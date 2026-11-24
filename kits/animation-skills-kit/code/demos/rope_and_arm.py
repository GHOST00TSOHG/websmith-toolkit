"""Procedural demo: a target travels a Catmull-Rom path at constant speed
(arc-length), an IK arm reaches for it (FABRIK), a spring follower chases it
(follow-through), and a Verlet rope hangs from it, swaying with noise wind.

Key lesson: SIMULATION and RENDERING are decoupled. Physics runs at a fixed
240 Hz timestep and states are stored; the renderer interpolates between
states at any time t (so motion blur sub-frames and any fps work).

Run from code/:  python -m demos.rope_and_arm
"""
from __future__ import annotations

from pathlib import Path

import numpy as np

from anim.curves import ArcLengthPath, catmull_rom
from anim.easing import in_out_cubic
from anim.physics import Noise1D, Spring, VerletRope, fabrik
from anim.render import frames, write_gif, write_mp4

W, H, FPS, DUR, SIM_HZ = 480, 320, 24, 6.0, 240

CTRL = np.array([[120, 80], [300, 60], [400, 150], [300, 230], [150, 200], [120, 80]], float)
path = ArcLengthPath(lambda u: catmull_rom(CTRL, u))
wind = Noise1D(seed=7)
BASE = np.array([240.0, 305.0])
REST = np.array([BASE + [-8 * i, -68 * i] for i in range(5)])  # 4 bones, slight bend


def target_at(t: float) -> np.ndarray:
    return path.at(in_out_cubic((t / DUR) % 1.0))  # ease the whole loop's speed


# ---- fixed-timestep simulation, stored for the renderer -----------------
dt = 1 / SIM_HZ
steps = int(DUR * SIM_HZ) + 2
rope = VerletRope(target_at(0), n=10, seg=9)
spring = Spring(target_at(0), frequency=1.2, damping=0.35)
rope_states = np.empty((steps, 10, 2))
spring_states = np.empty((steps, 2))
arm_states = np.empty((steps, len(REST), 2))
arm = REST.copy()
for i in range(steps):
    t = i * dt
    gust = 500 * wind.fbm(t * 0.7)
    rope_states[i] = rope.step(target_at(t), dt, gravity=(gust, 900.0))
    spring_states[i] = spring.step(target_at(t), dt)
    arm = fabrik(arm, target_at(t))   # warm start from last pose: no popping between frames
    arm_states[i] = arm


def state_at(states: np.ndarray, t: float) -> np.ndarray:
    x = min(t * SIM_HZ, steps - 1.001)
    i = int(x)
    return states[i] + (states[i + 1] - states[i]) * (x - i)


def draw(d, t: float, s: float) -> None:
    pts = [tuple(p * s) for p in (path.at(u) for u in np.linspace(0, 1, 120))]
    d.line(pts, fill=(45, 45, 70), width=int(2 * s))
    tgt = target_at(t)
    # Rope
    r = state_at(rope_states, t)
    d.line([tuple(p * s) for p in r], fill=(120, 200, 255), width=int(2 * s), joint="curve")
    tip = r[-1]
    d.ellipse([*(tip - 4) * s, *(tip + 4) * s], fill=(120, 200, 255))
    # IK arm
    arm = state_at(arm_states, t)
    d.line([tuple(p * s) for p in arm], fill=(240, 240, 250), width=int(5 * s), joint="curve")
    for p in arm:
        d.ellipse([*(p - 5) * s, *(p + 5) * s], fill=(255, 120, 90))
    # Spring follower
    f = state_at(spring_states, t)
    d.ellipse([*(f - 9) * s, *(f + 9) * s], outline=(150, 255, 150), width=int(3 * s))
    # Target
    d.ellipse([*(tgt - 6) * s, *(tgt + 6) * s], fill=(255, 210, 80))


if __name__ == "__main__":
    out = Path("out"); out.mkdir(exist_ok=True)
    imgs = list(frames(draw, DUR, FPS, (W, H), blur_samples=4))
    print(write_mp4(imgs, out / "rope_and_arm.mp4", FPS))
    print(write_gif(imgs, out / "rope_and_arm.gif", FPS))
