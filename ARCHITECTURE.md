# RAILY — Architecture

> An AI-native operating system for Indian Railways. This document describes the system architecture, key design decisions, data flow, and deployment model.

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [High-Level Architecture](#2-high-level-architecture)
3. [Frontend Layer (Next.js App)](#3-frontend-layer-nextjs-app)
4. [AI Pipeline](#4-ai-pipeline)
5. [Data Service (Rapi)](#5-data-service-rapi)
6. [State Management](#6-state-management)
7. [Security Model](#7-security-model)
8. [Testing & Resilience](#8-testing--resilience)
9. [Deployment](#9-deployment)
10. [Key Design Decisions](#10-key-design-decisions)

---

## 1. System Overview

RAILY is a conversational AI assistant for Indian Railways. Users describe trips in natural language, and the AI orchestrates data retrieval, seat selection, booking, and post-booking actions through a unified chat interface.

**Core principle:** The AI is the interface. There is no traditional form-based UI. The entire application is a conversation that dynamically surfaces context-relevant UI components (train lists, seat maps, booking confirmations, journey trackers) alongside AI-generated text.

**Important note on booking:** All bookings are simulations. There is no real IRCTC API integration. The `confirmBooking` tool generates deterministic PNR numbers from a hash of booking parameters and persists them to browser localStorage. No real tickets are issued.

### Key Features

- Natural-language trip planning and train discovery
- AI-assisted booking flow with conversational prompts
- Dynamic coach visualization with seat selection
- Live train tracking with delay-aware journey updates
- PNR lookup and booking history management
- PDF ticket generation and email delivery

### Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (React 19, TypeScript) |
| Styling | Tailwind CSS v4 + CSS custom properties |
| Auth | Clerk |
| AI Provider | Groq (default) / OpenRouter (fallback) |
| Email | Resend |
| PDF Generation | pdfkit |
| State Management | React Context + localStorage |
| Data Fetching | TanStack React Query |
| Testing | Vitest |
| Backend Data Service | Express.js (self-hosted, `Rapi/`) |

---

## 2. High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Browser (Client)                          │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  Next.js App (React 19 SPA)                           │  │
│  │  ┌──────────┐  ┌───────────┐  ┌──────────────────┐   │  │
│  │  │  Chat UI  │  │  Dynamic  │  │  Booking Store    │   │  │
│  │  │  (Stream) │  │ Components│  │  (React Context)  │   │  │
│  │  └────┬─────┘  └─────┬─────┘  └────────┬─────────┘   │  │
│  │       │               │                 │             │  │
│  │  ┌────▼───────────────▼─────────────────▼──────────┐  │  │
│  │  │           AI Client Orchestrator                 │  │  │
│  │  │  (processWithAI / processWithAISimple)           │  │  │
│  │  └────────────────────┬────────────────────────────┘  │  │
│  └───────────────────────┼───────────────────────────────┘  │
└──────────────────────────┼──────────────────────────────────┘
                           │ HTTP / JSON / SSE streams
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                  Next.js API Routes (Server)                 │
│  ┌────────────────────┐  ┌──────────────────┐              │
│  │  /api/ai/chat      │  │  /api/ai/health   │              │
│  │  (AI Proxy)        │  │  (Health Check)   │              │
│  └────────┬───────────┘  └──────────────────┘              │
│           │                                                 │
│  ┌────────▼───────────┐  ┌──────────────────┐              │
│  │  /api/ticket/send  │  │  AI Provider      │              │
│  │  (Email + PDF)     │  │  (Groq/OpenRouter) │              │
│  └────────────────────┘  └──────────────────┘              │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│               Rapi (Self-hosted Express.js)                  │
│  ┌──────────┐  ┌───────────┐  ┌───────────────────────┐   │
│  │ Scrapers  │  │ In-Memory  │  │ Station Autocomplete  │   │
│  │ (erail.in)│  │  Cache     │  │ (local JSON)         │   │
│  └──────────┘  └───────────┘  └───────────────────────┘   │
│                                                             │
│  Endpoints: /api/v1/trains/*, /api/v1/pnr/*,               │
│             /api/v1/stations/*, /api/v1/admin/*             │
└─────────────────────────────────────────────────────────────┘
```

### Service Boundary

| Service | Role | Deployed To |
|---------|------|-------------|
| **Next.js App** | Frontend + AI orchestration + email/PDF | Vercel |
| **Rapi** | Railway data scraping + caching | Render (Singapore) |

The two services communicate over HTTP. The Next.js app never calls Indian Railways or erail.in directly. All railway data goes through Rapi. If Rapi is unreachable, the client gracefully degrades with descriptive error messages via `RapiUnreachableError`.

---

## 3. Frontend Layer (Next.js App)

### Route Structure

```
/                          → Landing page (marketing + auth prompts)
/sign-in                  → Clerk sign-in
/sign-up                  → Clerk sign-up
/app                      → Main application (protected, client-only)
  /app (layout)           → RapiQueryProvider wrapper (TanStack Query)
/app/page.tsx             → Dynamic import of AppLayout
```

### Error Boundaries

```
app/error.tsx     → Global error boundary for the root layout
app/loading.tsx   → Loading state for root layout
app/not-found.tsx → Custom 404 page
```

The `app/app/page.tsx` loads `AppLayout` via `next/dynamic` with its own skeleton loading state, keeping the initial bundle small.

### Component Architecture

```
<ClerkProvider> (root layout)
└── AppLayout
    ├── TopBar (app header with branding, auth status)
    ├── ChatPanel
    │   ├── MessageList (streaming text + embedded components)
    │   ├── StreamingText (real-time text with DOMPurify sanitization)
    │   └── ChatInput (text input with send button)
    └── Right Panel (dynamically rendered components)
        ├── TrainExplorer (train search results)
        ├── CoachVisualizer (seat/coach layout with selection)
        ├── BookingConfirmation (post-booking summary)
        ├── BookingHistory (past bookings from localStorage)
        ├── JourneyTracker (live train tracking)
        └── PNRManager (PNR status lookup)
```

### Design System

The visual language is inspired by Dieter Rams / Braun functional purity, Swiss graphic design, and Indian Railway signage.

- **Font:** IBM Plex Sans (UI) + IBM Plex Mono (metadata, labels, data values)
- **Grid:** 8px base spacing
- **Colors:** Minimal palette — background `#F6F4EF`, foreground `#111111`, border `#D8D6D1`, accent red `#C41E3A`
- **Animations:** `slide-up`, `scale-in`, `clip-reveal` — mechanical, purposeful, never decorative
- **Noise overlay:** Subtle dot-grid grain for texture
- **Selection style:** Inverted — foreground on background

---

## 4. AI Pipeline

The AI pipeline is the core of RAILY. It is a deterministic finite-state machine that orchestrates the entire user request lifecycle on the client side.

### State Machine (16 States)

```
IDLE → REQUEST_RECEIVED → BUILD_CONTEXT → CALL_PROVIDER →
  STREAMING → (optional: TOOL_CALL_DETECTED → EXECUTE_TOOL →
  WAIT_FOR_TOOL_RESULT → SECOND_LLM_PASS) → PARSE_RESPONSE →
  EMIT_FRONTEND_EVENTS → FINAL_RESPONSE_READY → COMPLETE

Terminal states: COMPLETE | ERROR | CANCELLED | TIMEOUT
```

Every transition is validated against a strict transition map (`STATE_TRANSITIONS` in `types.ts`). Invalid transitions force-terminate in ERROR. Every request terminates in exactly one terminal state. No silent disappearances.

### Pipeline Flow

#### Phase 1: Streaming Pass

1. User sends a message via `ChatPanel`
2. `BookingStore.processUserInput()` creates a streaming message placeholder
3. `processWithAI()` is called with structured callbacks:
   - `onText` — accumulates text into the streaming message
   - `onToolCall` — shows tool name as inline indicator
   - `onToolResult` — syncs booking state from confirmed tools
   - `onComponent` — maps AI component tags to UI components
   - `onDone` — marks streaming as complete
   - `onError` — displays error message
   - `onEvents` — executes browser events (PDF download, navigation)

#### Phase 2: Tool Execution (Conditional)

If the LLM calls tools during streaming, the orchestrator:
1. Transitions to `TOOL_CALL_DETECTED` → `EXECUTE_TOOL` → `WAIT_FOR_TOOL_RESULT`
2. Executes all tools in parallel (Promise.all)
3. Validates any browser events returned by tools
4. Dispatches validated events to the frontend
5. Makes a second LLM pass with tool results (`SECOND_LLM_PASS`)
6. Parses the final response for UI component triggers

#### Phase 3: Direct Response (No Tools)

If no tools were called, the response is parsed directly and returned.

### Provider Layer (`lib/ai/provider.ts`)

The provider is a client-side proxy that:
- Calls `/api/ai/chat` (Next.js API route) instead of calling AI providers directly
- The API route forwards to Groq (default) or OpenRouter
- API keys stay server-side only
- Streaming SSE is parsed line-byline from NDJSON
- Guaranteed callback contract: 1x `onStart`, 0+ `onChunk`, 0+ `onToolCall`, exactly 1 `onDone` or `onError`, exactly 1 `cleanup`
- Uses a `StreamAccumulator` pattern so the orchestrator can read final state after the stream completes

### Tool System (`lib/ai/tools.ts`)

**Core rule:** The LLM NEVER claims success without a tool confirming it. Every tool returns a standardized `StandardToolResponse`:

```typescript
{
  success: boolean;
  data: Record<string, unknown> | null;
  message: string;
  error: { code: string; message: string } | null;
  events?: BrowserEvent[];  // Frontend actions to dispatch
}
```

**Available Tools (11 total):**

| Tool | Description |
|------|-------------|
| `searchStations` | Fuzzy station search by name/code from bundled JSON |
| `searchTrains` | Find trains between stations on a date |
| `getTrainInfo` | Full route and schedule for a train |
| `getLiveStatus` | Real-time running status and delay |
| `getAvailability` | Class-wise seat availability and fare |
| `getPnrStatus` | PNR booking status and passenger details |
| `getFare` | Class-wise fare breakdown |
| `getHealth` | Rapi server connectivity check |
| `confirmBooking` | Finalize simulated booking, generate PNR, save to localStorage |
| `downloadTicketPdf` | Return browser event for PDF download |
| `sendTicketEmail` | Email ticket PDF via Resend |

All tools that call Rapi use `withRetry` (2 retries, exponential backoff) for transient failures.

**Browser Events Architecture:**

Tools do NOT manipulate the DOM directly. Instead, they return structured `BrowserEvent` objects in their response. The orchestrator validates these events (schema check, dedup), and the frontend `executeBrowserEvents()` dispatches them:

| Event Type | Action |
|-----------|--------|
| `download-pdf` | Fetch blob from API -> trigger browser download |
| `navigate` | `window.location.href` redirect |
| `scroll-to` | `element.scrollIntoView()` with smooth behavior |
| `focus` | `element.focus()` |

### Prompt System (`lib/ai/prompts.ts`)

- **System prompt:** Defines RAILY's identity as an "AI-native railway operating system" with strict truth rules and explicit booking flow sequence
- **Conversation memory:** `ConversationMemory` class with sliding window (max 50 entries), auto-summarization at 30 entries or 12K tokens
- **Context builder:** Last 20 entries with 2000-char truncation for long tool results
- **Response parser:** Extracts `<showComponentType>` trigger tags from AI output (e.g., `<showTrainList>`, `<showSeatMap>`)
- **Token estimation:** Rough estimate (~4 chars per token)

### Correlated Logging

Every request gets a unique `requestId` (format: `req_{timestamp}_{random}_{counter}`) that threads through provider -> orchestrator -> tools -> callbacks -> frontend. Every log line includes this ID for debugging. The `RequestStateMachine` logs every state transition with timestamps.

---

## 5. Data Service (Rapi)

Rapi is a self-hosted Express.js API that scrapes Indian Railways data from public sources (primarily erail.in) and provides a clean, typed REST interface. It is in the `Rapi/` directory and deployable independently.

### Endpoints

```
GET  /api/v1/trains/search?from=NDLS&to=BCT&date=DD-MM-YYYY
GET  /api/v1/trains/:number/info
GET  /api/v1/trains/:number/live?date=DD-MM-YYYY
GET  /api/v1/trains/:number/availability?from=&to=&date=
GET  /api/v1/trains/:number/fare?from=&to=&date=
GET  /api/v1/pnr/:pnr
GET  /api/v1/stations/autocomplete?q=DEL
GET  /api/v1/admin/health
GET  /api/v1/admin/cache
POST /api/v1/admin/cache/flush
```

### Scraper Architecture

```
scraperClient.ts  ->  Axios + cookie-jar + retry with exponential backoff
         |
         +-- searchScraper.ts       -> erail.in pipe-delimited train search
         +-- infoScraper.ts         -> erail.in train info + route
         +-- liveStatusScraper.ts   -> erail.in + schedule-based status
         +-- availabilityScraper.ts -> erail.in class/fare parsing
         +-- pnrScraper.ts          -> Indian Railways official portal
              +-- OCR CAPTCHA solving (tesseract.js)
              +-- JSON response parsing
```

**PNR Scraper** is the most complex scraper with a full CAPTCHA-solving pipeline:
1. Fetches CAPTCHA image from Indian Railways portal
2. Processes image (greyscale, contrast, scale x2) via Jimp
3. Solves math expression via tesseract.js OCR
4. Submits PNR + solved CAPTCHA
5. Parses response JSON (handles multiple field name conventions like `train_no`, `trainno`, `train_number`)
6. Retries on CAPTCHA failure with new session

### Scraper Sources

| Function | Source URL | Format |
|----------|-----------|--------|
| Train search | `erail.in/rail/getTrains.aspx` | Pipe-delimited text |
| Train info | `erail.in/rail/getTrainSchedule.aspx` | Pipe-delimited text |
| Train route | `erail.in/rail/getTrainRoute.aspx` | Pipe-delimited text |
| PNR status | `indianrail.gov.in/enquiry/CommonCaptcha` | JSON API |
| Station autocomplete | Bundled `stations.json` (8,000+ stations) | Local, O(0ms) |

### Caching Layer

- **In-memory cache** with TTL per endpoint type, LRU eviction at max 5000 keys
- **Stale-while-revalidate pattern:** serve stale data while refreshing in background
- **Minimum refresh interval** (30s) prevents thundering herd
- **Per-endpoint TTLs:**
  - PNR: 180s
  - Live status: 120s
  - Train search: 600s
  - Route info: 86400s (24h)
  - Availability/fare: 120s
- **Admin endpoints** expose cache telemetry: hit rate, utilization, keys, evictions

### Middleware Stack

1. Request ID generation (first middleware)
2. Helmet security headers
3. CORS (configurable origins in production)
4. JSON body parsing (10kb limit)
5. General rate limiting (100 req/min, burst 200)
6. Admin rate limiting (10 req/min)
7. Optional API key authentication (`x-api-key` header)
8. Structured JSON request logging (method, path, status, duration)

---

## 6. State Management

### React Context

The `BookingProvider` (React Context in `lib/booking-store.tsx`) manages all application state:

```typescript
BookingState {
  step: BookingStep          // Current booking workflow phase
  query: ExtractedQuery|null // Parsed origin/destination/date
  trains: Train[]            // Search results
  selectedTrain: Train|null  // User's chosen train
  selectedCoach: string      // Selected coach (default "B1")
  selectedSeat: string|null  // Selected seat ID
  bookingConfirmed: boolean
  pnrNumber: string|null
  isProcessing: boolean
  messages: Message[]        // Chat history with streaming support
  rapiConnected: boolean     // Rapi health status
  aiConfigured: boolean      // AI provider status
}
```

### Chat Message System

```typescript
Message {
  id: string;
  role: "user" | "assistant";
  content: string;               // Can be partial during streaming
  component?: ChatComponentType; // Embedded UI component type
  streaming?: boolean;           // True while AI is still generating
  timestamp: number;
}
```

### LocalStorage Persistence

- **Recent bookings:** `railyRecentBookings` key, stores last 5 bookings with PNR, train, route, status
- Saved when `confirmBooking` tool succeeds
- Read by `BookingHistory` component on mount
- Best-effort: localStorage writes are try/caught and never block the booking flow

### Booking Store Testability

Pure data-construction functions are extracted into `lib/booking-store-utils.ts` to be unit-testable in isolation:

| Function | Purpose |
|----------|---------|
| `buildSeatId(coach, seat, tier)` | Builds compound seat ID (e.g., `B1-7L`) |
| `buildTrainFromBookingData(data)` | Constructs Train object from booking fields |
| `buildQueryFromBookingData(data)` | Constructs ExtractedQuery from booking fields |

These are fully tested in `lib/booking-store-utils.test.ts` (36 test cases covering formatting, optional fields, edge cases).

---

## 7. Security Model

### API Key Protection

- AI provider API keys (Groq, OpenRouter) are stored in `.env.local` - NEVER in client bundle
- The Next.js API route `/api/ai/chat` proxies all AI calls, keeping keys server-side
- Rapi supports optional `x-api-key` header authentication
- Admin endpoints require `x-admin-key` header (configured via `ADMIN_KEY` env var)
- `lib/ai/server-config.ts` reads server-only env vars and must never be imported from client code

### HTTP Security Headers

Configured in `next.config.ts`:
- `X-Frame-Options: DENY` - prevents clickjacking
- `X-Content-Type-Options: nosniff` - prevents MIME sniffing
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`

### Input Sanitization & Validation

- AI-generated text is sanitized via DOMPurify before rendering in `StreamingText`
- Station search queries capped at 100 characters
- PNR values validated for exact 10-digit format
- Station codes validated as 2-5 letter codes
- Train numbers validated as 4-5 digits
- Dates validated as DD-MM-YYYY format
- All validation happens at both Rapi route level and client endpoint level

### Auth

- Clerk handles authentication (`proxy.ts` middleware)
- `/app/*` routes are protected by Clerk middleware (`isProtectedRoute`)
- Unauthenticated users see the marketing landing page only
- Clerk appearance is customized to match RAILY's design system

---

## 8. Testing & Resilience

### Test Suites

| Test File | Scope | Tests |
|-----------|-------|-------|
| `lib/booking-store-utils.test.ts` | Pure utility functions | 36 cases |
| `Rapi/test/chaos.test.ts` | Rapi chaos/error handling | N/A |
| `Rapi/test/load-benchmark.ts` | Rapi load benchmarking | N/A |
| `Rapi/test/memory-eviction.test.ts` | Rapi cache eviction | N/A |
| `Rapi/test/security-fuzzing.test.ts` | Rapi input fuzzing | N/A |
| `Rapi/test/security-headers.test.ts` | Rapi security headers | N/A |

Tests run via `vitest run` (`npm test`).

### Resilience Patterns

1. **Rapi unreachable:** The `RapiApiClient` throws `RapiUnreachableError` with a helpful message (\"Start it with: cd Rapi && npm run dev\"). Tools catch this and return `failure()` with the message, and the LLM explains the issue to the user.

2. **Retry with exponential backoff:** All tool handlers use `withRetry(fn, 2, 1000)` for transient failures.

3. **Streaming guardrails:** The streaming provider has `safeComplete` and `safeCleanup` guards that ensure exactly one `onDone`/`onError` call and exactly one `cleanup` call, even with edge cases like abort/timeout.

4. **State machine safety:** The `OrchestrationScope.runInState()` catches errors and force-terminates the machine. The `safeTransition()` method catches invalid transitions and force-terminates in ERROR instead of crashing.

5. **localStorage fallback:** All localStorage operations are wrapped in try/catch. Incognito mode, full storage, or disabled storage never blocks the booking flow.

6. **Non-blocking AI pipeline:** The AI pipeline has a 60-second timeout. If exceeded, the state machine transitions to TIMEOUT and the error callback fires with a user-friendly message.

---

## 9. Deployment

### Next.js App -> Vercel

```json
// vercel.json
{
  "version": 2,
  "framework": "nextjs",
  "buildCommand": "next build",
  "installCommand": "npm install"
}
```

- Serverless deployment
- `pdfkit` marked as `serverExternalPackages` in `next.config.ts` so .afm font files are bundled for serverless
- Security headers set via `next.config.ts` headers() function
- Compression enabled

### Rapi -> Render

```yaml
# render.yaml
services:
  - type: web
    name: rapi
    env: node
    rootDir: Rapi
    region: singapore
    plan: free
```

- Deployed as a web service in Singapore region for optimal Indian Railway data proximity
- Health check at `/api/v1/admin/health`
- Cache TTLs configured via environment variables
- Admin key for protected operations
- Auto-deploy enabled

### Environment Variables

```env
# AI Provider
AI_PROVIDER=groq|openrouter
GROQ_API_KEY=...
OPENROUTER_API_KEY=...

# Auth
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=...
CLERK_SECRET_KEY=...

# Email
RESEND_API_KEY=...
RESEND_FROM_EMAIL=...

# Rapi (optional override, defaults to localhost:3001)
NEXT_PUBLIC_RAPI_BASE_URL=http://localhost:3001
```

---

## 10. Key Design Decisions

### 1. AI-as-Interface (Not Chatbot)

The AI is not a chatbot layered on top of forms. It IS the interface. There are no standalone search forms, booking forms, or PNR checkers. The AI surfaces context-relevant UI components (train lists, seat maps, journey trackers) alongside text. This eliminates the traditional form-filling UX and makes the interaction feel like a conversation with an intelligent travel agent.

### 2. Tool-Truth Architecture

The LLM must NEVER fabricate outcomes. Every action must go through a tool. Tools return standardized responses with `success: true/false`. The LLM reasons only over these responses. The system prompt enforces this with explicit "Tool Truth Rules" that are highlighted in a box. Violations are described as "CRITICAL FAILURE."

### 3. Deterministic State Machine

Every AI request follows an explicit 16-state finite state machine with validated transitions. This prevents silent failures, ensures every request terminates cleanly (COMPLETE, ERROR, CANCELLED, or TIMEOUT), and provides full observability through state history.

### 4. Browser Events (Not DOM Manipulation)

Tools return structured `BrowserEvent` objects instead of directly manipulating the DOM. The orchestrator validates events (schema, dedup, type checking), and the frontend dispatches them. This maintains a clean architectural boundary between the AI backend and the browser.

### 5. Server-Only API Keys

AI provider API keys are never bundled to the client. A Next.js API route proxies all requests. This is a hard requirement enforced at the architecture level. The `server-config.ts` file explicitly documents this constraint.

### 6. Self-Hosted Data Layer

Rapi is a separate service that scrapes Indian Railways data. This decouples the frontend from upstream data source instability, adds caching, and provides a clean typed API. The PNR scraper's CAPTCHA-solving capability (tesseract.js OCR on math expressions) is notable for dealing with the official IR portal's bot protection.

### 7. Minimal Infrastructure Dependencies

- No database (bookings stored in localStorage only)
- No stateful backend (Rapi is stateless with in-memory cache)
- No external search service (station autocomplete uses bundled 8,000+ station JSON)
- This makes the app deployable with zero infrastructure beyond Vercel + Render free tier

### 8. Streaming-First UX

The chat interface shows AI responses as they are generated. The streaming message system supports partial content updates, tool call indicators as inline annotations, and seamless component insertion. Users see progress immediately rather than waiting for a full response cycle.

### 9. Pure Utility Functions for Testability

State-deriving logic is extracted into pure functions (`booking-store-utils.ts`) that receive data and return data without React dependencies. This makes them trivially testable (36 tests) and reusable across different contexts.

### 10. Simulated Booking Flow

The booking flow is a simulation. `confirmBooking` generates deterministic PNRs from booking parameter hashes and saves to localStorage. No IRCTC API is called. This allows demonstrating the full booking UX without real payment or reservation integration.

---

*Document generated from codebase review. Reflects the system as implemented. Last updated: July 2026.*
