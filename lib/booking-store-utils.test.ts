/* ══════════════════════════════════════════════════════════════
   RAILY — Booking Store Utilities Tests
   
   Tests for the pure data-construction functions extracted
   from the booking store: seat ID formatting, Train object
   construction, and ExtractedQuery construction.
   ══════════════════════════════════════════════════════════════ */

import { describe, it, expect } from "vitest";
import {
  buildSeatId,
  buildTrainFromBookingData,
  buildQueryFromBookingData,
  type BookingDataFields,
} from "./booking-store-utils";

/* ─── buildSeatId ──────────────────────────────────────────── */

describe("buildSeatId", () => {
  it("formats standard lower berth", () => {
    expect(buildSeatId("B1", "7", "Lower")).toBe("B1-7L");
  });

  it("formats middle berth", () => {
    expect(buildSeatId("A1", "12", "Middle")).toBe("A1-12M");
  });

  it("formats upper berth", () => {
    expect(buildSeatId("S5", "3", "Upper")).toBe("S5-3U");
  });

  it("handles lowercase tier input", () => {
    expect(buildSeatId("B1", "7", "lower")).toBe("B1-7L");
  });

  it("handles empty tier string", () => {
    expect(buildSeatId("B1", "7", "")).toBe("B1-7");
  });

  it("handles undefined tier", () => {
    expect(buildSeatId("B1", "7", undefined)).toBe("B1-7");
  });

  it("handles tier with multiple words like 'Lower Berth'", () => {
    expect(buildSeatId("B1", "7", "Lower Berth")).toBe("B1-7L");
  });

  it("formats with different coach names", () => {
    expect(buildSeatId("S1", "55", "Upper")).toBe("S1-55U");
  });
});

/* ─── buildTrainFromBookingData ────────────────────────────── */

describe("buildTrainFromBookingData", () => {
  const MINIMAL_DATA: BookingDataFields = {
    trainName: "Mumbai Rajdhani",
    trainNumber: "12951",
  };

  it("returns null when trainName is missing", () => {
    const result = buildTrainFromBookingData({ trainNumber: "12951" });
    expect(result).toBeNull();
  });

  it("returns null when trainNumber is missing", () => {
    const result = buildTrainFromBookingData({ trainName: "Mumbai Rajdhani" });
    expect(result).toBeNull();
  });

  it("returns null when both essential fields are missing", () => {
    const result = buildTrainFromBookingData({});
    expect(result).toBeNull();
  });

  it("uses fallback defaults for missing optional fields", () => {
    const result = buildTrainFromBookingData(MINIMAL_DATA);
    expect(result).not.toBeNull();
    expect(result!.departure).toBe("--");
    expect(result!.arrival).toBe("--");
    expect(result!.duration).toBe("--");
    expect(result!.classType).toBe("—");
    expect(result!.price).toBe(0);
  });

  it("constructs train ID from number and station codes", () => {
    const result = buildTrainFromBookingData({
      ...MINIMAL_DATA,
      fromCode: "NDLS",
      toCode: "JP",
    });
    expect(result!.id).toBe("12951-NDLS-JP");
  });

  it("uses ? placeholder when station codes are missing", () => {
    const result = buildTrainFromBookingData(MINIMAL_DATA);
    expect(result!.id).toBe("12951-?-?");
  });

  it("sets name and number correctly", () => {
    const result = buildTrainFromBookingData(MINIMAL_DATA);
    expect(result!.name).toBe("Mumbai Rajdhani");
    expect(result!.number).toBe("12951");
  });

  it("fills all provided fields", () => {
    const result = buildTrainFromBookingData({
      trainName: "Shatabdi Exp",
      trainNumber: "12015",
      departure: "06:00",
      arrival: "10:30",
      duration: "4h 30m",
      fare: "875",
      class: "CC",
      fromCode: "NDLS",
      toCode: "JP",
    });
    expect(result!.name).toBe("Shatabdi Exp");
    expect(result!.number).toBe("12015");
    expect(result!.departure).toBe("06:00");
    expect(result!.arrival).toBe("10:30");
    expect(result!.duration).toBe("4h 30m");
    expect(result!.price).toBe(875);
    expect(result!.classType).toBe("CC");
    expect(result!.id).toBe("12015-NDLS-JP");
  });

  it("coerces fare from string to number", () => {
    const result = buildTrainFromBookingData({
      ...MINIMAL_DATA,
      fare: "1245",
    });
    expect(result!.price).toBe(1245);
  });

  it("handles fare as number type", () => {
    const result = buildTrainFromBookingData({
      ...MINIMAL_DATA,
      fare: 1245,
    });
    expect(result!.price).toBe(1245);
  });

  it("defaults to 0 for NaN fare", () => {
    const result = buildTrainFromBookingData({
      ...MINIMAL_DATA,
      fare: "not-a-number",
    });
    expect(result!.price).toBe(0);
  });

  it("sets defaults for optional boolean/number fields", () => {
    const result = buildTrainFromBookingData(MINIMAL_DATA);
    expect(result!.available).toBe(1);
    expect(result!.probability).toBe(100);
    expect(result!.isSuperfast).toBe(false);
    expect(result!.rating).toBe(4);
  });
});

/* ─── buildQueryFromBookingData ────────────────────────────── */

describe("buildQueryFromBookingData", () => {
  it("uses from and to when available", () => {
    const result = buildQueryFromBookingData({
      from: "Delhi",
      fromCode: "NDLS",
      to: "Jaipur",
      toCode: "JP",
      date: "2026-08-15",
    });
    expect(result.origin).toBe("Delhi");
    expect(result.destination).toBe("Jaipur");
    expect(result.date).toBe("2026-08-15");
    expect(result.raw).toContain("NDLS");
    expect(result.raw).toContain("JP");
    expect(result.raw).toContain("2026-08-15");
  });

  it("falls back to station codes when names are missing", () => {
    const result = buildQueryFromBookingData({
      fromCode: "NDLS",
      toCode: "JP",
      date: "2026-08-15",
    });
    expect(result.origin).toBe("NDLS");
    expect(result.destination).toBe("JP");
  });

  it("uses em-dash for missing fields", () => {
    const result = buildQueryFromBookingData({});
    expect(result.origin).toBe("—");
    expect(result.destination).toBe("—");
    expect(result.date).toBe("—");
  });

  it("builds raw string correctly", () => {
    const result = buildQueryFromBookingData({
      from: "New Delhi",
      fromCode: "NDLS",
      to: "Mumbai",
      toCode: "BCT",
      date: "2026-08-15",
    });
    expect(result.raw).toBe("NDLS to BCT on 2026-08-15");
  });
});
