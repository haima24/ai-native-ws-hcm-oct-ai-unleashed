# US-003 Dev Spec: Reveal, results and revote

## Goal and non-goals
- Goal: the Host reveals the round, every client shows identical per-Participant votes, Average, Consensus and participation, and the Host starts a Revote that clears the round.
- Non-goals: round history, export, next story, extra phases, network-level vote privacy (D-005), authenticating senders on Broadcast, host migration, changes to US-001 join/leave rules or US-002 card/pending UX.
- Requirement: [US-003](../requirements/US-003-reveal-results-and-revote.md)
- Decisions: D-004, D-005, D-006, D-007, D-008, D-009, D-010, D-014, D-015, D-018, D-019, D-021, D-022, D-023.

## Dependency on the US-002 vote contract
This spec follows the vote contract in [US-002 dev spec](US-002-dev-spec.md).

## AC coverage
Level: U = unit/protocol only (no UI trigger), E = also e2e. Priority: **DC** demo-critical, LP lower priority.

| AC | Level / priority | Implementation | Unit test | E2E test | Assumption |
|---|---|---|---|---|---|
| AC-003-01 | E / DC | `Reveal` reducer case; Host `reveal()`; publish view with `results` | Reveal in `voting` with 1 vote: phase `revealed`, revision + 1, roundId unchanged | Create, join, both vote, Host reveals; Guest sees `revealed` without reload; cards disabled on both | Card disabling in `revealed` is US-002 |
| AC-003-02 | E / DC | Reducer outcome `no-votes`; `reveal()` returns it; Host-only inline error | 0 votes: state identical, outcome `no-votes`; `?`-only counts as a vote; vote then retry succeeds | Host clicks Reveal with no votes: error visible, phase `voting`; after a vote Reveal works | A voter who left does not count (`Leave` deletes the vote, D-023; `computeResults` also filters by roster) |
| AC-003-03 | E + U / DC | Guest has no Reveal control and no `reveal()`; Host registers no Reveal intent handler | Fake channel: emit `room:reveal-intent`; no state change, no publish, no handler registered | Guest sees no Reveal button and `Waiting for Host to reveal.` | Sender ids cannot be authenticated (D-005); see "Host-only enforcement" |
| AC-003-04 | E / DC | `computeResults` entries; roster shows `results` values when `revealed` | Entries per roster member: value, `?`, `null` (No vote) | Host and Guest roster rows show same value, `?` and `No vote` | Roster order |
| AC-003-05 | E / DC | `computeResults.average` (integer math) | Worked examples R-01..R-12 | Average text equal on both clients | Card `0` is numeric |
| AC-003-06 | E / DC | `computeResults.consensus` | Worked examples R-01..R-12 | Consensus text equal on both clients | `?` and No vote excluded |
| AC-003-07 | E / LP | `computeResults.voted` / `participants` | Examples include `?` and No vote | Asserted in the main flow (cheap) | Denominator is the roster incl. Host |
| AC-003-08 | E / LP | Join in `revealed` publishes recomputed results via existing `publish()` | Join in `revealed`: entry `null`, `participants + 1`, `voted` unchanged | Optional third context joins after Reveal | Guest sees results from first view (join probe accepts it) |
| AC-003-09 | E / LP | `Leave` reducer deletes the vote (US-002, D-023); `computeResults` also filters by current roster as a defensive check | Leave in `voting` then Reveal: vote gone; Leave in `revealed` recomputes; `computeResults` ignores a vote of a non-roster id (R-11) | Optional: Guest closes page in `revealed` | Presence `leave` is the signal (US-001) |
| AC-003-10 | E + U / DC | `Revote` reducer case; clients derive empty selection from `roundId` | Phase `voting`, votes `{}`, all `hasVoted` false, roundId + 1, revision + 1; results `null` in view | Revote: roster back to `Not voted`, no results panel, cards enabled, can vote again | roundId increase itself is unit-only |
| AC-003-11 | E + U / DC | Guest has no Revote control and no `revote()`; Host registers no Revote intent handler | As AC-003-03 with `room:revote-intent` | Guest sees no Revote button and `Waiting for Host to start a revote.` | As AC-003-03 |
| AC-003-12 | U only / DC | Reducer phase guards; `Vote` round guard (US-002 reducer) | Reveal in `revealed` and Revote in `voting`: state identical, outcome `ignored`; vote with old roundId after Revote: no change, no revision bump | none (no UI trigger) | Stale intent outcome name follows US-002 |
| AC-003-13 | E (best effort) / LP | Reveal/Revote button `disabled` while connection is lost | none (UI only) | `context.setOffline(true)` on Host: button disabled; restore: enabled. Report NOT RUN if the transport status is not observable | Needs the US-002 `connection` session event |

## Host-only enforcement (AC-003-03, AC-003-11, D-007)
- Reveal and Revote are Host-local actions: only the Host session exposes `reveal()` / `revote()`, and the Host dispatches them directly to `roomReducer`.
- Recommended: the Host registers no `room:reveal-intent` or `room:revote-intent` handler. A Guest-sent intent therefore has nothing to act on, which satisfies "the Host ignores it" by design. A Guest session has no method that sends one.
- Limitation: Broadcast carries no authenticated sender. Any intent that said "from the Host" could be forged by any Guest, so a remote intent with a sender check would be false security (D-005). The same applies to a forged `room:public-view`; this friendly-team threat model does not defend against it and the spec does not claim to.

## Results
New pure function `computeResults(votes, participants)` in `src/domain/results.ts`. Population is the current roster; votes of non-roster ids are ignored.

- Entry: `{ participantId, value: Card | null }`, roster order; `null` means `No vote`.
- Numeric votes: entries whose value is not `null` and not `?`. Card `0` is numeric.
- Average: `sum` and `count` of numeric votes as integers. `hundredths = floor((200 * sum + count) / (2 * count))` (half up). Display: whole = `floor(h / 100)`, fraction = `h % 100`; fraction 0 omits it, a trailing zero is dropped (`6.50` -> `6.5`), otherwise two digits (`0.13`). `—` when `count = 0`.
- Consensus: `—` when `count = 0`; `Yes` when all numeric votes are equal; otherwise `No`.
- Participation: `voted` = entries with a value (`?` counts); `participants` = roster size; display `<voted> of <participants> voted`.

Worked examples for `src/domain/results.test.ts` (`—` is U+2014):

| # | Roster votes | Average | Consensus | Participation |
|---|---|---|---|---|
| R-01 | A none, B none (empty) | `—` | `—` | `0 of 2 voted` |
| R-02 | A `?`, B `?` (all `?`) | `—` | `—` | `2 of 2 voted` |
| R-03 | A `0`, B `0` (only zeros) | `0` | `Yes` | `2 of 2 voted` |
| R-04 | A `0`, B `?` | `0` | `Yes` | `2 of 2 voted` |
| R-05 | seven `0`, one `1` (1/8 = 0.125) | `0.13` | `No` | `8 of 8 voted` |
| R-06 | `5`, `5`, `8`, `8` (tie) | `6.5` | `No` | `4 of 4 voted` |
| R-07 | `3`, `5`, `8`, `?`, none | `5.33` | `No` | `4 of 5 voted` |
| R-08 | `5`, `5`, `?`, none | `5` | `Yes` | `3 of 4 voted` |
| R-09 | `1`, `2`, `2` (5/3 = 1.666...) | `1.67` | `No` | `3 of 3 voted` |
| R-10 | `13`, `21` | `17` | `No` | `2 of 2 voted` |
| R-11 | votes `{gone: 5}`, roster A `3` | `3` | `Yes` | `1 of 1 voted` |
| R-12 | `1` only, roster of 3 incl. 2 No vote | `1` | `Yes` | `1 of 3 voted` |

## File table
| File | Existing / new | Reason |
|---|---|---|
| [src/types/room.ts](../../src/types/room.ts) | Existing | `RoomAction` + `Reveal`, `Revote`; `RoomOutcome` + `no-votes`; `ResultEntry`, `RoundResults`; `PublicView.results` |
| `src/domain/results.ts` | New | Pure `computeResults`, defensively filtered by the current roster |
| `src/domain/results.test.ts` | New | Worked examples R-01..R-12 |
| [src/domain/room.ts](../../src/domain/room.ts) | Existing | `Reveal` / `Revote` reducer cases; `isPublicView` validates `results`; `Leave` deleting the vote is owned by US-002 (D-023) |
| [src/domain/room.test.ts](../../src/domain/room.test.ts) | Existing | Reducer and view-validation tests |
| [src/realtime/room-channel.ts](../../src/realtime/room-channel.ts) | Existing | `toPublicView` adds results when `revealed`; Host-only `reveal()` / `revote()`; no intent handlers |
| [src/realtime/room-channel.test.ts](../../src/realtime/room-channel.test.ts) | Existing | Publish, privacy, forged-intent, join/leave-in-`revealed` tests |
| [src/features/room/RoomShell.tsx](../../src/features/room/RoomShell.tsx) | Existing | Phase action, Guest texts, error, roster values, focus |
| `src/features/room/ResultsPanel.tsx` | New | Average, Consensus, participation |
| `src/features/room/useRoomSession.ts` | Existing, only if it wraps the session | Expose `reveal` / `revote` |
| US-002 selection state file | Existing (US-002) | Selection derived from `roundId` |
| `tests/e2e/US-003.spec.ts`, [tests/page-objects/RoomPage.ts](../../tests/page-objects/RoomPage.ts) | New / existing | Flow and selectors |

## Data and message shapes
Owner: Host tab owns `RoomState` (D-004). Guests only render `PublicView`.

```text
RoundResults = { entries: { participantId, value: Card | null }[];
                 average: string; consensus: 'Yes' | 'No' | '—';
                 voted: number; participants: number }
PublicView   = existing fields + results: RoundResults | null
```
- Event `room:public-view` is unchanged except for `results`. No new Broadcast events.
- `results` is `null` in `voting` and non-null in `revealed`. `toPublicView` builds it from `computeResults(state.votes, state.participants)` on every publish, so no field in a `voting` view ever holds a card value (D-005). It must not spread `RoomState` into the view.
- `isPublicView` rejects (malformed) a `voting` view with non-null `results` and a `revealed` view with null `results`; the guest keeps its current view.
- Guests render published values and never recompute, so all clients show identical text (success criterion 5).

Data path: Guest `Vote` intent -> Host reducer (`votes`, private to the Host tab) -> `voting` view (`hasVoted` only) -> Reveal -> `toPublicView` with `results` -> all clients. Revote -> `votes = {}`, `results = null`, roundId + 1. Vote intents themselves are visible on the Broadcast topic (D-005 limitation).

## State transitions
Reveal and Revote carry no sender: they are Host-local (see above).

| From | Event | To | Rejected / no-op behavior |
|---|---|---|---|
| `voting` | Reveal, at least one roster Participant has an accepted vote | `revealed`; revision + 1; roundId same | — |
| `voting` | Reveal, none | `voting`; outcome `no-votes`; revision same; Host shows error | Not published |
| `revealed` | Reveal | unchanged, outcome `ignored` | revision same |
| `revealed` | Revote | `voting`; `votes = {}`; all `hasVoted = false`; roundId + 1; revision + 1 | — |
| `voting` | Revote | unchanged, outcome `ignored` | revision same |
| any | Guest-sent Reveal / Revote intent | unchanged | No handler registered; nothing published |
| `revealed` | Guest `Join` / `Leave` (US-001) | `revealed`; revision + 1; republished with recomputed `results` (D-023) | Existing US-001 rejections |
| `voting` | `Vote` with `roundId` of an earlier round | unchanged | Rejected; revision same (D-018) |
| `revealed` | `Vote` | unchanged | Rejected (US-002) |
| `ended` | any | unchanged | Existing guard |

Rejected and no-op results never bump revision (D-014). Revealed -> Revote on the Host also emits the view locally through the existing `publish()`.

## UI contract
| Element | Role and accessible name | data-testid | Exact message |
|---|---|---|---|
| Reveal (Host, `voting`) | button `Reveal estimates` | — | — |
| Revote (Host, `revealed`) | button `Revote` | — | — |
| Reveal error (Host) | `role="alert"`, linked to the Reveal button via `aria-describedby` | `reveal-error` | `At least one vote is required to reveal` |
| Guest wait text, `voting` | paragraph | `phase-waiting` | `Waiting for Host to reveal.` |
| Guest wait text, `revealed` | paragraph | `phase-waiting` | `Waiting for Host to start a revote.` |
| Phase heading | heading with `tabIndex={-1}` containing the existing `room-phase` span | `phase-heading` | `Phase: voting` / `Phase: revealed` |
| Results panel | region `Results`, only when `revealed` | `results-panel` | — |
| Results heading | heading `Results`, `tabIndex={-1}` | `results-heading` | `Results` |
| Average value | value text only | `results-average` | e.g. `6.5`, `—` |
| Consensus value | value text only | `results-consensus` | `Yes`, `No`, `—` |
| Participation | full text | `results-participation` | `<voted> of <participants> voted` |
| Roster vote cell | inside each `players-list` row | `player-vote` | `Voted` / `Not voted` in `voting` (US-002); card value, `?` or `No vote` in `revealed` |

Behavior:
- Roster rows: values come from `results.entries` when `revealed`. Rows are matched by name text.
- Reveal error is derived from the outcome returned by `reveal()` plus the `revision` at that time, and hidden when the view revision changes or the next Reveal succeeds; no effect needed.
- Connection lost (`Connection lost. Reconnecting…`, owned by US-002): the Reveal/Revote button is `disabled`; the error text is unaffected.
- Focus: after a successful Reveal or Revote the Host focuses `phase-heading` directly in the click handler (the trigger button is replaced). A failed Reveal keeps focus on the button. Guest and roster updates never move focus.
- Guest never receives the control in the DOM (not just hidden).

## Failure and recovery
- Failures: Host publish fails after Reveal/Revote (existing `sendChecked` reports an error; Host state is not rolled back, so Guests may stay on the previous view). Host loses connection (buttons disabled). Malformed `results` (view ignored).
- Recovery: any later accepted change (Join, Leave, Reveal, Revote) republishes the full view. No resync event is added (non-goal); risk below.
- Privacy and lifecycle: values leave the Host tab only in a `revealed` view. Revote removes them from the view; clients drop the previous results when a higher-revision `voting` view arrives. Host tab closing ends the room (US-001).

## Implementation tasks
Commands from [package.json](../../package.json): `npm test` (Vitest), `npm run build`, `npm run test:e2e`.

| # | Task | Level | Command |
|---|---|---|---|
| 1 | Types in `src/types/room.ts` | build | `npm run build` |
| 2 | `computeResults` tests R-01..R-12 first, then implementation | unit | `npm test -- src/domain/results.test.ts` |
| 3 | Reducer tests first (Reveal, Revote, wrong-phase, stale vote, Join/Leave in `revealed`), then `Reveal` / `Revote` cases | unit | `npm test -- src/domain/room.test.ts` |
| 4 | `isPublicView` validation of `results`, tests first | unit | `npm test -- src/domain/room.test.ts` |
| 5 | `toPublicView` results; host `reveal()` / `revote()`; tests: published payload while `voting` contains no card value; forged intent ignored; Join/Leave in `revealed` republish | unit | `npm test -- src/realtime/room-channel.test.ts` |
| 6 | UI: `RoomShell`, `ResultsPanel`, roster values, focus, disabled-while-lost | build | `npm run build` |
| 7 | Local selection is cleared through the `voteReducer` event `round-changed` (US-002 spec) | unit/build | `npm test` |
| 8 | Page object and `US-003.spec.ts` after Test designs cases | e2e | `npm run test:e2e` |
| 9 | Full run: US-001 and US-002 tests must still pass | unit, e2e | `npm test`; `npm run build`; `npm run test:e2e` |
| 10 | Self-review in `docs/reviews/US-003-dev-review.md` with current evidence | — | — |

## Open decisions
| # | Decision | Owner | Blocking | Recommended default |
|---|---|---|---|---|
| 1 | ~~US-002 vote contract assumed~~ Closed: this spec follows the US-002 dev spec | — | No | — |
| 2 | Wording "Host ignores a Guest intent" vs no remote intent | Developer | No | No Reveal/Revote intent handler at all |
| 3 | Where Results are computed | Developer | No | Host computes in `toPublicView`; Guests render only |
| 4 | ~~Connection-lost signal~~ Closed: US-002 owns the `connection` session event | — | No | — |
| 5 | Delete a leaving Participant's vote in the `Leave` reducer | Developer | No | Yes, as in the US-002 spec (D-023); `computeResults` also filters by roster as a defensive check |
| 6 | Doc drift: [ui-ux.md](../design/ui-ux.md) still marks zero-vote Reveal and D-015 as Proposed though D-021 and D-015 are Accepted | BA / UX | No | Update the doc; this spec follows the decisions |
| 7 | Reveal when only `?` votes exist | BA | No | Allowed (`?` is an accepted vote); Average and Consensus `—` |
| 8 | Host publish failure leaves Guests stale | Developer | No | Accept and report the error; revisit with a resync event post-MVP |

## Risks
- A Guest voting at the moment of Revote gets a rejected intent; US-002 pending feedback must resolve it.
- Forged `room:public-view` or vote values cannot be prevented on Broadcast (D-005).
- `player-vote` is shared with US-002 and must keep both texts stable.

## Handoff to Test
- Story: US-003; spec: `docs/specs/US-003-dev-spec.md`; cases needed for AC-003-01..13 (add IDs to the coverage table).
- Unit: R-01..R-12; reducer transitions and no-ops (revision unchanged); round increase; stale vote after Revote; forged Reveal/Revote intent via fake channel; `voting` payload contains no card value; malformed `results`.
- E2E flow with separate Host and Guest browser contexts: create -> join -> Host `Reveal estimates` with no votes (error) -> both vote -> Reveal -> assert phase, roster values, Average, Consensus, participation on every client and deep-equal them -> Guest sees `Waiting for Host to start a revote.` -> Host `Revote` -> roster `Not voted`, no results panel, cards enabled -> vote again. Add a third context for AC-003-08 and a closing Guest for AC-003-09 as lower priority.
- Cannot be tested through the UI: roundId value, wrong-phase intents, stale vote intents, Guest-sent Reveal/Revote intents, network-level privacy (UX-08, separate boundary test), sender authentication, publish failure divergence. AC-003-13 depends on a controllable offline state.
- Independent risk pass: focus after Reveal/Revote, 20 Participants layout, `0` vs `No vote` vs `?` display, midpoint rounding.
- Existing US-001 and US-002 tests must keep passing.
