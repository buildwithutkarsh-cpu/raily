"use client";

import { useBooking, formatDisplayDate } from "@/lib/booking-store";
import { parseSeatId } from "@/lib/booking-store-utils";
import { motion } from "framer-motion";
import { Check, Train, ArrowRight, Clock, Ticket } from "lucide-react";

export default function BookingConfirmation() {
  const { state, resetBooking, addMessage } = useBooking();

  const train = state.selectedTrain;
  const pnr = state.pnrNumber || "—";
  const query = state.query;
  const seatInfo = state.selectedSeat ? parseSeatId(state.selectedSeat) : null;
  const seatLabel = seatInfo ? `${seatInfo.seat}${seatInfo.tier ? ` (${seatInfo.tier})` : ""}` : "";
  const seatRow = seatInfo ? `${seatInfo.coach}-${seatInfo.seat}${seatInfo.tier ? ` (${seatInfo.tier})` : ""}` : "";

  return (
    <div className="space-y-4">
      {/* Success header */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-3 p-4 border border-[var(--border)]"
      >
        <div className="w-8 h-8 flex items-center justify-center bg-[var(--fg)] flex-shrink-0">
          <Check className="h-4 w-4 text-[var(--bg)]" />
        </div>
        <div>
          <p className="text-sm font-medium">Booking Confirmed</p>
          <p className="text-[11px] text-[var(--muted)]">
            Your journey has been booked. PNR: <span className="font-mono text-[var(--fg)]">{pnr}</span>
          </p>
        </div>
      </motion.div>

      {/* Ticket-like detail */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="border border-[var(--border)]"
      >
        {/* Train header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 flex items-center justify-center bg-[var(--fg)]">
              <Train className="h-3.5 w-3.5 text-[var(--bg)]" />
            </div>
            <div>
              <p className="text-sm font-medium">{train?.name || "Rajdhani Express"}</p>
              <p className="text-[10px] text-[var(--muted)] font-mono">
                {train?.number || "12951"} · {train?.classType || "3A"}
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-lg font-semibold">₹{train?.price || 1245}</p>
            <p className="text-[9px] text-[var(--muted)] uppercase tracking-[0.1em] font-mono">
              Total fare
            </p>
          </div>
        </div>

        {/* Route */}
        <div className="px-4 py-4 border-b border-[var(--border)]">
          <div className="flex items-center justify-between">
            <div className="text-center">
              <p className="text-lg font-semibold">{train?.departure || "06:25"}</p>
              <p className="text-[10px] text-[var(--muted)] font-mono uppercase tracking-[0.05em]">
                {query?.origin || "Delhi"}
              </p>
            </div>
            <div className="flex-1 mx-6 flex flex-col items-center">
              <p className="text-[10px] text-[var(--muted)] font-mono">
                {train?.duration || "5h 25m"}
              </p>
              <div className="w-full flex items-center gap-1.5 my-1">
                <div className="h-px flex-1 bg-[var(--border)]" />
                <Train className="h-3 w-3 text-[var(--muted)]" />
                <div className="h-px flex-1 bg-[var(--border)]" />
              </div>
              <p className="text-[10px] text-[var(--muted)] font-mono">
                {query?.date ? formatDisplayDate(query.date) : "Today"}
              </p>
            </div>
            <div className="text-center">
              <p className="text-lg font-semibold">{train?.arrival || "11:50"}</p>
              <p className="text-[10px] text-[var(--muted)] font-mono uppercase tracking-[0.05em]">
                {query?.destination || "Jaipur"}
              </p>
            </div>
          </div>
        </div>

        {/* Details grid */}
        <div className="grid grid-cols-4 px-4 py-3 border-b border-[var(--border)]">
          {[
            { label: "PNR", value: pnr },
            { label: "Coach", value: seatInfo?.coach || state.selectedCoach || "B1" },
            { label: "Seat", value: seatLabel || "—" },
            { label: "Platform", value: "5" },
          ].map((item) => (
            <div key={item.label} className="text-center">
              <p className="text-[9px] text-[var(--muted)] font-mono uppercase tracking-[0.1em]">
                {item.label}
              </p>
              <p className="text-sm font-medium mt-0.5">{item.value}</p>
            </div>
          ))}
        </div>

        {/* Passenger */}
        <div className="px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-5 h-5 flex items-center justify-center bg-[var(--fg)]/10 text-[10px] font-medium">
                1
              </span>
              <span className="text-sm">Primary Passenger</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[11px] text-[var(--muted)]">
                {seatRow || `${state.selectedCoach || "B1"} (—)`}
              </span>
              <span className="px-2 py-0.5 bg-[var(--fg)] text-[var(--bg)] text-[9px] font-mono uppercase tracking-[0.1em]">
                CNF
              </span>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Quick actions */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="flex items-center gap-3"
      >
        <button
          onClick={() => {
            addMessage({
              id: `msg-pnr-${Date.now()}`,
              role: "assistant",
              content: `PNR **${pnr}** status:`,
              component: "pnr-status",
              timestamp: Date.now(),
            });
          }}
          className="flex items-center gap-1.5 px-3 py-2 text-xs border border-[var(--border)] hover:border-[var(--fg)] transition-colors"
        >
          <Ticket className="h-3.5 w-3.5" />
          Check PNR
        </button>
        <button
          onClick={() => {
            addMessage({
              id: `msg-journey-${Date.now()}`,
              role: "assistant",
              content: `Tracking **${train?.name || "your train"}** in real-time:`,
              component: "journey-tracker",
              timestamp: Date.now(),
            });
          }}
          className="flex items-center gap-1.5 px-3 py-2 text-xs border border-[var(--border)] hover:border-[var(--fg)] transition-colors"
        >
          <Clock className="h-3.5 w-3.5" />
          Live Tracking
        </button>
        <button
          onClick={resetBooking}
          className="flex items-center gap-1.5 px-3 py-2 text-xs ml-auto border border-[var(--border)] hover:bg-[var(--fg)] hover:text-[var(--bg)] transition-colors"
        >
          <ArrowRight className="h-3.5 w-3.5" />
          New Booking
        </button>
      </motion.div>
    </div>
  );
}