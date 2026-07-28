/* ══════════════════════════════════════════════════════════════
   RAPI — Live Train Status Scraper
   
   Sources: etrain.info, NTES enquiry portal
   
   Strategy:
     1. Fetch live status page from etrain.info
     2. Try cheerio DOM parsing with flexible CSS selector fallbacks
     3. Fall back to embedded JSON extraction (__INITIAL_STATE__)
     4. Combined fallback: merge data from both sources
   
   DOM Resiliency:
     - Multiple CSS selector paths for each field
     - Sanitizes whitespace via clean()
     - Handles missing columns gracefully
   ══════════════════════════════════════════════════════════════ */

import * as cheerio from "cheerio";
import { scraperClient, ScrapeResult, ok, cachedRes, fail } from "./client";
import { ERROR_CODES } from "../utils/errors";
import { cache } from "../cache";
import { SOURCES, CONFIG } from "../config";
import { clean } from "../utils/parser";

/* ─── Types ────────────────────────────────────────────────── */

export interface LiveStation {
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

export interface LiveStatusResponse {
  trainNo: string;
  trainName: string;
  date: string;
  statusNote: string;
  lastUpdate: string;
  currentStationCode: string;
  currentStationName: string;
  delay: number;
  totalStations: number;
  timeline: LiveStation[];
}

/* ─── Helpers ──────────────────────────────────────────────── */

function getTodayDate(): string {
  const d = new Date();
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}-${mm}-${yyyy}`;
}

/**
 * Parse delay string like "15 min late", "On Time", "30M" into minutes.
 */
function parseDelay(delayStr: string): number {
  if (!delayStr) return 0;
  const lower = delayStr.toLowerCase();
  if (lower.includes("on time") || lower.includes("right time") || lower === "-") return 0;
  const match = delayStr.match(/(\d+)\s*(min|m)/i);
  return match ? parseInt(match[1]) : 0;
}

/* ─── DOM Parsing ──────────────────────────────────────────── */

interface DOMExtract {
  trainNo?: string;
  trainName?: string;
  statusNote?: string;
  lastUpdate?: string;
  currentStation?: string;
  currentStationName?: string;
  delay?: number;
  stations?: Array<{
    code: string;
    name: string;
    schArr: string;
    schDep: string;
    actArr?: string;
    actDep?: string;
    distance: number;
    day: number;
    platform?: string;
    delay: number;
    status: LiveStation["status"];
  }>;
}

/**
 * Parse live status from etrain.info HTML using cheerio.
 * Uses multiple selector fallbacks for each data point.
 */
function parseLiveDOM(html: string): DOMExtract | null {
  try {
    const $ = cheerio.load(html);
    const result: DOMExtract = {};

    // ── Train Name ──────────────────────────────────────────
    const titleText = clean($("title").text()) || "";
    result.trainName =
      clean($(".train-name").text()) ||
      clean($("[data-testid='train-name']").text()) ||
      clean($(".train-info .train-name").text()) ||
      clean($("h1.train-name, h1.tn").text()) ||
      titleText.split("|")[0]?.replace("Live Status", "").trim() ||
      "";

    // ── Train Number ────────────────────────────────────────
    result.trainNo =
      clean($(".train-number").text()) ||
      clean($("[data-testid='train-number']").text()) ||
      clean($(".train-info .train-no").text()) ||
      clean($(".train-number span").text()) ||
      "";

    // ── Status Note ─────────────────────────────────────────
    result.statusNote =
      clean($(".train-running-status .status-text").text()) ||
      clean($(".live-status-summary .status, .live-status-summary").text()) ||
      clean($(".current-status-indicator .status-text").text()) ||
      clean($(".running-status .status-message").text()) ||
      clean($(".status-info, .status").first().text()) ||
      "Status unavailable";

    // ── Last Updated ────────────────────────────────────────
    result.lastUpdate =
      clean($(".last-updated, .last-update").text()) ||
      clean($("[data-testid='last-update']").text()) ||
      clean($(".update-info .time").text()) ||
      clean($(".live-status-header .time").text()) ||
      new Date().toISOString();

    // ── Current Station ─────────────────────────────────────
    result.currentStation =
      clean($(".current-station .station-code, .current-stn-code").text()) ||
      clean($("[data-testid='current-station'] .code").text()) ||
      clean($(".current-station-name .code").text()) ||
      "";

    result.currentStationName =
      clean($(".current-station .station-name, .current-stn-name").text()) ||
      clean($("[data-testid='current-station'] .name").text()) ||
      clean($(".current-station-name .name").text()) ||
      "";

    // ── Overall Delay ───────────────────────────────────────
    const delayText =
      clean($(".total-delay, .delay-info, .late-by").text()) ||
      clean($("[data-testid='delay']").text()) ||
      clean($(".status-delay .value").text()) ||
      "";
    result.delay = parseDelay(delayText);

    // ── Station Timeline Table ──────────────────────────────
    const stations: DOMExtract["stations"] = [];

    // Pattern 1: Standard station table
    $(
      "table.live-station-table tbody tr, " +
      ".station-list tr, " +
      ".train-route-table tbody tr, " +
      ".schedule-table tbody tr, " +
      "[data-testid='station-timeline'] tbody tr, " +
      ".station-row"
    ).each((_i: number, row: any) => {
      const cells = $(row).find("td, .station-cell");
      if (cells.length < 4) return;

      const station: (typeof stations)[0] = {
        code: clean($(cells[0]).text()),
        name: clean($(cells[1]).text()),
        schArr: clean($(cells[2]).text()),
        schDep: clean($(cells[3]).text()),
        actArr: cells.length > 4 ? clean($(cells[4]).text()) || undefined : undefined,
        actDep: cells.length > 5 ? clean($(cells[5]).text()) || undefined : undefined,
        distance: cells.length > 6 ? parseInt($(cells[6]).text() || "0") : 0,
        day: 1,
        platform: cells.length > 7 ? clean($(cells[7]).text()) || undefined : undefined,
        delay: 0,
        status: "upcoming",
      };

      // Determine status from row class
      const rowClass = $(row).attr("class") || "";
      const dataStatus = $(row).attr("data-status") || "";

      if (
        rowClass.includes("passed") ||
        rowClass.includes("completed") ||
        station.actDep
      ) {
        station.status = "passed";
      } else if (
        rowClass.includes("current") ||
        rowClass.includes("active") ||
        dataStatus === "current" ||
        rowClass.includes("live")
      ) {
        station.status = "current";
        result.currentStation = station.code;
        result.currentStationName = station.name;

        // Calculate delay from current station
        if (station.actArr && station.schArr) {
          station.delay = calculateDelay(station.schArr, station.actArr);
        }
      }

      // Try to extract delay from delay column or embedded text
      if (cells.length > 8) {
        const delayCellText = clean($(cells[8]).text());
        if (delayCellText) station.delay = parseDelay(delayCellText);
      }

      stations.push(station);
    });

    // Pattern 2: Div-based station cards (mobile layout)
    if (stations.length === 0) {
      $(
        ".station-card, .station-item, .route-station, " +
        "[data-testid='station-card']"
      ).each((_i: number, card: any) => {
        const station: (typeof stations)[0] = {
          code:
            clean($(card).find(".stn-code, .station-code, .code").text()) ||
            clean($(card).find("[data-stn-code]").attr("data-stn-code") || ""),
          name:
            clean($(card).find(".stn-name, .station-name, .name").text()) || "",
          schArr:
            clean($(card).find(".sch-arr, .scheduled-arrival, .arrival-sch").text()) || "",
          schDep:
            clean($(card).find(".sch-dep, .scheduled-departure, .departure-sch").text()) || "",
          actArr:
            clean($(card).find(".act-arr, .actual-arrival, .arrival-act").text()) || undefined,
          actDep:
            clean($(card).find(".act-dep, .actual-departure, .departure-act").text()) || undefined,
          distance: parseInt(
            $(card).find(".distance, .km, .dist").text() || "0"
          ),
          day: 1,
          platform:
            clean($(card).find(".platform, .pf, .plat").text()) || undefined,
          delay: 0,
          status: "upcoming",
        };

        const cardClass = $(card).attr("class") || "";
        if (cardClass.includes("current") || cardClass.includes("live")) {
          station.status = "current";
          result.currentStation = station.code;
          result.currentStationName = station.name;
          if (station.actArr && station.schArr) {
            station.delay = calculateDelay(station.schArr, station.actArr);
          }
        } else if (cardClass.includes("passed") || cardClass.includes("done")) {
          station.status = "passed";
        }

        // Day from attribute or text
        const dayAttr = $(card).attr("data-day");
        if (dayAttr) station.day = parseInt(dayAttr);
        const dayText = clean($(card).find(".day, .journey-day").text());
        const dayMatch = dayText.match(/(\d+)/);
        if (dayMatch) station.day = parseInt(dayMatch[1]);

        stations.push(station);
      });
    }

    result.stations = stations;
    return result;
  } catch (err: any) {
    console.warn("[LiveStatus] DOM parsing failed:", err.message);
    return null;
  }
}

/**
 * Calculate delay in minutes between scheduled and actual time.
 * Times in HH:MM format.
 */
function calculateDelay(scheduled: string, actual: string): number {
  if (!scheduled || !actual) return 0;
  const schParts = scheduled.match(/(\d{1,2}):(\d{2})/);
  const actParts = actual.match(/(\d{1,2}):(\d{2})/);
  if (!schParts || !actParts) return 0;

  const schMin = parseInt(schParts[1]) * 60 + parseInt(schParts[2]);
  const actMin = parseInt(actParts[1]) * 60 + parseInt(actParts[2]);
  let diff = actMin - schMin;

  if (diff < -720) diff += 1440;
  if (diff > 720) diff -= 1440;

  return Math.max(0, diff);
}

/**
 * Extract embedded JSON from etrain.info live status page.
 */
function parseEmbeddedJSON(html: string): any {
  // Pattern 1: window.__INITIAL_STATE__
  const match = html.match(/window\.__INITIAL_STATE__\s*=\s*({.*?});/s);
  if (match) {
    try {
      return JSON.parse(match[1]);
    } catch { /* continue */ }
  }

  // Pattern 2: __NEXT_DATA__
  const nextMatch = html.match(/<script[^>]*id="__NEXT_DATA__"[^>]*>(.*?)<\/script>/s);
  if (nextMatch) {
    try {
      return JSON.parse(nextMatch[1]);
    } catch { /* continue */ }
  }

  // Pattern 3: JSON-LD
  const jsonLdMatch = html.match(/<script[^>]*type="application\/ld\+json"[^>]*>(.*?)<\/script>/s);
  if (jsonLdMatch) {
    try {
      return JSON.parse(jsonLdMatch[1]);
    } catch { return null; }
  }

  return null;
}

/* ─── Main Scraper Function ───────────────────────────────── */

export async function getLiveStatus(
  trainNo: string,
  date?: string
): Promise<ScrapeResult<LiveStatusResponse>> {
  if (!/^\d{4,5}$/.test(trainNo)) {
    return fail(ERROR_CODES.INVALID_INPUT, "Train number must be 4-5 digits");
  }

  const journeyDate = date || getTodayDate();

  if (!/^\d{2}-\d{2}-\d{4}$/.test(journeyDate)) {
    return fail(ERROR_CODES.INVALID_INPUT, "Date must be in DD-MM-YYYY format");
  }

  const cacheKey = `live:${trainNo}:${journeyDate}`;

  return cache.getOrRefresh<LiveStatusResponse>(
    cacheKey,
    CONFIG.CACHE.LIVE_TTL,
    async () => {
      const html = await scraperClient.get(
        SOURCES.LIVE_STATUS(trainNo, journeyDate),
        "https://etrain.info/"
      );

      const domParsed = parseLiveDOM(html);
      const jsonParsed = parseEmbeddedJSON(html);

      let timeline: LiveStation[] = [];
      let trainName = domParsed?.trainName || "";
      let statusNote = domParsed?.statusNote || "Status unavailable";
      let lastUpdate = domParsed?.lastUpdate || new Date().toISOString();
      let currentStationCode = domParsed?.currentStation || "";
      let currentStationName = domParsed?.currentStationName || "";
      let totalDelay = domParsed?.delay || 0;

      if (jsonParsed) {
        const jsonTimeline = extractTimelineFromJSON(jsonParsed);
        if (jsonTimeline.length > 0) {
          timeline = jsonTimeline;

          trainName = trainName ||
            extractFromJSON(jsonParsed, "trainName", "train_name", "train.name") || "";

          const jsonCurrent = timeline.find((s) => s.status === "current");
          if (jsonCurrent) {
            currentStationCode = jsonCurrent.stationCode;
            currentStationName = jsonCurrent.stationName;
            totalDelay = jsonCurrent.delay;
          }

          statusNote = statusNote ||
            extractFromJSON(jsonParsed, "statusNote", "status_note", "status") || "Status unavailable";
        }
      }

      if (timeline.length === 0 && domParsed?.stations && domParsed.stations.length > 0) {
        timeline = domParsed.stations.map((s) => ({
          stationCode: s.code,
          stationName: s.name,
          scheduledArrival: s.schArr,
          scheduledDeparture: s.schDep,
          actualArrival: s.actArr,
          actualDeparture: s.actDep,
          distance: s.distance,
          day: s.day || 1,
          platform: s.platform,
          delay: s.delay,
          status: s.status,
        }));
      }

      if (timeline.length === 0) {
        throw new Error("PARSE_FAILURE");
      }

      return {
        trainNo,
        trainName,
        date: journeyDate,
        statusNote,
        lastUpdate,
        currentStationCode,
        currentStationName,
        delay: totalDelay,
        totalStations: timeline.length,
        timeline,
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
      return fail(ERROR_CODES.PARSE_FAILURE, "Could not parse live status data — the page structure may have changed", true);
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

/* ─── JSON Extraction Helpers ─────────────────────────────── */

function extractFromJSON(obj: any, ...keys: (string)[]): string | undefined {
  if (!obj) return undefined;
  for (const key of keys) {
    const parts = key.split(".");
    let current = obj;
    let found = true;
    for (const part of parts) {
      if (current && typeof current === "object" && part in current) {
        current = current[part];
      } else {
        found = false;
        break;
      }
    }
    if (found && current !== undefined && current !== null) {
      return String(current);
    }
  }
  return undefined;
}

function extractTimelineFromJSON(json: any): LiveStation[] {
  if (!json) return [];

  const timeline: LiveStation[] = [];

  const possibleSources = [
    json, json.data, json.props, json.props?.pageProps,
    json.pageProps, json.initialState, json.state,
  ];

  for (const source of possibleSources) {
    if (!source) continue;

    const rawTimeline =
      source.timeline || source.stationList || source.stations ||
      source.route || source.stationTimeline || source.trainRoute ||
      source.data?.timeline || source.data?.stations || source.data?.route;

    if (Array.isArray(rawTimeline) && rawTimeline.length > 0) {
      for (const entry of rawTimeline) {
        const station: LiveStation = {
          stationCode:
            entry.stationCode || entry.code || entry.stnCode ||
            entry.station_code || entry.stn_code || "",
          stationName:
            entry.stationName || entry.name || entry.stnName ||
            entry.station_name || entry.stn_name || "",
          scheduledArrival:
            entry.schArr || entry.scheduledArrival || entry.arrival?.scheduled ||
            entry.sch_arr || entry.scheduled_arrival || entry.arrivalTime || "",
          scheduledDeparture:
            entry.schDep || entry.scheduledDeparture || entry.departure?.scheduled ||
            entry.sch_dep || entry.scheduled_departure || entry.departureTime || "",
          actualArrival:
            entry.actArr || entry.actualArrival || entry.arrival?.actual ||
            entry.act_arr || entry.actual_arrival || undefined,
          actualDeparture:
            entry.actDep || entry.actualDeparture || entry.departure?.actual ||
            entry.act_dep || entry.actual_departure || undefined,
          distance: parseInt(entry.distance || entry.distanceKm || entry.distance_km || "0"),
          day: parseInt(entry.day || entry.journeyDay || entry.day_no || "1"),
          platform:
            entry.platform || entry.pf || entry.platformNumber ||
            entry.platform_number || undefined,
          delay: parseInt(entry.delay || entry.delayMinutes || entry.delay_minutes || "0"),
          status: entry.status || "upcoming",
        };

        timeline.push(station);
      }

      if (timeline.length > 0) break;
    }
  }

  return timeline;
}
