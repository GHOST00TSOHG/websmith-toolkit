"""Immutable data types shared by every part of the bot.

Frozen, slotted dataclasses: cheap, hashable, and safe to pass between tasks
because nobody can mutate them after creation.
"""
from __future__ import annotations

import time
from dataclasses import dataclass, field
from enum import Enum, auto


class Role(Enum):
    HUMAN = auto()
    BOT = auto()


@dataclass(frozen=True, slots=True)
class Message:
    channel: str          # conversation id: a DM, a room, a web session...
    author: str
    text: str
    role: Role = Role.HUMAN
    ts: float = field(default_factory=time.time)

    @property
    def from_bot(self) -> bool:
        return self.role is Role.BOT


@dataclass(frozen=True, slots=True)
class Reply:
    channel: str
    text: str
    in_reply_to: Message
