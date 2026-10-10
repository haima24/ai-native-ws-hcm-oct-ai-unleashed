# US-003 Dev Spec: Reveal, results and revote

## Goal and non-goals
- Goal: the Host reveals the round, every client shows identical per-Participant votes, grouped vote counts and participation, and the Host starts a Revote that clears the round.
- Non-goals: round history, export, next story, extra phases, network-level vote privacy (D-005), authenticating senders on Broadcast, host migration, changes to US-001 join/leave rules or US-002 card/pending UX.
- Requirement: [US-003](../requirements/US-003-reveal-results-and-revote.md)
- Decisions: D-004, D-005, D-006, D-007, D-008, D-014, D-018, D-021, D-022, D-023, D-025 (supersedes D-009, D-010, D-015, D-019 for Results).
- Note: the decisions log also has a Proposed D-025 for US-004 (vintage theme). In this spec D-025 means the Accepted grouped-counts decision.

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
| AC-003-05 | E / DC | `computeResults.groups` (one group per card cast by a current Participant); `ResultsPanel` rows with card label, bar and count text | Worked examples G-01..G-12 (TC-003-13..24); malformed `groups` (TC-003-12) | `results-group` rows and count texts equal on both clients (TC-003-25..27) | Card `0` and `?` are cards; No vote is excluded |
| AC-003-06 | E / DC | `computeResults.groups` order (numeric ascending, `?` last); one horizontal bar per row | G-04, G-09, G-10 (ordering) | Row order and bar presence equal on both clients (TC-003-25) | Bar width is derived from published counts; it is not an independent data source |
| AC-003-07 | E / LP | `computeResults.voted` / `participants` | Examples include `?` and No vote | Asserted in the main flow (cheap) | Denominator is the roster incl. Host |
| AC-003-08 | E / LP | Join in `revealed` publishes recomputed results via existing `publish()` | Join in `revealed`: entry `null`, `participants + 1`, `voted` unchanged | Optional third context joins after Reveal | Guest sees results from first view (join probe accepts it) |
| AC-003-09 | E / LP | `Leave` reducer deletes the vote (US-002, D-023); `computeResults` also filters by current roster as a defensive check | Leave in `voting` then Reveal: vote gone; Leave in `revealed` recomputes; `computeResults` ignores a vote of a non-roster id (G-11) | Optional: Guest closes page in `revealed` | Presence `leave` is the signal (US-001) |
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
- Group: `{ card: Card, count: number }`. One group per card cast by at least one current Participant; `count` is a positive integer. Card `0` is a card, and `?` is its own group.
- Group order: numeric cards ascending by numeric value (`0, 1, 2, 3, 5, 8, 13, 21`), then `?` last. Entries with `null` (No vote) are in no group.
- No average, consensus or rounding is computed (D-025).
- Participation: `voted` = entries with a value (`?` counts); `participants` = roster size; display `<voted> of <participants> voted`.

Worked examples for `src/domain/results.test.ts`. Each G-xx maps to one test case; "none" means No vote:

| # | Test case | Roster votes | Groups (`card` count) | Participation |
|---|---|---|---|---|
| G-01 | TC-003-13 | A none, B none | none (empty array) | `0 of 2 voted` |
| G-02 | TC-003-14 | A `?`, B `?` | `?` 2 | `2 of 2 voted` |
| G-03 | TC-003-15 | A `0`, B `0` | `0` 2 | `2 of 2 voted` |
| G-04 | TC-003-16 | A `0`, B `?` | `0` 1, `?` 1 | `2 of 2 voted` |
| G-05 | TC-003-17 | seven `0`, one `1` | `0` 7, `1` 1 | `8 of 8 voted` |
| G-06 | TC-003-18 | `5`, `5`, `8`, `8` | `5` 2, `8` 2 | `4 of 4 voted` |
| G-07 | TC-003-19 | `3`, `5`, `8`, `?`, none | `3` 1, `5` 1, `8` 1, `?` 1 | `4 of 5 voted` |
| G-08 | TC-003-20 | `5`, `5`, `?`, none | `5` 2, `?` 1 | `3 of 4 voted` |
| G-09 | TC-003-21 | A `?`, B `21`, C `1`, D `13`, E `0`, F `8`, G `3`, H `2`, I `5` | `0` 1, `1` 1, `2` 1, `3` 1, `5` 1, `8` 1, `13` 1, `21` 1, `?` 1 | `9 of 9 voted` |
| G-10 | TC-003-22 | `13`, `21` | `13` 1, `21` 1 | `2 of 2 voted` |
| G-11 | TC-003-23 | votes `{gone: 5}`, roster A `3` | `3` 1 | `1 of 1 voted` |
| G-12 | TC-003-24 | A `1`, B none, C none | `1` 1 | `1 of 3 voted` |

Entries (roster order, `null` for No vote) are asserted by TC-003-11 and are not repeated per example.

## File table
| File | Existing / new | Reason |
|---|---|---|
| [src/types/room.ts](../../src/types/room.ts) | Existing | `RoomAction` + `Reveal`, `Revote`; `RoomOutcome` + `no-votes`; `ResultEntry`, `RoundResults`; `PublicView.results` |
| `src/domain/results.ts` | New | Pure `computeResults` (entries, groups, participation), defensively filtered by the current roster |
| `src/domain/results.test.ts` | New | Worked examples G-01..G-12 |
| [src/domain/room.ts](../../src/domain/room.ts) | Existing | `Reveal` / `Revote` reducer cases; `isPublicView` validates `results` including `groups`; `Leave` deleting the vote is owned by US-002 (D-023) |
| [src/domain/room.test.ts](../../src/domain/room.test.ts) | Existing | Reducer and view-validation tests |
| [src/realtime/room-channel.ts](../../src/realtime/room-channel.ts) | Existing | `toPublicView` adds results when `revealed`; Host-only `reveal()` / `revote()`; no intent handlers |
| [src/realtime/room-channel.test.ts](../../src/realtime/room-channel.test.ts) | Existing | Publish, privacy, forged-intent, join/leave-in-`revealed` tests |
| [src/features/room/RoomShell.tsx](../../src/features/room/RoomShell.tsx) | Existing | Phase action, Guest texts, error, roster values, focus |
| `src/features/room/ResultsPanel.tsx` | New | Grouped vote-count rows with bars, participation |
| `src/features/room/useRoomSession.ts` | Existing, only if it wraps the session | Expose `reveal` / `revote` |
| US-002 selection state file | Existing (US-002) | Selection derived from `roundId` |
| `tests/e2e/US-003.spec.ts`, [tests/page-objects/RoomPage.ts](../../tests/page-objects/RoomPage.ts) | New / existing | Flow and selectors |

## Data and message shapes
Owner: Host tab owns `RoomState` (D-004). Guests only render `PublicView`.

```text
RoundResults = { entries: { participantId, value: Card | null }[];
                 groups: { card: Card; count: number }[];
                 voted: number; participants: number }
PublicView   = existing fields + results: RoundResults | null
```
- Event `room:public-view` is unchanged except for `results`. No new Broadcast events.
- `results` is `null` in `voting` and non-null in `revealed`. `toPublicView` builds it from `computeResults(state.votes, state.participants)` on every publish, so no field in a `voting` view ever holds a card value (D-005). It must not spread `RoomState` into the view.
- `isPublicView` rejects (malformed) a `voting` view with non-null `results`, a `revealed` view with null `results`, and a `revealed` view whose `results.groups` is missing or not an array. Each group must have a known card, a positive integer `count`, and the array must be in order (numeric ascending, `?` last, no duplicate card). The guest keeps its current view.
- Guests render published values and never recompute groups, so all clients show identical rows and count texts (success criterion 5). The bar width is the only derived value: `count / max(count over groups)` of the published groups.

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
| `revealed` | Guest `Join` / `Leave` (US-001) | `revealed`; revision + 1; republished with recomputed `results` including `groups` and participation (D-023); a leaving Participant's card is removed from the counts and a group whose count reaches 0 disappears | Existing US-001 rejections |
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
| Result groups | list container inside `results-panel`; rendered even with no groups (empty) | `results-groups` | — |
| Result group row | one per group, in `groups` order, inside `results-groups`; text is card label then count text | `results-group` | e.g. `5 2 votes`, `8 1 vote` |
| Group bar | decorative horizontal bar inside each row, `aria-hidden="true"`; inline `width` = `count / max count` as a percentage (the largest group is 100%; every bar has non-zero width) | `results-group-bar` | — |
| Group count text | inside each row; `1 vote` when count is 1, else `<n> votes` | `results-group-count` | `1 vote`, `2 votes` |
| Participation | full text | `results-participation` | `<voted> of <participants> voted` |
| Roster vote cell | inside each `players-list` row | `player-vote` | `Voted` / `Not voted` in `voting` (US-002); card value, `?` or `No vote` in `revealed` |

Behavior:
- Roster rows: values come from `results.entries` when `revealed`. Rows are matched by name text.
- Result rows: meaning is carried by the card label and count text; the bar never carries information alone. No row for No vote. With no groups the container is empty and `results-participation` still shows (G-01).
- No `results-average` or `results-consensus` element exists (D-025). Layout follows [ui-ux.md](../design/ui-ux.md) section 5.
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
| 2 | `computeResults` tests G-01..G-12 first, then implementation | unit | `npm test -- src/domain/results.test.ts` |
| 3 | Reducer tests first (Reveal, Revote, wrong-phase, stale vote, Join/Leave in `revealed`), then `Reveal` / `Revote` cases | unit | `npm test -- src/domain/room.test.ts` |
| 4 | `isPublicView` validation of `results` and `groups`, tests first (TC-003-12) | unit | `npm test -- src/domain/room.test.ts` |
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
| 7 | Reveal when only `?` votes exist | BA | No | Allowed (`?` is an accepted vote); one `?` group (G-02) |
| 8 | Host publish failure leaves Guests stale | Developer | No | Accept and report the error; revisit with a resync event post-MVP |

## Risks
- A Guest voting at the moment of Revote gets a rejected intent; US-002 pending feedback must resolve it.
- Forged `room:public-view` or vote values cannot be prevented on Broadcast (D-005).
- `player-vote` is shared with US-002 and must keep both texts stable.

## Handoff to Test
- Story: US-003; spec: `docs/specs/US-003-dev-spec.md`; cases needed for AC-003-01..13 (add IDs to the coverage table).
- Unit: G-01..G-12 (TC-003-13..24); reducer transitions and no-ops (revision unchanged); round increase; stale vote after Revote; forged Reveal/Revote intent via fake channel; `voting` payload contains no card value; malformed `results`.
- E2E flow with separate Host and Guest browser contexts: create -> join -> Host `Reveal estimates` with no votes (error) -> both vote -> Reveal -> assert phase, roster values, `results-group` rows with count texts and bars, participation on every client and deep-equal them -> Guest sees `Waiting for Host to start a revote.` -> Host `Revote` -> roster `Not voted`, no results panel, cards enabled -> vote again. Add a third context for AC-003-08 and a closing Guest for AC-003-09 as lower priority.
- Cannot be tested through the UI: roundId value, wrong-phase intents, stale vote intents, Guest-sent Reveal/Revote intents, network-level privacy (UX-08, separate boundary test), sender authentication, publish failure divergence. AC-003-13 depends on a controllable offline state.
- Independent risk pass: focus after Reveal/Revote, 20 Participants layout, `0` vs `No vote` vs `?` display, bar width with a large count spread.
- Existing US-001 and US-002 tests must keep passing.
