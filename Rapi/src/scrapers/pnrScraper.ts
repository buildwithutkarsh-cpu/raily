/* ══════════════════════════════════════════════════════════════
   RAPI — PNR Status Scraper
   
   Source: confirmtkt.com (HTML → cheerio DOM parsing + embedded JSON)
   
   Strategy:
     1. Try cheerio DOM parsing with flexible CSS selector fallbacks
     2. Fall back to embedded JSON extraction (`var data = {...}`)
     3. If both fail, return structured error with retryable=true
   
   DOM Resiliency:
     - Multiple selector paths for each field
     - Sanitizes whitespace, \\n, \\t, &nbsp; via `clean()` utility
     - Returns null instead of throwing on parse failures
   ══════════════════════════════════════════════════════════════ */

import * as cheerio from "cheerio";
import { scraperClient, ScrapeResult, ok, cachedRes, fail } from "./client";
import { ERROR_CODES } from "../utils/errors";
import { cache } from "../cache";
import { SOURCES, CONFIG } from "../config";
import { clean } from "../utils/parser";

/* ─── Types ────────────────────────────────────────────────── */

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

/* ─── DOM Parsing: Fallback Selectors ──────────────────────── */

interface DOMExtract {
  pnr?: string;
  trainNo?: string;
  trainName?: string;
  journeyDate?: string;
  class?: string;
  quota?: string;
  from?: { code?: string; name?: string };
  to?: { code?: string; name?: string };
  boardingPoint?: { code?: string; name?: string };
  distance?: number;
  chartStatus?: string;
  fare?: number;
  passengers?: Array<{
    serialNumber?: string;
    bookingStatus?: string;
    bookingCoach?: string;
    bookingBerth?: string;
    bookingDetails?: string;
    currentStatus?: string;
    currentCoach?: string;
    currentBerth?: string;
    currentDetails?: string;
  }>;
}

/**
 * Parse PNR status from confirmtkt HTML DOM.
 * Uses multiple CSS selector fallbacks for DOM resiliency.
 */
function parsePNRDOM(html: string): DOMExtract | null {
  try {
    const $ = cheerio.load(html);
    const result: DOMExtract = {};

    // ── Train Info ──────────────────────────────────────────
    // Try multiple selector patterns for train number and name
    result.trainNo =
      clean($(".train-number").text()) ||
      clean($("[data-testid='train-number']").text()) ||
      clean($(".pnr-train-info .train-no").text()) ||
      clean($(".train-info .train-no").text()) ||
      "";

    result.trainName =
      clean($(".train-name").text()) ||
      clean($("[data-testid='train-name']").text()) ||
      clean($(".pnr-train-info .train-name").text()) ||
      clean($(".train-info .train-name").text()) ||
      "";

    // ── Journey Details ────────────────────────────────────
    result.journeyDate =
      clean($(".journey-date").text()) ||
      clean($("[data-testid='journey-date']").text()) ||
      clean($(".pnr-detail .date").text()) ||
      clean($(".detail-row .date-value").text()) ||
      "";

    result.class =
      clean($(".travel-class").text()) ||
      clean($("[data-testid='class']").text()) ||
      clean($(".pnr-detail .class").text()) ||
      clean($(".detail-row .class-value").text()) ||
      "";

    result.quota =
      clean($(".quota").text()) ||
      clean($("[data-testid='quota']").text()) ||
      clean($(".pnr-detail .quota").text()) ||
      "GN";

    // ── Station Info ───────────────────────────────────────
    result.from = {
      name:
        clean($(".from-station .station-name").text()) ||
        clean($("[data-testid='from-station']").text()) ||
        clean($(".source-station").text()) ||
        "",
    };

    result.to = {
      name:
        clean($(".to-station .station-name").text()) ||
        clean($("[data-testid='to-station']").text()) ||
        clean($(".destination-station").text()) ||
        "",
    };

    // Try to extract station codes from text like "NDLS - New Delhi"
    const fromText = result.from?.name || "";
    const toText = result.to?.name || "";
    const fromCodeMatch = fromText.match(/^([A-Z]{2,5})\s/);
    const toCodeMatch = toText.match(/^([A-Z]{2,5})\s/);
    if (fromCodeMatch) result.from!.code = fromCodeMatch[1];
    if (toCodeMatch) result.to!.code = toCodeMatch[1];

    // ── Chart Status ───────────────────────────────────────
    const chartText = clean($(".chart-status").text()) ||
      clean($("[data-testid='chart-status']").text()) ||
      clean($(".pnr-status .chart-prepare-status").text()) ||
      "";

    result.chartStatus = chartText || "Chart Not Prepared";

    // ── Fare ───────────────────────────────────────────────
    const fareText = clean($(".total-fare").text()) ||
      clean($("[data-testid='fare']").text()) ||
      clean($(".pnr-detail .fare-amount").text()) ||
      "";
    const fareMatch = fareText.match(/[\d,]+/);
    result.fare = fareMatch ? parseInt(fareMatch[0].replace(/,/g, "")) : 0;

    // ── Passenger Table ────────────────────────────────────
    // Try multiple selector patterns for the passenger table
    const passengers: DOMExtract["passengers"] = [];

    // Pattern 1: Table with passenger rows
    $(
      "table.passenger-table tbody tr, " +
      ".passenger-details tbody tr, " +
      ".pnr-passengers tbody tr, " +
      "[data-testid='passenger-table'] tbody tr, " +
      ".passenger-list .passenger-item, " +
      ".passenger-row"
    ).each((_i: number, row: any) => {
      const cells = $(row).find("td, .passenger-col, .col");
      const passenger: NonNullable<typeof passengers>[0] = {};

      // Serial number / name
      passenger.serialNumber =
        clean($(cells[0] || row).text()) ||
        `Passenger ${_i + 1}`;

      // Booking status (usually in cells[1] or cell with class .booking-status)
      const bookingEl = $(row).find(
        ".booking-status, .booked-status, [data-label='Booking']"
      );
      passenger.bookingStatus = clean(bookingEl.text()) ||
        clean($(cells[1]).text()) || "";

      // Current status (usually in cells[2] or cell with class .current-status)
      const currentEl = $(row).find(
        ".current-status, .live-status, [data-label='Current']"
      );
      passenger.currentStatus = clean(currentEl.text()) ||
        clean($(cells[2]).text()) || "";

      // Booking details (coach/berth info)
      passenger.bookingDetails = clean(
        $(row).find(".booking-details, .booked-details").text()
      ) || passenger.bookingStatus;

      // Current details
      passenger.currentDetails = clean(
        $(row).find(".current-details, .live-details").text()
      ) || passenger.currentStatus;

      passengers.push(passenger);
    });

    // Pattern 2: Div-based layout with passenger cards
    if (passengers.length === 0) {
      $(
        ".passenger-card, .passenger-info, .berth-info, " +
        "[data-testid='passenger']"
      ).each((_i: number, card: any) => {
        const passenger: NonNullable<typeof passengers>[0] = {};

        passenger.serialNumber =
          clean($(card).find(".passenger-sr, .sr-no, .passenger-name").text()) ||
          `Passenger ${_i + 1}`;

        passenger.bookingStatus =
          clean($(card).find(".booking-status, .book-status").text()) || "";

        passenger.bookingDetails =
          clean($(card).find(".booking-coach, .coach-info").text()) || "";

        passenger.currentStatus =
          clean($(card).find(".current-status, .live-status").text()) || "";

        passenger.currentDetails =
          clean($(card).find(".current-coach, .live-detail").text()) || "";

        // Extract coach and berth from text like "B1 45, Coach B1, Berth 45"
        const bookingCoachMatch = passenger.bookingDetails?.match(/([A-Z]\d+)\s*(\d+)/);
        if (bookingCoachMatch) {
          passenger.bookingCoach = bookingCoachMatch[1];
          passenger.bookingBerth = bookingCoachMatch[2];
        }

        const currentCoachMatch = passenger.currentDetails?.match(/([A-Z]\d+)\s*(\d+)/);
        if (currentCoachMatch) {
          passenger.currentCoach = currentCoachMatch[1];
          passenger.currentBerth = currentCoachMatch[2];
        }

        passengers.push(passenger);
      });
    }

    result.passengers = passengers;
    return result;
  } catch (err: any) {
    console.warn("[PNR] DOM parsing failed, falling back to JSON extraction:", err.message);
    return null;
  }
}

/**
 * Extract embedded JSON from confirmtkt PNR page.
 * The page has: var data = {...}; or window.__INITIAL_STATE__ = {...};
 */
function parseEmbeddedJSON(html: string): any {
  // Pattern 1: var data = {...};
  const dataMatch = html.match(/var\s+data\s*=\s*({.*?});/s);
  if (dataMatch) {
    try {
      return JSON.parse(dataMatch[1]);
    } catch {
      // Continue to next pattern
    }
  }

  // Pattern 2: window.__INITIAL_STATE__ = {...};
  const stateMatch = html.match(/window\.__INITIAL_STATE__\s*=\s*({.*?});/s);
  if (stateMatch) {
    try {
      return JSON.parse(stateMatch[1]);
    } catch {
      // Continue to next pattern
    }
  }

  // Pattern 3: JSON-LD script tag
  const jsonLdMatch = html.match(
    /<script[^>]*type="application\/ld\+json"[^>]*>(.*?)<\/script>/s
  );
  if (jsonLdMatch) {
    try {
      return JSON.parse(jsonLdMatch[1]);
    } catch {
      // Continue to next pattern
    }
  }

  // Pattern 4: Any JSON object in a script tag with __NEXT_DATA__
  const nextMatch = html.match(/<script[^>]*id="__NEXT_DATA__"[^>]*>(.*?)<\/script>/s);
  if (nextMatch) {
    try {
      return JSON.parse(nextMatch[1]);
    } catch {
      return null;
    }
  }

  return null;
}

/**
 * Normalize JSON data into our PNRResponse schema with fallback
 * field name mapping for multiple upstream source formats.
 */
function normalizeFromJSON(raw: any, pnr: string): PNRResponse | null {
  if (!raw) return null;

  // Flexible field name mapping — handles different API response shapes
  const getField = (obj: any, ...keys: string[]) => {
    for (const key of keys) {
      const val = obj?.[key];
      if (val !== undefined && val !== null) return val;
    }
    return undefined;
  };

  const passengers: PassengerInfo[] = [];

  // Extract passenger list from various possible locations
  const rawPassengers =
    raw.passengers ||
    raw.passenger ||
    raw.passenger_details ||
    raw.pnr_data?.passengers ||
    raw.data?.passengers ||
    [];

  (rawPassengers || []).forEach((p: any) => {
    passengers.push({
      serialNumber: getField(p, "serial_number", "serialNumber", "passenger_serial_number") || `Passenger ${passengers.length + 1}`,
      coachPosition: getField(p, "coach_position", "coachPosition") || 0,
      booking: {
        status: getField(p, "booking_status", "bookingStatus", "booking.status") || "",
        coach: getField(p, "booking_coach", "bookingCoach", "booking.coach") || null,
        berthNo: getField(p, "booking_berth_no", "bookingBerthNo", "booking.berthNo") ?? null,
        berthCode: getField(p, "booking_berth_code", "bookingBerthCode", "booking.berthCode") || null,
        details: getField(p, "booking_status_details", "bookingStatusDetails", "booking.details") || "",
      },
      current: {
        status: getField(p, "current_status", "currentStatus", "current.status") || "",
        coach: getField(p, "current_coach", "currentCoach", "current.coach") || null,
        berthNo: getField(p, "current_berth_no", "currentBerthNo", "current.berthNo") ?? null,
        berthCode: getField(p, "current_berth_code", "currentBerthCode", "current.berthCode") || null,
        details: getField(p, "current_status_details", "currentStatusDetails", "current.details") || "",
      },
    });
  });

  // Extract journey details with fallback field names
  const journey = raw.journey || raw.journey_details || raw.trip || {};

  const getStation = (station: any) => {
    if (!station) return { code: "", name: "" };
    if (typeof station === "string") return { code: station, name: station };
    return {
      code: getField(station, "code", "station_code", "stationCode", "stn_code") || "",
      name: getField(station, "name", "station_name", "stationName", "stn_name") || "",
    };
  };

  return {
    pnr: getField(raw, "pnr", "pnr_number", "pnrNumber") || pnr,
    train: {
      number: getField(raw, "train_number", "trainNumber", "train.number", "train_no")?.toString() || "",
      name: getField(raw, "train_name", "trainName", "train.name") || "",
    },
    journey: {
      date: getField(journey, "date_of_journey", "dateOfJourney", "date", "journey_date") || "",
      class: getField(journey, "class", "class_name", "travel_class") || "",
      quota: getField(journey, "quota") || "GN",
      source: getStation(getField(raw, "source_station", "sourceStation", "from", "source") || journey.source),
      destination: getStation(getField(raw, "dest_station", "destStation", "destination", "to", "dest") || journey.destination),
      boardingPoint: getStation(
        getField(raw, "boarding_point", "boardingPoint") ||
        getField(raw, "boarding_station", "boardingStation") ||
        journey.boardingPoint ||
        journey.source
      ),
      distance: getField(raw, "distance", "total_distance") || getField(journey, "distance") || 0,
    },
    chart: {
      status: getField(raw, "chart_status", "chartStatus", "chart.status", "chart_prepared") || "Chart Not Prepared",
      prepared: !!(
        getField(raw, "chart_status", "chartStatus", "chart.status", "chart_prepared") &&
        String(getField(raw, "chart_status", "chartStatus", "chart.status", "chart_prepared"))
          .toLowerCase().includes("prepared")
      ),
    },
    booking: {
      fare: getField(raw, "total_fare", "totalFare", "fare", "booking.fare") || 0,
      ticketFare: getField(raw, "ticket_fare", "ticketFare") || 0,
      bookingDate: getField(raw, "booking_date", "bookingDate", "date_of_booking") || "",
    },
    passengers,
  };
}

/* ─── Main Scraper Function ───────────────────────────────── */

export async function getPNRStatus(pnr: string): Promise<ScrapeResult<PNRResponse>> {
  // Validate
  if (!/^\d{10}$/.test(pnr)) {
    return fail(ERROR_CODES.INVALID_INPUT, "PNR must be exactly 10 digits");
  }

  const cacheKey = `pnr:${pnr}`;

  return cache.getOrRefresh<PNRResponse>(
    cacheKey,
    CONFIG.CACHE.PNR_TTL,
    async () => {
      const html = await scraperClient.get(
        SOURCES.PNR_STATUS(pnr),
        "https://www.confirmtkt.com/"
      );

      const domParsed = parsePNRDOM(html);
      const jsonParsed = parseEmbeddedJSON(html);

      let result: PNRResponse | null = null;

      if (jsonParsed) {
        result = normalizeFromJSON(jsonParsed, pnr);
      } else if (domParsed && domParsed.passengers && domParsed.passengers.length > 0) {
        result = {
          pnr,
          train: {
            number: domParsed.trainNo || "",
            name: domParsed.trainName || "",
          },
          journey: {
            date: domParsed.journeyDate || "",
            class: domParsed.class || "",
            quota: domParsed.quota || "GN",
            source: { code: domParsed.from?.code || "", name: domParsed.from?.name || "" },
            destination: { code: domParsed.to?.code || "", name: domParsed.to?.name || "" },
            boardingPoint: {
              code: domParsed.boardingPoint?.code || domParsed.from?.code || "",
              name: domParsed.boardingPoint?.name || domParsed.from?.name || "",
            },
            distance: domParsed.distance || 0,
          },
          chart: {
            status: domParsed.chartStatus || "Chart Not Prepared",
            prepared: (domParsed.chartStatus || "").toLowerCase().includes("prepared"),
          },
          booking: {
            fare: domParsed.fare || 0,
            ticketFare: 0,
            bookingDate: "",
          },
          passengers: (domParsed.passengers || []).map((p, i) => ({
            serialNumber: p.serialNumber || `Passenger ${i + 1}`,
            coachPosition: 0,
            booking: {
              status: p.bookingStatus || "",
              coach: p.bookingCoach || null,
              berthNo: p.bookingBerth ? parseInt(p.bookingBerth) : null,
              berthCode: null,
              details: p.bookingDetails || "",
            },
            current: {
              status: p.currentStatus || "",
              coach: p.currentCoach || null,
              berthNo: p.currentBerth ? parseInt(p.currentBerth) : null,
              berthCode: null,
              details: p.currentDetails || "",
            },
          })),
        };
      }

      if (!result || (!result.train.number && result.passengers.length === 0)) {
        throw new Error("PARSE_FAILURE");
      }

      return result;
    }
  )
  .then(
    ({ data, cached: isCached }) =>
      isCached ? cachedRes(data) : ok(data)
  )
  .catch((err: any) => {
    const msg = err.message || "Unknown error";
    if (msg.includes("timeout") || msg.includes("TIMEOUT")) {
      return fail(ERROR_CODES.TIMEOUT, msg, true);
    }
    if (msg.includes("ECONNREFUSED") || msg.includes("ENOTFOUND")) {
      return fail(ERROR_CODES.UPSTREAM_UNREACHABLE, msg, true);
    }
    if (msg.includes("429") || msg.includes("Too Many Requests")) {
      return fail(ERROR_CODES.UPSTREAM_RATE_LIMIT, msg, true);
    }
    if (msg.includes("5") && msg.includes("HTTP")) {
      return fail(ERROR_CODES.UPSTREAM_ERROR, msg, true);
    }
    if (msg === "PARSE_FAILURE") {
      return fail(ERROR_CODES.PARSE_FAILURE, "Failed to parse PNR data from confirmtkt — page structure may have changed", true);
    }
    return fail(ERROR_CODES.UPSTREAM_ERROR, msg, true);
  });
}
