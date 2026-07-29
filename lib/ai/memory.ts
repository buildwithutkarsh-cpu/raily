/* ══════════════════════════════════════════════════════════════
   Raily AI — Conversation Memory
   
   Maintains conversation context across turns.
   Uses a sliding window approach with automatic summarization
   when the window is exceeded.
   ══════════════════════════════════════════════════════════════ */

import type { ConversationEntry, ConversationSummary, AIToolCall, ToolResult } from "./types";
import { estimateTokens } from "./prompts";

/* ─── Configuration ──────────────────────────────────────── */

const MAX_CONTEXT_TOKENS = 12_000; // Trigger summarization when exceeded
const MAX_HISTORY_LENGTH = 50; // Max entries before pruning
const SUMMARIZATION_THRESHOLD = 30; // Entries before summarization

/* ─── Memory Manager ─────────────────────────────────────── */

export class ConversationMemory {
  private entries: ConversationEntry[] = [];
  private summary: ConversationSummary | null = null;
  private idCounter = 0;

  /* ── Add Entry ─────────────────────────────────────────── */

  addUserEntry(content: string): ConversationEntry {
    return this.addEntry("user", content);
  }

  addAssistantEntry(content: string, toolCalls?: AIToolCall[]): ConversationEntry {
    return this.addEntry("assistant", content, toolCalls);
  }

  addToolEntry(result: ToolResult): ConversationEntry {
    return this.addEntry("tool", JSON.stringify(result.data || result.error || ""), undefined, result);
  }

  private addEntry(
    role: "user" | "assistant" | "tool",
    content: string,
    toolCalls?: AIToolCall[],
    toolResult?: ToolResult
  ): ConversationEntry {
    const entry: ConversationEntry = {
      id: `conv-${++this.idCounter}`,
      role,
      content,
      toolCalls,
      toolResult,
      timestamp: Date.now(),
      tokens: estimateTokens(content),
    };

    this.entries.push(entry);

    // Auto-prune when exceeded
    if (this.entries.length > MAX_HISTORY_LENGTH) {
      this.prune();
    }

    // Auto-summarize when threshold reached
    if (this.shouldSummarize()) {
      this.generateSummary();
    }

    return entry;
  }

  /* ── Accessors ─────────────────────────────────────────── */

  getEntries(): ConversationEntry[] {
    return [...this.entries];
  }

  getSummary(): ConversationSummary | null {
    return this.summary;
  }

  getContextTokens(): number {
    return this.entries.reduce((sum, e) => sum + e.tokens, 0);
  }

  /* ── Pruning ───────────────────────────────────────────── */

  private prune(): void {
    // Keep the first entry (greeting) and the last N entries
    const firstEntry = this.entries[0];
    const recentEntries = this.entries.slice(-MAX_HISTORY_LENGTH + 1);

    // Check if we should keep the first entry
    if (firstEntry && firstEntry.role === "assistant" && firstEntry.content.includes("travel assistant")) {
      // Keep the welcome message as context
      this.entries = [firstEntry, ...recentEntries];
    } else {
      this.entries = recentEntries;
    }
  }

  /* ── Summarization ─────────────────────────────────────── */

  private shouldSummarize(): boolean {
    return (
      this.entries.length >= SUMMARIZATION_THRESHOLD ||
      this.getContextTokens() >= MAX_CONTEXT_TOKENS
    );
  }

  private generateSummary(): void {
    const recent = this.entries.slice(-10);

    // Extract key information from recent conversation
    const keyInfo: Record<string, string> = {};

    // Look for journey details
    for (const entry of recent) {
      if (entry.role === "assistant") {
        const content = entry.content;

        // Extract train numbers
        const trainMatch = content.match(/\b\d{5}\b/);
        if (trainMatch) keyInfo.lastTrainNumber = trainMatch[0];

        // Extract PNR
        const pnrMatch = content.match(/\b[468]\d{9}\b/);
        if (pnrMatch) keyInfo.lastPNR = pnrMatch[0];

        // Extract station codes
        const stationMatch = content.match(/\b[A-Z]{2,5}\b/g);
        if (stationMatch) {
          if (!keyInfo.stations) keyInfo.stations = stationMatch.join(", ");
        }

        // Extract booked status
        if (content.includes("confirmed") || content.includes("booked")) {
          keyInfo.bookingStatus = "confirmed";
        }
      }
    }

    // Build summary text
    const summaryParts: string[] = [];
    const userMessages = recent.filter((e) => e.role === "user");
    const userIntents = userMessages.map((e) => e.content.slice(0, 100)).join(" | ");

    if (userIntents) {
      summaryParts.push(`User asked about: ${userIntents}`);
    }
    if (keyInfo.lastTrainNumber) {
      summaryParts.push(`Last train: ${keyInfo.lastTrainNumber}`);
    }
    if (keyInfo.lastPNR) {
      summaryParts.push(`Last PNR: ${keyInfo.lastPNR}`);
    }

    this.summary = {
      summary: summaryParts.join(". "),
      keyInfo,
      lastUpdated: Date.now(),
    };
  }

  /* ── Reset ─────────────────────────────────────────────── */

  reset(): void {
    this.entries = [];
    this.summary = null;
    this.idCounter = 0;
  }

  /* ── Serialization ─────────────────────────────────────── */

  toJSON(): { entries: ConversationEntry[]; summary: ConversationSummary | null } {
    return {
      entries: this.entries,
      summary: this.summary,
    };
  }
}

/* ─── Singleton ──────────────────────────────────────────── */

let globalMemory: ConversationMemory | null = null;

export function getConversationMemory(): ConversationMemory {
  if (!globalMemory) {
    globalMemory = new ConversationMemory();
  }
  return globalMemory;
}

export function resetConversationMemory(): void {
  globalMemory = null;
}