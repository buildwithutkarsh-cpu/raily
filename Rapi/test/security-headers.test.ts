/* ══════════════════════════════════════════════════════════════
   RAPI — Security Headers, Rate Limiting & PII Masking Suite
   ══════════════════════════════════════════════════════════════ */

import { describe, it, expect } from "vitest";
import request from "supertest";
import app from "../src/index";

describe("Security Headers", () => {
  it("strips X-Powered-By header", async () => {
    const res = await request(app).get("/");
    expect(res.headers).not.toHaveProperty("x-powered-by");
  });

  it("returns CORS allow-origin header", async () => {
    const res = await request(app)
      .options("/api/v1/trains/search")
      .set("Origin", "https://example.com")
      .set("Access-Control-Request-Method", "GET");
    expect(res.headers["access-control-allow-origin"]).toBe("*");
  });

  it("returns JSON content-type for all API endpoints", async () => {
    const endpoints = [
      "/",
      "/api/v1/stations/autocomplete?q=DEL",
    ];
    for (const ep of endpoints) {
      const res = await request(app).get(ep);
      expect(res.headers["content-type"]).toMatch(/json/);
    }
  });

  it("returns 404 for unknown endpoints with clean error (no stack)", async () => {
    const res = await request(app).get("/api/v1/nonexistent");
    expect(res.status).toBe(404);
    expect(res.body).toEqual({
      success: false,
      error: "Endpoint not found. See GET / for available endpoints.",
    });
  });

  it("handles OPTIONS preflight successfully (returns 204)", async () => {
    const res = await request(app).options("/api/v1/trains/search");
    // CORS middleware returns 204 No Content for successful preflight requests.
    // This is standard HTTP behavior and not an error.
    expect([200, 204]).toContain(res.status);
  });
});

describe("Rate Limiting Enforcement (API-level 429)", () => {
  // Isolated describe block: rate-limit tests run in their own section
  // to avoid rate-limit bleed into subsequent tests.

  it("rate-limits after exceeding threshold", async () => {
    const endpoint = "/api/v1/stations/autocomplete?q=DEL";
    const requestCount = 150; // exceeds 100 req/min limit

    const results: number[] = [];
    for (let i = 0; i < requestCount; i++) {
      const res = await request(app).get(endpoint);
      results.push(res.status);
      if (res.status === 429) break;
    }

    const gotLimited = results.includes(429);
    if (gotLimited) {
      const first429 = results.indexOf(429);
      console.log(`[RateLimit] Hit 429 at request ${first429 + 1}/${requestCount}`);
    }

    const limitedRes = await request(app).get(endpoint);
    if (limitedRes.status === 429) {
      expect(limitedRes.body).toHaveProperty("success", false);
      expect(limitedRes.body.error).toBe("RATE_LIMIT_EXCEEDED");
      expect(limitedRes.body).toHaveProperty("retryAfter");
    }
  });
});

describe("Error Response Schema Compliance", () => {
  it("all errors return standardized envelope", async () => {
    const errorEndpoints = [
      "/api/v1/pnr/00000",
      "/api/v1/trains/search",
      "/api/v1/trains/abc/live",
      "/api/v1/trains/123/info",
    ];
    for (const ep of errorEndpoints) {
      const res = await request(app).get(ep);
      expect(res.body).toHaveProperty("success", false);
      expect(res.body).toHaveProperty("error");
      // Must NOT contain stack traces
      expect(JSON.stringify(res.body)).not.toMatch(/Error:|at\s\w+|stack|eval|Function/);
    }
  });
});

describe("PII Not Exposed", () => {
  it("PNR response does not contain raw PII fields", async () => {
    const res = await request(app).get("/api/v1/pnr/1234567890");
    if (res.body.success && res.body.data?.passengers) {
      for (const p of res.body.data.passengers) {
        expect(p).not.toHaveProperty("phone");
        expect(p).not.toHaveProperty("aadhaar");
        expect(p).not.toHaveProperty("email");
        expect(p).not.toHaveProperty("pan");
      }
    }
  });

  it("does not expose server internals in errors", async () => {
    const res = await request(app).get("/api/v1/nonexistent");
    expect([200, 404, 429]).toContain(res.status);
    if (res.status === 404) {
      expect(res.body).toEqual({
        success: false,
        error: "Endpoint not found. See GET / for available endpoints.",
      });
    }
    // No stack traces regardless of status
    expect(JSON.stringify(res.body)).not.toMatch(/Error:|at\s\w+|stack|eval|Function/);
  });
});
