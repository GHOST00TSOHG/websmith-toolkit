"""Per-conversation memory with a size budget."""
from __future__ import annotations

from collections import defaultdict, deque
from dataclasses import dataclass


@dataclass(frozen=True, slots=True)
class Turn:
    role: str  # "user" or "assistant", the format LLM APIs expect
    content: str


class ConversationMemory:
    """Keeps the most recent turns per conversation under `max_chars`.

    Characters are a cheap proxy for tokens (~4 chars per token in English).
    The oldest turns are dropped first; the history always starts on a user turn,
    because most chat APIs reject a history that opens with the assistant.
    """

    def __init__(self, max_chars: int = 6000, max_turns: int = 40) -> None:
        self.max_chars = max_chars
        self._turns: dict[str, deque[Turn]] = defaultdict(lambda: deque(maxlen=max_turns))

    def add(self, channel: str, role: str, content: str) -> None:
        self._turns[channel].append(Turn(role, content))
        self._trim(channel)

    def history(self, channel: str) -> list[dict[str, str]]:
        return [{"role": t.role, "content": t.content} for t in self._turns[channel]]

    def size(self) -> int:
        return len(self._turns)

    def clear(self, channel: str) -> None:
        self._turns.pop(channel, None)

    def _trim(self, channel: str) -> None:
        turns = self._turns[channel]
        while len(turns) > 1 and sum(len(t.content) for t in turns) > self.max_chars:
            turns.popleft()
        while turns and turns[0].role != "user":
            turns.popleft()
