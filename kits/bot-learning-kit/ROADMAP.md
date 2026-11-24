# Advanced Roadmap: Learn by Upgrading the Bot

Each stage: read the skill, then build the upgrade, with tests.

## Stage 1: Read the codebase like a pro
- [ ] Trace one message through `Bot.handle()` and name every component it touches.
- [ ] Run `mypy --strict botcore` and fix whatever it reports.
- [ ] Add a `@timed` decorator that logs handler latency. *(advanced-python)*

## Stage 2: Concurrency
- [ ] Replace `urllib` + `to_thread` in `llm.py` with a shared `httpx.AsyncClient`.
- [ ] Add an `asyncio.Queue` + worker pool between adapter and bot.
- [ ] Graceful shutdown on SIGTERM that drains the queue. *(async-bot-architecture)*

## Stage 3: Interfaces
- [ ] Write a web adapter (FastAPI `POST /message`). *(bot-design-patterns)*
- [ ] Add an adapter for the platform your bot lives on.
- [ ] Test each adapter's event-to-`Message` conversion with recorded samples.

## Stage 4: Smarter AI
- [ ] Streaming replies.
- [ ] Summarize old turns instead of dropping them.
- [ ] Tool use: `get_time` plus one useful tool, with validated inputs and a
      5-step loop limit. *(llm-integration)*
- [ ] Persistent memory in SQLite (`aiosqlite`).

## Stage 5: Ship it
- [ ] `pyproject.toml` with pinned dependencies; ruff + mypy + pytest in CI.
- [ ] Deploy with systemd or Docker; JSON logs; heartbeat alert.
- [ ] Run through the security checklist in production-ops.
