# Product Brief

## Overview
Story Pointing is a planning-poker web app for agile teams. A Host creates a room, Guests join, everyone votes on a story with hidden Fibonacci cards, the Host reveals the results and can start a revote. One end-to-end flow, demoable in 5 minutes, built by one mob in one day.

## Target users
- Host: the room creator and the facilitator of the session, typically a Scrum Master or tech lead.
- Guests: developers and QA who join with a room code or link.
- Host and Guests are all Participants and can vote.
- Teams of 3-10 people, co-located or remote, using a desktop browser.

## Core features
1. **US-001 Create / join room**
   - Value: a team enters one shared session in seconds, with no signup.
   - Done when: the Host creates a room and gets a short code and share link; a Guest joins with a display name; both see the same live participant list.
2. **US-002 Vote with hidden cards**
   - Value: independent estimates, so nobody anchors on others' votes.
   - Done when: each Participant picks a card (0, 1, 2, 3, 5, 8, 13, 21, ?), can change it before reveal, and others see only "Voted / Not voted".
3. **US-003 Reveal, results and revote**
   - Value: the team sees the spread and agreement at once and re-estimates without a new room.
   - Done when: only the Host can reveal; all clients show every vote, the average (excluding `?`) and a consensus indicator (all numeric votes equal); only the Host can revote, which clears all votes for a new round in the same room.

## Success criteria
1. Host and Guest in separate browser contexts see roster updates within 2 s.
2. Before reveal, the UI of other Participants never shows vote values, only Voted / Not voted; network-level privacy is not guaranteed (D-005).
3. The Guest UI has no Reveal/Revote controls; the Host ignores such intents from non-Host clients.
4. Create > join > vote > reveal > revote > reveal works without a page reload.
5. After reveal, all clients show identical votes, average and consensus.
6. The public Vercel URL passes the Playwright happy-path e2e.

## Out of scope
- Login, accounts, roles beyond Host/Participant.
- Database tables or a custom backend server.
- Round history, export, analytics.
- Host migration (Host closing the tab ends the room).
- Backlog or Jira integration.
- Timers, chat, avatars, themes, custom decks, spectators, localization.

## Tech stack
- Frontend: React 19 + strict TypeScript + Vite + Tailwind. Rationale: fast setup, typed UI, stable selectors for tests.
- Realtime: Supabase Realtime Broadcast only, no tables. Rationale: real-time without writing a server; the Host tab owns room state (pure reducer), Guests send intents, the Host publishes state. Config via Vite env vars (Supabase URL + anon key); no secrets committed.
- Hosting: Vercel. Rationale: free public demo URL.
- Testing: Vitest for domain logic; Playwright e2e with separate Host and Guest contexts, authored and run through Playwright MCP, also runnable against the deployed Vercel URL. Rationale: fast logic checks plus real multi-user verification.

## Open decisions
- Hidden-vote privacy: any subscriber of a shared Supabase topic can read broadcasts. Accept a friendly-team threat model, or use private channels? Do not claim cryptographic privacy.
- Room code: 4 or 6 characters, case-insensitive?
- Consensus: all numeric votes equal, or within one adjacent card?
