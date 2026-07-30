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
import type { AIComponentType, ToolResult } from "@/lib/ai/types";
import { buildSeatId, buildTrainFromBookingData, buildQueryFromBookingData } from "@/lib/booking-store-utils";

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

/* ─── Recent Bookings (localStorage) ───────────────────────── */

const RECENT_BOOKINGS_KEY = "railyRecentBookings";

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
      "showTrainList": "train-list",
      "showSeatMap": "seat-map",
      "showBookingConfirmation": "booking-confirmation",
      "showJourneyTracker": "journey-tracker",
      "showPnrStatus": "pnr-status",
      "showBookingHistory": "booking-history",
      "showStationSearch": "text",
      "showRouteComparison": "train-list",
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

  /**
   * Extract booking fields from a data source (either result.data or tool args)
   * and sync them to the React booking store. Used as the primary path for    * confirmBooking and as a defensive fallback for downloadTicketPdf and
   * sendTicketEmail.
   */
  const syncBookingFromData = useCallback((source: Record<string, unknown>) => {
    const pnr = source.pnr as string;
    const trainName = source.trainName as string;
    const trainNumber = source.trainNumber as string;
    const departure = source.departure as string;
    const arrival = source.arrival as string;
    const duration = (source.duration as string) || "";
    const rawFare = source.fare;
    const fare = typeof rawFare === "number" ? rawFare : Number(rawFare) || 0;
    const classType = source.class as string;
    const coach = source.coach as string;
    const seat = source.seat as string;
    const tier = source.tier as string;
    const seatId = buildSeatId(coach, seat, tier);
    const from = source.from as string;
    const fromCode = source.fromCode as string;
    const to = source.to as string;
    const toCode = source.toCode as string;
    const date = source.date as string;

    // Only sync if we have essential data
    if (!pnr || !trainName || !trainNumber) return;

    // Use extracted pure helpers for construction
    const train = buildTrainFromBookingData({
      trainName, trainNumber, departure, arrival, duration,
      fare, class: classType, coach, seat, tier,
      fromCode, toCode,
    });
    if (!train) return; // essential fields missing

    const query = buildQueryFromBookingData({
      from, fromCode, to, toCode, date,
    });

    setState((prev) => ({
      ...prev,
      step: "confirmed",
      pnrNumber: pnr,
      bookingConfirmed: true,
      selectedTrain: train,
      selectedCoach: coach || "B1",
      selectedSeat: seatId,
      query,
    }));
  }, []);

  /**
   * Sync the booking store React state when the AI's booking-related tools succeed.
   *    * Primary: confirmBooking — always syncs from result.data
   * Defensive fallback: downloadTicketPdf and sendTicketEmail — sync from args
   *   only when the store doesn't already have booking data (pnrNumber is null).
   *   This ensures the BookingConfirmation component renders correctly even if     *   confirmBooking's state sync was missed for any reason.
   */
  const handleToolResult = useCallback((toolName: string, args: Record<string, unknown>, result: ToolResult) => {
    if (!result.success) return;

    if (toolName === "confirmBooking" && result.data) {
      // Primary path: confirmBooking result.data has all fields
      syncBookingFromData(result.data as Record<string, unknown>);
      return;
    }

    // Defensive fallback: downloadTicketPdf or sendTicketEmail — sync from args
    // but only if the store doesn't already have booking data
    if (
      (toolName === "downloadTicketPdf" || toolName === "sendTicketEmail") &&
      result.success &&
      !stateRef.current.pnrNumber
    ) {
      const bookingData: Record<string, unknown> = {
        pnr: args.pnr,
        trainName: args.trainName,
        trainNumber: args.trainNumber,
        departure: args.departure,
        arrival: args.arrival,
        duration: args.duration,
        fare: args.fare,
        class: args.class,
        coach: args.coach,
        seat: args.seat,
        tier: args.tier,
        from: args.from,
        fromCode: args.fromCode,
        to: args.to,
        toCode: args.toCode,
        date: args.date,
      };
      syncBookingFromData(bookingData);
    }
  }, [syncBookingFromData]);

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
    try {
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
      onToolResult: (toolName: string, args: Record<string, unknown>, result: ToolResult) => {
        handleToolResult(toolName, args, result);
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
    } catch (err: unknown) {
      // Catch-all for unhandled exceptions from processWithAI
      const errorMsg = err instanceof Error ? err.message : "An unexpected error occurred";
      setState((prev) => {
        const messages = [...prev.messages];
        const idx = messages.findIndex((m) => m.id === streamMsgId);
        if (idx >= 0) {
          messages[idx] = {
            ...messages[idx],
            content: `I encountered an error: ${errorMsg}. Please try again or rephrase your request.`,
            streaming: false,
          };
        }
        return { ...prev, messages, isProcessing: false };
      });
      streamingMsgId.current = null;
    }
  }, [mapAIComponent, handleToolResult]);

  return (
    <BookingContext.Provider value={{
      state, setStep, setQuery, selectTrain,
      setSelectedCoach, setSelectedSeat, setSeatRecommendation,
      resetBooking, addMessage, clearMessages,
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
