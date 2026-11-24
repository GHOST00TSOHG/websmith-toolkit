---
name: ai-native-ui-and-agents
description: Designing and building UI for and with AI: MCP Apps (interactive UIs inside AI chats), generative UI, streaming chat interfaces, agent-friendly websites, AI coding workflows (AGENTS.md, DevTools MCP), and security for embedded UIs. Use when building chat UIs, AI features, MCP servers with UI, or making sites usable by agents.
---

# AI-Native UI & Agents

## MCP Apps: your UI inside AI chats
- An official MCP extension (SEP-1865; stable 2026-01-26; included in the
  2026-07-28 spec), co-developed by Anthropic, OpenAI and the MCP-UI community.
- A tool declares a UI resource (`_meta.ui.resourceUri: "ui://..."`, MIME
  `text/html;profile=mcp-app`). The host renders it in a **sandboxed iframe**
  with bidirectional JSON-RPC: the UI can call tools and send messages back.
- Use for dashboards, forms, pickers and multi-step flows where text is clumsy.
  Supported by Claude, ChatGPT and others; check host support.
- Security: least-privilege capabilities, no secrets in the iframe, validate
  every message, CSP. Treat the UI as untrusted, like any third-party integration.

## Chat & streaming UX patterns
- Stream tokens; render markdown incrementally without layout jumps (reserve
  space, avoid re-parsing everything per token).
- Show tool activity and progress; allow stop, retry and edit.
- Use `aria-live="polite"` on the message log, but announce completed messages, not
  every token. Keep the input focused and support keyboard shortcuts.
- **Optimistic sends** plus offline queueing for flaky networks.

## Generative UI
A model chooses or composes components from a **constrained catalog** (your
design system) instead of free-form HTML: structured output (JSON schema) mapped
to vetted components. It's safer, on-brand and accessible.

## Agent-friendly websites
Semantic HTML, real links and forms, descriptive labels, stable URLs, structured
data (JSON-LD), and no critical content locked behind client-only rendering. The
same practices serve screen readers, search engines and AI agents.

## AI-assisted development
Next.js 16.2 supports AGENTS.md and DevTools MCP so coding agents can read
logs and the DOM. Give agents skills, tests to run, and
screenshots to compare. This kit's Playwright suite works as an agent feedback loop.

## Exercises
1. Build an MCP App that shows a tool's options as buttons and sends the choice back.
2. Build a streaming chat log component with proper live-region behaviour.
3. Define a JSON schema for "cards" that a model can fill and render with the kit's CSS.

Part of `kits/advanced-web-ui-kit`. Code paths in this skill (such as `code/...`) are relative to that folder.
