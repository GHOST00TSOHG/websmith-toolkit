"""XPBD cloth with graph-colored, vectorized Gauss-Seidel and "small steps".

XPBD (Macklin, Mueller, Chentanez 2016) adds compliance to PBD so stiffness
is a physical parameter, independent of iteration count and timestep.
"Small Steps" (Macklin et al. 2019): many substeps with ONE iteration each
beats few substeps with many iterations. Constraints are split into colors
(independent sets: no two share a particle), so each color is solved
in parallel with numpy, exactly the way GPU solvers (Vellum, Warp) do it.
"""
from __future__ import annotations

import numpy as np

Array = np.ndarray


class XPBDCloth:
    def __init__(self, w: int = 24, h: int = 18, spacing: float = 0.1,
                 stretch_compliance: float = 0.0, shear_compliance: float = 1e-6,
                 bend_compliance: float = 1e-3, pin_top: bool = True) -> None:
        ii, jj = np.mgrid[0:h, 0:w]
        self.w, self.h = w, h
        # Cloth hangs in the x-z plane at height y, top row at y = 0
        self.x = np.stack([jj * spacing - (w - 1) * spacing / 2,
                           np.zeros_like(jj, float),
                           ii * spacing], -1).reshape(-1, 3).astype(float)
        self.x[:, 1] = 2.0
        self.v = np.zeros_like(self.x)
        self.inv_m = np.ones(len(self.x))
        if pin_top:
            self.inv_m[:w] = 0.0                       # pinned: infinite mass
        idx = lambda r, c: r * w + c
        groups: list[tuple[list[tuple[int, int]], float]] = []
        # Each group of constraints is further split into colors below
        stretch = [(idx(r, c), idx(r, c + 1)) for r in range(h) for c in range(w - 1)] + \
                  [(idx(r, c), idx(r + 1, c)) for r in range(h - 1) for c in range(w)]
        shear = [(idx(r, c), idx(r + 1, c + 1)) for r in range(h - 1) for c in range(w - 1)] + \
                [(idx(r, c + 1), idx(r + 1, c)) for r in range(h - 1) for c in range(w - 1)]
        bend = [(idx(r, c), idx(r, c + 2)) for r in range(h) for c in range(w - 2)] + \
               [(idx(r, c), idx(r + 2, c)) for r in range(h - 2) for c in range(w)]
        groups = [(stretch, stretch_compliance), (shear, shear_compliance), (bend, bend_compliance)]
        self.colors: list[tuple[Array, Array, Array, float]] = []
        for pairs, comp in groups:
            for color in self._greedy_color(pairs):
                a = np.array([p[0] for p in color]); b = np.array([p[1] for p in color])
                rest = np.linalg.norm(self.x[a] - self.x[b], axis=1)
                self.colors.append((a, b, rest, comp))

    @staticmethod
    def _greedy_color(pairs: list[tuple[int, int]]) -> list[list[tuple[int, int]]]:
        """Greedy graph coloring: each color touches every particle at most once."""
        colors: list[list[tuple[int, int]]] = []
        used: list[set[int]] = []
        for a, b in pairs:
            for k, s in enumerate(used):
                if a not in s and b not in s:
                    colors[k].append((a, b)); s.update((a, b)); break
            else:
                colors.append([(a, b)]); used.append({a, b})
        return colors

    def step(self, dt: float, substeps: int = 15, gravity=(0, -9.81, 0),
             wind=(0.0, 0.0, 0.0), sphere: tuple[Array, float] | None = None,
             drag: float = 0.02, friction: float = 0.6) -> Array:
        h = dt / substeps
        g = np.asarray(gravity, float); wv = np.asarray(wind, float)
        free = self.inv_m > 0
        for _ in range(substeps):
            self.v[free] += h * (g + wv - drag * self.v[free])
            prev = self.x.copy()
            self.x[free] += h * self.v[free]
            for a, b, rest, comp in self.colors:     # one XPBD iteration per substep
                d = self.x[a] - self.x[b]
                L = np.linalg.norm(d, axis=1)
                C = L - rest
                wsum = self.inv_m[a] + self.inv_m[b]
                alpha = comp / (h * h)                # compliance scaled by substep
                dlam = -C / np.maximum(wsum + alpha, 1e-12)
                n = d / np.maximum(L, 1e-12)[:, None]
                corr = (dlam[:, None] * n)
                self.x[a] += corr * self.inv_m[a][:, None]
                self.x[b] -= corr * self.inv_m[b][:, None]
            if sphere is not None:                   # collision as a projection
                c, r = sphere
                d = self.x - c
                dist = np.linalg.norm(d, axis=1)
                hit = (dist < r * 1.02) & free
                n = d[hit] / dist[hit, None]
                self.x[hit] = c + n * r * 1.02
                self._friction(hit, n, prev, friction)
            floor = self.x[:, 1] < 0
            self.x[floor, 1] = 0
            self._friction(floor, np.array([[0.0, 1.0, 0.0]]), prev, friction)
            self.v = (self.x - prev) / h               # velocity from positions (PBD)
        return self.x

    def _friction(self, mask: Array, n: Array, prev: Array, mu: float) -> None:
        """Positional friction: cancel part of the tangential motion this substep."""
        if not mask.any():
            return
        dx = self.x[mask] - prev[mask]
        tangential = dx - (dx * n).sum(1, keepdims=True) * n
        self.x[mask] -= mu * tangential

    def stretch_error(self) -> float:
        errs = []
        for a, b, rest, comp in self.colors:
            if comp == 0.0:
                errs.append(np.abs(np.linalg.norm(self.x[a] - self.x[b], axis=1) / rest - 1))
        return float(np.concatenate(errs).max())
