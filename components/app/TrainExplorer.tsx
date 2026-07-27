"use client";

import { useState } from "react";
import {
  Train,
  Clock,
  ArrowRight,
  Star,
  AlertCircle,
  ChevronDown,
  Filter,
} from "lucide-react";

interface Train {
  id: string;
  name: string;
  number: string;
  departure: string;
  arrival: string;
  duration: string;
  price: number;
  available: number;
  probability: number;
  classType: string;
  isSuperfast: boolean;
  rating: number;
}

const trains: Train[] = [
  {
    id: "1",
    name: "Rajdhani Express",
    number: "12951",
    departure: "06:25",
    arrival: "11:50",
    duration: "5h 25m",
    price: 1245,
    available: 42,
    probability: 94,
    classType: "3A",
    isSuperfast: true,
    rating: 4.5,
  },
  {
    id: "2",
    name: "Shatabdi Express",
    number: "12009",
    departure: "07:30",
    arrival: "12:25",
    duration: "4h 55m",
    price: 1580,
    available: 28,
    probability: 87,
    classType: "CC",
    isSuperfast: true,
    rating: 4.3,
  },
  {
    id: "3",
    name: "Garib Rath",
    number: "12215",
    departure: "08:10",
    arrival: "14:05",
    duration: "5h 55m",
    price: 740,
    available: 156,
    probability: 96,
    classType: "3A",
    isSuperfast: false,
    rating: 3.8,
  },
  {
    id: "4",
    name: "Jan Shatabdi",
    number: "12055",
    departure: "08:15",
    arrival: "14:25",
    duration: "6h 10m",
    price: 890,
    available: 74,
    probability: 72,
    classType: "2S",
    isSuperfast: false,
    rating: 4.0,
  },
  {
    id: "5",
    name: "Intercity Express",
    number: "14211",
    departure: "09:00",
    arrival: "15:30",
    duration: "6h 30m",
    price: 620,
    available: 210,
    probability: 98,
    classType: "SL",
    isSuperfast: false,
    rating: 3.5,
  },
  {
    id: "6",
    name: "Duronto Express",
    number: "12285",
    departure: "05:45",
    arrival: "10:50",
    duration: "5h 05m",
    price: 1480,
    available: 12,
    probability: 65,
    classType: "3A",
    isSuperfast: true,
    rating: 4.6,
  },
];

export default function TrainExplorer({
  onSelectTrain,
}: {
  onSelectTrain?: (train: Train) => void;
}) {
  const [sortBy, setSortBy] = useState<"price" | "duration" | "probability" | "departure">("probability");
  const [selectedClass, setSelectedClass] = useState<string>("all");

  const sorted = [...trains].sort((a, b) => {
    if (sortBy === "price") return a.price - b.price;
    if (sortBy === "duration") {
      const toMins = (d: string) => {
        const [h, m] = d.split("h ");
        return parseInt(h) * 60 + parseInt(m.replace("m", ""));
      };
      return toMins(a.duration) - toMins(b.duration);
    }
    if (sortBy === "probability") return b.probability - a.probability;
    return a.departure.localeCompare(b.departure);
  });

  return (
    <div className="space-y-6">
      {/* Results header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold uppercase tracking-[0.05em]">
            Delhi → Jaipur
          </h2>
          <p className="text-[13px] text-[var(--muted)] mt-1">
            Tomorrow, 28 Jul • 6 trains found •{" "}
            <span className="text-[var(--railway-red)] font-semibold">
              ₹{Math.min(...trains.map((t) => t.price))} – ₹
              {Math.max(...trains.map((t) => t.price))}
            </span>
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.1em]">
            <Filter className="h-3.5 w-3.5" />
            <span className="text-[var(--muted)]">Sort:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
              className="bg-transparent border border-[var(--fg)] px-2 py-1 text-[11px] uppercase tracking-[0.05em] outline-none"
            >
              <option value="probability">Best Match</option>
              <option value="price">Cheapest</option>
              <option value="duration">Fastest</option>
              <option value="departure">Departure</option>
            </select>
          </div>
        </div>
      </div>

      {/* Class filter */}
      <div className="flex items-center gap-2 text-[11px]">
        <span className="text-[var(--muted)] uppercase tracking-[0.1em] mr-1">
          Class:
        </span>
        {["all", "3A", "CC", "SL", "2S"].map((cls) => (
          <button
            key={cls}
            onClick={() => setSelectedClass(cls)}
            className={`px-3 py-1.5 border text-[11px] uppercase tracking-[0.05em] transition-colors ${
              selectedClass === cls
                ? "bg-[var(--fg)] text-[var(--bg)] border-[var(--fg)]"
                : "border-[var(--fg)] hover:bg-[var(--fg)]/5"
            }`}
          >
            {cls === "all" ? "All" : cls}
          </button>
        ))}
      </div>

      {/* Train list */}
      <div className="space-y-3">
        {sorted.map((train, index) => (
          <button
            key={train.id}
            onClick={() => onSelectTrain?.(train)}
            className="w-full text-left border-2 border-[var(--fg)] p-5 hover:bg-[var(--fg)]/[0.02] transition-colors group"
          >
            <div className="flex items-start justify-between gap-4">
              {/* Left: Train info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-1">
                  <div className="w-8 h-8 flex items-center justify-center bg-[var(--fg)] group-hover:bg-[var(--railway-red)] transition-colors flex-shrink-0">
                    <Train className="h-4 w-4 text-[var(--bg)]" />
                  </div>
                  <div>
                    <span className="font-bold text-sm uppercase tracking-[0.02em]">
                      {train.name}
                    </span>
                    <span className="text-[11px] text-[var(--muted)] ml-2">
                      {train.number}
                    </span>
                  </div>
                  {train.probability >= 90 && (
                    <span className="text-[10px] px-2 py-0.5 bg-[var(--fg)] text-[var(--bg)] uppercase tracking-[0.1em]">
                      Best Match
                    </span>
                  )}
                </div>

                {/* Times */}
                <div className="flex items-center gap-4 mt-3">
                  <div className="text-center">
                    <div className="text-lg font-bold">{train.departure}</div>
                    <div className="text-[10px] text-[var(--muted)] uppercase tracking-[0.1em]">
                      Delhi
                    </div>
                  </div>
                  <div className="flex-1 flex items-center gap-2 max-w-[120px]">
                    <div className="h-px flex-1 bg-[var(--fg)]/30" />
                    <div className="flex flex-col items-center">
                      <Clock className="h-3 w-3 text-[var(--muted)]" />
                      <span className="text-[10px] text-[var(--muted)]">
                        {train.duration}
                      </span>
                    </div>
                    <div className="h-px flex-1 bg-[var(--fg)]/30" />
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-bold">{train.arrival}</div>
                    <div className="text-[10px] text-[var(--muted)] uppercase tracking-[0.1em]">
                      Jaipur
                    </div>
                  </div>
                </div>

                {/* Meta */}
                <div className="flex items-center gap-4 mt-3 text-[11px] text-[var(--muted)]">
                  <span>{train.classType}</span>
                  <span>·</span>
                  <span>{train.available} seats left</span>
                  {train.isSuperfast && (
                    <>
                      <span>·</span>
                      <span className="text-[var(--railway-red)]">Superfast</span>
                    </>
                  )}
                  <span>·</span>
                  <span className="flex items-center gap-1">
                    <Star className="h-3 w-3" /> {train.rating}
                  </span>
                </div>
              </div>

              {/* Right: Price & probability */}
              <div className="text-right flex-shrink-0">
                <div className="text-2xl font-bold">₹{train.price}</div>
                <div className="mt-2 w-24">
                  <div className="flex items-center justify-between text-[10px] text-[var(--muted)] uppercase tracking-[0.1em] mb-1">
                    <span>Confirm</span>
                    <span className="font-bold text-[var(--fg)]">
                      {train.probability}%
                    </span>
                  </div>
                  <div className="h-1.5 bg-[var(--fg)]/10">
                    <div
                      className={`h-full transition-all ${
                        train.probability >= 90
                          ? "bg-[var(--fg)]"
                          : train.probability >= 75
                          ? "bg-[var(--railway-red)]"
                          : "bg-[var(--muted)]"
                      }`}
                      style={{ width: `${train.probability}%` }}
                    />
                  </div>
                </div>
                <div className="mt-3 text-[11px] group-hover:text-[var(--railway-red)] transition-colors uppercase tracking-[0.1em] font-semibold">
                  Select →
                </div>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

export type { Train };
