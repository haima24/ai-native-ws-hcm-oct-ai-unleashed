# US-004 Dev Review: Vintage UI refresh

Date: 2026-10-10. Scope: requirements rev 3, spec rev 2. Commit: not committed (worktree changes only).

## Files changed
- `src/index.css`: theme tokens, page background and paper texture, serif headings, `ornate` and `ornament-divider` classes.
- `src/features/room/HomeIllustration.tsx` (new): inline SVG card motif, `aria-hidden`.
- `src/features/room/HomePage.tsx`, `RoomShell.tsx`, `VotingCards.tsx`, `ResultsPanel.tsx`: token classes, dividers, corner ornaments, state cues.
- `docs/design/ui-ux.md` (visual tokens and decoration contract), `docs/knowledge/decisions.md` (D-026, now Accepted).
- No change to `src/domain/`, `src/realtime/`, `src/types/`, `tests/` or `package.json`.

## Contract changes
None to messages, state or selectors. All `data-testid`, roles, labels and copy are unchanged. New elements: decorative `aria-hidden` illustration and divider `div`s.

## Checks
| Check | Command | Result |
|---|---|---|
| Type-check and build | `npm run build` | PASS (71 modules, CSS 17.14 kB) |
| Unit tests | `npm test` | PASS, 5 files, 92 tests |
| Old palette scan of `src/` | grep for `[#`, `slate-`, `gray-`, `bg-white`, `text-white`, hex | PASS: only the eight token definitions in `src/index.css` |
| Remote reference in built CSS | search `url(` in `dist/assets/*.css` | PASS: none |
| e2e | `npm run test:e2e` | NOT RUN: no `.env` (only `.env.example`), so Supabase is not configured; run was stopped after timing out |
| Contrast measurements | n/a | NOT RUN |
| Viewport screenshots / mob visual review | n/a | NOT RUN |
| `tests/e2e/US-004.spec.ts`, static theme test | n/a | NOT WRITTEN (Test owns) |

## Self-review
- Correctness: class-level changes only; Host-only controls, vote privacy and phase rules are untouched, and decoration is static and independent of room state (AC-004-11).
- Host-only enforcement: no change; Reveal/Revote still rendered only for the Host and enforced by the domain.
- Input validation: no change.
- Effect cleanup and failure handling: none added; decoration is inline or CSS, so it cannot fail to load.
- Accessibility: decoration has `aria-hidden` and `pointer-events: none`; focus outlines use the `focus` token. Contrast values are targets and are unmeasured.

## Risks and open items
- Q1 (themes) and Q6 (avatars/illustration) were not decided by the mob; implementation followed the instruction to implement. D-026 was Proposed at review time and is now Accepted by the mob (2026-10-10); Q6 is still recorded as open in the requirements.
- `ornate` adds a 1 px border to the Home panels and Results, and the Room header lost no height but gained the divider (12 px plus margin); AC-004-05 requires comparing with the pre-change baseline, which has not been measured.
- Muted text on the textured page and contrast for `text-sm` errors need measurement (TC-004-24, 25, 36).
- The `ornate` frame sits 3 px inside a 12-16 px padding; long names or wrapped text must not enter that band (TC-004-36).
- Disabled-card cue is opacity and cursor only; the spec's muted border was not added to avoid conflicting with the pending dashed style.
- `Connection lost` and a header connection indicator are not implemented (US-002 AC-002-06), so AC-004-06 and AC-004-02 cannot be fully verified.

## Next action
1. Mob: Q6 (avatars/illustration) is still open in the requirements; D-026 is Accepted.
2. Configure Supabase env vars (see [supabase-setup](../knowledge/supabase-setup.md)), then run `npm run test:e2e`.
3. Test: write `tests/e2e/US-004.spec.ts` and the static theme test from [the cases](../test-cases/US-004-test-cases.md) and save `docs/reviews/US-004-verification.md`.
