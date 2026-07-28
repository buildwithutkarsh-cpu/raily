"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Ticket,
  Search,
  AlertCircle,
  User,
  Sparkles,
  Clock,
  MapPin,
  Train,
} from "lucide-react";
import { useBooking } from "@/lib/booking-store";
import type { PNRStatus } from "@/lib/railway/types";

interface PNRDisplay {
  number: string;
  status: "confirmed" | "waitlist" | "rac" | "cancelled";
  trainName: string;
  trainNumber: string;
  date: string;
  from: string;
  to: string;
  departure: string;
  arrival: string;
  class: string;
  passengers: { name: string; berth: string; status: string }[];
  lastUpdated: string;
}

/* ── Convert API PNRStatus to Display Format ───────────────── */

function toDisplay(pnr: PNRStatus): PNRDisplay {
  const statusMap: Record<string, "confirmed" | "waitlist" | "rac" | "cancelled"> = {
    CONFIRMED: "confirmed",
    RAC: "rac",
    WAITLIST: "waitlist",
    CANCELLED: "cancelled",
  };

  return {
    number: pnr.pnr,
    status: statusMap[pnr.status] || "cancelled",
    trainName: pnr.train.name,
    trainNumber: pnr.train.number,
    date: pnr.date,
    from: `${pnr.from.name} (${pnr.from.code})`,
    to: `${pnr.to.name} (${pnr.to.code})`,
    departure: pnr.departure || "--",
    arrival: pnr.arrival || "--",
    class: pnr.class,
    passengers: pnr.passengers.map((p) => ({
      name: p.name,
      berth: p.berth || `${p.coach || "?"}-${p.seat || "—"}`,
      status: p.currentStatus || p.bookingStatus || "—",
    })),
    lastUpdated: pnr.lastUpdated
      ? new Date(pnr.lastUpdated).toLocaleString()
      : "—",
  };
}

/* ── AI Explanation Generator ──────────────────────────────── */

function getAIExplanation(pnr: PNRDisplay): {
  summary: string;
  plainLanguage: string;
  tips: string[];
} {
  switch (pnr.status) {
    case "confirmed":
      return {
        summary: `Your ticket is confirmed ✅ — you have a guaranteed seat on this train.`,
        plainLanguage: `Your booking for **${pnr.trainName}** (${pnr.trainNumber}) is fully confirmed. This means you have a reserved seat with a confirmed berth number. No need to worry about boarding — just show your ticket and take your assigned seat.\n\n• **Coach:** Your seat is in coach ${pnr.passengers[0]?.berth?.split("-")[0] || "B1"}\n• **Seat:** ${pnr.passengers.map((p) => `${p.name} → ${p.berth}`).join(", ")}\n• **Platform:** Check station display for platform info\n• **Check-in:** Gates open 1 hour before departure`,
        tips: [
          "Arrive at the station 30 minutes early to find your platform comfortably.",
          "Pre-order meals through the railway catering app for breakfast on board.",
          "Share your PNR with family so they can track your journey live.",
        ],
      };
    case "rac":
      return {
        summary: `You have a Reserved Against Cancellation (RAC) ticket ⚠️ — you can board the train but may need to share a seat initially.`,
        plainLanguage: `Your ticket for **${pnr.trainName}** (${pnr.trainNumber}) is on RAC (Reserved Against Cancellation). This is actually better than a waitlist!\n\n• **You CAN board the train** — RAC tickets allow you to get on.\n• **You'll have a seat** — initially you may need to share, but as cancellations happen, you'll get your own berth.\n• **Good news:** Most RAC tickets convert to confirmed before departure.`,
        tips: [
          "Check PNR status 24 hours before departure — it often converts to confirmed.",
          "You can still cancel and get a partial refund if you find a better option.",
          "Consider upgrading to a higher class for better confirmation chances.",
        ],
      };
    case "waitlist":
      return {
        summary: `You're on the waitlist (WL) 🕐 — your ticket is not yet confirmed.`,
        plainLanguage: `Your ticket for **${pnr.trainName}** (${pnr.trainNumber}) is currently on the waitlist (WL). This means your booking is pending and will only be confirmed if other passengers cancel.\n\n• **Current status:** ${pnr.passengers[0]?.status || "WL"}\n• **What this means:** You may not get a confirmed seat on this train.\n• **Be prepared:** Have a backup plan in case the ticket doesn't confirm.`,
        tips: [
          "Set up PNR alerts — we'll notify you the moment it updates.",
          "Book an alternate train as backup if your travel is critical.",
          "Check alternative routes or classes that might have availability.",
          "You can cancel a waitlisted ticket for a full refund.",
        ],
      };
    default:
      return {
        summary: `Your booking status is ${pnr.status}.`,
        plainLanguage: `Your booking for **${pnr.trainName}** (${pnr.trainNumber}) is currently marked as ${pnr.status}.`,
        tips: ["Contact railway customer support for more information."],
      };
  }
}

/* ── Component ────────────────────────────────────────────── */

export default function PNRManager() {
  const { fetchPNR } = useBooking();
  const [pnrInput, setPnrInput] = useState("");
  const [searchedPNR, setSearchedPNR] = useState<PNRDisplay | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAIExplanation, setShowAIExplanation] = useState(true);

  const statusStyles: Record<string, { label: string; className: string }> = {
    confirmed: {
      label: "Confirmed ✅",
      className: "bg-[var(--fg)] text-[var(--bg)]",
    },
    rac: {
      label: "RAC ⚠️",
      className: "bg-[var(--railway-red)] text-[var(--bg)]",
    },
    waitlist: {
      label: "Waitlist 🕐",
      className: "border-2 border-[var(--fg)] text-[var(--fg)]",
    },
    cancelled: {
      label: "Cancelled ❌",
      className: "bg-[var(--fg)]/20 text-[var(--fg)]/50",
    },
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pnrInput.trim() || pnrInput.length !== 10) return;

    setIsSearching(true);
    setError(null);
    setSearchedPNR(null);

    try {
      const result = await fetchPNR(pnrInput);

      if (result.success && result.data) {
        const data = result.data as PNRStatus;
        setSearchedPNR(toDisplay(data));
      } else {
        setError(
          result.error?.message || `No booking found with PNR ${pnrInput}`
        );
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to check PNR status"
      );
    } finally {
      setIsSearching(false);
    }
  };

  const aiExplanation = searchedPNR ? getAIExplanation(searchedPNR) : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold uppercase tracking-[0.05em]">
          PNR Status
        </h2>
        <p className="text-[13px] text-[var(--muted)] mt-1">
          Check your booking status by entering a 10-digit PNR number
        </p>
      </div>

      {/* Search */}
      <form onSubmit={handleSearch} className="flex gap-2">
        <div className="flex-1 relative">
          <input
            type="text"
            value={pnrInput}
            onChange={(e) =>
              setPnrInput(e.target.value.replace(/\D/g, "").slice(0, 10))
            }
            placeholder="Enter 10-digit PNR number"
            maxLength={10}
            className="w-full bg-transparent border-2 border-[var(--fg)] px-4 py-3 text-sm outline-none placeholder:text-[var(--muted)]"
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-[var(--muted)]">
            {pnrInput.length}/10
          </span>
        </div>
        <button
          type="submit"
          disabled={pnrInput.length !== 10 || isSearching}
          className="px-6 bg-[var(--fg)] text-[var(--bg)] text-xs uppercase tracking-[0.1em] font-semibold disabled:opacity-30 hover:bg-[var(--railway-red)] transition-colors flex items-center gap-2"
        >
          {isSearching ? (
            <div className="w-4 h-4 border-2 border-[var(--bg)] border-t-transparent animate-spin" />
          ) : (
            <Search className="h-4 w-4" />
          )}
          Check
        </button>
      </form>

      {/* Error state */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="border-2 border-[var(--fg)] p-6 text-center"
          >
            <AlertCircle className="h-8 w-8 mx-auto mb-3 text-[var(--muted)]" />
            <p className="text-sm text-[var(--muted)]">{error}</p>
            <p className="text-[11px] text-[var(--muted)] mt-1">
              Please check the number and try again
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Search result */}
      <AnimatePresence>
        {searchedPNR && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-4"
          >
            {/* AI Explanation Card */}
            {aiExplanation && showAIExplanation && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="border-2 border-[var(--fg)] p-5"
              >
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 flex items-center justify-center bg-[var(--fg)] flex-shrink-0">
                    <Sparkles className="h-5 w-5 text-[var(--bg)]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-sm font-bold uppercase tracking-[0.05em]">
                        AI Summary
                      </span>
                      <span
                        className={`text-[10px] px-2 py-0.5 uppercase tracking-[0.1em] ${
                          statusStyles[searchedPNR.status].className
                        }`}
                      >
                        {statusStyles[searchedPNR.status].label}
                      </span>
                      <button
                        onClick={() => setShowAIExplanation(false)}
                        className="ml-auto text-[10px] text-[var(--muted)] hover:text-[var(--fg)] uppercase tracking-[0.1em]"
                      >
                        Hide
                      </button>
                    </div>

                    <p className="text-[14px] font-semibold mb-3">
                      {aiExplanation.summary}
                    </p>

                    <div className="text-[13px] leading-relaxed text-[var(--muted)] whitespace-pre-wrap">
                      {aiExplanation.plainLanguage}
                    </div>

                    {/* Tips */}
                    <div className="mt-4 pt-4 border-t border-[var(--fg)]/10">
                      <div className="text-[10px] text-[var(--muted)] uppercase tracking-[0.15em] mb-2">
                        AI Suggestions
                      </div>
                      <ul className="space-y-1.5">
                        {aiExplanation.tips.map((tip, i) => (
                          <li key={i} className="flex items-start gap-2 text-[12px] text-[var(--muted)]">
                            <span className="text-[var(--fg)] mt-0.5">→</span>
                            <span>{tip}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {!showAIExplanation && (
              <button
                onClick={() => setShowAIExplanation(true)}
                className="flex items-center gap-2 text-[11px] text-[var(--muted)] hover:text-[var(--fg)] uppercase tracking-[0.1em]"
              >
                <Sparkles className="h-3.5 w-3.5" />
                Show AI explanation
              </button>
            )}

            {/* PNR Details Card */}
            <div className="border-2 border-[var(--fg)]">
              <div className="p-5">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <div className="flex items-center gap-3 mb-1">
                      <span className="font-bold text-sm">
                        {searchedPNR.trainName} ({searchedPNR.trainNumber})
                      </span>
                      <span
                        className={`text-[10px] px-2 py-0.5 uppercase tracking-[0.1em] ${
                          statusStyles[searchedPNR.status].className
                        }`}
                      >
                        {statusStyles[searchedPNR.status].label}
                      </span>
                    </div>
                    <p className="text-[13px] text-[var(--muted)]">
                      PNR: {searchedPNR.number}
                    </p>
                  </div>
                  <span className="text-[10px] text-[var(--muted)]">
                    Updated {searchedPNR.lastUpdated}
                  </span>
                </div>

                <div className="grid grid-cols-4 gap-4 mb-4 text-center">
                  <div>
                    <div className="text-[10px] text-[var(--muted)] uppercase tracking-[0.1em] mb-1">
                      Date
                    </div>
                    <div className="text-sm font-bold">{searchedPNR.date}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-[var(--muted)] uppercase tracking-[0.1em] mb-1">
                      From
                    </div>
                    <div className="text-sm font-bold">{searchedPNR.from}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-[var(--muted)] uppercase tracking-[0.1em] mb-1">
                      To
                    </div>
                    <div className="text-sm font-bold">{searchedPNR.to}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-[var(--muted)] uppercase tracking-[0.1em] mb-1">
                      Class
                    </div>
                    <div className="text-sm font-bold">{searchedPNR.class}</div>
                  </div>
                </div>

                {/* Passengers */}
                <div className="border-t border-[var(--fg)]/20 pt-4">
                  <div className="text-[10px] text-[var(--muted)] uppercase tracking-[0.1em] mb-3">
                    Passengers
                  </div>
                  <div className="space-y-2">
                    {searchedPNR.passengers.length > 0 ? (
                      searchedPNR.passengers.map((p, i) => (
                        <div
                          key={i}
                          className="flex items-center justify-between text-sm"
                        >
                          <div className="flex items-center gap-3">
                            <User className="h-3.5 w-3.5 text-[var(--muted)]" />
                            <span>{p.name}</span>
                          </div>
                          <div className="flex items-center gap-4 text-[13px]">
                            <span className="text-[var(--muted)]">{p.berth}</span>
                            <span className="font-semibold">{p.status}</span>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-[13px] text-[var(--muted)] text-center py-2">
                        No passenger details available
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <div className="border-t-2 border-[var(--fg)] flex">
                <button className="flex-1 py-3 text-xs uppercase tracking-[0.1em] font-semibold hover:bg-[var(--fg)] hover:text-[var(--bg)] transition-colors flex items-center justify-center gap-2">
                  <Train className="h-3.5 w-3.5" />
                  Track Train
                </button>
                <button className="flex-1 py-3 text-xs uppercase tracking-[0.1em] font-semibold border-l-2 border-[var(--fg)] hover:bg-[var(--fg)] hover:text-[var(--bg)] transition-colors flex items-center justify-center gap-2">
                  <MapPin className="h-3.5 w-3.5" />
                  Platform Info
                </button>
                <button className="flex-1 py-3 text-xs uppercase tracking-[0.1em] font-semibold border-l-2 border-[var(--fg)] hover:bg-[var(--fg)] hover:text-[var(--bg)] transition-colors flex items-center justify-center gap-2">
                  <Clock className="h-3.5 w-3.5" />
                  Schedule
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Empty state — no recent bookings yet */}
      <div>
        <div className="text-[11px] text-[var(--muted)] uppercase tracking-[0.15em] mb-3">
          Recent Bookings
        </div>
        <div className="border-2 border-dashed border-[var(--fg)]/30 p-8 text-center">
          <Ticket className="h-8 w-8 mx-auto mb-3 text-[var(--muted)]" />
          <p className="text-sm text-[var(--muted)]">
            No recent PNR lookups yet
          </p>
          <p className="text-[11px] text-[var(--muted)] mt-1">
            Enter a PNR number above to check your booking status,
            <br />
            or ask the AI assistant to check it for you.
          </p>
        </div>
      </div>
    </div>
  );
}
