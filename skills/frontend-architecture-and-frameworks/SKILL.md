---
name: frontend-architecture-and-frameworks
description: Choosing and architecting frontend stacks in 2026: rendering strategies (SSR, SSG, streaming, islands, RSC), React 19.2 + React Compiler, Next.js 16 Cache Components, Vite 8/Rolldown, Astro, Svelte 5, signals, web components, state, data fetching, testing and monorepos. Use when starting a project, picking a framework, or restructuring an app.
---

# Frontend Architecture & Frameworks

## Choose by content, not hype
| Site type | Good default |
|---|---|
| Content/marketing/docs | **Astro** (islands: zero JS by default) or plain HTML + CSS |
| App with SEO + dynamic data | **Next.js 16** (React Server Components) or SvelteKit / Nuxt |
| Highly interactive client app | **Vite 8** + React/Svelte/Vue/Solid SPA |
| Widgets embedded anywhere | **Web components** (framework-agnostic custom elements) |
| Old devices / no-JS | Server-rendered HTML forms (see progressive-enhancement skill) |

## Rendering strategies
Static (SSG) → incremental revalidation → server render (SSR) → **streaming**
with Suspense → **Server Components** (no client JS for server-only parts) →
client islands for interactivity. Ship the least JavaScript that does the job.

## React in 2026
- **React 19.2:** `<Activity>` (keep hidden UI alive, pre-render), `useEffectEvent`,
  View Transitions integration, Actions + `useActionState` / `useOptimistic` for forms.
- **React Compiler 1.0** memoizes automatically, so you rarely need hand-written
  `useMemo`/`useCallback`. It's stable in Next 16 (opt-in) and in Vite via a preset.
- **Next.js 16:** Turbopack default; **Cache Components** with `"use cache"`
  directives; `revalidateTag` / `updateTag` / `refresh`; `proxy.ts` (formerly
  middleware); async `params`/`searchParams`.

## Tooling
- **Vite 8** uses Rolldown + Oxc (Rust) for one bundler in dev and prod, with Lightning
  CSS minification and built-in tsconfig paths.
- TypeScript everywhere (strict), Biome or ESLint + Prettier/Oxfmt, Vitest +
  Playwright, pnpm workspaces or Turborepo/Nx for monorepos.

## State & data
Server state goes in a cache (TanStack Query, RSC fetch cache); URL state goes in search
params; local UI state stays in components. Global stores (Zustand, signals) are for
genuinely shared client state. **Signals** (Solid, Svelte 5 runes, Preact, Angular;
TC39 proposal) give fine-grained reactivity.

## Web components done well
Use light-DOM custom elements for progressive enhancement (`<ui-tabs>` wraps
plain HTML). Use shadow DOM for encapsulated widgets, styled through `::part()` and
custom properties. Declarative Shadow DOM allows SSR.

## Exercises
1. Rebuild the showcase page in Astro with `<ui-tabs>` as an island.
2. Port the theme toggle to a React 19 component using `useOptimistic` and measure
   the bundle with and without the compiler.
3. Add Playwright component tests for `<ui-tabs>` in a Vite 8 project.

Part of `kits/advanced-web-ui-kit`. Code paths in this skill (such as `code/...`) are relative to that folder.
