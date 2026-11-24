"""Splines and motion paths: Catmull-Rom, arc-length reparameterization, slerp."""
from __future__ import annotations

import numpy as np
from numpy.typing import NDArray

Vec = NDArray[np.float64]


def lerp(a, b, u):
    return a + (b - a) * u


def catmull_rom(points: Vec, u: float, alpha: float = 0.5) -> Vec:
    """Point on a Catmull-Rom spline through `points` at global parameter u in [0, 1].

    alpha=0.5 (centripetal) avoids cusps and self-intersections that the
    uniform version (alpha=0) produces when points are unevenly spaced.
    Endpoints are duplicated so the curve passes through the first and last point.
    """
    P = np.asarray(points, float)
    P = np.vstack([P[0], P, P[-1]])
    segs = len(P) - 3
    x = min(max(u, 0.0), 1.0) * segs
    i = min(int(x), segs - 1)
    t = x - i
    p0, p1, p2, p3 = P[i:i + 4]

    def tj(ti: float, a: Vec, b: Vec) -> float:
        return ti + max(float(np.linalg.norm(b - a)) ** alpha, 1e-6)

    t0 = 0.0; t1 = tj(t0, p0, p1); t2 = tj(t1, p1, p2); t3 = tj(t2, p2, p3)
    T = t1 + (t2 - t1) * t
    a1 = (t1 - T) / (t1 - t0) * p0 + (T - t0) / (t1 - t0) * p1
    a2 = (t2 - T) / (t2 - t1) * p1 + (T - t1) / (t2 - t1) * p2
    a3 = (t3 - T) / (t3 - t2) * p2 + (T - t2) / (t3 - t2) * p3
    b1 = (t2 - T) / (t2 - t0) * a1 + (T - t0) / (t2 - t0) * a2
    b2 = (t3 - T) / (t3 - t1) * a2 + (T - t1) / (t3 - t1) * a3
    return (t2 - T) / (t2 - t1) * b1 + (T - t1) / (t2 - t1) * b2


class ArcLengthPath:
    """Constant-speed travel along any parametric curve.

    Raw spline parameters don't map to distance: objects speed up on long
    segments. We sample the curve, build a cumulative length table, and invert
    it so `at(d)` returns the point at fraction d of the total length.
    """

    def __init__(self, curve, samples: int = 512) -> None:
        self.curve = curve
        self.us = np.linspace(0, 1, samples)
        pts = np.array([curve(u) for u in self.us])
        seg = np.linalg.norm(np.diff(pts, axis=0), axis=1)
        self.lengths = np.concatenate([[0], np.cumsum(seg)])
        self.total = float(self.lengths[-1])

    def at(self, d: float) -> Vec:
        target = min(max(d, 0.0), 1.0) * self.total
        u = float(np.interp(target, self.lengths, self.us))
        return self.curve(u)


def quat_from_axis_angle(axis, angle: float) -> Vec:
    axis = np.asarray(axis, float)
    axis = axis / np.linalg.norm(axis)
    return np.concatenate([[np.cos(angle / 2)], np.sin(angle / 2) * axis])  # (w, x, y, z)


def slerp(q0: Vec, q1: Vec, u: float) -> Vec:
    """Spherical linear interpolation between unit quaternions.

    Constant angular velocity and no gimbal lock, unlike lerping Euler angles.
    Flips q1 when needed so rotation takes the short way around.
    """
    q0 = np.asarray(q0, float); q1 = np.asarray(q1, float)
    dot = float(np.dot(q0, q1))
    if dot < 0:
        q1, dot = -q1, -dot
    if dot > 0.9995:  # nearly identical: nlerp avoids division by ~0
        q = q0 + u * (q1 - q0)
        return q / np.linalg.norm(q)
    theta = np.arccos(dot)
    return (np.sin((1 - u) * theta) * q0 + np.sin(u * theta) * q1) / np.sin(theta)
