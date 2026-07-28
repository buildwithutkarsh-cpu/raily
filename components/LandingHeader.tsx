"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@clerk/nextjs";
import { TrainFront, Menu, X } from "lucide-react";

export default function LandingHeader() {
  const { isLoaded, isSignedIn } = useAuth();
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-[200] transition-all duration-300 ${
        scrolled
          ? "bg-[var(--bg)]/95 backdrop-blur-sm border-b-2 border-[var(--fg)]"
          : "bg-transparent"
      }`}
    >
      <div className="max-w-7xl mx-auto px-6 h-[60px] flex items-center justify-between">
        {/* Brand */}
        <Link href="/" className="flex items-center gap-3 group">
          <div className="w-8 h-8 flex items-center justify-center bg-[var(--fg)] group-hover:bg-[var(--railway-red)] transition-colors duration-200">
            <TrainFront className="h-4 w-4 text-[var(--bg)]" />
          </div>
          <span className="font-bold text-sm tracking-[0.15em] uppercase">
            RAILY
          </span>
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden md:flex items-center gap-8">
          <a
            href="#features"
            className="text-[11px] uppercase tracking-[0.15em] text-[var(--muted)] hover:text-[var(--fg)] transition-colors"
          >
            Features
          </a>
          <a
            href="#how-it-works"
            className="text-[11px] uppercase tracking-[0.15em] text-[var(--muted)] hover:text-[var(--fg)] transition-colors"
          >
            How It Works
          </a>
          <a
            href="#stats"
            className="text-[11px] uppercase tracking-[0.15em] text-[var(--muted)] hover:text-[var(--fg)] transition-colors"
          >
            Stats
          </a>
        </nav>

        {/* Auth Buttons */}
        <div className="hidden md:flex items-center gap-3">
          {isLoaded && isSignedIn ? (
            <Link
              href="/app"
              className="flex items-center gap-2 px-5 py-2.5 bg-[var(--fg)] text-[var(--bg)] text-[11px] uppercase tracking-[0.1em] font-semibold hover:bg-[var(--railway-red)] transition-colors duration-150"
            >
              Open App →
            </Link>
          ) : (
            <>
              <Link
                href="/sign-in"
                className="flex items-center gap-2 px-4 py-2 border-2 border-[var(--fg)] text-[11px] uppercase tracking-[0.1em] font-semibold hover:bg-[var(--fg)] hover:text-[var(--bg)] transition-colors duration-150"
              >
                Sign In
              </Link>
              <Link
                href="/sign-up"
                className="flex items-center gap-2 px-5 py-2.5 bg-[var(--fg)] text-[var(--bg)] text-[11px] uppercase tracking-[0.1em] font-semibold hover:bg-[var(--railway-red)] transition-colors duration-150"
              >
                Get Started
              </Link>
            </>
          )}
        </div>

        {/* Mobile Menu Toggle */}
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="md:hidden w-10 h-10 flex items-center justify-center"
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Mobile Menu */}
      {mobileOpen && (
        <div className="md:hidden bg-[var(--bg)] border-b-2 border-[var(--fg)] px-6 py-4 space-y-4">
          <a
            href="#features"
            onClick={() => setMobileOpen(false)}
            className="block text-[12px] uppercase tracking-[0.1em] text-[var(--fg)] py-2"
          >
            Features
          </a>
          <a
            href="#how-it-works"
            onClick={() => setMobileOpen(false)}
            className="block text-[12px] uppercase tracking-[0.1em] text-[var(--fg)] py-2"
          >
            How It Works
          </a>
          <a
            href="#stats"
            onClick={() => setMobileOpen(false)}
            className="block text-[12px] uppercase tracking-[0.1em] text-[var(--fg)] py-2"
          >
            Stats
          </a>
          <div className="flex flex-col gap-3 pt-2 border-t-2 border-[var(--fg)]/20">
            {isLoaded && isSignedIn ? (
              <Link
                href="/app"
                className="flex items-center justify-center gap-2 px-5 py-3 bg-[var(--fg)] text-[var(--bg)] text-[11px] uppercase tracking-[0.1em] font-semibold"
              >
                Open App →
              </Link>
            ) : (
              <>
                <Link
                  href="/sign-in"
                  className="flex items-center justify-center gap-2 px-5 py-3 border-2 border-[var(--fg)] text-[11px] uppercase tracking-[0.1em] font-semibold"
                >
                  Sign In
                </Link>
                <Link
                  href="/sign-up"
                  className="flex items-center justify-center gap-2 px-5 py-3 bg-[var(--fg)] text-[var(--bg)] text-[11px] uppercase tracking-[0.1em] font-semibold"
                >
                  Get Started Free
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
