"use client";

import { useState, useEffect } from "react";
import { useBooking } from "@/lib/booking-store";
import { Check, Clock } from "lucide-react";
import * as rapi from "@/lib/rapi/endpoints";
import { transformPNR, type PNRActionInfo } from "@/lib/rapi/transform";

/* ─── Fallback Mock Data ───────────────────────────────────── */

const FALLBACK: PNRActionInfo = {
  pnr: "4681234567",
  trainName: "Mumbai Rajdhani Express",
  trainNumber: "12951",
  date: "28 Jul 2026",
  fromName: "Delhi (NDLS)",
  fromCode: "NDLS",
  toName: "Mumbai (BCT)",
  toCode: "BCT",
  className: "3A",
  quota: "GN",
  chartPrepared: false,
  fare: 1940,
  passengers: [
    { number: 1, bookingStatus: "CNF", currentStatus: "CNF", coach: "B1", berth: "B1-7 (Lower)" },
    { number: 2, bookingStatus: "CNF", currentStatus: "CNF", coach: "B1", berth: "B1-8 (Upper)" },
  ],
};

/* ─── Helpers ──────────────────────────────────────────────── */

function computeStatus(passengers: PNRActionInfo["passengers"]): { label: string; variant: "confirmed" | "rac" | "waitlist" | "unknown" } {
  if (!passengers.length) return { label: "Unknown", variant: "unknown" };
  const statuses = passengers.map((p) => p.currentStatus);
  if (statuses.every((s) => s === "CNF" || s === "CONFIRMED")) return { label: "Confirmed", variant: "confirmed" };
  if (statuses.some((s) => s.startsWith("RAC"))) return { label: "RAC", variant: "rac" };
  if (statuses.some((s) => s.startsWith("WL") || s.startsWith("W/L"))) return { label: "Waitlist", variant: "waitlist" };
  return { label: statuses[0] || "Unknown", variant: "unknown" };
}

function formatDate(dateStr: string): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function formatFare(fare: number): string {
  return `\u20B9${fare.toLocaleString("en-IN")}`;
}

/* ─── Loading Skeleton ─────────────────────────────────────── */

function PNRSkeleton() {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 p-3 border border-[var(--border)]">
        <div className="w-7 h-7 bg-[var(--border)] animate-pulse" />
        <div className="space-y-1.5 flex-1">
          <div className="h-4 w-40 bg-[var(--border)] animate-pulse" />
          <div className="h-3 w-56 bg-[var(--border)] animate-pulse" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="border border-[var(--border)] p-3">
            <div className="h-3 w-12 bg-[var(--border)] animate-pulse mb-2" />
            <div className="h-4 w-24 bg-[var(--border)] animate-pulse" />
            <div className="h-3 w-16 bg-[var(--border)] animate-pulse mt-1" />
          </div>
        ))}
      </div>
      <div className="border border-[var(--border)]">
        <div className="px-3 py-2 border-b border-[var(--border)]">
          <div className="h-3 w-20 bg-[var(--border)] animate-pulse" />
        </div>
        {[1, 2].map((i) => (
          <div key={i} className="flex items-center justify-between px-3 py-2.5">
            <div className="flex items-center gap-2.5">
              <div className="w-5 h-5 bg-[var(--border)] animate-pulse" />
              <div className="h-3 w-32 bg-[var(--border)] animate-pulse" />
            </div>
            <div className="h-4 w-16 bg-[var(--border)] animate-pulse" />
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── PNR Manager ──────────────────────────────────────────── */

export default function PNRManager() {
  const { state } = useBooking();
  const [data, setData] = useState<PNRActionInfo | null>(null);
  const [loading, setLoading] = useState(true);

  const pnr = state.pnrNumber || "4681234567";

  const fetchPNR = async () => {
    setLoading(true);
    try {
      const result = await rapi.getPNRStatus(pnr);
      if (result.success && result.data) {
        setData(transformPNR(result.data));
      } else {
        setData(FALLBACK);
      }
    } catch {
      setData(FALLBACK);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPNR();
  }, [pnr]);

  if (loading) return <PNRSkeleton />;

  const info = data || FALLBACK;
  const status = computeStatus(info.passengers);

  return (
    <div className="space-y-3">
      {/* PNR header */}
      <div className="flex items-center gap-3 p-3 border border-[var(--border)]">
        <div className="w-7 h-7 flex items-center justify-center bg-[var(--fg)] flex-shrink-0">
          <Check className="h-3.5 w-3.5 text-[var(--bg)]" />
        </div>
        <div>
          <p className="text-sm font-medium">PNR {info.pnr}</p>
          <p className="text-[11px] text-[var(--muted)]">
            {status.label} · {info.trainName} · {info.trainNumber}
          </p>
        </div>
        <span className={`ml-auto text-[10px] px-2 py-1 font-mono uppercase tracking-[0.1em] ${
          status.variant === "confirmed"
            ? "bg-[var(--fg)] text-[var(--bg)]"
            : status.variant === "rac"
            ? "bg-[var(--railway-red)]/10 text-[var(--railway-red)] border border-[var(--railway-red)]/30"
            : "bg-[var(--railway-red)]/10 text-[var(--railway-red)] border border-[var(--railway-red)]/30"
        }`}>
          {status.label}
        </span>
      </div>

      {/* Details grid */}
      <div className="grid grid-cols-2 gap-3">
        <div className="border border-[var(--border)] p-3">
          <p className="text-[10px] text-[var(--muted)] font-mono uppercase tracking-[0.1em] mb-1">
            Route
          </p>
          <p className="text-sm font-medium">{info.fromName}</p>
          <p className="text-sm font-medium">{info.toName}</p>
        </div>
        <div className="border border-[var(--border)] p-3">
          <p className="text-[10px] text-[var(--muted)] font-mono uppercase tracking-[0.1em] mb-1">
            Journey
          </p>
          <p className="text-sm font-medium">{formatDate(info.date)}</p>
          <p className="text-[11px] text-[var(--muted)] font-mono">
            Fare: {formatFare(info.fare)}
          </p>
        </div>
        <div className="border border-[var(--border)] p-3">
          <p className="text-[10px] text-[var(--muted)] font-mono uppercase tracking-[0.1em] mb-1">
            Class
          </p>
          <p className="text-sm font-medium">{info.className}</p>
          <p className="text-[11px] text-[var(--muted)] font-mono">{info.quota}</p>
        </div>
        <div className="border border-[var(--border)] p-3">
          <p className="text-[10px] text-[var(--muted)] font-mono uppercase tracking-[0.1em] mb-1">
            Chart
          </p>
          <p className="text-2xl font-semibold">{info.chartPrepared ? "Prepared" : "—"}</p>
          <p className="text-[11px] text-[var(--muted)] font-mono">
            Chart {info.chartPrepared ? "ready" : "pending"}
          </p>
        </div>
      </div>

      {/* Passengers */}
      <div className="border border-[var(--border)]">
        <div className="px-3 py-2 border-b border-[var(--border)]">
          <p className="text-[10px] text-[var(--muted)] font-mono uppercase tracking-[0.1em]">
            Passengers
          </p>
        </div>
        {info.passengers.map((p) => (
          <div
            key={p.number}
            className="flex items-center justify-between px-3 py-2.5"
          >
            <div className="flex items-center gap-2.5">
              <span className="w-5 h-5 flex items-center justify-center bg-[var(--fg)]/10 text-[10px] font-medium">
                {p.number}
              </span>
              <div>
                <span className="text-sm">{p.coach} · {p.berth}</span>
                <span className="text-[10px] text-[var(--muted)] ml-2 font-mono">
                  Booked: {p.bookingStatus}
                </span>
              </div>
            </div>
            <span className={`px-2 py-0.5 text-[9px] font-mono uppercase tracking-[0.1em] ${
              p.currentStatus === "CNF" || p.currentStatus === "CONFIRMED"
                ? "bg-[var(--fg)] text-[var(--bg)]"
                : "bg-[var(--railway-red)]/10 text-[var(--railway-red)]"
            }`}>
              {p.currentStatus}
            </span>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-[11px] text-[var(--muted)]">
          <Clock className="h-3 w-3" />
          <span>Updated just now</span>
        </div>
        <button
          onClick={fetchPNR}
          className="text-[10px] text-[var(--muted)] font-mono hover:text-[var(--fg)] transition-colors underline underline-offset-2"
        >
          Refresh
        </button>
      </div>
    </div>
  );
}