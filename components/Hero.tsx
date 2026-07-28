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
 * Uses GSAP ScrollTrigger for smooth, scrub-based animation.
 *
 * PHASE 0 (initial):    RAILY centered, calm
 * PHASE 1 (0→15%):      Letters separate mechanically
 * PHASE 2 (15→35%):     INDIA reveals from behind via clip-path
 * PHASE 3 (35→55%):     Split continues, INDIA exits downward
 * PHASE 4 (55→75%):     Terminal appears inside the opening
 * PHASE 5 (75→100%):    Terminal expands, ENTER RAILY appears
 * ═══════════════════════════════════════════════════════════════
 */

export default function Hero({
  onEnter,
}: {
  onEnter?: () => void;
}) {
  const [isTransitioning, setIsTransitioning] = useState(false);
  const isMorphingRef = useRef(false);
  const typingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  /* ── Refs ────────────────────────────────────────────────── */
  const sectionRef = useRef<HTMLDivElement>(null);
  const pinRef = useRef<HTMLDivElement>(null);
  const wordRef = useRef<HTMLDivElement>(null);
  const raRef = useRef<HTMLSpanElement>(null);
  const ilyRef = useRef<HTMLSpanElement>(null);
  const indiaRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<HTMLDivElement>(null);
  const terminalContentRef = useRef<HTMLDivElement>(null);
  const enterButtonRef = useRef<HTMLDivElement>(null);
  const statusRef = useRef<HTMLDivElement>(null);
  const sideRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const lineTopRef = useRef<HTMLDivElement>(null);
  const lineBottomRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);

  /* ── Transition to App — Morph ────────────────────────────── */
  const handleEnterRaily = () => {
    isMorphingRef.current = true;
    setIsTransitioning(true);

    // Stop typing effect immediately
    if (typingIntervalRef.current) {
      clearInterval(typingIntervalRef.current);
      typingIntervalRef.current = null;
    }

    // Kill all GSAP animations on these elements
    if (terminalRef.current) gsap.killTweensOf(terminalRef.current);
    if (terminalContentRef.current) gsap.killTweensOf(terminalContentRef.current);
    if (enterButtonRef.current) gsap.killTweensOf(enterButtonRef.current);
    if (wordRef.current) gsap.killTweensOf(wordRef.current);

    // Morph terminal: background transitions from black to off-white
    gsap.to(terminalRef.current, {
      background: "var(--bg)",
      duration: 0.5,
      ease: "power2.out",
    });

    // Fade out terminal content
    gsap.to(terminalContentRef.current, {
      opacity: 0,
      duration: 0.25,
      ease: "power2.out",
    });

    // Fade out ENTER RAILY button
    gsap.to(enterButtonRef.current, {
      opacity: 0,
      y: 20,
      duration: 0.2,
      ease: "power2.out",
    });

    // Fade out RAILY text
    gsap.to(wordRef.current, {
      opacity: 0,
      duration: 0.4,
      ease: "power2.out",
    });

    // Notify parent immediately — morph animation runs independently
    setTimeout(() => onEnter?.(), 500);
  };

  /* ── GSAP ScrollTrigger Animation ─────────────────────────── */
  useEffect(() => {
    // Respect reduced motion — skip GSAP scroll animations
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      // Still allow the enter button to show
      if (enterButtonRef.current) {
        enterButtonRef.current.style.opacity = "1";
        enterButtonRef.current.style.transform = "translateY(0)";
      }
      if (terminalRef.current) {
        terminalRef.current.style.clipPath = "circle(150% at 50% 50%)";
      }
      return;
    }

    const section = sectionRef.current;
    const pin = pinRef.current;
    if (!section || !pin) return;

    let typingStarted = false;
    let typingInterval: ReturnType<typeof setInterval> | null = null;

    const startTyping = () => {
      const container = terminalContentRef.current;
      if (!container) return;

      const lines = [
        "> Book me from Delhi to Jaipur tomorrow.",
        "> Budget ₹800.",
        "> Lower berth.",
        "> Fastest train.",
        "> ",
      ];

      let lineIndex = 0;
      let charIndex = 0;

      typingInterval = setInterval(() => {
        typingIntervalRef.current = typingInterval;
        if (lineIndex >= lines.length) {
          if (typingInterval) clearInterval(typingInterval);
          return;
        }

        charIndex++;

        if (charIndex > lines[lineIndex].length) {
          lineIndex++;
          charIndex = 0;
          if (lineIndex >= lines.length) {
            if (typingInterval) clearInterval(typingInterval);
            return;
          }
        }

        let html = "";
        for (let i = 0; i < lineIndex; i++) {
          html += `<div>${lines[i]}</div>`;
        }
        html += `<div>${lines[lineIndex].substring(0, charIndex)}<span class="terminal-cursor"></span></div>`;

        container.innerHTML = html;
      }, 38);
    };

    const ctx = gsap.context(() => {
      // ── Set initial states ──
      gsap.set(indiaRef.current, {
        clipPath: "inset(0 50% 0 50%)",
      });
      gsap.set(terminalRef.current, {
        clipPath: "circle(0% at 50% 50%)",
      });
      gsap.set(terminalContentRef.current, { opacity: 0 });
      gsap.set(enterButtonRef.current, { opacity: 0, y: 30 });

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

          // ── Phase 2: INDIA clip-path reveal (0.15 → 0.35) ──
          const revealProgress = gsap.utils.clamp(0, 1, (p - 0.15) / 0.2);
          const clipInset = (1 - revealProgress) * 50;
          if (indiaRef.current) {
            indiaRef.current.style.clipPath = `inset(0 ${clipInset}% 0 ${clipInset}%)`;
          }

          // ── Phase 4→5: Terminal circle clip-path (0.55 → 1.0) ──
          const phase4p = gsap.utils.clamp(0, 1, (p - 0.55) / 0.2);
          const phase5p = gsap.utils.clamp(0, 1, (p - 0.75) / 0.25);
          let circleSize = 0;
          if (phase5p > 0) {
            circleSize = 80 + phase5p * 70;
          } else if (phase4p > 0) {
            circleSize = phase4p * 80;
          }
          if (terminalRef.current) {
            terminalRef.current.style.clipPath = `circle(${circleSize}% at 50% 50%)`;
          }

          // ── Terminal content fade ──
          if (terminalContentRef.current) {
            terminalContentRef.current.style.opacity = `${Math.max(phase4p, phase5p)}`;
          }

          // ── ENTER RAILY button (appears at 85%) ──
          if (enterButtonRef.current && p > 0.85) {
            const btnReveal = Math.min((p - 0.85) / 0.15, 1);
            enterButtonRef.current.style.opacity = `${btnReveal}`;
            enterButtonRef.current.style.transform = `translateY(${(1 - btnReveal) * 30}px)`;
          }

          // ── Trigger typing at 70% ──
          if (p > 0.7 && !typingStarted) {
            typingStarted = true;
            startTyping();
          }
        },
      });

      // ═══ PHASE 1: Letter Separation (0 → 0.15) ═══
      tl.to(raRef.current, { x: "-22vw", ease: "power1.out" }, 0);
      tl.to(ilyRef.current, { x: "22vw", ease: "power1.out" }, 0);
      tl.to(wordRef.current, { scale: 1.03, ease: "power1.out" }, 0);
      tl.to(
        [statusRef.current, scrollRef.current, lineTopRef.current, lineBottomRef.current],
        { opacity: 0, ease: "power1.out" },
        0
      );
      // RA turns red halfway through phase 1
      tl.to(raRef.current, { color: "#C41E3A", ease: "none" }, 0.075);

      // ═══ PHASE 2: INDIA Reveal (0.15 → 0.35) ═══
      // INDIA color transition (clip-path handled in onUpdate)
      tl.to(
        indiaRef.current,
        { color: "#C41E3A", ease: "none", duration: 0.2 },
        0.15
      );

      // ═══ PHASE 3: Extra Split + INDIA Exit (0.35 → 0.55) ═══
      tl.to(raRef.current, { x: "-37vw", ease: "power1.inOut" }, 0.35);
      tl.to(ilyRef.current, { x: "37vw", ease: "power1.inOut" }, 0.35);
      tl.to(indiaRef.current, { y: "80vh", opacity: 0, ease: "power2.in" }, 0.35);
      tl.to(sideRef.current, { opacity: 0, ease: "power1.out" }, 0.35);

      // ═══ PHASE 4: Terminal Appears (0.55 → 0.75) ═══
      // clip-path + opacity handled in onUpdate for granular control

      // ═══ PHASE 5: Hide Word + Button Reveal (0.75 → 1.0) ═══
      tl.to(wordRef.current, { opacity: 0, ease: "power1.out" }, 0.75);
    }, pin);

    return () => {
      ctx.revert();
      if (typingInterval) clearInterval(typingInterval);
    };
  }, []);

  /* ── Mouse Perspective ────────────────────────────────────── */
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!pinRef.current || isTransitioning || isMorphingRef.current) return;
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

        {/* ── Terminal — grows to fill viewport ── */}
        <div ref={terminalRef} className="terminal-overlay">
          <div ref={terminalContentRef} className="terminal-content">
            {/* Populated by typing effect */}
          </div>

          {/* ── ENTER RAILY Button ── */}
          <div
            ref={enterButtonRef}
            className="absolute bottom-[15vh] left-1/2 -translate-x-1/2 opacity-0"
          >
            <button
              onClick={handleEnterRaily}
              disabled={isTransitioning}
              className="btn-enter group"
            >
              <span className="flex items-center gap-3">
                {isTransitioning ? "INITIALIZING…" : "ENTER RAILY"}
                <ArrowRight
                  className={`h-5 w-5 transition-transform duration-300 ${
                    isTransitioning ? "translate-x-1" : "group-hover:translate-x-1"
                  }`}
                />
              </span>
            </button>
            <p className="text-center text-[11px] text-[var(--bg)]/60 mt-4 uppercase tracking-[0.2em]">
              AI Operating System for Indian Railways
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
