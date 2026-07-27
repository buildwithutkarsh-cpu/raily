"use client";

"use client";

import { useEffect, useRef, useState } from "react";

import { ArrowRight } from "lucide-react";

/**
 * ═══════════════════════════════════════════════════════════════
 * RAILY — Cinematic Scroll Experience
 * ═══════════════════════════════════════════════════════════════
 *
 * 300vh pinned viewport. Camera never moves. World transforms.
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
  const [showEnterButton, setShowEnterButton] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const isMorphingRef = useRef(false);
  const typingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  /* ── Refs ────────────────────────────────────────────────── */
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

  /* ── Transition to App — Morph ────────────────────────────── */
  const handleEnterRaily = () => {
    isMorphingRef.current = true;
    setIsTransitioning(true);

    // Stop typing effect immediately
    if (typingIntervalRef.current) {
      clearInterval(typingIntervalRef.current);
      typingIntervalRef.current = null;
    }

    // Morph terminal: background transitions from black to off-white
    if (terminalRef.current) {
      terminalRef.current.style.transition = "background 0.5s ease";
      terminalRef.current.style.background = "var(--bg)";
    }

    // Fade out terminal content
    if (terminalContentRef.current) {
      terminalContentRef.current.style.transition = "opacity 0.25s ease";
      terminalContentRef.current.style.opacity = "0";
    }

    // Fade out ENTER RAILY button
    if (enterButtonRef.current) {
      enterButtonRef.current.style.transition = "opacity 0.2s ease, transform 0.2s ease";
      enterButtonRef.current.style.opacity = "0";
      enterButtonRef.current.style.transform = "translateY(20px)";
    }

    // Fade out RAILY text
    if (wordRef.current) {
      wordRef.current.style.transition = "opacity 0.4s ease";
      wordRef.current.style.opacity = "0";
    }

    // Notify parent immediately — morph animation runs independently
    onEnter?.();
  };

  /* ── Scroll-Driven Animation ──────────────────────────────── */
  useEffect(() => {
    let ticking = false;
    let typingStarted = false;
    let enterButtonShown = false;
    let typingInterval: ReturnType<typeof setInterval> | null = null;

    const handleScroll = () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          // Skip all scroll-driven animations during morph transition
          if (isMorphingRef.current) {
            ticking = false;
            return;
          }

          const scrollY = window.scrollY;
          const vh = window.innerHeight;
          // 300vh section → 200vh scrollable range
          const p = Math.min(Math.max(scrollY / (vh * 2), 0), 1);

          /* ═══ Phase 1: Letter Separation (0 → 0.15) ═══ */
          const sep = Math.min(p / 0.15, 1);

          const raX = -sep * 22;
          const ilyX = sep * 22;
          const zoom = 1 + sep * 0.03;
          const uiFade = 1 - sep;

          if (raRef.current) {
            raRef.current.style.transform = `translateX(${raX}vw)`;
            raRef.current.style.color =
              sep > 0.5 ? "var(--railway-red)" : "var(--fg)";
          }
          if (ilyRef.current) {
            ilyRef.current.style.transform = `translateX(${ilyX}vw)`;
          }
          if (wordRef.current)
            wordRef.current.style.transform = `scale(${zoom})`;
          if (statusRef.current)
            statusRef.current.style.opacity = `${uiFade}`;
          if (scrollRef.current)
            scrollRef.current.style.opacity = `${uiFade}`;
          if (lineTopRef.current)
            lineTopRef.current.style.opacity = `${uiFade}`;
          if (lineBottomRef.current)
            lineBottomRef.current.style.opacity = `${uiFade}`;

          /* ═══ Phase 2: INDIA Reveal (0.15 → 0.35) ═══ */
          const reveal = Math.min(Math.max((p - 0.15) / 0.2, 0), 1);

          if (indiaRef.current) {
            const clipInset = (1 - reveal) * 50;
            indiaRef.current.style.clipPath = `inset(0 ${clipInset}% 0 ${clipInset}%)`;
            indiaRef.current.style.color =
              reveal > 0.5 ? "var(--railway-red)" : "transparent";
          }

          /* ═══ Phase 3: Split Continues + INDIA Exit (0.35 → 0.55) ═══ */
          const phase3 = Math.min(Math.max((p - 0.35) / 0.2, 0), 1);

          const extraSep = phase3 * 15;
          if (raRef.current)
            raRef.current.style.transform = `translateX(${raX - extraSep}vw)`;
          if (ilyRef.current)
            ilyRef.current.style.transform = `translateX(${ilyX + extraSep}vw)`;

          if (indiaRef.current) {
            indiaRef.current.style.transform = `translate(-50%, calc(-50% + ${phase3 * 80}vh))`;
            indiaRef.current.style.opacity = `${1 - phase3}`;
          }

          if (sideRef.current)
            sideRef.current.style.opacity = `${1 - phase3}`;

          /* ═══ Phase 4: Terminal Appears (0.55 → 0.75) ═══ */
          const phase4 = Math.min(Math.max((p - 0.55) / 0.2, 0), 1);

          /* ═══ Phase 5: Terminal Expands (0.75 → 1.0) ═══ */
          const phase5 = Math.min(Math.max((p - 0.75) / 0.25, 0), 1);

          // Terminal clip-path
          // Phase 4: 0% → 80%, Phase 5: 80% → 150% (covers viewport fully)
          if (terminalRef.current) {
            let circleSize = 0;
            if (phase5 > 0) {
              circleSize = 80 + phase5 * 70;
            } else if (phase4 > 0) {
              circleSize = phase4 * 80;
            }
            terminalRef.current.style.clipPath = `circle(${circleSize}% at 50% 50%)`;
          }

          if (terminalContentRef.current) {
            terminalContentRef.current.style.opacity = `${Math.max(phase4, phase5)}`;
          }

          // Trigger typing when terminal is sufficiently visible
          if (p > 0.7 && !typingStarted) {
            typingStarted = true;
            startTyping();
          }

          // Show ENTER RAILY button when terminal has expanded
          if (p > 0.88 && !enterButtonShown) {
            enterButtonShown = true;
            setShowEnterButton(true);
          }

          // Animate ENTER RAILY button appearance (fade + slide up)
          if (enterButtonRef.current && p > 0.85) {
            const btnReveal = Math.min(Math.max((p - 0.85) / 0.15, 0), 1);
            enterButtonRef.current.style.opacity = `${btnReveal}`;
            enterButtonRef.current.style.transform = `translateY(${(1 - btnReveal) * 30}px)`;
          }

          // Hide RAILY text as terminal takes over
          if (wordRef.current) {
            wordRef.current.style.opacity = `${1 - phase5}`;
          }

          ticking = false;
        });
        ticking = true;
      }
    };

    /* ── Typing Effect ──────────────────────────────────────── */
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

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => {
      window.removeEventListener("scroll", handleScroll);
      if (typingInterval) clearInterval(typingInterval);
    };
  }, []);

  /* ── Mouse Perspective ────────────────────────────────────── */
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!pinRef.current || isTransitioning) return;
      const x = (e.clientX / window.innerWidth - 0.5) * 2.5;
      const y = (e.clientY / window.innerHeight - 0.5) * 2.5;
      pinRef.current.style.transform = `perspective(1200px) rotateY(${x}deg) rotateX(${-y}deg)`;
    };

    window.addEventListener("mousemove", handleMouseMove, { passive: true });
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, [isTransitioning]);

  /* ── Render ───────────────────────────────────────────────── */
  return (
    <section className={`cinematic ${isTransitioning ? "opacity-0 transition-opacity duration-500" : ""}`}>
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
