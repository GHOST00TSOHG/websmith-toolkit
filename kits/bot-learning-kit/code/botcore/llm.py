"""LLM clients behind a Protocol, so the bot never depends on one vendor.

`AnthropicClient` uses only the standard library (urllib) run in a worker thread,
so the kit works with zero installs. In production, swap in `httpx.AsyncClient`
for true async I/O and connection pooling; the Protocol means nothing else changes.
"""
from __future__ import annotations

import asyncio
import json
import os
import urllib.error
import urllib.request
from collections.abc import Sequence
from typing import Protocol

from .retry import RetryableError, retry


class LLMClient(Protocol):
    async def complete(self, system: str, messages: Sequence[dict[str, str]]) -> str: ...


class FakeLLM:
    """Deterministic stand-in for tests and offline use."""

    def __init__(self, reply: str = "(fake reply)") -> None:
        self.reply = reply
        self.calls: list[tuple[str, list[dict[str, str]]]] = []

    async def complete(self, system: str, messages: Sequence[dict[str, str]]) -> str:
        self.calls.append((system, list(messages)))
        return self.reply


class AnthropicClient:
    URL = "https://api.anthropic.com/v1/messages"

    def __init__(self, api_key: str | None = None, model: str | None = None,
                 max_tokens: int = 400, timeout: float = 30.0) -> None:
        self.api_key = api_key or os.environ["ANTHROPIC_API_KEY"]
        self.model = model or os.environ.get("LLM_MODEL", "claude-sonnet-5-5")
        self.max_tokens = max_tokens
        self.timeout = timeout

    @retry(attempts=4)
    async def complete(self, system: str, messages: Sequence[dict[str, str]]) -> str:
        body = {"model": self.model, "max_tokens": self.max_tokens,
                "system": system, "messages": list(messages)}
        data = await asyncio.to_thread(self._post, body)
        return "".join(b.get("text", "") for b in data.get("content", [])
                       if b.get("type") == "text").strip()

    def _post(self, body: dict) -> dict:
        req = urllib.request.Request(
            self.URL, data=json.dumps(body).encode(), method="POST",
            headers={"x-api-key": self.api_key, "anthropic-version": "2023-06-01",
                     "content-type": "application/json"})
        try:
            with urllib.request.urlopen(req, timeout=self.timeout) as resp:
                return json.load(resp)
        except urllib.error.HTTPError as e:
            if e.code == 429 or e.code >= 500:
                raise RetryableError(f"HTTP {e.code}") from e
            raise RuntimeError(f"LLM API error {e.code}: {e.read()[:300]!r}") from e
        except (urllib.error.URLError, TimeoutError) as e:
            raise RetryableError(str(e)) from e
