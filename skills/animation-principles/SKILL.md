---
name: animation-principles
description: The classic principles of animation (timing, spacing, easing, squash and stretch, anticipation, follow-through, overlap, arcs, secondary action, staging, exaggeration) translated into concrete code and parameters. Use when designing or critiquing any motion, or when an animation "feels wrong".
---

# Animation Principles, Expressed in Code

Motion feels alive when it obeys these rules. Each one maps to a technique in
`code/anim/`. See `demos/bouncing_ball.py` for most of them in one file.

| Principle | What it means | How to do it in code |
|---|---|---|
| **Timing** | How many frames an action takes; sets weight and mood | Keyframe times in a `Track`. Heavy = slower; quick = 4–8 frames at 24 fps |
| **Spacing / slow in–slow out** | Distance between frames varies | Easing functions (`easing.py`); never default to `linear` except for mechanical motion |
| **Squash & stretch** | Deform with speed and impact; keep volume | Scale along velocity: `sy = 1 + k*|v|`, `sx = 1/sy` (2D area) or `1/sqrt(sy)` (3D volume) |
| **Anticipation** | Small move opposite to the main action first | `in_back` easing, or an extra key moving the wrong way |
| **Follow-through & overlap** | Parts keep moving after the body stops, at different rates | Under-damped `Spring` (zeta 0.2–0.5); time-offset child tracks by a few frames |
| **Arcs** | Natural motion travels on curves | Catmull-Rom paths (`curves.py`); separate x and y easing creates arcs |
| **Secondary action** | Supporting motion that adds life | Noise (`Noise1D.fbm`) for idle sway, ropes/hair via `VerletRope` |
| **Staging** | One clear idea at a time | Contrast, framing; move one thing while others hold |
| **Exaggeration** | Push past realism for clarity | Scale squash/overshoot parameters up 20–50% and compare |
| **Solid drawing / appeal** | Consistent forms, readable silhouettes | Test silhouettes at thumbnail size; avoid symmetry ("twinning") |

## Timing reference (24 fps)
- Blink: 2–4 frames closed. Head turn: 6–12. Light object fall of 1 m: ~11 frames.
- Bounce height and hang time: time is proportional to sqrt(height). A ball that
  bounces to 45% of its height needs about 67% of the time.
- Holds: a "moving hold" (tiny drift or a spring settling) beats a frozen pose.

## Diagnosing bad motion
- **Floaty:** falls use ease-out instead of ease-in, or timing is too slow.
- **Robotic:** linear spacing; everything starts and stops at once (add overlap).
- **Jittery:** simulation tied to frame rate, or unsmoothed noise. Use a fixed
  timestep and C2 noise (quintic fade).
- **Popping:** IK solved from scratch each frame. Warm-start from the last pose
  (`demos/rope_and_arm.py`).
- **Mushy impacts:** contact keys have smooth tangents. Use sharp ("vector") handles at
  contacts and add 1–2 frames of squash.

## Exercise
In `bouncing_ball.py` change the ball to a bowling ball (less squash, faster decay,
tiny bounces) then a beach ball (more squash, slower, more floaty). Only parameters
should change, not code structure.

Part of `kits/animation-skills-kit`. Code paths in this skill (such as `code/...`) are relative to that folder.
