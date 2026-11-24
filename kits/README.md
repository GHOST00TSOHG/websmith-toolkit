# Kits

Five learning kits. Each kit has a `README.md`, an `AGENT_INSTRUCTIONS.md`, a `ROADMAP.md` of staged projects, and working reference code in `code/`.

The kits' skills live in the top-level `skills/` folder, not inside each kit. When a kit says `skills/<name>/SKILL.md`, read it from the repository root. When a skill cites `code/...`, the path is relative to its kit folder here.

| Kit | What it teaches | Skills |
|---|---|---|
| `advanced-vfx-kit` | Production-level simulation, rendering and compositing (Python + NumPy) | `vfx-state-of-the-art-2026`, `fluid-simulation`, `xpbd-and-constraint-solvers`, `sdf-raymarching-and-shaders`, `procedural-fx-patterns`, `compositing-color-and-hdr`, `advanced-character-motion`, `neural-and-ai-vfx`, `gpu-and-performance` |
| `advanced-web-ui-kit` | Website and interface engineering on the 2026 web platform, with a tested demo site and token/contrast tools | `web-platform-state-2026`, `modern-css-architecture`, `design-systems-and-tokens`, `accessibility-engineering`, `frontend-architecture-and-frameworks`, `performance-and-core-web-vitals`, `motion-and-interaction-design`, `ai-native-ui-and-agents`, `webgpu-and-3d-web`, `progressive-enhancement-and-legacy-devices` |
| `animation-skills-kit` | Animation principles, easing math, procedural and physics motion, Blender Python, rendering | `animation-principles`, `interpolation-and-easing-math`, `procedural-and-physics-animation`, `blender-python-scripting`, `rendering-and-encoding` |
| `bot-learning-kit` | Building chat bots in Python: async architecture, LLM calls, guards, memory, tests, operations | `advanced-python`, `async-bot-architecture`, `bot-design-patterns`, `llm-integration`, `production-ops`, `testing-and-debugging` |
| `paper-popup-world-kit` | A papercraft diorama where props fold up as a character walks by (web + Blender) | `style-breakdown`, `papercraft-look`, `proximity-popup-system`, `paper-particles-and-secondary-motion`, `diorama-camera-and-tilt-shift`, `building-it-for-the-web`, `building-it-in-blender` |

## Left out of this repository

- Pre-rendered demo videos and GIFs (`code/out/`, `*.mp4`, `*.gif`). Run the demos to make them again. The repository's `.gitignore` already excludes these.
- `bot-learning-kit/code/.env.example`. Create your own `.env` with `ANTHROPIC_API_KEY`, `LLM_MODEL`, `BOT_NAME`, `BOT_OWNER` and `LOG_LEVEL`, and never commit it.

## Before you rely on them

- The Blender scripts were written where Blender was not available. Run them in Blender first and fix any renamed API.
- Version and browser-support claims were researched in November 2026. Check vendor docs before relying on a specific version. For the maturity of three.js `WebGPURenderer`, also read `skills/web-motion-libraries`.
- The code has its own tests (`python -m pytest -q` in each `code/` folder; `node --test tests/popup.test.mjs` for the paper pop-up logic).

## Licence

MIT, like the rest of this repository. The kits contain no third-party code or assets. Sources cited inside skills are links only.
