"""Procedural FX building blocks: vectorized 2D Perlin noise, fBm, domain warping,
curl noise (divergence-free flow), Gray-Scott reaction-diffusion."""
from __future__ import annotations

import numpy as np
from scipy.ndimage import convolve

Array = np.ndarray


class Perlin2D:
    def __init__(self, seed: int = 0) -> None:
        rng = np.random.default_rng(seed)
        self.perm = np.tile(rng.permutation(256), 2)
        ang = rng.uniform(0, 2 * np.pi, 256)
        self.grad = np.stack([np.cos(ang), np.sin(ang)], -1)

    def __call__(self, x: Array, y: Array) -> Array:
        x = np.asarray(x, float); y = np.asarray(y, float)
        xi = np.floor(x).astype(int) & 255; yi = np.floor(y).astype(int) & 255
        xf = x - np.floor(x); yf = y - np.floor(y)
        fade = lambda t: t ** 3 * (t * (6 * t - 15) + 10)
        u, v = fade(xf), fade(yf)
        p = self.perm

        def dot(ix, iy, dx, dy):
            g = self.grad[p[p[ix] + iy] % 256]
            return g[..., 0] * dx + g[..., 1] * dy

        n00 = dot(xi, yi, xf, yf); n10 = dot(xi + 1, yi, xf - 1, yf)
        n01 = dot(xi, yi + 1, xf, yf - 1); n11 = dot(xi + 1, yi + 1, xf - 1, yf - 1)
        nx0 = n00 + u * (n10 - n00); nx1 = n01 + u * (n11 - n01)
        return (nx0 + v * (nx1 - nx0)) * 1.41  # ~[-1, 1]

    def fbm(self, x, y, octaves: int = 5, lacunarity: float = 2.0, gain: float = 0.5) -> Array:
        total = 0.0; amp = 1.0; freq = 1.0; norm = 0.0
        for o in range(octaves):
            total = total + amp * self(x * freq + 17.3 * o, y * freq - 9.1 * o)
            norm += amp; amp *= gain; freq *= lacunarity
        return total / norm

    def warped(self, x, y, strength: float = 1.5) -> Array:
        """Domain warping (Quilez): noise of noise, giving marbled, flowing patterns."""
        qx = self.fbm(x, y); qy = self.fbm(x + 5.2, y + 1.3)
        return self.fbm(x + strength * qx, y + strength * qy)

    def curl(self, x, y, eps: float = 1e-3, octaves: int = 3) -> tuple[Array, Array]:
        """Curl of a scalar potential: (dpsi/dy, -dpsi/dx). Divergence-free, so
        particles swirl like an incompressible fluid without bunching up."""
        f = lambda a, b: self.fbm(a, b, octaves)
        dpdx = (f(x + eps, y) - f(x - eps, y)) / (2 * eps)
        dpdy = (f(x, y + eps) - f(x, y - eps)) / (2 * eps)
        return dpdy, -dpdx


LAPLACE = np.array([[0.05, 0.2, 0.05], [0.2, -1.0, 0.2], [0.05, 0.2, 0.05]])


def gray_scott(shape=(160, 160), steps: int = 4000, f: float = 0.0545, k: float = 0.062,
               du: float = 1.0, dv: float = 0.5, seed: int = 0, snapshot_every: int = 0):
    """Gray-Scott reaction-diffusion: U + 2V -> 3V. (f, k) picks the pattern:
    (0.0545, 0.062) coral, (0.035, 0.065) spots, (0.029, 0.057) mazes."""
    rng = np.random.default_rng(seed)
    U = np.ones(shape); V = np.zeros(shape)
    h, w = shape
    for _ in range(12):
        cy, cx = rng.integers(10, h - 10), rng.integers(10, w - 10)
        V[cy - 4:cy + 4, cx - 4:cx + 4] = 1.0; U[cy - 4:cy + 4, cx - 4:cx + 4] = 0.5
    snaps = []
    for i in range(steps):
        uvv = U * V * V
        U += du * convolve(U, LAPLACE, mode="wrap") - uvv + f * (1 - U)
        V += dv * convolve(V, LAPLACE, mode="wrap") + uvv - (f + k) * V
        if snapshot_every and i % snapshot_every == 0:
            snaps.append(V.copy())
    return (U, V, snaps) if snapshot_every else (U, V)
