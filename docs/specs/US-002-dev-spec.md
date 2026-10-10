# US-002 Developer Spec — Vote with hidden cards

## Goal and non-goals
- **Goal:** Let every Participant pick and change one card while the room is in `voting`; others see only `Voted` / `Not voted`.
- **Non-goals:** Reveal, Revote, Results, Average, Consensus, post-reveal vote display (US-003); room create/join and roster structure (US-001); network-level vote privacy (D-005); custom scales, history, persistence.
- **Requirement:** [US-002](../requirements/US-002-vote-with-hidden-card.md)
- **References:** [decisions](../knowledge/decisions.md), [UI/UX](../design/ui-ux.md) (state matrix, selectors section 6), [US-001 spec](US-001-dev-spec.md) (format, Realtime design).
- **Decisions:** D-003, D-004, D-005, D-006, D-011, D-014, D-018 (all Accepted); D-023 (a leaving Participant's vote is excluded); D-008 (Revote clears votes, US-003).
- **Inputs inspected:** the requirement, decisions, UI/UX, US-001 spec, `src/types/room.ts`, `src/domain/room.ts`, `src/realtime/room-channel.ts`, `src/features/room/RoomShell.tsx`. `useRoomSession.ts`, `package.json` and test files were not inspected; see File table and Implementation tasks.

## AC coverage
Test names are planned labels, not test-case IDs; Test owns IDs. `Sending vote…` is transient: it is verified at unit level (fake timers) and in e2e only with a delayed Host reply (available: @playwright/test ^1.64, `page.routeWebSocket`).

Priority: AC-002-01..04 are demo-critical; AC-002-06 and implementation task 7 are lower priority with a 15 minute time-box.

| AC | Planned implementation | Unit test | Playwright e2e test | Assumption / contradiction |
|---|---|---|---|---|
| AC-002-01 | `CARDS` constant in `src/domain/room.ts`; `VotingCards` renders it in order for every role. | `room.test.ts`: `CARDS` equals `0,1,2,3,5,8,13,21,?`; `isCard` accepts exactly these. | `US-002.spec.ts`: Host and Guest contexts each show nine card buttons in that order. | — |
| AC-002-02 | `vote` session API, `voteReducer` client state machine, Host `Vote` reducer action, `room:vote-intent` / `room:vote-accepted`. | `vote.test.ts`: idle→pending→confirmed, confirmed→pending (replacement)→confirmed. `room-channel.test.ts`: ack matched by `requestId`. `room.test.ts`: latest vote wins. | `US-002.spec.ts`: select, then `aria-pressed=true` and own row `Voted`; change card, new card pressed. `Sending vote…` only in the delayed-reply case. | Pending card is outlined but `aria-pressed` stays tied to the confirmed card (AC says pressed only once confirmed; UI/UX says "outlined"). Host's own vote is confirmed synchronously, so the Host never shows `Sending vote…`. |
| AC-002-03 | `toPublicView` keeps building explicit fields; votes live outside `Participant`; own selection comes from local client state. | `room.test.ts`: after votes, `Participant` objects and public view contain no card value. `room-channel.test.ts`: published views and acks serialized contain no card. | `US-002.spec.ts`: Host sees Guest `Voted`, no card text in Guest row; Guest with intent blocked (dropped before reaching Host) shows `Not voted` at Host while own card is outlined. | D-005: the intent itself carries the card on the shared topic; the UI never renders it, and no confidentiality is claimed. |
| AC-002-04 | 5 s timer started when the intent is sent; failed `channel.send` also fails immediately; `room:vote-rejected` fails early. | `vote.test.ts`: pending→failed on timeout/rejection/send error; retry. `room-channel.test.ts`: fake `Timers`, no ack at 5 s emits `failed`. | `US-002.spec.ts`: Guest `room:vote-accepted` frames dropped; after 5 s message appears, own row stays `Not voted`, Retry works once frames pass. | 5 s is a baseline (Business rule 10). Host's own vote cannot fail this way. |
| AC-002-05 | Cards `disabled` when `phase !== 'voting'`; Host reducer ignores `Vote` in `revealed` (D-018 reason `not-voting`). | `room.test.ts`: `Vote` in `revealed` is `ignored`. Component-level disabled state only if a component test setup is agreed (open decision 6). | Not drivable in this slice: Reveal belongs to US-003. Test adds the e2e case when US-003 lands. | Coverage gap by design; recorded as risk. |
| AC-002-06 (lower priority, 15 minute time-box) | `connection` session event (`connected` / `lost`); `RoomShell` shows `Connection lost. Reconnecting…` and disables cards. | `room-channel.test.ts`: status sequence `SUBSCRIBED`→`CHANNEL_ERROR`/`TIMED_OUT`/`CLOSED`→`SUBSCRIBED` emits `lost` then `connected`; deliberate `close()` emits nothing. | `US-002.spec.ts`: `context.setOffline(true)` on a Guest, message shown and cards disabled; back online, cleared. | Detection and recovery latency of Supabase client status is UNVERIFIED; the e2e uses generous waits and records observed timing. |

## Realtime design

### Data path (privacy trace)
| Step | Carrier | Contains card value? |
|---|---|---|
| Guest selects card | local client state | yes (own selection only) |
| Guest → Host `room:vote-intent` | Broadcast on shared topic | yes; visible to anyone subscribed (D-005 accepted limit) |
| Host reducer | Host tab memory (`RoomState.votes`) | yes; only the Host tab holds the map |
| Host → all `room:public-view` | Broadcast | no, only `hasVoted` |
| Host → all `room:vote-accepted` / `room:vote-rejected` | Broadcast | no |
| Presence metadata | Presence | no |

Broadcast is not an authorization boundary. The Host validates every intent; clients ignore events whose `participantId` / `requestId` do not match their own pending request. `votes` is never added to `Participant`, `PublicView` or any event payload before reveal. US-003 defines the reveal payload.

### State ownership
- Host tab owns the vote map. `RoomState` is extended (see Domain API); `PublicView` and `Participant` types are unchanged (`hasVoted` already exists).
- The Host's own vote does not use Broadcast: `session.vote()` on the Host dispatches the reducer directly with the Host's `participantId`.
- Reducer rules for `Leave`: the leaving Participant's vote is deleted with the roster entry (D-023); the existing `Leave` revision increment covers it.

### Broadcast events
Exact event names. `Card` is defined in Domain API. Payloads from the wire are untrusted: the Host validates types, then the reducer validates values.

| Event | TypeScript payload sketch | Sender → handler |
|---|---|---|
| `room:vote-intent` | `{ requestId: string; participantId: string; roundId: number; card: Card }` | Guest → Host dispatches `Vote`. Other Guests ignore it. |
| `room:vote-accepted` | `{ requestId: string; participantId: string; roundId: number }` | Host → all; only the Guest whose pending `requestId` and `participantId` match confirms. Carries no card. |
| `room:vote-rejected` | `{ requestId: string; participantId: string; reason: 'invalid-card' \| 'round-mismatch' \| 'not-voting' }` | Host → all; only the matching Guest reacts by moving to `failed` early. Not sent for an unknown sender (no valid addressee). |
| `room:public-view` (existing) | unchanged | Host → all; published after a vote only when the public view changes. |

Host handling order for a vote intent: dispatch `Vote`; if the first vote of that Participant changed the public view, publish the view; then send the acknowledgement (so a Guest has the new view before the ack, given one ordered socket; ordering is not a documented guarantee, so the UI must tolerate either order). Rejected intents change nothing and send only `room:vote-rejected`.

### Confirmation of a replacement vote
- `hasVoted` is already `true` for a replacement, and a replacement publishes no new view, so it cannot signal acceptance. Only `room:vote-accepted` with the matching `requestId` confirms (Business rule 8).
- The client starts a 5 s timer when it sends the intent (injected `Timers`). No matching ack within 5 s: the selection becomes `failed` (`Vote was not confirmed. Try again.`). A `channel.send` rejection or non-`ok` status, or a matching `room:vote-rejected`, fails the vote immediately with the same message.
- Failed replacement (Business rule 8): the new card is marked not confirmed. The previously confirmed card stays the last known confirmed card; the Players status follows the Host's view. The Host may in fact have stored the new card (lost ack), which is why Retry resends the same card with a new `requestId` and the Host treats a same-card resend as `accepted` (idempotent) and acknowledges it.
- A late ack for the failed request's own `requestId` is accepted and moves `failed`→`confirmed` (it is an explicit Host acknowledgement). Acks for any other `requestId` are ignored (open decision 4).
- Only one request is in flight per Participant; cards are disabled while `pending` (open decision 2).

### Revision and publishing
- `revision` increases only when Host state changes: a first vote or a different card. A same-card resend is `accepted` but leaves state and revision unchanged (D-014).
- A replacement changes `votes` but not the public view, so no new `room:public-view` is published (recommended; open decision 1). Guests may observe a revision gap on the next publish; that is allowed because Guests only apply higher revisions.
- Transport publishes iff the voting Participant's `hasVoted` flipped (`isPublicViewChange`, Domain API).

## Domain API
Pure, I/O-free, no mutation of input state. Types go in [src/types/room.ts](../../src/types/room.ts); reducer in [src/domain/room.ts](../../src/domain/room.ts).

```ts
export type Card = '0' | '1' | '2' | '3' | '5' | '8' | '13' | '21' | '?'
export const CARDS: readonly Card[]
isCard(value: unknown): value is Card

// RoomState = Room & { votes: Record<participantId, Card> }; createRoom initializes votes to {}
RoomAction += { type: 'Vote'; participantId: string; roundId: number; card: string }
type VoteIgnoreReason = 'unknown-participant' | 'invalid-card' | 'round-mismatch' | 'not-voting'
RoomReducerResult += { reason?: VoteIgnoreReason }   // set only when a Vote is ignored
isPublicViewChange(prev: RoomState, next: RoomState): boolean
```

| Current state | Event | Result | Rejected / no-op behavior |
|---|---|---|---|
| Active, `voting`, current round | `Vote` from roster member (including Host), valid card, different from stored | Store card, set `hasVoted: true`, revision +1, outcome `accepted` | — |
| Same, same card as stored | `Vote` | `accepted`, state and revision unchanged | Transport still acknowledges. |
| Any | `Vote` from sender not in roster | `ignored`, reason `unknown-participant` | No state change; no rejection sent. |
| Any | `Vote` with card outside `CARDS` | `ignored`, reason `invalid-card` | No state change. |
| Any | `Vote` with `roundId` ≠ `state.roundId` | `ignored`, reason `round-mismatch` (D-018) | No state change. |
| `revealed` | `Vote` | `ignored`, reason `not-voting` | No state change. |
| `ended` | any | `ignored` (existing early return, no reason) | No rejection sent. |
| Active | `Leave` of a Guest with a vote | Roster entry and its vote removed, revision +1 | Existing `Leave` no-ops unchanged. |

Check order for `Vote`: ended, roster membership, card, round, phase. Latest accepted vote per Participant wins; the map holds at most one entry per Participant.

## Client vote state machine
Pure transitions in `src/domain/vote.ts`; timers and transport stay in the session (`room-channel.ts`) and `useRoomSession`.

```ts
type VoteUiState =
  | { status: 'idle'; confirmed: null }
  | { status: 'pending'; card: Card; requestId: string; confirmed: Card | null }
  | { status: 'confirmed'; card: Card; confirmed: Card }
  | { status: 'failed'; card: Card; requestId: string; confirmed: Card | null }
type VoteUiEvent =
  | { type: 'select'; card: Card; requestId: string }   // also Retry with the same card
  | { type: 'confirmed'; requestId: string }
  | { type: 'failed'; requestId: string }
  | { type: 'round-changed' }                           // view with a different roundId (US-003 Revote)
voteReducer(state: VoteUiState, event: VoteUiEvent): VoteUiState

// RoomSession additions
vote(card: Card): string                 // returns requestId; Host path is synchronous
SessionEvent += { type: 'vote-result'; requestId: string; result: 'confirmed' | 'failed' }
              | { type: 'connection'; status: 'connected' | 'lost' }
```

| From | Event | To | No-op / rule |
|---|---|---|---|
| `idle`, `confirmed`, `failed` | `select` | `pending` | Ignored unless phase `voting` and connected. Not accepted while `pending`. |
| `pending` | `confirmed` (matching `requestId`) | `confirmed` | Non-matching `requestId`: no change. |
| `pending` | `failed` (timeout, send error, rejection) | `failed`, keeps previous `confirmed` card | Non-matching `requestId`: no change. |
| `failed` | `confirmed` (late ack, same `requestId`) | `confirmed` | Any other `requestId`: ignored. |
| `failed` | `select` (Retry or other card) | `pending` with a new `requestId` | — |
| any | `round-changed` | `idle` | Used when US-003 lands; no effect in this slice. |

Own-selection display:

| State | Cards | `aria-pressed` | Visual marker | Own Players row | Message |
|---|---|---|---|---|---|
| `idle` | enabled | none pressed | none | Host view (`Not voted`) | — |
| `pending` | disabled | `confirmed` card only, if any | pending card outlined, `data-selection="pending"` | Host view | `Sending vote…` |
| `confirmed` | enabled | the confirmed card | pressed style | Host view (`Voted`) | — |
| `failed` | enabled | previous `confirmed` card only, if any | failed card `data-selection="failed"` with `Retry` button | Host view | `Vote was not confirmed. Try again.` |

- A pending or failed selection is never evidence of a vote: only the Host's `hasVoted` drives any Players row, including the Participant's own.
- Connection lost while `pending`: the 5 s timer continues and ends in `failed`. Cards are disabled until connected regardless of state.
- Host path: `vote()` dispatches the reducer, emits `vote-result: confirmed` synchronously; `pending` is never rendered for the Host.

## File table
| File | Existing / new | Reason |
|---|---|---|
| `src/types/room.ts` | Existing | `Card`, `votes` in `RoomState`, `Vote` action, `VoteIgnoreReason`, vote payload types. |
| `src/domain/room.ts` | Existing | `CARDS`, `isCard`, `Vote` reducer branch, `Leave` removes vote, `isPublicViewChange`. |
| `src/domain/vote.ts` | New | Client `voteReducer`. |
| `src/realtime/room-channel.ts` | Existing | Host vote handler and ack/reject, Guest `vote()` with 5 s timer, `vote-result` and `connection` events, ordering publish-then-ack. |
| `src/features/room/useRoomSession.ts` | Existing, not inspected | Expose vote state, `vote()` and connection state; keep effect cleanup. |
| `src/features/room/VotingCards.tsx` | New | Card grid, pending/failed markers, Retry, status messages. |
| `src/features/room/RoomShell.tsx` | Existing | Render `VotingCards` in the Round section; show `Voted` as well as `Not voted`; connection message. |
| `src/domain/room.test.ts`, `src/realtime/room-channel.test.ts` | Existing | Reducer and transport cases above. |
| `src/domain/vote.test.ts` | New | State machine cases. |
| `tests/e2e/US-002.spec.ts` | New | Multi-context e2e. |
| `tests/page-objects/RoomPage.ts` | Existing | Card, status and connection helpers. |

## UI contract
Role/name first; `data-testid` only where ambiguous. Selectors are owned here (UI/UX section 6).

| Element | Role and accessible name | `data-testid` | Exact text |
|---|---|---|---|
| Card group | group, `Voting cards` | `vote-cards` | — |
| Card | button, name equals the card (`0` … `21`, `?`), `aria-pressed`; use `exact: true` | — | `0`,`1`,`2`,`3`,`5`,`8`,`13`,`21`,`?` |
| Pending / failed marker | attribute on the card | `data-selection="pending"` / `"failed"` | — |
| Pending feedback | status | `vote-status` | `Sending vote…` |
| Not-confirmed feedback | alert | `vote-error` | `Vote was not confirmed. Try again.` |
| Retry | button, `Retry` | — | `Retry` |
| Players row status | inside `players-list` row text | — | `Voted` / `Not voted` (never a card value) |
| Connection feedback | status (polite) | `connection-status` | `Connection lost. Reconnecting…` |

Cards use the native `disabled` attribute when `phase !== 'voting'`, the connection is lost, or the state is `pending`. Layout per [UI/UX](../design/ui-ux.md) section 3 (5+4 grid, no blank cards). Do not add Reveal/Revote controls.

## Failure and recovery
- **Intent never reaches Host / ack lost:** `failed` after 5 s; Retry resends with a new `requestId`; Host idempotent for the same card.
- **Host rejects** (`invalid-card`, `round-mismatch`, `not-voting`): early `failed`, same message.
- **Connection lost:** cards disabled, `Connection lost. Reconnecting…`; cleared on a later `SUBSCRIBED`. The last view is stale until the next higher revision (see open decision 3). Host tab loss still ends the room (US-001).
- **Cleanup:** the session clears the vote timer on `close()` and ignores callbacks afterwards; no event after unmount.
- **Reorder risk:** Broadcast order is not documented as guaranteed (D-014). One in-flight vote per Participant limits it; a lagging old intent after a timeout and retry could still win at the Host. Accepted for the MVP (open decision 2).
- **Privacy boundary:** votes exist only in Host memory and in the intent on the wire; no payload from the Host carries a card (D-005).

## Implementation tasks
Commands are NOT VERIFIED: `package.json` was not inspected. Read the actual scripts before running anything.

| # | Task | Test level | Command |
|---|---|---|---|
| 1 | Add `Card`, `CARDS`, `isCard`, `votes`, `Vote` reducer branch, `Leave` vote removal, `isPublicViewChange`, with reducer tests. | Unit | Derive from `package.json`. |
| 2 | Add `voteReducer` with tests (every row of the transition table, stale `requestId`). | Unit | Derive from `package.json`. |
| 3 | Host intent handler, ack/reject, publish-then-ack, no card in any outbound payload; tests with fake channel and `Timers`. | Unit | Derive from `package.json`. |
| 4 | Guest `vote()`, 5 s timer, send-error failure, late ack, `connection` events (initial `SUBSCRIBED` guard in current code only handles the first status). | Unit | Derive from `package.json`. |
| 5 | `VotingCards`, `RoomShell` status text, connection message, `useRoomSession` wiring. | Unit/component per open decision 6 | Derive from `package.json`. |
| 6 | e2e: AC-002-01..04 and 06 with Host and Guest contexts; delayed/dropped frames for 02..04; offline for 06. | E2E | Derive from `package.json`; Playwright MCP if available. |
| 7 | Lower priority, 15 minute time-box: probe Supabase client status callbacks on network loss and recovery before relying on AC-002-06 timing. | Spike | Derive from `package.json`. |

## Open decisions
1. **Replacement vote publishes a view?** Recommended default: no; publish only when `hasVoted` flips. Owner: Developer; non-blocking.
2. **Disable cards while `pending`?** Adds a condition beyond AC-002-05/06 to keep one in-flight vote. Recommended default: yes (a `sequence` number per Participant is the upgrade if Test shows reorder). Owner: BA/mob; non-blocking.
3. **Resync after reconnect:** `room:sync-request` is deferred to post-MVP. Owner: Developer/mob; non-blocking.
4. **Late ack after failure:** recommended default: accept for the failed request's own `requestId` (truthful, explicit Host ack). Owner: BA; non-blocking.
5. **Rejection event vs requirement wording** (requirement says the Host "ignores"): recommended default: send `room:vote-rejected` for the three addressable reasons for faster failure; behavior stays "not accepted". Owner: BA; non-blocking.
6. **Component test setup:** `jsdom` and a React testing library may not be in the repo; D-001/D-012 do not list them. Recommended default: no new library; cover transient UI via `voteReducer` + fake-timer session tests and the delayed-reply e2e. Owner: mob; non-blocking.
7. **Supabase client status behavior** on loss/recovery (statuses and latency) is UNVERIFIED; task 7 verifies it. If it does not report recovery, return to BA before implementing AC-002-06.
8. **AC-002-05 e2e** cannot be written until US-003 provides Reveal; recorded as deferred coverage.
9. **Failed-state marker:** with a prior confirmed card, both that card (`aria-pressed`) and the failed card (`data-selection="failed"`) are marked. Recommended default as specified; BA/UX may prefer clearing the old marker.

## Risks
- A Guest may stay stale after reconnect until the next view.

## Handoff to Test
- **Story:** US-002. **Spec:** this file. Design cases for AC-002-01..06 in `docs/test-cases/US-002-test-cases.md` and assign IDs.
- Use separate Host and Guest contexts. Cover exact messages, `aria-pressed`, own-row vs other-row status and keyboard activation.
- Independent risk pass: no card text for other Participants in DOM and in `room:public-view` / ack payloads; replacement vote with lost ack then Retry; same-card resend; vote from unknown sender, invalid card, wrong `roundId`; Leave removing a vote; Host's own vote; offline/online cycle.
- Transient `Sending vote…`: delayed Host reply or fake timers; do not assert it in a plain e2e run.
- AC-002-05: unit coverage now; e2e after US-003.
