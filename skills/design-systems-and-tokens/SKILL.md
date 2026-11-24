---
name: design-systems-and-tokens
description: Building design systems with the stable DTCG 2025.10 design token format: token tiers, aliases, theming (light/dark, brands), OKLCH palette generation, accessible color pairing, typography and spacing scales, and token pipelines to CSS and native platforms. Use when creating or scaling a design system, theming, or turning Figma variables into code.
---

# Design Systems & Design Tokens

Reference: `code/tools/tokens.py` (DTCG → CSS), `code/tools/color.py`
(palettes and contrast), token sources in `code/site/tokens/`.

## The DTCG 2025.10 format (first stable version, Oct 2025)
```json
{ "color": { "$type": "color",
    "brand": { "500": { "$value": { "colorSpace": "oklch", "components": [0.62, 0.18, 285] } } } },
  "space": { "$type": "dimension", "4": { "$value": { "value": 1, "unit": "rem" } } },
  "semantic": { "primary": { "$type": "color", "$value": "{color.brand.500}" } } }
```
- `$value`, `$type` (inherited from groups), `$description`; aliases `{a.b.c}`.
- Types: color (object with colorSpace + components), dimension and duration
  (`{value, unit}`), fontFamily, fontWeight, number, cubicBezier, and composites
  (shadow, typography, border, transition, gradient).
- Modules: Format, Color, **Resolver** (sets + modifiers for themes and brands).

## Token tiers
1. **Primitive / reference:** raw palette and scales (`color.brand.500`).
2. **Semantic / system:** intent (`semantic.primary`, `semantic.text-muted`),
   which differs per theme.
3. **Component:** optional (`button.bg`), aliases semantic tokens.
Components consume only semantic or component tokens. Changing a theme should never
touch component CSS.

## Theming
The kit's build emits `light-dark(a, b)` for tokens that differ between themes,
and keeps `var(--alias)` references when both themes alias the same token. One
stylesheet serves both themes and `[data-theme]` can force one. For brands and
density, use resolver modifiers or `@container style()` variants.

## Color system
- Generate tonal scales in OKLCH at constant hue with perceptually even
  lightness; taper chroma at the extremes and gamut-map into sRGB
  (`tonal_palette`). Consider Display-P3 for vivid accents (`@media (color-gamut: p3)`).
- Pair text and background by contrast: WCAG 2.2 ratio is the legal baseline
  (4.5 body text, 3 large text and UI); APCA Lc as a perceptual second opinion
  (`apca_lc`). The kit's test suite checks every semantic pair in both themes.

## Pipeline
Figma Variables → DTCG JSON (export plugin or Tokens Studio) → build
(Style Dictionary v4+, Terrazzo, or `tools/tokens.py`) → CSS, iOS, Android
outputs → visual regression tests. Version tokens like code and publish changelogs.

## Exercises
1. Add a "high contrast" theme as a third file and emit it under
   `@media (prefers-contrast: more)`.
2. Extend `tools/tokens.py` with the `border` and `transition` composite types.
3. Generate a P3 variant of the brand palette and compare it on a wide-gamut screen.

Part of `kits/advanced-web-ui-kit`. Code paths in this skill (such as `code/...`) are relative to that folder.
