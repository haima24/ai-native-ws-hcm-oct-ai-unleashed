---
applyTo: "src/domain/**/*.ts,src/types/**/*.ts,src/realtime/**/*.ts,src/features/room/**/*.ts"
---
# Room state and realtime

Context: no custom backend and no database tables. Supabase Realtime Broadcast carries messages. The Host tab owns room state; Guests send intents; the Host publishes state to everyone.

## Who decides
- The Host decides every state change. Guests only send intents.
- Keep rules (vote, reveal, revote, results) in pure domain reducers; keep send/receive in `src/realtime/`.
- Change a message format only after updating `docs/knowledge/decisions.md` or the spec.
- Reveal and revote are Host-only: the Host ignores or rejects these intents from any non-Host sender.

## Ordering
- Increase the room revision only for accepted changes; no-ops and rejections keep it.
- Ignore any state update whose revision is not newer, within the same room.
- A late vote from an earlier round must not count in a new round. Vote intents carry `roundId` (D-018); the Host rejects intents with a different `roundId`.

## Untrusted input
- Validate every incoming message at runtime: type, sender ID, vote value (0, 1, 2, 3, 5, 8, 13, 21, ?), and fields for the current phase. TypeScript types do not check network data.
- Check the sender is in the room and the action is allowed in the current phase. A client-sent ID or a hidden button proves nothing.

## Vote privacy
- Any subscriber of a shared topic can read broadcasts. Before claiming votes are private, trace each vote from Guest to Host and back, including logs.
- If votes travel readable on a shared channel, do not claim privacy. Report it, ask the mob to decide (friendly-team model or private channels), and propose the smallest fix. Never claim cryptographic privacy.

## Connections
- Subscribe before sending. Clean up channels and timers when leaving a room; ignore callbacks from an old room.
- Handle send failures that return an error status, not only thrown errors. A retry must not apply the same change twice.
- Supabase URL and anon key come from Vite env vars; never commit secrets.
