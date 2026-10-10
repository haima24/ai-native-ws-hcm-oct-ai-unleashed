# US-005 Dev Spec: Theme selection with themed imagery

**Status:** Implemented on the mob's explicit instruction to implement, which overrides the gate below. Q1 and Q3 are treated as approved with the recommended answers; the test cases are still missing. See [dev review](../reviews/US-005-dev-review.md).

## Gate before production code
| Required artifact | State |
|---|---|
| [Requirements](../requirements/US-005-theme-selection.md) | Exists; Draft; Q1 (brief excludes themes/avatars) and Q3 (per Participant or room-wide) not decided by the mob |
| This spec | Exists |
| `docs/test-cases/US-005-test-cases.md` | Missing; owner: Test |

Implementation was started before the gate was met, at the mob's request. This spec assumes the recommended answers: six themes, decoration only, choice is per Participant and local (Q3), default Vintage (Q2).

## Goal and non-goals
- Goal: a `Theme` picker (Vintage, Light, Dark, Ocean, Sunny, Forest) that switches palette, Home illustration, ornament style and icon at once, remembered on this device, with no effect on room state or other Participants.
- Non-goals: room-wide or Host-set theme, any realtime message or URL parameter for theme, OS theme detection, custom themes, icon libraries, web fonts, raster or remote images, avatars, new animations, changes to rules, copy (except the picker and status message), roles or transport.
- Requirement: [US-005](../requirements/US-005-theme-selection.md)
- Decisions: D-002 (Tailwind kept), D-003, D-004, D-005, D-007, D-011; D-024 (Proposed) is superseded by a new decision for selectable themes (proposed D-025, mob to accept).

## Design summary
- A theme is a set of CSS custom properties. The default theme (Vintage) stays in `@theme` in `src/index.css`; each other theme overrides the same `--color-*` tokens under `:root[data-theme="<id>"]`. Components keep using token utilities (`bg-paper`, `text-ink`, `bg-accent`, ...), so no component classes change per theme.
- The active theme id is `document.documentElement.dataset.theme`. Vintage is the absence of the attribute or `vintage`.
- A tiny module store (`themeStore`) holds the current theme, writes the attribute and `localStorage`, and notifies subscribers. React reads it with `useSyncExternalStore`, so Home and Room share one source and nothing is threaded through props.
- To avoid a flash of the default theme, an inline script in `index.html` `<head>` sets `data-theme` from storage before the bundle loads. No `vercel.json` or CSP exists, so an inline script is allowed; a unit test keeps its id list equal to `THEMES`.
- Illustrations and icons are inline SVG components that read the current theme; their colors come from the token classes (`fill-panel stroke-rule text-accent`), so only the artwork shape differs per theme.
- Ornament style per theme comes from CSS variables (`--divider-line`, `--divider-mark-radius`, `--ornate-frame-style`, `--ornate-dot`, `--ornate-radius`) used by `.ornament-divider` and `.ornate`.

## AC coverage
| AC | Planned implementation | Test case ID (added after Test designs cases) | Contradiction or assumption |
|---|---|---|---|
| AC-005-01 | `ThemePicker.tsx`: `fieldset` with legend `Theme`, six radio inputs (visually hidden) each in a `label` with icon and text; native arrow-key behavior; `min-h-11`; selected shown by `checked` plus a visible border and a check-free text style | pending Test | Radio group chosen over a `<select>` because icons must show beside names |
| AC-005-02 | `setTheme` updates the store and attribute only; picker renders `<p role="status">Theme set to {name}.</p>`; no import from `src/realtime/` | pending Test | Status text is new copy defined by the AC |
| AC-005-03 | `themeStore` reads `localStorage` key `story-pointing:theme`, validates with `isTheme`, falls back to `vintage`; `try/catch` around storage; inline head script for first paint | pending Test | Storage choice is Q4; no-flash feasibility confirmed by the inline script |
| AC-005-04 | Five override blocks in `src/index.css` with the eight tokens each; state cues (`aria-pressed` ring, dashed pending, disabled opacity) are token-independent | pending Test | Palette values are targets; contrast must be measured (Q7) |
| AC-005-05 | `HomeIllustration.tsx` switches by theme; `ThemeIcon.tsx` supplies one glyph per theme used in the picker and beside the four headings; ornament CSS variables per theme | pending Test | One glyph per theme is used for the picker and heading markers (see Open decisions) |
| AC-005-06 | All decoration `aria-hidden="true"`, `focusable="false"`, `pointer-events-none`; markup does not depend on role, phase or votes | pending Test | none |
| AC-005-07 | No edits to existing text, roles, `data-testid`; headings get an `aria-hidden` icon child only | pending Test | Existing US-001 e2e must pass unchanged |
| AC-005-08 | Keep layout classes; picker wraps (`flex-wrap`) and sits on its own row (`basis-full`) so header content does not move | pending Test | none |
| AC-005-09 | Inline SVG and CSS only; no dependency; `package.json` unchanged | pending Test | none |

Conflict resolution: US-004 says "one fixed theme, no theme switcher, no dark mode" and the brief lists themes and avatars as out of scope. US-005 supersedes those US-004 lines only after the mob approves Q1; until then the code must not start. BA updates US-004 after approval.

## File table
| File | Existing / new | Reason for change |
|---|---|---|
| `src/features/theme/themes.ts` | New | `THEMES` (id, label), `DEFAULT_THEME`, `isTheme`, storage key and safe read/write helpers |
| `src/features/theme/themes.test.ts` | New | Unit tests for validation, fallback and storage failure |
| `src/features/theme/themeStore.ts` | New | Module store, `useTheme` via `useSyncExternalStore`, applies `data-theme` |
| `src/features/theme/ThemePicker.tsx` | New | Picker and status message |
| `src/features/theme/ThemeIcon.tsx` | New | One decorative icon per theme |
| `src/features/room/HomeIllustration.tsx` | Existing | Choose one of six illustrations by theme |
| `src/features/room/HomePage.tsx` | Existing | Picker, heading icons |
| `src/features/room/RoomShell.tsx` | Existing | Picker in the header row; heading icon for `Players`; Host-left shows the current theme without a picker |
| `src/features/room/ResultsPanel.tsx` | Existing | Heading icon |
| `src/index.css` | Existing | Five theme override blocks, per-theme ornament variables, `color-scheme` |
| `index.html` | Existing | Inline head script that applies the stored theme before first paint |
| `docs/design/ui-ux.md` | Existing | Theme list, picker placement, per-theme tokens |
| `docs/knowledge/decisions.md` | Existing | Add proposed D-025 (selectable themes, local only) |

No change to `src/domain/`, `src/realtime/`, `src/types/`, `tests/` (Test owns), or `package.json`.

## Data and message shapes
- `type ThemeId = 'vintage' | 'light' | 'dark' | 'ocean' | 'sunny' | 'forest'` in `themes.ts`. Owner: the local browser only.
- Storage: `localStorage['story-pointing:theme']` = a `ThemeId`. Never read by or sent to other clients.
- No new realtime message, room-state field, URL parameter or roster field (D-004, D-005).

## Theme tokens (targets)
Each theme sets the same eight tokens. Values are proposals; Test measures contrast and the Developer adjusts them to meet 4.5:1.

| Token | Vintage | Light | Dark | Ocean | Sunny | Forest |
|---|---|---|---|---|---|---|
| `--color-paper` | `#F3E9D2` | `#F7F8FA` | `#0F1720` | `#EAF6FA` | `#FFF8E1` | `#EEF3E6` |
| `--color-panel` | `#EADCBC` | `#E9ECF1` | `#1A2532` | `#D2EAF2` | `#FFEBB0` | `#DCE8CE` |
| `--color-ink` | `#3E2C23` | `#1B1F27` | `#E6EDF5` | `#0B2A3A` | `#3B2A00` | `#1D2B1A` |
| `--color-ink-muted` | `#6B5646` | `#4A5565` | `#A9B8C8` | `#3E5C6B` | `#6B5200` | `#4A5E43` |
| `--color-accent` | `#7A2E1D` | `#1F4FBF` | `#7FB2FF` | `#0B6A8F` | `#A63F00` | `#2E6B34` |
| `--color-danger` | `#9B1C1C` | `#B3261E` | `#FF8A80` | `#B3261E` | `#A4161A` | `#A8231B` |
| `--color-focus` | `#1F4E79` | `#0B57D0` | `#FFD166` | `#0A3D91` | `#1A4FA0` | `#7A3E00` |
| `--color-rule` | `#8A6F4D` | `#6B7686` | `#5B6B7D` | `#4F8FA8` | `#C28A00` | `#6E8F5B` |

Text on `accent` uses `paper`, so every `accent`/`paper` pair must reach 4.5:1 (Dark inverts: light accent, dark paper). `color-scheme` is `dark` for Dark and `light` otherwise.

Ornament style per theme:

| Theme | Divider line | Divider mark | Panel frame | Corner dot |
|---|---|---|---|---|
| Vintage | `3px double` | rotated square | solid | 2 px |
| Light | `1px solid` | rotated square | solid | none |
| Dark | `1px solid` | circle | solid | 2 px |
| Ocean | `2px dotted` | circle | dotted | 3 px |
| Sunny | `3px dashed` | circle | dashed | 3 px |
| Forest | `2px dashed` | leaf (`border-radius: 0 100% 0 100%`) | solid | 2 px |

## Illustrations and icons
| Theme | Home illustration (96x96 SVG) | Icon (24x24, `currentColor`) |
|---|---|---|
| Vintage | three fanned cards with a spade (existing) | spade |
| Light | one clean card outline with a circle and two lines | lightbulb |
| Dark | crescent moon and three four-point stars on a card | moon |
| Ocean | three waves and a small anchor | wave |
| Sunny | circle with eight rays | sun |
| Forest | two layered trees and a leaf | tree |

All are authored in the repo, no card values or Participant data inside, no `<title>`, no text nodes.

## State transitions
| From | Event | To | Rejected / no-op behavior |
|---|---|---|---|
| any theme | user selects a theme id | that theme; attribute and storage updated; status text shown | selecting the current theme is a no-op except the status text; an unknown id is rejected by `isTheme` and ignored |
| page load | stored value valid | that theme before first paint | missing or invalid stored value: `vintage`, no message; storage throws: `vintage`, picker still works in memory |

Room phases, votes, Host-only Reveal/Revote and the realtime channel are untouched.

## UI contract
| Element | Role and accessible name | data-testid (only if needed) | Exact message |
|---|---|---|---|
| Picker group | group `Theme` (`fieldset` legend) | `theme-picker` | none |
| Picker choices | radios named `Vintage`, `Light`, `Dark`, `Ocean`, `Sunny`, `Forest` | none | none |
| Status | status | `theme-status` | `Theme set to <name>.` |
| Decorative icons and illustration | none (`aria-hidden`) | none | none |

Existing selectors from the US-001..US-004 specs stay unchanged.

## Failure and recovery
- Failure cases: storage unavailable or throwing, invalid stored value, a theme token missing from one override block, low contrast in a theme, picker overflowing at 390 px, inline script id list drifting from `THEMES`.
- Recovery: fall back to `vintage`; a missing token inherits the Vintage value instead of rendering transparent; the unit test fails when the script and `THEMES` differ.
- Privacy and lifecycle boundaries affected: none; theme never leaves the browser (D-005).

## Implementation tasks
| # | Task | Test level | Command (from package.json) |
|---|---|---|---|
| 1 | `themes.ts` and `themes.test.ts` (validation, fallback, throwing storage, `index.html` script list equals `THEMES`) | unit | `npm test` |
| 2 | `themeStore.ts` with `useTheme`; unit test that `setTheme` sets the attribute and storage and ignores unknown ids | unit | `npm test` |
| 3 | Override blocks, ornament variables and `color-scheme` in `src/index.css`; head script in `index.html` | build | `npm run build` |
| 4 | `ThemeIcon.tsx`, per-theme `HomeIllustration.tsx` | build | `npm run build` |
| 5 | `ThemePicker.tsx`; wire into `HomePage.tsx` and `RoomShell.tsx`; heading icons in Home, Players and Results | e2e | `npm run test:e2e` |
| 6 | Scan `src/` for hex outside `src/index.css`, `slate-`, `bg-white`, `text-white` | static | grep |
| 7 | Measure contrast per theme and capture screenshots at 1280x720, 768x1024, 390x844 | manual evidence | n/a |
| 8 | Update UI/UX; add proposed D-025; write `docs/reviews/US-005-dev-review.md` | docs | n/a |
| 9 | Run `npm run build`, `npm test`, `npm run test:e2e` and report PASS / FAIL / NOT RUN; e2e needs Supabase env vars (no `.env` exists yet) | all | as listed |

## Open decisions
- Q1 themes and avatars out of scope, Q3 per Participant vs room-wide: mob, blocking.
- Q2 Vintage as default, Q4 `localStorage` vs `sessionStorage`, Q7 palettes: non-blocking; the values above are proposals.
- One icon glyph per theme is reused as the picker icon and the heading marker. If the mob wants a different icon per heading (for example players, results), AC-005-05 needs a richer icon set: Developer proposes, BA confirms, non-blocking.
- Proposed D-025 to record selectable local themes: mob, blocking for DONE.
- Slicing (from the story review): slice 1 picker, persistence, Light and Dark; slice 2 Ocean, Sunny, Forest; slice 3 themed illustrations and icons. Developer recommends implementing in that order.

## Handoff to Test
- Story: US-005; spec: this file; no cases exist yet.
- Cases needed for AC-005-01..09. Priority risks: no flash and persistence (AC-005-03), per-Participant independence (Host and Guest contexts), contrast and state cues per theme (AC-005-04), decoration accessibility and privacy (AC-005-06), layout and picker overflow at 390 px (AC-005-08), and unchanged US-001..US-004 behavior (AC-005-07).
- Test writes `docs/test-cases/US-005-test-cases.md` and then `tests/e2e/US-005.spec.ts`; Developer writes the Vitest tests in tasks 1 and 2.
