/* ══════════════════════════════════════════════════════════════
   RAPI — PNR Status Scraper
   Source: Indian Railways Official Enquiry Portal
   ══════════════════════════════════════════════════════════════ */

import axios, { AxiosInstance } from "axios";
import { wrapper } from "axios-cookiejar-support";
import { CookieJar } from "tough-cookie";
import { createWorker, Worker } from "tesseract.js";
import Jimp from "jimp";
import { ScrapeResult, ok, cachedRes, fail } from "./client";
import { ERROR_CODES } from "../utils/errors";
import { cache } from "../cache";
import { CONFIG } from "../config";
import type { PNRResponse, PassengerInfo } from "../types";

/* ─── Configuration ───────────────────────────────────────── */

const IR_BASE = "https://www.indianrail.gov.in";
const IR_CAPTCHA_URL = `${IR_BASE}/enquiry/captchaDraw.png`;
const IR_PNR_URL = `${IR_BASE}/enquiry/CommonCaptcha`;

/* ─── IR Session Client ───────────────────────────────────── */

let irCookieJar: CookieJar | null = null;
let irClient: AxiosInstance | null = null;

function resetIRSession(): void {
  irCookieJar = null;
  irClient = null;
}

function getIRClient(): AxiosInstance {
  if (!irClient) {
    irCookieJar = new CookieJar();
    irClient = wrapper(
      axios.create({
        timeout: 15_000,
        maxRedirects: 5,
        validateStatus: (status: number) => status < 500,
        withCredentials: true,
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
          Accept:
            "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.5",
        },
      })
    );
    const clientWithJar = irClient as unknown as Record<string, unknown>;
    clientWithJar.jar = irCookieJar;
    clientWithJar.withCredentials = true;
  }
  return irClient;
}

/* ─── Singleton Tesseract Worker ──────────────────────────── */

let tessWorker: Worker | null = null;

async function getTessWorker(): Promise<Worker> {
  if (!tessWorker) {
    tessWorker = await createWorker("eng", 1, {
      logger: () => {},
    });
  }
  return tessWorker;
}

interface CaptchaParseResult {
  result: number;
  raw: string;
}

/**
 * Fetch the Indian Railways CAPTCHA image and solve it.
 * The captcha is a simple math expression like "5+3=" or "9-4=".
 */
async function solveCaptcha(): Promise<CaptchaParseResult> {
  const client = getIRClient();
  const ts = Date.now();

  const imgResp = await client.get(`${IR_CAPTCHA_URL}?${ts}`, {
    responseType: "arraybuffer",
    headers: {
      Accept: "image/png,image/*;q=0.9,*/*;q=0.8",
      Referer: `${IR_BASE}/enquiry/PNRStatus.html`,
    },
  });

  const imgBuffer = Buffer.from(imgResp.data);

  let processedBuffer: Buffer;
  try {
    const image = await Jimp.read(imgBuffer);
    processedBuffer = await image
      .greyscale()
      .contrast(0.5)
      .normalize()
      .scale(2)
      .getBufferAsync(Jimp.MIME_PNG);
  } catch {
    processedBuffer = imgBuffer;
  }

  const worker = await getTessWorker();
  const { data } = await worker.recognize(processedBuffer);
  const text = data.text?.trim() || "";

  if (!text) {
    throw new Error("CAPTCHA_OCR_EMPTY");
  }

  const cleanText = text.replace(/\s/g, "").replace(/[=:]/g, "");

  let result = 0;
  let extracted = false;

  if (cleanText.includes("+")) {
    const parts = cleanText.split("+");
    const a = parseInt(parts[0]?.replace(/\D/g, ""));
    const b = parseInt(parts[1]?.replace(/\D/g, ""));
    if (!isNaN(a) && !isNaN(b)) {
      result = a + b;
      extracted = true;
    }
  } else if (cleanText.includes("-")) {
    const parts = cleanText.split("-");
    const a = parseInt(parts[0]?.replace(/\D/g, ""));
    const b = parseInt(parts[1]?.replace(/\D/g, ""));
    if (!isNaN(a) && !isNaN(b)) {
      result = a - b;
      extracted = true;
    }
  }

  if (!extracted) {
    throw new Error(`CAPTCHA_OCR_FAILED: raw="${cleanText}"`);
  }

  return { result, raw: cleanText };
}

interface IRRawResponse {
  errorMessage?: string;
  result?: Record<string, unknown>;
}

/**
 * Parse the Indian Railways PNR response JSON into our PNRResponse format.
 */
function parseIRResponse(data: IRRawResponse, pnr: string): PNRResponse | null {
  if (!data || data.errorMessage || !data.result) {
    return null;
  }

  const r = data.result;

  const passengers: PassengerInfo[] = [];

  const passengerKeys = Object.keys(r).filter((k) =>
    k.toLowerCase().startsWith("passenger")
  );

  if (passengerKeys.length > 0) {
    passengerKeys.forEach((key, idx) => {
      const p = r[key] as Record<string, string> | undefined;
      if (!p) return;

      const bookingStatus = p.booking_status || p.bookingStatus || "";
      const currentStatus = p.current_status || p.currentStatus || "";

      const parseCoachBerth = (status: string): { coach: string | null; berthNo: number | null } => {
        const match = status.match(/([A-Z]+\d+)\s+(\d+)/);
        return {
          coach: match ? match[1] : null,
          berthNo: match ? parseInt(match[2]) : null,
        };
      };

      const bookingInfo = parseCoachBerth(bookingStatus);
      const currentInfo = parseCoachBerth(currentStatus);

      passengers.push({
        serialNumber: `${idx + 1}`,
        coachPosition: parseInt(p.coach_position || p.coachPosition || "0"),
        booking: {
          status: bookingStatus,
          coach: bookingInfo.coach,
          berthNo: bookingInfo.berthNo,
          berthCode: null,
          details: bookingStatus,
        },
        current: {
          status: currentStatus,
          coach: currentInfo.coach,
          berthNo: currentInfo.berthNo,
          berthCode: null,
          details: currentStatus,
        },
      });
    });
  }

  const doj = (r.doj || r.date_of_journey || r.journey_date || "") as string;

  return {
    pnr,
    train: {
      number: (r.train_no || r.trainno || r.train_number || "") as string,
      name: (r.train_name || r.name || r.trainName || "") as string,
    },
    journey: {
      date: doj,
      class: (r.class || r.travel_class || r.travelClass || "") as string,
      quota: (r.quota || r.quota_code || r.quotaCode || "GN") as string,
      source: {
        code: (r.from_stn || r.fromStn || r.source_station || r.from || "") as string,
        name: (r.from_stn_name || r.fromStnName || r.source_station_name || "") as string,
      },
      destination: {
        code: (r.to_stn || r.toStn || r.dest_station || r.to || "") as string,
        name: (r.to_stn_name || r.toStnName || r.dest_station_name || "") as string,
      },
      boardingPoint: {
        code: (r.boarding_point || r.boardingPoint || r.from_stn || r.from || "") as string,
        name: (r.boarding_point_name || r.boardingPointName || "") as string,
      },
      distance: parseInt((r.distance || "0") as string),
    },
    chart: {
      status: (r.chart || r.chart_status || r.chartStatus || "NOT PREPARED") as string,
      prepared: ((r.chart || r.chart_status || r.chartStatus || "") as string).toUpperCase().includes("PREPARED"),
    },
    booking: {
      fare: parseInt((r.fare || r.total_fare || r.totalFare || "0") as string),
      ticketFare: parseInt((r.ticket_fare || r.ticketFare || "0") as string),
      bookingDate: (r.booking_date || r.bookingDate || "") as string,
    },
    passengers,
  };
}

/* ─── Main Scraper Function ───────────────────────────────── */

export async function getPNRStatus(
  pnr: string
): Promise<ScrapeResult<PNRResponse>> {
  if (!/^\d{10}$/.test(pnr)) {
    return fail(ERROR_CODES.INVALID_INPUT, "PNR must be exactly 10 digits");
  }

  const cacheKey = `pnr:${pnr}`;

  return cache
    .getOrRefresh<PNRResponse>(
      cacheKey,
      CONFIG.CACHE.PNR_TTL,
      async () => {
        let captchaSolution: string;
        try {
          const result = await solveCaptcha();
          captchaSolution = String(result.result);
        } catch (err: unknown) {
          resetIRSession();
          const msg = err instanceof Error ? err.message : "Unknown error";
          throw new Error(`CAPTCHA_SOLVE_FAILED: ${msg}`);
        }

        const ts = Date.now();
        const client = getIRClient();
        let resp;
        try {
          resp = await client.get(IR_PNR_URL, {
            params: {
              inputPnrNo: pnr,
              inputPage: "PNR",
              language: "en",
              inputCaptcha: captchaSolution,
              _: ts,
            },
            headers: {
              Referer: `${IR_BASE}/enquiry/PNRStatus.html`,
              Accept: "application/json, text/plain, */*",
            },
          });
        } catch (err: unknown) {
          resetIRSession();
          const msg = err instanceof Error ? err.message : "Unknown error";
          throw new Error(`UPSTREAM_ERROR: ${msg}`);
        }

        const data = resp.data as IRRawResponse;

        if (data?.errorMessage) {
          if (
            data.errorMessage.includes("Session") ||
            data.errorMessage.includes("CAPTCHA") ||
            data.errorMessage.includes("Invalid")
          ) {
            resetIRSession();
            try {
              const retryCaptcha = await solveCaptcha();
              const retryResp = await client.get(IR_PNR_URL, {
                params: {
                  inputPnrNo: pnr,
                  inputPage: "PNR",
                  language: "en",
                  inputCaptcha: String(retryCaptcha.result),
                  _: Date.now(),
                },
                headers: {
                  Referer: `${IR_BASE}/enquiry/PNRStatus.html`,
                  Accept: "application/json, text/plain, */*",
                },
              });
              const retryData = retryResp.data as IRRawResponse;
              if (retryData?.errorMessage) {
                throw new Error(`UPSTREAM_ERROR: ${retryData.errorMessage}`);
              }
              const parsed = parseIRResponse(retryData, pnr);
              if (!parsed || !parsed.train.number) {
                throw new Error("PARSE_FAILURE");
              }
              return parsed;
            } catch (retryErr: unknown) {
              const msg = retryErr instanceof Error ? retryErr.message : "Retry failed";
              throw new Error(`UPSTREAM_ERROR: ${msg}`);
            }
          }
          throw new Error(`UPSTREAM_ERROR: ${data.errorMessage}`);
        }

        const parsed = parseIRResponse(data, pnr);
        if (!parsed || !parsed.train.number) {
          throw new Error("PARSE_FAILURE");
        }

        return parsed;
      }
    )
    .then(({ data, cached: isCached }) =>
      isCached ? cachedRes(data) : ok(data)
    )
    .catch((err: unknown) => {
      const msg = err instanceof Error ? err.message : "Unknown error";

      if (msg.includes("CAPTCHA_SOLVE_FAILED")) {
        return fail(ERROR_CODES.UPSTREAM_ERROR, `Failed to solve IR captcha`, true);
      }
      if (msg.includes("CAPTCHA_OCR_EMPTY")) {
        return fail(ERROR_CODES.UPSTREAM_ERROR, "IR captcha image returned empty", true);
      }
      if (msg.includes("CAPTCHA_OCR_FAILED")) {
        return fail(ERROR_CODES.UPSTREAM_ERROR, "IR captcha OCR could not parse math expression", true);
      }
      if (msg.includes("UPSTREAM_ERROR")) {
        return fail(ERROR_CODES.UPSTREAM_ERROR, msg.replace("UPSTREAM_ERROR: ", ""), true);
      }
      if (msg.includes("timeout") || msg.includes("TIMEOUT")) {
        return fail(ERROR_CODES.TIMEOUT, msg, true);
      }
      if (msg.includes("ECONNREFUSED") || msg.includes("ENOTFOUND")) {
        return fail(ERROR_CODES.UPSTREAM_UNREACHABLE, msg, true);
      }
      if (msg.includes("429") || msg.includes("Too Many Requests")) {
        return fail(ERROR_CODES.UPSTREAM_RATE_LIMIT, msg, true);
      }
      if (msg === "PARSE_FAILURE") {
        return fail(ERROR_CODES.PARSE_FAILURE, "Failed to parse PNR data — response format may have changed", true);
      }
      return fail(ERROR_CODES.UPSTREAM_ERROR, msg, true);
    });
}