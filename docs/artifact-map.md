# Artifact map and agent outputs

A project convention, not a universal standard. The goal is one source of truth and a clear owner per file, not more folders.

## Which file answers which question?

| File | Answers | Owner |
|---|---|---|
| [Product brief](product-brief.md) | What are we building, for whom, what is in scope? | BA + mob |
| [UI/UX](design/ui-ux.md) | What do screens look like, how do users interact? | BA defines behavior; Developer maintains design |
| [Decisions](knowledge/decisions.md) | Why this choice; decided or only proposed? | Mob decides; Developer records technical decisions |
| [Glossary](knowledge/glossary.md) | What do Host, Participant, Vote and Results mean? | BA maintains; all roles reference |
| [Supabase setup](knowledge/supabase-setup.md) | How is Supabase configured; what to check before the demo? | Developer; Van verifies dashboard settings |
| [Token log](token-log.md) | How much AI usage did the team spend? | Mob |

Agents do not need these pasted in: the global instructions in `.github/copilot-instructions.md` point to them. Each task reads only the relevant parts and re-reads when they change. The glossary is not a place to hide new business rules; a rule needs an AC and a test.

## Output contract

Paths are relative to the application root (where `package.json` lives).

| Agent / skill | Output | Location |
|---|---|---|
| BA / story-authoring | Story and ACs | `docs/requirements/US-xxx-slug.md` |
| BA | Separate review when needed | `docs/reviews/US-xxx-ba-review.md` |
| Developer / delivery-spec | File plan, contracts, UI selector map | `docs/specs/US-xxx-dev-spec.md` |
| Developer | Code and unit tests | `src/`; unit tests beside the module |
| Developer | Post-implementation review | `docs/reviews/US-xxx-dev-review.md` |
| Test / story-verification: design | Cases and AC mapping | `docs/test-cases/US-xxx-test-cases.md` |
| Test / story-verification: execution | Page objects | `tests/page-objects/` |
| Test / story-verification: execution | Playwright scenarios | `tests/e2e/US-xxx-slug.spec.ts` |
| Test | Verification with actual results | `docs/reviews/US-xxx-verification.md` |
| Mob | Demo script, AI usage | `docs/demo-script.md`, `docs/token-log.md` |

Skills are instructions, not separate processes; the agent using a skill writes the artifact with its tools. Never save output under `.github/skills/`. Templates live in each skill's `assets/` folder; replace placeholders in new artifacts and do not treat a template as a finished deliverable.

## Keeping docs in sync

1. The brief owns scope; UI/UX owns shared layout and states; the story owns detailed ACs; the dev spec owns implementation and the story's selectors.
2. When a business rule changes, update the related AC and decision, then sync spec and cases. Code or a screenshot never overrides a requirement.
3. Accepted means decided, not that code complies. Proposed needs a decision. Superseded points to its replacement.
4. Link instead of copying UI design text into each story. An old review does not prove the code still passes after later changes.
5. `playwright-report/` and `test-results/` are generated and gitignored. Keep a durable summary in the verification report; archive redacted evidence if needed for demo or audit.
6. The harness lives in `.github/`; application artifacts live in `docs/`, `src/` and `tests/`.

## What to read per task

- BA: brief, glossary, relevant decisions, UI/UX when writing screen ACs.
- Developer: story, spec, decisions; UI/UX before changing the UI.
- Test: story first, then spec, cases and relevant UX checks; design expected results independently of the code.
