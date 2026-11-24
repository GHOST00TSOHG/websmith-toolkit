---
name: xpbd-and-constraint-solvers
description: Position-based and constraint-based simulation (PBD, XPBD, small-steps, graph coloring, collisions, friction) for cloth, hair, soft bodies and rigid bodies, plus how Vellum/Otis-style solvers relate. Use when building or tuning cloth, ropes, soft bodies, destruction or any constraint-based effect.
---

# XPBD and Constraint Solvers

Reference: `code/vfx/xpbd.py`, demo `demos/xpbd_cloth.py`.

## Why XPBD
PBD projects positions to satisfy constraints directly, which is stable and
controllable, but its stiffness depends on iteration count and timestep. XPBD adds a
Lagrange multiplier λ and **compliance α** (inverse stiffness), so materials
behave the same whatever the step settings. The per-constraint update is:

```
α̃ = α / h²
Δλ = (-C - α̃ λ) / (Σ w_i |∇C_i|² + α̃)
Δx_i = w_i ∇C_i Δλ
```
α = 0 is perfectly inextensible; larger α is softer.

## Small steps (Macklin et al. 2019)
Many substeps with **one** iteration each beat few substeps with many iterations:
better stiffness, damping and collision response for the same cost. The kit uses
`substeps=15–20`, one pass per substep, and λ reset per substep.

## Parallel solving with graph coloring
Gauss-Seidel (sequential) converges fast but is serial; Jacobi is parallel but
slow and needs averaging. **Coloring** splits constraints into sets where no two
share a particle, then solves each set in parallel and the colors in sequence. That
gives Gauss-Seidel convergence with GPU parallelism (`_greedy_color`). This is
how GPU cloth solvers are structured.

## Constraint zoo
- Distance (stretch, shear), bending (distance across 2 edges, or dihedral angle),
  volume (soft bodies), shape matching (deformable rigid-ish clusters),
  attachment/pin (inverse mass 0), tether (long-range attachments stop cloth sagging).
- **Collisions are constraints too:** project out of shapes and apply **positional
  friction** by cancelling part of the tangential displacement (`_friction`).
- Self-collision: spatial hash + particle radius; continuous collision for thin cloth.

## Production relatives
- **Houdini Vellum:** XPBD-based cloth, hair, grains, softbodies; Houdini 21
  improved dense-collision stability, adaptive remeshing and bend models.
- **Otis (Houdini 21):** GPU muscle/soft-tissue solver for character FX.
- **Rigid bodies:** impulse-based (Bullet) or XPBD rigid bodies (Müller et al.
  2020); fracture via Voronoi pre-fracture + glue constraints; secondary sims seeded
  from fracture edges.
- **Projective Dynamics / VBD (Vertex Block Descent):** newer implicit-like solvers
  with better large-step behaviour.

## Tuning guide
| Symptom | Fix |
|---|---|
| Rubbery cloth | Lower stretch compliance, more substeps |
| Jitter at rest | Add damping, check collision thickness, sleep thresholds |
| Tunnelling | Thicker collision radius, more substeps, CCD |
| Cloth slides off | Friction (positional), tighter collision offset |
| Too stiff folds | Raise bend compliance |

## Exercises
1. Add self-collision with a spatial hash.
2. Replace distance-bending with dihedral bending and compare folds.
3. Port `XPBDCloth.step` to NVIDIA Warp kernels (one kernel per color).

Part of `kits/advanced-vfx-kit`. Code paths in this skill (such as `code/...`) are relative to that folder.
