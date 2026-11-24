"""Signed distance fields + sphere-tracing raymarcher, fully vectorized (numpy).

The same math is what ShaderToy/GLSL demos run per pixel on the GPU; here
every pixel's ray is a row in an array, so the code ports to a fragment
shader almost line for line.
"""
from __future__ import annotations

import numpy as np

Array = np.ndarray


def length(p: Array) -> Array:
    return np.sqrt((p * p).sum(-1))


def normalize(v: Array) -> Array:
    return v / np.maximum(length(v), 1e-9)[..., None]


# ---- primitives (all centered at origin; translate by subtracting from p) ----
def sd_sphere(p: Array, r: float) -> Array:
    return length(p) - r


def sd_box(p: Array, b) -> Array:
    q = np.abs(p) - np.asarray(b)
    return length(np.maximum(q, 0)) + np.minimum(q.max(-1), 0)


def sd_torus(p: Array, R: float, r: float) -> Array:
    q = np.stack([length(p[..., [0, 2]]) - R, p[..., 1]], -1)
    return length(q) - r


def sd_plane_y(p: Array, h: float = 0.0) -> Array:
    return p[..., 1] - h


# ---- operators ---------------------------------------------------------------
def smin(a: Array, b: Array, k: float) -> Array:
    """Polynomial smooth minimum (Quilez): blends shapes with a fillet of size k."""
    h = np.clip(0.5 + 0.5 * (b - a) / k, 0, 1)
    return b + (a - b) * h - k * h * (1 - h)


def rot_y(p: Array, a: float) -> Array:
    c, s = np.cos(a), np.sin(a)
    x, y, z = p[..., 0], p[..., 1], p[..., 2]
    return np.stack([c * x + s * z, y, -s * x + c * z], -1)


def repeat(p: Array, period: Array) -> Array:
    """Domain repetition: infinite copies for the cost of one. Period 0 = no repeat."""
    period = np.asarray(period, float)
    safe = np.where(period > 0, period, 1.0)
    return np.where(period > 0, p - safe * np.round(p / safe), p)


# ---- rendering -----------------------------------------------------------------
def camera_rays(w: int, h: int, eye, target, fov_deg: float = 45.0) -> tuple[Array, Array]:
    eye = np.asarray(eye, float); target = np.asarray(target, float)
    f = normalize(target - eye)
    r = normalize(np.cross(f, [0.0, 1.0, 0.0]))
    u = np.cross(r, f)
    t = np.tan(np.radians(fov_deg) / 2)
    ys, xs = np.mgrid[0:h, 0:w]
    px = (2 * (xs + 0.5) / w - 1) * t * w / h
    py = (1 - 2 * (ys + 0.5) / h) * t
    d = normalize(px[..., None] * r + py[..., None] * u + f)
    return np.broadcast_to(eye, d.shape).reshape(-1, 3), d.reshape(-1, 3)


def raymarch(sdf, ro: Array, rd: Array, max_steps: int = 96, tmax: float = 30.0,
             eps: float = 1e-3) -> tuple[Array, Array]:
    """Sphere tracing: step by the distance bound until we hit or escape."""
    t = np.zeros(len(ro))
    active = np.ones(len(ro), bool)
    hit = np.zeros(len(ro), bool)
    for _ in range(max_steps):
        if not active.any():
            break
        idx = np.nonzero(active)[0]
        d = sdf(ro[idx] + rd[idx] * t[idx, None])
        t[idx] += d * 0.9                            # relaxation for non-exact SDFs
        done_hit = d < eps * np.maximum(t[idx], 1)   # pixel-footprint-scaled epsilon
        done_miss = t[idx] > tmax
        hit[idx[done_hit]] = True
        active[idx[done_hit | done_miss]] = False
    return t, hit


def calc_normal(sdf, p: Array, e: float = 1e-3) -> Array:
    """Tetrahedral gradient estimate: 4 SDF taps instead of 6."""
    k = np.array([[1, -1, -1], [-1, -1, 1], [-1, 1, -1], [1, 1, 1]], float)
    n = sum(k[i] * sdf(p + k[i] * e)[:, None] for i in range(4))
    return normalize(n)


def soft_shadow(sdf, p: Array, l: Array, k: float = 10.0, steps: int = 32) -> Array:
    """Penumbra from how closely the shadow ray grazes geometry."""
    res = np.ones(len(p)); t = np.full(len(p), 0.02)
    for _ in range(steps):
        h = sdf(p + l * t[:, None])
        res = np.minimum(res, np.clip(k * h / t, 0, 1))
        t += np.clip(h, 0.02, 0.25)
    return np.clip(res, 0, 1)


def ambient_occlusion(sdf, p: Array, n: Array, samples: int = 5) -> Array:
    occ = np.zeros(len(p)); sca = 1.0
    for i in range(1, samples + 1):
        hr = 0.03 * i
        occ += (hr - sdf(p + n * hr)) * sca
        sca *= 0.7
    return np.clip(1 - 2.5 * occ, 0, 1)
