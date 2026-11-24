---
name: web-platform-state-2026
description: Researched map of where web and UI development stands as of November 2026 (browser features, Interop 2026, frameworks and build tools, accessibility law, design tokens, WebGPU, AI-native UI), with sources. Use when choosing a stack or feature, checking whether something is safe to ship, or planning what to learn.
---

# State of the Web Platform (researched November 2026)

Re-verify version-specific claims on webstatus.dev, MDN, caniuse and vendor blogs before relying on them.

## Browser platform
- **Interop 2026** (Apple, Google, Igalia, Microsoft, Mozilla; announced Feb 2026)
  has 20 focus areas, 15 of them new. They include anchor positioning, container
  style queries, dialog and popover (`closedby`, `popover="hint"`), scroll-driven
  animations, view transitions (including **cross-document**), scroll snap,
  `contrast-color()`, `shape()`, the Navigation API, WebTransport, IndexedDB, and
  media pseudo-classes (`:playing`, `:paused`...).
- Interop 2025 took the overall score from 25 to 95, and brought same-document view
  transitions, anchor positioning, the Navigation API, `@scope` and URLPattern to
  every engine.
- **Baseline 2026:** container *style* queries became newly available (May
  2026); scroll-driven animations, relative color syntax, `@starting-style` and
  `field-sizing` reached cross-browser support during 2026.
- **Customizable `<select>`** (`appearance: base-select`) ships in Chromium and
  is coming in Safari 27. It isn't Baseline yet, so use it behind
  `@supports`.
- **State of CSS 2026** (4,902 respondents): anchor positioning was the favorite
  new feature and had the biggest usage jump; `:has()`, `aspect-ratio` and nesting
  are the most used and loved.
- **WebGPU** is supported in Chrome, Edge, Firefox and Safari (Safari 26,
  Firefox 141+ on Windows, with more platforms rolling out).
- Coming next: native CSS mixins (`@mixin`/`@apply`), gap decorations, masonry
  layout, reading-flow.

## Frameworks and tooling
- **React 19.2** (`<Activity>`, `useEffectEvent`, View Transitions) and **React
  Compiler 1.0** (automatic memoization). **Next.js 16** (Oct 2025; 16.2 in March 2026):
  Turbopack is the default bundler, Cache Components replace PPR via `"use cache"`,
  middleware is renamed proxy, and it adds AGENTS.md support and DevTools MCP for AI-assisted debugging.
- **Vite 8** (March 2026) uses **Rolldown** (a Rust bundler) for both dev and prod,
  with Oxc for transforms and Lightning CSS for minification; Vite 8.1 followed in
  June 2026. The JavaScript toolchain is consolidating on Rust.

## Accessibility & law
- The **European Accessibility Act** has been enforceable since 28 June 2025.
  **EN 301 549 v4.1.1** (published 2 Sept 2026) moves the baseline to **WCAG 2.2
  AA**; it gives a legal presumption of conformity once cited in the EU Official
  Journal. Target WCAG 2.2 AA now.

## Design systems
- The **Design Tokens spec reached its first stable version (2025.10)**, with Format,
  Color and Resolver modules. Use one JSON source of truth for web, iOS and Android.

## AI-native UI
- **MCP Apps** (SEP-1865, stable 2026-01-26, part of the 2026-07-28 MCP release)
  let tools return interactive HTML UIs that render in sandboxed iframes inside AI
  chats (Claude, ChatGPT and others). It's a merger of MCP-UI and OpenAI's Apps SDK.

## Sources
- Interop 2026 (web.dev): https://web.dev/blog/interop-2026
- Launching Interop 2026 (Mozilla): https://hacks.mozilla.org/2026/02/launching-interop-2026/
- Baseline digest May 2026: https://web.dev/blog/baseline-digest-may-2026
- State of CSS 2026: https://2026.stateofcss.com/
- Customizable select (Chrome): https://developer.chrome.com/blog/a-customizable-select
- WebGPU in major browsers: https://web.dev/blog/webgpu-supported-major-browsers
- Next.js 16: https://nextjs.org/blog/next-16
- Vite 8: https://vite.dev/blog/announcing-vite8
- Design Tokens 2025.10: https://www.designtokens.org/TR/2025.10/
- EN 301 549 v4.1.1 (Deque): https://www.deque.com/blog/en-301-549-v4-1-1-is-final-what-changed-what-it-means-and-what-you-should-do/
- MCP Apps: https://blog.modelcontextprotocol.io/posts/2026-01-26-mcp-apps/

Part of `kits/advanced-web-ui-kit`. Code paths in this skill (such as `code/...`) are relative to that folder.
