"use client";

import { useState } from "react";
import {
  Ticket,
  ChevronRight,
  Download,
  Search,
  Train,
} from "lucide-react";

interface Booking {
  id: string;
  pnr: string;
  trainName: string;
  trainNumber: string;
  from: string;
  to: string;
  date: string;
  departure: string;
  arrival: string;
  class_: string;
  amount: number;
  status: "completed" | "cancelled" | "upcoming";
  passengers: number;
}

const statusConfig: Record<string, { label: string; className: string }> = {
  upcoming: {
    label: "Upcoming",
    className: "bg-[var(--fg)] text-[var(--bg)]",
  },
  completed: {
    label: "Completed",
    className: "border border-[var(--fg)] text-[var(--fg)]",
  },
  cancelled: {
    label: "Cancelled",
    className: "bg-[var(--fg)]/10 text-[var(--muted)]",
  },
};

export default function BookingHistory() {
  const [filter, setFilter] = useState<"all" | "upcoming" | "completed" | "cancelled">("all");
  const [searchQuery, setSearchQuery] = useState("");

  const bookings: Booking[] = [];

  const filtered = bookings.filter((b) => {
    if (filter !== "all" && b.status !== filter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        b.trainName.toLowerCase().includes(q) ||
        b.pnr.includes(q) ||
        b.from.toLowerCase().includes(q) ||
        b.to.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const totalSpent = bookings
    .filter((b) => b.status !== "cancelled")
    .reduce((sum, b) => sum + b.amount, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold uppercase tracking-[0.05em]">
            Booking History
          </h2>
          <p className="text-[13px] text-[var(--muted)] mt-1">
            {bookings.length === 0
              ? "No bookings yet"
              : `${bookings.length} bookings · ₹${totalSpent.toLocaleString()} total spent`}
          </p>
        </div>
        <button
          disabled
          className="flex items-center gap-2 px-4 py-2 border-2 border-[var(--fg)]/30 text-xs uppercase tracking-[0.1em] text-[var(--muted)] opacity-50 cursor-not-allowed"
        >
          <Download className="h-3.5 w-3.5" />
          Export
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3">
        {(["all", "upcoming", "completed", "cancelled"] as const).map((f) => {
          const count =
            f === "all"
              ? bookings.length
              : bookings.filter((b) => b.status === f).length;
          return (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`p-4 border-2 text-left transition-colors ${
                filter === f
                  ? "bg-[var(--fg)] text-[var(--bg)] border-[var(--fg)]"
                  : "border-[var(--fg)] hover:bg-[var(--fg)]/5"
              }`}
            >
              <div className="text-2xl font-bold">{count}</div>
              <div className="text-[10px] uppercase tracking-[0.1em] mt-1">
                {f === "all" ? "Total" : f}
              </div>
            </button>
          );
        })}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--muted)]" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search by train name, PNR, or station..."
          className="w-full bg-transparent border-2 border-[var(--fg)] pl-10 pr-4 py-3 text-sm outline-none placeholder:text-[var(--muted)]"
        />
      </div>

      {/* List */}
      <div className="space-y-2">
        {filtered.length === 0 && !searchQuery && (
          <div className="border-2 border-dashed border-[var(--fg)]/30 p-12 text-center">
            <div className="w-14 h-14 flex items-center justify-center bg-[var(--fg)] mx-auto mb-5">
              <Ticket className="h-7 w-7 text-[var(--bg)]" />
            </div>
            <h3 className="text-lg font-bold uppercase tracking-[0.03em] mb-2">
              No bookings yet
            </h3>
            <p className="text-[13px] text-[var(--muted)] max-w-md mx-auto leading-relaxed mb-8">
              Your booking history will show up here once you book your
              first journey. Try asking the AI to find and book a train
              for you.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              {[
                { icon: Train, text: "Delhi → Jaipur" },
                { icon: Train, text: "Mumbai → Pune" },
                { icon: Train, text: "Bangalore → Chennai" },
              ].map((item) => (
                <button
                  key={item.text}
                  className="flex items-center gap-2 px-4 py-3 border-2 border-[var(--fg)] text-xs uppercase tracking-[0.1em] font-semibold hover:bg-[var(--fg)] hover:text-[var(--bg)] transition-colors"
                >
                  <Train className="h-3.5 w-3.5" />
                  {item.text}
                </button>
              ))}
            </div>
          </div>
        )}
        {filtered.length === 0 && searchQuery && (
          <div className="border-2 border-[var(--fg)] p-8 text-center">
            <p className="text-sm text-[var(--muted)]">No bookings found</p>
          </div>
        )}
        {filtered.map((booking) => {
          const status = statusConfig[booking.status];
          return (
            <div
              key={booking.id}
              className="border-2 border-[var(--fg)] p-5 hover:bg-[var(--fg)]/[0.02] transition-colors group"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-8 h-8 flex items-center justify-center bg-[var(--fg)] group-hover:bg-[var(--railway-red)] transition-colors flex-shrink-0">
                      <Ticket className="h-4 w-4 text-[var(--bg)]" />
                    </div>
                    <div>
                      <span className="font-bold text-sm">
                        {booking.trainName}
                      </span>
                      <span className="text-[11px] text-[var(--muted)] ml-2">
                        {booking.trainNumber}
                      </span>
                    </div>
                    <span
                      className={`text-[10px] px-2 py-0.5 uppercase tracking-[0.1em] ${status.className}`}
                    >
                      {status.label}
                    </span>
                  </div>

                  <div className="grid grid-cols-4 gap-4 mt-3 text-center">
                    <div>
                      <div className="text-[10px] text-[var(--muted)] uppercase tracking-[0.1em]">
                        Date
                      </div>
                      <div className="text-[13px] font-semibold">
                        {booking.date}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] text-[var(--muted)] uppercase tracking-[0.1em]">
                        From
                      </div>
                      <div className="text-[13px] font-semibold">
                        {booking.from}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] text-[var(--muted)] uppercase tracking-[0.1em]">
                        To
                      </div>
                      <div className="text-[13px] font-semibold">
                        {booking.to}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] text-[var(--muted)] uppercase tracking-[0.1em]">
                        Amount
                      </div>
                      <div className="text-[13px] font-semibold">
                        ₹{booking.amount}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 mt-3 text-[11px] text-[var(--muted)]">
                    <span>PNR: {booking.pnr}</span>
                    <span>·</span>
                    <span>
                      {booking.departure} – {booking.arrival}
                    </span>
                    <span>·</span>
                    <span>
                      {booking.passengers} passenger{booking.passengers > 1 ? "s" : ""}
                    </span>
                    <span>·</span>
                    <span>
                      {booking.class_}
                    </span>
                  </div>
                </div>

                <div className="flex-shrink-0">
                  <ChevronRight className="h-5 w-5 text-[var(--muted)] group-hover:text-[var(--fg)] transition-colors" />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
