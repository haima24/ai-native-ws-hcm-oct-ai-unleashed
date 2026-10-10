# US-005 Dev Review: Theme selection with themed imagery

Date: 2026-10-10. Scope: requirements US-005 (Draft), spec US-005. Commit: not committed (worktree changes only).

## Gate status
Implemented on the mob's explicit instruction. Not met: `docs/test-cases/US-005-test-cases.md` is missing, and Q1 (themes/avatars out of scope) and Q3 (per Participant vs room-wide) are not recorded as decisions. Proposed D-027 records the choice (now Accepted by the mob, 2026-10-10).

## Files changed
- New: `src/features/theme/themes.ts`, `themeStore.ts`, `themeStore.test.ts`, `ThemeIcon.tsx`, `ThemePicker.tsx`.
- Changed: `src/features/room/HomeIllustration.tsx` (six illustrations by theme), `HomePage.tsx`, `RoomShell.tsx`, `ResultsPanel.tsx` (picker, heading icons), `src/index.css` (five theme override blocks, ornament variables), `index.html` (first-paint script), `src/main.tsx` (`initTheme()`).
- Docs: `docs/design/ui-ux.md`, `docs/knowledge/decisions.md` (D-027, now Accepted), this review, spec status.
- No change to `src/domain/`, `src/realtime/`, `src/types/`, `tests/` or `package.json`.

## Contract changes
- New UI: `Theme` radio group (`data-testid="theme-picker"`), status `Theme set to <name>.` (`data-testid="theme-status"`). All existing selectors, roles, copy and `data-testid` values are unchanged; headings gain an `aria-hidden` icon child.
- No realtime message, room-state, URL or roster change. Storage: `localStorage['story-pointing:theme']`.

## Checks
| Check | Command | Result |
|---|---|---|
| Type-check and build | `npm run build` | PASS (75 modules, CSS 20.39 kB) |
| Unit tests | `npm test` | PASS, 6 files, 101 tests (9 new theme tests) |
| Old-palette scan of `src/` | grep `[#`, `slate-`, `gray-`, `bg-white`, `text-white`, hex | PASS: hex appears only in the six token blocks of `src/index.css` |
| Theme CSS in build | search `dist/assets/*.css` for `data-theme=` | PASS: light, dark, ocean, sunny, forest |
| First-paint script in build | search `dist/index.html` | PASS |
| Token contrast (computed from the token values, not from the rendered page) | node script, WCAG formula | PASS: lowest ratio 4.84 (`panel` text on `accent` in Ocean); body ink 10.95-15.54; muted text 5.08-8.92; error text 5.52-7.90 |
| e2e | `npm run test:e2e` | NOT RUN: no `.env` (Supabase not configured) |
| Rendered contrast, focus, layout at 1280/768/390, per-theme screenshots | n/a | NOT RUN |
| Mob visual review of illustrations and icons | n/a | NOT RUN |

## Self-review
- Correctness: `setTheme` ignores unknown ids; `readStoredTheme` and `storeTheme` handle throwing storage; the picker and illustrations read one shared store, so Home and Room stay in sync.
- Host-only and privacy: no change to Reveal/Revote or vote data; theme never enters `src/realtime/` (D-005, D-007).
- Failure handling: invalid or missing stored value gives `vintage`; storage failure keeps the in-memory choice.
- No-flash: the head script sets `data-theme` before the bundle loads; a unit test keeps its id list equal to `THEMES`.
- Accessibility: decorations and icons are `aria-hidden` with `pointer-events-none`; radios are native (arrow keys), the selected one is shown by fill, ring and weight; a polite status announces changes.

## Risks and open items
- The picker is six labels with 44 px targets; at 390 px it wraps over several rows, which pushes content down. Not measured against the AC-004-05/AC-005-08 baseline.
- `has-checked:` and `has-focus-visible:` variants are used on the picker labels; the build accepts them, but real-browser rendering of the selected and focus states is unverified.
- Palettes, illustrations and icons are Developer proposals (Q7); the mob has not seen them. The Dark `accent` is light, so buttons use dark text on light blue; check visually.
- One icon per theme is reused for the picker and the Create, Join, Players and Results headings; a richer icon set per heading would be a change to AC-005-05.
- `ornate` frames use `0px` dot size in Light, which can leave a faint half-pixel dot.
- `Connection lost` and the header connection indicator still do not exist (US-002 AC-002-06).

## Next action
1. Mob: D-026 and D-027 are Accepted (2026-10-10); Q1, Q2, Q3 accepted with the recommended defaults.
2. Test: write `docs/test-cases/US-005-test-cases.md`, then `tests/e2e/US-005.spec.ts`, and verify.
3. Configure the Supabase env vars and run `npm run test:e2e`; capture per-theme screenshots and rendered contrast.
