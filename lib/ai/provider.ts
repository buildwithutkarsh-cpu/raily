/* ══════════════════════════════════════════════════════════════
   Raily AI — Provider Layer (Client-Side Proxy)
   
   Calls our own /api/ai/chat endpoint instead of calling
   AI providers directly. API keys remain server-side only.
   
   Supported providers (configurable server-side in .env.local):
   - Groq (default)
   - OpenRouter (fallback)
   ══════════════════════════════════════════════════════════════ */

import type {
  AIMessage,
  AIToolCall,
  AIToolDefinition,
} from "./types";

/* ─── Error Classes ───────────────────────────────────────── */

export class AIProviderError extends Error {
  constructor(
    message: string,
    public code: string = "AI_PROVIDER_ERROR",
    public status?: number
  ) {
    super(message);
    this.name = "AIProviderError";
  }
}

export class AIRateLimitError extends AIProviderError {
  constructor(retryAfter = 30) {
    super("Rate limited by AI provider", "AI_RATE_LIMIT", 429);
    this.name = "AIRateLimitError";
  }
}

export class AITimeoutError extends AIProviderError {
  constructor() {
    super("AI provider request timed out", "AI_TIMEOUT", 408);
    this.name = "AITimeoutError";
  }
}

/* ─── API Base URL ───────────────────────────────────────── */

function getApiUrl(): string {
  return "/api/ai/chat";
}

/* ─── Non-Streaming Completion ───────────────────────────── */

export async function createCompletion(
  messages: AIMessage[],
  tools: AIToolDefinition[] = []
): Promise<{
  content: string;
  toolCalls: AIToolCall[];
}> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);

  try {
    const response = await fetch(getApiUrl(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages,
        tools: tools.length > 0 ? tools : undefined,
        stream: false,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    const body = await response.json();

    if (!response.ok) {
      const code = body?.error?.code || "AI_REQUEST_FAILED";
      const message = body?.error?.message || `AI request failed (${response.status})`;

      if (response.status === 429) {
        throw new AIRateLimitError();
      }
      throw new AIProviderError(message, code, response.status);
    }

    return {
      content: body?.data?.content || "",
      toolCalls: body?.data?.toolCalls || [],
    };
  } catch (err: any) {
    clearTimeout(timeout);
    if (err instanceof AIProviderError) throw err;
    if (err.name === "AbortError") throw new AITimeoutError();
    throw new AIProviderError(
      err?.message || "AI request failed",
      "AI_REQUEST_FAILED"
    );
  }
}

/* ─── Streaming Completion ───────────────────────────────── */

export async function createStreamingCompletion(
  messages: AIMessage[],
  tools: AIToolDefinition[] = [],
  callbacks: {
    onText: (text: string) => void;
    onToolCall: (toolCall: AIToolCall) => void;
    onDone: (fullContent: string, toolCalls: AIToolCall[]) => void;
    onError: (error: Error) => void;
  }
): Promise<void> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60_000);

  try {
    const response = await fetch(getApiUrl(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages,
        tools: tools.length > 0 ? tools : undefined,
        stream: true,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (response.status === 429) {
      const retryAfter = parseInt(
        response.headers.get("Retry-After") || "30"
      );
      callbacks.onError(new AIRateLimitError(retryAfter));
      return;
    }

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      callbacks.onError(
        new AIProviderError(
          body?.error?.message || `AI request failed (${response.status})`,
          body?.error?.code || "AI_REQUEST_FAILED",
          response.status
        )
      );
      return;
    }

    const reader = response.body?.getReader();
    if (!reader) {
      callbacks.onError(new AIProviderError("No response body", "AI_NO_BODY"));
      return;
    }

    const decoder = new TextDecoder();
    let fullContent = "";
    let toolCalls: AIToolCall[] = [];
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (!line.trim()) continue;

        try {
          const parsed = JSON.parse(line);
          const type = parsed.type;

          if (type === "chunk") {
            // Forwarded SSE chunk from the provider
            const data = parsed.data;
            if (!data) continue;

            try {
              const chunk = JSON.parse(data);
              const delta = chunk.choices?.[0]?.delta;

              if (delta?.content) {
                fullContent += delta.content;
                callbacks.onText(delta.content);
              }

              if (delta?.tool_calls) {
                for (const tc of delta.tool_calls) {
                  const existing = toolCalls.find((t) => t.id === tc.id);
                  if (existing) {
                    existing.function.arguments += tc.function?.arguments || "";
                  } else {
                    toolCalls.push({
                      id: tc.id,
                      type: "function",
                      function: {
                        name: tc.function?.name || "",
                        arguments: tc.function?.arguments || "",
                      },
                    });
                  }
                }
              }
            } catch {
              // Skip malformed JSON chunks
            }
          } else if (type === "done") {
            // Stream complete
          } else if (type === "error") {
            callbacks.onError(
              new AIProviderError(
                parsed.message || "AI stream error",
                parsed.code || "AI_STREAM_ERROR"
              )
            );
            return;
          }
        } catch {
          // Skip malformed lines
        }
      }
    }

    // Finalize tool calls — validate JSON arguments
    for (const tc of toolCalls) {
      try {
        JSON.parse(tc.function.arguments);
      } catch {
        tc.function.arguments = "{}";
      }
      callbacks.onToolCall(tc);
    }

    callbacks.onDone(fullContent, toolCalls);
  } catch (err: any) {
    clearTimeout(timeout);
    if (err.name === "AbortError") {
      callbacks.onError(new AITimeoutError());
    } else {
      callbacks.onError(
        err instanceof AIProviderError
          ? err
          : new AIProviderError(err?.message || "Streaming failed")
      );
    }
  }
}

/* ─── Provider Health Check ──────────────────────────────── */

export async function checkAIProviderHealth(): Promise<{
  configured: boolean;
  reachable: boolean;
  provider: string;
}> {
  try {
    const response = await fetch(getApiUrl(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [{ role: "user", content: "ping" }],
        stream: false,
      }),
      signal: AbortSignal.timeout(10_000),
    });

    if (response.ok) return { configured: true, reachable: true, provider: "proxy" };
    if (response.status === 400) {
      // AI_NOT_CONFIGURED returns 400
      const body = await response.json().catch(() => ({}));
      const configured = body?.error?.code !== "AI_NOT_CONFIGURED";
      return { configured, reachable: true, provider: "proxy" };
    }
    return { configured: true, reachable: false, provider: "proxy" };
  } catch {
    return { configured: false, reachable: false, provider: "proxy" };
  }
}
