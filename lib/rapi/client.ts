/* ══════════════════════════════════════════════════════════════
   RAPI — API Client
   
   Single source of truth for all railway data in Raily.
   Every request goes through this client.
   No mock data, no fallback providers, no static JSON.
   
   All data originates from the self-hosted Rapi server.
   ══════════════════════════════════════════════════════════════ */

const DEFAULT_BASE_URL = "http://localhost:3001";
const DEFAULT_TIMEOUT = 15_000;

/* ─── Error Classes ────────────────────────────────────────── */

export class RapiError extends Error {
  constructor(
    message: string,
    public code: string = "RAPI_ERROR",
    public status: number = 500,
    public details?: string
  ) {
    super(message);
    this.name = "RapiError";
  }
}

export class RapiTimeoutError extends RapiError {
  constructor(url: string) {
    super(`Request timed out: ${url}`, "RAPI_TIMEOUT", 408);
    this.name = "RapiTimeoutError";
  }
}

export class RapiRateLimitError extends RapiError {
  constructor(retryAfter = 60) {
    super(
      `Rate limit exceeded. Retry after ${retryAfter}s`,
      "RAPI_RATE_LIMIT",
      429,
      `Retry-After: ${retryAfter}`
    );
    this.name = "RapiRateLimitError";
  }
}

export class RapiUnreachableError extends RapiError {
  constructor(baseUrl: string) {
    super(
      `Rapi server not reachable at ${baseUrl}. Start it with: cd Rapi && npm run dev`,
      "RAPI_UNREACHABLE",
      503
    );
    this.name = "RapiUnreachableError";
  }
}

/* ─── Response Types ───────────────────────────────────────── */

export interface RapiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  errorCode?: string;
  errorMessage?: string;
  retryable?: boolean;
  cached: boolean;
}

/* ─── API Client ───────────────────────────────────────────── */

class RapiApiClient {
  private baseUrl: string;
  private timeout: number;
  private abortController: AbortController | null = null;

  constructor(baseUrl?: string, timeoutMs = DEFAULT_TIMEOUT) {
    this.baseUrl =
      baseUrl ||
      process.env.NEXT_PUBLIC_RAPI_BASE_URL ||
      process.env.RAPI_BASE_URL ||
      DEFAULT_BASE_URL;
    this.timeout = timeoutMs;
  }

  /** Cancel any in-flight request */
  cancel(): void {
    this.abortController?.abort();
  }

  async get<T>(path: string): Promise<RapiResponse<T>> {
    const url = `${this.baseUrl}${path}`;
    this.abortController = new AbortController();
    const timeout = setTimeout(() => this.abortController!.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        signal: this.abortController.signal,
        headers: { Accept: "application/json" },
      });

      clearTimeout(timeout);

      if (response.status === 429) {
        const retryAfter = parseInt(response.headers.get("Retry-After") || "60");
        throw new RapiRateLimitError(retryAfter);
      }
      if (response.status === 502) {
        // Rapi returns 502 for upstream scraping failures
        const body = await response.json().catch(() => ({}));
        return {
          success: false,
          error: body.error || "Upstream scraping failed",
          errorCode: body.errorCode || "RAPI_UPSTREAM",
          errorMessage: body.errorMessage || "Railway data source is temporarily unavailable",
          retryable: true,
          cached: false,
        };
      }
      if (response.status === 404) {
        return { success: false, error: "Not found", cached: false };
      }
      if (response.status >= 500) {
        const body = await response.json().catch(() => ({}));
        return {
          success: false,
          error: body.error || `Rapi server error: ${response.statusText}`,
          cached: false,
        };
      }

      return (await response.json()) as RapiResponse<T>;
    } catch (err: unknown) {
      clearTimeout(timeout);
      if (err instanceof RapiError) throw err;
      if (err instanceof Error && err.name === "AbortError") {
        throw new RapiTimeoutError(url);
      }
      const errorRecord = err as Record<string, unknown>;
      const cause = errorRecord?.cause as Record<string, unknown> | undefined;
      if (cause?.code === "ECONNREFUSED" || (typeof errorRecord?.message === "string" && errorRecord.message.includes("ECONNREFUSED"))) {
        throw new RapiUnreachableError(this.baseUrl);
      }
      throw new RapiError(err instanceof Error ? err.message : "Rapi request failed");
    }
  }
}

/* ─── Singleton ────────────────────────────────────────────── */

let globalClient: RapiApiClient | null = null;

export function getRapiClient(): RapiApiClient {
  if (!globalClient) {
    globalClient = new RapiApiClient();
  }
  return globalClient;
}

export function resetRapiClient(): void {
  globalClient = null;
}

export default RapiApiClient;
export { RapiApiClient };