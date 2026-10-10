# US-001 Developer Spec — Create / join room

## Goal and non-goals
- **Goal:** Let a Host create an ephemeral room and let Guests join it by code or link, with a shared live Players roster.
- **Non-goals:** Voting, reveal, revote, accounts, persistence, host migration, tables, or a custom backend.
- **Requirement:** [US-001](../requirements/US-001-create-join-room.md)
- **References:** [Product brief](../product-brief.md), [decisions](../knowledge/decisions.md), [glossary](../knowledge/glossary.md), [UI/UX](../design/ui-ux.md).
- **Decisions:** D-003 (Accepted baseline), D-004 (Accepted), D-006 (Accepted), D-014 (Accepted), D-016 (Accepted), D-017 (Accepted), D-018 (Accepted), D-020 (Proposed; approval required before using Presence).

## AC coverage
Test names below are planned coverage labels, not assigned test-case IDs; Test owns case design and IDs. Business rule 8 also needs a Guest reload e2e case (prefilled code/name, no automatic rejoin), although it has no AC.

| AC | Planned implementation | Unit test | Playwright e2e test | Contradiction or assumption |
|---|---|---|---|---|
| AC-001-01 | `createRoom` initializes Host state; `HomePage` opens `RoomShell` from accepted state. | `src/domain/room.test.ts`: creates voting room with Host as sole Participant. | `tests/e2e/US-001.spec.ts`: Host creates and sees code, link, phase and own row. | Room code generator uses the generation-only restricted alphabet. |
| AC-001-02 | `normalizeRoomCode`, `joinRoom`, Host reducer and public view. | `src/domain/room.test.ts`: normalized join and roster. | `tests/e2e/US-001.spec.ts`: Guest joins by mixed-case, whitespace-padded code in separate context. | Assumes connected Guest can receive a Host acknowledgement within the join deadline. |
| AC-001-03 | `HomePage` parses share-link code into `JoinForm`; joining remains explicit. | `src/domain/room.test.ts`: URL code normalization if extracted as pure helper. | `tests/e2e/US-001.spec.ts`: opening link prefills code only, then joins after name entry. | Share-link path/query representation is unspecified; use one canonical `?room=<CODE>` unless the UI already defines another. |
| AC-001-04 | Host reducer increments revision and broadcasts the sanitized roster view; subscribed clients apply only newer revisions. | `src/domain/room.test.ts`: accepted join increments revision; stale view ignored. | `tests/e2e/US-001.spec.ts`: Host and two Guest contexts show the same roster within 2 s of second Guest confirmation. | Transport-level 2 s performance is not guaranteed by the Presence documentation. |
| AC-001-05 | Shared `validateDisplayName` and `HomePage` field errors. | `src/domain/room.test.ts`: trimmed empty, 1/20-character valid, >20 invalid. | `tests/e2e/US-001.spec.ts`: empty/whitespace/long name, retained input, both forms. | Length uses trimmed JavaScript string length; if Unicode grapheme counting is intended, BA must decide. |
| AC-001-06 | Host reducer rejects case-insensitive duplicate before mutating state; rejection response stays targeted by request ID. | `src/domain/room.test.ts`: case/space-insensitive duplicate is a no-op and leaves existing roster unchanged. | `tests/e2e/US-001.spec.ts`: duplicate Guest receives exact error; other contexts stay unchanged. | Name comparison uses locale-independent `toLowerCase`; normalization beyond trim/case is unspecified. |
| AC-001-07 | `normalizeRoomCode` and `isWellFormedRoomCode` validate exactly six A-Z/0-9 characters after trim and uppercase. | `src/domain/room.test.ts`: blank, length, punctuation, lowercase and `0/O/1/I` cases. | `tests/e2e/US-001.spec.ts`: field errors and input retention for malformed codes. | Generation alone excludes look-alikes, as stated in Business rule 2. |
| AC-001-08 | `useRoomConnection` distinguishes failure to reach `SUBSCRIBED` by the deadline and releases the form lock. | `src/realtime/room-channel.test.ts`: subscribe timeout returns connection-timeout result. | `tests/e2e/US-001.spec.ts`: stalled connection shows `Could not connect in time. Try again.` and preserves inputs. | Create 10 s and join 5 s are unmeasured baselines; wall-clock deadline begins on submit. |
| AC-001-09 | Presence `leave` dispatches a Host reducer action only for an already-accepted Guest; Host publishes the resulting public view. | `src/domain/room.test.ts`: leaving Guest removal; released name can rejoin. | `tests/e2e/US-001.spec.ts`: close Guest context and verify Host/remaining Guest roster removal. | D-020 is Proposed. Leave event propagation is documented, but detection latency is not; see Presence verification. |
| AC-001-10 | Host Presence `leave` dispatches `EndByHost` only for the accepted Host ID; Guests show terminal message and return-home action. | `src/domain/room.test.ts`: Host leave ends room and rejects later joins. | `tests/e2e/US-001.spec.ts`: close and reload Host context; Guest sees ended-room message and old code cannot rejoin. | Host reload is treated as ending the room (requirements); Presence cannot distinguish an intentional close from transient disconnection. |
| AC-001-11 | After successful channel subscription, `joinRoom` waits for Host acceptance until the overall 5 s deadline; absence of a Host acknowledgement is unknown/unreachable. | `src/realtime/room-channel.test.ts`: subscribed but no Host acknowledgement returns room-unavailable, distinct from subscribe timeout. | `tests/e2e/US-001.spec.ts`: never-created/ended code and blocked acknowledgement show form-level error and retain inputs. | “Network unreachable” may fail before subscription and map to AC-001-08; see Open decisions. |

## Realtime design

### Channel and ownership
- Use one Supabase Realtime channel per normalized room code: `story-pointing:${roomCode}` where `roomCode` is six uppercase alphanumeric characters. D-016 makes lookup case-insensitive; normalization occurs before channel creation.
- Host tab owns the canonical room state and is the only writer of accepted roster/public views (D-004). Guests send intents and consume public views. No database tables or custom backend.
- Enable Broadcast on the room channel. Presence is the proposed same-channel lifecycle signal (D-020); do not depend on it until the decision is approved and feasibility verified.
- Each browser tab generates a random `participantId` and `requestId` locally. A Guest tracks Presence only after receiving `room:join-accepted`, using the accepted `participantId` as its unique Presence key; rejected and pending Guests never appear in Presence or the roster. The Host tracks only after initializing its own reducer state. Presence metadata is `{ participantId, displayName, role }`; do not treat a client-supplied role as authorization.
- Broadcast is not an authorization boundary. Any subscriber may observe or forge messages; the Host validates every intent, and the public view carries no vote values. Do not claim network-level vote privacy (D-005).

### Broadcast event contract
The listed names are the exact application Broadcast event names. `revision` advances only for an accepted room-state change; receivers ignore older revisions (D-014). `roundId` is carried with room views and any round-sensitive intents (D-018); US-001 does not implement votes.

| Event | TypeScript payload sketch | Sender → handler |
|---|---|---|
| `room:join-intent` | `{ requestId: string; participantId: string; displayName: string }` | Guest → Host validates normalized name and applies `join`. Other Guests ignore it. |
| `room:public-view` | `{ roomCode: string; revision: number; roundId: number; phase: 'voting' \| 'revealed'; participants: Array<{ participantId: string; displayName: string; role: 'host' \| 'guest'; hasVoted: boolean }>; ended: boolean }` | Host → all Guest subscribers. Host renders its local reducer result. Clients verify room code and apply only a higher revision. `hasVoted` is status only; never include vote values before reveal. |
| `room:join-accepted` | `{ requestId: string; participantId: string; roomCode: string; revision: number }` | Host → all channel subscribers; only matching joining Guest accepts it. Host sends only after reducer acceptance and publishes the corresponding public view. |
| `room:join-rejected` | `{ requestId: string; reason: 'duplicate-name' }` | Host → all channel subscribers; matching Guest maps to `That name is already taken in this room.` Other clients ignore it. |
| `room:host-left` | `{ roomCode: string; participantId: string; revision: number }` | Host → Guests as best-effort orderly-close notification; Guests validate the Host participant ID and end the view. Abrupt tab close/reload cannot rely on this event; Presence leave is the candidate signal. |
| `room:guest-left` | `{ roomCode: string; participantId: string }` | Accepted Guest → Host, best-effort on `pagehide` (D-024); the Host dispatches `Leave` only for a current non-Host roster member and ignores anything else. Presence leave remains the fallback; a duplicate Leave is a no-op. |

Presence is a Supabase protocol, not an application Broadcast event: configure its key as `participantId`, and track `{ participantId, displayName, role }`. Presence is used only to detect departure of an already-accepted Participant; it does not discover rooms or accept joins. Roster changes occur only through reducer actions: Host-accepted `Join`, `Leave`, or `EndByHost`. Presence `join`/`sync` never changes the roster; the Host ignores entries whose IDs are not already in reducer state. A Presence `leave` for an already-accepted Guest dispatches `Leave`; a Presence `leave` for the accepted Host dispatches `EndByHost`.

### Pure domain API and state transitions
Keep domain operations deterministic and I/O-free. Supabase, timers and browser storage remain in `src/realtime` or feature hooks; IDs and generated codes are passed in rather than generated by the reducer.

```ts
normalizeRoomCode(input: string): string
isWellFormedRoomCode(code: string): boolean
validateDisplayName(input: string): { value: string } | { error: 'required' | 'too-long' }
createRoom(input: { roomCode: string; hostId: string; displayName: string }): RoomState
type RoomReducerResult = { state: RoomState; outcome: 'accepted' | 'duplicate-name' | 'invalid-name' | 'ignored' }
```

The reducer returns a deterministic outcome so transport can send a rejection without repeating domain validation:

```ts
roomReducer(state: RoomState, action: RoomAction): RoomReducerResult
```

`RoomState` includes normalized code, revision, roundId, phase, status (`active` or `ended`), Host ID, and Participants. `RoomAction` for this slice is `Join { participantId, displayName } | Leave { participantId } | EndByHost`. The reducer trims names, enforces 1–20 characters and room-unique case-insensitive names (including Host), and never mutates input state.

| Current state | Input/event | Result | Rejected / no-op behavior |
|---|---|---|---|
| No room | `createRoom` with normalized valid code and Host name | Active room, `voting`, revision 0, roundId 1, Host as sole Participant | Invalid name/code returns a validation result at the feature boundary; never create partial state. |
| Active | Host accepts Guest `Join` intent | Add Guest, increment revision once; preserve phase and roundId; send `room:join-accepted`, then Guest may track Presence. | Duplicate name (case-insensitive), invalid name, duplicate participant ID, or ended room: no state change; duplicate name yields `room:join-rejected`; pending/rejected IDs are not roster members. |
| Active | Presence `leave` for an already-accepted Guest; dispatch reducer `Leave` | Remove that Guest, increment revision once; Host publishes roster. | Presence `join`/`sync` never changes roster; unknown or unaccepted participant and duplicate leave are no-ops. |
| Active | Presence `leave` for the accepted Host; dispatch reducer `EndByHost` | Mark ended, remove live room availability, increment revision; notify connected Guests. | Presence for an unknown/non-Host ID is ignored; repeated end is a no-op. Host reload is not room recovery. |
| Any view | Public view with revision ≤ current, wrong code, or malformed payload | Keep current view. | Ignore stale/mismatched messages; report malformed transport data through the realtime error path, not a success fallback. |

### Join flow and timeout distinction
1. Normalize/validate the form synchronously; field errors do not open a channel.
2. Start one wall-clock deadline at submit: 10 s for Host create, 5 s for Guest join. Disable duplicate submission and show `Connecting…`.
3. Guest opens the normalized room channel and waits for Supabase status `SUBSCRIBED`. If it does not arrive by the deadline, return the AC-001-08 connection-timeout result: `Could not connect in time. Try again.`
4. After subscription, Guest sends `room:join-intent` but does not track Presence yet. The Host applies reducer `Join`; on acceptance it sends `room:join-accepted` and the public view. Only then does the Guest track Presence with the accepted ID. A rejection maps to the duplicate-name field error and the Guest never tracks Presence.
5. If channel subscription succeeded but there is no matching Host acceptance by the original 5 s deadline, show the AC-001-11 form-level message: `Room not found or unreachable. Check the code and try again.` This includes a never-created/ended room and an unresponsive Host on an established channel.
6. Keep typed code/name on either failure and unsubscribe/untrack the failed joining tab. The distinction answers requirement open question 10 by observable transport state, not by inferring room existence from a failed connection.

## Presence verification (D-020)
- **Source checked:** Supabase Realtime Presence documentation, [supabase.com/docs/guides/realtime/presence](https://supabase.com/docs/guides/realtime/presence), checked 2026-10-10.
- **Verified from the current docs:** Presence tracks state for connected clients on a shared channel. `sync`, `join`, and `leave` events are exposed; the documentation explicitly says a client disconnect triggers Presence events and that `untrack()` triggers `leave`. A unique Presence key can be configured. This supports Presence as a candidate for closed-tab and reload lifecycle signals without application tables or a custom timer.
- **Important documented caveat:** a `sync` may contain apparent `join` and `leave` events as state reconciliation; consumers must reconcile complete state rather than equate each diff with a user action.
- **UNVERIFIED:** The docs do not promise how quickly server-side disconnect detection occurs, a delivery SLA for `leave`, or detection within the story's 2 s roster target. They do not guarantee a browser's tab close/reload is distinguishable from transient transport loss. Do not add an arbitrary application timer to manufacture certainty.
- **Fallback:** D-020 remains Proposed until a small implementation spike demonstrates channel behavior. If Presence does not provide the needed lifecycle signal, stop before implementation of AC-001-09/10/11 and return to BA/mob to revise the ACs or approve a different mechanism; do not silently add tables, a backend, or a custom timeout detector.

## File table
Planned paths only; repository code boundaries and existing files were not inspected because inputs were restricted to the five named documents.

| Path | Existing / new | Purpose |
|---|---|---|
| `src/domain/room.ts` | New | Pure room state, `createRoom`, normalization, validation, reducer and transitions. |
| `src/types/room.ts` | New | Room, Participant, action, view and typed realtime payload contracts. |
| `src/realtime/supabase.ts` | New | Vite-configured Supabase client and channel lifecycle; no credentials beyond D-017 public values. |
| `src/realtime/room-channel.ts` | New | `joinRoom`, channel name, Broadcast event handlers, Presence tracking and typed transport results. |
| `src/features/room/HomePage.tsx` | New | Create/join forms, URL prefill, validation and connecting/error states. |
| `src/features/room/RoomShell.tsx` | New | Room header, Players roster, phase, leave/Host-left view. |
| `src/features/room/useRoomSession.ts` | New | Feature orchestration, reducer invocation and effect cleanup. |
| `src/features/room/useRoomConnection.ts` | New | `useRoomConnection` hook for connection deadlines, form state and failure results. |
| `src/domain/room.test.ts` | New | Vitest coverage for reducer, validation and code helpers. |
| `src/realtime/room-channel.test.ts` | New | Vitest coverage distinguishing subscribe timeout from missing Host acknowledgement. |
| `tests/e2e/US-001.spec.ts` | New | Multi-context Playwright create/join, roster, validation and lifecycle tests. |
| `tests/page-objects/HomePage.ts` | New | Accessible Home form interactions and message assertions. |
| `tests/page-objects/RoomPage.ts` | New | Room header, Players, phase and Host-left interactions/assertions. |

## UI contract
Use native labeled inputs/buttons, visible focus, field-associated validation and accessible alert feedback. Selectors are owned here; use role/name first and `data-testid` only for otherwise ambiguous live state.

| Element | Role and accessible name | `data-testid` (only if needed) | Exact text |
|---|---|---|---|
| Display name | textbox, `Display name` | — | — |
| Room code | textbox, `Room code` | — | — |
| Create submit | button, `Create room` | — | — |
| Join submit | button, `Join room` | — | — |
| Connecting feedback | status | `connection-status` | `Connecting…` |
| Field error | alert associated with input | `field-error` only if association is insufficient | `Enter a display name.` / `Display name must be 20 characters or fewer.` / `That name is already taken in this room.` / `Enter the room code.` / `Room code must be 6 letters or digits.` |
| Form-level join failure | alert above Join submit | `form-error` | `Room not found or unreachable. Check the code and try again.` |
| Connection failure | alert in submitted form | `form-error` | `Could not connect in time. Try again.` |
| Host-left message | alert and button `Return to Home` | — | `The Host closed the room. Return to Home to start or join another room.` |
| Room code in header | text | `room-code` | normalized six-character code |
| Players | heading and list; count equals rows | `players-list` | `Players (n)`; row annotations `Host`, `You`; no vote `Not voted` |
| Phase | heading/status | `room-phase` | `voting` or `revealed` |

The requirement includes no exact label for the Host-left return control; `Return to Home` is the recommended accessible name. Copy-link strings remain those in UI/UX: `Copy link`, `Link copied`, and `Could not copy link. Select and copy the link.` Do not add voting/reveal/revote controls in this story shell.

## Failure and recovery
- Validation errors stay local to the field and preserve entered values. Duplicate-name rejection does not mutate the roster.
- Connection failure and no Host acknowledgement are separate outcomes based on channel subscription status; both unlock submit and preserve form values.
- Host-tab termination ends the room; Guest sees a terminal message and may return to Home. Host reload starts at Home; no migration or automatic rejoin.
- The room code is read from the `?room=<CODE>` URL parameter, which is set or retained after successful joining. On successful Guest join, save the display name in `sessionStorage`; Home reads it on Guest reload. No other state is persisted and reload never automatically rejoins.
- Broadcast and Presence are not cryptographic privacy boundaries. Only the Host reducer accepts state changes; Guests ignore stale revisions and mismatched room codes. No votes are part of this slice's public payload.
- `useRoomSession` must unsubscribe/untrack and ignore callbacks after unmount; surface transport errors instead of presenting a successful join.

## Implementation tasks
Tasks are small, ordered and intended to be independently committable. Repository/package scripts were not inspected under the user's input restriction; commands below are explicitly not verified and must be filled from actual `package.json` before execution.

| # | Task | Test level | Command |
|---|---|---|---|
| 1 | Scaffold Vite + React 19 + strict TypeScript + Tailwind + Vitest; establish accessible app entry and the npm scripts `dev`, `build`, `test`, and `test:e2e`. | Unit smoke/build | NOT VERIFIED — derive from `package.json`. |
| 2 | Provision Supabase project and configure Vite URL + anon key only; no secrets committed (D-017). Record no project credentials in the spec. | Startup/config smoke | NOT VERIFIED — derive from `package.json`; configuration check only. |
| 3 | Run a standalone D-020 Presence disconnect/reload spike for Guest and Host; record evidence and obtain approval before any AC-001-09/10/11 implementation depends on Presence. | Two-client e2e probe | NOT VERIFIED — derive from `package.json`. |
| 4 | Implement room types, normalization, validation and pure reducer; add unit tests for joins, leaves, duplicate names and code handling. | Unit | NOT VERIFIED — derive from `package.json`. |
| 5 | After the Presence gate passes, implement channel adapter, Broadcast messages, accepted-member Presence tracking, revisions and cleanup. | Unit adapter tests; two-client e2e probe | NOT VERIFIED — derive from `package.json`. |
| 6 | Implement Home and Room shell with exact requirement messages, share-link prefill, connecting state, roster and terminal Host-left view. | Component/unit tests | NOT VERIFIED — derive from `package.json`. |
| 7 | Add Playwright e2e with distinct Host and Guest browser contexts, covering every AC, Guest reload for Business rule 8, and uncapped extra Guest where needed. | E2E | NOT VERIFIED — derive from `package.json`; run with Playwright MCP when available. |
| 8 | Deploy to Vercel with public Vite environment values and run the happy path against the public URL. | Deployed e2e | NOT VERIFIED — derive from `package.json`; deployment command depends on project setup. |

## Open decisions and risks
- **D-020 Presence (blocking):** Proposed, not accepted. Recommended default: approve Presence as a narrow D-003 extension (same channel, no tables/backend) only if the disconnect/reload spike succeeds; otherwise revise AC-001-09/10/11 before coding.
- **Presence timing (risk):** Current docs do not establish leave-event latency or AC-001-04's 2 s guarantee. No arbitrary custom timer is an acceptable fallback.
- **Unknown/unreachable vs connection timeout:** Spec answer is subscription-state based. A network path that allows channel subscription but blocks Host responses maps to AC-001-11; a path that cannot subscribe maps to AC-001-08. Confirm this aligns with Test's controlled network setup.
- **AC and decision consistency:** Requirement traceability lists D-003 for AC-001-11, while D-003 is Broadcast-only and Presence is only proposed by D-020. Approval or an explicit superseding decision is required.
- **Requirement rule with no AC:** Business rule 5 (Guest joins in either phase with no vote) remains in scope but its former AC was removed. Recommended default: Test covers it against the room shell, and BA restores a dedicated AC if the mob requires AC-only traceability.
- **Lifecycle semantics:** Presence cannot establish why a tab disconnected; requirement intentionally treats Host reload as room end. Do not auto-recover the old room on reload.
- **Environment scripts:** Package scripts and existing file layout were not inspected; commands and “new” file statuses must be reconciled before implementation.

## Handoff to Test
- Story: US-001. Spec: this file. Design independent Playwright cases for AC-001-01 through AC-001-11 using separate Host and Guest browser contexts; assign stable test-case IDs in the test-case artifact.
- Cover exact field/form messages, input retention, double-submit prevention, share-link prefill without auto-join, and separate connection-timeout vs no-Host-ack outcomes.
- Cover Business rule 5 explicitly: Guest can join in `voting` and `revealed`, sees the current phase, and has no vote; do not add voting behavior.
- Cover Business rule 8 explicitly: Guest reload returns to Home with room code and display name prefilled and does not automatically rejoin.
- Independently challenge duplicate names with case and surrounding spaces, generated vs accepted code alphabets, stale revisions, Host and Guest tab close/reload behavior, and the 2 s roster threshold.
- Validate Presence disconnect/reload behavior against current Supabase behavior; record observed conditions and latency. Do not interpret synthetic `sync` reconciliation join/leave diffs as user actions.
