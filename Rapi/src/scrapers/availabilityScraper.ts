/* ══════════════════════════════════════════════════════════════
   RAPI — Seat Availability & Fare Scraper
   Source: erail.in (pipe-delimited train info from getTrains.aspx)
   ══════════════════════════════════════════════════════════════ */

import { scraperClient, ScrapeResult, ok, cachedRes, fail } from "./client";
import { ERROR_CODES } from "../utils/errors";
import { cache } from "../cache";
import { SOURCES, CONFIG } from "../config";
import { parseErailTrainInfo } from "../utils/parser";
import type { ClassAvailability, AvailabilityResponse, SeatStatus, FareEntry, FareResponse } from "../types";

/* ─── Constants ────────────────────────────────────────────── */

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
};

const FARE_GROUP_CLASSES = ["1A", "2A", "3A", "SL", "CC", "EC", "2S", "FC", "3E", "EV", "VC", "VS", "GN"];

/* ─── Helpers ──────────────────────────────────────────────── */

function parseFareData(raw: string): Record<string, number> {
  const fares: Record<string, number> = {};
  const blocks = raw.split("~~~~~~~~").filter(Boolean);
  if (blocks.length < 2) return fares;

  const detailFields = blocks[1].split("~");
  if (detailFields.length <= 20) return fares;

  const fareField = detailFields[20];
  if (!fareField) return fares;

  const groups = fareField.split(":");
  for (let i = 2; i < groups.length; i++) {
    const classCode = FARE_GROUP_CLASSES[i - 2];
    if (!classCode) break;

    const values = groups[i].split(",").filter(Boolean);
    if (values.length >= 6) {
      const fare = parseInt(values[5].trim());
      if (!isNaN(fare) && fare > 0) {
        fares[classCode] = fare;
      }
    }
  }

  return fares;
}

function parseClassData(raw: string): Array<{ classCode: string; total: number; available: number; rac: number; wl: number }> {
  const results: Array<{ classCode: string; total: number; available: number; rac: number; wl: number }> = [];

  const sectionMatch = raw.match(/~0~1~(.+?)~~~~~~~/);
  const classSection = sectionMatch ? sectionMatch[1] : "";
  if (!classSection) return results;

  const entries = classSection.split("|").filter(Boolean);
  for (const entry of entries) {
    const fields = entry.split(":");
    if (fields.length < 2) continue;

    const classCode = fields[0].trim();
    if (classCode.length > 5 || /^\d+$/.test(classCode)) continue;
    if (!(classCode in CLASS_NAMES) && !/^[123][AEC]$/.test(classCode) &&
        !["SL", "CC", "EC", "2S", "FC"].includes(classCode)) continue;

    results.push({
      classCode,
      total: parseInt(fields[1] || "0"),
      available: parseInt(fields[2] || "0"),
      rac: parseInt(fields[3] || "0"),
      wl: parseInt(fields[4] || "0"),
    });
  }

  return results;
}

function determineSeatStatus(entry: { available: number; rac: number; wl: number }): SeatStatus {
  if (entry.available > 0) return "AVAILABLE";
  if (entry.rac > 0) return "RAC";
  if (entry.wl > 0) return "WAITLIST";
  return "NOT_AVAILABLE";
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

  return cache
    .getOrRefresh<AvailabilityResponse>(
      cacheKey,
      CONFIG.CACHE.AVAIL_TTL,
      async () => {
        const raw = await scraperClient.get(
          SOURCES.TRAIN_INFO(trainNo),
          "https://erail.in/"
        );

        const header = parseErailTrainInfo(raw);
        if (!header) throw new Error("NOT_FOUND");

        const classEntries = parseClassData(raw);
        if (classEntries.length === 0) throw new Error("PARSE_FAILURE");

        const fareData = parseFareData(raw);

        const classes: ClassAvailability[] = classEntries.map((entry) => ({
          classCode: entry.classCode,
          className: CLASS_NAMES[entry.classCode] || entry.classCode,
          status: determineSeatStatus(entry),
          available: entry.available,
          waitlistNumber: entry.wl > 0 ? entry.wl : undefined,
          fare: fareData[entry.classCode] || 0,
          isTatkal: false,
        }));

        const fromName = from.toUpperCase() === header.from_stn_code
          ? header.from_stn_name || ""
          : from.toUpperCase() === header.to_stn_code
            ? header.to_stn_name || ""
            : "";
        const toName = to.toUpperCase() === header.to_stn_code
          ? header.to_stn_name || ""
          : to.toUpperCase() === header.from_stn_code
            ? header.from_stn_name || ""
            : "";

        return {
          trainNumber: header.train_no || trainNo,
          trainName: header.train_name || "",
          from: { code: from.toUpperCase(), name: fromName },
          to: { code: to.toUpperCase(), name: toName },
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
    .catch((err: unknown) => {
      const msg = err instanceof Error ? err.message : "Unknown error";
      if (msg === "NOT_FOUND")
        return fail(ERROR_CODES.NOT_FOUND, `Train ${trainNo} not found`, false);
      if (msg === "PARSE_FAILURE")
        return fail(ERROR_CODES.PARSE_FAILURE, "Could not parse availability data from train info response", true);
      if (msg.includes("timeout") || msg.includes("TIMEOUT"))
        return fail(ERROR_CODES.TIMEOUT, msg, true);
      if (msg.includes("ECONNREFUSED") || msg.includes("ENOTFOUND"))
        return fail(ERROR_CODES.UPSTREAM_UNREACHABLE, msg, true);
      if (msg.includes("429") || msg.includes("Too Many Requests"))
        return fail(ERROR_CODES.UPSTREAM_RATE_LIMIT, msg, true);
      return fail(ERROR_CODES.UPSTREAM_ERROR, msg, true);
    });
}

/**
 * GET /api/v1/trains/:trainNumber/fare
 * Fare endpoint — returns only fare information, not availability.
 * Separated from availability to have a distinct response format.
 */
export async function getFare(
  trainNo: string,
  from: string,
  to: string,
  date: string,
  quota = "GN"
): Promise<ScrapeResult<FareResponse>> {
  if (!/^\d{4,5}$/.test(trainNo)) {
    return fail(ERROR_CODES.INVALID_INPUT, "Train number must be 4-5 digits");
  }

  const cacheKey = `fare:${trainNo}:${from}:${to}:${date}:${quota}`;

  return cache
    .getOrRefresh<FareResponse>(
      cacheKey,
      CONFIG.CACHE.AVAIL_TTL,
      async () => {
        const raw = await scraperClient.get(
          SOURCES.TRAIN_INFO(trainNo),
          "https://erail.in/"
        );

        const header = parseErailTrainInfo(raw);
        if (!header) throw new Error("NOT_FOUND");

        const fareData = parseFareData(raw);
        const classEntries = parseClassData(raw);

        const fares: FareEntry[] = classEntries.map((entry) => ({
          classCode: entry.classCode,
          className: CLASS_NAMES[entry.classCode] || entry.classCode,
          fare: fareData[entry.classCode] || 0,
          isTatkal: false,
        }));

        const fromName = from.toUpperCase() === header.from_stn_code
          ? header.from_stn_name || ""
          : from.toUpperCase() === header.to_stn_code
            ? header.to_stn_name || ""
            : "";
        const toName = to.toUpperCase() === header.to_stn_code
          ? header.to_stn_name || ""
          : to.toUpperCase() === header.from_stn_code
            ? header.from_stn_name || ""
            : "";

        return {
          trainNumber: header.train_no || trainNo,
          trainName: header.train_name || "",
          from: { code: from.toUpperCase(), name: fromName },
          to: { code: to.toUpperCase(), name: toName },
          date,
          quota: quota.toUpperCase(),
          fares,
          totalFares: fares.length,
        };
      }
    )
    .then(
      ({ data, cached: isCached }) =>
        isCached ? cachedRes(data) : ok(data)
    )
    .catch((err: unknown) => {
      const msg = err instanceof Error ? err.message : "Unknown error";
      if (msg === "NOT_FOUND")
        return fail(ERROR_CODES.NOT_FOUND, `Train ${trainNo} not found`, false);
      if (msg.includes("timeout") || msg.includes("TIMEOUT"))
        return fail(ERROR_CODES.TIMEOUT, msg, true);
      if (msg.includes("ECONNREFUSED") || msg.includes("ENOTFOUND"))
        return fail(ERROR_CODES.UPSTREAM_UNREACHABLE, msg, true);
      return fail(ERROR_CODES.UPSTREAM_ERROR, msg, true);
    });
}