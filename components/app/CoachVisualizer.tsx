"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Map,
  ChevronLeft,
  ChevronRight,
  Info,
  Check,
  Sparkles,
  Maximize2,
  Minimize2,
  Train,
  AlertCircle,
  RefreshCw,
} from "lucide-react";
import { useBooking } from "@/lib/booking-store";
import type { SeatAvailabilityClass } from "@/lib/railway/types";

/* ─── Types ─────────────────────────────────────────────────── */

interface Seat {
  id: string;
  number: number;
  status: "available" | "booked" | "selected" | "recommended";
  tier: "lower" | "middle" | "upper" | "side-lower" | "side-upper";
  price: number;
}

interface BerthInfo {
  id: string;
  label: string;
  seats: Seat[];
}

interface CoachLayout {
  name: string;
  type: string; // e.g. "3 Tier AC (3A)"
  classCode: string;
  berths: BerthInfo[];
  fare: number;
  available: number;
}

/* ─── Class-to-Layout Configuration ─────────────────────────── */

interface ClassLayoutConfig {
  coachPrefix: string;
  displayName: (code: string) => string;
  berthsPerBay: number;
  bays: number;
  sideBerths: { count: number; tiers: Array<"side-lower" | "side-upper"> };
  startNumber: number;
  aisleAfterBay?: boolean;
}

const CLASS_LAYOUTS: Record<string, ClassLayoutConfig> = {
  "1A": {
    coachPrefix: "H",
    displayName: (_code: string) => "First AC (1A)",
    berthsPerBay: 2,
    bays: 6,
    sideBerths: { count: 2, tiers: ["side-lower", "side-upper"] },
    startNumber: 1,
  },
  "2A": {
    coachPrefix: "A",
    displayName: (_code: string) => "Second AC (2A)",
    berthsPerBay: 2,
    bays: 6,
    sideBerths: { count: 2, tiers: ["side-lower", "side-upper"] },
    startNumber: 1,
  },
  "3A": {
    coachPrefix: "B",
    displayName: (_code: string) => "Third AC (3A)",
    berthsPerBay: 3,
    bays: 6,
    sideBerths: { count: 4, tiers: ["side-lower", "side-upper"] },
    startNumber: 1,
  },
  SL: {
    coachPrefix: "S",
    displayName: (_code: string) => "Sleeper (SL)",
    berthsPerBay: 3,
    bays: 8,
    sideBerths: { count: 4, tiers: ["side-lower", "side-upper"] },
    startNumber: 1,
  },
  CC: {
    coachPrefix: "C",
    displayName: (_code: string) => "Chair Car (CC)",
    berthsPerBay: 4,
    bays: 0,
    sideBerths: { count: 0, tiers: [] },
    startNumber: 1,
  },
  EC: {
    coachPrefix: "E",
    displayName: (_code: string) => "Executive Chair Car (EC)",
    berthsPerBay: 3,
    bays: 0,
    sideBerths: { count: 0, tiers: [] },
    startNumber: 1,
  },
  "2S": {
    coachPrefix: "D",
    displayName: (_code: string) => "Second Sitting (2S)",
    berthsPerBay: 4,
    bays: 0,
    sideBerths: { count: 0, tiers: [] },
    startNumber: 1,
  },
  FC: {
    coachPrefix: "F",
    displayName: (_code: string) => "First Class (FC)",
    berthsPerBay: 3,
    bays: 8,
    sideBerths: { count: 2, tiers: ["side-lower", "side-upper"] },
    startNumber: 1,
  },
};

/* ─── Helpers ───────────────────────────────────────────────── */

const TIER_NAMES: Record<string, string> = {
  lower: "Lower",
  middle: "Middle",
  upper: "Upper",
  "side-lower": "Side Lower",
  "side-upper": "Side Upper",
};

const TIER_SHORT: Record<string, string> = {
  lower: "L",
  middle: "M",
  upper: "U",
  "side-lower": "SL",
  "side-upper": "SU",
};

function shuffleArray<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function getTierOrder(berthsPerBay: number): Array<"lower" | "middle" | "upper"> {
  if (berthsPerBay === 2) return ["lower", "upper"];
  return ["lower", "middle", "upper"];
}

/* ─── Coach Generator ───────────────────────────────────────── */

function generateCoachesForClass(
  classData: SeatAvailabilityClass,
  numCoaches: number
): CoachLayout[] {
  const config = CLASS_LAYOUTS[classData.code] || CLASS_LAYOUTS["3A"];
  const coaches: CoachLayout[] = [];
  const totalBerthsPerCoach = config.bays * config.berthsPerBay + config.sideBerths.count;
  const totalCoachesBerths = totalBerthsPerCoach * numCoaches;
  // Clamp so some seats show as booked for realism
  const rawRatio = totalCoachesBerths > 0 ? classData.available / totalCoachesBerths : 0.5;
  const availRatio = Math.min(rawRatio, 0.92);

  for (let ci = 0; ci < numCoaches; ci++) {
    const coachName = `${config.coachPrefix}${ci + 1}`;
    const berths: BerthInfo[] = [];
    let seatCounter = config.startNumber;

    // Determine which seats are available in this coach
    const totalSeatsInCoach = totalBerthsPerCoach;
    const availableForCoach = Math.round(
      availRatio * totalSeatsInCoach * (0.9 + Math.random() * 0.2)
    );
    const bookedSeatsCount = Math.max(
      0,
      totalSeatsInCoach - Math.min(availableForCoach, totalSeatsInCoach)
    );

    // Pre-compute which indices are booked
    const indices = shuffleArray(Array.from({ length: totalSeatsInCoach }, (_, i) => i));
    const bookedIndices = new Set(indices.slice(0, bookedSeatsCount));

    let globalSeatIndex = 0;

    // Generate bays
    const tierOrder = getTierOrder(config.berthsPerBay);
    for (let bay = 0; bay < config.bays; bay++) {
      const baySeats: Seat[] = [];
      const bayLabel = `Bay ${bay + 1}`;

      for (let t = 0; t < config.berthsPerBay; t++) {
        const seatNum = seatCounter++;
        const tier = tierOrder[t];
        const seatId = `${coachName}-${seatNum}${TIER_SHORT[tier]}`;
        const isBooked = bookedIndices.has(globalSeatIndex++);

        baySeats.push({
          id: seatId,
          number: seatNum,
          status: isBooked ? "booked" : "available",
          tier,
          price: classData.fare,
        });
      }

      berths.push({
        id: `${coachName}-bay${bay + 1}`,
        label: bayLabel,
        seats: baySeats,
      });
    }

    // Generate side berths
    if (config.sideBerths.count > 0) {
      const sideSeats: Seat[] = [];
      // Split side berths into groups (usually 2 per side group)
      const groups = Math.ceil(config.sideBerths.count / 2);
      for (let g = 0; g < groups; g++) {
        const groupSeats: Seat[] = [];
        const sideTiers = config.sideBerths.tiers.slice(g * 2, g * 2 + 2);
        for (const tier of sideTiers) {
          const seatNum = seatCounter++;
          const seatId = `${coachName}-${seatNum}${TIER_SHORT[tier]}`;
          const isBooked = bookedIndices.has(globalSeatIndex++);

          groupSeats.push({
            id: seatId,
            number: seatNum,
            status: isBooked ? "booked" : "available",
            tier,
            price: Math.round(classData.fare * 0.85), // Side berths are ~15% cheaper
          });
        }
        sideSeats.push(...groupSeats);
      }

      if (sideSeats.length > 0) {
        berths.push({
          id: `${coachName}-side`,
          label: "Side",
          seats: sideSeats,
        });
      }
    }

    const availableInCoach = berths
      .flatMap((b) => b.seats)
      .filter((s) => s.status === "available").length;

    coaches.push({
      name: coachName,
      type: config.displayName(classData.code),
      classCode: classData.code,
      berths,
      fare: classData.fare,
      available: availableInCoach,
    });
  }

  // Mark the best seat as recommended in the first coach
  if (coaches.length > 0 && coaches[0].berths.length > 0) {
    const allSeats = coaches[0].berths.flatMap((b) => b.seats);
    const availableSeats = allSeats.filter((s) => s.status === "available");
    // Prefer lower berths
    const bestSeat =
      availableSeats.find((s) => s.tier === "lower" && s.status === "available") ||
      availableSeats[0];
    if (bestSeat) {
      bestSeat.status = "recommended";
    }
  }

  return coaches;
}

function generateAllCoaches(
  classes: SeatAvailabilityClass[]
): CoachLayout[] {
  const allCoaches: CoachLayout[] = [];

  for (const cls of classes) {
    const config = CLASS_LAYOUTS[cls.code] || CLASS_LAYOUTS["3A"];
    const totalBerthsPerCoach = config.bays * config.berthsPerBay + config.sideBerths.count;

    if (totalBerthsPerCoach === 0) continue; // Skip unknown layouts

    const numCoaches = Math.max(1, Math.ceil(cls.total / totalBerthsPerCoach));

    const coaches = generateCoachesForClass(cls, numCoaches);
    allCoaches.push(...coaches);
  }

  return allCoaches;
}

/* ─── Component ────────────────────────────────────────────── */

export default function CoachVisualizer() {
  const { state, setSelectedCoach, setSelectedSeat, confirmBooking, fetchAvailability } =
    useBooking();

  const [expanded, setExpanded] = useState(false);
  const [showLegend, setShowLegend] = useState(true);
  const [availabilityData, setAvailabilityData] = useState<SeatAvailabilityClass[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryTrigger, setRetryTrigger] = useState(0);

  const train = state.selectedTrain;
  const query = state.query;

  // Fetch availability data when the selected train changes
  useEffect(() => {
    if (!train?.number || !query?.origin || !query?.destination) return;

    const fromCode = query.origin.toUpperCase();
    const toCode = query.destination.toUpperCase();

    setIsLoading(true);
    setError(null);
    fetchAvailability(train.number, fromCode, toCode)
      .then((result) => {
        if (result.success && result.data) {
          const data = result.data as { classes?: SeatAvailabilityClass[] };
          setAvailabilityData(data.classes || []);
        } else {
          setError(result.error?.message || "Could not load seat availability");
        }
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Failed to load coach data");
      })
      .finally(() => setIsLoading(false));
  }, [train?.number, query?.origin, query?.destination, fetchAvailability, retryTrigger]);

  // Generate dynamic coach layouts from API data
  const coachLayouts = useMemo(() => {
    if (!availabilityData || availabilityData.length === 0) return [];

    // Use class data from API, or fallback to estimated totals
    const classes = availabilityData.map((c) => ({
      ...c,
      total: c.total || c.available, // if total isn't available, use available as floor
    }));

    return generateAllCoaches(classes);
  }, [availabilityData]);

  // Fallback if no API data: generate from train's class type
  const allCoaches = useMemo<CoachLayout[]>(() => {
    if (coachLayouts.length > 0) return coachLayouts;

    // Minimal fallback using the train's class type
    if (train) {
      const fallbackClass: SeatAvailabilityClass = {
        code: train.classType || "3A",
        name: "",
        fare: train.price || 1850,
        available: train.available || 50,
        total: train.available || 50,
        status: "AVAILABLE",
      };
      return generateCoachesForClass(fallbackClass, 2);
    }

    return [];
  }, [coachLayouts, train]);

  const coachKeys = useMemo(() => allCoaches.map((c) => c.name), [allCoaches]);
  const currentCoach = useMemo(
    () => allCoaches.find((c) => c.name === state.selectedCoach) || allCoaches[0],
    [allCoaches, state.selectedCoach]
  );

  // Update selectedCoach if it's not in the current list
  useEffect(() => {
    if (coachKeys.length > 0 && !coachKeys.includes(state.selectedCoach)) {
      setSelectedCoach(coachKeys[0]);
    }
  }, [coachKeys, state.selectedCoach, setSelectedCoach]);

  const allSeats = useMemo(
    () => currentCoach?.berths.flatMap((b) => b.seats) || [],
    [currentCoach]
  );

  const stats = useMemo(
    () => ({
      total: allSeats.length,
      available: allSeats.filter((s) => s.status === "available").length,
      booked: allSeats.filter((s) => s.status === "booked").length,
      recommended: allSeats.filter((s) => s.status === "recommended").length,
    }),
    [allSeats]
  );

  const selectedSeatData = allSeats.find((s) => s.id === state.selectedSeat);

  // Only find the recommended seat for AI panel display
  const recommendedSeat = useMemo(
    () => allSeats.find((s) => s.status === "recommended"),
    [allSeats]
  );

  const handleCoachChange = useCallback(
    (direction: 1 | -1) => {
      if (coachKeys.length === 0) return;
      const idx = coachKeys.indexOf(state.selectedCoach);
      const next = (idx + direction + coachKeys.length) % coachKeys.length;
      setSelectedCoach(coachKeys[next]);
      setSelectedSeat(null);
    },
    [coachKeys, state.selectedCoach, setSelectedCoach, setSelectedSeat]
  );

  const handleSelectSeat = useCallback(
    (seat: Seat) => {
      if (seat.status === "booked") return;
      setSelectedSeat(seat.id);
    },
    [setSelectedSeat]
  );

  /* ── Status styles ─────────────────────────────────────── */
  const statusStyles: Record<string, string> = {
    available:
      "border-[var(--fg)] bg-transparent hover:bg-[var(--fg)] hover:text-[var(--bg)] cursor-pointer",
    booked:
      "border-[var(--fg)]/30 bg-[var(--fg)]/10 opacity-40 cursor-not-allowed",
    selected:
      "bg-[var(--fg)] text-[var(--bg)] border-[var(--fg)] cursor-pointer scale-105",
    recommended:
      "bg-[var(--railway-red)] text-[var(--bg)] border-[var(--railway-red)] cursor-pointer shadow-[0_0_12px_rgba(196,30,58,0.3)]",
  };

  // Loading state
  if (isLoading && allCoaches.length === 0) {
    return (
      <div className="space-y-6">
        <div className="border-2 border-[var(--fg)] p-12 text-center">
          <div className="w-12 h-12 mx-auto mb-4 border-2 border-[var(--fg)] border-t-transparent animate-spin" />
          <p className="text-sm text-[var(--muted)]">Loading coach layout...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error && allCoaches.length === 0) {
    return (
      <div className="space-y-6">
        <div className="border-2 border-[var(--fg)] p-12 text-center">
          <AlertCircle className="h-10 w-10 mx-auto mb-3 text-[var(--muted)]" />
          <p className="text-sm text-[var(--muted)]">{error}</p>
          <button
            onClick={() => {
              setError(null);
              setRetryTrigger((t) => t + 1);
            }}
            className="mt-4 inline-flex items-center gap-2 px-4 py-2 border border-[var(--fg)] text-xs uppercase tracking-[0.1em] hover:bg-[var(--fg)]/5 transition-colors"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Try Again
          </button>
        </div>
      </div>
    );
  }

  // Empty state
  if (allCoaches.length === 0) {
    return (
      <div className="space-y-6">
        <div className="border-2 border-dashed border-[var(--fg)]/30 p-12 text-center">
          <Train className="h-12 w-12 mx-auto mb-4 text-[var(--muted)]" />
          <h3 className="text-lg font-bold uppercase tracking-[0.03em] mb-2">
            No coach data available
          </h3>
          <p className="text-[13px] text-[var(--muted)] max-w-md mx-auto leading-relaxed">
            Select a train first to see its coach layout and book your seat.
          </p>
        </div>
      </div>
    );
  }

  if (!currentCoach) return null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold uppercase tracking-[0.05em]">
            Coach {currentCoach.name}
          </h2>
          <p className="text-[13px] text-[var(--muted)] mt-1">
            {currentCoach.type} · {train?.name} {train?.number} ·{" "}
            {train?.departure || "--:--"} → {train?.arrival || "--:--"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isLoading && (
            <div className="w-5 h-5 border-2 border-[var(--fg)] border-t-transparent animate-spin" />
          )}
          <button
            onClick={() => setExpanded(!expanded)}
            className="w-8 h-8 flex items-center justify-center border border-[var(--fg)] hover:bg-[var(--fg)]/5 transition-colors"
            title={expanded ? "Compact view" : "Expanded view"}
          >
            {expanded ? (
              <Minimize2 className="h-3.5 w-3.5" />
            ) : (
              <Maximize2 className="h-3.5 w-3.5" />
            )}
          </button>
          <button
            onClick={() => handleCoachChange(-1)}
            disabled={coachKeys.length <= 1}
            className="w-8 h-8 flex items-center justify-center border border-[var(--fg)] hover:bg-[var(--fg)]/5 transition-colors disabled:opacity-30"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <motion.div
            key={currentCoach.name}
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            className="min-w-[40px] text-center"
          >
            <span className="text-sm font-bold">{currentCoach.name}</span>
          </motion.div>
          <button
            onClick={() => handleCoachChange(1)}
            disabled={coachKeys.length <= 1}
            className="w-8 h-8 flex items-center justify-center border border-[var(--fg)] hover:bg-[var(--fg)]/5 transition-colors disabled:opacity-30"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Legend + Stats */}
      {showLegend && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          className="overflow-hidden"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-6 text-[11px] uppercase tracking-[0.1em]">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 border-2 border-[var(--fg)]" />
                <span>Available ({stats.available})</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-[var(--fg)]/30 border border-[var(--fg)]/30" />
                <span>Booked ({stats.booked})</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-[var(--railway-red)]" />
                <span className="text-[var(--railway-red)]">AI Recommended</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-[var(--fg)]" />
                <span>Selected</span>
              </div>
            </div>
            <button
              onClick={() => setShowLegend(false)}
              className="text-[10px] text-[var(--muted)] hover:text-[var(--fg)] uppercase tracking-[0.1em]"
            >
              Hide
            </button>
          </div>
        </motion.div>
      )}

      {!showLegend && (
        <button
          onClick={() => setShowLegend(true)}
          className="text-[11px] text-[var(--muted)] hover:text-[var(--fg)] uppercase tracking-[0.1em]"
        >
          Show legend
        </button>
      )}

      {/* Coach layout */}
      <motion.div
        className="border-2 border-[var(--fg)] p-6 overflow-x-auto"
        layout
        transition={{ duration: 0.3, ease: "easeInOut" }}
      >
        {/* Coach diagram - direction indicator */}
        <div className="flex items-center justify-center mb-6">
          <div className="flex items-center gap-2 text-[10px] text-[var(--muted)] uppercase tracking-[0.2em]">
            <div className="w-8 h-px bg-[var(--muted)]" />
            <span>ENGINE →</span>
            <div className="w-8 h-px bg-[var(--muted)]" />
          </div>
        </div>

        {/* Berths grid */}
        <div
          className={`grid gap-x-6 gap-y-8 ${
            expanded ? "grid-cols-6" : "grid-cols-4"
          }`}
        >
          {currentCoach.berths.map((bay) => {
            const isSide = bay.label === "Side";
            return (
              <div key={bay.id} className="space-y-2">
                {!isSide && bay.seats.length > 1 && (
                  <div className="text-[10px] text-[var(--muted)] uppercase tracking-[0.1em] text-center mb-2">
                    {bay.label}
                  </div>
                )}
                <div className="space-y-2">
                  {bay.seats.map((seat) => {
                    const isSelected = state.selectedSeat === seat.id;
                    const isRecommended = seat.status === "recommended";

                    return (
                      <motion.button
                        key={seat.id}
                        onClick={() => handleSelectSeat(seat)}
                        disabled={seat.status === "booked"}
                        whileTap={
                          seat.status !== "booked" ? { scale: 0.95 } : undefined
                        }
                        className={`relative w-full aspect-square flex flex-col items-center justify-center border-2 text-[11px] font-bold transition-all duration-150 ${
                          statusStyles[seat.status]
                        } ${isSelected ? "ring-2 ring-[var(--fg)]" : ""}`}
                        title={`Seat ${seat.number} - ${TIER_NAMES[seat.tier]} - ₹${seat.price}`}
                      >
                        <motion.span
                          key={seat.number}
                          initial={isRecommended ? { scale: 0.8 } : undefined}
                          animate={isRecommended ? { scale: [1, 1.1, 1] } : undefined}
                          transition={
                            isRecommended
                              ? { duration: 2, repeat: Infinity }
                              : undefined
                          }
                        >
                          {seat.number}
                        </motion.span>
                        <span className="text-[8px] uppercase tracking-[0.1em] opacity-70">
                          {TIER_SHORT[seat.tier]}
                        </span>

                        {/* Recommendation indicator */}
                        {isRecommended && (
                          <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            className="absolute -top-1 -right-1 w-4 h-4 bg-[var(--railway-red)] flex items-center justify-center"
                          >
                            <Sparkles className="h-2.5 w-2.5 text-[var(--bg)]" />
                          </motion.div>
                        )}

                        {/* Selected indicator */}
                        {isSelected && (
                          <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            className="absolute -top-1 -right-1 w-4 h-4 bg-[var(--fg)] flex items-center justify-center"
                          >
                            <Check className="h-2.5 w-2.5 text-[var(--bg)]" />
                          </motion.div>
                        )}
                      </motion.button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Aisle indicator */}
        <div className="flex items-center justify-center mt-6">
          <div className="flex items-center gap-2 text-[10px] text-[var(--muted)] uppercase tracking-[0.2em]">
            <div className="w-8 h-px bg-[var(--muted)]" />
            <span>AISLE</span>
            <div className="w-8 h-px bg-[var(--muted)]" />
          </div>
        </div>

        {/* Side berths bottom row */}
        <AnimatePresence>
          {currentCoach.berths.filter((b) => b.label === "Side").length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="border-t-2 border-[var(--fg)]/20 mt-6 pt-4"
            >
              <div
                className={`flex items-center justify-center gap-4 ${
                  expanded ? "flex-wrap" : ""
                }`}
              >
                {currentCoach.berths
                  .filter((b) => b.label === "Side")
                  .flatMap((bay) =>
                    bay.seats.map((seat) => (
                      <motion.button
                        key={seat.id}
                        onClick={() => handleSelectSeat(seat)}
                        disabled={seat.status === "booked"}
                        whileTap={
                          seat.status !== "booked" ? { scale: 0.95 } : undefined
                        }
                        className={`w-16 aspect-square flex flex-col items-center justify-center border-2 text-[11px] font-bold transition-all duration-150 ${
                          statusStyles[seat.status]
                        }`}
                      >
                        <span>{seat.number}</span>
                        <span className="text-[8px] uppercase tracking-[0.1em] opacity-70">
                          {TIER_SHORT[seat.tier]}
                        </span>
                      </motion.button>
                    ))
                  )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* AI Seat Recommendation Panel */}
      {recommendedSeat && !state.selectedSeat && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="border-2 border-[var(--fg)] p-5"
        >
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 flex items-center justify-center bg-[var(--railway-red)] flex-shrink-0">
              <Sparkles className="h-5 w-5 text-[var(--bg)]" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-sm font-bold uppercase tracking-[0.05em]">
                  AI Seat Recommendation
                </span>
                <span className="text-[10px] px-2 py-0.5 bg-[var(--fg)] text-[var(--bg)] uppercase tracking-[0.1em]">
                  Best Match
                </span>
              </div>

              {/* Recommended seat highlight */}
              <div className="flex items-center gap-3 mb-3 p-3 bg-[var(--railway-red)]/[0.05] border border-[var(--railway-red)]/30">
                <div className="w-12 h-12 flex flex-col items-center justify-center bg-[var(--railway-red)] text-[var(--bg)]">
                  <span className="font-bold text-lg">
                    {recommendedSeat.number}
                  </span>
                  <span className="text-[8px] uppercase tracking-[0.1em]">
                    {TIER_NAMES[recommendedSeat.tier]}
                  </span>
                </div>
                <div>
                  <div className="text-sm font-bold">
                    Coach {currentCoach.name} · Seat{" "}
                    {recommendedSeat.number} ({TIER_NAMES[recommendedSeat.tier]})
                  </div>
                  <div className="text-[12px] text-[var(--muted)]">
                    ₹{recommendedSeat.price} ·{" "}
                    {currentCoach.type}
                  </div>
                </div>
              </div>

              {/* Reasoning */}
              <div className="text-[13px] leading-relaxed whitespace-pre-wrap text-[var(--muted)]">
                {recommendedSeat.tier === "lower"
                  ? "✓ Lower berth — easier access, preferred for daytime journeys.\n✓ Away from restrooms — quieter section of the coach.\n✓ Window seat — enjoy the views along the route."
                  : recommendedSeat.tier === "middle"
                  ? "✓ Middle berth — good compromise between upper and lower.\n✓ Middle of coach — less motion, smoother ride.\n✓ Near the center — balanced temperature."
                  : recommendedSeat.tier === "upper"
                  ? "✓ Upper berth — maximum privacy, undisturbed sleep.\n✓ Luggage stays below — more space up top.\n✓ Preferred for overnight journeys."
                  : "✓ Side berth — economical choice, great value.\n✓ Extra luggage space underneath.\n✓ Quieter than center bays."}
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Selected seat info + confirm */}
      {state.selectedSeat && selectedSeatData && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="border-2 border-[var(--fg)] p-5 flex items-center justify-between"
        >
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 flex items-center justify-center bg-[var(--fg)]">
              <Map className="h-5 w-5 text-[var(--bg)]" />
            </div>
            <div>
              <p className="font-bold text-sm">
                Seat {selectedSeatData.number} ·{" "}
                {TIER_NAMES[selectedSeatData.tier]}
              </p>
              <p className="text-[12px] text-[var(--muted)]">
                Coach {currentCoach.name} · ₹{selectedSeatData.price}
                {selectedSeatData.status === "recommended" && (
                  <span className="text-[var(--railway-red)] ml-2 font-semibold">
                    ✓ AI recommended
                  </span>
                )}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSelectedSeat(null)}
              className="px-4 py-3 border-2 border-[var(--fg)] text-xs uppercase tracking-[0.1em] font-semibold hover:bg-[var(--fg)]/5 transition-colors"
            >
              Change
            </button>
            <button
              onClick={confirmBooking}
              className="px-6 py-3 bg-[var(--fg)] text-[var(--bg)] text-xs uppercase tracking-[0.1em] font-semibold hover:bg-[var(--railway-red)] transition-colors flex items-center gap-2"
            >
              <Check className="h-4 w-4" />
              Confirm Booking
            </button>
          </div>
        </motion.div>
      )}

      {/* Quick actions */}
      <div className="flex items-center gap-3">
        <div className="flex-1 flex gap-3">
          {allCoaches
            .filter((c) => c.classCode !== currentCoach.classCode)
            .slice(0, 3)
            .map((coach) => (
              <button
                key={coach.name}
                onClick={() => {
                  setSelectedCoach(coach.name);
                  setSelectedSeat(null);
                }}
                className="flex items-center justify-center gap-2 px-4 py-3 border-2 border-[var(--fg)] text-xs uppercase tracking-[0.1em] font-semibold hover:bg-[var(--fg)] hover:text-[var(--bg)] transition-colors flex-1"
              >
                <Train className="h-3.5 w-3.5" />
                Switch to {coach.name}
              </button>
            ))}
        </div>
        <button className="flex items-center justify-center gap-2 px-4 py-3 border-2 border-[var(--fg)] text-xs uppercase tracking-[0.1em] font-semibold hover:bg-[var(--fg)] hover:text-[var(--bg)] transition-colors">
          <Info className="h-3.5 w-3.5" />
          Info
        </button>
      </div>
    </div>
  );
}
