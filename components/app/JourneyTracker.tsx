"use client";

import {
  MapPin,
  Train,
  Clock,
  Utensils,
  Flag,
  Navigation,
  Coffee,
} from "lucide-react";

interface JourneyStep {
  id: string;
  title: string;
  subtitle: string;
  icon: React.ElementType;
  time: string;
  status: "completed" | "active" | "pending";
  detail: string;
}

const journey: JourneyStep[] = [
  {
    id: "departure",
    title: "Departure",
    subtitle: "NDLS · Platform 3",
    icon: MapPin,
    time: "06:25",
    status: "completed",
    detail: "Left Delhi on time",
  },
  {
    id: "running",
    title: "Running Status",
    subtitle: "On time",
    icon: Train,
    time: "07:10",
    status: "active",
    detail: "Speed: 82 km/h · Next stop: Alwar Junction (ETA 08:05)",
  },
  {
    id: "stops",
    title: "Alwar Junction",
    subtitle: "Scheduled stop",
    icon: Clock,
    time: "08:05",
    status: "pending",
    detail: "Stop: 2 min · Almost on time (+3 min delay)",
  },
  {
    id: "meals",
    title: "Breakfast Service",
    subtitle: "Onboard catering",
    icon: Coffee,
    time: "08:30",
    status: "pending",
    detail: "Pre-ordered: Masala Dosa & Coffee · Seat 34",
  },
  {
    id: "midway",
    title: "Jaipur-Bandikui Jn",
    subtitle: "Midway checkpoint",
    icon: Navigation,
    time: "10:15",
    status: "pending",
    detail: "386 km covered · 189 km remaining",
  },
  {
    id: "arrival",
    title: "Arrival",
    subtitle: "Jaipur Junction",
    icon: Flag,
    time: "11:50",
    status: "pending",
    detail: "Platform 1 · Exit via Gate 2",
  },
];

export default function JourneyTracker() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold uppercase tracking-[0.05em]">
            Live Journey
          </h2>
          <p className="text-[13px] text-[var(--muted)] mt-1">
            Delhi → Jaipur · Rajdhani Express 12951 · 5h 25m
          </p>
        </div>
        <div className="flex items-center gap-3 px-4 py-2 border-2 border-[var(--fg)]">
          <div className="w-2.5 h-2.5 bg-[var(--fg)] animate-pulse rounded-full" />
          <span className="text-xs uppercase tracking-[0.1em] font-semibold">
            Live
          </span>
        </div>
      </div>

      {/* Status overview */}
      <div className="border-2 border-[var(--fg)] p-5">
        <div className="grid grid-cols-3 gap-6">
          <div>
            <div className="text-[10px] text-[var(--muted)] uppercase tracking-[0.15em] mb-1">
              Status
            </div>
            <div className="text-lg font-bold text-[var(--fg)]">On Time</div>
          </div>
          <div>
            <div className="text-[10px] text-[var(--muted)] uppercase tracking-[0.15em] mb-1">
              Current Speed
            </div>
            <div className="text-lg font-bold">82 km/h</div>
          </div>
          <div>
            <div className="text-[10px] text-[var(--muted)] uppercase tracking-[0.15em] mb-1">
              Distance Left
            </div>
            <div className="text-lg font-bold">189 km</div>
          </div>
        </div>
        {/* Progress bar */}
        <div className="mt-4 h-2 bg-[var(--fg)]/10">
          <div
            className="h-full bg-[var(--fg)] transition-all duration-1000"
            style={{ width: "67%" }}
          />
        </div>
        <div className="flex justify-between text-[10px] text-[var(--muted)] mt-1 uppercase tracking-[0.1em]">
          <span>Delhi (06:25)</span>
          <span>67% complete</span>
          <span>Jaipur (11:50)</span>
        </div>
      </div>

      {/* Timeline */}
      <div className="relative pl-8">
        {/* Vertical line */}
        <div className="absolute left-[15px] top-2 bottom-2 w-0.5 bg-[var(--fg)]/20" />

        <div className="space-y-0">
          {journey.map((step, index) => {
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
                {index < journey.length - 1 && (
                  <div
                    className={`absolute left-[8px] top-[30px] bottom-0 w-[1px] ${
                      isCompleted
                        ? "bg-[var(--fg)]"
                        : "bg-[var(--fg)]/10"
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
    </div>
  );
}
