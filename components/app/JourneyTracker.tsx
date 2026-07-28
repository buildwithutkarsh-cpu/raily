"use client";

import { useState, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  MapPin,
  Train,
  Clock,
  Utensils,
  Flag,
  Navigation,
  Coffee,
  AlertCircle,
  RefreshCw,
} from "lucide-react";
import { useBooking } from "@/lib/booking-store";
import type { LiveStatus } from "@/lib/railway/types";

/* ── Component ────────────────────────────────────────────── */

export default function JourneyTracker() {
  const { fetchLiveStatus } = useBooking();
  const [liveData, setLiveData] = useState<LiveStatus | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [trainInput, setTrainInput] = useState("12301");

  const fetchStatus = async (trainNumber?: string) => {
    const tn = trainNumber || trainInput;
    if (!tn.trim()) return;

    setIsLoading(true);
    setError(null);

    try {
      const result = await fetchLiveStatus(tn);
      if (result.success && result.data) {
        setLiveData(result.data as LiveStatus);
      } else {
        setError(result.error?.message || `No live data for train ${tn}`);
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to fetch live status"
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus("12301");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const train = liveData?.train;
  const route = liveData?.route || [];

  /* ── Build journey steps from live data ──────────────────── */

  const getJourneySteps = () => {
    if (route.length === 0) return [];

    const passed = route.filter((s) => s.crossed);
    const current = route.find((s) => !s.crossed);
    let upcoming: typeof route = [];
    if (current) {
      upcoming = route.slice(route.indexOf(current) + 1);
    } else if (passed.length === route.length && route.length > 0) {
      // All stations passed — journey completed
      upcoming = [];
    }

    const steps: Array<{
      id: string;
      title: string;
      subtitle: string;
      icon: React.ElementType;
      time: string;
      status: "completed" | "active" | "pending";
      detail: string;
    }> = [];

    // Departure
    const firstStation = route[0];
    steps.push({
      id: "departure",
      title: firstStation.station.name,
      subtitle: `${firstStation.station.code} · Platform ${firstStation.platform || "—"}`,
      icon: MapPin,
      time: firstStation.scheduledDeparture || firstStation.scheduledArrival,
      status: firstStation.crossed ? "completed" : firstStation === current ? "active" : "pending",
      detail: firstStation.crossed
        ? `Departed at ${firstStation.actualDeparture || firstStation.scheduledDeparture}`
        : firstStation === current
        ? `Departing ${firstStation.scheduledDeparture}`
        : `Scheduled departure ${firstStation.scheduledDeparture}`,
    });

    // Midway stations (without creating too many steps)
    const midStations = passed.slice(1, -1).slice(0, 3); // max 3 midway
    midStations.forEach((s) => {
      steps.push({
        id: `stop-${s.station.code}`,
        title: s.station.name,
        subtitle: `${s.station.code} · Day ${s.day}`,
        icon: Clock,
        time: s.scheduledArrival,
        status: "completed",
        detail: `Arr ${s.actualArrival || s.scheduledArrival} · Dep ${s.actualDeparture || s.scheduledDeparture}${s.delay ? ` · Delay: ${s.delay} min` : ""}`,
      });
    });

    // Current station
    if (current) {
      steps.push({
        id: "running",
        title: current.station.name,
        subtitle: `Next stop${upcoming.length > 0 ? ` → ${upcoming[0].station.code}` : ""}`,
        icon: Train,
        time: current.scheduledArrival,
        status: "active",
        detail: liveData?.delay
          ? `Expected ${current.scheduledArrival} · ${liveData.delay} min delay`
          : `Scheduled ${current.scheduledArrival} · On time`,
      });
    }

    // Upcoming stations (max 2)
    upcoming.slice(0, 2).forEach((s) => {
      steps.push({
        id: `upcoming-${s.station.code}`,
        title: s.station.name,
        subtitle: `Scheduled stop · Day ${s.day}`,
        icon: Clock,
        time: s.scheduledArrival,
        status: "pending",
        detail: `Arr ${s.scheduledArrival} · Dep ${s.scheduledDeparture}${s.platform ? ` · Platform ${s.platform}` : ""}`,
      });
    });

    // Arrival
    const lastStation = route[route.length - 1];
    if (lastStation.station.code !== firstStation.station.code) {
      steps.push({
        id: "arrival",
        title: lastStation.station.name,
        subtitle: `${lastStation.station.code} · Day ${lastStation.day}`,
        icon: Flag,
        time: lastStation.scheduledArrival,
        status: lastStation.crossed ? "completed" : "pending",
        detail: lastStation.crossed
          ? `Arrived ${lastStation.actualArrival || lastStation.scheduledArrival}`
          : `Expected arrival ${lastStation.scheduledArrival}`,
      });
    }

    return steps;
  };

  const journeySteps = getJourneySteps();

  // Status display
  const statusConfig = {
    ONTIME: { label: "On Time", color: "bg-[var(--fg)]" },
    DELAYED: { label: `Delayed ${liveData?.delay || 0} min`, color: "bg-[var(--railway-red)]" },
    CANCELLED: { label: "Cancelled", color: "bg-[var(--muted)]" },
    ARRIVED: { label: "Arrived", color: "bg-[var(--fg)]" },
  };

  const currentStatus = statusConfig[liveData?.status || "ONTIME"];

  // Coffee break suggestion
  const hasMealStop = journeySteps.some(
    (s) => s.id.includes("upcoming") && s.status === "pending"
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold uppercase tracking-[0.05em]">
            Live Journey
          </h2>
          <p className="text-[13px] text-[var(--muted)] mt-1">
            {train ? `${train.name} (${train.number})` : "Enter a train number to track"}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Live indicator */}
          <div className="flex items-center gap-2 px-4 py-2 border-2 border-[var(--fg)]">
            <div
              className={`w-2.5 h-2.5 rounded-full animate-pulse ${currentStatus.color}`}
            />
            <span className="text-xs uppercase tracking-[0.1em] font-semibold">
              {currentStatus.label}
            </span>
          </div>
          {/* Refresh button */}
          <button
            onClick={() => fetchStatus()}
            disabled={isLoading}
            className="w-9 h-9 flex items-center justify-center border-2 border-[var(--fg)] hover:bg-[var(--fg)]/5 transition-colors disabled:opacity-30"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Train input (for testing different trains) */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          fetchStatus();
        }}
        className="flex gap-2"
      >
        <input
          type="text"
          value={trainInput}
          onChange={(e) => setTrainInput(e.target.value.replace(/\D/g, "").slice(0, 5))}
          placeholder="Enter train number (e.g. 12301)"
          className="flex-1 bg-transparent border-2 border-[var(--fg)] px-4 py-2 text-sm outline-none placeholder:text-[var(--muted)]"
        />
        <button
          type="submit"
          disabled={isLoading || !trainInput.trim()}
          className="px-5 bg-[var(--fg)] text-[var(--bg)] text-xs uppercase tracking-[0.1em] font-semibold disabled:opacity-30 hover:bg-[var(--railway-red)] transition-colors"
        >
          {isLoading ? (
            <div className="w-4 h-4 border-2 border-[var(--bg)] border-t-transparent animate-spin" />
          ) : (
            "Track"
          )}
        </button>
      </form>

      {/* Error state */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="border-2 border-[var(--fg)] p-6 text-center"
          >
            <AlertCircle className="h-8 w-8 mx-auto mb-3 text-[var(--muted)]" />
            <p className="text-sm text-[var(--muted)]">{error}</p>
            <p className="text-[11px] text-[var(--muted)] mt-1">
              Try a different train number or try again later
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Status overview */}
      {liveData && (
        <>
          <div className="border-2 border-[var(--fg)] p-5">
            <div className="grid grid-cols-3 gap-6">
              <div>
                <div className="text-[10px] text-[var(--muted)] uppercase tracking-[0.15em] mb-1">
                  Status
                </div>
                <div className="text-lg font-bold text-[var(--fg)]">
                  {currentStatus.label}
                </div>
              </div>
              <div>
                <div className="text-[10px] text-[var(--muted)] uppercase tracking-[0.15em] mb-1">
                  Current Station
                </div>
                <div className="text-lg font-bold">
                  {liveData.currentStation.name || "—"}
                </div>
              </div>
              <div>
                <div className="text-[10px] text-[var(--muted)] uppercase tracking-[0.15em] mb-1">
                  Distance Left
                </div>
                <div className="text-lg font-bold">
                  {liveData.totalDistance - liveData.distanceCovered} km
                </div>
              </div>
            </div>
            {/* Progress bar */}
            <div className="mt-4 h-2 bg-[var(--fg)]/10">
              <div
                className="h-full bg-[var(--fg)] transition-all duration-1000"
                style={{ width: `${Math.min(liveData.position, 100)}%` }}
              />
            </div>
            <div className="flex justify-between text-[10px] text-[var(--muted)] mt-1 uppercase tracking-[0.1em]">
              <span>
                {route[0]?.station.code} ({route[0]?.scheduledDeparture})
              </span>
              <span>{Math.round(liveData.position)}% complete</span>
              <span>
                {route[route.length - 1]?.station.code} ({route[route.length - 1]?.scheduledArrival})
              </span>
            </div>
          </div>

          {/* Timeline */}
          <div className="relative pl-8">
            {/* Vertical line */}
            <div className="absolute left-[15px] top-2 bottom-2 w-0.5 bg-[var(--fg)]/20" />

            <div className="space-y-0">
              {journeySteps.map((step, index) => {
                const isActive = step.status === "active";
                const isCompleted = step.status === "completed";

                return (
                  <div key={step.id} className="relative pb-8 last:pb-0">
                    {/* Timeline dot */}
                    <div className="absolute -left-8 top-1">
                      {isCompleted ? (
                        <div className="w-8 h-8 flex items-center justify-center">
                          <div className="w-3.5 h-3.5 bg-[var(--fg)] rotate-45" />
                        </div>
                      ) : isActive ? (
                        <div className="relative">
                          <div className="w-8 h-8 flex items-center justify-center">
                            <div className="w-3.5 h-3.5 bg-[var(--railway-red)] rotate-45 animate-pulse" />
                          </div>
                        </div>
                      ) : (
                        <div className="w-8 h-8 flex items-center justify-center">
                          <div className="w-3.5 h-3.5 border-2 border-[var(--fg)]/30 rotate-45" />
                        </div>
                      )}
                    </div>

                    {/* Content */}
                    <div className="ml-4">
                      <div className="flex items-center gap-3 mb-1">
                        <span className="text-[11px] text-[var(--muted)] font-mono">
                          {step.time}
                        </span>
                        <span
                          className={`font-bold text-sm ${
                            isActive ? "text-[var(--railway-red)]" : ""
                          }`}
                        >
                          {step.title}
                        </span>
                        {isActive && (
                          <span className="text-[10px] px-2 py-0.5 bg-[var(--railway-red)] text-[var(--bg)] uppercase tracking-[0.1em]">
                            Now
                          </span>
                        )}
                      </div>
                      <p className="text-[13px] text-[var(--muted)]">
                        {step.detail}
                      </p>
                    </div>

                    {/* Connecting line */}
                    {index < journeySteps.length - 1 && (
                      <div
                        className={`absolute left-[8px] top-[30px] bottom-0 w-[1px] ${
                          isCompleted ? "bg-[var(--fg)]" : "bg-[var(--fg)]/10"
                        }`}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Quick actions */}
          <div className="flex items-center gap-3 pt-2">
            <button className="flex-1 flex items-center justify-center gap-2 px-4 py-3 border-2 border-[var(--fg)] text-xs uppercase tracking-[0.1em] font-semibold hover:bg-[var(--fg)] hover:text-[var(--bg)] transition-colors">
              <Navigation className="h-3.5 w-3.5" />
              Share Live Status
            </button>
            <button className="flex-1 flex items-center justify-center gap-2 px-4 py-3 border-2 border-[var(--fg)] text-xs uppercase tracking-[0.1em] font-semibold hover:bg-[var(--fg)] hover:text-[var(--bg)] transition-colors">
              <Utensils className="h-3.5 w-3.5" />
              Order Food
            </button>
          </div>
        </>
      )}

      {/* Empty state */}
      {!liveData && !error && !isLoading && (
        <div className="border-2 border-dashed border-[var(--fg)]/30 p-12 text-center">
          <Train className="h-12 w-12 mx-auto mb-4 text-[var(--muted)]" />
          <h3 className="text-lg font-bold uppercase tracking-[0.03em] mb-2">
            No journey data
          </h3>
          <p className="text-[13px] text-[var(--muted)] max-w-md mx-auto leading-relaxed">
            Enter a train number above to see live running status,
            station timeline, and journey progress.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            {["12301", "12951", "12002", "12309"].map((tn) => (
              <button
                key={tn}
                onClick={() => {
                  setTrainInput(tn);
                  fetchStatus(tn);
                }}
                className="px-4 py-2 border border-[var(--fg)]/30 text-[11px] uppercase tracking-[0.1em] hover:border-[var(--fg)] transition-colors"
              >
                Train {tn}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <div className="flex items-center gap-3">
            <div className="w-6 h-6 border-2 border-[var(--fg)] border-t-transparent animate-spin" />
            <span className="text-[13px] text-[var(--muted)]">
              Fetching live data...
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
