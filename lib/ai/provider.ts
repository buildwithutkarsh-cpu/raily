/* ══════════════════════════════════════════════════════════════
   Raily AI — Provider Layer (Client-Side Proxy)
   
   Calls our own /api/ai/chat endpoint instead of calling
   AI providers directly. API keys remain server-side only.
   
   Streaming Contract (guaranteed):
   1 onStart() at the beginning
   0+ onChunk() calls for text
   0+ onToolCall() calls
   0+ onToolResult() calls
   Exactly 1 onDone() OR exactly 1 onError()
   Exactly 1 cleanup() at the end
   ══════════════════════════════════════════════════════════════ */

import type {
  AIMessage,
  AIToolCall,
  AIToolDefinition,
  RequestId,
  StreamCallbacks,
} from "./types";
import { createLogger } from "./request-state";

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
  tools: AIToolDefinition[] = [],
  requestId?: RequestId,
  options?: { toolChoice?: "auto" | "none" }
): Promise<{
  content: string;
  toolCalls: AIToolCall[];
}> {
  const log = requestId ? createLogger(requestId) : null;
  log?.info(`createCompletion: ${messages.length} messages, ${tools.length} tools`);

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
        tool_choice: options?.toolChoice ?? (tools.length > 0 ? "auto" : "none"),
        _requestId: requestId, // Pass through for server-side logging
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

    log?.info(`createCompletion done: ${body?.data?.content?.length || 0} chars, ${body?.data?.toolCalls?.length || 0} tool calls`);

    return {
      content: body?.data?.content || "",
      toolCalls: body?.data?.toolCalls || [],
    };
  } catch (err: unknown) {
    clearTimeout(timeout);
    if (err instanceof AIProviderError) throw err;
    if (err instanceof Error && err.name === "AbortError") {
      log?.error("createCompletion timed out");
      throw new AITimeoutError();
    }
    log?.error(`createCompletion failed: ${err instanceof Error ? err.message : String(err)}`);
    throw new AIProviderError(
      err instanceof Error ? err.message : "AI request failed",
      "AI_REQUEST_FAILED"
    );
  }
}

/* ─── Streaming Completion (Guaranteed Contract) ─────────── */

/**
 * Guaranteed streaming lifecycle (every callback fires as specified):
 *
 *   onStart() — exactly once, before any other callback
 *   onChunk() — 0+ times for text deltas
 *   onToolCall() — 0+ times as tool calls are finalized
 *   onDone() — exactly once when the stream completes successfully
 *     OR
 *   onError() — exactly once when an error occurs
 *   cleanup() — exactly once, after onDone/onError
 *
 * No callback fires twice. If the stream is aborted/cancelled,
 * onError fires once and the function returns.
 */
export interface StreamAccumulator {
  /** Final accumulated text content */
  fullContent: string;
  /** Final accumulated tool calls */
  toolCalls: AIToolCall[];
}

/**
 * Default empty accumulator — the provider mutates this object
 * so the caller can read the final state after the function completes.
 */
export function createStreamAccumulator(): StreamAccumulator {
  return { fullContent: "", toolCalls: [] };
}

export async function createStreamingCompletion(
  messages: AIMessage[],
  tools: AIToolDefinition[] = [],
  callbacks: Partial<StreamCallbacks>,
  requestId?: RequestId,
  /**
   * Mutable accumulator that receives the final content and tool calls.
   * The caller can read this after the promise resolves.
   */
  accumulator?: StreamAccumulator
): Promise<void> {
  const log = requestId ? createLogger(requestId) : null;
  let cleanupCalled = false;
  let completedOrErrored = false;

  // Guard to ensure cleanup fires exactly once
  const safeCleanup = () => {
    if (cleanupCalled) return;
    cleanupCalled = true;
    try {
      callbacks.cleanup?.();
    } catch (err: unknown) {
      // cleanup must never throw
      log?.error(`cleanup callback threw: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  // Guard to ensure onDone/onError fires exactly once
  const safeComplete = (type: "done" | "error", ...args: unknown[]) => {
    if (completedOrErrored) {
      log?.warn(`Stream already ${completedOrErrored ? "completed" : "errored"} — ignoring duplicate ${type}`);
      return;
    }
    completedOrErrored = true;

    try {
      if (type === "done") {
        callbacks.onDone?.(args[0] as string, requestId || "");
      } else {
        callbacks.onError?.(args[0] as Error, requestId || "");
      }
    } finally {
      safeCleanup();
    }
  };

  try {
    // ── 1. Fire onStart ────────────────────────────────────
    callbacks.onStart?.();
    log?.info("createStreamingCompletion: onStart fired");

    // ── 2. Prepare fetch ───────────────────────────────────
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60_000);

    log?.info("createStreamingCompletion: fetching /api/ai/chat");
    const response = await fetch(getApiUrl(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages,
        tools: tools.length > 0 ? tools : undefined,
        stream: true,
        _requestId: requestId,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);
    log?.info(`createStreamingCompletion: received AI proxy response ${response.status} ${response.statusText}`);
    log?.info(`createStreamingCompletion: response headers: ${JSON.stringify(Object.fromEntries(response.headers.entries()))}`);

    // Handle non-200 status codes
    if (response.status === 429) {
      const retryAfter = parseInt(response.headers.get("Retry-After") || "30");
      safeComplete("error", new AIRateLimitError(retryAfter));
      return;
    }

    if (!response.ok) {
      let errorMessage = `AI request failed (${response.status})`;
      try {
        const body = await response.json();
        errorMessage = body?.error?.message || errorMessage;
      } catch {
        // Response body is not JSON — use default message
      }
      safeComplete("error",
        new AIProviderError(errorMessage, bodyErrorCode(response), response.status)
      );
      return;
    }

    // ── 3. Read the stream ─────────────────────────────────
    const reader = response.body?.getReader();
    if (!reader) {
      log?.error("createStreamingCompletion: no response body reader available");
      safeComplete("error", new AIProviderError("No response body", "AI_NO_BODY"));
      return;
    }

    const decoder = new TextDecoder();
    let fullContent = "";
    const toolCalls: AIToolCall[] = [];
    let buffer = "";
    let streamError: Error | null = null;

    const processLine = (line: string) => {
      if (!line.trim()) return;

      let parsed: Record<string, unknown>;
      try {
        parsed = JSON.parse(line);
      } catch {
        log?.warn(`Malformed stream line (${line.slice(0, 80)})`);
        return;
      }

      const type = parsed.type;
      log?.info(`createStreamingCompletion: parsed stream event type=${type}`);

      if (type === "chunk") {
        const data = parsed.data as string | undefined;
        if (!data) return;

        let chunk: Record<string, unknown>;
        try {
          chunk = JSON.parse(data);
        } catch {
          log?.warn(`Malformed chunk data: ${(data as string)?.slice(0, 80)}`);
          return;
        }

        const delta = (chunk.choices as Array<Record<string, unknown>>)?.[0]?.delta as Record<string, unknown> | undefined;

        if (delta?.content) {
          const textContent = delta.content as string;
          fullContent += textContent;
          callbacks.onChunk?.(textContent, requestId || "");
        }

        if (delta?.tool_calls) {
          const rawToolCalls = delta.tool_calls as Array<Record<string, unknown>>;
          for (const tc of rawToolCalls) {
            // OpenAI/Groq streams send the tool-call `id` + `function.name`
            // ONLY on the first fragment; later fragments carry just
            // `index` + `function.arguments`. Key on `index` when present
            // (fall back to `id` for providers that include it each chunk)
            // so fragmented arguments join their tool call instead of
            // creating broken duplicate entries.
            const tcIndex = typeof tc.index === "number" ? tc.index : undefined;
            const tcId = tc.id as string | undefined;
            const existing =
              tcIndex !== undefined && tcIndex >= 0 && tcIndex < toolCalls.length
                ? toolCalls[tcIndex]
                : tcId
                  ? toolCalls.find((t) => t.id === tcId)
                  : undefined;

            if (existing) {
              existing.function.arguments += (tc.function as Record<string, unknown>)?.arguments || "";
            } else {
              const fnData = (tc.function as Record<string, unknown>) || {};
              toolCalls.push({
                id: tcId || `call_${toolCalls.length}`,
                type: "function",
                function: {
                  name: (fnData.name as string) || "",
                  arguments: (fnData.arguments as string) || "",
                },
              });
            }
          }
        }
      } else if (type === "done") {
        // Stream complete signal from server
      } else if (type === "error") {
        streamError = new AIProviderError(
          (parsed.message as string) || "AI stream error",
          (parsed.code as string) || "AI_STREAM_ERROR"
        );
      }
    };

    while (true) {
      let readResult: ReadableStreamReadResult<Uint8Array>;
      try {
        // Add per-read timeout to prevent client hang if server stream stalls
        const readPromise = reader.read();
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("Stream read timeout (30s)")), 30_000)
        );
        readResult = await Promise.race([readPromise, timeoutPromise]);
      } catch (err: unknown) {
        streamError = err instanceof Error ? err : new Error("Stream read failed");
        break;
      }

      const { done, value } = readResult;
      if (done) {
        log?.info("Stream reader returned done=true");
        if (buffer.trim()) {
          processLine(buffer);
          buffer = "";
        }
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        processLine(line);
        if (streamError) break;
      }

      if (streamError) break;
    }

    // ── 4. Handle stream error ─────────────────────────────
    if (streamError) {
      safeComplete("error", streamError);
      return;
    }

    // ── 5. Finalize tool calls ────────────────────────────
    for (const tc of toolCalls) {
      // Validate JSON arguments — recover gracefully with "{}" for invalid
      try {
        JSON.parse(tc.function.arguments);
      } catch {
        log?.warn(`Tool call ${tc.id} (${tc.function.name}) has malformed arguments, using {}`);
        tc.function.arguments = "{}";
      }
      callbacks.onToolCall?.(tc, requestId || "");
    }

    // Populate the accumulator so the caller can read final state
    if (accumulator) {
      accumulator.fullContent = fullContent;
      accumulator.toolCalls = toolCalls;
    }

    // ── 6. Fire onDone ────────────────────────────────────
    log?.info(`createStreamingCompletion done: ${fullContent.length} chars, ${toolCalls.length} tool calls`);
    safeComplete("done", fullContent);

  } catch (err: unknown) {
    // Catch-all for unexpected errors (fetch failures, etc.)
    if (completedOrErrored) {
      log?.error(`Stream already completed but caught additional error: ${err instanceof Error ? err.message : String(err)}`);
      safeCleanup();
      return;
    }

    if (err instanceof Error && err.name === "AbortError") {
      safeComplete("error", new AITimeoutError());
    } else {
      safeComplete("error",
        err instanceof AIProviderError
          ? err
          : new AIProviderError(err instanceof Error ? err.message : "Streaming failed")
      );
    }
  }
}

/* ─── Helpers ──────────────────────────────────────────────── */

function bodyErrorCode(response: Response): string {
  if (response.status === 429) return "AI_RATE_LIMIT";
  if (response.status === 408) return "AI_TIMEOUT";
  if (response.status >= 500) return "AI_SERVER_ERROR";
  return "AI_REQUEST_FAILED";
}

/* ─── Provider Health Check ──────────────────────────────── */

export async function checkAIProviderHealth(requestId?: RequestId): Promise<{
  configured: boolean;
  reachable: boolean;
  provider: string;
  model?: string;
  latency?: string;
  healthy?: boolean;
}> {
  try {
    const response = await fetch("/api/ai/health", {
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      return { configured: false, reachable: false, provider: "unknown" };
    }

    const body = await response.json();
    return {
      configured: body?.data?.configured ?? false,
      reachable: body?.data?.reachable ?? false,
      provider: body?.data?.provider ?? "unknown",
      model: body?.data?.model,
      latency: body?.latency,
      healthy: body?.data?.healthy ?? false,
    };
  } catch (err: unknown) {
    if (requestId) {
      const log = createLogger(requestId);
      log.warn(`Health check failed: ${err instanceof Error ? err.message : String(err)}`);
    }
    return { configured: false, reachable: false, provider: "unknown" };
  }
}
