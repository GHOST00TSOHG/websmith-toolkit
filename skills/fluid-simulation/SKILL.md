---
name: fluid-simulation
description: Smoke, fire and liquid simulation: Eulerian grids (advection, pressure projection, vorticity confinement), MacCormack/BFECC, MAC grids, FLIP/PIC/APIC, SPH, MPM, sparse grids (VDB), solvers and stability. Use when building, tuning or debugging any fluid, smoke, fire or liquid effect.
---

# Fluid Simulation

Reference implementation: `code/vfx/fluids.py`, demo `demos/smoke_fire.py`.

## The incompressible Navier-Stokes loop (smoke/fire)
1. **Forces:** buoyancy `v += dt * (alpha*T - beta*rho)`, wind, artist forces.
2. **Advect** velocity by itself (semi-Lagrangian: trace back, sample).
3. **Vorticity confinement:** measure the swirl ω = curl u, push along
   N × ω (N = normalized gradient of |ω|) to restore small eddies that numerical
   diffusion removed. This is the "turbulence" dial.
4. **Project:** solve ∇²p = ∇·u, then u -= ∇p, which makes the flow incompressible.
   This step is what creates swirls and rolling plumes.
5. **Advect scalars** (density, temperature, fuel) and apply dissipation and cooling.

## Accuracy upgrades
- **MacCormack / BFECC:** advect forward, then backward, then correct by half the
  round-trip error. It's much sharper; *clamp* to the neighbourhood min/max or it
  goes unstable (`advect_maccormack`).
- **Staggered MAC grid:** store u on x-faces and v on y-faces. Pressure
  gradients and divergence become compact and exact, with no checkerboard
  decoupling (the collocated version in this kit explains why in `project()`).
- **Pressure solver:** Jacobi is for teaching. Production uses
  conjugate-gradient with a multigrid or MIC(0) preconditioner. Warm-start from the
  previous frame.
- **Time step:** CFL condition: `dt * max|u| / dx ≲ 1–5` with semi-Lagrangian;
  substep fast regions. Spatiotemporal FLIP (SIGGRAPH 2026) pushes much larger steps.

## Liquids: particles + grid
- **PIC → FLIP → APIC:** particles carry velocity; transfer to the grid,
  project, transfer back. PIC is stable but viscous; FLIP (transfer only the
  *change*) is lively but noisy; blend 95–99% FLIP; APIC stores per-particle
  affine velocity: energetic *and* stable. Houdini's FLIP solver is this family.
- **Surface:** particles → SDF (VDB from particles) → mesh, with smoothing.
- **Narrow band:** simulate particles only near the surface, with a grid below.

## SPH (Smoothed Particle Hydrodynamics)
Grid-free, with kernel-weighted neighbour sums. Good for splashes and real-time
(position-based fluids = SPH with PBD constraints). It needs a spatial hash for
neighbours and has compressibility issues (use DFSPH/IISPH).

## MPM (Material Point Method)
Particles + background grid with a full stress model. It handles snow, sand,
mud, jelly and tearing metal in one framework with automatic self-collision. Houdini's
multi-material MPM solver is the production reference. Taichi and Warp have
compact MPM examples (MLS-MPM in ~100 lines).

## Fire specifics
Fuel → burn → heat + soot. Shade fire from **temperature through a blackbody
ramp** (emission) and smoke from **density with scattering**. Expansion from
combustion (positive divergence target in the projection) gives billowing.
Render as volumes: sparse VDB, ray-marched with delta/ratio tracking.

## Sparse grids
Fluids occupy a fraction of the box: OpenVDB / NanoVDB (GPU) store active
tiles only. Blender 5 Geometry Nodes and Houdini both process VDB grids natively.

## Art-direction toolkit
Target shapes via guiding forces; up-res (wavelet turbulence, or Houdini 21's
ML Volume Upres); retime with velocity-based interpolation; mask forces by
regions; cache everything (simulate once, render many).

## Exercises
1. Convert `Smoke2D` to a MAC grid and compare residual divergence.
2. Add a fuel field and expansion to make a fireball.
3. Write a 2D PIC/FLIP liquid (dam break) reusing `project()`.

Part of `kits/advanced-vfx-kit`. Code paths in this skill (such as `code/...`) are relative to that folder.
