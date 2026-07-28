"use client";

import { useState, useMemo } from "react";
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
} from "lucide-react";
import { useBooking } from "@/lib/booking-store";

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

/* ─── Coach Data ───────────────────────────────────────────── */

const coachDataList: Record<
  string,
  { name: string; type: string; berths: BerthInfo[] }
> = {
  B1: {
    name: "B1",
    type: "3 Tier AC (3A)",
    berths: [
      {
        id: "bay1",
        label: "Bay 1",
        seats: [
          { id: "1L", number: 1, status: "booked", tier: "lower", price: 1245 },
          { id: "1M", number: 2, status: "booked", tier: "middle", price: 1245 },
          { id: "1U", number: 3, status: "available", tier: "upper", price: 1180 },
        ],
      },
      {
        id: "bay2",
        label: "Bay 2",
        seats: [
          { id: "4L", number: 4, status: "available", tier: "lower", price: 1245 },
          { id: "4M", number: 5, status: "available", tier: "middle", price: 1245 },
          { id: "4U", number: 6, status: "booked", tier: "upper", price: 1245 },
        ],
      },
      {
        id: "bay3",
        label: "Bay 3",
        seats: [
          { id: "7L", number: 7, status: "recommended", tier: "lower", price: 1245 },
          { id: "7M", number: 8, status: "available", tier: "middle", price: 1180 },
          { id: "7U", number: 9, status: "available", tier: "upper", price: 1245 },
        ],
      },
      {
        id: "bay4",
        label: "Bay 4",
        seats: [
          { id: "10L", number: 10, status: "booked", tier: "lower", price: 1245 },
          { id: "10M", number: 11, status: "booked", tier: "middle", price: 1245 },
          { id: "10U", number: 12, status: "booked", tier: "upper", price: 1245 },
        ],
      },
      {
        id: "bay5",
        label: "Bay 5",
        seats: [
          { id: "13L", number: 13, status: "available", tier: "lower", price: 1245 },
          { id: "13M", number: 14, status: "available", tier: "middle", price: 1245 },
          { id: "13U", number: 15, status: "available", tier: "upper", price: 1180 },
        ],
      },
      {
        id: "bay6",
        label: "Bay 6",
        seats: [
          { id: "16L", number: 16, status: "available", tier: "lower", price: 1245 },
          { id: "16M", number: 17, status: "available", tier: "middle", price: 1245 },
          { id: "16U", number: 18, status: "booked", tier: "upper", price: 1245 },
        ],
      },
      {
        id: "side1",
        label: "Side",
        seats: [
          { id: "SL1", number: 19, status: "available", tier: "side-lower", price: 1050 },
          { id: "SU1", number: 20, status: "booked", tier: "side-upper", price: 1050 },
        ],
      },
      {
        id: "side2",
        label: "Side",
        seats: [
          { id: "SL2", number: 21, status: "available", tier: "side-lower", price: 1050 },
          { id: "SU2", number: 22, status: "available", tier: "side-upper", price: 1050 },
        ],
      },
    ],
  },
  B2: {
    name: "B2",
    type: "3 Tier AC (3A)",
    berths: [
      {
        id: "bay1",
        label: "Bay 1",
        seats: [
          { id: "B2-1L", number: 1, status: "available", tier: "lower", price: 1245 },
          { id: "B2-1M", number: 2, status: "available", tier: "middle", price: 1245 },
          { id: "B2-1U", number: 3, status: "booked", tier: "upper", price: 1245 },
        ],
      },
      {
        id: "bay2",
        label: "Bay 2",
        seats: [
          { id: "B2-4L", number: 4, status: "booked", tier: "lower", price: 1245 },
          { id: "B2-4M", number: 5, status: "booked", tier: "middle", price: 1245 },
          { id: "B2-4U", number: 6, status: "available", tier: "upper", price: 1245 },
        ],
      },
      {
        id: "bay3",
        label: "Bay 3",
        seats: [
          { id: "B2-7L", number: 7, status: "available", tier: "lower", price: 1245 },
          { id: "B2-7M", number: 8, status: "available", tier: "middle", price: 1180 },
          { id: "B2-7U", number: 9, status: "booked", tier: "upper", price: 1245 },
        ],
      },
      {
        id: "bay4",
        label: "Bay 4",
        seats: [
          { id: "B2-10L", number: 10, status: "available", tier: "lower", price: 1245 },
          { id: "B2-10M", number: 11, status: "booked", tier: "middle", price: 1245 },
          { id: "B2-10U", number: 12, status: "available", tier: "upper", price: 1245 },
        ],
      },
      {
        id: "bay5",
        label: "Bay 5",
        seats: [
          { id: "B2-13L", number: 13, status: "available", tier: "lower", price: 1245 },
          { id: "B2-13M", number: 14, status: "available", tier: "middle", price: 1245 },
          { id: "B2-13U", number: 15, status: "available", tier: "upper", price: 1180 },
        ],
      },
      {
        id: "side1",
        label: "Side",
        seats: [
          { id: "B2-SL1", number: 16, status: "booked", tier: "side-lower", price: 1050 },
          { id: "B2-SU1", number: 17, status: "available", tier: "side-upper", price: 1050 },
        ],
      },
    ],
  },
  A1: {
    name: "A1",
    type: "2 Tier AC (2A)",
    berths: [
      {
        id: "bay1",
        label: "Bay 1",
        seats: [
          { id: "A1-1L", number: 1, status: "available", tier: "lower", price: 1840 },
          { id: "A1-1U", number: 2, status: "booked", tier: "upper", price: 1840 },
        ],
      },
      {
        id: "bay2",
        label: "Bay 2",
        seats: [
          { id: "A1-3L", number: 3, status: "available", tier: "lower", price: 1840 },
          { id: "A1-3U", number: 4, status: "available", tier: "upper", price: 1840 },
        ],
      },
      {
        id: "bay3",
        label: "Bay 3",
        seats: [
          { id: "A1-5L", number: 5, status: "booked", tier: "lower", price: 1840 },
          { id: "A1-5U", number: 6, status: "available", tier: "upper", price: 1780 },
        ],
      },
      {
        id: "side1",
        label: "Side",
        seats: [
          { id: "A1-SL1", number: 7, status: "available", tier: "side-lower", price: 1580 },
        ],
      },
    ],
  },
};

/* ─── Seat Tier Labels ─────────────────────────────────────── */

const tierLabels: Record<string, string> = {
  lower: "Lower Berth",
  middle: "Middle Berth",
  upper: "Upper Berth",
  "side-lower": "Side Lower",
  "side-upper": "Side Upper",
};

const tierShort: Record<string, string> = {
  lower: "L",
  middle: "M",
  upper: "U",
  "side-lower": "SL",
  "side-upper": "SU",
};

/* ─── Component ────────────────────────────────────────────── */

export default function CoachVisualizer() {
  const { state, setSelectedCoach, setSelectedSeat, confirmBooking } =
    useBooking();

  const [expanded, setExpanded] = useState(false);
  const [showLegend, setShowLegend] = useState(true);

  const coachKeys = Object.keys(coachDataList);
  const currentCoach = coachDataList[state.selectedCoach] || coachDataList["B1"];

  const allSeats = useMemo(
    () => currentCoach.berths.flatMap((b) => b.seats),
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

  const handleCoachChange = (direction: 1 | -1) => {
    const idx = coachKeys.indexOf(state.selectedCoach);
    const next = (idx + direction + coachKeys.length) % coachKeys.length;
    setSelectedCoach(coachKeys[next]);
    setSelectedSeat(null);
  };

  const handleSelectSeat = (seat: Seat) => {
    if (seat.status === "booked") return;
    setSelectedSeat(seat.id);
  };

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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold uppercase tracking-[0.05em]">
            Coach {currentCoach.name}
          </h2>
          <p className="text-[13px] text-[var(--muted)] mt-1">
            {currentCoach.type} · {state.selectedTrain?.name}{" "}
            {state.selectedTrain?.number} ·{" "}
            {state.selectedTrain?.departure} → {state.selectedTrain?.arrival}
          </p>
        </div>
        <div className="flex items-center gap-2">
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
        className={`border-2 border-[var(--fg)] p-6 overflow-x-auto ${
          expanded ? "" : ""
        }`}
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
          {currentCoach.berths.map((bay) => (
            <div key={bay.id} className="space-y-2">
              {bay.seats.length > 1 && (
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
                      title={`Seat ${seat.number} - ${tierLabels[seat.tier]} - ₹${seat.price}`}
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
                        {tierShort[seat.tier]}
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
          ))}
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
                          {tierShort[seat.tier]}
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
      {state.seatRecommendation && (
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
                    {state.seatRecommendation.number}
                  </span>
                  <span className="text-[8px] uppercase tracking-[0.1em]">
                    {state.seatRecommendation.tier}
                  </span>
                </div>
                <div>
                  <div className="text-sm font-bold">
                    Coach {state.seatRecommendation.coach} · Seat{" "}
                    {state.seatRecommendation.number} ({state.seatRecommendation.tier})
                  </div>
                  <div className="text-[12px] text-[var(--muted)]">
                    ₹{selectedSeatData?.price || 1245} ·{" "}
                    {currentCoach.type}
                  </div>
                </div>
              </div>

              {/* Reasoning */}
              <div className="text-[13px] leading-relaxed whitespace-pre-wrap text-[var(--muted)]">
                {state.seatRecommendation.reason}
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Selected seat info + confirm */}
      {state.selectedSeat && (
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
                Seat {selectedSeatData?.number} ·{" "}
                {selectedSeatData ? tierLabels[selectedSeatData.tier] : ""}
              </p>
              <p className="text-[12px] text-[var(--muted)]">
                Coach {currentCoach.name} · ₹{selectedSeatData?.price || 1245}
                {selectedSeatData?.status === "recommended" && (
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
        <button className="flex items-center gap-2 px-4 py-3 border-2 border-[var(--fg)] text-xs uppercase tracking-[0.1em] font-semibold hover:bg-[var(--fg)] hover:text-[var(--bg)] transition-colors flex-1 justify-center">
          <Train className="h-3.5 w-3.5" />
          Switch Class
        </button>
        <button className="flex items-center gap-2 px-4 py-3 border-2 border-[var(--fg)] text-xs uppercase tracking-[0.1em] font-semibold hover:bg-[var(--fg)] hover:text-[var(--bg)] transition-colors flex-1 justify-center">
          <Info className="h-3.5 w-3.5" />
          Coach Info
        </button>
      </div>
    </div>
  );
}
