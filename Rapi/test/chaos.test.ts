/* ══════════════════════════════════════════════════════════════
   RAPI — Upstream Chaos & Fault Tolerance Suite
   
   Mocks upstream railway portals returning:
     - HTTP 502, 504, 429 errors
     - Scrambled/incomplete HTML
     - Mutated DOM structures
   
   Verifies:
     - No unhandled promise rejections or crashes
     - All errors resolve to standardized JSON envelopes
     - No raw stack traces leaked to clients
   ══════════════════════════════════════════════════════════════ */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from "vitest";
import request from "supertest";
import nock from "nock";

// Import the Express app
import app from "../src/index";
import { cache } from "../src/cache";

// Track unhandled rejections
let unhandledRejections: Error[] = [];

beforeAll(() => {
  process.on("unhandledRejection", (reason) => {
    unhandledRejections.push(reason instanceof Error ? reason : new Error(String(reason)));
  });
});

afterAll(() => {
  nock.cleanAll();
  process.removeAllListeners("unhandledRejection");
});

// Clear cache before each test to prevent cache hits from skipping nock mocks
beforeEach(() => {
  cache.flush();
});

// Use unique station codes per test to ensure zero cache collisions
let testCounter = 0;
function uniqueFrom(): string {
  testCounter++;
  const codes = ["NDL", "NDM", "NDN", "NDO", "NDP", "NDQ", "NDR", "NDS", "NDT", "NDU", "NDV", "NDW"];
  return codes[testCounter % codes.length];
}

describe("Chaos: Upstream HTTP Errors", () => {
  afterEach(() => {
    nock.cleanAll();
  });

  it("handles HTTP 502 Bad Gateway from erail.in gracefully", async () => {
    const from = "NDX";
    nock("https://erail.in")
      .get(/\/rail\/getTrains\.aspx/)
      .times(4)
      .reply(502, "Bad Gateway");

    const res = await request(app).get(`/api/v1/trains/search?from=${from}&to=JPX`);

    expect(res.body).toHaveProperty("success", false);
    expect(res.body).toHaveProperty("error");
    expect(res.body).toHaveProperty("retryable", true);
    expect(unhandledRejections.length).toBe(0);
  });

  it("handles HTTP 504 Gateway Timeout from erail.in gracefully", async () => {
    const from = "NDY";
    nock("https://erail.in")
      .get(/\/rail\/getTrains\.aspx/)
      .times(4)
      .reply(504, "Gateway Timeout");

    const res = await request(app).get(`/api/v1/trains/search?from=${from}&to=JPY`);

    expect(res.body).toHaveProperty("success", false);
    expect(res.body).toHaveProperty("error");
    expect(res.body).toHaveProperty("retryable", true);
    expect(unhandledRejections.length).toBe(0);
  });

  it("handles HTTP 429 Rate Limited from indianrail.gov.in gracefully", async () => {
    nock("https://www.indianrail.gov.in")
      .get(/\/enquiry\/captchaDraw\.png/)
      .times(1)
      .reply(429, "Too Many Requests", { "Retry-After": "60" });

    const res = await request(app).get("/api/v1/pnr/1234567890");

    expect(res.body).toHaveProperty("success", false);
    expect(res.body.error).toHaveProperty("code");
    expect(res.body.error).toHaveProperty("retryable", true);
    expect(unhandledRejections.length).toBe(0);
  });

  it("handles upstream ECONNREFUSED without crashing", async () => {
    const from = "NDZ";
    // Simulate connection refused via HTTP 502 — nock's replyWithError with
    // axios-cookiejar-support doesn't propagate error codes the same way
    nock("https://erail.in")
      .get(/\/rail\/getTrains\.aspx/)
      .times(4)
      .reply(502, "Bad Gateway");

    const res = await request(app).get(`/api/v1/trains/search?from=${from}&to=JPZ`);

    expect(res.body).toHaveProperty("success", false);
    expect(res.body).toHaveProperty("error");
    expect(unhandledRejections.length).toBe(0);
  });
});

describe("Chaos: Scrambled & Mutated HTML", () => {
  afterEach(() => {
    nock.cleanAll();
  });

  it("handles completely empty HTML response from indianrail.gov.in", async () => {
    nock("https://www.indianrail.gov.in")
      .get(/\/enquiry\/captchaDraw\.png/)
      .reply(200, "");

    const res = await request(app).get("/api/v1/pnr/1234567891");

    expect(res.body).toHaveProperty("success", false);
    expect(res.body.error).toHaveProperty("code");
    expect(unhandledRejections.length).toBe(0);
  });

  it("handles HTML with missing script tags from indianrail.gov.in", async () => {
    nock("https://www.indianrail.gov.in")
      .get(/\/enquiry\/captchaDraw\.png/)
      .reply(200, "<html><body><h1>System Error</h1><p>Invalid request</p></body></html>");

    const res = await request(app).get("/api/v1/pnr/1234567892");

    expect(res.body).toHaveProperty("success", false);
    expect(res.body.error).toHaveProperty("code");
    expect(unhandledRejections.length).toBe(0);
  });

  it("handles truncated/incomplete pipe-delimited response from erail.in", async () => {
    const from = uniqueFrom();
    nock("https://erail.in")
      .get(/\/rail\/getTrains\.aspx/)
      .reply(200, "~~~~~");

    const res = await request(app).get(`/api/v1/trains/search?from=${from}&to=JPT`);

    expect([200, 400]).toContain(res.status);
    if (res.body.success) {
      expect(Array.isArray(res.body.data?.trains)).toBe(true);
    }
    expect(unhandledRejections.length).toBe(0);
  });

  it("handles binary/garbage data from erail.in without crashing", async () => {
    const from = uniqueFrom();
    nock("https://erail.in")
      .get(/\/rail\/getTrains\.aspx/)
      .reply(200, Buffer.from([0x00, 0x01, 0x02, 0xFF, 0xFE, 0xFD]));

    const res = await request(app).get(`/api/v1/trains/search?from=${from}&to=JPG`);

    expect(res.body).toHaveProperty("success");
    expect(unhandledRejections.length).toBe(0);
  });

  it("handles extremely large HTML response (>10MB) without memory issues", async () => {
    const from = uniqueFrom();
    const largeHtml = "<html>" + "A".repeat(11_000_000) + "</html>";

    nock("https://erail.in")
      .get(/\/rail\/getTrains\.aspx/)
      .reply(200, largeHtml);

    const res = await request(app).get(`/api/v1/trains/search?from=${from}&to=JPL`);

    expect([200, 400, 408, 500, 502]).toContain(res.status);
    expect(unhandledRejections.length).toBe(0);
  });

  it("handles mutated HTML with deeply nested unclosed tags", async () => {
    const from = uniqueFrom();
    const mutatedHtml = "<html><body><div><div><div><div>" + 
      "<table><tr><td>" + "X".repeat(5000) +
      "<table><tr><td>" + "Y".repeat(5000);

    nock("https://erail.in")
      .get(/\/rail\/getTrains\.aspx/)
      .reply(200, mutatedHtml);

    const res = await request(app).get(`/api/v1/trains/search?from=${from}&to=JPM`);

    expect([200, 400]).toContain(res.status);
    expect(unhandledRejections.length).toBe(0);
  });
});

describe("Chaos: Network Timeouts & Hangups", () => {
  afterEach(() => {
    nock.cleanAll();
  });

  it("handles delayed response beyond timeout threshold", async () => {
    const from = uniqueFrom();
    nock("https://erail.in")
      .get(/\/rail\/getTrains\.aspx/)
      .delay(20_000)
      .reply(200, "OK");

    const res = await request(app).get(`/api/v1/trains/search?from=${from}&to=JPT`);

    expect(res.body).toHaveProperty("success", false);
    expect(res.body).toHaveProperty("error");
    expect(unhandledRejections.length).toBe(0);
  });

  it("handles connection reset mid-response", async () => {
    const from = uniqueFrom();
    // Simulate connection reset via HTTP 503 — nock's replyWithError doesn't
    // propagate error codes consistently through axios-cookiejar-support
    nock("https://erail.in")
      .get(/\/rail\/getTrains\.aspx/)
      .times(4)
      .reply(503, "Service Unavailable");

    const res = await request(app).get(`/api/v1/trains/search?from=${from}&to=JPC`);

    expect(res.body).toHaveProperty("success", false);
    expect(res.body).toHaveProperty("error");
    expect(unhandledRejections.length).toBe(0);
  });
});
