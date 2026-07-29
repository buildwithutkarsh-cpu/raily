/* ══════════════════════════════════════════════════════════════
   RAPI — PNR Route
   ══════════════════════════════════════════════════════════════ */

import { Router, Request, Response } from "express";
import { getPNRStatus } from "../scrapers/pnrScraper";
import { success, apiError } from "../utils/response";
import type { ScrapeResult } from "../scrapers/client";

const router = Router();

function sendScrapeResult<T>(res: Response, result: ScrapeResult<T>, req: Request): Response {
  if (result.success) {
    return res.status(200).json(success(result.data, result.cached, req.requestId));
  }
  const status = result.retryable ? 502 : 404;
  return res.status(status).json(
    apiError(result.errorCode || "UPSTREAM_ERROR", result.errorMessage || "Unknown error", !!result.retryable, req.requestId)
  );
}

/**
 * GET /api/v1/pnr/:pnr
 * Get PNR status for a 10-digit PNR number.
 */
router.get("/:pnr", async (req: Request, res: Response) => {
  const pnr = req.params.pnr as string;

  if (!/^\d{10}$/.test(pnr)) {
    return res.status(400).json(
      apiError("INVALID_INPUT", "PNR must be exactly 10 digits", false, req.requestId)
    );
  }

  const result = await getPNRStatus(pnr);
  return sendScrapeResult(res, result, req);
});

export default router;