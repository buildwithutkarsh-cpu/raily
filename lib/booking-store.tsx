"use client";

import {
  createContext,
  useContext,
  useCallback,
  useState,
  type ReactNode,
  type Dispatch,
  type SetStateAction,
} from "react";
import { getRailwayClient } from "@/lib/railway/client";
import type { TrainSearchEntry, ApiResponse } from "@/lib/railway/types";

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
  lastApiCall: {
    endpoint: string;
    success: boolean;
    cached: boolean;
    timestamp: string;
  } | null;
}

/* ─── City-to-Station Code Mapping ──────────────────────────── */

const CITY_TO_CODE: Record<string, string> = {
  delhi: "NDLS",
  "new delhi": "NDLS",
  mumbai: "BCT",
  bombay: "BCT",
  jaipur: "JP",
  chennai: "MAS",
  madras: "MAS",
  bangalore: "SBC",
  bengaluru: "SBC",
  howrah: "HWH",
  kolkata: "HWH",
  calcutta: "HWH",
  chandigarh: "CDG",
  lucknow: "LKO",
  patna: "PNBE",
  ahmedabad: "ADI",
  pune: "PUNE",
  bhopal: "BPL",
  amritsar: "ASR",
  nagpur: "NGP",
  secunderabad: "SC",
  hyderabad: "SC",
  guwahati: "GHY",
  varanasi: "BSB",
  agra: "AGC",
  mathura: "MTJ",
  ajmer: "AII",
  udaipur: "UDZ",
  jodhpur: "JU",
  indore: "INDB",
  vadodara: "BRC",
  surat: "ST",
};

function resolveStationCode(name: string): string {
  const clean = name.trim().toLowerCase();
  // Direct code match (e.g., "NDLS")
  if (/^[A-Z]{2,5}$/i.test(clean)) return clean.toUpperCase();
  // City name lookup
  return CITY_TO_CODE[clean] || clean.substring(0, 4).toUpperCase();
}

/* ─── Default State ────────────────────────────────────────── */

const defaultState: BookingState = {
  step: "idle",
  query: null,
  trains: [],
  selectedTrain: null,
  selectedCoach: "B1",
  selectedSeat: null,
  seatRecommendation: null,
  bookingConfirmed: false,
  pnrNumber: null,
  isProcessing: false,
  lastApiCall: null,
};

/* ─── Convert API Train Data to Frontend Format ─────────────── */

function convertToFrontendTrain(
  entry: TrainSearchEntry,
  index: number
): Train {
  const availClass =
    entry.availableClasses.length > 0
      ? entry.availableClasses.reduce((best, current) =>
          current.fare < best.fare ? current : best
        )
      : null;

  const totalSeats = entry.availableClasses.reduce(
    (sum, c) => sum + c.seats,
    0
  );

  const probability = availClass && availClass.fare > 0
    ? Math.min(Math.round((1 - availClass.fare / 5000) * 50 + 45 + Math.random() * 5), 98)
    : 85;

  return {
    id: `${entry.train.number}-${index}`,
    name: entry.train.name,
    number: entry.train.number,
    departure: entry.train.departure,
    arrival: entry.train.arrival,
    duration: entry.train.duration,
    price: availClass?.fare || 0,
    available: totalSeats,
    probability,
    classType: entry.availableClasses[0]?.code || "SL",
    isSuperfast: entry.train.type === "SUPERFAST" || entry.train.type === "RAJDHANI" || entry.train.type === "SHATABDI" || entry.train.type === "DURONTO",
    rating: Math.round((4 + Math.random()) * 10) / 10,
    badge: entry.recommendation?.badge,
    reason: entry.recommendation?.reason,
  };
}

export function getSeatRecommendation(train: Train): SeatRecommendation {
  return {
    seatId: "7L",
    number: 7,
    tier: "Lower",
    coach: "B1",
    reason:
      "✓ Window seat — enjoy the sunrise views as we cross the Aravalli hills.\n✓ Lower berth — easier access, preferred for daytime journeys.\n✓ Away from toilets — bay 3 is the quietest section of the coach.\n✓ Near exit — just 2 rows from the door for quick deboarding.",
  };
}

/* ─── Context ──────────────────────────────────────────────── */

interface BookingContextValue {
  state: BookingState;
  setStep: (step: BookingStep) => void;
  setQuery: (query: ExtractedQuery) => void;
  setTrains: (trains: Train[]) => void;
  selectTrain: (train: Train) => void;
  setSelectedCoach: (coach: string) => void;
  setSelectedSeat: (seatId: string | null) => void;
  setSeatRecommendation: (rec: SeatRecommendation | null) => void;
  confirmBooking: () => void;
  resetBooking: () => void;
  updateState: Dispatch<SetStateAction<BookingState>>;
  /** Fetch trains from the Railway API (real or mock) */
  fetchTrains: (query: ExtractedQuery) => Promise<void>;
  /** Check PNR status via the Railway API */
  fetchPNR: (pnr: string) => Promise<ApiResponse<any>>;
  /** Search stations via the Railway API */
  searchStations: (q: string) => Promise<ApiResponse<any>>;
  /** Get live status via Railway API */
  fetchLiveStatus: (trainNumber: string) => Promise<ApiResponse<any>>;
}

const BookingContext = createContext<BookingContextValue | null>(null);

export function BookingProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<BookingState>(defaultState);

  const setStep = useCallback((step: BookingStep) => {
    setState((prev) => ({ ...prev, step, isProcessing: false }));
  }, []);

  const setQuery = useCallback((query: ExtractedQuery) => {
    setState((prev) => ({ ...prev, query }));
  }, []);

  const setTrains = useCallback((trains: Train[]) => {
    setState((prev) => ({ ...prev, trains }));
  }, []);

  const selectTrain = useCallback((train: Train) => {
    setState((prev) => ({
      ...prev,
      selectedTrain: train,
      step: "coach-view",
      selectedCoach: "B1",
      selectedSeat: null,
      seatRecommendation: getSeatRecommendation(train),
    }));
  }, []);

  const setSelectedCoach = useCallback((coach: string) => {
    setState((prev) => ({ ...prev, selectedCoach: coach }));
  }, []);

  const setSelectedSeat = useCallback((seatId: string | null) => {
    setState((prev) => ({ ...prev, selectedSeat: seatId }));
  }, []);

  const setSeatRecommendation = useCallback(
    (rec: SeatRecommendation | null) => {
      setState((prev) => ({ ...prev, seatRecommendation: rec }));
    },
    []
  );

  const confirmBooking = useCallback(() => {
    setState((prev) => ({
      ...prev,
      bookingConfirmed: true,
      step: "confirmed",
      pnrNumber: "4785213694",
    }));
  }, []);

  const resetBooking = useCallback(() => {
    setState(defaultState);
  }, []);

  /* ── API: Fetch Trains ──────────────────────────────────── */
  const fetchTrains = useCallback(async (query: ExtractedQuery) => {
    setState((prev) => ({ ...prev, isProcessing: true, step: "searching" }));

    try {
      const client = getRailwayClient();
      const fromCode = resolveStationCode(query.origin);
      const toCode = resolveStationCode(query.destination);

      const result = await client.searchTrains(fromCode, toCode, query.date);

      if (!result.success) {
        setState((prev) => ({
          ...prev,
          isProcessing: false,
          trains: [],
          lastApiCall: {
            endpoint: "searchTrains",
            success: false,
            cached: false,
            timestamp: new Date().toISOString(),
          },
        }));
        return;
      }

      setState((prev) => ({
        ...prev,
        isProcessing: false,
        trains: (result.data?.trains || []).map((t, i) =>
          convertToFrontendTrain(t, i)
        ),
        step: "recommendations",
        lastApiCall: {
          endpoint: "searchTrains",
          success: result.success,
          cached: result.cached,
          timestamp: result.timestamp,
        },
      }));
    } catch (err) {
      setState((prev) => ({
        ...prev,
        isProcessing: false,
        trains: [],
        lastApiCall: {
          endpoint: "searchTrains",
          success: false,
          cached: false,
          timestamp: new Date().toISOString(),
        },
      }));
    }
  }, []);

  /* ── API: Fetch PNR ─────────────────────────────────────── */
  const fetchPNR = useCallback(async (pnr: string) => {
    const client = getRailwayClient();
    const result = await client.getPNRStatus(pnr);
    return result;
  }, []);

  /* ── API: Search Stations ───────────────────────────────── */
  const searchStations = useCallback(async (q: string) => {
    const client = getRailwayClient();
    const result = await client.searchStations(q);
    return result;
  }, []);

  /* ── API: Live Status ───────────────────────────────────── */
  const fetchLiveStatus = useCallback(async (trainNumber: string) => {
    const client = getRailwayClient();
    const result = await client.getLiveStatus(trainNumber);
    return result;
  }, []);

  return (
    <BookingContext.Provider
      value={{
        state,
        setStep,
        setQuery,
        setTrains,
        selectTrain,
        setSelectedCoach,
        setSelectedSeat,
        setSeatRecommendation,
        confirmBooking,
        resetBooking,
        updateState: setState,
        fetchTrains,
        fetchPNR,
        searchStations,
        fetchLiveStatus,
      }}
    >
      {children}
    </BookingContext.Provider>
  );
}

export function useBooking() {
  const ctx = useContext(BookingContext);
  if (!ctx) throw new Error("useBooking must be used within BookingProvider");
  return ctx;
}
