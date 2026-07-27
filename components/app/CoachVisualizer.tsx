"use client";

import { useState } from "react";
import { Map, ChevronLeft, ChevronRight } from "lucide-react";

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

const coachData: { name: string; type: string; berths: BerthInfo[] } = {
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
        { id: "7U", number: 9, status: "selected", tier: "upper", price: 1245 },
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
        { id: "16L", number: 16, status: "recommended", tier: "lower", price: 1245 },
        { id: "16M", number: 17, status: "available", tier: "middle", price: 1245 },
        { id: "16U", number: 18, status: "booked", tier: "upper", price: 1245 },
      ],
    },
    // Side berths
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
};

export default function CoachVisualizer() {
  const [selectedSeat, setSelectedSeat] = useState<string | null>("7L");

  const statusStyles: Record<string, string> = {
    available:
      "border-[var(--fg)] bg-transparent hover:bg-[var(--fg)] hover:text-[var(--bg)] cursor-pointer",
    booked:
      "border-[var(--fg)]/30 bg-[var(--fg)]/10 opacity-40 cursor-not-allowed",
    selected:
      "bg-[var(--fg)] text-[var(--bg)] border-[var(--fg)] cursor-pointer",
    recommended:
      "bg-[var(--railway-red)] text-[var(--bg)] border-[var(--railway-red)] cursor-pointer animate-pulse-slow",
  };

  const stats = {
    total: 72,
    available: coachData.berths.flatMap((b) => b.seats).filter((s) => s.status === "available").length,
    booked: coachData.berths.flatMap((b) => b.seats).filter((s) => s.status === "booked").length,
    recommended: coachData.berths.flatMap((b) => b.seats).filter((s) => s.status === "recommended").length,
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold uppercase tracking-[0.05em]">
            Coach {coachData.name}
          </h2>
          <p className="text-[13px] text-[var(--muted)] mt-1">
            {coachData.type} · Rajdhani Express 12951
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button className="w-8 h-8 flex items-center justify-center border border-[var(--fg)] hover:bg-[var(--fg)]/5 transition-colors">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-sm font-bold px-2">B1</span>
          <button className="w-8 h-8 flex items-center justify-center border border-[var(--fg)] hover:bg-[var(--fg)]/5 transition-colors">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Stats bar */}
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
          <span className="text-[var(--railway-red)]">Recommended</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-[var(--fg)]" />
          <span>Selected</span>
        </div>
      </div>

      {/* Coach layout */}
      <div className="border-2 border-[var(--fg)] p-6">
        {/* Coach diagram */}
        <div className="flex items-center justify-center mb-6">
          <div className="flex items-center gap-2 text-[10px] text-[var(--muted)] uppercase tracking-[0.2em]">
            <div className="w-8 h-px bg-[var(--muted)]" />
            <span>ENGINE →</span>
            <div className="w-8 h-px bg-[var(--muted)]" />
          </div>
        </div>

        {/* Berths grid */}
        <div className="grid grid-cols-4 gap-x-6 gap-y-8">
          {coachData.berths.map((bay) => (
            <div key={bay.id} className="space-y-2">
              {bay.seats.length > 1 && (
                <div className="text-[10px] text-[var(--muted)] uppercase tracking-[0.1em] text-center mb-2">
                  {bay.label}
                </div>
              )}
              <div className="space-y-2">
                {bay.seats.map((seat) => {
                  const isSelected = selectedSeat === seat.id;
                  return (
                    <button
                      key={seat.id}
                      onClick={() =>
                        seat.status !== "booked" && setSelectedSeat(seat.id)
                      }
                      disabled={seat.status === "booked"}
                      className={`w-full aspect-square flex flex-col items-center justify-center border-2 text-[11px] font-bold transition-all duration-150 ${
                        statusStyles[seat.status]
                      } ${isSelected && seat.status !== "booked" ? "ring-2 ring-[var(--fg)]" : ""}`}
                      title={`Seat ${seat.number} - ${seat.tier} - ₹${seat.price}`}
                    >
                      <span>{seat.number}</span>
                      <span className="text-[8px] uppercase tracking-[0.1em] opacity-70">
                        {seat.tier === "side-lower"
                          ? "SL"
                          : seat.tier === "side-upper"
                          ? "SU"
                          : seat.tier === "lower"
                          ? "L"
                          : seat.tier === "middle"
                          ? "M"
                          : "U"}
                      </span>
                    </button>
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
        <div className="border-t-2 border-[var(--fg)]/20 mt-6 pt-4">
          <div className="flex items-center justify-center gap-4">
            {coachData.berths.filter((b) => b.label === "Side").map((bay) =>
              bay.seats.map((seat) => (
                <button
                  key={seat.id}
                  onClick={() =>
                    seat.status !== "booked" && setSelectedSeat(seat.id)
                  }
                  disabled={seat.status === "booked"}
                  className={`w-16 aspect-square flex flex-col items-center justify-center border-2 text-[11px] font-bold transition-all duration-150 ${
                    statusStyles[seat.status]
                  }`}
                >
                  <span>{seat.number}</span>
                  <span className="text-[8px] uppercase tracking-[0.1em] opacity-70">
                    {seat.tier === "side-lower" ? "SL" : "SU"}
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Selected seat info */}
      {selectedSeat && (
        <div className="border-2 border-[var(--fg)] p-5 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 flex items-center justify-center bg-[var(--fg)]">
              <Map className="h-5 w-5 text-[var(--bg)]" />
            </div>
            <div>
              <p className="font-bold text-sm">
                Seat {selectedSeat.replace(/[^0-9]/g, "")} ·{" "}
                {(() => {
                  const seat = coachData.berths.flatMap((b) => b.seats).find((s) => s.id === selectedSeat);
                  if (!seat) return "";
                  const tierLabels: Record<string, string> = {
                    lower: "Lower Berth",
                    middle: "Middle Berth",
                    upper: "Upper Berth",
                    "side-lower": "Side Lower",
                    "side-upper": "Side Upper",
                  };
                  return tierLabels[seat.tier] || "";
                })()}
              </p>
              <p className="text-[12px] text-[var(--muted)]">
                Coach B1 · ₹{coachData.berths.flatMap((b) => b.seats).find((s) => s.id === selectedSeat)?.price || 1245}
              </p>
            </div>
          </div>
          <button className="px-6 py-3 bg-[var(--fg)] text-[var(--bg)] text-xs uppercase tracking-[0.1em] font-semibold hover:bg-[var(--railway-red)] transition-colors">
            Confirm Seat
          </button>
        </div>
      )}
    </div>
  );
}
