---
name: advanced-python
description: Advanced Python techniques used in this bot (typing, Protocols, dataclasses, decorators, generators, context managers, packaging). Use when writing or reviewing Python for the bot or explaining an advanced language feature.
---

# Advanced Python for Bot Builders

Every technique here is used somewhere in `code/botcore/`. Read the file referenced,
then do the exercise.

## 1. Static typing that pays off
- Use modern syntax: `list[str]`, `dict[str, int]`, `str | None` (3.10+), and
  `from __future__ import annotations` so annotations are not evaluated at import.
- `TypeAlias` names complex types (`Handler` in `router.py`).
- `ParamSpec` + `TypeVar` let a decorator keep the wrapped function's signature
  (`retry.py`). Without them, type checkers lose all argument info.
- Run a checker: `mypy --strict botcore` or `pyright`. Treat warnings as bugs.

**Exercise:** add a deliberately wrong type to a handler and see mypy catch it.

## 2. Protocols: interfaces without inheritance
`LLMClient` in `llm.py` is a `typing.Protocol`. Any class with a matching
`async def complete(...)` method qualifies, with no base class needed. This is
structural ("duck") typing that a checker can verify. It is why `FakeLLM` and
`AnthropicClient` are swappable and why tests need no network.

**Exercise:** write an `EchoLLM` that returns the last user message reversed and
plug it into the console adapter.

## 3. Dataclasses done right
- `@dataclass(frozen=True, slots=True)` gives immutable, memory-efficient,
  hashable value objects (`models.py`). Immutability makes sharing data between
  async tasks safe.
- `field(default_factory=...)` for mutable or computed defaults; never `= []`.
- Use `Enum` for closed sets of values (`Role`) instead of magic strings.
- For validating *external* input (JSON from a webhook, config files), use
  `pydantic` models; keep dataclasses for internal data.

## 4. Decorators and closures
- Registration decorators (`@router.command("ping")` in `router.py`) are a closure
  that stores the function and returns it unchanged.
- Wrapping decorators (`@retry` in `retry.py`) return a new function. Always use
  `functools.wraps` to keep the name and docstring.
- A decorator *with arguments* is a function that returns a decorator: three layers.

**Exercise:** write `@timed` that logs how long any async handler took.

## 5. Context managers
- `async with semaphore:` (`bot.py`) guarantees release even on exceptions.
- Write your own with `contextlib.contextmanager` / `asynccontextmanager`:
  ```python
  @asynccontextmanager
  async def typing_indicator(channel):
      task = asyncio.create_task(show_typing_forever(channel))
      try:
          yield
      finally:
          task.cancel()
  ```
- `contextlib.suppress(SomeError)` and `ExitStack` for dynamic resource sets.

## 6. Generators and lazy pipelines
Stream LLM tokens or process large logs without loading everything:
```python
def chunks(text: str, size: int):
    for i in range(0, len(text), size):
        yield text[i:i + size]
```
Async generators (`async def ... yield`) stream replies piece by piece, which is
useful for sending a long answer as several short messages on a small screen.

## 7. Data structures that matter here
- `collections.deque(maxlen=N)`: O(1) sliding windows (conversation memory).
- `defaultdict`: per-conversation state without key checks.
- `functools.lru_cache` / `cache`: memoize pure lookups.
- Know your costs: `x in list` is O(n), `x in set`/`dict` is O(1).

## 8. Regex, precisely
`CommandParser` anchors its pattern (`^\s*/name`) so `a/b` or `/ text` stay plain
text, then splits arguments with `shlex` so quoted arguments work. Always `re.escape()` user-supplied
names and compile patterns once.

## 9. Packaging and project layout
- Package code in a folder with `__init__.py`; run modules with `python -m`.
- Add a `pyproject.toml` with dependencies and tool config (ruff, mypy, pytest).
- Use a virtual environment per project: `python -m venv .venv`.
- Lint and format with `ruff check --fix` and `ruff format`.

## 10. Performance mindset
Measure before optimizing: `python -m cProfile -s cumtime script.py`,
`time.perf_counter()` for micro-timings. For a chat bot the bottleneck is almost
always network I/O to the AI API. Solve it with concurrency (see the
async-bot-architecture skill), not faster Python.

Part of `kits/bot-learning-kit`. Code paths in this skill (such as `code/...`) are relative to that folder.
