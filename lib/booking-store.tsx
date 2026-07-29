"use client";

import {
  createContext,
  useContext,
  useCallback,
  useState,
  useRef,
  type ReactNode,
} from "react";
import * as rapi from "@/lib/rapi/endpoints";
import { processWithAI } from "@/lib/ai/orchestrator";
import type { AIComponentType } from "@/lib/ai/types";

/* ─── Types ───────────────────────────────────────────────── */

export type BookingStep =
  | "idle"
  | "searching"
  | "recommendations"
  | "coach-view"
  | "confirming"
  | "confirmed"
  | "pnr"
  | "journey";

export interface ExtractedQuery {
  origin: string;
  destination: string;
  date: string;
  budget?: number;
  preference?: string;
  raw: string;
}

export interface Train {
  id: string;
  name: string;
  number: string;
  departure: string;
  arrival: string;
  duration: string;
  price: number;
  available: number;
  probability: number;
  classType: string;
  isSuperfast: boolean;
  rating: number;
  badge?: "best" | "fastest" | "cheapest" | "comfortable";
  reason?: string;
}

export interface SeatRecommendation {
  seatId: string;
  number: number;
  tier: string;
  coach: string;
  reason: string;
}

/* ─── Chat Message System ─────────────────────────────────── */

export type ChatComponentType =
  | "train-list"
  | "seat-map"
  | "booking-confirmation"
  | "journey-tracker"
  | "pnr-status"
  | "booking-history"
  | "loading"
  | "welcome"
  | "error"
  | "text";

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  component?: ChatComponentType;
  timestamp: number;
  /** If true, content is partial (streaming) and will be updated */
  streaming?: boolean;
}

let messageCounter = 0;
function generateMessageId(): string {
  return `msg-${Date.now()}-${++messageCounter}`;
}

export function createUserMessage(content: string): Message {
  return { id: generateMessageId(), role: "user", content, timestamp: Date.now() };
}

export function createAssistantMessage(content: string, component?: ChatComponentType): Message {
  return { id: generateMessageId(), role: "assistant", content, component, timestamp: Date.now() };
}

/* ─── Booking State ───────────────────────────────────────── */

export interface BookingState {
  step: BookingStep;
  query: ExtractedQuery | null;
  trains: Train[];
  selectedTrain: Train | null;
  selectedCoach: string;
  selectedSeat: string | null;
  seatRecommendation: SeatRecommendation | null;
  bookingConfirmed: boolean;
  pnrNumber: string | null;
  isProcessing: boolean;
  messages: Message[];
  rapiConnected: boolean;
  rapiError: string | null;
  aiConfigured: boolean;
  aiError: string | null;
}

/* ─── PNR Generator (simulated booking) ────────────────────── */

const PNR_FIRST_DIGITS = [4, 6, 8];

function generatePNR(trainNumber: string, coach: string, seatId: string | null): string {
  const now = new Date();
  const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}`;
  const raw = `${trainNumber}|${dateStr}|${coach}|${seatId || "-"}`;
  let hash = 0;
  for (let i = 0; i < raw.length; i++) { const char = raw.charCodeAt(i); hash = ((hash << 5) - hash) + char; hash |= 0; }
  const absHash = Math.abs(hash);
  const nineDigits = absHash % 1_000_000_000;
  const firstDigit = PNR_FIRST_DIGITS[absHash % PNR_FIRST_DIGITS.length];
  return `${firstDigit}${String(nineDigits).padStart(9, "0")}`;
}

/* ─── Recent Bookings (localStorage) ───────────────────────── */

const RECENT_BOOKINGS_KEY = "raily_recent_bookings";

interface RecentBooking {
  pnr: string;
  trainName: string;
  trainNumber: string;
  from: string;
  to: string;
  date: string;
  time: string;
  status: "CONFIRMED" | "RAC" | "WAITLIST" | "CANCELLED";
  timestamp: string;
}

function getRecentBookings(): RecentBooking[] {
  if (typeof window === "undefined") return [];
  try {
    const stored = localStorage.getItem(RECENT_BOOKINGS_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch { return []; }
}

function addRecentBooking(booking: RecentBooking): void {
  if (typeof window === "undefined") return;
  try {
    const existing = getRecentBookings();
    const filtered = existing.filter((b) => b.pnr !== booking.pnr);
    const updated = [booking, ...filtered].slice(0, 5);
    localStorage.setItem(RECENT_BOOKINGS_KEY, JSON.stringify(updated));
  } catch { /* silent */ }
}

export function getStoredRecentBookings(): RecentBooking[] {
  return getRecentBookings();
}

/* ─── Format Helpers ───────────────────────────────────────── */

export function formatDisplayDate(dateStr: string): string {
  if (!dateStr) return "";
  const today = toDateString(new Date());
  if (dateStr === today) return "Today";
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (dateStr === toDateString(tomorrow)) return "Tomorrow";
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
}

function toDateString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/* ─── Default State ────────────────────────────────────────── */

function createWelcomeMessage(): Message {
  return {
    id: "welcome", role: "assistant",
    content: "I'm your travel assistant for Indian Railways. Tell me where you'd like to go — I can search trains, check PNR status, track live journeys, and help with bookings.\n\nTry: \"Book Delhi to Jaipur tomorrow morning\"",
    component: "welcome", timestamp: Date.now(),
  };
}

const defaultState: BookingState = {
  step: "idle", query: null, trains: [], selectedTrain: null,
  selectedCoach: "B1", selectedSeat: null, seatRecommendation: null,
  bookingConfirmed: false, pnrNumber: null, isProcessing: false,
  messages: [createWelcomeMessage()], rapiConnected: false, rapiError: null,
  aiConfigured: false, aiError: null,
};

export function getSeatRecommendation(): SeatRecommendation {
  return {
    seatId: "7L", number: 7, tier: "Lower", coach: "B1",
    reason: "Window seat — enjoy the sunrise views as we cross the Aravalli hills.\nLower berth — easier access, preferred for daytime journeys.\nAway from toilets — bay 3 is the quietest section.\nNear exit — just 2 rows from the door for quick deboarding.",
  };
}

/* ─── Context ──────────────────────────────────────────────── */

interface BookingContextValue {
  state: BookingState;
  setStep: (step: BookingStep) => void;
  setQuery: (query: ExtractedQuery) => void;
  selectTrain: (train: Train) => void;
  setSelectedCoach: (coach: string) => void;
  setSelectedSeat: (seatId: string | null) => void;
  setSeatRecommendation: (rec: SeatRecommendation | null) => void;
  confirmBooking: () => Promise<string>;
  resetBooking: () => void;
  addMessage: (msg: Message) => void;
  clearMessages: () => void;
  processUserInput: (text: string) => Promise<void>;
  checkRapiConnection: () => Promise<boolean>;
  /** Update the last assistant message (used for streaming text) */
  updateLastMessage: (partialContent: string, component?: ChatComponentType) => void;
  /** Convert AI component type to ChatComponentType */
  mapAIComponent: (aiComponent: string) => ChatComponentType;
}

const BookingContext = createContext<BookingContextValue | null>(null);

export function BookingProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<BookingState>(defaultState);
  // Keep a ref to the streaming message ID so we can update it
  const streamingMsgId = useRef<string | null>(null);

  const setStep = useCallback((step: BookingStep) => setState((prev) => ({ ...prev, step, isProcessing: false })), []);
  const setQuery = useCallback((query: ExtractedQuery) => setState((prev) => ({ ...prev, query })), []);
  const selectTrain = useCallback((train: Train) => setState((prev) => ({
    ...prev, selectedTrain: train, step: "coach-view" as const, selectedCoach: "B1", selectedSeat: null, seatRecommendation: getSeatRecommendation(),
  })), []);
  const setSelectedCoach = useCallback((coach: string) => setState((prev) => ({ ...prev, selectedCoach: coach })), []);
  const setSelectedSeat = useCallback((seatId: string | null) => setState((prev) => ({ ...prev, selectedSeat: seatId })), []);
  const setSeatRecommendation = useCallback((rec: SeatRecommendation | null) => setState((prev) => ({ ...prev, seatRecommendation: rec })), []);

  // Ref to track the latest state synchronously for use in callbacks
  const stateRef = useRef(state);
  stateRef.current = state;

  const confirmBooking = useCallback(async (): Promise<string> => {
    const currentState = stateRef.current;
    const train = currentState.selectedTrain;
    const coach = currentState.selectedCoach;
    const seat = currentState.selectedSeat;
    const query = currentState.query;
    const pnr = generatePNR(train?.number || "00000", coach || "B1", seat);

    if (train && query) {
      addRecentBooking({
        pnr,
        trainName: train.name,
        trainNumber: train.number,
        from: query.origin.toUpperCase() || "—",
        to: query.destination.toUpperCase() || "—",
        date: query.date || new Date().toLocaleDateString(),
        time: `${train.departure} → ${train.arrival}`,
        status: "CONFIRMED" as const,
        timestamp: new Date().toISOString(),
      });
    }

    // Update state synchronously
    setState((prev) => ({
      ...prev,
      isProcessing: false,
      bookingConfirmed: true,
      step: "confirmed" as const,
      pnrNumber: pnr,
    }));

    return pnr;
  }, []);

  const resetBooking = useCallback(() => setState({ ...defaultState, messages: [createWelcomeMessage()] }), []);
  const addMessage = useCallback((msg: Message) => setState((prev) => ({ ...prev, messages: [...prev.messages, msg] })), []);
  const clearMessages = useCallback(() => setState((prev) => ({ ...prev, messages: [createWelcomeMessage()] })), []);

  const updateLastMessage = useCallback((partialContent: string, component?: ChatComponentType) => {
    setState((prev) => {
      const messages = [...prev.messages];
      const lastIdx = messages.length - 1;
      if (lastIdx >= 0 && messages[lastIdx].role === "assistant") {
        messages[lastIdx] = {
          ...messages[lastIdx],
          content: partialContent,
          component: component || messages[lastIdx].component,
          streaming: true,
        };
      }
      return { ...prev, messages };
    });
  }, []);

  /** Map AI component type tags to our ChatComponentType */
  const mapAIComponent = useCallback((aiComponent: string): ChatComponentType => {
    const map: Record<string, ChatComponentType> = {
      "show_train_list": "train-list",
      "show_seat_map": "seat-map",
      "show_booking_confirmation": "booking-confirmation",
      "show_journey_tracker": "journey-tracker",
      "show_pnr_status": "pnr-status",
      "show_booking_history": "booking-history",
      "show_station_search": "text",
      "show_route_comparison": "train-list",
    };
    return map[aiComponent] || "text";
  }, []);

  const checkRapiConnection = useCallback(async (): Promise<boolean> => {
    try {
      const result = await rapi.getHealth();
      const connected = result.success;
      setState((prev) => ({ ...prev, rapiConnected: connected, rapiError: connected ? null : "RAPI server unreachable" }));
      return connected;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "RAPI server unreachable";
      setState((prev) => ({ ...prev, rapiConnected: false, rapiError: message }));
      return false;
    }
  }, []);

  /* ── Process User Input (AI-native) ──────────────────────── */

  const processUserInput = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;

    // Add user message
    const userMsg = createUserMessage(trimmed);
    setState((prev) => ({ ...prev, messages: [...prev.messages, userMsg], isProcessing: true }));

    // Create a streaming message placeholder
    const streamMsgId = `msg-stream-${Date.now()}`;
    streamingMsgId.current = streamMsgId;
    const streamMsg: Message = {
      id: streamMsgId,
      role: "assistant",
      content: "",
      streaming: true,
      timestamp: Date.now(),
    };
    setState((prev) => ({ ...prev, messages: [...prev.messages, streamMsg] }));

    // Process with AI
    await processWithAI(trimmed, {
      onText: (chunk: string) => {
        // Accumulate text into the streaming message
        setState((prev) => {
          const messages = [...prev.messages];
          const idx = messages.findIndex((m) => m.id === streamMsgId);
          if (idx >= 0) {
            messages[idx] = {
              ...messages[idx],
              content: messages[idx].content + chunk,
              streaming: true,
            };
          }
          return { ...prev, messages };
        });
      },
      onToolCall: (toolName: string, _args: Record<string, unknown>) => {
        // Show which tool is being called (subtle indicator)
        setState((prev) => {
          const messages = [...prev.messages];
          const idx = messages.findIndex((m) => m.id === streamMsgId);
          if (idx >= 0) {
            const toolLabel = toolName.replace(/_/g, " ");
            messages[idx] = {
              ...messages[idx],
              content: messages[idx].content + `\n_→ ${toolLabel}..._`,
              streaming: true,
            };
          }
          return { ...prev, messages };
        });
      },
      onComponent: (component: AIComponentType) => {
        // Map AI component to ChatComponentType and update the message
        setState((prev) => {
          const messages = [...prev.messages];
          const idx = messages.findIndex((m) => m.id === streamMsgId);
          if (idx >= 0) {
            messages[idx] = {
              ...messages[idx],
              component: mapAIComponent(component),
              streaming: false,
            };
          }
          return { ...prev, messages };
        });
      },
      onDone: (_fullContent: string, _component: string | null) => {
        // Mark streaming as complete
        setState((prev) => {
          const messages = [...prev.messages];
          const idx = messages.findIndex((m) => m.id === streamMsgId);
          if (idx >= 0) {
            messages[idx] = {
              ...messages[idx],
              streaming: false,
            };
          }
          return { ...prev, messages, isProcessing: false };
        });
        streamingMsgId.current = null;
      },
      onError: (error: string) => {
        // Show error in the streaming message
        setState((prev) => {
          const messages = [...prev.messages];
          const idx = messages.findIndex((m) => m.id === streamMsgId);
          if (idx >= 0) {
            messages[idx] = {
              ...messages[idx],
              content: `I encountered an error: ${error}. Please try again or rephrase your request.`,
              streaming: false,
            };
          } else {
            // Fallback: add error message
            messages.push({
              id: `msg-error-${Date.now()}`,
              role: "assistant",
              content: `I encountered an error: ${error}. Please try again.`,
              component: "text",
              timestamp: Date.now(),
            });
          }
          return { ...prev, messages, isProcessing: false };
        });
        streamingMsgId.current = null;
      },
    });
  }, [mapAIComponent]);

  return (
    <BookingContext.Provider value={{
      state, setStep, setQuery, selectTrain,
      setSelectedCoach, setSelectedSeat, setSeatRecommendation,
      confirmBooking, resetBooking, addMessage, clearMessages,
      processUserInput, checkRapiConnection,
      updateLastMessage, mapAIComponent,
    }}>
      {children}
    </BookingContext.Provider>
  );
}

export function useBooking() {
  const ctx = useContext(BookingContext);
  if (!ctx) throw new Error("useBooking must be used within BookingProvider");
  return ctx;
}