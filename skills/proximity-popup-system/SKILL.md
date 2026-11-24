---
name: proximity-popup-system
description: The mechanics of props that pop up when a character approaches: distance triggers with hysteresis, one-shot vs reversible reveals, staggered delays, the fold-up hinge pose, closed-form spring curves, squash on landing, spatial hashing for large worlds, and reduced-motion behaviour. Use when implementing or tuning the pop-up reveal in any engine.
---

# Proximity Pop-Up System

Reference: `code/web/popup.js` (engine-agnostic logic, 8 Node tests in
`code/tests/popup.test.mjs`), used by `web/world.js` and mirrored in
`blender/paper_popup_scene.py`.

## 1. Trigger: distance + hysteresis
```
state: hidden → rising → shown          (once = true, the default)
       shown → falling → hidden         (reversible: only past the EXIT radius)
```
- Pop when `distance(player, prop) < enter` (≈ 3–4.5 m for human-scale props).
- If props fold away again, use a **larger exit radius** (e.g. enter 3.2, exit 4.5)
  so standing on the boundary can't make them flicker.
- One-shot (props stay up) feels like *building* the world; reversible feels like
  a *magic bubble* around the player. Pick one per project.

## 2. Pose: fold up around the base hinge
The pop-up-book read comes from **rotation about the base edge**, not scale alone:
`fold = -90° × (1 − p)`: lying flat at p = 0, upright at p = 1. Overshoot past
upright, then settle. Add a modest scale ramp (35% → 100%) and a brief **squash**
on landing (scale Y down and XZ up, keeping volume) for weight (`popPose`).
Put the pivot at ground level: in three.js, a parent `Group` at the base; in
Blender, an Empty "hinge".

## 3. Timing: a damped spring, in closed form
`springStep(t)` is the exact step response of a damped spring:
`1 − e^(−ζωt)(cos ω_d t + (ζω/ω_d) sin ω_d t)`, with frequency ≈ 2.2 Hz and
damping ratio ζ ≈ 0.42 (about 20% overshoot, settled in about 1 s). It's
frame-rate independent and can be sampled anywhere, including for Blender keyframes.
- Snappier: raise the frequency. Bouncier: lower ζ (0.3). Calmer: ζ 0.6–1.0.
- **Stagger** neighbours by 50–100 ms (`delay`) so clusters ripple up instead of
  appearing as a block. Big landmarks (the gate, the arch) get a larger trigger
  radius so they rise early as a reveal moment.

## 4. Scale: spatial hash
Testing every prop every frame is O(n). Insert props into a uniform grid
(`SpatialHash`, cell ≈ trigger radius) and test only the cells around the player:
O(nearby). Essential once a world has thousands of pieces (grass tufts, pebbles).

## 5. Accessibility
With `prefers-reduced-motion`: no overshoot (quick ease-in over 0.25 s), no
confetti, no camera smoothing (`progress(now, true)`); the browser tests check this.

## Tuning table
| Feel | freq | ζ | stagger | fold from |
|---|---|---|---|---|
| Playful (default) | 2.2 | 0.42 | 70 ms | −90° |
| Snappy UI-like | 3.5 | 0.55 | 30 ms | −60° |
| Dreamy | 1.2 | 0.6 | 150 ms | −90° |
| Cartoony boing | 2.8 | 0.28 | 50 ms | −100° |

## Exercises
1. Make props reversible with hysteresis and verify no flicker while circling the boundary.
2. Fold different prop types from different edges (left/right/back) for variety.
3. Drive 5,000 grass cards with the spatial hash and profile frame time.

Part of `kits/paper-popup-world-kit`. Code paths in this skill (such as `code/...`) are relative to that folder.
