/* ══════════════════════════════════════════════════════════════
   RAPI — Live Train Status Scraper
   Source: erail.in (pipe-delimited train info + route data)
   ══════════════════════════════════════════════════════════════ */

import { scraperClient, ScrapeResult, ok, cachedRes, fail } from "./client";
import { ERROR_CODES } from "../utils/errors";
import { cache } from "../cache";
import { SOURCES, CONFIG } from "../config";
import { parseErailTrainInfo, parseErailRoute } from "../utils/parser";
import type { LiveStation, LiveStatusResponse } from "../types";

/* ─── Helpers ──────────────────────────────────────────────── */

function getTodayDate(): string {
  const d = new Date();
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}-${mm}-${yyyy}`;
}

function timeToMinutes(timeStr: string): number {
  if (!timeStr || timeStr === "--" || timeStr === "First" || timeStr === "Last") return -1;
  const match = timeStr.match(/(\d{1,2})[.:](\d{2})/);
  if (!match) return -1;
  return parseInt(match[1]) * 60 + parseInt(match[2]);
}

function computeStationStatuses(
  stations: LiveStation[],
  now: Date,
  journeyDate: string
): { stations: LiveStation[]; currentCode: string; currentName: string } {
  if (stations.length === 0) {
    return { stations: [], currentCode: "", currentName: "" };
  }

  const [dd, mm, yyyy] = journeyDate.split("-").map(Number);
  const journeyStart = new Date(yyyy, mm - 1, dd);
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const msPerDay = 1000 * 60 * 60 * 24;
  const daysElapsed = Math.floor((now.getTime() - journeyStart.getTime()) / msPerDay);

  let currentCode = "";
  let currentName = "";
  let lastPassedIndex = -1;

  const result = stations.map((station, index) => {
    const dep = timeToMinutes(station.scheduledDeparture);
    let status: "passed" | "current" | "upcoming" = "upcoming";

    if (station.day <= daysElapsed && station.scheduledDeparture !== "Last") {
      status = "passed";
      if (index > lastPassedIndex) {
        lastPassedIndex = index;
        currentCode = station.stationCode;
        currentName = station.stationName;
      }
    } else if (station.day === daysElapsed + 1) {
      if (dep >= 0 && dep < nowMinutes) {
        status = "passed";
        if (index > lastPassedIndex) {
          lastPassedIndex = index;
          currentCode = station.stationCode;
          currentName = station.stationName;
        }
      } else if (dep >= 0 && dep <= nowMinutes + 30) {
        status = "current";
        currentCode = station.stationCode;
        currentName = station.stationName;
      }
    }
    return { ...station, status };
  });

  if (lastPassedIndex === -1 && result.length > 0) {
    result[0].status = "current";
    currentCode = result[0].stationCode;
    currentName = result[0].stationName;
  }

  if (!currentCode && lastPassedIndex >= 0) {
    result[lastPassedIndex].status = "current";
    currentCode = result[lastPassedIndex].stationCode;
    currentName = result[lastPassedIndex].stationName;
  }

  return { stations: result, currentCode, currentName };
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

  return cache
    .getOrRefresh<LiveStatusResponse>(
      cacheKey,
      CONFIG.CACHE.LIVE_TTL,
      async () => {
        const infoRaw = await scraperClient.get(
          SOURCES.TRAIN_INFO(trainNo),
          "https://erail.in/"
        );

        const info = parseErailTrainInfo(infoRaw);
        if (!info) {
          throw new Error("NOT_FOUND");
        }

        let routeRaw: Array<{ stnCode: string; stnName: string; arrival: string; departure: string; distance: number; day: number; zone: string }> = [];

        if (info.train_id) {
          try {
            const routeData = await scraperClient.get(
              SOURCES.TRAIN_ROUTE(info.train_id),
              "https://erail.in/"
            );
            routeRaw = parseErailRoute(routeData);
          } catch (routeErr: unknown) {
            const msg = routeErr instanceof Error ? routeErr.message : String(routeErr);
            console.warn(`[LiveStatus] Failed to fetch route for train ${trainNo}: ${msg}`);
          }
        }

        if (routeRaw.length === 0) {
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

          const trainType = info.train_type || "Train";
          const source = info.from_stn_name || "";
          const dest = info.to_stn_name || "";

          return {
            trainNumber: trainNo,
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

        const now = new Date();
        const rawTimeline: LiveStation[] = routeRaw.map((s) => ({
          stationCode: s.stnCode,
          stationName: s.stnName,
          scheduledArrival: s.arrival || "--",
          scheduledDeparture: s.departure || "--",
          distance: s.distance,
          day: s.day || 1,
          platform: undefined,
          delay: 0,
          status: "upcoming" as const,
        }));

        const { stations: timeline, currentCode, currentName } =
          computeStationStatuses(rawTimeline, now, journeyDate);

        const statusNote = timeline.some((s) => s.status === "current")
          ? `Last updated at ${now.toLocaleTimeString()} — schedule-based status from erail.in`
          : "Schedule data from erail.in";

        return {
          trainNumber: trainNo,
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
    .catch((err: unknown) => {
      const msg = err instanceof Error ? err.message : "Unknown error";
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