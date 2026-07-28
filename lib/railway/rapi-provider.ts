/* ══════════════════════════════════════════════════════════════
   RAILWAY — Rapi Provider
   Wraps the self-hosted Rapi scraping API into the RailwayProvider
   interface. Rapi runs as a local Express server and provides
   free Indian Railways data via web scraping.
   
   Repo: ../Rapi (sibling directory)
   ══════════════════════════════════════════════════════════════ */

import type { RailwayProvider, TrainSearchParams, SeatAvailabilityParams, FareParams } from "./provider";
import type {
  Station,
  StationSearchResult,
  TrainSearchResult,
  TrainSearchEntry,
  RunningDay,
  SeatAvailability,
  PNRStatus,
  PNRPassenger,
  LiveStatus,
  LiveStatusStation,
  FareEnquiry,
  CoachComposition,
  TrainSchedule,
  ScheduleStation,
} from "./types";
import { RailwayAPIError } from "./client";

interface RapiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  cached: boolean;
}

export class RapiProvider implements RailwayProvider {
  name = "Rapi (self-hosted)";
  private baseUrl: string;
  private timeout: number;

  constructor(baseUrl?: string, timeoutMs = 15_000) {
    this.baseUrl = baseUrl || process.env.RAPI_BASE_URL || "http://localhost:3001";
    this.timeout = timeoutMs;
  }

  /* ─── HTTP helper ────────────────────────────────────────── */

  private async get<T>(path: string): Promise<RapiResponse<T>> {
    const url = `${this.baseUrl}${path}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: { Accept: "application/json" },
      });

      clearTimeout(timeout);

      if (response.status === 429) {
        throw new RailwayAPIError("Rapi rate limit exceeded", "RATE_LIMIT", 429);
      }
      if (response.status === 404) {
        return { success: false, error: "Not found", cached: false };
      }
      if (response.status >= 500) {
        throw new RailwayAPIError(
          `Rapi server error: ${response.statusText}`,
          "RAPI_ERROR",
          response.status
        );
      }

      return await response.json() as RapiResponse<T>;
    } catch (err: any) {
      clearTimeout(timeout);
      if (err instanceof RailwayAPIError) throw err;
      if (err.name === "AbortError") {
        throw new RailwayAPIError(
          `Rapi request timed out: ${url}`,
          "RAPI_TIMEOUT",
          408
        );
      }
      if (err.cause?.code === "ECONNREFUSED" || err.message?.includes("ECONNREFUSED")) {
        throw new RailwayAPIError(
          `Rapi server not reachable at ${this.baseUrl}. Start it with: cd Rapi && npm run dev`,
          "RAPI_UNREACHABLE",
          503
        );
      }
      throw new RailwayAPIError(
        err?.message || "Rapi request failed",
        "RAPI_ERROR",
        500
      );
    }
  }

  /* ─── Station Search (autocomplete) ──────────────────────── */
  /* GET /api/v1/stations/autocomplete?q=                      */

  async searchStations(query: string, limit = 10): Promise<StationSearchResult> {
    const res = await this.get<{
      query: string;
      total: number;
      stations: Array<{ code: string; name: string; state: string; zone: string }>;
    }>(`/api/v1/stations/autocomplete?q=${encodeURIComponent(query)}`);

    if (!res.success || !res.data) {
      return { stations: [], total: 0, query };
    }

    const stations: Station[] = res.data.stations.slice(0, limit).map((s) => ({
      code: s.code,
      name: s.name,
      state: s.state,
    }));

    return { stations, total: stations.length, query };
  }

  /* ─── Train Search ───────────────────────────────────────── */
  /* GET /api/v1/trains/search?from=NDLS&to=BCT                 */

  async searchTrains(params: TrainSearchParams): Promise<TrainSearchResult> {
    const res = await this.get<{
      from: string;
      to: string;
      total: number;
      trains: Array<{
        train_no: string;
        train_name: string;
        from_stn_name: string;
        from_stn_code: string;
        to_stn_name: string;
        to_stn_code: string;
        from_time: string;
        to_time: string;
        travel_time: string;
        running_days: string;
      }>;
    }>(`/api/v1/trains/search?from=${params.from}&to=${params.to}`);

    if (!res.success || !res.data) {
      throw new RailwayAPIError(
        res.error || "Train search returned no data",
        "RAPI_EMPTY",
        404
      );
    }

    const trains: TrainSearchEntry[] = (res.data.trains || []).map((t) => ({
      train: {
        number: t.train_no,
        name: t.train_name,
        type: this.inferTrainType(t.train_name),
        from: { code: t.from_stn_code, name: t.from_stn_name },
        to: { code: t.to_stn_code, name: t.to_stn_name },
        departure: t.from_time,
        arrival: t.to_time,
        duration: t.travel_time,
        distance: 0,
        runningDays: this.parseRunningDays(t.running_days),
        classes: [],
      },
      availableClasses: [],
    }));

    return {
      trains,
      total: trains.length,
      from: { code: params.from, name: "" },
      to: { code: params.to, name: "" },
      date: params.date,
    };
  }

  /* ─── Train Schedule (route timetable) ───────────────────── */
  /* GET /api/v1/trains/:trainNumber/info                       */

  async getTrainSchedule(trainNumber: string): Promise<TrainSchedule> {
    const res = await this.get<{
      train_no: string;
      train_name: string;
      route: Array<{
        stnCode: string;
        stnName: string;
        arrival: string;
        departure: string;
        distance: number;
        day: number;
        platform?: string;
        zone?: string;
      }>;
      totalStops: number;
      distance: number;
    }>(`/api/v1/trains/${trainNumber}/info`);

    if (!res.success || !res.data) {
      throw new RailwayAPIError(
        res.error || `Train ${trainNumber} not found`,
        "RAPI_EMPTY",
        404
      );
    }

    const d = res.data;
    const route: ScheduleStation[] = (d.route || []).map((s) => ({
      station: { code: s.stnCode, name: s.stnName },
      day: s.day,
      arrival: s.arrival || "--",
      departure: s.departure || "--",
      distance: s.distance,
      platform: s.platform,
      halt: "--",
      zone: s.zone || "",
    }));

    return {
      train: { number: d.train_no, name: d.train_name },
      route,
      totalStops: d.totalStops || route.length,
      totalDistance: d.distance || (route.length > 0 ? route[route.length - 1].distance : 0),
      duration: "",
    };
  }

  /* ─── Seat Availability ──────────────────────────────────── */
  /* Rapi does NOT support seat availability — fall back to mock */

  async getSeatAvailability(params: SeatAvailabilityParams): Promise<SeatAvailability> {
    throw new RailwayAPIError(
      "Seat availability not supported by Rapi provider. Use RailKit or mock.",
      "NOT_SUPPORTED",
      501
    );
  }

  /* ─── Fare ───────────────────────────────────────────────── */
  /* Rapi does NOT support fare lookup — fall back to mock       */

  async getFare(params: FareParams): Promise<FareEnquiry> {
    throw new RailwayAPIError(
      "Fare lookup not supported by Rapi provider. Use RailKit or mock.",
      "NOT_SUPPORTED",
      501
    );
  }

  /* ─── PNR Status ─────────────────────────────────────────── */
  /* GET /api/v1/pnr/:pnr                                       */

  async getPNRStatus(pnr: string): Promise<PNRStatus> {
    const res = await this.get<{
      pnr: string;
      train: { number: string; name: string };
      journey: {
        date: string;
        class: string;
        quota: string;
        source: { code: string; name: string };
        destination: { code: string; name: string };
        boardingPoint: { code: string; name: string };
        distance: number;
      };
      chart: { status: string };
      booking: { fare: number };
      passengers: Array<{
        serialNumber: string;
        booking: { status: string; coach: string | null; berthNo: number | null; berthCode: string | null; details: string };
        current: { status: string; coach: string | null; berthNo: number | null; berthCode: string | null; details: string };
      }>;
    }>(`/api/v1/pnr/${pnr}`);

    if (!res.success || !res.data) {
      throw new RailwayAPIError(
        res.error || `PNR ${pnr} not found`,
        "RAPI_EMPTY",
        404
      );
    }

    const d = res.data;

    const firstPassenger = d.passengers?.[0];
    const bookingStatus: PNRStatus["status"] = this.inferBookingStatus(
      firstPassenger?.current?.status || firstPassenger?.booking?.status || ""
    );

    const passengers: PNRPassenger[] = (d.passengers || []).map(
      (p: any, i: number) => ({
        number: i + 1,
        name: p.serialNumber || `Passenger ${i + 1}`,
        age: 0,
        gender: "M" as const,
        status: p.current?.details || p.booking?.details || "",
        berth: p.current?.details || undefined,
        coach: p.current?.coach || p.booking?.coach || undefined,
        seat: p.current?.berthNo?.toString() || p.booking?.berthNo?.toString() || undefined,
        bookingStatus: p.booking?.status || "",
        currentStatus: p.current?.status || "",
      })
    );

    return {
      pnr: d.pnr,
      train: { number: d.train.number, name: d.train.name },
      from: d.journey.source,
      to: d.journey.destination,
      boardingAt: d.journey.boardingPoint,
      date: d.journey.date,
      class: d.journey.class,
      quota: d.journey.quota,
      chartPrepared: d.chart?.status === "Chart Prepared",
      passengers,
      status: bookingStatus,
      departure: "",
      arrival: "",
      platform: undefined,
      lastUpdated: new Date().toISOString(),
    };
  }

  /* ─── Live Status ────────────────────────────────────────── */
  /* GET /api/v1/trains/:trainNumber/live?date=DD-MM-YYYY       */

  async getLiveStatus(trainNumber: string, station?: string): Promise<LiveStatus> {
    void station;
    const today = new Date();
    const date = `${String(today.getDate()).padStart(2, "0")}-${String(today.getMonth() + 1).padStart(2, "0")}-${today.getFullYear()}`;

    const res = await this.get<{
      trainNo: string;
      trainName: string;
      date: string;
      statusNote: string;
      lastUpdate: string;
      currentStationCode: string;
      delay: number;
      totalStations: number;
      timeline: Array<{
        stationCode: string;
        stationName: string;
        scheduledArrival: string;
        scheduledDeparture: string;
        actualArrival?: string;
        actualDeparture?: string;
        distance: number;
        day: number;
        platform?: string;
        delay: number;
        status: "passed" | "current" | "upcoming";
      }>;
    }>(`/api/v1/trains/${trainNumber}/live?date=${date}`);

    if (!res.success || !res.data) {
      throw new RailwayAPIError(
        res.error || `Live status for ${trainNumber} not available`,
        "RAPI_EMPTY",
        404
      );
    }

    const d = res.data;
    const currentEntry = d.timeline?.find((s) => s.status === "current");
    const passedStations = d.timeline?.filter((s) => s.status === "passed") || [];
    const totalDistance = d.timeline?.length
      ? d.timeline[d.timeline.length - 1].distance
      : 0;

    const route: LiveStatusStation[] = (d.timeline || []).map((s) => ({
      station: { code: s.stationCode, name: s.stationName },
      scheduledArrival: s.scheduledArrival,
      scheduledDeparture: s.scheduledDeparture,
      actualArrival: s.actualArrival,
      actualDeparture: s.actualDeparture,
      distance: s.distance,
      day: s.day,
      platform: s.platform,
      delay: s.delay,
      crossed: s.status === "passed",
    }));

    return {
      train: { number: d.trainNo, name: d.trainName },
      currentStation: currentEntry
        ? { code: currentEntry.stationCode, name: currentEntry.stationName }
        : { code: "", name: d.statusNote || "En Route" },
      lastUpdated: d.lastUpdate,
      delay: d.delay,
      speed: 0,
      status: this.inferLiveStatus(d.statusNote),
      hasDeparted: passedStations.length > 0,
      distanceCovered: currentEntry?.distance || 0,
      totalDistance,
      position: totalDistance > 0 ? ((currentEntry?.distance || 0) / totalDistance) * 100 : 0,
      route,
    };
  }

  /* ─── Coach Composition ──────────────────────────────────── */
  /* Rapi does NOT support coach composition — fall back to mock */

  async getCoachComposition(trainNumber: string): Promise<CoachComposition> {
    void trainNumber;
    throw new RailwayAPIError(
      "Coach composition not supported by Rapi provider. Use RailKit or mock.",
      "NOT_SUPPORTED",
      501
    );
  }

  /* ─── Health Check ────────────────────────────────────────── */

  async healthCheck(): Promise<boolean> {
    try {
      await this.get("/");
      return true;
    } catch {
      return false;
    }
  }

  /* ─── Helpers ─────────────────────────────────────────────── */

  private inferTrainType(name: string): TrainSearchEntry["train"]["type"] {
    const upper = name.toUpperCase();
    if (upper.includes("RAJDHANI")) return "RAJDHANI";
    if (upper.includes("SHATABDI")) return "SHATABDI";
    if (upper.includes("DURONTO")) return "DURONTO";
    if (upper.includes("GARIB")) return "GARIB_RATH";
    if (upper.includes("SUPERFAST")) return "SUPERFAST";
    return "EXPRESS";
  }

  private parseRunningDays(days: string): RunningDay[] {
    const dayNames: RunningDay["day"][] = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
    if (!days || days.length < 7) {
      return dayNames.map((day) => ({ day, runs: true }));
    }
    return dayNames.map((day, i) => ({
      day,
      runs: days[i] === "1",
    }));
  }

  private inferBookingStatus(status: string): PNRStatus["status"] {
    const upper = status.toUpperCase();
    if (upper === "CNF" || upper === "CONFIRMED" || upper.startsWith("CNF")) return "CONFIRMED";
    if (upper.startsWith("RAC")) return "RAC";
    if (upper.startsWith("WL") || upper.startsWith("WAITLIST")) return "WAITLIST";
    return "CANCELLED";
  }

  private inferLiveStatus(note: string): LiveStatus["status"] {
    const lower = (note || "").toLowerCase();
    if (lower.includes("arrived")) return "ARRIVED";
    if (lower.includes("delay") || lower.includes("late")) return "DELAYED";
    if (lower.includes("cancelled")) return "CANCELLED";
    return "ONTIME";
  }
}
