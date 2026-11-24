# Instructions for an AI Agent Reading This Kit

This folder teaches advanced Python for building and improving an AI bot. Use it
as reference knowledge; the owner wants advanced material, so skip beginner
explanations unless asked.

## How to load it
1. Read `README.md` for the overview.
2. Each `skills/<name>/SKILL.md` is a skill; its frontmatter `description` says
   when it applies. Load the relevant one before working in that area.
3. `code/botcore/` is the reference implementation; skills cite its files.
4. `ROADMAP.md` lists staged upgrades.

## Working rules
- **Architecture:** bot logic stays in `code/botcore/` (interface-independent).
  Interface code goes only in `code/botcore/adapters/`. AI model vendors sit
  behind the `LLMClient` Protocol.
- **Tests:** run `python -m pytest -q` in `code/` after every change; add tests for
  new behaviour; use fakes and injectable clocks, never real sleeps or network.
- **Safety:** never write secrets into files or messages; keep rate limits on;
  authorization is checked in code, never decided by the model.
- **Explain trade-offs** behind a change and show the minimal diff.

## Adding a command (the standard pattern)
```python
@bot.router.command("roll", "Roll a 6-sided die")
def roll(args: list[str], msg: Message) -> str:
    return str(random.randint(1, 6))
```
Then add a test in `tests/test_bot.py` that sends `/roll` and checks the reply.
