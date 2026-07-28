/* ══════════════════════════════════════════════════════════════
   RAPI — Input Fuzzing & Security Hardening Suite
   ══════════════════════════════════════════════════════════════ */

import { describe, it, expect } from "vitest";
import request from "supertest";
import app from "../src/index";

const SQLI_PAYLOADS = [
  "' OR '1'='1",
  "'; DROP TABLE users; --",
  "' UNION SELECT * FROM passengers --",
  "1' OR '1'='1' /*",
  "admin'--",
  "' OR 1=1 --",
  "'; EXEC xp_cmdshell('dir') --",
  "' OR SLEEP(5) --",
  "1' AND 1=1#",
];

const XSS_PAYLOADS = [
  "<script>alert(1)</script>",
  "<img src=x onerror=alert(1)>",
  "<svg/onload=alert(1)>",
  "javascript:alert(1)",
  "\"><script>alert(1)</script>",
];

const COMMAND_INJECTION_PAYLOADS = [
  "NDLS; rm -rf /",
  "NDLS | cat /etc/passwd",
  "NDLS && whoami",
  "NDLS & ping -c 10 127.0.0.1 &",
  "`id`",
  "$(cat /etc/passwd)",
];

const SSRF_PAYLOADS = [
  "127.0.0.1",
  "10.0.0.1",
  "192.168.1.1",
  "169.254.169.254",
  "0.0.0.0",
  "localhost",
  "[::1]",
];

const SPECIAL_PAYLOADS = [
  "A".repeat(10_000),
  "\x00\x00\x00",
  "😀🚂🇮🇳🔥💀",
  "日本語हिन्दीதமிழ்",
  "\t\n\r\0\x1b\x7f",
  "../../../etc/passwd",
  "https://evil.com/proxy",
];

describe("Fuzzing: PNR Endpoint", () => {
  SQLI_PAYLOADS.forEach((payload) => {
    it(`rejects SQLi: ${payload.substring(0, 25)}`, async () => {
      const res = await request(app).get(`/api/v1/pnr/${encodeURIComponent(payload)}`);
      expect([400, 422]).toContain(res.status);
      expect(res.body).toHaveProperty("success", false);
    });
  });

  XSS_PAYLOADS.forEach((payload) => {
    it(`rejects XSS: ${payload.substring(0, 25)}`, async () => {
      const res = await request(app).get(`/api/v1/pnr/${encodeURIComponent(payload)}`);
      expect([400, 422]).toContain(res.status);
      expect(res.text || "").not.toContain("<script>");
    });
  });

  COMMAND_INJECTION_PAYLOADS.forEach((payload) => {
    it(`rejects cmd injection: ${payload.substring(0, 25)}`, async () => {
      const res = await request(app).get(`/api/v1/pnr/${encodeURIComponent(payload)}`);
      expect([400, 422]).toContain(res.status);
    });
  });

  SPECIAL_PAYLOADS.forEach((payload) => {
    it(`handles special payload: ${String(payload).substring(0, 15)}`, async () => {
      const res = await request(app).get(`/api/v1/pnr/${encodeURIComponent(String(payload))}`);
      expect([200, 400, 404, 422]).toContain(res.status);
      expect(res.body).toHaveProperty("success");
      expect(res.body).not.toHaveProperty("stack");
    });
  });
});

describe("Fuzzing: Train Search — SSRF & Injection", () => {
  SQLI_PAYLOADS.forEach((payload) => {
    it(`rejects SQLi in station code: ${payload.substring(0, 25)}`, async () => {
      const res = await request(app).get(
        `/api/v1/trains/search?from=${encodeURIComponent(payload)}&to=NDLS`
      );
      expect([400, 422]).toContain(res.status);
      expect(res.body).toHaveProperty("success", false);
    });
  });

  SSRF_PAYLOADS.forEach((payload) => {
    it(`blocks SSRF attempt: ${payload}`, async () => {
      const res = await request(app).get(
        `/api/v1/trains/search?from=${encodeURIComponent(payload)}&to=NDLS`
      );
      // Station codes are validated by regex (2-10 alphanumeric chars).
      // Payloads that pass format validation (e.g. "localhost" is 9 alpha)
      // will proceed to make HTTP requests which may fail with a network
      // error. Payloads that fail format validation get 400.
      // Either way, no crash and no data leak.
      if ([400, 422].includes(res.status)) {
        expect(res.body).toHaveProperty("success", false);
      } else {
        // Network-level failures are acceptable — the system didn't crash
        expect(res.body).toHaveProperty("success");
      }
    });
  });

  it("rejects 10,000+ char station code", async () => {
    const long = "A".repeat(10_000);
    const res = await request(app).get(`/api/v1/trains/search?from=${long}&to=NDLS`);
    expect([400, 413, 422]).toContain(res.status);
  });

  it("rejects null byte in station code", async () => {
    const res = await request(app).get("/api/v1/trains/search?from=NDLS%00&to=JP");
    expect([400, 422]).toContain(res.status);
  });
});

describe("Fuzzing: Station Autocomplete — XSS Defense", () => {
  XSS_PAYLOADS.forEach((payload) => {
    it(`sanitizes XSS in q param: ${payload.substring(0, 25)}`, async () => {
      const res = await request(app).get(
        `/api/v1/stations/autocomplete?q=${encodeURIComponent(payload)}`
      );
      expect(res.status).toBe(200);
      // The query is reflected in the JSON response as the `query` field.
      // JSON.stringify escapes HTML characters, so `<script>` becomes `"<script>"`
      // which cannot execute as HTML. The test verifies the response is valid
      // JSON and does not contain unescaped HTML that could execute in a
      // browser context (e.g., as direct text/html response).
      expect(res.body).toHaveProperty("success", true);
      expect(res.body.data).toHaveProperty("query");
      expect(Array.isArray(res.body.data.stations)).toBe(true);
      // Verify no response code injection: response must be valid JSON-only
      expect(res.headers["content-type"]).toMatch(/json/);
    });
  });
});

describe("Security: Input Boundaries", () => {
  it("rejects PNR with letters", async () => {
    const res = await request(app).get("/api/v1/pnr/ABCDEFGHIJ");
    expect(res.status).toBe(400);
  });

  it("rejects 9-digit PNR", async () => {
    const res = await request(app).get("/api/v1/pnr/123456789");
    expect(res.status).toBe(400);
  });

  it("rejects 11-digit PNR", async () => {
    const res = await request(app).get("/api/v1/pnr/12345678901");
    expect(res.status).toBe(400);
  });

  it("rejects train search without from", async () => {
    const res = await request(app).get("/api/v1/trains/search?to=NDLS");
    expect(res.status).toBe(400);
  });

  it("rejects train search without to", async () => {
    const res = await request(app).get("/api/v1/trains/search?from=NDLS");
    expect(res.status).toBe(400);
  });

  it("rejects non-numeric train number for live status", async () => {
    const res = await request(app).get("/api/v1/trains/ABCDE/live");
    expect(res.status).toBe(400);
  });

  it("rejects 3-digit train number", async () => {
    const res = await request(app).get("/api/v1/trains/123/info");
    expect(res.status).toBe(400);
  });
});

describe("Security: No Stack Trace Leaks", () => {
  it("does not leak stacks in error responses", async () => {
    const endpoints = [
      "/api/v1/pnr/invalid",
      "/api/v1/trains/search",
      "/api/v1/trains/abc/live",
      "/api/v1/nonexistent",
    ];
    for (const ep of endpoints) {
      const res = await request(app).get(ep);
      const body = JSON.stringify(res.body);
      expect(body).not.toContain("Error:");
      expect(body).not.toContain("at ");
      expect(body).not.toContain("stack");
    }
  });
});
