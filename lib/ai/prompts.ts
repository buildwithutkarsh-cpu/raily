/* ══════════════════════════════════════════════════════════════
   Raily AI — Prompt Manager
   
   Structured system prompt that defines the AI's personality,
   capabilities, tool usage, and response format. Never concatenates
   prompts randomly — every section has a purpose.
   ══════════════════════════════════════════════════════════════ */

import type { AIMessage, ConversationEntry, ConversationSummary } from "./types";

/* ─── System Prompt ──────────────────────────────────────── */

function buildSystemPrompt(): string {
  return `You are RAILY, an AI-native railway operating system for Indian Railways. You are NOT a chatbot. You are the entire application.

IDENTITY
- You are the interface. There is no app, no forms, no buttons — only conversation.
- You speak like a confident, knowledgeable railway assistant. Direct, concise, precise.
- You understand Indian railway terminology: PNR, IRCTC, platform, berth, coach, class, quota, tatkal, RAC, waitlist, CNF.

CORE PRINCIPLES
1. NEVER invent railway data. Always use tools to fetch real data.
2. If you don't know a station code, use search_stations to find it.
3. Be concise. Users want answers, not essays.
4. Suggest the next action naturally. Don't ask "would you like to..." — state what makes sense.

RESPONSE FORMAT
When you need to show a UI component, include a trigger tag on its own line:
<show_train_list> — After searching trains
<show_seat_map> — When showing seat/coach layout
<show_booking_confirmation> — After booking is confirmed
<show_journey_tracker> — For live journey tracking
<show_pnr_status> — For PNR status display
<show_booking_history> — For past bookings
<show_station_search> — When searching stations

Example:
"I found 3 trains from Delhi to Jaipur. Here they are:"
<show_train_list>
"Select any train to see its coach layout and available seats."

TOOL USAGE
- Always search for station codes before searching trains if you're unsure
- Use search_trains with proper station codes (NDLS, BCT, JP, etc.)
- For booking: guide the user through train selection → seat selection → confirmation
- For PNR: ask for the 10-digit PNR number, then use get_pnr_status
- For tracking: use get_live_status with the train number
- Check availability before suggesting a train

CONVERSATION STYLE
- Short responses. 2-3 sentences max unless showing details.
- Use railway terminology naturally.
- Be confident. Never say "I think" or "I'll try."
- If a tool fails, explain briefly and suggest an alternative.
- Remember context from earlier in the conversation.

CAPABILITIES
- Search trains between stations
- Check seat availability and fare
- Get train route and schedule
- Live train tracking
- PNR status check
- Station search
- Booking guidance (simulated)

LIMITATIONS
- You cannot actually book tickets on IRCTC (simulated booking)
- You can only access data through the tools provided
- You cannot see web pages or access external websites`;
}

/* ─── Context Builder ────────────────────────────────────── */

export function buildConversationContext(
  history: ConversationEntry[],
  summary?: ConversationSummary
): string {
  const parts: string[] = [];

  // Conversation summary (if available)
  if (summary) {
    parts.push(`[CONVERSATION CONTEXT: ${summary.summary}]`);
  }

  // Recent history (last 10 exchanges for context window)
  const recent = history.slice(-20);
  for (const entry of recent) {
    const prefix = entry.role === "user" ? "User" : entry.role === "assistant" ? "Assistant" : "Tool";
    const content = entry.content.slice(0, 2000); // Truncate long tool results
    parts.push(`${prefix}: ${content}`);
  }

  return parts.join("\n\n");
}

/* ─── Message Builder ────────────────────────────────────── */

export function buildMessages(
  userInput: string,
  history: ConversationEntry[],
  summary?: ConversationSummary
): AIMessage[] {
  const messages: AIMessage[] = [];

  // System prompt
  messages.push({
    role: "system",
    content: buildSystemPrompt(),
  });

  // Conversation summary context
  if (summary) {
    messages.push({
      role: "system",
      content: `Previous conversation context: ${summary.summary}`,
    });
  }

  // Recent conversation history (last 6 exchanges to stay within context)
  const recentHistory = history.slice(-12);
  for (const entry of recentHistory) {
    if (entry.role === "user") {
      messages.push({ role: "user", content: entry.content });
    } else if (entry.role === "assistant") {
      const msg: AIMessage = { role: "assistant", content: entry.content };
      if (entry.toolCalls && entry.toolCalls.length > 0) {
        msg.tool_calls = entry.toolCalls;
      }
      messages.push(msg);
    } else if (entry.role === "tool" && entry.toolResult) {
      messages.push({
        role: "tool",
        content: JSON.stringify(entry.toolResult.data || entry.toolResult.error),
        tool_call_id: entry.toolResult.toolCallId,
        name: entry.toolResult.toolName,
      });
    }
  }

  // Current user input
  messages.push({ role: "user", content: userInput });

  return messages;
}

/* ─── Response Parser ────────────────────────────────────── */

export interface ParsedResponse {
  text: string;
  uiComponent: string | null;
}

export function parseAIResponse(content: string): ParsedResponse {
  // Extract UI component trigger tags
  const triggerMatch = content.match(/<(show_[a-z_]+)>/);
  const uiComponent = triggerMatch ? triggerMatch[1] : null;

  // Clean the response text (remove trigger tags)
  const text = content.replace(/<show_[a-z_]+>/g, "").trim();

  return { text, uiComponent };
}

/* ─── Token Estimator ────────────────────────────────────── */

export function estimateTokens(text: string): number {
  // Rough estimate: ~4 chars per token for English text
  return Math.ceil(text.length / 4);
}