"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
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
} from "lucide-react";

const features = [
  {
    icon: Sparkles,
    title: "AI-Powered Search",
    desc: "Just tell me where you're going. Natural language queries that understand your budget, timing, and seat preferences.",
    example: '"Book Delhi to Jaipur tomorrow, lower berth, under ₹800"',
  },
  {
    icon: Train,
    title: "Smart Train Explorer",
    desc: "Compare trains by speed, price, and comfort. See availability at a glance with intelligent recommendations.",
    example: null,
  },
  {
    icon: Map,
    title: "Interactive Coach View",
    desc: "Choose your exact seat with our visual coach map. See which seats are near exits, away from toilets, or have windows.",
    example: null,
  },
  {
    icon: Clock,
    title: "Live Journey Tracking",
    desc: "Real-time train tracking with platform info, delay alerts, and arrival predictions.",
    example: null,
  },
  {
    icon: Ticket,
    title: "PNR Status Assistant",
    desc: "Just type your PNR number. Get instant status updates with smart insights about your seat location.",
    example: '"Check PNR 4785213694"',
  },
  {
    icon: Bell,
    title: "Price Drop Alerts",
    desc: "Set alerts for your routes. We'll notify you when fares drop so you never overpay.",
    example: null,
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

const stats = [
  { value: "2M+", label: "Bookings Processed", sub: "since launch" },
  { value: "45s", label: "Avg. Booking Time", sub: "from query to confirmed" },
  { value: "98.7%", label: "On-Time Accuracy", sub: "for predictions" },
  { value: "₹12Cr", label: "Saved by Users", sub: "through price alerts" },
];

const testimonials = [
  {
    quote: "I typed 'fastest train to Mumbai this Friday' and had a confirmed ticket in under a minute. This is the future of Indian railways.",
    name: "Priya Sharma",
    role: "Frequent Traveler, Delhi",
  },
  {
    quote: "The coach view is incredible. I always pick seats near the exit now — something I could never do on the IRCTC website.",
    name: "Arjun Patel",
    role: "Business Traveler, Mumbai",
  },
  {
    quote: "Price alerts saved me ₹2,400 on my last 3 trips. RAILY pays for itself.",
    name: "Deepa Nair",
    role: "Student, Bangalore",
  },
];

export default function LandingSections() {
  const sectionsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("animate-in");
          }
        });
      },
      { threshold: 0.1, rootMargin: "0px 0px -50px 0px" }
    );

    const elements = sectionsRef.current?.querySelectorAll(".fade-up");
    elements?.forEach((el) => observer.observe(el));

    return () => observer.disconnect();
  }, []);

  return (
    <div ref={sectionsRef} className="bg-[var(--bg)] relative">
      {/* ═══════════════════════════════════════════════════════════
          FEATURES SECTION
          ═══════════════════════════════════════════════════════════ */}
      <section id="features" className="py-24 px-6">
        <div className="max-w-6xl mx-auto">
          {/* Section Header */}
          <div className="fade-up mb-16 max-w-2xl">
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

          {/* Feature Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {features.map((feature, i) => (
              <div
                key={feature.title}
                className="fade-up border-2 border-[var(--fg)] p-6 group hover:bg-[var(--fg)] transition-all duration-300"
                style={{ animationDelay: `${i * 80}ms` }}
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
                {feature.example && (
                  <div className="mt-4 px-3 py-2 bg-[var(--fg)]/5 group-hover:bg-[var(--bg)]/10 transition-colors">
                    <code className="text-[11px] text-[var(--muted)] group-hover:text-[var(--bg)]/60 font-mono">
                      {feature.example}
                    </code>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════
          HOW IT WORKS
          ═══════════════════════════════════════════════════════════ */}
      <section id="how-it-works" className="py-24 px-6 border-t-2 border-[var(--fg)]">
        <div className="max-w-6xl mx-auto">
          <div className="fade-up mb-16 max-w-2xl">
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

          {/* Steps */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {steps.map((step, i) => (
              <div
                key={step.num}
                className="fade-up relative"
                style={{ animationDelay: `${i * 100}ms` }}
              >
                {/* Connector line */}
                {i < steps.length - 1 && (
                  <div className="hidden lg:block absolute top-8 left-full w-6 h-px bg-[var(--fg)]/30" />
                )}

                <div className="border-2 border-[var(--fg)] p-6 h-full relative">
                  <div className="flex items-center gap-4 mb-4">
                    <span className="text-3xl font-bold text-[var(--fg)]/20">
                      {step.num}
                    </span>
                    <div className="w-8 h-8 flex items-center justify-center bg-[var(--fg)]">
                      <step.icon className="h-4 w-4 text-[var(--bg)]" />
                    </div>
                  </div>
                  <h3 className="text-sm font-bold uppercase tracking-[0.05em] mb-2">
                    {step.title}
                  </h3>
                  <p className="text-[13px] text-[var(--muted)] leading-relaxed">
                    {step.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════
          TERMINAL DEMO
          ═══════════════════════════════════════════════════════════ */}
      <section className="py-24 px-6 bg-[var(--fg)] text-[var(--bg)]">
        <div className="max-w-4xl mx-auto">
          <div className="fade-up">
            <div className="border-2 border-[var(--bg)]/20 overflow-hidden">
              {/* Terminal Header */}
              <div className="flex items-center gap-2 px-4 py-3 border-b-2 border-[var(--bg)]/20">
                <div className="w-3 h-3 rounded-full bg-[var(--bg)]/30" />
                <div className="w-3 h-3 rounded-full bg-[var(--bg)]/30" />
                <div className="w-3 h-3 rounded-full bg-[var(--bg)]/30" />
                <span className="ml-4 text-[10px] uppercase tracking-[0.2em] text-[var(--bg)]/50">
                  raily terminal
                </span>
              </div>

              {/* Terminal Body */}
              <div className="p-6 md:p-8 font-mono text-sm md:text-base space-y-3">
                <div className="text-[var(--bg)]/60">
                  <span className="text-[var(--railway-red)]">▸</span> System ready. Awaiting input...
                </div>
                <div className="text-[var(--bg)]">
                  <span className="text-[var(--railway-red)]">▸</span> Book me from Delhi to Jaipur tomorrow
                </div>
                <div className="text-[var(--bg)]/80 pl-4">
                  ✓ Origin: Delhi (NDLS)
                </div>
                <div className="text-[var(--bg)]/80 pl-4">
                  ✓ Destination: Jaipur (JP)
                </div>
                <div className="text-[var(--bg)]/80 pl-4">
                  ✓ Date: Tomorrow, 29 Jul 2026
                </div>
                <div className="h-px bg-[var(--bg)]/20 my-2" />
                <div className="text-[var(--bg)]">
                  <span className="text-[var(--railway-red)]">▸</span> Budget ₹800, lower berth, fastest train
                </div>
                <div className="h-px bg-[var(--bg)]/20 my-2" />
                <div className="text-[var(--railway-red)] font-bold">
                  Searching 47 trains across 3 classes...
                </div>
                <div className="text-[var(--bg)]">
                  Found 12 options within your criteria.
                </div>
                <div className="text-[var(--bg)]/80 pl-4">
                  ⭐ <span className="text-[var(--railway-red)]">Recommended:</span> Garib Rath Express (12909)
                </div>
                <div className="text-[var(--bg)]/80 pl-4">
                  &nbsp;&nbsp;&nbsp;Departure: 22:40 → Arrival: 05:15 (+1)
                </div>
                <div className="text-[var(--bg)]/80 pl-4">
                  &nbsp;&nbsp;&nbsp;Price: ₹755 · Lower Berth · Available
                </div>
                <div className="h-px bg-[var(--bg)]/20 my-2" />
                <div className="text-[var(--bg)]">
                  <span className="text-[var(--railway-red)]">▸</span> Select seat B3-L12
                </div>
                <div className="text-[var(--bg)]">
                  <span className="text-[var(--railway-red)]">▸</span> Confirm booking
                </div>
                <div className="text-[var(--railway-red)] font-bold mt-4">
                  ✓ BOOKING CONFIRMED
                </div>
                <div className="text-[var(--bg)]/80 pl-4">
                  PNR: 4785213694
                </div>
                <div className="text-[var(--bg)]/80 pl-4">
                  E-ticket sent to your email.
                </div>
                <div className="flex items-center mt-4">
                  <span className="text-[var(--railway-red)]">▸</span>
                  <span className="ml-2 inline-block w-2 h-5 bg-[var(--bg)] animate-pulse" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════
          STATS SECTION
          ═══════════════════════════════════════════════════════════ */}
      <section id="stats" className="py-24 px-6 border-t-2 border-[var(--fg)]">
        <div className="max-w-6xl mx-auto">
          <div className="fade-up text-center mb-16">
            <span className="text-[10px] uppercase tracking-[0.3em] text-[var(--railway-red)] font-semibold">
              By the Numbers
            </span>
            <h2 className="text-3xl md:text-4xl font-bold uppercase tracking-[0.02em] mt-3">
              Trusted by thousands
            </h2>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {stats.map((stat, i) => (
              <div
                key={stat.label}
                className="fade-up border-2 border-[var(--fg)] p-6 text-center"
                style={{ animationDelay: `${i * 100}ms` }}
              >
                <div className="text-3xl md:text-4xl font-bold mb-2">
                  {stat.value}
                </div>
                <div className="text-[11px] uppercase tracking-[0.1em] font-semibold mb-1">
                  {stat.label}
                </div>
                <div className="text-[10px] text-[var(--muted)] uppercase tracking-[0.1em]">
                  {stat.sub}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════
          TESTIMONIALS
          ═══════════════════════════════════════════════════════════ */}
      <section className="py-24 px-6 border-t-2 border-[var(--fg)]">
        <div className="max-w-6xl mx-auto">
          <div className="fade-up mb-12 max-w-2xl">
            <span className="text-[10px] uppercase tracking-[0.3em] text-[var(--railway-red)] font-semibold">
              Testimonials
            </span>
            <h2 className="text-3xl md:text-4xl font-bold uppercase tracking-[0.02em] mt-3">
              What travelers say
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {testimonials.map((t, i) => (
              <div
                key={t.name}
                className="fade-up border-2 border-[var(--fg)] p-6"
                style={{ animationDelay: `${i * 100}ms` }}
              >
                <div className="text-[var(--railway-red)] text-2xl mb-3">"</div>
                <p className="text-[14px] leading-relaxed mb-6">{t.quote}</p>
                <div className="border-t-2 border-[var(--fg)]/20 pt-4">
                  <div className="text-sm font-bold">{t.name}</div>
                  <div className="text-[10px] text-[var(--muted)] uppercase tracking-[0.1em]">
                    {t.role}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════
          CTA SECTION
          ═══════════════════════════════════════════════════════════ */}
      <section className="py-24 px-6 bg-[var(--fg)] text-[var(--bg)]">
        <div className="max-w-4xl mx-auto text-center">
          <div className="fade-up">
            <span className="text-[10px] uppercase tracking-[0.3em] text-[var(--railway-red)] font-semibold">
              Get Started
            </span>
            <h2 className="text-3xl md:text-5xl font-bold uppercase tracking-[0.02em] mt-3 mb-6">
              Ready to transform
              <br />
              your railway experience?
            </h2>              <p className="text-[15px] text-[var(--bg)]/70 max-w-xl mx-auto mb-10 leading-relaxed">
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
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════
          FOOTER
          ═══════════════════════════════════════════════════════════ */}
      <footer className="py-12 px-6 border-t-2 border-[var(--fg)]">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-12">
            {/* Brand */}
            <div className="md:col-span-2">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 flex items-center justify-center bg-[var(--fg)]">
                  <TrainFront className="h-4 w-4 text-[var(--bg)]" />
                </div>
                <span className="font-bold text-sm tracking-[0.15em] uppercase">
                  RAILY
                </span>
              </div>
              <p className="text-[13px] text-[var(--muted)] leading-relaxed max-w-sm">
                The AI operating system for Indian Railways. Book smarter, travel
                better.
              </p>
            </div>

            {/* Links */}
            <div>
              <h4 className="text-[11px] uppercase tracking-[0.15em] font-bold mb-4">
                Product
              </h4>
              <ul className="space-y-2">
                {["Features", "Pricing", "Changelog", "Documentation"].map(
                  (link) => (
                    <li key={link}>
                      <a
                        href="#"
                        className="text-[12px] text-[var(--muted)] hover:text-[var(--fg)] transition-colors flex items-center gap-1 group"
                      >
                        {link}
                        <ChevronRight className="h-3 w-3 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
                      </a>
                    </li>
                  )
                )}
              </ul>
            </div>

            <div>
              <h4 className="text-[11px] uppercase tracking-[0.15em] font-bold mb-4">
                Company
              </h4>
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

          {/* Bottom */}
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
