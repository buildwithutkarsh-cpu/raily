"use client";

import { useState, useCallback, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useUser } from "@clerk/nextjs";
import AppSidebar, { type AppSection } from "./AppSidebar";
import TopBar from "./TopBar";
import AIAssistantPanel from "./AIAssistantPanel";
import TrainExplorer from "./TrainExplorer";
import CoachVisualizer from "./CoachVisualizer";
import JourneyTracker from "./JourneyTracker";
import PNRManager from "./PNRManager";
import BookingHistory from "./BookingHistory";
import NotificationsPanel from "./NotificationsPanel";
import TravelPlanner from "./TravelPlanner";
import BookingConfirmation from "./BookingConfirmation";
import { BookingProvider, useBooking, getStoredRecentBookings } from "@/lib/booking-store";
import {
  TrainFront,
  ArrowRight,
  Sparkles,
  Train,
  Map,
  Clock,
} from "lucide-react";

/* ─── Helpers ─────────────────────────────────────────────── */

function timeAgo(iso: string): string {
  const now = Date.now();
  const then = new Date(iso).getTime();
  const diffSec = Math.floor((now - then) / 1000);
  if (diffSec < 60) return "Just now";
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)} min ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)} hour${diffSec >= 7200 ? "s" : ""} ago`;
  return `${Math.floor(diffSec / 86400)} day${diffSec >= 172800 ? "s" : ""} ago`;
}

function getUserDisplayName(user: ReturnType<typeof useUser>["user"]): string {
  if (!user) return "Traveler";
  if (user.firstName && user.lastName) return `${user.firstName} ${user.lastName[0]}.`;
  if (user.firstName) return user.firstName;
  if (user.username) return user.username;
  return "Traveler";
}

function parseDateStr(dateStr: string): Date | null {
  // Try DD-MM-YYYY
  const dmy = dateStr.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (dmy) return new Date(parseInt(dmy[3]), parseInt(dmy[2]) - 1, parseInt(dmy[1]));
  // Try YYYY-MM-DD
  const ymd = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (ymd) return new Date(parseInt(ymd[1]), parseInt(ymd[2]) - 1, parseInt(ymd[3]));
  // Try "tomorrow"
  if (dateStr.toLowerCase().includes("tomorrow")) {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d;
  }
  // Try "today"
  if (dateStr.toLowerCase().includes("today")) return new Date();
  // Try "DD Mon YYYY" (e.g. "28 Jul 2026")
  const dmyText = dateStr.match(/^(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{4})$/i);
  if (dmyText) {
    const months: Record<string, number> = {
      jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
      jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
    };
    return new Date(parseInt(dmyText[3]), months[dmyText[2].toLowerCase()], parseInt(dmyText[1]));
  }
  return null;
}

/* ─── Welcome Content ─────────────────────────────────────── */

function WelcomeContent() {
  const { user, isLoaded } = useUser();
  const displayName = getUserDisplayName(user);

  // Compute stats from localStorage bookings (re-reads on each render)
  const bookings = getStoredRecentBookings();
  const totalTrips = bookings.length;

  // Count upcoming trips (date is in the future)
  const now = new Date();
  const upcomingTrips = bookings.filter((b) => {
    const d = parseDateStr(b.date);
    return d && d >= now;
  }).length;

  // Estimate total fare (avg ~₹1200 per booking)
  const estimatedFare = totalTrips * 1200;

  const stats = {
    trips: totalTrips,
    upcoming: upcomingTrips,
    fare: estimatedFare > 0 ? `₹${estimatedFare.toLocaleString()}` : "—",
  };

  // Recent activity from localStorage bookings
  const recentActivity: Array<{
    id: string;
    title: string;
    detail: string;
    status: string;
    time: string;
  }> = [];

  for (const b of bookings) {
    recentActivity.push({
      id: b.pnr,
      title: `${b.from} → ${b.to}`,
      detail: `${b.date} · ${b.trainName} ${b.trainNumber}`,
      status: b.status === "CONFIRMED" ? "Confirmed" : b.status,
      time: timeAgo(b.timestamp),
    });
  }

  const hasRecentBookings = recentActivity.length > 0;

  return (
    <div className="space-y-8">
      {/* Welcome */}
      <div>
        <div className="flex items-center gap-3 mb-3">
          <div className="w-8 h-8 flex items-center justify-center bg-[var(--fg)]">
            <TrainFront className="h-5 w-5 text-[var(--bg)]" />
          </div>
          <span className="text-[11px] uppercase tracking-[0.15em] text-[var(--muted)]">
            RAILY OS v1.0
          </span>
        </div>
        <h1 className="text-3xl md:text-4xl font-bold uppercase tracking-[0.02em] leading-tight">
          Welcome back,
          <br />
          <span className="text-[var(--railway-red)]">{displayName}</span>
        </h1>
        <p className="text-[15px] text-[var(--muted)] mt-3 max-w-xl">
          Ask me anything about your journey. I can book trains, check PNR
          status, suggest routes, and plan your travel.
        </p>
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          {
            label: "AI Search",
            desc: "Book with natural language",
            icon: Sparkles,
            section: "search" as AppSection,
          },
          {
            label: "Train Explorer",
            desc: "Browse & compare trains",
            icon: Train,
            section: "trains" as AppSection,
          },
          {
            label: "Coach View",
            desc: "Choose your seat",
            icon: Map,
            section: "coach" as AppSection,
          },
          {
            label: "Live Journey",
            desc: "Track in real-time",
            icon: Clock,
            section: "journey" as AppSection,
          },
        ].map((item) => (
          <button
            key={item.label}
            className="border-2 border-[var(--fg)] p-5 text-left hover:bg-[var(--fg)]/[0.02] transition-colors group"
          >
            <div className="w-10 h-10 flex items-center justify-center bg-[var(--fg)] group-hover:bg-[var(--railway-red)] transition-colors mb-4">
              <item.icon className="h-5 w-5 text-[var(--bg)]" />
            </div>
            <div className="text-sm font-bold uppercase tracking-[0.05em]">
              {item.label}
            </div>
            <div className="text-[11px] text-[var(--muted)] mt-1">
              {item.desc}
            </div>
          </button>
        ))}
      </div>

      {/* Recent Activity */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-bold uppercase tracking-[0.1em]">
            Recent Activity
          </h2>
        </div>
        {!hasRecentBookings && isLoaded ? (
          <div className="border-2 border-dashed border-[var(--fg)]/30 p-6 text-center">
            <p className="text-[13px] text-[var(--muted)]">
              No bookings yet — search for a train to get started
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {recentActivity.slice(0, 4).map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between p-4 border border-[var(--fg)]/30 hover:border-[var(--fg)] transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className="w-8 h-8 flex items-center justify-center bg-[var(--fg)]/10">
                    <ArrowRight className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold">{item.title}</div>
                    <div className="text-[11px] text-[var(--muted)]">
                      {item.detail}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-[11px] px-2 py-0.5 border border-[var(--fg)] uppercase tracking-[0.1em]">
                    {item.status}
                  </span>
                  <div className="text-[10px] text-[var(--muted)] mt-1">
                    {item.time}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { value: stats.trips > 0 ? String(stats.trips) : "—", label: "Trips This Year" },
          { value: stats.fare, label: "Total Fare" },
          { value: "—", label: "Avg Rating" },
          { value: stats.upcoming > 0 ? String(stats.upcoming) : "—", label: "Upcoming Trips" },
        ].map((stat) => (
          <div key={stat.label} className="border-2 border-[var(--fg)] p-4">
            <div className="text-2xl font-bold">
              {stat.value === "—" ? (
                <span className="text-[var(--muted)] opacity-50">{stat.value}</span>
              ) : (
                stat.value
              )}
            </div>
            <div className="text-[10px] text-[var(--muted)] uppercase tracking-[0.1em] mt-1">
              {stat.label}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function BookingFlowContent() {
  const { state, resetBooking } = useBooking();

  return (
    <div className="space-y-6">
      {/* Booking flow header when active */}
      {state.step !== "idle" && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              {[
                { step: "idle" as const, label: "Search" },
                { step: "recommendations" as const, label: "Select Train" },
                { step: "coach-view" as const, label: "Choose Seat" },
                { step: "confirmed" as const, label: "Confirm" },
              ].map((item, i) => {
                const isActive = state.step === item.step || 
                  (state.step === "searching" && item.step === "recommendations") ||
                  (state.step === "confirming" && item.step === "confirmed");
                const isDone = 
                  (item.step === "idle" && state.step !== "idle") ||
                  (item.step === "recommendations" && (state.step === "coach-view" || state.step === "confirming" || state.step === "confirmed")) ||
                  (item.step === "coach-view" && (state.step === "confirming" || state.step === "confirmed")) ||
                  (item.step === "confirmed" && state.step === "confirmed");
                return (
                  <div key={item.label} className="flex items-center gap-2">
                    <span
                      className={`text-[10px] px-2 py-1 uppercase tracking-[0.1em] font-bold transition-colors ${
                        isActive
                          ? "bg-[var(--fg)] text-[var(--bg)]"
                          : isDone
                          ? "text-[var(--muted)]"
                          : "text-[var(--muted)]/50"
                      }`}
                    >
                      {isDone ? "✓" : `0${i + 1}`}
                    </span>
                    <span
                      className={`text-[11px] uppercase tracking-[0.1em] ${
                        isActive
                          ? "text-[var(--fg)] font-bold"
                          : isDone
                          ? "text-[var(--muted)]"
                          : "text-[var(--muted)]/50"
                      }`}
                    >
                      {item.label}
                    </span>
                    {i < 3 && <span className="text-[var(--muted)]/30 mx-1">—</span>}
                  </div>
                );
              })}
            </div>
          </div>
          <button
            onClick={resetBooking}
            className="text-[11px] uppercase tracking-[0.1em] text-[var(--muted)] hover:text-[var(--fg)] transition-colors"
          >
            Clear ×
          </button>
        </div>
      )}

      {/* Render the appropriate view based on booking step */}
      <AnimatePresence mode="wait">
        <motion.div
          key={state.step + "-" + (state.selectedTrain?.id || "none")}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
        >
          {state.step === "idle" && <WelcomeContent />}
          {(state.step === "searching" || state.step === "recommendations") && (
            <TrainExplorer />
          )}
          {state.step === "coach-view" && <CoachVisualizer />}
          {state.step === "confirmed" && <BookingConfirmation />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}



function AppLayoutInner({
  defaultSection,
}: {
  defaultSection?: AppSection;
}) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [assistantOpen, setAssistantOpen] = useState(true);
  const [activeSection, setActiveSection] = useState<AppSection>(defaultSection ?? "search");
  const [unreadNotifications] = useState(3);

  useEffect(() => {
    if (!sessionStorage.getItem("app_reloaded")) {
      sessionStorage.setItem("app_reloaded", "true");
      window.location.reload();
    }
  }, []);

  const handleToggleCollapse = useCallback(() => {
    setSidebarCollapsed((prev) => !prev);
  }, []);

  const handleToggleAssistant = useCallback(() => {
    setAssistantOpen((prev) => !prev);
  }, []);

  const { state } = useBooking();

  // Auto-switch to search section when booking starts
  useEffect(() => {
    if (state.step !== "idle" && activeSection !== "search") {
      setActiveSection("search" as AppSection);
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional sync of booking step with section
  }, [state.step]);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[var(--bg)] text-[var(--fg)]">
      {/* Sidebar */}
      <AppSidebar
        activeSection={activeSection}
        onSectionChange={setActiveSection}
        collapsed={sidebarCollapsed}
        onToggleCollapse={handleToggleCollapse}
        unreadNotifications={unreadNotifications}
      />

      {/* Main content area - entrance animation */}
      <motion.div
        className="flex flex-1 flex-col min-w-0"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
      >
        <TopBar
          onToggleAssistant={handleToggleAssistant}
          assistantOpen={assistantOpen}
          unreadNotifications={unreadNotifications}
        />

        <div className="flex flex-1 min-h-0">
          {/* Page content */}
          <main className="flex-1 overflow-y-auto app-scroll">
            <div className="p-6 max-w-5xl mx-auto">
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeSection}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.2, ease: "easeOut" }}
                >
                  {activeSection === "search" ? (
                    <BookingFlowContent />
                  ) : (
                    <>
                      {activeSection === "trains" && <TrainExplorer />}
                      {activeSection === "coach" && <CoachVisualizer />}
                      {activeSection === "journey" && <JourneyTracker />}
                      {activeSection === "bookings" && <BookingHistory />}
                      {activeSection === "pnr" && <PNRManager />}
                      {activeSection === "planner" && <TravelPlanner />}
                      {activeSection === "notifications" && (
                        <NotificationsPanel />
                      )}
                      {activeSection === "settings" && (
                        <div className="space-y-6">
                          <h2 className="text-xl font-bold uppercase tracking-[0.05em]">
                            Settings
                          </h2>
                          <p className="text-[13px] text-[var(--muted)]">
                            Settings panel coming soon.
                          </p>
                        </div>
                      )}
                    </>
                  )}
                </motion.div>
              </AnimatePresence>
            </div>
          </main>

          {/* AI Assistant Panel */}
          <AnimatePresence>
            {assistantOpen && (
              <motion.div
                initial={{ width: 0, opacity: 0 }}
                animate={{ width: 380, opacity: 1 }}
                exit={{ width: 0, opacity: 0 }}
                transition={{ duration: 0.3, ease: "easeInOut" }}
                className="overflow-hidden flex-shrink-0"
              >
                <AIAssistantPanel
                  isOpen={assistantOpen}
                  onClose={() => setAssistantOpen(false)}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}

export default function AppLayout({
  defaultSection = "search",
}: {
  defaultSection?: AppSection;
}) {
  return (
    <BookingProvider>
      <AppLayoutInner defaultSection={defaultSection} />
    </BookingProvider>
  );
}
