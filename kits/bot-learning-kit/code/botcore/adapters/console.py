"""Terminal adapter: talk to the bot in your terminal.

Run:  python -m botcore.adapters.console
Try `/help`, `/ping`, or any question (answered by the AI model if an API key is set).
"""
from __future__ import annotations

import asyncio
import logging
import os

from ..bot import Bot, BotConfig
from ..llm import AnthropicClient
from ..models import Message


async def main() -> None:
    logging.basicConfig(level=os.environ.get("LOG_LEVEL", "WARNING"))
    user = os.environ.get("BOT_OWNER", "owner")
    cfg = BotConfig(name=os.environ.get("BOT_NAME", "assistant"), owner=user)
    llm = AnthropicClient() if os.environ.get("ANTHROPIC_API_KEY") else None
    bot = Bot(cfg, llm)
    print(f"Talking to {cfg.name}. Type /help. Ctrl-D to quit.")
    while True:
        try:
            line = await asyncio.to_thread(input, "> ")
        except EOFError:
            break
        reply = await bot.handle(Message("console", user, line))
        if reply:
            print(f"{cfg.name}: {reply.text}")


if __name__ == "__main__":
    asyncio.run(main())
