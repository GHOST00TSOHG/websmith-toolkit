"""Magic-energy particles: 30k particles advected through time-varying curl noise,
splatted additively into an HDR buffer with feedback trails, colored by speed,
then bloom + filmic tonemap + chromatic aberration + vignette + grain.

Run from code/:  python -m demos.curl_particles
"""
from __future__ import annotations

import numpy as np

from vfx import post
from vfx.io import VideoWriter
from vfx.procedural import Perlin2D

W, H, FPS, SECONDS, N = 320, 240, 24, 6, 30000
rng = np.random.default_rng(0)
noise = Perlin2D(11)


def spawn(n: int) -> np.ndarray:
    a = rng.uniform(0, 2 * np.pi, n); r = 18 * np.sqrt(rng.uniform(0, 1, n))
    return np.stack([W / 2 + r * np.cos(a), H / 2 + r * np.sin(a)], -1)


pos = spawn(N); age = rng.uniform(0, 3, N); life = rng.uniform(2, 4, N)
trail = np.zeros((H, W, 3))
c_slow, c_fast = np.array([0.05, 0.3, 1.0]), np.array([1.0, 0.25, 0.75])

with VideoWriter("out/curl_particles.mp4", FPS) as vw:
    for f in range(FPS * SECONDS):
        t = f / FPS
        dt = 1 / FPS
        sx, sy = pos[:, 0] / 90 + t * 0.15, pos[:, 1] / 90 - t * 0.1
        vx, vy = noise.curl(sx, sy)
        rx, ry = pos[:, 0] - W / 2, pos[:, 1] - H / 2          # gentle outward + swirl
        vel = np.stack([vx * 220 + rx * 0.35 - ry * 0.25, vy * 220 + ry * 0.35 + rx * 0.25], -1)
        pos += vel * dt
        age += dt
        dead = (age > life) | (pos[:, 0] < -5) | (pos[:, 0] > W + 5) | (pos[:, 1] < -5) | (pos[:, 1] > H + 5)
        pos[dead] = spawn(dead.sum()); age[dead] = 0; life[dead] = rng.uniform(2, 4, dead.sum())
        speed = np.linalg.norm(vel, axis=1)
        mix = np.clip(speed / 140, 0, 1)[:, None]
        fade = np.sin(np.clip(age / life, 0, 1) * np.pi)       # fade in and out over life
        trail *= 0.86                                           # feedback: light trails
        post.splat_points(trail, pos, c_slow * (1 - mix) + c_fast * mix, 0.035 * fade)
        hdr = post.bloom(trail, threshold=0.6, radii=(2, 5, 12, 30), weights=(0.6, 0.35, 0.2, 0.1))
        hdr = post.chromatic_aberration(hdr, 0.006)
        vw.write(post.to_display(post.vignette(hdr, 0.4), exposure=-0.2, rng=rng))
print("wrote out/curl_particles.mp4 / .gif")
