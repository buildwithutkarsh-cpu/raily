"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Ticket, Train, ArrowRight } from "lucide-react";

/* ─── Mock Bookings ────────────────────────────────────────── */

const MOCK_BOOKINGS = [
  {
    pnr: "4681234567",
    trainName: "Rajdhani Express",
    trainNumber: "12951",
    from: "NDLS",
    to: "JP",
    date: "28 Jul 2026",
    departure: "06:25",
    arrival: "11:50",
    class: "3A",
    fare: 1940,
    status: "Confirmed" as const,
  },
  {
    pnr: "6249876543",
    trainName: "Shatabdi Express",
    trainNumber: "12015",
    from: "NDLS",
    to: "CDG",
    date: "15 Jul 2026",
    departure: "07:40",
    arrival: "10:50",
    class: "CC",
    fare: 890,
    status: "Completed" as const,
  },
  {
    pnr: "8123456789",
    trainName: "Garib Rath",
    trainNumber: "12215",
    from: "NDLS",
    to: "BCT",
    date: "02 Jul 2026",
    departure: "14:25",
    arrival: "06:15",
    class: "3A",
    fare: 740,
    status: "Completed" as const,
  },
];

export default function BookingHistory() {
  const [selected, setSelected] = useState<string | null>(null);

  return (
    <div className="space-y-2">
      {MOCK_BOOKINGS.map((booking, i) => (
        <motion.div
          key={booking.pnr}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, delay: i * 0.05 }}
          onClick={() => setSelected(selected === booking.pnr ? null : booking.pnr)}
          className="border border-[var(--border)] hover:border-[var(--fg)] transition-colors cursor-pointer"
        >
          <div className="px-3 py-2.5">
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 flex items-center justify-center bg-[var(--fg)]">
                  <Ticket className="h-2.5 w-2.5 text-[var(--bg)]" />
                </div>
                <span className="text-sm font-medium">{booking.trainName}</span>
                <span className="text-[10px] text-[var(--muted)] font-mono">
                  {booking.trainNumber}
                </span>
              </div>
              <span
                className={`text-[9px] px-1.5 py-0.5 font-mono uppercase tracking-[0.1em] ${
                  booking.status === "Confirmed"
                    ? "bg-[var(--fg)] text-[var(--bg)]"
                    : "border border-[var(--border)] text-[var(--muted)]"
                }`}
              >
                {booking.status}
              </span>
            </div>

            <div className="flex items-center gap-3 text-xs text-[var(--muted)]">
              <span className="font-mono">{booking.departure}</span>
              <Train className="h-3 w-3" />
              <span className="font-mono">{booking.arrival}</span>
              <span className="mx-1">·</span>
              <span>{booking.from}</span>
              <ArrowRight className="h-3 w-3" />
              <span>{booking.to}</span>
              <span className="mx-1">·</span>
              <span className="font-mono">₹{booking.fare}</span>
            </div>
          </div>

          {/* Expanded detail */}
          {selected === booking.pnr && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              className="border-t border-[var(--border)] px-3 py-2.5 space-y-1"
            >
              <p className="text-[11px] text-[var(--muted)] font-mono">
                PNR: {booking.pnr} · {booking.class} · {booking.date}
              </p>
              <p className="text-[11px] text-[var(--muted)]">
                {booking.status === "Confirmed"
                  ? "Your journey is confirmed. Check PNR for real-time status."
                  : "Journey completed successfully."}
              </p>
            </motion.div>
          )}
        </motion.div>
      ))}
    </div>
  );
}