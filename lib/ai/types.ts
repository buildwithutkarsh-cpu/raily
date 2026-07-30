/* ══════════════════════════════════════════════════════════════
   Raily AI — Core Types
   ══════════════════════════════════════════════════════════════ */

/* ─── Request Identity ──────────────────────────────────── */

/**
 * Unique identifier for every AI request.
 * Generated at the call-site (e.g. processUserInput) and threaded
 * through provider → orchestrator → tools → callbacks → frontend.
 * Every log line MUST include this ID.
 */
export type RequestId = string;

/**
 * Generate a unique requestId.
 */
export function generateRequestId(): RequestId {
  const timestamp = Date.now().toString(36);
  const randomPart = Math.random().toString(36).substring(2, 10);
  const counter = nextRequestCounter();
  return `req_${timestamp}_${randomPart}_${counter}`;
}

let requestCounter = 0;
function nextRequestCounter(): string {
  return (++requestCounter).toString(36);
}

/**
 * Context object passed through the entire AI pipeline.
 * Every function in the pipeline accepts this as the first argument.
 */
export interface RequestContext {
  readonly requestId: RequestId;
  readonly createdAt: number;
  /** Timeout in ms — pipeline must abort if exceeded */
  readonly timeoutMs: number;
  /** AbortSignal that fires when the pipeline should cancel */
  readonly signal: AbortSignal;
  /** Called to abort the pipeline */
  abort(reason: string): void;
}

/* ─── Finite State Machine ───────────────────────────────── */

export enum RequestState {
  IDLE = "IDLE",
  REQUEST_RECEIVED = "REQUEST_RECEIVED",
  BUILD_CONTEXT = "BUILD_CONTEXT",
  CALL_PROVIDER = "CALL_PROVIDER",
  STREAMING = "STREAMING",
  TOOL_CALL_DETECTED = "TOOL_CALL_DETECTED",
  EXECUTE_TOOL = "EXECUTE_TOOL",
  WAIT_FOR_TOOL_RESULT = "WAIT_FOR_TOOL_RESULT",
  SECOND_LLM_PASS = "SECOND_LLM_PASS",
  PARSE_RESPONSE = "PARSE_RESPONSE",
  EMIT_FRONTEND_EVENTS = "EMIT_FRONTEND_EVENTS",
  FINAL_RESPONSE_READY = "FINAL_RESPONSE_READY",
  COMPLETE = "COMPLETE",
  ERROR = "ERROR",
  CANCELLED = "CANCELLED",
  TIMEOUT = "TIMEOUT",
}

/** Allowed terminal states — every request must end in exactly one */
export const TERMINAL_STATES: readonly RequestState[] = [
  RequestState.COMPLETE,
  RequestState.ERROR,
  RequestState.CANCELLED,
  RequestState.TIMEOUT,
];

/** Map of valid state transitions */
export const STATE_TRANSITIONS: Record<RequestState, RequestState[]> = {
  [RequestState.IDLE]: [RequestState.REQUEST_RECEIVED],
  [RequestState.REQUEST_RECEIVED]: [RequestState.BUILD_CONTEXT, RequestState.ERROR, RequestState.CANCELLED, RequestState.TIMEOUT],
  [RequestState.BUILD_CONTEXT]: [RequestState.CALL_PROVIDER, RequestState.ERROR, RequestState.CANCELLED, RequestState.TIMEOUT],
  [RequestState.CALL_PROVIDER]: [RequestState.STREAMING, RequestState.ERROR, RequestState.CANCELLED, RequestState.TIMEOUT],
  [RequestState.STREAMING]: [RequestState.TOOL_CALL_DETECTED, RequestState.PARSE_RESPONSE, RequestState.ERROR, RequestState.CANCELLED, RequestState.TIMEOUT],
  [RequestState.TOOL_CALL_DETECTED]: [RequestState.EXECUTE_TOOL, RequestState.ERROR, RequestState.CANCELLED, RequestState.TIMEOUT],
  [RequestState.EXECUTE_TOOL]: [RequestState.WAIT_FOR_TOOL_RESULT, RequestState.ERROR, RequestState.CANCELLED, RequestState.TIMEOUT],
  [RequestState.WAIT_FOR_TOOL_RESULT]: [RequestState.SECOND_LLM_PASS, RequestState.ERROR, RequestState.CANCELLED, RequestState.TIMEOUT],
  [RequestState.SECOND_LLM_PASS]: [RequestState.PARSE_RESPONSE, RequestState.ERROR, RequestState.CANCELLED, RequestState.TIMEOUT],
  [RequestState.PARSE_RESPONSE]: [RequestState.EMIT_FRONTEND_EVENTS, RequestState.FINAL_RESPONSE_READY, RequestState.ERROR, RequestState.CANCELLED, RequestState.TIMEOUT],
  [RequestState.EMIT_FRONTEND_EVENTS]: [RequestState.FINAL_RESPONSE_READY, RequestState.ERROR, RequestState.CANCELLED, RequestState.TIMEOUT],
  [RequestState.FINAL_RESPONSE_READY]: [RequestState.COMPLETE, RequestState.ERROR, RequestState.CANCELLED, RequestState.TIMEOUT],
  [RequestState.COMPLETE]: [],
  [RequestState.ERROR]: [],
  [RequestState.CANCELLED]: [],
  [RequestState.TIMEOUT]: [],
};

/* ─── State Machine Instance ─────────────────────────────── */

export interface StateMachine {
  readonly context: RequestContext;
  readonly currentState: RequestState;
  readonly stateHistory: Array<{ from: RequestState; to: RequestState; timestamp: number }>;

  /** Transition to a new state. Throws if transition is invalid. */
  transition(to: RequestState): void;

  /** Check if the request has terminated (COMPLETE, ERROR, CANCELLED, or TIMEOUT) */
  readonly isTerminated: boolean;

  /** Check if the request is in an error state */
  readonly isError: boolean;
}

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
  /**
   * Structured browser events that the tool wants the frontend to execute.
   * The orchestrator validates these events and passes them to the frontend.
   * The tool MUST NOT directly manipulate the DOM.
   */
  events?: BrowserEvent[];
}

/**
 * Standardized response that every tool MUST return.
 * The AI reasons ONLY over these fields — never fabricates outcomes.
 */
export interface StandardToolResponse {
  success: boolean;
  data: Record<string, unknown> | null;
  message: string;
  error: {
    code: string;
    message: string;
  } | null;
  /**
   * Browser events that the frontend should execute after this tool completes.
   * The orchestrator validates and dispatches these.
   */
  events?: BrowserEvent[];
}

/* ─── Browser Events ─────────────────────────────────────── */

/**
 * A structured event that represents a browser-side action.
 * Tools return these instead of directly manipulating the DOM.
 * The orchestrator validates them, and the frontend dispatches them.
 */
export type BrowserEvent =
  | DownloadPdfEvent
  | NavigateEvent
  | ScrollToEvent
  | FocusEvent;

export interface DownloadPdfEvent {
  type: "download-pdf";
  /** The URL or endpoint to fetch the PDF from */
  url: string;
  /** The method to use */
  method: "GET" | "POST";
  /** Optional request body (for POST) */
  body?: Record<string, unknown>;
  /** Suggested filename */
  filename: string;
  /** Unique event ID for tracking completion */
  eventId: string;
}

export interface NavigateEvent {
  type: "navigate";
  url: string;
  eventId: string;
}

export interface ScrollToEvent {
  type: "scroll-to";
  selector: string;
  eventId: string;
}

export interface FocusEvent {
  type: "focus";
  selector: string;
  eventId: string;
}

/**
 * Result returned after the frontend executes a BrowserEvent.
 */
export interface BrowserEventResult {
  eventId: string;
  success: boolean;
  error?: string;
}

/* ─── Streaming ──────────────────────────────────────────── */

export type StreamChunk =
  | { type: "text"; content: string }
  | { type: "tool-call"; toolCall: AIToolCall }
  | { type: "tool-result"; result: ToolResult }
  | { type: "done"; content: string }
  | { type: "error"; message: string; code?: string };

/**
 * Guaranteed streaming contract:
 *   1 onStart() at the beginning
 *   0+ onChunk() calls for text
 *   0+ onToolCall() calls (if the LLM requests tools)
 *   0+ onToolResult() calls (tool execution results)
 *   exactly 1 onDone() OR exactly 1 onError()
 *   exactly 1 cleanup() at the end
 */
export interface StreamCallbacks {
  onStart: () => void;
  onChunk: (text: string, requestId: RequestId) => void;
  onToolCall: (toolCall: AIToolCall, requestId: RequestId) => void;
  onToolResult: (result: ToolResult, requestId: RequestId) => void;
  onDone: (fullContent: string, requestId: RequestId) => void;
  onError: (error: Error, requestId: RequestId) => void;
  cleanup: () => void;
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
  "showTrainList": "train-list",
  "showSeatMap": "seat-map",
  "showBookingConfirmation": "booking-confirmation",
  "showJourneyTracker": "journey-tracker",
  "showPnrStatus": "pnr-status",
  "showBookingHistory": "booking-history",
  "showStationSearch": "station-search",
  "showRouteComparison": "route-comparison",
};

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
