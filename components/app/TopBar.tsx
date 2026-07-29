"use client";

import { useState } from "react";
import {
  Search,
  Bell,
  Sparkles,
} from "lucide-react";
import UserMenu from "./UserMenu";

interface TopBarProps {
  onToggleAssistant: () => void;
  assistantOpen: boolean;
  unreadNotifications: number;
  onSearch?: (query: string) => void;
}

export default function TopBar({
  onToggleAssistant,
  assistantOpen,
  unreadNotifications,
  onSearch,
}: TopBarProps) {
  const [searchFocused, setSearchFocused] = useState(false);
  const [searchValue, setSearchValue] = useState("");

  const handleSearch = () => {
    const trimmed = searchValue.trim();
    if (!trimmed || !onSearch) return;
    onSearch(trimmed);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSearch();
    }
  };

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
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder='Search trains, PNR, or ask AI... Try "Book Delhi to Jaipur tomorrow"'
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
            className="flex-1 bg-transparent py-2.5 text-[13px] outline-none placeholder:text-[var(--muted)]"
          />
          <button
            onClick={handleSearch}
            disabled={!searchValue.trim()}
            className="px-4 py-2 text-[11px] uppercase tracking-[0.1em] font-semibold bg-[var(--fg)] text-[var(--bg)] hover:bg-[var(--railway-red)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors flex items-center gap-1.5"
          >
            <Search className="h-3.5 w-3.5" />
            Search
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
        <button
          className="relative w-10 h-10 flex items-center justify-center border-2 border-[var(--fg)] hover:bg-[var(--fg)]/5 transition-colors"
          aria-label={`Notifications (${unreadNotifications} unread)`}
        >
          <Bell className="h-4 w-4" />
          {unreadNotifications > 0 && (
            <span className="absolute -top-1 -right-1 w-4.5 h-4.5 flex items-center justify-center bg-[var(--railway-red)] text-[var(--bg)] text-[9px] font-bold">
              {unreadNotifications}
            </span>
          )}
        </button>

        {/* User Menu — uses Clerk auth */}
        <UserMenu />
      </div>
    </header>
  );
}
