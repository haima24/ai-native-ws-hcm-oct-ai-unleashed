---
name: story-verification
description: Design test cases or verify an implemented Story Pointing story against ACs, with traceability and honest execution evidence.
---
# Design or verify one story

Read requirements first, then relevant decisions, spec, existing cases and the [testing rules](../../instructions/testing.instructions.md). Pick the requested mode; do not rerun the whole workflow for a small correction.

## Case design
Use the [case template](assets/test-case-template.md). Apply boundary values, equivalence classes or state transitions where they expose risk. Save `docs/test-cases/US-xxx-test-cases.md` with case ID, AC, risk, level, preconditions, steps/data, expected result and its source. Include an AC coverage table. Do an independent risk pass for realtime, privacy and Host-only behavior. Do not finalize expected results for an unresolved business rule; ask BA.

## Execution
Use the [verification template](assets/verification-template.md). Read `package.json` and `playwright.config.ts` first; reuse existing tests and page objects.
- Specs: `tests/e2e/US-xxx-feature-slug.spec.ts`. Page objects: `tests/page-objects/`. Unit tests: beside modules as `src/**/*.test.ts(x)`.
- Run build, Vitest and Playwright with the scripts that actually exist. Before marking a story complete, run the full e2e suite when the environment is ready.
- Playwright MCP is for live inspection and authoring help; it does not replace saved specs or the Playwright runner.
- For the deployed Vercel URL, confirm the config reads the base URL variable, then record the actual URL and browsers.
- Do not repeat an unchanged failing environment setup.

Save `docs/reviews/US-xxx-verification.md`: story, date/time, commit and worktree status; AC to case to evidence mapping; commands with PASS / FAIL / NOT RUN, counts and skip reasons; defects with reproduction; completion recommendation and blockers.

Use real evidence only. Missing environment, credentials or browsers means NOT RUN, never a fabricated pass. Redact sensitive configuration.
