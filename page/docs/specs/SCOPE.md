# Scope: Websmith toolkit showcase page

Every item below is locked. Do not drop, merge or reinterpret an item without the owner's OK. Questions go in PLAN.md "Open questions".

## What it is

- A public showcase page for the open-source `websmith-toolkit` repository (skills, animations, motion kit, installers).
- Hosted as a static site on GitHub Pages. No server of our own.
- Anyone who runs their own Websmith builder bot can use it: they paste their own Websmith webhook URL and key. The key stays in their browser.
- Original, futuristic design. No borrowed brand look, logos or names from any other product.
- First version: about one day of work, split into rounds R2 to R4.

## Theme (locked)

- A futuristic builder blueprint throughout: dark grid, cyan construction lines, dimension marks, monospace labels.
- Helper cursors draft each section as a wireframe, then fill it in.
- Light mode is pale blueprint paper with ink-blue lines.
- Neon colors, lots of blue liquid glass, rich shading and animation.
- The page should be fun to use: everything reacts to the pointer and is rewarding to play with.

## Features

### Shell and theme
1. Dark and light mode with a glass toggle (spec: TOGGLE-SPEC.md, inspired by @kaolti, built original).
2. Startup-only build-swarm reveal: helper cursors assemble the page (spec: INTRO-SPEC.md, inspired by @hrstwt, built original).
3. A "Shut down" button: the helpers pack the page up in reverse.
4. ASCII wake hero (in the style of the MIT `ascii-wake` effect, rebuilt original) that greets the owner by the name they saved locally.
5. Data cables flowing data from card to card (spec: CABLES-SPEC.md, inspired by flandermaxx, built original).
6. Liquid fusing skill chips and setup steps, in original WebGL2 code.

### Toolkit showcase
7. Every toolkit item (skill, animation, motion kit part, installer) as a card, built from the repository contents.
8. Search, filters and a "what's new" marker.
9. Each card has one brief, very easy-to-read, plain-English line saying what it does. (These lines are required; they are exempt from any "cut helper text" rule.)
10. Each card can play a tiny live demo. Non-visual tools get an animated before and after.

### Connection and setup
11. Connection status indicator.
12. First-time setup for the Websmith webhook URL and key. The key is stored only in the browser (localStorage) and is never sent anywhere except the owner's own webhook.
13. Setup asks "Want to connect Claude or ChatGPT?" with the choices Claude, ChatGPT or Not now. It can be connected later from settings.
14. Choosing one runs an opt-in "Find my login": the owner's own local Websmith checks only whether a Claude Code or Codex CLI login is signed in. It never reads or copies tokens.
15. The page then shows "Found Claude, connect?" (or ChatGPT) and the user taps Connect.
16. An API key is an alternative, kept in the browser only.
17. Never auto-detect or pre-tick a login.

### Chat
18. A chat with Websmith (through the owner's webhook), with ThinkingOrbs as the thinking indicator.
19. A picker for the 9 ThinkingOrbs presets.

### Plan sheet and workers
20. A "Plan" sheet: Websmith plans the project with toolkit skills and keeps suggesting design improvements while the owner plans.
21. Nothing builds until the user presses "Let's do it!".
22. A "Copy plan" button on the Plan sheet.
23. Worker choice: Claude or ChatGPT. The bot sends the plan, and the worker uses the toolkit from GitHub through an AGENTS.md and CLAUDE.md pointer. Pushing needs the owner's OK.
24. A status trail after "Let's do it!": Planned, Sent, Building, Done. A glowing line fills from stage to stage, each node gets a liquid pulse, and Done ends in a particle burst.

### Control and trust (original versions of ideas from an "ask first" pattern)
25. A "Needs your OK" card whose buttons name the action (for example "Push to GitHub", not "Yes").
26. A "Didn't need to ask" button that tells Websmith it can do that kind of action on its own next time.
27. Autonomy levels shown in two columns: "Does on its own" and "Asks you first".
28. Live previews for each setting.
29. A preview of the target, outlined.
30. Usage bars with reset times.

### Personalization, install, access
31. Personalization questions (name, accent, orb, density and similar), saved as a local theme.
32. An installable PWA (manifest, icons, service worker, offline shell).
33. Full keyboard support and screen-reader labels.
34. No reduced-motion work in v1 (owner decision).

## Build rules
35. Use every toolkit skill while building the page. Each skill is on the build checklist and applied where it fits. At the end, deliver a list of each skill and where it was used.
36. Self-host every asset. No CDNs.
37. Reference videos and study code are never copied into the project.

## Run plan
- Setup, then R1 (plan), R2 (showcase), R3 (connection, chat and orbs), R4 (personalization, PWA and accessibility).
- Then a private preview, QA, the owner's OK, and only then public GitHub Pages.

## Owner decisions (2026-11-24)

These settle PLAN.md section 10. They are locked like the items above.

- D1. Hosting: the page lives in the `websmith-page` GitHub organization. The later Pages URL is `https://websmith-page.github.io/websmith-page/` or the org root. Only config changes between the two (relative base path); no code depends on it.
- D2. Source links on cards point to the toolkit at `github.com/GHOST00TSOHG/websmith-toolkit` (set in `site.config.json`).
- D3. The iPhone Home Screen app has its own storage, so setup runs again there. Accepted.
- D4. Webhook URLs must be `https://`. Reject anything else in setup with a clear message.
- D5. The worker API key never leaves the browser. The page never sends it, not even to the owner's webhook. The owner's bot uses its own Claude or ChatGPT login. (Item 16 stays: the key field exists, is stored locally, and has Forget; it is used only for features that run in the browser, or kept for later.)
- D6. `axe-core` is allowed as a dev-only dependency for tests. It is never shipped.
- D7. `lottie-web` is lazy-loaded only when a Lottie demo plays. The footer carries "Emoji animations: Animated Noto Emoji by Google, CC BY 4.0".
- D8. The weather card demo uses our own WebGL2 code, not three.js.
- D9. Sound plays only inside the audio card's demo. No UI sounds.
- D10. The intro is skippable (any key or click) and short for returning visitors (full once, then a quick version, about 0.6 s).
- D11. "Shut down" ends on a Wake button. No data is lost.
- D12. A one-field name prompt ("What should I call you?") ships in R2 in the hero. The full personalization questions stay in R4.
- D13. Fonts: Space Grotesk and JetBrains Mono, self-hosted woff2 (OFL).
- D14. Status updates use polling in v1.
- D15. Skills that genuinely don't fit this page are marked "not used here" in docs/SKILL-USAGE.md, with one honest line why. No forced mappings.
- D16. Item 34 means: build no reduced-motion features. There is no test that enforces the absence of such code.
- D17. Acceptance for "everything reacts and is rewarding to play with": every card, chip and control has a visible hover, press and (where it makes sense) drag response, proven by a Playwright check that hovers and presses each one and asserts a computed style or transform change.

### Item 6 behaviour note (from study notes; original code only)
The liquid chips and setup steps behave like a glass step bar: one liquid front moves through the steps; between neighbouring steps small buds grow toward each other, snap into a neck and fuse; draining stretches, pinches and recoils the neck; hover previews the next step; a completed step slides its label aside and draws a check. Keyboard: arrows, Space, Home, End. Write it from scratch; never copy the study files.
