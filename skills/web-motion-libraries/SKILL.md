---
name: web-motion-libraries
description: >-
  Use this when choosing or wiring motion libraries: Three.js WebGPU and TSL
  status, GSAP ScrollTrigger, the GSAP license, and the React useGSAP hook.
---
# Web motion libraries

Short notes on Three.js WebGPU and GSAP: when to use them, and how to license GSAP.

## Three.js WebGPU and TSL

`WebGPURenderer` is documented as a "new alternative" to `WebGLRenderer`, not as the default and not as production-ready. It tries a WebGPU backend first, then falls back to WebGL 2 (`forceWebGL` forces WebGL 2). Import `WebGPURenderer` and `NodeMaterial` from `three/webgpu`, and TSL from `three/tsl`. Node materials work only with `WebGPURenderer` (since r164). Latest confirmed release in this research was r187 (Oct 30, 2026).

Browser support (caniuse, October 2026): Chrome and Edge from 113; Safari 26 (desktop labelled "partial"; caniuse does not spell out what is missing); Firefox not supported, or disabled by default. MDN still marks WebGPU as limited availability, not Baseline.

Maintainers on the official three.js forum still call `WebGPURenderer` experimental, including its WebGL fallback (Don McCurdy, Oct 29, 2025; manthrax, May 29, 2026). Prefer `WebGLRenderer` unless you need TSL, node materials, or compute.

Docs: [WebGPURenderer](https://threejs.org/docs/pages/WebGPURenderer.html) (three.js docs, MIT library). Forum: [experimental, including the fallback](https://discourse.threejs.org/t/webgpurenderer-forcewebgl-true-vs-webglrenderer/87805) and [use it only if WebGL cannot do the job](https://discourse.threejs.org/t/webgpurenderer-2x-slower-cpu-and-5-10x-slower-first-frame-than-webglrenderer-on-many-mesh-scenes-r183-same-on-both-backends/91904).

## GSAP ScrollTrigger and React

GSAP is **not open source**. It is under the [Standard No-Charge License](https://gsap.com/standard-license/) (Webflow; effective Apr 30, 2025). Commercial use is covered, including formerly members-only plugins such as SplitText and MorphSVG. It is prohibited in no-code visual animation builders that compete with Webflow, unless you have prior written consent. Do not reverse-engineer it or remove its notices. **Host GSAP and `@gsap/react` in the project repo; do not load them from a CDN.**

ScrollTrigger is a plugin, not core. Register it with `gsap.registerPlugin(ScrollTrigger)`. Minimal use: `gsap.to('.box', { scrollTrigger: '.box', x: 500 })`. Useful options: `trigger`, `start`, `end`, `scrub`, `pin`, `toggleActions` (default `"play none none none"`), `markers`, and `snap`. `ScrollTrigger.create()` makes a standalone instance. Call `ScrollTrigger.refresh()` after layout changes. `clamp()` in start/end needs 3.12 or later. `ScrollTrigger.matchMedia()` is deprecated. Needs GSAP 3.3.0 or later.

In React, use [`useGSAP`](https://gsap.com/resources/React) from `@gsap/react` (same license, not MIT). It is a drop-in for `useEffect` / `useLayoutEffect` that cleans up with `gsap.context()`. Pass `scope` (a container ref) so selectors only match descendants. Wrap event handlers and timeouts in `contextSafe()` or they will not be cleaned up. Register the hook with `gsap.registerPlugin(useGSAP)`. In Next.js App Router, use it in a client component (`'use client'`). Pattern: `useGSAP(() => { gsap.to(...) }, { scope: containerRef })`.

Docs: [ScrollTrigger](https://gsap.com/docs/v3/Plugins/ScrollTrigger/) and [GSAP + React](https://gsap.com/resources/React).

## Don't

- Treat `WebGPURenderer` as the default or as production-ready.
- Use `WebGPURenderer` when `WebGLRenderer` already does the job.
- Load GSAP or `@gsap/react` from a CDN, or treat them as MIT.
- Use GSAP in a no-code animation builder that competes with Webflow without written consent.
- Use deprecated `ScrollTrigger.matchMedia()`, or skip `contextSafe()` for React event handlers.
