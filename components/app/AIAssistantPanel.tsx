"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  X,
  Send,
  Sparkles,
  User,
  Bot,
  Mic,
  Train,
  Check,
  ArrowRight,
} from "lucide-react";
import { useBooking, parseNaturalLanguageQuery, getSeatRecommendation as getSeatRec, formatDisplayDate } from "@/lib/booking-store";
import type { ExtractedQuery } from "@/lib/booking-store";
import type { Train as TrainType } from "@/lib/booking-store";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  actions?: {
    label: string;
    action: () => void;
    primary?: boolean;
  }[];
}

const suggestions = [
  "Book Delhi → Jaipur tomorrow, lower berth, under ₹800",
  "Fastest train Mumbai → Pune this Friday morning",
  "Overnight trains Bangalore → Chennai, sleeper class",
  "Check PNR status for my last booking",
];

export default function AIAssistantPanel({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const {
    state,
    setStep,
    setQuery,
    selectTrain,
    setSelectedSeat,
    setSeatRecommendation,
    confirmBooking,
    fetchTrains,
  } = useBooking();

  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content:
        "I'm your AI travel assistant. Tell me where you'd like to go, and I'll find the best trains for you. Try saying something like *\"Book Delhi to Jaipur tomorrow\"* or *\"Check my PNR\"*.",
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  /* ── Build AI Response from Parsed Query ───────────────── */
  const buildQueryResponse = useCallback((query: ExtractedQuery): string => {
    if (!query.origin || !query.destination) {
      return `I can help you find the perfect train — just tell me where you're going and when! Try something like "Delhi to Jaipur tomorrow".`;
    }

    const displayDate = formatDisplayDate(query.date);
    const prefStr = query.preference ? ` (${query.preference})` : "";
    const budgetStr = query.budget ? ` under ₹${query.budget}` : "";

    let response = `I found trains from **${query.origin} → ${query.destination}** on ${displayDate}${prefStr}${budgetStr}. Let me search for the best options and organize them by what matters most.`;

    if (query.budget && query.budget <= 800) {
      response += `\n\n⭐ **Budget Pick:** I'll prioritize the most affordable options within ₹${query.budget}.`;
    } else if (query.preference?.includes("Lower")) {
      response += `\n\n⭐ **Comfort Pick:** I'll find trains with lower berth availability for easy access.`;
    } else {
      response += `\n\n⭐ **Top Pick:** I'll recommend the best overall option balancing speed, comfort, and price.`;
    }

    return response;
  }, []);


  /* ── Handle Message Submit ─────────────────────────────── */
  const handleSubmit = useCallback(
    async (text?: string) => {
      const msgText = text || input;
      if (!msgText.trim() || isTyping) return;
      setInput("");

      const userMsg: Message = {
        id: Date.now().toString(),
        role: "user",
        content: msgText,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, userMsg]);
      setIsTyping(true);

      const lower = msgText.toLowerCase();
      const isPNRQuery =
        !!msgText.match(/\b\d{10}\b/) ||
        lower.includes("pnr") ||
        (lower.includes("check") && lower.includes("status"));
      const isBookingQuery =
        lower.includes("book") ||
        lower.includes("train") ||
        lower.includes("ticket") ||
        lower.includes("journey") ||
        lower.includes("going") ||
        lower.includes("travel") ||
        lower.includes("route") ||
        lower.includes("delhi") ||
        lower.includes("mumbai") ||
        lower.includes("jaipur") ||
        lower.includes("bangalore") ||
        lower.includes("chennai");

      if (isPNRQuery) {
        const aiMsg: Message = {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: `I can check the status of any PNR number. Please enter your 10-digit PNR number in the PNR section, or type it here and I'll pull up your booking details.`,
          timestamp: new Date(),
          actions: [
            {
              label: "Open PNR Section",
              action: () => {
                setStep("pnr");
              },
              primary: true,
            },
          ],
        };
        setMessages((prev) => [...prev, aiMsg]);
        setIsTyping(false);
        return;
      }

      if (isBookingQuery) {
        const query = parseNaturalLanguageQuery(msgText);
        setQuery(query);
        setStep("searching");
        const response = buildQueryResponse(query);
        // Show a brief thinking state, then await the real API call
        const aiMsg: Message = {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: response,
          timestamp: new Date(),
          actions: [
            {
              label: "Compare All Trains",
              action: () => {
                setStep("recommendations");
              },
              primary: true,
            },
          ],
        };
        setMessages((prev) => [...prev, aiMsg]);
        setIsTyping(false);
        // Actually fetch trains — fetchTrains handles step transition internally
        fetchTrains(query);
        return;
      }

      // Generic fallback
      const aiMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content:
          "I can help you book trains, check PNR status, find routes, and plan your journey. Try something like:\n\n• \"Book Delhi to Jaipur tomorrow\"\n• \"Check PNR status\"\n• \"Fastest train Mumbai to Pune\"",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, aiMsg]);
      setIsTyping(false);
    },
    [input, isTyping, buildQueryResponse, setQuery, fetchTrains, setStep]
  );

  /* ── Follow-up: select train ──────────────────────────── */
  const handleSelectTrain = useCallback(
    (train: TrainType) => {
      selectTrain(train);
      const rec = getSeatRec(train);
      setSeatRecommendation(rec);

      const aiMsg: Message = {
        id: (Date.now() + 2).toString(),
        role: "assistant",
        content: `Great choice! I've selected **${train.name}** (${train.number}) for you. Let me recommend the best seat based on your preferences:\n\n${rec.reason}\n\nWould you like to see this seat in the coach view?`,
        timestamp: new Date(),
        actions: [
          {
            label: "Show Coach View",
            action: () => {
              setSelectedSeat(rec.seatId);
            },
            primary: true,
          },
          {
            label: "Try Another Seat",
            action: () => {
              setSelectedSeat(null);
            },
          },
        ],
      };
      setMessages((prev) => [...prev, aiMsg]);
    },
    [selectTrain, setSeatRecommendation, setSelectedSeat, getSeatRec]
  );

  /* ── Follow-up: confirm booking ───────────────────────── */
  const handleConfirmBooking = useCallback(() => {
    confirmBooking();

    const train = state.selectedTrain;
    const aiMsg: Message = {
      id: (Date.now() + 3).toString(),
      role: "assistant",
      content: `🎉 **Booking Confirmed!**\n\nYour ticket has been booked successfully.\n\n• **Train:** ${train?.name || "—"} (${train?.number || "—"})\n• **Time:** ${train?.departure || "—"} → ${train?.arrival || "—"}\n• **Amount:** ₹${train?.price || "—"}\n\nI've saved this to your bookings. What would you like to do next?`,
      timestamp: new Date(),
      actions: [
        {
          label: "Check PNR Status",
          action: () => {
            setStep("pnr");
          },
        },
        {
          label: "Track Live Journey",
          action: () => {
            setStep("journey");
          },
          primary: true,
        },
        {
          label: "Book Another",
          action: () => {
            setStep("idle");
          },
        },
      ],
    };
    setMessages((prev) => [...prev, aiMsg]);
  }, [confirmBooking, state.selectedTrain, setStep]);

  /* ── Keyboard handler ─────────────────────────────────── */
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="flex flex-col h-full border-l-2 border-[var(--fg)] bg-[var(--bg)] w-[380px] flex-shrink-0">
      {/* Header */}
      <div className="flex items-center justify-between border-b-2 border-[var(--fg)] px-5 h-[60px] flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 flex items-center justify-center bg-[var(--fg)]">
            <Sparkles className="h-3.5 w-3.5 text-[var(--bg)]" />
          </div>
          <div>
            <span className="text-sm font-bold uppercase tracking-[0.05em]">
              AI Assistant
            </span>
            <span className="block text-[10px] text-[var(--muted)] uppercase tracking-[0.15em]">
              {state.step !== "idle" ? "Processing" : "Online · Ready"}
            </span>
          </div>
        </div>
        <button
          onClick={onClose}
          className="w-8 h-8 flex items-center justify-center hover:bg-[var(--fg)]/5 transition-colors"
          aria-label="Close AI assistant"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto app-scroll p-5 space-y-5">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : ""}`}
          >
            <div
              className={`w-8 h-8 flex items-center justify-center flex-shrink-0 ${
                msg.role === "assistant" ? "bg-[var(--fg)]" : "bg-[var(--railway-red)]"
              }`}
            >
              {msg.role === "assistant" ? (
                <Bot className="h-4 w-4 text-[var(--bg)]" />
              ) : (
                <User className="h-4 w-4 text-[var(--bg)]" />
              )}
            </div>
            <div className={`flex-1 max-w-[260px] ${msg.role === "user" ? "text-right" : ""}`}>
              <div
                className={`inline-block text-left px-4 py-3 text-[13px] leading-relaxed ${
                  msg.role === "assistant"
                    ? "border-2 border-[var(--fg)]"
                    : "bg-[var(--fg)] text-[var(--bg)]"
                }`}
              >
                <div className="whitespace-pre-wrap">{msg.content}</div>

                {/* Action buttons */}
                {msg.actions && msg.actions.length > 0 && (
                  <div className="mt-4 space-y-2">
                    {msg.actions.map((action, i) => (
                      <button
                        key={i}
                        onClick={action.action}
                        className={`w-full flex items-center justify-between px-3 py-2 text-[11px] uppercase tracking-[0.1em] font-semibold transition-all duration-150 ${
                          action.primary
                            ? "bg-[var(--fg)] text-[var(--bg)] hover:bg-[var(--railway-red)]"
                            : "border border-[var(--fg)] text-[var(--fg)] hover:bg-[var(--fg)] hover:text-[var(--bg)]"
                        }`}
                      >
                        <span>{action.label}</span>
                        <ArrowRight className="h-3 w-3" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="text-[10px] text-[var(--muted)] mt-1 uppercase tracking-[0.1em]">
                {msg.role === "assistant" ? "RAILY AI" : "You"} ·{" "}
                {msg.timestamp.toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </div>
            </div>
          </div>
        ))}

        {isTyping && (
          <div className="flex gap-3">
            <div className="w-8 h-8 flex items-center justify-center bg-[var(--fg)]">
              <Bot className="h-4 w-4 text-[var(--bg)]" />
            </div>
            <div className="border-2 border-[var(--fg)] px-4 py-3">
              <span className="inline-flex gap-1">
                <span
                  className="w-2 h-2 bg-[var(--fg)]"
                  style={{
                    animation: "typingDot 1.2s ease-in-out infinite",
                    animationDelay: "0ms",
                  }}
                />
                <span
                  className="w-2 h-2 bg-[var(--fg)] opacity-60"
                  style={{
                    animation: "typingDot 1.2s ease-in-out infinite",
                    animationDelay: "300ms",
                  }}
                />
                <span
                  className="w-2 h-2 bg-[var(--fg)] opacity-30"
                  style={{
                    animation: "typingDot 1.2s ease-in-out infinite",
                    animationDelay: "600ms",
                  }}
                />
              </span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Suggestions */}
      {messages.length < 3 && (
        <div className="px-5 py-3 border-t border-[var(--fg)]/20">
          <p className="text-[10px] text-[var(--muted)] uppercase tracking-[0.15em] mb-3">
            Try asking
          </p>
          <div className="flex flex-wrap gap-2">
            {suggestions.map((s, i) => (
              <button
                key={i}
                onClick={() => {
                  handleSubmit(s);
                }}
                className="text-[11px] px-3 py-1.5 border border-[var(--fg)] hover:bg-[var(--fg)] hover:text-[var(--bg)] transition-colors duration-150 uppercase tracking-[0.05em]"
              >
                {s.length > 40 ? s.substring(0, 40) + "…" : s}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Booking flow actions */}
      {state.step === "recommendations" && state.trains.length > 0 && (
        <div className="px-5 py-3 border-t border-[var(--fg)]/20">
          <p className="text-[10px] text-[var(--muted)] uppercase tracking-[0.15em] mb-2">
            Quick Select
          </p>
          <div className="flex flex-wrap gap-2">
            {state.trains
              .filter((t) => t.badge)
              .slice(0, 2)
              .map((train) => (
                <button
                  key={train.id}
                  onClick={() => handleSelectTrain(train)}
                  className="flex items-center gap-2 text-[11px] px-3 py-1.5 bg-[var(--fg)] text-[var(--bg)] hover:bg-[var(--railway-red)] transition-colors duration-150 uppercase tracking-[0.05em]"
                >
                  <Train className="h-3 w-3" />
                  <span>{train.name}</span>
                  <span className="opacity-70">₹{train.price}</span>
                </button>
              ))}
          </div>
        </div>
      )}

      {/* Booking confirmation action */}
      {state.step === "coach-view" && state.selectedSeat && (
        <div className="px-5 py-3 border-t-2 border-[var(--fg)]">
          <div className="flex items-center justify-between mb-3">
            <div className="text-[11px]">
              <span className="font-bold">
                {state.selectedTrain?.name}
              </span>
              <span className="text-[var(--muted)] ml-2">
                · B1 · Seat {state.selectedSeat.replace(/[^0-9]/g, "")}
              </span>
            </div>
            <span className="font-bold text-sm">₹{state.selectedTrain?.price}</span>
          </div>
          <button
            onClick={handleConfirmBooking}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-[var(--fg)] text-[var(--bg)] text-xs uppercase tracking-[0.1em] font-semibold hover:bg-[var(--railway-red)] transition-colors"
          >
            <Check className="h-4 w-4" />
            Confirm Booking
          </button>
        </div>
      )}

      {/* Input */}
      <div className="border-t-2 border-[var(--fg)] p-4">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSubmit();
          }}
          className="flex gap-2"
        >
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about trains..."
            rows={1}
            className="flex-1 bg-transparent border-2 border-[var(--fg)] px-3 py-2.5 text-[13px] outline-none resize-none placeholder:text-[var(--muted)]"
          />
          <button
            type="button"
            className="w-10 h-10 flex items-center justify-center border-2 border-[var(--fg)] hover:bg-[var(--fg)] hover:text-[var(--bg)] transition-colors"
          >
            <Mic className="h-4 w-4" />
          </button>
          <button
            type="submit"
            disabled={!input.trim() || isTyping}
            className="w-10 h-10 flex items-center justify-center bg-[var(--fg)] text-[var(--bg)] disabled:opacity-30 transition-opacity"
          >
            <Send className="h-4 w-4" />
          </button>
        </form>
      </div>
    </div>
  );
}
