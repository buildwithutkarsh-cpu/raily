"use client";

import { useCallback } from "react";
import { useUser } from "@clerk/nextjs";
import { TrainFront } from "lucide-react";
import AIAssistantPanel from "@/features/chat/components/ChatPanel";
import { BookingProvider } from "@/lib/booking-store";

/* ─── Minimal Top Bar ─────────────────────────────────────── */

function TopBar() {
  const { user, isLoaded } = useUser();

  const displayName =
    user?.firstName || user?.username || (isLoaded ? "Traveler" : "...");

  return (
    <header className="h-14 border-b border-[var(--border)] bg-[var(--bg)] flex items-center justify-between px-6 flex-shrink-0">
      {/* Brand */}
      <div className="flex items-center gap-2.5">
        <div className="w-7 h-7 flex items-center justify-center bg-[var(--fg)]">
          <TrainFront className="h-3.5 w-3.5 text-[var(--bg)]" />
        </div>
        <span className="font-sans font-semibold text-sm tracking-[0.1em] uppercase">
          RAILY
        </span>
      </div>

      {/* Profile */}
      <div className="flex items-center gap-2.5">
        <span className="text-xs text-[var(--muted)]">{displayName}</span>
        <div className="w-7 h-7 flex items-center justify-center bg-[var(--fg)] text-[var(--bg)] text-[10px] font-semibold">
          {displayName.charAt(0).toUpperCase()}
        </div>
      </div>
    </header>
  );
}

/* ─── App Layout ──────────────────────────────────────────── */

function AppLayoutInner() {
  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-[var(--bg)] text-[var(--fg)]">
      {/* Minimal top bar */}
      <TopBar />

      {/* Chat area — centered, max-width constrained */}
      <main className="flex-1 flex flex-col min-h-0">
        <AIAssistantPanel />
      </main>
    </div>
  );
}

export default function AppLayout() {
  return (
    <BookingProvider>
      <AppLayoutInner />
    </BookingProvider>
  );
}
