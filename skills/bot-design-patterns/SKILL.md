---
name: bot-design-patterns
description: Design patterns for AI bots in Python: interface adapters, command design, conversation state, admin/authorization, safe tool use, handling other bots, graceful degradation and conversation UX. Use when adding features to a bot, connecting it to a new interface, or reviewing a bot's design.
---

# Bot Design Patterns

Reference: `code/botcore/bot.py`, `router.py`, `guards.py`, `adapters/console.py`.

## 1. Ports and adapters
The core (`Bot.handle(Message) -> Reply`) knows nothing about where messages
come from. An adapter turns events from a terminal, web API, Discord, Telegram,
Slack, SMS or email into `Message`, and sends `Reply.text` back. A new interface
means a new ~50-line adapter; the core and its tests are untouched.

## 2. Commands vs. natural language
- Deterministic actions (`/ping`, `/reset`, `/stats`) go through the
  `CommandRouter` in code: fast, free and testable.
- Everything else goes to the AI model.
- Register commands with a decorator; handlers can be sync or async and receive
  parsed arguments (`shlex` splitting, so quotes work).
- Unknown commands get a helpful error pointing to `/help`; don't send them to
  the model.

## 3. Conversation state
- Key memory by conversation id (`Message.channel`), never globally.
- Keep a size budget and trim oldest turns first (`ConversationMemory`).
- Give users `/reset`. For long-term facts, store them explicitly (SQLite) and
  inject only the relevant ones.

## 4. Authorization lives in code
Admin commands compare `msg.author` with the configured owner (`/stats`). Never
ask the model whether someone is allowed. Model output is not a security boundary.

## 5. Protecting cost and stability
- Per-user rate limits (`PerKeyLimiter`) so one user can't starve others.
- A concurrency cap on model calls (semaphore), timeouts on every call, and
  retries only for transient errors.
- `ignore_bots=True` by default: two bots answering each other can loop forever.
- Graceful failure: if the model is down, reply with a clear message; commands
  still work.

## 6. Tools (agent behaviour)
Give the model tools with validated inputs and allow-lists. Require a
confirmation step for anything destructive or costly, and cap the tool loop
(e.g. 5 steps). Log every tool call.

## 7. Conversation UX
Acknowledge slow work quickly (a "thinking..." message or typing indicator), keep
replies concise with an option to expand, make errors actionable ("Try /help"),
and keep `/help` generated from the registered commands so it never goes stale.

## Exercises
1. Write a web adapter: a FastAPI `POST /message` endpoint that calls `Bot.handle`.
2. Add a `/remind <minutes> "<text>"` command using an asyncio task scheduler.
3. Add one tool (e.g. current time or a calculator) with input validation and a
   5-step loop limit.

Part of `kits/bot-learning-kit`. Code paths in this skill (such as `code/...`) are relative to that folder.
