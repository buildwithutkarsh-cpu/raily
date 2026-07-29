"use client";

import { useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { TrainFront, ArrowRight } from "lucide-react";
import { useEffect, useState } from "react";

export default function Home() {
  const router = useRouter();
  const { isLoaded, isSignedIn } = useAuth();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleEnter = () => {
    router.push("/app");
  };

  return (
    <>
      <div className="fixed inset-0 pointer-events-none z-0">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              "radial-gradient(#000 0.8px, transparent 0.8px)",
            backgroundSize: "4px 4px",
            opacity: 0.025,
          }}
        />
      </div>

      <main className="relative z-10 flex flex-col min-h-screen">
        {/* ── Minimal header ── */}
        <header className="h-14 border-b border-[var(--border)] flex items-center justify-between px-6">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 flex items-center justify-center bg-[var(--fg)]">
              <TrainFront className="h-3.5 w-3.5 text-[var(--bg)]" />
            </div>
            <span className="font-semibold text-sm tracking-[0.1em] uppercase">
              RAILY
            </span>
          </div>

          <nav className="hidden md:flex items-center gap-6">
            <a href="#features" className="text-xs text-[var(--muted)] hover:text-[var(--fg)] transition-colors">
              Features
            </a>
            <a href="#faq" className="text-xs text-[var(--muted)] hover:text-[var(--fg)] transition-colors">
              FAQ
            </a>
          </nav>

          <div className="flex items-center gap-2.5">
            {isLoaded && isSignedIn ? (
              <button
                onClick={handleEnter}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--fg)] text-[var(--bg)] text-xs font-medium hover:bg-[var(--railway-red)] transition-colors"
              >
                Open App
                <ArrowRight className="h-3 w-3" />
              </button>
            ) : (
              <>
                <a
                  href="/sign-in"
                  className="px-3 py-1.5 text-xs text-[var(--muted)] hover:text-[var(--fg)] transition-colors"
                >
                  Sign In
                </a>
                <a
                  href="/sign-up"
                  className="px-3 py-1.5 bg-[var(--fg)] text-[var(--bg)] text-xs font-medium hover:bg-[var(--railway-red)] transition-colors"
                >
                  Get Started
                </a>
              </>
            )}
          </div>
        </header>

        {/* ── Centered hero ── */}
        <section className="flex-1 flex flex-col items-center justify-center px-6 py-20">
          <div className="max-w-[600px] text-center space-y-10">
            {/* Brand mark */}
            <div className="space-y-4">
              <div className="flex items-center justify-center gap-3">
                <div className="w-10 h-10 flex items-center justify-center bg-[var(--fg)]">
                  <TrainFront className="h-5 w-5 text-[var(--bg)]" />
                </div>
              </div>

              <h1
                className={`text-5xl md:text-6xl font-semibold tracking-tight leading-[1.05] ${
                  mounted ? "animate-[fade-in_0.6s_ease]" : "opacity-0"
                }`}
              >
                RAILY
              </h1>

              <p
                className={`text-lg text-[var(--muted)] leading-relaxed max-w-md mx-auto ${
                  mounted ? "animate-[fade-in_0.6s_ease_0.15s_both]" : "opacity-0"
                }`}
              >
                An AI operating system for Indian Railways.
                <br />
                Just type where you want to go.
              </p>
            </div>

            {/* Sample prompt */}
            <div
              className={`flex items-center justify-center gap-2 px-4 py-3 border border-[var(--border)] ${
                mounted ? "animate-[fade-in_0.6s_ease_0.3s_both]" : "opacity-0"
              }`}
            >
              <span className="text-xs text-[var(--muted)]">
                "Book Delhi to Jaipur tomorrow morning"
              </span>
              <span className="w-2 h-4 bg-[var(--fg)] animate-[cursor-blink_1s_step-end_infinite]" />
            </div>

            {/* CTA */}
            <div
              className={`flex flex-col sm:flex-row items-center justify-center gap-3 ${
                mounted ? "animate-[fade-in_0.6s_ease_0.45s_both]" : "opacity-0"
              }`}
            >
              {isLoaded && isSignedIn ? (
                <button
                  onClick={handleEnter}
                  className="px-6 py-3 bg-[var(--fg)] text-[var(--bg)] text-sm font-medium hover:bg-[var(--railway-red)] transition-colors"
                >
                  Open RAILY
                </button>
              ) : (
                <>
                  <a
                    href="/sign-up"
                    className="px-6 py-3 bg-[var(--fg)] text-[var(--bg)] text-sm font-medium hover:bg-[var(--railway-red)] transition-colors"
                  >
                    Start Booking Free
                  </a>
                  <a
                    href="/sign-in"
                    className="px-6 py-3 border border-[var(--border)] text-sm text-[var(--muted)] hover:text-[var(--fg)] hover:border-[var(--fg)] transition-colors"
                  >
                    Sign In
                  </a>
                </>
              )}
            </div>
          </div>
        </section>

        {/* ── Features strip ── */}
        <section id="features" className="border-t border-[var(--border)] px-6 py-16">
          <div className="max-w-[900px] mx-auto">
            <p className="text-[10px] uppercase tracking-[0.15em] text-[var(--muted)] mb-6 font-mono">
              Capabilities
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-[var(--border)]">
              {[
                {
                  title: "Natural Language Search",
                  desc: "Just tell the AI where you want to go. It finds the best trains, seats, and prices.",
                },
                {
                  title: "Visual Coach Selection",
                  desc: "See the exact layout of your coach. Pick your seat with a single click.",
                },
                {
                  title: "Live Journey Tracking",
                  desc: "Real-time train tracking with delay predictions and platform information.",
                },
              ].map((feature) => (
                <div
                  key={feature.title}
                  className="bg-[var(--bg)] p-6"
                >
                  <h3 className="text-sm font-medium mb-2">{feature.title}</h3>
                  <p className="text-[13px] text-[var(--muted)] leading-relaxed">
                    {feature.desc}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── FAQ strip ── */}
        <section id="faq" className="border-t border-[var(--border)] px-6 py-16">
          <div className="max-w-[600px] mx-auto">
            <p className="text-[10px] uppercase tracking-[0.15em] text-[var(--muted)] mb-6 font-mono">
              FAQ
            </p>
            <div className="space-y-4">
              {[
                {
                  q: "How does RAILY work?",
                  a: "You type your request naturally — like 'Book Delhi to Jaipur tomorrow' — and the AI handles everything. Search, recommendations, seat selection, and booking all happen in one conversation.",
                },
                {
                  q: "Is it free?",
                  a: "Yes. Basic features including train search, PNR status, and journey tracking are free. No credit card required.",
                },
                {
                  q: "Which trains are supported?",
                  a: "All Indian Railways trains — from Vande Bharat to local passenger trains. If it runs on Indian tracks, RAILY can find it.",
                },
              ].map((item) => (
                <div key={item.q} className="border-b border-[var(--border)] pb-4">
                  <p className="text-sm font-medium mb-1.5">{item.q}</p>
                  <p className="text-[13px] text-[var(--muted)] leading-relaxed">
                    {item.a}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Footer ── */}
        <footer className="border-t border-[var(--border)] px-6 py-6">
          <div className="max-w-[900px] mx-auto flex items-center justify-between">
            <p className="text-[10px] text-[var(--muted)] font-mono uppercase tracking-[0.1em]">
              © 2026 RAILY
            </p>
            <div className="flex items-center gap-4">
              <span className="text-[10px] text-[var(--muted)] font-mono">
                AI Operating System for Indian Railways
              </span>
            </div>
          </div>
        </footer>
      </main>
    </>
  );
}