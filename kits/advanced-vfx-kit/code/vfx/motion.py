"""Character-motion building blocks used in modern game animation:
inertialization blending and a minimal motion-matching search."""
from __future__ import annotations

import numpy as np

Array = np.ndarray


def inertialize(offset: Array, velocity: Array, t: Array | float, blend_time: float) -> Array:
    """Quintic inertialization (Bollo, GDC 2018).

    At a transition you jump to the NEW animation instantly, then add a decaying
    offset = (old pose - new pose) that reaches zero with zero velocity and
    acceleration at `blend_time`. No need to keep evaluating the old animation,
    unlike crossfades. Works per channel (positions, angles...).
    """
    x0 = np.asarray(offset, float); v0 = np.asarray(velocity, float)
    T = blend_time
    t = np.clip(np.asarray(t, float), 0, T)
    # Clamp the initial velocity so the curve doesn't overshoot when v0 points away from 0
    v0 = np.where(v0 * x0 >= 0, 0.0, v0)
    with np.errstate(divide="ignore", invalid="ignore"):
        T = np.minimum(T, np.where(v0 != 0, -5 * x0 / v0, T))
    T = np.maximum(T, 1e-6)
    a0 = (-8 * v0 * T - 20 * x0) / T ** 2
    A = -(a0 * T ** 2 + 6 * v0 * T + 12 * x0) / (2 * T ** 5)
    B = (3 * a0 * T ** 2 + 16 * v0 * T + 30 * x0) / (2 * T ** 4)
    C = -(3 * a0 * T ** 2 + 12 * v0 * T + 20 * x0) / (2 * T ** 3)
    t = np.minimum(t, T)
    return A * t**5 + B * t**4 + C * t**3 + a0 / 2 * t**2 + v0 * t + x0


class MotionDatabase:
    """Minimal motion matching: every frame of every clip gets a feature vector
    (e.g. future trajectory positions/directions + foot positions/velocities).
    Each query picks the frame whose features best match the desired ones.
    Features are normalized per dimension and weighted.
    """

    def __init__(self, features: Array, weights: Array | None = None) -> None:
        self.raw = np.asarray(features, float)
        self.mean = self.raw.mean(0)
        self.std = self.raw.std(0) + 1e-8
        self.w = np.ones(self.raw.shape[1]) if weights is None else np.asarray(weights, float)
        self.db = (self.raw - self.mean) / self.std * self.w

    def query(self, feature: Array, exclude: Array | None = None) -> tuple[int, float]:
        q = (np.asarray(feature, float) - self.mean) / self.std * self.w
        d = ((self.db - q) ** 2).sum(1)
        if exclude is not None:
            d[exclude] = np.inf
        i = int(np.argmin(d))  # production: KD-tree / AABB hierarchy, or learned (LMM)
        return i, float(d[i])
