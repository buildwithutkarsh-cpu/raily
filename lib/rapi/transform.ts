/* ══════════════════════════════════════════════════════════════
   RAPI — Frontend Transformation Layer
   
   Transforms snake_case RAPI responses into camelCase types
   used by the frontend components.
   
   This is the ONLY file that maps API data → UI data.
   ══════════════════════════════════════════════════════════════ */

import type { RapiTrainEntry, RapiRouteStation, RapiLiveStation, RapiClassAvailability, RapiPassenger, PNRStatusData, TrainInfoData, LiveStatusData, AvailabilityData } from "./endpoints";

/* ─── Types used by Components ─────────────────────────────── */

export interface StationOption {
  code: string;
  name: string;
  state: string;
}

export interface TrainOption {
  id: string;
  number: string;
  name: string;
  type: string;
  departure: string;
  arrival: string;
  duration: string;
  fromCode: string;
  fromName: string;
  toCode: string;
  toName: string;
  distance: number;
  runningDays: string;
}

export interface RouteStation {
  code: string;
  name: string;
  arrival: string;
  departure: string;
  distance: number;
  day: number;
  platform: string;
}

export interface LiveStation {
  code: string;
  name: string;
  scheduledArrival: string;
  scheduledDeparture: string;
  distance: number;
  day: number;
  platform: string;
  delay: number;
  status: "passed" | "current" | "upcoming";
}

export interface ClassAvailability {
  code: string;
  name: string;
  status: "AVAILABLE" | "RAC" | "WAITLIST" | "NOT_AVAILABLE";
  available: number;
  fare: number;
}

export interface PNRActionInfo {
  pnr: string;
  trainName: string;
  trainNumber: string;
  date: string;
  fromName: string;
  fromCode: string;
  toName: string;
  toCode: string;
  className: string;
  quota: string;
  chartPrepared: boolean;
  fare: number;
  passengers: Array<{
    number: number;
    bookingStatus: string;
    currentStatus: string;
    coach: string;
    berth: string;
  }>;
}

export interface JourneyInfo {
  trainNo: string;
  trainName: string;
  date: string;
  currentStationName: string;
  delay: number;
  timeline: LiveStation[];
}

export interface CoachComposition {
  coachName: string;
  classType: string;
  totalBerths: number;
  availableBerths: number;
}

/* ─── Train Type Mapping ───────────────────────────────────── */

const TRAIN_TYPE_MAP: Record<string, string> = {
  RAJDHANI: "RAJDHANI",
  SHATABDI: "SHATABDI",
  DURONTO: "DURONTO",
  GARIB_RATH: "GARIB_RATH",
  SUPERFAST: "SUPERFAST",
  EXPRESS: "EXPRESS",
  PASSENGER: "PASSENGER",
};

export function inferTrainType(name: string, trainType?: string): string {
  if (trainType && TRAIN_TYPE_MAP[trainType]) return trainType;
  const upper = name.toUpperCase();
  if (upper.includes("RAJDHANI")) return "RAJDHANI";
  if (upper.includes("SHATABDI")) return "SHATABDI";
  if (upper.includes("DURONTO")) return "DURONTO";
  if (upper.includes("GARIB RATH") || upper.includes("GARIB_RATH")) return "GARIB_RATH";
  if (upper.includes("SF") || upper.includes("SUPERFAST") || name.includes("Exp")) return "SUPERFAST";
  return "EXPRESS";
}

/* ─── Running Days Parser ──────────────────────────────────── */

export function parseRunningDays(runningDays: string): string {
  if (!runningDays) return "Daily";
  // erail.in format: 7-digit binary string (1111111 = daily)
  const days = ["S", "M", "T", "W", "T", "F", "S"];
  const chars = runningDays.split("");
  const active = chars.map((c, i) => (c === "1" ? days[i] : "")).filter(Boolean);
  if (active.length === 7) return "Daily";
  if (active.length === 0) return "Not Running";
  return active.join(", ");
}

/* ─── Transformers ─────────────────────────────────────────── */

export function transformTrainEntry(t: RapiTrainEntry): TrainOption {
  return {
    id: `${t.train_no}-${t.from_stn_code}-${t.to_stn_code}`,
    number: t.train_no,
    name: t.train_name,
    type: inferTrainType(t.train_name, t.train_type),
    departure: t.from_time.replace(".", ":"),
    arrival: t.to_time.replace(".", ":"),
    duration: t.travel_time.replace(".", "h ") + "m",
    fromCode: t.from_stn_code,
    fromName: t.from_stn_name,
    toCode: t.to_stn_code,
    toName: t.to_stn_name,
    distance: 0,
    runningDays: parseRunningDays(t.running_days),
  };
}

export function transformTrainInfo(info: TrainInfoData): {
  train: TrainOption;
  route: RouteStation[];
} {
  return {
    train: {
      id: `${info.train_no}-route`,
      number: info.train_no,
      name: info.train_name,
      type: info.type,
      departure: info.from_time.replace(".", ":"),
      arrival: info.to_time.replace(".", ":"),
      duration: info.travel_time,
      fromCode: info.from_stn_code,
      fromName: info.from_stn_name,
      toCode: info.to_stn_code,
      toName: info.to_stn_name,
      distance: info.distance,
      runningDays: parseRunningDays(info.running_days),
    },
    route: (info.route || []).map((s: RapiRouteStation) => ({
      code: s.stnCode,
      name: s.stnName,
      arrival: s.arrival || "--",
      departure: s.departure || "--",
      distance: s.distance,
      day: s.day,
      platform: s.platform || "",
    })),
  };
}

export function transformLiveStatus(live: LiveStatusData): JourneyInfo {
  return {
    trainNo: live.trainNo,
    trainName: live.trainName,
    date: live.date,
    currentStationName: live.currentStationName,
    delay: live.delay,
    timeline: (live.timeline || []).map((s: RapiLiveStation) => ({
      code: s.stationCode,
      name: s.stationName,
      scheduledArrival: s.scheduledArrival,
      scheduledDeparture: s.scheduledDeparture,
      distance: s.distance,
      day: s.day,
      platform: s.platform || "",
      delay: s.delay,
      status: s.status,
    })),
  };
}

export function transformAvailability(avail: AvailabilityData): ClassAvailability[] {
  return (avail.classes || []).map((c: RapiClassAvailability) => ({
    code: c.classCode,
    name: c.className,
    status: (c.available > 0 ? "AVAILABLE" : "NOT_AVAILABLE") as ClassAvailability["status"],
    available: c.available,
    fare: c.fare,
  }));
}

export function transformPNR(pnrData: PNRStatusData): PNRActionInfo {
  return {
    pnr: pnrData.pnr,
    trainName: pnrData.train.name,
    trainNumber: pnrData.train.number,
    date: pnrData.journey.date,
    fromName: pnrData.journey.source.name,
    fromCode: pnrData.journey.source.code,
    toName: pnrData.journey.destination.name,
    toCode: pnrData.journey.destination.code,
    className: pnrData.journey.class,
    quota: pnrData.journey.quota,
    chartPrepared: pnrData.chart.prepared,
    fare: pnrData.booking.fare,
    passengers: (pnrData.passengers || []).map((p: RapiPassenger) => ({
      number: parseInt(p.serialNumber),
      bookingStatus: p.booking.status,
      currentStatus: p.current.status,
      coach: p.current.coach || "",
      berth: p.current.details,
    })),
  };
}