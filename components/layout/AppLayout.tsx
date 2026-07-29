"use client";

import { useCallback } from "react";
import { useUser, useAuth } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { TrainFront, LogOut } from "lucide-react";
import AIAssistantPanel from "@/features/chat/components/ChatPanel";
import { BookingProvider } from "@/lib/booking-store";

/* ─── Minimal Top Bar ─────────────────────────────────────── */

function TopBar() {
  const { user, isLoaded } = useUser();
  const { signOut } = useAuth();
  const router = useRouter();

  const displayName =
    user?.firstName || user?.username || (isLoaded ? "Traveler" : "...");

  const handleSignOut = async () => {
    await signOut();
    router.push("/");
  };

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

      {/* Profile & Sign Out */}
      <div className="flex items-center gap-2.5">
        <span className="text-xs text-[var(--muted)]">{displayName}</span>
        <div className="w-7 h-7 flex items-center justify-center bg-[var(--fg)] text-[var(--bg)] text-[10px] font-semibold">
          {displayName.charAt(0).toUpperCase()}
        </div>
        <button
          onClick={handleSignOut}
          className="flex items-center gap-1.5 px-2 py-1 text-[11px] text-[var(--muted)] hover:text-[var(--fg)] transition-colors"
          title="Sign out"
        >
          <LogOut className="h-3.5 w-3.5" />
        </button>
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
