/* ══════════════════════════════════════════════════════════════
   RAPI — Train Search Scraper
   Source: erail.in (pipe-delimited text response)
   ══════════════════════════════════════════════════════════════ */

import * as cheerio from "cheerio";
import { scraperClient, ScrapeResult, ok, cachedRes, fail } from "./client";
import { ERROR_CODES } from "../utils/errors";
import { cache } from "../cache";
import { SOURCES, CONFIG } from "../config";
import { clean } from "../utils/parser";
import type { TrainSearchEntry, TrainSearchResponse } from "../types";

/* ─── Parser: erail.in pipe-delimited format ───────────────── */

function parsePipeDelimited(raw: string): TrainSearchEntry[] {
  const blocks = raw.split("~~~~~~~~").filter(Boolean);
  if (!blocks.length) return [];

  const trains: TrainSearchEntry[] = [];

  for (const block of blocks) {
    try {
      const lines = block.split("~^");
      if (lines.length < 2) continue;

      const fields = lines[1].split("~").filter(Boolean);
      if (fields.length < 14) {
        while (fields.length < 14) fields.push("");
      }

      trains.push({
        trainNumber: fields[0] || "",
        trainName: fields[1] || "",
        sourceStationName: fields[2] || "",
        sourceStationCode: fields[3] || "",
        destinationStationName: fields[4] || "",
        destinationStationCode: fields[5] || "",
        fromStationName: fields[6] || "",
        fromStationCode: fields[7] || "",
        toStationName: fields[8] || "",
        toStationCode: fields[9] || "",
        fromTime: fields[10] || "",
        toTime: fields[11] || "",
        travelTime: fields[12] || "",
        runningDays: fields[13] || "",
        trainType: fields.length > 14 ? fields[14] || "" : undefined,
      });
    } catch {
      continue;
    }
  }

  return trains;
}

/**
 * Parse train search results from HTML (fallback if pipe-delimited fails).
 */
function parseHTMLTable(html: string): TrainSearchEntry[] {
  try {
    const $ = cheerio.load(html);
    const trains: TrainSearchEntry[] = [];

    $(
      "table.train-list tbody tr, " +
      ".train-results tbody tr, " +
      ".train-table tbody tr, " +
      "[data-testid='train-results'] tbody tr, " +
      "table.table tbody tr"
    ).each((_i: number, row: any) => {
      const cells = $(row).find("td");
      if (cells.length < 6) return;

      const train: TrainSearchEntry = {
        trainNumber: clean($(cells[0]).text()),
        trainName: clean($(cells[1]).text()),
        sourceStationName: clean($(cells[2]).text()),
        sourceStationCode: "",
        destinationStationName: clean($(cells[3]).text()),
        destinationStationCode: "",
        fromStationName: clean($(cells[2]).text()),
        fromStationCode: "",
        toStationName: clean($(cells[3]).text()),
        toStationCode: "",
        fromTime: clean($(cells[4]).text()),
        toTime: clean($(cells[5]).text()),
        travelTime: cells.length > 6 ? clean($(cells[6]).text()) : "",
        runningDays: cells.length > 7 ? clean($(cells[7]).text()) : "",
      };

      const fromMatch = train.fromStationName.match(/\(([A-Z]+)\)/);
      const toMatch = train.toStationName.match(/\(([A-Z]+)\)/);
      if (fromMatch) train.fromStationCode = fromMatch[1];
      if (toMatch) train.toStationCode = toMatch[1];

      trains.push(train);
    });

    return trains;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn("[Search] HTML table parsing failed:", msg);
    return [];
  }
}

/* ─── Main Scraper Function ───────────────────────────────── */

export async function searchTrains(
  from: string,
  to: string,
  date?: string
): Promise<ScrapeResult<TrainSearchResponse>> {
  if (!/^[A-Za-z0-9]{2,10}$/.test(from) || !/^[A-Za-z0-9]{2,10}$/.test(to)) {
    return fail(ERROR_CODES.INVALID_INPUT, "Invalid station codes");
  }

  const fromUpper = from.toUpperCase().trim();
  const toUpper = to.toUpperCase().trim();
  const cacheKey = date
    ? `trains:${fromUpper}:${toUpper}:${date}`
    : `trains:${fromUpper}:${toUpper}`;

  return cache
    .getOrRefresh<TrainSearchResponse>(
      cacheKey,
      CONFIG.CACHE.TRAIN_SEARCH_TTL,
      async () => {
        const raw = await scraperClient.get(
          SOURCES.TRAIN_SEARCH(fromUpper, toUpper),
          "https://erail.in/"
        );

        let trains = parsePipeDelimited(raw);
        if (trains.length === 0) {
          trains = parseHTMLTable(raw);
        }

        return {
          from: fromUpper,
          to: toUpper,
          total: trains.length,
          trains,
        };
      }
    )
    .then(
      ({ data, cached: isCached }) =>
        isCached ? cachedRes(data) : ok(data)
    )
    .catch((err: unknown) => {
      const msg = err instanceof Error ? err.message : "Unknown error";
      if (msg.includes("timeout") || msg.includes("TIMEOUT"))
        return fail(ERROR_CODES.TIMEOUT, msg, true);
      if (msg.includes("ECONNREFUSED") || msg.includes("ENOTFOUND"))
        return fail(ERROR_CODES.UPSTREAM_UNREACHABLE, msg, true);
      if (msg.includes("429") || msg.includes("Too Many Requests"))
        return fail(ERROR_CODES.UPSTREAM_RATE_LIMIT, msg, true);
      return fail(ERROR_CODES.UPSTREAM_ERROR, msg, true);
    });
}