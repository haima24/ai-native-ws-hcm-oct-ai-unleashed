# US-005 Test Cases: Theme selection with themed imagery

Sources: [requirements](../requirements/US-005-theme-selection.md), [dev spec](../specs/US-005-dev-spec.md), [UI/UX](../design/ui-ux.md), [decisions](../knowledge/decisions.md), US-001..US-004 requirements.
Status: designed; automated in `tests/e2e/US-005.spec.ts` (e2e) and `src/features/theme/themeStore.test.ts` (unit, written by the Developer). Execution status is in [US-005-verification.md](../reviews/US-005-verification.md). Priority: P1 = must pass for story done, P2 = should pass.
Techniques: equivalence classes (six themes, valid vs invalid stored values), boundary values (viewports 390 / 768 / 1280, 44 px target, 4.5:1), state transitions (voting, pending, failed, revealed, Host-left, switch at each step), regression of unchanged behavior.

Expected results come from the ACs and decisions D-004, D-005, D-007, D-022 and UI/UX sections 3-6. The spec is used for selectors and file names only; it is not the source of any expected value. Palette values are never asserted, only relations: contrast, "differs from", "equals a fresh load".

## Conventions
| Item | Value |
|---|---|
| e2e contexts | `Host` = context 1 (`Maya`), `Guest` = a separate context (`Noah`); Home-only tests use one context. Fresh room per test. |
| Locators | Picker: group `Theme`, radios named by theme name; status `data-testid=theme-status`. Choices are clicked through their visible label because the radio is visually hidden. |
| Theme probes | Computed colours are converted to RGBA through a canvas, background = first non-transparent ancestor, ratio = WCAG relative luminance. Disabled controls are excluded. |
| Old palette | `rgb(69, 90, 100)`, `rgb(241, 243, 244)`, `rgb(38, 50, 56)`, `rgb(84, 110, 122)`, `rgb(179, 38, 30)`, `rgb(0, 95, 204)` (the pre-US-004 colours). |
| Viewports | Desktop 1280x720, Tablet 768x1024, Narrow 390x844. |
| Frame control | `routeWebSocket` with `delayAck` (1500 ms) and `dropIntent` on the Guest page, as in the US-002 cases. |
| Tags | `@home` = needs no Supabase connection (Home only); all other e2e cases create rooms and need the Supabase env vars. |
| Results | Cases do not assert Average or Consensus (see F2). They use per-Participant roster values and `<voted> of <participants> voted` (D-022). |
| Command | `npx playwright test US-005` (all) or `--grep @home` (Home only); `npm test` for unit. |

## AC coverage
| AC | Case IDs | Level | Gap or note |
|---|---|---|---|
| AC-005-01 | TC-005-01, 02, 03, 04, 05 | e2e | none |
| AC-005-02 | TC-005-06, 07, 08 | e2e | none |
| AC-005-03 | TC-005-09, 10, 11, 12, 13, 34 | e2e, unit | "No flash" is checked by frame sampling (F3) |
| AC-005-04 | TC-005-14, 15, 16, 17, 18 | e2e | TC-005-15 is expected to fail today (F1) |
| AC-005-05 | TC-005-19, 20, 21, 22, 35 | e2e, manual | "Visibly different" proxy plus mob review (F3) |
| AC-005-06 | TC-005-23, 24, 25, 26 | e2e | none |
| AC-005-07 | TC-005-27, 28, 29 | e2e | Average/Consensus not asserted (F2) |
| AC-005-08 | TC-005-30, 31 | e2e | none |
| AC-005-09 | TC-005-32, 33 | e2e, command | `package.json` and dist checks are commands |

## 1. Theme picker (AC-005-01)
| ID | AC / rule | Title | Preconditions | Steps | Expected result | Level | Priority |
|---|---|---|---|---|---|---|---|
| TC-005-01 | AC-005-01 | Six choices in order with an icon each (happy) | Open Home | 1. Read the `Theme` group, its radios and label texts. 2. Count `svg` in each choice. | Exactly six radios; labels read `Vintage`, `Light`, `Dark`, `Ocean`, `Sunny`, `Forest` in that order; each choice has one icon. | e2e `@home` | P1 |
| TC-005-02 | AC-005-01, rule 4 | Default is Vintage, OS preference ignored, selection not colour only (boundary) | Fresh context; second context with OS dark colour scheme | 1. Read the checked radio in both. 2. Compare page backgrounds. 3. Compare the selected and an unselected choice's non-colour style (weight, ring, border). | `Vintage` checked in both; backgrounds equal; the selected choice differs from an unselected one by more than colour. | e2e `@home` | P1 |
| TC-005-03 | AC-005-01 | Keyboard operation and visible focus (happy) | Open Home | 1. Press `Tab` once. 2. Read the focused control and the focus outline. 3. Press `ArrowRight` twice, `ArrowLeft` twice. | First Tab focuses the checked radio; its choice shows an outline of non-zero width; arrows move the selection Vintage > Light > Dark > Light > Vintage and the status names each change. | e2e `@home` | P1 |
| TC-005-04 | AC-005-01, UI/UX 6 | Touch targets at least 44x44 (boundary) | 1280x720 and 390x844 | 1. Read each choice's box. | Width and height >= 44 px for all six, at both sizes. | e2e `@home` | P1 |
| TC-005-05 | AC-005-01 | Room: own row after Copy link, header content unmoved, keyboard order (happy) | Host in a room | 1. Compare the picker box with `room-code` and `Copy link`. 2. Focus `Copy link`, press `Tab`. 3. Switch through all themes and re-read the header boxes. | Picker starts below `Copy link` and overlaps neither; the next Tab stop is the picker; room code and `Copy link` do not move in any theme. | e2e | P1 |

## 2. Switch (AC-005-02)
| ID | AC / rule | Title | Preconditions | Steps | Expected result | Level | Priority |
|---|---|---|---|---|---|---|---|
| TC-005-06 | AC-005-02 | Immediate switch, no reload, announced (happy) | Home, page marked | 1. Choose `Ocean`. | Page background changes at once; status reads `Theme set to Ocean.` and is a `status` region; focus stays on the `Ocean` radio; the page marker survives (no reload). | e2e `@home` | P1 |
| TC-005-07 | AC-005-02 | Typed input and focus survive (edge) | Home with the three fields filled | 1. Choose `Dark`, then `Sunny`. | Create name, join code and join name keep their values; focus is on the picker. | e2e `@home` | P1 |
| TC-005-08 | AC-005-02, D-004, D-005 | Room state unchanged, nothing sent (negative) | Host and Guest in `R`; Guest voted `5`, Host `8` | 1. Count frames sent by the Host page (ignoring heartbeats). 2. Choose each theme in `voting`, then reveal and choose each again. | Roster, phase, own pressed card, `Voted` rows, revealed values and `2 of 2 voted` are identical in every theme; the theme switches add zero sent frames; Reveal does add frames (the capture works); no frame mentions a theme. | e2e | P1 |

## 3. Persistence and locality (AC-005-03)
| ID | AC / rule | Title | Preconditions | Steps | Expected result | Level | Priority |
|---|---|---|---|---|---|---|---|
| TC-005-09 | AC-005-03 | Choice survives reload (happy) | Home | 1. Choose `Dark`. 2. Reload. | `Dark` is checked and the page background equals the pre-reload one. | e2e `@home` | P1 |
| TC-005-10 | AC-005-03 | Choice applies to another room and later visit on the same browser (happy) | One context, two pages | 1. Choose `Sunny`, create a room. 2. Open a second page, read Home, create another room. | `Sunny` is checked with the same background in room 1, on the second Home and in room 2. | e2e | P1 |
| TC-005-11 | AC-005-03 | Saved theme before first visible frame (boundary) | Dark chosen; reference Vintage background known | 1. Sample the body background on every animation frame during a reload. | No sampled frame equals the Vintage background; the Dark background appears. | e2e `@home` | P1 |
| TC-005-12 | AC-005-03 | Missing, invalid or unavailable storage (negative) | Stored values `neon`, `DARK`, ` dark`, `dark `, empty; and a context whose `localStorage` throws | 1. Open Home for each. 2. In the blocked context choose `Ocean`, then reload. | Invalid values give `Vintage` with the Vintage background and no alert; blocked storage still lets the choice apply for the page view, shows no alert, and a reload returns to `Vintage`. | e2e `@home` | P1 |
| TC-005-13 | AC-005-03, D-005 | One Participant's theme never reaches another or the share link (negative) | Host chose `Dark`; Guest on default | 1. Both join one room. 2. Read the Guest's checked theme, background and URL. 3. Copy the link on the Host. 4. Guest chooses `Sunny`. | Guest stays `Vintage` until it chooses; Guest URL has no theme; the copied link ends with `?room=<code>` and has no theme text; Host stays `Dark` after the Guest's change. | e2e | P1 |
| TC-005-34 | AC-005-03 | Store logic (happy, negative) | none | `isTheme` for the six ids and bad values (`''`, `Dark`, ` dark`, `neon`, null, undefined, 5); stored value read/fallback; throwing storage on read and write; `index.html` script ids equal `THEMES`. | Matches the AC: unknown values rejected, `vintage` fallback, no throw, store applies and persists a valid theme and ignores an unknown one, script list equals the theme list. | unit (`themeStore.test.ts`) | P1 |

## 4. Complete and readable (AC-005-04)
| ID | AC / rule | Title | Preconditions | Steps | Expected result | Level | Priority |
|---|---|---|---|---|---|---|---|
| TC-005-14 | AC-005-04 | Switching leaves no colour from the previous theme (negative) | Home | 1. Switch through the six themes and a repeat, recording every colour on the page. 2. For each theme choose it, reload, record again. | Each theme's colours after switching equal its colours after a fresh load; six distinct page backgrounds. | e2e `@home` | P1 |
| TC-005-15 | AC-005-04 | No pre-US-004 colour in any theme (negative) | Home with a field error shown | 1. In each theme list every colour on the page. | None of the six old colours appears. | e2e `@home` | P1 |
| TC-005-16 | AC-005-04, AC-004-07 | Home contrast in every theme (boundary) | Home with a field error | 1. In each theme read the ratio for title, subtitle, legend, selected and unselected choices, panel heading, label, input text, both buttons, field error. | Every ratio >= 4.5:1; ratios recorded in the run annotations. | e2e `@home` | P1 |
| TC-005-17 | AC-005-04 | Room contrast in every theme and phase (boundary) | Host and Guest in a room | 1. With the Reveal error shown, then after votes, then after reveal, read ratios in each theme for roster, muted role, `Voted`, headings, `Copy link`, `Reveal estimates`, `Revote`, selected and unselected cards, waiting text, Results heading, participation, revealed value. | Every non-disabled pair >= 4.5:1. | e2e | P1 |
| TC-005-18 | AC-005-04 | State cues beyond colour in every theme (negative) | Guest with frame control; Host voted | 1. For each theme: selected card vs unselected; pending card with `Sending vote…`; failed vote with `Vote was not confirmed. Try again.` and `Retry`; disabled cards after reveal vs enabled. | Selected differs by more than colour and is `aria-pressed=true`; pending shows the text and a non-colour cue; failed shows text and `Retry` and is not pressed; disabled cards are `disabled` and differ in opacity, cursor or border from enabled ones. | e2e | P1 |

## 5. Images and icons (AC-005-05)
| ID | AC / rule | Title | Preconditions | Steps | Expected result | Level | Priority |
|---|---|---|---|---|---|---|---|
| TC-005-19 | AC-005-05 | One distinct illustration per theme near the title (happy) | Home | 1. In each theme find SVGs at least 48 px wide; read their box and markup. | Exactly one per theme, level with the title; six different markups. | e2e `@home` | P1 |
| TC-005-20 | AC-005-05 | Heading and picker icons belong to the theme (happy) | Home | 1. Read the picker icons. 2. In each theme read the `Create room` and `Join room` heading icon and text. | Six different picker icons; heading text unchanged; each heading has one icon equal to the current theme's picker icon. | e2e `@home` | P1 |
| TC-005-21 | AC-005-05 | Room: Players and Results icons; cards show only the value (happy) | Host in a revealed room | 1. In each theme read the Players and Results heading icons and the nine cards. | Each icon equals the theme's picker icon; each card's text equals its value and contains no `svg` or `img`. | e2e | P1 |
| TC-005-22 | AC-005-05 | Ornaments exist in every theme (happy) | Home | 1. In each theme read the divider and panel ornament pseudo-elements. | Divider and panel ornaments have content in all six themes; their style signature is recorded but not asserted (F3). | e2e `@home` | P2 |
| TC-005-35 | AC-005-05 | Artwork matches each theme (visual) | Screenshots of Home and Room per theme at three viewports | 1. Mob reviews: Vintage playing cards, Light minimal card, Dark moon and stars, Ocean waves and anchor, Sunny sun, Forest tree and leaf; icons fit; nothing clipped. | Mob accepts or lists changes. Screenshots are evidence only. | manual | P2 |

## 6. Decoration is non-informational (AC-005-06)
| ID | AC / rule | Title | Preconditions | Steps | Expected result | Level | Priority |
|---|---|---|---|---|---|---|---|
| TC-005-23 | AC-005-06 | Hidden from assistive tech and keyboard (negative) | Home, each theme | 1. Inspect every `svg` for `aria-hidden`, `aria-label`, `role`, `title`, `tabindex`, `focusable`, text. 2. Count `img`, `picture`, `role=img`. 3. Read the accessibility snapshot. 4. Tab through the page. 5. Read each radio's accessible name. | Every `svg` is `aria-hidden=true` with no name, role, tab stop or text; no `img`; the snapshot has no image or graphic; every tab stop is an input or button; each radio is named exactly by its theme name. | e2e `@home` | P1 |
| TC-005-24 | AC-005-06 | No pointer blocking (negative) | Home, each theme | 1. For each input, button and label take the topmost element at its centre and four inset corners. 2. Read `pointer-events` of every `svg`, divider and ornament pseudo-element. | The topmost element is the control or its container/content; all decoration has `pointer-events: none`. | e2e `@home` | P1 |
| TC-005-25 | AC-005-06, D-005, D-007 | Decoration identical across role, phase and votes (negative) | Host and Guest in `Ocean` | 1. Record decoration markup and ornament counts (outside Results) on both pages before votes, after votes and after reveal. | All six records are equal; no decoration reveals who voted, any value, or the Host role. | e2e | P1 |
| TC-005-26 | AC-005-06 | Usable without images, icons or ornaments (negative) | Home with image requests aborted and `svg`, dividers and ornament pseudo-elements removed | 1. Read the picker, fill the fields, read the title, switch theme. | Picker names, fields and buttons remain visible and enabled; title shown; no horizontal overflow. | e2e `@home` | P2 |

## 7. Behavior unchanged (AC-005-07)
| ID | AC / rule | Title | Preconditions | Steps | Expected result | Level | Priority |
|---|---|---|---|---|---|---|---|
| TC-005-27 | AC-005-07, brief 4 | Full flow while the theme changes at every step (happy) | Host and Guest, pages marked | 1. Vote, reveal, revote, vote, reveal while switching the Host and Guest themes between steps. | Revealed values and `2 of 2 voted` are identical on both clients; Revote clears votes, hides Results and enables unselected cards; no reload on either page. | e2e | P1 |
| TC-005-28 | AC-005-07, D-005, D-007 | Guest has no Reveal/Revote and sees no value before reveal in any theme (negative) | Host voted `13` | 1. On the Guest page in each theme read the Reveal and Revote controls, waiting text and the Host row. 2. Repeat after reveal. | Zero Reveal/Revote buttons in the DOM in both phases; `Waiting for Host to reveal.` then `Waiting for Host to start a revote.`; before reveal the Host row says `Voted` and never `13`. | e2e | P1 |
| TC-005-29 | AC-005-07, AC-001-10 | Host-left screen keeps the theme and exact message (edge) | Guest chose `Dark`; Host page closes | 1. Read the Guest page. 2. Return to Home. | Exact Host-left message and `Return to Home`; the page keeps the Dark background; Home still shows `Dark` checked. (Picker presence on this screen is not asserted: Q8.) | e2e | P2 |

## 8. Layout (AC-005-08)
| ID | AC / rule | Title | Preconditions | Steps | Expected result | Level | Priority |
|---|---|---|---|---|---|---|---|
| TC-005-30 | AC-005-08, UI/UX 3 | Home layout per theme and viewport (boundary) | Three viewports x six themes | 1. Read overflow, page padding, picker position and overlap with title, subtitle, illustration and both panels, panel arrangement. | No horizontal overflow; padding 24 / 16 / 12 px; picker inside the viewport and overlapping nothing; panels side by side from 768 px and stacked at 390 px. | e2e `@home` | P1 |
| TC-005-31 | AC-005-08, UI/UX 3 | Room layout per theme and viewport (boundary) | Host in a room, three viewports x six themes | 1. Read overflow, padding, card columns, sidebar width, picker overlap, Reveal position. | No overflow; padding 24 / 16 / 12 px; cards 5 / 3 / 3 columns; Players 220 px, 180 px, full width; picker overlaps nothing; `Reveal estimates` inside the viewport width. | e2e | P1 |

## 9. No new dependency or remote asset (AC-005-09)
| ID | AC / rule | Title | Preconditions | Steps | Expected result | Level | Priority |
|---|---|---|---|---|---|---|---|
| TC-005-32 | AC-005-09 | Every theme renders with other origins blocked (negative) | All requests to other origins aborted | 1. Open Home and switch through all themes. | Six distinct backgrounds, an illustration and a picker icon in every theme, and zero requests to other origins. | e2e `@home` | P1 |
| TC-005-33 | AC-005-09 | No new dependency, raster or remote reference (static) | Build done | 1. `git diff --exit-code -- package.json`. 2. `git status --porcelain` for new image or font files. 3. Search `dist/` for `@import url(`, `fonts.googleapis`, `fonts.gstatic`, `cdn`, remote `<link>`. | No dependency change; no `.png`, `.jpg`, `.gif`, `.webp`, `.ico` or font file added; no matches in `dist/`. | command | P1 |

## Traceability
| AC | Cases |
|---|---|
| AC-005-01 | TC-005-01 .. 05 |
| AC-005-02 | TC-005-06 .. 08 |
| AC-005-03 | TC-005-09 .. 13, 34 |
| AC-005-04 | TC-005-14 .. 18 |
| AC-005-05 | TC-005-19 .. 22, 35 |
| AC-005-06 | TC-005-23 .. 26 |
| AC-005-07 | TC-005-27 .. 29 |
| AC-005-08 | TC-005-30, 31 |
| AC-005-09 | TC-005-32, 33 |

## Automation scope
| Level | Tool | Cases |
|---|---|---|
| e2e, Home only (`@home`) | Playwright | TC-005-01, 02, 03, 04, 06, 07, 09, 11, 12, 14, 15, 16, 19, 20, 22, 23, 24, 26, 30, 32 |
| e2e, needs rooms | Playwright | TC-005-05, 08, 10, 13, 17, 18, 21, 25, 27, 28, 29, 31 |
| unit | Vitest | TC-005-34 |
| command | `git`, search in `dist/` | TC-005-33 |
| manual | Mob review | TC-005-35 |

Page object: `tests/page-objects/ThemePicker.ts`. Existing page objects are reused unchanged.

## Findings from the cross-check
| # | Finding | Owner |
|---|---|---|
| F1 | AC-005-04 forbids any pre-US-004 colour, but the Light and Ocean themes use `#B3261E` for errors, the same value as the old error colour. TC-005-15 fails on both (observed). Either change those two tokens or BA relaxes the AC to the old neutral and accent colours. | Developer / BA |
| F2 | Decisions were renumbered: D-024 is now the Accepted Results decision (grouped counts, no Average or Consensus), D-025 is the US-004 theme, D-026 the US-005 themes. US-005 requirements still cite D-024 as the fixed theme, business rule 6 and AC-005-07 still mention Average and Consensus, and the dev spec and review still call the US-005 decision D-025. The app (`ResultsPanel`), `US-003.spec.ts` and the US-004 cases still use Average and Consensus. US-005 cases avoid those values on purpose. | BA / Developer |
| F3 | Interpretations made without a spec value: "header order" is DOM and Tab order; "visibly different" is distinct markup plus mob review (TC-005-35); "no visible flash" is animation-frame sampling and may need tuning; "uses only that theme's colours" is "equals a fresh load of that theme"; ornament style per theme is recorded, not asserted, because the AC states no required differences. BA to confirm. | BA |
| F4 | TC-005-22, 24 and 25 select `.ornate` and `.ornament-divider`; there is no accessible hook for decoration. These class names are an implementation contract in the dev spec and make the cases brittle. | Developer |
| F5 | The radios are visually hidden, so cases click the label and a user who tabs sees focus on the label border only; verified by outline checks (TC-005-03) but not by a screenshot. | Test |
| F6 | Room cases need Supabase env vars; only the `@home` subset can run without them. | Developer / mob |
| F7 | Not covered by design: picker presence on the Host-left screen (Q8) and automatic OS theme (out of scope; only the default is checked). | BA |

## Review before handoff
- Missing ACs: none.
- Duplicate cases: TC-005-14 and 15 both read the colour snapshot, kept apart because they test different rules.
- Isolation: separate Host and Guest browser contexts and a fresh room per test; localStorage is per context.
- Unresolved business rules (owner BA): F1 and F2; Q1 and Q3 are not decided by the mob (D-026 is Proposed).
