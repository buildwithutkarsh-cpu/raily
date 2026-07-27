"use client";

import { useState, useCallback } from "react";
import Hero from "@/components/Hero";
import AppLayout from "@/components/app/AppLayout";

type Phase = "landing" | "morphing" | "app";

export default function Home() {
  const [phase, setPhase] = useState<Phase>("landing");
  const [appMounted, setAppMounted] = useState(false);

  const handleEnterRaily = useCallback(() => {
    setPhase("morphing");
    // Mount AppLayout immediately (hidden) so it's ready to animate in
    setAppMounted(true);

    // After the morph animation completes, reveal the app and update URL
    setTimeout(() => {
      setPhase("app");
      // Update URL to /app for direct access on refresh
      window.history.replaceState(null, "", "/app");
    }, 800);
  }, []);

  return (
    <>
      {/* Grid overlay — visible through landing and morph phases */}
      {phase !== "app" && <div className="grid-overlay" />}

      {/* Cinematic Hero — in normal flow so 300vh scroll area works */}
      {/* During landing: normal (scrollable). During morph: fade out but stay in flow */}
      {/* During app: hidden AND collapsed (no 300vh gap) */}
      <div
        className={`transition-all duration-700 ease-in-out ${
          phase === "app"
            ? ""
            : phase === "morphing"
            ? "opacity-0 pointer-events-none"
            : ""
        }`}
        style={
          phase === "app"
            ? { height: 0, overflow: "hidden", visibility: "hidden" }
            : undefined
        }
      >
        <Hero onEnter={handleEnterRaily} />
      </div>

      {/* App Layout — mounts during morph phase, animates in during app phase */}
      {appMounted && (
        <div
          className={`fixed inset-0 z-50 transition-all duration-700 ease-in-out ${
            phase === "app"
              ? "opacity-100 scale-100"
              : "opacity-0 scale-[0.97]"
          }`}
        >
          <AppLayout />
        </div>
      )}
    </>
  );
}
