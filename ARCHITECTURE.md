# Raily Architecture

**Version:** 0.1.0
**Last Updated:** July 2026
**Status:** Active Development

> Raily is a speculative reimagining of India's railway experience for the modern era. It is an AI-native railway operating system — not a booking website, not a dashboard, not a chatbot. The conversation is the interface.

---

## Table of Contents

1. [Product Philosophy](#1-product-philosophy)
2. [High-Level System Architecture](#2-high-level-system-architecture)
3. [Folder Structure](#3-folder-structure)
4. [Feature Architecture](#4-feature-architecture)
5. [Component Architecture](#5-component-architecture)
6. [Routing Architecture](#6-routing-architecture)
7. [State Management](#7-state-management)
8. [API Architecture](#8-api-architecture)
9. [AI Architecture](#9-ai-architecture)
10. [RAPI Integration](#10-rapi-integration)
11. [Data Flow](#11-data-flow)
12. [Design System](#12-design-system)
13. [Engineering Standards](#13-engineering-standards)
14. [Security](#14-security)
15. [Performance](#15-performance)
16. [Current Technical Debt](#16-current-technical-debt)
17. [Refactoring Opportunities](#17-refactoring-opportunities)
18. [Roadmap](#18-roadmap)
19. [Appendix](#19-appendix)

---

## 1. Product Philosophy

### Why Raily Exists

Indian Railways is the world's fourth-largest railway network, serving over 20 million passengers daily. Yet the digital experience — dominated by IRCTC — remains form-based, page-driven, and transaction-oriented. Raily reimagines this entirely.

### Why Conversation-First

Traditional railway apps require users to navigate forms, pages, and menus to complete simple tasks like booking a ticket or checking PNR status. Raily eliminates this friction. The user types naturally:

> "Book Delhi to Jaipur tomorrow morning"

The AI handles everything: intent detection, station resolution, train search, recommendation, seat selection, booking, and confirmation. All within a single conversation.

### Why AI Is the Operating System

Raily is not a website with an AI chatbot attached. The AI **is** the application. Every interaction — search, booking, tracking, PNR check — flows through the LLM. The AI decides when to call RAPI, which UI component to render, and how to present information. The frontend is a thin rendering layer.

### Why RAPI Is the Source of Truth

The LLM never invents railway facts. RAPI (Raily API) is a self-hosted, scraping-based REST API that provides all railway data. The AI reasons over live data from RAPI. If the AI needs train schedules, it calls `search_trains`. If it needs PNR status, it calls `get_pnr_status`. No data is fabricated.

### Why Traditional Dashboards Are Avoided

There is no sidebar, no dashboard, no card grid, no floating widgets. The interface is a single centered conversation. Every interactive element — train lists, seat maps, booking confirmations, journey timelines — appears inline within the chat. The interface disappears behind the conversation.

---

## 2. High-Level System Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        BROWSER (Next.js)                            │
│                                                                     │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │                    Raily Frontend                              │  │
│  │                                                                │  │
│  │  ┌──────────┐  ┌─────────────────┐  ┌──────────────────────┐ │  │
│  │  │ Landing  │  │  App Layout      │  │  Auth (Clerk)        │ │  │
│  │  │ Page     │  │  (Centered Chat) │  │  Sign In / Sign Up   │ │  │
│  │  └──────────┘  └────────┬────────┘  └──────────────────────┘ │  │
│  │                          │                                     │  │
│  │  ┌───────────────────────▼──────────────────────────────────┐  │  │
│  │  │              AIAssistantPanel                             │  │  │
│  │  │  ┌─────────────┐  ┌──────────────┐  ┌───────────────┐  │  │  │
│  │  │  │ ChatInput   │  │ MessageList  │  │ StreamingText │  │  │  │
│  │  │  └─────────────┘  └──────┬───────┘  └───────────────┘  │  │  │
│  │  │                          │                              │  │  │
│  │  │  ┌───────────────────────▼───────────────────────────┐  │  │  │
│  │  │  │         Inline Components (rendered by AI)         │  │  │  │
│  │  │  │  ┌──────────┐ ┌──────────┐ ┌──────────────────┐  │  │  │
│  │  │  │  │Train     │ │Coach     │ │Booking           │  │  │  │
│  │  │  │  │Explorer  │ │Visualizer│ │Confirmation      │  │  │  │
│  │  │  │  └──────────┘ └──────────┘ └──────────────────┘  │  │  │  │
│  │  │  │  ┌──────────┐ ┌──────────┐ ┌──────────────────┐  │  │  │  │
│  │  │  │  │Journey   │ │PNR      │ │Booking           │  │  │  │  │
│  │  │  │  │Tracker   │ │Manager  │ │History           │  │  │  │  │
│  │  │  │  └──────────┘ └──────────┘ └──────────────────┘  │  │  │  │
│  │  │  └──────────────────────────────────────────────────┘  │  │  │
│  │  └────────────────────────────────────────────────────────┘  │  │
│  │                                                                │  │
│  │  ┌──────────────────────────────────────────────────────────┐  │  │
│  │  │                  State Management                         │  │  │
│  │  │  ┌─────────────────┐  ┌──────────────┐  ┌─────────────┐ │  │  │
│  │  │  │ booking-store   │  │ Conversation │  │ React Query │ │  │  │
│  │  │  │ (React Context) │  │ Memory       │  │ (Cache)     │ │  │  │
│  │  │  └────────┬────────┘  └──────────────┘  └─────────────┘ │  │  │
│  │  └───────────┼──────────────────────────────────────────────┘  │  │
│  │              │                                                 │  │
│  │  ┌───────────▼──────────────────────────────────────────────┐  │  │
│  │  │                       AI Layer                            │  │  │
│  │  │  ┌──────────┐ ┌──────────┐ ┌────────┐ ┌──────────────┐  │  │  │
│  │  │  │Provider  │ │Tools     │ │Prompts │ │Memory        │  │  │  │
│  │  │  │(Groq/OR) │ │(RAPI)    │ │Manager │ │(Conversation)│  │  │  │
│  │  │  └────┬─────┘ └────┬─────┘ └────┬───┘ └──────────────┘  │  │  │
│  │  │       └─────────────┴────────────┘                        │  │  │
│  │  │                      │                                     │  │  │
│  │  │              ┌───────▼───────┐                             │  │  │
│  │  │              │ Orchestrator  │                             │  │  │
│  │  │              └───────┬───────┘                             │  │  │
│  │  └──────────────────────┼────────────────────────────────────┘  │  │
│  │                         │                                       │  │
│  │  ┌──────────────────────▼────────────────────────────────────┐  │  │
│  │  │              RAPI Client Layer (lib/rapi/)                 │  │  │
│  │  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐ │  │  │
│  │  │  │Client    │ │Endpoints │ │Transform │ │Hooks (React  │ │  │  │
│  │  │  │(fetch)   │ │(typed)   │ │(camelCase)│ │Query)        │ │  │  │
│  │  │  └──────────┘ └──────────┘ └──────────┘ └──────────────┘ │  │  │
│  │  └──────────────────────┬────────────────────────────────────┘  │  │
│  │                         │                                       │  │
│  └─────────────────────────┼───────────────────────────────────────┘  │
│                            │ HTTP/JSON                                 │
│  ┌─────────────────────────▼───────────────────────────────────────┐  │
│  │                      RAPI Server (Express)                       │  │
│  │                                                                  │  │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────────────────┐  │  │
│  │  │ PNR      │ │ Trains   │ │ Stations │ │ Admin (Cache/Mon)  │  │  │
│  │  │/api/v1   │ │ /api/v1  │ │ /api/v1  │ │ /api/v1            │  │  │
│  │  └────┬─────┘ └────┬─────┘ └────┬─────┘ └────────────────────┘  │  │
│  │       └─────────────┴────────────┘                                │  │
│  │                      │                                           │  │
│  │  ┌───────────────────▼───────────────────────────────────────┐  │  │
│  │  │              Scraper Layer                                  │  │  │
│  │  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐  │  │  │
│  │  │  │Erail     │ │Confirm   │ │Etrain    │ │CommonCaptcha │  │  │  │
│  │  │  │Scraper   │ │Tkt PNR   │ │Live      │ │PNR           │  │  │  │
│  │  │  └──────────┘ └──────────┘ └──────────┘ └──────────────┘  │  │  │
│  │  └────────────────────────────────────────────────────────────┘  │  │
│  │                      │                                           │  │
│  │  ┌───────────────────▼───────────────────────────────────────┐  │  │
│  │  │              Cache Layer (NodeCache)                       │  │  │
│  │  │  SWR + Stale-While-Revalidate + LRU Eviction + Locking     │  │  │
│  │  └────────────────────────────────────────────────────────────┘  │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                      │                                                 │
│  ┌───────────────────▼───────────────────────────────────────────────┐│
│  │                    External Sources                                ││
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────────────┐ ││
│  │  │ erail.in │ │confirmtkt│ │etrain.info│ │indianrail.gov.in    │ ││
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────────────────┘ ││
│  └───────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────┘

                     ┌──────────────────────────────┐
                     │     External Services        │
                     │  ┌────────┐ ┌────────────┐   │
                     │  │ Groq   │ │ OpenRouter │   │
                     │  │ (LLM)  │ │ (Fallback) │   │
                     │  └────────┘ └────────────┘   │
                     │  ┌────────┐ ┌────────────┐   │
                     │  │ Clerk  │ │ Resend     │   │
                     │  │ (Auth) │ │ (Email)    │   │
                     │  └────────┘ └────────────┘   │
                     └──────────────────────────────┘
```

### Data Flow Summary

```
User Input → AIAssistantPanel → booking-store.processUserInput
                                         ↓
                              lib/ai/orchestrator.processWithAI
                                         ↓
                          ┌────────────────┴────────────────┐
                          ↓                                 ↓
                 lib/ai/provider.ts                 lib/ai/tools.ts
                 (Groq/OpenRouter SSE)               (RAPI Execution)
                          ↓                                 ↓
                 Streaming Text + Tool Calls        Tool Results → Memory
                          ↓                                 ↓
                          └────────────────┬────────────────┘
                                           ↓
                                Second LLM Pass (reasoning)
                                           ↓
                              Final Response + UI Component
                                           ↓
                              AIAssistantPanel (renders inline)
```

---

## 3. Folder Structure

```
raily/
├── app/                          # Next.js App Router
│   ├── layout.tsx                # Root layout (Clerk, fonts, globals)
│   ├── page.tsx                  # Landing page (hero, features, FAQ)
│   ├── globals.css               # Design system tokens + CSS
│   ├── app/                      # Protected app route
│   │   ├── layout.tsx            # App layout (RapiQueryProvider + AppLayout)
│   │   └── page.tsx              # App entry (returns null, AppLayout handles everything)
│   ├── sign-in/                  # Clerk sign-in page
│   ├── sign-up/                  # Clerk sign-up page
│   └── api/                      # API routes (Next.js)
│       └── ticket/send/route.ts  # Email ticket PDF via Resend
│
├── components/                   # React components
│   ├── app/                      # Application components (chat interface)
│   │   ├── AppLayout.tsx         # Root layout: top bar + AIAssistantPanel
│   │   ├── AIAssistantPanel.tsx  # Main chat interface with streaming
│   │   ├── TrainExplorer.tsx     # Inline train list (departure board style)
│   │   ├── CoachVisualizer.tsx   # Inline seat map (architectural diagram)
│   │   ├── BookingConfirmation.tsx  # Inline booking ticket
│   │   ├── JourneyTracker.tsx    # Inline journey timeline (metro map style)
│   │   ├── PNRManager.tsx        # Inline PNR status card
│   │   ├── BookingHistory.tsx    # Inline past bookings list
│   │   ├── UserMenu.tsx          # User menu (sign out)
│   │   ├── NotificationsPanel.tsx  # Stub (minimal, unused)
│   │   ├── TravelPlanner.tsx     # Stub (minimal, unused)
│   │   ├── AppSidebar.tsx        # Dead (from old dashboard architecture)
│   │   ├── TopBar.tsx            # Dead (duplicate, inline version in AppLayout)
│   │   └── BookingHistory.tsx    # Inline past bookings list (expandable cards)
│   ├── Hero.tsx                  # Dead (old landing page, GSAP-based)
│   ├── LandingHeader.tsx         # Dead (old landing page)
│   ├── LandingSections.tsx       # Dead (old landing page)
│   └── Cursor.tsx                # Dead (custom cursor component)
│
├── lib/                          # Core libraries
│   ├── ai/                       # AI-native architecture
│   │   ├── index.ts              # Barrel export
│   │   ├── types.ts              # Core types (provider, messages, tools, streaming)
│   │   ├── provider.ts           # AI provider layer (Groq + OpenRouter)
│   │   ├── tools.ts              # Tool definitions + execution engine (RAPI)
│   │   ├── prompts.ts            # System prompt + context builder + parser
│   │   ├── memory.ts             # Conversation memory (sliding window + summarization)
│   │   └── orchestrator.ts       # Central orchestration (intent → tools → response)
│   │
│   ├── rapi/                     # RAPI client layer
│   │   ├── client.ts             # HTTP client with error classes, timeout, rate limiting
│   │   ├── endpoints.ts          # 10 typed endpoint functions (stations, trains, PNR, etc.)
│   │   ├── hooks.ts              # TanStack Query hooks (caching, retries, background refresh)
│   │   ├── provider.tsx           # React Query provider wrapper
│   │   └── transform.ts          # snake_case → camelCase transformation layer
│   │
│   ├── booking-store.tsx         # Global state (React Context) — messages, booking, AI
│   ├── ticket-pdf.ts             # PDF ticket generation (PDFKit)
│   └── railway/                  # DELETED — old mock-based architecture
│       ├── types.ts              # Old normalized types (replaced by lib/rapi/)
│       ├── client.ts             # Old multi-provider client (deleted)
│       ├── provider.ts           # Old provider interface (deleted)
│       ├── mock-provider.ts      # Old mock data (deleted)
│       ├── rapi-provider.ts      # Old RAPI wrapper (deleted)
│       ├── indianrailapi-provider.ts  # Old provider (deleted)
│       ├── irctc-api-provider.ts # Old provider (deleted)
│       ├── railkit-provider.ts   # Old provider (deleted)
│       └── cache.ts              # Old caching layer (deleted)
│
├── Rapi/                         # Self-hosted Railway API (Express server)
│   ├── src/
│   │   ├── index.ts              # Express server entry point
│   │   ├── config.ts             # Environment config, source URLs
│   │   ├── cache.ts              # In-memory cache (SWR, LRU, locking)
│   │   ├── routes/
│   │   │   ├── trains.ts         # Train search, info, live, availability, fare
│   │   │   ├── pnr.ts            # PNR status
│   │   │   ├── stations.ts       # Station autocomplete (local JSON search)
│   │   │   └── admin.ts          # Cache health, telemetry, flush
│   │   ├── scrapers/
│   │   │   ├── client.ts         # HTTP client with cookie jar, retries, headers
│   │   │   ├── searchScraper.ts  # erail.in train search scraper
│   │   │   ├── infoScraper.ts    # erail.in train info scraper
│   │   │   ├── liveStatusScraper.ts  # etrain.info live status scraper
│   │   │   ├── pnrScraper.ts     # confirmtkt PNR scraper (with CAPTCHA solving)
│   │   │   └── availabilityScraper.ts # erail.in availability scraper
│   │   ├── utils/
│   │   │   ├── parser.ts         # HTML parsing utilities
│   │   │   ├── headers.ts        # Browser header generation
│   │   │   └── errors.ts         # Error codes
│   │   └── data/
│   │       └── stations.json     # 8,000+ Indian railway stations
│   ├── test/                     # Vitest test suite
│   │   ├── setup.ts              # Test helpers
│   │   ├── chaos.test.ts         # Chaos + stress tests
│   │   ├── load-benchmark.ts     # Load benchmark
│   │   ├── memory-eviction.test.ts  # Cache eviction tests
│   │   ├── security-fuzzing.test.ts  # Security fuzzing
│   │   └── security-headers.test.ts  # Security header validation
│   ├── package.json
│   └── tsconfig.json
│
├── AGENTS.md                     # Next.js constraint rules (must read before coding)
├── .env.example                  # Environment variables template
├── proxy.ts                      # Clerk middleware (protected routes)
├── next.config.ts                # Next.js configuration
├── tsconfig.json                 # TypeScript configuration
├── vercel.json                   # Vercel deployment config
├── render.yaml                   # Render deployment config (Rapi)
└── package.json
```

---

## 4. Feature Architecture

### 4.1 Chat (Core Interface)

| Aspect | Detail |
|--------|--------|
| **Purpose** | Primary interaction model. Every feature is accessed through conversation. |
| **Implementation** | `AIAssistantPanel.tsx` renders messages with inline components. `booking-store.tsx` manages state. `lib/ai/` orchestrates AI responses. |
| **Dependencies** | `lib/ai/*`, `lib/booking-store.tsx`, `framermotion` |
| **State** | `BookingState.messages` (array of `Message` objects) |
| **Future** | Markdown rendering, code blocks, message editing, conversation branching |

### 4.2 Train Search (AI-Driven)

| Aspect | Detail |
|--------|--------|
| **Purpose** | Search trains between stations using natural language |
| **Flow** | User types "Book Delhi to Jaipur tomorrow" → AI calls `search_trains` tool → RAPI scrapes erail.in → AI presents results → renders `TrainExplorer` component |
| **Dependencies** | `lib/ai/tools.ts` → `lib/rapi/endpoints.ts` → RAPI → erail.in |
| **State** | `BookingState.trains`, `BookingState.query` |
| **Future** | Date-based filtering, class filtering, multi-route comparison |

### 4.3 Coach Visualizer

| Aspect | Detail |
|--------|--------|
| **Purpose** | Interactive seat map showing berth layout, availability, and AI recommendation |
| **Implementation** | `CoachVisualizer.tsx` generates a 6-bay coach layout with 3-tier berths. Static simulation (no live coach data). |
| **Dependencies** | `lib/booking-store.tsx`, `framermotion` |
| **State** | `BookingState.selectedCoach`, `BookingState.selectedSeat`, `BookingState.seatRecommendation` |
| **Future** | Live coach composition from RAPI, real seat availability, multiple coach types |

### 4.4 Booking Confirmation

| Aspect | Detail |
|--------|--------|
| **Purpose** | Premium ticket-like confirmation with PNR, route, passenger details |
| **Implementation** | `BookingConfirmation.tsx` renders a mock ticket with animated entrance. PNR is generated deterministically from train number + timestamp. |
| **Dependencies** | `lib/booking-store.tsx`, `framermotion` |
| **State** | `BookingState.bookingConfirmed`, `BookingState.pnrNumber` |
| **Future** | Real IRCTC booking integration, PDF download, email delivery |

### 4.5 Journey Tracking

| Aspect | Detail |
|--------|--------|
| **Purpose** | Real-time journey timeline with station progress, delays, and AI notes |
| **Implementation** | `JourneyTracker.tsx` renders a metro-map-style timeline. Currently uses hardcoded mock data. |
| **Dependencies** | `framermotion` |
| **Future** | Live status from RAPI `get_live_status`, auto-refresh, delay notifications |

### 4.6 PNR Status

| Aspect | Detail |
|--------|--------|
| **Purpose** | Check PNR status with passenger details, coach/berth info, chart status |
| **Implementation** | `PNRManager.tsx` renders PNR details card. Currently uses hardcoded mock data. |
| **Dependencies** | `lib/booking-store.tsx`, `framermotion` |
| **Future** | Real PNR lookup via RAPI, push notifications on status change |

### 4.7 Booking History

| Aspect | Detail |
|--------|--------|
| **Purpose** | View past bookings stored in localStorage |
| **Implementation** | `BookingHistory.tsx` renders expandable booking cards. `getStoredRecentBookings()` reads from localStorage. |
| **Dependencies** | `lib/booking-store.tsx`, `framermotion` |
| **Future** | Server-side booking history, sync across devices, analytics |

### 4.8 AI (Core Intelligence)

| Aspect | Detail |
|--------|--------|
| **Purpose** | Understands user intent, calls RAPI tools, generates responses, renders UI components |
| **Implementation** | `lib/ai/` — 7 files: provider, tools, prompts, memory, orchestrator |
| **Dependencies** | Groq (primary), OpenRouter (fallback), `lib/rapi/*` |
| **State** | `ConversationMemory` (sliding window + summarization) |
| **Future** | Multi-turn reasoning, proactive suggestions, travel planning |

### 4.9 Notifications (Stub)

| Aspect | Detail |
|--------|--------|
| **Purpose** | Placeholder for future notification system |
| **Implementation** | `NotificationsPanel.tsx` is a minimal stub. Not imported or rendered. |

### 4.10 Travel Planner (Stub)

| Aspect | Detail |
|--------|--------|
| **Purpose** | Placeholder for future multi-city trip planning |
| **Implementation** | `TravelPlanner.tsx` is a minimal stub. Not imported or rendered. |

---

## 5. Component Architecture

### Component Hierarchy

```
AppLayout
├── TopBar (inline)
│   ├── Brand (RAILY logo + name)
│   └── User Profile (name + avatar initial)
│
└── AIAssistantPanel
    ├── ChatInput
    │   └── Input (text) + Submit Button (ArrowUp icon)
    │
    └── MessageList
        └── ChatMessage (per message)
            ├── User Message (right-aligned, dark background)
            └── Assistant Message
                ├── MessageContent
                │   ├── StreamingText (if streaming)
                │   ├── TrainExplorer (if component === "train-list")
                │   ├── CoachVisualizer (if component === "seat-map")
                │   ├── BookingConfirmation (if component === "booking-confirmation")
                │   ├── JourneyTracker (if component === "journey-tracker")
                │   ├── PNRManager (if component === "pnr-status")
                │   ├── BookingHistory (if component === "booking-history")
                │   ├── WelcomeMessage (if component === "welcome")
                │   └── LoadingDots (if component === "loading" or streaming without text)
                └── SuggestionButtons (if component === "welcome")
```

### Component Details

| Component | File | Props | State | Notes |
|-----------|------|-------|-------|-------|
| `AppLayout` | `components/app/AppLayout.tsx` | none | none | Wraps `BookingProvider`, renders `TopBar` inline + `AIAssistantPanel` |
| `AIAssistantPanel` | `components/app/AIAssistantPanel.tsx` | none | `isProcessing` | Main chat interface, reads `state.messages` from `useBooking()` |
| `ChatInput` | (inline in AIAssistantPanel) | `onSend`, `disabled` | `input` | Auto-focuses on mount, Enter to submit |
| `ChatMessage` | (inline in AIAssistantPanel) | `message`, `onSuggestionClick` | none | Animated entrance via framer-motion |
| `MessageContent` | (inline in AIAssistantPanel) | `message`, `onSuggestionClick` | none | Routes to inline components or renders formatted text |
| `TrainExplorer` | `components/app/TrainExplorer.tsx` | none | `sortBy` | Reads `state.trains` + `state.query` from `useBooking()` |
| `CoachVisualizer` | `components/app/CoachVisualizer.tsx` | none | `coachIndex` | Reads `state.selectedTrain` from `useBooking()` |
| `BookingConfirmation` | `components/app/BookingConfirmation.tsx` | none | none | Reads `state` from `useBooking()` |
| `JourneyTracker` | `components/app/JourneyTracker.tsx` | none | `trainName`, `trainNumber`, `currentSpeed`, `delay` | Hardcoded mock data |
| `PNRManager` | `components/app/PNRManager.tsx` | none | none | Hardcoded mock data |
| `BookingHistory` | `components/app/BookingHistory.tsx` | none | `selected` | Hardcoded mock bookings |
| `UserMenu` | `components/app/UserMenu.tsx` | none | none | Sign out button, reads Clerk's `useAuth` |
| `WelcomeMessage` | (inline in AIAssistantPanel) | `onSuggestionClick` | none | Static welcome UI with suggestion buttons |

### Dead Components (Not Imported)

| Component | File | Notes |
|-----------|------|-------|
| `AppSidebar` | `components/app/AppSidebar.tsx` | Old dashboard sidebar |
| `TopBar` | `components/app/TopBar.tsx` | Duplicate — inline version in AppLayout used |
| `NotificationsPanel` | `components/app/NotificationsPanel.tsx` | Stub, never imported |
| `TravelPlanner` | `components/app/TravelPlanner.tsx` | Stub, never imported |
| `Hero` | `components/Hero.tsx` | Old GSAP hero |
| `LandingHeader` | `components/LandingHeader.tsx` | Old GSAP header |
| `LandingSections` | `components/LandingSections.tsx` | Old GSAP sections |
| `Cursor` | `components/Cursor.tsx` | Old custom cursor |

---

## 6. Routing Architecture

```
/                → Landing page (public)
/app             → App layout (protected, redirects to sign-in if unauthenticated)
/app/*           → App page (returns null, AppLayout renders everything)
/sign-in         → Clerk sign-in page
/sign-up         → Clerk sign-up page
/api/ticket/send → POST endpoint for email ticket PDF
```

### Route Protection

Protected by Clerk middleware in `proxy.ts`:

```typescript
const isProtectedRoute = createRouteMatcher(["/app(.*)"]);
export default clerkMiddleware(async (auth, req) => {
  if (isProtectedRoute(req)) {
    await auth.protect();
  }
});
```

### Layout Structure

```
RootLayout (app/layout.tsx)
├── ClerkProvider (authentication)
├── IBM Plex Sans + Mono fonts
└── globals.css
    │
    ├── Landing Page (app/page.tsx)
    │   └── Self-contained: hero, features, FAQ, footer
    │
    └── App Layout (app/app/layout.tsx)
        └── RapiQueryProvider (React Query)
            └── AppLayout (components/app/AppLayout.tsx)
                └── BookingProvider (state)
                    └── AIAssistantPanel (chat)
```

---

## 7. State Management

### Global State (React Context)

| Context | File | Provides |
|---------|------|----------|
| `BookingContext` | `lib/booking-store.tsx` | `BookingState`, `processUserInput`, `selectTrain`, `confirmBooking`, `addMessage`, etc. |

### Booking State Shape

```typescript
interface BookingState {
  step: BookingStep;           // "idle" | "searching" | "recommendations" | "coach-view" | etc.
  query: ExtractedQuery | null;  // Parsed user query (origin, destination, date, budget)
  trains: Train[];             // Current train search results
  selectedTrain: Train | null; // User-selected train
  selectedCoach: string;       // Currently selected coach (e.g. "B1")
  selectedSeat: string | null; // Currently selected seat ID
  seatRecommendation: SeatRecommendation | null; // AI seat recommendation
  bookingConfirmed: boolean;   // Whether booking is confirmed
  pnrNumber: string | null;    // Generated PNR
  isProcessing: boolean;       // Whether AI is processing
  messages: Message[];         // Chat message history
  rapiConnected: boolean;      // RAPI server health
  rapiError: string | null;    // RAPI error message
  aiConfigured: boolean;       // AI provider configured
  aiError: string | null;      // AI provider error
}
```

### Local State (React useState)

| Component | State | Purpose |
|-----------|-------|---------|
| `AIAssistantPanel` | `isProcessing` | Disables input during AI processing |
| `ChatInput` | `input` | Controlled input value |
| `TrainExplorer` | `sortBy` | "departure" | "price" | "duration" |
| `CoachVisualizer` | `coachIndex` | 0-5, which coach to display |
| `JourneyTracker` | `trainName`, `trainNumber`, `currentSpeed`, `delay` | Mock data state |
| `BookingHistory` | `selected` | Expanded booking PNR |

### React Query Cache (TanStack Query)

| Hook | File | Caches | Stale Time |
|------|------|--------|------------|
| `useStations` | `lib/rapi/hooks.ts` | Station autocomplete | 1 hour |
| `useTrainSearch` | `lib/rapi/hooks.ts` | Train search results | 10 min |
| `useTrainInfo` | `lib/rapi/hooks.ts` | Train info + route | 24 hours |
| `useLiveStatus` | `lib/rapi/hooks.ts` | Live train status | 2 min (auto-refresh) |
| `useAvailability` | `lib/rapi/hooks.ts` | Seat availability | 2 min |
| `useFare` | `lib/rapi/hooks.ts` | Fare details | 5 min |
| `usePNRStatus` | `lib/rapi/hooks.ts` | PNR status | 3 min |
| `useRapiHealth` | `lib/rapi/hooks.ts` | RAPI server health | 5 min |

### Conversation Memory (AI Context)

| Aspect | Detail |
|--------|--------|
| **Type** | In-memory sliding window (`ConversationMemory` class in `lib/ai/memory.ts`) |
| **Max History** | 50 entries |
| **Max Tokens** | 12,000 tokens before summarization |
| **Summarization** | Auto-generated when threshold reached, extracts: last train number, last PNR, stations, booking status |
| **Persistence** | None (resets on page refresh) |

### Persistent Storage

| Data | Storage | Key |
|------|---------|-----|
| Recent bookings | `localStorage` | `raily_recent_bookings` (max 5) |

---

## 8. API Architecture

### 8.1 RAPI Endpoints (Self-Hosted)

| Endpoint | Method | Description | Cache TTL |
|----------|--------|-------------|-----------|
| `/api/v1/pnr/:pnr` | GET | PNR status (10-digit) | 3 min |
| `/api/v1/trains/search?from=&to=&date=` | GET | Train search between stations | 10 min |
| `/api/v1/trains/:trainNumber/live?date=` | GET | Live running status | 2 min |
| `/api/v1/trains/:trainNumber/info` | GET | Train info + route schedule | 24 hr |
| `/api/v1/trains/:trainNumber/availability` | GET | Seat availability | 2 min |
| `/api/v1/trains/:trainNumber/fare` | GET | Fare details | 2 min |
| `/api/v1/stations/autocomplete?q=` | GET | Station autocomplete | ∞ (local JSON) |
| `/api/v1/admin/health` | GET | Server health + cache stats | None |
| `/api/v1/admin/cache` | GET | Cache telemetry | None |
| `/api/v1/admin/cache/flush` | POST | Clear cache (requires key) | None |

### 8.2 RAPI Request Flow

```
Client → RapiApiClient.get() → fetch() → RAPI Server → Scraper → External Source
                                    ↓                            ↓
                               Error check                   Parse HTML
                                    ↓                            ↓
                              Return JSON ←── Cache (SWR) ←─── Clean data
```

### 8.3 RAPI Cache Architecture

The RAPI server uses a sophisticated in-memory cache with:

- **Stale-While-Revalidate (SWR):** Serve stale data immediately, refresh in background
- **Background Refresh Locking:** Prevents stampede (only one refresh per key)
- **Minimum Scrape Interval:** 30s minimum between scrapes of same key
- **LRU Eviction:** Max 5,000 keys, oldest evicted first
- **Telemetry:** Tracks hits, misses, stale hits, evictions, background refreshes

### 8.4 RAPI Scraping Sources

| Source | Used For | Method |
|--------|----------|--------|
| erail.in | Train search, train info, route, availability, fare | Cheerio DOM parsing |
| confirmtkt.com | PNR status | Axios + cookie jar + Tesseract OCR |
| etrain.info | Live running status | Cheerio DOM parsing |
| indianrail.gov.in | PNR (via CommonCaptcha) | CAPTCHA solving |

### 8.5 Frontend API Layer (`lib/rapi/`)

```
lib/rapi/client.ts       → HTTP client (fetch, timeout, rate limiting, error classes)
lib/rapi/endpoints.ts    → 10 typed endpoint functions
lib/rapi/transform.ts    → snake_case → camelCase transformation
lib/rapi/hooks.ts        → TanStack Query hooks (caching, retries, auto-refresh)
lib/rapi/provider.tsx     → QueryClientProvider wrapper
```

### 8.6 Ticket Send API

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/ticket/send` | POST | Email ticket PDF via Resend |

Uses `pdfkit` to generate a PDF ticket and `resend` to email it. Requires `RESEND_API_KEY` env var.

---

## 9. AI Architecture

### 9.1 Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        AI Layer (lib/ai/)                       │
│                                                                 │
│  ┌────────────────┐                                            │
│  │   types.ts     │  Core types: AIMessage, AIToolCall,         │
│  │                │  AIToolDefinition, StreamChunk, etc.        │
│  └────────┬───────┘                                            │
│           │                                                     │
│  ┌────────▼───────┐    ┌────────────────┐    ┌───────────────┐  │
│  │  provider.ts   │    │   tools.ts     │    │  prompts.ts   │  │
│  │                │    │                │    │               │  │
│  │ Groq (primary) │    │ 8 RAPI tools:  │    │ System prompt │  │
│  │ OpenRouter     │    │ - search_stn   │    │ Context       │  │
│  │ (fallback)     │    │ - search_trn   │    │ builder       │  │
│  │                │    │ - get_info     │    │ Response      │  │
│  │ SSE streaming  │    │ - get_live     │    │ parser        │  │
│  │ Error handling │    │ - get_avail    │    │ Token         │  │
│  │ Rate limiting  │    │ - get_pnr      │    │ estimator     │  │
│  │                │    │ - get_fare     │    │               │  │
│  │                │    │ - get_health   │    │               │  │
│  └────────┬───────┘    └────────┬───────┘    └───────┬───────┘  │
│           │                     │                     │         │
│           └─────────────────────┼─────────────────────┘         │
│                                 │                               │
│  ┌──────────────────────────────▼────────────────────────────┐  │
│  │                    orchestrator.ts                         │  │
│  │                                                           │  │
│  │  processWithAI(userInput, callbacks) → streaming          │  │
│  │  processWithAISimple(userInput) → { content, component }  │  │
│  │                                                           │  │
│  │  1. Build messages (system prompt + history + input)      │  │
│  2. Stream LLM response (with tool definitions)           │  │
│  3. If tool calls → execute tools → second LLM pass      │  │
│  4. Parse response (extract UI component tags)            │  │
│  5. Return final content + component type                 │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                 │                               │
│  ┌──────────────────────────────▼────────────────────────────┐  │
│  │                    memory.ts                               │  │
│  │                                                           │  │
│  │  ConversationMemory class:                                │  │
│  │  - Sliding window (50 entries)                            │  │
│  │  - Auto-summarization (12k tokens threshold)              │  │
│  │  - Context extraction (train numbers, PNRs, stations)     │  │
│  │  - Token estimation                                        │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### 9.2 Provider Configuration

| Aspect | Groq (Primary) | OpenRouter (Fallback) |
|--------|----------------|----------------------|
| **Env Var** | `NEXT_PUBLIC_GROQ_API_KEY` | `NEXT_PUBLIC_OPENROUTER_API_KEY` |
| **Model** | `llama-3.3-70b-versatile` | `google/gemini-2.0-flash-001` |
| **Base URL** | `https://api.groq.com/openai/v1` | `https://openrouter.ai/api/v1` |
| **Max Tokens** | 4096 | 4096 |
| **Temperature** | 0.3 | 0.3 |
| **Switch** | Change `NEXT_PUBLIC_AI_PROVIDER` in `.env.local` | |

### 9.3 Tool Definitions

The AI has access to 8 tools, defined in `lib/ai/tools.ts`:

| Tool Name | Description | RAPI Endpoint |
|-----------|-------------|---------------|
| `search_stations` | Search stations by name/code | `GET /api/v1/stations/autocomplete` |
| `search_trains` | Search trains between stations | `GET /api/v1/trains/search` |
| `get_train_info` | Get train route + schedule | `GET /api/v1/trains/:no/info` |
| `get_live_status` | Get real-time train status | `GET /api/v1/trains/:no/live` |
| `get_availability` | Check seat availability | `GET /api/v1/trains/:no/availability` |
| `get_pnr_status` | Check PNR status | `GET /api/v1/pnr/:pnr` |
| `get_fare` | Get fare details | `GET /api/v1/trains/:no/fare` |
| `get_health` | Check RAPI connectivity | `GET /api/v1/admin/health` |

### 9.4 Prompt Engineering

The system prompt (in `lib/ai/prompts.ts`) defines:

- **Identity:** "You are RAILY, an AI-native railway operating system for Indian Railways."
- **Core Principles:** Never invent railway data, always use tools, be concise, suggest next actions
- **Response Format:** Use `<show_train_list>`, `<show_seat_map>`, etc. tags to trigger UI components
- **Tool Usage:** Search station codes before searching trains, check availability before suggesting
- **Conversation Style:** Short responses, railway terminology, confident tone

### 9.5 Streaming

The streaming engine (`lib/ai/provider.ts`) handles SSE from Groq/OpenRouter:

- Parses `data: ` lines from the SSE stream
- Accumulates text chunks → calls `onText` callback
- Accumulates tool call chunks → finalizes on `onDone`
- Handles malformed JSON, network errors, timeouts, rate limits

### 9.6 Two-Pass Execution

1. **First Pass:** Streaming LLM response with tool definitions. If the LLM calls a tool, execution pauses.
2. **Tool Execution:** All tools run in parallel. Results are stored in memory and added to the message array.
3. **Second Pass:** LLM receives tool results and generates the final response (without tool definitions).

---

## 10. RAPI Integration

### 10.1 Currently Used Endpoints

| Frontend Function | RAPI Endpoint | Status |
|-------------------|---------------|--------|
| `rapi.searchStations()` | `/api/v1/stations/autocomplete` | ✅ Connected |
| `rapi.searchTrains()` | `/api/v1/trains/search` | ✅ Connected |
| `rapi.getTrainInfo()` | `/api/v1/trains/:no/info` | ✅ Connected |
| `rapi.getLiveStatus()` | `/api/v1/trains/:no/live` | ✅ Connected |
| `rapi.getAvailability()` | `/api/v1/trains/:no/availability` | ✅ Connected |
| `rapi.getFare()` | `/api/v1/trains/:no/fare` | ✅ Connected |
| `rapi.getPNRStatus()` | `/api/v1/pnr/:pnr` | ✅ Connected |
| `rapi.getHealth()` | `/api/v1/admin/health` | ✅ Connected |
| `rapi.getCacheTelemetry()` | `/api/v1/admin/cache` | ✅ Connected |

### 10.2 Endpoints Registered in RAPI But Not Used

| Endpoint | Notes |
|----------|-------|
| `POST /api/v1/admin/cache/flush` | Admin-only, requires ADMIN_KEY |

### 10.3 Missing Integrations

| Feature | Current Status | Needed |
|---------|---------------|--------|
| Coach composition | Static simulation | `getCoachComposition` endpoint |
| Real seat availability | Static simulation | Coach-level availability data |
| Actual booking | Simulated PNR generation | Real IRCTC booking API |
| Fare breakdown | Static price per train type | Real fare data from RAPI |
| Route maps | Not implemented | GeoJSON route data |

### 10.4 Data Flow

```
RAPI Response (snake_case)        Frontend (camelCase)
─────────────────────             ─────────────────────
train_no               →          number
train_name             →          name
from_stn_code          →          fromCode
from_stn_name          →          fromName
to_stn_code            →          toCode
to_stn_name            →          toName
from_time              →          departure
to_time                →          arrival
travel_time            →          duration
running_days           →          runningDays
```

Transformation is handled by `lib/rapi/transform.ts` — the **only file** that maps API data to UI data.

### 10.5 Date Format

| System | Format | Example |
|--------|--------|---------|
| Frontend (internal) | YYYY-MM-DD | 2026-07-29 |
| RAPI (external) | DD-MM-YYYY | 29-07-2026 |
| Conversion | `toRapiDate()` in `lib/rapi/endpoints.ts` | |

---

## 11. Data Flow

### 11.1 Train Search Flow

```
User: "Book Delhi to Jaipur tomorrow"
                    │
                    ▼
processUserInput("Book Delhi to Jaipur tomorrow")
                    │
                    ▼
processWithAI(userInput, callbacks)
                    │
                    ├──► buildMessages() → system prompt + history + user input
                    │
                    ├──► createStreamingCompletion(messages, TOOLS)
                    │       │
                    │       ├──► LLM decides: call search_trains(from="NDLS", to="JP")
                    │       │
                    │       └──► onDone: toolCalls detected
                    │
                    ├──► executeTool("search_trains", { from: "NDLS", to: "JP" })
                    │       │
                    │       ├──► rapi.searchTrains("NDLS", "JP", "28-07-2026")
                    │       │       │
                    │       │       └──► RAPI → erail.in → parse HTML → return JSON
                    │       │
                    │       └──► ToolResult { success, data: { trains: [...] } }
                    │
                    ├──► Second LLM pass (with tool results)
                    │       │
                    │       └──► LLM generates response + <show_train_list>
                    │
                    └──► Callbacks:
                            onText("I found 3 trains from Delhi to Jaipur...")
                            onComponent("train-list")
                            onDone("I found 3 trains...", "train-list")
```

### 11.2 Booking Flow

```
User selects train in TrainExplorer
                    │
                    ▼
selectTrain(train) → sets selectedTrain, step = "coach-view"
                    │
                    ▼
addMessage(assistant, "Coach layout:", component="seat-map")
                    │
                    ▼
CoachVisualizer renders seat map
User selects seat → handleSelectSeat(seatId)
                    │
                    ▼
User clicks "Confirm Booking"
                    │
                    ▼
confirmBooking() → generates PNR from train number + timestamp
                    │
                    ▼
addMessage(assistant, "Booking confirmed! PNR: ...", component="booking-confirmation")
                    │
                    ▼
BookingConfirmation renders ticket
```

### 11.3 PNR Check Flow

```
User: "Check PNR 4681234567"
                    │
                    ▼
processUserInput("Check PNR 4681234567")
                    │
                    ▼
processWithAI(userInput, callbacks)
                    │
                    ├──► LLM calls get_pnr_status(pnr: "4681234567")
                    │       │
                    │       └──► rapi.getPNRStatus("4681234567")
                    │               │
                    │               └──► RAPI → confirmtkt → parse → return JSON
                    │
                    └──► LLM generates response + <show_pnr_status>
                            → PNRManager renders status card
```

---

## 12. Design System

### 12.1 Philosophy

```
Inspired by:  Dieter Rams, Braun, Muji, Nothing, Linear
              Railway signage, Swiss graphic design
NOT inspired by: Glassmorphism, Neumorphism, Dribbble shots,
                 Rounded cards, Floating widgets, Gradients
```

### 12.2 Design Tokens (from `app/globals.css`)

```css
:root {
  --bg: #F6F4EF;              /* Warm off-white */
  --fg: #111111;              /* Almost black */
  --border: #D8D6D1;          /* Warm gray */
  --muted: #8A8A8A;           /* Neutral gray */
  --railway-red: #C41E3A;     /* Accent (attention only) */
  --railway-red-light: rgba(196, 30, 58, 0.08);
  --chat-max-width: 700px;
  --topbar-height: 56px;
}
```

### 12.3 Typography

| Font | Usage | Weight |
|------|-------|--------|
| IBM Plex Sans | Body, headings, UI text | 400, 500, 600, 700 |
| IBM Plex Mono | Metadata, labels, data values | 400, 600, 700 |

Monospace is used **only** for metadata, labels, and data values. Never for long paragraphs.

### 12.4 Spacing

8px grid system. Very generous whitespace. Never cram information.

### 12.5 Borders

- **Border radius: 0px** — Everything uses sharp edges
- Borders should feel engineered, not decorative
- 1px solid borders using `var(--border)`

### 12.6 Motion

Mechanical, not playful:

- `slide-up` — cubic-bezier(0.16, 1, 0.3, 1)
- `scale-in` — 0.25s mechanical
- `clip-reveal` — 0.4s clip path animation
- `pulse-dot` — loading indicator
- No bouncing, no springs

### 12.7 Accessibility

- `:focus-visible` outline styles
- Touch device font-size adjustment (16px to prevent iOS zoom)
- `prefers-reduced-motion` support
- Semantic HTML structure

---

## 13. Engineering Standards

### 13.1 Naming Conventions

| Category | Convention | Example |
|----------|------------|---------|
| Files | PascalCase for components, kebab-case for libs | `TrainExplorer.tsx`, `booking-store.tsx` |
| Components | PascalCase | `AIAssistantPanel`, `CoachVisualizer` |
| Functions | camelCase | `processUserInput`, `formatDisplayDate` |
| Types/Interfaces | PascalCase | `Train`, `BookingState`, `AIToolCall` |
| CSS Variables | kebab-case | `--chat-max-width`, `--railway-red` |
| Environment Variables | UPPER_SNAKE_CASE | `NEXT_PUBLIC_GROQ_API_KEY` |

### 13.2 TypeScript Rules

- Strict mode enabled
- Avoid `any` — use proper types
- All API responses typed through `RapiResponse<T>`
- All AI messages typed through `AIMessage`
- Zod schemas not yet implemented (Needs Investigation)

### 13.3 Error Handling

| Layer | Strategy |
|-------|----------|
| RAPI Client | Custom error classes: `RapiError`, `RapiTimeoutError`, `RapiRateLimitError`, `RapiUnreachableError` |
| AI Provider | Custom error classes: `AIProviderError`, `AIRateLimitError`, `AITimeoutError` |
| Components | Graceful fallback UI, error messages in chat |
| RAPI Server | JSON error responses with `success: false`, `error`, `errorCode` |

### 13.4 Testing

| Area | Tool | Status |
|------|------|--------|
| RAPI (backend) | Vitest + supertest + nock | ✅ Comprehensive (chaos, security, load, memory) |
| Frontend | None | ❌ Not implemented |

---

## 14. Security

### 14.1 Authentication

| Provider | Clerk |
|----------|-------|
| Sign-in | Clerk-hosted UI at `/sign-in` |
| Sign-up | Clerk-hosted UI at `/sign-up` |
| Protection | Clerk middleware in `proxy.ts` |
| Protected routes | `/app(.*)` |

### 14.2 Secrets

| Secret | Used By | Storage |
|--------|---------|---------|
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk | `.env.local` |
| `CLERK_SECRET_KEY` | Clerk | `.env.local` |
| `NEXT_PUBLIC_GROQ_API_KEY` | AI Provider | `.env.local` |
| `NEXT_PUBLIC_OPENROUTER_API_KEY` | AI Provider | `.env.local` |
| `RESEND_API_KEY` | Email | `.env.local` |
| `ADMIN_KEY` | RAPI cache flush | `.env` (Rapi) |

### 14.3 RAPI Security

| Measure | Implementation |
|---------|---------------|
| Rate limiting | 100 req/min per IP, burst to 200 |
| CORS | Enabled |
| X-Powered-By | Disabled |
| Security headers | X-Content-Type-Options, X-Frame-Options, X-XSS-Protection, HSTS |
| Input validation | Regex validation on all parameters |
| No stack traces | Error responses are sanitized |
| Admin endpoint | Header-based auth (`x-admin-key`) |

### 14.4 AI Security

- API keys are client-side (NEXT_PUBLIC_) — sent directly to Groq/OpenRouter
- No server-side proxy for AI requests
- **Prompt injection risk:** System prompt instructs the LLM to never invent railway data, but no output sanitization is implemented
- **Needs Investigation:** Output sanitization, rate limiting on AI calls, abuse prevention

---

## 15. Performance

### 15.1 Caching

| Layer | Technology | Strategy |
|-------|------------|----------|
| RAPI Server | NodeCache (in-memory) | SWR + stale-while-revalidate + LRU eviction + background refresh + min scrape interval |
| Frontend | TanStack Query | Stale time per endpoint, auto-refresh for live status, retry with exponential backoff |
| Conversation | ConversationMemory | Sliding window (50 entries), auto-summarization at 12k tokens |

### 15.2 Streaming

- AI responses stream via SSE from Groq/OpenRouter
- Each chunk updates the message in real-time via `setState`
- **Known issue:** Many re-renders during streaming — each chunk triggers a state update

### 15.3 Optimization Opportunities

| Area | Current | Target |
|------|---------|--------|
| Streaming renders | `setState` per chunk | Batch updates via ref + requestAnimationFrame |
| Image optimization | None | Next.js Image component |
| Bundle size | Full framer-motion | Tree-shake unused animations |
| Lazy loading | None | Dynamic imports for inline components |
| Prefetching | None | Prefetch likely next requests (PNR after booking) |

---

## 16. Current Technical Debt

### Critical

| # | Issue | Location | Impact |
|---|-------|----------|--------|
| 1 | `confirmBooking` uses `setTimeout` for async state access | `lib/booking-store.tsx:284` | Fragile, could hang if unmounted |
| 2 | Streaming text before tool calls is discarded | `lib/ai/orchestrator.ts` | Users may miss LLM's reasoning text |
| 3 | Many `setState` calls during streaming cause re-renders | `lib/booking-store.tsx:processUserInput` | Jank on long responses |

### High

| # | Issue | Location | Impact |
|---|-------|----------|--------|
| 4 | Dead components polluting the codebase | `components/` (8 files) | Confusion, larger bundle |
| 5 | No AI provider fallback UI when not configured | `lib/booking-store.tsx` | Poor DX for new developers |
| 6 | JourneyTracker and PNRManager use hardcoded mock data | `components/app/JourneyTracker.tsx`, `PNRManager.tsx` | Not connected to RAPI |
| 7 | No frontend tests | Entire project | Cannot verify changes |

### Medium

| # | Issue | Location | Impact |
|---|-------|----------|--------|
| 8 | Old regex functions still in booking-store.tsx | `lib/booking-store.tsx` (dead code) | Confusion |
| 9 | CoachVisualizer layout doesn't change with coachIndex | `components/app/CoachVisualizer.tsx` | All 6 coaches look identical |
| 10 | No scroll-aware streaming (auto-scrolls even if user scrolled up) | `components/app/AIAssistantPanel.tsx` | Annoying UX |
| 11 | Conversation memory is not persisted | `lib/ai/memory.ts` | Resets on page refresh |

### Low

| # | Issue | Location | Impact |
|---|-------|----------|--------|
| 12 | `lib/rapi/hooks.ts` is unused (booking store calls endpoints directly) | `lib/rapi/hooks.ts` | Dead code |
| 13 | `components/lib.ts` cn() utility is unused | `components/lib.ts` | Dead code |
| 14 | `gsap` dependency still in package.json | `package.json` | Unused package |
| 15 | `railkit` dependency still in package.json | `package.json` | Unused package |

---

## 17. Refactoring Opportunities

| Priority | Opportunity | Effort | Impact |
|----------|-------------|--------|--------|
| 🔴 High | Replace `confirmBooking` setTimeout with `useRef` pattern | Small | Eliminates fragile async pattern |
| 🔴 High | Preserve streaming text before tool calls | Medium | Better UX during tool execution |
| 🔴 High | Batch streaming state updates | Medium | Smoother streaming performance |
| 🟡 Medium | Clean up dead components and files | Small | Reduced bundle size, less confusion |
| 🟡 Medium | Connect JourneyTracker + PNRManager to live RAPI | Medium | Real data instead of mock |
| 🟡 Medium | Add scroll-aware auto-scroll detection | Small | Better reading experience |
| 🟢 Low | Add graceful error UI when AI is not configured | Small | Better onboarding |
| 🟢 Low | Remove unused gsap and railkit dependencies | Small | Faster install |
| 🟢 Low | Add frontend tests (Vitest + React Testing Library) | Large | Confidence in changes |

---

## 18. Roadmap

### Current Architecture

```
Single-page Next.js app with:
- Conversation-first interface
- AI-native (LLM-driven) intent detection
- Client-side AI provider (Groq/OpenRouter)
- Self-hosted RAPI backend (scraping-based)
- React Context for state management
- TanStack Query for API caching
- No backend for user data storage
```

### Target Architecture

```
Same frontend + AI layer, but with:
- Server-side AI proxy (for API key security + rate limiting)
- Persistent user data (PostgreSQL or similar)
- Real IRCTC booking integration
- Coach composition and real seat availability
- Push notifications for PNR updates
- Travel planner with multi-city itineraries
- Mobile app (React Native)
```

### Known Limitations

| Limitation | Impact |
|------------|--------|
| RAPI depends on scraping (fragile, may break if sources change) | Occasional data unavailability |
| AI keys are client-side (exposed in browser) | Security risk for production |
| No user data persistence (bookings lost on browser clear) | Poor UX for returning users |
| Booking is simulated (no real IRCTC integration) | Cannot book actual tickets |
| Coach visualizer is static (no live coach data) | Not connected to real train configuration |

---

## 19. Appendix

### A. Glossary

| Term | Definition |
|------|------------|
| RAPI | Raily API — self-hosted Express server that scrapes railway data |
| Raily | The product — an AI-native railway operating system |
| PNR | Passenger Name Record — 10-digit booking identifier |
| IRCTC | Indian Railway Catering and Tourism Corporation — official booking portal |
| RAC | Reservation Against Cancellation — partial confirmation |
| CNF | Confirmed booking status |
| WL | Waitlist — booking not yet confirmed |
| SWR | Stale-While-Revalidate — cache strategy |
| SSE | Server-Sent Events — streaming protocol |
| Groq | Primary AI provider (fast LLM inference) |
| OpenRouter | Fallback AI provider (multiple model access) |

### B. Important Files

| File | Why It Matters |
|------|----------------|
| `lib/booking-store.tsx` | Central state management — every feature depends on it |
| `lib/ai/orchestrator.ts` | Main AI orchestration — the brain of the product |
| `lib/ai/provider.ts` | AI provider connection — streaming + completion |
| `lib/ai/tools.ts` | Tool definitions — the bridge between AI and RAPI |
| `lib/rapi/endpoints.ts` | Typed RAPI endpoint functions |
| `lib/rapi/transform.ts` | API response transformation layer |
| `components/app/AIAssistantPanel.tsx` | Main chat UI — streaming text + component rendering |
| `app/globals.css` | Design system — every visual token |
| `Rapi/src/index.ts` | RAPI server entry — all backend routes |
| `Rapi/src/cache.ts` | RAPI caching layer — SWR + LRU |

### C. Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Yes | — | Clerk publishable key |
| `CLERK_SECRET_KEY` | Yes | — | Clerk secret key |
| `NEXT_PUBLIC_GROQ_API_KEY` | Yes* | — | Groq API key (for AI) |
| `NEXT_PUBLIC_AI_PROVIDER` | No | `groq` | AI provider: `groq` or `openrouter` |
| `NEXT_PUBLIC_OPENROUTER_API_KEY` | No | — | OpenRouter API key (fallback) |
| `NEXT_PUBLIC_RAPI_BASE_URL` | No | `http://localhost:3001` | RAPI server URL |
| `RESEND_API_KEY` | No | — | Resend key for email tickets |
| `ADMIN_KEY` | No | — | RAPI admin key for cache flush |

*\* Required for AI features to work*

### D. Dependencies

#### Frontend (package.json)

| Package | Purpose |
|---------|---------|
| `next` | React framework |
| `react` / `react-dom` | UI library |
| `@clerk/nextjs` | Authentication |
| `@tanstack/react-query` | Server state caching |
| `framer-motion` | Animations |
| `lucide-react` | Icons |
| `pdfkit` | PDF ticket generation |
| `resend` | Email delivery |
| `tailwindcss` | CSS framework |
| `gsap` | **Unused** — legacy dependency |
| `railkit` | **Unused** — legacy dependency |

#### Backend (Rapi/package.json)

| Package | Purpose |
|---------|---------|
| `express` | HTTP server |
| `cors` | Cross-origin requests |
| `express-rate-limit` | Rate limiting |
| `cheerio` | HTML parsing |
| `axios` / `axios-cookiejar-support` | HTTP client with cookie support |
| `tesseract.js` | OCR for CAPTCHA solving |
| `jimp` | Image processing for CAPTCHA |
| `node-cache` | In-memory caching |
| `vitest` | Testing |
| `supertest` | HTTP testing |
| `nock` | HTTP mocking |
| `autocannon` | Load testing |

### E. Useful Commands

```bash
# Frontend
npm run dev          # Start Next.js dev server (localhost:3000)
npm run build        # Production build
npm run lint         # ESLint

# RAPI Backend
cd Rapi && npm run dev     # Start RAPI dev server (localhost:3001)
cd Rapi && npm test        # Run test suite
cd Rapi && npx vitest run  # Run tests once

# Both (run in separate terminals)
npm run dev          # Frontend
cd Rapi && npm run dev  # Backend
```

### F. Developer Onboarding

1. **Clone the repo**
2. **Install dependencies:** `npm install` (root) + `cd Rapi && npm install`
3. **Copy environment:** `cp .env.example .env.local` and fill in keys
4. **Get a Groq API key:** Sign up at https://console.groq.com
5. **Get Clerk keys:** Sign up at https://dashboard.clerk.com
6. **Start RAPI:** `cd Rapi && npm run dev` (starts on port 3001)
7. **Start frontend:** `npm run dev` (starts on port 3000)
8. **Open:** http://localhost:3000
9. **Sign in** via Clerk, then start chatting

---

*This document is a living artifact. Update it as the codebase evolves.*