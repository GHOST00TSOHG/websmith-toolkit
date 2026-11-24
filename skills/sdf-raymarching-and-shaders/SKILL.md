---
name: sdf-raymarching-and-shaders
description: Signed distance fields, sphere tracing, smooth blending, domain operations, soft shadows, ambient occlusion and fog, and porting the math to GLSL/HLSL shaders, ShaderToy and Geometry Nodes SDF grids. Use for procedural shapes, morphing, motion graphics, shader effects or real-time raymarched visuals.
---

# SDFs, Raymarching and Shaders

Reference: `code/vfx/sdf.py`, demo `demos/sdf_morph.py` (rendered in parallel
processes). Every function is written like a fragment shader, with pixels as array rows.

## Core ideas
- An SDF returns the distance to the nearest surface (negative inside).
- **Sphere tracing:** step along the ray by the SDF value, which is safe because
  nothing is closer. Use a hit epsilon scaled by distance (pixel footprint) and a
  relaxation factor (0.8–0.9) for inexact SDFs.
- **Normals** = SDF gradient (tetrahedral 4-tap trick).

## Operators
- Union `min`, intersection `max`, subtraction `max(a, -b)`.
- **Smooth min** (`smin`) blends shapes organically; animate k for melting morphs.
- **Domain ops:** repetition (`repeat`, infinite copies free), mirroring
  `abs(p)`, twisting/bending (rotate p by an angle depending on p.y), and
  displacement (add noise: makes the SDF inexact, so reduce the step size).
- **Rounding:** `sdf - r` rounds any shape.

## Lighting tricks that come almost free
- **Soft shadows:** march toward the light and keep `min(k*h/t)`. A ray that
  passes close to geometry gets a penumbra.
- **Ambient occlusion:** sample the SDF a few steps along the normal.
- **Fog:** `exp(-density * t²)` blends to the sky color.
- Add subsurface (sample SDF inside), iridescence, or glow (accumulate
  `1/(1+d²)` along the ray for neon).

## Porting to the GPU
NumPy array ↔ GLSL per-pixel is nearly 1:1: `length`, `normalize`, `clamp`, `mix`
exist in GLSL. Run in ShaderToy, a WebGL page, moderngl from Python, Unreal
custom material nodes, or Godot shaders. GPU raymarching runs 1000× faster than
this NumPy version.

## SDFs in production
- **Blender 5.0 Geometry Nodes** have SDF grid nodes and volume grids. Model with
  booleans and smooth blends procedurally, then mesh.
- Houdini VDB SDFs: collision fields for sims, booleans, offsets, morphing via
  SDF interpolation.
- Unreal: Mesh Distance Fields drive soft shadows, AO and Niagara collisions.
- Fonts: SDF text rendering gives crisp scalable glyphs, glows and outlines.

## Exercises
1. Twist the box over time (rotate p.xz by an angle proportional to p.y).
2. Add a neon glow pass accumulated along the ray and bloom it.
3. Port `scene_at` + `render` to a ShaderToy shader.

Part of `kits/advanced-vfx-kit`. Code paths in this skill (such as `code/...`) are relative to that folder.
