# Raily Project Tree

```
raily/
├── AGENTS.md                     # Next.js constraint rules
├── ARCHITECTURE.md               # Canonical architecture document
├── .env.example                  # Environment variables template
├── proxy.ts                      # Clerk middleware (protected routes)
├── next.config.ts                # Next.js configuration
├── tsconfig.json                 # TypeScript configuration
├── package.json                  # Dependencies + scripts
├── vercel.json                   # Vercel deployment config
├── render.yaml                   # Render deployment config (Rapi)
│
├── app/                          # Next.js App Router
│   ├── layout.tsx                # Root layout (Clerk, fonts, globals)
│   ├── page.tsx                  # Landing page (hero, features, FAQ)
│   ├── globals.css               # Design system tokens
│   ├── favicon.ico
│   ├── (chat)/                   # Route group: chat interface
│   │   ├── layout.tsx            # App layout (RapiQueryProvider + AppLayout)
│   │   └── page.tsx              # App entry (returns null)
│   ├── sign-in/                  # Clerk sign-in page
│   ├── sign-up/                  # Clerk sign-up page
│   └── api/                      # API routes
│       └── ticket/send/route.ts  # Email ticket PDF via Resend
│
├── features/                     # Feature-based modules
│   ├── chat/                     # Core chat interface
│   │   └── components/
│   │       └── ChatPanel.tsx     # Main chat with streaming, input, messages
│   ├── booking/                  # Booking features
│   │   └── components/
│   │       ├── BookingConfirmation.tsx  # Premium ticket display
│   │       └── BookingHistory.tsx       # Past bookings list
│   ├── trains/                   # Train search
│   │   └── components/
│   │       └── TrainExplorer.tsx  # Departure-board-style train list
│   ├── coach/                    # Coach visualization
│   │   └── components/
│   │       └── CoachVisualizer.tsx  # Interactive seat map
│   ├── journey/                  # Journey tracking
│   │   └── components/
│   │       └── JourneyTracker.tsx  # Metro-map-style timeline
│   └── pnr/                      # PNR status
│       └── components/
│           └── PNRManager.tsx     # PNR status card
│
├── components/                   # Shared components
│   ├── layout/
│   │   └── AppLayout.tsx         # TopBar + BookingProvider + ChatPanel
│   ├── shared/
│   │   └── UserMenu.tsx          # Sign out button
│   └── ui/                       # (empty) Reserved for UI primitives
│
├── lib/                          # Core libraries
│   ├── ai/                       # AI-native architecture
│   │   ├── index.ts              # Barrel export
│   │   ├── types.ts              # Core types
│   │   ├── provider.ts           # AI provider (Groq/OpenRouter)
│   │   ├── tools.ts              # RAPI tool definitions + execution
│   │   ├── prompts.ts            # System prompt + context builder
│   │   ├── memory.ts             # Conversation memory
│   │   └── orchestrator.ts      # Central orchestration
│   ├── rapi/                     # RAPI client layer
│   │   ├── client.ts             # HTTP client
│   │   ├── endpoints.ts          # 10 typed endpoint functions
│   │   ├── hooks.ts              # TanStack Query hooks
│   │   ├── provider.tsx          # React Query provider
│   │   └── transform.ts          # snake_case → camelCase
│   ├── booking-store.tsx         # Global state (React Context)
│   ├── ticket/
│   │   └── pdf.ts                # PDF ticket generation
│   ├── utils/
│   │   └── cn.ts                 # clsx + tailwind-merge utility
│   ├── auth/                     # (empty) Reserved for auth utilities
│   └── railway/                  # DELETED — old mock architecture
│
├── types/
│   └── pdfkit.d.ts              # PDFKit type declarations
│
└── Rapi/                         # Self-hosted Railway API
    ├── src/
    │   ├── index.ts              # Express server entry
    │   ├── config.ts             # Environment config
    │   ├── cache.ts              # In-memory cache (SWR, LRU)
    │   ├── routes/
    │   │   ├── trains.ts         # Train search, info, live, avail, fare
    │   │   ├── pnr.ts            # PNR status
    │   │   ├── stations.ts       # Station autocomplete
    │   │   └── admin.ts          # Cache health, telemetry
    │   ├── scrapers/
    │   │   ├── client.ts         # HTTP client with cookie jar
    │   │   ├── searchScraper.ts  # erail.in train search
    │   │   ├── infoScraper.ts    # erail.in train info
    │   │   ├── liveStatusScraper.ts  # etrain.info live status
    │   │   ├── pnrScraper.ts     # confirmtkt PNR (with OCR)
    │   │   └── availabilityScraper.ts # erail.in availability
    │   ├── utils/
    │   │   ├── parser.ts         # HTML parsing utilities
    │   │   ├── headers.ts        # Browser header generation
    │   │   └── errors.ts         # Error codes
    │   └── data/
    │       └── stations.json     # 8,000+ Indian railway stations
    └── test/                     # Vitest test suite
```

