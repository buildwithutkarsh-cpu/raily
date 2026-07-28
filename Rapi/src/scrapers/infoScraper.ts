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

export interface RouteStation {
  stnCode: string;
  stnName: string;
  arrival: string;
  departure: string;
  distance: number;
  day: number;
  platform?: string;
  zone?: string;
}

export interface TrainInfoResponse {
  train_no: string;
  train_name: string;
  from_stn_name: string;
  from_stn_code: string;
  to_stn_name: string;
  to_stn_code: string;
  from_time: string;
  to_time: string;
  travel_time: string;
  running_days: string;
  type: string;
  distance: number;
  avg_speed: number;
  totalStops: number;
  route: RouteStation[];
}

export async function getTrainInfo(
  trainNumber: string
): Promise<ScrapeResult<TrainInfoResponse>> {
  // Validate
  if (!/^\d{4,5}$/.test(trainNumber)) {
    return fail("Train number must be 4-5 digits");
  }

  const cacheKey = `info:${trainNumber}`;

  return cache.getOrRefresh<TrainInfoResponse>(
    cacheKey,
    CONFIG.CACHE.ROUTE_TTL,
    async () => {
      // Step 1: Get train info
      const infoRaw = await scraperClient.get(
        SOURCES.TRAIN_INFO(trainNumber),
        "https://erail.in/"
      );

      const info = parseErailTrainInfo(infoRaw);
      if (!info) {
        throw new Error("NOT_FOUND");
      }

      // Step 2: Get route using train_id
      let route: RouteStation[] = [];
      if (info.train_id) {
        try {
          const routeRaw = await scraperClient.get(
            SOURCES.TRAIN_ROUTE(info.train_id),
            "https://erail.in/"
          );
          route = parseErailRoute(routeRaw).map((s: any) => ({
            ...s,
            platform: s.platform || undefined,
          }));
        } catch (routeErr: any) {
          console.warn(`[INFO] Failed to fetch route for train ${trainNumber}:`, routeErr.message);
        }
      }

      return {
        train_no: info.train_no,
        train_name: info.train_name,
        from_stn_name: info.from_stn_name,
        from_stn_code: info.from_stn_code,
        to_stn_name: info.to_stn_name,
        to_stn_code: info.to_stn_code,
        from_time: info.from_time,
        to_time: info.to_time,
        travel_time: info.travel_time,
        running_days: info.running_days,
        type: info.train_type || "",
        distance: parseInt(info.distance || "0"),
        avg_speed: parseInt(info.avg_speed || "0"),
        totalStops: route.length,
        route,
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
      return fail(ERROR_CODES.NOT_FOUND, `Train ${trainNumber} not found on erail.in`, false);
    }
    if (msg.includes("timeout") || msg.includes("TIMEOUT"))
      return fail(ERROR_CODES.TIMEOUT, msg, true);
    if (msg.includes("ECONNREFUSED") || msg.includes("ENOTFOUND"))
      return fail(ERROR_CODES.UPSTREAM_UNREACHABLE, msg, true);
    if (msg.includes("5") && msg.includes("HTTP"))
      return fail(ERROR_CODES.UPSTREAM_ERROR, msg, true);
    return fail(ERROR_CODES.UPSTREAM_ERROR, msg, true);
  });
}
