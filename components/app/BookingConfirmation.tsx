"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Check,
  Train,
  Clock,
  Ticket,
  Download,

  ArrowRight,
  Printer,
  Sparkles,
  Mail,
  Loader2,
  Send,
  X,
} from "lucide-react";
import { useBooking, formatDisplayDate } from "@/lib/booking-store";

export default function BookingConfirmation() {
  const { state, resetBooking, setStep } = useBooking();
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [email, setEmail] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [sendStatus, setSendStatus] = useState<
    "idle" | "sending" | "sent" | "error"
  >("idle");
  const [sendMessage, setSendMessage] = useState("");

  const handleSendTicket = async () => {
    if (!email.includes("@")) return;

    setIsSending(true);
    setSendStatus("sending");
    setSendMessage("");

    try {
      const fromCode =
        state.query?.origin === "—" ? "NDLS" :
        state.query?.origin?.substring(0, 4).toUpperCase() || "NDLS";
      const toCode =
        state.query?.destination?.substring(0, 4).toUpperCase() || "JP";

      const res = await fetch("/api/ticket/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          pnr: state.pnrNumber || "—",
          trainName: state.selectedTrain?.name || "Rajdhani Express",
          trainNumber: state.selectedTrain?.number || "12951",
          from: state.query?.origin || "Delhi",
          fromCode,
          to: state.query?.destination || "Jaipur",
          toCode,
          date: state.query?.date || new Date().toLocaleDateString(),
          departure: state.selectedTrain?.departure || "06:25",
          arrival: state.selectedTrain?.arrival || "11:50",
          duration: state.selectedTrain?.duration || "5h 25m",
          coach: state.selectedCoach || "B1",
          seat: state.selectedSeat?.match(/-(\d+)/)?.[1] || "7",
          tier: state.seatRecommendation?.tier || "Lower",
          fare: state.selectedTrain?.price || 1245,
          class: state.selectedTrain?.classType || "3A",
          passengerName: "Primary Passenger",
          platform: "5",
        }),
      });

      const data = await res.json();

      if (data.success) {
        setSendStatus("sent");
        setSendMessage("Ticket sent to your email! Check your inbox.");
      } else {
        setSendStatus("error");
        setSendMessage(data.error?.message || "Failed to send ticket");
      }
    } catch (err) {
      setSendStatus("error");
      setSendMessage(
        err instanceof Error ? err.message : "Something went wrong"
      );
    } finally {
      setIsSending(false);
    }
  };

  const train = state.selectedTrain;
  const pnr = state.pnrNumber || "—";

  return (
    <div className="space-y-6">
      {/* Success header */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4 }}
        className="border-2 border-[var(--fg)] p-8 text-center"
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.15, type: "spring", stiffness: 200, damping: 15 }}
          className="w-16 h-16 bg-[var(--fg)] flex items-center justify-center mx-auto mb-5"
        >
          <Check className="h-8 w-8 text-[var(--bg)]" />
        </motion.div>
        <h2 className="text-2xl font-bold uppercase tracking-[0.05em] mb-2">
          Booking Confirmed
        </h2>
        <p className="text-[15px] text-[var(--muted)] max-w-md mx-auto">
          Your journey has been booked successfully. Check your PNR status for
          real-time updates.
        </p>
      </motion.div>

      {/* Journey card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="border-2 border-[var(--fg)]"
      >
        {/* Train header */}
        <div className="p-5 border-b-2 border-[var(--fg)]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 flex items-center justify-center bg-[var(--fg)]">
                <Train className="h-5 w-5 text-[var(--bg)]" />
              </div>
              <div>
                <div className="text-lg font-bold">
                  {train?.name || "Rajdhani Express"}
                </div>
                <div className="text-[12px] text-[var(--muted)]">
                  {train?.number || "12951"} · {train?.classType || "3A"} · Superfast
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold">₹{train?.price || 1245}</div>
              <div className="text-[10px] text-[var(--muted)] uppercase tracking-[0.1em]">
                Total fare
              </div>
            </div>
          </div>
        </div>

        {/* Journey details */}
        <div className="p-5 space-y-5">
          {/* Route */}
          <div className="flex items-center gap-6">
            <div className="flex-1 text-center">
              <div className="text-2xl font-bold">{train?.departure || "06:25"}</div>
              <div className="text-[11px] text-[var(--muted)] uppercase tracking-[0.1em]">
                {state.query?.origin || "Delhi"} (NDLS)
              </div>
            </div>
            <div className="flex-1 flex flex-col items-center">
              <div className="text-[10px] text-[var(--muted)] uppercase tracking-[0.1em] mb-1">
                {train?.duration || "5h 25m"}
              </div>
              <div className="w-full flex items-center gap-2">
                <div className="h-px flex-1 bg-[var(--fg)]/30" />
                <Train className="h-4 w-4 text-[var(--fg)]" />
                <div className="h-px flex-1 bg-[var(--fg)]/30" />
              </div>
              <div className="text-[10px] text-[var(--muted)] uppercase tracking-[0.1em] mt-1">
                309 km
              </div>
            </div>
            <div className="flex-1 text-center">
              <div className="text-2xl font-bold">{train?.arrival || "11:50"}</div>
              <div className="text-[11px] text-[var(--muted)] uppercase tracking-[0.1em]">
                {state.query?.destination || "Jaipur"} (JP)
              </div>
            </div>
          </div>

          {/* Divider */}
          <div className="border-t border-[var(--fg)]/20 pt-4">
            <div className="grid grid-cols-4 gap-4">
              {[
                { label: "PNR", value: pnr },
              { label: "Coach", value: state.selectedCoach || "—" },
              { label: "Seat", value: state.selectedSeat ? `${state.selectedSeat.match(/-(\d+)/)?.[1] || '—'} (${state.seatRecommendation?.tier || '—'})` : "—" },
                { label: "Platform", value: "5" },
              ].map((item) => (
                <div key={item.label} className="text-center">
                  <div className="text-[10px] text-[var(--muted)] uppercase tracking-[0.1em] mb-1">
                    {item.label}
                  </div>
                  <div className="text-sm font-bold">{item.value}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Passenger */}
          <div className="border-t border-[var(--fg)]/20 pt-4">
            <div className="text-[10px] text-[var(--muted)] uppercase tracking-[0.1em] mb-3">
              Passenger Details
            </div>
            <div className="space-y-2">
              {[
                { name: "Primary Passenger", age: "—", berth: `${state.selectedCoach || "B1"}-${state.selectedSeat?.match(/-(\d+)/)?.[1] || "—"} (${state.seatRecommendation?.tier || '—'})`, status: "CNF" },
              ].map((p, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between py-2 text-sm"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-6 h-6 flex items-center justify-center bg-[var(--fg)]/10 text-[10px] font-bold">
                      {i + 1}
                    </div>
                    <span>{p.name}</span>
                    <span className="text-[var(--muted)] text-[12px]">{p.age} yrs</span>
                  </div>
                  <div className="flex items-center gap-4 text-[13px]">
                    <span className="text-[var(--muted)]">{p.berth}</span>
                    <span className="px-2 py-0.5 bg-[var(--fg)] text-[var(--bg)] text-[10px] uppercase tracking-[0.1em]">
                      {p.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="border-t-2 border-[var(--fg)] flex">
          <button
            onClick={() => {
              const w = window.open("", "_blank");
              if (w) {
                w.document.write(
                  `<pre style="font-family:monospace;background:#F5F2EA;color:#111;padding:40px;font-size:14px;line-height:1.6;">🚆 RAILY BOOKING CONFIRMATION
══════════════════════════════
PNR: ${pnr}
Train: ${train?.name} (${train?.number})
Route: ${state.query?.origin || "Delhi"} → ${state.query?.destination || "Jaipur"}
Date: ${state.query?.date ? formatDisplayDate(state.query.date) : "28 Jul 2026"}
Time: ${train?.departure} → ${train?.arrival}
Coach: B1 · Seat: 7 (Lower)
Fare: ₹${train?.price || 1245}
Platform: 5
Status: CONFIRMED ✅
══════════════════════════════
Thank you for using RAILY.</pre>`
                );
                w.document.close();
              }
            }}
            className="flex-1 flex items-center justify-center gap-2 py-3 text-xs uppercase tracking-[0.1em] font-semibold hover:bg-[var(--fg)] hover:text-[var(--bg)] transition-colors"
          >
            <Printer className="h-3.5 w-3.5" />
            Print
          </button>
          <button
            onClick={() => {
              setShowEmailModal(true);
              setSendStatus("idle");
              setSendMessage("");
            }}
            className="flex-1 flex items-center justify-center gap-2 py-3 text-xs uppercase tracking-[0.1em] font-semibold border-l-2 border-[var(--fg)] hover:bg-[var(--fg)] hover:text-[var(--bg)] transition-colors"
          >
            <Mail className="h-3.5 w-3.5" />
            Email
          </button>
          <button
            onClick={() => {
              // Trigger PDF download via the API
              fetch("/api/ticket/send", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  email: "download@raily.app",
                  pnr: state.pnrNumber || "—",
                  trainName: state.selectedTrain?.name || "Rajdhani Express",
                  trainNumber: state.selectedTrain?.number || "12951",
                  from: state.query?.origin || "Delhi",
                  fromCode: state.query?.origin?.substring(0, 4).toUpperCase() || "NDLS",
                  to: state.query?.destination || "Jaipur",
                  toCode: state.query?.destination?.substring(0, 4).toUpperCase() || "JP",
                  date: state.query?.date || new Date().toLocaleDateString(),
                  departure: state.selectedTrain?.departure || "06:25",
                  arrival: state.selectedTrain?.arrival || "11:50",
                  duration: state.selectedTrain?.duration || "5h 25m",
                  coach: state.selectedCoach || "B1",
                  seat: state.selectedSeat?.match(/-(\d+)/)?.[1] || "7",
                  tier: state.seatRecommendation?.tier || "Lower",
                  fare: state.selectedTrain?.price || 1245,
                  class: state.selectedTrain?.classType || "3A",
                  passengerName: "Primary Passenger",
                  platform: "5",
                }),
              })
                .then((res) => {
                  const contentType = res.headers.get("Content-Type");
                  if (contentType === "application/pdf") {
                    return res.blob();
                  }
                  return null;
                })
                .then((blob) => {
                  if (blob) {
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = `ticket-${pnr}.pdf`;
                    a.click();
                    URL.revokeObjectURL(url);
                  }
                })
                .catch(() => {
                  // Silent fallback
                });
            }}
            className="flex-1 flex items-center justify-center gap-2 py-3 text-xs uppercase tracking-[0.1em] font-semibold border-l-2 border-[var(--fg)] hover:bg-[var(--fg)] hover:text-[var(--bg)] transition-colors"
          >
            <Download className="h-3.5 w-3.5" />
            Download
          </button>
        </div>
      </motion.div>

      {/* Quick actions */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35 }}
        className="grid grid-cols-2 gap-3"
      >
        <button
          onClick={() => {
            setStep("pnr");
          }}
          className="flex items-center justify-center gap-3 p-5 border-2 border-[var(--fg)] hover:bg-[var(--fg)]/5 transition-colors text-left"
        >
          <Ticket className="h-6 w-6" />
          <div>
            <div className="text-sm font-bold uppercase tracking-[0.05em]">
              Check PNR
            </div>
            <div className="text-[11px] text-[var(--muted)]">
              {pnr} · Confirmed
            </div>
          </div>
          <ArrowRight className="h-5 w-5 ml-auto text-[var(--muted)]" />
        </button>
        <button
          onClick={() => {
            setStep("journey");
          }}
          className="flex items-center justify-center gap-3 p-5 border-2 border-[var(--fg)] hover:bg-[var(--fg)]/5 transition-colors text-left"
        >
          <Clock className="h-6 w-6" />
          <div>
            <div className="text-sm font-bold uppercase tracking-[0.05em]">
              Live Tracking
            </div>
            <div className="text-[11px] text-[var(--muted)]">
              Track your train in real-time
            </div>
          </div>
          <ArrowRight className="h-5 w-5 ml-auto text-[var(--muted)]" />
        </button>
      </motion.div>

      {/* AI suggestion */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="flex items-start gap-3 p-4 border border-[var(--fg)]/30"
      >
        <Sparkles className="h-4 w-4 mt-0.5 text-[var(--muted)]" />
        <div>
          <p className="text-[13px] text-[var(--muted)]">
            <span className="font-semibold text-[var(--fg)]">AI Note:</span> Your
            train departs from Platform 5. Dining car is in Coach C1. Food
            service begins 30 min after departure. Pre-order available.
          </p>
        </div>
      </motion.div>

      {/* New booking */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="text-center"
      >
        <button
          onClick={resetBooking}
          className="inline-flex items-center gap-2 px-6 py-3 border-2 border-[var(--fg)] text-xs uppercase tracking-[0.1em] font-semibold hover:bg-[var(--fg)] hover:text-[var(--bg)] transition-colors"
        >
          Book Another Journey
        </button>
      </motion.div>

      {/* Email Ticket Modal */}
      <AnimatePresence>
        {showEmailModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[300] flex items-center justify-center bg-black/50"
            onClick={() => setShowEmailModal(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ duration: 0.2 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-[var(--bg)] border-2 border-[var(--fg)] p-6 w-full max-w-sm mx-4"
            >
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-3">
                  <Mail className="h-5 w-5" />
                  <span className="font-bold text-sm uppercase tracking-[0.05em]">
                    Email Ticket
                  </span>
                </div>
                <button
                  onClick={() => setShowEmailModal(false)}
                  className="w-8 h-8 flex items-center justify-center hover:bg-[var(--fg)]/5 transition-colors"
                  aria-label="Close email modal"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {sendStatus === "sent" ? (
                <div className="text-center py-6">
                  <div className="w-12 h-12 bg-[var(--fg)] flex items-center justify-center mx-auto mb-4">
                    <Check className="h-6 w-6 text-[var(--bg)]" />
                  </div>
                  <p className="text-sm font-bold mb-1">Ticket Sent! 🎫</p>
                  <p className="text-[13px] text-[var(--muted)]">
                    {sendMessage || "Check your inbox for the PDF"}
                  </p>
                  <button
                    onClick={() => setShowEmailModal(false)}
                    className="mt-4 px-6 py-2 bg-[var(--fg)] text-[var(--bg)] text-xs uppercase tracking-[0.1em] font-semibold hover:bg-[var(--railway-red)] transition-colors"
                  >
                    Done
                  </button>
                </div>
              ) : (
                <>
                  <p className="text-[13px] text-[var(--muted)] mb-4">
                    Enter your email to receive the PDF ticket for{" "}
                    <span className="font-semibold text-[var(--fg)]">
                      {state.selectedTrain?.name || "your booking"}
                    </span>
                  </p>

                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full bg-transparent border-2 border-[var(--fg)] px-4 py-3 text-sm outline-none mb-4 placeholder:text-[var(--muted)]"
                  />

                  {sendStatus === "error" && sendMessage && (
                    <p className="text-[12px] text-[var(--railway-red)] mb-3">
                      {sendMessage}
                    </p>
                  )}

                  <div className="flex gap-2">
                    <button
                      onClick={() => setShowEmailModal(false)}
                      className="flex-1 px-4 py-3 border-2 border-[var(--fg)] text-xs uppercase tracking-[0.1em] font-semibold hover:bg-[var(--fg)]/5 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSendTicket}
                      disabled={!email.includes("@") || isSending}
                      className="flex-1 px-4 py-3 bg-[var(--fg)] text-[var(--bg)] text-xs uppercase tracking-[0.1em] font-semibold disabled:opacity-30 hover:bg-[var(--railway-red)] transition-colors flex items-center justify-center gap-2"
                    >
                      {isSending ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Sending...
                        </>
                      ) : (
                        <>
                          <Send className="h-4 w-4" />
                          Send Ticket
                        </>
                      )}
                    </button>
                  </div>

                  <p className="text-[10px] text-[var(--muted)] mt-3 text-center">
                    ✦ This is a simulated ticket not valid for real travel ✦
                  </p>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
