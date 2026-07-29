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

  const requestBody = {
    model: config.model,
    messages: body.messages,
    tools: body.tools && body.tools.length > 0 ? body.tools : undefined,
    tool_choice: body.tools && body.tools.length > 0 ? "auto" : "none",
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
    throw { code: "AI_PROVIDER_ERROR", status: response.status, message: text.slice(0, 300), retryable: response.status >= 500 };
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

  const requestBody = {
    model: config.model,
    messages: body.messages,
    tools: body.tools && body.tools.length > 0 ? body.tools : undefined,
    tool_choice: body.tools && body.tools.length > 0 ? "auto" : "none",
    max_tokens: config.maxTokens,
    temperature: config.temperature,
    stream: true,
  };

  const response = await fetch(`${config.baseUrl}/chat/completions`, {
    method: "POST",
    headers,
    body: JSON.stringify(requestBody),
    signal: AbortSignal.timeout(60_000),
  });

  if (response.status === 429) {
    const retryAfter = parseInt(response.headers.get("Retry-After") || "30");
    yield JSON.stringify({ type: "error", code: "AI_RATE_LIMIT", message: `Rate limited. Retry after ${retryAfter}s`, retryable: true });
    return;
  }

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    yield JSON.stringify({ type: "error", code: "AI_PROVIDER_ERROR", message: text.slice(0, 300), retryable: response.status >= 500 });
    return;
  }

  const reader = response.body?.getReader();
  if (!reader) {
    yield JSON.stringify({ type: "error", code: "AI_NO_BODY", message: "No response body from provider" });
    return;
  }

  const decoder = new TextDecoder();
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
      if (data === "[DONE]") {
        yield JSON.stringify({ type: "done" });
        continue;
      }
      if (!data) continue;

      // Forward the raw chunk as-is — the client handles parsing
      yield JSON.stringify({ type: "chunk", data });
    }
  }

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
  const config = getServerConfig();
  if (!config.apiKey) {
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
        try {
          for await (const chunk of streamProviderCompletion(config, validation.data)) {
            controller.enqueue(new TextEncoder().encode(chunk + "\n"));
          }
        } catch (err: unknown) {
          controller.enqueue(
            new TextEncoder().encode(
              JSON.stringify({ type: "error", code: "AI_STREAM_ERROR", message: err instanceof Error ? err.message : "Stream failed" }) + "\n"
            )
          );
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
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
