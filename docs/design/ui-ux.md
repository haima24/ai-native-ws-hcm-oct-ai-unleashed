# UI/UX — Story Pointing

Architecture: see the [solution architecture document](sad.md).

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
- Show field validation beside the field using the exact US-001 messages (`Enter a display name.`, `Display name must be 20 characters or fewer.`, `That name is already taken in this room.`, `Enter the room code.`, `Room code must be 6 letters or digits.`), not generic toasts. Field errors are linked to the input and expose alert feedback.
- Form-level errors appear above the submit button of the form that was submitted: `Room not found or unreachable. Check the code and try again.` (AC-001-11) and `Could not connect in time. Try again.` (AC-001-08).
- While connecting, disable duplicate submission and show `Connecting…`; keep typed input on failure. Limits: create 10 s, join 5 s (baselines, not measured).
- Room code input is trimmed and upper-cased; a share link prefills it and leaves `Display name` empty and never auto-joins (AC-001-03). After a Guest reload, Home shows the last room code and display name prefilled; no automatic rejoin.
- Host-left screen (AC-001-10): replaces the Room shell content with `The Host closed the room. Return to Home to start or join another room.` and a button returning to Home; the Players list is not shown as live.

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
- Players roster: `Players (n)` count matches the number of rows; the same names appear for every Participant within 2 s of a join (AC-001-04) and a Participant who leaves disappears (AC-001-09). A Guest joining mid-round shows `Not voted`.
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

Note: the colors below are superseded by US-004/US-005 and D-026/D-027 (vintage default plus five selectable themes).

Visual tokens (US-004, vintage theme; proposed D-024) are defined once in `src/index.css` under `@theme` and used as Tailwind utilities: `paper` `#F3E9D2` (page, inputs), `panel` `#EADCBC` (roster, panels, cards), `ink` `#3E2C23` (text), `ink-muted` `#6B5646`, `accent` `#7A2E1D` (primary actions, selected card), `danger` `#9B1C1C`, `focus` `#1F4E79` (outline), `rule` `#8A6F4D` (borders); headings and card values use a system serif stack. Body text >=16px; card values about 32px; 4px rounding. Contrast of text pairs targets 4.5:1 and is measured in the story review, not assumed.

Decoration (US-004 AC-004-09..11): a Home card-motif illustration, an ornamental divider under the Home title block and the Room header, corner ornaments on panels, and a faint paper texture. Decoration is inline SVG or CSS, identical for every Participant and state, hidden from assistive technology, never behind card values or text, and never blocks pointer input. No avatars or per-Participant imagery.

Themes (US-005; proposed D-025): the `Theme` picker offers Vintage (default), Light, Dark, Ocean, Sunny and Forest with a text name and icon each. It sits in the Room header on its own row and below the divider on Home. Each theme overrides the eight color tokens above in `src/index.css` under `:root[data-theme="<id>"]` and sets its own illustration, icon and ornament style. The choice is local to the browser (`localStorage`), applied before first paint, and never sent to other Participants. The values per theme are in the [US-005 dev spec](../specs/US-005-dev-spec.md).

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
| Host left (Guest only) | Room ended: message `The Host closed the room. Return to Home to start or join another room.` and a return-to-Home button; no live Players list | n/a (Host tab closed or reloaded; reloaded Host starts at Home) | Return to Home |

Accepted (D-021): Reveal with zero votes is blocked with `At least one vote is required to reveal`.

Pending, failure and reconnection feedback is target behavior; BA and Developer reconcile it with ACs and the transport before implementation. Do not invent a Host-disconnect detector with an arbitrary timer; react to observed transport status. Host closing the tab ends the room (brief). Reveal and Revote must be enforced by the domain rules, not only by hidden buttons. An icon alone never conveys selected, voted or error state.

## 5. Results contract — US-003

- After reveal, show each Participant's value; `No vote` for no accepted vote. `?` is a cast abstention, distinct from no vote.
- Show grouped counts of accepted votes by card value, excluding Participants without an accepted vote. A cast `?` is its own group.
- Order numeric card values from lowest to highest and place `?` last (D-025).
- Each group row shows the card label, a simple horizontal bar, and the exact count text `<n> vote` when the count is 1 or `<n> votes` otherwise (D-025).
- Show `<voted> of <participants> voted` using the current Players roster; an accepted `?` counts as a vote (D-022).

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
| UX-06 Results/revote | Per-user values, no vote vs `?`, grouped counts and participation; all cleared after Revote |
| UX-07 Accessibility | Labels, focus order, visible focus, pressed state, readable contrast |
| UX-08 Privacy | Separate network-boundary tests; screenshots or DOM alone cannot prove it (D-005) |

Capture only relevant states for a changed story. This document defines checks, not results.
