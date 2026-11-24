---
name: webgpu-and-3d-web
description: GPU graphics and compute in the browser: WebGPU and WGSL (now in all major browsers), three.js WebGPURenderer and TSL, Babylon.js, compute shaders for particles and simulation, porting classic effects to the web, and fallbacks to WebGL. Use for 3D sites, interactive visuals, shaders, or in-browser simulation and ML.
---

# WebGPU & 3D on the Web

## Status
WebGPU is supported in Chrome, Edge, Firefox (141+, platforms expanding) and
Safari 26. Feature-detect with `navigator.gpu`, and fall back to WebGL2 or a static image.

## Mental model
Adapter → device → buffers/textures → **pipelines** (render or compute) with WGSL
shaders → command encoder → queue.submit. Unlike WebGL, it has explicit bind groups,
**compute shaders** and much lower CPU overhead.

## Choose a level
- **three.js `WebGPURenderer` + TSL** (Three Shading Language: node-based shaders
  compiled to WGSL or GLSL) for most 3D sites. It falls back to WebGL automatically.
- **Babylon.js** for engine-like features (render bundles / snapshot rendering).
- Raw WebGPU for custom compute (particles, fluids, ML inference).

## Classic effects on WebGPU
- SDF raymarching becomes a fullscreen fragment shader.
- Particles become a compute shader updating a storage buffer of positions,
  rendered as instanced points with additive blending.
- Grid fluids become compute passes: advect → divergence → Jacobi pressure (ping-pong
  textures) → project.
- Post FX (bloom, tonemap) run as compute or fragment passes on an `rgba16float` HDR target.

## Production concerns
- Respect `prefers-reduced-motion`; pause when the tab is hidden or off-screen
  (IntersectionObserver).
- Cap device pixel ratio (`min(devicePixelRatio, 2)`); adapt quality to frame time.
- Accessibility: canvas content needs text alternatives and DOM controls.
- Load lazily: don't let 3D delay LCP.

## Exercises
1. WebGPU compute: 100k curl-noise particles at 60 fps.
2. Write a raymarched SDF scene in WGSL with soft shadows.
3. three.js TSL material driven by the design tokens (brand colors from CSS variables).

Part of `kits/advanced-web-ui-kit`. Code paths in this skill (such as `code/...`) are relative to that folder.

For the maturity of three.js `WebGPURenderer` and its WebGL fallback, see `skills/web-motion-libraries`.
