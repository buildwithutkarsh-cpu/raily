/* ══════════════════════════════════════════════════════════════
   RAPI — Standardized Error Codes
   
   Ensures all API errors return machine-readable codes so
   consumers can handle errors programmatically without brittle
   string matching on human-readable messages.
   
   Usage:
     fail(ERROR_CODES.PARSE_FAILURE, "Failed to parse PNR data")
     → { success: false, error: "PARSE_FAILURE", errorMessage: "Failed to parse PNR data", retryable: true }
   ══════════════════════════════════════════════════════════════ */

export const ERROR_CODES = {
  /** Scraper could not parse the upstream HTML/response */
  PARSE_FAILURE: "PARSE_FAILURE",
  /** Missing or invalid input parameters */
  INVALID_INPUT: "INVALID_INPUT",
  /** Upstream API returned an error (502, 504, etc.) */
  UPSTREAM_ERROR: "UPSTREAM_ERROR",
  /** Upstream is unreachable (ECONNREFUSED, DNS failure) */
  UPSTREAM_UNREACHABLE: "UPSTREAM_UNREACHABLE",
  /** Rate limited by upstream */
  UPSTREAM_RATE_LIMIT: "UPSTREAM_RATE_LIMIT",
  /** Timeout while waiting for upstream response */
  TIMEOUT: "TIMEOUT",
  /** Resource not found (invalid PNR, train number, etc.) */
  NOT_FOUND: "NOT_FOUND",
  /** Internal server error */
  INTERNAL_ERROR: "INTERNAL_ERROR",
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];
