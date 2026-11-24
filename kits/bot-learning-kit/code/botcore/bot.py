"""The bot: interface-independent orchestration.

Flow for each incoming Message:
  ignore other bots? -> per-user rate limit -> /command? -> else AI model -> trim -> Reply
Adapters (console, web API, Discord, Telegram, Slack, SMS...) only convert their
events into `Message` and send `Reply.text` back. They never contain bot logic.
"""
from __future__ import annotations

import asyncio
import logging
import time
from dataclasses import dataclass

from .guards import PerKeyLimiter
from .llm import LLMClient
from .memory import ConversationMemory
from .models import Message, Reply
from .router import CommandParser, CommandRouter

log = logging.getLogger(__name__)


@dataclass(slots=True)
class BotConfig:
    name: str = "assistant"
    owner: str = "owner"            # only this user may run admin commands
    command_prefix: str = "/"
    ignore_bots: bool = True        # don't answer other bots (prevents reply loops)
    max_reply_chars: int = 2000
    max_concurrent_llm: int = 4
    user_rate_per_sec: float = 0.5
    user_burst: int = 5
    system_prompt: str = (
        "You are {name}, a helpful assistant. Be accurate and concise "
        "(under {limit} characters). If you are unsure, say so."
    )


class Bot:
    def __init__(self, config: BotConfig, llm: LLMClient | None = None) -> None:
        self.cfg = config
        self.llm = llm
        self.parser = CommandParser(config.command_prefix)
        self.router = CommandRouter()
        self.memory = ConversationMemory()
        self.limiter = PerKeyLimiter(config.user_rate_per_sec, config.user_burst)
        self._llm_slots = asyncio.Semaphore(config.max_concurrent_llm)
        self._started = time.monotonic()
        self._register_builtins()

    # ---- built-in commands ------------------------------------------------
    def _register_builtins(self) -> None:
        r = self.router
        p = self.cfg.command_prefix

        @r.command("ping", "Health check")
        def _ping(args: list[str], msg: Message) -> str:
            return "pong"

        @r.command("help", "List commands")
        def _help(args: list[str], msg: Message) -> str:
            lines = [f"{p}{c.name}: {c.help}" for c in self.router.commands.values()]
            return "\n".join(lines + ["Anything else is answered by the AI model."])

        @r.command("uptime", "How long the bot has been running")
        def _uptime(args: list[str], msg: Message) -> str:
            s = int(time.monotonic() - self._started)
            return f"up {s // 3600}h {s % 3600 // 60}m {s % 60}s"

        @r.command("reset", "Clear the conversation memory for this conversation")
        def _reset(args: list[str], msg: Message) -> str:
            self.memory.clear(msg.channel)
            return "Conversation memory cleared."

        @r.command("stats", "Admin only: usage numbers")
        def _stats(args: list[str], msg: Message) -> str:
            if msg.author != self.cfg.owner:       # authorization is checked in code
                return "Sorry, that command is for the bot owner."
            return f"conversations in memory: {self.memory.size()}"

    # ---- main entry point -------------------------------------------------
    async def handle(self, msg: Message) -> Reply | None:
        if msg.from_bot and self.cfg.ignore_bots:
            return None
        if not msg.text.strip():
            return None
        if not self.limiter.allow(msg.author):
            log.info("rate limited: %s", msg.author)
            return Reply(msg.channel, "You're sending messages too fast. Try again shortly.", msg)

        cmd = self.parser.parse(msg.text)
        if cmd is not None:
            text = await self.router.dispatch(cmd, msg)
            if text is None:
                text = f"Unknown command {self.cfg.command_prefix}{cmd.name}. Try {self.cfg.command_prefix}help"
        else:
            text = await self._ask_llm(msg.text.strip(), msg)
        return Reply(msg.channel, self._fit(text), msg)

    async def _ask_llm(self, body: str, msg: Message) -> str:
        if self.llm is None:
            return f"No AI model configured. Try {self.cfg.command_prefix}help"
        self.memory.add(msg.channel, "user", body)
        system = self.cfg.system_prompt.format(name=self.cfg.name, limit=self.cfg.max_reply_chars)
        try:
            async with self._llm_slots:
                answer = await asyncio.wait_for(
                    self.llm.complete(system, self.memory.history(msg.channel)), 60)
        except Exception:
            log.exception("LLM call failed")
            return "Sorry, I couldn't reach the AI model. Please try again."
        self.memory.add(msg.channel, "assistant", answer)
        return answer

    def _fit(self, text: str) -> str:
        limit = self.cfg.max_reply_chars
        return text if len(text) <= limit else text[: limit - 1].rstrip() + "…"
