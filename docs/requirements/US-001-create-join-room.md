# US-001: Create / join room

## Story
As a Host or Guest, I want to create a room or join one with a code or share link and a display name, so that the team enters one shared session in seconds and everyone sees the same live Players list.

- MVP feature: US-001 from [product brief](../product-brief.md)
- Brief success criteria: 1 (roster updates within 2 s), 4 (flow works without a page reload; this story covers only the create/join part)
- Decisions: D-004 (Accepted), D-006 (Accepted), D-016 (Accepted), D-017 (Accepted)

## Scope
**In scope**
- Host creates a room with a display name; gets a 6-character room code and a share link.
- Guest joins with room code (typed or from the share link) and a display name.
- Host and all Guests see the same live Players list, including when someone leaves.
- Guest joining in phase `voting` or `revealed` sees the current phase; a new joiner has no vote.
- Validation, connecting, failure and Host-left behavior on Home and the Room shell header/sidebar.

**Out of scope**
- Voting, reveal, revote (US-002, US-003); card grid behavior and Results.
- Accounts, login, persistence, host migration, automatic rejoin.
- Participant cap, avatars, chat, spectators, localization.

## Acceptance criteria
Keep AC IDs stable when revising. Each AC has an observable result. Playwright uses separate Host and Guest browser contexts.

### AC-001-01 Host creates a room
- **Given** the Host is on Home and enters a valid display name in `Create room`
- **When** the Host submits
- **Then** the Room shell opens with a room code of exactly 6 characters from the code alphabet (see Business rules) shown in the header, a `Copy link` action, phase `voting`, and `Players (1)` listing the Host's name annotated `Host` and `You`
- **And** the share link, when opened, loads Home with that room code (see AC-001-03)

### AC-001-02 Guest joins with a code
- **Given** a room exists and the Host is in it
- **When** a Guest on Home enters the room code and a valid display name in `Join room` and submits
- **Then** the Guest sees the Room shell with the same room code and a Players list containing the Host (annotated `Host`) and the Guest (annotated `You`)
- **And** the code is accepted regardless of letter case or surrounding spaces (e.g. ` abc234 ` joins room `ABC234`)

### AC-001-03 Guest joins with the share link
- **Given** the Host has a room and copies the share link
- **When** a Guest opens the share link in a separate browser context
- **Then** Home shows the room code prefilled in `Join room` and the `Display name` field empty
- **And** after entering a valid display name and submitting, the Guest joins as in AC-001-02

### AC-001-04 Live roster within 2 s
- **Given** the Host and one Guest are in the same room
- **When** a second Guest joins
- **Then** within 2 s of the join being confirmed to the second Guest, the Host's and the first Guest's Players lists show the new name and the same count and the same set of names as the second Guest's list

### AC-001-05 Display name length validation
- **Given** the user is on Home
- **When** they submit `Create room` or `Join room` with a display name that is empty, only spaces, or longer than 20 characters after trimming
- **Then** the field error from the Input validation table is shown beside `Display name`, no room is created or joined, and the typed values stay in the fields
- **And** a name of 1 to 20 characters after trimming is accepted, stored trimmed

### AC-001-06 Duplicate display name
- **Given** a room contains a Participant named `Maya`
- **When** a Guest submits `Join room` with display name `maya` (or ` MAYA `)
- **Then** the duplicate-name error is shown beside `Display name`, the Guest is not added, the Players list of existing Participants is unchanged, and the typed room code and name stay in the fields

### AC-001-07 Room code format validation
- **Given** the user is on Home
- **When** they submit `Join room` with an empty room code, or a code that after trimming is not exactly 6 characters or contains characters outside the code alphabet (e.g. `ABC12`, `ABC1234`, `ABC-12`, `ABO012`)
- **Then** the matching field error from the Input validation table is shown beside `Room code`, no connection attempt result is shown as joined, and typed values stay in the fields

### AC-001-08 Connecting state and timeout
- **Given** the user has submitted `Create room` (limit 10 s) or `Join room` (limit 5 s)
- **When** the request is in progress
- **Then** the submit control is disabled and `Connecting…` is shown, so a second click creates or joins only once
- **And** when the realtime connection cannot be established within the limit, the timeout error from the Input validation table is shown, the form is enabled again and typed input is kept

### AC-001-09 Guest leaves
- **Given** the Host and two Guests are in a room
- **When** one Guest closes their tab
- **Then** that Guest's name disappears from the Host's and the other Guest's Players lists and the count decreases by one
- **And** the departed name can be used again by a new join

### AC-001-10 Host leaves ends the room
- **Given** the Host and at least one Guest are in a room
- **When** the Host closes or reloads the tab
- **Then** each Guest sees the Host-left message from the Input validation table and a control to return to Home; no Players list is presented as live
- **And** after the Guest returns to Home, joining with the old code shows the unknown-or-unreachable error from the Input validation table; the reloaded Host starts at Home with no room

## Input validation
| Field | Rule | Exact error message |
|---|---|---|
| Display name | Required; trimmed; empty or only spaces | `Enter a display name.` |
| Display name | Trimmed length > 20 | `Display name must be 20 characters or fewer.` |
| Display name | Must be unique in the room, ignoring case (join only) | `That name is already taken in this room.` |
| Room code | Required; empty after trim | `Enter the room code.` |
| Room code | After trim and case-normalization not exactly 6 characters from the code alphabet | `Room code must be 6 letters or digits.` |
| Room (join) | Well-formed code, no Host response within 5 s, or network unreachable | `Room not found or unreachable. Check the code and try again.` |
| Connection (create 10 s / join 5 s) | Realtime connection not established within the limit | `Could not connect in time. Try again.` |
| Room (Guest in room) | Host closed or reloaded the tab | `The Host closed the room. Return to Home to start or join another room.` |

Existing UI strings reused unchanged from [UI/UX](../design/ui-ux.md): `Connecting…`, `Players`, `Copy link`, `Link copied`, `Could not copy link. Select and copy the link.`, `Connection lost. Reconnecting…`, `Not voted`, annotations `Host` and `You`. The messages in the table above are new copy proposed by this story; field errors appear beside the field, not as toasts.

## Business rules
1. Display name: trimmed, 1 to 20 characters, unique in the room ignoring case; the Host's name counts.
2. Room code: 6 characters, case-insensitive (D-016). Generated from uppercase letters and digits excluding look-alikes `0`, `O`, `1`, `I` (alphabet: `ABCDEFGHJKLMNPQRSTUVWXYZ23456789`). Input is trimmed and upper-cased before validation and lookup; typing `0`, `O`, `1` or `I` is malformed.
3. Share link opens Home with the room code prefilled; the Guest still enters a display name. Opening the link never auto-joins.
4. The Host tab owns room state and the roster; Guests send a join intent and the Host publishes the roster (D-004). Phases are only `voting` and `revealed` (D-006); a new room starts in `voting`.
5. A Guest may join in any phase, sees the current phase, and starts with no vote. No Participant cap.
6. A Participant who leaves (closes the tab) disappears from every Players list. The mechanism is not prescribed.
7. Host closes or reloads the tab: the room ends, Guests see the Host-left message and return to Home. No host migration.
8. Guest reload returns to Home with the room code and display name prefilled; no automatic rejoin.
9. Connection limits: create 10 s, join 5 s. These are baselines to verify, not measured. While connecting, submission is disabled; typed input is kept on any failure.
10. Supabase URL and anon key come only from Vite env vars (D-017); no secrets in this story's artifacts.
11. Players list shows the same set of names to every Participant; ordering is not specified.

## Traceability
| AC | Brief success criterion | Decision ID |
|---|---|---|
| AC-001-01 | 4 (create step) | D-004, D-006, D-016 |
| AC-001-02 | 4 (join step) | D-004, D-016 |
| AC-001-03 | 4 (join step) | D-016 |
| AC-001-04 | 1 | D-004 |
| AC-001-05 | — (US-001 "Done when") | — |
| AC-001-06 | — (US-001 "Done when") | — |
| AC-001-07 | — (US-001 "Done when") | D-016 |
| AC-001-08 | — (US-001 "Done when") | D-003, D-017 |
| AC-001-09 | 1 | D-004 |
| AC-001-10 | — (brief out of scope: no host migration) | D-004 |

D-017 is relevant only to environment configuration (needed by AC-001-08); no AC tests it directly.

## Dependencies
- [product brief](../product-brief.md), [decisions](../knowledge/decisions.md), [glossary](../knowledge/glossary.md), [UI/UX](../design/ui-ux.md) (Home and Room shell).
- Developer spec `docs/specs/US-001-dev-spec.md` and test cases `docs/test-cases/US-001-test-cases.md` must exist before production code.
- Feasibility inputs for the Developer: Broadcast-only leave detection, Host-left detection, and distinguishing unknown room from timeout (see assumptions).

## Open questions and assumptions
| # | Question or assumption | Type | Status |
|---|---|---|---|
| 1 | Display name: trimmed, 1-20 characters, unique ignoring case. | reversible assumption | Open for mob review |
| 2 | Room code: 6 chars, alphabet without `0/O/1/I`, trimmed and normalized input; brief only fixes length and case-insensitivity (D-016). | reversible assumption | Open for mob review |
| 3 | Share link opens Home with code prefilled; no auto-join. | reversible assumption | Open for mob review |
| 4 | Guest may join in `voting` or `revealed`, sees current phase, has no vote; no participant cap. | reversible assumption | Open for mob review |
| 5 | A leaving Participant disappears from every Players list; mechanism left to the Developer. | reversible assumption | Developer to verify feasibility |
| 6 | Host closing or reloading the tab ends the room; Guests see a message and return to Home; no host migration. | reversible assumption | Open for mob review |
| 7 | Guest reload returns to Home with code and name prefilled; no auto rejoin. | reversible assumption | Open for mob review |
| 8 | Create waits up to 10 s, join up to 5 s; baselines, not measured. | reversible assumption | Developer to verify |
| 9 | Error message wording in the validation table is new copy. | reversible assumption | Open for mob review |
| 10 | Can the client distinguish "no Host responded" from "transport not connected" so the unknown-or-unreachable message and the AC-001-08 timeout message differ? If not, both may collapse to one message. (The unknown-room case no longer has its own AC.) | question | Developer to answer in spec |
| 11 | Can a Broadcast-only design reliably detect a closed or reloaded Host tab (and a closed Guest tab) without an arbitrary timer? UI/UX says not to invent a timer detector. | question | Developer to answer in spec |

## Review
- INVEST check: Small and Testable hold, but the story bundles create, join, validation and leave/Host-left behavior into 10 ACs. If the mob needs a smaller slice, AC-001-09 and AC-001-10 (leave handling) can be split into a follow-up without breaking the rest. The "Valuable" part depends on US-002/US-003 for a full demo.
- Material issues:
  - AC-001-04, AC-001-08, AC-001-09 and AC-001-10 depend on timing/leave detection that Supabase Broadcast may not support reliably without a presence mechanism or timers (questions 10 and 11); if infeasible, those ACs must be revised, not weakened silently.
  - ACs were renumbered after removing the unknown-or-unreachable-room AC and the mid-round-join AC. The unknown-or-unreachable error row remains in the validation table and is only referenced by AC-001-10; the mid-round join behavior remains as business rule 5 and assumption 4 with no AC. Test cases for both must come from those rules, or the mob should drop the rules.
  - AC-001-04's 2 s is measured from join confirmation on the joining client; the brief does not define the start point (assumption of this story).
  - Guest-reload behavior (rule 8) has no dedicated AC; the Test owner should add a test case from the rule.
