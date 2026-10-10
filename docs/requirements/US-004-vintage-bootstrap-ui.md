# US-004: Vintage UI refresh

**Status:** Accepted by the mob 2026-10-10; presentation-only. Revision 2: Bootstrap dropped; the theme is built with the current Tailwind setup (D-002). Revision 3: adds decorative imagery and page decoration (AC-004-09..11; changed lines marked `rev 3`).

## Story
As a Participant, I want the Home and Room screens to use a consistent vintage look with decorative images and ornaments, so that the app feels polished and easy to scan without changing how estimation works.

- MVP feature: none. Presentation-only change across US-001, US-002 and US-003 screens ([product brief](../product-brief.md)).
- Brief success criteria: 1-6 must still hold unchanged (regression guard).
- Decisions: D-001 (Accepted), D-002 (Accepted, Tailwind kept), D-005 (Accepted), D-006 (Accepted), D-007 (Accepted), D-011 (Accepted), D-026 (Accepted, one fixed vintage theme; its "fixed" part is superseded by D-027 in US-005). Brief "Out of scope: themes" is lifted for this story by D-026 (Q1).

## Scope
**In scope**
- Restyle Home (Create room, Join room, Host-left screen) and the Room shell (header, Players roster, card grid, phase text, Reveal/Revote action, Results, connection feedback) with one vintage theme using Tailwind utilities and Tailwind theme tokens only.
- One fixed theme: warm paper background, ink-brown text, muted brick/sepia accent, serif headings, thin rule borders. No theme switcher.
- (rev 3) Decorative imagery shared by all Participants: a Home illustration (vintage playing-card motif), an ornamental divider under page titles and headers, subtle corner ornaments on panels, and a faint paper texture on the page background. All are static, authored in the repo (SVG or CSS) and identical for every Participant.
- Theme tokens documented in [UI/UX](../design/ui-ux.md) as a replacement for section 3 visual tokens once approved.

**Out of scope**
- Any change to rules, phases, copy, roles, validation, realtime or transport behavior.
- Avatars and any per-Participant or per-vote image (brief: avatars out of scope), photos, user uploads, illustrations that depict room state, custom scales, dark mode, theme switching, new animations, localization. (rev 3: illustrations are in scope only as the fixed decorations listed above.)
- New screens, navigation, story title, chat, timers.
- Adding any UI library or CSS framework (including Bootstrap) or a pre-built template package.

## Acceptance criteria
Keep AC IDs stable when revising. Each AC has an observable result. Cross-Participant checks use separate Host and Guest browser contexts.

### AC-004-01 Home uses the vintage style
- **Given** a visitor opens Home
- **When** the page renders
- **Then** `Create room` and `Join room` are shown as two bordered paper-tone panels, each with labeled inputs and a sepia/brick primary button
- **And** the page title `Story Pointing` and subtitle `Estimate together, without signing up.` are unchanged

### AC-004-02 Room shell uses the vintage style
- **Given** a Participant is in a room
- **When** the Room shell renders
- **Then** the header (room code, copy-link action, connection feedback), the Players roster with `Players (n)` title, the card buttons, the phase action and Results all use the vintage theme
- **And** the Room shell keeps the structure in [UI/UX section 2](../design/ui-ux.md)

### AC-004-03 One vintage theme applied everywhere
- **Given** any screen or state in the [UI/UX state matrix](../design/ui-ux.md)
- **When** it renders
- **Then** it uses the same theme tokens: paper-tone page background, ink-brown text, one sepia/brick accent for primary actions and selected cards, a muted red for errors, and a serif font stack for headings
- **And** no screen mixes the previous palette (`#455A64` and related) with the vintage palette

### AC-004-04 Behavior and copy unchanged
- **Given** the restyled UI
- **When** a Participant runs create > join > vote > reveal > revote > reveal
- **Then** every visible message, label and error keeps its exact current text (US-001..US-003 ACs)
- **And** a Guest still has no Reveal or Revote control (D-007) and before reveal other Participants' values are never shown (D-005)
- **And** the existing Playwright selectors from the dev specs resolve without edits to the e2e tests

### AC-004-05 Layout contract preserved
- **Given** viewports of 1280x720, 768x1024 and 390x844
- **When** Home and Room render
- **Then** the column counts, card grid (5 / 3 / 3 columns), sidebar widths and padding follow [UI/UX section 3](../design/ui-ux.md)
- **And** there is no horizontal overflow and no clipped action
- **And** (rev 3) decorative images and ornaments do not change those measurements, cause overflow, or overlap text, fields, cards or buttons

### AC-004-06 State distinction beyond color
- **Given** card, roster and feedback states: selected, pending (`Sending vote…`), accepted (`Voted`), failed (`Vote was not confirmed. Try again.`), disabled (revealed or `Connection lost. Reconnecting…`), field error
- **When** each state renders
- **Then** each is distinguishable by text, border style or `aria-pressed`/`aria-disabled`, not by color alone
- **And** a disabled card is visibly distinct from an enabled one

### AC-004-07 Accessibility is not reduced
- **Given** the vintage theme
- **When** keyboard and visual checks run
- **Then** body text and button text meet a contrast ratio of at least 4.5:1 against their backgrounds, and focus outlines are visible on every interactive element
- **And** buttons and cards keep a touch target of at least 44x44 px
- **And** field errors remain linked to inputs with alert feedback
- **And** (rev 3) the 4.5:1 ratio is met for text that sits over or next to the paper texture and ornaments, measured at the lowest-contrast point of the background behind the text

### AC-004-08 No new dependency or remote asset
- **Given** the app is loaded from the Vercel build
- **When** the page renders with no access to third-party CDNs
- **Then** all styles and fonts still apply, using the existing Tailwind build and a system serif font stack (no remote font or CDN request)
- **And** `package.json` gains no new UI dependency
- **And** (rev 3) every image and ornament is served from the app's own build output (no remote image, CDN or hot-linked asset), and every asset is created for this project or has a recorded permissive license

### AC-004-09 Home decoration (rev 3)
- **Given** a visitor opens Home
- **When** the page renders
- **Then** the Home illustration is shown once near the title, and an ornamental divider appears under the title block
- **And** the Create room and Join room panels show corner ornaments
- **And** at 390 px width the illustration scales down or is hidden, and the forms stay above the fold of scrolling: `Create room` stays reachable without horizontal scrolling

### AC-004-10 Room decoration (rev 3)
- **Given** a Participant is in a room in any phase
- **When** the Room shell renders
- **Then** the header has the ornamental divider and the page background shows the paper texture
- **And** the Players panel, voting area and Results panel keep their content, order and layout from [UI/UX section 2](../design/ui-ux.md); decoration appears only in borders, corners, the header and the page background
- **And** card faces show only the card value, with no image or ornament behind or beside the value that changes its legibility
- **And** the Host-left screen uses the same decoration and its message stays the first alert text

### AC-004-11 Decoration is non-informational (rev 3)
- **Given** any screen with decorative images or ornaments
- **When** assistive technology, keyboard or pointer interacts with the page
- **Then** every decorative image is hidden from assistive technology (`alt=""` or `aria-hidden="true"`, or CSS background) and has no accessible name, role or tab stop
- **And** decoration does not intercept clicks or text selection on controls (`pointer-events` do not block any input, button or card)
- **And** no image or ornament conveys vote status, phase, Host role, Participant identity or any value; the same Participant states are readable without images
- **And** with images failing to load or blocked, all content, labels and actions are still shown and usable

## Input validation
No new input rules. Existing field rules and exact messages in US-001 are unchanged.

## Business rules
1. This story changes presentation only; no business rule, decision or AC text from US-001..US-003 changes.
2. Reveal/Revote authority, vote privacy (D-005) and phase rules (D-006) are enforced by domain code, not by styling.
3. Results semantics follow US-003: accepted votes are grouped by card value with numeric values ascending, `?` last, no-vote excluded, and a simple horizontal bar per group; participation is shown as `<voted> of <participants> voted`. This story restyles their presentation only.
4. (rev 3) Imagery is decoration only. It is the same for every Participant, never depends on room state or votes (D-005), never replaces text, and adds no avatar or Participant-specific graphic.

## Traceability
| AC | Brief success criterion | Decision ID |
|---|---|---|
| AC-004-01 | 1, 4 | D-002 |
| AC-004-02 | 1, 4, 5 | D-002, D-006 |
| AC-004-03 | none (presentation) | D-002 |
| AC-004-04 | 2, 3, 4, 5 | D-005, D-007 |
| AC-004-05 | 4 | none |
| AC-004-06 | 2 | D-005, D-011 |
| AC-004-07 | none (UI/UX section 6) | none |
| AC-004-08 | 6 | D-013 |
| AC-004-09 | 1 | D-002 |
| AC-004-10 | 2, 4, 5 | D-002, D-005, D-006 |
| AC-004-11 | 2, 3 | D-005, D-007 |

## Dependencies
- US-001, US-002, US-003 implemented behavior and selector maps in their dev specs.
- Mob decision to lift the brief's "themes" exclusion for one fixed theme.
- (rev 3) Decision on the brief's out-of-scope list for avatars: decoration here is non-Participant imagery only (Q6).
- (rev 3) Dev spec and test cases are out of date for AC-004-09..11 and the rev 3 lines of AC-004-05, 07, 08; the Developer and Test owners must sync them.
- [UI/UX](../design/ui-ux.md) section 3 visual tokens (including "no gradients or large shadows") to be superseded by the vintage tokens after approval.

## Open questions and assumptions
| # | Question or assumption | Type | Status |
|---|---|---|---|
| Q1 | The brief lists "themes" as out of scope. Does the mob accept one fixed vintage theme as a scope change? Recommend yes, as a single fixed theme, no switcher. | question | Accepted by the mob 2026-10-10 (recommended default: one fixed vintage theme, no switcher; D-026) |
| Q2 | Bootstrap vs Tailwind. | question | Resolved: keep current Tailwind (D-002); Bootstrap dropped |
| Q3 | "Vintage template" is not a specific file in the repo. Assumed: a custom vintage theme expressed as Tailwind theme tokens, sepia palette. A named template would be only a visual reference. | reversible assumption | Accepted by the mob 2026-10-10 (recommended default) |
| Q4 | Exact palette and serif font stack are defined by Developer/mob in the spec; target only: paper background, ink-brown text, sepia/brick accent, contrast at least 4.5:1. | reversible assumption | Open |
| Q5 | (rev 3) Image budget: how much extra weight is acceptable for decorations? Assumed: SVG or CSS only, no raster photos, so the build stays small; no number is set until the mob gives one. | reversible assumption | Open |
| Q6 | (rev 3) The brief excludes "avatars"; illustration and ornaments are not named there. Does the mob accept fixed, non-Participant decoration? Recommend yes; related to Q1. | question | Open, blocks start |
| Q7 | (rev 3) Who supplies the images? Assumed: authored in the repo as inline SVG or CSS; no stock or third-party artwork, so no license issue. If the mob wants specific artwork, it must supply it with its license. | reversible assumption | Open |
| Q8 | (rev 3) Subject of the Home illustration. Assumed: a vintage playing-card/poker-card motif unrelated to any Participant or vote value. | reversible assumption | Open |

## Review
- INVEST check: Small and independent of rules, but touches every screen; if too large, slice by screen (Home first, then Room shell) keeping AC IDs.
- Material issues: Q1 and Q6 contradict or touch the brief's out-of-scope list and block the dev spec until the mob decides. Accessibility and contrast values are targets, not measured results. (rev 3) Decoration raises the contrast and overflow risk, so AC-004-05, 07 and 11 now state those limits explicitly.
