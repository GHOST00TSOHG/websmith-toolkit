---
name: testing-and-debugging
description: Testing and debugging the bot: pytest patterns, fakes and dependency injection, testing async code and time without sleeping, parametrized tests, debugging with pdb and logs, profiling. Use before and after any code change and when tracking down bugs.
---

# Testing and Debugging

## Run the suite
```bash
cd code
python -m pytest -q          # all tests
python -m pytest -k loop -v  # only tests whose name contains "loop"
```
Rule: every change keeps the suite green, and every new command or bug fix adds a test.

## Patterns used in `tests/test_bot.py`
- **Fakes over mocks:** `FakeLLM` records calls and returns a fixed reply. Tests
  check what the bot *sent* to the model (`llm.calls`), with no network.
- **Injectable clocks:** `TokenBucket` and `PerKeyLimiter` take `clock=`. Tests move
  time by changing a variable instead of sleeping, so they run fast and never flake.
- **Injectable sleep:** `retry(sleep=fake_sleep)` records backoff delays.
- **Parametrize** edge cases in one table (`test_parse_commands`).
- **Async without plugins:** `asyncio.run(bot.handle(...))`. With `pytest-asyncio`
  installed you can write `async def test_...` directly.

## Test pyramid for this bot
1. Unit: parser, guards, memory, retry (fast, many).
2. Bot-level: `Bot.handle()` with `FakeLLM` (behaviour end to end, no network).
3. Adapter: convert a sample platform event into `Message` (one or two per adapter).
4. Manual smoke test: console adapter, then the real chat.

## Debugging
- `breakpoint()` drops into pdb: `n` next, `s` step in, `p var` print, `c` continue.
- `LOG_LEVEL=DEBUG python -m botcore.adapters.console` shows guard and rate-limit
  decisions.
- "Bot doesn't answer" checklist: is the sender a bot (`ignore_bots`)? command prefix right?
  rate limited? exception logged? The order in `Bot.handle()` is the order to check.
- Reproduce a bug as a failing test first, then fix it. The test stops it coming back.

## Quality tools
`ruff check .` (lint), `ruff format .` (format), `mypy --strict botcore` (types),
`python -m pytest --cov=botcore` (coverage, with pytest-cov). Run them in a
pre-commit hook or CI (GitHub Actions) on every push.

Part of `kits/bot-learning-kit`. Code paths in this skill (such as `code/...`) are relative to that folder.
