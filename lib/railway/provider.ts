/* ══════════════════════════════════════════════════════════════
   RAILWAY — Abstract Provider Interface
   All providers must implement this interface.
   Swap providers without changing any frontend code.
   ══════════════════════════════════════════════════════════════ */

import type {
  StationSearchResult,
  TrainSearchResult,
  SeatAvailability,
  PNRStatus,
  LiveStatus,
  FareEnquiry,
  CoachComposition,
  TrainSchedule,
} from "./types";

export interface RailwayProvider {
  name: string;
  /** Search stations by name or code (partial matching, autocomplete) */
  searchStations(query: string, limit?: number): Promise<StationSearchResult>;
  /** Search for trains between two stations on a given date */
  searchTrains(params: TrainSearchParams): Promise<TrainSearchResult>;
  /** Get detailed train information */
  getTrainSchedule(trainNumber: string): Promise<TrainSchedule>;
  /** Check seat availability for a specific train/class */
  getSeatAvailability(params: SeatAvailabilityParams): Promise<SeatAvailability>;
  /** Get fare information */
  getFare(params: FareParams): Promise<FareEnquiry>;
  /** Check PNR status */
  getPNRStatus(pnr: string): Promise<PNRStatus>;
  /** Get live running status of a train */
  getLiveStatus(trainNumber: string, station?: string): Promise<LiveStatus>;
  /** Get coach composition */
  getCoachComposition(trainNumber: string): Promise<CoachComposition>;
  /** Check if the provider is healthy */
  healthCheck(): Promise<boolean>;
}

/* ─── Query Parameters ─────────────────────────────────────── */

export interface TrainSearchParams {
  from: string; // station code
  to: string; // station code
  date: string; // YYYY-MM-DD
  class?: string;
  quota?: string; // GN, TQ, LD, etc.
}

export interface SeatAvailabilityParams {
  trainNumber: string;
  from: string;
  to: string;
  date: string;
  class?: string;
  quota?: string;
}

export interface FareParams {
  trainNumber: string;
  from: string;
  to: string;
  class?: string;
  quota?: string;
  date?: string;
}
