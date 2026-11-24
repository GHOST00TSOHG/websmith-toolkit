---
name: llm-integration
description: Connecting the bot to an AI model API: request format, system prompts, conversation memory and context budgets, streaming, tool use / function calling, cost control and prompt-injection defense. Use when changing how the bot talks to the AI model or adding agent abilities.
---

# Integrating an AI Model (LLM)

## The request
Chat APIs take a **system prompt** (who the bot is, rules) and a **messages** list
of alternating `user` / `assistant` turns. See `llm.py` (`AnthropicClient`) for a
dependency-free implementation with retries. Configure via environment variables:
`ANTHROPIC_API_KEY`, `LLM_MODEL`. Check the provider's docs for current model names.

## System prompt design
`BotConfig.system_prompt` in `bot.py` sets: identity, tone, format (concise; say
when unsure) and
boundaries (don't impersonate others). Tips:
- Put stable rules in the system prompt and the changing context in messages.
- Be specific about output format and length; models follow concrete limits.
- Version your prompts in git, and test changes against saved example chats.

## Memory and the context window
Models are stateless: you resend history every call. `ConversationMemory` keeps a
per-conversation rolling window under a character budget (~4 chars per token) and makes
sure history starts with a user turn. Upgrades:
- **Summarize** old turns: when trimming, ask the model to compress dropped turns
  into one "Earlier in this chat: ..." note.
- **Long-term memory:** store facts in SQLite and inject relevant ones into the
  system prompt. For many facts, use embeddings + vector search (retrieval, "RAG").
- In conversations with several people, prefix each user turn with the speaker
  (`alice: ...`) so the model knows who said what.

## Streaming
Most APIs can stream tokens (server-sent events). Benefit: show a "typing"
indicator or send the first sentence early. With `httpx`:
`async with client.stream("POST", url, json=body) as r: async for line in r.aiter_lines(): ...`
and parse `data:` lines as JSON events.

## Tool use (function calling): turning a bot into an agent
You describe tools (name, description, JSON-schema input); the model replies with a
tool call; your code runs it and sends back the result; the model then answers.
```python
TOOLS = {"get_time": lambda args: datetime.now().isoformat()}
# loop: resp = call(messages, tools=schemas)
#   while resp wants a tool: run TOOLS[name](input), append tool_result, call again
#   cap the loop (e.g. 5 iterations) to avoid runaway costs
```
Good first tools: weather, reminders, web search, reading a notes file.
Treat every tool input as untrusted: validate it with pydantic and allow-list
what tools may touch (paths, URLs, commands).

## Prompt injection
Anyone who can send your bot text (or write a page it reads) can craft text to
hijack your bot ("ignore your instructions and..."). Defenses:
- Never give the model tools with destructive power without a confirmation step
  from the owner (check `msg.author == cfg.owner`).
- Keep secrets out of prompts entirely; the model can be tricked into repeating them.
- Admin commands are checked in code, never by asking the model.

## Cost and latency control
- Cap `max_tokens`; short replies are cheaper and faster.
- Answer commands (`ping`, `help`) in code, never via the model.
- Log token usage from each response's `usage` field; alert on spikes.
- Use a smaller/faster model for routing or summaries, a bigger one for answers.

Part of `kits/bot-learning-kit`. Code paths in this skill (such as `code/...`) are relative to that folder.
