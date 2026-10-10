# US-005: Theme selection with themed imagery

**Status:** Draft, blocked on mob decision (Q1, Q2, Q3). Not part of the 3 MVP features. Do not start the spec or code until the mob approves the scope change.

## Story
As a Participant, I want to choose a theme (Light, Dark, Ocean, Sunny, Forest, or the existing Vintage) with matching images and icons, so that the app is comfortable and pleasant for me to use without changing how estimation works for anyone else.

- MVP feature: none. Presentation-only extension of [US-004](US-004-vintage-bootstrap-ui.md) across US-001, US-002 and US-003 screens ([product brief](../product-brief.md)).
- Brief success criteria: 1-6 must still hold unchanged (regression guard).
- Decisions: D-002 (Accepted, Tailwind kept), D-003 (Accepted), D-004 (Accepted), D-005 (Accepted), D-007 (Accepted), D-011 (Accepted), D-024 (Proposed, one fixed vintage theme; this story would supersede its "fixed" part). Brief "Out of scope: themes, avatars" is affected (Q1).

## Scope
**In scope**
- Six selectable themes: Vintage (existing from US-004), Light, Dark, Ocean, Sunny, Forest.
- A theme picker on Home and in the Room header, with visible text names.
- Per theme: a colour palette, a Home illustration, an ornament style for dividers and panel corners, and a small icon set (picker option icon and heading markers) that fits the theme (for example Ocean: waves, anchor; Sunny: sun; Forest: tree, leaf; Dark: moon, stars; Light: clean card motif; Vintage: playing-card motif).
- The choice is local to this device and Participant; it is remembered across reloads and later rooms.

**Out of scope**
- A room-wide or Host-controlled theme; any realtime message, roster field or share-link parameter carrying the theme (Q3).
- Automatic theme from the operating system setting, scheduled themes, user-made themes, custom colours.
- Avatars and any per-Participant or per-vote image, photos, uploads, animations, sound, localization.
- Icon libraries, web fonts, remote or raster images, new libraries or frameworks.
- Any change to rules, phases, copy (except the one status message below), roles, validation or transport behavior.

## Acceptance criteria
Keep AC IDs stable when revising. Each AC has an observable result. Cross-Participant checks use separate Host and Guest browser contexts.

### AC-005-01 Theme picker
- **Given** a visitor is on Home or a Participant is in a room
- **When** the page renders
- **Then** a control labeled `Theme` offers exactly six choices with visible text names in this order: `Vintage`, `Light`, `Dark`, `Ocean`, `Sunny`, `Forest`
- **And** the current choice is indicated by text or `aria-checked`/selected state, not by colour alone
- **And** the control is reachable by keyboard in the header order, operable with keyboard and pointer, has a visible focus indicator, and each choice shows its theme icon next to the name
- **And** the picker is at least 44x44 px per choice target and does not cover or move the existing header content (room code, `Copy link`)

### AC-005-02 Switch applies immediately and changes nothing else
- **Given** a Participant is on Home or in a room in any phase
- **When** they choose a different theme
- **Then** the whole page uses the new theme at once, without a page reload
- **And** the status `Theme set to <name>.` is announced politely (for example `Theme set to Ocean.`)
- **And** room state is unchanged: roster, phase, own selected card, pending vote, `Voted`/`Not voted` rows, Results, typed form input and focus position (focus stays on the picker)
- **And** no realtime message is sent because of the switch

### AC-005-03 Choice is remembered and local
- **Given** a Participant has chosen a theme
- **When** they reload the page, return to Home, or join or create another room on the same browser
- **Then** the same theme is applied, and it is applied before the first screen is visible (no visible flash of another theme)
- **And** with no stored choice the theme is `Vintage`
- **And** a stored value that is not one of the six themes is ignored and `Vintage` is used, with no error message
- **And** when storage is unavailable the picker still works for the current page view and no error is shown
- **And** one Participant's choice never changes another Participant's theme: a Host switching to `Dark` leaves a Guest's theme as it was
- **And** the theme is not in the share link, the roster or any message to other Participants (D-005)

### AC-005-04 Every theme is complete and readable
- **Given** each of the six themes
- **When** any screen or state in the [UI/UX state matrix](../design/ui-ux.md) renders (Home, Room `voting`, `revealed`, Host-left, field errors, failed vote, disabled cards)
- **Then** it uses only that theme's colours; no colour from another theme or from the pre-US-004 palette remains
- **And** body text, button text and error text meet a contrast ratio of at least 4.5:1 against their backgrounds, and focus outlines are visible, in every theme
- **And** selected, pending, failed and disabled cards, and field errors, stay distinguishable by text, border style or `aria-pressed`/`disabled`, not by colour alone, in every theme

### AC-005-05 Themed images and icons
- **Given** each of the six themes
- **When** Home and the Room shell render
- **Then** Home shows that theme's own illustration once near the title, and the dividers and panel corner ornaments use that theme's ornament style
- **And** `Create room`, `Join room`, `Players` and `Results` headings show that theme's icon next to the unchanged heading text, and the picker shows each theme's icon next to its name
- **And** the illustrations and icons of different themes are visibly different, and each matches its theme (Vintage: playing cards; Light: clean minimal card motif; Dark: moon and stars; Ocean: waves and anchor; Sunny: sun; Forest: tree and leaf)
- **And** card faces show only the card value; no image or icon is behind or beside a value in a way that changes its legibility

### AC-005-06 Decoration is non-informational
- **Given** any theme
- **When** assistive technology, keyboard or pointer interacts with the page
- **Then** every decorative image and icon is hidden from assistive technology (`aria-hidden="true"` or CSS background) with no accessible name, role or tab stop
- **And** images and icons never intercept clicks or text selection on controls
- **And** no image or icon conveys vote status, phase, Host role, Participant identity or any value, and decoration is identical for all roles, phases and vote states within a theme (D-005, D-007)
- **And** the picker choices are named by their text, so removing every icon leaves all labels, messages and actions usable

### AC-005-07 Behavior, copy and selectors unchanged
- **Given** any theme
- **When** a Participant runs create > join > vote > reveal > revote > reveal
- **Then** every visible message, label and error keeps its exact current text (US-001..US-003 ACs, AC-004-04) except the picker and the AC-005-02 status
- **And** a Guest still has no Reveal or Revote control (D-007) and before reveal other Participants' values are never shown (D-005)
- **And** existing `data-testid` values, roles and labels resolve without edits to the existing e2e tests

### AC-005-08 Layout preserved in every theme
- **Given** viewports of 1280x720, 768x1024 and 390x844 and each theme
- **When** Home and Room render
- **Then** column counts, card grid (5 / 3 / 3 columns), sidebar widths and padding follow [UI/UX section 3](../design/ui-ux.md) and the AC-004-05 baseline
- **And** there is no horizontal overflow, no clipped action, and no image, icon or the picker overlapping text, fields, cards or buttons; at 390 px the picker wraps below the title rather than overflowing

### AC-005-09 No new dependency or remote asset
- **Given** the app is loaded from the Vercel build with third-party origins blocked
- **When** the page renders in each theme
- **Then** all themes, illustrations and icons still render, using only the existing Tailwind build, inline SVG and CSS shipped with the app
- **And** `package.json` gains no icon, UI or font dependency, and no raster image, remote font or CDN reference is added

## Input validation
| Field | Rule | Exact error message (if specified) |
|---|---|---|
| Theme choice | One of the six names only; no free input | none; an invalid stored value silently falls back to `Vintage` (AC-005-03) |

## Business rules
1. Theme is a presentation preference of one Participant on one browser; it has no effect on room state, other Participants or results.
2. Theme never travels over the realtime channel, is not in the URL, and is not stored by any server (D-003, D-004, D-005).
3. Reveal/Revote authority, vote privacy and phase rules are enforced by domain code, not by styling (D-005, D-006, D-007).
4. The default theme is `Vintage`. No theme is chosen by operating-system settings.
5. Imagery is decoration only and the same for every Participant in a theme; it never replaces text.
6. Results semantics (Average excluding `?`, Consensus, `—` when empty, `<voted> of <participants> voted`) are unchanged in every theme.

## Traceability
| AC | Brief success criterion | Decision ID |
|---|---|---|
| AC-005-01 | none (presentation) | D-002, D-024 |
| AC-005-02 | 4 | D-003, D-004 |
| AC-005-03 | 2, 3 | D-005 |
| AC-005-04 | 2 | D-002, D-011 |
| AC-005-05 | none (presentation) | D-002, D-024 |
| AC-005-06 | 2, 3 | D-005, D-007 |
| AC-005-07 | 2, 3, 4, 5 | D-005, D-007 |
| AC-005-08 | 4 | none |
| AC-005-09 | 6 | D-013, D-017 |

## Dependencies
- [US-004](US-004-vintage-bootstrap-ui.md): its Vintage theme, token structure, decoration approach and AC-004-04..08 expectations carry into every theme. When this story is approved, the US-004 lines "no theme switcher", "dark mode" and "one fixed theme" must be updated by BA to point here.
- US-001..US-003 implemented behavior and selector maps in their dev specs.
- Mob decision on Q1, Q2, Q3; D-024 to be superseded by a new decision for selectable themes.
- [UI/UX](../design/ui-ux.md) section 3 visual tokens to be restructured per theme after approval.

## Open questions and assumptions
| # | Question or assumption | Type | Status |
|---|---|---|---|
| Q1 | The brief lists "themes" and "avatars" as out of scope and US-004 says one fixed theme. Does the mob accept selectable themes with themed imagery as a scope change? Recommend yes, limited to the six named themes and decoration only. | question | Open, blocks start |
| Q2 | Keep Vintage as the default sixth theme, or replace it with Light as the default? Assumed: keep Vintage as the default and add the five requested; "more template" suggests adding. | question | Open |
| Q3 | Is the choice per Participant on their own device, or should the Host set one theme for the whole room? Recommend per Participant: a room-wide theme needs a new Host intent and a protocol change, which is a separate story. | question | Open, blocks start |
| Q4 | Storage of the choice: assumed browser `localStorage` (persists across sessions, not sensitive, never sent anywhere). The display name uses `sessionStorage`; use that instead if the mob wants the theme to reset per tab. | reversible assumption | Open |
| Q5 | Spelling: the request says "Forrest"; assumed `Forest`. | reversible assumption | Open |
| Q6 | Images and icons are authored in the repo as inline SVG or CSS, one illustration and one small icon set per theme; no stock art, no icon library (so no license issue). If the mob wants specific artwork, it must supply it with its licence. | reversible assumption | Open |
| Q7 | Exact palettes, illustrations and ornament styles are chosen by the Developer in the spec within the AC limits (4.5:1 contrast, non-colour cues). | reversible assumption | Open |
| Q8 | No OS dark-mode detection and no picker on the Host-left screen (it shows the current theme only). | reversible assumption | Open |
| Q9 | Image budget (extra bytes for six illustrations and icon sets): no limit is set until the mob gives a number. | reversible assumption | Open |

## Review
- INVEST check: Larger than one slice (picker and persistence, five palettes, five illustrations and icon sets). Suggested slicing keeping AC IDs: (1) picker, persistence and Light/Dark palettes (AC-005-01..04, 07..09), (2) Ocean, Sunny, Forest palettes, (3) themed illustrations and icons (AC-005-05, 06). Each slice must pass the full AC-005-04 contrast check for the themes it ships.
- Material issues: Q1 and Q3 contradict the brief's out-of-scope list and block the spec. Contrast and overflow values are targets, not measured results. AC-005-03 "no flash of another theme" depends on how the theme is applied at load; the Developer must confirm feasibility in the spec.
