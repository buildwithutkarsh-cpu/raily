"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { ScrollToPlugin } from "gsap/ScrollToPlugin";

gsap.registerPlugin(ScrollTrigger, ScrollToPlugin);

import {
  Sparkles,
  Train,
  TrainFront,
  Map,
  Clock,
  ArrowRight,
  MessageSquare,
  Ticket,
  Bell,
  Calendar,
  ChevronRight,
  MapPin,
  Globe,
  CreditCard,
  Sunset,
  Wind,
  Sofa,
} from "lucide-react";

const features = [
  {
    icon: Sparkles,
    title: "AI-Powered Search",
    desc: "Just tell me where you're going. Natural language queries that understand your budget, timing, and seat preferences.",
  },
  {
    icon: Train,
    title: "Smart Train Explorer",
    desc: "Compare trains by speed, price, and comfort. See availability at a glance with intelligent recommendations.",
  },
  {
    icon: Map,
    title: "Interactive Coach View",
    desc: "Choose your exact seat with our visual coach map. See which seats are near exits, away from toilets, or have windows.",
  },
  {
    icon: Clock,
    title: "Live Journey Tracking",
    desc: "Real-time train tracking with platform info, delay alerts, and arrival predictions.",
  },
  {
    icon: Ticket,
    title: "PNR Status Assistant",
    desc: "Just type your PNR number. Get instant status updates with smart insights about your seat location.",
  },
  {
    icon: Bell,
    title: "Price Drop Alerts",
    desc: "Set alerts for your routes. We'll notify you when fares drop so you never overpay.",
  },
];

const steps = [
  {
    num: "01",
    title: "Tell us your plan",
    desc: "Use natural language — where, when, budget, preferences. The AI handles the rest.",
    icon: MessageSquare,
  },
  {
    num: "02",
    title: "Review smart options",
    desc: "Get curated train recommendations ranked by what matters most to you.",
    icon: Train,
  },
  {
    num: "03",
    title: "Pick your seat",
    desc: "Visual coach view shows exactly what's available. AI recommends the best spot.",
    icon: Map,
  },
  {
    num: "04",
    title: "Book & track",
    desc: "One-click booking with instant confirmation. Track your journey in real-time.",
    icon: Calendar,
  },
];

const questions = [
  {
    icon: MapPin,
    question: "Where do you want to go?",
    desc: "Delhi → Mumbai? Bangalore → Chennai? Just name your cities.",
    tag: "Inter-state",
  },
  {
    icon: Globe,
    question: "Inter-state or intra-city?",
    desc: "Crossing borders or staying local — both work seamlessly.",
    tag: "Any route",
  },
  {
    icon: CreditCard,
    question: "What's your budget?",
    desc: "From ₹150 general to ₹4,000 AC First Class. We'll find your match.",
    tag: "Flexible",
  },
  {
    icon: Sofa,
    question: "AC, Sleeper, or General?",
    desc: "Pick your class — or let the AI recommend the best value.",
    tag: "All classes",
  },
  {
    icon: Sunset,
    question: "Morning, afternoon, or night?",
    desc: "Early bird or night owl? We'll show trains that fit your schedule.",
    tag: "Any time",
  },
  {
    icon: Wind,
    question: "Window seat or aisle?",
    desc: "Love the view or need easy access? Pick your perfect spot.",
    tag: "Comfort",
  },
];

const faqs = [
  {
    q: "How does RAILY book trains?",
    a: "You tell the AI where you want to go, when, and your preferences — it searches live train data, finds the best options, and guides you through booking in seconds. No forms, no hassle.",
  },
  {
    q: "Which trains are supported?",
    a: "All Indian Railways trains — from Vande Bharat Express to local passenger trains. If it runs on Indian tracks, RAILY can find it.",
  },
  {
    q: "Is RAILY free to use?",
    a: "Yes! Basic features like train search, PNR status, and journey tracking are completely free. Advanced features like price alerts and priority support are available on premium plans.",
  },
  {
    q: "How accurate is the live tracking?",
    a: "RAILY uses real-time Indian Railways data with 98.7% on-time accuracy for predictions. We factor in historical patterns, current delays, and route conditions.",
  },
  {
    q: "Can I cancel or modify bookings?",
    a: "Absolutely. RAILY handles cancellations and modifications through the integrated IRCTC system. Refunds are processed as per railway policy.",
  },
  {
    q: "How do I check PNR status?",
    a: "Just type or paste your 10-digit PNR number. RAILY shows current status, coach position, berth details, and even predicts confirmation chances for waitlisted tickets.",
  },
];

export default function LandingSections() {
  const sectionsRef = useRef<HTMLDivElement>(null);
  const featuresRef = useRef<HTMLDivElement>(null);
  const stepsRef = useRef<HTMLDivElement>(null);
  const questionsRef = useRef<HTMLDivElement>(null);
  const faqRef = useRef<HTMLDivElement>(null);
  const ctaRef = useRef<HTMLDivElement>(null);
  const trainRef = useRef<HTMLDivElement>(null);

  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);

  // ── GSAP ScrollTrigger Animations ──
  useEffect(() => {
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReduced) return;

    const ctx = gsap.context(() => {
      const animateSection = (
        container: HTMLElement,
        staggerChildren: string,
        opts?: { from?: string; distance?: number }
      ) => {
        const header = container.querySelector(".section-header");
        const items = container.querySelectorAll(staggerChildren);

        if (header) {
          gsap.fromTo(
            header,
            { opacity: 0, y: 40, rotationX: 5 },
            {
              opacity: 1,
              y: 0,
              rotationX: 0,
              duration: 1,
              ease: "power3.out",
              scrollTrigger: {
                trigger: header,
                start: "top 85%",
                toggleActions: "play none none reverse",
              },
            }
          );
        }

        if (items.length > 0) {
          gsap.fromTo(
            items,
            {
              opacity: 0,
              y: opts?.distance ?? 40,
              scale: 0.97,
            },
            {
              opacity: 1,
              y: 0,
              scale: 1,
              duration: 0.8,
              stagger: 0.08,
              ease: "power3.out",
              scrollTrigger: {
                trigger: container,
                start: "top 82%",
                toggleActions: "play none none reverse",
              },
            }
          );
        }
      };

      // ── Features ──
      if (featuresRef.current) {
        animateSection(featuresRef.current, ".feature-card", {
          distance: 50,
        });
      }

      // ── Steps ──
      if (stepsRef.current) {
        animateSection(stepsRef.current, ".step-card", {
          distance: 60,
        });
      }

      // ── Questions ──
      if (questionsRef.current) {
        animateSection(questionsRef.current, ".question-card", {
          distance: 50,
        });
      }

      // ── FAQ ──
      if (faqRef.current) {
        gsap.fromTo(
          faqRef.current.querySelectorAll(".faq-item"),
          { opacity: 0, y: 30 },
          {
            opacity: 1,
            y: 0,
            duration: 0.7,
            stagger: 0.1,
            ease: "power3.out",
            scrollTrigger: {
              trigger: faqRef.current,
              start: "top 82%",
              toggleActions: "play none none reverse",
            },
          }
        );
      }

      // ── CTA ──
      if (ctaRef.current) {
        gsap.fromTo(
          ctaRef.current,
          { opacity: 0, scale: 0.95 },
          {
            opacity: 1,
            scale: 1,
            duration: 1.2,
            ease: "elastic.out(1, 0.4)",
            scrollTrigger: {
              trigger: ctaRef.current,
              start: "top 85%",
              toggleActions: "play none none reverse",
            },
          }
        );
      }

      // ── Decorative Train ──
      if (trainRef.current) {
        gsap.to(trainRef.current, {
          x: "100vw",
          duration: 20,
          repeat: -1,
          ease: "none",
          force3D: true,
        });
      }

      // ── Smooth scroll for anchor links ──
      document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
        anchor.addEventListener("click", (e) => {
          e.preventDefault();
          const href = anchor.getAttribute("href");
          if (!href) return;
          const target = document.querySelector(href);
          if (target) {
            gsap.to(window, {
              scrollTo: { y: target, offsetY: 60 },
              duration: 1.2,
              ease: "power3.inOut",
            });
          }
        });
      });
    }, sectionsRef);

    return () => ctx.revert();
  }, []);

  return (
    <div ref={sectionsRef} className="bg-[var(--bg)] relative overflow-hidden">
      {/* ── Decorative Train Animation ── */}
      <div
        ref={trainRef}
        className="fixed top-1/2 left-0 -translate-y-1/2 z-0 pointer-events-none opacity-[0.03]"
      >
        <TrainFront className="h-16 w-16 text-[var(--fg)]" />
      </div>

      {/* ═══════════════════════════════════════════════════════════
          FEATURES SECTION
          ═══════════════════════════════════════════════════════════ */}
      <section id="features" className="py-24 px-6 relative z-[1]">
        <div ref={featuresRef} className="max-w-6xl mx-auto">
          <div className="section-header mb-16 max-w-2xl">
            <span className="text-[10px] uppercase tracking-[0.3em] text-[var(--railway-red)] font-semibold">
              Capabilities
            </span>
            <h2 className="text-3xl md:text-4xl font-bold uppercase tracking-[0.02em] mt-3 mb-4">
              Everything you need,
              <br />
              <span className="text-[var(--railway-red)]">nothing you don&apos;t.</span>
            </h2>
            <p className="text-[15px] text-[var(--muted)] leading-relaxed">
              Built for the modern Indian traveler. Every feature designed to make
              your journey seamless, from search to destination.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {features.map((feature) => (
              <div
                key={feature.title}
                className="feature-card border-2 border-[var(--fg)] p-6 group hover:bg-[var(--fg)] transition-all duration-500 hover:scale-[1.02] hover:-translate-y-1"
              >
                <div className="w-10 h-10 flex items-center justify-center bg-[var(--fg)] group-hover:bg-[var(--bg)] transition-colors mb-5">
                  <feature.icon className="h-5 w-5 text-[var(--bg)] group-hover:text-[var(--fg)] transition-colors" />
                </div>
                <h3 className="text-sm font-bold uppercase tracking-[0.05em] mb-2 group-hover:text-[var(--bg)] transition-colors">
                  {feature.title}
                </h3>
                <p className="text-[13px] text-[var(--muted)] leading-relaxed group-hover:text-[var(--bg)]/70 transition-colors">
                  {feature.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════
          HOW IT WORKS
          ═══════════════════════════════════════════════════════════ */}
      <section id="how-it-works" className="py-24 px-6 border-t-2 border-[var(--fg)] relative z-[1]">
        <div ref={stepsRef} className="max-w-6xl mx-auto">
          <div className="section-header mb-16 max-w-2xl">
            <span className="text-[10px] uppercase tracking-[0.3em] text-[var(--railway-red)] font-semibold">
              Process
            </span>
            <h2 className="text-3xl md:text-4xl font-bold uppercase tracking-[0.02em] mt-3 mb-4">
              Book in four
              <br />
              <span className="text-[var(--railway-red)]">simple steps.</span>
            </h2>
            <p className="text-[15px] text-[var(--muted)] leading-relaxed">
              No more fighting with complicated forms. Just tell the AI what you
              need, and watch the magic happen.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {steps.map((step, i) => (
              <div key={step.num} className="step-card relative">
                {i < steps.length - 1 && (
                  <div className="hidden lg:block absolute top-8 left-full w-6 h-px bg-[var(--fg)]/30" />
                )}
                <div className="border-2 border-[var(--fg)] p-6 h-full relative overflow-hidden group hover:border-[var(--railway-red)] transition-colors duration-300">
                  <div className="absolute -top-4 -right-4 text-8xl font-bold text-[var(--fg)]/[0.03] select-none pointer-events-none">
                    {step.num}
                  </div>
                  <div className="flex items-center gap-4 mb-4 relative z-[1]">
                    <span className="text-3xl font-bold text-[var(--fg)]/20">{step.num}</span>
                    <div className="w-8 h-8 flex items-center justify-center bg-[var(--fg)] group-hover:bg-[var(--railway-red)] transition-colors duration-300">
                      <step.icon className="h-4 w-4 text-[var(--bg)]" />
                    </div>
                  </div>
                  <h3 className="text-sm font-bold uppercase tracking-[0.05em] mb-2 relative z-[1]">
                    {step.title}
                  </h3>
                  <p className="text-[13px] text-[var(--muted)] leading-relaxed relative z-[1]">
                    {step.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════
          QUESTIONS SECTION — Where do you want to go?
          ═══════════════════════════════════════════════════════════ */}
      <section className="py-24 px-6 bg-[var(--fg)] text-[var(--bg)] relative z-[1] overflow-hidden">
        {/* Subtle pattern overlay */}
        <div className="absolute inset-0 pointer-events-none opacity-[0.03] bg-[radial-gradient(circle_at_50%_50%,var(--bg),transparent_70%)]" />

        <div ref={questionsRef} className="max-w-6xl mx-auto relative z-[2]">
          <div className="section-header mb-16 max-w-2xl">
            <span className="text-[10px] uppercase tracking-[0.3em] text-[var(--railway-red)] font-semibold">
              Start Here
            </span>
            <h2 className="text-3xl md:text-4xl font-bold uppercase tracking-[0.02em] mt-3 mb-4 text-[var(--bg)]">
              Where do you
              <br />
              <span className="text-[var(--railway-red)]">want to go?</span>
            </h2>
            <p className="text-[15px] text-[var(--bg)]/70 leading-relaxed">
              Tell the AI where you&apos;re headed. It&apos;s that simple.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {questions.map((item) => (
              <div
                key={item.question}
                className="question-card border-2 border-[var(--bg)]/20 p-6 group hover:bg-[var(--bg)] hover:border-[var(--bg)] transition-all duration-500 hover:scale-[1.02] hover:-translate-y-1 cursor-default"
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 flex items-center justify-center bg-[var(--bg)]/10 group-hover:bg-[var(--railway-red)] transition-colors duration-300">
                    <item.icon className="h-5 w-5 text-[var(--bg)] group-hover:text-[var(--fg)] transition-colors" />
                  </div>
                  <span className="text-[9px] uppercase tracking-[0.2em] text-[var(--bg)]/40 group-hover:text-[var(--fg)]/40 transition-colors border border-[var(--bg)]/20 group-hover:border-[var(--fg)]/20 px-2 py-1">
                    {item.tag}
                  </span>
                </div>
                <h3 className="text-base font-bold uppercase tracking-[0.03em] mb-2 group-hover:text-[var(--fg)] transition-colors">
                  {item.question}
                </h3>
                <p className="text-[13px] text-[var(--bg)]/60 leading-relaxed group-hover:text-[var(--fg)]/70 transition-colors">
                  {item.desc}
                </p>
              </div>
            ))}
          </div>

          {/* Prompt example */}
          <div className="mt-12 text-center">
            <div className="inline-flex items-center gap-3 px-6 py-4 border-2 border-[var(--bg)]/20 group hover:border-[var(--railway-red)] transition-all duration-300 cursor-default">
              <span className="text-[var(--railway-red)] text-sm">▸</span>
              <span className="text-[var(--bg)]/80 group-hover:text-[var(--bg)] text-sm transition-colors">
                &ldquo;I need a train from Delhi to Mumbai, AC class, under ₹1,500, tomorrow morning&rdquo;
              </span>
              <span className="w-2 h-4 bg-[var(--bg)] animate-pulse" />
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════
          FAQ SECTION
          ═══════════════════════════════════════════════════════════ */}
      <section id="faq" className="py-24 px-6 border-t-2 border-[var(--fg)] relative z-[1]">
        <div ref={faqRef} className="max-w-3xl mx-auto">
          <div className="section-header mb-16 max-w-2xl">
            <span className="text-[10px] uppercase tracking-[0.3em] text-[var(--railway-red)] font-semibold">
              Questions?
            </span>
            <h2 className="text-3xl md:text-4xl font-bold uppercase tracking-[0.02em] mt-3 mb-4">
              Frequently asked
              <br />
              <span className="text-[var(--railway-red)]">questions.</span>
            </h2>
            <p className="text-[15px] text-[var(--muted)] leading-relaxed">
              Everything you need to know about RAILY. Can&apos;t find what you&apos;re looking for?
              Just ask the AI.
            </p>
          </div>

          <div className="space-y-3">
            {faqs.map((faq, index) => (
              <div
                key={index}
                className={`faq-item border-2 border-[var(--fg)] transition-all duration-300 ${
                  openFaqIndex === index ? "bg-[var(--fg)] text-[var(--bg)]" : ""
                }`}
              >
                <button
                  onClick={() => setOpenFaqIndex(openFaqIndex === index ? null : index)}
                  className="w-full flex items-center justify-between p-5 text-left"
                >
                  <span className="text-sm font-bold uppercase tracking-[0.03em] pr-4">
                    {faq.q}
                  </span>
                  <ChevronRight
                    className={`h-4 w-4 flex-shrink-0 transition-transform duration-300 ${
                      openFaqIndex === index ? "rotate-90" : ""
                    }`}
                  />
                </button>
                <div
                  className={`overflow-hidden transition-all duration-300 ${
                    openFaqIndex === index ? "max-h-96" : "max-h-0"
                  }`}
                >
                  <p
                    className={`px-5 pb-5 text-[13px] leading-relaxed ${
                      openFaqIndex === index ? "text-[var(--bg)]/80" : ""
                    }`}
                  >
                    {faq.a}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════
          CTA SECTION
          ═══════════════════════════════════════════════════════════ */}
      <section className="py-24 px-6 bg-[var(--fg)] text-[var(--bg)] relative z-[1] overflow-hidden">
        <div className="absolute inset-0 opacity-[0.03]">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,var(--bg)_0%,transparent_50%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_50%,var(--bg)_0%,transparent_50%)]" />
        </div>

        <div ref={ctaRef} className="max-w-4xl mx-auto text-center relative z-[1]">
          <span className="text-[10px] uppercase tracking-[0.3em] text-[var(--railway-red)] font-semibold">
            Get Started
          </span>
          <h2 className="text-3xl md:text-5xl font-bold uppercase tracking-[0.02em] mt-3 mb-6">
            Ready to transform
            <br />
            your railway experience?
          </h2>
          <p className="text-[15px] text-[var(--bg)]/70 max-w-xl mx-auto mb-10 leading-relaxed">
            Join thousands of travelers who have already made the switch.
            Sign up for free and book your next journey with AI.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/sign-up"
              className="group flex items-center gap-3 px-8 py-4 bg-[var(--railway-red)] text-[var(--bg)] text-sm font-bold uppercase tracking-[0.1em] hover:bg-[var(--bg)] hover:text-[var(--fg)] transition-all duration-300 border-2 border-[var(--railway-red)] hover:border-[var(--bg)]"
            >
              Start Booking Free
              <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
            </Link>
            <Link
              href="/sign-in"
              className="flex items-center gap-3 px-8 py-4 border-2 border-[var(--bg)]/30 text-[var(--bg)] text-sm uppercase tracking-[0.1em] hover:border-[var(--bg)] transition-colors"
            >
              Sign In to Existing Account
            </Link>
          </div>

          <p className="text-[10px] text-[var(--bg)]/40 uppercase tracking-[0.2em] mt-8">
            No credit card required · Free forever for basic features
          </p>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════
          FOOTER
          ═══════════════════════════════════════════════════════════ */}
      <footer className="py-12 px-6 border-t-2 border-[var(--fg)] relative z-[1]">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-12">
            <div className="md:col-span-2">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 flex items-center justify-center bg-[var(--fg)]">
                  <TrainFront className="h-4 w-4 text-[var(--bg)]" />
                </div>
                <span className="font-bold text-sm tracking-[0.15em] uppercase">RAILY</span>
              </div>
              <p className="text-[13px] text-[var(--muted)] leading-relaxed max-w-sm">
                The AI operating system for Indian Railways. Book smarter, travel better.
              </p>
            </div>

            <div>
              <h4 className="text-[11px] uppercase tracking-[0.15em] font-bold mb-4">Product</h4>
              <ul className="space-y-2">
                {["Features", "Pricing", "Changelog", "Documentation"].map((link) => (
                  <li key={link}>
                    <a
                      href="#"
                      className="text-[12px] text-[var(--muted)] hover:text-[var(--fg)] transition-colors flex items-center gap-1 group"
                    >
                      {link}
                      <ChevronRight className="h-3 w-3 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h4 className="text-[11px] uppercase tracking-[0.15em] font-bold mb-4">Company</h4>
              <ul className="space-y-2">
                {["About", "Blog", "Careers", "Contact"].map((link) => (
                  <li key={link}>
                    <a
                      href="#"
                      className="text-[12px] text-[var(--muted)] hover:text-[var(--fg)] transition-colors flex items-center gap-1 group"
                    >
                      {link}
                      <ChevronRight className="h-3 w-3 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="border-t-2 border-[var(--fg)]/20 pt-6 flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-[10px] text-[var(--muted)] uppercase tracking-[0.15em]">
              © 2026 RAILY. All rights reserved.
            </p>
            <div className="flex items-center gap-6">
              {["Privacy", "Terms", "Cookies"].map((link) => (
                <a
                  key={link}
                  href="#"
                  className="text-[10px] text-[var(--muted)] hover:text-[var(--fg)] uppercase tracking-[0.15em] transition-colors"
                >
                  {link}
                </a>
              ))}
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
