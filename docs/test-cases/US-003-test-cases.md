# US-003 Test Cases — Reveal, results and revote

Sources: [requirements](../requirements/US-003-reveal-results-and-revote.md), [dev spec](../specs/US-003-dev-spec.md), [UI/UX](../design/ui-ux.md).
Status: designed, NOT RUN. Priority: P1 = must pass for story done, P2 = should pass.
Scope: P1 ACs only (AC-003-01..06, 10, 11, 12). AC-003-07, 08, 09, 13 are listed under Deferred.

Conventions

| Item | Value |
|---|---|
| e2e contexts | `Host` = browser context 1 (`Maya`), `Guest` = context 2 (`Noah`), `Guest2` = context 3 (`Linh`, only where stated). Never tabs of one context. |
| Setup | Room `R` created by Host; Guests join; votes cast through the cards (US-002). A vote is awaited until its own row shows `Voted`. |
| Values | Roster cell = `player-vote` in each `players-list` row. Results = `results-average`, `results-consensus`. `—` is U+2014. |
| No reload | Assert no navigation: a `load` listener on each page fires once, or a marker set on `window` before the action survives. |
| Cross-client equality | Read the roster cells and result texts in every context and deep-equal them. Row order is NOT asserted; compare by name. |
| Fake channel | Unit fake channel emits events and records sent payloads; no real Supabase. |
| Unit files | `src/domain/results.test.ts`, `src/domain/room.test.ts`, `src/domain/vote.test.ts`, `src/realtime/room-channel.test.ts` |
| e2e file | `tests/e2e/US-003.spec.ts` |

## 1. Host reveals (AC-003-01)

| ID | AC / rule | Title | Preconditions | Steps | Expected result | Level | Priority |
|---|---|---|---|---|---|---|---|
| TC-003-01 | AC-003-01 | Host reveals after votes, no reload, cards disabled (happy) | Host and Guest in `R`; Host voted `5`, Guest voted `8` | 1. Host clicks `Reveal estimates`. | Host and Guest `room-phase` = `revealed` without reload. Reveal button gone for the Host; `results-panel` visible on both. All nine cards disabled in both contexts. | e2e | P1 |
| TC-003-02 | AC-003-01, success criterion 5 | Both clients show identical revealed state (happy) | TC-003-01 state | 1. Read roster cells, `results-average`, `results-consensus` in both contexts. | Per-name values equal in both contexts (`Maya` `5`, `Noah` `8`); Average `6.5`, Consensus `No` in both. | e2e | P1 |
| TC-003-03 | AC-003-01, rule 1 | Reducer `Reveal` with one vote (happy) | Active `voting` room, one stored vote | `Reveal`. | `phase` = `revealed`, `revision` +1, `roundId` unchanged, votes retained, outcome `accepted`; input state not mutated. | unit | P1 |
| TC-003-04 | AC-003-01, D-005 | Results leave the Host only after Reveal (happy, privacy) | Fake channel, Host session; votes `5`, `8` | 1. Capture every `room:public-view` while `voting`. 2. Host `reveal()`. 3. Capture the next view. | Step 1: `results` is `null`; no card value anywhere in the serialized payload. Step 3: `phase` `revealed`, `results` non-null with `entries`, `average`, `consensus`, `voted`, `participants`; published once. | unit | P1 |

## 2. Reveal requires a vote (AC-003-02)

| ID | AC / rule | Title | Preconditions | Steps | Expected result | Level | Priority |
|---|---|---|---|---|---|---|---|
| TC-003-05 | AC-003-02, rule 3 | Reveal with no votes is blocked, then works (negative, happy) | Host and Guest in `R`; no votes | 1. Host clicks `Reveal estimates`. 2. Host clicks card `5`, wait `Voted`. 3. Host clicks `Reveal estimates`. | Step 1: `reveal-error` alert `At least one vote is required to reveal`; phase `voting` on both; no `results-panel`; focus stays on the Reveal button. Step 3: phase `revealed`, error gone. | e2e | P1 |
| TC-003-06 | AC-003-02 | Reducer `Reveal` with zero votes (negative) | Active `voting` room, `votes` `{}` | `Reveal`. | outcome `no-votes`; state deep-equal to before; `revision` unchanged; `reveal()` on the session publishes nothing. | unit | P1 |
| TC-003-07 | AC-003-02, D-021 | `?`-only vote counts; a leaver's vote does not (edge) | Active `voting` room with Host and Guest `g1` | 1. `Vote{ g1, '?' }` then `Reveal`. 2. New room: `Vote{ g1, '5' }`, `Leave{ g1 }`, `Reveal`. | Step 1: `accepted`, `revealed`. Step 2: outcome `no-votes`, phase stays `voting`. | unit | P2 |

## 3. Reveal is Host-only (AC-003-03)

| ID | AC / rule | Title | Preconditions | Steps | Expected result | Level | Priority |
|---|---|---|---|---|---|---|---|
| TC-003-08 | AC-003-03, rule 2, D-007 | Guest has no Reveal control (negative) | Host and Guest in `R`, `voting` | 1. Inspect the Guest view, including after the Host votes. | Count of `Reveal estimates` buttons in Guest DOM = 0 (not just hidden); `phase-waiting` shows `Waiting for Host to reveal.`; Host view has the button. | e2e | P1 |
| TC-003-09 | AC-003-03 | Guest-sent Reveal intent is ignored (negative) | Fake channel, Host session; one vote stored | 1. Emit `room:reveal-intent` carrying Guest id. 2. Check Guest session API. | State deep-equal; `revision` unchanged; nothing published; no `room:reveal-intent` handler registered; Guest session exposes no `reveal()`. | unit | P1 |

## 4. Show each Participant's vote (AC-003-04)

| ID | AC / rule | Title | Preconditions | Steps | Expected result | Level | Priority |
|---|---|---|---|---|---|---|---|
| TC-003-10 | AC-003-04, rule 4 | Values, `?` and `No vote` on every client (happy) | Host `Maya`, Guest `Noah`, Guest2 `Linh` in `R`; Maya voted `0`, Noah `?`, Linh no vote | 1. Host clicks `Reveal estimates`. 2. Read roster cells in all three contexts. | Every context shows `Maya` `0`, `Noah` `?`, `Linh` `No vote`; `0` is not shown as `No vote` and `?` is not shown as `No vote`; values equal across contexts. | e2e | P1 |
| TC-003-11 | AC-003-04, rule 4 | `computeResults` entries (happy) | Roster `A, B, C`; votes `A=0`, `B=?` | `computeResults(votes, roster)`. | `entries` in roster order: `A` `'0'`, `B` `'?'`, `C` `null`. | unit | P1 |
| TC-003-12 | AC-003-04, D-014 | Malformed `results` view is ignored (negative) | Guest at `voting` revision 3 | Apply views: `voting` with non-null `results`; `revealed` with `results: null`; `revealed` with `results` missing `entries`. | `isPublicView` rejects each; the Guest keeps its current view. | unit | P2 |

## 5. Average and Consensus (AC-003-05, AC-003-06)

Unit examples R-01..R-12 are from the dev spec. Call `computeResults(votes, roster)`; "none" = no vote. The Participation column is checked in the same example (the participation AC itself is deferred).

| ID | AC / rule | Title | Preconditions | Steps | Expected result | Level | Priority |
|---|---|---|---|---|---|---|---|
| TC-003-13 | AC-003-05, 06 (R-01) | No votes (edge) | Roster A none, B none | `computeResults`. | Average `—`, Consensus `—`, `0 of 2 voted`. | unit | P1 |
| TC-003-14 | AC-003-05, 06 (R-02) | All `?` (edge) | A `?`, B `?` | `computeResults`. | Average `—`, Consensus `—`, `2 of 2 voted`. | unit | P1 |
| TC-003-15 | AC-003-05, 06 (R-03) | Only zeros; `0` is numeric (edge) | A `0`, B `0` | `computeResults`. | Average `0`, Consensus `Yes`, `2 of 2 voted`. | unit | P1 |
| TC-003-16 | AC-003-05, 06 (R-04) | `0` with `?` (edge) | A `0`, B `?` | `computeResults`. | Average `0`, Consensus `Yes`, `2 of 2 voted`. | unit | P1 |
| TC-003-17 | AC-003-05, 06 (R-05) | Exact midpoint rounds up (boundary) | Seven `0`, one `1` (mean 0.125) | `computeResults`. | Average `0.13`, Consensus `No`, `8 of 8 voted`. | unit | P1 |
| TC-003-18 | AC-003-05, 06 (R-06) | Trailing zero dropped (happy) | `5`, `5`, `8`, `8` | `computeResults`. | Average `6.5`, Consensus `No`, `4 of 4 voted`. | unit | P1 |
| TC-003-19 | AC-003-05, 06 (R-07) | Round down, `?` and none excluded (happy) | `3`, `5`, `8`, `?`, none | `computeResults`. | Average `5.33`, Consensus `No`, `4 of 5 voted`. | unit | P1 |
| TC-003-20 | AC-003-05, 06 (R-08) | Equal numerics with `?` and none (happy) | `5`, `5`, `?`, none | `computeResults`. | Average `5`, Consensus `Yes`, `3 of 4 voted`. | unit | P1 |
| TC-003-21 | AC-003-05, 06 (R-09) | Round up non-midpoint (happy) | `1`, `2`, `2` (5/3) | `computeResults`. | Average `1.67`, Consensus `No`, `3 of 3 voted`. | unit | P1 |
| TC-003-22 | AC-003-05, 06 (R-10) | Whole-number mean (happy) | `13`, `21` | `computeResults`. | Average `17`, Consensus `No`, `2 of 2 voted`. | unit | P1 |
| TC-003-23 | AC-003-05, 06, rule 11 (R-11) | Vote of a non-roster id ignored (negative) | Votes `{ gone: 5 }`, roster A `3` | `computeResults`. | Average `3`, Consensus `Yes`, `1 of 1 voted`; no entry for `gone`. | unit | P1 |
| TC-003-24 | AC-003-05, 06 (R-12) | One vote in a roster of three (happy) | A `1`, B none, C none | `computeResults`. | Average `1`, Consensus `Yes`, `1 of 3 voted`. | unit | P1 |
| TC-003-25 | AC-003-05, 06 | Different numerics on every client (happy) | Host and Guest in `R`; Host `5`, Guest `8` | 1. Host reveals. 2. Read `results-average`, `results-consensus` in both contexts. | Both contexts: Average `6.5`, Consensus `No`. | e2e | P1 |
| TC-003-26 | AC-003-05, 06, rule 6 | Zero votes are numeric (edge) | Host `0`, Guest `0` | 1. Host reveals. 2. Read results in both contexts. | Both contexts: Average `0`, Consensus `Yes`; roster cells `0`, not `No vote`. | e2e | P1 |
| TC-003-27 | AC-003-05, 06, D-015 | All `?` shows dashes (edge) | Host `?`, Guest `?` | 1. Host reveals. | Reveal allowed; both contexts: Average `—`, Consensus `—`; roster cells `?`. | e2e | P2 |

## 6. Host starts a Revote (AC-003-10)

| ID | AC / rule | Title | Preconditions | Steps | Expected result | Level | Priority |
|---|---|---|---|---|---|---|---|
| TC-003-28 | AC-003-10, rule 9 | Revote clears the round and allows a new vote (happy) | `revealed` room, Host `5`, Guest `8` | 1. Host clicks `Revote`. 2. Read both contexts. 3. Host and Guest both vote `3`. 4. Host reveals. | Step 2: no reload; `room-phase` `voting`; every roster row `Not voted`; no `results-panel`; cards enabled and none `aria-pressed=true` in both contexts. Step 4: Average `3`, Consensus `Yes`; no value from round 1 shown. | e2e | P1 |
| TC-003-29 | AC-003-10, D-008, D-018 | Reducer `Revote` (happy) | `revealed` room, `roundId` n, votes stored | `Revote`. | `phase` `voting`; `votes` `{}`; all `hasVoted` false; `roundId` n+1; `revision` +1; roster and `status` unchanged; input not mutated. | unit | P1 |
| TC-003-30 | AC-003-10 | Revote view carries no results (happy) | Fake channel, Host `revealed` | 1. Host `revote()`. 2. Inspect the published view. 3. Apply it to a Guest holding the revealed view. | View: `phase` `voting`, `results` `null`, higher `revision`, `roundId` n+1. Guest drops previous results. | unit | P1 |
| TC-003-31 | AC-003-10 | `voteReducer` clears local selection on `round-changed` (happy) | States `confirmed 5`, `pending 8`, `failed 8` | `round-changed` on each. | Each becomes `idle` with `confirmed` null. | unit | P1 |

## 7. Revote is Host-only (AC-003-11)

| ID | AC / rule | Title | Preconditions | Steps | Expected result | Level | Priority |
|---|---|---|---|---|---|---|---|
| TC-003-32 | AC-003-11, rule 2, D-007 | Guest has no Revote control (negative) | `revealed` room, Host and Guest | 1. Inspect the Guest view. | Count of `Revote` buttons in Guest DOM = 0 (not just hidden); `phase-waiting` shows `Waiting for Host to start a revote.`; Host view has the button. | e2e | P1 |
| TC-003-33 | AC-003-11 | Guest-sent Revote intent is ignored (negative) | Fake channel, Host session in `revealed` | 1. Emit `room:revote-intent` carrying Guest id. 2. Check Guest session API. | Phase, votes and results unchanged; `revision` unchanged; nothing published; no `room:revote-intent` handler; Guest session exposes no `revote()`. | unit | P1 |

## 8. Wrong phase and stale intents (AC-003-12)

| ID | AC / rule | Title | Preconditions | Steps | Expected result | Level | Priority |
|---|---|---|---|---|---|---|---|
| TC-003-34 | AC-003-12, rule 10 | Reveal while `revealed` (negative) | `revealed` room | `Reveal`. | outcome `ignored`; state deep-equal; `revision` unchanged. | unit | P1 |
| TC-003-35 | AC-003-12, rule 10 | Revote while `voting` (negative) | `voting` room with a vote | `Revote`. | outcome `ignored`; state deep-equal (vote kept, `roundId` unchanged); `revision` unchanged. | unit | P1 |
| TC-003-36 | AC-003-12, D-018 | Stale vote after Revote is rejected (negative) | Room after one Revote (`roundId` 2) | `Vote{ g1, 1, '5' }` (round 1). | `ignored` with reason `round-mismatch`; `votes` `{}`; `hasVoted` false for all; `revision` unchanged. | unit | P1 |
| TC-003-37 | AC-003-12, D-018 | Stale vote intent over the channel (negative) | Fake channel, Host after Revote (`roundId` 2) | Deliver `room:vote-intent` `{ rq1, g1, 1, '5' }`. | Host sends `room:vote-rejected` `round-mismatch`; no `room:vote-accepted`; no `room:public-view`; new-round votes and `hasVoted` unchanged. | unit | P1 |

## 9. Focus after phase change (UX risk pass)

| ID | AC / rule | Title | Preconditions | Steps | Expected result | Level | Priority |
|---|---|---|---|---|---|---|---|
| TC-003-38 | AC-003-01, 10, UI/UX | Host focus moves to phase heading (happy) | Host and Guest in `R`; one vote | 1. Host clicks `Reveal estimates`. 2. Host clicks `Revote`. 3. Guest clicks any card. | After 1 and 2: `phase-heading` has focus on the Host. Guest focus does not move because of the roster or phase update. | e2e | P2 |

## Traceability

| AC | Cases |
|---|---|
| AC-003-01 | TC-003-01 .. TC-003-04, TC-003-38 |
| AC-003-02 | TC-003-05 .. TC-003-07 |
| AC-003-03 | TC-003-08, TC-003-09 |
| AC-003-04 | TC-003-10 .. TC-003-12 |
| AC-003-05 | TC-003-13 .. TC-003-27 |
| AC-003-06 | TC-003-13 .. TC-003-27 |
| AC-003-10 | TC-003-28 .. TC-003-31, TC-003-38 |
| AC-003-11 | TC-003-32, TC-003-33 |
| AC-003-12 | TC-003-34 .. TC-003-37 |

## Automation scope

| Level | Tool | Cases |
|---|---|---|
| e2e | Playwright (`tests/e2e/US-003.spec.ts`) | TC-003-01, 02, 05, 08, 10, 25, 26, 27, 28, 32, 38 |
| unit | Vitest | TC-003-03, 04, 06, 07, 09, 11, 12, 13..24 (R-01..R-12), 29, 30, 31, 33, 34, 35, 36, 37 |

- TC-003-13..24 are `src/domain/results.test.ts`; card `0` is numeric and Average uses integer rounding per spec (half up to two decimals, trailing zeroes omitted).
- AC-003-12 and the Guest-sent intents (TC-003-09, 33) have no UI trigger: unit or protocol level only.
- TC-003-10 is the only case needing three contexts. TC-003-01/02/25/26/27 may share one fixture; IDs stay separate for traceability.
- No case is manual. Existing US-001 and US-002 tests must keep passing.

## Deferred (no cases in this pass)

- AC-003-07 Participation count: the `<voted> of <participants> voted` text is checked only inside R-01..R-12 data; no e2e or UI case yet.
- AC-003-08 Guest joins after Reveal: lower priority; optional third context after Reveal.
- AC-003-09 Participant who voted leaves: lower priority; depends on Presence (D-020); TC-003-07 only covers the reducer side.
- AC-003-13 Disable phase actions while disconnected: lower priority; depends on the Supabase status spike and US-002 `connection` event.
