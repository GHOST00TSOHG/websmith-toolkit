# Advanced Animation Roadmap

## Stage 1: Motion quality
- [ ] Bowling ball vs beach ball from the same `bouncing_ball.py` (parameters only).
- [ ] Add a character "hop" with anticipation, overlap on ears/antenna (springs).
- [ ] Animate "on twos" and compare the feel.

## Stage 2: Math
- [ ] Plot every easing curve with matplotlib in one grid.
- [ ] Ease distance along an `ArcLengthPath`; move a camera on it with a spring.
- [ ] 3D rotation track using slerp between keyed quaternions.

## Stage 3: Simulation
- [ ] 2D cloth with a collider (from `VerletRope`).
- [ ] Particle system with numpy arrays: fountain, then smoke with curl noise.
- [ ] Boids with a spatial hash, 2,000 agents at 24 fps offline.
- [ ] Two-bone analytic IK with a pole vector; compare with FABRIK.

## Stage 4: Rendering pipeline
- [ ] Parallel frame rendering with a process pool; measure speedup.
- [ ] Two-pass ffmpeg GIF palettes; compare size and quality to `write_gif`.
- [ ] Try skia-python or moderngl for a faster renderer behind the same `draw(t)` API.

## Stage 5: 3D
- [ ] Run `procedural_bounce.py` in Blender headless; fix any API drift.
- [ ] Procedural scene generator: 10 variations rendered by one script.
- [ ] Script a simple rig (armature + IK constraint) and animate its controls.
