"""Procedural motion: springs, Verlet ropes, FABRIK inverse kinematics, noise."""
from __future__ import annotations

import math

import numpy as np
from numpy.typing import NDArray

Vec = NDArray[np.float64]


# ---------------------------------------------------------------- springs
class Spring:
    """Damped spring toward a target: x'' = -w^2 (x - target) - 2*zeta*w*x'.

    frequency (Hz) sets speed; damping ratio zeta sets character:
    zeta < 1 wobbles (follow-through), zeta == 1 is the fastest no-overshoot
    settle (critically damped, great for cameras/UI), zeta > 1 is sluggish.
    Uses semi-implicit Euler: stable for w*dt well under 1.
    """

    def __init__(self, x: float | Vec, frequency: float = 2.0, damping: float = 0.4) -> None:
        self.x = np.asarray(x, float)
        self.v = np.zeros_like(self.x)
        self.w = 2 * math.pi * frequency
        self.zeta = damping

    def step(self, target: float | Vec, dt: float) -> Vec:
        a = -self.w ** 2 * (self.x - target) - 2 * self.zeta * self.w * self.v
        self.v = self.v + a * dt   # update velocity first...
        self.x = self.x + self.v * dt  # ...then position with the NEW velocity
        return self.x


# ------------------------------------------------------------ Verlet rope
class VerletRope:
    """Rope/chain via position-based dynamics.

    Verlet stores current and previous positions; velocity is implicit
    (x - x_prev). After integrating, distance constraints are relaxed a few
    times. More iterations = stiffer rope. Point 0 is pinned to an anchor.
    """

    def __init__(self, anchor, n: int = 12, seg: float = 10.0, damping: float = 0.995) -> None:
        anchor = np.asarray(anchor, float)
        self.p = np.array([anchor + [0, i * seg] for i in range(n)], float)
        self.prev = self.p.copy()
        self.seg = seg
        self.damping = damping

    def step(self, anchor, dt: float, gravity=(0.0, 900.0), iterations: int = 12) -> Vec:
        vel = (self.p - self.prev) * self.damping
        self.prev = self.p.copy()
        self.p = self.p + vel + np.asarray(gravity) * dt * dt
        for _ in range(iterations):
            self.p[0] = anchor
            d = self.p[1:] - self.p[:-1]
            dist = np.linalg.norm(d, axis=1, keepdims=True)
            corr = d * (1 - self.seg / np.maximum(dist, 1e-9)) / 2
            self.p[:-1] += corr
            self.p[1:] -= corr
        self.p[0] = anchor
        return self.p


# ------------------------------------------------------------------ FABRIK
def fabrik(joints: Vec, target, iterations: int = 20, tol: float = 1e-3) -> Vec:
    """Forward And Backward Reaching IK. Returns new joint positions.

    Backward pass: put the end effector on the target and pull each joint
    toward its child. Forward pass: re-pin the root and push outward.
    Lengths are preserved exactly; works in 2D and 3D.
    """
    j = np.array(joints, float)
    target = np.asarray(target, float)
    lens = np.linalg.norm(np.diff(j, axis=0), axis=1)
    root = j[0].copy()
    if np.linalg.norm(target - root) >= lens.sum():  # unreachable: straighten toward it
        direction = (target - root) / np.linalg.norm(target - root)
        return np.vstack([root, root + np.cumsum(lens)[:, None] * direction])
    for _ in range(iterations):
        j[-1] = target
        for i in range(len(j) - 2, -1, -1):
            d = j[i] - j[i + 1]
            j[i] = j[i + 1] + d / np.linalg.norm(d) * lens[i]
        j[0] = root
        for i in range(1, len(j)):
            d = j[i] - j[i - 1]
            j[i] = j[i - 1] + d / np.linalg.norm(d) * lens[i - 1]
        if np.linalg.norm(j[-1] - target) < tol:
            break
    return j


# ------------------------------------------------------------------- noise
class Noise1D:
    """Seeded 1D gradient (Perlin-style) noise in about [-1, 1], plus fBm.

    Smooth randomness for handheld camera shake, idle sway, flicker.
    """

    def __init__(self, seed: int = 0, size: int = 256) -> None:
        rng = np.random.default_rng(seed)
        self.g = rng.uniform(-1, 1, size)
        self.size = size

    def __call__(self, x: float) -> float:
        i = math.floor(x)
        f = x - i
        g0 = self.g[i % self.size]; g1 = self.g[(i + 1) % self.size]
        u = f ** 3 * (f * (6 * f - 15) + 10)  # quintic fade: C2-continuous
        return 2 * ((1 - u) * g0 * f + u * g1 * (f - 1))

    def fbm(self, x: float, octaves: int = 4, lacunarity: float = 2.0, gain: float = 0.5) -> float:
        total, amp, freq, norm = 0.0, 1.0, 1.0, 0.0
        for _ in range(octaves):
            total += amp * self(x * freq); norm += amp
            amp *= gain; freq *= lacunarity
        return total / norm
