"use client";

import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useBooking, formatDisplayDate, createAssistantMessage } from "@/lib/booking-store";
import {
  ArrowRight,
  Zap,
  Clock,
  Info,
} from "lucide-react";

/* ─── Badge Config ──────────────────────────────────────────── */

const BADGES: Record<
  string,
  { icon: React.ElementType; label: string }
> = {
  best: { icon: Zap, label: "Best" },
  fastest: { icon: Zap, label: "Fastest" },
  cheapest: { icon: Clock, label: "Best Value" },
  comfortable: { icon: Zap, label: "Premium" },
};

/* ─── Component ────────────────────────────────────────────── */

export default function TrainExplorer() {
  const { state, selectTrain, addMessage } = useBooking();
  const [sortBy, setSortBy] = useState<
    "departure" | "price" | "duration"
  >("departure");

  const query = state.query;
  const trains = state.trains;

  const sorted = useMemo(() => {
    const list = [...trains];
    if (sortBy === "price") return list.sort((a, b) => a.price - b.price);
    if (sortBy === "duration") {
      const toMins = (d: string) => {
        const [h, m] = d.split("h ");
        return parseInt(h) * 60 + parseInt(m?.replace("m", "") || "0");
      };
      return list.sort((a, b) => toMins(a.duration) - toMins(b.duration));
    }
    return list.sort((a, b) => a.departure.localeCompare(b.departure));
  }, [trains, sortBy]);

  const handleSelect = (train: (typeof trains)[0]) => {
    selectTrain(train);
    addMessage(
      createAssistantMessage(
        `Coach **${train.name}** — here's the seating layout. The AI recommends a lower berth near the window.`,
        "seat-map"
      )
    );
  };

  if (!trains.length) return null;

  return (
    <div className="space-y-3">
      {/* Sort controls */}
      <div className="flex items-center gap-3 text-xs">
        <span className="text-[var(--muted)]">Sort by</span>
        {(["departure", "price", "duration"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setSortBy(s)}
            className={`px-2.5 py-1 text-xs uppercase tracking-[0.05em] transition-colors ${
              sortBy === s
                ? "bg-[var(--fg)] text-[var(--bg)]"
                : "border border-[var(--border)] hover:border-[var(--fg)]"
            }`}
          >
            {s === "departure" ? "Departure" : s === "price" ? "Fare" : "Duration"}
          </button>
        ))}
      </div>

      {/* Train list — departure board style */}
      <div className="border border-[var(--border)] divide-y divide-[var(--border)]">
        {/* Header */}
        <div className="flex items-center px-4 py-2 text-[10px] uppercase tracking-[0.1em] text-[var(--muted)]">
          <div className="w-20">Train No.</div>
          <div className="flex-1">Name</div>
          <div className="w-14 text-center">Dep</div>
          <div className="w-14 text-center">Arr</div>
          <div className="w-12 text-center">Dur</div>
          <div className="w-20 text-right">Fare</div>
        </div>

        {/* Rows */}
        <AnimatePresence>
          {sorted.map((train, i) => {
            const badge = train.badge ? BADGES[train.badge] : null;
            return (
              <motion.button
                key={train.id}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, delay: i * 0.04 }}
                onClick={() => handleSelect(train)}
                className="w-full flex items-center px-4 py-3 text-left hover:bg-[var(--fg)]/5 transition-colors group"
              >
                <div className="w-20 font-mono text-xs">
                  {train.number}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium truncate">
                      {train.name}
                    </span>
                    {badge && (
                      <span className="flex items-center gap-1 px-1.5 py-0.5 bg-[var(--railway-red-light)] text-[var(--railway-red)] text-[9px] uppercase tracking-[0.1em] font-mono">
                        <badge.icon className="h-2.5 w-2.5" />
                        {badge.label}
                      </span>
                    )}
                  </div>
                </div>
                <div className="w-14 text-center font-mono text-sm font-medium">
                  {train.departure}
                </div>
                <div className="w-14 text-center font-mono text-sm">
                  {train.arrival}
                </div>
                <div className="w-12 text-center font-mono text-[11px] text-[var(--muted)]">
                  {train.duration}
                </div>
                <div className="w-20 text-right font-medium">
                  ₹{train.price}
                </div>
              </motion.button>
            );
          })}
        </AnimatePresence>
      </div>

      {/* Info footer */}
      <div className="flex items-center gap-1.5 text-[11px] text-[var(--muted)]">
        <Info className="h-3 w-3" />
        <span>
          Click any train to view its coach layout and select a seat
        </span>
      </div>
    </div>
  );
}
