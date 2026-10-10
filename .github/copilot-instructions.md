# Story Pointing — project contract

## Language
- All repo content is English: docs, code, comments, commit messages, `docs/token-log.md`.
- Chat replies to the team are Vietnamese.

## Context and scope
- Read `docs/product-brief.md` when starting a feature or changing scope: 3 MVP features (US-001..US-003), success criteria, out of scope.
- Read relevant sections of `docs/knowledge/glossary.md` and `docs/knowledge/decisions.md`. Accepted is not proof of code compliance; Proposed must not silently become a requirement.
- Stack: React 19, strict TypeScript, Vite, Tailwind, Supabase Realtime Broadcast (no tables), Vercel, Vitest, Playwright. Add no library or infrastructure without an agreed need.
- Roles: Host (room creator and facilitator) and Guests; all are Participants and vote. Only the Host reveals and revotes.

## Workflow
- New story: BA requirements > Developer spec > Test cases > Developer implementation > Test verification > mob review.
- Before production code for a story, require `docs/requirements/US-xxx-*.md`, `docs/specs/US-xxx-dev-spec.md`, `docs/test-cases/US-xxx-test-cases.md`. If one is missing, name it and hand off to its owner.
- Bug fix: reproduce > regression test > minimal fix > verify.
- Do not auto-delegate or auto-commit; the mob reviews all AI output.
- Agents: [ba](agents/ba.agent.md), [developer](agents/developer.agent.md), [test](agents/test.agent.md).
- Instructions: [react](instructions/react.instructions.md), [realtime](instructions/realtime.instructions.md), [testing](instructions/testing.instructions.md).
- Skills: [story-authoring](skills/story-authoring/SKILL.md), [delivery-spec](skills/delivery-spec/SKILL.md), [story-verification](skills/story-verification/SKILL.md).

## Token rules
- Narrow context: attach `#file` / `#selection`, not whole folders.
- One story at a time; keep diffs small.
- Load only the skill needed for the task.
- Keep chat answers short; save durable results in repo artifacts, not pasted logs.
- Record team usage in `docs/token-log.md`.

## Quality and evidence
- Never commit credentials. Only the Supabase URL and anon key are allowed in Vite env vars, never service-role keys.
- Read actual scripts in `package.json` before running commands. Do not invent a command.
- Report every check as PASS / FAIL / NOT RUN with the command, counts and environment. Never claim an unrun check passed.
- Story done = ACs covered, build, unit and e2e checks reported, artifacts updated, reviewed commit.
- Preserve unrelated user changes.
