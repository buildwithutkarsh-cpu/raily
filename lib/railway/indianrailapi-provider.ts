/* ══════════════════════════════════════════════════════════════
   RAILWAY — Indian Rail API Provider
   Supports both direct API key (indianrailapi.com) and
   RapidAPI (x-rapidapi-key + x-rapidapi-host) authentication.
   
   Docs: https://indianrailapi.com/api-collection
   RapidAPI: https://rapidapi.com/... (search "Indian Railways")
   ══════════════════════════════════════════════════════════════ */

import type { RailwayProvider, TrainSearchParams, SeatAvailabilityParams, FareParams } from "./provider";
import type {
  StationSearchResult,
  TrainSearchResult,
  TrainSearchEntry,
  SeatAvailability,
  PNRStatus,
  LiveStatus,
  FareEnquiry,
  CoachComposition,
  TrainSchedule,
} from "./types";
import { RailwayAPIError, RailwayRateLimitError } from "./client";

interface ProviderConfig {
  /** API key (used as `apikey` query param for direct API) */
  apiKey: string;
  /** RapidAPI host header value (set when using RapidAPI gateway) */
  rapidApiHost?: string;
  /** Base URL for the API */
  baseUrl?: string;
}

const DEFAULT_BASE_URL = "https://indianrailapi.com/api/v2";

export class IndianRailAPIProvider implements RailwayProvider {
  name = "Indian Railways API";
  private apiKey: string;
  private rapidApiHost: string | null;
  private baseUrl: string;
  private lastRequestTime = 0;
  private readonly minRequestInterval = 200; // 200ms between requests

  constructor(config: ProviderConfig) {
    this.apiKey = config.apiKey;
    this.rapidApiHost = config.rapidApiHost || null;

    // Auto-derive base URL from RapidAPI host, else use default or custom
    if (config.baseUrl) {
      this.baseUrl = config.baseUrl;
    } else if (this.rapidApiHost) {
      this.baseUrl = `https://${this.rapidApiHost}`;
    } else {
      this.baseUrl = DEFAULT_BASE_URL;
    }

    if (!this.apiKey) {
      console.warn(
        "[IndianRailAPIProvider] No API key provided. " +
        "Set RAILWAY_API_KEY environment variable."
      );
    }
  }

  /* ─── Station Search ──────────────────────────────────────── */

  async searchStations(query: string, limit = 10): Promise<StationSearchResult> {
    const data = await this.fetch<{
      data: Array<{ station_code: string; station_name: string; state?: string }>;
    }>("/stations/search", { query, limit: limit.toString() });

    return {
      stations: (data?.data || []).map((s) => ({
        code: s.station_code,
        name: s.station_name,
        state: s.state,
      })),
      total: data?.data?.length || 0,
      query,
    };
  }

  /* ─── Train Search ────────────────────────────────────────── */

  async searchTrains(params: TrainSearchParams): Promise<TrainSearchResult> {
    const data = await this.fetch<{
      data: Array<{
        train_number: string;
        train_name: string;
        source: { code: string; name: string };
        dest: { code: string; name: string };
        departure_time: string;
        arrival_time: string;
        travel_time: string;
        distance: number;
        classes: Array<{ code: string; name: string; available: boolean; fare?: number }>;
      }>;
    }>("/trains/between", {
      from: params.from,
      to: params.to,
      date: params.date,
    });

    const trains: TrainSearchEntry[] = (data?.data || []).map((t) => {
      const availableClasses = (t.classes || [])
        .filter((c) => c.available)
        .map((c) => ({
          code: c.code,
          name: c.name,
          available: c.available,
          fare: c.fare || 0,
          seats: 0,
          status: "AVAILABLE" as const,
        }));

      return {
        train: {
          number: t.train_number,
          name: t.train_name,
          type: inferTrainType(t.train_name, t.train_number),
          from: { code: t.source.code, name: t.source.name },
          to: { code: t.dest.code, name: t.dest.name },
          departure: t.departure_time,
          arrival: t.arrival_time,
          duration: t.travel_time,
          distance: t.distance,
          runningDays: [],
          classes: (t.classes || []).map((c) => ({
            code: c.code,
            name: c.name,
            available: c.available,
            fare: c.fare,
          })),
        },
        availableClasses,
      };
    });

    return {
      trains,
      total: trains.length,
      from: { code: params.from, name: "" },
      to: { code: params.to, name: "" },
      date: params.date,
    };
  }

  /* ─── Train Schedule ──────────────────────────────────────── */

  async getTrainSchedule(trainNumber: string): Promise<TrainSchedule> {
    const data = await this.fetch<{
      data: {
        train_number: string;
        train_name: string;
        route: Array<{
          station_code: string;
          station_name: string;
          arrival: string;
          departure: string;
          distance: number;
          day: number;
          platform?: string;
          halt?: string;
        }>;
      };
    }>(`/train/schedule`, { train: trainNumber });

    const route = data?.data?.route || [];
    const totalDistance = route.length > 0 ? route[route.length - 1].distance : 0;

    return {
      train: { number: trainNumber, name: data?.data?.train_name || "" },
      route: route.map((s) => ({
        station: { code: s.station_code, name: s.station_name },
        day: s.day,
        arrival: s.arrival,
        departure: s.departure,
        distance: s.distance,
        platform: s.platform,
        halt: s.halt || "-",
        zone: "",
      })),
      totalStops: route.length,
      totalDistance,
      duration: "",
    };
  }

  /* ─── Seat Availability ───────────────────────────────────── */

  async getSeatAvailability(params: SeatAvailabilityParams): Promise<SeatAvailability> {
    const data = await this.fetch<{
      data: {
        train_number: string;
        train_name?: string;
        classes: Array<{
          code: string;
          name: string;
          fare: number;
          available: number;
          total?: number;
          status?: string;
        }>;
      };
    }>("/train/seat-availability", {
      train: params.trainNumber,
      from: params.from,
      to: params.to,
      date: params.date,
      class: params.class || "ALL",
    });

    return {
      train: { number: params.trainNumber, name: data?.data?.train_name || "" },
      date: params.date,
      from: { code: params.from, name: "" },
      to: { code: params.to, name: "" },
      classes: (data?.data?.classes || []).map((c) => ({
        code: c.code,
        name: c.name,
        fare: c.fare,
        available: c.available,
        total: c.total || 100,
        status: c.available > 10 ? "AVAILABLE" : c.available > 0 ? "RAC" : "NOT_AVAILABLE",
      })),
      lastUpdated: new Date().toISOString(),
    };
  }

  /* ─── Fare ────────────────────────────────────────────────── */

  async getFare(params: FareParams): Promise<FareEnquiry> {
    const data = await this.fetch<{
      data: {
        base_fare?: number;
        total_fare?: number;
        classes: Array<{
          code: string;
          name: string;
          fare: number;
          reservation_charge?: number;
          superfast_charge?: number;
          convenience_fee?: number;
        }>;
      };
    }>("/train/fare", {
      train: params.trainNumber,
      from: params.from,
      to: params.to,
    });

    return {
      train: { number: params.trainNumber, name: "" },
      from: { code: params.from, name: "" },
      to: { code: params.to, name: "" },
      date: params.date || new Date().toISOString().split("T")[0],
      classes: (data?.data?.classes || []).map((c) => ({
        code: c.code,
        name: c.name,
        baseFare: c.fare,
        reservationCharge: c.reservation_charge || 0,
        superfastCharge: c.superfast_charge || 0,
        convenienceFee: c.convenience_fee || 0,
        totalFare: c.fare + (c.reservation_charge || 0) + (c.superfast_charge || 0) + (c.convenience_fee || 0),
        available: true,
      })),
      baseFare: data?.data?.base_fare || 0,
      totalFare: data?.data?.total_fare || 0,
      lastUpdated: new Date().toISOString(),
    };
  }

  /* ─── PNR Status ──────────────────────────────────────────── */

  async getPNRStatus(pnr: string): Promise<PNRStatus> {
    const data = await this.fetch<{
      data: {
        pnr: string;
        train_number: string;
        train_name: string;
        from: { code: string; name: string };
        to: { code: string; name: string };
        boarding_point?: { code: string; name: string };
        date: string;
        class: string;
        quota: string;
        chart_prepared: boolean;
        passengers: Array<{
          number: number;
          booking_status: string;
          current_status: string;
          coach?: string;
          berth?: string;
          seat?: string;
        }>;
        platform?: string;
      };
    }>("/pnr/check", { pnr });

    return {
      pnr: data?.data?.pnr || pnr,
      train: {
        number: data?.data?.train_number || "",
        name: data?.data?.train_name || "",
      },
      from: data?.data?.from || { code: "", name: "" },
      to: data?.data?.to || { code: "", name: "" },
      boardingAt: data?.data?.boarding_point || data?.data?.from || { code: "", name: "" },
      date: data?.data?.date || "",
      class: data?.data?.class || "",
      quota: data?.data?.quota || "GN",
      chartPrepared: data?.data?.chart_prepared || false,
      passengers: (data?.data?.passengers || []).map((p) => ({
        number: p.number,
        name: `Passenger ${p.number}`,
        age: 0,
        gender: "M",
        status: p.current_status,
        berth: p.berth ? `${p.coach}-${p.berth} (${p.seat || ""})`.trim() : undefined,
        coach: p.coach,
        seat: p.seat,
        bookingStatus: p.booking_status,
        currentStatus: p.current_status,
      })),
      status: inferPNRStatus(data?.data?.passengers?.[0]?.current_status || ""),
      departure: "",
      arrival: "",
      platform: data?.data?.platform,
      lastUpdated: new Date().toISOString(),
    };
  }

  /* ─── Live Status ─────────────────────────────────────────── */

  async getLiveStatus(trainNumber: string, station?: string): Promise<LiveStatus> {
    void station;
    const data = await this.fetch<{
      data: {
        train_number: string;
        train_name?: string;
        current_station?: { code: string; name: string };
        lateness: number;
        speed?: number;
        status?: string;
        position?: number;
        stations?: Array<{
          station_code: string;
          station_name: string;
          sch_arr: string;
          sch_dep: string;
          act_arr?: string;
          act_dep?: string;
          distance: number;
          day: number;
          platform?: string;
          delay?: number;
        }>;
      };
    }>("/train/live", { train: trainNumber });

    const stations = data?.data?.stations || [];

    return {
      train: { number: trainNumber, name: data?.data?.train_name || "" },
      currentStation: data?.data?.current_station || { code: "", name: "En Route" },
      lastUpdated: new Date().toISOString(),
      delay: data?.data?.lateness || 0,
      speed: data?.data?.speed || 0,
      status: data?.data?.status === "ONTIME" ? "ONTIME" : data?.data?.lateness > 15 ? "DELAYED" : "ONTIME",
      hasDeparted: true,
      distanceCovered: data?.data?.position || 0,
      totalDistance: stations.length > 0 ? stations[stations.length - 1].distance : 1000,
      position: data?.data?.position || 0,
      route: stations.map((s) => ({
        station: { code: s.station_code, name: s.station_name },
        scheduledArrival: s.sch_arr,
        scheduledDeparture: s.sch_dep,
        actualArrival: s.act_arr,
        actualDeparture: s.act_dep,
        distance: s.distance,
        day: s.day,
        platform: s.platform,
        delay: s.delay || 0,
        crossed: !!s.act_dep,
      })),
    };
  }

  /* ─── Coach Composition ───────────────────────────────────── */

  async getCoachComposition(trainNumber: string): Promise<CoachComposition> {
    const data = await this.fetch<{
      data: {
        train_number: string;
        train_name?: string;
        coaches: Array<{
          coach_number: string;
          coach_type: string;
          coach_class: string;
          position: number;
          total_berths: number;
          available_berths?: number;
        }>;
      };
    }>("/train/coaches", { train: trainNumber });

    return {
      train: { number: trainNumber, name: data?.data?.train_name || "" },
      coaches: (data?.data?.coaches || []).map((c) => ({
        number: c.coach_number,
        type: c.coach_type,
        class: c.coach_class,
        position: c.position,
        totalBerths: c.total_berths,
        availableBerths: c.available_berths,
      })),
      totalCoaches: data?.data?.coaches?.length || 0,
    };
  }

  /* ─── Health Check ────────────────────────────────────────── */

  async healthCheck(): Promise<boolean> {
    try {
      await this.fetch("/health", {}, 5000);
      return true;
    } catch {
      return false;
    }
  }

  /* ─── HTTP Client ─────────────────────────────────────────── */

  private async fetch<T>(
    path: string,
    params: Record<string, string> = {},
    timeoutMs = 10000
  ): Promise<T> {
    if (!this.apiKey) {
      throw new RailwayAPIError(
        "Railway API key not configured. Set the RAILWAY_API_KEY environment variable.",
        "NO_API_KEY",
        401
      );
    }

    // Rate limiting
    const now = Date.now();
    const elapsed = now - this.lastRequestTime;
    if (elapsed < this.minRequestInterval) {
      await this.sleep(this.minRequestInterval - elapsed);
    }
    this.lastRequestTime = Date.now();

    // Build URL
    const url = new URL(`${this.baseUrl}${path}`);

    // Build headers
    const headers: Record<string, string> = {
      Accept: "application/json",
    };

    if (this.rapidApiHost) {
      // RapidAPI auth: use headers
      headers["x-rapidapi-key"] = this.apiKey;
      headers["x-rapidapi-host"] = this.rapidApiHost;
    } else {
      // Direct API auth: pass apikey as query param
      url.searchParams.set("apikey", this.apiKey);
    }

    // Add query params
    Object.entries(params).forEach(([key, value]) => {
      if (value) url.searchParams.set(key, value);
    });

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url.toString(), {
        signal: controller.signal,
        headers,
      });

      if (response.status === 429) {
        const retryAfter = parseInt(response.headers.get("Retry-After") || "60", 10);
        throw new RailwayRateLimitError(retryAfter);
      }

      if (!response.ok) {
        const body = await response.text().catch(() => "");
        throw new RailwayAPIError(
          `API request failed: ${response.statusText}`,
          "API_ERROR",
          response.status,
          body
        );
      }

      return await response.json();
    } catch (err) {
      if (err instanceof RailwayAPIError || err instanceof RailwayRateLimitError) throw err;
      if ((err as Error).name === "AbortError") {
        throw new RailwayAPIError(`Request timed out: ${path}`, "TIMEOUT", 408);
      }
      throw new RailwayAPIError(
        err instanceof Error ? err.message : "Network error",
        "NETWORK_ERROR",
        0
      );
    } finally {
      clearTimeout(timeout);
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((r) => setTimeout(r, ms));
  }
}

/* ─── Helpers ──────────────────────────────────────────────── */

function inferTrainType(name: string, number: string): TrainSearchEntry["train"]["type"] {
  void number;
  const upper = name.toUpperCase();
  if (upper.includes("RAJDHANI")) return "RAJDHANI";
  if (upper.includes("SHATABDI")) return "SHATABDI";
  if (upper.includes("DURONTO")) return "DURONTO";
  if (upper.includes("GARIB")) return "GARIB_RATH";
  if (upper.includes("SUPERFAST")) return "SUPERFAST";
  return "EXPRESS";
}

function inferPNRStatus(status: string): PNRStatus["status"] {
  const upper = status.toUpperCase();
  if (upper === "CNF" || upper === "CONFIRMED" || upper.startsWith("CNF")) return "CONFIRMED";
  if (upper.startsWith("RAC")) return "RAC";
  if (upper.startsWith("WL") || upper.startsWith("WAITLIST")) return "WAITLIST";
  if (upper === "CANCELLED" || upper === "CAN") return "CANCELLED";
  return "WAITLIST";
}
