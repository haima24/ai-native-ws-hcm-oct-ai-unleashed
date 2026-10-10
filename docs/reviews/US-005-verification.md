# US-005 Verification: Theme selection with themed imagery

Date: 2026-10-10. Commit: `296b5b6`; worktree has uncommitted changes (3 entries in `git status --porcelain`). Environment: Windows, Playwright Chromium, local Vite dev server (`http://localhost:5173`). No Supabase env vars are configured.
Cases: [US-005-test-cases.md](../test-cases/US-005-test-cases.md). Spec: `tests/e2e/US-005.spec.ts`, page object `tests/page-objects/ThemePicker.ts`.

## Recommendation
Not complete. The Home-only subset ran (19 PASS, 1 FAIL). The 12 room cases did not run. AC-005-04 has a confirmed defect (F1). Do not mark the story done.

## Results
| Check | Command | Result |
|---|---|---|
| Type-check of tests | `npx tsc --noEmit` | PASS |
| Unit tests | `npm test` | PASS, 6 files, 101 tests (includes the 9 theme tests, TC-005-34) |
| e2e, Home only | `npx playwright test US-005 --grep "@home" --retries=0` | 19 PASS, 1 FAIL (TC-005-15), 40 s, 2 workers |
| Home contrast, measured | `npx playwright test US-005 --grep "TC-005-16" --reporter=json` | PASS; lowest ratio 5.23:1 (Ocean field error); Ocean buttons and selected choice 5.49; Light field error 5.52 |
| e2e, room cases | `npx playwright test US-005` | NOT RUN: no Supabase env vars, rooms cannot be created |
| `package.json` unchanged | `git diff --stat -- package.json` | PASS: no diff |
| Dist search for remote refs, new image or font files | n/a | NOT RUN |
| Manual artwork review (TC-005-35) | n/a | NOT RUN |

## AC to case to evidence
| AC | Cases | Evidence |
|---|---|---|
| AC-005-01 | TC-005-01, 02, 03, 04 | PASS (Home). TC-005-05 NOT RUN |
| AC-005-02 | TC-005-06, 07 | PASS (Home). TC-005-08 NOT RUN |
| AC-005-03 | TC-005-09, 11, 12, 34 | PASS. TC-005-10, 13 NOT RUN |
| AC-005-04 | TC-005-14, 16 | PASS. TC-005-15 FAIL. TC-005-17, 18 NOT RUN |
| AC-005-05 | TC-005-19, 20, 22 | PASS. TC-005-21 NOT RUN; TC-005-35 NOT RUN |
| AC-005-06 | TC-005-23, 24, 26 | PASS. TC-005-25 NOT RUN |
| AC-005-07 | none | NOT RUN (TC-005-27, 28, 29 need rooms) |
| AC-005-08 | TC-005-30 | PASS (Home). TC-005-31 NOT RUN |
| AC-005-09 | TC-005-32 | PASS. TC-005-33 partly: `package.json` has no diff, the rest NOT RUN |

## Defects
| # | Defect | Reproduction | Expected | Owner |
|---|---|---|---|---|
| D1 | Light and Ocean use `rgb(179, 38, 30)` (`#B3261E`) for errors, identical to the pre-US-004 error colour | Open Home, click `Create room` with an empty name to show the field error, choose `Light` or `Ocean`, run TC-005-15 | AC-005-04: no colour from the pre-US-004 palette remains. Either change the `--color-danger` of those two themes in `src/index.css`, or BA relaxes the AC | Developer / BA |

## Notes
- TC-005-15 is an AC-literal check; if BA relaxes the AC, update the case, do not delete it.
- Room cases need the Supabase URL and anon key (see [supabase-setup](../knowledge/supabase-setup.md)); once set, run `npx playwright test US-005` and record counts.
- Privacy: UI-level only. A shared Supabase topic does not guarantee network-level privacy (D-005).
- The earlier US-001 e2e run on this machine hung without Supabase and was stopped; no US-001..US-003 result is claimed here.
- Open findings F2 (stale decision numbers and Average/Consensus references) and F3 (interpretations) in the cases file need BA confirmation.
