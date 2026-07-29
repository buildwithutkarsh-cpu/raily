/* ══════════════════════════════════════════════════════════════
   RAPI — Train Routes
   ══════════════════════════════════════════════════════════════ */

import { Router, Request, Response } from "express";
import { searchTrains } from "../scrapers/searchScraper";
import { getLiveStatus } from "../scrapers/liveStatusScraper";
import { getTrainInfo } from "../scrapers/infoScraper";
import { getAvailability, getFare } from "../scrapers/availabilityScraper";
import { success, apiError } from "../utils/response";
import type { ScrapeResult } from "../scrapers/client";

const router = Router();

const TRAIN_NUMBER_REGEX = /^\d{4,5}$/;
const STATION_CODE_REGEX = /^[A-Za-z]{2,5}$/;
const DATE_REGEX = /^\d{2}-\d{2}-\d{4}$/;

function sendScrapeResult<T>(res: Response, result: ScrapeResult<T>, req: Request): Response {
  if (result.success) {
    return res.status(200).json(success(result.data, result.cached, req.requestId));
  }
  const status = result.retryable ? 502 : 400;
  return res.status(status).json(
    apiError(result.errorCode || "UPSTREAM_ERROR", result.errorMessage || "Unknown error", !!result.retryable, req.requestId)
  );
}

/**
 * GET /api/v1/trains/search?from=NDLS&to=BCT&date=DD-MM-YYYY
 */
router.get("/search", async (req: Request, res: Response) => {
  const from = (req.query.from as string || "").toUpperCase().trim();
  const to = (req.query.to as string || "").toUpperCase().trim();
  const date = req.query.date as string | undefined;

  if (!from || !to) {
    return res.status(400).json(apiError("INVALID_INPUT", "Missing required query parameters: from, to", false, req.requestId));
  }
  if (!STATION_CODE_REGEX.test(from) || !STATION_CODE_REGEX.test(to)) {
    return res.status(400).json(apiError("INVALID_INPUT", "Invalid station codes. Use 2-5 letter codes like NDLS, BCT", false, req.requestId));
  }

  const result = await searchTrains(from, to, date);
  return sendScrapeResult(res, result, req);
});

/**
 * GET /api/v1/trains/:trainNumber/live?date=DD-MM-YYYY
 */
router.get("/:trainNumber/live", async (req: Request, res: Response) => {
  const trainNumber = req.params.trainNumber as string;
  const date = req.query.date as string | undefined;

  if (!TRAIN_NUMBER_REGEX.test(trainNumber)) {
    return res.status(400).json(apiError("INVALID_INPUT", "Train number must be 4-5 digits", false, req.requestId));
  }
  if (date && !DATE_REGEX.test(date)) {
    return res.status(400).json(apiError("INVALID_INPUT", "Date must be in DD-MM-YYYY format", false, req.requestId));
  }

  const result = await getLiveStatus(trainNumber, date);
  return sendScrapeResult(res, result, req);
});

/**
 * GET /api/v1/trains/:trainNumber/info
 */
router.get("/:trainNumber/info", async (req: Request, res: Response) => {
  const trainNumber = req.params.trainNumber as string;

  if (!TRAIN_NUMBER_REGEX.test(trainNumber)) {
    return res.status(400).json(apiError("INVALID_INPUT", "Train number must be 4-5 digits", false, req.requestId));
  }

  const result = await getTrainInfo(trainNumber);
  return sendScrapeResult(res, result, req);
});

/**
 * GET /api/v1/trains/:trainNumber/availability
 */
router.get("/:trainNumber/availability", async (req: Request, res: Response) => {
  const trainNumber = req.params.trainNumber as string;
  const from = (req.query.from as string || "").toUpperCase().trim();
  const to = (req.query.to as string || "").toUpperCase().trim();
  const date = req.query.date as string | undefined;
  const quota = (req.query.quota as string || "GN").toUpperCase();

  if (!TRAIN_NUMBER_REGEX.test(trainNumber)) {
    return res.status(400).json(apiError("INVALID_INPUT", "Train number must be 4-5 digits", false, req.requestId));
  }
  if (!from || !to) {
    return res.status(400).json(apiError("INVALID_INPUT", "Missing required query parameters: from, to", false, req.requestId));
  }
  if (!STATION_CODE_REGEX.test(from) || !STATION_CODE_REGEX.test(to)) {
    return res.status(400).json(apiError("INVALID_INPUT", "Invalid station codes. Use 2-5 letter codes like NDLS, BCT", false, req.requestId));
  }
  if (!date || !DATE_REGEX.test(date)) {
    return res.status(400).json(apiError("INVALID_INPUT", "Missing or invalid date. Use DD-MM-YYYY format", false, req.requestId));
  }

  const result = await getAvailability(trainNumber, from, to, date, quota);
  return sendScrapeResult(res, result, req);
});

/**
 * GET /api/v1/trains/:trainNumber/fare
 */
router.get("/:trainNumber/fare", async (req: Request, res: Response) => {
  const trainNumber = req.params.trainNumber as string;
  const from = (req.query.from as string || "").toUpperCase().trim();
  const to = (req.query.to as string || "").toUpperCase().trim();
  const date = req.query.date as string | undefined;
  const quota = (req.query.quota as string || "GN").toUpperCase();

  if (!TRAIN_NUMBER_REGEX.test(trainNumber)) {
    return res.status(400).json(apiError("INVALID_INPUT", "Train number must be 4-5 digits", false, req.requestId));
  }
  if (!from || !to) {
    return res.status(400).json(apiError("INVALID_INPUT", "Missing required query parameters: from, to", false, req.requestId));
  }
  if (!date || !DATE_REGEX.test(date)) {
    return res.status(400).json(apiError("INVALID_INPUT", "Missing or invalid date. Use DD-MM-YYYY format", false, req.requestId));
  }

  const result = await getFare(trainNumber, from, to, date, quota);
  return sendScrapeResult(res, result, req);
});

export default router;