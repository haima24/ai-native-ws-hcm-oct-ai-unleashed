---
applyTo: "src/**/*.test.ts,src/**/*.test.tsx,tests/**/*.ts,playwright.config.ts"
---
# Tests and verification

- Derive assertions from ACs and accepted decisions, then check the spec and code for gaps. Tests generated only from the implementation repeat its mistakes.
- Name tests with story and case IDs, e.g. `US-002 TC-002-07 hides other votes before reveal`.
- Vitest for domain logic without network, including malformed input. Playwright for user journeys.
- Use separate Host and Guest browser contexts and a fresh room per test.
- Prefer role/label locators and web-first assertions. Avoid fixed sleeps and brittle CSS selectors.
- Privacy (D-005): with a Host and two Guests, assert at UI level that other Participants' vote values are never shown before reveal. Do not assert network privacy; record in the verification report that a shared Supabase topic does not guarantee it.
- Host-only: assert the Guest UI has no Reveal/Revote controls, and that a forged reveal/revote intent from a Guest is ignored.
- Results: cover zero numeric votes, mixed `?` and numbers, all `?`, and consensus (all numeric votes equal).
- Flow: create, join, vote, reveal, revote, reveal without page reload.
- Roster updates reach the Guest within 2 s; record start, end and duration, not just eventual visibility.
- Use Playwright MCP to inspect the live UI when available. MCP does not replace saved `.spec.ts` files.
- Check `playwright.config.ts` before testing the Vercel URL; record the actual base URL and browsers.
- Keep required tests enabled; report skips with reasons. A zero-test run is not completion.
- Report each check as PASS / FAIL / NOT RUN with command, counts and environment.
