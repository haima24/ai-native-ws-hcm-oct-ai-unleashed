# Story Pointing

Realtime story pointing for teams (React 19, TypeScript, Vite, Tailwind, Supabase Realtime Broadcast).

## Prerequisites

- Node.js 22 or newer
- A Supabase project (only its URL and anon key are needed)

## Setup

1. Copy `.env.example` to `.env.local` and fill in `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. Never commit this file.
2. `npm install`
3. `npx playwright install chromium` (first time, for e2e tests)

## Scripts

- `npm run dev` — start the dev server at http://localhost:5173
- `npm run build` — type-check and build to `dist`
- `npm test` — run Vitest unit tests
- `npm run test:e2e` — run Playwright tests (starts the dev server; set `PLAYWRIGHT_BASE_URL` to target a deployed URL instead)
