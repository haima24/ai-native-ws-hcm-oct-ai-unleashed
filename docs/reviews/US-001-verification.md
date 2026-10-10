# US-001 verification and project smoke review

- Date: 2026-10-10, Australia/Sydney.
- Scope: current working tree; review and execution only, no application/test fixes.
- Initial commit: `b56dffb3cf9ce0dd1926826c6ba54ba9d5cdb79b`, dirty (existing documentation, Playwright config and test changes).
- During review another workflow committed `34c48555d0918c8ffcb508ffad36f33eb7b4c560` and continued editing US-002/003 test-case documents. This is not an immutable-checkout certification.
- Environment: Windows, localhost:5173, Chromium, configured Supabase Realtime. No deployed URL was supplied. No credentials recorded.

## Findings

1. **P1 — Production build fails.** `npm run build` reports TS6133 at `tests/e2e/US-001.spec.ts:46`: unused `timed`. The root TypeScript config includes tests and enables `noUnusedLocals`. Remove the unused helper or use it, then rerun build. Playwright execution alone does not catch this build gate.
2. **Product flow remains incomplete.** The implemented Room shell has a roster and phase, but no card selection, Reveal, Results or Revote. The sole E2E spec covers US-001. Passing it cannot establish the brief's create → join → vote → reveal → revote → reveal criterion. This is a US-002/003 delivery gap, not an assertion that those features belong in US-001.
3. **P2 — Presence evidence is inconsistent.** `tests/e2e/US-001.spec.ts:488` claims a measured approximately 3 s worst case from the D-020 spike, but `spikes/presence/RESULTS.md` says NOT RUN and D-020 remains Proposed. Replace the claim with actual recorded evidence and reconcile the decision/status documents. A lifecycle test pass does not constitute approval of the architectural decision or a latency guarantee.
4. **Share-link coverage gap.** TC-001-14/15 construct `/?room=<code>` through the page object; they never click Copy link and use the actual clipboard value. A regression in generated/copy URL can pass these tests. TC-001-03/99 remain manual/not automated; exercise the real copy action during smoke testing.
5. **P1 — Guest reload leaves a stale roster in the observed run.** TC-001-90 and TC-001-72 failed after Guest Noah reloaded and returned Home. TC-001-90 expected Players (1), received Players (2), and still found Noah until the test timed out. TC-001-72 expected Maya/Linh, received Maya/Linh/Noah after its 10 s wait. Reproduce with the full E2E command or select these two IDs. This establishes a failing lifecycle check, not whether the cause is a deterministic application defect or variable Presence departure latency. Investigate reload cleanup and Presence events before increasing timeouts. Guest close and Host reload tests passed in this run.

## Checks

| Command | Result | Evidence |
|---|---|---|
| `npm test` outside sandbox | PASS | 30 tests, 3 files. Initial sandbox attempt failed reading a temporary Vitest file; unrestricted rerun passed. |
| `npm run build` | FAIL | TS6133, unused `timed`; Vite production build was not reached. |
| `npm run test:e2e -- --retries=0` in sandbox | NOT RUN | Server startup did not complete; interrupted before any tests ran. |
| `npm run test:e2e -- --retries=0` outside sandbox | FAIL | 46 passed, 2 failed, 0 skipped; 48 tests, 2 workers, Chromium, 2.1 minutes. Failures: TC-001-90 and TC-001-72. |
| Smoke selection with `--list --grep` | PASS (discovery only) | The final command below selects 10 tests, including the failing reload regression. This is not a separate smoke execution. |
| Deployed smoke / full voting flow / manual clipboard | NOT RUN | No deployment URL supplied; voting flow is not implemented; clipboard has not been manually exercised. |

## Smoke procedure

Use the repository's existing scripts. Configure `.env.local` using `.env.example` and install Chromium as described in README. Use a test Supabase project because browser tests create live ephemeral rooms.

```powershell
npm test
npm run build
npm run test:e2e -- --retries=0 --grep 'TC-001-(01 |04 |06 |15 |37 |61 |68 |72 |76 )'
```

The 10 selected cases cover create, code join, share-link join, empty-name validation, duplicate name, unavailable room, Guest departure (page and context), Host departure, and Guest reload. Their results within the full run were 9 PASS and 1 FAIL (TC-001-72). Treat any failure as a failed smoke; do not count retries as first-attempt success. There is currently no `test:smoke` script or `@smoke` tag.

For a deployment, set `$env:PLAYWRIGHT_BASE_URL` to the actual deployment URL before the Playwright command, and remove it afterward with `Remove-Item Env:PLAYWRIGHT_BASE_URL`. The config disables local server startup when that variable is set. A dev-server pass does not validate the production bundle or deployment environment.

Manual supplement (separate browser profiles/contexts):

1. Host Maya creates a room; check six-character code, voting phase, Players (1).
2. Click Copy link, paste the actual clipboard value into a separate Guest context; verify code prefill, enter Noah and join. Both rosters must match.
3. Add Linh in a third context; check the same three names and counts, within 2 s of Linh seeing the Room shell.
4. Close Noah; verify both remaining rosters remove Noah. Close Host; verify Linh sees Host-left and can return Home. Joining the ended code must fail.
5. Once US-002/003 are implemented, add an automated smoke journey without page reload: Host votes 3, Guest votes 5, another Guest votes `?`; verify other values remain hidden; Host reveals; everyone sees the `3` and `5` groups each with `1 vote`, the `?` group with `1 vote`, and `3 of 3 voted`; Host revotes; values/results clear; vote again and reveal. Guests must have no Reveal/Revote controls. Test forged intents separately at protocol level.

## Completion recommendation

Not done for US-001 or the whole product. Build and Guest reload checks must pass, US-002/003 must be implemented and tested, and the deployed happy path must be verified. No commit was made by this review.

## AC to case to execution evidence

All E2E evidence below comes from the saved US-001 spec executed by the full runner, not manual inspection. PASS applies to the listed cases, not every possible case for that AC.

| AC / rule | Executed cases (TC-001 prefix) | Result |
|---|---|---|
| AC-001-01 create | 01, 04 | PASS; actual clipboard not covered |
| AC-001-02 join | 06, 07, 11, 12 | PASS |
| AC-001-03 link | 14, 15, 16 | PASS for constructed share URL |
| AC-001-04 roster | 18, 21 | PASS; test 18 checked each observer against 2000 ms |
| AC-001-05 name validation | 23, 24, 25, 26, 28, 30, 31, 32 | PASS |
| AC-001-06 duplicates | 36, 37, 38 | PASS |
| AC-001-07 code validation | 44, 45, 46, 47, 48 | PASS |
| AC-001-08 connecting/timeouts | 53, 54 (two variants), 55, 56, 57 | PASS |
| AC-001-09 departure | 61 (two variants), 62, 67 | PASS for close; reload has failures below |
| AC-001-10 Host lifecycle | 68, 69, 70 | PASS |
| AC-001-11 unavailable room | 76, 77, 78, 81 | PASS |
| Rule 5 phase on join | 84 | PASS for voting; revealed browser flow NOT RUN |
| Rule 8 Guest reload / non-Host lifecycle | 89; 90, 72 | 89 PASS; 90 and 72 FAIL on stale Host roster |

Roster timing: TC-001-18 starts observation after Guest2 sees its room shell and ends when each observer has the expected names/count. The list reporter did not retain individual timing annotations in a durable report, so no exact latency sample is claimed here. Network was the configured live Supabase connection. Other manual/P2/P3 cases in the case design were not separately executed. Domain/adapter unit evidence is 30 passing assertions/tests across 3 files; this review does not equate that count with complete case-design coverage.

AI usage credits are unavailable to this session; no numeric expense was fabricated or written to the shared usage ledger.
