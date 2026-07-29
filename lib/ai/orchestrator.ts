/* ══════════════════════════════════════════════════════════════
   Raily AI — Orchestration Layer
   
   The central intelligence that replaces the old regex-based
   processUserInput. Handles intent detection, tool calling,
   streaming, and response generation through the LLM.
   
   Flow:
   User Input → Build Messages → Streaming LLM Call →
   Tool Execution → Second LLM Call → Response + UI Components
   ══════════════════════════════════════════════════════════════ */

import { createStreamingCompletion, createCompletion } from "./provider";
import { executeTool, RAILWAY_TOOLS, buildToolResultMessage } from "./tools";
import { buildMessages, parseAIResponse } from "./prompts";
import { getConversationMemory, resetConversationMemory } from "./memory";
import type { AIMessage, AIToolCall, AIComponentType, ConversationSummary } from "./types";
import { AI_COMPONENT_TRIGGERS } from "./types";

/* ─── Stream Callback Types ──────────────────────────────── */

export interface OrchestrationCallbacks {
  onText: (text: string) => void;
  onToolCall: (toolName: string, args: Record<string, unknown>) => void;
  onComponent: (component: AIComponentType, data?: Record<string, unknown>) => void;
  onDone: (fullContent: string, component: string | null) => void;
  onError: (error: string) => void;
}

/* ─── Tool Execution + Second Pass ───────────────────────── */

async function executeToolCallsAndRespond(
  toolCalls: AIToolCall[],
  messages: AIMessage[],
  callbacks: OrchestrationCallbacks,
  initialContent = ""
): Promise<{ content: string; component: string | null }> {
  const memory = getConversationMemory();

  // Execute all tools in parallel
  const results = await Promise.all(
    toolCalls.map(async (tc) => {
      let args: Record<string, unknown> = {};
      try {
        args = JSON.parse(tc.function.arguments);
      } catch {
        args = {};
      }

      callbacks.onToolCall(tc.function.name, args);

      const result = await executeTool(tc.function.name, args, tc.id);
      memory.addToolEntry(result);
      return buildToolResultMessage(tc.id, tc.function.name, result);
    })
  );

  // Add assistant message with tool calls to the messages array
  // Include the initial reasoning text so the LLM sees its own thoughts
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

  // Second pass: get LLM response with tool results
  const secondResponse = await createCompletion(messages, []);

  const parsed = parseAIResponse(secondResponse.content);
  const component = parsed.uiComponent ? AI_COMPONENT_TRIGGERS[parsed.uiComponent] || null : null;

  // Include initial reasoning in the final content
  const combinedContent = initialContent ? `${initialContent}\n\n${parsed.text}` : parsed.text;

  // Store the final response
  memory.addAssistantEntry(parsed.text);

  // Stream the response text (not the initial reasoning — it was already streamed)
  callbacks.onText(parsed.text);

  // Trigger UI component if needed
  if (component) {
    callbacks.onComponent(component as AIComponentType);
  }

  callbacks.onDone(combinedContent, component);

  return { content: combinedContent, component };
}

/* ─── Main Orchestration ─────────────────────────────────── */

export async function processWithAI(
  userInput: string,
  callbacks: OrchestrationCallbacks
): Promise<void> {
  const memory = getConversationMemory();
  const summary = memory.getSummary() ?? undefined;

  // Store user input
  memory.addUserEntry(userInput);

  // Build messages
  const messages = buildMessages(userInput, memory.getEntries(), summary);

  // Wait for streaming to complete
  await createStreamingCompletion(
    messages,
    RAILWAY_TOOLS,
    {
      onText: (text: string) => {
        callbacks.onText(text);
      },
      onToolCall: (toolCall: AIToolCall) => {
        // Tool calls are accumulated and handled in onDone
      },
      onDone: async (fullContent: string, toolCalls: AIToolCall[]) => {
        // If there are tool calls, execute them and do a second pass
        // Pass fullContent (initial LLM reasoning) so it's preserved in context
        if (toolCalls.length > 0) {
          await executeToolCallsAndRespond(toolCalls, messages, callbacks, fullContent);
          return;
        }

        // No tool calls — parse the response directly
        const parsed = parseAIResponse(fullContent);
        const component = parsed.uiComponent ? AI_COMPONENT_TRIGGERS[parsed.uiComponent] || null : null;

        // Store the final response
        memory.addAssistantEntry(parsed.text);

        // Trigger UI component if needed
        if (component) {
          callbacks.onComponent(component as AIComponentType);
        }

        callbacks.onDone(parsed.text, component);
      },
      onError: (error: Error) => {
        callbacks.onError(error.message);
      },
    }
  );
}

/* ─── Simple (Non-Streaming) Process ─────────────────────── */

export async function processWithAISimple(
  userInput: string
): Promise<{
  content: string;
  component: string | null;
  toolCalls: AIToolCall[];
}> {
  const memory = getConversationMemory();
  const summary = memory.getSummary() ?? undefined;

  // Store user input
  memory.addUserEntry(userInput);

  // Build messages
  const messages = buildMessages(userInput, memory.getEntries(), summary);

  // First pass: get LLM response
  const firstResponse = await createCompletion(messages, RAILWAY_TOOLS);

  // If there are tool calls, execute them
  if (firstResponse.toolCalls.length > 0) {
    const toolResults = [];
    for (const tc of firstResponse.toolCalls) {
      let args: Record<string, unknown> = {};
      try {
        args = JSON.parse(tc.function.arguments);
      } catch {
        args = {};
      }

      const result = await executeTool(tc.function.name, args, tc.id);
      memory.addToolEntry(result);
      toolResults.push(buildToolResultMessage(tc.id, tc.function.name, result));
    }

    // Build second pass messages
    const secondMessages: AIMessage[] = [
      ...messages,
      { role: "assistant", content: "", tool_calls: firstResponse.toolCalls },
      ...toolResults,
    ];

    // Second pass
    const secondResponse = await createCompletion(secondMessages, []);
    const parsed = parseAIResponse(secondResponse.content);
    const component = parsed.uiComponent ? AI_COMPONENT_TRIGGERS[parsed.uiComponent] || null : null;

    memory.addAssistantEntry(parsed.text);

    return {
      content: parsed.text,
      component,
      toolCalls: firstResponse.toolCalls,
    };
  }

  // No tool calls — return directly
  const parsed = parseAIResponse(firstResponse.content);
  const component = parsed.uiComponent ? AI_COMPONENT_TRIGGERS[parsed.uiComponent] || null : null;

  memory.addAssistantEntry(parsed.text);

  return {
    content: parsed.text,
    component,
    toolCalls: [],
  };
}

/* ─── Reset Conversation ─────────────────────────────────── */

export function resetAI(): void {
  resetConversationMemory();
}