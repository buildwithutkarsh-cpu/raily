/* ══════════════════════════════════════════════════════════════
   RAPI — Seat Availability Scraper
   
   Sources: erail.in, indianrail.gov.in (public availability tables)
   
   Extracts class-wise seat status:
     - AVL 42  → 42 seats available
     - RAC 5   → 5 RAC (Reservation Against Cancellation)
     - WL 10   → Waitlist number 10
     - GNWL 15 → General Waitlist number 15
     - PQWL    → Pooled Quota Waitlist
     - RLWL    → Remote Location Waitlist
     - RELEASE → Cancelled/Released quota
   
   DOM Resiliency:
     - Multiple selector fallbacks for class/status/fare cells
     - Handles various table layouts from different portals
     - Flexible date parsing (DD-MM-YYYY, YYYY-MM-DD)
   ══════════════════════════════════════════════════════════════ */

import * as cheerio from "cheerio";
import { scraperClient, ScrapeResult, ok, cachedRes, fail } from "./client";
import { ERROR_CODES } from "../utils/errors";
import { cache } from "../cache";
import { SOURCES, CONFIG } from "../config";
import { clean } from "../utils/parser";

/* ─── Types ────────────────────────────────────────────────── */

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
  available: number;       // Number of seats available (0 for WL/RAC)
  waitlistNumber?: number;  // Waitlist position (for WL/RAC/GNWL/etc)
  fare: number;
  isTatkal: boolean;
  quota?: string;
}

export interface AvailabilityResponse {
  trainNo: string;
  trainName: string;
  from: { code: string; name: string };
  to: { code: string; name: string };
  date: string;
  quota: string;
  classes: ClassAvailability[];
  totalClasses: number;
}

/* ─── Helpers ──────────────────────────────────────────────── */

function parseSeatStatus(statusText: string): {
  status: SeatStatus;
  available: number;
  waitlistNumber?: number;
} {
  const text = clean(statusText).toUpperCase();

  const avlMatch = text.match(/^(AVL|AVAILABLE|AVAIL)\s*(\d+)/i);
  if (avlMatch) {
    return { status: "AVAILABLE", available: parseInt(avlMatch[2]) };
  }

  const racMatch = text.match(/^(RAC)\s*(\d+)/i);
  if (racMatch) {
    return { status: "RAC", available: 0, waitlistNumber: parseInt(racMatch[2]) };
  }

  const gnwlMatch = text.match(/^(GNWL)\s*(\d+)/i);
  if (gnwlMatch) {
    return { status: "GNWL", available: 0, waitlistNumber: parseInt(gnwlMatch[2]) };
  }

  const pqwlMatch = text.match(/^(PQWL)\s*(\d+)/i);
  if (pqwlMatch) {
    return { status: "PQWL", available: 0, waitlistNumber: parseInt(pqwlMatch[2]) };
  }

  const rlwlMatch = text.match(/^(RLWL)\s*(\d+)/i);
  if (rlwlMatch) {
    return { status: "RLWL", available: 0, waitlistNumber: parseInt(rlwlMatch[2]) };
  }

  const wlMatch = text.match(/^(WL)\s*(\d+)/i);
  if (wlMatch) {
    return { status: "WAITLIST", available: 0, waitlistNumber: parseInt(wlMatch[2]) };
  }

  if (text.includes("RELEASE") || text.includes("CANCEL")) {
    return { status: "RELEASE", available: 0 };
  }

  if (text.includes("CHART") || text.includes("CNF")) {
    return { status: "CHART_PREPARED", available: 1 };
  }

  if (text.includes("N/A") || text.includes("NA") || text === "--" || text === "") {
    return { status: "NOT_APPLICABLE", available: 0 };
  }

  return { status: "NOT_AVAILABLE", available: 0 };
}

const CLASS_NAMES: Record<string, string> = {
  "1A": "First AC",
  "2A": "Second AC",
  "3A": "Third AC",
  "3E": "Third AC Economy",
  "SL": "Sleeper",
  "CC": "Chair Car",
  "EC": "Executive Chair Car",
  "2S": "Second Sitting",
  "FC": "First Class",
  "1A/2A": "First/Second AC Combined",
  "2A/3A": "Second/Third AC Combined",
  "3A/SL": "Third AC/Sleeper Combined",
};

/* ─── DOM Parsing ──────────────────────────────────────────── */

function parseAvailabilityTable($: cheerio.CheerioAPI): ClassAvailability[] {
  const classes: ClassAvailability[] = [];

  // Pattern 1: Standard availability table
  $(
    "table.availability-table tbody tr, " +
    ".availability-results tbody tr, " +
    ".seat-availability tbody tr, " +
    "[data-testid='availability-table'] tbody tr, " +
    ".avail-table tbody tr, " +
    "table.train-availability tbody tr, " +
    ".class-wise-availability tr"
  ).each((_i: number, row: any) => {
    const cells = $(row).find("td, .avail-cell");
    if (cells.length < 3) return;

    const classCode = clean($(cells[0]).text()).toUpperCase();
    const statusText = clean($(cells[1]).text());
    const fareText = clean($(cells[2]).text());

    if (
      classCode.toLowerCase().includes("class") ||
      classCode.toLowerCase().includes("avail") ||
      classCode.match(/^\d+$/)
    ) {
      return;
    }

    const parsed = parseSeatStatus(statusText);
    const fareMatch = fareText.match(/[\d,]+/);
    const fare = fareMatch ? parseInt(fareMatch[0].replace(/,/g, "")) : 0;

    const isTatkal =
      classCode.includes("TATKAL") ||
      clean($(cells[3])?.text() || "").toLowerCase().includes("tatkal") ||
      $(row).hasClass("tatkal");

    const baseCode = classCode.replace(/\s*TATKAL\s*/i, "").trim();

    classes.push({
      classCode: baseCode || classCode,
      className: CLASS_NAMES[baseCode] || baseCode,
      status: parsed.status,
      available: parsed.available,
      waitlistNumber: parsed.waitlistNumber,
      fare,
      isTatkal,
    });
  });

  // Pattern 2: Grid/card-based layout (mobile view)
  if (classes.length === 0) {
    $(
      ".class-card, .availability-card, .seat-card, " +
      "[data-testid='class-card'], .avail-card"
    ).each((_i: number, card: any) => {
      const classCode = clean(
        $(card).find(".class-code, .class-name, .travel-class").text()
      ).toUpperCase();

      const statusText = clean(
        $(card).find(".status, .seat-status, .avail-status").text()
      );

      const fareText = clean(
        $(card).find(".fare, .price, .amount").text()
      );

      if (!classCode) return;

      const parsed = parseSeatStatus(statusText);
      const fareMatch = fareText.match(/[\d,]+/);
      const fare = fareMatch ? parseInt(fareMatch[0].replace(/,/g, "")) : 0;

      const baseCode = classCode.replace(/\s*TATKAL\s*/i, "").trim();

      classes.push({
        classCode: baseCode || classCode,
        className: CLASS_NAMES[baseCode] || baseCode,
        status: parsed.status,
        available: parsed.available,
        waitlistNumber: parsed.waitlistNumber,
        fare,
        isTatkal: classCode.includes("TATKAL") || $(card).hasClass("tatkal"),
      });
    });
  }

  // Pattern 3: JSON-LD or embedded data in script tags
  if (classes.length === 0) {
    const scriptData = $("script#availability-data, script[data-availability]").text();
    if (scriptData) {
      try {
        const jsonData = JSON.parse(scriptData);
        if (Array.isArray(jsonData)) {
          jsonData.forEach((item: any) => {
            const code = item.classCode || item.code || item.class;
            if (!code) return;

            const statusText = item.status || item.availability || item.seatStatus || "";
            const parsed = parseSeatStatus(statusText);

            classes.push({
              classCode: String(code),
              className: item.className || item.name || CLASS_NAMES[String(code)] || String(code),
              status: parsed.status,
              available: parsed.available || parseInt(item.available || item.avl || "0"),
              waitlistNumber: parsed.waitlistNumber || item.waitlistNumber,
              fare: parseInt(item.fare || item.price || item.ticketFare || "0"),
              isTatkal: !!item.isTatkal,
            });
          });
        }
      } catch { /* Invalid JSON */ }
    }
  }

  return classes;
}

/* ─── Main Scraper Functions ──────────────────────────────── */

function getAvailabilityURL(
  trainNo: string,
  from: string,
  to: string,
  date: string,
  quota: string
): string {
  const dateParts = date.split("-");
  const erailDate = `${dateParts[2]}${dateParts[1]}${dateParts[0]}`;
  return SOURCES.AVAILABILITY(trainNo, from.toUpperCase(), to.toUpperCase(), erailDate, quota);
}

export async function getAvailability(
  trainNo: string,
  from: string,
  to: string,
  date: string,
  quota = "GN"
): Promise<ScrapeResult<AvailabilityResponse>> {  const cacheKey = `avail:${trainNo}:${from}:${to}:${date}:${quota}`;

  return cache.getOrRefresh<AvailabilityResponse>(
    cacheKey,
    CONFIG.CACHE.AVAIL_TTL,
    async () => {
      const url = getAvailabilityURL(trainNo, from, to, date, quota);
      const raw = await scraperClient.get(url, "https://erail.in/");

      const $ = cheerio.load(raw);
      let classes = parseAvailabilityTable($);

      // Fallback: pipe-delimited format
      if (classes.length === 0) {
        const blocks = raw.split("~~~~~~~~").filter(Boolean);
        for (const block of blocks) {
          const lines = block.split("~^");
          if (lines.length < 2) continue;
          const fields = lines[1].split("~").filter(Boolean);
          if (fields.length >= 3) {
            const classCode = clean(fields[0]).toUpperCase();
            const statusText = clean(fields[1]);
            const fareText = clean(fields[2]);
            if (!classCode || classCode.includes("CLASS")) continue;

            const parsed = parseSeatStatus(statusText);
            const fareMatch = fareText.match(/[\d,]+/);
            const fare = fareMatch ? parseInt(fareMatch[0].replace(/,/g, "")) : 0;
            classes.push({
              classCode,
              className: CLASS_NAMES[classCode] || classCode,
              status: parsed.status,
              available: parsed.available,
              waitlistNumber: parsed.waitlistNumber,
              fare,
              isTatkal: false,
            });
          }
        }
      }

      if (classes.length === 0) {
        throw new Error("PARSE_FAILURE");
      }

      return {
        trainNo,
        trainName: "",
        from: { code: from.toUpperCase(), name: "" },
        to: { code: to.toUpperCase(), name: "" },
        date,
        quota: quota.toUpperCase(),
        classes,
        totalClasses: classes.length,
      };
    }
  )
  .then(
    ({ data, cached: isCached }) =>
      isCached ? cachedRes(data) : ok(data)
  )
  .catch((err: any) => {
    const msg = err.message || "Unknown error";
    if (msg === "PARSE_FAILURE") {
      return fail(ERROR_CODES.PARSE_FAILURE, "Could not parse availability data — the page structure may have changed", true);
    }
    if (msg.includes("timeout") || msg.includes("TIMEOUT"))
      return fail(ERROR_CODES.TIMEOUT, msg, true);
    if (msg.includes("ECONNREFUSED") || msg.includes("ENOTFOUND"))
      return fail(ERROR_CODES.UPSTREAM_UNREACHABLE, msg, true);
    if (msg.includes("429") || msg.includes("Too Many Requests"))
      return fail(ERROR_CODES.UPSTREAM_RATE_LIMIT, msg, true);
    return fail(ERROR_CODES.UPSTREAM_ERROR, msg, true);
  });
}

export async function getFare(
  trainNo: string,
  from: string,
  to: string,
  date: string,
  quota = "GN"
): Promise<ScrapeResult<AvailabilityResponse>> {
  return getAvailability(trainNo, from, to, date, quota);
}
