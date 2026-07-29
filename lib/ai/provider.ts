/* ══════════════════════════════════════════════════════════════
   Raily AI — Provider Layer
   
   Client-side AI provider that supports Groq (primary) and
   OpenRouter (fallback). Switching providers requires changing
   one line in .env.local.
   ══════════════════════════════════════════════════════════════ */

import type {
  AIProviderConfig,
  AIMessage,
  AIToolCall,
  AIToolDefinition,
  AIProviderType,
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

/* ─── Configuration ──────────────────────────────────────── */

function getConfig(): AIProviderConfig {
  const provider = (process.env.NEXT_PUBLIC_AI_PROVIDER || "groq") as AIProviderType;

  if (provider === "openrouter") {
    return {
      provider: "openrouter",
      model: process.env.NEXT_PUBLIC_OPENROUTER_MODEL || "google/gemini-2.0-flash-001",
      apiKey: process.env.NEXT_PUBLIC_OPENROUTER_API_KEY || "",
      baseUrl: "https://openrouter.ai/api/v1",
      maxTokens: 4096,
      temperature: 0.3,
    };
  }

  // Default: Groq
  return {
    provider: "groq",
    model: process.env.NEXT_PUBLIC_GROQ_MODEL || "llama-3.3-70b-versatile",
    apiKey: process.env.NEXT_PUBLIC_GROQ_API_KEY || "",
    baseUrl: "https://api.groq.com/openai/v1",
    maxTokens: 4096,
    temperature: 0.3,
  };
}

/* ─── Request Builder ────────────────────────────────────── */

interface ChatCompletionRequest {
  model: string;
  messages: Array<{
    role: string;
    content: string;
    tool_call_id?: string;
    tool_calls?: Array<{
      id: string;
      type: "function";
      function: { name: string; arguments: string };
    }>;
    name?: string;
  }>;
  tools?: Array<{
    type: "function";
    function: {
      name: string;
      description: string;
      strict: boolean;
      parameters: {
        type: "object";
        properties: Record<string, unknown>;
        required: string[];
        additionalProperties: boolean;
      };
    };
  }>;
  tool_choice?: "auto" | "none" | "required";
  max_tokens: number;
  temperature: number;
  stream: boolean;
}

function buildRequest(
  messages: AIMessage[],
  tools: AIToolDefinition[],
  stream: boolean
): ChatCompletionRequest {
  const config = getConfig();
  return {
    model: config.model,
    messages: messages.map((m) => {
      const base: Record<string, unknown> = { role: m.role, content: m.content };
      if (m.tool_call_id) base.tool_call_id = m.tool_call_id;
      if (m.tool_calls) base.tool_calls = m.tool_calls;
      if (m.name) base.name = m.name;
      return base as ChatCompletionRequest["messages"][0];
    }),
    tools: tools.length > 0 ? (tools as ChatCompletionRequest["tools"]) : undefined,
    tool_choice: tools.length > 0 ? "auto" : "none",
    max_tokens: config.maxTokens,
    temperature: config.temperature,
    stream,
  };
}

/* ─── Non-Streaming Completion ───────────────────────────── */

export async function createCompletion(
  messages: AIMessage[],
  tools: AIToolDefinition[] = []
): Promise<{
  content: string;
  toolCalls: AIToolCall[];
}> {
  const config = getConfig();
  if (!config.apiKey) {
    throw new AIProviderError(
      "AI provider not configured. Set NEXT_PUBLIC_GROQ_API_KEY or NEXT_PUBLIC_OPENROUTER_API_KEY in .env.local",
      "AI_NOT_CONFIGURED",
      400
    );
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);

  try {
    const response = await fetch(`${config.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`,
        ...(config.provider === "openrouter"
          ? { "HTTP-Referer": "https://raily.app", "X-Title": "Raily" }
          : {}),
      },
      body: JSON.stringify(buildRequest(messages, tools, false)),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (response.status === 429) {
      const retryAfter = parseInt(
        response.headers.get("Retry-After") || "30"
      );
      throw new AIRateLimitError(retryAfter);
    }

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new AIProviderError(
        `AI provider error: ${response.status}${body ? ` — ${body.slice(0, 200)}` : ""}`,
        "AI_PROVIDER_ERROR",
        response.status
      );
    }

    const data = await response.json();
    const choice = data.choices?.[0];
    const message = choice?.message;

    return {
      content: message?.content || "",
      toolCalls: message?.tool_calls || [],
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
  const config = getConfig();
  if (!config.apiKey) {
    callbacks.onError(
      new AIProviderError(
        "AI provider not configured. Set NEXT_PUBLIC_GROQ_API_KEY or NEXT_PUBLIC_OPENROUTER_API_KEY in .env.local",
        "AI_NOT_CONFIGURED",
        400
      )
    );
    return;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60_000);

  try {
    const response = await fetch(`${config.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`,
        ...(config.provider === "openrouter"
          ? { "HTTP-Referer": "https://raily.app", "X-Title": "Raily" }
          : {}),
      },
      body: JSON.stringify(buildRequest(messages, tools, true)),
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
      const body = await response.text().catch(() => "");
      callbacks.onError(
        new AIProviderError(
          `AI provider error: ${response.status}${body ? ` — ${body.slice(0, 200)}` : ""}`,
          "AI_PROVIDER_ERROR",
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
        if (!line.startsWith("data: ")) continue;
        const data = line.slice(6).trim();
        if (data === "[DONE]") continue;
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
      }
    }

    // Finalize tool calls
    for (const tc of toolCalls) {
      // Parse accumulated arguments
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
  const config = getConfig();
  const configured = !!config.apiKey;

  if (!configured) {
    return { configured: false, reachable: false, provider: config.provider };
  }

  try {
    const response = await fetch(`${config.baseUrl}/models`, {
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
      },
      signal: AbortSignal.timeout(5000),
    });
    return {
      configured: true,
      reachable: response.ok,
      provider: config.provider,
    };
  } catch {
    return { configured: true, reachable: false, provider: config.provider };
  }
}