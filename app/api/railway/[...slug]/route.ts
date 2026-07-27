/* ══════════════════════════════════════════════════════════════
   RAILWAY — Next.js API Routes
   
   Proxy endpoints that sit between the frontend and the
   Railway API provider. API keys remain server-side only.
   
   Endpoints:
     GET /api/railway/stations?q=del
     GET /api/railway/trains?from=NDLS&to=JP&date=2026-07-28
     GET /api/railway/trains/[number]/schedule
     GET /api/railway/trains/[number]/seats?from=NDLS&to=JP&date=2026-07-28
     GET /api/railway/trains/[number]/coaches
     GET /api/railway/trains/[number]/live
     GET /api/railway/trains/[number]/fare?from=NDLS&to=JP
     GET /api/railway/pnr/[pnr]
     GET /api/railway/health
   ══════════════════════════════════════════════════════════════ */

import { NextRequest, NextResponse } from "next/server";
import { getRailwayClient } from "@/lib/railway/client";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/* ─── Route Handler ────────────────────────────────────────── */

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string[] }> }
) {
  const { searchParams } = request.nextUrl;
  const resolvedParams = await params;
  const slug = resolvedParams.slug;
  const path = slug.join("/");

  try {
    const client = getRailwayClient();

    switch (path) {
      /* ── Station Search ──────────────────────────────────── */
      case "stations": {
        const query = searchParams.get("q") || searchParams.get("query") || "";
        if (!query) {
          return NextResponse.json(
            { error: { code: "INVALID_PARAMS", message: "Query parameter 'q' is required" } },
            { status: 400 }
          );
        }
        const limit = parseInt(searchParams.get("limit") || "10", 10);
        const result = await client.searchStations(query, limit);
        return NextResponse.json(result);
      }

      /* ── Train Search ────────────────────────────────────── */
      case "trains": {
        const from = searchParams.get("from") || "";
        const to = searchParams.get("to") || "";
        const date = searchParams.get("date") || "";
        const cls = searchParams.get("class") || undefined;

        if (!from || !to) {
          return NextResponse.json(
            { error: { code: "INVALID_PARAMS", message: "Parameters 'from' and 'to' are required" } },
            { status: 400 }
          );
        }

        const result = await client.searchTrains(from.toUpperCase(), to.toUpperCase(), date, cls);
        return NextResponse.json(result);
      }

      /* ── Train Schedule ──────────────────────────────────── */
      case `trains/${slug[1]}/schedule`:
      case `trains/${slug[1]}/seats`:
      case `trains/${slug[1]}/coaches`:
      case `trains/${slug[1]}/live`:
      case `trains/${slug[1]}/fare`: {
        const trainNumber = slug[1];

        if (path === `trains/${trainNumber}/schedule`) {
          const result = await client.getTrainSchedule(trainNumber);
          return NextResponse.json(result);
        }

        if (path === `trains/${trainNumber}/seats`) {
          const from = searchParams.get("from") || "";
          const to = searchParams.get("to") || "";
          const date = searchParams.get("date") || "";
          const cls = searchParams.get("class") || undefined;

          const result = await client.getSeatAvailability(trainNumber, from, to, date, cls);
          return NextResponse.json(result);
        }

        if (path === `trains/${trainNumber}/coaches`) {
          const result = await client.getCoachComposition(trainNumber);
          return NextResponse.json(result);
        }

        if (path === `trains/${trainNumber}/live`) {
          const result = await client.getLiveStatus(trainNumber);
          return NextResponse.json(result);
        }

        if (path === `trains/${trainNumber}/fare`) {
          const from = searchParams.get("from") || "";
          const to = searchParams.get("to") || "";
          const result = await client.getFare(trainNumber, from, to);
          return NextResponse.json(result);
        }

        return NextResponse.json(
          { error: { code: "NOT_FOUND", message: `Unknown endpoint: ${path}` } },
          { status: 404 }
        );
      }

      /* ── PNR Status ──────────────────────────────────────── */
      case `pnr/${slug[1]}`: {
        const pnr = slug[1];
        if (!/^\d{10}$/.test(pnr)) {
          return NextResponse.json(
            { error: { code: "INVALID_PNR", message: "PNR must be a 10-digit number" } },
            { status: 400 }
          );
        }
        const result = await client.getPNRStatus(pnr);
        return NextResponse.json(result);
      }

      /* ── Health Check ────────────────────────────────────── */
      case "health": {
        return NextResponse.json({
          success: true,
          provider: client.providerName,
          isMock: client.isMock,
          cacheStats: client.cacheStats,
          timestamp: new Date().toISOString(),
        });
      }

      default:
        return NextResponse.json(
          { error: { code: "NOT_FOUND", message: `Unknown endpoint: ${path}` } },
          { status: 404 }
        );
    }
  } catch (err) {
    console.error(`[Railway API] Error: ${err instanceof Error ? err.message : err}`);

    return NextResponse.json(
      {
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "An internal error occurred while fetching railway data.",
          status: 500,
        },
        cached: false,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

/* ─── Handle unsupported methods ────────────────────────────── */

export async function POST() {
  return NextResponse.json(
    { error: { code: "METHOD_NOT_ALLOWED", message: "POST method is not supported. Use GET." } },
    { status: 405 }
  );
}
