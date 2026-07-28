/* ══════════════════════════════════════════════════════════════
   RAPI — Station Autocomplete Route
   100% local, 0ms network latency
   ══════════════════════════════════════════════════════════════ */

import { Router, Request, Response } from "express";
import stations from "../data/stations.json";

const router = Router();

/**
 * GET /api/v1/stations/autocomplete?q=DEL
 * Fast local fuzzy search against bundled stations.json
 */
router.get("/autocomplete", (req: Request, res: Response) => {
  const query = ((req.query.q as string) || "").toLowerCase().trim();

  if (!query || query.length < 1) {
    return res.json({
      success: true,
      data: {
        total: 0,
        stations: [],
      },
      cached: true,
    });
  }

  // Filter stations by code or name match
  const results = stations
    .filter(
      (s: any) =>
        s.code.toLowerCase().includes(query) ||
        s.name.toLowerCase().includes(query) ||
        (s.state && s.state.toLowerCase().includes(query))
    )
    .slice(0, 20)
    .map((s: any) => ({
      code: s.code,
      name: s.name,
      state: s.state || "",
      zone: s.zone || "",
    }));

  return res.json({
    success: true,
    data: {
      query,
      total: results.length,
      stations: results,
    },
    cached: true,
  });
});

export default router;
