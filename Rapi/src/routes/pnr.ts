/* ══════════════════════════════════════════════════════════════
   RAPI — PNR Route
   ══════════════════════════════════════════════════════════════ */

import { Router, Request, Response } from "express";
import { getPNRStatus } from "../scrapers/pnrScraper";

const router = Router();

/**
 * GET /api/v1/pnr/:pnr
 * Get PNR status for a 10-digit PNR number.
 * Uses cheerio DOM parsing with CSS selector fallbacks.
 */
router.get("/:pnr", async (req: Request, res: Response) => {
  const pnr = req.params.pnr as string;

  if (!/^\d{10}$/.test(pnr)) {
    return res.status(400).json({
      success: false,
      error: "PNR must be exactly 10 digits",
    });
  }

  const result = await getPNRStatus(pnr);
  const status = result.success ? 200 : (result.retryable ? 502 : 404);
  return res.status(status).json(result);
});

export default router;
