/* ══════════════════════════════════════════════════════════════
   RAPI — Standardized Error Codes
   ══════════════════════════════════════════════════════════════ */

export const ERROR_CODES = {
  PARSE_FAILURE: "PARSE_FAILURE",
  INVALID_INPUT: "INVALID_INPUT",
  UPSTREAM_ERROR: "UPSTREAM_ERROR",
  UPSTREAM_UNREACHABLE: "UPSTREAM_UNREACHABLE",
  UPSTREAM_RATE_LIMIT: "UPSTREAM_RATE_LIMIT",
  TIMEOUT: "TIMEOUT",
  NOT_FOUND: "NOT_FOUND",
  INTERNAL_ERROR: "INTERNAL_ERROR",
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];