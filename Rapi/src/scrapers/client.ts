/* ══════════════════════════════════════════════════════════════
   RAPI — Scraper HTTP Session Layer
   ══════════════════════════════════════════════════════════════ */

import axios, { AxiosInstance, AxiosRequestConfig } from "axios";
import { wrapper } from "axios-cookiejar-support";
import { CookieJar } from "tough-cookie";
import { CONFIG } from "../config";
import { getBrowserHeaders } from "../utils/headers";
import { ERROR_CODES, type ErrorCode } from "../utils/errors";

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
  private readonly maxRetries: number;
  private readonly baseDelay: number;

  constructor() {
    this.cookieJar = new CookieJar();
    this.maxRetries = CONFIG.MAX_RETRIES;
    this.baseDelay = CONFIG.BASE_DELAY;

    this.client = wrapper(
      axios.create({
        timeout: CONFIG.TIMEOUT,
        maxRedirects: 5,
        validateStatus: (status: number) => status < 500,
        responseType: "text" as const,
      })
    );

    // Type assertion for cookiejar support
    const clientWithJar = this.client as unknown as Record<string, unknown>;
    clientWithJar.jar = this.cookieJar;
    clientWithJar.withCredentials = true;
  }

  async get(
    url: string,
    referer?: string,
    retries?: number
  ): Promise<string> {
    const maxAttempts = retries ?? this.maxRetries;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= maxAttempts; attempt++) {
      try {
        const headers = getBrowserHeaders(referer);

        const config: AxiosRequestConfig = {
          headers,
        };

        const response = await this.client.get(url, config);

        if (response.status >= 400) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        return typeof response.data === "string"
          ? response.data
          : JSON.stringify(response.data);
      } catch (err: unknown) {
        lastError = err instanceof Error ? err : new Error(String(err));

        if (attempt < maxAttempts) {
          const baseDelay = this.baseDelay * Math.pow(2, attempt);
          const jitter = Math.random() * 1000;
          const delay = Math.min(baseDelay + jitter, 10_000);

          console.warn(
            `[ScraperClient] Attempt ${attempt + 1}/${maxAttempts + 1} failed for ${url}: ${lastError.message}`
          );

          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError || new Error("ScraperClient: All retries exhausted");
  }

  /**
   * Reset the session — clear cookies and create a new jar.
   */
  resetSession(): void {
    this.cookieJar = new CookieJar();
    const clientWithJar = this.client as unknown as Record<string, unknown>;
    clientWithJar.jar = this.cookieJar;
  }
}

export const scraperClient = new ScraperClient();