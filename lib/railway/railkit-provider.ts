/* ══════════════════════════════════════════════════════════════
   RAILWAY — RailKit Provider
   Wraps the official railkit npm SDK into the RailwayProvider
   interface so it plugs seamlessly into RailwayClient.
   
   Docs: https://railkit.rajivdubey.dev/docs
   NPM:  https://www.npmjs.com/package/railkit
   ══════════════════════════════════════════════════════════════ */

import {
  configure,
  checkPNRStatus,
  getTrainInfo,
  trackTrain,
  searchTrainBetweenStations,
  getAvailability,
  fareLookup,
} from "railkit";

import type { RailwayProvider, TrainSearchParams, SeatAvailabilityParams, FareParams } from "./provider";
import type {
  Station,
  StationSearchResult,
  TrainSearchResult,
  TrainSearchEntry,
  RunningDay,
  SeatAvailability,
  PNRStatus,
  LiveStatus,
  FareEnquiry,
  CoachComposition,
  TrainSchedule,
  ScheduleStation,
} from "./types";
import { RailwayAPIError } from "./client";

/* ─── Station Database (for autocomplete — RailKit doesn't expose station search) ── */

const STATIONS: Station[] = [
  { code: "NDLS", name: "New Delhi", state: "Delhi" },
  { code: "JP", name: "Jaipur", state: "Rajasthan" },
  { code: "BCT", name: "Mumbai Central", state: "Maharashtra" },
  { code: "CSTM", name: "Mumbai CSMT", state: "Maharashtra" },
  { code: "MAS", name: "Chennai Central", state: "Tamil Nadu" },
  { code: "SBC", name: "Bangalore", state: "Karnataka" },
  { code: "HWH", name: "Howrah", state: "West Bengal" },
  { code: "CDG", name: "Chandigarh", state: "Chandigarh" },
  { code: "LKO", name: "Lucknow", state: "Uttar Pradesh" },
  { code: "PNBE", name: "Patna", state: "Bihar" },
  { code: "ADI", name: "Ahmedabad", state: "Gujarat" },
  { code: "PUNE", name: "Pune", state: "Maharashtra" },
  { code: "KGP", name: "Kharagpur", state: "West Bengal" },
  { code: "BPL", name: "Bhopal", state: "Madhya Pradesh" },
  { code: "JHS", name: "Jhansi", state: "Uttar Pradesh" },
  { code: "KOTA", name: "Kota", state: "Rajasthan" },
  { code: "ALD", name: "Prayagraj", state: "Uttar Pradesh" },
  { code: "GKP", name: "Gorakhpur", state: "Uttar Pradesh" },
  { code: "ASR", name: "Amritsar", state: "Punjab" },
  { code: "LTT", name: "LTT Mumbai", state: "Maharashtra" },
  { code: "AII", name: "Ajmer", state: "Rajasthan" },
  { code: "UDZ", name: "Udaipur", state: "Rajasthan" },
  { code: "JAT", name: "Jammu Tawi", state: "Jammu and Kashmir" },
  { code: "NGP", name: "Nagpur", state: "Maharashtra" },
  { code: "SC", name: "Secunderabad", state: "Telangana" },
  { code: "GHY", name: "Guwahati", state: "Assam" },
  { code: "BBS", name: "Bhubaneswar", state: "Odisha" },
  { code: "MYS", name: "Mysuru", state: "Karnataka" },
  { code: "VSKP", name: "Visakhapatnam", state: "Andhra Pradesh" },
  { code: "TVC", name: "Thiruvananthapuram", state: "Kerala" },
];

/* ─── Provider ─────────────────────────────────────────────── */

export class RailKitProvider implements RailwayProvider {
  name = "RailKit (railkit.rajivdubey.dev)";
  private configured = false;

  constructor(apiKey: string) {
    if (!apiKey) {
      throw new RailwayAPIError(
        "RailKit API key not configured. Set RAILKIT_API_KEY in .env.local.",
        "NO_API_KEY",
        401
      );
    }
    configure(apiKey);
    this.configured = true;
  }

  /* ─── Station Search (built-in list) ──────────────────────── */

  async searchStations(query: string, limit = 10): Promise<StationSearchResult> {
    const q = query.toLowerCase().trim();
    const results = STATIONS.filter(
      (s) =>
        s.code.toLowerCase().includes(q) ||
        s.name.toLowerCase().includes(q) ||
        s.state?.toLowerCase().includes(q)
    ).slice(0, limit);

    return {
      stations: results,
      total: results.length,
      query,
    };
  }

  /* ─── Train Search ────────────────────────────────────────── */
  /* searchTrainBetweenStations(from, to, date?)                  */

  async searchTrains(params: TrainSearchParams): Promise<TrainSearchResult> {
    // Convert date from YYYY-MM-DD to DD-MM-YYYY
    const date = params.date ? this.toDDMMYYYY(params.date) : undefined;

    let result: { success: boolean; data?: any[] };
    try {
      result = await searchTrainBetweenStations(params.from, params.to, date);
    } catch (err: any) {
      throw new RailwayAPIError(
        err?.message || "RailKit train search failed",
        "RAILKIT_ERROR",
        500
      );
    }

    if (!result.success) {
      throw new RailwayAPIError(
        result?.data?.toString() || "RailKit train search returned no data",
        "RAILKIT_EMPTY",
        404
      );
    }

    const trains: TrainSearchEntry[] = (result.data || []).map((t: any) => ({
      train: {
        number: t.train_no || "",
        name: t.train_name || "",
        type: this.inferTrainType(t.train_name || "", t.train_no || ""),
        from: { code: t.from_stn_code || params.from, name: t.from_stn_name || "" },
        to: { code: t.to_stn_code || params.to, name: t.to_stn_name || "" },
        departure: t.from_time || "",
        arrival: t.to_time || "",
        duration: t.travel_time || "",
        distance: parseInt(t.distance) || 0,
        runningDays: this.parseRunningDays(t.running_days || ""),
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

  /* ─── Train Schedule ──────────────────────────────────────── */
  /* getTrainInfo(trainNumber) — returns trainInfo + route       */

  async getTrainSchedule(trainNumber: string): Promise<TrainSchedule> {
    let result: { success: boolean; data?: any };
    try {
      result = await getTrainInfo(trainNumber);
    } catch (err: any) {
      throw new RailwayAPIError(
        err?.message || "RailKit train info failed",
        "RAILKIT_ERROR",
        500
      );
    }

    if (!result.success || !result.data) {
      throw new RailwayAPIError("Train not found", "RAILKIT_EMPTY", 404);
    }

    const { trainInfo, route } = result.data;
    const stops: ScheduleStation[] = (route || []).map((s: any) => ({
      station: { code: s.stnCode || "", name: s.stnName || "" },
      day: parseInt(s.day) || 1,
      arrival: s.arrival || "--",
      departure: s.departure || "--",
      distance: parseInt(s.distance) || 0,
      platform: s.platform,
      halt: s.halt || "--",
      zone: s.zone || "",
    }));

    return {
      train: { number: trainNumber, name: trainInfo?.train_name || "" },
      route: stops,
      totalStops: stops.length,
      totalDistance: stops.length > 0 ? stops[stops.length - 1].distance : 0,
      duration: trainInfo?.travel_time || "",
    };
  }

  /* ─── Seat Availability ───────────────────────────────────── */
  /* getAvailability(trainNo, fromStnCode, toStnCode, date, coach, quota) */

  async getSeatAvailability(params: SeatAvailabilityParams): Promise<SeatAvailability> {
    const date = this.toDDMMYYYY(params.date);
    const coach = params.class || "ALL";
    const quota = params.quota || "GN";

    let result: { success: boolean; data?: any };
    try {
      result = await getAvailability(params.trainNumber, params.from, params.to, date, coach, quota);
    } catch (err: any) {
      throw new RailwayAPIError(
        err?.message || "RailKit seat availability failed",
        "RAILKIT_ERROR",
        500
      );
    }

    if (!result.success) {
      throw new RailwayAPIError("Seat availability lookup failed", "RAILKIT_EMPTY", 404);
    }

    const d = result.data;
    const availData = d?.availability || [];
    const fareData = d?.fare || {};

    return {
      train: { number: params.trainNumber, name: d?.train?.trainName || "" },
      date: params.date,
      from: { code: params.from, name: "" },
      to: { code: params.to, name: "" },
      classes: [
        {
          code: coach,
          name: this.coachName(coach),
          fare: fareData?.totalFare || 0,
          available: availData[0]?.available || 0,
          total: 100,
          status: this.inferStatus(availData[0]),
        },
      ],
      lastUpdated: new Date().toISOString(),
    };
  }

  /* ─── Fare ────────────────────────────────────────────────── */
  /* fareLookup(trainNo, fromStnCode, toStnCode, date, travelClass, quota) */

  async getFare(params: FareParams): Promise<FareEnquiry> {
    const date = params.date ? this.toDDMMYYYY(params.date) : "";
    const travelClass = params.class || "3A";
    const quota = params.quota || "GN";

    let result: { success: boolean; data?: any };
    try {
      result = await fareLookup(params.trainNumber, params.from, params.to, date, travelClass, quota);
    } catch (err: any) {
      throw new RailwayAPIError(
        err?.message || "RailKit fare lookup failed",
        "RAILKIT_ERROR",
        500
      );
    }

    if (!result.success) {
      throw new RailwayAPIError("Fare lookup failed", "RAILKIT_EMPTY", 404);
    }

    const d = result.data;
    return {
      train: { number: params.trainNumber, name: d?.trainName || "" },
      from: { code: params.from, name: "" },
      to: { code: params.to, name: "" },
      date: params.date || "",
      classes: [
        {
          code: travelClass,
          name: this.coachName(travelClass),
          baseFare: d?.baseFare || 0,
          reservationCharge: d?.reservation || 0,
          superfastCharge: d?.superfast || 0,
          convenienceFee: d?.gst || 0,
          totalFare: d?.totalFare || 0,
          available: true,
        },
      ],
      baseFare: d?.baseFare || 0,
      totalFare: d?.totalFare || 0,
      lastUpdated: new Date().toISOString(),
    };
  }

  /* ─── PNR Status ──────────────────────────────────────────── */
  /* checkPNRStatus(pnr)                                          */

  async getPNRStatus(pnr: string): Promise<PNRStatus> {
    let result: { success: boolean; data?: any };
    try {
      result = await checkPNRStatus(pnr);
    } catch (err: any) {
      throw new RailwayAPIError(
        err?.message || "RailKit PNR check failed",
        "RAILKIT_ERROR",
        500
      );
    }

    if (!result.success || !result.data) {
      throw new RailwayAPIError("PNR not found", "RAILKIT_EMPTY", 404);
    }

    const d = result.data;
    const passengers = (d.passengers || []).map((p: any, i: number) => ({
      number: p.serialNumber || i + 1,
      name: `Passenger ${p.serialNumber || i + 1}`,
      age: 0,
      gender: "M" as const,
      status: p.current?.details || p.booking?.details || "",
      berth: p.current?.details || undefined,
      coach: p.current?.coach || p.booking?.coach || undefined,
      seat: p.current?.berthNo?.toString() || p.booking?.berthNo?.toString() || undefined,
      bookingStatus: p.booking?.status || "",
      currentStatus: p.current?.status || "",
    }));

    return {
      pnr: d.pnr || pnr,
      train: { number: d.train?.number || "", name: d.train?.name || "" },
      from: d.journey?.source || { code: "", name: "" },
      to: d.journey?.destination || { code: "", name: "" },
      boardingAt: d.journey?.boardingPoint || d.journey?.source || { code: "", name: "" },
      date: d.journey?.dateOfJourney || "",
      class: d.journey?.class || "",
      quota: d.journey?.quota || "GN",
      chartPrepared: d.chart?.status === "Chart Prepared",
      passengers,
      status: this.inferPNRBookingStatus(passengers[0]?.currentStatus || ""),
      departure: "",
      arrival: "",
      platform: undefined,
      lastUpdated: new Date().toISOString(),
    };
  }

  /* ─── Live Status ─────────────────────────────────────────── */
  /* trackTrain(trainNumber, date)                                */

  async getLiveStatus(trainNumber: string, station?: string): Promise<LiveStatus> {
    void station;
    // Default to today's date for live tracking
    const today = new Date();
    const date = `${String(today.getDate()).padStart(2, "0")}-${String(today.getMonth() + 1).padStart(2, "0")}-${today.getFullYear()}`;

    let result: { success: boolean; data?: any };
    try {
      result = await trackTrain(trainNumber, date);
    } catch (err: any) {
      throw new RailwayAPIError(
        err?.message || "RailKit live tracking failed",
        "RAILKIT_ERROR",
        500
      );
    }

    if (!result.success || !result.data) {
      throw new RailwayAPIError("Live tracking data not available", "RAILKIT_EMPTY", 404);
    }

    const d = result.data;
    const timeline = d.timeline || [];

    // Find current station
    const currentEntry = timeline.find((s: any) => s.status === "current");
    const passedStations = timeline.filter((s: any) => s.status === "passed");
    const totalDistance = timeline.length > 0
      ? parseInt(timeline[timeline.length - 1].distanceKm || "0")
      : 0;

    return {
      train: { number: d.trainNo || trainNumber, name: d.trainName || "" },
      currentStation: currentEntry
        ? { code: currentEntry.stationCode, name: currentEntry.stationName }
        : { code: "", name: d.statusNote || "En Route" },
      lastUpdated: d.lastUpdate || new Date().toISOString(),
      delay: currentEntry?.arrival?.delay
        ? parseInt(currentEntry.arrival.delay) || 0
        : 0,
      speed: 0,
      status: this.inferLiveStatus(d.statusNote || ""),
      hasDeparted: passedStations.length > 0,
      distanceCovered: currentEntry ? parseInt(currentEntry.distanceKm || "0") : 0,
      totalDistance,
      position: totalDistance > 0
        ? ((currentEntry
          ? parseInt(currentEntry.distanceKm || "0")
          : (([...timeline].reverse().find((s: any) => s.status === "passed")?.distanceKm) || 0)
        ) / totalDistance) * 100
        : 0,
      route: timeline.map((s: any) => ({
        station: { code: s.stationCode || "", name: s.stationName || "" },
        scheduledArrival: s.arrival?.scheduled || "",
        scheduledDeparture: s.departure?.scheduled || "",
        actualArrival: s.arrival?.actual || undefined,
        actualDeparture: s.departure?.actual || undefined,
        distance: parseInt(s.distanceKm || "0"),
        day: 1,
        platform: s.platform,
        delay: parseInt(s.arrival?.delay || "0"),
        crossed: s.status === "passed",
      })),
    };
  }

  /* ─── Coach Composition ───────────────────────────────────── */
  /* Uses coach position data from trackTrain result              */

  async getCoachComposition(trainNumber: string): Promise<CoachComposition> {
    // Try to get coach position from trackTrain
    const today = new Date();
    const date = `${String(today.getDate()).padStart(2, "0")}-${String(today.getMonth() + 1).padStart(2, "0")}-${today.getFullYear()}`;

    let result: { success: boolean; data?: any };
    try {
      result = await trackTrain(trainNumber, date);
    } catch (err) {
      console.warn("[RailKitProvider] Coach composition unavailable:", err);
      return {
        train: { number: trainNumber, name: "" },
        coaches: [],
        totalCoaches: 0,
      };
    }

    if (!result.success || !result.data) {
      return {
        train: { number: trainNumber, name: "" },
        coaches: [],
        totalCoaches: 0,
      };
    }

    const d = result.data;
    const timeline = d.timeline || [];
    const firstStoppage = timeline.find((s: any) => s.type === "stoppage" && s.coachPosition);
    const coachPositions = firstStoppage?.coachPosition || [];

    return {
      train: { number: d.trainNo || trainNumber, name: d.trainName || "" },
      coaches: coachPositions.map((c: any, i: number) => ({
        number: c.number || `C${i + 1}`,
        type: c.type || "General",
        class: this.coachName(c.type || ""),
        position: parseInt(c.position || i.toString()),
        totalBerths: 0,
      })),
      totalCoaches: coachPositions.length,
    };
  }

  /* ─── Health Check ────────────────────────────────────────── */

  async healthCheck(): Promise<boolean> {
    try {
      await searchTrainBetweenStations("NDLS", "JP");
      return true;
    } catch {
      return false;
    }
  }

  /* ─── Helpers ─────────────────────────────────────────────── */

  private inferTrainType(name: string, number: string): TrainSearchEntry["train"]["type"] {
    void number;
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

  private toDDMMYYYY(dateStr: string): string {
    // Accept YYYY-MM-DD or DD-MM-YYYY
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      const [y, m, d] = dateStr.split("-");
      return `${d}-${m}-${y}`;
    }
    return dateStr;
  }

  private coachName(code: string): string {
    const map: Record<string, string> = {
      "1A": "First AC",
      "2A": "2 Tier AC",
      "3A": "3 Tier AC",
      "3E": "3 Tier Economy",
      CC: "Chair Car",
      EC: "Executive Chair Car",
      SL: "Sleeper",
      "2S": "Second Sitting",
      GN: "General",
    };
    return map[code.toUpperCase()] || code;
  }

  private inferStatus(availDay: any): "AVAILABLE" | "RAC" | "WAITLIST" | "CLOSED" | "NOT_AVAILABLE" {
    if (!availDay) return "NOT_AVAILABLE";
    const text = (availDay.availabilityText || "").toUpperCase();
    const avail = availDay.available || 0;
    if (text.includes("AVAILABLE") || text.includes("CNF") || avail > 10) return "AVAILABLE";
    if (text.includes("RAC") || avail > 0) return "RAC";
    if (text.includes("WL") || text.includes("WAITLIST")) return "WAITLIST";
    if (text.includes("CLOSED") || text.includes("NOT")) return "NOT_AVAILABLE";
    return "NOT_AVAILABLE";
  }

  private inferPNRBookingStatus(status: string): PNRStatus["status"] {
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
    if (lower.includes("on time") || lower.includes("ontime")) return "ONTIME";
    return "ONTIME";
  }


}
