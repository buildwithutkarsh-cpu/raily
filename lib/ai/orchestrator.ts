/* ══════════════════════════════════════════════════════════════
   Raily AI — Orchestration Layer (Deterministic Pipeline)

   The request lifecycle is an explicit finite state machine.
   Every transition is validated. No implicit state.
   Every request terminates in exactly one state:
     COMPLETE | ERROR | CANCELLED | TIMEOUT

   Flow:
   IDLE → REQUEST_RECEIVED → BUILD_CONTEXT → CALL_PROVIDER →
   STREAMING → (optional TOOL_CALL_DETECTED → EXECUTE_TOOL →
   WAIT_FOR_TOOL_RESULT → SECOND_LLM_PASS) → PARSE_RESPONSE →
   EMIT_FRONTEND_EVENTS → FINAL_RESPONSE_READY → COMPLETE
   ══════════════════════════════════════════════════════════════ */

import { createStreamingCompletion, createCompletion, createStreamAccumulator } from "./provider";
import { executeTool, RAILWAY_TOOLS, buildToolResultMessage } from "./tools";
import { buildMessages, parseAIResponse } from "./prompts";
import { getConversationMemory, resetConversationMemory } from "./memory";
import { OrchestrationScope, createLogger } from "./request-state";
import type {
  AIMessage,
  AIToolCall,
  AIComponentType,
  RequestId,
  BrowserEvent,
  ToolResult,
} from "./types";
import { AI_COMPONENT_TRIGGERS, RequestState } from "./types";

/* ─── Orchestration Callbacks ────────────────────────────── */

export interface OrchestrationCallbacks {
  onText: (text: string, requestId: RequestId) => void;
  onToolCall: (toolName: string, args: Record<string, unknown>, requestId: RequestId) => void;
  onToolResult: (toolName: string, args: Record<string, unknown>, result: ToolResult, requestId: RequestId) => void;
  onComponent: (component: AIComponentType, requestId: RequestId) => void;
  onDone: (fullContent: string, component: string | null, requestId: RequestId) => void;
  onError: (error: string, requestId: RequestId) => void;
  onEvents: (events: BrowserEvent[], requestId: RequestId) => void;
}

/* ─── Tool Execution + Second Pass ───────────────────────── */

async function executeToolCallsAndRespond(
  toolCalls: AIToolCall[],
  messages: AIMessage[],
  callbacks: OrchestrationCallbacks,
  scope: OrchestrationScope,
  initialContent = ""
): Promise<{ content: string; component: string | null }> {
  const { machine, requestId, log } = scope;
  const memory = getConversationMemory();

  // ── Transition to TOOL_CALL_DETECTED ──────────────────────
  if (!machine.isTerminated) {
    scope.safeTransition(RequestState.TOOL_CALL_DETECTED);
  }
  if (machine.isTerminated) return { content: initialContent, component: null };

  // ── EXECUTE_TOOL state ───────────────────────────────────
  scope.safeTransition(RequestState.EXECUTE_TOOL);
  if (machine.isTerminated) return { content: initialContent, component: null };

  // Persist the assistant message carrying these tool_calls BEFORE the tool
  // results are stored. Without this, the next turn's reconstructed history
  // contains tool messages whose tool_call_id has no preceding assistant
  // tool_calls — Groq rejects that with `tool_use_failed` on turn 2.
  memory.addAssistantEntry(initialContent, toolCalls);

  // Collect all browser events from tools for validation
  const pendingEvents: BrowserEvent[] = [];

  // Execute all tools in parallel
  const results = await Promise.all(
    toolCalls.map(async (tc) => {
      let args: Record<string, unknown> = {};
      try {
        args = JSON.parse(tc.function.arguments);
      } catch (err: unknown) {
        log.error(`Failed to parse arguments for tool ${tc.function.name}: ${err instanceof Error ? err.message : String(err)}`);
        args = {};
      }

      callbacks.onToolCall(tc.function.name, args, requestId);

      // ── WAIT_FOR_TOOL_RESULT (per tool) ──────────────────
      scope.safeTransition(RequestState.WAIT_FOR_TOOL_RESULT);

      // Execute tool with requestId for correlated logging
      const result = await executeTool(tc.function.name, args, tc.id, requestId);

      memory.addToolEntry(result);

      // Collect browser events from the tool's result
      if (result.events && result.events.length > 0) {
        pendingEvents.push(...validateEvents(result.events, tc.function.name, log));
      }

      // Fire onToolResult so callers (e.g. booking store) can sync state
      callbacks.onToolResult(tc.function.name, args, result, requestId);

      return buildToolResultMessage(tc.id, tc.function.name, result);
    })
  );

  // ── EMIT_FRONTEND_EVENTS (for tool-triggered browser actions) ──
  if (pendingEvents.length > 0) {
    const eventTypes = pendingEvents.map(e => e.type).join(", ");
    log.info(`Emitting ${pendingEvents.length} browser events: [${eventTypes}]`);
    callbacks.onEvents(pendingEvents, requestId);
    log.info(`Browser events emitted, second LLM pass will NOT wait for them`);
  }

  // Add assistant message with tool calls to the messages array
  messages.push({
    role: "assistant",
    content: initialContent,
    tool_calls: toolCalls,
  });

  // Add all tool results
  for (const result of results) {
    messages.push({
      role: "tool",
      content: result.content,
      tool_call_id: result.tool_call_id,
      name: result.name,
    });
  }

  // ── SECOND_LLM_PASS state ────────────────────────────────
  scope.safeTransition(RequestState.SECOND_LLM_PASS);
  if (machine.isTerminated) return { content: initialContent, component: null };

  // Second pass: get LLM response with tool results.
  // IMPORTANT: RAILWAY_TOOLS MUST be re-sent. Groq validates that every
  // tool_calls entry in the message history exists in request.tools, so
  // omitting tools here causes `tool_use_failed: ... which was not in
  // request.tools` (the exact error in the Groq logs). tool_choice "none"
  // prevents the model from calling tools again on this pass.
  const secondResponse = await createCompletion(messages, RAILWAY_TOOLS, requestId, { toolChoice: "none" });

  // ── PARSE_RESPONSE state ─────────────────────────────────
  scope.safeTransition(RequestState.PARSE_RESPONSE);
  if (machine.isTerminated) return { content: initialContent, component: null };

  const parsed = parseAIResponse(secondResponse.content);
  const component = parsed.uiComponent ? AI_COMPONENT_TRIGGERS[parsed.uiComponent] || null : null;

  // Include initial reasoning in the final content
  const combinedContent = initialContent ? `${initialContent}\n\n${parsed.text}` : parsed.text;

  // Store the final response
  memory.addAssistantEntry(parsed.text);

  // ── FINAL_RESPONSE_READY / EMIT_FRONTEND_EVENTS ──────────
  scope.safeTransition(RequestState.FINAL_RESPONSE_READY);

  // Stream the response text
  callbacks.onText(parsed.text, requestId);

  // Trigger UI component if needed
  if (component) {
    callbacks.onComponent(component as AIComponentType, requestId);
  }

  // Final done callback
  callbacks.onDone(combinedContent, component, requestId);

  // Transition to COMPLETE
  scope.safeTransition(RequestState.COMPLETE);

  return { content: combinedContent, component };
}

/* ─── Event Validation ──────────────────────────────────── */

function validateEvents(
  events: BrowserEvent[],
  toolName: string,
  log: ReturnType<typeof createLogger>
): BrowserEvent[] {
  const valid: BrowserEvent[] = [];
  const seenEventIds = new Set<string>();

  for (const event of events) {
    if (!event.type) {
      log.warn(`Tool ${toolName} returned event without type — skipping`);
      continue;
    }

    if (!event.eventId) {
      log.warn(`Tool ${toolName} returned event without eventId — skipping`);
      continue;
    }

    if (seenEventIds.has(event.eventId)) {
      log.warn(`Duplicate eventId ${event.eventId} from tool ${toolName} — skipping`);
      continue;
    }

    switch (event.type) {
      case "download-pdf": {
        const dl = event as unknown as { url: unknown; filename: unknown };
        if (!dl.url || typeof dl.url !== "string") {
          log.warn(`Tool ${toolName} download-pdf event without valid url — skipping`);
          continue;
        }
        if (!dl.filename || typeof dl.filename !== "string") {
          log.warn(`Tool ${toolName} download-pdf event without valid filename — skipping`);
          continue;
        }
        break;
      }
      case "navigate": {
        const nav = event as unknown as { url: unknown };
        if (!nav.url || typeof nav.url !== "string") {
          log.warn(`Tool ${toolName} navigate event without valid url — skipping`);
          continue;
        }
        break;
      }
      case "scroll-to":
      case "focus": {
        const sel = event as unknown as { selector: unknown };
        if (!sel.selector || typeof sel.selector !== "string") {
          log.warn(`Tool ${toolName} ${event.type} event without valid selector — skipping`);
          continue;
        }
        break;
      }
      default:
        log.warn(`Tool ${toolName} unknown event type: ${(event as BrowserEvent).type} — skipping`);
        continue;
    }

    seenEventIds.add(event.eventId);
    valid.push(event);
  }

  if (valid.length !== events.length) {
    log.warn(`Tool ${toolName}: ${events.length - valid.length}/${events.length} events filtered by validation`);
  }

  return valid;
}

/* ─── Main Orchestration ─────────────────────────────────── */

export async function processWithAI(
  userInput: string,
  callbacks: OrchestrationCallbacks
): Promise<void> {
  // ── Create orchestration scope with state machine ─────────
  const scope = OrchestrationScope.create(60_000);
  const { machine, log, requestId } = scope;

  log.info(`processWithAI called with input: "${userInput.slice(0, 100)}"`);

  try {
    const memory = getConversationMemory();
    const summary = memory.getSummary() ?? undefined;

    // Store user input
    memory.addUserEntry(userInput);

    // ── BUILD_CONTEXT state ─────────────────────────────────
    const messagesResult = await scope.runInState(RequestState.BUILD_CONTEXT, async () => {
      return buildMessages(userInput, memory.getEntries(), summary);
    });

    if (machine.isTerminated || !messagesResult) {
      callbacks.onError(
        machine.currentState === RequestState.TIMEOUT
          ? "Request timed out while building context"
          : machine.currentState === RequestState.CANCELLED
          ? "Request cancelled"
          : "Request failed while building context",
        requestId
      );
      return;
    }

    const builtMessages = messagesResult as AIMessage[];

    // ── CALL_PROVIDER state ─────────────────────────────────
    scope.safeTransition(RequestState.CALL_PROVIDER);
    if (machine.isTerminated) return;

    // ── STREAMING state ─────────────────────────────────────
    // Use the accumulator pattern so we can read tool calls after streaming completes
    const accumulator = createStreamAccumulator();
    let streamingError: string | null = null;

    await createStreamingCompletion(
      builtMessages,
      RAILWAY_TOOLS,
      {
        onStart: () => {
          scope.safeTransition(RequestState.STREAMING);
        },
        onChunk: (text: string, chunkRequestId: RequestId) => {
          callbacks.onText(text, chunkRequestId || requestId);
        },
        onToolCall: (_toolCall: AIToolCall, _tcRequestId: RequestId) => {
          // Tool calls are accumulated in the accumulator via createStreamingCompletion
        },
        onDone: (_fullContent: string, _doneRequestId: RequestId) => {
          // The accumulator is populated with final content and tool calls
        },
        onError: (error: Error, errRequestId: RequestId) => {
          streamingError = error.message;
          log.error(`Streaming error: ${error.message} (${errRequestId})`);
        },
        cleanup: () => {
          log.info("Stream cleanup complete");
        },
      },
      requestId,
      accumulator
    );

    if (streamingError) {
      callbacks.onError(streamingError, requestId);
      return;
    }

    // Safety net: if the FSM was force-terminated mid-stream (timeout / cancel /
    // invalid transition) without surfacing a streaming error (e.g. a slow-trickling
    // stream stays alive past the pipeline timeout so the per-read 30s timeout never
    // fires), still terminate with onError — never leave the UI loading forever.
    if (machine.isTerminated) {
      const message =
        machine.currentState === RequestState.TIMEOUT
          ? "Request timed out while streaming"
          : machine.currentState === RequestState.CANCELLED
          ? "Request was cancelled while streaming"
          : "Request failed while streaming";
      callbacks.onError(message, requestId);
      return;
    }

    // Read final states from the accumulator
    const accumulatedContent = accumulator.fullContent;
    const accumulatedToolCalls = accumulator.toolCalls;

    log.info(`Stream completed: ${accumulatedContent.length} chars, ${accumulatedToolCalls.length} tool calls`);

    // ── PHASE 2: Tool execution (if tool calls were detected) ──
    if (accumulatedToolCalls.length > 0) {
      let returnedNormally = false;
      try {
        await executeToolCallsAndRespond(
          accumulatedToolCalls,
          builtMessages,
          callbacks,
          scope,
          accumulatedContent
        );
        returnedNormally = true;
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Tool execution failed unexpectedly";
        // Ensure the machine lands in a terminal state so the request lifecycle
        // always terminates (previously it could be left in SECOND_LLM_PASS).
        if (!machine.isTerminated) {
          machine.forceTerminate(RequestState.ERROR, message);
        }
        callbacks.onError(message, requestId);
      }

      // Safety net: fires ONLY when executeToolCallsAndRespond returned
      // without throwing (so onError was not already emitted by the catch)
      // but the machine was force-terminated mid-flight (timeout / cancel /
      // invalid transition) without reaching COMPLETE. Guarantees the
      // frontend's loading state is always cleared.
      if (returnedNormally && machine.currentState !== RequestState.COMPLETE) {
        const message =
          machine.currentState === RequestState.TIMEOUT
            ? "Request timed out while processing tool calls"
            : machine.currentState === RequestState.CANCELLED
            ? "Request was cancelled while processing tool calls"
            : "Request failed while processing tool calls";
        callbacks.onError(message, requestId);
      }
      return;
    }

    // ── PHASE 3: No tool calls — parse and respond directly ──
    scope.safeTransition(RequestState.PARSE_RESPONSE);
    if (machine.isTerminated) return;

    const parsed = parseAIResponse(accumulatedContent);
    const component = parsed.uiComponent ? AI_COMPONENT_TRIGGERS[parsed.uiComponent] || null : null;

    // Store the final response
    memory.addAssistantEntry(parsed.text);

    // Trigger UI component if needed
    if (component) {
      callbacks.onComponent(component as AIComponentType, requestId);
    }

    // Final done
    scope.safeTransition(RequestState.FINAL_RESPONSE_READY);
    callbacks.onDone(parsed.text, component, requestId);

    // Complete
    scope.safeTransition(RequestState.COMPLETE);

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unexpected pipeline error";
    log.error(`Unhandled pipeline error: ${message}`);

    if (!machine.isTerminated) {
      machine.forceTerminate(RequestState.ERROR, message);
    }

    callbacks.onError(message, requestId);
  } finally {
    // Always dispose the state machine (logs final state + history)
    machine.dispose();
  }
}

/* ─── Simple (Non-Streaming) Process ─────────────────────── */

export async function processWithAISimple(
  userInput: string
): Promise<{
  content: string;
  component: string | null;
  toolCalls: AIToolCall[];
}> {
  const scope = OrchestrationScope.create(30_000);
  const { machine, log, requestId } = scope;

  log.info(`processWithAISimple called`);

  try {
    const memory = getConversationMemory();
    const summary = memory.getSummary() ?? undefined;

    memory.addUserEntry(userInput);

    // BUILD_CONTEXT
    const messagesResult = await scope.runInState(RequestState.BUILD_CONTEXT, async () => {
      return buildMessages(userInput, memory.getEntries(), summary);
    });

    if (machine.isTerminated || !messagesResult) {
      return { content: "Request failed", component: null, toolCalls: [] };
    }

    const builtMessages = messagesResult as AIMessage[];

    // CALL_PROVIDER
    const firstResponse = await scope.runInState(RequestState.CALL_PROVIDER, async () => {
      return createCompletion(builtMessages, RAILWAY_TOOLS, requestId);
    });

    if (machine.isTerminated || !firstResponse) {
      return { content: "Request failed", component: null, toolCalls: [] };
    }

    // Mark the completion as received (STREAMING) so the FSM can legally
    // proceed to TOOL_CALL_DETECTED or PARSE_RESPONSE next.
    scope.safeTransition(RequestState.STREAMING);
    if (machine.isTerminated) {
      return { content: "Request failed", component: null, toolCalls: [] };
    }

    // TOOL_CALL_DETECTED → EXECUTE_TOOL → SECOND_LLM_PASS
    if (firstResponse.toolCalls.length > 0) {
      scope.safeTransition(RequestState.TOOL_CALL_DETECTED);

      // Persist the assistant tool_calls message BEFORE tool results so the
      // reconstructed history keeps tool_call_id pairing valid on turn 2.
      memory.addAssistantEntry("", firstResponse.toolCalls);

      const toolResults: AIMessage[] = [];
      const pendingEvents: BrowserEvent[] = [];

      for (const tc of firstResponse.toolCalls) {
        scope.safeTransition(RequestState.EXECUTE_TOOL);

        let args: Record<string, unknown> = {};
        try {
          args = JSON.parse(tc.function.arguments);
        } catch (err: unknown) {
          log.error(`Failed to parse args for ${tc.function.name}: ${err instanceof Error ? err.message : String(err)}`);
          args = {};
        }

        scope.safeTransition(RequestState.WAIT_FOR_TOOL_RESULT);

        const result = await executeTool(tc.function.name, args, tc.id, requestId);
        memory.addToolEntry(result);

        if (result.events && result.events.length > 0) {
          pendingEvents.push(...result.events);
        }

        toolResults.push(buildToolResultMessage(tc.id, tc.function.name, result));
      }

      // SECOND_LLM_PASS
      const secondMessages: AIMessage[] = [
        ...builtMessages,
        { role: "assistant", content: "", tool_calls: firstResponse.toolCalls },
        ...toolResults,
      ];

      const secondResponse = await scope.runInState(RequestState.SECOND_LLM_PASS, async () => {
        // Same as the streaming flow: tools must be re-sent or Groq rejects
        // the historical tool_calls with `tool_use_failed`.
        return createCompletion(secondMessages, RAILWAY_TOOLS, requestId, { toolChoice: "none" });
      });

      if (machine.isTerminated || !secondResponse) {
        return { content: "Request failed", component: null, toolCalls: firstResponse.toolCalls };
      }

      const parsed = parseAIResponse(secondResponse.content);
      const component = parsed.uiComponent ? AI_COMPONENT_TRIGGERS[parsed.uiComponent] || null : null;

      memory.addAssistantEntry(parsed.text);

      scope.safeTransition(RequestState.PARSE_RESPONSE);
      if (machine.isTerminated) {
        return { content: "Request failed", component: null, toolCalls: firstResponse.toolCalls };
      }
      scope.safeTransition(RequestState.FINAL_RESPONSE_READY);
      scope.safeTransition(RequestState.COMPLETE);

      return { content: parsed.text, component, toolCalls: firstResponse.toolCalls };
    }

    // No tool calls — return directly
    const parsed = parseAIResponse(firstResponse.content);
    const component = parsed.uiComponent ? AI_COMPONENT_TRIGGERS[parsed.uiComponent] || null : null;

    memory.addAssistantEntry(parsed.text);

    scope.safeTransition(RequestState.PARSE_RESPONSE);
    if (machine.isTerminated) {
      return { content: "Request failed", component: null, toolCalls: [] };
    }
    scope.safeTransition(RequestState.FINAL_RESPONSE_READY);
    scope.safeTransition(RequestState.COMPLETE);

    return { content: parsed.text, component, toolCalls: [] };

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unexpected error in processWithAISimple";
    log.error(message);

    if (!machine.isTerminated) {
      machine.forceTerminate(RequestState.ERROR, message);
    }

    return { content: `Error: ${message}`, component: null, toolCalls: [] };
  } finally {
    machine.dispose();
  }
}

/* ─── Reset Conversation ─────────────────────────────────── */

export function resetAI(): void {
  resetConversationMemory();
}
