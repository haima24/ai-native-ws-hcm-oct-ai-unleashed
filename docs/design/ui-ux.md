# UI/UX — Story Pointing

**Status:** implementation target; not a claim of implemented UI or completed usability testing.
**Owners:** BA defines behavior and copy; Developer maintains this design and the story selector contracts; Test verifies observable states.

## 1. What to copy from the reference

![User-provided planning poker reference](references/planning-poker-reference.png)

Copy the restrained light background, dark blue-gray accents, small Players panel on the left, large flat card buttons, selected-card contrast and the action centered below the grid. Do not copy the image's names, avatars, exact pixels or numeric scale.

The fixed scale is `0, 1, 2, 3, 5, 8, 13, 21, ?` (D-011). Nine cards use a 5+4 desktop grid; do not render blank fake cards to fill the row.

## 2. Screens and hierarchy

### Home — US-001
- Page title `Story Pointing`; subtitle `Estimate together, without signing up.`
- Two labeled sections: `Create room` (`Display name`, primary action) and `Join room` (`Room code`, `Display name`, primary action). A share link prefills the room code.
- Show field validation beside the field using the exact US-001 AC messages, not generic toasts.
- While connecting, disable duplicate submission and show `Connecting…`; keep typed input on failure.

### Room shell — US-001, US-002, US-003

```text
+------------------------------------------------------------+
| Story Pointing     Room ABC123     Copy link     Connection  |
+--------------------+---------------------------------------+
| Players (3)        | Phase: voting                         |
| Maya · Host · You  |                                       |
| Noah · Voted       | [0] [1] [2] [3] [5]                   |
| Linh · Not voted   | [8] [13] [21] [?]                     |
|                    |                                       |
|                    |   [Reveal estimates]  (Host only)     |
|                    | Results appear here after reveal      |
+--------------------+---------------------------------------+
```

Names and values are illustrative. Before reveal, the roster never shows other Participants' values. A player without an accepted vote stays `Not voted`, even if another client has a pending selection.

- Header: room code, copy-link action and connection feedback. Success says `Link copied`; failure says `Could not copy link. Select and copy the link.` and shows a selectable URL.
- Sidebar title is `Players`, a UI alias for Participant (see [glossary](../knowledge/glossary.md)). Rows show display name, Host/You annotation and vote status or value.
- Main panel: phase, card grid, the Host-only primary action, then Results after reveal.
- No avatars, custom scales, story title, chat or extra navigation.

## 3. Layout and styling contract

| Area | Desktop ≥1024px | Tablet 640–1023px | Narrow <640px |
|---|---|---|---|
| Page | 24px padding; max-width 1280px, centered | 16px padding | 12px padding |
| Room columns | Sidebar 220px, main minmax(0,1fr), gap 24px | Sidebar 180px, gap 16px | Single column: header, Players, main |
| Cards | 5 columns, gap 12px, max grid 760px | 3 columns, gap 12px | 3 columns, gap 8px |
| Card size | Fills cell; min-height 112px | 96px | 88px |
| Results | Wrapping compact metrics below cards | Wrap | Stack/wrap, no horizontal overflow |

Use normal page scrolling; do not force a 100vh container that clips controls. With 20 participants the main action stays reachable; names wrap rather than overlap status.

Visual tokens (targets, applied via Tailwind utilities): page `#FFFFFF`; cards/roster `#F1F3F4`; text `#263238`; secondary `#546E7A`; accent/selected `#455A64` with white text; error `#B3261E`; focus outline `#005FCC`. Body text ≥16px; card values about 32px; 4px rounding; no gradients or large shadows.

## 4. State and action matrix

Phases are `voting` and `revealed` only (D-006). Reveal and Revote are Host-only; Guests never see those controls (D-007).

| State | Participant experience | Host actions | Guest actions |
|---|---|---|---|
| Connecting/joining | Form retained, progress text, submit disabled | Wait/retry | Wait/retry |
| Voting, no selection | Cards enabled, other votes hidden | Vote; `Reveal estimates` | Vote; text `Waiting for Host to reveal.` |
| Vote pending | Selected card outlined, `Sending vote…` | Same | Same |
| Vote accepted | Selected card `aria-pressed=true`; status `Voted` | Change vote or reveal | Change vote |
| Vote send failed | Not shown as accepted; `Vote was not confirmed. Try again.` | Retry | Retry |
| Revealed | Cards disabled; roster shows values or `No vote`; Results shown | `Revote` | Read results; text `Waiting for Host to start a revote.` |
| Revote | All votes, selections and Results cleared; back to `voting` | Vote again | Vote again |
| Connection lost | Last view marked stale; voting and actions disabled; `Connection lost. Reconnecting…` | Same | Same |

Proposed (confirm in US-002 before implementation): Reveal with zero votes is blocked with `At least one vote is required to reveal`.

Pending, failure and reconnection feedback is target behavior; BA and Developer reconcile it with ACs and the transport before implementation. Do not invent a Host-disconnect detector with an arbitrary timer; react to observed transport status. Host closing the tab ends the room (brief). Reveal and Revote must be enforced by the domain rules, not only by hidden buttons. An icon alone never conveys selected, voted or error state.

## 5. Results contract — US-003

- After reveal, show each Participant's value; `No vote` for no accepted vote. `?` is a cast abstention, distinct from no vote.
- Show only `Average` and `Consensus` besides the per-Participant votes.
- Average excludes `?` (D-009). Consensus is `Yes` when there is at least one numeric vote and all numeric votes are equal; otherwise `No` (D-010).
- Proposed (D-015): Average to at most two decimals; with no numeric votes, Average and Consensus show `—`. Show `2 of 3 voted` to make participation explicit.
- Consensus is all numeric votes equal; the adjacency variant is out of scope (D-019).

## 6. Accessibility and selectors

- Native buttons and labeled inputs, logical keyboard order, visible focus and text feedback. Buttons and cards target at least 44×44px (project usability target, not a WCAG claim).
- Selected cards expose `aria-pressed`; Enter/Space activate them. Do not rely on fill color alone.
- Announce connection, copy and vote feedback politely; field errors link to inputs and expose alert feedback.
- After a phase action removes its trigger control, move focus to the phase heading or next primary control. Background roster updates must not steal focus.
- The story dev spec owns the selector table; this document owns visual and interaction intent. Do not duplicate selectors here.

## 7. Review checks

| Check | Evidence needed |
|---|---|
| UX-01 Reference composition | Screenshot at 1280×720: Players left, cards right, primary action below |
| UX-02 Responsive layout | Check at 768×1024 and 390×844; no clipped actions or horizontal overflow |
| UX-03 Role/phase rules | Host and Guest views in `voting` and `revealed`; Guest has no Reveal/Revote; controls match the matrix |
| UX-04 Vote selection | Keyboard and pointer; selected, pending, accepted and failed states distinguishable |
| UX-05 Errors/copy | AC messages, retained input, copy success and fallback |
| UX-06 Results/revote | Per-user values, no vote vs `?`, Average and Consensus; all cleared after Revote |
| UX-07 Accessibility | Labels, focus order, visible focus, pressed state, readable contrast |
| UX-08 Privacy | Separate network-boundary tests; screenshots or DOM alone cannot prove it (D-005) |

Capture only relevant states for a changed story. This document defines checks, not results.
