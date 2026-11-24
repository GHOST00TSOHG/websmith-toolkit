# websmith-toolkit

Scripts, a motion-graphics kit, and portable skills for a Websmith builder bot.

A bot (or a person) fetches a file from this repository and runs it. Installers target Apple Silicon macOS. They install into a folder under `~/builds`, unless a note says otherwise. They never edit shell profiles or your login PATH.

This repository may start private. Raw fetch URLs work for anyone only after it is public. Pin a commit SHA once you rely on a script.

## Layout

- `install/` — installers and the Xcode checklist
- `motion/` — Remotion motion-graphics kit (see `motion/PLAYBOOK.md`)
- `animations/thinking-orbs/` — vendored ThinkingOrbs engine, demo, and how-to
- `kits/` — five learning kits (VFX, web UI, animation, bots, paper pop-up world) with reference code and roadmaps; see `kits/README.md`
- `skills/` — portable builder skills (markdown):
  - `admin-backoffice` — roles, tables, and an append-only audit log for admin software
  - `audio-reactive-visuals`
  - `installable-pwa`
  - `iphone-safari-touch-haptics`
  - `payments-test-mode` — test-mode Stripe Checkout, webhooks, and refunds
  - `ship-whole-app` — a safe Cloudflare release, with a way to undo it
  - `stylized-water-sky-weather`
  - `swiftui-home-widgets`
  - `thinking-orbs` — dotted AI thinking and loading indicators (web or SwiftUI)
  - `web-motion-libraries` — Three.js WebGPU/TSL status, GSAP ScrollTrigger, and the React cleanup hook
  - 37 more skills from the five kits, listed by kit in `kits/README.md`
- `LICENSE` — MIT, for the files in this repository

## How a bot uses an installer

1. Fetch the raw script. Prefer a commit SHA over a branch name.
2. Read the script.
3. Run it.
4. Check the summary it prints (paths, versions, checksums).
5. Call the tool by full path, or set `PATH` for the current session only.

```bash
SHA=<commit-sha>
curl -fsSL "https://raw.githubusercontent.com/GHOST00TSOHG/websmith-toolkit/${SHA}/install/colmap-brush.sh" -o /tmp/colmap-brush.sh
# read /tmp/colmap-brush.sh
bash /tmp/colmap-brush.sh
~/builds/splat-tools/bin/colmap version
~/builds/splat-tools/bin/brush --version
```

Rust and beanfx follow the same pattern. Xcode is documented in `install/xcode.md` because the licence step needs the owner to run `sudo`.

For the motion kit, clone this repository (or sparse-checkout `motion/`), then follow `motion/README.md`: `npm ci` in `motion/template`, `./new.sh <name> [--preset starter]`, `npx tsc --noEmit`, then `scripts/render.sh` and `scripts/qa.sh`.

## Installers

| File | What it does | Where it writes |
|---|---|---|
| `install/colmap-brush.sh` | COLMAP 4.2.1 official arm64 app and Brush 0.3.0, plus `bin/` wrappers | `~/builds/splat-tools` |
| `install/rust.sh` | Official rustup, minimal profile, `--no-modify-path` | `~/.cargo` and `~/.rustup` |
| `install/beanfx.sh` | Enables the baenv/beanfx Claude Code plugin in a project | `<project>/.claude/settings.json` |
| `install/xcode.md` | Xcode from the App Store, licence, iOS Simulator, duplicate runtimes | `/Applications/Xcode.app` and Apple's simulator runtimes |

`rust.sh` is the exception to `~/builds`: rustup always uses `~/.cargo` and `~/.rustup`. The script says so when it runs. `beanfx.sh` expects you to pass a project folder such as `~/builds/<name>`.

Scripts are idempotent. They check for an existing install before downloading, and they verify SHA-256 checksums when the upstream project publishes them.

## Licences

Files in this repository are MIT (see `LICENSE`), except where a bundled third-party file carries its own licence.

- **COLMAP 4.2.1** — New BSD (3-clause). A built `COLMAP.app` also ships third-party libraries (Qt, Boost, FFmpeg-related, and others) that may use other licences. See the official COPYING text.
- **Brush 0.3.0** — Apache License 2.0.
- **Rust / rustup** — Apache-2.0 or MIT, under the Rust project's terms. The installer is fetched from `static.rust-lang.org` and checksummed.
- **beanfx** — see [baenv/beanfx](https://github.com/baenv/beanfx) for that project's licence.
- **Xcode and the iOS Simulator** — Apple software, under Apple's licence, from the App Store.
- **Motion kit fonts** — Inter and Jost, SIL Open Font License 1.1 (`motion/template/public/fonts/`).
- **Lottie icons** — useAnimations (MIT) and Google Noto animated emoji (CC BY 4.0). Credit Noto as "Emoji animations: Animated Noto Emoji by Google, CC BY 4.0".
- **Remotion and other npm packages** — their own licences, installed from the lockfile when you run `npm ci`.
- **ThinkingOrbs** — MIT. The canvas/React engine and designs are Copyright 2026 Jakub Antalik (`thinking-orbs` 0.3.2). The SwiftUI port is Copyright 2026 Haplo LLC and Jakub Antalik. See `animations/thinking-orbs/NOTICE` and the LICENSE files in that folder.

The installers download official upstream binaries. They do not vendor those binaries in this repository.
