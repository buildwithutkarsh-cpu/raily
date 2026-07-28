"use client";

import { useState } from "react";
import {
  Plus,
  Train,
  Sparkles,
  Sun,
  Moon,
  Coffee,
  Hotel,
  MapPin,
} from "lucide-react";

interface DayPlan {
  day: number;
  date: string;
  activities: {
    time: string;
    title: string;
    type: "travel" | "stay" | "food" | "explore";
    detail: string;
  }[];
}

const activityIcons: Record<string, React.ElementType> = {
  travel: Train,
  stay: Hotel,
  food: Coffee,
  explore: Sun,
};

export default function TravelPlanner() {
  const [plans] = useState<DayPlan[]>([]);
  const [activeDay, setActiveDay] = useState(0);

  if (plans.length === 0) {
    return (
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h2 className="text-xl font-bold uppercase tracking-[0.05em]">
            Travel Planner
          </h2>
          <p className="text-[13px] text-[var(--muted)] mt-1">
            Plan your entire journey — itineraries, seats, and connections
          </p>
        </div>

        {/* Empty state */}
        <div className="border-2 border-dashed border-[var(--fg)]/30 p-12 text-center">
          <div className="w-14 h-14 flex items-center justify-center bg-[var(--fg)] mx-auto mb-5">
            <MapPin className="h-7 w-7 text-[var(--bg)]" />
          </div>
          <h3 className="text-lg font-bold uppercase tracking-[0.03em] mb-2">
            No travel plans yet
          </h3>
          <p className="text-[13px] text-[var(--muted)] max-w-md mx-auto leading-relaxed mb-8">
            Tell the AI where you want to go — it will create a complete
            itinerary with trains, timings, seat recommendations, and
            local tips. Just say something like:
          </p>
          <div className="inline-flex items-center gap-3 px-5 py-3 border-2 border-[var(--fg)] bg-[var(--fg)]/[0.02]">
            <Sparkles className="h-4 w-4 text-[var(--railway-red)]" />
            <span className="text-sm text-[var(--muted)]">
              &ldquo;Plan a 3-day trip from Delhi to Jaipur&rdquo;
            </span>
          </div>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            {[
              "Delhi → Agra → Jaipur circuit",
              "Mumbai to Goa weekend",
              "Bangalore → Mysore day trip",
            ].map((suggestion) => (
              <button
                key={suggestion}
                className="px-4 py-2 border border-[var(--fg)]/30 text-[11px] uppercase tracking-[0.1em] hover:border-[var(--fg)] transition-colors"
              >
                {suggestion}
              </button>
            ))}
          </div>
        </div>

        {/* Summary skeleton */}
        <div className="grid grid-cols-3 gap-4 opacity-30 pointer-events-none">
          <div className="border-2 border-[var(--fg)] p-4">
            <div className="text-[10px] text-[var(--muted)] uppercase tracking-[0.1em] mb-1">
              Total Travel
            </div>
            <div className="text-lg font-bold">—</div>
            <div className="text-[11px] text-[var(--muted)]">Plan a trip to see estimates</div>
          </div>
          <div className="border-2 border-[var(--fg)] p-4">
            <div className="text-[10px] text-[var(--muted)] uppercase tracking-[0.1em] mb-1">
              Total Cost
            </div>
            <div className="text-lg font-bold">—</div>
            <div className="text-[11px] text-[var(--muted)]">Plan a trip to see estimates</div>
          </div>
          <div className="border-2 border-[var(--fg)] p-4">
            <div className="text-[10px] text-[var(--muted)] uppercase tracking-[0.1em] mb-1">
              AI Score
            </div>
            <div className="text-lg font-bold">—</div>
            <div className="text-[11px] text-[var(--muted)]">Plan a trip to see estimates</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold uppercase tracking-[0.05em]">
            Travel Planner
          </h2>
          <p className="text-[13px] text-[var(--muted)] mt-1">
            {plans[activeDay]?.date
              ? `${plans[0]?.activities?.[0]?.title?.split("→")?.[0]?.trim() || ""} ↔ ${plans[plans.length - 1]?.activities?.[plans[plans.length - 1]?.activities?.length - 1]?.title?.split("→")?.[1]?.trim() || ""} · ${plans.length} days · AI-optimized itinerary`
              : "AI-optimized itinerary"}
          </p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-[var(--railway-red)] text-[var(--bg)] text-xs uppercase tracking-[0.1em] font-semibold hover:bg-[var(--fg)] transition-colors">
          <Sparkles className="h-3.5 w-3.5" />
          Optimize Plan
        </button>
      </div>

      {/* Timeline overview */}
      <div className="flex gap-3">
        {plans.map((day, index) => (
          <button
            key={day.day}
            onClick={() => setActiveDay(index)}
            className={`flex-1 p-4 border-2 text-left transition-colors ${
              activeDay === index
                ? "bg-[var(--fg)] text-[var(--bg)] border-[var(--fg)]"
                : "border-[var(--fg)] hover:bg-[var(--fg)]/5"
            }`}
          >
            <div className="text-[10px] uppercase tracking-[0.1em] opacity-70">
              Day {day.day}
            </div>
            <div className="text-sm font-bold mt-1">{day.date}</div>
            <div className="text-[10px] mt-1 opacity-70">
              {day.activities.length} activities
            </div>
          </button>
        ))}
        <button className="w-16 flex items-center justify-center border-2 border-dashed border-[var(--fg)]/50 hover:border-[var(--fg)] transition-colors">
          <Plus className="h-5 w-5 text-[var(--muted)]" />
        </button>
      </div>

      {/* Day detail */}
      {plans[activeDay] && (
        <div className="border-2 border-[var(--fg)] p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-bold">
                Day {plans[activeDay].day}
              </h3>
              <p className="text-[13px] text-[var(--muted)]">
                {plans[activeDay].date}
              </p>
            </div>
            <div className="flex items-center gap-3 text-[11px]">
              <span className="flex items-center gap-1">
                <Sun className="h-3.5 w-3.5" /> 24°C
              </span>
              <span className="text-[var(--muted)]">|</span>
              <span className="flex items-center gap-1">
                <Moon className="h-3.5 w-3.5" /> 18°C
              </span>
            </div>
          </div>

          {/* Timeline */}
          <div className="relative pl-8">
            <div className="absolute left-[11px] top-2 bottom-2 w-0.5 bg-[var(--fg)]/10" />
            <div className="space-y-6">
              {plans[activeDay].activities.map((activity, i) => {
                const Icon = activityIcons[activity.type];
                return (
                  <div key={i} className="relative">
                    <div className="absolute -left-8 top-0.5 w-6 h-6 flex items-center justify-center bg-[var(--bg)]">
                      <div className="w-5 h-5 flex items-center justify-center border-2 border-[var(--fg)]">
                        <Icon className="h-3 w-3" />
                      </div>
                    </div>
                    <div className="ml-2">
                      <div className="flex items-center gap-3">
                        <span className="text-[11px] text-[var(--muted)] font-mono">
                          {activity.time}
                        </span>
                        <span className="font-bold text-sm">{activity.title}</span>
                        <span className="text-[9px] px-2 py-0.5 border border-[var(--fg)] uppercase tracking-[0.15em]">
                          {activity.type}
                        </span>
                      </div>
                      <p className="text-[13px] text-[var(--muted)] mt-1 ml-0">
                        {activity.detail}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        <div className="border-2 border-[var(--fg)] p-4">
          <div className="text-[10px] text-[var(--muted)] uppercase tracking-[0.1em] mb-1">
            Total Travel
          </div>
          <div className="text-lg font-bold">—</div>
          <div className="text-[11px] text-[var(--muted)]">Plan a trip to see estimates</div>
        </div>
        <div className="border-2 border-[var(--fg)] p-4">
          <div className="text-[10px] text-[var(--muted)] uppercase tracking-[0.1em] mb-1">
            Total Cost
          </div>
          <div className="text-lg font-bold">—</div>
          <div className="text-[11px] text-[var(--muted)]">Plan a trip to see estimates</div>
        </div>
        <div className="border-2 border-[var(--fg)] p-4">
          <div className="text-[10px] text-[var(--muted)] uppercase tracking-[0.1em] mb-1">
            AI Score
          </div>
          <div className="text-lg font-bold">—</div>
          <div className="text-[11px] text-[var(--muted)]">Plan a trip to see estimates</div>
        </div>
      </div>
    </div>
  );
}
