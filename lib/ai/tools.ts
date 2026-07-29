/* ══════════════════════════════════════════════════════════════
   Raily AI — Tool Calling System
   
   Every RAPI endpoint is exposed as a callable tool.
   The LLM decides which tools to call based on user intent.
   Tools are the ONLY way the AI accesses railway data.
   ══════════════════════════════════════════════════════════════ */

import * as rapi from "@/lib/rapi/endpoints";
import { transformTrainEntry, transformPNR, transformLiveStatus, transformAvailability } from "@/lib/rapi/transform";
import { toRapiDate } from "@/lib/rapi/endpoints";
import type { AIToolDefinition, ToolResult, AIMessage } from "./types";

/* ─── Tool Definitions ───────────────────────────────────── */

export const RAILWAY_TOOLS: AIToolDefinition[] = [
  {
    type: "function",
    function: {
      name: "search_stations",
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
      name: "search_trains",
      description: "Search for trains between two stations on a given date. Returns train numbers, names, departure/arrival times, duration, and running days. Use this to find available trains for a journey.",
      strict: true,
      parameters: {
        type: "object",
        properties: {
          from: { type: "string", description: "Source station code (e.g. 'NDLS', 'BCT', 'JP')" },
          to: { type: "string", description: "Destination station code (e.g. 'NDLS', 'BCT', 'JP')" },
          date: { type: "string", description: "Date of journey in YYYY-MM-DD format", default: "today" },
        },
        required: ["from", "to"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_train_info",
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
      name: "get_live_status",
      description: "Get real-time running status of a train, including current location, delay, speed, and the full station timeline. Use this to track a journey.",
      strict: true,
      parameters: {
        type: "object",
        properties: {
          trainNumber: { type: "string", description: "5-digit train number (e.g. '12951')" },
          date: { type: "string", description: "Date in YYYY-MM-DD format (optional, defaults to today)", default: "" },
        },
        required: ["trainNumber"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_availability",
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
      name: "get_pnr_status",
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
      name: "get_fare",
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
      name: "get_health",
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
];

/* ─── Tool Execution Engine ──────────────────────────────── */

export async function executeTool(
  toolName: string,
  args: Record<string, unknown>,
  toolCallId: string
): Promise<ToolResult> {
  try {
    switch (toolName) {
      case "search_stations": {
        const result = await rapi.searchStations(args.query as string);
        return {
          success: true,
          data: result.success ? result.data : { stations: [], query: args.query, total: 0 },
          toolCallId,
          toolName,
        };
      }

      case "search_trains": {
        const from = args.from as string;
        const to = args.to as string;
        const date = args.date ? toRapiDate(args.date as string) : undefined;
        const result = await rapi.searchTrains(from, to, date);
        return {
          success: true,
          data: result.success
            ? {
                from,
                to,
                date: args.date || "today",
                total: result.data?.total || 0,
                trains: (result.data?.trains || []).map(transformTrainEntry),
              }
            : { from, to, date: args.date || "today", total: 0, trains: [] },
          toolCallId,
          toolName,
        };
      }

      case "get_train_info": {
        const result = await rapi.getTrainInfo(args.trainNumber as string);
        return {
          success: result.success,
          data: result.success ? result.data : null,
          error: result.success ? undefined : (result.error || "Train info not found"),
          toolCallId,
          toolName,
        };
      }

      case "get_live_status": {
        const date = args.date ? toRapiDate(args.date as string) : undefined;
        const result = await rapi.getLiveStatus(args.trainNumber as string, date);
        return {
          success: result.success,
          data: result.success ? transformLiveStatus(result.data!) : null,
          error: result.success ? undefined : (result.error || "Live status not available"),
          toolCallId,
          toolName,
        };
      }

      case "get_availability": {
        const date = toRapiDate(args.date as string);
        const result = await rapi.getAvailability(
          args.trainNumber as string,
          args.from as string,
          args.to as string,
          date
        );
        return {
          success: result.success,
          data: result.success ? { ...result.data, classes: transformAvailability(result.data!) } : null,
          error: result.success ? undefined : (result.error || "Availability not available"),
          toolCallId,
          toolName,
        };
      }

      case "get_pnr_status": {
        const result = await rapi.getPNRStatus(args.pnr as string);
        return {
          success: result.success,
          data: result.success ? transformPNR(result.data!) : null,
          error: result.success ? undefined : (result.error || "PNR not found"),
          toolCallId,
          toolName,
        };
      }

      case "get_fare": {
        const date = toRapiDate(args.date as string);
        const result = await rapi.getFare(
          args.trainNumber as string,
          args.from as string,
          args.to as string,
          date
        );
        return {
          success: result.success,
          data: result.success ? result.data : null,
          error: result.success ? undefined : (result.error || "Fare not available"),
          toolCallId,
          toolName,
        };
      }

      case "get_health": {
        const result = await rapi.getHealth();
        return {
          success: true,
          data: result.success ? result.data : { status: "unreachable" },
          toolCallId,
          toolName,
        };
      }

      default:
        return {
          success: false,
          error: `Unknown tool: ${toolName}`,
          toolCallId,
          toolName,
        };
    }
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || `Tool ${toolName} execution failed`,
      toolCallId,
      toolName,
    };
  }
}

/* ─── Tool Result Formatter ──────────────────────────────── */

export function formatToolResultForPrompt(result: ToolResult): string {
  if (!result.success) {
    return `[Tool ${result.toolName} failed: ${result.error}]`;
  }

  // Format based on tool type for LLM consumption
  const data = result.data as Record<string, unknown> | null;
  if (!data) return `[Tool ${result.toolName} returned no data]`;

  return JSON.stringify(data, null, 2);
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
    lower.includes("show_train_list") ||
    lower.includes("show_seat_map") ||
    lower.includes("show_booking") ||
    lower.includes("show_journey") ||
    lower.includes("show_pnr") ||
    lower.includes("show_booking_history") ||
    lower.includes("search") ||
    lower.includes("check") ||
    lower.includes("track")
  );
}