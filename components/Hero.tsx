"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowRight } from "lucide-react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

/**
 * ═══════════════════════════════════════════════════════════════
 * RAILY — Cinematic Scroll Experience (GSAP Powered)
 * ═══════════════════════════════════════════════════════════════
 *
 * 300vh pinned viewport. Camera never moves. World transforms.
 *
 * PHASE 0 (initial):    RAILY centered, calm
 * PHASE 1 (0→20%):      Letters separate mechanically
 * PHASE 2 (20→45%):     INDIA reveals from behind via clip-path
 * PHASE 3 (45→65%):     Split continues, INDIA exits downward
 * PHASE 4 (65→85%):     RAILY scales up — full-screen brand takeover
 * PHASE 5 (85→100%):    Fade out, scroll triggers content below
 * ═══════════════════════════════════════════════════════════════
 */

export default function Hero({
  onEnter,
}: {
  onEnter?: () => void;
}) {
  const [isTransitioning, setIsTransitioning] = useState(false);

  /* ── Refs ────────────────────────────────────────────────── */
  const sectionRef = useRef<HTMLDivElement>(null);
  const pinRef = useRef<HTMLDivElement>(null);
  const wordRef = useRef<HTMLDivElement>(null);
  const raRef = useRef<HTMLSpanElement>(null);
  const ilyRef = useRef<HTMLSpanElement>(null);
  const indiaRef = useRef<HTMLDivElement>(null);
  const statusRef = useRef<HTMLDivElement>(null);
  const sideRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const lineTopRef = useRef<HTMLDivElement>(null);
  const lineBottomRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const ctaRef = useRef<HTMLDivElement>(null);

  /* ── Transition to App ───────────────────────────────────── */
  const handleEnterRaily = () => {
    setIsTransitioning(true);
    setTimeout(() => onEnter?.(), 400);
  };

  /* ── GSAP ScrollTrigger Animation ─────────────────────────── */
  useEffect(() => {
    // Respect reduced motion — skip GSAP scroll animations
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      if (ctaRef.current) {
        ctaRef.current.style.opacity = "1";
        ctaRef.current.style.transform = "translateY(0) scale(1)";
      }
      return;
    }

    const section = sectionRef.current;
    const pin = pinRef.current;
    if (!section || !pin) return;

    const ctx = gsap.context(() => {
      // ── Set initial states ──
      gsap.set(indiaRef.current, {
        clipPath: "inset(0 50% 0 50%)",
      });
      gsap.set(ctaRef.current, { opacity: 0, y: 40, scale: 0.9 });

      // ── Create the master timeline ──
      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: section,
          start: "top top",
          end: "+=200%",
          scrub: 1.2,
          pin: true,
          anticipatePin: 1,
          invalidateOnRefresh: true,
        },
        onUpdate: function () {
          const p = this.progress();

          // ── Phase 2: INDIA clip-path reveal (0.20 → 0.45) ──
          const revealProgress = gsap.utils.clamp(0, 1, (p - 0.2) / 0.25);
          const clipInset = (1 - revealProgress) * 50;
          if (indiaRef.current) {
            indiaRef.current.style.clipPath = `inset(0 ${clipInset}% 0 ${clipInset}%)`;
          }

          // ── Phase 4→5: RAILY Scale Up (0.65 → 1.0) ──
          const scaleProgress = gsap.utils.clamp(0, 1, (p - 0.65) / 0.35);
          if (wordRef.current) {
            const scale = scaleProgress * 5 + 1;
            wordRef.current.style.transform = `scale(${scale})`;
            wordRef.current.style.opacity = `${1 - scaleProgress * 0.3}`;
          }

          // ── CTA button at 80%+ ──
          if (ctaRef.current && p > 0.8) {
            const btnReveal = Math.min((p - 0.8) / 0.2, 1);
            ctaRef.current.style.opacity = `${btnReveal}`;
            ctaRef.current.style.transform = `translateY(${(1 - btnReveal) * 40}px) scale(${0.9 + btnReveal * 0.1})`;
          }
        },
      });

      // ═══ PHASE 1: Letter Separation (0 → 0.20) ═══
      tl.to(raRef.current, { x: "-22vw", ease: "power1.out" }, 0);
      tl.to(ilyRef.current, { x: "22vw", ease: "power1.out" }, 0);
      tl.to(wordRef.current, { scale: 1.03, ease: "power1.out" }, 0);
      tl.to(
        [statusRef.current, scrollRef.current, lineTopRef.current, lineBottomRef.current],
        { opacity: 0, ease: "power1.out" },
        0
      );
      // RA turns red halfway through phase 1
      tl.to(raRef.current, { color: "#C41E3A", ease: "none" }, 0.1);

      // ═══ PHASE 2: INDIA Reveal (0.20 → 0.45) ═══
      tl.to(
        indiaRef.current,
        { color: "#C41E3A", ease: "none", duration: 0.25 },
        0.2
      );

      // ═══ PHASE 3: Extra Split + INDIA Exit (0.45 → 0.65) ═══
      tl.to(raRef.current, { x: "-37vw", ease: "power1.inOut" }, 0.45);
      tl.to(ilyRef.current, { x: "37vw", ease: "power1.inOut" }, 0.45);
      tl.to(indiaRef.current, { y: "80vh", opacity: 0, ease: "power2.in" }, 0.45);
      tl.to(sideRef.current, { opacity: 0, ease: "power1.out" }, 0.45);

      // ═══ PHASE 4: RAILY Scales Up (0.65 → 1.0) ═══
      // scale + opacity handled in onUpdate

    }, pin);

    return () => {
      ctx.revert();
    };
  }, []);

  /* ── Mouse Perspective ────────────────────────────────────── */
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!pinRef.current || isTransitioning) return;
      const x = (e.clientX / window.innerWidth - 0.5) * 2.5;
      const y = (e.clientY / window.innerHeight - 0.5) * 2.5;
      gsap.to(pinRef.current, {
        rotationY: x,
        rotationX: -y,
        duration: 0.8,
        ease: "power2.out",
        transformPerspective: 1200,
        overwrite: "auto",
      });
    };

    window.addEventListener("mousemove", handleMouseMove, { passive: true });
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, [isTransitioning]);

  /* ── Render ───────────────────────────────────────────────── */
  return (
    <section
      ref={sectionRef}
      className={`cinematic ${isTransitioning ? "opacity-0 transition-opacity duration-500" : ""}`}
    >
      <div ref={pinRef} className="cinematic-pin">
        {/* ── Status text — top left ── */}
        <div ref={statusRef} className="cinematic-status">
          SYSTEM ONLINE ●
        </div>

        {/* ── Side text — rotated left ── */}
        <div ref={sideRef} className="cinematic-side">
          AI OPERATING SYSTEM FOR INDIAN RAILWAYS
        </div>

        {/* ── Horizontal divider lines ── */}
        <div ref={lineTopRef} className="cinematic-line top" />
        <div ref={lineBottomRef} className="cinematic-line bottom" />

        {/* ── Scroll indicator — bottom right ── */}
        <div ref={scrollRef} className="cinematic-scroll">
          SCROLL ↓
        </div>

        {/* ── RAILY — split into RA and ILY ── */}
        <div ref={wordRef} className="cinematic-word">
          <span ref={raRef} className="cinematic-letter-group">
            RA
          </span>
          <span ref={ilyRef} className="cinematic-letter-group">
            ILY
          </span>
        </div>

        {/* ── INDIA — revealed behind the opening ── */}
        <div ref={indiaRef} className="cinematic-india">
          INDIA
        </div>

        {/* ── Decorative train track line ── */}
        <div
          ref={trackRef}
          className="absolute bottom-[40px] left-0 right-0 h-[2px] z-[4] overflow-hidden"
        >
          <div className="absolute inset-0 bg-[var(--fg)]/10" />
          <div className="absolute top-0 left-0 h-full w-20 bg-gradient-to-r from-transparent via-[var(--railway-red)] to-transparent animate-[train-track_2s_linear_infinite]" />
        </div>

        {/* ── ENTER RAILY Overlay — appears at end of scroll ── */}
        <div
          ref={ctaRef}
          className="absolute inset-0 z-[50] flex flex-col items-center justify-center opacity-0 pointer-events-none"
        >
          <div className="pointer-events-auto flex flex-col items-center gap-8">
            <button
              onClick={handleEnterRaily}
              disabled={isTransitioning}
              className="group inline-flex items-center justify-center gap-3 px-12 py-5 text-base font-bold font-mono text-[var(--bg)] bg-[var(--railway-red)] border-2 border-[var(--railway-red)] uppercase tracking-[0.15em] transition-all duration-200 relative overflow-hidden hover:bg-[var(--fg)] hover:border-[var(--fg)] before:absolute before:inset-0 before:bg-[var(--fg)] before:scale-x-0 before:origin-right hover:before:scale-x-100 hover:before:origin-left before:transition-transform before:duration-300"
            >
              <span className="relative z-[1] flex items-center gap-3">
                {isTransitioning ? "INITIALIZING…" : "ENTER RAILY"}
                <ArrowRight
                  className={`h-5 w-5 transition-transform duration-300 ${
                    isTransitioning ? "translate-x-1" : "group-hover:translate-x-1"
                  }`}
                />
              </span>
            </button>
            <p className="text-center text-[11px] text-[var(--bg)]/60 mt-2 uppercase tracking-[0.2em]">
              AI Operating System for Indian Railways
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
