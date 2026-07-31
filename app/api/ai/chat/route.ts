/* ══════════════════════════════════════════════════════════════
   RAILY — AI Chat API Route (Server-Side Proxy)
   
   This route proxies AI provider requests so that API keys
   are NEVER exposed to the client bundle. The client sends
   messages and tools; this route adds the API key server-side.
   
   POST /api/ai/chat
   
   Body:
     { messages: AIMessage[], tools?: AIToolDefinition[], stream?: boolean }
   
   For streaming requests (stream: true), returns a SSE stream.
   For non-streaming requests, returns JSON.
   ══════════════════════════════════════════════════════════════ */

import { NextRequest } from "next/server";
import { getServerConfig } from "@/lib/ai/server-config";

/* ─── Types ──────────────────────────────────────────────── */

interface ChatRequest {
  messages: Array<{
    role: string;
    content: string;
    tool_call_id?: string;
    name?: string;
  }>;
  tools?: Array<Record<string, unknown>>;
  stream?: boolean;
  /** Explicit tool_choice override. Defaults to "auto" when tools present, "none" otherwise. */
  tool_choice?: string;
}

/* ─── Groq Error Extraction ───────────────────────────────── */

/**
 * Groq returns 400 tool_use_failed / schema errors as a JSON body with
 * { error: { message, code, type } }. Extract the human-readable message
 * so the client can surface it instead of raw JSON.
 */
function extractErrorMessage(raw: string): string {
  try {
    const parsed = JSON.parse(raw);
    const message = parsed?.error?.message;
    if (typeof message === "string" && message.trim()) {
      return message.slice(0, 500);
    }
  } catch {
    // Not JSON — fall through to raw text
  }
  return raw.slice(0, 300);
}

/* ─── Error Responses ────────────────────────────────────── */

function errorResponse(message: string, status: number, code?: string) {
  return Response.json(
    {
      success: false,
      error: {
        code: code || "AI_PROXY_ERROR",
        message,
        retryable: status >= 500,
      },
    },
    { status }
  );
}

/* ─── Request Body Validation ────────────────────────────── */

function validateRequest(body: unknown): { valid: true; data: ChatRequest } | { valid: false; error: string } {
  if (!body || typeof body !== "object") {
    return { valid: false, error: "Request body must be a JSON object" };
  }

  const req = body as Record<string, unknown>;

  if (!Array.isArray(req.messages) || req.messages.length === 0) {
    return { valid: false, error: "messages must be a non-empty array" };
  }

  for (const msg of req.messages) {
    if (!msg || typeof msg !== "object") {
      return { valid: false, error: "Each message must be an object" };
    }
    if (typeof (msg as Record<string, unknown>).role !== "string") {
      return { valid: false, error: "Each message must have a 'role' string" };
    }
  }

  return { valid: true, data: body as ChatRequest };
}

/* ─── Tool Schema Normalization ─────────────────────────── */

function sanitizeToolDefinitions(tools: Array<Record<string, unknown>> | undefined) {
  if (!Array.isArray(tools) || tools.length === 0) {
    return undefined;
  }

  return tools.map((tool) => {
    if (!tool || typeof tool !== "object") {
      return tool;
    }

    const toolRecord = tool as Record<string, unknown>;
    const functionDefinition = toolRecord.function;

    if (functionDefinition && typeof functionDefinition === "object") {
      const functionRecord = functionDefinition as Record<string, unknown>;
      const parameters = functionRecord.parameters;

      if (parameters && typeof parameters === "object") {
        const schema = parameters as Record<string, unknown>;

        if (!schema.type || typeof schema.type !== "string") {
          schema.type = "object";
        }

        const properties = schema.properties;
        if (!properties || typeof properties !== "object" || Array.isArray(properties)) {
          schema.properties = {};
        }

        // NOTE: do NOT delete empty `required` arrays. Groq strict-mode requires
        // `required` to be supplied for every tool (including zero-property tools
        // like getHealth, which must send `required: []`). Deleting it causes
        // `invalid JSON schema for tool ...` errors.

        if (typeof schema.additionalProperties !== "boolean") {
          schema.additionalProperties = false;
        }

        functionRecord.parameters = schema;
      }
    }

    return toolRecord;
  });
}

/* ─── OpenAI-Compatible Chat Completion Call ─────────────── */

async function callProviderCompletion(config: ReturnType<typeof getServerConfig>, body: ChatRequest) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${config.apiKey}`,
  };

  if (config.provider === "openrouter") {
    headers["HTTP-Referer"] = "https://raily.app";
    headers["X-Title"] = "Raily";
  }

  const normalizedTools = sanitizeToolDefinitions(body.tools as Array<Record<string, unknown>> | undefined);

  const requestBody = {
    model: config.model,
    messages: body.messages,
    tools: normalizedTools && normalizedTools.length > 0 ? normalizedTools : undefined,
    tool_choice: body.tool_choice ?? (normalizedTools && normalizedTools.length > 0 ? "auto" : "none"),
    max_tokens: config.maxTokens,
    temperature: config.temperature,
    stream: false,
  };

  const response = await fetch(`${config.baseUrl}/chat/completions`, {
    method: "POST",
    headers,
    body: JSON.stringify(requestBody),
    signal: AbortSignal.timeout(30_000),
  });

  if (response.status === 429) {
    const retryAfter = parseInt(response.headers.get("Retry-After") || "30");
    throw { code: "AI_RATE_LIMIT", status: 429, message: `Rate limited. Retry after ${retryAfter}s`, retryable: true };
  }

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw { code: "AI_PROVIDER_ERROR", status: response.status, message: extractErrorMessage(text), retryable: response.status >= 500 };
  }

  return response.json();
}

/* ─── Streaming Chat Completion ──────────────────────────── */

async function* streamProviderCompletion(config: ReturnType<typeof getServerConfig>, body: ChatRequest) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${config.apiKey}`,
  };

  if (config.provider === "openrouter") {
    headers["HTTP-Referer"] = "https://raily.app";
    headers["X-Title"] = "Raily";
  }

  const normalizedTools = sanitizeToolDefinitions(body.tools as Array<Record<string, unknown>> | undefined);

  const requestBody = {
    model: config.model,
    messages: body.messages,
    tools: normalizedTools && normalizedTools.length > 0 ? normalizedTools : undefined,
    tool_choice: body.tool_choice ?? (normalizedTools && normalizedTools.length > 0 ? "auto" : "none"),
    max_tokens: config.maxTokens,
    temperature: config.temperature,
    stream: true,
  };

  console.log(`[AI Chat] calling upstream provider: ${config.baseUrl}/chat/completions (model=${config.model})`);
  const response = await fetch(`${config.baseUrl}/chat/completions`, {
    method: "POST",
    headers,
    body: JSON.stringify(requestBody),
    signal: AbortSignal.timeout(60_000),
  });

  console.log(`[AI Chat] upstream response: ${response.status} ${response.statusText}`);

  if (response.status === 429) {
    const retryAfter = parseInt(response.headers.get("Retry-After") || "30");
    console.warn(`[AI Chat] rate limited, retry-after: ${retryAfter}s`);
    yield JSON.stringify({ type: "error", code: "AI_RATE_LIMIT", message: `Rate limited. Retry after ${retryAfter}s`, retryable: true });
    return;
  }

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    console.error(`[AI Chat] upstream error: ${response.status} - ${text.slice(0, 300)}`);
    yield JSON.stringify({ type: "error", code: "AI_PROVIDER_ERROR", message: extractErrorMessage(text), retryable: response.status >= 500 });
    return;
  }

  const reader = response.body?.getReader();
  if (!reader) {
    console.error("[AI Chat] no response body reader from upstream");
    yield JSON.stringify({ type: "error", code: "AI_NO_BODY", message: "No response body from provider" });
    return;
  }

  const decoder = new TextDecoder();
  let buffer = "";
  let lineCount = 0;
  let doneReceived = false;

  // Add a stream-level timeout to prevent infinite hang
  const streamTimeout = setTimeout(() => {
    console.error("[AI Chat] STREAM TIMEOUT: no data for 90s, aborting reader");
    reader.cancel("Stream timeout").catch(() => {});
  }, 90_000);

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        console.log("[AI Chat] upstream reader done");
        if (buffer.trim()) {
          console.log("[AI Chat] flushing residual buffer", buffer);
          const line = buffer.trim();
          if (line.startsWith("data: ")) {
            const data = line.slice(6).trim();
            if (data === "[DONE]") {
              doneReceived = true;
              console.log("[AI Chat] received [DONE] from upstream (flushed buffer)");
              yield JSON.stringify({ type: "done" });
            } else if (data) {
              yield JSON.stringify({ type: "chunk", data });
            }
          }
        }
        break;
      }

      clearTimeout(streamTimeout);
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        lineCount++;
        if (!line.startsWith("data: ")) continue;
        const data = line.slice(6).trim();
        if (data === "[DONE]") {
          doneReceived = true;
          console.log("[AI Chat] received [DONE] from upstream");
          yield JSON.stringify({ type: "done" });
          continue;
        }
        if (!data) continue;

        yield JSON.stringify({ type: "chunk", data });
      }
    }
  } catch (err: unknown) {
    console.error("[AI Chat] error reading upstream stream:", err);
    yield JSON.stringify({ type: "error", code: "AI_STREAM_READ_ERROR", message: err instanceof Error ? err.message : "Stream read failed" });
  } finally {
    clearTimeout(streamTimeout);
  }

  if (!doneReceived) {
    console.warn("[AI Chat] upstream closed without [DONE] marker");
  }
  console.log(`[AI Chat] stream completed: ${lineCount} SSE lines processed`);
  yield JSON.stringify({ type: "done" });
}

/* ─── POST Handler ───────────────────────────────────────── */

export async function POST(request: NextRequest) {
  // Parse and validate request body
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse("Invalid JSON in request body", 400);
  }

  const validation = validateRequest(body);
  if (!validation.valid) {
    return errorResponse(validation.error, 400, "INVALID_REQUEST");
  }

  // Get server-side config
  console.log("[AI Chat] POST /api/ai/chat received", { stream: validation.data.stream });
  const config = getServerConfig();
  if (!config.apiKey) {
    console.error("[AI Chat] missing API key");
    return errorResponse(
      "AI provider not configured. Set GROQ_API_KEY or OPENROUTER_API_KEY in .env.local",
      400,
      "AI_NOT_CONFIGURED"
    );
  }

  // Streaming response
  if (validation.data.stream) {
    const stream = new ReadableStream({
      async start(controller) {
        console.log("[AI Chat] starting streaming response to client");
        let chunkCount = 0;
        try {
          for await (const chunk of streamProviderCompletion(config, validation.data)) {
            chunkCount++;
            if (chunkCount === 1) console.log("[AI Chat] first chunk received from provider");
            if (chunkCount % 50 === 0) console.log(`[AI Chat] forwarded ${chunkCount} chunks`);
            controller.enqueue(new TextEncoder().encode(chunk + "\n"));
          }
          console.log(`[AI Chat] streamProviderCompletion completed, total chunks: ${chunkCount}`);
        } catch (err: unknown) {
          console.error("[AI Chat] streamProviderCompletion threw:", err);
          controller.enqueue(
            new TextEncoder().encode(
              JSON.stringify({ type: "error", code: "AI_STREAM_ERROR", message: err instanceof Error ? err.message : "Stream failed" }) + "\n"
            )
          );
        } finally {
          controller.close();
          console.log("[AI Chat] streaming response closed");
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        "X-Accel-Buffering": "no",
        Connection: "keep-alive",
      },
    });
  }

  // Non-streaming response
  try {
    const data = await callProviderCompletion(config, validation.data);
    const choice = data.choices?.[0];
    const message = choice?.message;

    return Response.json({
      success: true,
      data: {
        content: message?.content || "",
        toolCalls: message?.tool_calls || [],
      },
    });
  } catch (err: unknown) {
    console.error("[AI Chat] non-streaming provider error:", err);
    const errRecord = err as Record<string, unknown>;
    if (errRecord?.code) {
      return errorResponse(
        typeof errRecord.message === "string" ? errRecord.message : "AI request failed",
        typeof errRecord.status === "number" ? errRecord.status : 500,
        String(errRecord.code)
      );
    }
    return errorResponse(
      err instanceof Error ? err.message : "AI request failed",
      500,
      "AI_REQUEST_FAILED"
    );
  }
}
