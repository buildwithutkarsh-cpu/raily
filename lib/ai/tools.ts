/* ══════════════════════════════════════════════════════════════
   Raily AI — Tool Calling System
   
   Every action is a tool. The LLM NEVER claims success without
   a tool confirming it. Every tool returns a standardized
   response that the LLM reasons over.
   
   Tool Result Contract:
   - success: true  → AI may confirm the action
   - success: false → AI must explain the failure
   - Tool not called → AI never mentions it
   ══════════════════════════════════════════════════════════════ */

import * as rapi from "@/lib/rapi/endpoints";
import { transformTrainEntry, transformPNR, transformLiveStatus, transformAvailability } from "@/lib/rapi/transform";
import { toRapiDate } from "@/lib/rapi/endpoints";
import type { AIToolDefinition, ToolResult, AIMessage, StandardToolResponse } from "./types";

/* ─── Helpers ──────────────────────────────────────────────── */

const PNR_FIRST_DIGITS = [4, 6, 8];

function generatePNR(trainNumber: string, coach: string, seatId: string | null): string {
  const now = new Date();
  const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}`;
  const raw = `${trainNumber}|${dateStr}|${coach}|${seatId || "-"}`;
  let hash = 0;
  for (let i = 0; i < raw.length; i++) { const char = raw.charCodeAt(i); hash = ((hash << 5) - hash) + char; hash |= 0; }
  const absHash = Math.abs(hash);
  const nineDigits = absHash % 1_000_000_000;
  const firstDigit = PNR_FIRST_DIGITS[absHash % PNR_FIRST_DIGITS.length];
  return `${firstDigit}${String(nineDigits).padStart(9, "0")}`;
}

/** Create a standardized success response */
function success(data: Record<string, unknown>, message: string): StandardToolResponse {
  return { success: true, data, message, error: null };
}

/** Create a standardized failure response */
function failure(code: string, message: string): StandardToolResponse {
  return { success: false, data: null, message: "", error: { code, message } };
}

/** Convert StandardToolResponse to ToolResult */
function toToolResult(resp: StandardToolResponse, toolCallId: string, toolName: string): ToolResult {
  return {
    success: resp.success,
    data: resp.success ? resp.data : null,
    error: resp.success ? undefined : resp.error?.message,
    toolCallId,
    toolName,
  };
}

/** Execute a fetch with timeout */
async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs = 15_000): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    return response;
  } finally {
    clearTimeout(timeout);
  }
}

/** Retry wrapper for transient failures */
async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 2,
  baseDelay = 1_000
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err: unknown) {
      lastError = err;
      if (attempt < maxRetries) {
        const delay = baseDelay * Math.pow(2, attempt);
        await new Promise((r) => setTimeout(r, delay));
      }
    }
  }
  throw lastError;
}

/* ─── Tool Definitions ───────────────────────────────────── */

export const RAILWAY_TOOLS: AIToolDefinition[] = [
  {
    type: "function",
    function: {
      name: "searchStations",
      description: "Search for Indian railway stations by name or code. Returns station code, name, state, and zone. Use this to find station codes for train search.",
      strict: true,
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Station name or code to search for (e.g. 'Delhi', 'NDLS', 'Mumbai')" },
        },
        required: ["query"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "searchTrains",
      description: "Search for trains between two stations on a given date. Returns train numbers, names, departure/arrival times, duration, and running days. Use this to find available trains for a journey.",
      strict: true,
      parameters: {
        type: "object",
        properties: {
          from: { type: "string", description: "Source station code (e.g. 'NDLS', 'BCT', 'JP')" },
          to: { type: "string", description: "Destination station code (e.g. 'NDLS', 'BCT', 'JP')" },
          date: { type: "string", description: "Date of journey in YYYY-MM-DD format (use today's date if not specified)" },
        },
        required: ["from", "to", "date"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "getTrainInfo",
      description: "Get detailed information about a train including its full route, schedule, and type. Use this to show the complete route of a train.",
      strict: true,
      parameters: {
        type: "object",
        properties: {
          trainNumber: { type: "string", description: "5-digit train number (e.g. '12951', '12015')" },
        },
        required: ["trainNumber"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "getLiveStatus",
      description: "Get real-time running status of a train, including current location, delay, speed, and the full station timeline. Use this to track a journey.",
      strict: true,
      parameters: {
        type: "object",
        properties: {
          trainNumber: { type: "string", description: "5-digit train number (e.g. '12951')" },
          date: { type: "string", description: "Date in YYYY-MM-DD format (use today's date if not specified)" },
        },
        required: ["trainNumber", "date"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "getAvailability",
      description: "Check seat availability and fare for a specific train between two stations. Returns class-wise availability, fare, and status.",
      strict: true,
      parameters: {
        type: "object",
        properties: {
          trainNumber: { type: "string", description: "5-digit train number" },
          from: { type: "string", description: "Source station code" },
          to: { type: "string", description: "Destination station code" },
          date: { type: "string", description: "Date in YYYY-MM-DD format" },
        },
        required: ["trainNumber", "from", "to", "date"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "getPnrStatus",
      description: "Check the status of a PNR (Passenger Name Record) number. Returns passenger details, booking status, coach/berth info, and journey details.",
      strict: true,
      parameters: {
        type: "object",
        properties: {
          pnr: { type: "string", description: "10-digit PNR number" },
        },
        required: ["pnr"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "getFare",
      description: "Get fare details for a specific train between two stations. Returns class-wise fare breakdown including base fare, reservation charges, and total.",
      strict: true,
      parameters: {
        type: "object",
        properties: {
          trainNumber: { type: "string", description: "5-digit train number" },
          from: { type: "string", description: "Source station code" },
          to: { type: "string", description: "Destination station code" },
          date: { type: "string", description: "Date in YYYY-MM-DD format" },
        },
        required: ["trainNumber", "from", "to", "date"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "getHealth",
      description: "Check if the RAPI railway data server is connected and healthy. Use this to verify backend connectivity.",
      strict: true,
      parameters: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "downloadTicketPdf",
      description: "Generate and download a PDF ticket for a confirmed booking. The ticket is downloaded directly in the browser. Only call this tool AFTER the booking is confirmed (after confirmBooking succeeds). Returns the ticket details and triggers the browser download.",
      strict: true,
      parameters: {
        type: "object",
        properties: {
          pnr: { type: "string", description: "10-digit PNR number from the confirmed booking" },
          trainName: { type: "string", description: "Train name (e.g. 'Mumbai Rajdhani')" },
          trainNumber: { type: "string", description: "5-digit train number" },
          from: { type: "string", description: "Source station name" },
          fromCode: { type: "string", description: "Source station code" },
          to: { type: "string", description: "Destination station name" },
          toCode: { type: "string", description: "Destination station code" },
          date: { type: "string", description: "Journey date" },
          departure: { type: "string", description: "Departure time" },
          arrival: { type: "string", description: "Arrival time" },
          duration: { type: "string", description: "Travel duration" },
          coach: { type: "string", description: "Coach number (e.g. 'B1')" },
          seat: { type: "string", description: "Seat number (e.g. '7')" },
          tier: { type: "string", description: "Berth tier (e.g. 'Lower', 'Upper')" },
          fare: { type: "string", description: "Total fare in INR (e.g. '1245')" },
          class: { type: "string", description: "Travel class (e.g. '3A', 'SL')" },
          passengerName: { type: "string", description: "Passenger name" },
        },
        required: ["pnr", "trainName", "trainNumber", "from", "fromCode", "to", "toCode", "date", "departure", "arrival", "duration", "coach", "seat", "tier", "fare", "class", "passengerName"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "sendTicketEmail",
      description: "Send the ticket PDF to an email address. Requires the booking to be confirmed first. Only call this tool AFTER the booking is confirmed (after confirmBooking succeeds) and the user has provided their email address.",
      strict: true,
      parameters: {
        type: "object",
        properties: {
          email: { type: "string", description: "Recipient email address" },
          pnr: { type: "string", description: "10-digit PNR number from the confirmed booking" },
          trainName: { type: "string", description: "Train name" },
          trainNumber: { type: "string", description: "5-digit train number" },
          from: { type: "string", description: "Source station name" },
          fromCode: { type: "string", description: "Source station code" },
          to: { type: "string", description: "Destination station name" },
          toCode: { type: "string", description: "Destination station code" },
          date: { type: "string", description: "Journey date" },
          departure: { type: "string", description: "Departure time" },
          arrival: { type: "string", description: "Arrival time" },
          duration: { type: "string", description: "Travel duration" },
          coach: { type: "string", description: "Coach number" },
          seat: { type: "string", description: "Seat number" },
          tier: { type: "string", description: "Berth tier" },
          fare: { type: "string", description: "Total fare in INR (e.g. '1245')" },
          class: { type: "string", description: "Travel class" },
          passengerName: { type: "string", description: "Passenger name" },
        },
        required: ["email", "pnr", "trainName", "trainNumber", "from", "fromCode", "to", "toCode", "date", "departure", "arrival", "duration", "coach", "seat", "tier", "fare", "class", "passengerName"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "confirmBooking",
      description: "Confirm and finalize a ticket booking. Generates a PNR number, saves the booking record, and returns confirmation details. Only call this after the user has selected a train, coach, and seat. The user must have explicitly agreed to book.",
      strict: true,
      parameters: {
        type: "object",
        properties: {
          trainName: { type: "string", description: "Train name (e.g. 'Mumbai Rajdhani')" },
          trainNumber: { type: "string", description: "5-digit train number" },
          from: { type: "string", description: "Source station name (e.g. 'Delhi')" },
          fromCode: { type: "string", description: "Source station code (e.g. 'NDLS')" },
          to: { type: "string", description: "Destination station name" },
          toCode: { type: "string", description: "Destination station code" },
          date: { type: "string", description: "Journey date" },
          departure: { type: "string", description: "Departure time" },
          arrival: { type: "string", description: "Arrival time" },
          duration: { type: "string", description: "Travel duration" },
          coach: { type: "string", description: "Coach number (e.g. 'B1')" },
          seat: { type: "string", description: "Seat number (e.g. '7')" },
          tier: { type: "string", description: "Berth tier (e.g. 'Lower')" },
          fare: { type: "string", description: "Total fare in INR (e.g. '1245')" },
          class: { type: "string", description: "Travel class (e.g. '3A')" },
          passengerName: { type: "string", description: "Passenger name (default 'Primary Passenger')" },
        },
        required: ["trainName", "trainNumber", "from", "fromCode", "to", "toCode", "date", "departure", "arrival", "duration", "coach", "seat", "tier", "fare", "class", "passengerName"],
        additionalProperties: false,
      },
    },
  },
];

/* ─── Tool Execution Engine ──────────────────────────────── */

export async function executeTool(
  toolName: string,
  args: Record<string, unknown>,
  toolCallId: string
): Promise<ToolResult> {
  try {
    let result: StandardToolResponse;

    switch (toolName) {
      case "searchStations":
        result = await handleSearchStations(args);
        break;

      case "searchTrains":
        result = await handleSearchTrains(args);
        break;

      case "getTrainInfo":
        result = await handleGetTrainInfo(args);
        break;

      case "getLiveStatus":
        result = await handleGetLiveStatus(args);
        break;

      case "getAvailability":
        result = await handleGetAvailability(args);
        break;

      case "getPnrStatus":
        result = await handleGetPNRStatus(args);
        break;

      case "getFare":
        result = await handleGetFare(args);
        break;

      case "getHealth":
        result = await handleGetHealth();
        break;

      case "downloadTicketPdf":
        result = await handleDownloadTicketPDF(args);
        break;

      case "sendTicketEmail":
        result = await handleSendTicketEmail(args);
        break;

      case "confirmBooking":
        result = await handleConfirmBooking(args);
        break;

      default:
        result = failure("UNKNOWN_TOOL", `Unknown tool: ${toolName}`);
    }

    return toToolResult(result, toolCallId, toolName);
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : `Tool ${toolName} execution failed`,
      toolCallId,
      toolName,
    };
  }
}

/* ─── Tool Handlers ────────────────────────────────────────── */

async function handleSearchStations(args: Record<string, unknown>): Promise<StandardToolResponse> {
  const query = args.query as string;
  if (!query || typeof query !== "string" || query.trim().length === 0) {
    return failure("INVALID_INPUT", "Station search query is required");
  }

  return withRetry(async () => {
    const result = await rapi.searchStations(query.trim());
    if (result.success && result.data) {
      return success(
        { stations: result.data.stations, query: result.data.query, total: result.data.total },
        `Found ${result.data.total} station(s) matching "${query}"`
      );
    }
    return failure("NOT_FOUND", result.error || `No stations found matching "${query}"`);
  });
}

async function handleSearchTrains(args: Record<string, unknown>): Promise<StandardToolResponse> {
  const from = (args.from as string)?.toUpperCase();
  const to = (args.to as string)?.toUpperCase();
  const date = args.date ? toRapiDate(args.date as string) : undefined;

  if (!from || !to) {
    return failure("INVALID_INPUT", "Both 'from' and 'to' station codes are required");
  }

  return withRetry(async () => {
    const result = await rapi.searchTrains(from, to, date);
    if (result.success && result.data) {
      const trains = (result.data.trains || []).map(transformTrainEntry);
      return success(
        { from, to, date: args.date || "today", total: result.data.total || trains.length, trains },
        `Found ${trains.length} train(s) from ${from} to ${to}`
      );
    }
    return failure("NOT_FOUND", result.error || `No trains found from ${from} to ${to}`);
  });
}

async function handleGetTrainInfo(args: Record<string, unknown>): Promise<StandardToolResponse> {
  const trainNumber = args.trainNumber as string;
  if (!trainNumber || trainNumber.length < 5) {
    return failure("INVALID_INPUT", "A valid 5-digit train number is required");
  }

  return withRetry(async () => {
    const result = await rapi.getTrainInfo(trainNumber);
    if (result.success && result.data) {
      return success(
        result.data as unknown as Record<string, unknown>,
        `Train ${trainNumber} information retrieved`
      );
    }
    return failure("NOT_FOUND", result.error || `Train ${trainNumber} not found`);
  });
}

async function handleGetLiveStatus(args: Record<string, unknown>): Promise<StandardToolResponse> {
  const trainNumber = args.trainNumber as string;
  const date = args.date ? toRapiDate(args.date as string) : undefined;

  if (!trainNumber) {
    return failure("INVALID_INPUT", "Train number is required");
  }

  return withRetry(async () => {
    const result = await rapi.getLiveStatus(trainNumber, date);
    if (result.success && result.data) {
      const transformed = transformLiveStatus(result.data);
      return success(
        transformed as unknown as Record<string, unknown>,
        `Live status for train ${trainNumber} retrieved`
      );
    }
    return failure("NOT_FOUND", result.error || `Live status not available for train ${trainNumber}`);
  });
}

async function handleGetAvailability(args: Record<string, unknown>): Promise<StandardToolResponse> {
  const trainNumber = args.trainNumber as string;
  const from = (args.from as string)?.toUpperCase();
  const to = (args.to as string)?.toUpperCase();
  const date = toRapiDate(args.date as string);

  if (!trainNumber || !from || !to) {
    return failure("INVALID_INPUT", "Train number, from station, and to station are required");
  }

  return withRetry(async () => {
    const result = await rapi.getAvailability(trainNumber, from, to, date);
    if (result.success && result.data) {
      const classes = transformAvailability(result.data);
      return success(
        { ...result.data, classes } as unknown as Record<string, unknown>,
        `Availability for train ${trainNumber} retrieved`
      );
    }
    return failure("NOT_FOUND", result.error || `Availability not available for train ${trainNumber}`);
  });
}

async function handleGetPNRStatus(args: Record<string, unknown>): Promise<StandardToolResponse> {
  const pnr = args.pnr as string;
  if (!pnr || pnr.length !== 10) {
    return failure("INVALID_INPUT", "A valid 10-digit PNR number is required");
  }

  return withRetry(async () => {
    const result = await rapi.getPNRStatus(pnr);
    if (result.success && result.data) {
      const transformed = transformPNR(result.data);
      return success(
        transformed as unknown as Record<string, unknown>,
        `PNR ${pnr} status retrieved`
      );
    }
    return failure("NOT_FOUND", result.error || `PNR ${pnr} not found`);
  });
}

async function handleGetFare(args: Record<string, unknown>): Promise<StandardToolResponse> {
  const trainNumber = args.trainNumber as string;
  const from = (args.from as string)?.toUpperCase();
  const to = (args.to as string)?.toUpperCase();
  const date = toRapiDate(args.date as string);

  if (!trainNumber || !from || !to) {
    return failure("INVALID_INPUT", "Train number, from station, and to station are required");
  }

  return withRetry(async () => {
    const result = await rapi.getFare(trainNumber, from, to, date);
    if (result.success && result.data) {
      return success(
        result.data as unknown as Record<string, unknown>,
        `Fare for train ${trainNumber} retrieved`
      );
    }
    return failure("NOT_FOUND", result.error || `Fare not available for train ${trainNumber}`);
  });
}

async function handleGetHealth(): Promise<StandardToolResponse> {
  try {
    const result = await rapi.getHealth();
    if (result.success && result.data) {
      return success(
        result.data as unknown as Record<string, unknown>,
        "RAPI server is connected and healthy"
      );
    }
    return success({ status: "unreachable" }, "RAPI server is unreachable");
  } catch {
    return success({ status: "unreachable" }, "RAPI server is unreachable");
  }
}

async function handleDownloadTicketPDF(args: Record<string, unknown>): Promise<StandardToolResponse> {
  const required = ["pnr", "trainName", "trainNumber", "from", "fromCode", "to", "toCode", "date", "departure", "arrival", "coach", "seat", "tier", "fare", "class", "passengerName"];
  for (const field of required) {
    if (!args[field]) {
      return failure("INVALID_INPUT", `Missing required field: ${field}`);
    }
  }

  try {
    // Call the ticket/send API with the download flag
    const response = await fetchWithTimeout("/api/ticket/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "download@raily.app", // Special flag for download
        pnr: args.pnr,
        trainName: args.trainName,
        trainNumber: args.trainNumber,
        from: args.from,
        fromCode: args.fromCode,
        to: args.to,
        toCode: args.toCode,
        date: args.date,
        departure: args.departure,
        arrival: args.arrival,
        duration: args.duration || "",
        coach: args.coach,
        seat: args.seat,
        tier: args.tier,
        fare: Number(args.fare),
        class: args.class,
        passengerName: args.passengerName || "Passenger",
      }),
    }, 30_000); // 30s timeout for PDF generation

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      return failure(
        body?.error?.code || "DOWNLOAD_FAILED",
        body?.error?.message || `Failed to generate PDF (${response.status})`
      );
    }

    // Get the blob and trigger browser download
    const blob = await response.blob();
    const filename = `ticket-${args.pnr}.pdf`;
    const blobUrl = URL.createObjectURL(blob);

    // Create an anchor and trigger download
    const anchor = document.createElement("a");
    anchor.href = blobUrl;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);

    // Clean up the blob URL after a delay
    setTimeout(() => URL.revokeObjectURL(blobUrl), 10_000);

    return success(
      {
        pnr: args.pnr as string,
        trainName: args.trainName as string,
        trainNumber: args.trainNumber as string,
        filename,
      },
      `PDF ticket for ${args.trainName} (${args.pnr}) has been downloaded successfully`
    );
  } catch (err: unknown) {
    return failure(
      "DOWNLOAD_FAILED",
      err instanceof Error ? err.message : "Failed to download ticket PDF. The PDF service may be unavailable."
    );
  }
}

async function handleSendTicketEmail(args: Record<string, unknown>): Promise<StandardToolResponse> {
  const email = args.email as string;
  if (!email || !email.includes("@")) {
    return failure("INVALID_INPUT", "A valid email address is required");
  }

  const required = ["pnr", "trainName", "trainNumber", "from", "fromCode", "to", "toCode", "date", "departure", "arrival", "coach", "seat", "tier", "fare", "class", "passengerName"];
  for (const field of required) {
    if (!args[field]) {
      return failure("INVALID_INPUT", `Missing required field: ${field}`);
    }
  }

  try {
    const response = await fetchWithTimeout("/api/ticket/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        pnr: args.pnr,
        trainName: args.trainName,
        trainNumber: args.trainNumber,
        from: args.from,
        fromCode: args.fromCode,
        to: args.to,
        toCode: args.toCode,
        date: args.date,
        departure: args.departure,
        arrival: args.arrival,
        duration: args.duration || "",
        coach: args.coach,
        seat: args.seat,
        tier: args.tier,
        fare: Number(args.fare),
        class: args.class,
        passengerName: args.passengerName || "Passenger",
      }),
    }, 30_000);

    const body = await response.json();

    if (!response.ok || !body.success) {
      return failure(
        body?.error?.code || "EMAIL_FAILED",
        body?.error?.message || "Failed to send ticket email"
      );
    }

    return success(
      { pnr: args.pnr as string, email },
      `Ticket PDF has been sent to ${email}`
    );
  } catch (err: unknown) {
    return failure(
      "EMAIL_FAILED",
      err instanceof Error ? err.message : "Failed to send ticket email. The email service may be unavailable."
    );
  }
}

async function handleConfirmBooking(args: Record<string, unknown>): Promise<StandardToolResponse> {
  const required = ["trainName", "trainNumber", "from", "to", "date", "coach", "seat", "tier", "fare", "class"];
  for (const field of required) {
    if (!args[field]) {
      return failure("INVALID_INPUT", `Missing required field: ${field}`);
    }
  }

  const trainNumber = args.trainNumber as string;
  const coach = args.coach as string;
  const seat = args.seat as string;

  // Generate PNR
  const pnr = generatePNR(trainNumber, coach, seat);
  const passengerName = (args.passengerName as string) || "Primary Passenger";
  const bookingTime = new Date().toISOString();

  // Save to localStorage
  try {
    if (typeof window !== "undefined") {
      const RECENT_BOOKINGS_KEY = "railyRecentBookings";
      const existing = JSON.parse(localStorage.getItem(RECENT_BOOKINGS_KEY) || "[]");
      const filtered = existing.filter((b: { pnr: string }) => b.pnr !== pnr);
      const updated = [{
        pnr,
        trainName: args.trainName,
        trainNumber,
        from: (args.fromCode as string) || (args.from as string),
        to: (args.toCode as string) || (args.to as string),
        date: args.date,
        time: `${args.departure} → ${args.arrival}`,
        status: "CONFIRMED",
        timestamp: bookingTime,
      }, ...filtered].slice(0, 5);
      localStorage.setItem(RECENT_BOOKINGS_KEY, JSON.stringify(updated));
    }
  } catch {
    // localStorage might not be available
  }

  return success(
    {
      pnr,
      trainName: args.trainName as string,
      trainNumber,
      from: args.from as string,
      fromCode: args.fromCode as string || "",
      to: args.to as string,
      toCode: args.toCode as string || "",
      date: args.date as string,
      departure: args.departure as string,
      arrival: args.arrival as string,
      duration: args.duration as string || "",
      coach,
      seat,
      tier: args.tier as string,
      fare: Number(args.fare),
      class: args.class as string,
      passengerName,
      bookingTime,
      status: "CONFIRMED",
    },
    `Booking confirmed! PNR: ${pnr}. Your ticket on ${args.trainName} (${trainNumber}) from ${args.from} to ${args.to} is confirmed.`
  );
}

/* ─── Tool Result Formatter ──────────────────────────────── */

/**
 * Formats a tool result into a standardized JSON string for the LLM.
 * The LLM must only reason over this explicit format.
 *
 * Format:
 *   [TOOL: toolName]
 *   success: true/false
 *   data: { ... } or null
 *   error: { code, message } or null
 */
export function formatToolResultForPrompt(result: ToolResult): string {
  const lines: string[] = [
    `[TOOL: ${result.toolName}]`,
    `success: ${result.success}`,
  ];

  if (result.success && result.data !== undefined && result.data !== null) {
    // Limit serialized data to avoid token overflow
    const serialized = JSON.stringify(result.data);
    lines.push(`data: ${serialized.slice(0, 5000)}`);
  } else if (!result.success && result.error) {
    lines.push(`error: ${result.error}`);
  }

  return lines.join("\n");
}

/* ─── Tool Execution Helpers ─────────────────────────────── */

export function buildToolResultMessage(
  toolCallId: string,
  toolName: string,
  result: ToolResult
): AIMessage {
  return {
    role: "tool",
    content: formatToolResultForPrompt(result),
    tool_call_id: toolCallId,
    name: toolName,
  };
}

export function isToolExecutionNeeded(content: string): boolean {
  // Check if the response contains a tool call trigger
  const lower = content.toLowerCase();
  return (
    lower.includes("showTrainList") ||
    lower.includes("showSeatMap") ||
    lower.includes("showBooking") ||
    lower.includes("showJourney") ||
    lower.includes("showPnr") ||
    lower.includes("showBookingHistory") ||
    lower.includes("search") ||
    lower.includes("check") ||
    lower.includes("track")
  );
}
