# US-003: Reveal, results and revote

## Story
As the Host, I want to reveal the team's votes and start a revote, so that everyone can review the estimates and re-estimate in the same room when needed.

- MVP feature: US-003 from [product brief](../product-brief.md)
- Brief success criteria: 2 (values remain hidden until reveal); 3 (Host-only reveal/revote); 4 (full flow without reload); 5 (identical results for all clients)
- Decisions: D-004 (Accepted), D-005 (Accepted), D-006 (Accepted), D-007 (Accepted), D-008 (Accepted), D-009 (Accepted), D-010 (Accepted), D-014 (Accepted), D-018 (Accepted), D-019 (Accepted), D-015 (Accepted), D-021 (Accepted), D-022 (Accepted), D-023 (Accepted)

## Scope
**In scope**
- Host-only Reveal and Revote actions, including enforcement when a Guest sends either intent.
- Revealing the current round's votes to all current Participants.
- Per-Participant vote display and the Average, Consensus and participation count.
- Returning the same room to `voting` with all votes cleared when the Host starts a Revote.
- Rejecting stale vote intents from an earlier round.

**Out of scope**
- Creating/joining rooms, room identity, display names and live roster behavior (US-001).
- Choosing or changing a vote, pending state and vote-send confirmation (US-002).
- Persistent round history, exporting results, next-story/backlog workflows or additional phases.
- Network-level confidentiality; D-005 only promises that other Participants' vote values are not shown in the UI before reveal.

## Acceptance criteria
Keep AC IDs stable when revising. Each AC has an observable result. Cross-Participant results are checked in separate Host and Guest browser contexts.

### AC-003-01 Host reveals a round with at least one accepted vote
- **Given** the room is in phase `voting` and at least one current Participant has an accepted vote
- **When** the Host activates `Reveal estimates`
- **Then** the phase changes to `revealed` without a page reload
- **And** all connected Participants see the same revealed votes and results for that room state
- **And** card selection is disabled for all Participants until a Revote returns the room to `voting` (US-002)

### AC-003-02 Reveal requires an accepted vote
- **Given** the room is in phase `voting` and no Participant has an accepted vote
- **When** the Host activates `Reveal estimates`
- **Then** the phase remains `voting`, votes remain hidden, and the Host sees `At least one vote is required to reveal`
- **And** the Host can retry Reveal after at least one vote is accepted

### AC-003-03 Reveal is Host-only
- **Given** the room is in phase `voting`
- **When** a Guest views the room
- **Then** the Guest does not see a Reveal control and sees `Waiting for Host to reveal.`
- **And** if a Guest sends a Reveal intent, the Host ignores it and the phase and public view do not change

### AC-003-04 Show each current Participant's vote
- **Given** the room is in phase `revealed`
- **When** a Participant views the Players list
- **Then** each current Participant with an accepted vote is shown with that card value
- **And** each current Participant without an accepted vote is shown as `No vote`
- **And** a cast `?` is shown as `?`, not `No vote`
- **And** all connected Participants see the same values for the same current room state

### AC-003-05 Calculate Average
- **Given** the room is in phase `revealed`
- **When** at least one current Participant has an accepted numeric vote
- **Then** `Average` is the arithmetic mean of those numeric votes; `?` and `No vote` are excluded
- **And** the displayed value is rounded to the nearest hundredth, with an exact midpoint rounded up, and trailing zeroes are omitted (for example, an exact mean of `0.125` displays as `0.13`)
- **When** there are no accepted numeric votes
- **Then** `Average` displays `—`

### AC-003-06 Calculate Consensus
- **Given** the room is in phase `revealed` and at least one current Participant has an accepted numeric vote
- **When** all numeric votes are equal
- **Then** `Consensus` displays `Yes`
- **When** the numeric votes are not all equal
- **Then** `Consensus` displays `No`
- **And** `?` and `No vote` do not affect Consensus
- **When** there are no accepted numeric votes
- **Then** `Consensus` displays `—`

### AC-003-07 Show participation count
- **Given** the room is in phase `revealed`
- **When** a Participant views Results
- **Then** the participation count is shown as `<voted> of <participants> voted` using the current Players roster
- **And** any accepted card, including `?`, counts as a vote; `No vote` does not

### AC-003-08 Guest joins after Reveal
- **Given** the room is in phase `revealed` and a Guest joins according to US-001
- **When** the Guest's current room state is shown
- **Then** the Guest sees phase `revealed`, appears in Players with `No vote`, and sees the same existing vote values and calculated results as the other Participants
- **And** the participation count includes the Guest in its participant total but not in its voted total

### AC-003-09 Participant who voted leaves
- **Given** a Guest with an accepted vote leaves while the room is in phase `voting` or `revealed`
- **When** the leave is reflected in the current Players roster (US-001)
- **Then** that Guest is removed from Players for all connected Participants
- **And** if the room is `revealed`, the Guest is removed from Results and their vote is excluded from Average, Consensus and the participation count
- **And** if the room is `voting`, their vote is not shown and is excluded if the Host later reveals the round
- **And** all remaining Participants see the same current room state and, when revealed, the same updated Results

### AC-003-10 Host starts a Revote
- **Given** the room is in phase `revealed`
- **When** the Host activates `Revote`
- **Then** the same room returns to phase `voting` without a page reload
- **And** all accepted votes, local selections, revealed values and Results are cleared for the new round
- **And** the round identifier increases so that intents from the previous round cannot affect the new round
- **And** Participants can vote again as described by US-002

### AC-003-11 Revote is Host-only
- **Given** the room is in phase `revealed`
- **When** a Guest views the room
- **Then** the Guest does not see a Revote control and sees `Waiting for Host to start a revote.`
- **And** if a Guest sends a Revote intent, the Host ignores it and the phase, votes and Results do not change

### AC-003-12 Ignore actions in the wrong phase and stale vote intents
- **Given** the room is in phase `revealed`
- **When** the Host sends another Reveal intent
- **Then** the room remains unchanged
- **Given** the room is in phase `voting`
- **When** the Host sends a Revote intent
- **Then** the room remains unchanged
- **Given** the Host has started a Revote
- **When** a vote intent carrying the previous round identifier arrives
- **Then** the Host rejects it and it does not change any new-round vote or vote status

### AC-003-13 Disable phase actions while disconnected
- **Given** the Host's room connection is lost and the room view indicates `Connection lost. Reconnecting…`
- **When** the Host views the phase action
- **Then** Reveal or Revote is disabled until the connection is restored

## Input validation
| Field / action | Rule | Exact error message (if specified) |
|---|---|---|
| Reveal | Room must be in `voting` and have at least one accepted vote. | `At least one vote is required to reveal` |
| Reveal / Revote | Only the Host may perform the action; non-Host intents are ignored. | — |
| Revote | Room must be in `revealed`. | — |
| Vote intent | Its round identifier must match the current round. | — |

## Business rules
1. Phases are only `voting` and `revealed` (D-006). A new room starts in `voting` (US-001); Reveal changes it to `revealed`; Revote returns it to `voting`.
2. Only the Host can Reveal or Revote. Guests never see those controls, and the Host ignores those intents from non-Host senders (D-007).
3. Reveal requires at least one accepted vote (Accepted via D-021). A pending selection is not an accepted vote (US-002); when there are none, the Host sees the AC-003-02 message and the phase stays `voting`.
4. On Reveal, show the current Players roster's accepted vote values. Show `No vote` for a current Participant without a vote; show a cast `?` literally. `?` is distinct from no vote (glossary).
5. Average is the arithmetic mean of current Participants' numeric votes; exclude `?` and `No vote` (D-009). Round to the nearest hundredth with exact midpoint rounded up, omit trailing zeroes, and display `—` if there are no numeric votes (Accepted via D-015). Average is computed with integer arithmetic (sum / count, rounded half up to two decimals) to avoid floating point errors.
6. Consensus is `Yes` if at least one numeric vote exists and all numeric votes are equal; otherwise `No` (D-010, D-019). Display `—` when there are no numeric votes (Accepted via D-015). A card `0` is a numeric vote: it counts in Average and Consensus (only `0` votes give Average `0` and Consensus `Yes`).
7. Show `<voted> of <participants> voted`; count accepted `?` as voted. The denominator is the current Players roster (Accepted via D-022).
8. A Guest joining in `revealed` has no vote under US-001. They appear as `No vote`; their presence changes only the participation count, not the existing votes, Average or Consensus (Accepted via D-023).
9. A Revote clears accepted votes, pending local selections, per-Participant revealed values, Average, Consensus and participation count; it increments the round identifier and retains the same room (D-008, D-018).
10. A vote intent from a previous round is rejected (D-018). An action that is unauthorized or invalid for the current phase leaves room state unchanged.
11. The current Players roster defines the result population. When a Participant leaves, they are removed from Results and their vote is excluded; in `voting`, their vote is excluded if the Host later reveals the round. The live roster/leave behavior itself is specified in US-001 (Accepted via D-023).

## Traceability
| AC | Brief success criterion | Decision ID |
|---|---|---|
| AC-003-01 | 4, 5 | D-004, D-006 |
| AC-003-02 | US-003 Done when | D-021 |
| AC-003-03 | 2, 3 | D-005, D-007 |
| AC-003-04 | 5 | D-005, D-009, D-011 |
| AC-003-05 | 5 | D-009, D-015 |
| AC-003-06 | 5 | D-010, D-015, D-019 |
| AC-003-07 | UI/UX Results | D-022 |
| AC-003-08 | 5; US-001 mid-round join rule | D-023 |
| AC-003-09 | 5; US-001 leave behavior | US-001 AC-001-09; D-023 |
| AC-003-10 | 4 | D-008, D-018 |
| AC-003-11 | 3 | D-007 |
| AC-003-12 | US-003 Done when | D-006, D-007, D-018 |
| AC-003-13 | UI/UX connection-lost state | D-003 |

## Dependencies
- [US-001 Create / join room](US-001-create-join-room.md): establishes the Host, current Players roster, Host-left behavior and Guest-join behavior; AC-001-09 and Business rule 5 affect result population.
- [US-002 Vote with hidden cards](US-002-vote-with-hidden-card.md): provides the fixed card set, accepted votes, pending-vote distinction, phase-based voting availability and owns the `Connection lost. Reconnecting…` state used by AC-003-13.
- [UI/UX](../design/ui-ux.md): Room shell, Host/Guest action matrix, revealed state, Results presentation, connection behavior, focus management and accessibility.
- [Decisions](../knowledge/decisions.md) and [glossary](../knowledge/glossary.md): phase, role, result and round definitions.
- Developer spec `docs/specs/US-003-dev-spec.md` and test cases `docs/test-cases/US-003-test-cases.md` must exist before production code, per project workflow.

## Open questions and assumptions
| # | Question or assumption | Type (question / reversible assumption) | Status |
|---|---|---|---|
| 1 | Reveal is blocked until at least one vote is accepted, with the exact message in AC-003-02. | reversible assumption | Accepted via D-021 |
| 2 | Average is rounded to at most two decimals; exact midpoints round up, trailing zeroes are omitted, and no numeric votes shows `—` for Average and Consensus. | reversible assumption | Accepted via D-015 |
| 3 | Show `<voted> of <participants> voted`, including `?` as a vote and using the current roster as denominator. | reversible assumption | Accepted via D-022 |
| 4 | A Guest may join while `revealed` with no vote, per US-001; the Guest appears as `No vote` and changes the participation denominator only. | reversible assumption | Accepted via D-023 |
| 5 | A Participant leaving is removed from the result population and their vote is excluded, including when the phase is already `revealed`. | reversible assumption | Accepted via D-023 |
| 6 | Vote intent acknowledgment and failed replacement-vote behavior are still open in US-002. US-003 uses only Host-accepted votes as the source for reveal and results. | question | Developer to resolve in US-002 spec before end-to-end implementation |

## Review
- INVEST check: Small and testable as the final phase of one room round; Results and Revote remain together because they share the revealed state.
- The round identifier (AC-003-10) and wrong-phase or non-Host intents (AC-003-12, AC-003-03, AC-003-11 intent part) have no UI control and are verified at unit or protocol level.
- Live recalculation after Reveal for AC-003-09 is lower priority.
- Material issue: The vote acknowledgement contract is owned by US-002 and remains the only open item.