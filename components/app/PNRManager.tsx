"use client";

import { useState } from "react";
import {
  Ticket,
  Search,
  AlertCircle,
  User,
  ChevronRight,
} from "lucide-react";

interface PNRData {
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

const mockPNRs: PNRData[] = [
  {
    number: "4785213694",
    status: "confirmed",
    trainName: "Rajdhani Express",
    trainNumber: "12951",
    date: "28 Jul 2026",
    from: "NDLS",
    to: "JP",
    departure: "06:25",
    arrival: "11:50",
    class: "3A",
    passengers: [
      { name: "A. Kumar", berth: "B1-34 (Lower)", status: "Confirmed" },
      { name: "P. Sharma", berth: "B1-35 (Upper)", status: "Confirmed" },
    ],
    lastUpdated: "2 min ago",
  },
  {
    number: "8651274390",
    status: "rac",
    trainName: "Shatabdi Express",
    trainNumber: "12009",
    date: "30 Jul 2026",
    from: "NDLS",
    to: "CDG",
    departure: "07:30",
    arrival: "10:55",
    class: "CC",
    passengers: [
      { name: "R. Patel", berth: "C2-12 (Side)", status: "RAC 1" },
    ],
    lastUpdated: "1 hour ago",
  },
  {
    number: "3512876945",
    status: "waitlist",
    trainName: "Garib Rath",
    trainNumber: "12215",
    date: "1 Aug 2026",
    from: "NDLS",
    to: "JP",
    departure: "08:10",
    arrival: "14:05",
    class: "3A",
    passengers: [
      { name: "S. Singh", berth: "-", status: "WL 15" },
    ],
    lastUpdated: "3 hours ago",
  },
];

export default function PNRManager() {
  const [pnrInput, setPnrInput] = useState("");
  const [searchedPNR, setSearchedPNR] = useState<PNRData | null>(null);
  const [isSearching, setIsSearching] = useState(false);

  const statusStyles: Record<string, { label: string; className: string }> = {
    confirmed: {
      label: "Confirmed",
      className: "bg-[var(--fg)] text-[var(--bg)]",
    },
    rac: {
      label: "RAC",
      className: "bg-[var(--railway-red)] text-[var(--bg)]",
    },
    waitlist: {
      label: "Waitlist",
      className: "border-2 border-[var(--fg)] text-[var(--fg)]",
    },
    cancelled: {
      label: "Cancelled",
      className: "bg-[var(--fg)]/20 text-[var(--fg)]/50",
    },
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pnrInput.trim() || pnrInput.length !== 10) return;
    setIsSearching(true);
    await new Promise((r) => setTimeout(r, 800));
    const found = mockPNRs.find((p) => p.number === pnrInput);
    setSearchedPNR(found || null);
    setIsSearching(false);
  };

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
            onChange={(e) => setPnrInput(e.target.value.replace(/\D/g, "").slice(0, 10))}
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

      {/* Search result */}
      {searchedPNR && (
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
                {searchedPNR.passengers.map((p, i) => (
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
                ))}
              </div>
            </div>
          </div>

          <div className="border-t-2 border-[var(--fg)] flex">
            <button className="flex-1 py-3 text-xs uppercase tracking-[0.1em] font-semibold hover:bg-[var(--fg)] hover:text-[var(--bg)] transition-colors">
              Track Train
            </button>
            <button className="flex-1 py-3 text-xs uppercase tracking-[0.1em] font-semibold border-l-2 border-[var(--fg)] hover:bg-[var(--fg)] hover:text-[var(--bg)] transition-colors">
              Share PNR
            </button>
            <button className="flex-1 py-3 text-xs uppercase tracking-[0.1em] font-semibold border-l-2 border-[var(--fg)] hover:bg-[var(--fg)] hover:text-[var(--bg)] transition-colors">
              Cancel Booking
            </button>
          </div>
        </div>
      )}

      {searchedPNR === null && pnrInput.length === 10 && !isSearching && (
        <div className="border-2 border-[var(--fg)] p-6 text-center">
          <AlertCircle className="h-8 w-8 mx-auto mb-3 text-[var(--muted)]" />
          <p className="text-sm text-[var(--muted)]">
            No booking found with PNR {pnrInput}
          </p>
          <p className="text-[11px] text-[var(--muted)] mt-1">
            Please check the number and try again
          </p>
        </div>
      )}

      {/* Recent PNRs */}
      <div>
        <div className="text-[11px] text-[var(--muted)] uppercase tracking-[0.15em] mb-3">
          Recent Bookings
        </div>
        <div className="space-y-2">
          {mockPNRs.map((pnr) => (
            <button
              key={pnr.number}
              onClick={() => {
                setPnrInput(pnr.number);
                setSearchedPNR(pnr);
              }}
              className="w-full flex items-center justify-between p-4 border border-[var(--fg)]/30 hover:border-[var(--fg)] transition-colors text-left"
            >
              <div className="flex items-center gap-4">
                <Ticket className="h-4 w-4 text-[var(--muted)]" />
                <div>
                  <div className="text-sm font-bold">{pnr.number}</div>
                  <div className="text-[11px] text-[var(--muted)]">
                    {pnr.trainName} · {pnr.from} → {pnr.to}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-[11px] text-[var(--muted)]">{pnr.date}</span>
                <ChevronRight className="h-4 w-4 text-[var(--muted)]" />
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
