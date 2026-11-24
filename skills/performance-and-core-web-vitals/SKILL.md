---
name: performance-and-core-web-vitals
description: Web performance engineering: Core Web Vitals (LCP, INP, CLS) thresholds and measurement, loading strategy (fetchpriority, preload, speculation rules, bfcache), images and fonts, JavaScript cost and main-thread scheduling, CSS containment and content-visibility, caching and CDNs. Use when a site feels slow, before launch, or when optimizing SEO.
---

# Performance & Core Web Vitals

## Targets (75th percentile of real users)
- **LCP** (largest contentful paint) ≤ 2.5 s
- **INP** (interaction to next paint) ≤ 200 ms
- **CLS** (cumulative layout shift) ≤ 0.1
Measure in the field (RUM: the `web-vitals` library, CrUX), then debug in the lab
(DevTools Performance panel, Lighthouse, WebPageTest).

## LCP
- Make the LCP element discoverable in the HTML (no lazy-loading it, no JS-only render).
- `<img fetchpriority="high">` for the hero; `loading="lazy"` below the fold (the
  kit's audit enforces one or the other).
- Images: AVIF/WebP, `srcset` + `sizes`, a CDN with resizing.
- Fonts: `font-display: swap`, subset, preload the critical file only, and
  fallback metric overrides (`size-adjust`) to reduce shift.
- Fast TTFB: cache HTML at the edge; stream server responses.

## INP
- Break up long tasks: `await scheduler.yield()`, chunk work, debounce.
- Do less on interaction: optimistic UI, avoid layout thrash (batch reads and writes),
  `content-visibility: auto` for long off-screen sections, CSS `contain`.
- Ship less JS (server components, islands); move heavy work to Web Workers.

## CLS
Reserve space with width/height or `aspect-ratio` on media (enforced by the
audit), no injected banners above content, transforms instead of layout
properties for animation.

## Navigation speed
- **Speculation Rules API:** `<script type="speculationrules">` to prefetch or
  prerender likely next pages (Chromium) for near-instant navigations.
- Keep pages **bfcache**-eligible (no `unload` handlers, careful with
  `Cache-Control: no-store`).
- Cross-document view transitions make MPAs feel app-like.

## Budgets
Set budgets (for example ≤ 170 KB compressed JS on mobile, LCP image ≤ 200 KB) and
enforce them in CI with Lighthouse CI or bundle-size checks.

## Exercises
1. Add the `web-vitals` library to the showcase and log INP attribution.
2. Write speculation rules that prerender `about.html` on hover.
3. Profile the theme-toggle view transition and keep it under 100 ms of main-thread work.

Part of `kits/advanced-web-ui-kit`. Code paths in this skill (such as `code/...`) are relative to that folder.
