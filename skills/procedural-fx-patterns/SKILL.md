---
name: procedural-fx-patterns
description: Procedural motion and texture recipes used across VFX and motion graphics: gradient noise, fBm, domain warping, curl noise flow fields, particle systems with trails, reaction-diffusion, Voronoi, and noise-driven secondary motion. Use when designing magic, energy, organic growth, abstract motion graphics or particle effects.
---

# Procedural FX Patterns

Reference: `code/vfx/procedural.py`, demo `demos/curl_particles.py`.

## Noise toolkit
- **Gradient (Perlin) noise:** smooth and band-limited. Use quintic fade for C2
  smoothness. Simplex/OpenSimplex reduce grid artifacts in 3D+.
- **fBm:** sum octaves (lacunarity ~2, gain ~0.5) for detail at every scale.
- **Ridged / billow:** `1-|n|` for ridges (lightning, mountains), `|n|` for clouds.
- **Domain warping:** feed noise into the coordinates of noise (`warped`) to get
  marble, nebulae and flowing ink. Animate the warp offset over time.
- Newer noise types in production tools (e.g. phasor noise, bubble noise in
  Houdini 21) give controllable oriented or cellular patterns.

## Curl noise: the particle workhorse
Take the curl of a noise potential: `(∂ψ/∂y, -∂ψ/∂x)` in 2D, curl of a vector
potential in 3D. It's **divergence-free**, so particles swirl like a real fluid
and don't clump or empty out. Add an outward or vortex field, animate by
scrolling noise coordinates, and modulate near obstacles (Bridson's trick:
ramp the potential to 0 at boundaries).

## Particle system architecture
- Structure-of-arrays (`pos`, `vel`, `age`, `life`) updated with vectorized numpy
  (or GPU). Respawn dead particles instead of allocating.
- Shape over life: size, opacity `sin(π·age/life)`, color by speed or age.
- Render **additively into an HDR float buffer** with sub-pixel splatting
  (`post.splat_points`), then bloom and tonemap. Energy effects need HDR.
- **Trails:** feedback (`buffer *= decay` each frame) or store positions per
  particle and draw ribbons.

## Reaction-diffusion (Gray-Scott)
Two chemicals diffuse and react; the (f, k) parameters choose spots, stripes,
coral or mitosis. Use the result as a growth mask, displacement, or dissolve
transition. Run it on a mesh surface (Houdini or Geometry Nodes) for organic growth.

## More recipes
- **Voronoi/Worley:** cracks, cells, shattered glass, stylized water caustics.
- **Flow maps:** paint a 2D vector field to drive textures (lava, rivers).
- **SDF-guided particles:** move along the SDF gradient to swarm onto a logo.
- **Noise-driven secondary motion:** camera shake (3 decorrelated fBm channels),
  flicker, hover bob.

## Exercises
1. Make particles form a word: target positions sampled from a text mask, blended
   with curl noise that fades out over time.
2. Use `gray_scott` as a dissolve mask between two images.
3. 3D curl noise particles with depth-sorted rendering.

Part of `kits/advanced-vfx-kit`. Code paths in this skill (such as `code/...`) are relative to that folder.
