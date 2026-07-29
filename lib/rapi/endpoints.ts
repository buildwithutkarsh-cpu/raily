/* ══════════════════════════════════════════════════════════════
   RAPI — Endpoint Functions
   
   High-level functions that call the Rapi client and return
   typed responses. Each function maps to one RAPI endpoint.
   ══════════════════════════════════════════════════════════════ */

import { getRapiClient } from "./client";
import type { RapiResponse } from "./client";

/* ─── Station Search ───────────────────────────────────────── */
/* GET /api/v1/stations/autocomplete?q=                         */

export interface RapiStation {
  code: string;
  name: string;
  state: string;
  zone: string;
}

export interface StationSearchData {
  query: string;
  total: number;
  stations: RapiStation[];
}

export async function searchStations(
  query: string
): Promise<RapiResponse<StationSearchData>> {
  return getRapiClient().get<StationSearchData>(
    `/api/v1/stations/autocomplete?q=${encodeURIComponent(query)}`
  );
}

/* ─── Train Search ─────────────────────────────────────────── */
/* GET /api/v1/trains/search?from=NDLS&to=BCT&date=DD-MM-YYYY  */

export interface RapiTrainEntry {
  train_no: string;
  train_name: string;
  source_stn_name: string;
  source_stn_code: string;
  dstn_stn_name: string;
  dstn_stn_code: string;
  from_stn_name: string;
  from_stn_code: string;
  to_stn_name: string;
  to_stn_code: string;
  from_time: string;
  to_time: string;
  travel_time: string;
  running_days: string;
  train_type?: string;
}

export interface TrainSearchData {
  from: string;
  to: string;
  date?: string;
  total: number;
  trains: RapiTrainEntry[];
}

export async function searchTrains(
  from: string,
  to: string,
  date?: string
): Promise<RapiResponse<TrainSearchData>> {
  const dateParam = date ? `&date=${toRapiDate(date)}` : "";
  return getRapiClient().get<TrainSearchData>(
    `/api/v1/trains/search?from=${from}&to=${to}${dateParam}`
  );
}

/* ─── Train Info (Schedule + Route) ────────────────────────── */
/* GET /api/v1/trains/:trainNumber/info                          */

export interface RapiRouteStation {
  stnCode: string;
  stnName: string;
  arrival: string;
  departure: string;
  distance: number;
  day: number;
  platform?: string;
  zone?: string;
}

export interface TrainInfoData {
  train_no: string;
  train_name: string;
  from_stn_name: string;
  from_stn_code: string;
  to_stn_name: string;
  to_stn_code: string;
  from_time: string;
  to_time: string;
  travel_time: string;
  running_days: string;
  type: string;
  distance: number;
  avg_speed: number;
  totalStops: number;
  route: RapiRouteStation[];
}

export async function getTrainInfo(
  trainNumber: string
): Promise<RapiResponse<TrainInfoData>> {
  return getRapiClient().get<TrainInfoData>(
    `/api/v1/trains/${trainNumber}/info`
  );
}

/* ─── Live Status ──────────────────────────────────────────── */
/* GET /api/v1/trains/:trainNumber/live?date=DD-MM-YYYY         */

export interface RapiLiveStation {
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
  status: "passed" | "current" | "upcoming";
}

export interface LiveStatusData {
  trainNo: string;
  trainName: string;
  date: string;
  statusNote: string;
  lastUpdate: string;
  currentStationCode: string;
  currentStationName: string;
  delay: number;
  totalStations: number;
  timeline: RapiLiveStation[];
}

export async function getLiveStatus(
  trainNumber: string,
  date?: string
): Promise<RapiResponse<LiveStatusData>> {
  const dateParam = date ? `?date=${toRapiDate(date)}` : "";
  return getRapiClient().get<LiveStatusData>(
    `/api/v1/trains/${trainNumber}/live${dateParam}`
  );
}

/* ─── Seat Availability ────────────────────────────────────── */
/* GET /api/v1/trains/:trainNumber/availability?from=&to=&date=  */

export interface RapiClassAvailability {
  classCode: string;
  className: string;
  status: string;
  available: number;
  fare: number;
  isTatkal: boolean;
}

export interface AvailabilityData {
  trainNo: string;
  trainName: string;
  from: { code: string; name: string };
  to: { code: string; name: string };
  date: string;
  quota: string;
  classes: RapiClassAvailability[];
  totalClasses: number;
}

export async function getAvailability(
  trainNumber: string,
  from: string,
  to: string,
  date: string,
  quota = "GN"
): Promise<RapiResponse<AvailabilityData>> {
  return getRapiClient().get<AvailabilityData>(
    `/api/v1/trains/${trainNumber}/availability?from=${from}&to=${to}&date=${toRapiDate(date)}&quota=${quota}`
  );
}

/* ─── Fare ─────────────────────────────────────────────────── */
/* GET /api/v1/trains/:trainNumber/fare?from=&to=&date=          */

export interface FareData {
  trainNo: string;
  trainName: string;
  from: { code: string; name: string };
  to: { code: string; name: string };
  date: string;
  quota: string;
  classes: RapiClassAvailability[];
  totalClasses: number;
}

export async function getFare(
  trainNumber: string,
  from: string,
  to: string,
  date: string,
  quota = "GN"
): Promise<RapiResponse<FareData>> {
  return getRapiClient().get<FareData>(
    `/api/v1/trains/${trainNumber}/fare?from=${from}&to=${to}&date=${toRapiDate(date)}&quota=${quota}`
  );
}

/* ─── PNR Status ───────────────────────────────────────────── */
/* GET /api/v1/pnr/:pnr                                         */

export interface RapiPassenger {
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

export interface PNRStatusData {
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
  passengers: RapiPassenger[];
}

export async function getPNRStatus(
  pnr: string
): Promise<RapiResponse<PNRStatusData>> {
  return getRapiClient().get<PNRStatusData>(`/api/v1/pnr/${pnr}`);
}

/* ─── Health ────────────────────────────────────────────────── */
/* GET /api/v1/admin/health                                       */

export interface HealthData {
  status: string;
  uptime: number;
  memory: { rss: number; heapTotal: number; heapUsed: number; external: number };
  cache: { keys: number; maxKeys: number; utilizationPercent: number; hitRate: number };
}

export async function getHealth(): Promise<RapiResponse<HealthData>> {
  return getRapiClient().get<HealthData>("/api/v1/admin/health");
}

/* ─── Cache Telemetry ──────────────────────────────────────── */
/* GET /api/v1/admin/cache                                        */

export interface CacheTelemetryData {
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

export async function getCacheTelemetry(): Promise<
  RapiResponse<CacheTelemetryData>
> {
  return getRapiClient().get<CacheTelemetryData>("/api/v1/admin/cache");
}

/* ─── Utility ──────────────────────────────────────────────── */

/** Convert YYYY-MM-DD to DD-MM-YYYY for Rapi */
export function toRapiDate(dateStr: string): string {
  if (!dateStr) return "";
  // If already DD-MM-YYYY, return as-is
  if (/^\d{2}-\d{2}-\d{4}$/.test(dateStr)) return dateStr;
  // Convert YYYY-MM-DD → DD-MM-YYYY
  const parts = dateStr.split("-");
  if (parts.length === 3 && parts[0].length === 4) {
    return `${parts[2]}-${parts[1]}-${parts[0]}`;
  }
  return dateStr;
}

/** Get today's date in DD-MM-YYYY format */
export function todayRapiDate(): string {
  const d = new Date();
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}-${mm}-${yyyy}`;
}