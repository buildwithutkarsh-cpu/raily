"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Clock, MapPin, Train } from "lucide-react";

/* ─── Mock Journey Data ────────────────────────────────────── */

const MOCK_STATIONS = [
  { name: "Delhi (NDLS)", dep: "06:25", arr: "—", day: 1, delay: 0, crossed: true },
  { name: "Mathura (MTJ)", dep: "07:52", arr: "07:50", day: 1, delay: 2, crossed: true },
  { name: "Agra (AGC)", dep: "08:45", arr: "08:40", day: 1, delay: 5, crossed: true },
  { name: "Bharatpur (BTE)", dep: "—", arr: "09:30", day: 1, delay: 0, crossed: false },
  { name: "Jaipur (JP)", dep: "—", arr: "11:50", day: 1, delay: 0, crossed: false },
];

export default function JourneyTracker() {
  const [trainName] = useState("Rajdhani Express");
  const [trainNumber] = useState("12951");
  const [currentSpeed] = useState("87 km/h");
  const [delay] = useState(2);

  return (
    <div className="space-y-4">
      {/* Train info */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 flex items-center justify-center bg-[var(--fg)]">
            <Train className="h-3.5 w-3.5 text-[var(--bg)]" />
          </div>
          <div>
            <p className="text-sm font-medium">{trainName}</p>
            <p className="text-[10px] text-[var(--muted)] font-mono">
              {trainNumber} · {currentSpeed} · {delay > 0 ? `${delay} min late` : "On time"}
            </p>
          </div>
        </div>
        <span className="text-[10px] px-2 py-1 border border-[var(--border)] font-mono">
          {delay > 0 ? "DELAYED" : "ONTIME"}
        </span>
      </div>

      {/* Journey line */}
      <div className="border border-[var(--border)] p-4">
        <div className="space-y-0">
          {MOCK_STATIONS.map((station, i) => (
            <div key={station.name} className="flex items-start gap-3 relative">
              {/* Timeline line */}
              {i < MOCK_STATIONS.length - 1 && (
                <div className="absolute left-[11px] top-7 bottom-0 w-px bg-[var(--border)]" />
              )}

              {/* Dot */}
              <div className="relative z-10 mt-1.5">
                <div
                  className={`w-[22px] h-[22px] flex items-center justify-center border ${
                    station.crossed
                      ? "bg-[var(--fg)] border-[var(--fg)] text-[var(--bg)]"
                      : "border-[var(--border)] text-[var(--muted)]"
                  }`}
                >
                  {station.crossed ? (
                    <div className="w-1.5 h-1.5 bg-[var(--bg)]" />
                  ) : (
                    <div className="w-1.5 h-1.5 bg-[var(--border)]" />
                  )}
                </div>
              </div>

              {/* Station details */}
              <div className="flex-1 pb-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <p className={`text-sm font-medium ${station.crossed ? "" : "text-[var(--muted)]"}`}>
                      {station.name}
                    </p>
                    {station.delay > 0 && station.crossed && (
                      <span className="text-[10px] text-[var(--railway-red)] font-mono">
                        +{station.delay}m
                      </span>
                    )}
                  </div>
                  <div className="text-right">
                    <p className={`text-xs font-mono ${station.crossed ? "" : "text-[var(--muted)]"}`}>
                      {station.crossed ? station.arr : station.arr || station.dep || "—"}
                    </p>
                    {station.crossed && (
                      <p className="text-[10px] text-[var(--muted)] font-mono">
                        {station.dep || "—"}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* AI note */}
      <div className="flex items-start gap-2 text-[11px] text-[var(--muted)]">
        <MapPin className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
        <p>
          Current location: Approaching Bharatpur. Estimated arrival in Jaipur:
          <span className="text-[var(--fg)]"> 11:50</span>
          {delay > 0 && (
            <span className="text-[var(--railway-red)]">
              {" "}(+{delay} min delay)
            </span>
          )}
        </p>
      </div>
    </div>
  );
}