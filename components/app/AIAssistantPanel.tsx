"use client";

import { useState, useRef, useEffect } from "react";
import {
  MessageSquare,
  X,
  Send,
  Sparkles,
  User,
  Bot,
  ArrowRight,
  Mic,
} from "lucide-react";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

const suggestions = [
  "Book Delhi → Jaipur tomorrow, lower berth, under ₹800",
  "Fastest train Mumbai → Pune this Friday morning",
  "Overnight trains Bangalore → Chennai, sleeper class",
  "Round trip Delhi → Lucknow → Delhi next weekend",
];

export default function AIAssistantPanel({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content: "I'm your AI travel assistant. Tell me where you'd like to go, and I'll find the best trains for you.",
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || isTyping) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsTyping(true);

    // Simulate AI response
    await new Promise((r) => setTimeout(r, 1200 + Math.random() * 800));

    const responses = [
      "I found 3 trains from Delhi to Jaipur tomorrow. The best option is Rajdhani Express (12951) departing at 06:25, reaching 11:50. Lower berth available at ₹1,245. Would you like me to book it?",
      "The fastest option is Shatabdi Express (12009) departing 07:30, reaching 12:25 — just 4h 55m. I can check berth availability if you'd like.",
      "I've checked overnight options. Yes, there are 2 overnight trains from Bangalore to Chennai with sleeper class. The 22691 Kranti Express departs at 22:15 and reaches at 05:30. Would you like details?",
    ];

    const aiMsg: Message = {
      id: (Date.now() + 1).toString(),
      role: "assistant",
      content: responses[Math.floor(Math.random() * responses.length)],
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, aiMsg]);
    setIsTyping(false);
  };

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
              Online · Ready
            </span>
          </div>
        </div>
        <button
          onClick={onClose}
          className="w-8 h-8 flex items-center justify-center hover:bg-[var(--fg)]/5 transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto app-scroll p-5 space-y-5">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex gap-3 ${
              msg.role === "user" ? "flex-row-reverse" : ""
            }`}
          >
            <div
              className={`w-8 h-8 flex items-center justify-center flex-shrink-0 ${
                msg.role === "assistant"
                  ? "bg-[var(--fg)]"
                  : "bg-[var(--railway-red)]"
              }`}
            >
              {msg.role === "assistant" ? (
                <Bot className="h-4 w-4 text-[var(--bg)]" />
              ) : (
                <User className="h-4 w-4 text-[var(--bg)]" />
              )}
            </div>
            <div
              className={`flex-1 max-w-[260px] ${
                msg.role === "user" ? "text-right" : ""
              }`}
            >
              <div
                className={`inline-block text-left px-4 py-3 text-[13px] leading-relaxed ${
                  msg.role === "assistant"
                    ? "border-2 border-[var(--fg)]"
                    : "bg-[var(--fg)] text-[var(--bg)]"
                }`}
              >
                {msg.content}
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
                <span className="w-2 h-2 bg-[var(--bg)] opacity-100" style={{ animation: "typingDot 1.2s ease-in-out infinite", animationDelay: "0ms" }} />
                <span className="w-2 h-2 bg-[var(--bg)] opacity-60" style={{ animation: "typingDot 1.2s ease-in-out infinite", animationDelay: "300ms" }} />
                <span className="w-2 h-2 bg-[var(--bg)] opacity-30" style={{ animation: "typingDot 1.2s ease-in-out infinite", animationDelay: "600ms" }} />
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
            {suggestions.slice(0, 2).map((s, i) => (
              <button
                key={i}
                onClick={() => {
                  setInput(s);
                  setTimeout(() => handleSubmit(), 100);
                }}
                className="text-[11px] px-3 py-1.5 border border-[var(--fg)] hover:bg-[var(--fg)] hover:text-[var(--bg)] transition-colors duration-150 uppercase tracking-[0.05em]"
              >
                {s.length > 40 ? s.substring(0, 40) + "…" : s}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <div className="border-t-2 border-[var(--fg)] p-4">
        <form onSubmit={handleSubmit} className="flex gap-2">
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
