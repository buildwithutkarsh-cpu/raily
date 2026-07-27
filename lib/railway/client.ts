/* ══════════════════════════════════════════════════════════════
   RAILWAY — API Client
   The single entry point for all railway data.
   Combines provider, caching, retry logic, and timeout handling.
   
   Usage:
     const client = getRailwayClient();
     const trains = await client.searchTrains({ from: "NDLS", to: "JP", date: "2026-07-28" });
   ══════════════════════════════════════════════════════════════ */

import type { RailwayProvider } from "./provider";
import { MockRailwayProvider } from "./mock-provider";
import { IndianRailAPIProvider } from "./indianrailapi-provider";
import { RailwayCache } from "./cache";
import type {
  StationSearchResult,
  TrainSearchResult,
  TrainSchedule,
  SeatAvailability,
  FareEnquiry,
  PNRStatus,
  LiveStatus,
  CoachComposition,
  ApiResponse,
} from "./types";

/* ─── Configuration ────────────────────────────────────────── */

export interface RailwayClientConfig {
  /** Use mock data instead of real API */
  useMock?: boolean;
  /** API key for the real provider (if not using mock) */
  apiKey?: string;
  /** Cache TTL in milliseconds */
  cacheTTL?: number;
  /** Request timeout in milliseconds */
  timeout?: number;
  /** Max retries on failure */
  maxRetries?: number;
}

/* ─── Error Classes ────────────────────────────────────────── */

export class RailwayAPIError extends Error {
  constructor(
    message: string,
    public code: string,
    public status: number = 500,
    public details?: string
  ) {
    super(message);
    this.name = "RailwayAPIError";
  }
}

export class RailwayTimeoutError extends RailwayAPIError {
  constructor(url: string) {
    super(`Request timed out: ${url}`, "TIMEOUT", 408);
    this.name = "RailwayTimeoutError";
  }
}

export class RailwayRateLimitError extends RailwayAPIError {
  constructor(retryAfter = 60) {
    super("Rate limit exceeded. Please wait before retrying.", "RATE_LIMIT", 429, `Retry after ${retryAfter}s`);
    this.name = "RailwayRateLimitError";
  }
}

/* ─── Client ───────────────────────────────────────────────── */

export class RailwayClient {
  private provider: RailwayProvider;
  private cache: RailwayCache;
  private config: Required<RailwayClientConfig>;

  constructor(config?: RailwayClientConfig) {
    this.config = {
      useMock: config?.useMock ?? true,
      apiKey: config?.apiKey || "",
      cacheTTL: config?.cacheTTL ?? 60_000,
      timeout: config?.timeout ?? 10_000,
      maxRetries: config?.maxRetries ?? 2,
    };

    this.cache = new RailwayCache(this.config.cacheTTL);

    // Select provider based on configuration
    if (this.config.useMock || !this.config.apiKey) {
      this.provider = new MockRailwayProvider();
    } else {
      this.provider = new IndianRailAPIProvider(this.config.apiKey);
    }
  }

  /* ─── Provider Info ──────────────────────────────────────── */

  get providerName(): string {
    return this.provider.name;
  }

  get isMock(): boolean {
    return this.provider instanceof MockRailwayProvider;
  }

  get cacheStats() {
    return this.cache.stats;
  }

  /* ─── API Methods ────────────────────────────────────────── */

  async searchStations(query: string, limit = 10): Promise<ApiResponse<StationSearchResult>> {
    return this.execute(
      RailwayCache.key.stations(query),
      () => this.provider.searchStations(query, limit)
    );
  }

  async searchTrains(from: string, to: string, date: string, cls?: string): Promise<ApiResponse<TrainSearchResult>> {
    return this.execute(
      RailwayCache.key.trains(from, to, date),
      () => this.provider.searchTrains({ from, to, date, class: cls }),
      120_000 // Cache train search for 2 minutes
    );
  }

  async getTrainSchedule(trainNumber: string): Promise<ApiResponse<TrainSchedule>> {
    return this.execute(
      RailwayCache.key.schedule(trainNumber),
      () => this.provider.getTrainSchedule(trainNumber),
      600_000 // Cache schedule for 10 minutes
    );
  }

  async getSeatAvailability(
    trainNumber: string,
    from: string,
    to: string,
    date: string,
    cls?: string
  ): Promise<ApiResponse<SeatAvailability>> {
    return this.execute(
      RailwayCache.key.seatAvail(trainNumber, from, to, date, cls),
      () => this.provider.getSeatAvailability({ trainNumber, from, to, date, class: cls }),
      30_000 // Cache seat availability for 30 seconds
    );
  }

  async getFare(trainNumber: string, from: string, to: string): Promise<ApiResponse<FareEnquiry>> {
    return this.execute(
      RailwayCache.key.fare(trainNumber, from, to),
      () => this.provider.getFare({ trainNumber, from, to }),
      300_000 // Cache fare for 5 minutes
    );
  }

  async getPNRStatus(pnr: string): Promise<ApiResponse<PNRStatus>> {
    return this.execute(
      RailwayCache.key.pnr(pnr),
      () => this.provider.getPNRStatus(pnr),
      15_000 // Cache PNR for 15 seconds
    );
  }

  async getLiveStatus(trainNumber: string): Promise<ApiResponse<LiveStatus>> {
    return this.execute(
      RailwayCache.key.liveStatus(trainNumber),
      () => this.provider.getLiveStatus(trainNumber),
      10_000 // Cache live status for 10 seconds
    );
  }

  async getCoachComposition(trainNumber: string): Promise<ApiResponse<CoachComposition>> {
    return this.execute(
      RailwayCache.key.coach(trainNumber),
      () => this.provider.getCoachComposition(trainNumber),
      600_000 // Cache coach composition for 10 minutes
    );
  }

  /* ─── Core Execution ─────────────────────────────────────── */

  private async execute<T>(
    cacheKey: string,
    fetcher: () => Promise<T>,
    ttlMs?: number
  ): Promise<ApiResponse<T>> {
    try {
      // Try cache first
      const cached = this.cache.get<T>(cacheKey);
      if (cached) {
        return {
          success: true,
          data: cached.data,
          cached: true,
          timestamp: new Date().toISOString(),
        };
      }

      // Fetch with retry + timeout
      const data = await this.withRetry(() => this.withTimeout(fetcher()));

      // Cache the result
      this.cache.set(cacheKey, data, ttlMs);

      return {
        success: true,
        data,
        cached: false,
        timestamp: new Date().toISOString(),
      };
    } catch (err) {
      if (err instanceof RailwayAPIError) {
        return {
          success: false,
          error: {
            code: err.code,
            message: err.message,
            details: err.details,
            status: err.status,
          },
          cached: false,
          timestamp: new Date().toISOString(),
        };
      }

      const message = err instanceof Error ? err.message : "Unknown error";
      return {
        success: false,
        error: {
          code: "UNKNOWN",
          message,
          status: 500,
        },
        cached: false,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /* ─── Timeout ────────────────────────────────────────────── */

  private async withTimeout<T>(promise: Promise<T>): Promise<T> {
    const timeout = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new RailwayTimeoutError("Request")), this.config.timeout);
    });

    return Promise.race([promise, timeout]);
  }

  /* ─── Retry Logic ────────────────────────────────────────── */

  private async withRetry<T>(fn: () => Promise<T>, attempt = 0): Promise<T> {
    try {
      return await fn();
    } catch (err) {
      if (err instanceof RailwayRateLimitError) {
        // For rate limits, wait longer
        await this.sleep(5000);
        return fn();
      }

      if (attempt < this.config.maxRetries) {
        await this.sleep(Math.pow(2, attempt) * 500); // Exponential backoff
        return this.withRetry(fn, attempt + 1);
      }

      throw err;
    }
  }

  /* ─── Utility ────────────────────────────────────────────── */

  private sleep(ms: number): Promise<void> {
    return new Promise((r) => setTimeout(r, ms));
  }
}

/* ─── Singleton ────────────────────────────────────────────── */

let globalClient: RailwayClient | null = null;

/**
 * Get the global Railway client instance.
 * Configure via environment variables:
 *   - NEXT_PUBLIC_RAILWAY_USE_MOCK: "true" to use mock data
 *   - RAILWAY_API_KEY: API key for the real provider
 */
export function getRailwayClient(): RailwayClient {
  if (!globalClient) {
    const useMock = process.env.NEXT_PUBLIC_RAILWAY_USE_MOCK !== "false";
    globalClient = new RailwayClient({
      useMock,
      apiKey: process.env.RAILWAY_API_KEY,
    });
  }
  return globalClient;
}

/** Reset the global client (useful for testing) */
export function resetRailwayClient(): void {
  globalClient = null;
}
