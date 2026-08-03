"use client";

import { useState, useEffect } from "react";
import { MapPin, Train } from "lucide-react";
import { useBooking } from "@/lib/booking-store";
import * as rapi from "@/lib/rapi/endpoints";
import { transformLiveStatus } from "@/lib/rapi/transform";
import type { JourneyInfo } from "@/lib/rapi/transform";

/* Fallback mock data */

const FALLBACK: JourneyInfo = {
  trainNo: "12951",
  trainName: "Rajdhani Express",
  date: "2026-07-29",
  currentStationName: "Delhi (NDLS)",
  delay: 0,
  timeline: [
    { code: "NDLS", name: "Delhi (NDLS)", scheduledArrival: "--", scheduledDeparture: "06:25", distance: 0, day: 1, platform: "5", delay: 0, status: "passed" },
    { code: "MTJ", name: "Mathura (MTJ)", scheduledArrival: "07:50", scheduledDeparture: "07:52", distance: 141, day: 1, platform: "2", delay: 2, status: "passed" },
    { code: "AGC", name: "Agra (AGC)", scheduledArrival: "08:40", scheduledDeparture: "08:45", distance: 199, day: 1, platform: "3", delay: 5, status: "current" },
    { code: "BTE", name: "Bharatpur (BTE)", scheduledArrival: "09:30", scheduledDeparture: "09:32", distance: 271, day: 1, platform: "1", delay: 0, status: "upcoming" },
    { code: "JP", name: "Jaipur (JP)", scheduledArrival: "11:50", scheduledDeparture: "--", distance: 431, day: 1, platform: "1", delay: 0, status: "upcoming" },
  ],
};

/* Loading skeleton */

function JourneySkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 bg-[var(--border)] animate-pulse" />
          <div className="space-y-1.5">
            <div className="h-4 w-32 bg-[var(--border)] animate-pulse" />
            <div className="h-3 w-48 bg-[var(--border)] animate-pulse" />
          </div>
        </div>
        <div className="h-5 w-16 bg-[var(--border)] animate-pulse" />
      </div>
      <div className="border border-[var(--border)] p-4 space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex items-center gap-3">
            <div className="w-[22px] h-[22px] bg-[var(--border)] animate-pulse" />
            <div className="flex-1 h-4 bg-[var(--border)] animate-pulse" />
            <div className="w-12 h-4 bg-[var(--border)] animate-pulse" />
          </div>
        ))}
      </div>
    </div>
  );
}

/* Journey Tracker */

export default function JourneyTracker() {
  const { state } = useBooking();
  const [journey, setJourney] = useState<JourneyInfo | null>(null);
  const [loading, setLoading] = useState(true);
  // Real train number — from the selected train, or resolved from the PNR
  // via a lookup (PNR digits are NOT a train number, so we never slice them).
  const [trainNumber, setTrainNumber] = useState<string | null>(
    state.selectedTrain?.number || null
  );
  const [resolved, setResolved] = useState(!!state.selectedTrain?.number);

  useEffect(() => {
    let cancelled = false;

    const resolveTrainNumber = async () => {
      if (state.selectedTrain?.number) {
        setTrainNumber(state.selectedTrain.number);
        setResolved(true);
        return;
      }
      if (state.pnrNumber) {
        // Look up the actual train number from the PNR status endpoint.
        const result = await rapi.getPNRStatus(state.pnrNumber);
        if (!cancelled && result.success && result.data?.train?.number) {
          setTrainNumber(result.data.train.number);
        }
        if (!cancelled) setResolved(true);
        return;
      }
      if (!cancelled) {
        setTrainNumber(null);
        setResolved(true);
      }
    };

    resolveTrainNumber();
    return () => {
      cancelled = true;
    };
  }, [state.selectedTrain?.number, state.pnrNumber]);

  const fetchJourney = async () => {
    setLoading(true);
    try {
      const result = await rapi.getLiveStatus(trainNumber || "12951");
      if (result.success && result.data) {
        setJourney(transformLiveStatus(result.data));
      } else {
        setJourney(FALLBACK);
      }
    } catch {
      setJourney(FALLBACK);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!resolved) return;
    fetchJourney();
  }, [resolved, trainNumber]);

  if (loading) return <JourneySkeleton />;

  const data = journey || FALLBACK;
  const delay = data.delay;
  const timeline = data.timeline || [];

  return (
    <div className="space-y-4">
      {/* Train info */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 flex items-center justify-center bg-[var(--fg)]">
            <Train className="h-3.5 w-3.5 text-[var(--bg)]" />
          </div>
          <div>
            <p className="text-sm font-medium">{data.trainName}</p>
            <p className="text-[10px] text-[var(--muted)] font-mono">
              {data.trainNo} · {delay > 0 ? `${delay} min late` : "On time"}
            </p>
          </div>
        </div>
        <span className={`text-[10px] px-2 py-1 border border-[var(--border)] font-mono ${delay > 0 ? "text-[var(--railway-red)]" : ""}`}>
          {delay > 0 ? "DELAYED" : "ONTIME"}
        </span>
      </div>

      {/* Journey line */}
      <div className="border border-[var(--border)] p-4">
        <div className="space-y-0">
          {timeline.map((station, i) => (
            <div key={station.code} className="flex items-start gap-3 relative">
              {i < timeline.length - 1 && (
                <div className="absolute left-[11px] top-7 bottom-0 w-px bg-[var(--border)]" />
              )}
              <div className="relative z-10 mt-1.5">
                <div
                  className={`w-[22px] h-[22px] flex items-center justify-center border ${
                    station.status === "passed"
                      ? "bg-[var(--fg)] border-[var(--fg)] text-[var(--bg)]"
                      : station.status === "current"
                      ? "bg-[var(--railway-red)] border-[var(--railway-red)] text-[var(--bg)]"
                      : "border-[var(--border)] text-[var(--muted)]"
                  }`}
                >
                  {station.status === "passed" ? (
                    <div className="w-1.5 h-1.5 bg-[var(--bg)]" />
                  ) : station.status === "current" ? (
                    <div className="w-1.5 h-1.5 bg-[var(--bg)] animate-pulse" />
                  ) : (
                    <div className="w-1.5 h-1.5 bg-[var(--border)]" />
                  )}
                </div>
              </div>
              <div className="flex-1 pb-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <p className={`text-sm font-medium ${station.status === "upcoming" ? "text-[var(--muted)]" : ""}`}>
                      {station.name}
                      {station.platform ? (
                        <span className="text-[10px] text-[var(--muted)] font-mono ml-1.5">P{station.platform}</span>
                      ) : null}
                    </p>
                    {station.delay > 0 && station.status !== "upcoming" && (
                      <span className="text-[10px] text-[var(--railway-red)] font-mono">+{station.delay}m</span>
                    )}
                  </div>
                  <div className="text-right">
                    <p className={`text-xs font-mono ${station.status === "upcoming" ? "text-[var(--muted)]" : ""}`}>
                      {station.status === "passed"
                        ? station.scheduledDeparture || station.scheduledArrival || "\u2014"
                        : station.scheduledArrival || station.scheduledDeparture || "\u2014"}
                    </p>
                    {station.status === "passed" && station.scheduledArrival !== "\u2014" && (
                      <p className="text-[10px] text-[var(--muted)] font-mono">{station.scheduledArrival}</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* AI note — current location */}
      {data.currentStationName ? (
        <div className="flex items-center gap-2 px-1">
          <MapPin className="h-3 w-3 text-[var(--railway-red)]" />
          <p className="text-[11px] text-[var(--muted)]">
            Currently at{" "}
            <span className="text-[var(--fg)] font-medium">{data.currentStationName}</span>
            {delay > 0 && (
              <span className="text-[var(--railway-red)]">
                {" "}· Running {delay} min late
              </span>
            )}
          </p>
        </div>
      ) : null}

      {/* Last update indicator */}
      <div className="flex items-center justify-between px-1">
        <p className="text-[10px] text-[var(--muted)] font-mono flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-[var(--fg)]" />
          Live
        </p>
        <button
          onClick={fetchJourney}
          className="text-[10px] text-[var(--muted)] font-mono hover:text-[var(--fg)] transition-colors underline underline-offset-2"
        >
          Refresh
        </button>
      </div>
    </div>
  );
}
