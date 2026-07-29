/* ══════════════════════════════════════════════════════════════
   RAPI — Admin Routes (Cache Monitoring & Management)
   ══════════════════════════════════════════════════════════════ */

import { Router, Request, Response } from "express";
import { cache } from "../cache";
import { success, apiError, buildCacheTelemetry } from "../utils/response";
import { CONFIG } from "../config";

const router = Router();

/**
 * GET /api/v1/admin/cache
 * Returns cache telemetry with consistent hit/miss/stale rates.
 */
router.get("/cache", (req: Request, res: Response) => {
  const telemetry = cache.getTelemetry();
  const cacheStats = buildCacheTelemetry(telemetry);

  return res.json(success(cacheStats, false, req.requestId));
});

/**
 * POST /api/v1/admin/cache/flush
 * Clears all cached entries. Requires ADMIN_KEY env var.
 */
router.post("/cache/flush", (req: Request, res: Response) => {
  const adminKey = CONFIG.ADMIN_KEY;
  if (!adminKey) {
    return res.status(501).json(
      apiError("NOT_CONFIGURED", "ADMIN_KEY environment variable not configured. Set it to enable cache flush.", false, req.requestId)
    );
  }

  const providedKey = req.headers["x-admin-key"] as string | undefined;
  if (providedKey !== adminKey) {
    return res.status(401).json(
      apiError("UNAUTHORIZED", "Invalid or missing admin key. Set x-admin-key header.", false, req.requestId)
    );
  }

  cache.flush();
  return res.json(success({ message: "Cache flushed successfully" }, false, req.requestId));
});

/**
 * GET /api/v1/admin/health
 * Health check with cache status using consistent hitRate formula.
 */
router.get("/health", (req: Request, res: Response) => {
  const telemetry = cache.getTelemetry();
  const total = telemetry.hits + telemetry.misses;
  const hitRate = total > 0 ? Math.round((telemetry.hits / total) * 10000) / 100 : 0;

  return res.json(success({
    status: "healthy" as const,
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    cache: {
      keys: telemetry.keys,
      maxKeys: telemetry.maxKeys,
      utilizationPercent: telemetry.maxKeys > 0
        ? Math.round((telemetry.keys / telemetry.maxKeys) * 10000) / 100
        : 0,
      hitRate,
    },
  }, false, req.requestId));
});

export default router;