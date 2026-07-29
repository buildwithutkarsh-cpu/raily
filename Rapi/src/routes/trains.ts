/* ══════════════════════════════════════════════════════════════
   RAPI — Train Routes
   ══════════════════════════════════════════════════════════════ */

import { Router, Request, Response } from "express";
import { searchTrains } from "../scrapers/searchScraper";
import { getLiveStatus } from "../scrapers/liveStatusScraper";
import { getTrainInfo } from "../scrapers/infoScraper";
import { getAvailability, getFare } from "../scrapers/availabilityScraper";

const router = Router();

/**
 * GET /api/v1/trains/search?from=NDLS&to=BCT&date=29-07-2026
 * Search for trains between two stations.
 * 
 * The date parameter is optional and passed along for cache key
 * granularity. The underlying scraper returns all trains on a
 * route; date-based running-day filtering is done client-side.
 */
router.get("/search", async (req: Request, res: Response) => {
  const from = req.query.from as string | undefined;
  const to = req.query.to as string | undefined;
  const date = req.query.date as string | undefined;

  if (!from || !to) {
    return res.status(400).json({
      success: false,
      error: "Missing required query parameters: from, to",
    });
  }

  const result = await searchTrains(from, to, date);
  return res.status(result.success ? 200 : 400).json(result);
});

/**
 * GET /api/v1/trains/:trainNumber/live?date=DD-MM-YYYY
 * Get live running status of a train.
 */
router.get("/:trainNumber/live", async (req: Request, res: Response) => {
  const trainNumber = req.params.trainNumber as string;
  const date = req.query.date as string | undefined;

  if (!/^\d{4,5}$/.test(trainNumber)) {
    return res.status(400).json({
      success: false,
      error: "Train number must be 4-5 digits",
    });
  }

  // Validate date format if provided
  if (date && !/^\d{2}-\d{2}-\d{4}$/.test(date)) {
    return res.status(400).json({
      success: false,
      error: "Date must be in DD-MM-YYYY format",
    });
  }

  const result = await getLiveStatus(trainNumber, date);
  const status = result.success ? 200 : (result.retryable ? 502 : 404);
  return res.status(status).json(result);
});

/**
 * GET /api/v1/trains/:trainNumber/info
 * Get detailed train information including route timetable.
 */
router.get("/:trainNumber/info", async (req: Request, res: Response) => {
  const trainNumber = req.params.trainNumber as string;

  if (!/^\d{4,5}$/.test(trainNumber)) {
    return res.status(400).json({
      success: false,
      error: "Train number must be 4-5 digits",
    });
  }

  const result = await getTrainInfo(trainNumber);
  const status = result.success ? 200 : (result.retryable ? 502 : 404);
  return res.status(status).json(result);
});

/**
 * GET /api/v1/trains/:trainNumber/availability
 * Get seat availability with class-wise status.
 *
 * Query params:
 *   - from: Source station code (required, e.g. NDLS)
 *   - to: Destination station code (required, e.g. BCT)
 *   - date: Journey date in DD-MM-YYYY (required)
 *   - quota: Quota code (optional, default: GN)
 */
router.get("/:trainNumber/availability", async (req: Request, res: Response) => {
  const trainNumber = req.params.trainNumber as string;
  const from = req.query.from as string | undefined;
  const to = req.query.to as string | undefined;
  const date = req.query.date as string | undefined;
  const quota = (req.query.quota as string) || "GN";

  // Validate
  if (!/^\d{4,5}$/.test(trainNumber)) {
    return res.status(400).json({
      success: false,
      error: "Train number must be 4-5 digits",
    });
  }

  if (!from || !to) {
    return res.status(400).json({
      success: false,
      error: "Missing required query parameters: from, to",
    });
  }

  if (!/^[A-Za-z]{2,5}$/.test(from) || !/^[A-Za-z]{2,5}$/.test(to)) {
    return res.status(400).json({
      success: false,
      error: "Invalid station codes. Use 2-5 letter codes like NDLS, BCT",
    });
  }

  if (!date || !/^\d{2}-\d{2}-\d{4}$/.test(date)) {
    return res.status(400).json({
      success: false,
      error: "Missing or invalid date. Use DD-MM-YYYY format",
    });
  }

  const result = await getAvailability(trainNumber, from, to, date, quota);
  const status = result.success ? 200 : (result.retryable ? 502 : 400);
  return res.status(status).json(result);
});

/**
 * GET /api/v1/trains/:trainNumber/fare
 * Get fare details for a train between two stations.
 *
 * Query params:
 *   - from: Source station code (required)
 *   - to: Destination station code (required)
 *   - date: Journey date in DD-MM-YYYY (required)
 *   - quota: Quota code (optional, default: GN)
 */
router.get("/:trainNumber/fare", async (req: Request, res: Response) => {
  const trainNumber = req.params.trainNumber as string;
  const from = req.query.from as string | undefined;
  const to = req.query.to as string | undefined;
  const date = req.query.date as string | undefined;
  const quota = (req.query.quota as string) || "GN";

  if (!/^\d{4,5}$/.test(trainNumber)) {
    return res.status(400).json({
      success: false,
      error: "Train number must be 4-5 digits",
    });
  }

  if (!from || !to) {
    return res.status(400).json({
      success: false,
      error: "Missing required query parameters: from, to",
    });
  }

  if (!date || !/^\d{2}-\d{2}-\d{4}$/.test(date)) {
    return res.status(400).json({
      success: false,
      error: "Missing or invalid date. Use DD-MM-YYYY format",
    });
  }

  const result = await getFare(trainNumber, from, to, date, quota);
  const status = result.success ? 200 : (result.retryable ? 502 : 400);
  return res.status(status).json(result);
});

export default router;
