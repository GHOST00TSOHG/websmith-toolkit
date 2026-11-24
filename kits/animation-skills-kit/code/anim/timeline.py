"""Keyframe tracks: the core data model of every animation tool."""
from __future__ import annotations

import bisect
from dataclasses import dataclass, field
from typing import Any

from .easing import Ease, linear


@dataclass(frozen=True, slots=True)
class Key:
    t: float
    value: Any            # float, tuple, or numpy array: anything supporting + - *
    ease: Ease = linear   # easing used for the segment that *arrives* at this key


@dataclass(slots=True)
class Track:
    keys: list[Key] = field(default_factory=list)

    def add(self, t: float, value: Any, ease: Ease = linear) -> "Track":
        i = bisect.bisect([k.t for k in self.keys], t)
        self.keys.insert(i, Key(t, value, ease))
        return self  # chainable: Track().add(0, 0).add(1, 10, out_back)

    def sample(self, t: float) -> Any:
        if not self.keys:
            raise ValueError("empty track")
        ks = self.keys
        if t <= ks[0].t:
            return ks[0].value
        if t >= ks[-1].t:
            return ks[-1].value
        i = bisect.bisect_right([k.t for k in ks], t)
        a, b = ks[i - 1], ks[i]
        u = (t - a.t) / (b.t - a.t)
        return a.value + (b.value - a.value) * b.ease(u)

    def velocity(self, t: float, dt: float = 1e-3) -> Any:
        """Central difference: drives squash & stretch and motion blur."""
        return (self.sample(t + dt) - self.sample(t - dt)) / (2 * dt)
