/* ══════════════════════════════════════════════════════════════
   Raily AI — Tool Calling System
   
   Every action is a tool. The LLM NEVER claims success without
   a tool confirming it. Every tool returns a standardized
   response with structured events.
   
   Tool Result Contract:
   - success: true  → AI may confirm the action
   - success: false → AI must explain the failure
   - Tool not called → AI never mentions it
   
   Event Contract:
   - Tools return { events: BrowserEvent[] } instead of DOM ops
   - Orchestrator validates events
   - Frontend executes events
   - AI describes completed actions only after event confirmation
   ══════════════════════════════════════════════════════════════ */

import * as rapi from "@/lib/rapi/endpoints";
import { transformTrainEntry, transformPNR, transformLiveStatus, transformAvailability } from "@/lib/rapi/transform";
import { toRapiDate } from "@/lib/rapi/endpoints";
import type {
  AIToolDefinition,
  ToolResult,
  AIMessage,
  StandardToolResponse,
  RequestId,
  RequestContext,
  BrowserEvent,
  DownloadPdfEvent,
} from "./types";
import { createLogger } from "./request-state";

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

let eventIdCounter = 0;
function nextEventId(): string {
  return `evt-${Date.now().toString(36)}-${++eventIdCounter}`;
}

/** Create a standardized success response */
function success(
  data: Record<string, unknown>,
  message: string,
  events?: BrowserEvent[]
): StandardToolResponse {
  return { success: true, data, message, error: null, events };
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
    events: resp.events,
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
      description: "RESOLVE station names to station codes. When a user says a station name like 'Delhi' or 'Mumbai', call this tool FIRST to get the official station code (like 'NDLS' or 'BCT'). Returns code, name, state, and zone. If the query matches multiple stations, present the options to the user.",
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
      description: "Search for trains between two stations on a given date. Requires station CODES (like 'NDLS', 'BCT', 'JP'). If you only have station NAMES (like 'Delhi', 'Mumbai'), you MUST call searchStations FIRST to resolve each name to a code. Never ask the user for the code — resolve it yourself.",
      strict: true,
      parameters: {
        type: "object",
        properties: {
          from: { type: "string", description: "Source station CODE (e.g. 'NDLS', 'BCT', 'JP'). Do NOT pass station names — resolve names to codes first via searchStations." },
          to: { type: "string", description: "Destination station CODE (e.g. 'NDLS', 'BCT', 'JP'). Do NOT pass station names — resolve names to codes first via searchStations." },
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
        required: [],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "downloadTicketPdf",
      description: "Prepare a PDF ticket for download. Validates that the ticket data can generate a valid PDF, then triggers a browser download. Only call this tool AFTER the booking is confirmed (after confirmBooking succeeds). IMPORTANT: success:true means the PDF data is VALID and ready for download — it does NOT mean the file has been saved to the user's device. The actual download happens in the browser automatically after this tool returns. If success:false, tell the user the PDF could not be generated.",
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
          fare: { type: "number", description: "Total fare in INR as a numeric amount (e.g. 1245)" },
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
      description: "Send the ticket PDF to an email address via Resend. REQUIRES: the booking to be confirmed first AND the RESEND_API_KEY to be configured server-side. Only call this tool AFTER confirmBooking succeeds AND the user has provided their email. success:true means the email was ACTUALLY sent (Resend confirmed delivery). success:false means it failed — tell the user exactly why (e.g. 'Email service not configured' or 'Invalid email address').",
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
          fare: { type: "number", description: "Total fare in INR as a numeric amount (e.g. 1245)" },
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
          fare: { type: "number", description: "Total fare in INR as a numeric amount (e.g. 1245)" },
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
  toolCallId: string,
  requestId?: RequestId
): Promise<ToolResult> {
  const log = requestId ? createLogger(requestId) : null;

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
        result = await handleDownloadTicketPDF(args, requestId);
        break;

      case "sendTicketEmail":
        result = await handleSendTicketEmail(args, requestId);
        break;

      case "confirmBooking":
        result = await handleConfirmBooking(args);
        break;

      default:
        log?.error(`Unknown tool called: ${toolName}`);
        result = failure("UNKNOWN_TOOL", `Unknown tool: ${toolName}`);
    }

    log?.info(`Tool ${toolName} completed: success=${result.success}, events=${result.events?.length || 0}`);
    return toToolResult(result, toolCallId, toolName);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : `Tool ${toolName} execution failed`;
    log?.error(`Tool ${toolName} threw: ${message}`);
    return {
      success: false,
      error: message,
      toolCallId,
      toolName,
      events: undefined,
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
  let rapiResult: { success: boolean; data?: unknown; error?: string };
  try {
    rapiResult = await rapi.getHealth();
  } catch (err: unknown) {
    // Health check failure — report as failure so the LLM knows
    return failure(
      "RAPI_UNREACHABLE",
      `RAPI server is unreachable: ${err instanceof Error ? err.message : "Connection failed"}`
    );
  }

  if (rapiResult.success) {
    return success(
      rapiResult.data as Record<string, unknown>,
      "RAPI server is connected and healthy"
    );
  }

  return failure(
    "RAPI_UNREACHABLE",
    rapiResult.error || "RAPI server is unreachable"
  );
}

/**
 * handleDownloadTicketPDF — proactively verifies the PDF CAN be generated
 * by calling /api/ticket/send with verify=true before returning success.
 * Only returns success:true if the API confirms PDF generation works.
 * Returns the BrowserEvent for the frontend to trigger the actual download.
 *
 * This prevents the LLM from claiming "PDF downloaded" when the API
 * endpoint is broken, pdfkit is misconfigured, or the data is invalid.
 */
async function handleDownloadTicketPDF(
  args: Record<string, unknown>,
  requestId?: RequestId
): Promise<StandardToolResponse> {
  const log = requestId ? createLogger(requestId) : null;

  const required = ["pnr", "trainName", "trainNumber", "from", "fromCode", "to", "toCode", "date", "departure", "arrival", "coach", "seat", "tier", "fare", "class", "passengerName"];
  for (const field of required) {
    if (!args[field]) {
      log?.error(`downloadTicketPDF missing field: ${field}`);
      return failure("INVALID_INPUT", `Missing required field: ${field}`);
    }
  }

  // ── STEP 1: Proactively verify PDF generation works ─────────
  // Call /api/ticket/send with verify=true — the API validates the data
  // and checks that pdfkit can generate the PDF, WITHOUT returning the
  // full PDF buffer (saves bandwidth).
  log?.info(`downloadTicketPDF: verifying PDF generation for PNR ${args.pnr}`);
  try {
    const verifyResponse = await fetchWithTimeout("/api/ticket/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...args,
        email: "download@raily.app",
        fare: Number(args.fare),
        duration: args.duration || "",
        passengerName: args.passengerName || "Passenger",
        verify: true, // ← tells the API to do a dry-run validation
      }),
    }, 15_000);

    const verifyBody = await verifyResponse.json();

    if (!verifyResponse.ok || !verifyBody.success) {
      const errorMsg = verifyBody?.error?.message || "PDF generation validation failed";
      log?.error(`downloadTicketPDF verification failed: ${errorMsg}`);
      return failure(
        verifyBody?.error?.code || "PDF_VERIFICATION_FAILED",
        `The ticket PDF could not be generated: ${errorMsg}. The booking is confirmed but the download is unavailable.`
      );
    }

    log?.info(`downloadTicketPDF: verification passed for PNR ${args.pnr}`);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Verification request failed";
    log?.error(`downloadTicketPDF verification threw: ${message}`);
    return failure(
      "PDF_VERIFICATION_FAILED",
      `Could not verify PDF generation: ${message}. The booking is confirmed but the download may not work.`
    );
  }

  // ── STEP 2: Build the download event ────────────────────────
  // Only reached if verification passed, so the actual download
  // fetch is very likely to succeed.
  const downloadEvent: DownloadPdfEvent = {
    type: "download-pdf",
    url: "/api/ticket/send",
    method: "POST",
    body: {
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
    },
    filename: `ticket-${args.pnr}.pdf`,
    eventId: nextEventId(),
  };

  log?.info(`downloadTicketPDF: verification passed, returning event ${downloadEvent.eventId} for PNR ${args.pnr}`);

  // NOTE: success:true means "PDF data is validated and ready for browser download"
  // It does NOT mean the file was saved to disk — that's async via BrowserEvent
  return success(
    {
      pnr: args.pnr as string,
      trainName: args.trainName as string,
      trainNumber: args.trainNumber as string,
      filename: downloadEvent.filename,
      verificationStatus: "passed",
    },
    `The PDF ticket for ${args.trainName} (${args.pnr}) has been validated and is being downloaded in your browser. If the download doesn't start automatically, check your browser's download settings.`,
    [downloadEvent]
  );
}

async function handleSendTicketEmail(
  args: Record<string, unknown>,
  requestId?: RequestId
): Promise<StandardToolResponse> {
  const log = requestId ? createLogger(requestId) : null;

  const email = args.email as string;
  if (!email || !email.includes("@")) {
    return failure("INVALID_INPUT", "A valid email address is required");
  }

  const required = ["pnr", "trainName", "trainNumber", "from", "fromCode", "to", "toCode", "date", "departure", "arrival", "coach", "seat", "tier", "fare", "class", "passengerName"];
  for (const field of required) {
    if (!args[field]) {
      log?.error(`sendTicketEmail missing field: ${field}`);
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
      log?.error(`sendTicketEmail failed: ${response.status} ${body?.error?.message || ""}`);
      return failure(
        body?.error?.code || "EMAIL_FAILED",
        body?.error?.message ? `Failed to send ticket email: ${body.error.message}` : "Failed to send ticket email"
      );
    }

    log?.info(`sendTicketEmail sent to ${email} for PNR ${args.pnr}`);
    return success(
      {
        pnr: args.pnr as string,
        email,
        emailId: body?.data?.emailId || null,
      },
      `Ticket PDF has been sent to ${email}. They should receive it within a few minutes.`
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to send ticket email";
    log?.error(`sendTicketEmail threw: ${message}`);
    return failure("EMAIL_FAILED", message);
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

  // Save to localStorage (fire-and-forget — failure is non-critical)
  saveBookingToLocalStorage({
    pnr,
    trainName: args.trainName as string,
    trainNumber,
    from: (args.fromCode as string) || (args.from as string),
    to: (args.toCode as string) || (args.to as string),
    date: args.date as string,
    time: `${args.departure} → ${args.arrival}`,
    status: "CONFIRMED",
    timestamp: bookingTime,
  });

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

/* ─── Local Storage Save (extracted for safety) ──────────── */

interface LocalBookingRecord {
  pnr: string;
  trainName: string;
  trainNumber: string;
  from: string;
  to: string;
  date: string;
  time: string;
  status: string;
  timestamp: string;
}

function saveBookingToLocalStorage(record: LocalBookingRecord): void {
  // localStorage is not always available (SSR, incognito restrictions, etc.)
  // This is best-effort — failure is non-critical
  if (typeof window === "undefined") return;

  try {
    const RECENT_BOOKINGS_KEY = "railyRecentBookings";
    const raw = localStorage.getItem(RECENT_BOOKINGS_KEY);
    let existing: LocalBookingRecord[] = [];
    try {
      existing = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(existing)) existing = [];
    } catch {
      // Corrupted localStorage — reset
      existing = [];
    }

    const filtered = existing.filter((b) => b.pnr !== record.pnr);
    const updated = [record, ...filtered].slice(0, 5);
    localStorage.setItem(RECENT_BOOKINGS_KEY, JSON.stringify(updated));
  } catch (err: unknown) {
    // localStorage might be full, disabled, or throw for other reasons
    // This is non-critical — the booking is still confirmed
    console.warn("[Tools] Failed to save booking to localStorage:", err instanceof Error ? err.message : String(err));
  }
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
