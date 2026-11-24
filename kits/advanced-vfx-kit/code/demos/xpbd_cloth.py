"""XPBD cloth: a sheet held by its four corners sags and ripples in gusty wind,
then is released and drapes over a sphere. Rendered with a tiny painter's-algorithm rasterizer
(Lambert + rim light, two-sided) to keep the demo dependency-free.

Run from code/:  python -m demos.xpbd_cloth
"""
from __future__ import annotations

import numpy as np
from PIL import Image, ImageDraw

from vfx import post
from vfx.io import VideoWriter
from vfx.procedural import Perlin2D
from vfx.xpbd import XPBDCloth

W, H, FPS, SECONDS, SS = 320, 240, 24, 6, 2
cloth = XPBDCloth(w=24, h=24, spacing=0.08, bend_compliance=2e-3, pin_top=False)
corners = [0, cloth.w - 1, cloth.w * (cloth.h - 1), cloth.w * cloth.h - 1]
cloth.inv_m[corners] = 0.0
sphere_c, sphere_r = np.array([0.0, 0.55, 0.92]), 0.5
wind_noise = Perlin2D(5)
L = np.array([0.4, 0.8, -0.45]); L /= np.linalg.norm(L)
eye = np.array([2.2, 1.7, -1.4]); target = np.array([0, 0.6, 0.92])
fwd = target - eye; fwd /= np.linalg.norm(fwd)
right = np.cross(fwd, [0, 1, 0]); right /= np.linalg.norm(right); up = np.cross(right, fwd)


def project(p: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    d = p - eye
    z = d @ fwd
    sx = (d @ right) / z * 1.6 * H / 2 + W / 2
    sy = -(d @ up) / z * 1.6 * H / 2 + H / 2
    return np.stack([sx, sy], -1) * SS, z


def draw_sphere(d: ImageDraw.ImageDraw) -> None:
    # sphere (flat-shaded disc with a simple shading falloff)
    sc, sz = project(sphere_c[None])
    rad = sphere_r / sz[0] * 1.6 * H / 2 * SS
    for k in range(12, 0, -1):
        g = int(40 + 110 * (1 - k / 12) ** 0.7)
        rr = rad * k / 12
        off = (1 - k / 12) * rad * 0.35
        d.ellipse([sc[0, 0] - rr - off, sc[0, 1] - rr - off, sc[0, 0] + rr - off, sc[0, 1] + rr - off],
                  fill=(g, int(g * 0.9), int(g * 0.75)))


quads = [(r * cloth.w + c, r * cloth.w + c + 1, (r + 1) * cloth.w + c + 1, (r + 1) * cloth.w + c)
         for r in range(cloth.h - 1) for c in range(cloth.w - 1)]
quads = np.array(quads)

with VideoWriter("out/xpbd_cloth.mp4", FPS) as vw:
    for f in range(FPS * SECONDS):
        t = f / FPS
        if f == int(FPS * 1.5):
            cloth.inv_m[:] = 1.0                                   # release the corners
        gust = 14 * wind_noise.fbm(np.array(t * 1.5), np.array(0.0))
        x = cloth.step(1 / FPS, substeps=20, wind=(0.0, float(gust) if t < 1.5 else 0.0, 0.0),
                       sphere=(sphere_c, sphere_r))
        img = Image.new("RGB", (W * SS, H * SS), (14, 16, 24))
        d = ImageDraw.Draw(img)
        # floor
        fl = np.array([[-1.6, 0, -0.6], [1.6, 0, -0.6], [1.6, 0, 2.6], [-1.6, 0, 2.6]], float)
        fs, _ = project(fl)
        d.polygon([tuple(q) for q in fs], fill=(34, 38, 50))
        s2, z = project(x)
        pts = x[quads]
        n = np.cross(pts[:, 1] - pts[:, 0], pts[:, 3] - pts[:, 0])
        n /= np.linalg.norm(n, axis=1, keepdims=True) + 1e-9
        facing = np.sign((n * (eye - pts.mean(1))).sum(1))[:, None]
        n = n * facing                                              # two-sided lighting
        lam = np.clip(n @ L, 0, 1)
        rim = np.clip(1 - np.abs((n * (eye - pts.mean(1))).sum(1) /
                                 np.linalg.norm(eye - pts.mean(1), axis=1)), 0, 1) ** 3
        order = np.argsort(-z[quads].mean(1))                       # far to near
        _, sphere_z = project(sphere_c[None])
        sphere_drawn = False
        for qi in order:
            if not sphere_drawn and z[quads[qi]].mean() < sphere_z[0]:
                draw_sphere(d); sphere_drawn = True                 # painter's algorithm
            r_, c_ = divmod(qi, cloth.w - 1)
            stripe = 1.0 if (c_ // 3) % 2 == 0 else 0.75
            base = np.array([0.85, 0.12, 0.18]) * stripe
            lin = base * (0.08 + 1.1 * lam[qi]) + 0.25 * rim[qi]
            col = tuple((post.linear_to_srgb(np.clip(lin, 0, 1)) * 255).astype(int))
            d.polygon([tuple(s2[i]) for i in quads[qi]], fill=col)
        if not sphere_drawn:
            draw_sphere(d)
        vw.write(np.asarray(img.resize((W, H), Image.LANCZOS)))
print("wrote out/xpbd_cloth.mp4 / .gif")
