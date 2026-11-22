# How the ThinkingOrbs animations are made

These are not CSS or Lottie animations. Each frame is **procedural 3D (or 2D) geometry** turned into a list of grayscale dots — and, for Connecting, line segments — then drawn as plain canvas circles. No WebGL, no `ctx.filter`, no SVG filters. The SwiftUI port draws the same lists with `Canvas`.

The source of truth is `src/engine/` in [Jakubantalik/thinking-orbs](https://github.com/Jakubantalik/thinking-orbs). Haplo’s Swift files `Sources/ThinkingOrbs/Engine/OrbEngine.swift` and `OrbPresets.swift` in [haplollc/ThinkingOrbs](https://github.com/haplollc/ThinkingOrbs) are a port of that engine, not a re-design. This folder vendors the published 0.3.2 web engine in `vendor/`.

## Pipeline

Every tick, for each mounted orb:

1. Resolve `(state, size)` once to a **mode key**, a **speed**, and a bag of **opts** (`resolvePreset` in `src/presets.ts`).
2. Advance a shared clock: `t = (performance.now() / 1000) * speed * userSpeed`. Every orb on screen stays in phase because they all read `performance.now()`, not their own start time.
3. Call the mode’s frame function: `(size, t, opts) → { dots, lines }`. Each dot is `{ x, y, z, r, white, a? }`. `white` is ink on paper: `0` is darkest.
4. `finalizeFrame` drops marks with alpha < 0.02, clamps radius to a floor (`rMin`, usually 0.3), and **z-sorts far → near**.
5. `paintFrame` strokes lines first, then fills dots. On a dark background the ink is mirrored (`1 - white`) so near dots read bright. The same depth language, inverted substrate.

Reduced motion skips the clock and paints one deterministic frame at `t = 0.6`. Offscreen and hidden-tab instances pause and resume in phase.

There are almost no CSS keyframes in the orbs themselves. The only CSS animation in `demo.html` is the status-label shimmer (a sliding gradient on the text). Timing lives in the frame functions and the preset speed multipliers.

## Shared math

**Camera** (`makeProj(yaw, tilt, cx, cy, scale)` in `core.ts`): yaw around Y, then tilt around X, then orthographic projection.

```
x1 =  x * cos(yaw) + z * sin(yaw)
z1 = -x * sin(yaw) + z * cos(yaw)
y1 =  y * cos(tilt) - z1 * sin(tilt)
z2 =  y * sin(tilt) + z1 * cos(tilt)
→ [cx + x1 * scale, cy - y1 * scale, z2]
```

Most modes pass `yaw` as a multiple of `t` (a slow tumble) and a small fixed or gently breathing `tilt`. Depth `z2` is kept, not thrown away.

**Depth language.** After projection, `depth = (z / R + 1) / 2` (or `(z + 1) / 2` when the projector already baked in the radius). Near dots are larger (`rBase + rDepth * depth`) and heavier (`inkFar - inkSpan * depth`). That is the whole “3D” look: size + ink + painter’s algorithm. No lighting model, no perspective.

**Radius vs canvas size.** Dot radii were tuned for a 300pt frame. They scale sub-linearly: `radiusScale(size, pow) = (size / 300) ** pow` with `pow` default 0.6, so a 20px orb does not collapse into dust.

**Sphere sampling.** Even point sets on a sphere use a Fibonacci lattice (`fibDir`): golden-angle spiral, `y = 1 - 2*(i+0.5)/n`. Latitude/longitude modes instead walk rings, with longitude count `round(|cos(lat)| * lonDensity)` so poles are not overcrowded.

**Cheap noise.** `hashD(a, b)` is a deterministic sine-hash in `[0, 1)`. `vnoise` is value noise on a 2D lattice with a smoothstep fade (`x*x*(3-2x)`). Used so Connecting’s nodes wander and so orbit planes are stable (not random each frame).

**Angle wrap.** `angleDelta` is `atan2(sin(a-b), cos(a-b))`, the shortest signed difference, used by the search meridian.

## Two sizes, not a scale factor

`BASE_PROFILES` in `profiles.ts` are the “fine” (dense) tunings. Each shipped preset then applies:

- `count` — total-dot multiplier. Lattice pairs (`latRings` × `lonDensity`, `lanes` × `segs`) each take `√count` so the product scales by `count`. Flat lists (`orbitN`, `nodeN`, …) scale linearly. A value of `0` means “this layer is off” and must stay off (Breathing has no ghost sphere).
- `size` — multiplies every radius key (`rBase`, `rDepth`, `partR`, …).
- `speed` — multiplies the shared clock for that mode.
- `extra` — mode-specific overrides merged last (`scanMul`, `faceOn`, `spin: 0`, …).

Regular (64) is dense and relatively slow. Small (20) uses a much lower `count`, a higher `size` (bigger dots), and often a higher `speed`, so a 20px orb still reads as the same verb.

Preset speeds (64 / 20): working 1.885 / 3.9, searching 2.015 / 2.665, solving 1.82 / 1.95, listening 4.388 / 3.998, connecting 3.315 / 6.63, weaving 1.625 / 2.75, composing 2.34 / 3.12, breathing 3.24 / 3.78, shaping 2.405 / 2.08.

## The nine designs

Mode keys in the engine are older names; the public API uses verbs. Mapping: working→`orbits`, searching→`globe`, solving→`rubik`, listening→`wave`, connecting→`web`, weaving→`braid`, composing→`ribbon`, breathing→`ring` (same painter as ribbon), shaping→`morph`.

Times below are in the mode’s own `t` (already multiplied by preset speed) unless noted.

### 1. Working — `orbits.ts`

Particles on tilted ghost orbits. No nucleus.

- Camera: `yaw = t * 0.12`, tilt `0.3`, sphere radius `0.82 * size/2`.
- `orbitN` tilted circles (12 at the fine profile). Each orbit gets a stable hashed radius (`0.45R–0.97R`) and a random plane: normal from hashed spherical coordinates, then an orthonormal basis `(u, v)` in that plane.
- The **ghost path** is `ghostN` faint dots around the circle. Alpha is weaker in back (`0.4 + 0.6 * depth`).
- **Particles** (3 per orbit) run `angle = t * speed + even spacing + hashed phase`. Per-orbit `speed` is hashed too, and half the orbits run backwards. Particle radius grows with depth; ink is darker up close (`white = 0.3 - 0.22 * depth`).

### 2. Searching — `frameGlobe` in `lattice.ts`

A latitude/longitude dotted globe with a scan meridian.

- Camera: `yaw = t * 0.5`, tilt `0.4 + 0.06 * sin(t * 0.35)` (a slight nod).
- Dots sit on the unit sphere, `latRings × lonDensity`.
- The scan angle is `t * (spin + (1.7 - spin) * scanMul)`. Presets push `scanMul` to ~4 so the meridian races the spin. For each dot, `d = angleDelta(lon + t*spin, scan)` and `boost = exp(-(d²) / 0.18) * max(0, z)` — a Gaussian ridge, front-facing only, read as a **size ripple**, not a highlight.
- `dimBase` (0.45 in the shipped presets) fades unswept dots so the meridian pops: `alpha = dimBase + (1 - dimBase) * min(1, boost)`.

### 3. Solving — `frameRubik` in `lattice.ts`

Same lat/long sphere, but slabs of it twist like a 3-axis Rubik cube, then unwind.

- Camera: `yaw = t * 0.55`, tilt `0.35 + 0.1 * sin(t * 0.9)`.
- `moveCount` (14) predetermined moves, hashed once: axis `0|1|2`, a slab `[lo, lo+0.5]` on that axis, and a ±90° turn (`π/2`).
- **Cycle** (`solveCycle`): `slotDur = 0.42`, `rest = 1.2`. Scramble all moves in order, then replay them in reverse (a palindrome), then sit solved during the rest. Cycle length `2 * 14 * 0.42 + 1.2 = 12.96s` of mode-time (~7.1s of wall time at speed 1.82).
- Easing inside a slot: the move finishes in the first 70% (`cl = min(1, p / 0.7)`), then holds. Ease-out is cubic, “machine” feel: `1 - (1 - cl)³`.
- `applyMoves` rotates a point through every move whose slab contains it, in order. The active slab’s dots ink a touch darker and slightly larger — the “hand” on the band.

### 4. Listening — `frameWave` in `lattice.ts`

Latitude rings breathe like a waveform.

- Camera: `yaw = t * 0.18` (slow), tilt `0.38`. Radius is `0.874 * size/2` so that after the inward undulation it matches the other lattices.
- Two incommensurate sines, phase-shifted by ring index so the wave travels:  
  `w = 0.62 * sin(t * 2.1 - ri * 0.52) + 0.38 * sin(t * 1.27 + ri * 0.83)`
- Each ring’s radius is `R * (0.88 + 0.105 * w)`. Crests also bump dot size (`× (1 + 0.4 * max(0, w))`) and darken ink a little.

### 5. Connecting — `web.ts`

A constellation that rewires itself. The only mode that draws lines.

- Camera: `yaw = t * 0.12`, tilt `0.32`, radius `0.8 * size/2`.
- `nodeN` points start on a Fibonacci sphere, then wander with value noise (amplitude 0.3, temporal frequencies ~0.21–0.27) and are **renormalised** back onto the unit sphere.
- Every pair closer than `thr` (0.72, unit-sphere chord length) grows an edge. Line alpha is `(1 - dist/thr) * (0.3 + 0.55 * mid-depth)`.
- Nodes pulse: `1 + 0.25 * sin(t * 1.4 + i * 2.7)`.
- At the 20px preset, `nodeN` falls to 8 and those points usually sit farther than `thr`, so the small Connecting orb is mostly pulsing nodes and packets, not a dense web. That is the shipped tuning, not a bug.
- `signals` (5) bright packets: each second of `t * 0.55 + s * 7.31` re-picks a node pair via `hashD`, then the packet lerps along the chord and is projected back onto the sphere (`frac` of that interval is the position). Ink is almost black (`white = 0.05`) so they read as sparks.

### 6. Weaving — `braid.ts`

Three helical strands plait around a faint ghost sphere.

- Camera: `yaw = t * 0.4`, tilt `0.3`, radius `0.76 * size/2`.
- Ghost: `ghostN` Fibonacci dots, very faint.
- Each of 3 strands has phase `s/3 * 2π`. Parameter `u` walks pole to pole, and `frac(i / strandN + t * 0.045)` slowly slides the whole strand along itself.
- Helix: `a = u * π * turns + phase` with `turns = 3`, radius in the xz-plane is `sqrt(1 - u²)` (a sphere).
- **Plait:** a radial breathe `1 + 0.075 * sin(u * π * turns * 2 + phase * 2 + t * 0.8)` makes strands trade places (over/under). Alpha fades in the last 10% toward each pole so the ends do not clump.

### 7. Composing — `ribbon.ts` with `spin: 0`

An undulating sash of parallel lanes on a great circle.

- The painter supports a 3D tumble (`spin`), but the shipped preset sets `spin = 0`, so the band’s orientation is frozen and only the wave travels.
- A band plane is built from basis vectors `u, v` and normal `n = u × v`. `bandMul` 3.9 turns the base 5 lanes into 20; `segs` is 88 samples around the loop.
- Two traveling waves along the band:  
  `wob = (0.16 * sin(a*3 - t*1.7 + w*0.22) + 0.07 * sin(a*5 + t*1.1)) * wobMul`
- For the sash, that wobble is an **out-of-plane offset**. The point is then renormalised onto the sphere, so the silhouette stays at radius `R` and the deformation can only pull dots inward — a ribbon lying on a globe. Outer lanes are slightly smaller and lighter (`edge` term). A faint Fibonacci ghost sphere sits behind.

### 8. Breathing — same `ribbon.ts`, `faceOn: 1`

A face-on ring that slowly morphs. Same painter, different flags:

- `ghostN = 0` (no sphere behind it).
- `spin = 0`.
- `faceOn` sets the band’s tilt to `-camTilt` so the projection is a true circle, not a tilted ellipse.
- The wobble modulates **in-plane radius** (`radial = 1 + wob`) instead of out-of-plane offset, so lobes swell out and pinch in.
- Base radius is pre-shrunk, `R / (1 + 0.85 * wobAmp)`, so the silhouette stays inside the frame. `wobMul` is lower than composing’s (0.368 at 64) — a slower, subtler breathe. `bandMul` ~3.6 still packs many lanes into a thick ring.

### 9. Shaping — `morph.ts`

The only non-3D design: a dotted 2D outline cycling circle → triangle → square.

- Each shape is a closed path parameterised by **arc length**, starting at top-centre, going clockwise. The square is a 5-vertex walk so it also starts at the top midpoint, not a corner.
- Timeline, per shape: **hold 1.4s**, **morph 0.9s**. Three shapes → 6.9s of mode-time per loop (~2.9s of wall time at speed 2.405).
- Morph ease is a smoothstep, `x * x * (3 - 2x)` (same cubic used in `vnoise`). During a hold, blend factor `m = 0`.
- Method: blend the two neighbouring paths at 160 sample parameters, measure the blended outline’s arc length, then place `n` dots **evenly along that length**. Spacing stays uniform at every instant, mid-morph included. Do not lerp dot indices; lerp the path, then resample.
- A tiny uniform pulse, `1 + 0.02 * sin(local * 3.1)`, makes a formed shape breathe. Radius comes from `rDot`, not from the count. `spread` (1.45 in the presets) scales the whole outline.

## Recipe: making a new variant

You usually do not need a new mode. Try this order:

1. **Retune an existing verb.** Fork the `(state, size)` preset: change `speed`, `count`, `size`, and `extra` (`scanMul`, `wobMul`, `bandMul`, `turns`, `signals`, `thr`, `spread`, …). Always retune 64 and 20 separately. Preview both themes. Check reduced-motion at `t = 0.6`.
2. **New verb, old geometry.** Add a `STATE_TO_MODE` entry that points at an existing mode (Breathing is already Ribbon with flags). Put the flags in `BASE_PROFILES` / `PRESETS.extra`. This is how you get a “searching, but slower meridian” or a “ribbon that still tumbles” (`spin: 1`) without new math.
3. **New geometry.** Add `frameMyMode(size, t, opts)` in `src/engine/`:
   - Build points in 3D (or a 2D path for an outline mode).
   - Run them through `makeProj` (or a screen mapping, like morph).
   - Encode depth in `r` and `white` with the same near-is-larger, near-is-darker convention.
   - Push `Dot`s (and `Line`s if you need edges), then `return finalizeFrame(dots, lines, opts.rMin)`.
   - Register it in `MODE_FRAMES` (`registry.ts`). Add a base profile and two size presets.
   - Keep it monochrome. Colour would fight the light/dark ink mirror.
   - Prefer a closed cycle or a palindrome (see Solving) if the motion should “resolve” rather than drift forever.
   - Drive everything from `t` and hashed indices, never `Math.random()`, so instances stay in phase and tests can freeze a timestamp.
4. **Drop it in.** Web: `resolvePreset` + `MODE_DRAWS[mode](ctx, size, t * speed, dark, opts)` as in `demo.html`, or `<ThinkingOrb state="…" />` once the state is on the public type. Swift: port the frame function into `OrbEngine.swift` the same way Haplo did, add a case on `OrbDesign`, and a row in `OrbPresets.swift`. The portable contract is the finished `OrbFrame` list — a port should draw the list, not re-invent the painter’s algorithm differently.

A good new “thinking” orb is a short verb (what the agent is doing), readable at 20px, silent on both themes, and cheap: a few hundred dots, a handful of trig calls, one sort.
