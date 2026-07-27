"use client";

import { motion } from "framer-motion";
import {
  Check,
  Train,
  MapPin,
  Clock,
  Ticket,
  Download,
  Share2,
  ArrowRight,
  Printer,
  Sparkles,
} from "lucide-react";
import { useBooking } from "@/lib/booking-store";

export default function BookingConfirmation() {
  const { state, resetBooking } = useBooking();

  const train = state.selectedTrain;
  const pnr = state.pnrNumber || "4785213694";

  return (
    <div className="space-y-6">
      {/* Success header */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4 }}
        className="border-2 border-[var(--fg)] p-8 text-center"
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.15, type: "spring", stiffness: 200, damping: 15 }}
          className="w-16 h-16 bg-[var(--fg)] flex items-center justify-center mx-auto mb-5"
        >
          <Check className="h-8 w-8 text-[var(--bg)]" />
        </motion.div>
        <h2 className="text-2xl font-bold uppercase tracking-[0.05em] mb-2">
          Booking Confirmed
        </h2>
        <p className="text-[15px] text-[var(--muted)] max-w-md mx-auto">
          Your journey has been booked successfully. Check your PNR status for
          real-time updates.
        </p>
      </motion.div>

      {/* Journey card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="border-2 border-[var(--fg)]"
      >
        {/* Train header */}
        <div className="p-5 border-b-2 border-[var(--fg)]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 flex items-center justify-center bg-[var(--fg)]">
                <Train className="h-5 w-5 text-[var(--bg)]" />
              </div>
              <div>
                <div className="text-lg font-bold">
                  {train?.name || "Rajdhani Express"}
                </div>
                <div className="text-[12px] text-[var(--muted)]">
                  {train?.number || "12951"} · {train?.classType || "3A"} · Superfast
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold">₹{train?.price || 1245}</div>
              <div className="text-[10px] text-[var(--muted)] uppercase tracking-[0.1em]">
                Total fare
              </div>
            </div>
          </div>
        </div>

        {/* Journey details */}
        <div className="p-5 space-y-5">
          {/* Route */}
          <div className="flex items-center gap-6">
            <div className="flex-1 text-center">
              <div className="text-2xl font-bold">{train?.departure || "06:25"}</div>
              <div className="text-[11px] text-[var(--muted)] uppercase tracking-[0.1em]">
                {state.query?.origin || "Delhi"} (NDLS)
              </div>
            </div>
            <div className="flex-1 flex flex-col items-center">
              <div className="text-[10px] text-[var(--muted)] uppercase tracking-[0.1em] mb-1">
                {train?.duration || "5h 25m"}
              </div>
              <div className="w-full flex items-center gap-2">
                <div className="h-px flex-1 bg-[var(--fg)]/30" />
                <Train className="h-4 w-4 text-[var(--fg)]" />
                <div className="h-px flex-1 bg-[var(--fg)]/30" />
              </div>
              <div className="text-[10px] text-[var(--muted)] uppercase tracking-[0.1em] mt-1">
                309 km
              </div>
            </div>
            <div className="flex-1 text-center">
              <div className="text-2xl font-bold">{train?.arrival || "11:50"}</div>
              <div className="text-[11px] text-[var(--muted)] uppercase tracking-[0.1em]">
                {state.query?.destination || "Jaipur"} (JP)
              </div>
            </div>
          </div>

          {/* Divider */}
          <div className="border-t border-[var(--fg)]/20 pt-4">
            <div className="grid grid-cols-4 gap-4">
              {[
                { label: "PNR", value: pnr },
                { label: "Coach", value: "B1" },
                { label: "Seat", value: `7 (Lower)` },
                { label: "Platform", value: "5" },
              ].map((item) => (
                <div key={item.label} className="text-center">
                  <div className="text-[10px] text-[var(--muted)] uppercase tracking-[0.1em] mb-1">
                    {item.label}
                  </div>
                  <div className="text-sm font-bold">{item.value}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Passenger */}
          <div className="border-t border-[var(--fg)]/20 pt-4">
            <div className="text-[10px] text-[var(--muted)] uppercase tracking-[0.1em] mb-3">
              Passenger Details
            </div>
            <div className="space-y-2">
              {[
                { name: "A. Kumar", age: "28", berth: "B1-7 (Lower)", status: "CNF" },
                { name: "P. Sharma", age: "32", berth: "B1-8 (Middle)", status: "CNF" },
              ].map((p, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between py-2 text-sm"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-6 h-6 flex items-center justify-center bg-[var(--fg)]/10 text-[10px] font-bold">
                      {i + 1}
                    </div>
                    <span>{p.name}</span>
                    <span className="text-[var(--muted)] text-[12px]">{p.age} yrs</span>
                  </div>
                  <div className="flex items-center gap-4 text-[13px]">
                    <span className="text-[var(--muted)]">{p.berth}</span>
                    <span className="px-2 py-0.5 bg-[var(--fg)] text-[var(--bg)] text-[10px] uppercase tracking-[0.1em]">
                      {p.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="border-t-2 border-[var(--fg)] flex">
          <button
            onClick={() => {
              const w = window.open("", "_blank");
              if (w) {
                w.document.write(
                  `<pre style="font-family:monospace;background:#F5F2EA;color:#111;padding:40px;font-size:14px;line-height:1.6;">🚆 RAILY BOOKING CONFIRMATION
══════════════════════════════
PNR: ${pnr}
Train: ${train?.name} (${train?.number})
Route: ${state.query?.origin || "Delhi"} → ${state.query?.destination || "Jaipur"}
Date: ${state.query?.date || "28 Jul 2026"}
Time: ${train?.departure} → ${train?.arrival}
Coach: B1 · Seat: 7 (Lower)
Fare: ₹${train?.price || 1245}
Platform: 5
Status: CONFIRMED ✅
══════════════════════════════
Thank you for using RAILY.</pre>`
                );
                w.document.close();
              }
            }}
            className="flex-1 flex items-center justify-center gap-2 py-3 text-xs uppercase tracking-[0.1em] font-semibold hover:bg-[var(--fg)] hover:text-[var(--bg)] transition-colors"
          >
            <Printer className="h-3.5 w-3.5" />
            Print
          </button>
          <button className="flex-1 flex items-center justify-center gap-2 py-3 text-xs uppercase tracking-[0.1em] font-semibold border-l-2 border-[var(--fg)] hover:bg-[var(--fg)] hover:text-[var(--bg)] transition-colors">
            <Download className="h-3.5 w-3.5" />
            Download
          </button>
          <button className="flex-1 flex items-center justify-center gap-2 py-3 text-xs uppercase tracking-[0.1em] font-semibold border-l-2 border-[var(--fg)] hover:bg-[var(--fg)] hover:text-[var(--bg)] transition-colors">
            <Share2 className="h-3.5 w-3.5" />
            Share
          </button>
        </div>
      </motion.div>

      {/* Quick actions */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35 }}
        className="grid grid-cols-2 gap-3"
      >
        <button
          onClick={() => {
            // Navigate to PNR
            window.location.hash = "pnr";
          }}
          className="flex items-center justify-center gap-3 p-5 border-2 border-[var(--fg)] hover:bg-[var(--fg)]/5 transition-colors text-left"
        >
          <Ticket className="h-6 w-6" />
          <div>
            <div className="text-sm font-bold uppercase tracking-[0.05em]">
              Check PNR
            </div>
            <div className="text-[11px] text-[var(--muted)]">
              {pnr} · Confirmed
            </div>
          </div>
          <ArrowRight className="h-5 w-5 ml-auto text-[var(--muted)]" />
        </button>
        <button
          onClick={() => {
            // Navigate to journey tracker
            window.location.hash = "journey";
          }}
          className="flex items-center justify-center gap-3 p-5 border-2 border-[var(--fg)] hover:bg-[var(--fg)]/5 transition-colors text-left"
        >
          <Clock className="h-6 w-6" />
          <div>
            <div className="text-sm font-bold uppercase tracking-[0.05em]">
              Live Tracking
            </div>
            <div className="text-[11px] text-[var(--muted)]">
              Track your train in real-time
            </div>
          </div>
          <ArrowRight className="h-5 w-5 ml-auto text-[var(--muted)]" />
        </button>
      </motion.div>

      {/* AI suggestion */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="flex items-start gap-3 p-4 border border-[var(--fg)]/30"
      >
        <Sparkles className="h-4 w-4 mt-0.5 text-[var(--muted)]" />
        <div>
          <p className="text-[13px] text-[var(--muted)]">
            <span className="font-semibold text-[var(--fg)]">AI Note:</span> Your
            train departs from Platform 5. Dining car is in Coach C1. Food
            service begins 30 min after departure. Pre-order available.
          </p>
        </div>
      </motion.div>

      {/* New booking */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="text-center"
      >
        <button
          onClick={resetBooking}
          className="inline-flex items-center gap-2 px-6 py-3 border-2 border-[var(--fg)] text-xs uppercase tracking-[0.1em] font-semibold hover:bg-[var(--fg)] hover:text-[var(--bg)] transition-colors"
        >
          Book Another Journey
        </button>
      </motion.div>
    </div>
  );
}
