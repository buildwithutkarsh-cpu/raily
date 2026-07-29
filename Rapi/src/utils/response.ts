/* ══════════════════════════════════════════════════════════════
   RAPI — Unified Response Helpers & Request ID Middleware
   ══════════════════════════════════════════════════════════════ */

import { v4 as uuidv4 } from "uuid";
import type { ApiSuccess, ApiError, ErrorCode, CacheTelemetry } from "../types";

/* ─── Request ID Generation ───────────────────────────────── */

let requestCounter = 0;

export function generateRequestId(): string {
  requestCounter++;
  const timestamp = Date.now().toString(36);
  const counter = requestCounter.toString(36).padStart(4, "0");
  return `rapi-${timestamp}-${counter}`;
}

/* ─── Success Response ────────────────────────────────────── */

export function success<T>(data: T, cached = false, requestId?: string): ApiSuccess<T> {
  return {
    success: true,
    data,
    cached,
    timestamp: new Date().toISOString(),
    requestId: requestId || generateRequestId(),
  };
}

/* ─── Error Response ──────────────────────────────────────── */

export function apiError(
  code: ErrorCode | string,
  message: string,
  retryable = false,
  requestId?: string,
): ApiError {
  return {
    success: false,
    error: {
      code,
      message,
      retryable,
    },
    timestamp: new Date().toISOString(),
    requestId: requestId || generateRequestId(),
  };
}

/* ─── Specific Error Helpers ──────────────────────────────── */

export function notFound(message: string, requestId?: string): ApiError {
  return apiError("NOT_FOUND", message, false, requestId);
}

export function invalidInput(message: string, requestId?: string): ApiError {
  return apiError("INVALID_INPUT", message, false, requestId);
}

export function upstreamError(message: string, retryable = true, requestId?: string): ApiError {
  return apiError("UPSTREAM_ERROR", message, retryable, requestId);
}

export function timeoutError(message: string, requestId?: string): ApiError {
  return apiError("TIMEOUT", message, true, requestId);
}

export function internalError(message = "Internal server error", requestId?: string): ApiError {
  return apiError("INTERNAL_ERROR", message, false, requestId);
}

export function unauthorized(message = "Unauthorized", requestId?: string): ApiError {
  return apiError("UNAUTHORIZED", message, false, requestId);
}

export function rateLimited(message = "Rate limit exceeded", requestId?: string): ApiError {
  return apiError("RATE_LIMITED", message, false, requestId);
}

/* ─── Cache Telemetry Builder ─────────────────────────────── */

export function buildCacheTelemetry(telemetry: {
  hits: number;
  misses: number;
  sets: number;
  evictions: number;
  staleHits: number;
  backgroundRefreshes: number;
  keys: number;
  maxKeys: number;
}): CacheTelemetry {
  const total = telemetry.hits + telemetry.misses + telemetry.staleHits;
  return {
    ...telemetry,
    hitRate: total > 0 ? Math.round((telemetry.hits / total) * 10000) / 100 : 0,
    staleHitRate: total > 0 ? Math.round((telemetry.staleHits / total) * 10000) / 100 : 0,
    missRate: total > 0 ? Math.round((telemetry.misses / total) * 10000) / 100 : 0,
    utilizationPercent: telemetry.maxKeys > 0
      ? Math.round((telemetry.keys / telemetry.maxKeys) * 10000) / 100
      : 0,
    totalRequests: total,
  };
}

/* ─── Request ID Middleware ────────────────────────────────── */

import type { Request, Response, NextFunction } from "express";

declare global {
  namespace Express {
    interface Request {
      requestId: string;
    }
  }
}

export function requestIdMiddleware(req: Request, _res: Response, next: NextFunction): void {
  req.requestId = generateRequestId();
  next();
}

/* ─── Structured Logger ───────────────────────────────────── */

export function log(
  level: "info" | "warn" | "error" | "debug",
  message: string,
  meta?: Record<string, unknown>,
): void {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...meta,
  };
  const output = JSON.stringify(entry);
  switch (level) {
    case "error":
      console.error(output);
      break;
    case "warn":
      console.warn(output);
      break;
    case "debug":
      console.debug(output);
      break;
    default:
      console.log(output);
  }
}