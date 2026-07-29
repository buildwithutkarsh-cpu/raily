"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useBooking } from "@/lib/booking-store";
import type { Message, ChatComponentType } from "@/lib/booking-store";
import { ArrowUp } from "lucide-react";
import TrainExplorer from "@/features/trains/components/TrainExplorer";
import CoachVisualizer from "@/features/coach/components/CoachVisualizer";
import BookingConfirmation from "@/features/booking/components/BookingConfirmation";
import JourneyTracker from "@/features/journey/components/JourneyTracker";
import PNRManager from "@/features/pnr/components/PNRManager";
import BookingHistory from "@/features/booking/components/BookingHistory";

/* ─── Loading Indicator ───────────────────────────────────── */

function LoadingDots() {
  return (
    <div className="flex items-center gap-1.5 py-2">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="w-1.5 h-1.5 bg-[var(--muted)]"
          style={{
            animation: `pulse-dot 1.2s ease-in-out ${i * 0.2}s infinite`,
          }}
        />
      ))}
    </div>
  );
}

/* ─── Welcome Message ─────────────────────────────────────── */

function WelcomeMessage({
  onSuggestionClick,
}: {
  onSuggestionClick?: (text: string) => void;
}) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight mb-2">
          How can I help you today?
        </h1>
        <p className="text-sm text-[var(--muted)] leading-relaxed">
          I can search trains, book tickets, check PNR status, and track
          your journey across Indian Railways.
        </p>
      </div>

      {/* Quick suggestions */}
      <div className="flex flex-wrap gap-2">
        {[
          "Book Delhi to Jaipur tomorrow",
          "Check PNR status",
          "Track my train",
        ].map((suggestion) => (
          <button
            key={suggestion}
            onClick={() => onSuggestionClick?.(suggestion)}
            className="px-3 py-1.5 text-xs text-[var(--muted)] border border-[var(--border)] hover:border-[var(--fg)] hover:text-[var(--fg)] transition-colors"
          >
            {suggestion}
          </button>
        ))}
      </div>

      {/* Getting Started */}
      <div className="pt-2 border-t border-[var(--border)]">
        <p className="text-[10px] uppercase tracking-[0.1em] text-[var(--muted)] mb-2">
          Getting Started
        </p>
        <p className="text-xs text-[var(--muted)] leading-relaxed">
          Just type your request naturally. No forms. No navigation.
          Everything happens in this conversation.
        </p>
      </div>
    </div>
  );
}

/* ─── Animated Streaming Text ──────────────────────────────── */

function StreamingText({ content }: { content: string }) {
  // Split on tool call indicators (italics markers)
  const parts = content.split(/(_\→ .*?\.\.\._)/g);

  return (
    <div className="text-sm leading-relaxed whitespace-pre-wrap">
      {parts.map((part, i) => {
        if (part.startsWith("_→") && part.endsWith("_")) {
          // Tool call indicator — show subtly
          return (
            <span key={i} className="text-[11px] text-[var(--muted)] italic">
              {part.replace(/_/g, "")}
            </span>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </div>
  );
}

/* ─── Message Bubble ──────────────────────────────────────── */

function MessageContent({
  message,
  onSuggestionClick,
}: {
  message: Message;
  onSuggestionClick?: (text: string) => void;
}) {
  // Render inline component based on message type
  const renderComponent = (type: ChatComponentType) => {
    switch (type) {
      case "train-list":
        return <TrainExplorer />;
      case "seat-map":
        return <CoachVisualizer />;
      case "booking-confirmation":
        return <BookingConfirmation />;
      case "journey-tracker":
        return <JourneyTracker />;
      case "pnr-status":
        return <PNRManager />;
      case "booking-history":
        return <BookingHistory />;
      case "welcome":
        return <WelcomeMessage onSuggestionClick={onSuggestionClick} />;
      case "loading":
        return <LoadingDots />;
      default:
        return null;
    }
  };

  // Parse inline markdown-like bold markers
  const formatText = (text: string) => {
    const parts = text.split(/(\*\*[^*]+\*\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        return (
          <strong key={i} className="font-semibold">
            {part.slice(2, -2)}
          </strong>
        );
      }
      return part;
    });
  };

  return (
    <div className="space-y-3">
      {/* Text content */}
      {message.content && message.component !== "welcome" && (
        message.streaming ? (
          <StreamingText content={message.content} />
        ) : (
          <div className="text-sm leading-relaxed whitespace-pre-wrap">
            {formatText(message.content)}
          </div>
        )
      )}

      {/* Render inline component */}
      {message.component && !message.streaming && renderComponent(message.component)}

      {/* Loading indicator for streaming without text yet */}
      {message.streaming && !message.content && (
        <LoadingDots />
      )}

      {/* Suggestions for welcome */}
      {message.component === "welcome" && onSuggestionClick && (
        <div className="flex flex-wrap gap-2">
          {[
            "Book Delhi to Jaipur tomorrow",
            "Check PNR status",
            "Track my train",
          ].map((suggestion) => (
            <button
              key={suggestion}
              onClick={() => onSuggestionClick(suggestion)}
              className="px-3 py-1.5 text-xs text-[var(--muted)] border border-[var(--border)] hover:border-[var(--fg)] hover:text-[var(--fg)] transition-colors"
            >
              {suggestion}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Chat Message ────────────────────────────────────────── */

function ChatMessage({
  message,
  onSuggestionClick,
}: {
  message: Message;
  onSuggestionClick?: (text: string) => void;
}) {
  const isUser = message.role === "user";

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
      className={`flex ${isUser ? "justify-end" : "justify-start"}`}
    >
      <div
        className={`max-w-[85%] ${
          isUser
            ? "bg-[var(--fg)] text-[var(--bg)] px-4 py-2.5"
            : ""
        }`}
      >
        {isUser ? (
          <p className="text-sm leading-relaxed">{message.content}</p>
        ) : (
          <MessageContent
            message={message}
            onSuggestionClick={onSuggestionClick}
          />
        )}
      </div>
    </motion.div>
  );
}

/* ─── Input Bar ───────────────────────────────────────────── */

function ChatInput({
  onSend,
  disabled,
}: {
  onSend: (text: string) => void;
  disabled: boolean;
}) {
  const [input, setInput] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = useCallback(() => {
    const trimmed = input.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setInput("");
  }, [input, disabled, onSend]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit]
  );

  // Auto-focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  return (
    <div className="border-t border-[var(--border)] bg-[var(--bg)]">
      <div className="max-w-[var(--chat-max-width)] mx-auto px-6 py-4">
        <div className="flex items-center gap-2 border border-[var(--border)] focus-within:border-[var(--fg)] transition-colors">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask me anything about your journey..."
            disabled={disabled}
            className="flex-1 bg-transparent px-4 py-3 text-sm outline-none placeholder:text-[var(--muted)] disabled:opacity-50"
          />
          <button
            onClick={handleSubmit}
            disabled={!input.trim() || disabled}
            className="w-9 h-9 flex items-center justify-center mr-1 bg-[var(--fg)] text-[var(--bg)] disabled:bg-[var(--border)] disabled:text-[var(--muted)] transition-colors"
          >
            <ArrowUp className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── AI Assistant Panel ──────────────────────────────────── */

export default function AIAssistantPanel() {
  const { state, processUserInput } = useBooking();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [state.messages]);

  // Re-scroll when streaming content updates
  useEffect(() => {
    const lastMsg = state.messages[state.messages.length - 1];
    if (lastMsg?.streaming) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [state.messages]);

  const handleSend = useCallback(
    async (text: string) => {
      setIsProcessing(true);
      try {
        await processUserInput(text);
      } finally {
        setIsProcessing(false);
      }
    },
    [processUserInput]
  );

  const handleSuggestionClick = useCallback(
    (text: string) => {
      handleSend(text);
    },
    [handleSend]
  );

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Messages area */}
      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto scroll-smooth"
      >
        <div className="max-w-[var(--chat-max-width)] mx-auto px-6 py-8 space-y-6">
          <AnimatePresence mode="popLayout">
            {state.messages.map((message) => (
              <ChatMessage
                key={message.id}
                message={message}
                onSuggestionClick={handleSuggestionClick}
              />
            ))}
          </AnimatePresence>
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input bar */}
      <ChatInput onSend={handleSend} disabled={isProcessing} />
    </div>
  );
}