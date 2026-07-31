/* ══════════════════════════════════════════════════════════════
   RAILY — AI Pipeline End-to-End Verification
   ══════════════════════════════════════════════════════════════
   QA harness. Drives the REAL pipeline modules (orchestrator,
   provider, FSM, tools) against a MOCKED `/api/ai/chat` transport
   so every stage is exercised deterministically — no API key needed.

   Covers:
   - Callback contract: exactly one onDone OR one onError, cleanup once
   - Terminal state guarantees (COMPLETE / ERROR / no hang)
   - Tool-call flow incl. second pass re-sending tools + tool_choice
   - Multi-tool parallel flow (the former FSM force-terminate hang)
   - Provider error propagation (400 / 429 / network / stall / empty)
   - Tool schema strict-mode compliance + executeTool behaviors
   ══════════════════════════════════════════════════════════════ */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { processWithAI, processWithAISimple } from "./orchestrator";
import {
  createStreamingCompletion,
  createCompletion,
  createStreamAccumulator,
} from "./provider";
import { RAILWAY_TOOLS, executeTool } from "./tools";
import { RequestStateMachine } from "./request-state";
import { resetConversationMemory } from "./memory";
import { RequestState, TERMINAL_STATES } from "./types";
import type { AIMessage, AIComponentType } from "./types";
import type { OrchestrationCallbacks } from "./orchestrator";

/* ─── Transport Mock ────────────────────────────────────────── */

type ChatHandler = (body: Record<string, unknown>) => Response | Promise<Response>;

interface FetchMockOptions {
  chat: ChatHandler;
  rapi?: (url: string) => Response;
  ticket?: () => Response;
  fail?: boolean;
}

function jsonResponse(obj: unknown, status = 200): Response {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/** Build an SSE-style response: one JSON line per chunk, matching the route's wire format. */
function streamResponse(lines: string[]): Response {
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const line of lines) {
        controller.enqueue(encoder.encode(line + "\n"));
      }
      controller.close();
    },
  });
  return new Response(body, {
    status: 200,
    headers: { "Content-Type": "text/event-stream" },
  });
}

function chunkEvent(data: unknown): string {
  return JSON.stringify({ type: "chunk", data: JSON.stringify(data) });
}
function doneEvent(): string {
  return JSON.stringify({ type: "done" });
}
function textChunk(text: string): string {
  return chunkEvent({ id: "chunk_1", choices: [{ delta: { content: text } }] });
}
function toolChunk(name: string, args: string, id = "call_1"): string {
  return chunkEvent({
    id: "chunk_1",
    choices: [{ delta: { tool_calls: [{ id, type: "function", function: { name, arguments: args } }] } }],
  });
}

function rapiStationResponse(): Response {
  return jsonResponse({
    success: true,
    data: {
      query: "mumbai",
      total: 1,
      stations: [{ code: "BCT", name: "Mumbai Central", state: "Maharashtra", zone: "WR" }],
    },
    cached: false,
  });
}

let restoreFetch: (() => void) | null = null;

function installFetchMock(opts: FetchMockOptions): void {
  const original = global.fetch;
  global.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    if (opts.fail) throw new TypeError("fetch failed");
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : String((input as Request).url || input);
    if (url.includes("/api/ai/chat")) {
      const body = JSON.parse(String(init?.body ?? "{}"));
      return opts.chat(body);
    }
    if (url.includes("/api/ticket/send") && opts.ticket) return opts.ticket();
    if (opts.rapi) return opts.rapi(url);
    return jsonResponse({ success: false, error: "endpoint not mocked" }, 500);
  });
  restoreFetch = () => {
    global.fetch = original;
  };
}

/* ─── Helpers ───────────────────────────────────────────────── */

interface CallRecord {
  calls: string[];
  callbacks: OrchestrationCallbacks;
}

function fullCallbacks(): CallRecord {
  const calls: string[] = [];
  return {
    calls,
    callbacks: {
      onText: (t: string) => calls.push(`text:${t}`),
      onToolCall: (n: string) => calls.push(`toolcall:${n}`),
      onToolResult: (n: string) => calls.push(`toolresult:${n}`),
      onComponent: (c: AIComponentType) => calls.push(`component:${c}`),
      onDone: (c: unknown) => calls.push(`done:${c}`),
      onError: (e: string) => calls.push(`error:${e}`),
      onEvents: () => calls.push("events"),
    },
  };
}

const terminalCount = (calls: string[]): number =>
  calls.filter((c) => c.startsWith("done:") || c.startsWith("error:")).length;

beforeEach(() => {
  resetConversationMemory();
  restoreFetch = null;
});

afterEach(() => {
  restoreFetch?.();
  restoreFetch = null;
});

/* ══════════════════════════════════════════════════════════════
   SECTION 1 — Provider: createCompletion
   ══════════════════════════════════════════════════════════════ */

describe("createCompletion (non-streaming)", () => {
  it("sends tools + tool_choice from options (second-pass shape)", async () => {
    let captured: Record<string, unknown> | undefined;
    installFetchMock({
      chat: (body) => {
        captured = body;
        return jsonResponse({ success: true, data: { content: "ok", toolCalls: [] } });
      },
    });
    await createCompletion(
      [{ role: "user", content: "hi" }],
      RAILWAY_TOOLS,
      "req_1",
      { toolChoice: "none" }
    );
    expect(captured?.tool_choice).toBe("none");
    expect(Array.isArray(captured?.tools)).toBe(true);
    expect((captured?.tools as unknown[]).length).toBe(RAILWAY_TOOLS.length);
  });

  it("sends tool_choice auto by default when tools are present", async () => {
    let captured: Record<string, unknown> | undefined;
    installFetchMock({
      chat: (body) => {
        captured = body;
        return jsonResponse({ success: true, data: { content: "ok", toolCalls: [] } });
      },
    });
    await createCompletion([{ role: "user", content: "hi" }], RAILWAY_TOOLS, "req_1");
    expect(captured?.tool_choice).toBe("auto");
  });

  it("throws AIProviderError on 400 (tool_use_failed proxy)", async () => {
    installFetchMock({
      chat: () =>
        jsonResponse(
          { success: false, error: { code: "AI_PROVIDER_ERROR", message: "tool call validation failed" } },
          400
        ),
    });
    await expect(
      createCompletion([{ role: "user", content: "hi" }], [], "req_1")
    ).rejects.toMatchObject({ code: "AI_PROVIDER_ERROR", status: 400 });
  });

  it("throws AIRateLimitError on 429", async () => {
    installFetchMock({
      chat: () => new Response(JSON.stringify({ error: { message: "rate limited" } }), { status: 429 }),
    });
    await expect(
      createCompletion([{ role: "user", content: "hi" }], [], "req_1")
    ).rejects.toMatchObject({ code: "AI_RATE_LIMIT" });
  });
});

/* ══════════════════════════════════════════════════════════════
   SECTION 2 — Provider: createStreamingCompletion
   ══════════════════════════════════════════════════════════════ */

describe("createStreamingCompletion (streaming)", () => {
  it("fires onStart → onChunk → onDone → cleanup in order, exactly once each", async () => {
    const order: string[] = [];
    installFetchMock({
      chat: () => streamResponse([textChunk("Hello"), textChunk(" world"), doneEvent()]),
    });
    const acc = createStreamAccumulator();
    await createStreamingCompletion(
      [{ role: "user", content: "hi" }],
      [],
      {
        onStart: () => order.push("start"),
        onChunk: () => order.push("chunk"),
        onDone: () => order.push("done"),
        onError: () => order.push("error"),
        cleanup: () => order.push("cleanup"),
      },
      "req_1",
      acc
    );
    expect(order).toEqual(["start", "chunk", "chunk", "done", "cleanup"]);
    expect(acc.fullContent).toBe("Hello world");
    expect(acc.toolCalls).toHaveLength(0);
  });

  it("accumulates split tool-call arguments across chunks into the accumulator", async () => {
    installFetchMock({
      chat: () =>
        streamResponse([
          chunkEvent({
            id: "x",
            choices: [{ delta: { tool_calls: [{ id: "call_1", type: "function", function: { name: "searchStations", arguments: '{"query":' } }] } }],
          }),
          chunkEvent({
            id: "x",
            choices: [{ delta: { tool_calls: [{ id: "call_1", type: "function", function: { arguments: '"Mumbai"}' } }] } }],
          }),
          doneEvent(),
        ]),
    });
    const acc = createStreamAccumulator();
    const onToolCall = vi.fn();
    await createStreamingCompletion([{ role: "user", content: "hi" }], [], { onToolCall }, "req_1", acc);
    expect(acc.toolCalls).toHaveLength(1);
    expect(acc.toolCalls[0].function.name).toBe("searchStations");
    expect(acc.toolCalls[0].function.arguments).toBe('{"query":"Mumbai"}');
    expect(onToolCall).toHaveBeenCalledTimes(1);
  });

  it("fires onError exactly once for an in-band error event (never onDone)", async () => {
    installFetchMock({
      chat: () =>
        streamResponse([
          JSON.stringify({ type: "error", code: "AI_PROVIDER_ERROR", message: "upstream 400" }),
        ]),
    });
    const onDone = vi.fn();
    const onError = vi.fn();
    const cleanup = vi.fn();
    await createStreamingCompletion(
      [{ role: "user", content: "hi" }],
      [],
      { onDone, onError, cleanup },
      "req_1"
    );
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onDone).not.toHaveBeenCalled();
    expect(cleanup).toHaveBeenCalledTimes(1);
  });

  it("fires onError on non-200 HTTP status", async () => {
    installFetchMock({ chat: () => jsonResponse({ error: { message: "boom" } }, 500) });
    const onDone = vi.fn();
    const onError = vi.fn();
    await createStreamingCompletion([{ role: "user", content: "hi" }], [], { onDone, onError }, "req_1");
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onDone).not.toHaveBeenCalled();
  });

  it("fires onError on network failure", async () => {
    installFetchMock({ chat: () => { throw new TypeError("network down"); } });
    const onDone = vi.fn();
    const onError = vi.fn();
    await createStreamingCompletion([{ role: "user", content: "hi" }], [], { onDone, onError }, "req_1");
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onDone).not.toHaveBeenCalled();
  });

  it("fires onError when the upstream stream stalls past the read timeout (no hang)", async () => {
    vi.useFakeTimers();
    installFetchMock({
      chat: () => {
        // Never enqueues and never closes → read() hangs forever.
        const body = new ReadableStream<Uint8Array>({ start() { /* noop */ } });
        return new Response(body, { status: 200 });
      },
    });
    try {
      const onError = vi.fn();
      const onDone = vi.fn();
      const promise = createStreamingCompletion(
        [{ role: "user", content: "hi" }],
        [],
        { onDone, onError },
        "req_1"
      );
      await vi.advanceTimersByTimeAsync(30_000 + 100);
      await promise;
      expect(onError).toHaveBeenCalledTimes(1);
      expect(onDone).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it("terminates cleanly on an empty stream (onDone with empty content)", async () => {
    installFetchMock({ chat: () => streamResponse([]) });
    const onDone = vi.fn();
    const onError = vi.fn();
    await createStreamingCompletion([{ role: "user", content: "hi" }], [], { onDone, onError }, "req_1");
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(onError).not.toHaveBeenCalled();
  });
});

/* ══════════════════════════════════════════════════════════════
   SECTION 3 — Orchestrator: processWithAI end-to-end
   ══════════════════════════════════════════════════════════════ */

describe("processWithAI (full pipeline)", () => {
  it("text-only flow reaches onDone once, no onError, machine COMPLETE", async () => {
    installFetchMock({
      chat: (body) => {
        if (body.stream === true) {
          return streamResponse([textChunk("Here are your trains."), doneEvent()]);
        }
        return jsonResponse({ success: true, data: { content: "", toolCalls: [] } });
      },
    });
    const { calls, callbacks } = fullCallbacks();
    await processWithAI("Show me trains from Delhi to Jaipur", callbacks);
    expect(calls.filter((c) => c.startsWith("done:"))).toHaveLength(1);
    expect(calls.filter((c) => c.startsWith("error:"))).toHaveLength(0);
    expect(terminalCount(calls)).toBe(1);
    expect(calls).toContain("text:Here are your trains.");
  });

  it("tool-call flow executes the tool, re-sends tools on second pass with tool_choice none, reaches onDone", async () => {
    const chatBodies: Array<Record<string, unknown>> = [];
    installFetchMock({
      chat: (body) => {
        chatBodies.push(body);
        if (body.stream === true) {
          return streamResponse([toolChunk("searchStations", '{"query":"Mumbai"}'), doneEvent()]);
        }
        return jsonResponse({ success: true, data: { content: "Found Mumbai Central (BCT).", toolCalls: [] } });
      },
      rapi: () => rapiStationResponse(),
    });
    const { calls, callbacks } = fullCallbacks();
    await processWithAI("Where is Mumbai station?", callbacks);
    expect(calls).toContain("toolcall:searchStations");
    expect(calls).toContain("toolresult:searchStations");
    // The second pass must include tools (Groq validates historical tool_calls
    // against request.tools) AND force tool_choice "none" to prevent re-calls.
    const secondPass = chatBodies.find((b) => b.stream === false);
    expect(secondPass).toBeDefined();
    expect(Array.isArray(secondPass!.tools)).toBe(true);
    expect((secondPass!.tools as unknown[]).length).toBe(RAILWAY_TOOLS.length);
    expect(secondPass!.tool_choice).toBe("none");
    // Exactly one terminal callback.
    expect(terminalCount(calls)).toBe(1);
    expect(calls.filter((c) => c.startsWith("done:"))).toHaveLength(1);
  });

  it("multi-tool parallel flow (2 searchStations) does NOT hang and reaches onDone (FSM loop fix)", async () => {
    installFetchMock({
      chat: (body) => {
        if (body.stream === true) {
          return streamResponse([
            toolChunk("searchStations", '{"query":"Delhi"}', "call_1"),
            toolChunk("searchStations", '{"query":"Jaipur"}', "call_2"),
            doneEvent(),
          ]);
        }
        return jsonResponse({ success: true, data: { content: "Delhi (NDLS) and Jaipur (JP) resolved.", toolCalls: [] } });
      },
      rapi: () => rapiStationResponse(),
    });
    const { calls, callbacks } = fullCallbacks();
    await processWithAI("Book Delhi to Jaipur tomorrow", callbacks);
    expect(calls.filter((c) => c.startsWith("toolcall:"))).toHaveLength(2);
    expect(calls.filter((c) => c.startsWith("toolresult:"))).toHaveLength(2);
    expect(calls.filter((c) => c.startsWith("done:"))).toHaveLength(1);
    expect(calls.filter((c) => c.startsWith("error:"))).toHaveLength(0);
    expect(terminalCount(calls)).toBe(1);
  });

  it("second-pass 400 (tool_use_failed proxy) fires onError exactly once", async () => {
    installFetchMock({
      chat: (body) => {
        if (body.stream === true) {
          return streamResponse([toolChunk("searchStations", '{"query":"Mumbai"}'), doneEvent()]);
        }
        return jsonResponse(
          { success: false, error: { code: "AI_PROVIDER_ERROR", message: "tool call validation failed: attempted to call tool 'searchStations' which was not in request.tools" } },
          400
        );
      },
      rapi: () => rapiStationResponse(),
    });
    const { calls, callbacks } = fullCallbacks();
    await processWithAI("Where is Mumbai?", callbacks);
    expect(calls.filter((c) => c.startsWith("error:"))).toHaveLength(1);
    expect(calls.filter((c) => c.startsWith("done:"))).toHaveLength(0);
    expect(terminalCount(calls)).toBe(1);
  });

  it("429 on first pass fires onError once", async () => {
    installFetchMock({
      chat: () =>
        new Response(JSON.stringify({ error: { message: "Rate limit reached" } }), {
          status: 429,
          headers: { "Retry-After": "5" },
        }),
    });
    const { calls, callbacks } = fullCallbacks();
    await processWithAI("hello", callbacks);
    expect(calls.filter((c) => c.startsWith("error:"))).toHaveLength(1);
    expect(terminalCount(calls)).toBe(1);
  });

  it("network failure fires onError once", async () => {
    installFetchMock({ chat: () => { throw new TypeError("fetch failed"); } });
    const { calls, callbacks } = fullCallbacks();
    await processWithAI("hello", callbacks);
    expect(calls.filter((c) => c.startsWith("error:"))).toHaveLength(1);
    expect(calls.filter((c) => c.startsWith("done:"))).toHaveLength(0);
    expect(terminalCount(calls)).toBe(1);
  });

  it("empty stream terminates with onDone (no hang)", async () => {
    installFetchMock({ chat: () => streamResponse([]) });
    const { calls, callbacks } = fullCallbacks();
    await processWithAI("hello", callbacks);
    expect(terminalCount(calls)).toBe(1);
  });

  it("malformed stream lines are skipped and the request still terminates", async () => {
    installFetchMock({
      chat: () =>
        streamResponse([
          "not-json{{",
          JSON.stringify({ type: "chunk", data: "{{{bad json" }),
          doneEvent(),
        ]),
    });
    const { calls, callbacks } = fullCallbacks();
    await processWithAI("hello", callbacks);
    expect(terminalCount(calls)).toBe(1);
  });
});

/* ══════════════════════════════════════════════════════════════
   SECTION 4 — processWithAISimple (non-streaming entry point)
   ══════════════════════════════════════════════════════════════ */

describe("processWithAISimple", () => {
  it("first pass returns tool call, second pass returns content, tools re-sent", async () => {
    installFetchMock({
      chat: (body) => {
        if (body.tool_choice === "auto") {
          return jsonResponse({
            success: true,
            data: {
              content: "",
              toolCalls: [
                { id: "call_1", type: "function", function: { name: "searchStations", arguments: '{"query":"Mumbai"}' } },
              ],
            },
          });
        }
        return jsonResponse({ success: true, data: { content: "Found BCT.", toolCalls: [] } });
      },
      rapi: () => rapiStationResponse(),
    });
    const result = await processWithAISimple("Where is Mumbai?");
    expect(result.toolCalls).toHaveLength(1);
    expect(result.content).toContain("BCT");
  });
});

/* ══════════════════════════════════════════════════════════════
   SECTION 5 — Tool schemas (Groq strict-mode compliance)
   ══════════════════════════════════════════════════════════════ */

describe("RAILWAY_TOOLS schema validity (Groq strict-mode)", () => {
  it.each(RAILWAY_TOOLS.map((t) => [t.function.name]))("%s schema satisfies strict requirements", (name) => {
    const tool = RAILWAY_TOOLS.find((t) => t.function.name === name)!;
    const params = tool.function.parameters;
    expect(params.type).toBe("object");
    expect(params.additionalProperties).toBe(false);
    expect(Array.isArray(params.required)).toBe(true);
    // Groq strict mode: every key in properties MUST be listed in required.
    for (const key of Object.keys(params.properties)) {
      expect(params.required).toContain(key);
    }
  });

  it("fare is typed number in all booking/ticket tools (matches tool-result data)", () => {
    for (const tool of RAILWAY_TOOLS) {
      const props = tool.function.parameters.properties as Record<string, { type?: string }>;
      if (tool.function.name === "confirmBooking" || tool.function.name === "sendTicketEmail" || tool.function.name === "downloadTicketPdf") {
        expect(props.fare?.type).toBe("number");
      }
    }
  });

  it("getHealth declares required: [] (empty properties still needs required present)", () => {
    const health = RAILWAY_TOOLS.find((t) => t.function.name === "getHealth")!;
    expect(health.function.parameters.required).toEqual([]);
  });
});

/* ══════════════════════════════════════════════════════════════
   SECTION 6 — executeTool behaviors
   ══════════════════════════════════════════════════════════════ */

describe("executeTool", () => {
  it("searchStations succeeds with valid input and returns standardized result", async () => {
    installFetchMock({ chat: () => { throw new Error("unused"); }, rapi: () => rapiStationResponse() });
    const result = await executeTool("searchStations", { query: "mumbai" }, "call_1", "req_t");
    expect(result.success).toBe(true);
    expect(result.toolName).toBe("searchStations");
    expect(result.toolCallId).toBe("call_1");
  });

  it("searchStations fails gracefully on RAPI network error (no throw)", async () => {
    installFetchMock({
      chat: () => { throw new Error("unused"); },
      rapi: () => { throw new TypeError("ECONNREFUSED"); },
    });
    const result = await executeTool("searchStations", { query: "mumbai" }, "call_1", "req_t");
    expect(result.success).toBe(false);
    expect(result.error).toBeTruthy();
  });

  it("unknown tool returns structured failure", async () => {
    const result = await executeTool("doesNotExist", {}, "call_1");
    expect(result.success).toBe(false);
    expect(result.error).toBeTruthy();
  });

  it("getPnrStatus rejects an invalid PNR without calling the network", async () => {
    const result = await executeTool("getPnrStatus", { pnr: "123" }, "call_1", "req_t");
    expect(result.success).toBe(false);
    expect(result.error).toBeTruthy();
  });

  it("getHealth succeeds when RAPI is reachable", async () => {
    installFetchMock({
      chat: () => { throw new Error("unused"); },
      rapi: () => jsonResponse({ success: true, data: { status: "ok" }, cached: false }),
    });
    const result = await executeTool("getHealth", {}, "call_1", "req_t");
    expect(result.success).toBe(true);
  });

  it("confirmBooking returns a numeric fare consistent with the schema", async () => {
    installFetchMock({ chat: () => { throw new Error("unused"); } });
    const result = await executeTool(
      "confirmBooking",
      {
        trainName: "Mumbai Rajdhani", trainNumber: "12951",
        from: "Mumbai", fromCode: "MMCT", to: "Delhi", toCode: "NDLS",
        date: "2026-08-01", departure: "17:00", arrival: "08:30", duration: "15h 30m",
        coach: "B1", seat: "7", tier: "Lower", fare: 1245, class: "3A", passengerName: "A",
      },
      "call_1",
      "req_t"
    );
    expect(result.success).toBe(true);
    expect(typeof (result.data as Record<string, unknown>).fare).toBe("number");
  });
});

/* ══════════════════════════════════════════════════════════════
   SECTION 7 — State machine terminal-state guarantees
   ══════════════════════════════════════════════════════════════ */

describe("state machine terminal guarantees", () => {
  it("multi-tool loop (EXECUTE_TOOL ↔ WAIT_FOR_TOOL_RESULT) reaches COMPLETE", () => {
    const m = RequestStateMachine.create(60_000);
    m.transition(RequestState.BUILD_CONTEXT);
    m.transition(RequestState.CALL_PROVIDER);
    m.transition(RequestState.STREAMING);
    m.transition(RequestState.TOOL_CALL_DETECTED);
    m.transition(RequestState.EXECUTE_TOOL);
    m.transition(RequestState.WAIT_FOR_TOOL_RESULT); // tool 1
    m.transition(RequestState.WAIT_FOR_TOOL_RESULT); // tool 2 (self-loop, previously force-terminated)
    m.transition(RequestState.EXECUTE_TOOL);         // tool 3
    m.transition(RequestState.WAIT_FOR_TOOL_RESULT);
    m.transition(RequestState.SECOND_LLM_PASS);
    m.transition(RequestState.PARSE_RESPONSE);
    m.transition(RequestState.FINAL_RESPONSE_READY);
    m.transition(RequestState.COMPLETE);
    expect(m.isTerminated).toBe(true);
    expect(m.currentState).toBe(RequestState.COMPLETE);
    m.dispose();
  });

  it("invalid transition throws and does not silently hang", () => {
    const m = RequestStateMachine.create(60_000);
    expect(() => m.transition(RequestState.SECOND_LLM_PASS)).toThrow();
    m.dispose();
  });

  it("forceTerminate lands in exactly one terminal state", () => {
    const m = RequestStateMachine.create(60_000);
    m.forceTerminate(RequestState.ERROR, "test");
    expect(m.isTerminated).toBe(true);
    expect(m.isError).toBe(true);
    m.dispose();
  });

  it("terminal states are exactly COMPLETE | ERROR | CANCELLED | TIMEOUT", () => {
    expect([...TERMINAL_STATES].sort()).toEqual(
      [RequestState.COMPLETE, RequestState.ERROR, RequestState.CANCELLED, RequestState.TIMEOUT].sort()
    );
  });
});

/* ══════════════════════════════════════════════════════════════
   SECTION 8 — Multi-turn history reconstruction (conversation memory)
   ══════════════════════════════════════════════════════════════ */

describe("multi-turn history reconstruction", () => {
  it("turn 2 sends Groq-valid history: tool results stay paired with their assistant tool_calls", async () => {
    resetConversationMemory();
    const chatBodies: Array<Record<string, unknown>> = [];
    let streamCalls = 0;
    installFetchMock({
      chat: (body) => {
        chatBodies.push(body);
        if (body.stream === true) {
          streamCalls++;
          if (streamCalls === 1) {
            // Turn 1 first pass: emit a tool call.
            return streamResponse([toolChunk("searchStations", '{"query":"Mumbai"}'), doneEvent()]);
          }
          // Turn 2 first pass: plain text answer.
          return streamResponse([textChunk("Here are the trains."), doneEvent()]);
        }
        // Turn 1 second pass.
        return jsonResponse({ success: true, data: { content: "Found Mumbai Central (BCT).", toolCalls: [] } });
      },
      rapi: () => rapiStationResponse(),
    });

    const turn1 = fullCallbacks();
    await processWithAI("Where is Mumbai station?", turn1.callbacks);
    const turn2 = fullCallbacks();
    await processWithAI("Show me trains", turn2.callbacks);

    // Both turns must terminate with exactly one terminal callback.
    expect(terminalCount(turn1.calls)).toBe(1);
    expect(terminalCount(turn2.calls)).toBe(1);

    // The turn-2 request body must contain a Groq-valid message history:
    // every tool message's tool_call_id must have been declared by a
    // PRECEDING assistant message's tool_calls (else Groq 400s on turn 2).
    // chatBodies order: [turn1 stream, turn1 second-pass, turn2 stream]
    const turn2Request = chatBodies.filter((b) => b.stream === true)[1];
    expect(turn2Request).toBeDefined();
    const msgs = turn2Request!.messages as AIMessage[];
    const toolMsgs = msgs.filter((m) => m.role === "tool");
    expect(toolMsgs.length).toBeGreaterThan(0);

    const declaredIds = new Set<string>();
    for (const m of msgs) {
      if (m.role === "assistant" && m.tool_calls) {
        for (const tc of m.tool_calls) declaredIds.add(tc.id);
      }
      if (m.role === "tool") {
        expect(declaredIds.has(m.tool_call_id as string)).toBe(true);
      }
    }
  });
});
