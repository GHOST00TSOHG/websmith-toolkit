# Advanced Web & UI Roadmap

## Stage 1: Platform mastery
- [ ] Replace a JS dropdown with popover + anchor positioning; add `:popover-open` animation.
- [ ] Container style query variants for `.card` (`--variant: compact`).
- [ ] Shared-element cross-document transition: card → detail page.

## Stage 2: Design system
- [ ] Add high-contrast and brand-B themes via the tokens build (resolver-style).
- [ ] Extend `tools/tokens.py` with border/transition composites + an iOS/Android output.
- [ ] Display-P3 palette variant behind `@media (color-gamut: p3)`.

## Stage 3: Quality gates
- [ ] axe-core in the Playwright suite; fail on serious issues.
- [ ] Lighthouse CI with budgets (LCP, INP, JS KB).
- [ ] Visual regression: compare screenshots against approved baselines.

## Stage 4: App architecture
- [ ] Rebuild the showcase in Astro (islands) and in Next.js 16 (RSC); compare JS shipped.
- [ ] React 19.2 + Compiler version of the theme toggle and tabs.
- [ ] Vite 8 library build for `<ui-tabs>` as a distributable web component.

## Stage 5: Real-time + AI
- [ ] Real-time web app: FastAPI backend, modern page with streaming + optimistic
      updates, and a no-JS lite version of the same flow.
- [ ] MCP App that renders an interactive form or dashboard inside an AI chat.
- [ ] Generative UI: a model fills a JSON schema; render it with design-system components.

## Stage 6: GPU
- [ ] WebGPU compute particles driven by curl noise.
- [ ] three.js TSL hero scene themed by design tokens, with a static fallback.
