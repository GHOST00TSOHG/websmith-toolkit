---
name: async-bot-architecture
description: asyncio and architecture patterns for a responsive chat bot: event loop, tasks, semaphores, rate limiting, retries with backoff, timeouts, cancellation, graceful shutdown, ports-and-adapters layout. Use when designing bot structure or fixing concurrency, hanging or slowness issues.
---

# Async Architecture for Chat Bots

## Why async
A bot spends most of its time waiting: for chat events and for the AI API (often
2 to 20 seconds). With `asyncio`, one process handles many conversations while
waiting, without threads.

## Core rules
1. **Never block the event loop.** No `time.sleep`, `requests.get` or heavy CPU work
   inside `async def`. Use `await asyncio.sleep`, an async HTTP client (`httpx`,
   `aiohttp`), or offload with `await asyncio.to_thread(fn, ...)` (as `llm.py` does).
2. **Every network call gets a timeout:** `await asyncio.wait_for(coro, 60)` or
   `async with asyncio.timeout(60):` (3.11+).
3. **Bound concurrency** with `asyncio.Semaphore` (`bot.py` limits parallel LLM calls)
   so a burst of messages can't exhaust your API quota.
4. **Keep references to tasks** you create, or they can be garbage-collected mid-run:
   ```python
   tasks = set()
   t = asyncio.create_task(work()); tasks.add(t); t.add_done_callback(tasks.discard)
   ```
5. Prefer `asyncio.TaskGroup` (3.11+) for structured concurrency: if one child
   fails, the others are cancelled and the error propagates.

## Architecture: ports and adapters
```
chat platform --(adapter)--> Message --> Bot.handle() --> Reply --(adapter)--> platform
                                             |
                                   router / guards / memory / LLMClient (Protocol)
```
- `bot.py` knows nothing about Discord, Telegram or the console.
- Adapters translate events into `Message` and send `Reply.text` back.
- Dependencies are injected (`Bot(config, llm)`), so tests pass a `FakeLLM`.
Moving platforms means writing a ~50-line adapter, nothing else.

## Producer/consumer with a queue
For high traffic, decouple receiving from processing:
```python
queue: asyncio.Queue[Message] = asyncio.Queue(maxsize=100)   # backpressure

async def worker(bot, send):
    while True:
        msg = await queue.get()
        try:
            if reply := await bot.handle(msg):
                await send(reply)
        finally:
            queue.task_done()

async with asyncio.TaskGroup() as tg:
    for _ in range(4):
        tg.create_task(worker(bot, send))
```

## Rate limiting
`TokenBucket` in `guards.py` allows `rate` messages per second with bursts up to
`capacity`. `PerKeyLimiter` keeps one per user so one heavy user can't starve others; add one global bucket matching the
AI provider's limits. Note the injectable `clock`, which makes it testable without
sleeping.

## Retries: exponential backoff with full jitter
`retry.py`: delay = random(0, min(cap, base * 2^attempt)). Retry only *transient*
errors (timeouts, HTTP 429, 5xx). Never retry 400/401: they will fail again and
waste quota. Jitter prevents many clients retrying in lockstep.

## Cancellation and shutdown
- `CancelledError` must propagate. Don't swallow it with a bare `except:`
  (`except Exception` is fine, since CancelledError is a BaseException).
- On SIGTERM: stop accepting new messages, `await queue.join()` with a timeout,
  close HTTP clients, then exit. `loop.add_signal_handler(signal.SIGTERM, stop.set)`.

## Debugging async
- `PYTHONASYNCIODEBUG=1` or `asyncio.run(main(), debug=True)` warns about slow
  callbacks (a sign of blocking calls) and never-awaited coroutines.
- "coroutine was never awaited" means you called `f()` instead of `await f()`.

Part of `kits/bot-learning-kit`. Code paths in this skill (such as `code/...`) are relative to that folder.
