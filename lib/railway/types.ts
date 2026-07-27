/* ══════════════════════════════════════════════════════════════
   RAILWAY — Normalized Types
   All railway data types normalized from different providers
   into a single, consistent format for the frontend.
   ══════════════════════════════════════════════════════════════ */

/* ─── Station ──────────────────────────────────────────────── */

export interface Station {
  code: string;
  name: string;
  fullName?: string;
  state?: string;
  zone?: string;
  latitude?: number;
  longitude?: number;
}

export interface StationSearchResult {
  stations: Station[];
  total: number;
  query: string;
}

/* ─── Train ────────────────────────────────────────────────── */

export interface Train {
  number: string;
  name: string;
  type: TrainType;
  from: StationRef;
  to: StationRef;
  departure: string; // HH:mm
  arrival: string; // HH:mm
  duration: string; // e.g. "5h 25m"
  distance: number; // km
  runningDays: RunningDay[];
  classes: TrainClass[];
}

export type TrainType =
  | "RAJDHANI"
  | "SHATABDI"
  | "DURONTO"
  | "GARIB_RATH"
  | "SUPERFAST"
  | "EXPRESS"
  | "PASSENGER"
  | "LOCAL"
  | "OTHER";

export interface StationRef {
  code: string;
  name: string;
}

export interface RunningDay {
  day: "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";
  runs: boolean;
}

export interface TrainClass {
  code: string;
  name: string;
  available: boolean;
  fare?: number;
}

/* ─── Train Search Results ─────────────────────────────────── */

export interface TrainSearchResult {
  trains: TrainSearchEntry[];
  total: number;
  from: StationRef;
  to: StationRef;
  date: string;
}

export interface TrainSearchEntry {
  train: Train;
  availableClasses: TrainClassAvailability[];
  recommendation?: {
    badge: "best" | "fastest" | "cheapest" | "comfortable";
    reason: string;
  };
}

export interface TrainClassAvailability {
  code: string;
  name: string;
  available: boolean;
  fare: number;
  seats: number;
  status: AvailabilityStatus;
}

export type AvailabilityStatus = "AVAILABLE" | "RAC" | "WAITLIST" | "CLOSED" | "NOT_AVAILABLE";

/* ─── Seat Availability ────────────────────────────────────── */

export interface SeatAvailability {
  train: TrainRef;
  date: string;
  from: StationRef;
  to: StationRef;
  classes: SeatAvailabilityClass[];
  lastUpdated: string;
}

export interface TrainRef {
  number: string;
  name: string;
}

export interface SeatAvailabilityClass {
  code: string;
  name: string;
  fare: number;
  available: number;
  total: number;
  status: AvailabilityStatus;
  racCount?: number;
  wlCount?: number;
  berths?: BerthInfo[];
}

export interface BerthInfo {
  type: "lower" | "middle" | "upper" | "side-lower" | "side-upper";
  available: number;
  fare: number;
}

/* ─── PNR ──────────────────────────────────────────────────── */

export interface PNRStatus {
  pnr: string;
  train: TrainRef;
  from: StationRef;
  to: StationRef;
  boardingAt: StationRef;
  date: string;
  class: string;
  quota: string;
  chartPrepared: boolean;
  passengers: PNRPassenger[];
  status: PNRBookingStatus;
  departure: string;
  arrival: string;
  platform?: string;
  lastUpdated: string;
}

export type PNRBookingStatus = "CONFIRMED" | "RAC" | "WAITLIST" | "CANCELLED";

export interface PNRPassenger {
  number: number;
  name: string;
  age: number;
  gender: "M" | "F" | "T";
  status: string; // e.g. "CNF", "RAC 1", "WL 15"
  berth?: string; // e.g. "B1-34 (Lower)"
  coach?: string;
  seat?: string;
  bookingStatus: string;
  currentStatus: string;
}

/* ─── Live Running Status ──────────────────────────────────── */

export interface LiveStatus {
  train: TrainRef;
  currentStation: StationRef;
  lastUpdated: string;
  delay: number; // minutes
  speed: number; // km/h
  status: "ONTIME" | "DELAYED" | "CANCELLED" | "ARRIVED";
  hasDeparted: boolean;
  distanceCovered: number; // km
  totalDistance: number; // km
  position: number; // percent complete
  route: LiveStatusStation[];
}

export interface LiveStatusStation {
  station: StationRef;
  scheduledArrival: string;
  scheduledDeparture: string;
  actualArrival?: string;
  actualDeparture?: string;
  distance: number;
  day: number;
  platform?: string;
  delay: number;
  crossed: boolean;
}

/* ─── Fare ─────────────────────────────────────────────────── */

export interface FareEnquiry {
  train: TrainRef;
  from: StationRef;
  to: StationRef;
  date: string;
  classes: FareClass[];
  baseFare: number;
  totalFare: number;
  lastUpdated: string;
}

export interface FareClass {
  code: string;
  name: string;
  baseFare: number;
  reservationCharge: number;
  superfastCharge: number;
  convenienceFee: number;
  totalFare: number;
  available: boolean;
}

/* ─── Coach Composition ────────────────────────────────────── */

export interface CoachComposition {
  train: TrainRef;
  coaches: CoachInfo[];
  totalCoaches: number;
}

export interface CoachInfo {
  number: string;
  type: string;
  class: string;
  position: number; // from engine
  totalBerths: number;
  availableBerths?: number;
}

/* ─── Schedule ─────────────────────────────────────────────── */

export interface TrainSchedule {
  train: TrainRef;
  route: ScheduleStation[];
  totalStops: number;
  totalDistance: number;
  duration: string;
}

export interface ScheduleStation {
  station: StationRef;
  day: number;
  arrival: string;
  departure: string;
  distance: number;
  platform?: string;
  halt: string; // e.g. "2 min"
  zone: string;
}

/* ─── Error ────────────────────────────────────────────────── */

export interface RailwayError {
  code: string;
  message: string;
  details?: string;
  status: number;
}

/* ─── API Response Envelope ────────────────────────────────── */

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: RailwayError;
  cached: boolean;
  timestamp: string;
}
