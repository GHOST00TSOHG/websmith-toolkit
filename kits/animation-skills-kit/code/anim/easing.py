"""Easing functions: map normalized time u in [0, 1] to progress.

All functions satisfy f(0) == 0 and f(1) == 1. Some (back, elastic) overshoot
outside [0, 1] on purpose: that is anticipation and follow-through.
"""
from __future__ import annotations

import math
from collections.abc import Callable

Ease = Callable[[float], float]


def linear(u: float) -> float: return u
def in_quad(u: float) -> float: return u * u
def out_quad(u: float) -> float: return 1 - (1 - u) ** 2
def in_out_quad(u: float) -> float: return 2 * u * u if u < 0.5 else 1 - (-2 * u + 2) ** 2 / 2
def in_cubic(u: float) -> float: return u ** 3
def out_cubic(u: float) -> float: return 1 - (1 - u) ** 3
def in_out_cubic(u: float) -> float: return 4 * u ** 3 if u < 0.5 else 1 - (-2 * u + 2) ** 3 / 2
def smoothstep(u: float) -> float: return u * u * (3 - 2 * u)
def smootherstep(u: float) -> float: return u ** 3 * (u * (6 * u - 15) + 10)


def in_back(u: float, s: float = 1.70158) -> float:
    """Pulls back before moving: anticipation."""
    return (s + 1) * u ** 3 - s * u ** 2


def out_back(u: float, s: float = 1.70158) -> float:
    """Overshoots then settles: follow-through."""
    return 1 + (s + 1) * (u - 1) ** 3 + s * (u - 1) ** 2


def out_elastic(u: float) -> float:
    if u in (0.0, 1.0):
        return u
    return 2 ** (-10 * u) * math.sin((u * 10 - 0.75) * (2 * math.pi) / 3) + 1


def out_bounce(u: float) -> float:
    n, d = 7.5625, 2.75
    if u < 1 / d:
        return n * u * u
    if u < 2 / d:
        u -= 1.5 / d; return n * u * u + 0.75
    if u < 2.5 / d:
        u -= 2.25 / d; return n * u * u + 0.9375
    u -= 2.625 / d; return n * u * u + 0.984375


def reverse(f: Ease) -> Ease:
    """Turn an ease-in into an ease-out (and vice versa)."""
    return lambda u: 1 - f(1 - u)


def cubic_bezier(x1: float, y1: float, x2: float, y2: float) -> Ease:
    """CSS-style cubic-bezier(x1, y1, x2, y2) timing function.

    The curve is parametric in s, so for a given time u we must solve
    x(s) = u for s (Newton's method, bisection fallback), then return y(s).
    """
    if not (0 <= x1 <= 1 and 0 <= x2 <= 1):
        raise ValueError("x control points must be in [0, 1] so x(s) is monotonic")

    def bez(a: float, b: float, s: float) -> float:
        return 3 * a * (1 - s) ** 2 * s + 3 * b * (1 - s) * s * s + s ** 3

    def dbez(a: float, b: float, s: float) -> float:
        return 3 * a * (1 - s) ** 2 + 6 * (b - a) * (1 - s) * s + 3 * (1 - b) * s * s

    def ease(u: float) -> float:
        if u <= 0 or u >= 1:
            return float(u >= 1)
        s = u
        for _ in range(8):
            err = bez(x1, x2, s) - u
            if abs(err) < 1e-7:
                return bez(y1, y2, s)
            d = dbez(x1, x2, s)
            if abs(d) < 1e-6:
                break
            s -= err / d
        lo, hi, s = 0.0, 1.0, u
        for _ in range(50):
            x = bez(x1, x2, s)
            if abs(x - u) < 1e-7:
                break
            lo, hi = (s, hi) if x < u else (lo, s)
            s = (lo + hi) / 2
        return bez(y1, y2, s)

    return ease


EASES: dict[str, Ease] = {name: fn for name, fn in globals().items()
                          if callable(fn) and name in {
                              "linear", "in_quad", "out_quad", "in_out_quad", "in_cubic",
                              "out_cubic", "in_out_cubic", "smoothstep", "smootherstep",
                              "in_back", "out_back", "out_elastic", "out_bounce"}}
