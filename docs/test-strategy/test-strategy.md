# Test Strategy — Story Pointing

Sources: [product brief](../product-brief.md), [decisions](../knowledge/decisions.md) (D-005, D-007, D-012, D-013), [testing rules](../../.github/instructions/testing.instructions.md), [artifact map](../artifact-map.md).
Status: agreed approach, not a claim that any check has run. Results live in `docs/reviews/US-xxx-verification.md`.

## 1. Scope and approach

| Item | Decision |
|---|---|
| Browser | One main browser: Google Chrome, latest stable version. |
| Automation | Playwright (`@playwright/test`) for end-to-end user journeys; Vitest for domain and protocol logic without network (D-012). |
| Manual testing | Only where automation cannot decide: subjective visual review, rendered contrast measurement, license or dependency review. Each manual case is named in its test-case file. |
| Platform | Desktop browser (brief: teams of 3-10 on desktop). |
| Not tested | Firefox, Safari, Edge, mobile browsers and real devices, older Chrome versions. Responsive checks run in Chrome with resized viewports only (1280x720, 768x1024, 390x844). |

The single-browser decision is a scope choice, not a claim that other browsers work. Reports must state "Chrome only".

## 2. Test levels

| Level | Tool | What it covers | Location |
|---|---|---|---|
| Unit / protocol | Vitest (`npm test`) | Reducers, validation, `computeResults`, public-view validation, fake-channel intent handling, malformed input | `src/**/*.test.ts(x)` |
| End-to-end | Playwright (`npm run test:e2e`) | Create, join, vote, reveal, revote, theme switching, with real UI | `tests/e2e/US-xxx.spec.ts`, page objects in `tests/page-objects/` |
| Build check | `npm run build` | Type-check and production build | n/a |
| Manual | Reviewer with checklist | Cases marked `manual` in `docs/test-cases/` | Evidence in the verification report |

Rules that cannot be seen in the UI (stale round intents, forged Host intents, `roundId`) stay at unit or protocol level; network-level privacy is not asserted by e2e (D-005).

## 3. Playwright approach

- Project: a single project running Chrome desktop. Config in [playwright.config.ts](../../playwright.config.ts); read it before every run and record the actual values in the report.
- Multi-user: Host and each Guest in separate browser contexts (never tabs of one context), a fresh room per test.
- Locators: roles and labels first, existing `data-testid` where the story spec defines them; web-first assertions, no fixed sleeps.
- Test names include story and case IDs, e.g. `US-002 TC-002-07 ...`, so results trace back to `docs/test-cases/`.
- Timing checks (roster within 2 s, connect limits 5 s and 10 s) record start, end and duration; the limit is a baseline, not a guarantee.
- Skips and fixmes are reported with reasons; a zero-test run is not a pass.
- Playwright MCP may be used to inspect the live UI, but saved `.spec.ts` files and the Playwright runner are the evidence.

### Browser version

"Latest Chrome" means the current stable release when the run starts. The report records the exact browser version string from the run.

Current gap to resolve: the config uses the `Desktop Chrome` device profile, which runs Playwright's bundled Chromium, not the installed Google Chrome. To test branded Chrome stable, the project needs `channel: 'chrome'` (and Chrome installed, or `npx playwright install chrome`). Until that is changed, a passing run proves Chromium behavior only and must be reported as such. Owner: Test proposes, Developer confirms the config change.

## 4. Environments

| Environment | Base URL | Use |
|---|---|---|
| Local | `http://localhost:5173` (started by the Playwright `webServer`, `npm run dev`) | Default for every story |
| Deployed (Vercel) | Set by `PLAYWRIGHT_BASE_URL` | Happy-path e2e before the demo (brief, success criterion 6) |

Realtime tests need the Supabase URL and anon key as Vite env vars (D-017); without them e2e is NOT RUN, never skipped silently. No service-role key is ever used in tests or committed.

## 5. Test data and isolation

- Names: `Maya` (Host), `Noah`, `Linh`; boundary names defined in each test-case file.
- Each test creates its own room; rooms are ephemeral, so there is no cleanup and no shared state between tests.
- Tests run fully parallel, so no test may depend on another test's room or order.
- Theme tests clear or set `localStorage` per context.

## 6. Risk-based priorities

| Risk | Where it is checked |
|---|---|
| Other Participants' votes visible before reveal (D-005) | e2e UI assertion with Host and two Guests; separate boundary test for network privacy |
| Guest can Reveal or Revote (D-007) | e2e (no controls in DOM) and unit (forged intent ignored) |
| Roster or results differ between clients | e2e: read every context and compare by name |
| Stale or duplicate intents, wrong phase | Vitest |
| Connection loss, Host leaving, Presence-dependent behavior (D-020) | e2e where the transport is controllable; otherwise NOT RUN with reason |
| Theme leaking to other Participants, layout overflow | e2e with separate contexts and viewport checks |

## 7. Entry and exit criteria

Entry for testing a story: requirements `docs/requirements/US-xxx-*.md`, dev spec and test cases `docs/test-cases/US-xxx-test-cases.md` exist; `npm run build` passes.

Exit (story verified): all P1 cases for the story have a reported result; build, Vitest and Playwright results are recorded; no open defect on a P1 AC; skipped or NOT RUN items have reasons. Full e2e suite runs before marking a story complete when the environment is ready.

## 8. Reporting

Save `docs/reviews/US-xxx-verification.md` using the verification template. For each check give PASS / FAIL / NOT RUN, the exact command, counts, Chrome version, environment (local or Vercel URL), commit and worktree status. Defects include reproduction steps and expected behavior; production defects go to the Developer.

## 9. Limitations

- Chrome-only: no cross-browser or real-device evidence.
- Latency and timeout limits have no agreed SLA; results are samples from one environment.
- Broadcast gives no authenticated sender or network privacy (D-005); tests document this and do not claim security.
- Realtime and Presence results depend on Supabase availability and settings.
