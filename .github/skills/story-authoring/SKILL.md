---
name: story-authoring
description: Write or revise one Story Pointing MVP story with acceptance criteria, explicit business rules and traceability.
---
# Author one story

Read `docs/product-brief.md`, relevant parts of `docs/knowledge/glossary.md` and `docs/knowledge/decisions.md`, and any existing story. Use the [story template](assets/story-template.md); preserve AC IDs when revising. Do not expand beyond US-001..US-003.

1. Identify the user outcome and the MVP feature. Keep optional ideas out of the slice.
2. Resolve material ambiguity with batched questions and recommendations; document reversible details as assumptions.
3. Save `docs/requirements/US-xxx-slug.md`: story sentence, in/out scope, numbered Given/When/Then ACs, validation, exact error messages, dependencies, open questions.
4. Map ACs to brief success criteria and decision IDs. For results, define empty set, all-`?` set, rounding, ties and consensus; do not leave this to tests.
5. State Host-only rules (reveal, revote) as explicit ACs, including what a Guest sees.
6. Review: each AC is observable, nothing contradicts the brief or accepted decisions, no technical mechanism is asserted without evidence.

Handoff: story ID, path, changed ACs, unresolved questions.
