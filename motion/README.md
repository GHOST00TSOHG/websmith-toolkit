# Motion kit

Code-driven short films: Remotion (React) scenes to an h264 MP4, a generated royalty-free soundtrack, a two-pass loudnorm mux, and blocking QA. Everything runs locally. Fonts are bundled. There are no API keys.

Read [PLAYBOOK.md](PLAYBOOK.md) first. Web versions of every move and transition: [WEB.md](WEB.md).

## Quick start

```bash
cd motion
# If template/node_modules is missing:
#   cd template && npm ci && cd ..
./new.sh my-film                      # or: ./new.sh my-film --preset starter
cd projects/my-film
# 1. write SCRIPT.md + src/timeline.json   2. scenes in src/scenes/, poses in src/handoff.json
npx tsc --noEmit
npx remotion studio                    # live preview
bash ../../scripts/render.sh . 16x9 ../../my-film.mp4
```

Exit code 0 means QA passed. Review images are in `projects/my-film/out/review/sheet.png` and `cut_*.png`.

## Folder map

```
PLAYBOOK.md            rules, storytelling, workflow, audio, QA
WEB.md                 web mapping (CSS / WAAPI / scroll-driven / View Transitions)
new.sh                 new.sh <name> [--preset starter] -> projects/<name>
scripts/render.sh      tsc -> soundtrack -> draft -> review -> final -> loudnorm mux -> QA
scripts/qa.sh, qa.py   streams, -14 LUFS +/-1, TP <= -1 dBTP, black + frozen frames
scripts/review.sh      1 fps contact sheet (6xN) + 0.1 s close-ups around every cut
audio/generate.py      soundtrack generator: mood upbeat | cinematic
template/              Remotion 4.0.545 + React 19.1 (tokens, motion, moves, transitions,
                       Story, Handoff, LottieIcon, SafeZone; fonts: Inter + Jost, both SIL OFL 1.1)
presets/starter/       default preset overlay (SCRIPT.md + qa.json)
projects/demo/         short demo film
projects/smoke-9x16/   vertical smoke test
projects/lottie-test/  LottieIcon delay/trim proof
lottie/                fetch.mjs + icon library (useAnimations MIT, Noto CC BY 4.0)
html-render/           HTML -> MP4 fallback (puppeteer-core)
docs/archive/          earlier guides, read-only (superseded by PLAYBOOK.md)
```

`new.sh` does not reinstall dependencies. It copies the template and symlinks `template/node_modules`.
