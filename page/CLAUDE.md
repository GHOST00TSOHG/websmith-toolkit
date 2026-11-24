# Websmith page

A static public page inside the open-source `websmith-toolkit` repo (this folder is `page/`). It lists the toolkit (data source: the repo root `..`) as one plain list, and lets each owner connect their own Websmith bot. One page for every owner; each person's settings live only in their own browser. Hosted on GitHub Pages. Original builder-blueprint design.

## Read first
- `HANDOFF.md`: current state and the next step. `LAUNCH-CHECKLIST.md`: what must be OK before going public.
- `docs/coding-standards.md`: how code is written here.
- `docs/specs/SCOPE.md`, `docs/PLAN.md` (skill checklist in section 6).
- `../skills/<name>/SKILL.md`: the toolkit skills (`../skills/websmith-page/` is this page's own bot skill).

## Commands (run in `page/`)
- `npm run check`: list vs toolkit and descriptions, types, lint, repo checks, contrast, licences, migration tests.
- `npm run build`: regenerates the manifest from `..`, then builds `dist/` (relative base, works from a sub-path).
- `npm run check:dist`: size budgets and the launch-gate scan of `dist/`.
- `npm run dev` (port from 5183; never 4191 or 4291), `npm test` (Playwright, Chromium and WebKit).

## Hard rules
- **Public repo: no personal data.** No owner names, home-directory paths, host names, emails or private project names in code, docs, tests, comments or commits. Say "the owner".
- Original design only; no borrowed brand look, names or logos. No copied reference code or video.
- Self-host every asset. No CDNs. The only runtime network call is to the owner's own webhook.
- Settings (name, theme, webhook address and key, connected tools) live only in the browser (`ws.settings` in localStorage). Never in the URL, logs, commits or tests (tests use fake values only).
- Find my login is opt-in, nothing pre-ticked; the helper never reads tokens or credential files; the page never runs commands.
- Every list item has one plain-English line (15 words max) in `content/descriptions.json`. `npm run check` enforces it.
- No cards, per-item demos or row animations. Keep the hero, orb, cloth, header, Connected pill and list as they are. Sheets are plain DOM: no blur, filters, canvases or animation.
- Reduced motion: calm crossfades, still canvases, no opening. iPhone safety: staged boot, at most one WebGL context, under 20 GPU layers and 40 MB at load.
- Install packages only in `page/`; nothing global. Never read `.env` files.
- Do not push, merge to main, enable Pages or run workflows without the owner's OK.
- Never stash, reset, checkout, restore or discard changes; commit instead. Stop only processes you started, by PID.
- Only `page/` and `skills/websmith-page/` (and, at go-live, `.github/workflows/websmith-page.yml`) belong to this page; leave other toolkit files alone.

## Done for a round
`npm run check`, `npm run build` and `npm run check:dist` green; skill checklist in `docs/PLAN.md` updated; `HANDOFF.md` and `LAUNCH-CHECKLIST.md` current; work committed.
