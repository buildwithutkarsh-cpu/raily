"use client";

"use client";

import { useAuth } from "@clerk/nextjs";
import { motion } from "framer-motion";
import LandingHeader from "@/components/LandingHeader";
import LandingSections from "@/components/LandingSections";

export default function Home() {
  const { isLoaded, isSignedIn } = useAuth();

  return (
    <>
      {/* Grid overlay */}
      <div className="grid-overlay" />

      {/* Landing Header with Auth */}
      <LandingHeader />

      {/* Landing Content */}
      <div>
        {/* Hero Section */}
        <section className="min-h-screen flex items-center justify-center relative pt-[60px]">
          <HeroContent isLoaded={isLoaded} isSignedIn={isSignedIn ?? false} />
        </section>

        {/* Landing Sections */}
        <LandingSections />
      </div>
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════
   HERO CONTENT — Simplified, non-scroll-based intro
   ═══════════════════════════════════════════════════════════════ */

import {
  ArrowRight,
  Sparkles,
  Train,
  Map,
  Clock,
  Shield,
  Zap,
} from "lucide-react";
import Link from "next/link";

function HeroContent({
  isLoaded,
  isSignedIn,
}: {
  isLoaded: boolean;
  isSignedIn?: boolean;
}) {
  return (
    <div className="w-full min-h-screen flex flex-col items-center justify-center px-6 relative overflow-hidden">
      {/* Background decorative elements */}
      <div className="absolute inset-0 pointer-events-none">
        {/* Horizontal lines */}
        <div className="absolute top-[20%] left-0 right-0 h-px bg-[var(--fg)]/10" />
        <div className="absolute top-[80%] left-0 right-0 h-px bg-[var(--fg)]/10" />
        {/* Vertical lines */}
        <div className="absolute top-0 bottom-0 left-[10%] w-px bg-[var(--fg)]/10" />
        <div className="absolute top-0 bottom-0 right-[10%] w-px bg-[var(--fg)]/10" />
        {/* Corner markers */}
        <div className="absolute top-20 left-8 w-4 h-4 border-l-2 border-t-2 border-[var(--fg)]/30" />
        <div className="absolute top-20 right-8 w-4 h-4 border-r-2 border-t-2 border-[var(--fg)]/30" />
        <div className="absolute bottom-20 left-8 w-4 h-4 border-l-2 border-b-2 border-[var(--fg)]/30" />
        <div className="absolute bottom-20 right-8 w-4 h-4 border-r-2 border-b-2 border-[var(--fg)]/30" />
      </div>

      {/* Status indicator */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.6 }}
        className="absolute top-8 left-8 flex items-center gap-2"
      >
        <div className="w-2 h-2 bg-[var(--railway-red)] animate-pulse" />
        <span className="text-[10px] uppercase tracking-[0.3em] text-[var(--muted)]">
          System Online
        </span>
      </motion.div>

      {/* Side text */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4, duration: 0.6 }}
        className="absolute left-8 top-1/2 -translate-y-1/2 -rotate-90 origin-left hidden lg:block"
      >
        <span className="text-[10px] uppercase tracking-[0.5em] text-[var(--muted)] whitespace-nowrap">
          AI Operating System for Indian Railways
        </span>
      </motion.div>

      {/* Main Content */}
      <div className="text-center relative z-10 max-w-4xl mx-auto">
        {/* RAILY Logo */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="mb-8"
        >
          <div className="inline-flex items-center gap-3 mb-6">
            <div className="w-12 h-12 flex items-center justify-center bg-[var(--fg)]">
              <Train className="h-6 w-6 text-[var(--bg)]" />
            </div>
          </div>
        </motion.div>

        {/* Main Title */}
        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.8, ease: "easeOut" }}
          className="text-5xl md:text-7xl lg:text-8xl font-bold uppercase tracking-[0.02em] leading-[0.9] mb-6"
        >
          <span className="text-[var(--fg)]">RAIL</span>
          <span className="text-[var(--railway-red)]">Y</span>
        </motion.h1>

        {/* Subtitle */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.6 }}
          className="text-[11px] md:text-[13px] uppercase tracking-[0.25em] text-[var(--muted)] mb-10 max-w-lg mx-auto"
        >
          The AI operating system for Indian Railways
        </motion.p>

        {/* Feature Pills */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7, duration: 0.6 }}
          className="flex flex-wrap justify-center gap-3 mb-12"
        >
          {[
            { icon: Sparkles, label: "AI Search" },
            { icon: Train, label: "Live Tracking" },
            { icon: Map, label: "Seat Selection" },
            { icon: Clock, label: "Price Alerts" },
          ].map((item, i) => (
            <motion.div
              key={item.label}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.8 + i * 0.1, duration: 0.4 }}
              className="flex items-center gap-2 px-4 py-2 border border-[var(--fg)]/30 text-[var(--muted)]"
            >
              <item.icon className="h-3.5 w-3.5" />
              <span className="text-[10px] uppercase tracking-[0.1em]">
                {item.label}
              </span>
            </motion.div>
          ))}
        </motion.div>

        {/* Terminal Preview */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1, duration: 0.8 }}
          className="max-w-2xl mx-auto mb-12"
        >
          <div className="border-2 border-[var(--fg)]/30 bg-[var(--fg)]/[0.02] p-6 text-left">
            <div className="flex items-center gap-2 mb-4 pb-3 border-b border-[var(--fg)]/10">
              <div className="w-2.5 h-2.5 rounded-full bg-[var(--fg)]/20" />
              <div className="w-2.5 h-2.5 rounded-full bg-[var(--fg)]/20" />
              <div className="w-2.5 h-2.5 rounded-full bg-[var(--fg)]/20" />
              <span className="ml-2 text-[9px] uppercase tracking-[0.15em] text-[var(--muted)]">
                Terminal
              </span>
            </div>
            <div className="font-mono text-[13px] md:text-sm space-y-2">
              <div className="text-[var(--muted)]">
                <span className="text-[var(--railway-red)]">▸</span> Book me from Delhi to Jaipur tomorrow
              </div>
              <div className="text-[var(--muted)]">
                <span className="text-[var(--railway-red)]">▸</span> Budget ₹800, lower berth
              </div>
              <div className="h-px bg-[var(--fg)]/10 my-2" />
              <div className="text-[var(--fg)]">
                <span className="text-[var(--railway-red)]">✓</span> Found 12 options. Best match: Garib Rath Express
              </div>
              <div className="text-[var(--muted)]">
                <span className="text-[var(--railway-red)]">✓</span> Seat B3-L12 selected. Proceed to booking?
              </div>
            </div>
          </div>
        </motion.div>

        {/* CTA Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.2, duration: 0.6 }}
          className="flex flex-col sm:flex-row items-center justify-center gap-4"
        >
          {isLoaded && isSignedIn ? (
            <Link
              href="/app"
              className="group flex items-center gap-3 px-8 py-4 bg-[var(--fg)] text-[var(--bg)] text-sm font-bold uppercase tracking-[0.1em] hover:bg-[var(--railway-red)] transition-all duration-300"
            >
              Open App
              <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
            </Link>
          ) : (
            <>
              <Link
                href="/sign-up"
                className="group flex items-center gap-3 px-8 py-4 bg-[var(--fg)] text-[var(--bg)] text-sm font-bold uppercase tracking-[0.1em] hover:bg-[var(--railway-red)] transition-all duration-300"
              >
                Get Started Free
                <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
              </Link>
              <Link
                href="/sign-in"
                className="flex items-center gap-3 px-8 py-4 border-2 border-[var(--fg)] text-sm uppercase tracking-[0.1em] hover:bg-[var(--fg)] hover:text-[var(--bg)] transition-all duration-300"
              >
                Sign In
              </Link>
            </>
          )}
        </motion.div>

        {/* Social proof */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.5, duration: 0.6 }}
          className="mt-12 flex items-center justify-center gap-6 text-[var(--muted)]"
        >
          <div className="flex items-center gap-2">
            <Shield className="h-3.5 w-3.5" />
            <span className="text-[10px] uppercase tracking-[0.1em]">
              Secure
            </span>
          </div>
          <div className="w-1 h-1 rounded-full bg-[var(--fg)]/30" />
          <div className="flex items-center gap-2">
            <Zap className="h-3.5 w-3.5" />
            <span className="text-[10px] uppercase tracking-[0.1em]">
              Fast
            </span>
          </div>
          <div className="w-1 h-1 rounded-full bg-[var(--fg)]/30" />
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase tracking-[0.1em]">
              2M+ Bookings
            </span>
          </div>
        </motion.div>
      </div>

      {/* Scroll indicator */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 2, duration: 0.6 }}
        className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2"
      >
        <span className="text-[10px] uppercase tracking-[0.3em] text-[var(--muted)]">
          Scroll to explore
        </span>
        <div className="w-px h-8 bg-gradient-to-b from-[var(--fg)]/50 to-transparent" />
      </motion.div>
    </div>
  );
}
