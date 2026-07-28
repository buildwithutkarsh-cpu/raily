/* ══════════════════════════════════════════════════════════════
   RAILWAY — IRCTC RapidAPI Provider (irctc1.p.rapidapi.com)
   Dedicated provider for the IRCTC RapidAPI by IRCTCAPI.
   
   Confirmed endpoints:
     GET /api/v1/searchStation?query=         → station search
     GET /api/v2/trainBetweenStations?fromStationCode=&toStationCode=&date=  → train search
     GET /api/v2/getFare?trainNo=&fromStationCode=&toStationCode=  → fare
   
   For PNR, live status, schedule, coach, and seat endpoints,
   common patterns are used. If they differ, adjust the paths below.
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
  apiKey: string;
  rapidApiHost: string;
  baseUrl?: string;
}

export class IRCTCRapidAPIProvider implements RailwayProvider {
  name = "IRCTC RapidAPI (irctc1.p.rapidapi.com)";
  private apiKey: string;
  private rapidApiHost: string;
  private baseUrl: string;
  private lastRequestTime = 0;
  private readonly minRequestInterval = 300;

  constructor(config: ProviderConfig) {
    this.apiKey = config.apiKey;
    this.rapidApiHost = config.rapidApiHost;
    this.baseUrl = config.baseUrl || `https://${config.rapidApiHost}`;
  }

  /* ─── Station Search ──────────────────────────────────────── */
  /* GET /api/v1/searchStation?query=NDLS                      */

  async searchStations(query: string, limit = 10): Promise<StationSearchResult> {
    const data = await this.fetch<{
      status: boolean;
      data: Array<{
        code: string;
        name: string;
        eng_name?: string;
        state_name?: string;
      }>;
    }>("/api/v1/searchStation", { query });

    const stations = (data?.data || []).slice(0, limit).map((s) => ({
      code: s.code,
      name: s.name || s.eng_name || "",
      state: s.state_name,
    }));

    return {
      stations,
      total: stations.length,
      query,
    };
  }

  /* ─── Train Search ────────────────────────────────────────── */
  /* GET /api/v2/trainBetweenStations?fromStationCode=NDLS&toStationCode=JP&date=20260728 */

  async searchTrains(params: TrainSearchParams): Promise<TrainSearchResult> {
    const data = await this.fetch<{
      status: boolean;
      data: Array<{
        train_number: string;
        train_name: string;
        source: string;
        source_name?: string;
        dest: string;
        dest_name?: string;
        departure_time: string;
        arrival_time: string;
        travel_time: string;
        distance?: number;
        avg_speed?: number;
        train_type?: string;
        from_station_name?: string;
        to_station_name?: string;
      }>;
    }>("/api/v2/trainBetweenStations", {
      fromStationCode: params.from,
      toStationCode: params.to,
      date: params.date.replace(/-/g, ""),
    });

    const trains: TrainSearchEntry[] = (data?.data || []).map((t) => {
      const trainType = inferTrainType(t.train_name, t.train_number);
      return {
        train: {
          number: t.train_number,
          name: t.train_name,
          type: trainType,
          from: { code: t.source || params.from, name: t.from_station_name || t.source_name || "" },
          to: { code: t.dest || params.to, name: t.to_station_name || t.dest_name || "" },
          departure: t.departure_time,
          arrival: t.arrival_time,
          duration: t.travel_time,
          distance: t.distance || 0,
          runningDays: [],
          classes: [],
        },
        availableClasses: [],
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
  /* GET /api/v1/trainSchedule?trainNo=12951 (common pattern)   */

  async getTrainSchedule(trainNumber: string): Promise<TrainSchedule> {
    const data = await this.fetch<{
      status: boolean;
      data?: {
        train_number: string;
        train_name?: string;
        route?: Array<{
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
    }>("/api/v1/trainSchedule", { trainNo: trainNumber });

    const route = data?.data?.route || [];
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
      totalDistance: route.length > 0 ? route[route.length - 1].distance : 0,
      duration: "",
    };
  }

  /* ─── Seat Availability ───────────────────────────────────── */
  /* GET /api/v1/seatAvailability?trainNo=12951&from=NDLS&to=JP&date=20260728&class=3A */

  async getSeatAvailability(params: SeatAvailabilityParams): Promise<SeatAvailability> {
    const data = await this.fetch<{
      status: boolean;
      data?: {
        train_number: string;
        train_name?: string;
        classes?: Array<{
          code: string;
          name: string;
          fare: number;
          available: number;
          total?: number;
          status?: string;
        }>;
      };
    }>("/api/v1/seatAvailability", {
      trainNo: params.trainNumber,
      fromStationCode: params.from,
      toStationCode: params.to,
      date: params.date.replace(/-/g, ""),
      ...(params.class ? { classCode: params.class } : {}),
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
  /* GET /api/v2/getFare?trainNo=12951&fromStationCode=NDLS&toStationCode=BCT */

  async getFare(params: FareParams): Promise<FareEnquiry> {
    const data = await this.fetch<{
      status: boolean;
      data?: {
        classes?: Array<{
          class_code: string;
          class_name: string;
          fare: number;
          reservation_charge?: number;
          superfast_charge?: number;
          convenience_fee?: number;
        }>;
      };
    }>("/api/v2/getFare", {
      trainNo: params.trainNumber,
      fromStationCode: params.from,
      toStationCode: params.to,
    });

    const classes = (data?.data?.classes || []).map((c) => ({
      code: c.class_code,
      name: c.class_name,
      baseFare: c.fare,
      reservationCharge: c.reservation_charge || 0,
      superfastCharge: c.superfast_charge || 0,
      convenienceFee: c.convenience_fee || 0,
      totalFare: c.fare + (c.reservation_charge || 0) + (c.superfast_charge || 0) + (c.convenience_fee || 0),
      available: true,
    }));

    return {
      train: { number: params.trainNumber, name: "" },
      from: { code: params.from, name: "" },
      to: { code: params.to, name: "" },
      date: params.date || new Date().toISOString().split("T")[0],
      classes,
      baseFare: classes[0]?.baseFare || 0,
      totalFare: classes.reduce((sum, c) => sum + c.totalFare, 0),
      lastUpdated: new Date().toISOString(),
    };
  }

  /* ─── PNR Status ──────────────────────────────────────────── */
  /* GET /api/v1/pnrStatus?pnr=4785213694 (common pattern)      */

  async getPNRStatus(pnr: string): Promise<PNRStatus> {
    const data = await this.fetch<{
      status: boolean;
      data?: {
        pnr_number?: string;
        train_number?: string;
        train_name?: string;
        from_station?: { code: string; name: string };
        to_station?: { code: string; name: string };
        boarding_point?: { code: string; name: string };
        journey_date?: string;
        class_name?: string;
        quota?: string;
        chart_prepared?: boolean;
        passengers?: Array<{
          passenger_no: number;
          booking_status: string;
          current_status: string;
          coach?: string;
          berth?: string;
        }>;
        platform?: string;
      };
    }>("/api/v1/pnrStatus", { pnr });

    const d = data?.data;
    return {
      pnr: d?.pnr_number || pnr,
      train: { number: d?.train_number || "", name: d?.train_name || "" },
      from: d?.from_station || { code: "", name: "" },
      to: d?.to_station || { code: "", name: "" },
      boardingAt: d?.boarding_point || d?.from_station || { code: "", name: "" },
      date: d?.journey_date || "",
      class: d?.class_name || "",
      quota: d?.quota || "GN",
      chartPrepared: d?.chart_prepared || false,
      passengers: (d?.passengers || []).map((p) => ({
        number: p.passenger_no,
        name: `Passenger ${p.passenger_no}`,
        age: 0,
        gender: "M",
        status: p.current_status,
        berth: p.berth || undefined,
        coach: p.coach,
        seat: p.berth?.split("-")[1],
        bookingStatus: p.booking_status,
        currentStatus: p.current_status,
      })),
      status: inferPNRStatus(d?.passengers?.[0]?.current_status || ""),
      departure: "",
      arrival: "",
      platform: d?.platform,
      lastUpdated: new Date().toISOString(),
    };
  }

  /* ─── Live Status ─────────────────────────────────────────── */
  /* GET /api/v1/liveTrainStatus?trainNo=12951 (common pattern)  */

  async getLiveStatus(trainNumber: string, station?: string): Promise<LiveStatus> {
    const params: Record<string, string> = { trainNo: trainNumber };
    if (station) params.stationCode = station;

    const data = await this.fetch<{
      status: boolean;
      data?: {
        train_number: string;
        train_name?: string;
        current_station?: { code: string; name: string };
        lateness?: number;
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
    }>("/api/v1/liveTrainStatus", params);

    const d = data?.data;
    const stations = d?.stations || [];
    return {
      train: { number: trainNumber, name: d?.train_name || "" },
      currentStation: d?.current_station || { code: "", name: "" },
      lastUpdated: new Date().toISOString(),
      delay: d?.lateness || 0,
      speed: d?.speed || 0,
      status: (d?.status === "ONTIME" || (d?.lateness || 0) <= 15) ? "ONTIME" : "DELAYED",
      hasDeparted: true,
      distanceCovered: d?.position || 0,
      totalDistance: stations.length > 0 ? stations[stations.length - 1].distance : 1000,
      position: d?.position || 0,
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
  /* GET /api/v1/coachPosition?trainNo=12951 (common pattern)    */

  async getCoachComposition(trainNumber: string): Promise<CoachComposition> {
    const data = await this.fetch<{
      status: boolean;
      data?: {
        coaches?: Array<{
          coach_number: string;
          coach_type: string;
          class_name?: string;
          position?: number;
          total_berths?: number;
          available_berths?: number;
        }>;
      };
    }>("/api/v1/coachPosition", { trainNo: trainNumber });

    const coaches = (data?.data?.coaches || []).map((c) => ({
      number: c.coach_number,
      type: c.coach_type,
      class: c.class_name || c.coach_type,
      position: c.position || 0,
      totalBerths: c.total_berths || 0,
      availableBerths: c.available_berths,
    }));

    return {
      train: { number: trainNumber, name: "" },
      coaches,
      totalCoaches: coaches.length,
    };
  }

  /* ─── Health Check ────────────────────────────────────────── */

  async healthCheck(): Promise<boolean> {
    try {
      await this.fetch<{ status: boolean }>("/api/v1/searchStation", { query: "NDLS" }, 5000);
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
        "IRCTC API key not configured. Set RAILWAY_API_KEY in .env.local.",
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

    // Add query params
    Object.entries(params).forEach(([key, value]) => {
      if (value) url.searchParams.set(key, value);
    });

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url.toString(), {
        signal: controller.signal,
        headers: {
          "x-rapidapi-key": this.apiKey,
          "x-rapidapi-host": this.rapidApiHost,
          Accept: "application/json",
        },
      });

      // Handle quota exceeded
      if (response.status === 429 || response.status === 403) {
        const body = await response.text().catch(() => "");
        if (body.includes("quota") || body.includes("exceeded")) {
          throw new RailwayAPIError(
            "IRCTC API quota exceeded. Upgrade your RapidAPI plan or wait for reset.",
            "QUOTA_EXCEEDED",
            429,
            body
          );
        }
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
