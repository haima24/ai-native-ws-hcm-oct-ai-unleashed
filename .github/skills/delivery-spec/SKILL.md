---
name: delivery-spec
description: Create a scoped implementation spec for a Story Pointing story before production code, including boundaries and verification.
---
# Plan one implementation slice

Read the selected requirements, relevant decisions and existing code boundaries. Use the [spec template](assets/spec-template.md). Planning does not need test cases yet; add case IDs after Test designs them.

Save `docs/specs/US-xxx-dev-spec.md` with these compact sections:
- Goal, non-goals, requirement and decision references.
- AC coverage table, with any contradiction or assumption.
- File table: existing/new files and the reason for each.
- Message and state shapes with their owner (Host tab owns room state); transitions and rejected/no-op behavior, including Host-only reveal/revote.
- UI contract: role/name and `data-testid` only where needed; exact messages. This spec owns the selector table.
- Failure, recovery and privacy boundaries.
- Ordered tasks and test levels; commands taken from the actual `package.json`.
- Open decisions and handoff to Test.

Link existing types instead of copying code. For protocol or privacy changes, trace the full data path using the [realtime rules](../../instructions/realtime.instructions.md) and record the result before implementation. Resolve document conflicts explicitly; "newest wins" is not resolution.
