# RAILY

RAILY is an AI-powered travel assistant for Indian Railways. Users can describe a trip in plain language, explore train options, inspect coach layouts, track live journey updates, manage PNR details, and receive ticket-related updates through a conversational experience.

## Overview

This project combines a Next.js frontend with a server-side AI proxy and a railway data service. The experience is designed to feel like a natural-language operating layer over rail travel workflows rather than a traditional search-only UI.

## Key Features

- Natural-language trip planning and train discovery
- AI-assisted booking flow with conversational prompts
- Coach visualization and seat selection experience
- Live train tracking and delay-aware journey updates
- PNR lookup and booking history management
- Ticket email delivery and PDF-ready ticket workflows

## Tech Stack

- Next.js 16 with React 19 and TypeScript
- Tailwind CSS for styling
- Clerk for authentication
- Resend for email delivery
- OpenAI-compatible AI proxy routed through server-side environment variables
- Railway data service under the Rapi directory

## Getting Started

### 1. Install dependencies

```bash
npm install
```

### 2. Set up environment variables

Create a `.env.local` file in the project root with the following variables:

```env
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=your_clerk_publishable_key
CLERK_SECRET_KEY=your_clerk_secret_key

AI_PROVIDER=groq
GROQ_API_KEY=your_groq_key
# or use OPENROUTER_API_KEY with AI_PROVIDER=openrouter

RESEND_API_KEY=your_resend_key
RESEND_FROM_EMAIL=onboarding@resend.dev
```

If you are using the Rapi service separately, also configure its environment variables as needed from the Rapi project.

### 3. Run the app

```bash
npm run dev
```

Open http://localhost:3000 to view the app.

## Available Scripts

```bash
npm run dev      # start the Next.js development server
npm run build    # create a production build
npm run start    # run the production build locally
npm run lint     # run ESLint
```

## Project Structure

- app/ – app routes, API endpoints, and pages
- components/ – UI components for booking, chat, journey tracking, and train exploration
- lib/ – shared app logic, AI configuration, booking state, and API integrations
- Rapi/ – railway data scraping and route service

## Deployment

The repository includes deployment configuration for Vercel-style hosting and a separate Render-style service definition. The main app is intended to run as a Next.js deployment, while the Rapi service can be deployed independently if you want the railway data layer exposed separately.

## Notes

- AI provider credentials should stay on the server and never be exposed to the client bundle.
- The app is designed around Indian Railways data and workflows, but the underlying integrations may depend on external service availability.
