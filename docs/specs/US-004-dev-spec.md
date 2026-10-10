# US-004 Dev Spec: Vintage UI refresh

**Status:** Revision 2 (covers requirements rev 3). Implementation started on the mob's instruction to implement; this is recorded as the working approval of Q1 and Q6, which the mob must still confirm in the decisions table.

## Gate before production code
| Required artifact | State |
|---|---|
| [Requirements](../requirements/US-004-vintage-bootstrap-ui.md) | Exists; rev 3; Q1 and Q6 are treated as approved by the instruction to implement, not yet recorded as a decision |
| This spec | Exists |
| [Test cases](../test-cases/US-004-test-cases.md) | Exists; updated for AC-004-09..11 |

No e2e or static spec file is written for this story yet; Test owns them.

## Goal and non-goals
- Goal: apply one fixed vintage theme and fixed decorative imagery (Home illustration, ornamental dividers, panel corner ornaments, paper texture) to Home, Room shell, voting cards and Results using Tailwind theme tokens, inline SVG and CSS, with no behavior, copy or selector change.
- Non-goals: new libraries or CSS frameworks (Bootstrap dropped), theme switcher, dark mode, new copy, new layout, remote fonts or images, raster images, avatars, per-Participant or per-vote imagery, domain/realtime changes.
- Requirement: [US-004](../requirements/US-004-vintage-bootstrap-ui.md)
- Decisions: D-001, D-002 (Tailwind kept), D-005, D-006, D-007, D-011. Layout and state matrix stay as in [UI/UX](../design/ui-ux.md) sections 2-4.

## AC coverage
| AC | Planned implementation | Test case ID | Contradiction or assumption |
|---|---|---|---|
| AC-004-01 | `HomePage.tsx`: panels use `border-rule bg-panel`, inputs `bg-paper`, primary button `bg-accent` | TC-004-01, 02 | Assumed custom theme (Q3) |
| AC-004-02 | `RoomShell.tsx`, `VotingCards.tsx`, `ResultsPanel.tsx`: same tokens; header gets an ornamental divider, roster and Results get thin borders | TC-004-03, 04 | none |
| AC-004-03 | Tokens defined once in `src/index.css` `@theme`; components use token classes only, no arbitrary hex or `slate`/`white` classes | TC-004-05..08 | Palette values are targets (Q4) |
| AC-004-04 | Class and decoration-element changes only; no JSX text, role, `aria-*` or `data-testid` edits on existing elements; existing e2e untouched | TC-004-09..15, 32 | Verified by running unchanged e2e |
| AC-004-05 | Keep every existing layout class; decorations are `pointer-events-none`, positioned inside the existing flow; illustration is 64 px at narrow and 96 px from `sm` | TC-004-16..18, 35 | none |
| AC-004-06 | Selected: `aria-pressed` fill plus inner ring; pending: dashed border; failed: danger border; disabled: reduced opacity plus muted border; errors keep text | TC-004-19..23 | Ring is a non-color cue |
| AC-004-07 | Focus outline token on every control; contrast of token pairs measured before DONE; texture is a 4% ink dot pattern over `paper`, panels and cards are flat | TC-004-24..28, 36 | 4.5:1 is a target until measured |
| AC-004-08 | System serif stack; decorations are inline SVG and CSS only, no `url(`, no `@import`, no `<link>`, no `package.json` change | TC-004-29..31 | none |
| AC-004-09 | New `HomeIllustration` (inline SVG, `aria-hidden`) in the Home title block; `ornament-divider` under it; `ornate` class on both panels | TC-004-34 | Motif assumed (Q8) |
| AC-004-10 | `ornament-divider` after the Room header and on the Host-left screen; `ornate` on Players and Results panels; paper texture on `body`; cards untouched | TC-004-35 | none |
| AC-004-11 | Decorations are `aria-hidden` elements or CSS pseudo-elements with `pointer-events: none`; no text content; no state-dependent rendering | TC-004-37, 38 | none |

Conflict resolution: UI/UX section 3 visual tokens (`#455A64`, "no gradients or large shadows") are superseded by this theme; this story updates that section. The brief still lists "themes" and "avatars" as out of scope; the mob must record the exception under a new decision ID.

## File table
| File | Existing / new | Reason for change |
|---|---|---|
| `src/index.css` | Existing | `@theme` tokens; base layer (page background, text color, paper texture, heading font); `ornate` and `ornament-divider` component classes |
| `src/features/room/HomeIllustration.tsx` | New | Inline SVG playing-card motif, `aria-hidden`, colors from theme token classes |
| `src/features/room/HomePage.tsx` | Existing | Token classes; illustration beside the title; divider; `ornate` panels |
| `src/features/room/RoomShell.tsx` | Existing | Token classes; divider under the header and on Host-left; `ornate` roster |
| `src/features/room/VotingCards.tsx` | Existing | Card states with tokens and non-color cues; no decoration on cards |
| `src/features/room/ResultsPanel.tsx` | Existing | Panel and metric styling; `ornate` |
| `docs/design/ui-ux.md` | Existing | Replace section 3 visual tokens; add the decoration contract |
| `docs/knowledge/decisions.md` | Existing | Add a proposed decision for the theme and decoration exception under a new ID |

No change to `src/domain/`, `src/realtime/`, `src/types/`, `index.html`, `package.json` or `tests/`.

## Theme tokens (targets)
Defined in `src/index.css` under `@theme`; utilities such as `bg-paper` and `text-ink` follow from the names.

| Token | Target value | Use |
|---|---|---|
| `--color-paper` | `#F3E9D2` | Page background, input background, selected-card text |
| `--color-panel` | `#EADCBC` | Roster, panels, unselected cards |
| `--color-ink` | `#3E2C23` | Body text |
| `--color-ink-muted` | `#6B5646` | Secondary text |
| `--color-accent` | `#7A2E1D` | Primary buttons, selected card, pending border |
| `--color-danger` | `#9B1C1C` | Errors |
| `--color-focus` | `#1F4E79` | Focus outline |
| `--color-rule` | `#8A6F4D` | Borders |
| `--font-display` | `Georgia, "Times New Roman", serif` | h1-h3 and card values |

Body font stays the existing sans stack for form legibility. The page texture is a 4% ink dot pattern (`color-mix` of `--color-ink` and transparent) in `body` `background-image`; panels, cards and inputs keep flat fills. Values are proposals; the mob can change them, and contrast of ink/paper, ink-muted/panel, paper/accent and danger/paper must be measured and recorded in the dev review.

## Decoration contract (AC-004-09..11)
| Element | Implementation | Accessibility |
|---|---|---|
| Home illustration | `HomeIllustration.tsx`: inline SVG of three fanned cards and a spade shape; `h-16 w-16` at narrow, `sm:h-24 sm:w-24`; classes `fill-panel stroke-rule text-accent` | `aria-hidden="true"`, `focusable="false"`, no `<title>` |
| Ornamental divider | `<div aria-hidden="true" className="ornament-divider">`; double rule with a center diamond from `::before`/`::after` | Not focusable, no text, `pointer-events: none` |
| Panel corners | `ornate` class: inset frame (`::before`) and four corner dots (`::after`), `pointer-events: none`, inside the existing 12-16 px padding | Pseudo-elements carry no content |
| Paper texture | `body` `background-image` dot pattern | CSS only |

Cards, inputs, buttons and text never get a decorative background. No decoration depends on room state, role or votes.

## Data and message shapes
None. No change to room state, intents or views.

## State transitions
None. Reveal/Revote Host-only enforcement stays in the domain; this story must not add or remove any control.

## UI contract
Selectors are unchanged and owned by the earlier specs; this story must leave them intact.

| Element | Role and accessible name | data-testid | Exact message |
|---|---|---|---|
| Home title / subtitle | heading `Story Pointing` | none | `Estimate together, without signing up.` |
| Create / Join forms | labeled `Display name`, `Room code`; buttons `Create room`, `Join room` | `connection-status`, `form-error` | existing US-001 messages |
| Room code | text | `room-code` | none |
| Players | heading `Players (n)` | `players-list`, `player-vote` | `Voted`, `Not voted`, `No vote` |
| Phase | heading `Phase: <phase>` | `phase-heading`, `room-phase`, `phase-waiting` | `Waiting for Host to reveal.`, `Waiting for Host to start a revote.` |
| Cards | group `Voting cards`; buttons `0`..`?` with `aria-pressed` and `data-selection` | `vote-cards`, `vote-status`, `vote-error` | `Sending vote…`, `Vote was not confirmed. Try again.` |
| Host actions | buttons `Reveal estimates`, `Revote` | `reveal-error` | `At least one vote is required to reveal` |
| Results | heading `Results` | `results-panel`, `results-heading`, grouped result rows, `results-participation` | `<n> vote` / `<n> votes`; `<n> of <m> voted` |
| Copy link | button `Copy link`, input `Room link` | none | `Link copied`, `Could not copy link. Select and copy the link.` |
| Host-left | alert, button `Return to Home` | none | `The Host closed the room. Return to Home to start or join another room.` |
| Decorations | none (hidden from assistive tech) | none | none; no new accessible names, roles or tab stops |

## Failure and recovery
- Failure cases: low contrast, lost focus ring, layout shift from changed border widths, a missed hex color leaving mixed palettes, decoration overlapping content, images failing to load.
- Recovery: class-only changes are reverted per file; tokens are in one place; decorations are inline or CSS so they cannot fail to load.
- Privacy and lifecycle boundaries affected: none.

## Implementation tasks
| # | Task | Test level | Command |
|---|---|---|---|
| 1 | Add tokens and base layer to `src/index.css` | build | `npm run build` |
| 2 | Restyle `HomePage.tsx` | e2e | `npm run test:e2e` |
| 3 | Restyle `RoomShell.tsx` and Host-left screen | e2e | `npm run test:e2e` |
| 4 | Restyle `VotingCards.tsx` states | e2e | `npm run test:e2e` |
| 5 | Restyle `ResultsPanel.tsx` | e2e | `npm run test:e2e` |
| 5a | Add `ornate`, `ornament-divider` and texture to `src/index.css`; add `HomeIllustration.tsx`; wire decorations into Home, Room, Host-left and Results | e2e | `npm run build`, `npm run test:e2e` |
| 6 | Search for remaining arbitrary hex, `slate-`, `gray-`, `bg-white`, `text-white` in `src/` | static | grep |
| 7 | Run unit tests (must be unchanged) | unit | `npm test` |
| 8 | Measure contrast and capture screenshots (1280x720, 768x1024, 390x844) | manual evidence | n/a |
| 9 | Update UI/UX section 3; add a proposed decision under a new ID; write `docs/reviews/US-004-dev-review.md` | docs | n/a |

## Open decisions
- Q1 themes and Q6 avatars/illustration out of scope: mob, worked on as approved by the instruction to implement; must be recorded under a new decision ID.
- Q3 template source, Q4 final palette, Q5 image budget, Q7 asset source, Q8 motif: mob/Developer, non-blocking.

## Handoff to Test
- Story: US-004; spec: this file; cases: [US-004-test-cases.md](../test-cases/US-004-test-cases.md).
- Cases needed for AC-004-01..11 exist. Priority risk: unchanged e2e suites for US-001..US-003 as the regression proof for AC-004-04, viewport and overlap checks for AC-004-05/10, contrast over texture for AC-004-07, decoration accessibility for AC-004-11.
- Write `tests/e2e/US-004.spec.ts` and `src/features/room/theme.static.test.ts`, then run all checks.
