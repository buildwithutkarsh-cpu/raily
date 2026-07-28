/* ══════════════════════════════════════════════════════════════
   RAPI — Scraper HTTP Session Layer
   
   Built on axios + axios-cookiejar-support + tough-cookie to
   handle multi-step session cookies and handshakes automatically.
   
   Rotates realistic browser headers (User-Agent, Accept,
   Accept-Language, Sec-Fetch-*) to bypass bot detection.
   
   Features:
     - Cookie jar auto-attached via axios-cookiejar-support
     - Browser header rotation per-request
     - Exponential backoff with jitter
     - Response envelope (ScrapeResult) for consistent error handling
     - Referer tracking for session integrity
   ══════════════════════════════════════════════════════════════ */

import axios, { AxiosInstance, AxiosRequestConfig } from "axios";
import { wrapper } from "axios-cookiejar-support";
import { CookieJar } from "tough-cookie";
import { CONFIG } from "../config";
import { getBrowserHeaders } from "../utils/headers";

/* ─── Response Envelope ───────────────────────────────────── */

import type { ErrorCode } from "../utils/errors";
import { ERROR_CODES } from "../utils/errors";

/* ─── Response Envelope ───────────────────────────────────── */

export interface ScrapeResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  errorCode?: ErrorCode;
  errorMessage?: string;
  cached: boolean;
  retryable?: boolean;
}

export function ok<T>(data: T): ScrapeResult<T> {
  return { success: true, data, cached: false };
}

export function cachedRes<T>(data: T): ScrapeResult<T> {
  return { success: true, data, cached: true };
}

/**
 * Standardized error response with machine-readable error code.
 * - `error`: Short machine-readable code (e.g., "PARSE_FAILURE")
 * - `errorCode`: Same as `error` — both set for backward compatibility
 * - `errorMessage`: Human-readable description
 */
export function fail(
  errorCode: ErrorCode | string,
  errorMessage?: string,
  retryable = false
): ScrapeResult<never> {
  return {
    success: false,
    error: errorCode,
    errorCode: errorCode as ErrorCode,
    errorMessage: errorMessage || (typeof errorCode === "string" ? errorCode : "Unknown error"),
    cached: false,
    retryable,
  };
}

/* ─── Scraper HTTP Client ─────────────────────────────────── */

class ScraperClient {
  private client: AxiosInstance;
  private cookieJar: CookieJar;

  constructor() {
    this.cookieJar = new CookieJar();

    // Create base axios instance with cookie jar support
    this.client = wrapper(
      axios.create({
        timeout: CONFIG.TIMEOUT,
        maxRedirects: 5,
        validateStatus: (status) => status < 500,
        responseType: "text",
      })
    );

    // Attach the cookie jar
    (this.client.defaults as any).jar = this.cookieJar;
    (this.client.defaults as any).withCredentials = true;
  }

  /**
   * Fetch a URL with browser-like headers, cookie persistence,
   * and automatic retry with exponential backoff + jitter.
   */
  async get(
    url: string,
    referer?: string,
    retries = CONFIG.MAX_RETRIES
  ): Promise<string> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const headers = getBrowserHeaders(referer);

        const config: AxiosRequestConfig = {
          headers,
          // Axios-cookiejar-support automatically attaches cookies from the jar
        };

        const response = await this.client.get(url, config);

        if (response.status >= 400) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        return typeof response.data === "string"
          ? response.data
          : JSON.stringify(response.data);
      } catch (err: any) {
        lastError = err;

        if (attempt < retries) {
          // Exponential backoff with jitter
          const baseDelay = CONFIG.BASE_DELAY * Math.pow(2, attempt);
          const jitter = Math.random() * 1000;
          const delay = Math.min(baseDelay + jitter, 10_000);

          console.warn(
            `[ScraperClient] Attempt ${attempt + 1}/${retries + 1} failed for ${url.substring(0, 60)}..., retrying in ${Math.round(delay)}ms: ${err.message}`
          );

          await new Promise((r) => setTimeout(r, delay));
        }
      }
    }

    throw new Error(
      `Request failed after ${retries + 1} attempts: ${lastError?.message || "Unknown error"}`
    );
  }

  /**
   * Perform a POST request with form-encoded data (for multi-step forms).
   */
  async post(
    url: string,
    data: Record<string, string>,
    referer?: string,
    retries = CONFIG.MAX_RETRIES
  ): Promise<string> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const headers = {
          ...getBrowserHeaders(referer),
          "Content-Type": "application/x-www-form-urlencoded",
        };

        const response = await this.client.post(url, new URLSearchParams(data), {
          headers,
        });

        if (response.status >= 400) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        return typeof response.data === "string"
          ? response.data
          : JSON.stringify(response.data);
      } catch (err: any) {
        lastError = err;

        if (attempt < retries) {
          const baseDelay = CONFIG.BASE_DELAY * Math.pow(2, attempt);
          const jitter = Math.random() * 1000;
          const delay = Math.min(baseDelay + jitter, 10_000);

          await new Promise((r) => setTimeout(r, delay));
        }
      }
    }

    throw new Error(
      `POST failed after ${retries + 1} attempts: ${lastError?.message || "Unknown error"}`
    );
  }

  /**
   * Clear all cookies (for fresh sessions).
   */
  resetSession(): void {
    this.cookieJar = new CookieJar();
    (this.client.defaults as any).jar = this.cookieJar;
  }
}

export const scraperClient = new ScraperClient();
