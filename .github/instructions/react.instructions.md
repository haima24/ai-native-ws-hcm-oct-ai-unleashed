---
applyTo: "src/**/*.tsx,src/features/**/*.ts"
---
# React and UI

- Components render state and dispatch intent. Keep validation, voting transitions and result calculations in `src/domain/`; keep transport out of components.
- Use functional components and hooks; one primary exported component per file.
- Keep only necessary state. Derive values during render instead of syncing with effects.
- Effects synchronize external systems. Every subscription or timer has cleanup; tolerate setup, cleanup, setup and discard callbacks from an obsolete room.
- Include reactive dependencies; do not silence warnings to hide stale closures.
- Use stable participant IDs as list keys, not array indexes.
- Use semantic controls with labels, keyboard operation and visible focus. Prefer role/name locators; add `data-testid` only where needed and listed in the dev spec.
- Reveal and Revote controls render only for the Host. Guests see a "waiting for Host" state. Hiding a button is not the enforcement; see the realtime rules.
- Before reveal, show other Participants only "Voted / Not voted", never values.
- Keep exact AC-defined messages. Use Tailwind utilities; no global state library without a need.
- Show pending, accepted and failed actions honestly; do not show a local vote as Host-confirmed before acknowledgement.
