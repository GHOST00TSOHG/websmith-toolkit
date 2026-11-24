# Bot Learning Kit: Advanced Python + Skills for an AI Bot

An advanced kit for building, running and extending a Python AI bot. The design is
independent of where the bot runs (terminal, web API, any chat platform).

It has two layers:
- **`skills/`**: six skill folders, each with a `SKILL.md` (agent-skill format:
  YAML frontmatter + instructions). An AI agent can load these as skills, and you
  can read them as advanced guides.
- **`code/`**: a working, tested bot core that every skill refers to.

**AI agents: read `AGENT_INSTRUCTIONS.md` first.**

## Skills

| Skill | What it teaches |
|---|---|
| `advanced-python` | Typing, Protocols, ParamSpec decorators, dataclasses, context managers, generators, packaging |
| `async-bot-architecture` | asyncio, semaphores, queues, TaskGroup, rate limiting, backoff, cancellation, ports & adapters |
| `llm-integration` | System prompts, context budgets, streaming, tool use (agents), prompt injection, cost control |
| `bot-design-patterns` | Adapters, commands vs. natural language, conversation state, authorization, safe tools, UX |
| `production-ops` | Secrets, logging, systemd/Docker, monitoring, security checklist |
| `testing-and-debugging` | pytest fakes, injectable clocks, async tests, pdb, quality tooling |

## Code map (`code/botcore/`)

| Module | Advanced concepts shown |
|---|---|
| `models.py` | frozen + slotted dataclasses, Enum |
| `router.py` | anchored regex + shlex command parsing, decorator registration, sync/async handlers |
| `guards.py` | async token-bucket rate limiter, per-user limiter with pruning, injectable clock |
| `retry.py` | ParamSpec-typed async retry, exponential backoff with jitter |
| `memory.py` | per-conversation rolling context under a budget |
| `llm.py` | Protocol interface, fake client, zero-dependency API client with retries |
| `bot.py` | orchestration, semaphore-bounded concurrency, timeouts, admin checks, graceful failure |
| `adapters/console.py` | terminal interface for trying the bot |

## Quick start
```bash
cd code
python3 -m pytest -q                      # 24 tests should pass
python3 -m botcore.adapters.console       # type: /help
export ANTHROPIC_API_KEY=...              # optional: free-text answers from the model
```
Needs Python 3.11+. No third-party packages are required to run (pytest for tests).

## Learning path
Work through `ROADMAP.md`. Each stage pairs a skill with a hands-on change to the bot.
