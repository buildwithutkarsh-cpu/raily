"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Ticket, Train, ArrowRight } from "lucide-react";
import { getStoredRecentBookings } from "@/lib/booking-store";

interface BookingEntry {
  pnr: string;
  trainName: string;
  trainNumber: string;
  from: string;
  to: string;
  date: string;
  time: string;
  status: string;
  timestamp: string;
}

/* ─── Empty State ──────────────────────────────────────────── */

function EmptyState() {
  return (
    <div className="border border-[var(--border)] p-6 text-center">
      <div className="w-8 h-8 mx-auto mb-3 flex items-center justify-center bg-[var(--fg)]">
        <Ticket className="h-4 w-4 text-[var(--bg)]" />
      </div>
      <p className="text-sm font-medium mb-1">No bookings yet</p>
      <p className="text-[11px] text-[var(--muted)]">
        Book a train journey to see it here
      </p>
    </div>
  );
}

export default function BookingHistory() {
  const [selected, setSelected] = useState<string | null>(null);
  const [bookings, setBookings] = useState<BookingEntry[]>([]);

  useEffect(() => {
    setBookings(getStoredRecentBookings());
  }, []);

  if (bookings.length === 0) return <EmptyState />;

  return (
    <div className="space-y-2">
      {bookings.map((booking, i) => (
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
                  booking.status === "CONFIRMED"
                    ? "bg-[var(--fg)] text-[var(--bg)]"
                    : "border border-[var(--border)] text-[var(--muted)]"
                }`}
              >
                {booking.status}
              </span>
            </div>

            <div className="flex items-center gap-3 text-xs text-[var(--muted)]">
              <span className="font-mono">{booking.time}</span>
              <span className="mx-1">·</span>
              <span>{booking.from}</span>
              <ArrowRight className="h-3 w-3" />
              <span>{booking.to}</span>
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
                PNR: {booking.pnr} · {booking.date}
              </p>
              <p className="text-[11px] text-[var(--muted)]">
                {booking.status === "CONFIRMED"
                  ? "Your journey is confirmed. Check PNR for real-time status."
                  : "Booking recorded successfully."}
              </p>
            </motion.div>
          )}
        </motion.div>
      ))}
    </div>
  );
}