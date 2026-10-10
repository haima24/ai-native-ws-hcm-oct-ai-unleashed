# Decisions

These choices reuse the product direction in [product brief](../product-brief.md), which wins on any conflict. Accepted means chosen for planning, not implemented or verified. Proposed requires a decision before dependent implementation. Add a superseding entry when changing a choice; do not rewrite history.

| ID | Status | Choice | Reason |
|---|---|---|---|
| D-001 | Accepted | React 19, strict TypeScript, Vite | Fast setup, typed UI |
| D-002 | Accepted | Tailwind | Simple shared visual rules |
| D-003 | Accepted baseline | Supabase Realtime Broadcast only; no tables, no custom backend | Real-time without a server; privacy feasibility still needs design (D-005) |
| D-004 | Accepted | Host tab owns room state via a pure reducer; Guests send intents, Host publishes state | One state owner; host migration excluded |
| D-005 | Accepted | Friendly-team threat model: the UI never shows other Participants' votes before reveal | Network-level privacy is not guaranteed on a shared Supabase topic; do not claim cryptographic privacy |
| D-006 | Accepted | Phases are only `voting` and `revealed` | No waiting phase, story title or Next story in this MVP |
| D-007 | Accepted | Reveal and Revote are Host-only; Guests see no such controls and the Host ignores those intents from non-Host senders | UI hiding alone is not enforcement |
| D-008 | Accepted | Revote clears all votes and returns the same room to `voting` | Re-estimate without a new room |
| D-009 | Accepted | Average excludes `?` | Abstention is not a number |
| D-010 | Accepted | Consensus: all numeric votes equal; `?` is excluded like in Average | Matches the brief; see D-019 |
| D-011 | Accepted | Cards: 0, 1, 2, 3, 5, 8, 13, 21, ? | Fixed MVP scale |
| D-012 | Accepted | Vitest for domain logic; Playwright e2e with separate Host and Guest contexts, authored and run via Playwright MCP when available | Domain and cross-user verification |
| D-013 | Accepted target | Vercel hosting; the Playwright happy path also runs against the public URL | Public demo |
| D-014 | Accepted | Revision increases only for accepted changes; Guests ignore older state views | Do not rely on arrival order |
| D-015 | Accepted | Average shown to at most 2 decimals; no numeric votes shows `—` for Average and Consensus | Consistent result display |
| D-016 | Accepted | Room code is 6 characters, case-insensitive | Easy to share and type |
| D-017 | Accepted | Config only via Vite env vars: Supabase URL and anon key; no secrets committed | Browser config is public |
| D-018 | Accepted | Revote increments a `roundId`; vote intents carry it; the Host rejects intents with a different `roundId` | A late vote from an earlier round must not count in a new round |
| D-019 | Accepted | Consensus is all numeric votes equal; the adjacency rule is out of scope | Keeps the MVP rule simple |

| D-020 | Proposed | Allow Supabase Realtime Presence on the room channel (no tables, no custom backend) for join/leave and Host-left detection; the Developer verifies feasibility in the US-001 spec | Leave and Host-left detection need a signal beyond plain Broadcast; extends D-003 only if verified |
| D-021 | Accepted | Reveal requires at least one accepted vote; message `At least one vote is required to reveal` | Prevents revealing an empty round |
| D-022 | Accepted | Results show `<voted> of <participants> voted` using the current roster as denominator; an accepted `?` counts as voted | Makes participation clear without treating abstention as no vote |
| D-023 | Accepted | The result population is the current roster: a Participant who leaves is removed from Results and their vote is excluded; a Guest joining in `revealed` appears as `No vote` and changes only the participation denominator | Keeps displayed results aligned with current room membership |

No completed spike, deployment or test execution is implied by this table. Domain terms: [glossary](glossary.md). Screens: [UI/UX](../design/ui-ux.md).
