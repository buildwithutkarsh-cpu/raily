/* ══════════════════════════════════════════════════════════════
   RAPI — Seat Availability & Fare Scraper
   
   Source: erail.in (pipe-delimited train info from getTrains.aspx)
   
   Strategy:
     The dedicated availability/fare endpoints on erail.in use
     dynamic loading (SignalR/AJAX), making them unsuitable for
     server-side scraping. Instead, we extract class-wise data
     from the proven getTrains.aspx endpoint (same API used by
     infoScraper and searchScraper).
     
   Data extracted:
     - Class codes (1A, 2A, 3A, SL, CC, 2S, etc.)
     - Base class names and fare info
     - Static berth counts (from rake/coach composition)
   
   Note: Live per-date seat counts (AVL 42, RAC 5, WL 10) are
   not available through this method. The response will show
   classes as "AVAILABLE" or "NOT_AVAILABLE" based on whether
   the class exists on the train.
   ══════════════════════════════════════════════════════════════ */

import { scraperClient, ScrapeResult, ok, cachedRes, fail } from "./client";
import { ERROR_CODES } from "../utils/errors";
import { cache } from "../cache";
import { SOURCES, CONFIG } from "../config";
import { parseErailTrainInfo } from "../utils/parser";

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
  available: number;
  waitlistNumber?: number;
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
};

/**
 * Parse class-wise availability data from erail.in's pipe-delimited response.
 * 
 * The class data is embedded in a specific section of the response, bounded by
 * `~0~1~` on the left and `~~~~~~~` on the right.
 * Format within that section: CLASS:total:available:rac:wl::::fare:::|
 * Example: 1A:12::20:::::2:::|2A:105:69:42:24:2:::5::3:|3A:279:212:71:55:6:6::6::13:4|
 */
function parseClassData(raw: string): Array<{ classCode: string; total: number; available: number; rac: number; wl: number; fare: number }> {
  const results: Array<{ classCode: string; total: number; available: number; rac: number; wl: number; fare: number }> = [];
  
  // Isolate the class data section — bounded by ~0~1~ and ~~~~~~~
  const sectionMatch = raw.match(/~0~1~(.+?)~~~~~~~/);
  const classSection = sectionMatch ? sectionMatch[1] : "";
  if (!classSection) return results;
  
  // Split by | to get individual class entries
  const entries = classSection.split("|").filter(Boolean);
  for (const entry of entries) {
    const fields = entry.split(":");
    if (fields.length < 2) continue;
    
    const classCode = fields[0].trim();
    // Validate: must be a short alphanumeric code, not purely numeric
    if (classCode.length > 5 || /^\d+$/.test(classCode)) continue;
    // Must be a known class or look like one
    if (!(classCode in CLASS_NAMES) && !/^[123][AEC]$/.test(classCode) &&
        !["SL", "CC", "EC", "2S", "FC"].includes(classCode)) continue;
    
    results.push({
      classCode,
      total: parseInt(fields[1] || "0"),
      available: parseInt(fields[2] || "0"),
      rac: parseInt(fields[3] || "0"),
      wl: parseInt(fields[4] || "0"),
      fare: parseInt(fields[8] || fields[9] || "0"),
    });
  }
  
  return results;
}

/* ─── Main Scraper Functions ──────────────────────────────── */

export async function getAvailability(
  trainNo: string,
  from: string,
  to: string,
  date: string,
  quota = "GN"
): Promise<ScrapeResult<AvailabilityResponse>> {
  if (!/^\d{4,5}$/.test(trainNo)) {
    return fail(ERROR_CODES.INVALID_INPUT, "Train number must be 4-5 digits");
  }

  const cacheKey = `avail:${trainNo}:${from}:${to}:${date}:${quota}`;

  return cache.getOrRefresh<AvailabilityResponse>(
    cacheKey,
    CONFIG.CACHE.AVAIL_TTL,
    async () => {
      // Fetch train info from proven erail.in data API
      const raw = await scraperClient.get(
        SOURCES.TRAIN_INFO(trainNo),
        "https://erail.in/"
      );

      // Parse train header info (reuses parser from infoScraper)
      const header = parseErailTrainInfo(raw);
      if (!header) {
        throw new Error("NOT_FOUND");
      }

      // Parse class data from the pipe-delimited response
      const classEntries = parseClassData(raw);

      if (classEntries.length === 0) {
        throw new Error("PARSE_FAILURE");
      }

      // Build class availability list
      const classes: ClassAvailability[] = classEntries.map((entry) => ({
        classCode: entry.classCode,
        className: CLASS_NAMES[entry.classCode] || entry.classCode,
        status: entry.available > 0 ? "AVAILABLE" : "NOT_AVAILABLE",
        available: entry.available,
        fare: entry.fare,
        isTatkal: false,
      }));

      // Build response
      return {
        trainNo: header.train_no || trainNo,
        trainName: header.train_name || "",
        from: { code: from.toUpperCase(), name: header.from_stn_name || "" },
        to: { code: to.toUpperCase(), name: header.to_stn_name || "" },
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
    if (msg === "NOT_FOUND") {
      return fail(ERROR_CODES.NOT_FOUND, `Train ${trainNo} not found`, false);
    }
    if (msg === "PARSE_FAILURE") {
      return fail(ERROR_CODES.PARSE_FAILURE, "Could not parse availability data from train info response", true);
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
