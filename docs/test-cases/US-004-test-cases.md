# US-004 Test Cases: Vintage UI refresh

Sources: [requirements](../requirements/US-004-vintage-bootstrap-ui.md), [dev spec](../specs/US-004-dev-spec.md), [UI/UX](../design/ui-ux.md), [decisions](../knowledge/decisions.md), US-001..US-003 requirements.
Status: designed (rev 2, covers requirements rev 3 / AC-004-09..11), NOT RUN. Q1 (themes) and Q6 (avatars/illustration) are not yet recorded as mob decisions; the Developer implemented on the instruction to implement. Priority: P1 = must pass for story done, P2 = should pass.
Techniques: equivalence classes (palette roles, viewport classes), boundary values (viewport widths 390 / 768 / 1280, 44 px target, 4.5:1), state transitions (voting, pending, failed, revealed, Host-left), regression of unchanged behavior.

Expected results come from the ACs, D-005/D-006/D-007/D-011/D-015, UI/UX sections 2-6 and the US-001..US-003 ACs. The spec is used for planned file names and tokens only. Palette expectations are hue/lightness classes written from the AC wording, not the spec hex values, so Q4 can change the values without changing the cases.

## Conventions

| Item | Value |
|---|---|
| e2e contexts | `Host` = browser context 1 (`Maya`), `Guest` = a separate context (`Noah`). Fresh room per test. |
| Palette classes (computed `rgb`, converted to HSL) | `paper-tone`: L >= 85%, S <= 60%, hue 25-55 deg, not pure white. `ink-brown`: L <= 25%, hue 0-40 deg, S >= 10% (not neutral grey or black). `brick-accent`: hue 0-30 deg, S 30-80%, L 15-40%. `muted-red`: hue <= 15 or >= 345 deg, S <= 80%, L <= 45%. Proposed by Test from the AC wording; BA/mob to confirm (Q4). |
| Old palette (must be absent) | `rgb(69,90,100)` `#455A64`, `rgb(241,243,244)` `#F1F3F4`, `rgb(38,50,56)` `#263238`, `rgb(84,110,122)` `#546E7A`, `rgb(179,38,30)` `#B3261E`, `rgb(0,95,204)` `#005FCC`, and Tailwind default `slate`/`white` classes. |
| Contrast probe | For each element take computed `color` and the first non-transparent ancestor `background-color`; ratio = WCAG relative luminance formula. Disabled controls are excluded (WCAG exempts inactive components). |
| Viewports | Desktop 1280x720, Tablet 768x1024, Narrow 390x844 (UX-01, UX-02). |
| Frame control | As in the US-002 cases: `routeWebSocket` with `drop-intent` and `delay-ack` on the Guest page. |
| Layout baseline | Container widths and paddings are measured on the pre-US-004 commit and recorded in the verification report; "unchanged" means equal to that baseline (see Finding F4). |
| e2e file | `tests/e2e/US-004.spec.ts`; page objects in `tests/page-objects/`. Static scan: `src/features/room/theme.static.test.ts` (Vitest, reads files with `node:fs`). |

## AC coverage

| AC | Case IDs | Level | Gap or note |
|---|---|---|---|
| AC-004-01 | TC-004-01, 02 | e2e | none |
| AC-004-02 | TC-004-03, 04 | e2e | Header "connection feedback" has no UI today (F1); only observable states are covered |
| AC-004-03 | TC-004-05, 06, 07, 08 | e2e, unit (static) | none |
| AC-004-04 | TC-004-09 .. 15 | e2e, unit (static) | US-002 and US-003 e2e do not exist yet (F2) |
| AC-004-05 | TC-004-16, 17, 18 | e2e | Container max-width compared to baseline (F4) |
| AC-004-06 | TC-004-19 .. 23 | e2e | `Connection lost. Reconnecting…` state not implemented (F1); sub-case BLOCKED |
| AC-004-07 | TC-004-24 .. 28 | e2e | none |
| AC-004-08 | TC-004-29, 30, 31 | e2e, unit (static), manual | Deployed-URL run NOT RUN until a URL exists |
| AC-004-09 | TC-004-34 | e2e | none |
| AC-004-10 | TC-004-35 | e2e | none |
| AC-004-11 | TC-004-37, 38, 39 | e2e | none |
| AC-004-05 / 07 / 08 rev 3 lines | TC-004-18, 36, 31 | e2e, command | Overlap, contrast over texture, asset provenance |
| Brief criterion 6 (via AC-004-08) | TC-004-32 | e2e | Needs `PLAYWRIGHT_BASE_URL` |
| Scope item "thin rule borders", UX-01/02 look | TC-004-33 | manual | No AC for it (F5) |

## 1. Home screen (AC-004-01)

| ID | AC / rule | Title | Preconditions | Steps | Expected result | Level | Priority |
|---|---|---|---|---|---|---|---|
| TC-004-01 | AC-004-01 | Home panels and primary buttons (happy) | Open `/` at 1280x720 | 1. Read computed style of regions `Create room` and `Join room`, buttons `Create room`, `Join room`, and the title and subtitle. | Both regions are separate bordered panels: border width >= 1 px on all four sides, border style not `none`, background `paper-tone`, panel background differs from the old `#F1F3F4`. Both buttons have a `brick-accent` background and light text. Title `Story Pointing` and subtitle `Estimate together, without signing up.` unchanged. Each input is reachable by label (`Display name`, `Room code`). | e2e | P1 |
| TC-004-02 | AC-004-01, AC-001-03 | Home restyle keeps share-link prefill (regression) | Open `/?room=abc123` | 1. Read `Room code` and `Display name` values. | Room code field shows the prefilled code, `Display name` is empty, no room is joined (still Home). Theme classes do not alter field values. | e2e | P2 |

## 2. Room shell (AC-004-02)

| ID | AC / rule | Title | Preconditions | Steps | Expected result | Level | Priority |
|---|---|---|---|---|---|---|---|
| TC-004-03 | AC-004-02, UX-01 | Room shell elements use the theme and keep structure (happy) | Host `Maya`, Guest `Noah` in room `R`, phase `voting`, 1280x720 | 1. Read computed style of the header, `Copy link`, `Players (2)` section, a card, `Reveal estimates` (Host), `Phase` heading. 2. Read bounding boxes of the roster, the card grid and the Reveal button. | Every listed element uses palette classes only: backgrounds in `paper-tone` or `brick-accent`, text `ink-brown` or a muted ink; none uses the old palette. Roster is left of the card grid; Reveal sits below the grid (box top > grid bottom). Header shows room code and `Copy link`. | e2e | P1 |
| TC-004-04 | AC-004-02 | Results panel uses the theme after reveal (happy) | Room `R`; Host votes `5`, Guest votes `8`; Host reveals | 1. Read computed style of `results-panel`, heading `Results`, `results-average`, `results-consensus`, `results-participation`. | Panel and text use palette classes, none from the old palette. Values: Average `6.5`, Consensus `No`, `2 of 2 voted` (D-009, D-010, D-022). | e2e | P1 |

## 3. One vintage theme (AC-004-03)

| ID | AC / rule | Title | Preconditions | Steps | Expected result | Level | Priority |
|---|---|---|---|---|---|---|---|
| TC-004-05 | AC-004-03 | Page background and text are paper and ink on every screen (happy) | Screens: Home, Room `voting`, Room `revealed`, Host-left (Host closes its page) | 1. On each screen read computed `background-color` of `body` or the page root, and `color` of body text. | Background is `paper-tone` (not white) and text is `ink-brown` on all four screens. Computed background is identical across the four screens. | e2e | P1 |
| TC-004-06 | AC-004-03 | One accent for primary actions and selected cards (happy) | Room `R`, Host voted `5`, phase `voting` then `revealed` | 1. Read background of `Create room`, `Join room`, `Copy link`, `Reveal estimates`, selected card `5`. 2. After reveal, read `Revote`. 3. Read `Return to Home` on the Host-left screen. | All of them are `brick-accent` and the same computed color. | e2e | P1 |
| TC-004-07 | AC-004-03 | Errors use one muted red; headings use serif (happy) | Trigger: empty create name (field error), failed vote (`drop-intent`), Reveal with zero votes (`reveal-error`), Host-left alert | 1. Read `color` of each error text. 2. Read computed `font-family` of `h1`, `h2`, `h3` on Home and Room. | All error texts share one `muted-red` color. Headings' font-family ends with the generic `serif` (not `sans-serif`) on both screens. | e2e | P1 |
| TC-004-08 | AC-004-03 | No old palette remains in source (negative) | Source after implementation | 1. Scan `src/**/*.{ts,tsx,css}` for the old hex values (case-insensitive), for `slate-`, `gray-`, `bg-white`, and for arbitrary color classes `[#`. 2. Scan computed styles on Home and Room for the old `rgb` values. | Step 1 and 2 find zero matches. (`border-slate-400` in `HomePage.tsx` and `RoomShell.tsx` and `bg-white` in `HomePage.tsx` are the known risk, F3.) | unit (static) + e2e | P1 |

## 4. Behavior and copy unchanged (AC-004-04)

| ID | AC / rule | Title | Preconditions | Steps | Expected result | Level | Priority |
|---|---|---|---|---|---|---|---|
| TC-004-09 | AC-004-04, brief 4, 5 | Full flow without reload (happy) | Host `Maya`, Guest `Noah`; set `window.__marker = 1` on both pages | 1. Host creates room; Guest joins by code. 2. Host votes `5`, Guest votes `8`. 3. Host `Reveal estimates`. 4. Host `Revote`. 5. Both vote `5`; Host reveals. | Step 3: both clients show identical per-Participant values `5` and `8`, Average `6.5`, Consensus `No`, `2 of 2 voted`. Step 4: phase `voting`, votes and Results cleared. Step 5: Average `5`, Consensus `Yes`. `window.__marker` still `1` and no `framenavigated` after step 1 (no reload). | e2e | P1 |
| TC-004-10 | AC-004-04, D-007 | Guest DOM has no Reveal or Revote (negative) | Host and Guest in `R` | 1. In `voting` count buttons named `Reveal estimates`, `Revote` in the Guest page. 2. Host reveals; recount. 3. Read the Guest waiting text in both phases. | Count is 0 in the DOM (not merely hidden) in both phases. Texts `Waiting for Host to reveal.` then `Waiting for Host to start a revote.`. Host page shows `Reveal estimates` in `voting` and `Revote` in `revealed`. | e2e | P1 |
| TC-004-11 | AC-004-04, D-005 | Other votes never visible before reveal (negative) | Host `Maya`, Guests `Noah`, `Linh` | 1. Noah votes `13`, Linh votes `?`. 2. In each context read the Players rows. | Other rows show only `Voted` or `Not voted`; no card text in any other row; a Participant's own card shows `aria-pressed=true`. Same result in the restyled UI as before. | e2e | P1 |
| TC-004-12 | AC-004-04, AC-001-05..06 | Validation and error copy exact and linked (regression) | Home | 1. Submit Create empty; name of 21 chars. 2. Submit Join empty code; code `ab`. 3. Join a nonexistent well-formed code. | Messages exact: `Enter a display name.`, `Display name must be 20 characters or fewer.`, `Enter the room code.`, `Room code must be 6 letters or digits.`, `Room not found or unreachable. Check the code and try again.`. Each field error has `role=alert` and the input `aria-describedby` points to it; typed input is retained. | e2e | P1 |
| TC-004-13 | AC-004-04, D-015 | Results copy: empty and all-`?` sets (edge) | Room with Host and Guest | 1. Host reveals with zero votes. 2. Both vote `?`; Host reveals. | Step 1: `At least one vote is required to reveal` (D-021), still `voting`. Step 2: Average `—`, Consensus `—`, `2 of 2 voted`, each row shows `?`. | e2e | P1 |
| TC-004-14 | AC-004-04 | Selector inventory is intact (static) | Source after implementation | 1. Assert each `data-testid` from the US-001..US-003 UI contracts exists in `src`: `room-code`, `players-list`, `player-vote`, `phase-heading`, `room-phase`, `phase-waiting`, `vote-cards`, `vote-status`, `vote-error`, `reveal-error`, `results-panel`, `results-heading`, `results-average`, `results-consensus`, `results-participation`, `connection-status`, `form-error`. 2. `git diff --stat` for `src/domain`, `src/realtime`, `src/types`, `tests/`, `package.json`. | All ids present. Step 2: no changes outside the five files named in the spec. | unit (static) + manual command | P1 |
| TC-004-15 | AC-004-04 | Existing suites pass unchanged (regression) | Implementation done | 1. `npm run build`. 2. `npm test`. 3. `npm run test:e2e` with the `US-001.spec.ts` untouched. | PASS for all, counts recorded, no test file edited to make them pass. Report that `US-002.spec.ts` and `US-003.spec.ts` do not exist, so their ACs have no e2e regression proof except TC-004-09..13 (F2). | unit + e2e | P1 |

## 5. Layout contract (AC-004-05)

| ID | AC / rule | Title | Preconditions | Steps | Expected result | Level | Priority |
|---|---|---|---|---|---|---|---|
| TC-004-16 | AC-004-05, UI/UX 3 | Room layout per viewport (boundary) | Host and Guest in `voting` | For each of 1280x720, 768x1024, 390x844 on the Host page: 1. Read sidebar width, grid column count, grid gap, page padding, card min-height. | Desktop: sidebar 220 px, 5 columns, gap 12 px, padding 24 px, card height >= 112 px. Tablet: sidebar 180 px, 3 columns, gap 12 px, padding 16 px, card >= 96 px. Narrow: single column ordered header, Players, main; 3 columns, gap 8 px, padding 12 px, card >= 88 px. Nine cards, no blank filler cards. Container max-width equals the baseline (F4). | e2e | P1 |
| TC-004-17 | AC-004-05 | Home layout per viewport (boundary) | Open `/` at the three viewports | 1. Read padding and whether `Create room` and `Join room` stack. | Padding 24/16/12 px; the two panels are side by side from 768 px (`md`) and stacked at 390 px, matching the pre-US-004 baseline. | e2e | P2 |
| TC-004-18 | AC-004-05 | No overflow or clipped action (negative) | Host `Maya`, Guests with 20-character names (`Aaaaaaaaaaaaaaaaaaaa`, `Bbbbbbbbbbbbbbbbbbbb`); states `voting` and `revealed` | At each viewport: 1. `document.documentElement.scrollWidth <= clientWidth`. 2. Scroll `Reveal estimates` / `Revote` into view; read its box. 3. Check row names do not overlap their `Voted` status. 4. Home with a field error visible. 5. (rev 3) For the Home illustration, dividers and panel ornaments, read bounding boxes and compare with the boxes of every heading, label, input, button, card and text node. | No horizontal overflow on Home, Room `voting`, Room `revealed`, Host-left. Action fully inside the viewport width after scrolling. Names wrap, no overlap with status text. Step 5: no decoration box intersects any text, field, card or button box; container and sidebar measurements equal TC-004-16 values. | e2e | P1 |

## 6. State distinction (AC-004-06)

| ID | AC / rule | Title | Preconditions | Steps | Expected result | Level | Priority |
|---|---|---|---|---|---|---|---|
| TC-004-19 | AC-004-06, UI/UX 6 | Selected vs unselected card (happy) | Guest in `voting` | 1. Guest clicks `5`; wait for `aria-pressed=true`. 2. Compare computed style of `5` with `3`. | `5` has `aria-pressed=true` and a non-color visual cue different from `3` (border style or width, outline or box-shadow, or font-weight), plus a different background. A fill-color-only difference fails. | e2e | P1 |
| TC-004-20 | AC-004-06 | Pending and failed cards (happy, negative) | Guest, `delay-ack` then `drop-intent` | 1. Click `5` with a delayed ack; read card and text. 2. Click `8` with `drop-intent`; wait for the message. | Pending: text `Sending vote…`, `data-selection=pending`, border style differs from default (dashed) and from `aria-pressed` selection. Failed: text `Vote was not confirmed. Try again.`, `data-selection=failed`, `Retry` button visible, card not `aria-pressed=true`. | e2e | P1 |
| TC-004-21 | AC-004-06, AC-002-05 | Disabled cards after reveal (happy) | Host revealed the round | 1. Read a card on Host and Guest. 2. Compare with an enabled card from the voting phase. | Cards have the `disabled` attribute and differ visually from enabled cards by a non-color property (opacity, cursor `not-allowed`, or border style); the `Voted`/value text in the roster is shown as text. | e2e | P1 |
| TC-004-22 | AC-004-06, AC-002-06 | Disabled while `Connection lost. Reconnecting…` | n/a | BLOCKED: the message and state do not exist in `src` (F1). No expectation beyond the AC is finalized. | Re-open after US-002 AC-002-06 is implemented. | e2e | P2 (blocked) |
| TC-004-23 | AC-004-06 | Field error and roster status are text (happy) | Home with empty create name; Room with `Voted` / `Not voted` rows | 1. Read the error and roster status nodes. | Field error text is visible text, not only a red border; roster shows `Voted` or `Not voted` text. | e2e | P2 |

## 7. Accessibility (AC-004-07)

| ID | AC / rule | Title | Preconditions | Steps | Expected result | Level | Priority |
|---|---|---|---|---|---|---|---|
| TC-004-24 | AC-004-07 | Text and button contrast on Home (boundary) | Home, with a field error and the `Connecting…` status shown | 1. For each pair in the contrast probe list: body text, subtitle, labels, input text on input background, `Create room` / `Join room` text on accent, field error on panel, `form-error`. | Every ratio >= 4.5:1; record the ratio per pair in the verification report. | e2e | P1 |
| TC-004-25 | AC-004-07 | Text and button contrast in Room (boundary) | Room `voting` then `revealed`, with a failed vote and a reveal error | 1. Probe: roster text and muted text, `Voted` rows, `phase-waiting`, `Copy link`, `Reveal estimates`, `Revote`, `Retry`, selected and unselected cards, `vote-error`, `reveal-error`, Results text and `dt` labels, Host-left alert and `Return to Home`. | Every non-disabled pair >= 4.5:1; ratios recorded. Pairs below the target are failures even if close. | e2e | P1 |
| TC-004-26 | AC-004-07 | Visible focus on every interactive element (happy) | Home, Room (Host and Guest), Host-left | 1. Press `Tab` through the page and read the focused element's computed `outline-style`, `outline-width`, `outline-color`, then read `box-shadow` if outline is `none`. 2. Note focus order. | Each focused input, button and card has a visible indicator (outline width > 0 and style not `none`, or an equivalent ring), and the indicator color differs from the control's background. Order follows DOM order (header, roster, cards, action). Record whether the indicator reaches 3:1 against the adjacent background (informational). | e2e | P1 |
| TC-004-27 | AC-004-07, UI/UX 6 | Touch targets at least 44x44 (boundary) | Home, Room voting, Room revealed (Host), failed-vote state | 1. Read the bounding box of every button, card and `Retry` at 1280x720 and 390x844. | Width and height >= 44 px for each; cards >= 88 px tall at 390 px. | e2e | P1 |
| TC-004-28 | AC-004-07 | Field errors stay linked (regression) | Home | See TC-004-12 for messages. 1. Read `aria-invalid`, `aria-describedby`, `role=alert` for each invalid field after restyle. | Linked in every case; no error shown by color only. | e2e | P1 |

## 8. No new dependency or remote asset (AC-004-08)

| ID | AC / rule | Title | Preconditions | Steps | Expected result | Level | Priority |
|---|---|---|---|---|---|---|---|
| TC-004-29 | AC-004-08 | Theme applies with third-party origins blocked (negative) | Route all `http(s)` requests whose origin differs from the app origin to `abort` | 1. Open Home. 2. Read the page background and an h1 font-family. 3. Record all request origins. | Page renders with `paper-tone` background and serif heading; zero requests to other origins; no failed font or stylesheet request. | e2e | P1 |
| TC-004-30 | AC-004-08 | Build output has no remote CSS or font reference (static) | `npm run build` done | 1. Search `dist/` and `index.html` for `@import url(`, `fonts.googleapis`, `fonts.gstatic`, `cdn`, `<link ... href="http`, and `@font-face` with `url(http`. | No matches. | unit (static) / command | P1 |
| TC-004-31 | AC-004-08 | No new dependency (static) | Implementation done | 1. `git diff --exit-code -- package.json`. 2. Check no `bootstrap` entry in any `package.json` field. 3. (rev 3) List new tracked or untracked files (`git status --porcelain`). | Exit code 0 and no new dependency; a changed lockfile, if present, shows no new package. Step 3: no image binary (`.png`, `.jpg`, `.gif`, `.webp`, `.ico` or font file) was added; new assets are project-authored source (TSX, CSS), so no third-party license applies (Q7). | command | P1 |

## 9. Deployment and visual review

| ID | AC / rule | Title | Preconditions | Steps | Expected result | Level | Priority |
|---|---|---|---|---|---|---|---|
| TC-004-32 | AC-004-04, brief 6, D-013 | Happy path on the public URL (happy) | Deployed Vercel URL, `PLAYWRIGHT_BASE_URL` set | 1. Run TC-004-09 against the URL. | PASS with the actual URL and browser recorded. NOT RUN until a URL exists. | e2e | P2 |
| TC-004-33 | scope item, UX-01, UX-02 | Vintage look review by the mob (visual) | Screenshots of Home, Room `voting`, Room `revealed`, Host-left at the three viewports | 1. Mob reviews: warm paper look, serif headings, thin rule borders, nothing clipped, no leftover blue-gray, decoration tasteful and not distracting. | Mob accepts or lists changes. Screenshots are evidence only; no pixel baseline is asserted because Q3/Q4/Q8 may change palette and motif. | manual | P2 |

## 10. Decoration and imagery (AC-004-09, 10, 11 and rev 3 lines)

| ID | AC / rule | Title | Preconditions | Steps | Expected result | Level | Priority |
|---|---|---|---|---|---|---|---|
| TC-004-34 | AC-004-09 | Home decoration present and scaled (happy, boundary) | Open `/` at 1280x720, 768x1024, 390x844 | 1. Count decorative graphics near the title (inline `svg` or `img`). 2. Locate the divider under the title block. 3. For both panels read `::before` and `::after` computed `content` and `position`. 4. Read the illustration width at each viewport. 5. At 390 px read `scrollWidth` and whether `Create room` can be reached by vertical scrolling only. | Exactly one illustration near the title; one divider after the title block; both panels have corner ornaments (`content` not `none`, absolutely positioned). Illustration width at 390 px is smaller than at 1280 px, or it is not displayed. No horizontal scroll; `Create room` reachable. Title text and subtitle unchanged. | e2e | P1 |
| TC-004-35 | AC-004-10 | Room decoration without structural change (happy) | Host `Maya`, Guest `Noah`; phases `voting` and `revealed`; Host-left screen | 1. On Host and Guest pages in both phases locate the divider in the header area. 2. Read `body` `background-image`. 3. Read the Players and Results panels' pseudo-element `content`. 4. Re-run the structure check of TC-004-03 (roster left, cards right, action below). 5. Inspect card buttons: child elements, `::before`/`::after` content and `background-image`. 6. On Host-left read the first `role=alert` text. | Divider present on every screen state; `body` has a texture `background-image` (not `none`) and a flat `background-color` that is `paper-tone`; panels show corner ornaments. Structure identical to TC-004-03. Card buttons contain only their value text, no `svg`/`img` child, no pseudo-element content and `background-image: none`. Host-left alert text is `The Host closed the room. Return to Home to start or join another room.`. | e2e | P1 |
| TC-004-36 | AC-004-07 rev 3 | Contrast holds over texture and ornaments (boundary) | Home, Room `voting`, Room `revealed` at 1280x720 | 1. For title, subtitle, `Phase` heading and header text that sit on the page background: make text transparent, screenshot the text's box, and take the lowest-luminance or lowest-contrast pixel as the background. 2. Compute ratio with the text color. 3. For text inside panels, check that the panel text box lies at least 8 px inside the panel edge band that holds the ornaments. | Every ratio >= 4.5:1 against the worst pixel; text inside panels does not enter the ornament band. Record the ratios. | e2e | P1 |
| TC-004-37 | AC-004-11 | Decoration hidden from assistive tech and keyboard (happy) | Home and Room (Host) | 1. Take an accessibility snapshot of each screen. 2. Tab through the page. 3. Read each decorative element for `aria-hidden`, `tabindex`, text content, and `role`. 4. Count `img` elements in the app. | The snapshot lists no image, graphic, separator or decoration node and no name from decoration. Focus never lands on a decorative element. Each decorative element is `aria-hidden="true"` (or a pseudo-element), has no `tabindex`, empty text content and no role. Zero `img` elements (no raster files, spec). | e2e | P1 |
| TC-004-38 | AC-004-11 | Decoration never blocks interaction (negative) | Home, Room (Host and Guest), `voting` | 1. For each input, button and card read `document.elementFromPoint` at its center and at 4 px inside each corner. 2. Read computed `pointer-events` of decorative elements. 3. Create a room, join, vote, reveal using real clicks. | The topmost element at each point is the control or its descendant; decorative elements have `pointer-events: none`; the full flow works with clicks. | e2e | P1 |
| TC-004-39 | AC-004-11, D-005, D-007, rule 4 | Decoration is identical for every role, phase and vote state (negative) | Host `Maya`, Guest `Noah`, Guest `Linh` | 1. Capture the outer HTML of all decorative elements and the pseudo-element `content` values on Home and on each Room page before any vote. 2. Cast votes; capture again. 3. Reveal; capture again. 4. Compare Host and Guest pages. | Captured decoration is identical across roles, across before-vote, after-vote and after-reveal, and between Participants. No decoration reveals who voted, any value, or the Host role. | e2e | P1 |
| TC-004-40 | AC-004-11 | Content usable when decoration or images are absent (negative) | Home and Room | 1. Abort all requests with resource type `image`. 2. In a second run inject a style `svg, .ornament-divider { display: none }` and disable `ornate` pseudo-elements (`content: none`). 3. Run create > join > vote > reveal > revote. 4. Check overflow. | The flow completes; all labels, messages and actions remain visible and usable; no horizontal overflow; the Home illustration absence leaves the title intact. | e2e | P2 |

## Traceability

| AC | Cases |
|---|---|
| AC-004-01 | TC-004-01, 02 |
| AC-004-02 | TC-004-03, 04 |
| AC-004-03 | TC-004-05 .. 08 |
| AC-004-04 | TC-004-09 .. 15, 32 |
| AC-004-05 | TC-004-16 .. 18 |
| AC-004-06 | TC-004-19 .. 23 |
| AC-004-07 | TC-004-24 .. 28 |
| AC-004-08 | TC-004-29 .. 31 |
| AC-004-09 | TC-004-34 |
| AC-004-10 | TC-004-35 |
| AC-004-11 | TC-004-37 .. 40 |
| Rev 3 lines of AC-004-05, 07, 08 | TC-004-18, 36, 31 |

## Automation scope

| Level | Tool | Cases |
|---|---|---|
| e2e | Playwright (`tests/e2e/US-004.spec.ts`) | TC-004-01 .. 07, 09 .. 13, 16 .. 21, 23 .. 29, 32, 34 .. 40 |
| unit (static) | Vitest (`src/features/room/theme.static.test.ts`) | TC-004-08 (source part), 14, 30 |
| command | `npm run build`, `npm test`, `npm run test:e2e`, `git diff` | TC-004-15, 30, 31 |
| manual | Mob review | TC-004-33 |
| blocked | n/a | TC-004-22 |

Commands come from `package.json`: `build`, `test`, `test:e2e`. Cases 12, 13, 19-21 need `routeWebSocket` helpers shared with the US-002 cases.

## Findings from the cross-check

| # | Finding | Owner |
|---|---|---|
| F1 | `Connection lost. Reconnecting…` and a header connection indicator do not exist in `src` (searched). AC-004-06 (disabled while disconnected) and the "connection feedback" part of AC-004-02 cannot be verified; TC-004-22 is blocked. | Developer (US-002 AC-002-06) |
| F2 | Only `tests/e2e/US-001.spec.ts` exists. US-002 and US-003 e2e specs are not written, so "existing Playwright selectors resolve" (AC-004-04) has no regression proof for voting and results. TC-004-09..13 cover this for US-004; Test should write the US-002/003 specs in execution mode. | Test |
| F3 | The spec's task 6 searches for arbitrary hex classes, but `HomePage.tsx` and `RoomShell.tsx` also use `border-slate-400` and `bg-white`, which belong to the old palette under AC-004-03. TC-004-08 scans for them; the spec task should include them. | Developer |
| F4 | UI/UX section 3 states a page max-width of 1280 px, while the code uses `max-w-5xl` (Room) and `max-w-3xl` (Home). AC-004-05 says "preserved", so cases compare to the pre-US-004 baseline; the doc/code mismatch is a separate question. | BA / Developer |
| F5 | The story scope lists "thin rule borders" but no AC requires them except bordered panels in AC-004-01. Verified by TC-004-33 only. | BA |
| F6 | `text-sm` error text (14 px) is below the UI/UX body-text target of 16 px; not an AC-004 failure. Contrast is still checked at 4.5:1. | Developer (observation) |
| F7 | Decorations are specified as inline SVG and CSS pseudo-elements, so "images failing to load" (AC-004-11) cannot occur for them; TC-004-40 therefore also simulates their absence. If the mob later supplies raster artwork, TC-004-29, 31 and 40 need `img` and alt-text cases. | Test |
| F8 | Q1 and Q6 are not recorded decisions; implementation followed the instruction to implement. Cases are valid only if the mob confirms both, otherwise AC-004-09..11 must be removed. | Mob |

## Review before handoff
- Missing ACs: none; AC-004-06 `Connection lost` sub-case is blocked (F1). AC-004-09..11 are covered by TC-004-34..40.
- Duplicate cases: TC-004-12 and 28 share setup; kept separate for AC traceability.
- Isolation: separate Host and Guest browser contexts and a fresh room per test; blocking and `routeWebSocket` are per page.
- Unresolved business rules (owner BA/mob): Q1 (themes out of scope) and Q6 (avatars/illustration) are unrecorded; Q3/Q4 palette values and Q8 motif are not asserted, only hue/lightness classes and presence of one illustration. The classes themselves are Test proposals for BA to confirm.
- Cases are designed from the ACs and decisions; none has been run.
