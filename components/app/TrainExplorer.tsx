"use client";

import { useState, useMemo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Train,
  Clock,
  Star,
  Filter,
  Sparkles,
  Zap,
  Wallet,
  Sofa,
  TrendingUp,
  Info,
  ChevronRight,
} from "lucide-react";
import { useBooking, type Train as TrainType } from "@/lib/booking-store";

/* ── Badge Config ──────────────────────────────────────────── */

const badgeConfig: Record<
  string,
  { icon: React.ElementType; label: string; color: string }
> = {
  best: { icon: Sparkles, label: "Best Overall", color: "bg-[var(--fg)] text-[var(--bg)]" },
  fastest: { icon: Zap, label: "Fastest", color: "bg-[var(--railway-red)] text-[var(--bg)]" },
  cheapest: { icon: Wallet, label: "Cheapest", color: "bg-[var(--fg)] text-[var(--bg)]" },
  comfortable: { icon: Sofa, label: "Most Comfortable", color: "bg-[var(--fg)] text-[var(--bg)]" },
};

/* ── Component ────────────────────────────────────────────── */

export default function TrainExplorer() {
  const { state, selectTrain } = useBooking();
  const [sortBy, setSortBy] = useState<
    "recommended" | "price" | "duration" | "departure"
  >("recommended");
  const [selectedClass, setSelectedClass] = useState<string>("all");
  const [expandedReason, setExpandedReason] = useState<string | null>(null);

  // Use trains from booking store or fallback
  const trains = state.trains;

  const sorted = useMemo(() => {
    const list = [...trains];
    if (sortBy === "recommended") {
      // Badged first, then by probability
      return list.sort((a, b) => {
        const aBadge = a.badge ? 1 : 0;
        const bBadge = b.badge ? 1 : 0;
        if (aBadge !== bBadge) return bBadge - aBadge;
        return b.probability - a.probability;
      });
    }
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

  const classes = useMemo(() => {
    const set = new Set(trains.map((t) => t.classType));
    return ["all", ...Array.from(set)];
  }, [trains]);

  const query = state.query;

  return (
    <div className="space-y-6">
      {/* Results header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold uppercase tracking-[0.05em]">
            {query?.origin && query?.destination
              ? `${query.origin} → ${query.destination}`
              : "Train Recommendations"}
          </h2>
          <p className="text-[13px] text-[var(--muted)] mt-1">
            {query?.date || "Today"} · {trains.length} trains found ·{" "}
            <span className="text-[var(--railway-red)] font-semibold">
              ₹{Math.min(...trains.map((t) => t.price))} – ₹
              {Math.max(...trains.map((t) => t.price))}
            </span>
            {query?.budget && (
              <span className="text-[var(--fg)] font-semibold ml-1">
                · Budget: ₹{query.budget}
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.1em]">
            <Filter className="h-3.5 w-3.5" />
            <span className="text-[var(--muted)]">Sort:</span>
            <select
              value={sortBy}
              onChange={(e) =>
                setSortBy(e.target.value as typeof sortBy)
              }
              className="bg-transparent border border-[var(--fg)] px-2 py-1 text-[11px] uppercase tracking-[0.05em] outline-none"
            >
              <option value="recommended">AI Recommended</option>
              <option value="price">Cheapest</option>
              <option value="duration">Fastest</option>
              <option value="departure">Departure</option>
            </select>
          </div>
        </div>
      </div>

      {/* Smart recommendation summary */}
      {sortBy === "recommended" && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="border-2 border-[var(--fg)] p-4 bg-[var(--fg)]/[0.02]"
        >
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="h-4 w-4" />
            <span className="text-xs uppercase tracking-[0.1em] font-bold">
              AI Recommendations
            </span>
          </div>
          <div className="grid grid-cols-4 gap-3">
            {(["best", "fastest", "cheapest", "comfortable"] as const).map(
              (badge) => {
                const train = trains.find((t) => t.badge === badge);
                const config = badgeConfig[badge];
                if (!train) return null;
                const Icon = config.icon;
                return (
                  <button
                    key={badge}
                    onClick={() => {
                      selectTrain(train);
                    }}
                    className="border border-[var(--fg)] p-3 text-left hover:bg-[var(--fg)]/5 transition-colors group cursor-pointer"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <div className={`w-6 h-6 flex items-center justify-center ${config.color}`}>
                        <Icon className="h-3 w-3" />
                      </div>
                      <span className="text-[10px] uppercase tracking-[0.1em] font-bold">
                        {config.label}
                      </span>
                    </div>
                    <div className="text-sm font-bold mt-1">{train.name}</div>
                    <div className="text-[11px] text-[var(--muted)]">
                      {train.departure} → {train.arrival}
                    </div>
                    <div className="flex items-center justify-between mt-1">
                      <span className="font-bold text-sm">₹{train.price}</span>
                      <span className="text-[10px] text-[var(--muted)]">
                        {train.probability}%
                      </span>
                    </div>
                  </button>
                );
              }
            )}
          </div>
        </motion.div>
      )}

      {/* Class filter */}
      {classes.length > 1 && (
        <div className="flex items-center gap-2 text-[11px]">
          <span className="text-[var(--muted)] uppercase tracking-[0.1em] mr-1">
            Class:
          </span>
          {classes.map((cls) => (
            <button
              key={cls}
              onClick={() => setSelectedClass(cls)}
              className={`px-3 py-1.5 border text-[11px] uppercase tracking-[0.05em] transition-colors ${
                selectedClass === cls
                  ? "bg-[var(--fg)] text-[var(--bg)] border-[var(--fg)]"
                  : "border-[var(--fg)] hover:bg-[var(--fg)]/5"
              }`}
            >
              {cls === "all" ? "All" : cls}
            </button>
          ))}
        </div>
      )}

      {/* AI Tip */}
      <div className="flex items-center gap-2 text-[11px] text-[var(--muted)] border border-[var(--fg)]/20 px-4 py-2">
        <Info className="h-3.5 w-3.5 flex-shrink-0" />
        <span>
          {query?.preference
            ? `I've prioritized options matching your preference: ${query.preference}`
            : query?.budget
            ? `I've highlighted options within your ₹${query.budget} budget`
            : "Trains are sorted by AI recommendation — click any to see seat options"}
        </span>
      </div>

      {/* Train list */}
      <div className="space-y-3">
        <AnimatePresence>
          {sorted.map((train, index) => {
            const badge = train.badge ? badgeConfig[train.badge] : null;

            return (
              <motion.div
                key={train.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: index * 0.05 }}
              >
                <button
                  onClick={() => selectTrain(train)}
                  className="w-full text-left border-2 border-[var(--fg)] p-5 hover:bg-[var(--fg)]/[0.02] transition-colors group"
                >
                  <div className="flex items-start justify-between gap-4">
                    {/* Left: Train info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-1">
                        <div className="w-8 h-8 flex items-center justify-center bg-[var(--fg)] group-hover:bg-[var(--railway-red)] transition-colors flex-shrink-0">
                          <Train className="h-4 w-4 text-[var(--bg)]" />
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-sm uppercase tracking-[0.02em]">
                            {train.name}
                          </span>
                          <span className="text-[11px] text-[var(--muted)]">
                            {train.number}
                          </span>
                          {badge && (() => {
                            const BadgeIcon = badge.icon;
                            return (
                              <span
                                className={`inline-flex items-center gap-1 text-[9px] px-2 py-0.5 uppercase tracking-[0.1em] ${badge.color}`}
                              >
                                <BadgeIcon className="h-2.5 w-2.5" />
                                {badge.label}
                              </span>
                            );
                          })()}
                        </div>
                      </div>

                      {/* Times */}
                      <div className="flex items-center gap-4 mt-3">
                        <div className="text-center">
                          <div className="text-lg font-bold">{train.departure}</div>
                          <div className="text-[10px] text-[var(--muted)] uppercase tracking-[0.1em]">
                            {query?.origin || "Delhi"}
                          </div>
                        </div>
                        <div className="flex-1 flex items-center gap-2 max-w-[140px]">
                          <div className="h-px flex-1 bg-[var(--fg)]/30" />
                          <div className="flex flex-col items-center">
                            <Clock className="h-3 w-3 text-[var(--muted)]" />
                            <span className="text-[10px] text-[var(--muted)]">
                              {train.duration}
                            </span>
                          </div>
                          <div className="h-px flex-1 bg-[var(--fg)]/30" />
                        </div>
                        <div className="text-center">
                          <div className="text-lg font-bold">{train.arrival}</div>
                          <div className="text-[10px] text-[var(--muted)] uppercase tracking-[0.1em]">
                            {query?.destination || "Jaipur"}
                          </div>
                        </div>
                      </div>

                      {/* Meta */}
                      <div className="flex items-center gap-4 mt-3 text-[11px] text-[var(--muted)]">
                        <span>{train.classType}</span>
                        <span>·</span>
                        <span>{train.available} seats left</span>
                        {train.isSuperfast && (
                          <>
                            <span>·</span>
                            <span className="text-[var(--railway-red)]">Superfast</span>
                          </>
                        )}
                        <span>·</span>
                        <span className="flex items-center gap-1">
                          <Star className="h-3 w-3" /> {train.rating}
                        </span>
                      </div>

                      {/* AI Reason (togglable) */}
                      {train.reason && (
                        <div className="mt-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setExpandedReason(
                                expandedReason === train.id ? null : train.id
                              );
                            }}
                            className="flex items-center gap-1 text-[11px] text-[var(--railway-red)] hover:underline"
                          >
                            <Info className="h-3 w-3" />
                            <span>Why {train.badge ? "recommended" : "listed"}</span>
                            <ChevronRight
                              className={`h-3 w-3 transition-transform ${
                                expandedReason === train.id ? "rotate-90" : ""
                              }`}
                            />
                          </button>
                          <AnimatePresence>
                            {expandedReason === train.id && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: "auto", opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                className="overflow-hidden"
                              >
                                <p className="text-[12px] text-[var(--muted)] mt-1 pl-4 border-l-2 border-[var(--railway-red)]">
                                  {train.reason}
                                </p>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      )}
                    </div>

                    {/* Right: Price & probability */}
                    <div className="text-right flex-shrink-0">
                      <div className="text-2xl font-bold">₹{train.price}</div>
                      <div className="mt-2 w-24">
                        <div className="flex items-center justify-between text-[10px] text-[var(--muted)] uppercase tracking-[0.1em] mb-1">
                          <span>Confirm</span>
                          <span className="font-bold text-[var(--fg)]">
                            {train.probability}%
                          </span>
                        </div>
                        <div className="h-1.5 bg-[var(--fg)]/10">
                          <div
                            className={`h-full transition-all ${
                              train.probability >= 90
                                ? "bg-[var(--fg)]"
                                : train.probability >= 75
                                ? "bg-[var(--railway-red)]"
                                : "bg-[var(--muted)]"
                            }`}
                            style={{ width: `${train.probability}%` }}
                          />
                        </div>
                      </div>
                      <div className="mt-3 text-[11px] group-hover:text-[var(--railway-red)] transition-colors uppercase tracking-[0.1em] font-semibold">
                        Select →
                      </div>
                    </div>
                  </div>
                </button>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}
