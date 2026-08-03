<div align="center">

# RAILY

**An AI-native, conversational travel assistant for Indian Railways**

Chat-first train search, PNR tracking, seat selection, and simulated ticketing — powered by an LLM tool-calling pipeline and a self-hosted railway data service.

`Node >= 22` · `Next.js 16` · `React 19` · `TypeScript` · `Tailwind v4` · `MIT License`

</div>

---

> ⚠️ **Booking is simulated.** There is no real IRCTC booking integration. PNRs are generated deterministically and ticket delivery is simulated through a PDF/email workflow. RAILY is a demonstration/utility project, not a substitute for official booking channels.

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
  - [Service Boundaries](#service-boundaries)
  - [High-Level Diagram](#high-level-diagram)
  - [AI Pipeline](#ai-pipeline)
  - [Rapi Service](#rapi-service)
- [Getting Started](#getting-started)
  - [Requirements](#requirements)
  - [Installation](#installation)
  - [Environment Variables](#environment-variables)
  - [Running the App](#running-the-app)
  - [Running the Rapi Service](#running-the-rapi-service)
- [Scripts](#scripts)
- [Project Structure](#project-structure)
- [Key Files](#key-files)
- [Runtime Behavior](#runtime-behavior)
- [Deployment](#deployment)
- [Notes & Caveats](#notes--caveats)
- [Contributing](#contributing)
- [License](#license)

## Overview

RAILY reimagines Indian Railways ticket search as a conversation rather than a form. Users describe what they need in plain language, and the app surfaces train search results, PNR status, coach/seat visualization, ticket simulation, and journey tracking through an interactive, chat-first UI.

It is built as **two cooperating services**:

1. A **Next.js application** — UI, AI orchestration, auth, PDF/email endpoints.
2. **Rapi** — a self-hosted Express API that scrapes and caches Indian Railways data, kept isolated from the frontend.

## Features

-  Natural-language train search and itinerary planning
-  Coach visualization and interactive seat selection
-  PNR status lookup and booking history management
-  Journey tracking with schedule-based position estimates
-  PDF ticket generation with optional email delivery
-  Pluggable AI provider (Groq or OpenRouter)
-  Self-hosted data layer with rate limiting and admin controls

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16, React 19, TypeScript |
| Styling | Tailwind CSS v4 |
| Auth | Clerk |
| Email | Resend |
| AI Provider | Groq (default) or OpenRouter |
| PDF Generation | `pdfkit` |
| Data Fetching | TanStack React Query |
| Railway Data | Self-hosted `Rapi` service (Express) |
| Testing | Vitest |

## Architecture

### Service Boundaries

| File | Responsibility |
|---|---|
| `app/api/ai/chat/route.ts` | Proxies AI requests to the configured provider (Groq/OpenRouter) so API keys never reach the browser |
| `app/api/ai/health/route.ts` | Verifies provider configuration and reachability |
| `app/api/ticket/send/route.ts` | Generates ticket PDFs and sends email via Resend when configured |
| `lib/rapi/client.ts` | Single source of truth for all railway data requests |
| `Rapi/src/index.ts` | Boots an Express service with strict CORS, rate limiting, optional API key protection, and structured JSON responses |

### High-Level Diagram

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

### AI Pipeline

The core user flow is chat-first and tool-driven:

1. `BookingStore` manages conversation state and chat history.
2. `processWithAI()` handles streaming text, tool calls, and browser events.
3. Available tools: train search, station lookup, live status, availability, PNR status, fare lookup, booking confirmation, ticket download, and email delivery.
4. Every tool returns a standard result object and may emit browser events rather than manipulating the UI directly.

### Rapi Service

A separate Express-based scraper API that keeps Indian Railways data access isolated from the frontend.

- Uses cached, scraped railway data from sources like erail.in
- Supports station autocomplete, train search, train info, live status, availability, fare, and PNR lookup
- Includes a protected admin surface and strict rate limiting
- Defaults to `http://localhost:3001`; override via `NEXT_PUBLIC_RAPI_BASE_URL`

## Getting Started

### Requirements

- Node.js **22+** (recommended)
- npm
- A [Clerk](https://clerk.com) application for authentication
- An AI provider key — [Groq](https://groq.com) or [OpenRouter](https://openrouter.ai)
- A [Resend](https://resend.com) API key for email delivery *(optional — required only for emailed tickets)*

### Installation

```bash
git clone https://github.com/<your-org>/raily.git
cd raily
npm install
```

### Environment Variables

Create a `.env.local` file in the project root:

```env
# Auth (Clerk)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_xxx
CLERK_SECRET_KEY=sk_live_xxx

# AI provider
AI_PROVIDER=groq
GROQ_API_KEY=sk_xxx
# or
# AI_PROVIDER=openrouter
# OPENROUTER_API_KEY=sk_xxx

# Email (optional)
RESEND_API_KEY=rm_...
RESEND_FROM_EMAIL=onboarding@resend.dev

# Rapi service override (optional)
NEXT_PUBLIC_RAPI_BASE_URL=http://localhost:3001
```

>  Never commit `.env.local` or any file containing secrets.

### Running the App

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Running the Rapi Service

Rapi runs as a separate service for railway data:

```bash
cd Rapi
npm install
npm run dev
```

By default, the app expects Rapi at `http://localhost:3001`; override with `NEXT_PUBLIC_RAPI_BASE_URL` if needed.

## Scripts

### App

| Command | Description |
|---|---|
| `npm run dev` | Start the Next.js development server |
| `npm run build` | Production build |
| `npm run start` | Run the production build locally |
| `npm run lint` | Run ESLint |
| `npm run test` | Run Vitest tests |
| `npm run test:watch` | Run tests in watch mode |

### Rapi

| Command | Description |
|---|---|
| `npm run dev` | Start Rapi in development mode |
| `npm run build` | Build Rapi |
| `npm run start` | Run built Rapi service |
| `npm run test` | Run Rapi tests |
| `npm run test:security` | Security-focused test suite |
| `npm run test:chaos` | Chaos/resilience tests |
| `npm run test:memory` | Memory usage tests |
| `npm run test:headers` | HTTP header compliance tests |

## Project Structure

```text
.
├── app/                 # Next.js routes, layouts, pages, API routes
├── components/          # UI components for chat, train search, coaching, booking
├── lib/                 # shared logic, AI orchestration, Rapi client, ticket PDF
├── Rapi/                # self-hosted railway data service
├── public/              # static assets (if present)
├── README.md
├── next.config.ts
└── package.json
```

## Key Files

| Path | Purpose |
|---|---|
| `app/page.tsx` | Landing page and marketing entry |
| `app/app/layout.tsx` | Protected app shell with Clerk integration |
| `app/api/ai/chat/route.ts` | AI proxy route |
| `app/api/ai/health/route.ts` | AI health endpoint |
| `app/api/ticket/send/route.ts` | Ticket generation and email API |
| `lib/ai/server-config.ts` | Provider configuration and API key handling |
| `lib/rapi/client.ts` | Single source of truth for Rapi requests |
| `Rapi/src/index.ts` | Rapi service bootstrap and route registration |

## Runtime Behavior

- Clerk middleware (`proxy.ts`) protects all `/app` routes.
- The AI provider is configured server-side; calls are proxied through `/api/ai/chat` so keys never reach the client.
- Railway data is fetched via the Rapi service and accessed through typed client wrappers.
- Ticket generation runs server-side with `pdfkit`; email delivery is optional via Resend.

## Deployment

- `vercel.json` is included for Vercel-style deployment of the Next.js app.
- `next.config.ts` marks `pdfkit` as an external package so font metrics and PDF assets survive server bundling.
- The Rapi service can be deployed independently if you want the data layer separated from the app.

## Notes & Caveats

- This project targets Indian Railways workflows but relies on scraping and **simulated booking logic** — it is not connected to IRCTC.
- If Resend is not configured, users can still download generated PDF tickets directly.
- Rapi may require its own environment variables when run separately — see [`Rapi/`](./Rapi) for details.
- Do not commit API keys or secrets; keep them in `.env.local`.

## Contributing

Contributions are welcome! To get started:

1. Fork the repository and create a feature branch.
2. Run `npm install` in both the root and `Rapi/` directories.
3. Make your changes, adding tests where relevant (`npm run test`).
4. Run `npm run lint` before opening a PR.
5. Open a pull request describing the change and its motivation.

Please open an issue first for large or breaking changes so we can discuss the approach.

