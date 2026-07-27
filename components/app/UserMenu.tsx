"use client";

import { useState, useRef, useEffect } from "react";
import { useUser, useClerk } from "@clerk/nextjs";
import {
  User,
  ChevronDown,
  Settings,
  LogOut,
  Sparkles,
  Ticket,
} from "lucide-react";

export default function UserMenu() {
  const { isLoaded, isSignedIn, user } = useUser();
  const { signOut, openUserProfile } = useClerk();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (!isLoaded) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 border-2 border-[var(--fg)]/30">
        <div className="w-6 h-6 bg-[var(--fg)]/10 animate-pulse" />
        <div className="w-20 h-3 bg-[var(--fg)]/10 animate-pulse" />
      </div>
    );
  }

  if (!isSignedIn || !user) {
    return (
      <a
        href="/sign-in"
        className="flex items-center gap-2 px-4 py-2 border-2 border-[var(--fg)] text-xs uppercase tracking-[0.1em] font-semibold hover:bg-[var(--fg)] hover:text-[var(--bg)] transition-colors"
      >
        <User className="h-3.5 w-3.5" />
        Sign In
      </a>
    );
  }

  const initials =
    user.firstName?.charAt(0) || user.emailAddresses?.[0]?.emailAddress?.charAt(0) || "?";

  return (
    <div ref={menuRef} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3 py-2 border-2 border-[var(--fg)] hover:bg-[var(--fg)]/5 transition-colors"
      >
        {/* Avatar */}
        {user.hasImage ? (
          <div className="w-6 h-6 overflow-hidden bg-[var(--fg)]">
            <img
              src={user.imageUrl}
              alt={user.firstName || "User"}
              className="w-full h-full object-cover"
            />
          </div>
        ) : (
          <div className="w-6 h-6 flex items-center justify-center bg-[var(--fg)]">
            <span className="text-[10px] font-bold text-[var(--bg)] uppercase">
              {initials}
            </span>
          </div>
        )}

        <div className="text-left">
          <div className="text-[11px] font-semibold leading-tight text-[var(--fg)]">
            {user.firstName || user.emailAddresses?.[0]?.emailAddress || "User"}
          </div>
          <div className="text-[9px] text-[var(--muted)] uppercase tracking-[0.1em]">
            Gold Member
          </div>
        </div>
        <ChevronDown
          className={`h-3 w-3 text-[var(--muted)] transition-transform duration-200 ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {/* Dropdown menu */}
      {open && (
        <div className="absolute right-0 top-full mt-1 w-56 z-50 border-2 border-[var(--fg)] bg-[var(--bg)] shadow-lg">
          {/* User info header */}
          <div className="px-4 py-3 border-b-2 border-[var(--fg)]">
            <div className="text-sm font-semibold text-[var(--fg)]">
              {user.firstName} {user.lastName}
            </div>
            <div className="text-[11px] text-[var(--muted)] truncate">
              {user.emailAddresses?.[0]?.emailAddress || ""}
            </div>
            <div className="flex items-center gap-1 mt-1">
              <Sparkles className="h-3 w-3 text-[var(--railway-red)]" />
              <span className="text-[9px] text-[var(--railway-red)] uppercase tracking-[0.1em] font-semibold">
                Gold Member
              </span>
            </div>
          </div>

          {/* Menu items */}
          <div className="py-1">
            <button
              onClick={() => {
                setOpen(false);
                openUserProfile();
              }}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-[12px] uppercase tracking-[0.1em] text-[var(--fg)] hover:bg-[var(--fg)] hover:text-[var(--bg)] transition-colors"
            >
              <Settings className="h-3.5 w-3.5" />
              Profile Settings
            </button>

            <a
              href="/app"
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 px-4 py-2.5 text-[12px] uppercase tracking-[0.1em] text-[var(--fg)] hover:bg-[var(--fg)] hover:text-[var(--bg)] transition-colors"
            >
              <Ticket className="h-3.5 w-3.5" />
              My Bookings
            </a>
          </div>

          {/* Sign out */}
          <div className="border-t-2 border-[var(--fg)] py-1">
            <button
              onClick={() => {
                setOpen(false);
                signOut({ redirectUrl: "/" });
              }}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-[12px] uppercase tracking-[0.1em] text-[var(--railway-red)] hover:bg-[var(--railway-red)] hover:text-[var(--bg)] transition-colors"
            >
              <LogOut className="h-3.5 w-3.5" />
              Sign Out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
