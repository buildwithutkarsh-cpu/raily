"use client";

import { useState } from "react";
import {
  Search,
  Bell,
  MessageSquare,
  User,
  ChevronDown,
  Sparkles,
  ArrowRight,
} from "lucide-react";

interface TopBarProps {
  onToggleAssistant: () => void;
  assistantOpen: boolean;
  unreadNotifications: number;
}

export default function TopBar({
  onToggleAssistant,
  assistantOpen,
  unreadNotifications,
}: TopBarProps) {
  const [searchFocused, setSearchFocused] = useState(false);

  return (
    <header className="h-[60px] border-b-2 border-[var(--fg)] bg-[var(--bg)] flex items-center px-5 gap-4 flex-shrink-0">
      {/* AI Search Bar */}
      <div className="flex-1 max-w-lg">
        <div
          className={`flex items-center border-2 transition-colors ${
            searchFocused
              ? "border-[var(--fg)]"
              : "border-[var(--fg)]/30 hover:border-[var(--fg)]/70"
          }`}
        >
          <div className="px-3 flex items-center">
            <Search className="h-4 w-4 text-[var(--muted)]" />
          </div>
          <input
            type="text"
            placeholder='Search trains, PNR, or ask AI... Try "Book Delhi to Jaipur tomorrow"'
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
            className="flex-1 bg-transparent py-2.5 text-[13px] outline-none placeholder:text-[var(--muted)]"
          />
          <button className="px-3 py-2 text-[10px] uppercase tracking-[0.1em] text-[var(--muted)] hover:text-[var(--fg)] flex items-center gap-1">
            <kbd className="border border-[var(--fg)]/30 px-1.5 py-0.5 text-[10px]">
              ⌘K
            </kbd>
          </button>
        </div>
      </div>

      <div className="flex-1" />

      {/* Right actions */}
      <div className="flex items-center gap-2">
        {/* AI Assistant toggle */}
        <button
          onClick={onToggleAssistant}
          className={`flex items-center gap-2 px-4 py-2 text-xs uppercase tracking-[0.1em] font-semibold transition-colors ${
            assistantOpen
              ? "bg-[var(--fg)] text-[var(--bg)]"
              : "border-2 border-[var(--fg)] hover:bg-[var(--fg)] hover:text-[var(--bg)]"
          }`}
        >
          <Sparkles className="h-3.5 w-3.5" />
          AI
        </button>

        {/* Notifications */}
        <button className="relative w-10 h-10 flex items-center justify-center border-2 border-[var(--fg)] hover:bg-[var(--fg)]/5 transition-colors">
          <Bell className="h-4 w-4" />
          {unreadNotifications > 0 && (
            <span className="absolute -top-1 -right-1 w-4.5 h-4.5 flex items-center justify-center bg-[var(--railway-red)] text-[var(--bg)] text-[9px] font-bold">
              {unreadNotifications}
            </span>
          )}
        </button>

        {/* Profile */}
        <button className="flex items-center gap-2 px-3 py-2 border-2 border-[var(--fg)] hover:bg-[var(--fg)]/5 transition-colors">
          <div className="w-6 h-6 flex items-center justify-center bg-[var(--fg)]">
            <User className="h-3.5 w-3.5 text-[var(--bg)]" />
          </div>
          <div className="text-left">
            <div className="text-[11px] font-semibold leading-tight">A. Kumar</div>
            <div className="text-[9px] text-[var(--muted)] uppercase tracking-[0.1em]">
              Gold Member
            </div>
          </div>
          <ChevronDown className="h-3 w-3 text-[var(--muted)]" />
        </button>
      </div>
    </header>
  );
}
