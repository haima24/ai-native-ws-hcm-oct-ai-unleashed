# US-002: Vote with hidden cards

## Story
As a Participant, I want to choose and change an estimate while votes are hidden, so that everyone can estimate independently before the Host reveals the votes.

- MVP feature: US-002 from [product brief](../product-brief.md)
- Brief success criteria: 2 (other Participants see only vote status before reveal); 4 (vote is part of the create-to-reveal flow)
- Decisions: D-004 (Accepted), D-005 (Accepted), D-006 (Accepted), D-011 (Accepted)

## Scope
**In scope**
- Host and Guests who have joined the room as Participants can vote.
- Choose one card from the fixed Fibonacci scale and change the choice while the room is in `voting`.
- Show a Participant's accepted-vote status to others without exposing the value before reveal.
- Distinguish local pending selection from an accepted vote; provide vote-send feedback.
- Disable voting when the room is `revealed` or the connection is lost.

**Out of scope**
- Creating or joining a room, display names and the Players roster structure (US-001).
- Reveal and Revote controls or authorization, revealing values, Results, Average and Consensus (US-003).
- Network-level confidentiality or protection from inspecting messages (D-005).
- Custom scales, multiple votes per Participant, round history or persistence.

## Acceptance criteria
Keep AC IDs stable when revising. Each AC has an observable result. Use separate Host and Guest browser contexts for cross-Participant checks.

### AC-002-01 Fixed voting cards
- **Given** a Host or Guest has joined a room and its phase is `voting`
- **When** the Participant views the voting area
- **Then** the nine selectable cards are shown in this order: `0`, `1`, `2`, `3`, `5`, `8`, `13`, `21`, `?`
- **And** the Host and Guests have the same card choices

### AC-002-02 Select and change a vote
- **Given** a Participant is in a room in phase `voting`
- **When** they select a card
- **Then** that choice is visibly selected and the UI shows `Sending vote…` while awaiting confirmation
- **And** once the vote is confirmed, the selected card exposes `aria-pressed=true` and that Participant's status is `Voted`
- **And** before the phase changes to `revealed`, the Participant can select a different card and the confirmed vote is updated to that choice

### AC-002-03 Hide vote values before reveal
- **Given** at least one Participant has an accepted vote and the room is in phase `voting`
- **When** another Participant views the Players list
- **Then** each other Participant is shown only as `Voted` or `Not voted`, never by card value
- **And** a Participant without an accepted vote is shown as `Not voted`, even if that Participant has a pending local selection
- **And** each Participant may see their own selected card

### AC-002-04 Vote not confirmed
- **Given** a Participant selects a card while the room is in phase `voting`
- **When** the vote is not confirmed
- **Then** the UI shows `Vote was not confirmed. Try again.`
- **And** the unconfirmed selection is not presented as an accepted vote
- **And** the Participant can retry while the room remains in phase `voting`

### AC-002-05 Voting unavailable outside voting phase
- **Given** the room phase is `revealed`
- **When** a Participant views the voting area
- **Then** card selection is disabled until the Host starts a Revote and the room returns to `voting` (US-003)

### AC-002-06 Voting unavailable while disconnected
- **Given** the Participant's room connection is lost
- **When** the room view indicates `Connection lost. Reconnecting…`
- **Then** card selection is disabled until the connection is restored

## Input validation
| Field | Rule | Exact error message (if specified) |
|---|---|---|
| Card | A vote must use one of the nine fixed cards in AC-002-01; there is no free-form value input. | — |
| Vote confirmation | A selected vote has not been confirmed. | `Vote was not confirmed. Try again.` |

## Business rules
1. Every Participant, including the Host, may cast one vote in the current round.
2. The only valid card values are `0`, `1`, `2`, `3`, `5`, `8`, `13`, `21`, and `?` (D-011).
3. A Participant may replace their vote while the phase is `voting`. The latest confirmed vote is their vote for that round.
4. Until the phase is `revealed`, other Participants see only `Voted` or `Not voted`; their vote values are not shown in the UI (D-005). A Participant may see their own selection.
5. A pending local selection is not evidence of an accepted vote. The Players status remains `Not voted` until a vote is accepted; the UI uses the pending and failure feedback specified in the UI/UX contract.
6. Voting is unavailable in phase `revealed` and while the connection is lost. Revote returns the room to `voting` with votes cleared (US-003, D-008).
7. This story does not define vote display after reveal or calculate results; US-003 owns those rules.

## Traceability
| AC | Brief success criterion | Decision ID |
|---|---|---|
| AC-002-01 | US-002 Done when | D-011 |
| AC-002-02 | US-002 Done when; 4 | D-004, D-006 |
| AC-002-03 | 2 | D-005 |
| AC-002-04 | US-002 Done when | D-004 |
| AC-002-05 | 4 | D-006, D-008 |
| AC-002-06 | UI/UX voting state contract | D-003 |

## Dependencies
- [US-001 Create / join room](US-001-create-join-room.md): successful room entry establishes the Participant identity and Room shell; this story does not redefine either.
- [US-003 Reveal, results and revote](US-003-reveal-results-and-revote.md): owns phase transition to `revealed`, post-reveal presentation and return to voting through Revote; the zero-vote Reveal rule remains subject to mob confirmation there.
- [UI/UX](../design/ui-ux.md): Room shell, card grid, selected/pending/accepted/failed states, phase behavior and accessibility.
- [Decisions](../knowledge/decisions.md) and [glossary](../knowledge/glossary.md): D-004 through D-006, D-011 and shared definitions for Vote, Participant, Phase and Public view.
- Developer spec `docs/specs/US-002-dev-spec.md` and test cases `docs/test-cases/US-002-test-cases.md` must exist before production code, per project workflow.

## Open questions and assumptions
| # | Question or assumption | Type (question / reversible assumption) | Status |
|---|---|---|---|
| 1 | Vote acceptance and failure feedback follow the UI/UX target: pending selection shows `Sending vote…`; lack of confirmation shows `Vote was not confirmed. Try again.` | reversible assumption | Open for mob review; Developer verifies what confirmation/failure the transport can reliably distinguish |
| 2 | On a failed attempt to change an already confirmed vote, does the prior confirmed vote remain the displayed local selection, or can the Host have accepted the new vote without its confirmation reaching the sender? | question | Developer to resolve in the US-002 spec; align UI and tests to the actual acknowledgment contract |
| 3 | The UI/UX proposal to block Reveal when there are zero votes is not specified here because Reveal belongs to US-003 and must be decided there before implementation. | question | US-003 BA/mob decision |

## Review
- INVEST check: The slice is independently testable in a joined room and small enough to keep Reveal/Results in US-003.
- Material issues: Vote acknowledgment semantics, especially a failed replacement vote, need a concrete transport contract before implementation; see open question 2.