/* ══════════════════════════════════════════════════════════════
   RAPI — PNR Status Scraper
   
   Source: Indian Railways Official Enquiry Portal
   (https://www.indianrail.gov.in/enquiry/)
   
   Strategy:
     1. Get a session cookie from Indian Railways
     2. Download the CAPTCHA image (simple math: "5+3=" or "9-4=")
     3. OCR the CAPTCHA using tesseract.js (singleton worker)
     4. Solve the math problem
     5. Submit the PNR request with the captcha solution
     6. Parse the JSON response
   
   This is the same approach used by erail.in for PNR status.
   ══════════════════════════════════════════════════════════════ */

import axios, { AxiosInstance } from "axios";
import { wrapper } from "axios-cookiejar-support";
import { CookieJar } from "tough-cookie";
import { createWorker, Worker } from "tesseract.js";
import { ScrapeResult, ok, cachedRes, fail } from "./client";
import { ERROR_CODES } from "../utils/errors";
import { cache } from "../cache";
import { CONFIG } from "../config";

/* ─── Types ────────────────────────────────────────────────── */

export interface PassengerInfo {
  serialNumber: string;
  coachPosition: number;
  booking: {
    status: string;
    coach: string | null;
    berthNo: number | null;
    berthCode: string | null;
    details: string;
  };
  current: {
    status: string;
    coach: string | null;
    berthNo: number | null;
    berthCode: string | null;
    details: string;
  };
}

export interface PNRResponse {
  pnr: string;
  train: { number: string; name: string };
  journey: {
    date: string;
    class: string;
    quota: string;
    source: { code: string; name: string };
    destination: { code: string; name: string };
    boardingPoint: { code: string; name: string };
    distance: number;
  };
  chart: { status: string; prepared: boolean };
  booking: { fare: number; ticketFare: number; bookingDate: string };
  passengers: PassengerInfo[];
}

/* ─── IR Session Client ───────────────────────────────────── */

const IR_BASE = "https://www.indianrail.gov.in";
const IR_CAPTCHA_URL = `${IR_BASE}/enquiry/captchaDraw.png`;
const IR_PNR_URL = `${IR_BASE}/enquiry/CommonCaptcha`;

// Shared cookie jar + axios instance for the IR session
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
        validateStatus: (status) => status < 500,
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
    (irClient.defaults as any).jar = irCookieJar;
    (irClient.defaults as any).withCredentials = true;
  }
  return irClient;
}

/* ─── Singleton Tesseract Worker ──────────────────────────── */

let tessWorker: Worker | null = null;

async function getTessWorker(): Promise<Worker> {
  if (!tessWorker) {
    tessWorker = await createWorker("eng", 1, {
      logger: () => {}, // silence logs
    });
  }
  return tessWorker;
}

/**
 * Fetch the Indian Railways CAPTCHA image and solve it.
 * The captcha is a simple math expression like "5+3=" or "9-4=".
 * Returns the numerical result as a string.
 */
async function solveCaptcha(): Promise<string> {
  const client = getIRClient();
  const ts = Date.now();

  // 1. Initiate session by hitting the captcha endpoint
  const imgResp = await client.get(`${IR_CAPTCHA_URL}?${ts}`, {
    responseType: "arraybuffer",
    headers: {
      Accept: "image/png,image/*;q=0.9,*/*;q=0.8",
      Referer: `${IR_BASE}/enquiry/PNRStatus.html`,
    },
  });

  const imgBuffer = Buffer.from(imgResp.data);

  // 2. OCR the captcha image using tesseract.js (singleton worker)
  const worker = await getTessWorker();
  const { data } = await worker.recognize(imgBuffer);
  const text = data.text?.trim() || "";

  if (!text) {
    throw new Error("CAPTCHA_OCR_EMPTY");
  }

  // 3. Parse the math expression
  // Format is like "5+3=" or "9-4="
  // The = sign may or may not be there
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

  return String(result);
}

/**
 * Parse the Indian Railways PNR response JSON into our PNRResponse format.
 */
function parseIRResponse(data: any, pnr: string): PNRResponse | null {
  if (!data || data.errorMessage || !data.result) {
    return null;
  }

  const r = data.result;

  // Build passenger list from the passenger properties
  const passengers: PassengerInfo[] = [];
  
  // Indian Railways returns passengers as named properties: passenger1, passenger2, etc.
  const passengerKeys = Object.keys(r).filter((k) =>
    k.toLowerCase().startsWith("passenger")
  );

  if (passengerKeys.length > 0) {
    passengerKeys.forEach((key, idx) => {
      const p = r[key];
      if (!p) return;

      const bookingStatus = p.booking_status || p.bookingStatus || "";
      const currentStatus = p.current_status || p.currentStatus || "";

      // Parse coach and berth info from status strings
      // e.g., "B1 45, CNF" or "S5 032, WL 15"
      const parseCoachBerth = (status: string) => {
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

  // Extract journey date (DOJ)
  const doj = r.doj || r.date_of_journey || r.journey_date || "";

  return {
    pnr,
    train: {
      number: r.train_no || r.trainno || r.train_number || "",
      name: r.train_name || r.name || r.trainName || "",
    },
    journey: {
      date: doj,
      class: r.class || r.travel_class || r.travelClass || "",
      quota: r.quota || r.quota_code || r.quotaCode || "GN",
      source: {
        code: r.from_stn || r.fromStn || r.source_station || r.from || "",
        name: r.from_stn_name || r.fromStnName || r.source_station_name || "",
      },
      destination: {
        code: r.to_stn || r.toStn || r.dest_station || r.to || "",
        name: r.to_stn_name || r.toStnName || r.dest_station_name || "",
      },
      boardingPoint: {
        code:
          r.boarding_point || r.boardingPoint || r.from_stn || r.from || "",
        name: r.boarding_point_name || r.boardingPointName || "",
      },
      distance: parseInt(r.distance || "0"),
    },
    chart: {
      status: r.chart || r.chart_status || r.chartStatus || "NOT PREPARED",
      prepared: (
        r.chart || r.chart_status || r.chartStatus || ""
      ).toUpperCase().includes("PREPARED"),
    },
    booking: {
      fare: parseInt(r.fare || r.total_fare || r.totalFare || "0"),
      ticketFare: parseInt(r.ticket_fare || r.ticketFare || "0"),
      bookingDate: r.booking_date || r.bookingDate || "",
    },
    passengers,
  };
}

/* ─── Main Scraper Function ───────────────────────────────── */

export async function getPNRStatus(
  pnr: string
): Promise<ScrapeResult<PNRResponse>> {
  // Validate PNR format
  if (!/^\d{10}$/.test(pnr)) {
    return fail(
      ERROR_CODES.INVALID_INPUT,
      "PNR must be exactly 10 digits"
    );
  }

  const cacheKey = `pnr:${pnr}`;

  return cache
    .getOrRefresh<PNRResponse>(
      cacheKey,
      CONFIG.CACHE.PNR_TTL,
      async () => {
        // 1. Solve the CAPTCHA
        let captchaSolution: string;
        try {
          captchaSolution = await solveCaptcha();
        } catch (err: any) {
          // Reset session on captcha failure
          resetIRSession();
          throw new Error(
            `CAPTCHA_SOLVE_FAILED: ${err.message || "Could not solve captcha"}`
          );
        }

        const ts = Date.now();

        // 2. Make the PNR status request with the captcha solution
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
        } catch (err: any) {
          resetIRSession();
          throw new Error(
            `UPSTREAM_ERROR: ${err.message || "IR request failed"}`
          );
        }

        const data = resp.data;

        // 3. Handle error responses from IR API
        if (data?.errorMessage) {
          // Reset session on session/captcha errors
          if (
            data.errorMessage.includes("Session") ||
            data.errorMessage.includes("CAPTCHA") ||
            data.errorMessage.includes("Invalid")
          ) {
            resetIRSession();

            // Try once more with a fresh session + captcha
            try {
              const retryCaptcha = await solveCaptcha();
              const retryResp = await client.get(IR_PNR_URL, {
                params: {
                  inputPnrNo: pnr,
                  inputPage: "PNR",
                  language: "en",
                  inputCaptcha: retryCaptcha,
                  _: Date.now(),
                },
                headers: {
                  Referer: `${IR_BASE}/enquiry/PNRStatus.html`,
                  Accept: "application/json, text/plain, */*",
                },
              });
              const retryData = retryResp.data;
              if (retryData?.errorMessage) {
                throw new Error(
                  `UPSTREAM_ERROR: ${retryData.errorMessage}`
                );
              }
              const parsed = parseIRResponse(retryData, pnr);
              if (!parsed || !parsed.train.number) {
                throw new Error("PARSE_FAILURE");
              }
              return parsed;
            } catch (retryErr: any) {
              throw new Error(
                `UPSTREAM_ERROR: ${retryErr.message || "Retry also failed"}`
              );
            }
          }
          throw new Error(`UPSTREAM_ERROR: ${data.errorMessage}`);
        }

        // 4. Parse the response
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
    .catch((err: any) => {
      const msg = err.message || "Unknown error";

      if (msg.includes("CAPTCHA_SOLVE_FAILED")) {
        return fail(
          ERROR_CODES.UPSTREAM_ERROR,
          `Failed to solve IR captcha: ${msg.replace("CAPTCHA_SOLVE_FAILED: ", "")}`,
          true
        );
      }
      if (msg.includes("CAPTCHA_OCR_EMPTY")) {
        return fail(
          ERROR_CODES.UPSTREAM_ERROR,
          "IR captcha image returned empty — retrying with fresh session",
          true
        );
      }
      if (msg.includes("CAPTCHA_OCR_FAILED")) {
        return fail(
          ERROR_CODES.UPSTREAM_ERROR,
          `IR captcha OCR could not parse the math expression`,
          true
        );
      }
      if (msg.includes("UPSTREAM_ERROR")) {
        return fail(
          ERROR_CODES.UPSTREAM_ERROR,
          msg.replace("UPSTREAM_ERROR: ", ""),
          true
        );
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
        return fail(
          ERROR_CODES.PARSE_FAILURE,
          "Failed to parse PNR data from Indian Railways — response format may have changed",
          true
        );
      }
      return fail(ERROR_CODES.UPSTREAM_ERROR, msg, true);
    });
}
