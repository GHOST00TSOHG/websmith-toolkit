"""Raymarched SDF scene: a torus and box melting into a sphere via smooth-min,
with domain-repeated pillars, soft shadows, ambient occlusion, fog, and a
camera orbit. Frames render in parallel processes.

Run from code/:  python -m demos.sdf_morph   (a couple of minutes on 2 cores)
"""
from __future__ import annotations

from concurrent.futures import ProcessPoolExecutor

import numpy as np

from vfx import post
from vfx.io import VideoWriter
from vfx.sdf import (ambient_occlusion, calc_normal, camera_rays, normalize, raymarch, repeat,
                     rot_y, sd_box, sd_plane_y, sd_sphere, sd_torus, smin, soft_shadow)

W, H, FPS, SECONDS = 320, 200, 24, 4
LIGHT = normalize(np.array([0.6, 0.8, -0.4]))


def scene_at(t: float):
    k = 0.15 + 0.45 * (0.5 - 0.5 * np.cos(t * np.pi / 2))   # blend radius pulses

    def sdf(p):
        q = rot_y(p - [0, 1.0, 0], t * 0.9)
        a = sd_torus(q, 0.75, 0.22)
        b = sd_box(rot_y(q, 0.8), [0.38, 0.38, 0.38]) - 0.05
        c = sd_sphere(p - [np.sin(t * 1.7) * 0.9, 1.0 + 0.35 * np.sin(t * 2.3), 0], 0.38)
        blob = smin(smin(a, b, k), c, k)
        pr = repeat(p - [2.5, 0, 2.5], [5.0, 0, 5.0]); pr[..., 1] = p[..., 1] - 1.0
        pillars = sd_box(pr, [0.18, 1.0, 0.18]) - 0.04
        return np.minimum(np.minimum(blob, pillars), sd_plane_y(p, 0.0))
    return sdf


def render(i: int) -> np.ndarray:
    t = i / FPS
    sdf = scene_at(t)
    ang = 0.6 + t * 0.35
    eye = [3.0 * np.sin(ang), 1.7, -3.0 * np.cos(ang)]
    ro, rd = camera_rays(W, H, eye, [0, 0.9, 0], 50)
    dist, hit = raymarch(sdf, ro, rd, max_steps=110, tmax=25)
    sky = np.array([0.30, 0.42, 0.65]) * (1 - 0.5 * rd[:, 1:2].clip(0, 1)) + 0.05
    col = np.broadcast_to(sky, (len(ro), 3)).copy()
    p = ro[hit] + rd[hit] * dist[hit, None]
    n = calc_normal(sdf, p)
    diff = np.clip((n * LIGHT).sum(-1), 0, 1) * soft_shadow(sdf, p + n * 0.01, LIGHT)
    ao = ambient_occlusion(sdf, p, n)
    albedo = np.where((p[:, 1] < 0.01)[:, None],
                      0.35 + 0.15 * ((np.floor(p[:, 0]) + np.floor(p[:, 2])) % 2)[:, None],
                      np.array([0.9, 0.35, 0.2]))
    spec = np.clip((normalize(LIGHT - rd[hit]) * n).sum(-1), 0, 1) ** 40 * diff
    lit = albedo * (diff[:, None] * np.array([3.2, 2.9, 2.5])
                    + ao[:, None] * np.array([0.25, 0.32, 0.45])) + spec[:, None] * 2
    fog = np.exp(-0.012 * dist[hit] ** 2)[:, None]
    col[hit] = lit * fog + sky[hit] * (1 - fog)
    hdr = post.bloom(col.reshape(H, W, 3), threshold=1.6, radii=(2, 6, 14), weights=(0.3, 0.15, 0.08))
    return post.to_display(post.vignette(hdr, 0.25), exposure=-0.2)


if __name__ == "__main__":
    with ProcessPoolExecutor() as pool, VideoWriter("out/sdf_morph.mp4", FPS) as vw:
        for frame in pool.map(render, range(FPS * SECONDS)):   # map keeps frame order
            vw.write(frame)
    print("wrote out/sdf_morph.mp4 / .gif")
