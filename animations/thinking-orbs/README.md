# ThinkingOrbs

Dotted, honestly-3D “thinking” indicators for AI and agent interfaces. Nine hand-tuned designs, each at two sizes (regular 64px / small 20px), light and dark.

## Sources and license

| What | Where | License |
| --- | --- | --- |
| Original engine (canvas / React) | https://github.com/Jakubantalik/thinking-orbs — npm `thinking-orbs@0.3.2` | MIT, Copyright 2026 Jakub Antalik |
| SwiftUI port | https://github.com/haplollc/ThinkingOrbs | MIT, Copyright 2026 Haplo LLC and Jakub Antalik |
| Live demo of the JS library | https://orbs.jakubantalik.com | — |

See `NOTICE`, `LICENSE-thinking-orbs`, and `LICENSE-ThinkingOrbs`. A different library with a similar name, [@yogesharc/thinking-orbs](https://github.com/yogesharc/thinking-orbs), is not this one.

## The nine designs

| Design | Code (JS / Swift) | What it does | Use it when |
| --- | --- | --- | --- |
| Working | `working` / `.working` | Particles running on tilted ghost orbits | General-purpose busy |
| Searching | `searching` / `.searching` | A scan meridian sweeps a dotted globe | Web search, retrieval, lookups |
| Solving | `solving` / `.solving` | Latitude bands scramble in quarter-turns, then click back to solved | Reasoning, math, code |
| Listening | `listening` / `.listening` | A waveform rolls through the latitude rings | Voice input, transcription |
| Connecting | `connecting` / `.connecting` | A constellation wires itself; packets run the edges | Tool calls, APIs, sync |
| Weaving | `weaving` / `.weaving` | Three strands plait around the sphere | Planning, multi-step agents |
| Composing | `composing` / `.composing` | An undulating multi-band sash on a great circle | Writing a reply |
| Breathing | `breathing` / `.breathing` | A face-on ring slowly morphing | Idle thinking, waiting on a model |
| Shaping | `shaping` / `.shaping` | Dotted outline: circle → triangle → square | Design, image and layout work |

Eight designs are real 3D forms (rotated, depth-shaded, z-sorted). Shaping is a 2D morphing outline. Everything is grayscale dots (plus lines for Connecting), so it sits on light or dark UI.

The two sizes are **separate tunings**, not one design scaled: small uses fewer, bigger dots and its own tempo so it stays legible next to text.

## What’s in this folder

- `demo.html` — all nine designs, both sizes, light/dark, status chips. No network.
- `vendor/thinking-orbs-engine.js` — local IIFE of the 0.3.2 engine, used by the demo.
- `vendor/thinking-orbs-0.3.2/` — the published npm package (source of that engine).
- `HOW-TO-MAKE.md` — how the engine is built, timing, math, and a recipe for new variants.
- `NOTICE` and the `LICENSE-*` files — upstream copyright and MIT terms.

Open `demo.html` in a browser; it runs offline.

## Drop one into a web project

```bash
npm install thinking-orbs
```

```tsx
import { ThinkingOrb } from "thinking-orbs";

function Status() {
  return <ThinkingOrb state="searching" size={64} />;
}
```

`size` is `64` or `20`. Optional: `theme="auto" | "dark" | "light"`, `speed`, `paused`, `aria-label`.

To drive your own renderer (no React), import the pure geometry entry:

```js
import { resolvePreset, MODE_FRAMES, paintFrame } from "thinking-orbs/engine";

const { mode, speed, opts } = resolvePreset("searching", 64);
const frame = MODE_FRAMES[mode](64, elapsedSeconds * speed, opts);
paintFrame(ctx, frame, /* dark */ false);
```

The demo does exactly that, against the vendored IIFE. Copy `vendor/thinking-orbs-engine.js` plus the canvas loop in `demo.html` if you want a no-bundler drop-in. Keep the MIT copyright notice. Do not load the engine from a CDN.

## Drop one into a SwiftUI project

In Xcode: File → Add Package Dependencies, paste `https://github.com/haplollc/ThinkingOrbs` (iOS 17+, macOS 14+, and the other Apple platforms in `Package.swift`).

```swift
import SwiftUI
import ThinkingOrbs

struct AssistantStatus: View {
    var body: some View {
        ThinkingOrbLabel("Searching the web…", design: .searching)
        // or a bare orb:
        // ThinkingOrb(.working)
        // ThinkingOrb(.working, size: .small)
    }
}
```

`ThinkingOrbLabel` puts the orb beside a shimmering status line. `.thinkingShimmer()` is also available as a text modifier.
