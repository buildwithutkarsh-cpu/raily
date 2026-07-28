/* ══════════════════════════════════════════════════════════════
   RAPI — Admin Routes (Cache Monitoring & Management)
   
   Provides visibility into the cache layer's effectiveness:
     - Cache hit/miss/stale ratios
     - Key count and utilization
     - Background refresh activity
     - Manual flush for emergencies (requires ADMIN_KEY env var)
   ══════════════════════════════════════════════════════════════ */

import { Router, Request, Response } from "express";
import { cache } from "../cache";

const router = Router();

/**
 * GET /api/v1/admin/cache
 * Returns cache telemetry: hit/miss rates, key count, utilization.
 */
router.get("/cache", (_req: Request, res: Response) => {
  const telemetry = cache.getTelemetry();
  const total = telemetry.hits + telemetry.misses + telemetry.staleHits;

  return res.json({
    success: true,
    data: {
      ...telemetry,
      hitRate: total > 0 ? Math.round((telemetry.hits / total) * 10000) / 100 : 0,
      staleHitRate: total > 0 ? Math.round((telemetry.staleHits / total) * 10000) / 100 : 0,
      missRate: total > 0 ? Math.round((telemetry.misses / total) * 10000) / 100 : 0,
      totalRequests: total,
    },
    cached: false,
  });
});

/**
 * POST /api/v1/admin/cache/flush
 * Clears all cached entries. Requires ADMIN_KEY env var.
 * Returns 401 if ADMIN_KEY is not set or doesn't match.
 */
router.post("/cache/flush", (req: Request, res: Response) => {
  const adminKey = process.env.ADMIN_KEY;
  if (!adminKey) {
    return res.status(501).json({
      success: false,
      error: "ADMIN_KEY environment variable not configured. Set it to enable cache flush.",
    });
  }

  const providedKey = req.headers["x-admin-key"] as string | undefined;
  if (providedKey !== adminKey) {
    return res.status(401).json({
      success: false,
      error: "Invalid or missing admin key. Set x-admin-key header.",
    });
  }

  cache.flush();
  return res.json({
    success: true,
    data: { message: "Cache flushed successfully" },
    cached: false,
  });
});

/**
 * GET /api/v1/admin/health
 * Simple health check with cache status.
 */
router.get("/health", (_req: Request, res: Response) => {
  const telemetry = cache.getTelemetry();

  return res.json({
    success: true,
    data: {
      status: "healthy",
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      cache: {
        keys: telemetry.keys,
        maxKeys: telemetry.maxKeys,
        utilizationPercent: telemetry.utilizationPercent,
        hitRate: telemetry.hits > 0
          ? Math.round((telemetry.hits / (telemetry.hits + telemetry.misses)) * 10000) / 100
          : 0,
      },
    },
    cached: false,
  });
});

export default router;
