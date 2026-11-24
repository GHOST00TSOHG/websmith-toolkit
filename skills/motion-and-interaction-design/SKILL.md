---
name: motion-and-interaction-design
description: UI motion and micro-interactions with platform APIs: view transitions (same- and cross-document, shared elements, view-transition-class/types), scroll-driven animations, @starting-style entry/exit, spring easing via linear(), Web Animations API, FLIP, gesture feedback and reduced-motion design. Use when adding animation or polish to interfaces.
---

# Motion & Interaction Design for the Web

Reference: theme-toggle circular reveal (`app.js`), cross-document transition
(`styles.css` + `about.html`), scroll reveal and dialog entry/exit.

## Principles (UI-specific)
Motion explains change: where something came from and where it went. Keep it
fast (100–300 ms for UI, enter slower than exit), use easing that decelerates
into rest, choreograph (stagger 20–40 ms), and never block input.

## View transitions
- Same-document: `document.startViewTransition(update)`; style
  `::view-transition-old/new(name)`. Shared-element morphs: give matching
  elements the same `view-transition-name`.
- **Cross-document:** `@view-transition { navigation: auto; }` on both pages.
  Persistent header: `view-transition-name: site-header`.
- `view-transition-class` styles many elements at once; transition **types** let
  you vary animations by navigation direction. React 19.2 integrates View Transitions.

## Scroll-driven animations
`animation-timeline: view()` (element visibility) or `scroll()` (container
progress), with `animation-range: entry 0% cover 30%`. They run off the main thread,
so they're smooth. Uses: reveals, progress bars, parallax, sticky header shrink.

## Entry/exit for top-layer UI
`@starting-style` defines the "before" state; transition `display` and
`overlay` with `allow-discrete` so dialogs and popovers animate out too.

## Springs without JS
`linear()` easing can encode a sampled spring curve:
`transition-timing-function: linear(0, 0.6 15%, 1.08 35%, 0.98 55%, 1)`.
Generate the points by sampling a damped spring in a script.
For gesture-driven physics use WAAPI or a library (Motion).

## Reduced motion
`prefers-reduced-motion: reduce` swaps movement for fades or instant changes
rather than removing feedback. The kit tests this in a real browser.

## Exercises
1. Shared-element transition: a palette card expands into a detail page across documents.
2. Sample an underdamped spring (damping ratio 0.4) in Python, emit a `linear()` easing, and use it on buttons.
3. Scroll-progress bar using `animation-timeline: scroll(root)`.

Part of `kits/advanced-web-ui-kit`. Code paths in this skill (such as `code/...`) are relative to that folder.
