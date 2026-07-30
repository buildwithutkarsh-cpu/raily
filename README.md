# RAILY

RAILY is an AI-native travel assistant for Indian Railways. Users type conversational requests and the app surfaces train search results, PNR status, seat selection, ticket simulation, and journey tracking through an interactive chat-first UI.

## What is RAILY?

RAILY is not a traditional form-based booking site. It is a conversational operating layer that combines:

- Natural-language train search and itinerary planning
- Coach visualization and seat selection
- PNR status lookup and booking history management
- Live train tracking and delay-aware journey updates
- PDF ticket generation and email delivery
- A self-hosted railway data API service called `Rapi`

> Important: Booking is simulated. There is no real IRCTC booking integration. PNRs are generated deterministically and ticket delivery is simulated with a PDF/email workflow.

## Tech Stack

- Next.js 16 / React 19 / TypeScript
- Tailwind CSS v4
- Clerk for authentication
- Resend for email delivery
- Groq (default) or OpenRouter AI provider
- `pdfkit` for ticket generation
- TanStack React Query for client-side data fetching
- Self-hosted Rapi service for Indian Railways data scraping and caching
- Vitest for tests

## Architecture

RAILY is built as two cooperating services:

- `Next.js App` — front-end UI, AI orchestration, Clerk auth, email/PDF endpoints
- `Rapi` — self-hosted railway data API for train search, live status, PNR lookup, availability, and fare data

### Service boundaries

- `app/api/ai/chat/route.ts` proxies AI requests to the configured provider (Groq or OpenRouter) so API keys never reach the browser.
- `app/api/ai/health/route.ts` verifies provider configuration and reachability.
- `app/api/ticket/send/route.ts` generates ticket PDFs and sends email via Resend when configured.
- `lib/rapi/client.ts` is the single source of truth for all railway data requests.
- `Rapi/src/index.ts` boots an Express service with strict CORS, rate limiting, optional API key protection, and structured JSON responses.

### High-level architecture

```
Browser (Client)
  └─ Next.js App
       ├─ /app UI
       ├─ AI chat orchestration
       ├─ Clerk auth middleware
       └─ server-side API routes
            ├─ /api/ai/chat
            ├─ /api/ai/health
            └─ /api/ticket/send
                ↘ AI provider / Email provider
                    ↘ Groq/OpenRouter / Resend

Rapi service
  └─ Express API
       ├─ /api/v1/trains/*
       ├─ /api/v1/pnr/*
       ├─ /api/v1/stations/*
       └─ /api/v1/admin/*
```

### AI pipeline

The core user flow is chat-first and tool-driven. The app sends user messages to the AI proxy, streams provider responses back to the UI, and executes tools when the model requests them.

- `BookingStore` manages state and chat history
- `processWithAI()` handles streaming text, tool calls, and browser events
- Tools include train search, station lookup, live status, availability, PNR status, fare lookup, booking confirmation, ticket download, and email delivery
- Every tool returns a standard result object and may emit browser events rather than manipulating UI directly

### Rapi service

The Rapi service is a separate Express-based scraper API designed to keep Indian Railways data access isolated from the frontend.

- Uses cached, scraped railway data from sources like erail.in
- Supports station autocomplete, train search, train info, live status, availability, fare, and PNR lookup
- Includes a protected admin surface and strict rate limiting
- The app defaults to `http://localhost:3001`, but `NEXT_PUBLIC_RAPI_BASE_URL` can override it

### Deployment notes

- `vercel.json` is included for Vercel-style deployment of the Next.js app
- `next.config.ts` treats `pdfkit` as an external package so font metrics and PDF assets survive server bundling
- The Rapi service can be deployed independently if you want the data layer separated from the app

## Getting Started

### Requirements

- Node.js 22+ (recommended)
- npm
- A Clerk application for authentication
- A supported AI provider key (Groq or OpenRouter) for AI chat
- Resend API key for email delivery (optional, but required for email ticket sending)

### Install dependencies

```bash
npm install
```

### Environment variables

Create a `.env.local` file in the project root.

Recommended variables:

```env
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_xxx
CLERK_SECRET_KEY=sk_live_xxx

AI_PROVIDER=groq
GROQ_API_KEY=sk_xxx
# or
# AI_PROVIDER=openrouter
# OPENROUTER_API_KEY=sk_xxx

RESEND_API_KEY=rm_...
RESEND_FROM_EMAIL=onboarding@resend.dev

# Optional Rapi service URL override
NEXT_PUBLIC_RAPI_BASE_URL=http://localhost:3001
```

### Running the app

```bash
npm run dev
```

Then open `http://localhost:3000`.

### Running the Rapi service

The `Rapi/` service is designed to run separately for railway data.

```bash
cd Rapi
npm install
npm run dev
```

By default, the app expects Rapi at `http://localhost:3001`, but you can change that with `NEXT_PUBLIC_RAPI_BASE_URL`.

## Scripts

### App scripts

```bash
npm run dev       # start Next.js development server
npm run build     # production build
npm run start     # run production build locally
npm run lint      # run ESLint
npm run test      # run Vitest tests
npm run test:watch
```

### Rapi scripts

```bash
cd Rapi
npm run dev
npm run build
npm run start
npm run test
npm run test:security
npm run test:chaos
npm run test:memory
npm run test:headers
```

## Project structure

```text
.
├── app/                 # Next.js routes, layouts, pages, API routes
├── components/          # UI components for chat, train search, coaching, booking
├── lib/                 # shared logic, AI orchestration, Rapi client, ticket PDF
├── Rapi/                # self-hosted railway data service
├── public/              # static assets (if present)
├── README.md
├── ARCHITECTURE.md
├── next.config.ts
└── package.json
```

## Key files and folders

- `app/page.tsx` — landing page and marketing entry
- `app/app/layout.tsx` — protected app shell with Clerk integration
- `app/api/ai/chat/route.ts` — AI proxy route
- `app/api/ai/health/route.ts` — AI health endpoint
- `app/api/ticket/send/route.ts` — ticket generation and email API
- `lib/ai/server-config.ts` — provider configuration and API key handling
- `lib/rapi/client.ts` — single source of truth for Rapi requests
- `Rapi/src/index.ts` — Rapi service bootstrap and route registration

## Runtime behavior

- The app uses Clerk middleware (`proxy.ts`) to protect `/app` routes.
- The AI provider is configured server-side, and calls are proxied through `/api/ai/chat`.
- Railway data is fetched via the Rapi service and accessed through typed client wrappers.
- Ticket generation is handled server-side with `pdfkit`, and email delivery is optional via Resend.

## Notes

- This app is built around Indian Railways workflows, but it uses scraping and simulated booking logic.
- Do not commit API keys or secrets. Keep them in `.env.local`.
- If Resend is not configured, users can still download generated PDF tickets.
- Rapi may require its own environment variables when run separately; see `Rapi/` for details.

## Deployment

- The app includes `vercel.json` for Vercel-style deployment.
- `next.config.ts` marks `pdfkit` as an external package so PDF assets are preserved during server bundling.
- `ARCHITECTURE.md` contains deployment and service boundary guidance.

## Further reading

- `ARCHITECTURE.md` — architecture, data flow, and design decisions
- `Rapi/` — Indian Railways data service implementation and test coverage
- `app/` and `lib/` — AI orchestration and chat-first application logic
