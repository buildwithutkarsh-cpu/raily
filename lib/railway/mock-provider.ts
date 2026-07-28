/* ══════════════════════════════════════════════════════════════
   RAILWAY — Mock Provider
   Realistic mock data for demo and fallback scenarios.
   All data mirrors real Indian Railways routes, trains, and stations.
   ══════════════════════════════════════════════════════════════ */

import type {
  RailwayProvider,
  TrainSearchParams,
  SeatAvailabilityParams,
  FareParams,
} from "./provider";
import type {
  Station,
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

/* ─── Station Database ─────────────────────────────────────── */

const STATIONS: Station[] = [
  { code: "NDLS", name: "New Delhi", fullName: "New Delhi Railway Station", state: "Delhi" },
  { code: "JP", name: "Jaipur", fullName: "Jaipur Junction", state: "Rajasthan" },
  { code: "BCT", name: "Mumbai Central", fullName: "Mumbai Central", state: "Maharashtra" },
  { code: "CSTM", name: "Mumbai CSMT", fullName: "Chhatrapati Shivaji Maharaj Terminus", state: "Maharashtra" },
  { code: "MAS", name: "Chennai Central", fullName: "Chennai Central", state: "Tamil Nadu" },
  { code: "SBC", name: "Bangalore", fullName: "Bangalore City Junction", state: "Karnataka" },
  { code: "HWH", name: "Howrah", fullName: "Howrah Junction", state: "West Bengal" },
  { code: "CDG", name: "Chandigarh", fullName: "Chandigarh Junction", state: "Chandigarh" },
  { code: "LKO", name: "Lucknow", fullName: "Lucknow Junction", state: "Uttar Pradesh" },
  { code: "PNBE", name: "Patna", fullName: "Patna Junction", state: "Bihar" },
  { code: "ADI", name: "Ahmedabad", fullName: "Ahmedabad Junction", state: "Gujarat" },
  { code: "PUNE", name: "Pune", fullName: "Pune Junction", state: "Maharashtra" },
  { code: "KGP", name: "Kharagpur", fullName: "Kharagpur Junction", state: "West Bengal" },
  { code: "BPL", name: "Bhopal", fullName: "Bhopal Junction", state: "Madhya Pradesh" },
  { code: "JHS", name: "Jhansi", fullName: "Jhansi Junction", state: "Uttar Pradesh" },
  { code: "KOTA", name: "Kota", fullName: "Kota Junction", state: "Rajasthan" },
  { code: "ALD", name: "Prayagraj", fullName: "Prayagraj Junction", state: "Uttar Pradesh" },
  { code: "GKP", name: "Gorakhpur", fullName: "Gorakhpur Junction", state: "Uttar Pradesh" },
  { code: "ASR", name: "Amritsar", fullName: "Amritsar Junction", state: "Punjab" },
  { code: "LTT", name: "Lokmanya Tilak Terminus", fullName: "Lokmanya Tilak Terminus", state: "Maharashtra" },
  { code: "DEC", name: "Delhi Cantt", fullName: "Delhi Cantonment", state: "Delhi" },
  { code: "DLI", name: "Delhi", fullName: "Delhi Junction", state: "Delhi" },
  { code: "MMCT", name: "Mumbai Central", fullName: "Mumbai Central", state: "Maharashtra" },
  { code: "AII", name: "Ajmer", fullName: "Ajmer Junction", state: "Rajasthan" },
  { code: "UDZ", name: "Udaipur", fullName: "Udaipur City", state: "Rajasthan" },
  { code: "JAT", name: "Jammu Tawi", fullName: "Jammu Tawi", state: "Jammu and Kashmir" },
  { code: "DEE", name: "Delhi S Rohilla", fullName: "Delhi Sarai Rohilla", state: "Delhi" },
  { code: "KYN", name: "Kalyan", fullName: "Kalyan Junction", state: "Maharashtra" },
  { code: "NGP", name: "Nagpur", fullName: "Nagpur Junction", state: "Maharashtra" },
  { code: "SC", name: "Secunderabad", fullName: "Secunderabad Junction", state: "Telangana" },
];

function findStation(code: string): Station | undefined {
  const upper = code.toUpperCase();
  return STATIONS.find((s) => s.code === upper) || undefined;
}

/* ─── Train Database ───────────────────────────────────────── */

interface MockTrainEntry {
  number: string;
  name: string;
  type: string;
  from: string;
  to: string;
  departure: string;
  arrival: string;
  duration: string;
  distance: number;
  classes: { code: string; name: string; fare: number; seats: number }[];
  sunday: boolean;
  monday: boolean;
  tuesday: boolean;
  wednesday: boolean;
  thursday: boolean;
  friday: boolean;
  saturday: boolean;
}

const TRAINS: MockTrainEntry[] = [
  {
    number: "12951", name: "Mumbai Rajdhani Express", type: "RAJDHANI", from: "NDLS", to: "BCT",
    departure: "16:55", arrival: "08:35", duration: "15h 40m", distance: 1386,      classes: [{ code: "1A", name: "First AC", fare: 4685, seats: 18 }, { code: "2A", name: "2 Tier AC", fare: 2745, seats: 54 }, { code: "3A", name: "3 Tier AC", fare: 1940, seats: 72 }],
    sunday: true, monday: true, tuesday: true, wednesday: true, thursday: true, friday: true, saturday: true,
  },
  {
    number: "12001", name: "Shatabdi Express", type: "SHATABDI", from: "NDLS", to: "JP",
    departure: "06:00", arrival: "10:30", duration: "4h 30m", distance: 309,
    classes: [{ code: "CC", name: "Chair Car", fare: 890, seats: 76 }, { code: "EC", name: "Executive Chair Car", fare: 1780, seats: 32 }],
    sunday: false, monday: true, tuesday: true, wednesday: true, thursday: true, friday: true, saturday: true,
  },
  {
    number: "12009", name: "Shatabdi Express", type: "SHATABDI", from: "NDLS", to: "CDG",
    departure: "07:30", arrival: "10:55", duration: "3h 25m", distance: 276,
    classes: [{ code: "CC", name: "Chair Car", fare: 780, seats: 64 }, { code: "EC", name: "Executive Chair Car", fare: 1580, seats: 28 }],
    sunday: false, monday: true, tuesday: true, wednesday: true, thursday: true, friday: true, saturday: true,
  },
  {
    number: "12215", name: "Garib Rath", type: "GARIB_RATH", from: "NDLS", to: "JP",
    departure: "08:10", arrival: "14:05", duration: "5h 55m", distance: 309,
    classes: [{ code: "3A", name: "3 Tier AC", fare: 740, seats: 156 }],
    sunday: true, monday: true, tuesday: true, wednesday: true, thursday: true, friday: true, saturday: true,
  },
  {
    number: "12285", name: "Secunderabad Duronto Express", type: "DURONTO", from: "NDLS", to: "SC",
    departure: "05:45", arrival: "21:30", duration: "15h 45m", distance: 1126,
    classes: [{ code: "1A", name: "First AC", fare: 4890, seats: 12 }, { code: "2A", name: "2 Tier AC", fare: 2860, seats: 36 }, { code: "3A", name: "3 Tier AC", fare: 2060, seats: 48 }],
    sunday: true, monday: false, tuesday: true, wednesday: false, thursday: true, friday: false, saturday: true,
  },
  {
    number: "14211", name: "Intercity Express", type: "EXPRESS", from: "NDLS", to: "JP",
    departure: "09:00", arrival: "15:30", duration: "6h 30m", distance: 309,
    classes: [{ code: "SL", name: "Sleeper", fare: 210, seats: 240 }, { code: "2S", name: "Second Sitting", fare: 130, seats: 180 }],
    sunday: true, monday: true, tuesday: true, wednesday: true, thursday: true, friday: true, saturday: true,
  },
  {
    number: "12055", name: "Jan Shatabdi Express", type: "SHATABDI", from: "NDLS", to: "JP",
    departure: "08:15", arrival: "14:25", duration: "6h 10m", distance: 309,
    classes: [{ code: "CC", name: "Chair Car", fare: 470, seats: 64 }, { code: "2S", name: "Second Sitting", fare: 220, seats: 120 }],
    sunday: true, monday: true, tuesday: true, wednesday: true, thursday: true, friday: true, saturday: true,
  },
  {
    number: "12301", name: "Howrah Rajdhani Express", type: "RAJDHANI", from: "NDLS", to: "HWH",
    departure: "16:55", arrival: "09:55", duration: "17h 00m", distance: 1453,
    classes: [{ code: "1A", name: "First AC", fare: 5355, seats: 14 }, { code: "2A", name: "2 Tier AC", fare: 3185, seats: 48 }, { code: "3A", name: "3 Tier AC", fare: 2255, seats: 66 }],
    sunday: true, monday: true, tuesday: true, wednesday: true, thursday: true, friday: true, saturday: true,
  },
  {
    number: "22691", name: "Kranti Express", type: "SUPERFAST", from: "SBC", to: "NDLS",
    departure: "22:15", arrival: "05:30", duration: "31h 15m", distance: 1480,
    classes: [{ code: "2A", name: "2 Tier AC", fare: 3150, seats: 32 }, { code: "3A", name: "3 Tier AC", fare: 2200, seats: 48 }, { code: "SL", name: "Sleeper", fare: 785, seats: 180 }],
    sunday: true, monday: true, tuesday: true, wednesday: true, thursday: true, friday: true, saturday: true,
  },
  {
    number: "12903", name: "Golden Temple Mail", type: "SUPERFAST", from: "MMCT", to: "ASR",
    departure: "20:35", arrival: "08:30", duration: "35h 55m", distance: 1700,
    classes: [{ code: "2A", name: "2 Tier AC", fare: 3370, seats: 36 }, { code: "3A", name: "3 Tier AC", fare: 2360, seats: 54 }, { code: "SL", name: "Sleeper", fare: 850, seats: 200 }],
    sunday: true, monday: true, tuesday: true, wednesday: true, thursday: true, friday: true, saturday: true,
  },
  {
    number: "12621", name: "Tamil Nadu Express", type: "SUPERFAST", from: "NDLS", to: "MAS",
    departure: "22:10", arrival: "06:10", duration: "32h 00m", distance: 1537,
    classes: [{ code: "2A", name: "2 Tier AC", fare: 3280, seats: 24 }, { code: "3A", name: "3 Tier AC", fare: 2290, seats: 48 }, { code: "SL", name: "Sleeper", fare: 820, seats: 160 }],
    sunday: true, monday: true, tuesday: true, wednesday: true, thursday: true, friday: true, saturday: true,
  },
  {
    number: "12627", name: "Karnataka Express", type: "SUPERFAST", from: "NDLS", to: "SBC",
    departure: "21:20", arrival: "06:25", duration: "33h 05m", distance: 1480,
    classes: [{ code: "2A", name: "2 Tier AC", fare: 3150, seats: 32 }, { code: "3A", name: "3 Tier AC", fare: 2200, seats: 48 }, { code: "SL", name: "Sleeper", fare: 785, seats: 180 }],
    sunday: true, monday: true, tuesday: true, wednesday: true, thursday: true, friday: true, saturday: true,
  },
];

/* ─── Helpers ──────────────────────────────────────────────── */

function getToday(): string {
  return new Date().toISOString().split("T")[0];
}

function durationToMinutes(d: string): number {
  const parts = d.match(/(\d+)h\s*(\d+)?m?/);
  if (!parts) return 0;
  return parseInt(parts[1]) * 60 + (parseInt(parts[2]) || 0);
}

/* ─── Mock Provider ────────────────────────────────────────── */

export class MockRailwayProvider implements RailwayProvider {
  name = "Mock Indian Railways";

  async searchStations(query: string, limit = 10): Promise<StationSearchResult> {
    const q = query.toLowerCase();
    // Simulate network delay
    await delay(100 + Math.random() * 200);

    const results = STATIONS.filter(
      (s) =>
        s.code.toLowerCase().includes(q) ||
        s.name.toLowerCase().includes(q) ||
        s.fullName?.toLowerCase().includes(q)
    ).slice(0, limit);

    return {
      stations: results,
      total: results.length,
      query,
    };
  }

  async searchTrains(params: TrainSearchParams): Promise<TrainSearchResult> {
    await delay(400 + Math.random() * 400);

    const fromCode = params.from.toUpperCase();
    const toCode = params.to.toUpperCase();
    const fromStation = findStation(fromCode);
    const toStation = findStation(toCode);

    // Find direct trains between these stations
    const directTrains = TRAINS.filter(
      (t) =>
        (t.from === fromCode && t.to === toCode) ||
        (t.from === toCode && t.to === fromCode)
    );

    const entries: TrainSearchEntry[] = directTrains.map((t, idx) => {
      const totalSeats = t.classes.reduce((sum, c) => sum + (c.seats || 0), 0);

      // Assign recommendation badges
      let badge: TrainSearchEntry["recommendation"] = undefined;
      if (idx === 0) {
        badge = {
          badge: "best",
          reason:
            "Best balance of speed, comfort & price. Premium service with meals included.",
        };
      } else if (idx === 1 && directTrains.length > 1) {
        const fastestTime = Math.min(
          ...directTrains.map((dt) => durationToMinutes(dt.duration))
        );
        if (durationToMinutes(t.duration) === fastestTime) {
          badge = {
            badge: "fastest",
            reason:
              "Fastest connection between these stations with minimal travel time.",
          };
        }
      }

      // Cheapest badge
      if (!badge && t.classes.some((c) => c.fare && c.fare < 800)) {
        badge = {
          badge: "cheapest",
          reason:
            "Most economical option. Great value for budget-conscious travelers.",
        };
      }

      // Comfortable badge
      if (!badge && t.classes.some((c) => c.fare && c.fare > 2000)) {
        badge = {
          badge: "comfortable",
          reason:
            "Premium class available for a more comfortable journey experience.",
        };
      }

      return {
        train: {
          number: t.number,
          name: t.name,
          type: t.type as TrainSearchEntry["train"]["type"],
          from: { code: fromCode, name: fromStation?.name || fromCode },
          to: { code: toCode, name: toStation?.name || toCode },
          departure: t.departure,
          arrival: t.arrival,
          duration: t.duration,
          distance: t.distance,
          runningDays: [
            { day: "sun", runs: t.sunday },
            { day: "mon", runs: t.monday },
            { day: "tue", runs: t.tuesday },
            { day: "wed", runs: t.wednesday },
            { day: "thu", runs: t.thursday },
            { day: "fri", runs: t.friday },
            { day: "sat", runs: t.saturday },
          ],
          classes: t.classes.map((c) => ({
            code: c.code,
            name: c.name,
            available: c.seats > 0,
            fare: c.fare || undefined,
          })),
        },
        availableClasses: t.classes
          .filter((c) => c.fare !== null && c.seats > 0)
          .map((c) => ({
            code: c.code,
            name: c.name,
            available: c.seats > 0,
            fare: c.fare || 0,
            seats: c.seats,
            status: c.seats > 10 ? "AVAILABLE" as const : c.seats > 0 ? "RAC" as const : "NOT_AVAILABLE" as const,
          })),
        recommendation: badge,
      };
    });

    // Add additional trains if we don't have many
    if (entries.length < 3) {
      const extraTrains = [
        {
          number: "22451", name: "Express", type: "SUPERFAST",
          departure: "05:45", arrival: "12:30", duration: "6h 45m", distance: 350,
          from: fromCode, to: toCode,
          seats: [{ code: "SL", name: "Sleeper", fare: 350, seats: 180 }, { code: "3A", name: "3 Tier AC", fare: 890, seats: 48 }],
        },
        {
          number: "15011", name: "Express Mail", type: "EXPRESS",
          departure: "11:30", arrival: "19:00", duration: "7h 30m", distance: 350,
          from: fromCode, to: toCode,
          seats: [{ code: "SL", name: "Sleeper", fare: 280, seats: 240 }, { code: "2S", name: "Second Sitting", fare: 160, seats: 200 }],
        },
      ];

      for (let i = 0; i < extraTrains.length && entries.length < 5; i++) {
        const et = extraTrains[i];
        entries.push({
          train: {
            number: et.number,
            name: `Delhi ${et.name}`,
            type: et.type as TrainSearchEntry["train"]["type"],
            from: { code: fromCode, name: fromStation?.name || fromCode },
            to: { code: toCode, name: toStation?.name || toCode },
            departure: et.departure,
            arrival: et.arrival,
            duration: et.duration,
            distance: et.distance,
            runningDays: [
              { day: "sun", runs: true },
              { day: "mon", runs: true },
              { day: "tue", runs: true },
              { day: "wed", runs: true },
              { day: "thu", runs: true },
              { day: "fri", runs: true },
              { day: "sat", runs: true },
            ],
            classes: et.seats.map((c) => ({
              code: c.code,
              name: c.name,
              available: c.seats > 0,
              fare: c.fare,
            })) as any,
          },
          availableClasses: et.seats
            .filter((c) => c.seats > 0)
            .map((c) => ({
              code: c.code,
              name: c.name,
              available: c.seats > 0,
              fare: c.fare,
              seats: c.seats,
              status: "AVAILABLE" as const,
            })),
          recommendation: undefined,
        });
      }
    }

    return {
      trains: entries,
      total: entries.length,
      from: { code: fromCode, name: fromStation?.name || fromCode },
      to: { code: toCode, name: toStation?.name || toCode },
      date: params.date || getToday(),
    };
  }

  async getTrainSchedule(trainNumber: string): Promise<TrainSchedule> {
    await delay(200 + Math.random() * 300);
    const train = TRAINS.find((t) => t.number === trainNumber);
    if (!train) throw new Error(`Train ${trainNumber} not found`);

    return {
      train: { number: train.number, name: train.name },
      route: [
        { station: { code: train.from, name: findStation(train.from)?.name || train.from }, day: 1, arrival: "-", departure: train.departure, distance: 0, platform: "1", halt: "-", zone: "NR" },
        { station: { code: train.to, name: findStation(train.to)?.name || train.to }, day: 1, arrival: train.arrival, departure: "-", distance: train.distance, platform: "1", halt: "-", zone: queryZone(train.from) },
      ],
      totalStops: 1,
      totalDistance: train.distance,
      duration: train.duration,
    };
  }

  async getSeatAvailability(params: SeatAvailabilityParams): Promise<SeatAvailability> {
    await delay(300 + Math.random() * 400);
    const train = TRAINS.find((t) => t.number === params.trainNumber);

    return {
      train: { number: params.trainNumber, name: train?.name || "Train" },
      date: params.date || getToday(),
      from: { code: params.from, name: "" },
      to: { code: params.to, name: "" },
      classes: (train?.classes || [])
        .filter((c) => c.seats > 0)
        .map((c) => {
          const avail = Math.floor(c.seats * 0.35);
          return {
            code: c.code,
            name: c.name,
            fare: c.fare || 0,
            available: avail,
            total: c.seats,
            status: avail > 10 ? "AVAILABLE" as const : avail > 0 ? "RAC" as const : "NOT_AVAILABLE" as const,
            racCount: avail === 0 ? 0 : Math.floor(Math.random() * 10),
            wlCount: avail === 0 ? Math.floor(Math.random() * 50) : 0,
          };
        }),
      lastUpdated: new Date().toISOString(),
    };
  }

  async getFare(params: FareParams): Promise<FareEnquiry> {
    await delay(200 + Math.random() * 300);
    const train = TRAINS.find((t) => t.number === params.trainNumber);

    return {
      train: { number: params.trainNumber, name: train?.name || "Train" },
      from: { code: params.from, name: "" },
      to: { code: params.to, name: "" },
      date: params.date || getToday(),
      classes: (train?.classes || [])
        .filter((c) => c.fare !== null && c.seats > 0)
        .map((c) => ({
          code: c.code,
          name: c.name,
          baseFare: c.fare || 0,
          reservationCharge: 30,
          superfastCharge: 45,
          convenienceFee: 30,
          totalFare: (c.fare || 0) + 30 + 45 + 30,
          available: c.seats > 0,
        })),
      baseFare: 0,
      totalFare: 0,
      lastUpdated: new Date().toISOString(),
    };
  }

  async getPNRStatus(pnr: string): Promise<PNRStatus> {
    await delay(300 + Math.random() * 500);

    const statuses: PNRStatus[] = [
      {
        pnr: "4785213694",
        train: { number: "12951", name: "Mumbai Rajdhani Express" },
        from: { code: "NDLS", name: "New Delhi" },
        to: { code: "BCT", name: "Mumbai Central" },
        boardingAt: { code: "NDLS", name: "New Delhi" },
        date: getToday(),
        class: "3A",
        quota: "GN",
        chartPrepared: true,
        passengers: [
          { number: 1, name: "A. Kumar", age: 28, gender: "M", status: "CNF", berth: "B1-34 (Lower)", bookingStatus: "CNF", currentStatus: "CNF", coach: "B1", seat: "34" },
          { number: 2, name: "P. Sharma", age: 32, gender: "M", status: "CNF", berth: "B1-35 (Upper)", bookingStatus: "CNF", currentStatus: "CNF", coach: "B1", seat: "35" },
        ],
        status: "CONFIRMED",
        departure: "16:55",
        arrival: "08:35",
        platform: "5",
        lastUpdated: new Date().toISOString(),
      },
      {
        pnr: "8651274390",
        train: { number: "12009", name: "Shatabdi Express" },
        from: { code: "NDLS", name: "New Delhi" },
        to: { code: "CDG", name: "Chandigarh" },
        boardingAt: { code: "NDLS", name: "New Delhi" },
        date: getTomorrow(),
        class: "CC",
        quota: "GN",
        chartPrepared: false,
        passengers: [
          { number: 1, name: "R. Patel", age: 45, gender: "M", status: "RAC 1", berth: "C2-12 (Side)", bookingStatus: "RAC", currentStatus: "RAC 1", coach: "C2", seat: "12" },
        ],
        status: "RAC",
        departure: "07:30",
        arrival: "10:55",
        platform: "3",
        lastUpdated: new Date().toISOString(),
      },
    ];

    const found = statuses.find((s) => s.pnr === pnr);
    if (found) return found;

    // Generate mock for any PNR
    return {
      pnr,
      train: { number: "12215", name: "Garib Rath" },
      from: { code: "NDLS", name: "New Delhi" },
      to: { code: "JP", name: "Jaipur" },
      boardingAt: { code: "NDLS", name: "New Delhi" },
      date: getTomorrow(),
      class: "3A",
      quota: "GN",
      chartPrepared: false,
      passengers: [
        { number: 1, name: "S. Singh", age: 35, gender: "M", status: "WL 15", berth: "-", bookingStatus: "WL", currentStatus: "WL 15" },
      ],
      status: "WAITLIST",
      departure: "08:10",
      arrival: "14:05",
      lastUpdated: new Date().toISOString(),
    };
  }

  async getLiveStatus(trainNumber: string, station?: string): Promise<LiveStatus> {
    void station;
    await delay(200 + Math.random() * 400);
    const train = TRAINS.find((t) => t.number === trainNumber);

    // Build a dynamic route based on the train's actual from/to
    const fromCode = train?.from || "NDLS";
    const toCode = train?.to || "BCT";
    const fromName = findStation(fromCode)?.name || fromCode;
    const toName = findStation(toCode)?.name || toCode;
    const totalDist = train?.distance || 1000;
    const depTime = train?.departure || "06:00";
    const arrTime = train?.arrival || "20:00";

    // Pick a realistic midway station based on the route
    const midwayStation = getMidwayStation(fromCode, toCode);
    const midwayDist = Math.round(totalDist * 0.55);
    const midwayArr = interpolateTime(depTime, arrTime, 0.5);
    const midwayDep = interpolateTime(depTime, arrTime, 0.52);

    // Simulate some delay and position
    const delayMinutes = Math.floor(Math.random() * 12);
    const speed = 70 + Math.floor(Math.random() * 25);
    const distanceCovered = midwayDist;
    const position = totalDist > 0 ? Math.round((distanceCovered / totalDist) * 100) : 50;

    return {
      train: { number: trainNumber, name: train?.name || "Train" },
      currentStation: { code: midwayStation.code, name: midwayStation.name },
      lastUpdated: new Date().toISOString(),
      delay: delayMinutes,
      speed,
      status: delayMinutes > 10 ? "DELAYED" : "ONTIME",
      hasDeparted: true,
      distanceCovered,
      totalDistance: totalDist,
      position,
      route: [
        {
          station: { code: fromCode, name: fromName },
          scheduledArrival: "-",
          scheduledDeparture: depTime,
          distance: 0, day: 1, delay: 0, crossed: true,
        },
        {
          station: { code: midwayStation.code, name: midwayStation.name },
          scheduledArrival: midwayArr,
          scheduledDeparture: midwayDep,
          distance: midwayDist, day: 1, platform: "2", delay: delayMinutes,
          crossed: true,
        },
        {
          station: { code: toCode, name: toName },
          scheduledArrival: arrTime,
          scheduledDeparture: "-",
          distance: totalDist, day: 1, delay: Math.floor(delayMinutes * 0.7),
          crossed: false,
        },
      ],
    };
  }

  async getCoachComposition(trainNumber: string): Promise<CoachComposition> {
    await delay(150 + Math.random() * 200);
    const train = TRAINS.find((t) => t.number === trainNumber);

    return {
      train: { number: trainNumber, name: train?.name || "Train" },
      coaches: [
        { number: "EOG", type: "EOG", class: "EOG", position: 0, totalBerths: 0 },
        { number: "B1", type: "3 Tier AC", class: "3A", position: 1, totalBerths: 72, availableBerths: 18 },
        { number: "B2", type: "3 Tier AC", class: "3A", position: 2, totalBerths: 72, availableBerths: 24 },
        { number: "B3", type: "3 Tier AC", class: "3A", position: 3, totalBerths: 72, availableBerths: 6 },
        { number: "A1", type: "2 Tier AC", class: "2A", position: 4, totalBerths: 54, availableBerths: 8 },
        { number: "A2", type: "2 Tier AC", class: "2A", position: 5, totalBerths: 54, availableBerths: 12 },
        { number: "HA1", type: "First AC", class: "1A", position: 6, totalBerths: 24, availableBerths: 2 },
        { number: "PC", type: "Pantry Car", class: "PC", position: 7, totalBerths: 0 },
        { number: "S1", type: "Sleeper", class: "SL", position: 8, totalBerths: 84, availableBerths: 32 },
        { number: "S2", type: "Sleeper", class: "SL", position: 9, totalBerths: 84, availableBerths: 24 },
        { number: "S3", type: "Sleeper", class: "SL", position: 10, totalBerths: 84, availableBerths: 48 },
        { number: "EOG", type: "EOG", class: "EOG", position: 11, totalBerths: 0 },
      ],
      totalCoaches: 12,
    };
  }

  async healthCheck(): Promise<boolean> {
    return true;
  }
}

/* ─── Utilities ────────────────────────────────────────────── */

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getTomorrow(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().split("T")[0];
}

function queryZone(code: string): string {
  const zones: Record<string, string> = {
    NDLS: "NR", JP: "NWR", BCT: "WR", MAS: "SR", SBC: "SWR",
    HWH: "ER", CDG: "NR", PUNE: "CR", LKO: "NR",
  };
  return zones[code] || "NR";
}

/** Realistic midway stations for common IR routes */
const MIDWAY_STATIONS: Record<string, { code: string; name: string }> = {
  // Delhi → Mumbai
  NDLS_BCT: { code: "KOTA", name: "Kota Junction" },
  NDLS_MMCT: { code: "KOTA", name: "Kota Junction" },
  NDLS_CSTM: { code: "KOTA", name: "Kota Junction" },
  // Delhi → Howrah
  NDLS_HWH: { code: "ALD", name: "Prayagraj Junction" },
  // Delhi → Chennai
  NDLS_MAS: { code: "NGP", name: "Nagpur Junction" },
  // Delhi → Bangalore
  NDLS_SBC: { code: "SC", name: "Secunderabad Junction" },
  NDLS_JP: { code: "AII", name: "Ajmer Junction" },
  NDLS_CDG: { code: "DEC", name: "Delhi Cantt" },
  NDLS_SC: { code: "JHS", name: "Jhansi Junction" },
  // Mumbai → Delhi (reverse)
  BCT_NDLS: { code: "KOTA", name: "Kota Junction" },
  MMCT_NDLS: { code: "KOTA", name: "Kota Junction" },
  // Delhi → Amritsar
  NDLS_ASR: { code: "DEC", name: "Delhi Cantt" },
  NDLS_JAT: { code: "DEC", name: "Delhi Cantt" },
  // Bangalore → Delhi (reverse)
  SBC_NDLS: { code: "SC", name: "Secunderabad Junction" },
  // Mumbai → Amritsar
  MMCT_ASR: { code: "AII", name: "Ajmer Junction" },
  // Other routes
  JP_NDLS: { code: "AII", name: "Ajmer Junction" },
  HWH_NDLS: { code: "ALD", name: "Prayagraj Junction" },
};

function getMidwayStation(from: string, to: string): { code: string; name: string } {
  const key = `${from}_${to}`;
  const reversed = `${to}_${from}`;
  return MIDWAY_STATIONS[key] || MIDWAY_STATIONS[reversed] || { code: "KOTA", name: "Kota Junction" };
}

/** Roughly interpolate a time between departure and arrival, given fraction */
function interpolateTime(dep: string, arr: string, fraction: number): string {
  const toMins = (t: string) => {
    const m = t.match(/(\d{1,2}):(\d{2})/);
    return m ? parseInt(m[1]) * 60 + parseInt(m[2]) : 0;
  };
  const fromMins = (m: number) => {
    const h = Math.floor(m / 60) % 24;
    const min = m % 60;
    return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
  };

  let depMins = toMins(dep);
  let arrMins = toMins(arr);
  // Handle overnight trains (arrival < departure means next day)
  if (arrMins < depMins) arrMins += 24 * 60;

  const midway = Math.round(depMins + (arrMins - depMins) * fraction);
  return fromMins(midway);
}

/** Create a singleton instance */
export const mockProvider = new MockRailwayProvider();
