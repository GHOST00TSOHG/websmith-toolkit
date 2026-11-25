# Websmith page

One public page that lists everything in this toolkit (skills, learning kits, the ThinkingOrbs animation, the motion kit and installers) and connects to **your own** Websmith bot. Every owner opens the same page. Your settings stay in your own browser, on your own device.

## For a new owner

1. **Open the page.** Use the toolkit's GitHub Pages address (`https://<github-user>.github.io/websmith-toolkit/`). On iPhone you can add it to the Home Screen (Share, then Add to Home Screen); it then opens like an app, and the sliders button in the header takes you to Settings.
2. **First run.** The first time, a short sheet asks for your name (for the "Hi, <name>" greeting) and a theme (Dark, Light or System). Skip keeps a plain "Hi there". You can open it again from Settings > First-time setup.
3. **Connect your bot.** Your bot sends you a private setup link. Open it on the device you use; the page saves the bot and says "Your bot is connected." The link contains your key: don't share it. To set it up by hand instead, open Settings > **Connect your bot** > **Webhook address** and **Key** > Save. The address must start with `https://` (`http://localhost` works for testing). Both are kept only in this browser and sent only to that address.
4. **Find my login (optional).** Settings > **Find my login**. Your bot runs a small helper on your computer (`helper/find-my-login.sh`) and tells the page whether Claude Code or Codex is signed in. Only "signed in / not signed in / not installed" comes back, never a password or token. If one is signed in, the page asks "Found Claude, connect?" and you choose. If none is, it asks "Connect through Terminal?" and, only if you say yes, shows the sign-in command for you to run yourself. Without a webhook, it shows a message to send your bot and a box to paste the bot's reply.
5. **Clear my data** (Settings) removes everything this page saved in this browser and starts the first run again.

**Privacy:** your data stays on this device. The page only talks to the webhook you paste. No analytics, no cookies, no tracking.

Bots: see `../skills/websmith-page/SKILL.md` for the webhook protocol and the helper rules.

## For a maintainer

```sh
cd page
npm ci && npm run check && npm run build   # then: npm run check:dist
```

- `npm run check`: validates the list against the toolkit (every item needs a line in `content/descriptions.json`, 15 words or fewer, no stale entries), types, lint, repo checks, contrast, licences, and the settings-migration unit tests.
- `npm run build`: regenerates `src/generated/toolkit.manifest.json` from the repo root, then builds static files into `dist/` with relative paths, so it works from any sub-path.
- `npm run check:dist`: size budgets and the launch-gate scan of `dist/` (no secrets, notes, source maps, home paths, emails or third-party hosts).
- `npm run dev`: local server (first free port from 5183). `npm test`: build, dist scan, Playwright in Chromium and WebKit.
- The list needs full git history (dates come from it). In CI, check out with `fetch-depth: 0`.
### Publishing

The page is live at https://ghost00tsohg.github.io/websmith-toolkit/ (Pages source: **GitHub Actions**).

`.github/workflows/websmith-page.yml` rebuilds and redeploys it on every push to `main` that touches `page/`, `skills/`, `kits/`, `animations/`, `install/`, `motion/` or `README.md`, and on manual runs (Actions > Websmith page > Run workflow). It runs `npm ci`, `npm run check`, `npm run build` and `npm run check:dist` on Node 24, so a missing description or a leak in `dist/` stops the deploy and the last good page stays up. Every job is gated on `has_pages`, so nothing runs if Pages is turned off.

Code: MIT, like the rest of the repository. Credits: ThinkingOrbs (MIT, `src/vendor/thinking-orbs/`), Space Grotesk and JetBrains Mono (SIL OFL 1.1, `src/assets/fonts/`).
