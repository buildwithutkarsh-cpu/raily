/* ══════════════════════════════════════════════════════════════
   RAILY — Booking Store Pure Utilities
   
   Pure data-construction functions extracted from the booking
   store so they can be unit-tested in isolation.
   
   These helpers construct Train, ExtractedQuery, and seat-ID
   values from raw booking data (typically tool results or args).
   ══════════════════════════════════════════════════════════════ */

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
