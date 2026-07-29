/* ══════════════════════════════════════════════════════════════
   RAPI — Station Autocomplete Route
   100% local, 0ms network latency
   ══════════════════════════════════════════════════════════════ */

import { Router, Request, Response } from "express";
import stations from "../data/stations.json";
import { success, invalidInput } from "../utils/response";
import type { Station } from "../types";

const router = Router();

const MAX_QUERY_LENGTH = 100;

interface RawStation {
  code: string;
  name: string;
  state?: string;
  zone?: string;
}

/**
 * GET /api/v1/stations/autocomplete?q=DEL
 * Fast local fuzzy search against bundled stations.json
 * q parameter is limited to 100 characters to prevent amplification attacks.
 */
router.get("/autocomplete", (req: Request, res: Response) => {
  const rawQuery = (req.query.q as string) || "";
  const query = rawQuery.toLowerCase().trim().slice(0, MAX_QUERY_LENGTH);

  if (!query || query.length < 1) {
    return res.json(success({
      query,
      total: 0,
      stations: [] as Station[],
    }, false, req.requestId));
  }

  const results: Station[] = (stations as RawStation[])
    .filter(
      (s: RawStation) =>
        s.code.toLowerCase().includes(query) ||
        s.name.toLowerCase().includes(query) ||
        (s.state || "").toLowerCase().includes(query)
    )
    .slice(0, 20)
    .map((s: RawStation) => ({
      code: s.code,
      name: s.name,
      state: s.state || "",
      zone: s.zone || "",
    }));

  return res.json(success({
    query,
    total: results.length,
    stations: results,
  }, false, req.requestId));
});

export default router;