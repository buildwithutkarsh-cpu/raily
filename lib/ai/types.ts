/* ══════════════════════════════════════════════════════════════
   Raily AI — Core Types
   ══════════════════════════════════════════════════════════════ */

/* ─── Provider Configuration ─────────────────────────────── */

export type AIProviderType = "groq" | "openrouter";

export interface AIProviderConfig {
  provider: AIProviderType;
  model: string;
  apiKey: string;
  baseUrl: string;
  maxTokens: number;
  temperature: number;
}

export const PROVIDER_DEFAULTS: Record<AIProviderType, Omit<AIProviderConfig, "apiKey">> = {
  groq: {
    provider: "groq",
    model: "llama-3.3-70b-versatile",
    baseUrl: "https://api.groq.com/openai/v1",
    maxTokens: 4096,
    temperature: 0.3,
  },
  openrouter: {
    provider: "openrouter",
    model: "google/gemini-2.0-flash-001",
    baseUrl: "https://openrouter.ai/api/v1",
    maxTokens: 4096,
    temperature: 0.3,
  },
};

/* ─── Message Formats ────────────────────────────────────── */

export interface AIMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  tool_call_id?: string;
  tool_calls?: AIToolCall[];
  name?: string;
}

export interface AIToolCall {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
}

/* ─── Tool Definitions ───────────────────────────────────── */

export interface AIToolDefinition {
  type: "function";
  function: {
    name: string;
    description: string;
    strict: boolean;
    parameters: {
      type: "object";
      properties: Record<string, unknown>;
      required?: string[];
      additionalProperties: boolean;
    };
  };
}

export interface ToolResult {
  success: boolean;
  data?: unknown;
  error?: string;
  toolCallId: string;
  toolName: string;
}

/* ─── Streaming ──────────────────────────────────────────── */

export type StreamChunk =
  | { type: "text"; content: string }
  | { type: "tool-call"; toolCall: AIToolCall }
  | { type: "tool-result"; result: ToolResult }
  | { type: "done"; content: string }
  | { type: "error"; message: string };

export interface StreamCallbacks {
  onText: (text: string) => void;
  onToolCall: (toolCall: AIToolCall) => void;
  onToolResult: (result: ToolResult) => void;
  onDone: (fullContent: string) => void;
  onError: (error: Error) => void;
}

/* ─── Conversation Memory ────────────────────────────────── */

export interface ConversationEntry {
  id: string;
  role: "user" | "assistant" | "tool";
  content: string;
  toolCalls?: AIToolCall[];
  toolResult?: ToolResult;
  timestamp: number;
  tokens: number;
}

export interface ConversationSummary {
  summary: string;
  keyInfo: Record<string, string>;
  lastUpdated: number;
}

/* ─── AI Response ────────────────────────────────────────── */

export interface AIResponse {
  content: string;
  toolCalls: AIToolCall[];
  uiComponent?: string;
  uiData?: Record<string, unknown>;
}

/* ─── UI Component Types ─────────────────────────────────-- */

export type AIComponentType =
  | "train-list"
  | "seat-map"
  | "booking-confirmation"
  | "journey-tracker"
  | "pnr-status"
  | "booking-history"
  | "station-search"
  | "route-comparison";

export const AI_COMPONENT_TRIGGERS: Record<string, AIComponentType> = {
  "show_train_list": "train-list",
  "show_seat_map": "seat-map",
  "show_booking_confirmation": "booking-confirmation",
  "show_journey_tracker": "journey-tracker",
  "show_pnr_status": "pnr-status",
  "show_booking_history": "booking-history",
  "show_station_search": "station-search",
  "show_route_comparison": "route-comparison",
};