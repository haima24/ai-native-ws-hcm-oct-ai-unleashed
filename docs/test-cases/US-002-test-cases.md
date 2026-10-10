# US-002 Test Cases — Vote with hidden cards

Sources: [requirements](../requirements/US-002-vote-with-hidden-card.md), [dev spec](../specs/US-002-dev-spec.md), [UI/UX](../design/ui-ux.md).
Status: designed, NOT RUN. Priority: P1 = must pass for story done, P2 = should pass.
Scope: P1 ACs only (AC-002-01..04). AC-002-05 and AC-002-06 are listed under Deferred.

Conventions

| Item | Value |
|---|---|
| e2e contexts | `Host` = browser context 1 (`Maya`), `Guest` = separate context (`Noah`). Never tabs of one context. |
| Cards | `0`, `1`, `2`, `3`, `5`, `8`, `13`, `21`, `?`. Locate by role `button` with `exact: true` inside group `Voting cards`. |
| Own row vs other row | Own row = the row with `You`; other row = the other Participant's row in `players-list`. Status is `Voted` / `Not voted` only. |
| Frame control | Playwright `page.routeWebSocket` on the Guest page. `drop-intent` = drop outgoing frames containing `room:vote-intent`. `drop-ack` = drop incoming frames containing `room:vote-accepted`. `delay-ack` = hold incoming `room:vote-accepted` for 1500 ms. |
| Timing | 5 s is a baseline (business rule 10). Record measured ms and environment (local vs deployed). |
| Unit files | `src/domain/room.test.ts`, `src/domain/vote.test.ts`, `src/realtime/room-channel.test.ts` (fake channel and fake `Timers`) |
| e2e file | `tests/e2e/US-002.spec.ts` |

## 1. Fixed voting cards (AC-002-01)

| ID | AC / rule | Title | Preconditions | Steps | Expected result | Level | Priority |
|---|---|---|---|---|---|---|---|
| TC-002-01 | AC-002-01, D-011 | Host and Guest see the same nine cards in order (happy) | Host `Maya` and Guest `Noah` in room `R`, phase `voting` | 1. In each context read the buttons in group `Voting cards`. | Each context shows exactly nine buttons in order `0`, `1`, `2`, `3`, `5`, `8`, `13`, `21`, `?`; all enabled; none has `aria-pressed=true`; no free-form vote input. | e2e | P1 |
| TC-002-02 | AC-002-01, rule 2 | `CARDS` and `isCard` (happy + negative) | none | 1. Read `CARDS`. 2. `isCard(x)` for each of the nine values. 3. `isCard(x)` for `'4'`, `''`, `' 5'`, `'5 '`, `'1.5'`, `'x'`, number `5`, `null`, `undefined`. | `CARDS` equals `0,1,2,3,5,8,13,21,?` in order. Step 2 all `true`; step 3 all `false`. | unit | P1 |

## 2. Select and change a vote (AC-002-02)

| ID | AC / rule | Title | Preconditions | Steps | Expected result | Level | Priority |
|---|---|---|---|---|---|---|---|
| TC-002-03 | AC-002-02 | Guest selects a card, vote confirmed (happy) | Host and Guest in `R`, `voting` | 1. Guest clicks `5`. 2. Wait for the confirmation. | Guest card `5` has `aria-pressed=true`; Guest own row `Voted`; Host sees Guest row `Voted`. No card value in any other row. `Sending vote…` is NOT asserted here (transient). | e2e | P1 |
| TC-002-04 | AC-002-02, rule 1 | Host votes with its own card (happy) | Host and Guest in `R`, `voting` | 1. Host clicks `8`. | Host card `8` `aria-pressed=true`; Host own row `Voted`; Guest sees Host row `Voted`; `Sending vote…` is never shown to the Host (confirmed synchronously). | e2e | P1 |
| TC-002-05 | AC-002-02, rule 3 | Change vote before reveal (happy) | TC-002-03 state (`5` confirmed) | 1. Guest clicks `8`. 2. Wait for the confirmation. | `8` is `aria-pressed=true`, `5` is not; own row and Host's Guest row stay `Voted` (one vote, not two). | e2e | P1 |
| TC-002-06 | AC-002-02 | `Sending vote…` while awaiting confirmation (happy) | Host and Guest in `R`; `delay-ack` on Guest | 1. Guest clicks `5`. 2. Check during the delay. 3. Wait for the delayed ack. | During delay: `vote-status` shows `Sending vote…`; card `5` has `data-selection="pending"`; `5` is not `aria-pressed=true` yet; all cards disabled (spec open decision 2 default). After ack: message gone, `5` `aria-pressed=true`, cards enabled. Own row status during the delay is NOT asserted (Host view may already be `Voted`). | e2e | P1 |
| TC-002-07 | AC-002-02 | Card selectable by keyboard (happy) | Host and Guest in `R`, `voting` | 1. Guest tabs to card `3`. 2. Press `Enter`. 3. Tab to `13`, press `Space`. | `3` is confirmed after Enter; after Space `13` is `aria-pressed=true` and `3` is not. | e2e | P2 |
| TC-002-08 | AC-002-02, rules 1, 3 | Reducer `Vote` stores and replaces (happy) | Active room `voting` with Host `Maya`, Guest `g1`; `roundId` = 1 | 1. `Vote{ g1, 1, '5' }`. 2. `Vote{ g1, 1, '8' }`. 3. `Vote{ host, 1, '0' }`. | Step 1: `accepted`, `hasVoted` true, `revision` +1. Step 2: `accepted`, stored card `8`, `hasVoted` true, `revision` +1. Step 3: Host vote stored. At most one entry per Participant; no card on `Participant` objects; input state not mutated. | unit | P1 |
| TC-002-09 | AC-002-02, D-014 | Same-card resend is idempotent (edge) | `g1` already stored `5` | `Vote{ g1, 1, '5' }` again. | `accepted`; state deep-equal to before; `revision` unchanged. | unit | P2 |
| TC-002-10 | AC-002-02, rule 9, D-018 | Reducer ignores invalid votes (negative) | Active `voting` room, `g1` in roster | 1. `Vote{ 'zzz', 1, '5' }` (unknown sender). 2. `Vote{ g1, 1, '4' }`. 3. `Vote{ g1, 2, '5' }` (wrong round). | `ignored` with reasons `unknown-participant`, `invalid-card`, `round-mismatch`; state deep-equal to before; `revision` unchanged. | unit | P1 |
| TC-002-11 | AC-002-02, rule 8 | `voteReducer` success transitions (happy) | State `idle` | 1. `select 5 r1` → `confirmed r1`. 2. `select 8 r2` → `confirmed r2`. 3. `confirmed r-other` while pending. 4. `select 3` while pending. | Step 1: `pending` (card `5`, `confirmed` null) then `confirmed` (card `5`). Step 2: `pending` card `8` keeps `confirmed` `5`, then `confirmed` `8`. Steps 3 and 4: state unchanged (stale `requestId`; one request in flight). | unit | P1 |
| TC-002-12 | AC-002-02, rule 8 | Host acknowledges by `requestId`; publish-then-ack (happy) | Fake channel, Host session, Guest `g1` | 1. Deliver `room:vote-intent` `{ rq1, g1, 1, '5' }`. 2. Deliver `{ rq2, g1, 1, '8' }`. 3. Deliver `{ rq3, 'zzz', 1, '5' }`. 4. Deliver `{ rq4, g1, 1, '9' }`. | Step 1: view with `g1` `hasVoted` published first, then `room:vote-accepted` carrying `rq1`. Step 2: ack `rq2`, no new `room:public-view`. Step 3: nothing sent. Step 4: `room:vote-rejected` `invalid-card`. Guest session confirms only on the matching `requestId` and `participantId`. | unit | P1 |

## 3. Hide vote values before reveal (AC-002-03)

| ID | AC / rule | Title | Preconditions | Steps | Expected result | Level | Priority |
|---|---|---|---|---|---|---|---|
| TC-002-13 | AC-002-03, rule 4, D-005 | Others see only status, own selection visible (happy) | Host and Guest in `R`, `voting` | 1. Guest clicks `5`; wait confirmed. 2. Host clicks `13`; wait confirmed. 3. Read `players-list` and cards in both contexts. | Each context's other-Participant row shows only `Voted` (no `5`, `13` or any card text). Own card is `aria-pressed=true` in each context. Before step 2, Guest's view of Host row is `Not voted`. | e2e | P1 |
| TC-002-14 | AC-002-03, rule 5 | Pending selection is not an accepted vote (negative) | Host and Guest in `R`; `drop-intent` on Guest | 1. Guest clicks `8`. 2. Observe immediately and for 2 s. | Host sees Guest row `Not voted`. Guest's own card `8` is visibly selected (`data-selection="pending"`), not `aria-pressed=true`, and Guest's own row is `Not voted`. | e2e | P1 |
| TC-002-15 | AC-002-03, D-005 | No card value in public view or acks (negative) | Fake channel, Host session; votes `5`, `8` stored | 1. Inspect `Participant` objects and `toPublicView` output. 2. `JSON.stringify` every `room:public-view`, `room:vote-accepted`, `room:vote-rejected` payload the Host sent. | No card value appears in any `Participant`, view or outbound payload. No `votes` key in any of them. `hasVoted` only. | unit | P1 |

## 4. Vote not confirmed (AC-002-04)

| ID | AC / rule | Title | Preconditions | Steps | Expected result | Level | Priority |
|---|---|---|---|---|---|---|---|
| TC-002-16 | AC-002-04, rule 10 | Intent never reaches Host, then Retry (negative, happy) | Host and Guest in `R`; `drop-intent` on Guest | 1. Guest clicks `8`; record time to message. 2. Remove the drop. 3. Guest clicks `Retry`. | Step 1: at about 5 s (record ms) `vote-error` shows `Vote was not confirmed. Try again.`; `8` has `data-selection="failed"`, is not `aria-pressed=true`; `Retry` visible; Host row for Guest `Not voted`. Step 3: `8` `aria-pressed=true`, error gone, Host row `Voted`. | e2e | P1 |
| TC-002-17 | AC-002-04, rule 8 | Replacement vote fails, then Retry (negative) | Guest `5` confirmed; `drop-intent` on Guest | 1. Guest clicks `8`. 2. Wait for the message. 3. Remove the drop; click `Retry`. | Step 2: message `Vote was not confirmed. Try again.`; `8` `data-selection="failed"`; `5` stays `aria-pressed=true` (spec open decision 9); Host row `Voted`. Step 3: `8` `aria-pressed=true`, `5` not; error gone; Host row `Voted`. | e2e | P1 |
| TC-002-18 | AC-002-04, rule 8 | Ack lost, Retry resends the same card (negative, edge) | Host and Guest in `R`; `drop-ack` on Guest | 1. Guest clicks `5`. 2. Wait for the message. 3. Remove the drop; click `Retry`. | Step 2: `Vote was not confirmed. Try again.`; `5` not `aria-pressed=true`. Host row for Guest is allowed to show `Voted` (Host did store it); record the observed value. Step 3: `5` `aria-pressed=true`, error gone, Host shows exactly one `Voted` for Guest. | e2e | P1 |
| TC-002-19 | AC-002-04, rules 5, 8 | `voteReducer` failure transitions (negative) | State `confirmed 5`, then `select 8 r2` | 1. `failed r2`. 2. `failed r-other`. 3. Late `confirmed r2`. 4. From `failed`, `select 8 r3`. 5. From `failed`, `confirmed r-other`. | Step 1: `failed` card `8`, `confirmed` stays `5`. Step 2: no change. Step 3: `confirmed` card `8`. Step 4: `pending` with new `requestId`. Step 5: ignored. | unit | P1 |
| TC-002-20 | AC-002-04, rule 10 | Guest 5 s confirmation timer (negative, boundary) | Fake channel and fake `Timers`; Guest session | 1. `vote('5')`; advance 4999 ms. 2. Advance to 5000 ms. 3. New `vote('5')`; deliver matching ack at 4999 ms; advance 10 s. | Step 1: no `vote-result` emitted. Step 2: `vote-result` `failed`. Step 3: `confirmed` only; no later `failed` (timer cleared). | unit | P1 |
| TC-002-21 | AC-002-04 | Immediate failure and cleanup (negative) | Fake channel and fake `Timers`; Guest session | 1. `channel.send` rejects. 2. `channel.send` returns non-`ok`. 3. Deliver `room:vote-rejected` with matching `requestId`. 4. Same with another `requestId`. 5. `vote('5')` then `close()`; advance 10 s. | Steps 1-3: `vote-result` `failed` immediately. Step 4: ignored. Step 5: no event after `close()`; timer cleared. | unit | P1 |

## Traceability

| AC | Cases |
|---|---|
| AC-002-01 | TC-002-01, TC-002-02 |
| AC-002-02 | TC-002-03 .. TC-002-12 |
| AC-002-03 | TC-002-13 .. TC-002-15 |
| AC-002-04 | TC-002-16 .. TC-002-21 |

## Automation scope

| Level | Tool | Cases |
|---|---|---|
| e2e | Playwright (`tests/e2e/US-002.spec.ts`) | TC-002-01, 03, 04, 05, 06, 07, 13, 14, 16, 17, 18 |
| unit | Vitest | TC-002-02, 08, 09, 10, 11, 12, 15, 19, 20, 21 |

- Cases 06, 14, 16, 17, 18 need `page.routeWebSocket`; `Sending vote…` is only asserted in TC-002-06 (delayed reply), never in a plain run.
- Cases 14 and 16 can share one fixture; they keep separate IDs for AC traceability.
- No case is manual. Existing Vitest and Playwright tests for US-001 must keep passing.

## Deferred (no cases in this pass)

- AC-002-05 Voting unavailable outside voting phase: reducer-level `Vote` in `revealed` is covered by US-003 TC-003-34/35; e2e waits for US-003 Reveal.
- AC-002-06 Voting unavailable while disconnected: lower priority; depends on the Supabase status spike (spec task 7).
