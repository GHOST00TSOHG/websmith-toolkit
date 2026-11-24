---
name: interpolation-and-easing-math
description: The math of keyframe animation: lerp, easing curves, CSS cubic-bezier solving, Catmull-Rom and Bezier splines, arc-length parameterization, quaternions and slerp, frame-rate-independent smoothing. Use when implementing or debugging interpolation, motion paths, rotations or timing curves.
---

# Interpolation and Easing Math

## Lerp and the normalized-time pattern
Every keyframe segment reduces to: `u = (t - t0) / (t1 - t0)`, then
`value = a + (b - a) * ease(u)` (`timeline.py`). Easing only reshapes `u`. Keep
easing separate from value interpolation and you can ease anything: numbers,
vectors, colors.

- **Colors:** interpolate in linear light or in a perceptual space (OKLab), not raw
  sRGB, or midpoints look muddy.
- **Angles:** wrap the difference to (-π, π] or you'll spin the long way round.

## Easing families (`easing.py`)
- Polynomial in/out/in-out (quad, cubic...): the workhorses.
- `smoothstep` (C1) and `smootherstep` (C2): zero velocity (and acceleration) at
  both ends, ideal for loops and blending.
- `in_back` / `out_back`: anticipation and overshoot. `s` controls the amount.
- `out_elastic`, `out_bounce`: stylized follow-through.
- **cubic-bezier(x1, y1, x2, y2):** the CSS/After Effects standard. x(s) must be
  inverted numerically (Newton's method with a bisection fallback) because the
  curve is parametric. x control points must stay in [0, 1] for this to be valid.

## Splines (`curves.py`)
- **Bezier:** control points pull the curve but aren't on it. Good for design tools.
- **Catmull-Rom:** passes *through* every point. Use **centripetal** (alpha = 0.5)
  to avoid cusps and loops with uneven spacing.
- **Hermite:** points plus explicit tangents. This is what keyframe "handles" are.
- **Continuity:** C0 = no jumps, C1 = no velocity jumps, C2 = no acceleration
  jumps. Cameras need at least C1, ideally C2.

## Arc-length parameterization
Spline parameter u ≠ distance, so objects speed up on long segments. Fix: sample
the curve, build a cumulative length table, invert with interpolation
(`ArcLengthPath`). Then apply easing *to distance*, which gives full control over
speed along a path.

## Rotations: use quaternions
- Euler angles suffer gimbal lock and interpolate along weird paths.
- Unit quaternion `(w, x, y, z)` from axis-angle:
  `(cos θ/2, sin θ/2 · axis)`.
- **slerp** gives constant angular velocity. Flip one quaternion if `dot < 0` to
  take the short path, and fall back to normalized lerp when they are nearly equal.
- For more than two keys, use squad or simply slerp per segment with eased u.

## Frame-rate-independent smoothing
`x += (target - x) * 0.1` per frame behaves differently at 30 vs 144 fps.
Correct form: `x += (target - x) * (1 - exp(-rate * dt))`. Better still, use a
critically damped spring (`Spring(damping=1.0)`), which also handles moving targets
without lag artifacts.

## Exercise
Implement `ease_from_keyframe_handles(p1, p2)` that converts Blender-style
handles to a `cubic_bezier` and verify against `in_out_cubic` visually by plotting
both with matplotlib.

Part of `kits/animation-skills-kit`. Code paths in this skill (such as `code/...`) are relative to that folder.
