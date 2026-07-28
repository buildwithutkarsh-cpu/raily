/* ══════════════════════════════════════════════════════════════
   RAPI — Live Train Status Scraper
   
   Source: erail.in (pipe-delimited train info + route data)
   
   Strategy:
     1. Fetch train info from erail.in's getTrains.aspx API
     2. Extract the train_id for route data lookup
     3. Fetch route data from erail.in's data.aspx API
     4. Combine into a structured LiveStatusResponse
     5. Determine station status (passed/current/upcoming)
        based on scheduled times vs current time
   
   Why erail.in instead of etrain.info?
     - etrain.info uses captcha + dynamic AJAX loading, making
       server-side scraping unreliable
     - erail.in's data API is simple, fast, and proven to work
       (same API used by searchScraper and infoScraper)
     - erail.in returns pipe-delimited text that is easy to parse
   ══════════════════════════════════════════════════════════════ */

import { scraperClient, ScrapeResult, ok, cachedRes, fail } from "./client";
import { ERROR_CODES } from "../utils/errors";
import { cache } from "../cache";
import { SOURCES, CONFIG } from "../config";
import { parseErailTrainInfo, parseErailRoute } from "../utils/parser";

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
 * Parse a time string in HH.MM or HH:MM format to total minutes from midnight.
 */
function timeToMinutes(timeStr: string): number {
  if (!timeStr || timeStr === "--" || timeStr === "First" || timeStr === "Last") return -1;
  const match = timeStr.match(/(\d{1,2})[.:](\d{2})/);
  if (!match) return -1;
  return parseInt(match[1]) * 60 + parseInt(match[2]);
}

/**
 * Compute the current status of each station based on scheduled times and current time.
 * For a train journey:
 *   - If the scheduled departure of a station is before current time, mark as "passed"
 *   - The last passed station becomes "current"
 *   - All remaining stations are "upcoming"
 */
function computeStationStatuses(
  stations: LiveStation[],
  now: Date,
  journeyDate: string
): { stations: LiveStation[]; currentCode: string; currentName: string } {
  if (stations.length === 0) {
    return { stations: [], currentCode: "", currentName: "" };
  }

  // Parse the journey date
  const [dd, mm, yyyy] = journeyDate.split("-").map(Number);
  const journeyStart = new Date(yyyy, mm - 1, dd);
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  
  // Days elapsed since journey start (works across month/year boundaries)
  const msPerDay = 1000 * 60 * 60 * 24;
  const daysElapsed = Math.floor((now.getTime() - journeyStart.getTime()) / msPerDay);
  
  let currentCode = "";
  let currentName = "";
  let lastPassedIndex = -1;

  const result = stations.map((station, index) => {
    const dep = timeToMinutes(station.scheduledDeparture);
    
    let status: "passed" | "current" | "upcoming" = "upcoming";
    
    if (station.day <= daysElapsed && station.scheduledDeparture !== "Last") {
      // Previous day — definitely passed
      status = "passed";
      if (index > lastPassedIndex) {
        lastPassedIndex = index;
        currentCode = station.stationCode;
        currentName = station.stationName;
      }
    } else if (station.day === daysElapsed + 1) {
      // Same journey day — check current time vs departure
      if (dep >= 0 && dep < nowMinutes) {
        status = "passed";
        if (index > lastPassedIndex) {
          lastPassedIndex = index;
          currentCode = station.stationCode;
          currentName = station.stationName;
        }
      } else if (dep >= 0 && dep <= nowMinutes + 30) {
        // Within 30 minutes of departure — consider as current
        status = "current";
        currentCode = station.stationCode;
        currentName = station.stationName;
      }
    }
    
    return { ...station, status };
  });

  // If no stations marked as passed or current, mark source station as current
  if (lastPassedIndex === -1 && result.length > 0) {
    result[0].status = "current";
    currentCode = result[0].stationCode;
    currentName = result[0].stationName;
  }
  
  // More accurate: set the last "passed" station as "current" if nothing else is
  if (!currentCode && lastPassedIndex >= 0) {
    result[lastPassedIndex].status = "current";
    currentCode = result[lastPassedIndex].stationCode;
    currentName = result[lastPassedIndex].stationName;
  }

  return {
    stations: result,
    currentCode,
    currentName,
  };
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
      // Step 1: Fetch train info from erail.in
      const infoRaw = await scraperClient.get(
        SOURCES.TRAIN_INFO(trainNo),
        "https://erail.in/"
      );

      const info = parseErailTrainInfo(infoRaw);
      if (!info) {
        throw new Error("NOT_FOUND");
      }

      // Step 2: Fetch route data
      let routeStations: Array<{
        stnCode: string;
        stnName: string;
        arrival: string;
        departure: string;
        distance: number;
        day: number;
        zone?: string;
      }> = [];

      if (info.train_id) {
        try {
          const routeRaw = await scraperClient.get(
            SOURCES.TRAIN_ROUTE(info.train_id),
            "https://erail.in/"
          );
          routeStations = parseErailRoute(routeRaw);
        } catch (routeErr: any) {
          console.warn(`[LiveStatus] Failed to fetch route for train ${trainNo}:`, routeErr.message);
        }
      }

      // If no route data, create a minimal timeline from the train info
      if (routeStations.length === 0) {
        // Fallback: create stations from from/to info
        const timeline: LiveStation[] = [];
        
        timeline.push({
          stationCode: info.from_stn_code || "",
          stationName: info.from_stn_name || "",
          scheduledArrival: info.from_time || "First",
          scheduledDeparture: info.from_time || "First",
          distance: 0,
          day: 1,
          delay: 0,
          status: "current",
        });

        if (info.to_stn_code && info.to_stn_name) {
          timeline.push({
            stationCode: info.to_stn_code,
            stationName: info.to_stn_name,
            scheduledArrival: info.to_time || "",
            scheduledDeparture: info.to_time || "Last",
            distance: parseInt(info.distance || "0"),
            day: info.running_days?.includes("1") ? 1 : 2,
            delay: 0,
            status: "upcoming",
          });
        }

        // Get train type for status note
        const trainType = info.train_type || "Train";
        const source = info.from_stn_name || "";
        const dest = info.to_stn_name || "";

        return {
          trainNo,
          trainName: info.train_name || "",
          date: journeyDate,
          statusNote: `Schedule data from erail.in — ${trainType} ${trainNo} from ${source} to ${dest}`,
          lastUpdate: new Date().toISOString(),
          currentStationCode: info.from_stn_code || "",
          currentStationName: info.from_stn_name || "",
          delay: 0,
          totalStations: timeline.length,
          timeline,
        };
      }

      // Step 3: Build timeline from route data
      const now = new Date();
      const rawTimeline: LiveStation[] = (routeStations || []).map((s) => ({
        stationCode: s.stnCode,
        stationName: s.stnName,
        scheduledArrival: s.arrival || "--",
        scheduledDeparture: s.departure || "--",
        distance: s.distance,
        day: s.day || 1,
        platform: s.zone || undefined,
        delay: 0,
        status: "upcoming" as const,
      }));

      // Step 4: Compute station statuses based on time
      const { stations: timeline, currentCode, currentName } =
        computeStationStatuses(rawTimeline, now, journeyDate);

      // Step 5: Build status note
      const statusNote = timeline.some((s) => s.status === "current")
        ? `Last updated at ${now.toLocaleTimeString()} — schedule-based status from erail.in`
        : "Schedule data from erail.in";

      return {
        trainNo,
        trainName: info.train_name || "",
        date: journeyDate,
        statusNote,
        lastUpdate: now.toISOString(),
        currentStationCode: currentCode,
        currentStationName: currentName,
        delay: 0,
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
    if (msg === "NOT_FOUND") {
      return fail(ERROR_CODES.NOT_FOUND, `Train ${trainNo} not found`, false);
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
