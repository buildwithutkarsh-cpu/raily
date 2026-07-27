"use client";

import { useState, useCallback } from "react";
import { useAuth } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import Hero from "@/components/Hero";
import AppLayout from "@/components/app/AppLayout";

type Phase = "landing" | "morphing" | "app";

export default function Home() {
  const [phase, setPhase] = useState<Phase>("landing");
  const [appMounted, setAppMounted] = useState(false);
  const { isLoaded, isSignedIn } = useAuth();
  const router = useRouter();

  const handleEnterRaily = useCallback(() => {
    // If auth is loaded and user is signed in, go directly to /app
    if (isLoaded && isSignedIn) {
      router.push("/app");
      return;
    }

    // If auth is still loading or user is not signed in, show the morph animation
    // then redirect to sign-in
    if (isLoaded && !isSignedIn) {
      setPhase("morphing");
      setAppMounted(true);

      setTimeout(() => {
        router.push("/sign-in");
      }, 800);
      return;
    }

    // Auth still loading — show the app directly
    setPhase("morphing");
    setAppMounted(true);

    setTimeout(() => {
      setPhase("app");
      window.history.replaceState(null, "", "/app");
    }, 800);
  }, [isLoaded, isSignedIn, router]);

  return (
    <>
      {/* Grid overlay — visible through landing and morph phases */}
      {phase !== "app" && <div className="grid-overlay" />}

      {/* Cinematic Hero */}
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

      {/* App Layout — mounts during morph phase */}
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
