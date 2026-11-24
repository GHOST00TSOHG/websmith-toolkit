# Coding standards

Short on purpose. When this and `docs/specs/SCOPE.md` disagree, SCOPE wins.

## Working style
- Smallest change that meets the goal. Bias to deletion; no speculative layers or one-caller wrappers.
- Name the data shape first; each piece of state has one owner (settings: `src/core/settings.ts`; list filters: `src/list/state.ts`).
- Idempotent lifecycle steps: re-running setup, a migration or a reload converges to the same state.
- Blast radius: before a change, find every caller and test of what you touch and update them in the same commit.
- Fix root causes. A guard is a fix only when the state it handles is legitimate.

## TypeScript
- Strict mode, no `any`, `unknown` at boundaries. No `as` except to mint a brand after validation.
- Parse untrusted data once at the boundary (localStorage, webhook replies, helper JSON, URL hash, the manifest) into named types; trust types inside.
- Discriminated unions with exhaustive switches (`const _exhaustive: never = x`).
- Brand values that must not mix (`WebhookUrl`, `WebhookKey`, `ItemId`).
- Small pure functions for logic that must be right (the settings migration lives in `src/core/migrate.ts` with unit tests in `scripts/test-migrate.ts`).
- No `console.*` in `src/`.

## Performance (iPhone first)
- LCP < 2.5 s, INP < 200 ms, CLS < 0.1. Budgets in `scripts/check-dist.ts`.
- Staged boot; heavy effects and every sheet are lazy chunks. One WebGL context, one rAF loop, pause offscreen and when hidden.
- Animate transform and opacity only. No per-frame allocation.
- Self-hosted woff2 fonts, the critical one preloaded. No new runtime dependencies without a reason.
- Sheets are native `<dialog>`s in the top layer (no layout shift), solid fills, no blur or filters.

## PWA (GitHub Pages)
- `public/manifest.webmanifest`: relative `start_url`, `scope` and `id` (`./`), `display: standalone`, theme colour, PNG icons 192 and 512, a 180x180 apple-touch-icon, all in-repo (`scripts/make-icons.ts`).
- **No service worker for now:** a stale cache could keep owners on an old page and block updates of the one public page. Revisit with a versioned, network-first worker if offline use is wanted.
- Installed mode (`display-mode: standalone` or `navigator.standalone`) has no browser toolbar; the header Settings button is the way back.
- GitHub Pages cannot set headers: the CSP is a `<meta>` tag (no `frame-ancestors` possible). A saved webhook narrows `connect-src` to its origin at load.

## Touch and iPhone Safari
- Pointer Events with capture; `touch-action: manipulation` on buttons; never disable zoom; inputs at 16 px.
- Real `<input switch>` for the haptic tick, never scripted. Safe-area insets and `100dvh`.

## Accessibility
- Keyboard reachable with a visible focus ring; Escape closes sheets; icon buttons have names; live regions for status text. AA contrast in both themes.

## Security and privacy
- The page is public and so is everything in `dist/`: no secrets in the bundle, repo or history.
- Webhook key: localStorage only, sent only as `Authorization: Bearer` to the owner's own https webhook. Never in URLs, bodies, logs or tests.
- Find my login: opt-in, nothing pre-ticked, nothing automatic. The helper keeps exit codes only and never reads tokens or credential files. The page never runs anything.
- "Clear my data" removes exactly this page's keys (the github.io origin is shared with the owner's other Pages sites).

## Before committing
- `npm run check`, `npm run build`, `npm run check:dist` green.
- Review your own diff for personal data, secrets, bypassed consent and lost settings.
- Commit messages: imperative subject, body says why.
