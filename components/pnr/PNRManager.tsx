"use client";

import { motion } from "framer-motion";
import { useBooking } from "@/lib/booking-store";
import { Check, Clock, MapPin } from "lucide-react";

/* ─── Mock PNR Data ────────────────────────────────────────── */

const MOCK_PNR_DATA = {
  pnr: "4681234567",
  trainName: "Rajdhani Express",
  trainNumber: "12951",
  from: "Delhi (NDLS)",
  to: "Jaipur (JP)",
  date: "28 Jul 2026",
  departure: "06:25",
  arrival: "11:50",
  class: "3A",
  quota: "General",
  chartPrepared: true,
  passengers: [
    {
      number: 1,
      name: "Primary Passenger",
      status: "CNF",
      berth: "B1-7 (Lower)",
      bookingStatus: "CNF",
      currentStatus: "CNF",
    },
  ],
  platform: "5",
};

export default function PNRManager() {
  const { state } = useBooking();
  const pnr = state.pnrNumber || MOCK_PNR_DATA.pnr;
  const data = MOCK_PNR_DATA;

  return (
    <div className="space-y-3">
      {/* PNR header */}
      <div className="flex items-center gap-3 p-3 border border-[var(--border)]">
        <div className="w-7 h-7 flex items-center justify-center bg-[var(--fg)] flex-shrink-0">
          <Check className="h-3.5 w-3.5 text-[var(--bg)]" />
        </div>
        <div>
          <p className="text-sm font-medium">PNR {pnr}</p>
          <p className="text-[11px] text-[var(--muted)]">
            Confirmed · {data.trainName} · {data.trainNumber}
          </p>
        </div>
        <span className="ml-auto text-[10px] px-2 py-1 bg-[var(--fg)] text-[var(--bg)] font-mono uppercase tracking-[0.1em]">
          Confirmed
        </span>
      </div>

      {/* Details grid */}
      <div className="grid grid-cols-2 gap-3">
        <div className="border border-[var(--border)] p-3">
          <p className="text-[10px] text-[var(--muted)] font-mono uppercase tracking-[0.1em] mb-1">
            Route
          </p>
          <p className="text-sm font-medium">{data.from}</p>
          <p className="text-sm font-medium">{data.to}</p>
        </div>
        <div className="border border-[var(--border)] p-3">
          <p className="text-[10px] text-[var(--muted)] font-mono uppercase tracking-[0.1em] mb-1">
            Schedule
          </p>
          <p className="text-sm font-medium">{data.date}</p>
          <p className="text-[11px] text-[var(--muted)] font-mono">
            {data.departure} → {data.arrival}
          </p>
        </div>
        <div className="border border-[var(--border)] p-3">
          <p className="text-[10px] text-[var(--muted)] font-mono uppercase tracking-[0.1em] mb-1">
            Class
          </p>
          <p className="text-sm font-medium">{data.class}</p>
          <p className="text-[11px] text-[var(--muted)] font-mono">{data.quota}</p>
        </div>
        <div className="border border-[var(--border)] p-3">
          <p className="text-[10px] text-[var(--muted)] font-mono uppercase tracking-[0.1em] mb-1">
            Platform
          </p>
          <p className="text-2xl font-semibold">{data.platform}</p>
          <p className="text-[11px] text-[var(--muted)] font-mono">
            Chart prepared: {data.chartPrepared ? "Yes" : "No"}
          </p>
        </div>
      </div>

      {/* Passenger */}
      <div className="border border-[var(--border)]">
        <div className="px-3 py-2 border-b border-[var(--border)]">
          <p className="text-[10px] text-[var(--muted)] font-mono uppercase tracking-[0.1em]">
            Passengers
          </p>
        </div>
        {data.passengers.map((p) => (
          <div
            key={p.number}
            className="flex items-center justify-between px-3 py-2.5"
          >
            <div className="flex items-center gap-2.5">
              <span className="w-5 h-5 flex items-center justify-center bg-[var(--fg)]/10 text-[10px] font-medium">
                {p.number}
              </span>
              <span className="text-sm">{p.name}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[11px] text-[var(--muted)]">{p.berth}</span>
              <span className="px-2 py-0.5 bg-[var(--fg)] text-[var(--bg)] text-[9px] font-mono uppercase tracking-[0.1em]">
                {p.status}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="flex items-center gap-1.5 text-[11px] text-[var(--muted)]">
        <Clock className="h-3 w-3" />
        <span>Last updated: {new Date().toLocaleTimeString()}</span>
      </div>
    </div>
  );
}