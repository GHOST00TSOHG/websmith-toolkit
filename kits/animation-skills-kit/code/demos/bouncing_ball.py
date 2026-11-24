"""Principles demo: timing, easing (slow-in/slow-out), squash & stretch, anticipation,
arcs, decaying bounces, contact shadow and motion blur.

Run from code/:  python -m demos.bouncing_ball   -> out/bouncing_ball.mp4 / .gif
"""
from __future__ import annotations

import math
from pathlib import Path

from anim.easing import in_quad, out_quad, in_back
from anim.render import frames, write_gif, write_mp4
from anim.timeline import Track

W, H, FPS, DUR = 480, 320, 24, 4.0
GROUND, R = 270.0, 22.0

# Height track: each fall eases IN (accelerates, like gravity) and each rise eases OUT.
# Bounce height decays ~45% per bounce and each hop is shorter in time (sqrt of height).
y = Track().add(0.0, GROUND - 0.0)
y.add(0.35, GROUND - 25.0, out_quad)            # anticipation: small crouch-hop up
t, h = 0.35, 200.0
y.add(t + 0.25, GROUND - h, in_back)            # launch with a pull-back (anticipation)
t += 0.25
while h > 4 and t < DUR - 0.3:
    hop = 0.62 * math.sqrt(h / 200.0)
    y.add(t + hop, GROUND, in_quad)             # fall: slow-in to fast
    t += hop
    h *= 0.45
    if h > 4:
        y.add(t + hop * 0.67, GROUND - h, out_quad)  # rise: fast to slow-out
        t += hop * 0.67
x = Track().add(0.0, 60.0).add(t, 400.0, out_quad).add(DUR, 400.0)  # drift slows: arcs


def draw(d, t: float, s: float) -> None:
    """y track = position of the ball's BOTTOM; GROUND is the floor line."""
    cx, bottom = x.sample(t), y.sample(t)
    vy = y.velocity(t)
    height = GROUND - bottom
    # Squash & stretch with area preserved (sx * sy == 1):
    # stretch along the motion when fast, squash when touching the floor.
    stretch = 1 + min(abs(vy) / 1800.0, 0.35)
    contact = max(0.0, 1 - height / 6.0)                 # 1 when touching the ground
    impact = min(abs(vy) / 700.0, 1.0)                   # no squash once at rest
    sy = stretch * (1 - 0.4 * contact * impact)
    sx = 1 / sy
    rx, ry = R * sx, R * sy
    # Floor and contact shadow (wider + darker as the ball gets closer)
    d.line([0, GROUND * s, W * s, GROUND * s], fill=(70, 70, 95), width=int(2 * s))
    k = max(0.2, 1 - height / 220)
    sw = R * 1.3 * k
    d.ellipse([(cx - sw) * s, (GROUND - 3) * s, (cx + sw) * s, (GROUND + 3) * s],
              fill=(int(8 + 30 * k), int(8 + 30 * k), int(14 + 40 * k)))
    d.ellipse([(cx - rx) * s, (bottom - 2 * ry) * s, (cx + rx) * s, bottom * s],
              fill=(255, 140, 60))


if __name__ == "__main__":
    out = Path("out"); out.mkdir(exist_ok=True)
    imgs = list(frames(draw, DUR, FPS, (W, H), blur_samples=5))
    print(write_mp4(imgs, out / "bouncing_ball.mp4", FPS))
    print(write_gif(imgs, out / "bouncing_ball.gif", FPS))
