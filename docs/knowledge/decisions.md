# Decisions

These choices reuse the product direction in [product brief](../product-brief.md), which wins on any conflict. Accepted means chosen for planning, not implemented or verified. Proposed requires a decision before dependent implementation. Add a superseding entry when changing a choice; do not rewrite history.

| ID | Status | Choice | Reason |
|---|---|---|---|
| D-001 | Accepted | React 19, strict TypeScript, Vite | Fast setup, typed UI |
| D-002 | Accepted | Tailwind | Simple shared visual rules |
| D-003 | Accepted baseline | Supabase Realtime Broadcast only; no tables, no custom backend | Real-time without a server; privacy feasibility still needs design (D-005) |
| D-004 | Accepted | Host tab owns room state via a pure reducer; Guests send intents, Host publishes state | One state owner; host migration excluded |
| D-005 | Proposed; unresolved | Hidden-vote privacy: accept a friendly-team threat model, or use private channels | Any subscriber of a shared topic can read broadcasts; do not claim cryptographic privacy. Decide before US-002 |
| D-006 | Accepted | Phases are only `voting` and `revealed` | No waiting phase, story title or Next story in this MVP |
| D-007 | Accepted | Reveal and Revote are Host-only; Guests see no such controls and the Host ignores those intents from non-Host senders | UI hiding alone is not enforcement |
| D-008 | Accepted | Revote clears all votes and returns the same room to `voting` | Re-estimate without a new room |
| D-009 | Accepted | Average excludes `?` | Abstention is not a number |
| D-010 | Accepted | Consensus: all numeric votes equal; `?` is excluded like in Average | Matches the brief; adjacency rule is an open decision (D-016) |
| D-011 | Accepted | Cards: 0, 1, 2, 3, 5, 8, 13, 21, ? | Fixed MVP scale |
| D-012 | Accepted | Vitest for domain logic; Playwright e2e with separate Host and Guest contexts, authored and run via Playwright MCP when available | Domain and cross-user verification |
| D-013 | Accepted target | Vercel hosting; the Playwright happy path also runs against the public URL | Public demo |
| D-014 | Accepted | Revision increases only for accepted changes; Guests ignore older state views | Do not rely on arrival order |
| D-015 | Proposed | Average shown to at most 2 decimals; no numeric votes shows `—` for Average and Consensus | BA confirms in US-003 |
| D-016 | Proposed | Room code length (4 or 6) and case sensitivity; consensus as "all equal" vs "within one adjacent card" | Open decisions in the brief |
| D-017 | Accepted | Config only via Vite env vars: Supabase URL and anon key; no secrets committed | Browser config is public |

No completed spike, deployment or test execution is implied by this table. Domain terms: [glossary](glossary.md). Screens: [UI/UX](../design/ui-ux.md).
