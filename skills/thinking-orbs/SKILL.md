---
name: thinking-orbs
description: >-
  Use this when adding thinking or loading indicators for an AI or agent
  interface, on the web (canvas or React) or in SwiftUI, including new
  variants of those dotted orbs.
---
# ThinkingOrbs

Nine dotted, grayscale “the agent is busy” indicators, each at two sizes (64 and 20). Eight are real 3D forms drawn as depth-sorted dots; Shaping is a 2D morphing outline (circle → triangle → square). They sit on light or dark UI. The designs and engine are Jakub Antalik’s MIT library (`thinking-orbs`); Haplo’s package is the SwiftUI port.

Drop-in files live in `animations/thinking-orbs/`. Open `demo.html` (no CDN) to see all nine. For the math, timing, and a recipe for new variants, read `animations/thinking-orbs/HOW-TO-MAKE.md`. Keep the MIT notices in that folder when you copy the code.

## Web

```bash
npm install thinking-orbs
```

```tsx
import { ThinkingOrb } from "thinking-orbs";

<ThinkingOrb state="searching" size={64} />
<ThinkingOrb state="working" size={20} />
```

`state` is one of `working`, `searching`, `solving`, `listening`, `connecting`, `weaving`, `composing`, `breathing`, `shaping`. `size` is `64` or `20` — separate tunings, not a scale factor. Optional: `theme`, `speed`, `paused`.

For a no-React or no-bundler drop-in, copy `animations/thinking-orbs/vendor/thinking-orbs-engine.js` and follow the canvas loop in `demo.html`. Do not load the engine from a CDN. To drive your own renderer: `resolvePreset(state, size)` then `MODE_FRAMES[mode](size, elapsedSeconds * speed, opts)`.

## SwiftUI

In Xcode, File → Add Package Dependencies, paste `https://github.com/haplollc/ThinkingOrbs` (iOS 17+, macOS 14+).

```swift
import ThinkingOrbs

ThinkingOrbLabel("Searching the web…", design: .searching)
ThinkingOrb(.working, size: .small)
```

## New variants

Retune a preset, fork an existing mode with flags, or add a new frame function that returns z-sorted dots. Always tune 64 and 20 separately, keep it monochrome, and drive motion from `t` rather than `Math.random()`. Details are in `animations/thinking-orbs/HOW-TO-MAKE.md`.
