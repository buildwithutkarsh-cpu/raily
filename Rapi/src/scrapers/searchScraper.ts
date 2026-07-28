/* ══════════════════════════════════════════════════════════════
   RAPI — Train Search Scraper
   
   Source: erail.in (pipe-delimited text response)
   
   Strategy:
     1. Query erail.in with from/to station codes
     2. Parse the pipe-delimited (~^~ separated) response
     3. Apply output sanitization (whitespace, entities)
     4. Handle missing/truncated data gracefully
   
   DOM Resiliency:
     - Falls back to cheerio HTML parsing if pipe-delimited parsing fails
     - Multiple response format support
     - Sanitizes &nbsp;, \\n, \\t via clean()
   ══════════════════════════════════════════════════════════════ */

import * as cheerio from "cheerio";
import { scraperClient, ScrapeResult, ok, cachedRes, fail } from "./client";
import { ERROR_CODES } from "../utils/errors";
import { cache } from "../cache";
import { SOURCES, CONFIG } from "../config";
import { clean, sanitizeHTML } from "../utils/parser";

/* ─── Types ────────────────────────────────────────────────── */

export interface TrainSearchEntry {
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

export interface TrainSearchResponse {
  from: string;
  to: string;
  total: number;
  trains: TrainSearchEntry[];
}

/* ─── Parser: erail.in pipe-delimited format ───────────────── */

/**
 * Parse erail.in pipe-delimited train search response.
 * 
 * The response format is:
 *   ~~~header~~~^field1~field2~field3...~~~~~~~~
 * 
 * Each train entry is a block separated by ~~~~~~~~
 */
function parsePipeDelimited(raw: string): TrainSearchEntry[] {
  const blocks = raw.split("~~~~~~~~").filter(Boolean);
  if (!blocks.length) return [];

  const trains: TrainSearchEntry[] = [];

  for (const block of blocks) {
    try {
      // Each block has format: header~^~field1~field2~field3...
      const lines = block.split("~^");
      if (lines.length < 2) continue;

      const fields = lines[1].split("~").filter(Boolean);
      if (fields.length < 14) {
        // If we have partial data, fill with empty strings
        while (fields.length < 14) fields.push("");
      }

      const entry: TrainSearchEntry = {
        train_no: sanitizeHTML(fields[0] || ""),
        train_name: sanitizeHTML(fields[1] || ""),
        source_stn_name: sanitizeHTML(fields[2] || ""),
        source_stn_code: sanitizeHTML(fields[3] || ""),
        dstn_stn_name: sanitizeHTML(fields[4] || ""),
        dstn_stn_code: sanitizeHTML(fields[5] || ""),
        from_stn_name: sanitizeHTML(fields[6] || ""),
        from_stn_code: sanitizeHTML(fields[7] || ""),
        to_stn_name: sanitizeHTML(fields[8] || ""),
        to_stn_code: sanitizeHTML(fields[9] || ""),
        from_time: sanitizeHTML(fields[10] || ""),
        to_time: sanitizeHTML(fields[11] || ""),
        travel_time: sanitizeHTML(fields[12] || ""),
        running_days: sanitizeHTML(fields[13] || ""),
        train_type: fields.length > 14 ? sanitizeHTML(fields[14] || "") : undefined,
      };

      trains.push(entry);
    } catch {
      // Skip malformed blocks
      continue;
    }
  }

  return trains;
}

/**
 * Parse train search results from HTML (fallback if pipe-delimited fails).
 * Some endpoints return HTML tables instead of pipe-delimited text.
 */
function parseHTMLTable(html: string): TrainSearchEntry[] {
  try {
    const $ = cheerio.load(html);
    const trains: TrainSearchEntry[] = [];

    // Try to find a train results table
    $(
      "table.train-list tbody tr, " +
      ".train-results tbody tr, " +
      ".train-table tbody tr, " +
      "[data-testid='train-results'] tbody tr, " +
      "table.table tbody tr"
    ).each((_i: number, row: any) => {
      const cells = $(row).find("td");
      if (cells.length < 6) return;

      // Flexible column mapping
      const train: TrainSearchEntry = {
        train_no: clean($(cells[0]).text()),
        train_name: clean($(cells[1]).text()),
        source_stn_name: clean($(cells[2]).text()),
        source_stn_code: "",
        dstn_stn_name: clean($(cells[3]).text()),
        dstn_stn_code: "",
        from_stn_name: clean($(cells[2]).text()),
        from_stn_code: "",
        to_stn_name: clean($(cells[3]).text()),
        to_stn_code: "",
        from_time: clean($(cells[4]).text()),
        to_time: clean($(cells[5]).text()),
        travel_time: cells.length > 6 ? clean($(cells[6]).text()) : "",
        running_days: cells.length > 7 ? clean($(cells[7]).text()) : "",
      };

      // Try to extract station codes from names (e.g., "New Delhi(NDLS)")
      const fromMatch = train.from_stn_name.match(/\(([A-Z]+)\)/);
      const toMatch = train.to_stn_name.match(/\(([A-Z]+)\)/);
      if (fromMatch) train.from_stn_code = fromMatch[1];
      if (toMatch) train.to_stn_code = toMatch[1];

      trains.push(train);
    });

    return trains;
  } catch (err: any) {
    console.warn("[Search] HTML table parsing failed:", err.message);
    return [];
  }
}

/* ─── Main Scraper Function ───────────────────────────────── */

export async function searchTrains(
  from: string,
  to: string
): Promise<ScrapeResult<TrainSearchResponse>> {
  // Validate station codes
  if (!/^[A-Za-z0-9]{2,10}$/.test(from) || !/^[A-Za-z0-9]{2,10}$/.test(to)) {
    return fail(ERROR_CODES.INVALID_INPUT, "Invalid station codes. Use 2-10 character codes like NDLS, BCT");
  }

  const fromUpper = from.toUpperCase().trim();
  const toUpper = to.toUpperCase().trim();
  const cacheKey = `trains:${fromUpper}:${toUpper}`;

  return cache.getOrRefresh<TrainSearchResponse>(
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
  .catch((err: any) => {
    const msg = err.message || "Unknown error";
    if (msg.includes("timeout") || msg.includes("TIMEOUT"))
      return fail(ERROR_CODES.TIMEOUT, msg, true);
    if (msg.includes("ECONNREFUSED") || msg.includes("ENOTFOUND"))
      return fail(ERROR_CODES.UPSTREAM_UNREACHABLE, msg, true);
    if (msg.includes("429") || msg.includes("Too Many Requests"))
      return fail(ERROR_CODES.UPSTREAM_RATE_LIMIT, msg, true);
    return fail(ERROR_CODES.UPSTREAM_ERROR, msg, true);
  });
}
