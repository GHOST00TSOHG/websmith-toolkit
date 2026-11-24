"""Abuse and cost protection: per-user async token-bucket rate limiting."""
from __future__ import annotations

import asyncio
import time
from collections.abc import Callable

Clock = Callable[[], float]


class TokenBucket:
    """Async rate limiter: `rate` tokens per second, bursts up to `capacity`."""

    def __init__(self, rate: float, capacity: int, clock: Clock = time.monotonic) -> None:
        if rate <= 0 or capacity <= 0:
            raise ValueError("rate and capacity must be positive")
        self.rate = rate
        self.capacity = capacity
        self._tokens = float(capacity)
        self._clock = clock
        self._last = clock()
        self._lock = asyncio.Lock()

    def _refill(self) -> None:
        now = self._clock()
        self._tokens = min(self.capacity, self._tokens + (now - self._last) * self.rate)
        self._last = now

    def try_acquire(self) -> bool:
        self._refill()
        if self._tokens >= 1:
            self._tokens -= 1
            return True
        return False

    async def acquire(self) -> None:
        async with self._lock:  # waiters queue on the lock
            while not self.try_acquire():
                await asyncio.sleep((1 - self._tokens) / self.rate)


class PerKeyLimiter:
    """One bucket per key (user id, channel, API key). Idle buckets are pruned."""

    def __init__(self, rate: float, capacity: int, clock: Clock = time.monotonic,
                 max_keys: int = 10_000) -> None:
        self.rate, self.capacity, self._clock, self.max_keys = rate, capacity, clock, max_keys
        self._buckets: dict[str, TokenBucket] = {}

    def allow(self, key: str) -> bool:
        b = self._buckets.get(key)
        if b is None:
            if len(self._buckets) >= self.max_keys:
                self._prune()
            b = self._buckets[key] = TokenBucket(self.rate, self.capacity, self._clock)
        return b.try_acquire()

    def _prune(self) -> None:
        """Drop buckets that have refilled completely: those users are idle."""
        idle = []
        for k, b in self._buckets.items():
            b._refill()
            if b._tokens >= b.capacity:
                idle.append(k)
        for k in idle:
            del self._buckets[k]
