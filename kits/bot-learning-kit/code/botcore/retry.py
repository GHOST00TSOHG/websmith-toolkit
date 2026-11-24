"""Async retry decorator with exponential backoff and full jitter."""
from __future__ import annotations

import asyncio
import functools
import logging
import random
from collections.abc import Awaitable, Callable
from typing import ParamSpec, TypeVar

P = ParamSpec("P")
T = TypeVar("T")
log = logging.getLogger(__name__)


class RetryableError(Exception):
    """Raise this for failures worth retrying (timeouts, 429, 5xx)."""


def retry(attempts: int = 4, base: float = 0.5, cap: float = 8.0,
          on: tuple[type[BaseException], ...] = (RetryableError,),
          sleep: Callable[[float], Awaitable[None]] = asyncio.sleep,
          ) -> Callable[[Callable[P, Awaitable[T]]], Callable[P, Awaitable[T]]]:
    """Retry an async function. ParamSpec keeps the wrapped signature typed."""

    def decorator(fn: Callable[P, Awaitable[T]]) -> Callable[P, Awaitable[T]]:
        @functools.wraps(fn)
        async def wrapper(*args: P.args, **kwargs: P.kwargs) -> T:
            for attempt in range(1, attempts + 1):
                try:
                    return await fn(*args, **kwargs)
                except on as exc:
                    if attempt == attempts:
                        raise
                    delay = random.uniform(0, min(cap, base * 2 ** (attempt - 1)))
                    log.warning("%s failed (%s); retry %d/%d in %.2fs",
                                fn.__name__, exc, attempt, attempts - 1, delay)
                    await sleep(delay)
            raise AssertionError("unreachable")

        return wrapper

    return decorator
