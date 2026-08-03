/* ══════════════════════════════════════════════════════════════
   RAILY — Booking Store Pure Utilities
   
   Pure data-construction functions extracted from the booking
   store so they can be unit-tested in isolation.
   
   These helpers construct Train, ExtractedQuery, and seat-ID
   values from raw booking data (typically tool results or args).
   ══════════════════════════════════════════════════════════════ */

import type { TrainOption } from "./rapi/transform";

/* ─── Types (mirrored from booking-store.tsx) ─────────────── */

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

/* ─── Booking Data Fields ─────────────────────────────────── */

export interface BookingDataFields {
  pnr?: string;
  trainName?: string;
  trainNumber?: string;
  departure?: string;
  arrival?: string;
  duration?: string;
  fare?: string | number;
  class?: string;
  coach?: string;
  seat?: string;
  tier?: string;
  from?: string;
  fromCode?: string;
  to?: string;
  toCode?: string;
  date?: string;
}

/* ─── Seat ID Formatting ──────────────────────────────────── */

/**
 * Build a compound seat ID matching the CoachVisualizer format:
 *   {coach}-{seatNumber}{tierInitial}
 *
 * Examples:
 *   ("B1", "7", "Lower")    → "B1-7L"
 *   ("A1", "12", "Middle")  → "A1-12M"
 *   ("B1", "7", "")         → "B1-7"
 *   ("B1", "7", undefined)  → "B1-7"
 */
export function buildSeatId(coach: string, seat: string, tier?: string): string {
  const tierInitial = tier ? tier.charAt(0).toUpperCase() : "";
  return `${coach}-${seat}${tierInitial}`;
}

/* ─── Seat ID Parsing ─────────────────────────────────────── */

export interface ParsedSeatId {
  coach: string;
  seat: string;
  tier?: string;
}

const TIER_NAMES: Record<string, string> = {
  L: "Lower",
  M: "Middle",
  U: "Upper",
};

/**
 * Parse a compound seat ID back into its parts.
 * Format: {coach}-{seatNumber}{tierInitial}
 *
 * Examples:
 *   ("B1-7L") → { coach: "B1", seat: "7", tier: "Lower" }
 *   ("A1-12M") → { coach: "A1", seat: "12", tier: "Middle" }
 *   ("B1-7")  → { coach: "B1", seat: "7", tier: undefined }
 *   ("garbage") → null
 */
export function parseSeatId(seatId: string | null | undefined): ParsedSeatId | null {
  if (!seatId) return null;
  const match = seatId.match(/^([A-Z][A-Z0-9]*)-(\d+)([LMU])?$/i);
  if (!match) return null;
  const [, coach, seat, tierInitial] = match;
  return {
    coach,
    seat,
    tier: tierInitial ? TIER_NAMES[tierInitial.toUpperCase()] : undefined,
  };
}

/* ─── Train Construction ──────────────────────────────────── */

/**
 * Build a Train object from booking data fields.
 * Returns null if essential fields (trainName, trainNumber) are missing.
 */
export function buildTrainFromBookingData(data: BookingDataFields): Train | null {
  const { trainName, trainNumber, fromCode, toCode } = data;

  if (!trainName || !trainNumber) return null;

  const departure = data.departure || "--";
  const arrival = data.arrival || "--";
  const duration = data.duration || "--";
  const classType = data.class || "—";

  const rawFare = data.fare;
  const price = typeof rawFare === "number" ? rawFare : Number(rawFare) || 0;

  return {
    id: `${trainNumber}-${fromCode || "?"}-${toCode || "?"}`,
    name: trainName,
    number: trainNumber,
    departure,
    arrival,
    duration,
    price,
    available: 1,
    probability: 100,
    classType,
    isSuperfast: false,
    rating: 4,
  };
}

/* ─── Query Construction ──────────────────────────────────── */

/**
 * Build an ExtractedQuery object from booking data fields.
 */
export function buildQueryFromBookingData(data: BookingDataFields): ExtractedQuery {
  const from = data.from || data.fromCode || "—";
  const to = data.to || data.toCode || "—";
  const date = data.date || "—";
  const fromCode = data.fromCode || data.from || "?";
  const toCode = data.toCode || data.to || "?";

  return {
    origin: from,
    destination: to,
    date,
    raw: `${fromCode} to ${toCode} on ${date}`,
  };
}

/* ─── Search Result → Store State ─────────────────────────── */

/**
 * Build the store's `trains` + `query` state from a `searchTrains` tool
 * result payload (which carries `TrainOption[]` from the Rapi transform
 * layer). Returns null when the payload has no usable `trains` array.
 *
 * The Rapi train search returns schedule data only (times, duration,
 * running days) — it has no live price/availability fields — so the
 * derived store entries use neutral defaults for those, matching the
 * pre-existing fallback behavior of the UI.
 */
export function buildSearchStateFromToolData(
  data: Record<string, unknown>
): { trains: Train[]; query: ExtractedQuery } | null {
  const rawTrains = data.trains;
  if (!Array.isArray(rawTrains) || rawTrains.length === 0) return null;

  const options = rawTrains as TrainOption[];
  const trains: Train[] = options.map((t) => ({
    id: t.id,
    name: t.name,
    number: t.number,
    departure: t.departure,
    arrival: t.arrival,
    duration: t.duration,
    price: 0, // schedule search carries no fare — enriched later by getAvailability
    available: 0,
    probability: 0,
    classType: "", // travel class (e.g. "3A") — not in search data; UI falls back to its default
    isSuperfast: t.type === "SUPERFAST",
    rating: 0,
  }));

  // Station names (not codes) for display; fall back to the codes the LLM passed.
  const origin = options[0].fromName || (data.from as string) || "";
  const destination = options[0].toName || (data.to as string) || "";

  // The tool returns the literal "today" sentinel when no date was given;
  // normalize it to a concrete ISO date so consumers like formatDisplayDate
  // (which parses real dates) never render "Invalid Date".
  const rawDate = (data.date as string) || "";
  const date =
    rawDate === "today" ? toDateString(new Date()) : rawDate;

  const query: ExtractedQuery = {
    origin,
    destination,
    date,
    raw: `${origin} to ${destination}${date ? ` on ${date}` : ""}`,
  };

  return { trains, query };
}

/** Local YYYY-MM-DD formatter (mirrors the store's helper, kept pure). */
function toDateString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
