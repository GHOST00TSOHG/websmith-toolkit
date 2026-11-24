"""Fire + smoke plume: Eulerian smoke solver with buoyancy, vorticity confinement
and MacCormack advection, shaded as emissive fire (temperature -> blackbody-ish
color) over scattering smoke, composited in HDR with bloom and a filmic tonemap.

Run from code/:  python -m demos.smoke_fire   (about a minute)
"""
from __future__ import annotations

import numpy as np
from scipy.ndimage import zoom

from vfx import post
from vfx.fluids import Smoke2D
from vfx.io import VideoWriter
from vfx.procedural import Perlin2D

FPS, SECONDS, SUBSTEPS = 24, 6, 2
sim = Smoke2D(nx=120, ny=160, vorticity=0.6, buoyancy=0.22, cooling=0.12, dissipation=0.996)
noise = Perlin2D(3)
rng = np.random.default_rng(1)


def fire_color(temp: np.ndarray) -> np.ndarray:
    """Cheap blackbody ramp in linear HDR: dark red -> orange -> yellow-white."""
    t = np.clip(temp, 0, None)[..., None]
    ramp = np.array([2.2, 0.55, 0.08]) * t ** 1.5 + np.array([1.2, 1.0, 0.6]) * np.maximum(t - 0.8, 0) ** 2 * 3
    return ramp * 2.5


with VideoWriter("out/smoke_fire.mp4", FPS) as vw:
    for f in range(FPS * SECONDS):
        t = f / FPS
        wobble = 6 * noise.fbm(np.array(t * 0.8), np.array(0.3))
        for _ in range(SUBSTEPS):
            sim.emit(60 + float(wobble), 1, 11, density=0.9, heat=1.5,
                     vel=(float(rng.normal(0, 0.8)), 1.8))
            sim.step(0.5)
        rho = np.flipud(sim.rho)                 # sim y-up -> image y-down
        temp = np.flipud(sim.temp)
        smoke = np.clip(rho, 0, 1.5)[..., None]
        light = np.array([0.12, 0.13, 0.16])     # cool ambient on smoke
        hdr = light * smoke * 1.4 + fire_color(np.maximum(temp - 0.7, 0) * 1.6) * (1 - np.exp(-2.5 * smoke))
        hdr += np.array([0.004, 0.004, 0.008])   # night sky
        hdr = zoom(hdr, (2, 2, 1), order=1)      # 240x320 output
        hdr = post.bloom(hdr, threshold=0.9)
        img = post.to_display(post.vignette(hdr, 0.3), exposure=-0.3, rng=rng)
        vw.write(img)
print("wrote out/smoke_fire.mp4 / .gif")
