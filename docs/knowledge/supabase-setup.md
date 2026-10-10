# Supabase setup

Sources: [decisions](decisions.md) (D-003, D-017, D-020), [US-001 dev spec](../specs/US-001-dev-spec.md) (Realtime design).
Never write real URLs, keys or tokens in this file.

## 1. Purpose

- Supabase is used for Realtime Broadcast and Presence only.
- No database tables, no Auth, no custom backend (D-003).
- Presence (D-020) is Proposed: it extends D-003 only if the spike verifies it.

## 2. Dashboard settings

Van fills the last column after checking the dashboard.

| Setting | Expected value | Why | Verified by / date |
|---|---|---|---|
| Public access for Realtime channels | Enabled (no Auth, so channels must be open to the anon key) | Guests join with no login | TBD |
| Project region | Closest to the team and demo audience; record it here | Lower Broadcast latency | TBD |
| Project status | Active (not paused) | Paused projects reject connections | TBD |
| Credentials used by the app | Project URL + anon key only; never the service-role key | Browser config is public (D-017) | TBD |

## 3. Client and channel configuration (decided for the app)

Confirm every row during the D-020 spike.

| Item | Value |
|---|---|
| Channel name | `story-pointing:<ROOM_CODE>` (normalized six-character code) |
| Broadcast `self` | `false` |
| Broadcast `ack` | `true` |
| Presence key | `participantId` |
| Presence tracking | Only after `room:join-accepted` (Host: after its own reducer state is initialized) |
| Presence metadata | `{ participantId, displayName, role }`; never used for authorization |

## 4. Environment variables

| Variable | Local | Vercel |
|---|---|---|
| `VITE_SUPABASE_URL` | `.env.local` | Project environment variables |
| `VITE_SUPABASE_ANON_KEY` | `.env.local` | Project environment variables |

- `.env.example` lists names with empty values; copy it to `.env.local`.
- Never commit values.

## 5. Demo-day checklist

- [ ] Supabase project is not paused.
- [ ] `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are set on Vercel and the latest deployment used them.
- [ ] Playwright happy path run against the public URL (`PLAYWRIGHT_BASE_URL=<public URL> npm run test:e2e`); result recorded.
- [ ] Project region noted in section 2.
