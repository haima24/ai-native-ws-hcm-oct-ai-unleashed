# D-020 Presence spike results

**Status: NOT RUN.** The repo-root `.env.local` (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) does not exist in this checkout, so no live Supabase channel could be joined. No latency, missed/duplicated-leave or reload data has been observed. Nothing below is a measured result.

## Verdict

Presence OK for AC-001-09/10: **UNKNOWN (not measured)**. D-020 stays Proposed. The mob decides.

## Checks

| Check | Result | Detail |
|---|---|---|
| `node --check spikes/presence/run.mjs` | PASS | Syntax only |
| `tsc --noEmit --strict` on `spikes/presence/probe.ts` (ad-hoc flags, not in project tsconfig) | PASS | Type check only |
| `node spikes/presence/run.mjs` | NOT RUN | Exits with code 2 and "NOT RUN: .env.local is missing" |

## Channel config the probe is coded to use (not yet verified live)

- Channel `story-pointing:SPIKE01`; `config: { broadcast: { self: false, ack: true }, presence: { key: <participantId> } }`.
- Presence tracked `{ participantId, displayName, role }` after `SUBSCRIBED`.

## How to produce the real results

1. Create `.env.local` at the repo root with `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (see `.env.example`; anon key only).
2. Run `node spikes/presence/run.mjs` (~10 minutes: 6 presence scenarios x 5 trials plus 5 broadcast round trips; needs Playwright Chromium installed and port 5174 free).
3. The runner overwrites this file with, per scenario (a-f): min / median / max ms, missed and duplicated leaves, reload new-`participantId` behaviour and offline rejoin, plus the observed broadcast ack/round-trip and the verified channel config. It also writes `results.json` and computes the verdict (yes: no missed/duplicated leave and worst case within 2 s in scenarios a-e; partly: no missed leave but duplicates or over 2 s; no: any missed leave).

## Files

- `index.html`, `probe.ts`: probe page (`?role=host|guest`, optional `id`, `name`); exposes `window.__log`.
- `vite.config.ts`: serves the probe on port 5174 with `envDir` = repo root.
- `run.mjs`: Playwright (library) runner.
