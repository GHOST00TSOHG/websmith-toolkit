---
name: procedural-and-physics-animation
description: Generating motion with code instead of keyframes: numerical integration and fixed timesteps, springs, Verlet and position-based dynamics (ropes, cloth), inverse kinematics (FABRIK, two-bone), noise, particles, flocking and sim-to-render decoupling. Use when building simulations, rigs or any motion driven by rules rather than hand-set keys.
---

# Procedural and Physics-Based Animation

## Integrators: choose deliberately
| Method | Notes |
|---|---|
| Explicit Euler | `x += v*dt; v += a*dt`: gains energy, explodes. Avoid. |
| **Semi-implicit Euler** | `v += a*dt; x += v*dt`: stable, cheap. Default choice (`Spring`). |
| **Verlet** | `x_new = 2x - x_prev + a*dt²`: velocity is implicit, so constraints are easy (`VerletRope`). |
| RK4 | Accurate for smooth forces; overkill for most animation, bad with collisions. |

## Fixed timestep, decoupled from rendering
Never step physics by the render frame's dt. Run at a fixed rate (120–240 Hz) with
an accumulator, then **interpolate** between the last two states for display:
```python
acc += frame_dt
while acc >= DT: prev, cur = cur, step(cur, DT); acc -= DT
draw(lerp(prev, cur, acc / DT))
```
`demos/rope_and_arm.py` precomputes states at 240 Hz and samples them at any time,
which is why motion blur sub-frames work with simulations.

## Springs (`Spring`)
Parameterize by **frequency** (Hz) and **damping ratio** ζ, not raw stiffness:
these are intuitive and resolution-independent. ζ ≈ 0.3 bouncy, 1.0 critically
damped (cameras, UI), > 1 sluggish. Keep `ω·dt` well below 1 for stability.

## Position-based dynamics (ropes, cloth, soft bodies)
1. Integrate positions (Verlet). 2. Repeatedly project constraints (distance,
collision, pin) for N iterations. More iterations = stiffer. Cloth = grid of
points with structural + shear + bend distance constraints. Collisions: push
points out of shapes after each iteration.

## Inverse kinematics
- **FABRIK** (`physics.fabrik`): iterative, any number of bones, 2D/3D, preserves
  lengths exactly. Warm-start from the previous pose to prevent popping. Add joint
  limits by clamping angles after each pass.
- **Analytic two-bone IK** (arms, legs): law of cosines gives the exact elbow
  angle. Use a pole vector to choose the bend direction.
- Blend IK with FK animation (`pose = lerp(fk, ik, weight)`) for foot planting
  and hands on props.

## Noise (`Noise1D`)
Gradient noise is smooth randomness: camera shake (`fbm` on x, y, roll with
different seeds), idle breathing, flicker, wind. Use quintic fade for C2 smoothness,
offsets per channel to decorrelate them, and fBm octaves for detail.

## Particles and flocking
- Particle = position, velocity, age, lifetime. Store as numpy arrays (structure of
  arrays) and update vectorized: 100k particles in Python is fine with numpy.
- Emitters spawn with randomized velocity cones; forces: gravity, drag
  (`v *= exp(-k*dt)`), curl noise for swirling smoke.
- **Boids:** separation + alignment + cohesion within a radius. Use a spatial grid
  hash so neighbor search isn't O(n²).

## Determinism
Seed every random generator (`np.random.default_rng(seed)`) so renders are
reproducible and tests are stable.

## Exercise
Turn `VerletRope` into a 2D cloth: a 20×15 grid, top row pinned, wind from
`Noise1D`, rendered as a wireframe. Then add a circle collider the cloth drapes over.

Part of `kits/animation-skills-kit`. Code paths in this skill (such as `code/...`) are relative to that folder.
