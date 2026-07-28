"use client";

import { useRouter } from "next/navigation";
import LandingHeader from "@/components/LandingHeader";
import LandingSections from "@/components/LandingSections";
import Hero from "@/components/Hero";

export default function Home() {
  const router = useRouter();

  const handleEnterApp = () => {
    router.push("/app");
  };

  return (
    <>
      {/* Grid overlay */}
      <div className="grid-overlay" />

      {/* Landing Header */}
      <LandingHeader />

      {/* Hero Section — cinematic scroll experience */}
      <Hero onEnter={handleEnterApp} />

      {/* Landing Sections — features, how it works, stats, etc. */}
      <div className="relative z-10 bg-[var(--bg)] border-t-2 border-[var(--fg)]">
        <LandingSections />
      </div>
    </>
  );
}
