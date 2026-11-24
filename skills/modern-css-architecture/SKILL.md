---
name: modern-css-architecture
description: Architecting CSS with 2026 platform features: cascade layers, nesting, @scope, container size and style queries, :has(), anchor positioning, popover, dialog, view transitions, scroll-driven animations, @starting-style, OKLCH and relative colors, light-dark(), customizable select, fluid type and progressive enhancement with @supports. Use when writing or reviewing any stylesheet or replacing JS UI libraries with native CSS/HTML.
---

# Modern CSS Architecture

Reference: `code/site/styles.css` (every technique below is used there and tested
in `tests/test_site_e2e.py`).

## Structure
- **Cascade layers:** `@layer reset, base, layout, components, utilities;`
  Order beats specificity, so utilities always win without `!important`. Import
  third-party CSS into a low layer: `@import url(x.css) layer(vendor);`.
- **Nesting** with `&` for co-located states; keep nesting 2–3 levels deep.
- **`@scope (.card) to (.content)`** limits selectors to a subtree (donut scope).
  It scopes selectors, not inheritance.
- **Private custom properties** (`--_bg`) for component internals; public tokens
  (`--semantic-*`) for the API.

## Responsive without media queries
- **Container queries:** `container: card / inline-size;` then
  `@container card (inline-size > 30rem)`. Components adapt to their slot.
  **Style queries** `@container style(--variant: compact)` are Baseline (May 2026).
- Intrinsic grids: `repeat(auto-fit, minmax(min(18rem, 100%), 1fr))`.
- Fluid type with `clamp()`; `lh`/`rlh` units for rhythm; `dvh` for mobile viewports.

## Logic in CSS
- **`:has()`** gives parent and state selection (`.card:has(input:checked)`,
  `form:has(:user-invalid)`, `body:has(dialog[open])`).
- `:user-invalid` shows errors only after interaction.

## Native components (fewer JS libraries)
- **Popover API** (`popover`, `popovertarget`) gives top layer, light dismiss and focus
  return for free. **Anchor positioning** places it: `anchor-name`,
  `position-anchor`, `position-area`, `position-try-fallbacks: flip-block`.
- **`<dialog>` + `showModal()`** gives focus trap, inert background and Escape;
  `closedby="any"` adds light dismiss (Interop 2026).
- **Customizable select:** `select, ::picker(select) { appearance: base-select }`
  inside `@supports`, so it falls back to the OS select.
- **Animating to/from `display:none`:** `@starting-style` +
  `transition-behavior: allow-discrete` on `display`/`overlay`.
- `interpolate-size: allow-keywords` animates to `height: auto`.

## Color
- Author in **OKLCH**. Derive states with **relative color**
  (`oklch(from var(--c) calc(l - 0.06) c h)`) and mix with
  `color-mix(in oklch, ...)`. Use `light-dark(a, b)` + `color-scheme` for themes,
  `contrast-color()` (Interop 2026) for automatic text color, and `in oklch`
  gradient interpolation to avoid muddy middles.

## Progressive enhancement rule
Base experience first. Wrap new features in `@supports (...)`, keep the HTML
semantic, and never hide content behind an unsupported feature.

## Exercises
1. Replace a JS dropdown menu with popover + anchor positioning + `:popover-open` styles.
2. Add a `compact` variant using container style queries.
3. Write the `@scope` version of `.card` and compare specificity in DevTools.

Part of `kits/advanced-web-ui-kit`. Code paths in this skill (such as `code/...`) are relative to that folder.
