"use client";

import { useState, useMemo, useCallback } from "react";
import { motion } from "framer-motion";
import { useBooking } from "@/lib/booking-store";
import { Check, Sparkles, ChevronLeft, ChevronRight } from "lucide-react";

/* ─── Seeded PRNG ──────────────────────────────────────────── */

/** Simple hash a string into a 32-bit integer */
function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    h = ((h << 5) - h) + c;
    h |= 0; // convert to 32-bit int
  }
  return Math.abs(h);
}

/** Mulberry32 — a fast, high-quality seeded PRNG returning values in [0, 1) */
function mulberry32(a: number): () => number {
  return () => {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

/** Create a seeded random function from a seed string */
function seedRandom(seed: string): () => number {
  return mulberry32(hashStr(seed || "default"));
}

/* ─── Seat Status ──────────────────────────────────────────── */

interface Seat {
  id: string;
  number: number;
  status: "available" | "booked" | "selected" | "recommended";
  tier: string;
  price: number;
}

interface Berth {
  id: string;
  label: string;
  seats: Seat[];
}

/* ─── Generate Coach Layout ────────────────────────────────── */

function generateCoach(trainClass: string, fare: number, seed: string): Berth[] {
  const bays = 6;
  const tiers = ["lower", "middle", "upper"] as const;
  const berths: Berth[] = [];
  let seatNum = 1;
  const rand = seedRandom(seed);

  for (let b = 0; b < bays; b++) {
    const seats: Seat[] = [];
    for (let t = 0; t < 3; t++) {
      const id = `B1-${seatNum}${tiers[t].charAt(0).toUpperCase()}`;
      const isBooked = rand() > 0.55;
      seats.push({
        id,
        number: seatNum,
        status: isBooked ? "booked" : "available",
        tier: tiers[t],
        price: fare,
      });
      seatNum++;
    }
    berths.push({ id: `bay-${b + 1}`, label: `Bay ${b + 1}`, seats });
  }

  // Mark one seat as recommended
  const allSeats = berths.flatMap((b) => b.seats);
  const available = allSeats.filter((s) => s.status === "available");
  const best = available.find((s) => s.tier === "lower") || available[0];
  if (best) best.status = "recommended";

  return berths;
}

/* ─── Tier Labels ──────────────────────────────────────────── */

const TIER_LABELS: Record<string, string> = {
  lower: "L",
  middle: "M",
  upper: "U",
};

/* ─── Component ────────────────────────────────────────────── */

export default function CoachVisualizer() {
  const { state, setSelectedSeat, processUserInput } = useBooking();
  const [coachIndex, setCoachIndex] = useState(0);

  const train = state.selectedTrain;
  const fare = train?.price || 1245;
  const classType = train?.classType || "3A";
  const coachName = `B${coachIndex + 1}`;

  const berths = useMemo(() => generateCoach(classType, fare, `${train?.number || ''}-${state.query?.date || ''}`), [classType, fare, train?.number, state.query?.date]);

  const allSeats = useMemo(() => berths.flatMap((b) => b.seats), [berths]);
  const availableCount = allSeats.filter((s) => s.status === "available").length;
  const recommendedSeat = allSeats.find((s) => s.status === "recommended");
  const selectedSeatData = allSeats.find((s) => s.id === state.selectedSeat);

  const handleSelectSeat = useCallback(
    (seat: Seat) => {
      if (seat.status === "booked") return;
      setSelectedSeat(seat.id);
    },
    [setSelectedSeat]
  );

  const handleConfirm = useCallback(async () => {
    // Route through the AI pipeline so all bookings go through confirmBooking tool
    const query = state.query;
    const seatData = allSeats.find((s) => s.id === state.selectedSeat);

    const bookingMessage = [
      `Confirm and book this ticket:`,
      `Train: ${train?.name || ""} (${train?.number || ""})`,
      `From: ${query?.origin || ""} to ${query?.destination || ""}`,
      `Date: ${query?.date || ""}`,
      `Departure: ${train?.departure || ""} · Arrival: ${train?.arrival || ""} · Duration: ${train?.duration || ""}`,
      `Coach: ${coachName} · Seat: ${seatData?.number || ""} · Tier: ${seatData?.tier || ""} · Fare: ₹${fare} · Class: ${classType}`,
    ].join("\n");

    await processUserInput(bookingMessage);
  }, [processUserInput, train, coachName, state.selectedSeat, state.query, allSeats, fare, classType]);

  const seatStyle = (status: string, isSelected: boolean) => {
    if (isSelected) return "bg-[var(--fg)] text-[var(--bg)] border-[var(--fg)]";
    if (status === "booked") return "bg-[var(--border)]/50 text-[var(--muted)]/40 border-[var(--border)] cursor-not-allowed";
    if (status === "recommended") return "bg-[var(--railway-red)] text-[var(--bg)] border-[var(--railway-red)]";
    return "bg-transparent text-[var(--fg)] border-[var(--border)] hover:border-[var(--fg)] cursor-pointer";
  };

  if (!train) return null;

  return (
    <div className="space-y-4">
      {/* Coach selector */}
      <div className="flex items-center justify-between">
        <div className="text-xs text-[var(--muted)]">
          {train.name} <span className="mx-1.5">·</span>{" "}
          {train.number}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setCoachIndex(Math.max(0, coachIndex - 1))}
            disabled={coachIndex === 0}
            className="w-6 h-6 flex items-center justify-center border border-[var(--border)] disabled:opacity-30 hover:border-[var(--fg)] transition-colors"
          >
            <ChevronLeft className="h-3 w-3" />
          </button>
          <span className="font-mono text-xs font-medium min-w-[28px] text-center">
            {coachName}
          </span>
          <button
            onClick={() => setCoachIndex(Math.min(5, coachIndex + 1))}
            disabled={coachIndex === 5}
            className="w-6 h-6 flex items-center justify-center border border-[var(--border)] disabled:opacity-30 hover:border-[var(--fg)] transition-colors"
          >
            <ChevronRight className="h-3 w-3" />
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="flex items-center gap-4 text-[11px] text-[var(--muted)]">
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 border border-[var(--border)]" />
          Available ({availableCount})
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 bg-[var(--border)]/50 border border-[var(--border)]" />
          Booked
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 bg-[var(--railway-red)]" />
          AI Pick
        </span>
      </div>

      {/* Coach diagram */}
      <div className="border border-[var(--border)] p-4">
        {/* Engine direction */}
        <div className="flex items-center justify-center mb-4">
          <div className="flex items-center gap-2 text-[9px] uppercase tracking-[0.15em] text-[var(--muted)]">
            <div className="w-6 h-px bg-[var(--border)]" />
            <span>Engine →</span>
            <div className="w-6 h-px bg-[var(--border)]" />
          </div>
        </div>

        {/* Seat grid */}
        <div className="grid grid-cols-6 gap-2">
          {berths.map((bay) => (
            <div key={bay.id} className="space-y-1">
              <div className="text-[9px] text-center text-[var(--muted)] uppercase tracking-[0.1em]">
                {bay.label}
              </div>
              {bay.seats.map((seat) => {
                const isSelected = state.selectedSeat === seat.id;
                return (
                  <motion.button
                    key={seat.id}
                    onClick={() => handleSelectSeat(seat)}
                    disabled={seat.status === "booked"}
                    whileTap={seat.status !== "booked" ? { scale: 0.95 } : undefined}
                    className={`relative w-full aspect-square flex flex-col items-center justify-center border text-[11px] font-medium transition-all duration-150 ${seatStyle(seat.status, isSelected)}`}
                  >
                    <span>{seat.number}</span>
                    <span className="text-[7px] uppercase opacity-60">
                      {TIER_LABELS[seat.tier] || seat.tier.charAt(0).toUpperCase()}
                    </span>

                    {/* Recommended badge */}
                    {seat.status === "recommended" && !isSelected && (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-[var(--railway-red)] flex items-center justify-center"
                      >
                        <Sparkles className="h-2 w-2 text-[var(--bg)]" />
                      </motion.div>
                    )}

                    {/* Selected badge */}
                    {isSelected && (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-[var(--fg)] flex items-center justify-center"
                      >
                        <Check className="h-2 w-2 text-[var(--bg)]" />
                      </motion.div>
                    )}
                  </motion.button>
                );
              })}
            </div>
          ))}
        </div>

        {/* Aisle indicator */}
        <div className="flex items-center justify-center mt-4">
          <div className="flex items-center gap-2 text-[9px] uppercase tracking-[0.15em] text-[var(--muted)]">
            <div className="w-6 h-px bg-[var(--border)]" />
            <span>Aisle</span>
            <div className="w-6 h-px bg-[var(--border)]" />
          </div>
        </div>
      </div>

      {/* AI Recommendation */}
      {recommendedSeat && !state.selectedSeat && (
        <div className="border border-[var(--railway-red)]/30 bg-[var(--railway-red-light)] p-3">
          <div className="flex items-start gap-3">
            <div className="w-6 h-6 flex items-center justify-center bg-[var(--railway-red)] flex-shrink-0 mt-0.5">
              <Sparkles className="h-3 w-3 text-[var(--bg)]" />
            </div>
            <div>
              <p className="text-xs font-medium mb-1">
                AI recommends seat {recommendedSeat.number}{" "}
                <span className="text-[var(--railway-red)]">(Lower berth)</span>
              </p>
              <p className="text-[11px] text-[var(--muted)] leading-relaxed">
                Lower berth — easier access, preferred for daytime journeys.
                Away from restrooms. Window seat for the views.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Selected seat → Confirm */}
      {state.selectedSeat && selectedSeatData && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="border border-[var(--border)] p-4"
        >
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-xs font-medium">
                {coachName} · Seat {selectedSeatData.number}{" "}
                <span className="text-[var(--muted)]">({selectedSeatData.tier})</span>
              </p>
              <p className="text-[11px] text-[var(--muted)]">
                ₹{selectedSeatData.price} · {classType}
              </p>
            </div>
            <button
              onClick={handleConfirm}
              className="px-4 py-2 bg-[var(--fg)] text-[var(--bg)] text-xs font-medium hover:bg-[var(--railway-red)] transition-colors"
            >
              Confirm Booking
            </button>
          </div>
        </motion.div>
      )}
    </div>
  );
}
