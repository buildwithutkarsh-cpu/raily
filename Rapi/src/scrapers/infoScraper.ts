/* ══════════════════════════════════════════════════════════════
   RAPI — Train Info / Route Scraper
   Sources: erail.in (train info + route data)
   ══════════════════════════════════════════════════════════════ */

import { scraperClient, ok, cachedRes, fail } from "./client";
import { ERROR_CODES } from "../utils/errors";
import type { ScrapeResult } from "./client";
import { cache } from "../cache";
import { SOURCES, CONFIG } from "../config";
import { parseErailTrainInfo, parseErailRoute } from "../utils/parser";
import type { TrainInfoResponse, RouteStation } from "../types";

export async function getTrainInfo(
  trainNumber: string
): Promise<ScrapeResult<TrainInfoResponse>> {
  if (!/^\d{4,5}$/.test(trainNumber)) {
    return fail(ERROR_CODES.INVALID_INPUT, "Train number must be 4-5 digits");
  }

  const cacheKey = `info:${trainNumber}`;

  return cache
    .getOrRefresh<TrainInfoResponse>(
      cacheKey,
      CONFIG.CACHE.ROUTE_TTL,
      async () => {
        const infoRaw = await scraperClient.get(
          SOURCES.TRAIN_INFO(trainNumber),
          "https://erail.in/"
        );

        const info = parseErailTrainInfo(infoRaw);
        if (!info) {
          throw new Error("NOT_FOUND");
        }

        let route: RouteStation[] = [];
        if (info.train_id) {
          try {
            const routeRaw = await scraperClient.get(
              SOURCES.TRAIN_ROUTE(info.train_id),
              "https://erail.in/"
            );
            route = parseErailRoute(routeRaw).map((s) => ({
              stationCode: s.stnCode,
              stationName: s.stnName,
              arrival: s.arrival,
              departure: s.departure,
              distance: s.distance,
              day: s.day,
              platform: s.zone || undefined,
            }));
          } catch (routeErr: unknown) {
            const msg = routeErr instanceof Error ? routeErr.message : String(routeErr);
            console.warn(`[INFO] Failed to fetch route for train ${trainNumber}: ${msg}`);
          }
        }

        return {
          trainNumber: info.train_no,
          trainName: info.train_name,
          fromStationName: info.from_stn_name,
          fromStationCode: info.from_stn_code,
          toStationName: info.to_stn_name,
          toStationCode: info.to_stn_code,
          fromTime: info.from_time,
          toTime: info.to_time,
          travelTime: info.travel_time,
          runningDays: info.running_days,
          type: info.train_type || "",
          distance: parseInt(info.distance || "0"),
          averageSpeed: parseInt(info.avg_speed || "0"),
          totalStops: route.length,
          route,
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
        return fail(ERROR_CODES.NOT_FOUND, `Train ${trainNumber} not found`, false);
      }
      if (msg.includes("timeout") || msg.includes("TIMEOUT"))
        return fail(ERROR_CODES.TIMEOUT, msg, true);
      if (msg.includes("ECONNREFUSED") || msg.includes("ENOTFOUND"))
        return fail(ERROR_CODES.UPSTREAM_UNREACHABLE, msg, true);
      return fail(ERROR_CODES.UPSTREAM_ERROR, msg, true);
    });
}