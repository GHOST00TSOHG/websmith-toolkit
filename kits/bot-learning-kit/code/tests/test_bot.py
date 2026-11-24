"""Run from the code/ folder:  python -m pytest -q
Async tests use asyncio.run() directly, so no pytest plugins are needed.
"""
from __future__ import annotations

import asyncio

import pytest

from botcore.bot import Bot, BotConfig
from botcore.guards import PerKeyLimiter, TokenBucket
from botcore.llm import FakeLLM
from botcore.memory import ConversationMemory
from botcore.models import Message, Role
from botcore.retry import RetryableError, retry
from botcore.router import CommandParser


def msg(text: str, author: str = "alice", channel: str = "c1", role: Role = Role.HUMAN) -> Message:
    return Message(channel, author, text, role)


def make_bot(**kw) -> tuple[Bot, FakeLLM]:
    llm = FakeLLM("hello from the model")
    kw.setdefault("user_burst", 100)
    kw.setdefault("user_rate_per_sec", 100)
    return Bot(BotConfig(**kw), llm), llm


def run(bot: Bot, m: Message):
    return asyncio.run(bot.handle(m))


# ---- command parsing -------------------------------------------------------
@pytest.mark.parametrize("text,name,args", [
    ("/ping", "ping", []),
    ("  /Echo hello world", "echo", ["hello", "world"]),
    ('/remind "buy milk" 5pm', "remind", ["buy milk", "5pm"]),
    ('/note "unbalanced', "note", ['"unbalanced']),
])
def test_parse_commands(text, name, args):
    cmd = CommandParser("/").parse(text)
    assert cmd is not None and cmd.name == name and cmd.args == args


@pytest.mark.parametrize("text", ["hello", "a/b", "/ spaced", "/123", ""])
def test_plain_text_is_not_a_command(text):
    assert CommandParser("/").parse(text) is None


def test_custom_prefix():
    assert CommandParser("!").parse("!ping").name == "ping"
    assert CommandParser("!").parse("/ping") is None


# ---- routing -------------------------------------------------------------------
def test_builtin_commands_skip_the_model():
    bot, llm = make_bot()
    assert run(bot, msg("/ping")).text == "pong"
    assert "/ping" in run(bot, msg("/help")).text
    assert "Unknown command /nope" in run(bot, msg("/nope")).text
    assert llm.calls == []


def test_free_text_goes_to_model_with_memory():
    bot, llm = make_bot()
    assert run(bot, msg("tell me a joke")).text == "hello from the model"
    run(bot, msg("another"))
    system, history = llm.calls[1]
    assert "assistant" in system
    assert [h["role"] for h in history] == ["user", "assistant", "user"]


def test_conversations_are_isolated_and_resettable():
    bot, llm = make_bot()
    run(bot, msg("hi", channel="a")); run(bot, msg("hi", channel="b"))
    assert len(bot.memory.history("a")) == 2
    run(bot, msg("/reset", channel="a"))
    assert bot.memory.history("a") == [] and len(bot.memory.history("b")) == 2


def test_async_command_with_args():
    bot, _ = make_bot()

    @bot.router.command("echo", "Repeat the arguments")
    async def echo(args: list[str], m: Message) -> str:
        await asyncio.sleep(0)
        return " | ".join(args)

    assert run(bot, msg('/echo one "two three"')).text == "one | two three"


def test_admin_command_checks_owner():
    bot, _ = make_bot(owner="boss")
    assert "owner" in run(bot, msg("/stats", author="alice")).text
    assert "conversations" in run(bot, msg("/stats", author="boss")).text


def test_ignores_other_bots_by_default():
    bot, llm = make_bot()
    assert run(bot, msg("hello", author="otherbot", role=Role.BOT)) is None
    bot2, _ = make_bot(ignore_bots=False)
    assert run(bot2, msg("/ping", author="otherbot", role=Role.BOT)).text == "pong"


def test_reply_trimmed():
    bot, llm = make_bot(max_reply_chars=20)
    llm.reply = "x" * 100
    text = run(bot, msg("long please")).text
    assert len(text) == 20 and text.endswith("…")


def test_model_failure_is_graceful():
    class Broken:
        async def complete(self, system, messages):
            raise RuntimeError("boom")

    bot = Bot(BotConfig(), Broken())
    assert "couldn't reach" in run(bot, msg("hi")).text


def test_per_user_rate_limit():
    bot, _ = make_bot(user_burst=2, user_rate_per_sec=0.001)
    assert run(bot, msg("/ping")).text == "pong"
    assert run(bot, msg("/ping")).text == "pong"
    assert "too fast" in run(bot, msg("/ping")).text
    assert run(bot, msg("/ping", author="bob")).text == "pong"   # other users unaffected


# ---- rate limiter --------------------------------------------------------------
def test_token_bucket_refills():
    now = [0.0]
    b = TokenBucket(rate=1, capacity=2, clock=lambda: now[0])
    assert b.try_acquire() and b.try_acquire() and not b.try_acquire()
    now[0] = 1.0
    assert b.try_acquire() and not b.try_acquire()


def test_per_key_limiter_prunes_idle_keys():
    now = [0.0]
    lim = PerKeyLimiter(rate=1, capacity=1, clock=lambda: now[0], max_keys=2)
    lim.allow("a"); lim.allow("b")
    now[0] = 10.0                                  # both fully refilled = idle
    lim.allow("c")
    assert set(lim._buckets) == {"c"}


# ---- memory ----------------------------------------------------------------------
def test_memory_budget_and_user_first():
    m = ConversationMemory(max_chars=25)
    m.add("c", "user", "a" * 10)
    m.add("c", "assistant", "b" * 10)
    m.add("c", "user", "c" * 10)
    hist = m.history("c")
    assert hist[0]["role"] == "user"
    assert sum(len(t["content"]) for t in hist) <= 25


# ---- retry -------------------------------------------------------------------------
def test_retry_then_succeed():
    attempts, sleeps = [], []

    async def fake_sleep(d: float) -> None:
        sleeps.append(d)

    @retry(attempts=3, sleep=fake_sleep)
    async def flaky() -> str:
        attempts.append(1)
        if len(attempts) < 3:
            raise RetryableError("try again")
        return "ok"

    assert asyncio.run(flaky()) == "ok"
    assert len(attempts) == 3 and len(sleeps) == 2


def test_retry_gives_up():
    async def no_sleep(d: float) -> None: ...

    @retry(attempts=2, sleep=no_sleep)
    async def always_fails() -> None:
        raise RetryableError("nope")

    with pytest.raises(RetryableError):
        asyncio.run(always_fails())
