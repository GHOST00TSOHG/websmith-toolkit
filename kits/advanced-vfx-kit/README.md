# Advanced VFX Kit: State-of-the-Art Animation & Effects (November 2026)

It covers production-level simulation, rendering and compositing, plus a
researched map of where the industry is right now. Same format: `skills/*/SKILL.md`
for your AI agent, with working code behind every skill.

**AI agents: read `AGENT_INSTRUCTIONS.md` first.**

## Skills

| Skill | Covers |
|---|---|
| `vfx-state-of-the-art-2026` | Researched landscape: Houdini 22 splats, UE 5.7 motion matching, Blender 5 SDF/volume grids, ACES 2.0, SIGGRAPH 2026 trends, with sources |
| `fluid-simulation` | Eulerian smoke/fire, projection, vorticity, MacCormack, MAC, FLIP/APIC, SPH, MPM, VDB |
| `xpbd-and-constraint-solvers` | XPBD, small steps, graph coloring, collisions + friction, Vellum/Otis context |
| `sdf-raymarching-and-shaders` | SDF modeling, smooth blends, domain ops, soft shadows/AO, porting to GLSL |
| `procedural-fx-patterns` | fBm, domain warping, curl noise, HDR particles, reaction-diffusion |
| `compositing-color-and-hdr` | Scene-linear workflow, ACES 2.0/OCIO, bloom, lens FX, alpha, deep comp |
| `advanced-character-motion` | Motion matching, inertialization, foot IK, ragdoll blends, ML deformers, muscles |
| `neural-and-ai-vfx` | 3D/4D Gaussian splatting, NeRF, differentiable sim/render, controlled generative video |
| `gpu-and-performance` | Vectorization, multiprocessing, Numba, Warp, Taichi, CuPy, shaders |

## Code (`code/vfx/`), all tested (19 tests)

| Module | What it implements |
|---|---|
| `fluids.py` | 2D smoke/fire solver: buoyancy, vorticity confinement, consistent pressure projection, clamped MacCormack advection |
| `xpbd.py` | XPBD cloth: compliance, small steps, graph-colored vectorized solve, sphere/floor collision with friction |
| `sdf.py` | SDF primitives and operators, vectorized sphere tracing, normals, soft shadows, AO |
| `procedural.py` | Vectorized Perlin, fBm, domain warp, curl noise, Gray-Scott reaction-diffusion |
| `post.py` | HDR splatting, multi-scale bloom, ACES-fit and AgX-like tonemaps, CA, vignette, grain, sRGB |
| `motion.py` | Quintic inertialization, motion-matching database |
| `splats.py` | 2D Gaussian splatting renderer (front-to-back compositing) |
| `io.py` | ffmpeg MP4 + GIF writer |

## Demos (`code/demos/`, pre-rendered in `code/out/`)
- `smoke_fire`: rising fire plume with turbulent smoke, bloom, filmic tonemap.
- `sdf_morph`: raymarched melting shapes, soft shadows, AO, fog, orbiting camera
  (renders in parallel).
- `curl_particles`: 30k energy particles in curl noise, HDR trails, bloom, lens FX.
- `xpbd_cloth`: sheet ripples in gusty wind, then drapes over a sphere.

## Quick start
```bash
cd code
pip install numpy scipy pillow pytest     # + ffmpeg on PATH
python -m pytest -q                       # 19 tests
python -m demos.smoke_fire                # ~20 s
python -m demos.sdf_morph                 # ~40 s on 2 cores
```
Then see `ROADMAP.md`.
