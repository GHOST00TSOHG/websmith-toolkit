# PLAN: Websmith toolkit showcase page

Written in R1. Planning only. No code exists yet. SCOPE.md wins over this file. Where this plan proposes something that SCOPE.md does not say, it is marked **proposal** and listed in section 10 if it needs the owner's OK.

---

## 0. Owner decisions (2026-11-24): folded into the body in R2

These decisions are now written into sections 2.4, 5.1, 6, 9 and 10 below. If anything still disagrees, this section wins.

See `docs/specs/SCOPE.md` "Owner decisions" D1 to D17. Summary of what changes in this plan:
- Q1, Q11: hosting in the `websmith-page` org; Pages URL `https://websmith-page.github.io/websmith-page/` or the org root, config only. Source links show `GHOST00TSOHG/websmith-toolkit`.
- Q5: https webhooks only. Q6: the API key never leaves the browser; the bot uses its own login. `worker.connect` never carries a key.
- Q7: axe-core allowed as a dev-only test dependency (`@axe-core/playwright`). Replace the custom-only checks with axe plus the custom keyboard walk.
- Q8: lottie-web lazy on Play only; CC BY footer credit. Q9: own WebGL2 for weather. Q10: sound only in the audio card demo.
- Q12: intro skippable; returning visitors get a short version. Q13: Shut down ends on Wake, nothing lost. Q14: one-field name prompt in R2. Q15: Space Grotesk and JetBrains Mono. Q18: iPhone app runs setup again. Q19: polling.
- Section 6: remove forced mappings. A skill that does not fit is "not used here" with one honest line. Log real use in `docs/SKILL-USAGE.md`.
- Item 34: remove the repo check that fails on reduced-motion code. Still build no reduced-motion features.
- New acceptance (all rounds): every card, chip and control reacts to hover, press and, where sensible, drag; a Playwright check proves it.
- New skill `web-motion-libraries`: GSAP is not on the allowed licence list, so no GSAP. WebGPU is experimental, so WebGL2 stays.

---

## 1. Goal

A static, public page that shows every item in the open-source `websmith-toolkit` (skills, the ThinkingOrbs animation, the motion kit, installers) as playful, interactive cards. An owner who runs their own Websmith builder bot can connect it with a webhook URL and key, chat with it, plan a project on a Plan sheet and watch it build. Nothing builds until they press "Let's do it!".

The look is an original futuristic builder blueprint: dark grid, cyan construction lines, neon blue liquid glass, helper cursors that draft each section as a wireframe and then fill it. The whole thing is hosted on GitHub Pages with no server of our own, and the only runtime network call is to the owner's own webhook.

---

## 2. Architecture

### 2.1 Choice: vanilla TypeScript + Vite

- **Vanilla TS (strict) + Vite.** No UI framework.
- Why:
  - The page is mostly canvas, WebGL2 and DOM animation driven by one rAF loop. A framework adds weight and a second scheduler that fights the loop.
  - Zero runtime dependencies is possible and fits "self-host everything".
  - Vite gives code splitting (`import()`), a dev server, asset hashing and a relative `base`. Plain ESM would need us to hand-write all of that.
  - State is small: a few reducers and state machines, each with one owner module. No framework store needed.
- UI is built with small typed helpers (`h()` element factory, `bind()` for text and attributes). No `innerHTML` with dynamic data anywhere (see section 8).
- Shell and first paint are **pre-rendered at build time**: the card list is written into `index.html` as real markup. The page reads fine before JS runs, and CLS stays near zero.

### 2.2 Static build, sub-path hosting, no server

- GitHub Pages serves the site from `https://<owner>.github.io/<repo>/`. The base path is a sub-path we do not control.
- **Relative base.** `vite.config.ts` uses `base: './'`. Every asset URL is relative. The manifest, service worker, icons and `import()` chunks all resolve against the page or manifest URL.
- **Hash routing only** (`#/`, `#/settings`, `#/plan`, `#q=orb&kind=skill`). No History API paths, so no server rewrite is needed and deep links survive.
- `404.html`: a copy of `index.html` shell plus a tiny script that sends the visitor to the app root. It covers typos in the sub-path. It is not part of normal routing.
- `.nojekyll` file in `dist/` so Pages serves `_`-prefixed and generated files untouched.
- Sub-path proof: `scripts/serve-subpath.mjs` serves `dist/` under any prefix (for example `/a/b/`). Tests run against `/` and `/a/b/`. See section 9.
- Dev server: `npm run dev` picks a free port starting at 5183. `vite.config.ts` throws if the port is 4191 or 4291.
- Build outputs: `dist/` (site), `dist/sw.js` (service worker with a build hash), `dist/boot.js` (tiny classic script, see 2.5).
- Nothing deploys from this plan. No GitHub repo, push or Pages until the owner says so.

### 2.3 Card data: build-time manifest from `vendor/websmith-toolkit`

> **TPL1 update:** the page now lives in `page/` inside the toolkit repo. `scripts/build-manifest.ts` reads the repo root (`..`), every build regenerates the (git-ignored) manifest, and `npm run check` fails on a missing, long or stale description. The text below is the original R1 plan.

`npm run manifest` runs `scripts/build-manifest.ts`. It reads the vendor clone (read-only) and writes `src/generated/toolkit.manifest.json`. This file is **committed**, because `vendor/` is git-ignored. `npm run build` always uses the committed manifest, so a build never depends on `vendor/` being present. `npm run check` warns if the manifest has drifted from `vendor/`.

How each kind is read:

| Kind | Source in vendor | What the script reads |
|---|---|---|
| skill | `skills/<id>/SKILL.md` | Frontmatter `name` and `description` (folded `>-` YAML, tiny parser), first `#` heading, `##` section titles, the first code fence as "how to use". 9 items. |
| animation | `animations/thinking-orbs/` | README "nine designs" table (code, name, what it does, use when), version `0.3.2`, licence and NOTICE paths. 1 item with 9 presets. |
| motion | `motion/WEB.md`, `PLAYBOOK.md`, `lottie/library/INDEX.md`, `audio/generate.py`, `html-render/`, `presets/starter/` | One item per move (11) and per transition (11), parsed from the `**Name**` blocks and the transitions table. Kit-level items: Playbook, Lottie icon library, soundtrack generator, QA checks, HTML render fallback, starter preset, demo film. About 29 items. |
| installer | `install/*.sh`, `install/xcode.md`, README installer table | Script name, "what it does", "where it writes", the leading comment block. 4 items. |

Output shape (typed in `src/core/manifest.ts`, parsed once at the boundary by `parseManifest(unknown)`):

```ts
interface ToolkitManifest {
  schema: 1;
  toolkit: { sha: string; headDate: string; repoUrl: string | null }; // repoUrl comes from site.config.json
  generatedAt: string;
  items: readonly Item[];
}
```

**Plain-English one-liners (SCOPE 9).**
- Written by hand in `content/descriptions.json`, keyed by item id. Not auto-derived: SKILL.md descriptions are technical ("Use this when...").
- Rules: one sentence, 100 characters or fewer, no jargon, present tense. Example: ThinkingOrbs: "Little dotted balls that show your AI is busy thinking."
- The manifest script **fails the build** if any item has no line, if a line is too long, or if an id in the file no longer exists.
- Each line stores the hash of its source text. If the source changes, the script prints a "re-read this line" warning.

**"What's new" signal.**
- File-backed items (skills, installers, the animation folder, the kit docs) use git dates: `git -C vendor/websmith-toolkit log --follow --format=%cI -- <path>`. `addedAt` is the oldest commit, `updatedAt` is the newest. The script fails if the clone is shallow.
- Items that live inside one shared file (moves and transitions inside `WEB.md`) cannot use file dates, or every move would look new on every edit. They use a **ledger**: `content/seen.json` maps item id to `{ hash, addedAt, updatedAt }`. The script hashes each block. A new id gets `addedAt = HEAD commit date`. A changed hash gets `updatedAt = HEAD commit date`. The ledger is committed.
- Runtime rule (`cards/whatsnew.ts`): **New** if `addedAt` is within 30 days. **Updated** if `updatedAt` is within 14 days and the item is not New. **New since your last visit** if the date is after `ws.v1.lastVisit` in localStorage. The filter chip "What's new" lists all three. If nothing qualifies, it shows the latest five changes so it is never empty.

**Relations for cables** live in `content/relations.json` (item id to related item ids). The script checks that every id exists. Example: the `thinking-orbs` skill is related to the ThinkingOrbs animation card.

### 2.4 Dependencies

Runtime npm dependencies: **none**.

Vendored code (copied by `scripts/vendor-assets.ts`, never an npm runtime dependency):

| Item | Version | Licence | Why |
|---|---|---|---|
| ThinkingOrbs engine (`thinking-orbs-engine.js`, ES build) | 0.3.2 | MIT, (c) 2026 Jakub Antalik | SCOPE 18, 19. Copied with `NOTICE` and `LICENSE` into `src/vendor/thinking-orbs/`. Drives canvas through `resolvePreset` and `MODE_DRAWS`. No React needed. |
| Self-hosted fonts: Space Grotesk and JetBrains Mono (variable woff2, Latin subset) | current at install | OFL-1.1 | Display and UI text, and the monospace labels. OFL texts shipped in `public/fonts/`. |
| `lottie-web` light build, **lazy (decided, D7)** | 5.x | MIT | Only to play the Lottie library card demos. Loaded on first Play, never at startup. |
| Noto animated emoji / useAnimations Lottie JSON | n/a | CC BY 4.0 / MIT | Only the few files the demo uses, copied to `public/lottie/`. Footer credit line "Emoji animations: Animated Noto Emoji by Google, CC BY 4.0" is required. |

Dev dependencies (versions are the current stable at install time in R2, recorded in the lockfile; confirm with `npm view` first):

| Package | Licence | Why |
|---|---|---|
| `vite` (and its bundled `esbuild`) | MIT | Dev server, build, code splitting. |
| `typescript` | Apache-2.0 | Strict mode, `tsc --noEmit` in `npm run check`. |
| `eslint`, `typescript-eslint` | MIT | Lint in `npm run check`. Rules: no `any`, no `as` outside guards, exhaustive switches, no `console`. |
| `@playwright/test` | Apache-2.0 | Chromium and WebKit tests, visual snapshots, icon rasterising. |
| `tsx` | MIT | Runs the TypeScript build scripts. Dropped if the installed Node strips types natively. |
| `@fontsource-variable/space-grotesk`, `@fontsource-variable/jetbrains-mono` | OFL-1.1 | Source of the woff2 files, copied once by `vendor-assets.ts` (D13). |
| `@axe-core/playwright` (and `axe-core`, MPL-2.0) | MPL-2.0 | **Dev-only (D6).** Accessibility audits in tests. Never imported by `src/`, never in `dist/`. The licence gate allows MPL-2.0 for dev dependencies only. |

Considered and **not** used:
- Workbox (MIT): a hand-written service worker of about 80 lines plus a build-generated precache list is smaller and easier to audit. Workbox stays an allowed fallback.
- `@tanstack/table-core` (MIT): the activity log has four columns. Native sort code is shorter than the import.
- `three` (MIT): about 600 KB for one card demo. Own WebGL2 code is used instead (Q9).
- `@use-gesture/vanilla`: Pointer Events are enough.

`scripts/check-licenses.ts` walks the lockfile and fails on any licence outside MIT, BSD, Apache-2.0, ISC, OFL, CC0 (plus MPL-2.0 for `axe-core` only, dev-only). It runs in `npm run check`. GSAP is not on the allowed list, so it is not used (see `web-motion-libraries` in section 6).

### 2.5 One early classic script: `boot.js`

CSP and theme must be set before first paint. A deferred module is too late. So `index.html` loads a tiny classic script `./boot.js` (under 1.5 KB, same origin, no inline code). It:
1. Sets `<html data-theme>` from `ws.v1.theme` or the system preference. No flash of the wrong theme.
2. Adds `html.js` and (if the intro will play) `html.intro-pending`, so sections start as wireframes in CSS only.
3. Reads the saved webhook origin and appends a second `<meta http-equiv="Content-Security-Policy">` that narrows `connect-src` to that single origin (see section 8).

It is built from `src/boot/boot.ts` by a small Vite plugin using esbuild, and listed in the service worker precache.

---

## 3. File and module layout

```
websmith-page/
  index.html            static shell, pre-rendered cards, CSP meta, links boot.js
  404.html              sub-path typo fallback
  package.json  tsconfig.json  vite.config.ts  eslint.config.js  playwright.config.ts
  content/
    descriptions.json   hand-written plain-English line per item (required)
    relations.json      item id -> related item ids (cable graph)
    seen.json           ledger of hashes and dates for items inside shared files
    site.config.json    toolkitRepoUrl (owner sets), site title, base notes
  public/
    fonts/  icons/  lottie/  offline.html  .nojekyll  manifest.webmanifest
  scripts/
    build-manifest.ts   vendor -> src/generated/toolkit.manifest.json
    vendor-assets.ts    copy orbs engine, fonts, lottie files (with licences)
    prerender.ts        Vite plugin: card markup into index.html
    make-sw.ts          writes dist/sw.js with precache list and build hash
    make-icons.ts       rasterise original SVG to PNG 192/512/180 via Playwright
    check-budget.ts     gzip sizes vs the budget in section 7
    check-external.ts   fails if dist references any non-self URL
    check-licenses.ts   dependency licence gate
    contrast.mjs        computes contrast for every token pair in both themes
    serve-subpath.mjs   static server for dist/ under a sub-path
  src/
    main.ts             entry: wires modules, starts the loop, lazy-loads the rest
    boot/boot.ts        theme, flags, CSP narrowing (becomes dist/boot.js)
    core/
      types.ts          shared domain types (section 3.1)
      brand.ts          branded types and their verifying guards
      result.ts         Result<T,E>, parse helpers
      manifest.ts       ToolkitManifest type and parseManifest
      storage.ts        versioned localStorage with validators and migrations
      events.ts         tiny typed event bus
      log.ts            silenceable structured logger (no console.log)
      rng.ts            seeded PRNG (tests pass ?seed=)
      dom.ts            h() factory, safe text and attribute helpers
    engine/
      loop.ts           the single rAF loop: tickers, order, dt, pause on hidden
      rects.ts          batched getBoundingClientRect cache, dirty on scroll/resize
      visibility.ts     IntersectionObserver wrapper for offscreen pausing
      spring.ts         spring solver and CSS linear() sampler
      tier.ts           quality tiers and the frame-time watchdog
      perf.ts           frame, LCP, CLS, INP probes (read by tests via ?perf=1)
    theme/
      theme.ts          theme state, system preference, persistence
      tokens.css  blueprint.css  glass.css  type.css  motion.css
      toggle.ts         glass toggle: real switch input, knob, rim highlight
      toggle-icon.ts    ~48-square sun and moon masks and the burst animation
    draft/
      draft.ts          wireframe-then-fill controller for any section
      helpers.ts        the helper-cursor pool and its sprite
    intro/
      machine.ts        intro and shutdown state machine
      swarm.ts          boids, spatial grid, typed arrays, canvas draw
      boxes.ts          bounding boxes, corner handles, mono labels
      hud.ts            bottom pill with live counts
      shutdown.ts       reverse sequence and the Wake button
    hero/
      ascii-wake.ts     glyph-field hero, ripple wake, greeting
    cards/
      registry.ts       item id -> card renderer and demo loader
      render.ts         card DOM from Item
      search.ts  filters.ts  whatsnew.ts
      detail.ts         inline expand with source facts
    demos/
      index.ts          demo registry, lazy import per demo id
      live/*.ts         visual demos (orbs, moves, transitions, lottie, weather, touch pad, audio)
      beforeafter/*.ts  scripted before and after for non-visual items
    cables/
      graph.ts          nodes, edges, rect lookup
      draw.ts           bezier draw-on, glow, dimension ticks
      dots.ts           data dots, arrival pulse, counters, log line
    fusion/
      gl.ts             one WebGL2 context, context-loss handling
      shaders.ts        metaball SDF shaders (own code)
      chips.ts          chip and step blob registry
    conn/
      protocol.ts       request and response types, parsers (section 5.2)
      client.ts         fetch wrapper: timeouts, abort, backoff, no key in logs
      connection.ts     connection state machine and status polling
      setup.ts          first-run setup flow
      login.ts          worker (Claude or ChatGPT) state machine, Find my login
      ratelimit.ts      client-side chat limiter
    chat/
      chat.ts  markdown-lite.ts  orb-indicator.ts  orb-picker.ts
    plan/
      reducer.ts  sheet.ts  copy.ts  send.ts  suggest.ts
    trail/
      trail.ts          status trail view and glowing line
      burst.ts          Done particle burst
    control/
      approvals.ts      Needs-your-OK card
      autonomy.ts       two columns and "Didn't need to ask"
      preview.ts        live setting previews and the outlined target preview
      usage.ts          usage bars with reset times
      audit.ts          insert-only activity log (IndexedDB) and its table
    personalize/
      profile.ts  questions.ts
    pwa/
      register.ts  install-hint.ts  badge.ts
    a11y/
      announce.ts  focus.ts  keyboard.ts
    generated/          toolkit.manifest.json (committed)
    vendor/thinking-orbs/   engine copy, NOTICE, LICENSE
  tests/
    e2e/                Playwright specs per round
    mock-webhook/       scripted fake owner bot
    helpers/            page objects, perf probes, contrast util
  docs/
    PLAN.md  coding-standards.md  specs/*  WEBHOOK.md (R3)  RELEASE.md (R4)
```

### 3.1 Core domain types

```ts
// core/brand.ts: branded primitives. Made only by verifying guards, never by `as`.
type Brand<T, B extends string> = T & { readonly __brand: B };
type WebhookUrl = Brand<string, "WebhookUrl">;   // https URL (or loopback http), origin extracted
type WebhookKey = Brand<string, "WebhookKey">;
type ApiKey     = Brand<string, "ApiKey">;
type SkillId    = Brand<string, "SkillId">;
type ItemId     = Brand<string, "ItemId">;
declare function asWebhookUrl(s: string): Result<WebhookUrl, UrlError>;

// Card kinds: discriminated union on `kind`.
type OrbState = "working" | "searching" | "solving" | "listening" | "connecting"
              | "weaving" | "composing" | "breathing" | "shaping";
type MotionPart =
  | { part: "move"; name: string }
  | { part: "transition"; name: string; ms: number }
  | { part: "kit"; topic: "playbook" | "lottie" | "audio" | "qa" | "html-render" | "preset" | "demo-film" };
type Item = ItemBase & (
  | { kind: "skill"; id: SkillId; sections: readonly string[] }
  | { kind: "animation"; presets: readonly OrbState[]; version: string }
  | { kind: "motion"; motion: MotionPart }
  | { kind: "installer"; script: string; writesTo: string; platform: "macos-arm64" | "any" }
);
interface ItemBase {
  id: ItemId; title: string; oneLiner: string; tags: readonly string[];
  addedAt: string; updatedAt: string; sourcePath: string; demo: DemoSpec;
}
type DemoSpec =
  | { kind: "live"; demoId: string }
  | { kind: "beforeAfter"; demoId: string };

// Connection (conn/connection.ts): one owner, many readers.
type ConnectionState =
  | { kind: "unconfigured" }
  | { kind: "checking"; since: number }
  | { kind: "online"; latencyMs: number; bot: BotInfo; capabilities: readonly string[] }
  | { kind: "degraded"; reason: string; lastOkAt: number }
  | { kind: "auth-failed" }
  | { kind: "unreachable"; why: "network" | "cors" | "timeout" | "mixed-content" };

// Worker (conn/login.ts): Claude or ChatGPT.
type Provider = "claude" | "chatgpt";
type WorkerState =
  | { kind: "none" }                                    // nothing chosen. Never pre-ticked.
  | { kind: "deferred" }                                // owner chose "Not now"
  | { kind: "finding"; provider: Provider }             // opt-in Find my login running
  | { kind: "found"; provider: Provider }               // "Found Claude, connect?"
  | { kind: "not-found"; provider: Provider }
  | { kind: "connecting"; provider: Provider; via: "login" | "apikey" }
  | { kind: "connected"; provider: Provider; via: "login" | "apikey" }
  | { kind: "failed"; provider: Provider; reason: string };

// Status trail (trail/trail.ts). "needs-ok" overlays the current stage, it is not a stage.
type TrailState =
  | { kind: "planned" }
  | { kind: "sent"; at: number }
  | { kind: "building"; at: number; note: string | null }
  | { kind: "done"; at: number; summary: string }
  | { kind: "failed"; at: number; atStage: "sent" | "building"; reason: string };
interface TrailView { state: TrailState; blockedOn: ApprovalId | null }

// Intro and shutdown (intro/machine.ts). Reload mid-intro restarts at "booting".
type StagePhase =
  | { kind: "idle" }
  | { kind: "booting" }
  | { kind: "bursting"; t0: number }
  | { kind: "assembling"; progress: number }   // 0..1
  | { kind: "handoff" }
  | { kind: "ambient" }
  | { kind: "packing"; progress: number }      // shutdown, reverse of assembling
  | { kind: "down" };
type StageEvent = "start" | "skip" | "shutdown" | "wake" | "settled";

// Plan sheet (plan/reducer.ts)
type PlanPhase = "editing" | "sending" | "sent" | "failed";
interface PlanState {
  draft: { title: string; goal: string; features: string[]; skills: SkillId[]; notes: string };
  suggestions: readonly Suggestion[];
  worker: Provider | null;
  phase: PlanPhase;
  sendId: string | null;          // idempotency key, persisted before the request
}
type PlanAction =
  | { type: "edit"; patch: Partial<PlanState["draft"]> }
  | { type: "toggleSkill"; skill: SkillId }
  | { type: "suggestions"; items: readonly Suggestion[] }
  | { type: "decide"; id: string; accept: boolean }
  | { type: "chooseWorker"; provider: Provider }
  | { type: "send" } | { type: "sent" } | { type: "sendFailed"; reason: string };
```

State owners (one each): `ConnectionState` in `connection.ts`, `WorkerState` in `login.ts`, `PlanState` in `reducer.ts`, `TrailState` in `trail.ts`, `StagePhase` in `intro/machine.ts`, theme in `theme.ts`. Others read through typed events.

All lifecycle steps are idempotent: re-running setup, reopening the Plan sheet, reloading mid-intro or mid-send converge to the same state. Storage keys are versioned (`ws.v1.*`) with validators and migrations.

---

## 4. Design system

Original blueprint look. No colours, names, glyphs or layouts taken from another product. All imagery is generated in code or drawn for this project.

### 4.1 Blueprint language
- **Grid:** 8 px minor and 64 px major lines drawn in CSS gradients on the page background (`blueprint.css`). Slow parallax on pointer.
- **Construction lines:** 1 px cyan hairlines, dashed for "draft", solid for "filled". Corner handles (6 px squares) on drafted boxes.
- **Dimension marks:** tick-ended measure lines with a mono label (`1280 × 64`) at section edges and cable ends.
- **Labels:** JetBrains Mono, uppercase, letter-spacing 0.08em, small. They are labels and never carry body text.
- **Dark:** deep navy page, cyan and electric-blue lines, neon glass.
- **Light:** pale blueprint paper with ink-blue lines. Glass becomes frosted paper with ink edges. Neon becomes saturated ink.

### 4.2 Colour tokens

Contrast figures are approximate (WCAG relative luminance). `scripts/contrast.mjs` recomputes them for every pair in R2 and fails `npm run check` below AA.

| Token | Dark | Light | Use and contrast note |
|---|---|---|---|
| `--bg` | `#060B16` | `#EEF4FB` | Page. |
| `--surface` | `#0C1426` | `#FFFFFF` | Solid wells under text. |
| `--text` | `#E8F1FF` | `#0E2243` | Body. ≈17:1 on dark bg, ≈14:1 on light bg. |
| `--text-dim` | `#9FB3D1` | `#4A5F82` | Secondary. ≈9:1 dark, ≈5.8:1 light. |
| `--line` | `#3DE0FF` (cyan) | `#1D4ED8` (ink blue) | Lines and large text. ≈12.5:1 dark, ≈6:1 light. |
| `--neon` | `#4D7CFF` | `#1D4ED8` | Accent fills. ≈5.3:1 on dark bg, passes for text. |
| `--glow` | `#3DE0FF` at 35% | `#1D4ED8` at 18% | Shadows only. Never text. |
| `--ok` | `#3DDC97` | `#0B7A4B` | Done, success. Always paired with an icon or word. |
| `--warn` | `#FFB547` | `#8A5200` | Needs your OK. Same pairing rule. |
| `--danger` | `#FF6B8A` | `#B3123A` | Errors. Same pairing rule. |
| `--decor` | `#3DE0FF` at 40% | `#00B8D9` | Decoration only. Light-mode cyan is below 3:1, so it never carries meaning or text. |

Accent choice (SCOPE 31) swaps `--neon` and `--line` among five hand-checked palettes, each verified for both themes.

### 4.3 Type
- **Space Grotesk** (variable, OFL) for headings and UI. **JetBrains Mono** (variable, OFL) for labels, code and the ASCII hero.
- Latin subset woff2, `font-display: swap`. Preload Space Grotesk only. Fallback stack: `system-ui, sans-serif` and `ui-monospace, monospace`, with `size-adjust` to limit CLS.
- Scale (ratio 1.25, fluid with `clamp()`): 12, 14, 16 (body), 20, 25, 31, 39, 49 (hero, up to `clamp(40px, 9vmin, 88px)`). Body line height 1.55, max 68 characters per line.

### 4.4 Spacing and radii
- 4 px base: 4, 8, 12, 16, 24, 32, 48, 72, 112.
- Radii: chip 8, card 14, sheet 22, pill 999, toggle knob squircle (`border-radius` ≈ 30%; use `corner-shape: squircle` where supported).
- Touch targets at least 44 × 44 px. `touch-action: manipulation` on buttons.

### 4.5 Glass recipes
- **Neon glass (chrome, sheets, toggle, chips):** `background: linear-gradient(160deg, rgb(61 224 255 / .14), rgb(77 124 255 / .06))`, `backdrop-filter: blur(18px) saturate(1.4)`, 1 px border at 35% cyan, inset top highlight, outer glow.
- **Specular rim:** a conic-gradient border masked to the edge. Its angle follows the pointer through `--mx`, `--my` custom properties set with `style.setProperty` (allowed under CSP). Brightest on the outer edge.
- **Card glass (cheap):** same gradient and rim but **no backdrop blur**. Only about 12 blurred surfaces may be on screen at once. This protects iPhone GPUs.
- **Text wells:** text always sits on `--surface` at 85%+ opacity or on a darkened glass layer that meets 4.5:1. Never on raw glow, grid or the ASCII hero.
- **Light mode:** frosted paper (`rgb(255 255 255 / .6)` blur 14) with ink-blue rim and soft blue shadow.

### 4.6 Motion tokens
Taken from the toolkit's own motion kit (`motion/WEB.md`) so the page uses what it shows.
- Easing: `--ease-out cubic-bezier(.16,1,.3,1)`, `--ease-in (.7,0,.84,0)`, `--ease-in-out (.83,0,.17,1)`, `--ease-snap (.2,.9,.1,1)`, `--ease-soft (.45,0,.55,1)`, `--ease-overshoot (.34,1.56,.64,1)`.
- Durations: micro 150, short 300, base 500, long 800 ms. Stagger 40 ms per letter, 70 ms per word.
- Springs (`engine/spring.ts`, JS solver plus sampled CSS `linear()`): `snappy {k:420, c:30}`, `gentle {k:170, c:26}`, `bouncy {k:300, c:14}`. The theme toggle slide uses bouncy, about 550 ms, press scale 0.95.
- Animate only `transform`, `opacity`, `filter`, `clip-path`.
- No reduced-motion branch (SCOPE 34). The flash rules still hold: at most 3 flashes per second, and full-frame theme swaps take at least 200 ms.

### 4.7 Helper-cursor "wireframe then fill"
One controller, `draft/draft.ts`, reused everywhere. Each draftable element has `data-draft="wire" | "fill"` and a `data-label` (mono class label).
1. **DECIDED (D1, 2026-11-24).** **Wire:** helper cursors fly to the element's corners and drag out a dashed cyan box with corner handles, a mono label and a dimension mark. Content is hidden.
2. **Fill:** the box solidifies, glass and content fade, blur and slide in (staggered ease-out). Helpers move on.
3. **Reverse** for shutdown: fill, wire, collapse, helpers carry the box away.

Used in: the startup intro (all sections), first scroll-into-view of each section (IntersectionObserver flash), card grid reveal, the Plan sheet opening, the Needs-your-OK card arriving, the outlined target preview (SCOPE 29), setup steps, cables being drawn, and the shutdown. Away from the intro, only 2 or 3 helpers from the pool are used.

---

## 5. Features mapped to rounds

### 5.1 SCOPE items 1 to 37

Round order inside R2: scaffold and tests, manifest and cards, theme and toggle, loop, intro and shutdown, hero, cables, fusion, demos. Inside R3: protocol and mock, connection and setup, login, chat, plan and trail, control and usage. Inside R4: personalization, PWA, keyboard and screen-reader pass, report.

| # | Item | Round | How | Acceptance check |
|---|---|---|---|---|
| 1 | Dark/light glass toggle | R2 | `theme/toggle.ts` plus `toggle-icon.ts`. A real `<input type="checkbox" switch role="switch">` under a glass knob. Debossed track, knob overlaps the ends, rim highlight travels, 48-square sun and moon burst and re-form. Spring slide about 550 ms. Page crossfades in sync. Blue-cyan glow in dark, soft ink-blue glow in light. | Click and Space flip the theme. `data-theme` changes. Background crossfades in 200 ms or more. `aria-checked` updates. Both themes snapshot. |
| 2 | Startup swarm reveal | R2 | `intro/*`. About 80 helpers burst from a centre "Websmith core" emblem (40 on phones), boids drift, boxes and mono labels draw over real DOM, bottom HUD pill counts live. DOM is usable from first paint. | HUD shows the manifest counts. Page is clickable at 300 ms. Skip on any key or click ends it (D10). First visit plays the full intro (about 2.2 s); returning visitors (`ws.v1.seen` set) get a quick version of about 0.6 s. LCP and frame budgets hold. |
| 3 | "Shut down" button | R2 | Button in the top bar. State machine goes to `packing`: reverse of the intro, helpers pack sections into wireframes, then `down` with a "Wake" button. Ends on a Wake button (D11). Reversible, loses no data. | After Shut down the sections are hidden, a Wake button is focused, and Wake restores all state (theme, search, filters). Idempotent on double click. |
| 4 | ASCII wake hero with greeting | R2 | `hero/ascii-wake.ts`. Glyph grid on canvas from a pre-rendered glyph atlas. A wave-equation height field gives a wake behind the pointer or finger. Text mask for the greeting. Real `<h1>` stays in the DOM. Reads `ws.v1.profile.name`. A one-field "What should I call you?" prompt in the hero stores it (D12; the full questionnaire is item 31 in R4). | With a saved name the hero reads "Hello, <name>". Without one it reads a generic greeting. The pointer leaves a visible wake. Canvas is `aria-hidden`. Paused offscreen. |
| 5 | Data cables | R2 (trail and worker cables wired in R3) | `cables/*`. One overlay canvas. Cubic beziers from right edge to left edge, source accent colour, draw-on about 500 ms, dots 0.5 to 1 s, arrival ring pulse, counters, mono log line, dimension ticks. Ambient between related cards. Hover highlights a card's cables. | Cable endpoints sit on card edges after scroll and resize. Dots arrive and the target pulses. At most 8 ambient cables on screen. Hover raises that card's cables. |
| 6 | Liquid fusing chips and setup steps | R2 (setup steps used in R3) | `fusion/*`. One WebGL2 context. A metaball SDF field drawn at half resolution. Chips and steps are DOM elements with registered blobs. Chips fuse when dragged together or when a step completes. | Blobs track DOM rects. Chips fuse and split on drag. No WebGL2 means plain glass chips. Context loss recovers. Max 6 animated blobs. |
| 7 | Every toolkit item as a card | R2 | `build-manifest.ts` and `prerender.ts`. About 43 cards from the vendor repo. | Card count equals manifest count. Count per kind matches the vendor folders (9 skills, 1 animation, about 29 motion, 4 installers). Test fails if a vendor item has no card. |
| 8 | Search, filters, what's new | R2 | `cards/search.ts`, `filters.ts`, `whatsnew.ts`. Kind and tag chips, text search, "/" focuses search, state in the URL hash. | Typing narrows cards and announces the count. Filters combine. "What's new" lists New, Updated and Since-last-visit. URL restores the state. |
| 9 | One plain-English line per card | R2 | `content/descriptions.json` plus the build gate. Always shown on the card face. | Build fails with a missing or long line. Test: every card shows a non-empty line of 100 characters or fewer. |
| 10 | Tiny live demo per card | R2 | `demos/*`. Visual items play a live demo. Non-visual items play a scripted before and after. Lazy-loaded on first Play, paused offscreen. | Every card has a Play control. Play starts and Pause stops. Each demo mounts without console errors. Table in 6.2. |
| 11 | Connection status indicator | R3 | `conn/connection.ts` plus a header chip. Polls `status`. Shows one `ConnectionState` kind. | Mock webhook: online, auth-failed, slow, CORS-blocked and offline each show the right chip and text. R2 shows "Not connected". |
| 12 | First-time setup | R3 | `conn/setup.ts`. Steps: URL, key, test, worker choice. Key goes to localStorage `ws.v1.webhook` only. Origin is shown for confirmation. Reload on first save to apply the CSP. **The URL must be `https://` (D4); anything else is rejected with a clear message.** Loopback `http` is allowed only in test and dev builds. | Key appears in no URL, log, request except the owner's webhook, or test artefact. Re-running setup is safe. |
| 13 | "Connect Claude or ChatGPT?" | R3 | Radio-style choice: Claude, ChatGPT, Not now. None selected on open. Also reachable from settings. | Opening setup selects nothing. Not now sets `deferred` and settings can reopen it. |
| 14 | Opt-in Find my login | R3 | After a choice, `login.find` op. The bot only reports `signedIn: boolean`. The page never asks for or receives tokens. | No request is sent before the owner picks a provider. The mock rejects any response with token-like fields (page ignores unknown fields, test asserts none are displayed). |
| 15 | "Found Claude, connect?" | R3 | `WorkerState.found` shows a Connect button. Tap sends `worker.connect` with `via: "login"`. | Connect is never automatic. Not-found shows the API-key alternative. |
| 16 | API key alternative | R3 | Password field, kept in localStorage `ws.v1.apikey`, with Forget. **It never leaves the browser (D5): not sent to the webhook either.** The owner's bot uses its own Claude or ChatGPT login. The key is used only by features that run in the browser, or kept for later. | No request carries the API key. Forget removes it. |
| 17 | Never auto-detect or pre-tick | R3 | No detection at load. No default selection. The only trigger is a click. | Test: fresh load makes zero `login.find` calls. No input is checked or selected. |
| 18 | Chat with ThinkingOrbs | R3 | `chat/*`. `chat` op. While waiting, a 64 px or 20 px orb shows the chosen preset. Replies render as safe text. Live region announces replies. | Reply appears after the orb. XSS payloads render as text. Rate limit shows a cool-down. |
| 19 | Picker for the 9 presets | R3 | `chat/orb-picker.ts`. Radiogroup of nine live mini-orbs (20 px). Saved in the profile. | All nine presets selectable by mouse and arrow keys. The choice persists and drives the chat orb. |
| 20 | Plan sheet with suggestions | R3 | `plan/*`. Goal, features, skills (chips from the cards), notes. Debounced `plan.suggest` returns design improvements the owner can accept or dismiss. | Editing triggers one suggest call per 1.5 s pause. Accept adds to the plan. Works without a worker. |
| 21 | Nothing builds until "Let's do it!" | R3 | Only `plan.send` starts a build. `sendId` is saved before the request. | Mock logs zero build ops before the click. A double click or reload sends once. |
| 22 | Copy plan | R3 | `plan/copy.ts`. Markdown to the clipboard with a fallback selection copy. Announces "Plan copied". | Clipboard text equals the plan Markdown. Works in Chromium and WebKit. |
| 23 | Worker choice and toolkit pointer | R3 | Claude or ChatGPT in the plan. `plan.send` carries the plan, the worker, and the toolkit ref (repo URL and SHA from the manifest). The bot's worker reads the toolkit through AGENTS.md and CLAUDE.md pointers. Push needs the owner's OK (item 25). | Payload has worker and toolkit ref. Push is never sent as allowed unless the owner approved it. |
| 24 | Status trail | R3 | `trail/*`. Planned, Sent, Building, Done. A glowing line fills stage to stage, each node pulses (fusion), Done ends in a particle burst. **Done only ever comes from the bot's reply**, never from the page guessing. | Mock walks the four stages in order. Line fill and burst appear. Stage changes are announced. A failed job shows the failure, not Done. |
| 25 | "Needs your OK" card | R3 | `control/approvals.ts`. Buttons name the action ("Push to GitHub"), with "Not now" as the other choice. Never "Yes" or "OK". | Button text equals the action label from the bot. Choosing sends `approval.answer`. Badge count updates. |
| 26 | "Didn't need to ask" | R3 | A second button. Sends `autonomy.set` for that action kind to "Does on its own". | Click moves the action to the left column and the mock receives the change. Logged in the activity log. |
| 27 | Autonomy two columns | R3 | `control/autonomy.ts`. "Does on its own" and "Asks you first". Move by drag, or by a button per row (keyboard). Statements are action kinds. | Moving a row updates both columns and the bot. Works by keyboard alone. |
| 28 | Live previews per setting | R3 (autonomy), R4 (personalization) | `control/preview.ts`. Each setting shows what it changes: autonomy shows the approval card or an inline note, personalization shows the accent, orb and density. | Changing a setting updates its preview before saving. |
| 29 | Outlined target preview | R3 | In the approval card, the target (repo, branch, files, page) is drawn as a dashed blueprint outline by helpers. | The preview shows target name and a changes summary, outlined. Missing target data shows an honest "No preview from your bot". |
| 30 | Usage bars with reset times | R3 | `control/usage.ts`. `usage` op. Bars per meter with "resets in 2 h 10 min" and an absolute time. | Bars match mock values. Countdown ticks. Unsupported usage shows a clear empty state. |
| 31 | Personalization questions | R4 | `personalize/*`. Name, accent, orb, density, theme default. Saved as a local theme in `ws.v1.profile`. | Answers apply live and survive reload. "Reset" restores defaults. |
| 32 | Installable PWA | R4 | `pwa/*`, manifest, icons, `sw.js`. Offline shell. iOS "Add to Home Screen" hint. App badge for pending approvals. | Manifest valid with relative scope. SW installs under `/a/b/`. Offline reload shows the shell. Badge set when installed and supported. |
| 33 | Full keyboard and screen-reader support | R4 (basics built in R2 and R3) | `a11y/*`. Roving tabindex in grids and pickers, visible focus, Escape closes sheets, live regions. | Keyboard-only walkthrough passes. Every control has a name. axe audits and the custom checks pass in both themes. |
| 34 | No reduced-motion work in v1 | R2 (decision, not code) | Build no reduced-motion features (D16). The flash rules in 4.6 still apply. | No test enforces the absence of such code. Recorded in the handoff. |
| D17 | Everything reacts and is rewarding to play with | R2 onward | Every card, chip and control has a visible hover, press and (where it makes sense) drag response. | Playwright "reacts" check: hover and press each card, chip and control, assert a computed style or transform change. Runs in every round for what exists then. |
| 35 | Use every toolkit skill | R2 to R4, report in R4 | Checklist in section 6. Updated each round. R4 delivers the final list. | Every row has "where used", a round and a demo. Report matches the code. |
| 36 | Self-host every asset | R2 | Vite output only. `check-external.ts`. | `dist/` has no `http(s)://` host except the SVG and XML namespace strings on an allowlist. The browser makes no off-origin request except to the mock webhook. |
| 37 | No reference videos or study code | R2 | `.gitignore`, a repo check for video and study file patterns, and code written from the specs. | Repo check finds no video files or reference code. |

### 5.2 Webhook protocol (proposal)

Owner decisions applied: `https://` only (D4); no worker API key is ever sent, so `worker.connect` carries only `provider` and `via: "login"` (D5); status by polling (D14).

The owner's Websmith bot does not have this API yet. This section is the contract the page expects. R3 writes `docs/WEBHOOK.md` and a mock that implements it. The page also copes with a bot that supports only part of it.

**Transport.**
- One endpoint: `POST <webhookUrl>`. Body is JSON. The URL must be `https` (loopback `http` allowed for development).
- Auth: header `Authorization: Bearer <key>`. The key is never in the URL or the body.
- Every request: `{ "v": 1, "op": "<name>", "requestId": "<uuid>", ... }`. `requestId` is the idempotency key. The bot must treat a repeated `requestId` as the same request and return the first result.
- Every response: `{ "v": 1, "ok": true, "data": { ... } }` or `{ "v": 1, "ok": false, "error": { "code": "...", "message": "...", "retryAfterMs": 3000 } }`.
- Error codes: `unauthorized`, `rate_limited`, `unsupported_op`, `bad_request`, `busy`, `internal`.
- Timeouts: 15 s for `status`, `usage`, `login.*`. 90 s for `chat` and `plan.suggest`. 30 s for `plan.send`. All abortable.
- Unknown fields are ignored. Missing optional fields are fine. `status` lists `capabilities`, and the page hides features the bot does not list.

**Ops.**

```jsonc
// status
// -> { "v":1, "op":"status", "requestId":"…" }
// <- data: {
//   "bot": { "name": "Websmith", "version": "1.4.0" },
//   "capabilities": ["chat","plan.suggest","plan.send","login.find","worker.connect","usage","approvals","autonomy"],
//   "worker": { "state": "none" | "connected", "provider": "claude" | "chatgpt", "via": "login" | "apikey" },
//   "job": { "jobId": "…", "stage": "planned" | "sent" | "building" | "done" | "failed", "note": "…", "updatedAt": "ISO" } | null,
//   "pendingApprovals": [ { "id":"ap_1", "action":"git.push", "label":"Push to GitHub",
//        "why":"Publish the branch so you can review it",
//        "target": { "kind":"repo", "name":"my-site", "detail":"branch main, 4 files" } } ],
//   "now": "ISO" }

// chat
// -> { "op":"chat", "text":"What skill fits a Home Screen app?", "mode":"chat" | "plan" }
// <- data: { "reply": { "id":"m_9", "text":"Use **installable-pwa** …", "format":"markdown-lite" },
//            "orb": "searching" }        // optional hint of which preset fits

// plan.suggest   (called while the owner plans)
// -> { "op":"plan.suggest", "plan": { "title":"…", "goal":"…", "features":["…"], "skills":["installable-pwa"] } }
// <- data: { "suggestions": [ { "id":"s1", "text":"Add a clear empty state to the table.", "skill":"admin-backoffice" } ] }

// login.find     (only after the owner picks a provider)
// -> { "op":"login.find", "provider":"claude" }
// <- data: { "provider":"claude", "signedIn": true }     // a boolean only. No tokens, no email, no name.

// worker.connect
// -> { "op":"worker.connect", "provider":"claude", "via":"login" }
//    (no API key field exists: the page never sends it, D5)
// <- data: { "worker": { "state":"connected", "provider":"claude", "via":"login" } }

// plan.send      ("Let's do it!"; requestId is the saved sendId)
// -> { "op":"plan.send", "worker":"claude", "plan":"<markdown>",
//      "toolkit": { "repo":"<url>", "sha":"<commit>" } }
// <- data: { "jobId":"j_42", "stage":"sent" }

// job.status     (poll every 3 s while a job runs)
// -> { "op":"job.status", "jobId":"j_42" }
// <- data: { "stage":"building", "note":"Writing the card grid", "updatedAt":"ISO" }

// approval.answer
// -> { "op":"approval.answer", "id":"ap_1", "decision":"allow" | "deny" }
// <- data: { "ok": true }

// autonomy.get / autonomy.set
// <- data: { "actions":[ { "id":"git.push", "label":"Push to GitHub", "level":"ask" | "auto" } ] }
// -> { "op":"autonomy.set", "id":"git.push", "level":"auto" }

// usage
// <- data: { "asOf":"ISO", "meters":[ { "id":"claude-5h", "label":"Claude, 5 hour window",
//            "used": 42, "limit": 100, "unit":"%", "resetsAt":"ISO" } ] }
```

**Polling.** `status` every 10 s while the tab is visible and connected, every 3 s while a job runs, exponential backoff up to 60 s on errors, none while hidden. The status payload (and so any future Home Screen widget or Live Activity) stays under 4 KB.

**CORS (needed on the owner's bot).**
- `Access-Control-Allow-Origin: <the Pages origin>` (not `*`).
- `Access-Control-Allow-Headers: authorization, content-type`.
- `Access-Control-Allow-Methods: POST, OPTIONS`.
- Answer `OPTIONS` preflight with 204. Send the same headers on error responses too.
- The page reports a CORS failure as `unreachable: cors` with a short fix hint.

### 5.3 Where the stored data lives
- `ws.v1.webhook` `{ url, key }`, `ws.v1.apikey`, `ws.v1.profile` `{ name, accent, orb, density, theme }`, `ws.v1.theme`, `ws.v1.plan`, `ws.v1.lastVisit`. All parsed on read, discarded if invalid.
- The activity log (item 26, 27, 25 decisions) lives in IndexedDB, insert-only, no personal data.
- "Forget key" removes `webhook.key` and `apikey`. "Forget everything" clears all `ws.v1.*` and the log.

---

## 6. Skill checklist

Every skill in `../skills/` (the toolkit repo root) is applied where it honestly fits. A skill that does not fit is marked **not used here** with one honest line (D15); no forced mappings. Each skill also gets a card on the page, with a demo that shows what it is about. The real log lives in `docs/SKILL-USAGE.md`. "Where it is applied" is the build work. The "Card shows" column is the demo. Status columns are filled in each round.

### 6.1 Table

| Skill or item | Where applied in the build | Round | Card shows |
|---|---|---|---|
| `thinking-orbs` (skill) | Chat thinking indicator, the 9-preset picker, orbs in the status trail "Building" node and in the setup "checking" step. Follows the skill: `size` 64 or 20, tuned separately, driven by time not randomness, MIT notice kept. | R3 | Live: the nine presets in a grid, click one to enlarge, 64 and 20 side by side. |
| ThinkingOrbs animation (`animations/thinking-orbs`) | Vendored engine 0.3.2 drives all orb canvases through one shared ticker. Licence and NOTICE shown in settings credits. | R3 (card demo in R2) | Live: cycling presets on dark and light patches. |
| Motion kit (`motion/`) | Easing and duration tokens (4.6). Moves in the build: SplitText on headings, MaskReveal on sections, PathDraw on cables, Counter on HUD and usage, StackCards on the Plan sheet, Highlight on search matches, RollingWord in the hero. Transitions: crossfade for theme, mask iris for opening the Plan sheet from its button, push for settings, matchCut (shared element) from chip to Plan. Lottie check and sparkle in the status trail. | R2 to R4 | One live card per move and transition (22), plus kit cards (playbook, Lottie library, soundtrack generator, QA, HTML render, starter preset, demo film). |
| `installable-pwa` | Item 32: manifest, icons, hand-written service worker, offline shell, iOS install hint, app badge for pending approvals. Adapted for GitHub Pages: relative scope, no `_headers`, SW versioned by content. Web Push is **not** used (needs a server). | R4 | Before and after: a browser tab turns into a Home Screen icon, then works with the network switched off. |
| `iphone-safari-touch-haptics` | Pointer Events with capture everywhere (drag between autonomy columns, chip drag and fuse, hero wake). `touch-action: manipulation` on buttons, `none` only on canvases and drag handles. Safe-area padding and `100dvh`. Switch-input tick on the theme toggle and autonomy switches. `navigator.vibrate` feature-detected for Android only. | R2 (input), R3 (drag), R4 (audit) | Live: a touch pad you drag with a finger or mouse, plus a real switch that ticks on iPhone. Notes "iPhone only". |
| `web-motion-libraries` | **Decision recorded (R2).** No GSAP: its Standard No-Charge licence is not on the allowed list and the page needs no ScrollTrigger. No WebGPU or three.js: WebGPU is still experimental, so own WebGL2 is used (liquid chips, weather). Motion is CSS, WAAPI, the one rAF loop and our own spring solver. | R2 | Before and after: the same motion in GSAP-style code vs plain WAAPI (illustration), with the licence note. |
| `ship-whole-app` | **Not used here (D15).** It is about shipping on Cloudflare (D1, Workers, rollback). This page ships to GitHub Pages. R4 may borrow its "define done, preview before public, roll back" habit in `docs/RELEASE.md`, and will log that only if it really does. | R4 | Before and after: a staged rollout with a problem, then a rollback (illustration). |
| `admin-backoffice` | **Decide in R3 (D15).** The activity log and the autonomy columns may honestly use its append-only audit-log and empty/error-state rules. If the R3 code does not really use them, log "not used here". No forced `can()` layer. | R3 | Before and after: a permission matrix flips "Asks first" to "Does on its own" and an audit row appends (illustration). |
| `payments-test-mode` | **Not used here (D15).** No payments exist. Idempotency by `requestId` and "Done only from the bot" are ordinary protocol good practice, not this skill. | n/a | Before and after: the same event arrives twice and the second is ignored (illustration of idempotency). |
| `audio-reactive-visuals` | The audio card demo **only** (D9): one `AudioContext` unlocked by a tap, an `AnalyserNode` with reused typed arrays, smoothed bass, mid and high values driving the bars, a mute control, no autoplay. A synthesised tone, no audio files. No UI sounds anywhere else. | R2 | Live: tap to start a synthesised beat, bars pulse to it, mute button. |
| `stylized-water-sky-weather` | The weather card demo only, in own WebGL2 (D8, not three.js): sky gradient, water, points-based rain, one wind field, half resolution on phones, one shared sun direction. No calm toggle (item 34). Pause button. | R2 | Live: a small stylised water, sky and rain scene. Sliders for wind and rain. |
| `swiftui-home-widgets` | **Not used here (D15).** A web page cannot build a widget. The 4 KB status payload rule stays as plain good practice. | n/a | Before and after: a mock Home Screen widget walks Planned to Done, labelled "mock, not a real widget". |

### 6.1a Status after R2 (the full log is `docs/SKILL-USAGE.md`)

- Applied in R2: `thinking-orbs` (card demo with the vendored engine, NOTICE and LICENSE), `iphone-safari-touch-haptics` (switch-input toggle, Pointer Events with capture for the hero wake and chip drag, touch pad demo, safe areas, `100dvh`), `audio-reactive-visuals` (audio card demo only), `stylized-water-sky-weather` (weather card demo in own WebGL2), `web-motion-libraries` (decision: no GSAP, no WebGPU, own WebGL2).
- Waiting: `installable-pwa` (R4), `admin-backoffice` (decide in R3).
- Not used here: `payments-test-mode`, `ship-whole-app`, `swiftui-home-widgets`. Each still has a card with a before and after.
- The motion kit is used for real: its easing and duration tokens are in `src/styles/tokens.css`, and all 11 moves and 11 transitions have live card demos.

### 6.1b Status after R4 "fewer, bigger" (where each skill is used now)

- `thinking-orbs`: the single hero orb (`src/hero/orb.ts`): the vendored engine's frame data (`MODE_FRAMES`, typed in `engine.es.d.ts`) for all nine presets, drawn as glow sprites, time-driven, swirl morph between presets, MIT NOTICE kept. The card gallery demo and the picker orbs were cut as duplicates.
- `iphone-safari-touch-haptics`: switch-input haptic tick on the cloth tap and the theme toggle; Pointer Events on the cloth and orb; `touch-action: pan-y` on the cloth so vertical swipes still scroll; safe areas and `100svh`; the touch pad demo.
- `web-motion-libraries`: decision unchanged: no GSAP, no three.js or WebGPU. Own WebGL2 for the cloth (the one WebGL context), Canvas 2D for the opening and orb, WAAPI and CSS for the rest, one rAF loop.
- `stylized-water-sky-weather`: the weather card demo was cut in R4 (it was a second WebGL context). Its "one shared wind field, gusts that travel" rule now drives the cloth wind (`src/cloth/cloth.ts`, travelling noise plus gusts plus scroll).
- `audio-reactive-visuals`: the audio card demo only (unchanged).
- Motion kit: one easing (`--ease` / `EASE`) everywhere, including the opening and orb morph; move and transition card demos unchanged.
- `installable-pwa`: still waiting (R4 personalization round). `admin-backoffice`: still undecided (no R3 audit log yet).
- Not used here: `payments-test-mode`, `ship-whole-app`, `swiftui-home-widgets`.

### 6.1c Changes in R5 "polish"

- `iphone-safari-touch-haptics`: the iPhone layout rules applied to centring (no box wider than the
  viewport, because body `overflow-x` does not stop iPhone Safari panning; no `100vw` full-bleed, the banner
  cancels the page padding instead), the opaque sticky header over the safe area, and the tap-to-light card
  row (`src/cards/highlight.ts`: touch pointers mark the row, since touch has no hover).
- Motion kit: the card list's lift, float, sweep and scan use `--ease`, `--spring` and the `--t-*` tokens,
  animate only transform and opacity, and hold still under reduced motion.
- `web-motion-libraries`: decision unchanged (CSS for the card motion, no library).
- All other skills: as in 6.1b.

### 6.1d Changes in R6 "list view" (owner request: no cards, no card animations)

The cards and every per-card demo are gone (section 6.2 and SCOPE item 10 are retired by the owner). All 81
items are one list (`src/list/`, `src/styles/list.css`, rows pre-rendered by `scripts/prerender.ts`), and each
skill's "Card shows" column above no longer applies: each item now shows its one plain description line.

- `thinking-orbs`: the hero orb only (unchanged). The orb skill and animation are list rows.
- `iphone-safari-touch-haptics`: list rows are 44 px touch targets on phones; the kit and type filters stay
  real switch inputs (the iPhone tick). The tap-to-light row script (`src/cards/highlight.ts`) is deleted.
  The touch pad demo is deleted; the skill still drives the cloth tap and theme toggle (6.1b).
- `audio-reactive-visuals`: **not used here any more.** Its only use was the audio card demo, now deleted.
- `stylized-water-sky-weather`: the cloth wind (unchanged from 6.1b).
- `web-motion-libraries`: decision unchanged; `lottie-web` (the only runtime dependency) is removed with the
  Lottie demo. The list has no motion at all; filtering applies instantly.
- Motion kit: the tokens still drive the opening, orb, cloth, theme and power screen. The 22 move and
  transition demos are deleted; each is a list row with a plain description.
- `installable-pwa`, `admin-backoffice`: unchanged (waiting / undecided). Not used here: `payments-test-mode`,
  `ship-whole-app`, `swiftui-home-widgets`.

### 6.1e Round TPL1 "template page" (one public page for every owner)

| Skill | Where it was applied |
|---|---|
| `installable-pwa` | `public/manifest.webmanifest` linked from `index.html` (name, short_name, relative `id`/`start_url`/`scope`, `display: standalone`, theme and background colour), self-hosted PNG icons 192 and 512 (also maskable) and a 180x180 apple-touch-icon drawn from our own hex mark by `scripts/make-icons.ts`. Installed mode detected in `src/main.ts` (`display-mode: standalone` or `navigator.standalone`, sets `html[data-display]`); the header Settings button is the way back without a Safari toolbar. No service worker this round (stale caches would block updates); noted in `docs/coding-standards.md`. |
| launch-gate | `LAUNCH-CHECKLIST.md`: every item PASS (with evidence), FAIL or UNVERIFIED; nothing deployed or switched on. `scripts/check-dist.ts` scans every file in `dist/` for secrets, notes, source maps, home paths, emails and third-party hosts (self-tested with planted fakes); `scripts/check-repo.ts` blocks home paths and emails in tracked files; fonts self-hosted; the privacy note (footer and Settings) matches what `ws.settings` really stores. |
| web-perf | No new dependencies. The sheets and their CSS are lazy chunks (`settings` 3.0 KB, `firstrun` 0.9 KB, `sheet` 0.8 KB + 0.8 KB CSS, gzip); the first-run sheet is a top-layer `<dialog>` (no layout shift) and waits for the staged boot. Initial total 60 KB gzip (budget 160). Font preload unchanged. |
| typescript-best-practices | `src/core/migrate.ts`: branded `WebhookUrl`/`WebhookKey`, field-by-field parsing of localStorage, pure idempotent `migrate()`. `src/connect/webhook.ts`: bot replies and the helper line parsed into `LoginReport` at the boundary. Exhaustive switches (`resolveTheme`, `stateText`, the new `kit` item kind). No `any`. |
| blast-radius | Every caller of the old storage keys moved in the same commit (`profile`, `theme`, `status`, `connect`, `main`, `boot`, and the specs `toggle`, `theme`, `hero`, `sync-time`, `center`). Manifest changes updated `prerender`, `check-repo`, `manifest.spec`, `list.spec`. Existing-visitor risks are listed in `HANDOFF.md`. |
| interrogate | Final adversarial review of the whole diff for personal data, secrets, bypassed or pre-ticked consent, the helper touching tokens, and settings lost on update; findings and fixes in `HANDOFF.md`. |
| `websmith-page` (new toolkit skill) | `../skills/websmith-page/SKILL.md`: the bot side of the webhook, `find-my-login` and `connect-agent`. |

The list now has 87 items (48 skills, 5 learning kits as a new `kit` kind, 1 animation, 29 motion, 4 installers), generated from the repo root at build time. Other skills: as in 6.1d.

### 6.2 Demo plan by kind (retired in R6)

- **Live:** ThinkingOrbs (9 presets), the 22 moves and transitions (own CSS and WAAPI, written from the WEB.md descriptions, with the credit), Lottie library (lazy `lottie-web`, D7), weather scene, touch pad, audio bars.
- **Before and after:** the 4 installers (a terminal-style "before: nothing installed" to "after: tool prints its version", labelled **illustration, not executed**), `payments-test-mode`, `ship-whole-app`, `admin-backoffice`, `installable-pwa`, `swiftui-home-widgets`, motion kit's QA and soundtrack cards, `thinking-orbs` skill (live), and the Playbook.
- Each demo is a lazy module under 6 KB gzipped on average. It starts on Play, pauses offscreen and on tab hidden, and has a visible Pause.

---

## 7. Performance budget

Measured on a mid laptop (Chromium and WebKit) and an iPhone 15 class device (owner check, Q24).

### 7.1 Size (gzip, transferred)

| Part | Budget |
|---|---|
| Initial JS (shell, theme, toggle, loop, cards, search, filters, draft controller) | ≤ 60 KB |
| Initial CSS (tokens, blueprint, glass, cards) | ≤ 20 KB |
| Pre-rendered HTML including card markup | ≤ 45 KB |
| Fonts (Space Grotesk preloaded, JetBrains Mono on demand) | ≤ 90 KB total, ≤ 35 KB on the critical path |
| **Initial total (no images beyond inline SVG)** | **≤ 160 KB** |
| Lazy: intro swarm and shutdown | ≤ 25 KB |
| Lazy: cables | ≤ 12 KB |
| Lazy: WebGL2 fusion | ≤ 20 KB |
| Lazy: ASCII hero | ≤ 10 KB |
| Lazy: ThinkingOrbs engine and orb UI | ≤ 30 KB |
| Lazy: connection, setup, chat | ≤ 40 KB |
| Lazy: Plan sheet, trail, control | ≤ 45 KB |
| Lazy: each demo (average) | ≤ 6 KB |
| Lazy: `lottie-web` light (only on Lottie demos) | ≤ 60 KB |

### 7.2 Web vitals (mid laptop and iPhone 15 class)

| Metric | Target |
|---|---|
| LCP | < 2.0 s (hard limit 2.5 s). The LCP element is the real `<h1>` and the first cards. They are visible from first paint and not hidden by the intro. |
| INP | < 150 ms (limit 200 ms). Heavy work stays out of input handlers. |
| CLS | < 0.05 (limit 0.1). Fonts use `size-adjust`. Cards are pre-rendered at final size. Overlays are `position: fixed`. |
| TBT | < 150 ms (limit 200 ms). |

### 7.3 Frame times

| Effect | Budget per frame |
|---|---|
| Intro swarm (80 helpers, 40 on phones), boxes, HUD | ≤ 4 ms desktop, ≤ 8 ms iPhone |
| Cables (up to 40 edges, ≤ 8 ambient on screen, ≤ 6 dots each) | ≤ 2 ms |
| WebGL2 fusion (half-resolution field, ≤ 6 animated blobs) | ≤ 3 ms CPU, no dropped frames |
| ASCII hero (≈ 3,500 cells via glyph atlas) | ≤ 2 ms |
| ThinkingOrbs (≤ 3 visible at once) | ≤ 1 ms |
| **All effects together** | **≤ 10 ms desktop, ≤ 12 ms iPhone** (60 fps = 16.7 ms) |

### 7.4 How it is enforced
- **One rAF loop** (`engine/loop.ts`). Every effect registers a ticker with an order number. No effect calls `requestAnimationFrame` itself.
- **Reads before writes.** `engine/rects.ts` reads all rects once per frame in one batch, and only when something is dirty (scroll, resize, `ResizeObserver`, or an element in motion).
- **Offscreen and hidden pausing.** `IntersectionObserver` pauses an effect when its element or canvas is offscreen. `visibilitychange` pauses the whole loop. Resuming resets `dt` so nothing jumps.
- **No allocation per frame.** Typed arrays (`Float32Array`) are reused. Hot code uses positional arguments.
- **Tiering** (`engine/tier.ts`): a 60-frame rolling average above 14 ms steps down one tier: swarm 80 to 40, canvas DPR cap 2 to 1.5, fusion field to a quarter resolution, ambient cables 8 to 4. It never steps up during a session.
- **Code splitting.** Swarm, cables, fusion, hero, orbs, chat, plan and demos are `import()` chunks started after first paint. The page is fully usable without them.
- **Measurement.**
  - `npm run check:budget` gzips `dist/` and fails on any limit in 7.1.
  - Playwright (Chromium) reads LCP, CLS and INP through `PerformanceObserver` and reads `Performance.getMetrics` through CDP. `?perf=1` exposes `window.__perf` with frame-time percentiles from the loop. WebKit has no CDP, so it checks frame deltas only.
  - Perf tests run against the production build and fail above the targets with a 25% tolerance on CI-like variance. Real iPhone numbers are a manual check.

---

## 8. Security model

### 8.1 Keys
- The webhook key and any API key live **only** in localStorage under `ws.v1.*`. Never in a URL, hash, query, log, test file, screenshot, commit or service-worker cache.
- The webhook key is sent only as `Authorization` on requests to the owner's webhook origin. The worker API key is never sent anywhere (D5).
- **Forget key** (settings and setup) removes both keys at once. **Forget everything** clears all `ws.v1.*` and the activity log.
- The structured logger redacts any field named `key`, `apiKey`, `authorization` or `token`. Tests grep logs and network traces for the test key and must find it only in the `Authorization` header to the mock.
- Key inputs: `type="password"`, `autocomplete="off"`, `spellcheck="false"`, with a show/hide toggle.
- Storage caveat: GitHub Pages serves all of `<user>.github.io` as one origin, so other project pages of the same account can read this localStorage. See Q1.

### 8.2 Content Security Policy (meta tag)
GitHub Pages cannot send headers, so CSP is a `<meta http-equiv="Content-Security-Policy">`:

```
default-src 'self';
script-src 'self';
style-src 'self';
img-src 'self' data: blob:;
font-src 'self';
connect-src 'self' https: http://localhost:* http://127.0.0.1:*;   /* static, broad: origin unknown at build time */
worker-src 'self'; manifest-src 'self'; media-src 'self' blob:;
object-src 'none'; base-uri 'self'; form-action 'none';
require-trusted-types-for 'script'                              /* where supported */
```

- **Narrowing to the owner's origin.** The owner's webhook origin is unknown at build time, so the static tag must stay broad. `boot.js` (2.5) reads the saved origin and appends a **second** CSP meta with `connect-src 'self' <origin>`. When several policies exist, the browser enforces all of them, so the effective policy is the narrow one. After the first save in setup, the page reloads so `boot.js` applies the narrow policy before any other script runs. Before the first save, the page makes no network request at all.
- This depends on dynamically added meta CSP being honoured in Chromium and WebKit. **R2 starts with a spike test** in both. If WebKit ignores it, the fallback is the broad `https:` policy plus an application-level allow-list in `conn/client.ts` (a `fetch` wrapper that refuses any other origin). The wrapper is built regardless, as a second layer.
- `style-src 'self'` has no `'unsafe-inline'`. So: no `style="..."` attributes in markup, and dynamic styling uses CSSOM (`el.style.x = …`, `style.setProperty`), which CSP allows. No inline `<script>`. No third-party origins anywhere.
- `frame-ancestors` is ignored in a meta tag. Clickjacking is low risk (no sensitive one-click action), and the Needs-your-OK buttons require a deliberate click on a named action.
- The webhook URL must be `https` (loopback `http` for development). Setup shows the origin in large type and asks the owner to confirm it, because a pasted malicious URL would receive the key.

### 8.3 Chat replies and XSS
- Replies are **never** inserted with `innerHTML`. `chat/markdown-lite.ts` parses a small subset (paragraphs, bold, italic, inline code, code fences, lists, links) into DOM nodes with `textContent`.
- Links: only `https:` and `mailto:` are allowed, `rel="noopener noreferrer"`, `target="_blank"`. `javascript:`, `data:` and relative links become plain text.
- Images and HTML in replies are shown as text. Length cap of 20,000 characters per reply, with a "show more" fold.
- The same rules apply to plan suggestions, approval labels, usage labels and job notes: all bot text goes through `dom.ts` safe helpers.
- Tests send payloads such as `<img src=x onerror=...>`, `<script>`, and `[x](javascript:...)` and assert nothing executes and the text appears literally.

### 8.4 Rate limits and abuse
- Client limiter (`conn/ratelimit.ts`): one in-flight chat at a time, at least 2 s between sends, at most 10 sends per minute, 4,000 characters per message. When blocked, the send button shows a cool-down countdown.
- A `rate_limited` response with `retryAfterMs` starts the same cool-down.
- Status polling backs off on errors and never runs while the tab is hidden.

### 8.5 "Find my login"
- It runs only after the owner picks Claude or ChatGPT. Nothing is detected on load. Nothing is pre-ticked. The default is "no choice".
- The request asks the owner's own Websmith whether a login is signed in. The reply is a boolean. The page never asks for a token, a path, an email or a name, and shows none.
- "Found Claude, connect?" needs a deliberate Connect click.
- The page never reads CLI tokens (it cannot, being a browser page). The bot is told never to return them. If a reply has extra fields, they are ignored and not displayed or stored.

### 8.6 Other
- Service worker caches only same-origin `GET` of build files. It never caches the webhook origin.
- No analytics, no cookies, no third-party fonts or scripts.
- Never read `.env` files. Tests use a fake key string such as `test-key-not-real`.

---

## 9. Test plan

All tests are Playwright in **real Chromium and WebKit** (`playwright.config.ts` has both projects). They run against the production build served by `serve-subpath.mjs`. Each round adds its specs and re-runs the earlier ones.

### 9.1 Support code
- **Mock webhook** (`tests/mock-webhook/server.mjs`): a Node `http` server on a random free port. Scenarios: `online`, `auth-failed`, `slow`, `cors-blocked`, `offline`, `login-found`, `login-not-found`, `approval-needed`, `trail-walk` (planned, sent, building, done), `trail-fail`, `duplicate-send`, `xss-reply`, `rate-limited`, `usage`. It records every request in memory for assertions and never writes the key to disk.
- **Determinism:** `?seed=<n>` seeds the PRNG. `?freeze=1` stops the loop on a chosen frame for snapshots. `?perf=1` exposes probes. These carry no secrets.
- **Contrast util:** computes real colour pairs from computed styles in both themes.

### 9.2 Per round

**R2 (showcase)**
- Sub-path: build and serve at `/` and at `/a/b/`. Page, fonts, chunks, manifest and icons all load. No 404s in the network log.
- Cards: count matches the manifest, kinds match vendor folders, every card has a one-liner of 100 characters or fewer, a Play control and a title.
- Search, filters, What's new and URL-hash restore.
- Theme toggle: click, Space, persistence, no flash on reload (first paint already has the saved theme), `aria-checked`.
- Intro: runs once on cold load, HUD counts, page clickable early, skip works, reload mid-intro converges, shutdown then Wake restores all state.
- Hero: greeting with and without a saved name. Wake reacts to pointer.
- Cables: endpoints on card edges after resize and scroll, hover highlight, ≤ 8 ambient.
- Fusion: WebGL2 present and absent paths, context loss recovery.
- Each demo mounts, plays, pauses, and logs no errors.
- CSP spike in both engines. External request check: only same-origin requests.
- Budget check, perf probes, and the "reacts" check (D17: hover and press every card, chip and control, assert a style or transform change) and the repo checks (items 36, 37). There is no repo check for item 34 (D16).

**R3 (connection, chat, plan)**
- Connection chip for each mock scenario. CORS failure shows the hint.
- Setup: nothing selected by default, zero `login.find` before a choice, Find my login only after a click, "Found Claude, connect?" needs a click, Not now works, API key path, Forget key. The test key appears only in the `Authorization` header to the mock.
- Chat: orb shows while waiting, reply renders, XSS payloads inert, rate limit and cool-down, live region text.
- Preset picker: nine presets, arrow keys, persistence.
- Plan: suggestions arrive and can be accepted, Copy plan text equals the Markdown, zero build ops before "Let's do it!", double click and reload send once (same `sendId`), trail walks four stages with burst, failure shows failure, Done only after the bot says so.
- Approvals: button text is the action name, "Didn't need to ask" updates autonomy, columns move by mouse and keyboard, outlined target preview, usage bars and reset countdown.
- Duplicate and out-of-order mock events are handled.

**R4 (personalization, PWA, accessibility)**
- Personalization answers apply live and persist. Reset works.
- PWA: manifest relative scope, SW installs at `/a/b/`, offline reload shows the shell, update toast appears when the build id changes, iOS hint shows when not installed, badge call made when supported.
- Keyboard-only walkthrough, full report in 9.4.
- Final skill-usage report check against the code.

### 9.3 Visual snapshots
- `toHaveScreenshot` for both themes in both engines at 1280 × 800 and 390 × 844: hero, card grid, a card with demo open, Plan sheet, trail at each stage, Needs-your-OK card, settings, toggle mid-slide (frozen), WebGL fusion (frozen seed).
- Canvas regions use a tolerance of about 2% of pixels. Baselines are per engine and per OS and are committed.

### 9.4 Keyboard and accessibility
- **Keyboard-only walkthrough:** from the page top, Tab through the skip link, theme toggle, Shut down, search, filter chips, a card's Play, Settings. Open the Plan sheet and Settings, work inside them, Escape closes and returns focus. Autonomy rows move by button. Orb picker uses arrow keys. Every step asserts the focused element's accessible name and a visible focus ring.
- **Accessibility checks:** `@axe-core/playwright` (dev-only, D6) in both themes on every view, plus custom checks using `locator.ariaSnapshot()`, `getComputedStyle` and a contrast function:
  - every button, link and input has an accessible name; icon-only buttons have `aria-label`
  - one `h1`, no skipped heading levels, landmarks present (`header`, `main`, `footer`), `lang` set
  - every canvas is `aria-hidden="true"` and `pointer-events: none`
  - live regions exist for chat replies and trail stage changes and receive text
  - focus ring present on every focusable element
  - text contrast is 4.5:1 or better (3:1 large) in both themes, sampled from real computed colours over their real backgrounds
  - no `tabindex` above 0, dialogs trap focus and restore it

### 9.5 Sub-path build test
- `npm run build`, serve `dist/` at `/` and at `/a/b/` with `serve-subpath.mjs`, then run the smoke suite against both. Checks: hash routes, lazy chunks, SW scope, manifest `start_url`, icons, `404.html` redirect, no request leaves the prefix. Also run `check-external.ts` on `dist/`.

### 9.6 Out of Playwright's reach
Playwright WebKit is not iOS Safari. Haptics, the iOS install flow and real iPhone frame times need the owner's phone. They are listed in the R4 handoff as manual steps.

---

## 10. Risks and open questions

1. **Shared origin on GitHub Pages (needs owner decision).** At `<user>.github.io/<repo>/`, every project page of that account shares localStorage with this one. Any script on those pages could read the webhook key. Options: publish from a dedicated GitHub account or organisation, use a custom domain, or accept the risk. Recommendation: a dedicated org or a custom domain before the key feature goes public. The owner's repo name and Pages URL are also not decided yet.
2. **CSP narrowing is unproven.** A second meta CSP added by `boot.js` may not be honoured the same way in WebKit. R2 starts with a spike. The fallback (broad `https:` policy plus the `fetch` allow-list) is weaker, and I will report it plainly if it comes to that.
3. **The webhook API does not exist yet.** Section 5.2 is a proposal. The owner (or Websmith itself) must implement it. Does the owner accept the shape, or have a fixed one the bot already speaks?
4. **CORS on the owner's bot.** Without the headers in 5.2 the page cannot talk to the bot at all. This is a setup step the owner must do. A bot behind a tunnel or a private network may also be unreachable from a phone.
5. **DECIDED (D4, 2026-11-24).** **HTTPS and mixed content.** A Pages page cannot call a plain `http` bot, except loopback in some browsers. Safari's handling of `http://localhost` from an `https` page is not certain. The owner needs an `https` URL for real use.
6. **DECIDED (D5, 2026-11-24).** **API key handling.** SCOPE 16 says the API key is "kept in the browser only", but a worker on the bot side cannot use a key it never receives. Proposal: the key stays in localStorage and is sent once, inside `worker.connect`, to the owner's own webhook only. Is that acceptable? The alternative is that the bot asks for the key itself.
7. **DECIDED (D6, 2026-11-24).** **Accessibility checker licence.** `axe-core` is MPL-2.0, outside the allowed list. The plan uses custom checks. Allowing axe-core as a dev-only dependency (never shipped) would give much better coverage. Owner call.
8. **DECIDED (D7, 2026-11-24).** **Lottie demos.** Playing the Lottie library needs `lottie-web` (MIT, lazy, about 55 KB gzipped). Alternative: a static preview with no playback. Also, Noto animations need the CC BY 4.0 credit in the footer. Which do you prefer?
9. **DECIDED (D8, 2026-11-24).** **three.js for the weather card.** The skill assumes three.js. Own WebGL2 keeps zero dependencies and a small page, but is more code. Recommendation: own WebGL2. Say so if you want three.js (lazy, one card).
10. **DECIDED (D9, 2026-11-24).** **Sound.** SCOPE has no UI sound. The audio skill is applied only in one card demo. Say if you also want opt-in ticks and chimes on cables and the trail.
11. **DECIDED (D2, 2026-11-24).** **Toolkit repo URL and handle.** The vendor README contains the toolkit's GitHub owner name. Cards could link to source and the plan sends a toolkit ref to the worker. Is that public name fine to put in the repo? The plan reads it from `site.config.json` (owner sets it) so nothing is hard-coded. Empty means no source links.
12. **DECIDED (D10, 2026-11-24).** **Intro replay and speed.** Plan: the intro runs once per cold load, can be skipped by any key or click, lasts about 2.2 s, and uses 40 helpers on phones. Should a returning visitor in the same tab session skip it?
13. **DECIDED (D11, 2026-11-24).** **What "Shut down" ends in.** Proposal: the helpers pack the page, a dark "Wake" button remains, and nothing is erased. Reload starts fresh with the intro. Is that the intent?
14. **DECIDED (D12, 2026-11-24).** **Hero name before R4.** The hero needs a name in R2, but the full questions come in R4. Plan pulls a one-field name prompt into the hero in R2. Confirm.
15. **DECIDED (D13, 2026-11-24).** **Fonts.** Space Grotesk and JetBrains Mono (both OFL). Confirm or name others.
16. **Package versions.** The versions in 2.4 are pinned at install time in R2 (`npm view` first, then the lockfile). Vite's current major in Nov 2026 is not verified here.
17. **Reduced motion.** SCOPE 34 skips it. The toolkit docs and several skills say to honour it. The intro, swarm and ASCII hero are intense. The flash-rate rules still hold. Confirm this is still the decision.
18. **DECIDED (D3, 2026-11-24).** **iOS Home Screen storage is separate from Safari.** The installed app starts with empty localStorage, so setup runs again there. The key is never in a URL, so it cannot be passed over. Is a second setup acceptable?
19. **DECIDED (D14, 2026-11-24).** **Status by polling, not push.** Polling is simple and CSP-friendly. SSE or WebSocket would feel livelier. Proposal: polling in v1.
20. **Effect load on phones.** Backdrop blur, WebGL2 fusion, the swarm and the ASCII hero can add up on an iPhone. Tiering (7.4) is the defence, but the owner's phone is the only real test (Q24).
21. **One-day scope.** R2 holds seven large effects plus 43 cards and demos. If it overruns, the fallback order is: fewer demos first (before-and-after text versions), then ambient cables, then WebGL fusion with the CSS chip fallback. No SCOPE item is dropped without your OK.
22. **Toolkit freshness.** `vendor/` is a snapshot. Updating it is the owner's decision, then `npm run manifest`. The build never pulls.
23. **GitHub Pages rollback and settings.** The release notes in R4 will check current Pages docs. I have not verified Pages rollback behaviour.
24. **Real-device checks.** iPhone Safari frame times, haptics and install flow cannot be proven in Playwright. They need your phone before public release.
