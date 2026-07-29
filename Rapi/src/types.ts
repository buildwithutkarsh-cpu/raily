/* ══════════════════════════════════════════════════════════════
   RAPI — Unified TypeScript Types & Zod Schemas
   ══════════════════════════════════════════════════════════════ */

import { z } from "zod";

/* ─── Response Envelope ───────────────────────────────────── */

export interface ApiSuccess<T> {
  success: true;
  data: T;
  cached: boolean;
  timestamp: string;
  requestId: string;
}

export interface ApiError {
  success: false;
  error: {
    code: string;
    message: string;
    retryable: boolean;
  };
  timestamp: string;
  requestId: string;
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError;

/* ─── Error Codes ─────────────────────────────────────────── */

export const ErrorCode = {
  PARSE_FAILURE: "PARSE_FAILURE",
  INVALID_INPUT: "INVALID_INPUT",
  UPSTREAM_ERROR: "UPSTREAM_ERROR",
  UPSTREAM_UNREACHABLE: "UPSTREAM_UNREACHABLE",
  UPSTREAM_RATE_LIMIT: "UPSTREAM_RATE_LIMIT",
  TIMEOUT: "TIMEOUT",
  NOT_FOUND: "NOT_FOUND",
  INTERNAL_ERROR: "INTERNAL_ERROR",
  NOT_CONFIGURED: "NOT_CONFIGURED",
  RATE_LIMITED: "RATE_LIMITED",
  UNAUTHORIZED: "UNAUTHORIZED",
} as const;

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

/* ─── Train Search ────────────────────────────────────────── */

export interface TrainSearchEntry {
  trainNumber: string;
  trainName: string;
  sourceStationName: string;
  sourceStationCode: string;
  destinationStationName: string;
  destinationStationCode: string;
  fromStationName: string;
  fromStationCode: string;
  toStationName: string;
  toStationCode: string;
  fromTime: string;
  toTime: string;
  travelTime: string;
  runningDays: string;
  trainType?: string;
}

export interface TrainSearchResponse {
  from: string;
  to: string;
  total: number;
  trains: TrainSearchEntry[];
}

export const TrainSearchEntrySchema = z.object({
  trainNumber: z.string(),
  trainName: z.string(),
  sourceStationName: z.string(),
  sourceStationCode: z.string(),
  destinationStationName: z.string(),
  destinationStationCode: z.string(),
  fromStationName: z.string(),
  fromStationCode: z.string(),
  toStationName: z.string(),
  toStationCode: z.string(),
  fromTime: z.string(),
  toTime: z.string(),
  travelTime: z.string(),
  runningDays: z.string(),
  trainType: z.string().optional(),
});

/* ─── Train Info ──────────────────────────────────────────── */

export interface RouteStation {
  stationCode: string;
  stationName: string;
  arrival: string;
  departure: string;
  distance: number;
  day: number;
  platform?: string;
  zone?: string;
}

export interface TrainInfoResponse {
  trainNumber: string;
  trainName: string;
  fromStationName: string;
  fromStationCode: string;
  toStationName: string;
  toStationCode: string;
  fromTime: string;
  toTime: string;
  travelTime: string;
  runningDays: string;
  type: string;
  distance: number;
  averageSpeed: number;
  totalStops: number;
  route: RouteStation[];
}

export const RouteStationSchema = z.object({
  stationCode: z.string(),
  stationName: z.string(),
  arrival: z.string(),
  departure: z.string(),
  distance: z.number(),
  day: z.number(),
  platform: z.string().optional(),
  zone: z.string().optional(),
});

/* ─── Live Status ─────────────────────────────────────────── */

export type StationStatus = "passed" | "current" | "upcoming";

export interface LiveStation {
  stationCode: string;
  stationName: string;
  scheduledArrival: string;
  scheduledDeparture: string;
  actualArrival?: string;
  actualDeparture?: string;
  distance: number;
  day: number;
  platform?: string;
  delay: number;
  status: StationStatus;
}

export interface LiveStatusResponse {
  trainNumber: string;
  trainName: string;
  date: string;
  statusNote: string;
  lastUpdate: string;
  currentStationCode: string;
  currentStationName: string;
  delay: number;
  totalStations: number;
  timeline: LiveStation[];
}

export const LiveStationSchema = z.object({
  stationCode: z.string(),
  stationName: z.string(),
  scheduledArrival: z.string(),
  scheduledDeparture: z.string(),
  actualArrival: z.string().optional(),
  actualDeparture: z.string().optional(),
  distance: z.number(),
  day: z.number(),
  platform: z.string().optional(),
  delay: z.number(),
  status: z.enum(["passed", "current", "upcoming"]),
});

/* ─── Availability ────────────────────────────────────────── */

export type SeatStatus =
  | "AVAILABLE"
  | "RAC"
  | "WAITLIST"
  | "GNWL"
  | "PQWL"
  | "RLWL"
  | "RELEASE"
  | "CHART_PREPARED"
  | "NOT_AVAILABLE"
  | "NOT_APPLICABLE";

export interface ClassAvailability {
  classCode: string;
  className: string;
  status: SeatStatus;
  available: number;
  waitlistNumber?: number;
  fare: number;
  isTatkal: boolean;
  quota?: string;
}

export interface AvailabilityResponse {
  trainNumber: string;
  trainName: string;
  from: { code: string; name: string };
  to: { code: string; name: string };
  date: string;
  quota: string;
  classes: ClassAvailability[];
  totalClasses: number;
}

export const ClassAvailabilitySchema = z.object({
  classCode: z.string(),
  className: z.string(),
  status: z.enum([
    "AVAILABLE", "RAC", "WAITLIST", "GNWL", "PQWL",
    "RLWL", "RELEASE", "CHART_PREPARED", "NOT_AVAILABLE", "NOT_APPLICABLE",
  ]),
  available: z.number(),
  waitlistNumber: z.number().optional(),
  fare: z.number(),
  isTatkal: z.boolean(),
  quota: z.string().optional(),
});

/* ─── Fare ────────────────────────────────────────────────── */

export interface FareEntry {
  classCode: string;
  className: string;
  fare: number;
  isTatkal: boolean;
  quota?: string;
}

export interface FareResponse {
  trainNumber: string;
  trainName: string;
  from: { code: string; name: string };
  to: { code: string; name: string };
  date: string;
  quota: string;
  fares: FareEntry[];
  totalFares: number;
}

export const FareEntrySchema = z.object({
  classCode: z.string(),
  className: z.string(),
  fare: z.number(),
  isTatkal: z.boolean(),
  quota: z.string().optional(),
});

export const FareResponseSchema = z.object({
  trainNumber: z.string(),
  trainName: z.string(),
  from: z.object({ code: z.string(), name: z.string() }),
  to: z.object({ code: z.string(), name: z.string() }),
  date: z.string(),
  quota: z.string(),
  fares: z.array(FareEntrySchema),
  totalFares: z.number(),
});

/* ─── PNR ─────────────────────────────────────────────────── */

export interface PassengerInfo {
  serialNumber: string;
  coachPosition: number;
  booking: {
    status: string;
    coach: string | null;
    berthNo: number | null;
    berthCode: string | null;
    details: string;
  };
  current: {
    status: string;
    coach: string | null;
    berthNo: number | null;
    berthCode: string | null;
    details: string;
  };
}

export interface PNRResponse {
  pnr: string;
  train: { number: string; name: string };
  journey: {
    date: string;
    class: string;
    quota: string;
    source: { code: string; name: string };
    destination: { code: string; name: string };
    boardingPoint: { code: string; name: string };
    distance: number;
  };
  chart: { status: string; prepared: boolean };
  booking: { fare: number; ticketFare: number; bookingDate: string };
  passengers: PassengerInfo[];
}

/* ─── Station ─────────────────────────────────────────────── */

export interface Station {
  code: string;
  name: string;
  state: string;
  zone: string;
}

export interface StationAutocompleteResponse {
  query: string;
  total: number;
  stations: Station[];
}

/* ─── Cache Telemetry ─────────────────────────────────────── */

export interface CacheTelemetry {
  hits: number;
  misses: number;
  sets: number;
  evictions: number;
  staleHits: number;
  backgroundRefreshes: number;
  keys: number;
  maxKeys: number;
  utilizationPercent: number;
  hitRate: number;
  staleHitRate: number;
  missRate: number;
  totalRequests: number;
}

/* ─── Health ──────────────────────────────────────────────── */

export interface HealthResponse {
  status: "healthy" | "degraded" | "unhealthy";
  uptime: number;
  memory: {
    rss: number;
    heapTotal: number;
    heapUsed: number;
    external: number;
  };
  cache: {
    keys: number;
    maxKeys: number;
    utilizationPercent: number;
    hitRate: number;
  };
}