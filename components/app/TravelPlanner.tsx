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

const samplePlan: DayPlan[] = [
  {
    day: 1,
    date: "28 Jul 2026",
    activities: [
      {
        time: "06:25",
        title: "Delhi → Jaipur by Rajdhani Express",
        type: "travel",
        detail: "12951 · 3A · B1-34 (Lower) · 5h 25m",
      },
      {
        time: "11:50",
        title: "Arrive Jaipur Junction",
        type: "travel",
        detail: "Platform 1 · Likely on time",
      },
      {
        time: "12:30",
        title: "Check-in at Hotel",
        type: "stay",
        detail: "Rambagh Palace · Pre-booked · 2 nights",
      },
      {
        time: "15:00",
        title: "Explore Hawa Mahal & City Palace",
        type: "explore",
        detail: "Walking distance from hotel",
      },
      {
        time: "20:00",
        title: "Dinner at Chokhi Dhani",
        type: "food",
        detail: "Rajasthani thali · ₹1,200/person",
      },
    ],
  },
  {
    day: 2,
    date: "29 Jul 2026",
    activities: [
      {
        time: "05:30",
        title: "Sunrise at Amber Fort",
        type: "explore",
        detail: "Taxi booked · 30 min drive",
      },
      {
        time: "10:00",
        title: "Breakfast at hotel",
        type: "food",
        detail: "Included in stay",
      },
      {
        time: "11:00",
        title: "Jaipur Sightseeing",
        type: "explore",
        detail: "Jantar Mantar · Albert Hall · Bapu Bazaar",
      },
      {
        time: "20:00",
        title: "Evening at leisure",
        type: "food",
        detail: "Explore local food at MI Road",
      },
    ],
  },
  {
    day: 3,
    date: "30 Jul 2026",
    activities: [
      {
        time: "08:15",
        title: "Jaipur → Delhi by Jan Shatabdi",
        type: "travel",
        detail: "12055 · 2S · 6h 10m",
      },
      {
        time: "14:25",
        title: "Arrive Delhi",
        type: "travel",
        detail: "End of trip",
      },
    ],
  },
];

const activityIcons: Record<string, React.ElementType> = {
  travel: Train,
  stay: Hotel,
  food: Coffee,
  explore: Sun,
};

export default function TravelPlanner() {
  const [activeDay, setActiveDay] = useState(0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold uppercase tracking-[0.05em]">
            Travel Planner
          </h2>
          <p className="text-[13px] text-[var(--muted)] mt-1">
            Delhi ↔ Jaipur · 3 days · AI-optimized itinerary
          </p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-[var(--railway-red)] text-[var(--bg)] text-xs uppercase tracking-[0.1em] font-semibold hover:bg-[var(--fg)] transition-colors">
          <Sparkles className="h-3.5 w-3.5" />
          Optimize Plan
        </button>
      </div>

      {/* Timeline overview */}
      <div className="flex gap-3">
        {samplePlan.map((day, index) => (
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
      <div className="border-2 border-[var(--fg)] p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-lg font-bold">
              Day {samplePlan[activeDay].day}
            </h3>
            <p className="text-[13px] text-[var(--muted)]">
              {samplePlan[activeDay].date}
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
            {samplePlan[activeDay].activities.map((activity, i) => {
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

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        <div className="border-2 border-[var(--fg)] p-4">
          <div className="text-[10px] text-[var(--muted)] uppercase tracking-[0.1em] mb-1">
            Total Travel
          </div>
          <div className="text-lg font-bold">11h 35m</div>
          <div className="text-[11px] text-[var(--muted)]">2 train journeys</div>
        </div>
        <div className="border-2 border-[var(--fg)] p-4">
          <div className="text-[10px] text-[var(--muted)] uppercase tracking-[0.1em] mb-1">
            Total Cost
          </div>
          <div className="text-lg font-bold">₹6,850</div>
          <div className="text-[11px] text-[var(--muted)]">Transport + Stay + Food</div>
        </div>
        <div className="border-2 border-[var(--fg)] p-4">
          <div className="text-[10px] text-[var(--muted)] uppercase tracking-[0.1em] mb-1">
            AI Score
          </div>
          <div className="text-lg font-bold text-[var(--railway-red)]">92%</div>
          <div className="text-[11px] text-[var(--muted)]">Optimization confidence</div>
        </div>
      </div>
    </div>
  );
}
