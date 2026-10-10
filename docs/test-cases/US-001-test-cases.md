# US-001 Test Cases — Create / join room

Sources: [requirements](../requirements/US-001-create-join-room.md), [dev spec](../specs/US-001-dev-spec.md), [UI/UX](../design/ui-ux.md).
Status: designed; partly executed (see Execution status below). Priority: P1 = must pass for story done, P2 = should pass, P3 = nice to have.

Conventions

| Item | Value |
|---|---|
| Presence tag | `[D-020]` = depends on Supabase Presence (D-020 Accepted). The tag marks Presence-dependent cases; it no longer blocks execution. Departure detection can also arrive through `room:guest-left` (D-024). |
| e2e contexts | `Host` = browser context 1, `Guest`/`Guest2` = separate browser contexts (never tabs of one context, to keep `sessionStorage` separate). |
| Valid names | `Maya`, `Noah`, `Linh`. 20-char name: `ABCDEFGHIJKLMNOPQRST`. 21-char name: `ABCDEFGHIJKLMNOPQRSTU`. |
| Room code `R` | Code read from the Host's `room-code` element. Share link: `?room=<R>`. |
| Unit files | `src/domain/room.test.ts`, `src/realtime/room-channel.test.ts` |
| e2e file | `tests/e2e/US-001.spec.ts` |

## 1. Create room (AC-001-01)

| ID | AC / rule | Title | Preconditions | Steps | Expected result | Level | Priority |
|---|---|---|---|---|---|---|---|
| TC-001-01 | AC-001-01 | Host creates a room (happy) | Host on Home | 1. In `Create room` fill `Display name` = `Maya`. 2. Click `Create room`. | Room shell opens. `room-code` text matches `^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$`. `Copy link` visible. `room-phase` = `voting`. Heading `Players (1)`. One row `Maya` with annotations `Host` and `You`. | e2e | P1 |
| TC-001-02 | AC-001-01 | `createRoom` initial state (happy) | none | Call `createRoom({ roomCode: 'ABC234', hostId: 'h1', displayName: ' Maya ' })`. | `phase` = `voting`, `status` = `active`, `revision` = 0, `roundId` = 1, one Participant `Maya` with role `host`. | unit | P1 |
| TC-001-03 | AC-001-01 | Share link opens Home with code (happy) | Room `R` exists from TC-001-01 | 1. Host clicks `Copy link`. 2. Read the link. 3. Open it in a new Guest context. | Link contains `?room=R`. Guest sees Home, `Room code` = `R`. Link copy feedback is `Link copied` (or `Could not copy link. Select and copy the link.` with a selectable URL if clipboard is denied). | e2e | P2 |
| TC-001-04 | AC-001-01 | Create with empty name creates no room (negative) | Host on Home | 1. Leave `Display name` empty in `Create room`. 2. Click `Create room`. | Stays on Home. Error `Enter a display name.` beside `Display name`. No `room-code` element. No `Connecting…`. | e2e | P1 |

## 2. Join with a code (AC-001-02)

| ID | AC / rule | Title | Preconditions | Steps | Expected result | Level | Priority |
|---|---|---|---|---|---|---|---|
| TC-001-06 | AC-001-02 | Guest joins with code (happy) | Host in room `R` as `Maya` | 1. Guest on Home. 2. In `Join room` fill `Room code` = `R`, `Display name` = `Noah`. 3. Click `Join room`. | Guest sees room shell with `room-code` = `R`, `Players (2)`, rows `Maya` with `Host` and `Noah` with `You`. Host also shows `Players (2)`. | e2e | P1 |
| TC-001-07 | AC-001-02, rule 2 | Code is case-insensitive and trimmed: ` abc234 ` (happy) | A room with a known code exists and its Host `Maya` is in it. | 1. Guest fills `Room code` = ` abc234 ` (e2e: ` ` + lowercase `R` + ` `), `Display name` = `Noah`. 2. Submit `Join room`. | Guest joins room `ABC234`; `room-code` shows `ABC234`; no error. | e2e | P1 |
| TC-001-08 | AC-001-02, rule 2 | `normalizeRoomCode` trims and upper-cases (happy) | none | `normalizeRoomCode(' abc234 ')`. | Returns `ABC234`. | unit | P1 |
| TC-001-10 | AC-001-02, rule 2 | Join a room whose code contains `0/O/1/I` is accepted on input (happy) | Realtime is reachable and no room `AB0O1I` exists. | Submit `Join room` with `Room code` = `AB0O1I` and `Display name` = `Noah`. | No `Room code must be 6 letters or digits.` error is shown; after up to 5 s `Room not found or unreachable. Check the code and try again.` is shown. | e2e | P2 |
| TC-001-11 | AC-001-02 | Guest not in roster until Host accepts (negative) | Host in room `R` | 1. Guest submits `Join room` with `R`, `Noah` while Host reducer rejects (use duplicate name `Maya`). 2. Inspect Host and Guest context. | Host `Players (1)`, only `Maya`. Guest never opens room shell. | e2e | P1 |
| TC-001-12 | AC-001-02 | Well-formed code of another/nonexistent room does not join (negative) | Host in room `R` | Guest submits `Join room` with a well-formed code `X` != `R`, name `Noah`. | Guest stays on Home with `Room not found or unreachable. Check the code and try again.`. Host roster unchanged (`Players (1)`). | e2e | P1 |

## 3. Join with share link (AC-001-03)

| ID | AC / rule | Title | Preconditions | Steps | Expected result | Level | Priority |
|---|---|---|---|---|---|---|---|
| TC-001-14 | AC-001-03, rule 3 | Link prefills code, name empty (happy) | Host in room `R` | Guest context opens `<base>/?room=R`. | Home shows `Room code` = `R`; `Display name` = empty. | e2e | P1 |
| TC-001-15 | AC-001-03 | Join after entering name via link (happy) | TC-001-14 state | Guest fills `Display name` = `Noah`, clicks `Join room`. | Guest in room shell, same result as TC-001-06. | e2e | P1 |
| TC-001-17 | AC-001-03 | Link with lowercase code prefill is normalized or shown as typed (negative, edge) | Host in room `R` | Guest opens `?room=<lowercase R>` and submits with `Noah`. | Join succeeds (code case-insensitive). Prefill display (as-is or upper-cased) is NOT asserted. | e2e | P3 |

## 4. Live roster (AC-001-04)

| ID | AC / rule | Title | Preconditions | Steps | Expected result | Level | Priority |
|---|---|---|---|---|---|---|---|
| TC-001-18 | AC-001-04, rule 11 | Second Guest appears for all within 2 s (happy) `[D-020]` for latency evidence only; join itself does not need Presence | Host `Maya`, Guest `Noah` in room `R`; Guest2 context on Home | 1. Guest2 joins as `Linh`. 2. Record `t0` = time Guest2 sees room shell. 3. Poll Host and Guest until `Players (3)` and names `Maya`, `Noah`, `Linh`. | Host and Guest each show `Players (3)` and the same set of names as Guest2 within 2000 ms of `t0`. Record measured ms and environment (local vs deployed). | e2e | P1 |
| TC-001-19 | AC-001-04, D-014 | Accepted join increments revision once (happy) | Active room revision `n` | Apply `Join` for a new valid name. | `revision` = `n+1`; public view carries it. | unit | P1 |
| TC-001-20 | AC-001-04, D-014 | Stale revision ignored (negative) | Client view at revision 5 with 3 Participants | Apply public view with revision 4 (2 Participants); then revision 5 with different names; then a view with wrong `roomCode` at revision 9; then a malformed payload. | View stays revision 5 / 3 Participants after each; malformed payload goes to the realtime error path, not shown as success. | unit | P1 |
| TC-001-21 | AC-001-04 | Rejected join does not change other lists (negative) | Host `Maya`, Guest `Noah` in `R` | Guest2 joins with `noah`. | Host and Guest still `Players (2)` with `Maya`, `Noah`; Guest2 sees `That name is already taken in this room.`. | e2e | P1 |
| TC-001-22 | AC-001-04, rule 11 | All three contexts show the same set (happy, consistency) | Host, Guest, Guest2 in room | Compare the set of names in each context after settling. | Sets equal; row count equals the number in `Players (n)`. Order is NOT asserted. | e2e | P2 |

## 5. Display name validation (AC-001-05)

| ID | AC / rule | Title | Preconditions | Steps | Expected result | Level | Priority |
|---|---|---|---|---|---|---|---|
| TC-001-23 | AC-001-05, rule 1 | Create validates display-name classes | Home | Submit `Create room` in turn with an empty name, `     `, and `ABCDEFGHIJKLMNOPQRSTU`; then submit with `  ABCDEFGHIJKLMNOPQRST  `. | For each invalid value, show the matching field error beside `Display name`, retain the typed value, and do not create a room or show `Connecting…`; errors are linked to the input and exposed as alerts. For the valid value, open the room and show Host row `ABCDEFGHIJKLMNOPQRST` with no surrounding spaces. | e2e | P1 |
| TC-001-30 | AC-001-05 | Join validates display-name classes | Host room `R` exists; Guest on Home | Submit `Join room` with `R` and, in turn, an empty name, `     `, and `ABCDEFGHIJKLMNOPQRSTU`; then submit with `ABCDEFGHIJKLMNOPQRST`. | For each invalid value, show the matching field error beside `Display name`, retain the room code and typed name, and do not join or show `Connecting…`; errors are linked to the input and exposed as alerts. For the valid value, join `R` and show the Guest row `ABCDEFGHIJKLMNOPQRST` with `You`. | e2e | P1 |
| TC-001-34 | AC-001-05 | `validateDisplayName` classes (happy + negative) | none | Inputs: `''`, `'   '`, `'A'`, 20 chars, 21 chars, `' Maya '`, and `'  ABCDEFGHIJKLMNOPQRST  '`. | Required inputs return `{error:'required'}`; 1-char, 20-char and padded 20-char inputs return trimmed values; 21 chars returns `{error:'too-long'}`. | unit | P1 |

## 6. Duplicate display name (AC-001-06)

| ID | AC / rule | Title | Preconditions | Steps | Expected result | Level | Priority |
|---|---|---|---|---|---|---|---|
| TC-001-36 | AC-001-06 | Unique name accepted (happy) | Room `R` contains `Maya` (Host) | Guest joins as `Maya2`. | Joined; `Players (2)`. | e2e | P1 |
| TC-001-37 | AC-001-06, rule 1 | Duplicate ignores case and surrounding spaces (negative) | Room contains Host `Maya` | Guest submits `Join room` with `R` and each name in turn: `maya`, ` MAYA `. | For both inputs, show `That name is already taken in this room.` beside `Display name`; Guest is not added; Host remains `Players (1)` with `Maya`; the room code and submitted name remain in the fields. | e2e | P1 |
| TC-001-39 | AC-001-06, rule 1 | Reducer duplicate is a no-op (negative) | Room with `Maya` | `Join` with `maya`, then ` MAYA `. | `outcome` = `duplicate-name`; state deep-equal to before (revision unchanged). | unit | P1 |
| TC-001-40 | AC-001-06 | Duplicate of a Guest name, not only Host (negative) | Host `Maya`, Guest `Noah` | Guest2 submits `NOAH`. | Error `That name is already taken in this room.`; roster unchanged for all. | e2e | P2 |
| TC-001-41 | AC-001-06 | Same name allowed in a different room (happy) | Two rooms each with its own Host | Guest joins room B as the Host name of room A. | Accepted in room B (uniqueness is per room). | unit | P3 |
| TC-001-42 | AC-001-06 | Recovery after duplicate: change name and resubmit (happy) | After TC-001-37 | Guest changes name to `Noah`, submits. | Joined; error cleared. | e2e | P2 |

## 7. Room code validation (AC-001-07)

| ID | AC / rule | Title | Preconditions | Steps | Expected result | Level | Priority |
|---|---|---|---|---|---|---|---|
| TC-001-43 | AC-001-07 | Well-formed code passes format check (happy) | none | `isWellFormedRoomCode('ABC234')`, and after normalize `' abc234 '`. | `true` both. | unit | P1 |
| TC-001-44 | AC-001-07 | Empty code (negative) | Home | Submit `Join room` with empty `Room code`, valid name. | `Enter the room code.` beside `Room code`; not joined; name kept. | e2e | P1 |
| TC-001-45 | AC-001-07 | Only spaces code (negative) | Home | `Room code` = `   `, valid name. | `Enter the room code.` | e2e | P1 |
| TC-001-46 | AC-001-07 | 5 characters `ABC12` (negative, boundary) | Home | Submit with `ABC12`. | `Room code must be 6 letters or digits.`; typed values kept; no joined state. | e2e | P1 |
| TC-001-47 | AC-001-07 | 7 characters `ABC1234` (negative, boundary) | Home | Submit with `ABC1234`. | `Room code must be 6 letters or digits.` | e2e | P1 |
| TC-001-48 | AC-001-07 | Punctuation `ABC-12` (negative) | Home | Submit with `ABC-12`. | `Room code must be 6 letters or digits.` | e2e | P1 |
| TC-001-49 | AC-001-07 | Space inside code `AB C23` (negative, edge) | Home | Submit with `AB C23`. | `Room code must be 6 letters or digits.` (inner spaces are not trimmed). | unit | P2 |
| TC-001-50 | AC-001-07 | Non-ASCII letters `ÀBC234` (negative, edge) | Home | Submit with `ÀBC234`. | `Room code must be 6 letters or digits.` | unit | P3 |
| TC-001-51 | AC-001-07 | Format error causes no connection (negative) | Home | Submit `ABC12`. | No `Connecting…`; no channel subscription; field error is associated with `Room code`. | e2e | P2 |
| TC-001-52 | AC-001-07 | Code validation precedence with a bad name (negative) | Home | Submit `Join room` with `ABC12` and empty name. | Both field errors are shown, each beside its own field: `Room code must be 6 letters or digits.` and `Enter a display name.`. | e2e | P3 |

## 8. Connecting state and timeout (AC-001-08)

| ID | AC / rule | Title | Preconditions | Steps | Expected result | Level | Priority |
|---|---|---|---|---|---|---|---|
| TC-001-53 | AC-001-08 | Create shows `Connecting…` and disables submit (happy) | Home; Supabase channel connection delayed by network throttling | Submit `Create room` with `Maya`. | While pending: `Create room` button disabled; `connection-status` text `Connecting…`. On success room shell opens. | e2e | P1 |
| TC-001-54 | AC-001-08, rule 9 | Double-click on `Create room` creates one room (negative) | Home | Double-click `Create room` (`dblclick`, and two rapid `click` calls). | Exactly one channel/room created; one room code; `Players (1)`; no second room or duplicate Host row. | e2e | P1 |
| TC-001-55 | AC-001-08, rule 9 | Double-click on `Join room` joins once (negative) | Room `R` with Host `Maya` | Double-click `Join room` with `R`, `Noah`. | Host shows `Players (2)` with one `Noah`; no `That name is already taken in this room.` error caused by the second click. | e2e | P1 |
| TC-001-56 | AC-001-08 | Join timeout: cannot reach realtime (negative) | Home; block the realtime WebSocket (route abort or `context.setOffline(true)`) | Submit `Join room` with `ABC234`, `Noah`; wait up to 5 s plus margin. | At about 5 s (record measured ms): form-level `Could not connect in time. Try again.` (`form-error`) above the submit button; submit enabled; `Connecting…` gone; `Room code` = `ABC234`, `Display name` = `Noah`. | e2e | P1 |
| TC-001-57 | AC-001-08 | Create timeout (negative) | Home; realtime blocked | Submit `Create room` with `Maya`; wait up to 10 s plus margin. | At about 10 s: `Could not connect in time. Try again.`; form enabled; `Maya` kept; no room shell. | e2e | P1 |
| TC-001-58 | AC-001-08 | Subscribe timeout result (negative) | Fake channel never reaching `SUBSCRIBED` | Call join with deadline 5 s using fake timers. | Result is connection-timeout (distinct from room-unavailable); channel unsubscribed. | unit | P1 |
| TC-001-59 | AC-001-08 | Retry after timeout works (happy) | After TC-001-56, restore network | Click `Join room` again with a live room code. | Joins normally; previous error cleared. | e2e | P2 |
| TC-001-60 | AC-001-08 | Deadline starts at submit and is one wall-clock deadline (negative, edge) | Fake timers | Subscribe at 4 s, no Host acknowledgement. | Failure at 5 s total (AC-001-11 result), not at 9 s. | unit | P2 |

## 9. Guest leaves (AC-001-09) — Presence-dependent

| ID | AC / rule | Title | Preconditions | Steps | Expected result | Level | Priority |
|---|---|---|---|---|---|---|---|
| TC-001-61 | AC-001-09, rule 6 | Guest closes tab; removed from lists `[D-020]` | Host `Maya`, Guest `Noah`, Guest2 `Linh` in `R` | Close Guest context page (`page.close()`; also run with `context.close()`). | Host and Guest2 show `Players (2)` without `Noah`. Record latency in ms. | e2e | P1 |
| TC-001-62 | AC-001-09 | Departed name can be reused `[D-020]` | After TC-001-61 | New context joins `R` as `Noah`. | Accepted; Host `Players (3)` includes `Noah`. | e2e | P1 |
| TC-001-63 | AC-001-09 | Reducer `Leave` removes an accepted Guest (happy) | Room with `Maya`, `Noah`, `Linh` | `Leave{ g-noah }`, then `Join{ 'Noah' }`. | After leave: 2 Participants, `revision` +1. Join accepted afterwards. | unit | P1 |
| TC-001-64 | AC-001-09 | Leave of unknown or duplicate participant is a no-op (negative) | Same | `Leave` for unknown ID; second `Leave` for same ID. | `outcome` = `ignored`; state unchanged; revision unchanged. | unit | P1 |
| TC-001-65 | AC-001-09, D-020 | Guest closes before Presence tracking (edge, negative) `[D-020]` | Host in `R`; delay Host acceptance (block `room:join-accepted` for the Guest) | 1. Guest submits join. 2. Close Guest page before accepted. 3. Release delay. | By design (dev spec risk) a Guest accepted before it tracks Presence may remain as a ghost row in the Host roster. Record the observation and classify it as `known limitation`, not a defect. | e2e | P2 |
| TC-001-66 | AC-001-09 | Presence `join`/`sync` never changes roster (negative) | Active room | Feed Presence `join` for unaccepted ID `x`. | Roster unchanged; no `Leave` or `Join` dispatched. | unit | P1 |
| TC-001-67 | AC-001-09 | Non-Host leave does not end room (negative) `[D-020]` | Host + 2 Guests | Close one Guest. | Remaining Guest and Host stay live; no `The Host closed the room. Return to Home to start or join another room.`. | e2e | P1 |
| TC-001-100 | AC-001-09, D-024 | `room:guest-left` for an unknown `participantId` is ignored (negative) | Fake channel, Host session with Host `h1` and accepted Guest `g1` | Deliver `room:guest-left` `{ roomCode, participantId: 'zzz' }`. | Roster, `revision` and published views unchanged; nothing sent on the channel. | unit | P1 |
| TC-001-101 | AC-001-09, D-024 | `room:guest-left` carrying the Host id is ignored (negative) | Same | Deliver `room:guest-left` `{ roomCode, participantId: 'h1' }`. | Room stays `active`; Host stays in the roster; `revision` unchanged; no `EndByHost`; nothing sent. | unit | P1 |
| TC-001-102 | AC-001-09, D-024 | Duplicate `room:guest-left` and a later Presence leave are no-ops (negative) | Same, after the first `room:guest-left` for `g1` was accepted | 1. Deliver `room:guest-left` for `g1` again. 2. Emit Presence `leave` for `g1`. | `revision` stays at the value after the first removal; no second `room:public-view`; roster unchanged. | unit | P1 |
| TC-001-103 | AC-001-09, D-024 | `room:guest-left` removes an accepted Guest and republishes (happy) | Same, revision `n` | Deliver `room:guest-left` `{ roomCode, participantId: 'g1' }`. | `g1` removed from the roster; `revision` = `n+1`; exactly one `room:public-view` is published, carrying revision `n+1` and no `g1`. | unit | P1 |

## 10. Host leaves (AC-001-10) — Presence-dependent

| ID | AC / rule | Title | Preconditions | Steps | Expected result | Level | Priority |
|---|---|---|---|---|---|---|---|
| TC-001-68 | AC-001-10, rule 7 | Host closes tab; Guests see Host-left `[D-020]` | Host + Guest + Guest2 in `R` | Close the Host context. | Each Guest shows alert `The Host closed the room. Return to Home to start or join another room.` and a `Return to Home` button; `players-list` not shown as live. | e2e | P1 |
| TC-001-69 | AC-001-10 | Return to Home, old code fails `[D-020]` | After TC-001-68 | 1. Guest clicks `Return to Home`. 2. Join `R` with `Noah`. | Home shown. After up to 5 s: `Room not found or unreachable. Check the code and try again.`; code and name kept. | e2e | P1 |
| TC-001-70 | AC-001-10, edge | Host reload `[D-020]` | Host + Guest in `R` | Host calls `page.reload()`. | Guest sees the Host-left message and `Return to Home`. Reloaded Host shows Home with no room (no `room-code`, no Players list, forms empty). | e2e | P1 |
| TC-001-71 | AC-001-10 | `EndByHost` reducer (happy) | Active room | `EndByHost`; then `Join` for a new name; `EndByHost` again. | `status` = `ended`, revision +1; later `Join` is `ignored`/rejected with no state change; repeat end is a no-op. | unit | P1 |
| TC-001-72 | AC-001-10, D-024 | Guest reload does not end room (negative) `[D-020]` | Host + 2 Guests | Guest1 reloads. | Room stays live for Host and Guest2; no Host-left message. Guest1 sends a best-effort `room:guest-left` on `pagehide` (D-024), so the Host removes it from the roster and republishes; Presence leave is only the fallback and a later duplicate Leave is a no-op. Assert removal on Host and Guest2 and record the ms; assert the sent event only if the frame is observable. | e2e | P1 |
| TC-001-73 | AC-001-10, D-005 | Forged `room:host-left` with wrong participant ID is ignored (negative) | Guest in room; Host ID `h1` | Deliver `room:host-left` with `participantId: 'zzz'`. | Guest stays in room; no Host-left message. | unit | P1 |
| TC-001-74 | AC-001-10, D-005 | Forged `room:host-left` carrying the real Host ID (documented limitation) | Host + Guest in `R`; attacker client in channel (Playwright context 3 using the Supabase client, or a unit test) reads Host `participantId` from `room:public-view` | Attacker broadcasts `room:host-left` with that ID. | EXPECTED (limitation, not a defect): Guests accept it and show `The Host closed the room. Return to Home to start or join another room.`; Broadcast is not an authorization boundary (D-005). Result recorded as `documented limitation`; must not be reported as PASS for security. | manual | P2 |
| TC-001-75 | AC-001-10 | Orderly Host close broadcasts `room:host-left` `[D-020]` | Host + Guest | Host triggers `pagehide`/close. | Guest shows Host-left via either `room:host-left` or Presence leave; message identical. Record which signal arrived first. | e2e | P3 |

## 11. Unknown or unreachable room (AC-001-11)

| ID | AC / rule | Title | Preconditions | Steps | Expected result | Level | Priority |
|---|---|---|---|---|---|---|---|
| TC-001-76 | AC-001-11 | Never-created code (happy for the error path) | Realtime reachable; no room `ABC234` | Submit `Join room` with `ABC234`, `Noah`. | Within about 5 s (record ms): form-level `Room not found or unreachable. Check the code and try again.` (`form-error`) above `Join room`; NOT beside a field; submit enabled; `Room code` = `ABC234`; `Display name` = `Noah`. | e2e | P1 |
| TC-001-77 | AC-001-11 | Ended room code `[D-020]` | Room `R` ended by Host close (TC-001-68) | Guest submits `R`, `Noah`. | Same message and retained values as TC-001-76. | e2e | P1 |
| TC-001-78 | AC-001-11 | Subscribed but no Host acknowledgement (happy for distinction) | Realtime reachable; Host acknowledgements blocked | Guest submits valid code and name. | At 5 s: `Room not found or unreachable. Check the code and try again.`, NOT `Could not connect in time. Try again.`. | e2e | P1 |
| TC-001-79 | AC-001-11 | Room-unavailable result is distinct from subscribe timeout (negative) | Fake channel subscribes, no ack | Join with fake timers advanced 5 s. | Result is room-unavailable; failed tab unsubscribed and untracked. | unit | P1 |
| TC-001-80 | AC-001-11 | Failed join leaves no ghost (negative) | After TC-001-76 on a code later created | Host creates that code afterwards. | Host `Players (1)`; the failed Guest never appears. | e2e | P2 |
| TC-001-81 | AC-001-11 | Existing room does not show the error (negative) | Host in room `R` | Guest joins `R`. | No `Room not found or unreachable. Check the code and try again.` at any time. | e2e | P1 |
| TC-001-82 | AC-001-11 | Form is usable and retry succeeds (happy) | After TC-001-76; Host now creates the code | Guest clicks `Join room` again. | Joins; error removed. | e2e | P2 |
| TC-001-83 | AC-001-11 | Network unreachable before subscription maps to AC-001-08 message (edge, documented) | Network offline | Guest submits well-formed code. | Shows `Could not connect in time. Try again.` (see list of untestable items, #3). | e2e | P2 |

## 12. Business-rule cases without a dedicated AC

| ID | AC / rule | Title | Preconditions | Steps | Expected result | Level | Priority |
|---|---|---|---|---|---|---|---|
| TC-001-84 | Rule 5 | Guest joins in `voting`, sees phase, no vote | Host in `R`, phase `voting` | Guest joins as `Noah`. | Guest `room-phase` = `voting`; Guest row `Noah` shows `Not voted`; no vote value shown. | e2e | P1 |
| TC-001-85 | Rule 5 | Guest joins in `revealed`, sees phase, no vote | Room in phase `revealed` (needs US-002/US-003 reveal; at unit level, a state built with `phase: 'revealed'`) | Apply `Join` for `Noah`; e2e: Guest joins after Host reveals. | `outcome` = `accepted`; `phase` stays `revealed`, `roundId` unchanged, `Noah` has `hasVoted: false`. e2e: Guest `room-phase` = `revealed`; `Noah` row shows `Not voted`. | unit | P1 |
| TC-001-86 | Rule 5 | e2e variant of TC-001-85 | US-002 reveal implemented; Host revealed | Guest joins in `revealed`. | See TC-001-85 e2e expectation. NOT RUN: not automated; needs the US-003 Reveal flow. | e2e | P2 |
| TC-001-87 | Rule 5 | No participant cap | Host plus 5 Guests (use 6 contexts or reducer) | Join 5 Guests. | All accepted; `Players (6)`; no cap error. Unit: 25 joins accepted. | unit | P3 |
| TC-001-88 | Rule 5 | Joining does not change `roundId` or phase (negative) | Active room `roundId` 1 | Apply `Join`. | `roundId` and `phase` unchanged; no vote created. | unit | P1 |
| TC-001-89 | Rule 8 | Guest reload: Home with code and name prefilled | Host in `R`; Guest joined as `Noah` (`sessionStorage` set) | Guest calls `page.reload()`. | Guest on Home; `Room code` = `R`; `Display name` = `Noah`; no `room-code` header; no `Connecting…`. | e2e | P1 |
| TC-001-90 | Rule 8 | Guest reload does not rejoin automatically | Same | After reload, wait 5 s. Check Host. | Guest remains on Home; no new `Noah` row appears. Host reaches `Players (1)`: the reloading Guest sends a best-effort `room:guest-left` on `pagehide` (D-024) and Presence leave is the fallback; record the removal ms. | e2e | P1 |
| TC-001-91 | Rule 8 | Guest can rejoin manually after reload `[D-020]` | After TC-001-89 | Click `Join room`. | Joined as `Noah` once the old entry is removed; if Presence has not yet removed the old `Noah`, `That name is already taken in this room.` is shown — record observed behavior. | e2e | P2 |
| TC-001-92 | Rule 8 | Only name is stored in `sessionStorage` | Guest joined | Inspect storage. | Only display name (and room code via URL) stored; no secrets, no vote data; Host name not stored on reload. | e2e | P3 |
| TC-001-93 | Rule 10, D-017 | No service-role key in client bundle | Built app | Search `dist` for `service_role`; check Vite env names. | Only Supabase URL and anon key variables exist; no `service_role` string. | manual | P2 |

## 13. Additional edge cases

| ID | AC / rule | Title | Preconditions | Steps | Expected result | Level | Priority |
|---|---|---|---|---|---|---|---|
| TC-001-94 | AC-001-06 | Duplicate race: two Guests submit the same name at once | Host in `R`; Guest and Guest2 contexts | Both submit `Noah` simultaneously. | Exactly one accepted; the other sees `That name is already taken in this room.`; Host has one `Noah`. | e2e | P2 |
| TC-001-95 | AC-001-04 | Duplicate `participantId` join intent | Active room | `Join` with an existing `participantId` and different name. | `outcome` not `accepted`; roster unchanged. | unit | P2 |
| TC-001-96 | AC-001-08 | Double-click while error displayed re-enables once | After TC-001-56 | Double-click `Join room`. | One new attempt only; `Connecting…` shown once. | e2e | P3 |
| TC-001-97 | UX-02 | Home and Room shell at 390×844 and 768×1024 | Host in room | Resize; inspect Home and Room shell. | No clipped actions; no horizontal overflow; errors visible beside fields. | manual | P3 |
| TC-001-98 | UX-07 | Accessibility of Home forms | Home | Tab through fields; trigger errors. | Labels `Display name`, `Room code`; errors exposed as alert and linked to input; visible focus; targets at least 44×44 px. | manual | P2 |
| TC-001-99 | AC-001-01 | Host `Copy link` fallback when clipboard denied | Host in room, clipboard permission denied | Click `Copy link`. | `Could not copy link. Select and copy the link.` and a selectable URL. | e2e | P3 |

## Automation scope

| Bucket | Rule | TC ids |
|---|---|---|
| Playwright now | e2e, P1, not Presence-dependent | TC-001-01, 04, 06, 07, 11, 12, 14, 15, 21, 23, 30, 36, 37, 44, 45, 46, 47, 48, 53, 54, 55, 56, 57, 76, 78, 81, 84, 89, 90 |
| Playwright now, Presence-dependent | e2e, P1, `[D-020]` (Presence validated) | TC-001-18, 61, 62, 67, 68, 69, 70, 72, 77 |
| Manual | P2 (e2e or manual level) | TC-001-03, 10, 22, 40, 42, 51, 59, 65, 74, 80, 82, 83, 86, 91, 93, 94, 98 |
| Not planned | P3 | TC-001-17, 41, 50, 52, 75, 87, 92, 96, 97, 99 |
| Vitest (unit level, outside this split) | unit cases run in Vitest regardless of priority, except P3 which are not planned | P1: TC-001-02, 08, 19, 20, 34, 39, 43, 58, 63, 64, 66, 71, 73, 79, 85, 88, 100, 101, 102, 103; P2: TC-001-49, 60, 95 |

TC-001-90 asserts both the Guest side and the Host-side removal (via `room:guest-left`, D-024, with Presence as fallback).

## Coverage matrix

| AC / rule | Happy | Negative | Edge / other |
|---|---|---|---|
| AC-001-01 | TC-001-01, 02, 03 | TC-001-04 | TC-001-99 |
| AC-001-02 | TC-001-06, 07, 08, 10 | TC-001-11, 12 | TC-001-07 (` abc234 `), 10 (0/O/1/I) |
| AC-001-03 | TC-001-14, 15 | — | TC-001-17 |
| AC-001-04 | TC-001-18, 19, 22 | TC-001-20, 21 | TC-001-95 |
| AC-001-05 | TC-001-23, 30, 34 | TC-001-23, 30, 34 | TC-001-23, 30 (20/21 boundary) |
| AC-001-06 | TC-001-36, 41, 42 | TC-001-37, 39, 40 | TC-001-94 |
| AC-001-07 | TC-001-43 | TC-001-44, 45, 46, 47, 48, 49, 50, 51 | TC-001-52 |
| AC-001-08 | TC-001-53, 59 | TC-001-54, 55, 56, 57, 58 | TC-001-60, 96 |
| AC-001-09 `[D-020]` | TC-001-61, 62, 63, 103 | TC-001-64, 65 (known limitation, not a defect), 66, 67, 100, 101, 102 | TC-001-65 (leave before Presence; known limitation) |
| AC-001-10 `[D-020]` | TC-001-68, 69, 70, 71 | TC-001-72, 73 | TC-001-74 (forged host-left), 75 |
| AC-001-11 | TC-001-76, 77, 78 | TC-001-79, 80, 81 | TC-001-82, 83 |
| Rule 5 | TC-001-84, 85, 86 | TC-001-88 | TC-001-87 |
| Rule 8 | TC-001-89, 91 | TC-001-90 | TC-001-92 |
| Rule 10 / D-017 | — | TC-001-93 | — |
| Rule 11 | TC-001-18, 22 | — | — |

## Execution status

Presence is validated and D-020 is Accepted, so no case is gated on a spike any more. Figures below are the team-reported last run; per-case results are in the Playwright report, not reproduced here.

- Last e2e run: 65 of 70 tests passed before fixes (5 failed; the failing cases are not itemized in this file, and they were not re-run after the fixes). Result for those 5 is FAIL until a rerun is recorded.
- Automated e2e (executed in that run): TC-001-01, 04, 06, 07, 11, 12, 14, 15, 18, 21, 23, 30, 36, 37, 44, 45, 46, 47, 48, 53, 54, 55, 56, 57, 61, 62, 67, 68, 69, 70, 72, 76, 77, 78, 81, 84, 89, 90.
- Automated unit (Vitest): TC-001-02, 08, 19, 20, 34, 39, 43, 49, 58, 60, 63, 64, 66, 71, 73, 79, 85, 87, 88, 95, plus the `room:guest-left` cases TC-001-100..103.
- NOT RUN (no automation): e2e TC-001-03, 10, 17, 22, 40, 42, 51, 52, 59, 65, 75, 80, 82, 83, 86, 91, 92, 94, 96, 99; unit TC-001-41, 50; manual TC-001-74, 93, 97, 98.

## Not testable as written

| # | Item | Why | Needed from |
|---|---|---|---|
| 1 | AC-001-04 2 s | Start point is "join confirmed to the second Guest"; Presence/Broadcast latency has no documented SLA, so only a measured sample on one environment can be reported, not a guarantee. | BA / Developer (D-020 spike) |
| 2 | AC-001-08 10 s / 5 s limits | Baselines, "not measured"; tests can only check about the limit with a tolerance. Tolerance not defined. | BA |
| 3 | AC-001-11 "network unreachable" vs AC-001-08 | The requirement wording will be aligned by BA: a network failure before subscription is AC-001-08 (`Could not connect in time. Try again.`). TC-001-83 already follows this. | BA |
| 4 | AC-001-09 / AC-001-10 latency | No time bound defined for departure detection, and Presence gives none; the test waits an arbitrary maximum and records it. | BA / Developer |
| 5 | AC-001-10 "closes or reloads" | Presence cannot tell a close from transient loss; a Host network blip may end the room. Not asserted. | Developer / mob |
| 6 | AC-001-10 return control | Requirement gives no label; `Return to Home` is the spec's recommendation. | BA |
| 7 | Rule 5 in `revealed` (e2e) | No Reveal control exists in US-001; e2e needs US-002. Only the unit-level state is testable now. | US-002 |
| 8 | Rule 6 mechanism | Mechanism not prescribed; tests check only the observable roster. | — |
| 9 | Share link with malformed or empty `?room=` | Behavior not specified (prefill, ignore, or error). No case written. | BA |
| 10 | Unicode names (emoji, combined characters) | Length rule counts JavaScript characters; grapheme counting undecided. No boundary case written. | BA |
| 11 | Forged `room:host-left` (TC-001-74) | Expected behavior is a documented limitation (D-005), not a security guarantee; cannot PASS as protection. | Mob |
| 12 | TC-001-10 / TC-001-07 for codes with `0/O/1/I` in e2e | Rooms cannot be generated with those characters, so only the format check and a not-found outcome are testable end to end. | — |
| 13 | Guest reload for the Host-left (rule 7) state | Not specified whether prefill applies after the room ended. | BA |
| 14 | Unknown-or-unreachable vs "Host unresponsive" | Same message by design; they cannot be told apart by tests. | — |
| 15 | Clipboard behavior (`Link copied`) | Browser permission dependent; TC-001-03/99 cover both outcomes but depend on the browser. | Test environment |
| 16 | D-020 status | These cases treat D-020 as Accepted (Presence validated), but [decisions.md](../knowledge/decisions.md) and the [dev spec](../specs/US-001-dev-spec.md) still list it as Proposed. The `[D-020]` tag follows the team report until the decision log is updated. | BA / mob |
| 17 | `room:guest-left` cases TC-001-100..103 | D-024 and the spec event table define the event, but the spec has no AC or state-transition row for it; cases are traced to AC-001-09 and D-024. | Developer |
