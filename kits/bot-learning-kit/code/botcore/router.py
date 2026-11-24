"""Command parsing and decorator-based command routing."""
from __future__ import annotations

import inspect
import re
import shlex
from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from typing import TypeAlias

from .models import Message

Handler: TypeAlias = Callable[[list[str], Message], "str | Awaitable[str]"]


@dataclass(frozen=True, slots=True)
class Command:
    name: str
    help: str
    handler: Handler


@dataclass(frozen=True, slots=True)
class ParsedCommand:
    name: str
    args: list[str]


class CommandParser:
    """Parses `/name arg1 "quoted arg"` style commands.

    The prefix is configurable ("/", "!", ...). The name must start right after the
    prefix, so "a/b" or "/ not-a-command" are plain text. Arguments are split
    shell-style so quotes work; unbalanced quotes fall back to whitespace splitting.
    """

    def __init__(self, prefix: str = "/") -> None:
        self.prefix = prefix
        self._pattern = re.compile(rf"^\s*{re.escape(prefix)}([A-Za-z][\w-]*)(?:\s+(.*))?$", re.S)

    def parse(self, text: str) -> ParsedCommand | None:
        m = self._pattern.match(text)
        if not m:
            return None
        raw = m.group(2) or ""
        try:
            args = shlex.split(raw)
        except ValueError:
            args = raw.split()
        return ParsedCommand(m.group(1).lower(), args)


class CommandRouter:
    def __init__(self) -> None:
        self._commands: dict[str, Command] = {}

    def command(self, name: str, help: str = "") -> Callable[[Handler], Handler]:
        """Decorator: @router.command("ping", "Health check")."""

        def register(fn: Handler) -> Handler:
            key = name.lower()
            if key in self._commands:
                raise ValueError(f"command {name!r} already registered")
            self._commands[key] = Command(key, help or (fn.__doc__ or "").strip(), fn)
            return fn

        return register

    @property
    def commands(self) -> dict[str, Command]:
        return dict(self._commands)

    async def dispatch(self, cmd: ParsedCommand, msg: Message) -> str | None:
        """Run a registered command; None if the name is unknown."""
        c = self._commands.get(cmd.name)
        if c is None:
            return None
        result = c.handler(cmd.args, msg)
        if inspect.isawaitable(result):  # supports both sync and async handlers
            result = await result
        return result
