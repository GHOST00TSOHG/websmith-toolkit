# Advanced Web & UI Kit (researched November 2026)

It covers
production-level website and interface engineering on the 2026 web platform. Same
format: `skills/*/SKILL.md` for your AI agent, with working, browser-tested code behind them.

**AI agents: read `AGENT_INSTRUCTIONS.md` first.**

## Skills

| Skill | Covers |
|---|---|
| `web-platform-state-2026` | Researched landscape: Interop 2026, Baseline, State of CSS, React 19.2/Next 16, Vite 8, EAA/WCAG 2.2, DTCG tokens, MCP Apps, WebGPU, with sources |
| `modern-css-architecture` | Layers, nesting, @scope, container/style queries, :has(), anchor positioning, popover/dialog, OKLCH, light-dark(), customizable select |
| `design-systems-and-tokens` | DTCG 2025.10 format, token tiers, theming, OKLCH palettes, contrast-checked pairs, pipelines |
| `accessibility-engineering` | WCAG 2.2 AA, EN 301 549 v4.1.1, ARIA patterns, focus, testing |
| `frontend-architecture-and-frameworks` | Rendering strategies, RSC, React Compiler, Next 16, Vite 8/Rolldown, Astro, signals, web components |
| `performance-and-core-web-vitals` | LCP/INP/CLS, speculation rules, bfcache, images/fonts, main-thread scheduling |
| `motion-and-interaction-design` | View transitions (cross-document), scroll-driven animations, @starting-style, linear() springs |
| `ai-native-ui-and-agents` | MCP Apps, generative UI, streaming chat UX, agent-friendly sites |
| `webgpu-and-3d-web` | WebGPU/WGSL, three.js TSL, compute shaders for particles and simulation |
| `progressive-enhancement-and-legacy-devices` | No-JS paths, tiny pages, old TLS, resilient networking |

## Code (`code/`), 28 tests including 10 in a real Chrome browser

| Path | What it is |
|---|---|
| `tools/color.py` | OKLCH ↔ sRGB, gamut mapping, WCAG 2 contrast, APCA Lc, tonal palette generator |
| `tools/tokens.py` | DTCG 2025.10 → CSS: aliases, cycle detection, composites, light-dark() theming |
| `tools/audit.py` | Static accessibility + CLS/perf linter for HTML |
| `site/` | Showcase site: tokens.css (generated), layered CSS, accessible `<ui-tabs>` web component, native dialog, anchored popover, container queries, :has(), view transitions, customizable select, plus `lite.html` (under 1 KB, no JS) for old or low-power devices |
| `screenshots/` | Light, dark and mobile renders captured by the test suite |

## Quick start
```bash
cd code
pip install pytest playwright            # Chrome/Chromium needed for e2e tests
python -m tools.tokens site/tokens/base.tokens.json --light site/tokens/light.tokens.json \
       --dark site/tokens/dark.tokens.json -o site/tokens.css
python -m tools.audit site/*.html
python -m pytest -q                       # CHROME_PATH=/path/to/chrome if needed
python -m http.server -d site 8000        # open http://localhost:8000
```
Then follow `ROADMAP.md`.
