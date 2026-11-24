"""2D Eulerian smoke solver (Stam's "Stable Fluids" lineage), vectorized with numpy.

Per step:  add forces -> advect velocity -> vorticity confinement -> project
           -> advect density/temperature (MacCormack / BFECC-style, less blur).
Grid is collocated (cell-centered) for clarity; production solvers use a
staggered MAC grid. Boundaries: closed box (no-slip-ish), open top optional.
"""
from __future__ import annotations

import numpy as np
from scipy.ndimage import map_coordinates

Array = np.ndarray


def _sample(f: Array, x: Array, y: Array) -> Array:
    """Bilinear sample field f[y, x] at fractional coords (clamped)."""
    return map_coordinates(f, [y, x], order=1, mode="nearest")


class Smoke2D:
    def __init__(self, nx: int = 128, ny: int = 160, dx: float = 1.0,
                 buoyancy: float = 0.9, cooling: float = 0.6, dissipation: float = 0.995,
                 vorticity: float = 0.35, pressure_iters: int = 60, seed: int = 0) -> None:
        self.nx, self.ny, self.dx = nx, ny, dx
        self.u = np.zeros((ny, nx)); self.v = np.zeros((ny, nx))   # v>0 is UP (y grows up)
        self.rho = np.zeros((ny, nx)); self.temp = np.zeros((ny, nx))
        self.p = np.zeros((ny, nx))
        self.buoyancy, self.cooling, self.dissipation = buoyancy, cooling, dissipation
        self.vort_eps, self.iters = vorticity, pressure_iters
        self.rng = np.random.default_rng(seed)
        self.Y, self.X = np.mgrid[0:ny, 0:nx].astype(float)

    # ---- operators -------------------------------------------------------
    def advect(self, f: Array, dt: float) -> Array:
        """Semi-Lagrangian: trace back along velocity, sample. Unconditionally stable."""
        return _sample(f, self.X - self.u * dt / self.dx, self.Y - self.v * dt / self.dx)

    def advect_maccormack(self, f: Array, dt: float) -> Array:
        """Forward-then-backward advection to estimate and cancel the error.

        Much sharper than plain semi-Lagrangian. Clamped to the min/max of the
        neighbourhood it sampled from, to stay stable.
        """
        fwd = self.advect(f, dt)
        back = _sample(fwd, self.X + self.u * dt / self.dx, self.Y + self.v * dt / self.dx)
        out = fwd + 0.5 * (f - back)
        xs, ys = self.X - self.u * dt / self.dx, self.Y - self.v * dt / self.dx
        x0 = np.clip(np.floor(xs).astype(int), 0, self.nx - 2)
        y0 = np.clip(np.floor(ys).astype(int), 0, self.ny - 2)
        corners = np.stack([f[y0, x0], f[y0, x0 + 1], f[y0 + 1, x0], f[y0 + 1, x0 + 1]])
        return np.clip(out, corners.min(0), corners.max(0))

    def vorticity_confinement(self, dt: float) -> None:
        """Re-inject small swirls that numerical diffusion kills (Fedkiw et al. 2001)."""
        dvdx = np.gradient(self.v, axis=1); dudy = np.gradient(self.u, axis=0)
        w = dvdx - dudy
        aw = np.abs(w)
        gx = np.gradient(aw, axis=1); gy = np.gradient(aw, axis=0)
        mag = np.sqrt(gx * gx + gy * gy) + 1e-6
        nx, ny = gx / mag, gy / mag
        self.u += dt * self.vort_eps * ny * w
        self.v -= dt * self.vort_eps * nx * w

    def project(self) -> None:
        """Make velocity divergence-free: solve Laplace(p) = div(u), subtract grad p.

        On a collocated grid, div and grad use central differences (spacing 2), so
        the *consistent* Laplacian is the wide stencil (neighbours at +-2). Using
        the compact 5-point stencil instead leaves residual divergence. The wide
        stencil decouples into 4 interleaved sub-grids (checkerboard modes): the
        reason production solvers use a staggered MAC grid. Jacobi iterations,
        warm-started from last frame; real solvers use multigrid-preconditioned CG.
        """
        u, v = self._with_walls(self.u, self.v)
        div = 0.5 * (np.roll(u, -1, 1) - np.roll(u, 1, 1) + np.roll(v, -1, 0) - np.roll(v, 1, 0))
        div[:, [0, -1]] = 0; div[[0, -1], :] = 0
        p = self.p
        for _ in range(self.iters):
            pp = np.pad(p, 2, mode="edge")  # Neumann boundary: dp/dn = 0 at walls
            p = (pp[2:-2, :-4] + pp[2:-2, 4:] + pp[:-4, 2:-2] + pp[4:, 2:-2] - 4 * div) / 4
        pp = np.pad(p, 1, mode="edge")
        self.u = u - 0.5 * (pp[1:-1, 2:] - pp[1:-1, :-2])
        self.v = v - 0.5 * (pp[2:, 1:-1] - pp[:-2, 1:-1])
        self.u, self.v = self._with_walls(self.u, self.v)
        self.p = p

    @staticmethod
    def _with_walls(u: Array, v: Array) -> tuple[Array, Array]:
        u = u.copy(); v = v.copy()
        u[:, 0] = u[:, -1] = 0; v[0, :] = v[-1, :] = 0
        return u, v

    # ---- one simulation step ----------------------------------------------
    def emit(self, cx: float, cy: float, r: float, density: float, heat: float,
             vel: tuple[float, float] = (0.0, 0.0)) -> None:
        m = ((self.X - cx) ** 2 + (self.Y - cy) ** 2) < r * r
        jitter = 0.75 + 0.5 * self.rng.random(m.sum())
        self.rho[m] = np.maximum(self.rho[m], density * jitter)
        self.temp[m] = np.maximum(self.temp[m], heat * jitter)
        self.u[m] = vel[0]; self.v[m] = vel[1]

    def step(self, dt: float) -> None:
        self.v += dt * (self.buoyancy * self.temp - 0.05 * self.rho)  # hot rises, heavy sinks
        u = self.advect(self.u, dt); v = self.advect(self.v, dt)
        self.u, self.v = u, v
        self.vorticity_confinement(dt)
        self.project()
        self.rho = self.advect_maccormack(self.rho, dt) * self.dissipation
        self.temp = self.advect_maccormack(self.temp, dt) * np.exp(-self.cooling * dt)
