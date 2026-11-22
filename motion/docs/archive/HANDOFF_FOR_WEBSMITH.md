> **ARCHIVED (Animator's original, 2026-11-19). Superseded by [../../PLAYBOOK.md](../../PLAYBOOK.md) (and [../../WEB.md](../../WEB.md) for §10). Paths below point at the old /workspace/motion toolkit. Do not edit; do not follow where it disagrees with PLAYBOOK.md.**

# Motion pipeline handoff: for Websmith (and any builder bot)

Everything lives on the shared box under `/workspace/motion`. It is a code-driven motion-graphics pipeline:
**Remotion (React) scenes → MP4 (h264) + procedurally generated soundtrack → two-pass loudnorm mux → automated QA.**
Plus a Puppeteer HTML→MP4 fallback and a curated, license-clean Lottie library. No secrets, keys or accounts are needed
for any of it (only public npm and the public Noto CDN). Inter is bundled locally in `template/public/fonts`; renders do not need a network.

Verified working on 2026-11-19 (ET): the demo rendered and passed QA (20.0 s, 1920×1080 h264 High yuv420p 30 fps,
AAC LC 192k 48 kHz stereo, -13.9 LUFS integrated, -1.4 dBTP true peak).

---------------------------------------------------------------------------------------------------------------
## 1. Folder tree

```
/workspace/motion
├── MOTION_RULES.md          hard rules: reading time, safe zones, contrast, flashes, loudness, easing, camera, Lottie, checklist
├── STORYTELLING.md          beat recipes, transitions catalog, shared-element hand-off, camera mapping, writing
├── WORKFLOW.md              brief → story → project → render → QA → deliver (exact commands)
├── HANDOFF_FOR_WEBSMITH.md  this file
├── new.sh                   new.sh <name> → projects/<name> (template copy + symlinked node_modules)
├── scripts/
│   ├── render.sh            full pipeline for one project (tsc, audio, draft, contact sheet, final, loudnorm mux, QA)
│   └── qa.sh                ffprobe + ebur128 (-14±1 LUFS, TP ≤ -1 dBTP) + blackdetect + freezedetect; exit 1 on fail
├── template/                Remotion project (deps installed in template/node_modules)
│   ├── package.json, tsconfig.json, remotion.config.ts
│   ├── public/fonts/         Inter 4.1 woff2 (400/600/800/900) + OFL.txt; loaded via @remotion/fonts + staticFile()
│   ├── public/lottie/*.json  icons available to scenes via staticFile()
│   ├── public/audio/         soundtrack.wav is written here by render.sh
│   └── src/
│       ├── index.ts          registerRoot
│       ├── Root.tsx          registers Story-16x9, Story-1x1, Story-4x5, Story-9x16 (+ safe-zone & audio-preview props)
│       ├── timeline.json     scene timings (seconds), beats, transitions, music bpm, sfx
│       ├── handoff.json      shared-element hand-off config
│       ├── scenes/Starter.tsx  example 4-scene story (replace per project)
│       └── lib/
│           ├── tokens.ts      colors, fonts (local Inter via @remotion/fonts), type scale, easing tokens, duration tokens, spring presets
│           ├── motion.ts      sec(), progress(), tween(), lerp(), stagger(), springIn(), inOut(), readingTime(), fitsLineLength(), contrast(), rand()
│           ├── moves.tsx      SplitText, MaskReveal, Morph(+SHAPES), PinnedScrub, HorizontalRail, Parallax, Counter, PathDraw, Highlight, RollingWord, StackCards, Stage
│           ├── transitions.ts named transitions: cut, crossfade, push, pushUp, wipe, mask, cameraDive, zoomOut, matchCut, whip, slideOver
│           ├── timeline.ts    computeWindows(): seconds → frame windows with overlapping transitions
│           ├── Story.tsx      <Story>: renders scenes from timeline.json with transitions (z-order aware)
│           ├── Handoff.tsx    <HandoffLayer> + ownsElement(): shared elements travel between scenes
│           ├── LottieIcon.tsx <LottieIcon>: @remotion/lottie player, delayRender loading, recolor, pop-in
│           ├── SafeZone.tsx   safe-zone overlay (toggle with props {"safeZone": true})
│           └── formats.ts     the 4 formats + per-format safe-zone fractions
├── projects/
│   └── demo/                the 7-beat demo (src/scenes/Demo.tsx, src/timeline.json, CREDITS.md, out/*)
├── lottie/
│   ├── fetch.mjs            fetch + verify icons, regenerate INDEX.md
│   ├── CREDITS_TEMPLATE.md
│   └── library/
│       ├── INDEX.md         name | source | license | path | size/timing (38 icons)
│       ├── useanimations/   22 icons (MIT)
│       └── noto/            16 animated emoji (CC BY 4.0)
├── audio/generate.py        timeline.json → royalty-free music bed + SFX on cuts (48 kHz stereo WAV)
├── html-render/
│   ├── render.mjs           HTML → MP4 (Puppeteer frame capture + ffmpeg), deterministic virtual clock
│   ├── example.html         CSS-keyframes example page (tested)
│   └── package.json         puppeteer-core
├── demo.mp4                 rendered demo
└── demo_contact_sheet.jpg   6×4 contact sheet of the demo draft
```

## 2. Dependencies (installed, versions verified)
| what | version | where |
|---|---|---|
| Node / npm | 24.22.1 / 11.21.1 | system |
| remotion, @remotion/cli, @remotion/lottie, @remotion/paths, @remotion/shapes, @remotion/fonts | 4.0.545 (keep all @remotion/* on the SAME version) | template/node_modules |
| react / react-dom | 19.1.0 | template |
| lottie-web (peer of @remotion/lottie) | 5.13.0 | template |
| typescript / @types/react | 5.8.3 / 19.1.8 | template |
| puppeteer-core | 24.10.0 | html-render/node_modules |
| Google Chrome (for html-render) | 156.0.8078.47 at /usr/bin/google-chrome | system |
| Remotion headless shell | auto-downloaded by Remotion on first render (cached in node_modules/.remotion) | template |
| ffmpeg / ffprobe | 7.1.5 (has libx264, aac, loudnorm, ebur128, drawtext) | system |
| Python / numpy / scipy | 3.x / 2.5.4 / 1.18.1 | system |

Reinstall from scratch: `cd /workspace/motion/template && npm install` and `cd /workspace/motion/html-render && npm install`.

## 3. How the Remotion template works

### 3.1 timeline.json → frames (`lib/timeline.ts`)
```json
{"title":"…","fps":30,"music":{"bpm":116},"scenes":[
  {"id":"hook","beat":"hook","duration":3.2,"transitionOut":{"type":"push","duration":0.5}},
  {"id":"payoff","beat":"payoff","duration":4.0}]}
```
- `duration` is the scene's full on-screen time **including** its outgoing transition.
- Next scene starts at `start + duration - transitionOut.duration` (scenes overlap during transitions).
- Total = Σdurations − Σtransition durations. `computeWindows()` returns `{from, frames, inFrames, outFrames, inType, outType}` per scene.
- `audio/generate.py` uses the identical math, so SFX land exactly on the cuts.
- `beat` ∈ hook | problem | build | reveal | payoff | cta drives the music energy.

### 3.2 `<Story>` (`lib/Story.tsx`)
Wraps each scene in a `<Sequence>` and applies the transition styles from `TRANSITIONS[type].fn(easedProgress, 'in'|'out', w, h)`
for the overlap window. Incoming renders above outgoing, except `cameraDive`/`zoomOut`, where the outgoing scene renders on top.
Scene components receive `{w}` (their window) and use `useCurrentFrame()` (local to the scene).

### 3.3 Root.tsx compositions
`Story-16x9` 1920×1080, `Story-1x1` 1080×1080, `Story-4x5` 1080×1350, `Story-9x16` 1080×1920; duration from the timeline.
Props: `{format, safeZone: boolean, withAudio: boolean}`. `withAudio` only previews `public/audio/soundtrack.wav` in Studio;
final audio is always muxed by ffmpeg.

### 3.4 Moves (`lib/moves.tsx`); all take `delay` in frames, `dur` in seconds
| move | does | key props |
|---|---|---|
| `SplitText` | per word/char rise + fade + de-blur stagger | `text, by, each, dur, size, color` |
| `MaskReveal` | content slides in from behind a clip edge | `direction up/down/left/right, dur` |
| `Morph` | SVG path morph (interpolatePath); `SHAPES.circle/square/play` | `from, to, size, fill` |
| `PinnedScrub` | pinned element while a list scrolls past (scroll-section feel) | `pinned, items, dur, itemGap` |
| `HorizontalRail` | row of cards pans horizontally | `items, dur, itemWidth, gap` |
| `Parallax` | layers drift at depth-scaled speeds | `layers [{node, depth 0..1}], distance, axis` |
| `Counter` | eased count-up, tabular numerals | `from, to, dur, prefix, suffix, decimals` |
| `PathDraw` | stroke draws on (evolvePath) | `d, width, height, stroke, strokeWidth` |
| `Highlight` | marker / underline / strike sweep | `mode, color` |
| `RollingWord` | odometer-style word slot | `words, each` |
| `StackCards` | cards deal in with spring and stack with depth | `cards, each, w, h` |
| `Stage` | centered padded full-frame container | `bg` |

### 3.5 Shared elements (`handoff.json`, `lib/Handoff.tsx`)
```json
{"specs":[{"id":"dot","fromScene":"build2","toScene":"reveal",
  "from":{"x":0.5,"y":0.84,"scale":0.22},"to":{"x":0.5,"y":0.36,"scale":1},"leadIn":0.35,"tail":0.05}]}
```
`<HandoffLayer>` draws `HANDOFF_ELEMENTS[id]` above all scenes from `leadIn` s before A's outgoing transition until `tail` s
after B's incoming transition, interpolating x/y (fractions of the frame), scale, rotate, opacity with `easing.inOut`.
Inside scenes, draw your own copy only when `ownsElement(id, sceneId, w.from + frame, timeline, specs, fps)` is true.

### 3.6 `<LottieIcon>` (`lib/LottieIcon.tsx`)
`<LottieIcon src="lottie/rocket.json" size={240} delay={12} color="#22D3EE" loop={false} pop />`
Fetches `public/<src>` via `staticFile` inside `delayRender`, optionally recolors every static fill/stroke (`recolorLottie`),
springs in at `delay`, and plays frame-synced through `@remotion/lottie` (deterministic). useAnimations icons are black
line icons, so always pass `color` on dark backgrounds. Noto emoji are full color; don't recolor them.

### 3.7 Safe zones
`npx remotion still src/index.ts Story-9x16 out/safe.jpg --frame=120 --props='{"format":"9x16","safeZone":true,"withAudio":false}'`
Shades everything outside the safe area and draws a dashed box. Fractions are in `lib/formats.ts`.

## 4. Exact commands

```bash
# new project
/workspace/motion/new.sh myvideo && cd /workspace/motion/projects/myvideo
# edit src/timeline.json, src/scenes/*.tsx (point Root.tsx import at your scenes file), src/handoff.json
npx tsc --noEmit
npx remotion studio                                     # live preview at http://localhost:3000
npx remotion still src/index.ts Story-16x9 out/f.jpg --frame=90
# full pipeline (draft + contact sheet + final + loudnorm + QA)
bash /workspace/motion/scripts/render.sh /workspace/motion/projects/myvideo 16x9 /workspace/motion/myvideo.mp4
#   other formats: replace 16x9 with 1x1 | 4x5 | 9x16 ; add 4th arg --skip-draft for quick re-renders
bash /workspace/motion/scripts/qa.sh /workspace/motion/myvideo.mp4
```
Outputs in `projects/<name>/out/`: `draft.mp4`, `contact_sheet.jpg`, `video_noaudio.mp4`, `cues.json` (scene windows + SFX times).
Render speed on this box: ~45 s total for the 20 s 1080p demo (draft + final), concurrency 4 (`remotion.config.ts`).

## 5. Lottie: adding icons and credits
```bash
cd /workspace/motion/lottie
node fetch.mjs ua-list                       # list all useAnimations icon names
node fetch.mjs ua thumbsUp share2            # add useAnimations icons (MIT) by export name
node fetch.mjs noto 1f4aa:flexed-biceps      # add Noto animated emoji (CC BY 4.0) by codepoint[:name]
node fetch.mjs                               # re-fetch the default set
```
- useAnimations: extracted from the npm package `react-useanimations@3.1.1` (MIT; `animationData` of `lib/<name>.js`).
- Noto: `https://fonts.gstatic.com/s/e/notoemoji/latest/<codepoint>/lottie.json`. Browse names/codepoints at
  https://googlefonts.github.io/noto-emoji-animation/.
- Every file is verified (parses; has v, fr, ip, op, w, h, non-empty layers) and `library/INDEX.md` is regenerated.
  Note: codepoints for emoji added later via the CLI are not stored in INDEX.md; add them by hand or extend DEFAULT_NOTO.
- Use an icon: copy it to `projects/<name>/public/lottie/` and reference `lottie/<file>.json`.
- Credits: copy `lottie/CREDITS_TEMPLATE.md` to `projects/<name>/CREDITS.md` and list what you used. **Noto needs
  attribution** (CC BY 4.0) in the post description or end card. MIT needs only the notice kept in CREDITS.
- **No Lordicon.** It is excluded by policy for this pipeline; Lordicon has its own license terms, so stick to the two sources above.

## 6. Audio generator (`audio/generate.py`)
```bash
python3 /workspace/motion/audio/generate.py src/timeline.json public/audio/soundtrack.wav [--seed 7] [--no-music] [--no-sfx] [--cues out/cues.json]
```
- Output: 16-bit 48 kHz stereo WAV, exactly the video length, peak −3 dBFS (loudness is set later by loudnorm).
- Music: A-minor i–VI–III–VII (Am F C G) at `music.bpm`, built from detuned-saw pads (low-passed by energy), sine/saw bass
  (eighths from `problem` on), kick (from `build`), snare + extra hats + pluck arpeggios (`reveal`/`payoff`),
  a duck into the first reveal, a ring-out chord and an 0.8 s fade at the end.
- SFX (all synthesized): `whoosh` (band-passed noise sweep), `swoosh_up`, `impact` (sub drop + crack), `riser` (1.5 s),
  `pop`, `tick`, `shimmer`. Default placement: whoosh on push/pushUp/whip/slideOver/cameraDive/zoomOut/wipe/mask,
  tick on cut/matchCut, riser into + impact on the first `reveal` beat. Override per scene with `"sfx": ["impact","pop"]`
  (`impact`/`shimmer` play at scene start, `riser` 1.5 s before it, `pop` 0.2 s after it, others at the scene's out-transition).
- Royalty-free by construction: no samples, no external audio.

## 7. HTML → MP4 fallback (`html-render/render.mjs`)
```bash
node /workspace/motion/html-render/render.mjs page.html out.mp4 --w 1920 --h 1080 --fps 30 --dur 10 [--crf 17] [--audio a.wav] [--chrome /usr/bin/google-chrome]
```
Per frame it sets a **virtual clock** (overrides `requestAnimationFrame`, `performance.now`, `Date.now`), pauses and seeks
every CSS/WAAPI animation (`document.getAnimations()` → `currentTime = t`), awaits `window.__seek(t_seconds)` if the page
defines one (use it for GSAP `gsap.globalTimeline.seek(t)`, lottie-web `anim.goToAndStop(t*1000)`, canvas), screenshots PNG
and pipes to ffmpeg (libx264 slow, yuv420p, faststart). `window.__duration` sets the length if `--dur` is omitted.
Tested with `example.html` (CSS keyframes with delays). Scroll-driven CSS animations aren't time-based: for those, set
`window.__seek = t => window.scrollTo(0, t * pxPerSecond)`. Run the loudnorm mux + `qa.sh` afterwards as for Remotion.

## 8. QA steps
1. `qa.sh` must print `QA PASS`: integrated −14 ±1 LUFS, true peak ≤ −1 dBTP; no blackdetect hits ≥ 0.5 s
   (except intended); no freezedetect ≥ 1.5 s.
2. Open `out/contact_sheet.jpg` (24 frames with timestamps) and check story flow, layout and empty frames.
3. Spot-check full-res frames at every transition midpoint: `ffmpeg -ss 7.6 -i out.mp4 -frames:v 1 check.jpg`.
4. Vertical: safe-zone stills of every scene. 5. Contrast (`contrast()` ≥ 4.5 body / 3 large).
6. Reading time: `0.3 s/word + 0.5 s`, min 1.2 s; max 42 characters per line (`readingTime()`, `fitsLineLength()` in `motion.ts`).
7. Flashes ≤ 3/s, no full-frame white flashes.

## 9. Gotchas (learned while building)
- **Determinism**: no `Math.random`, `Date.now`, CSS animations or `setTimeout` in scenes; everything derives from
  `useCurrentFrame()`. Use `rand(seed)`.
- **Async assets** must use `delayRender`/`continueRender` (LottieIcon does). `cancelRender(err)` on failure, or the render hangs until timeout.
- **All `@remotion/*` packages must match the `remotion` version exactly** (4.0.545), or you get runtime version errors.
- Inter is bundled in `template/public/fonts` (SIL OFL 1.1, Inter 4.1: Regular/SemiBold/ExtraBold/Black woff2) and loaded in `src/lib/tokens.ts` with `@remotion/fonts` `loadFont` + `staticFile('fonts/...')`. Renders work offline and stay typographically identical. Do not use `@remotion/google-fonts` (it fetched Inter at render time and needed a network). Existing projects copied from the old template need the `public/fonts` folder and the new `tokens.ts`; `projects/demo` has already been updated.
- `new.sh` symlinks `node_modules` from the template; Remotion/webpack resolves it fine. If a project needs extra npm deps,
  `rm node_modules && npm install` inside that project (otherwise you'd be modifying the shared template deps).
- `npm install` prints an `allowScripts` warning for esbuild's postinstall: harmless here (esbuild's platform binary comes
  as an optional dependency and bundling works).
- Easing curves like `inOut` (0.83,0,0.17,1) are very steep: a transition looks static for its first ~30%. That's intended,
  but check transition midpoints, not starts.
- `zoomOut`/`cameraDive` show the incoming scene around the shrinking/fading outgoing one, so stagger the incoming scene's
  text in (MaskReveal/SplitText with delay) or it reads as a messy double exposure.
- Text must have explicit wrapping room (padding/maxWidth) or long headlines overflow in 9:16. **The demo scenes are tuned
  for 16:9**: they render in the other formats, but some layouts (reveal headline, problem row) overflow the 9:16/4:5 safe zones.
  Vertical deliverables need per-format layout tweaks (check with the overlay).
- useAnimations icons are 24–32 px black strokes: recolor them, and size them ≥ 8% of the short side or the strokes disappear.
- Noto emoji animations are designed to loop. Some (party popper) spend part of the loop in a "reset" pose, so pick
  `loop={false}` + a well-timed `delay` when the end pose matters. The useAnimations `check` animation draws then undraws when looped, so use `loop={false}`.
- Loudness: never normalize the WAV on its own; the two-pass loudnorm at mux with `linear=true` hits −14 LUFS without pumping.
  AAC encoding can raise true peak ~0.3 dB, which is why the target is −1.5 dBTP for a ≤ −1 dBTP pass.
- ffmpeg `drawtext` needs a font available to fontconfig (works on this box). If it fails, remove drawtext from the contact-sheet filter.
- No `rsync` on the box; `new.sh` uses tar.

---------------------------------------------------------------------------------------------------------------
## 10. Web translation: every move and transition on a plain web page

For cinematic websites. Three mechanisms, in order of preference:
1. **CSS transitions/keyframes**: entrance/ambient motion triggered by a class (add the class with IntersectionObserver).
2. **Web Animations API (WAAPI)**: `el.animate(keyframes, {duration, easing, delay, fill})`, for JS-controlled, sequenced or interruptible motion.
3. **Scroll-driven animations**: `animation-timeline: view()` (progress as the element crosses the viewport) or
   `scroll()` (progress of a scroll container), with `animation-range`. Chromium 115+ and Safari 26+; Firefox only behind
   a flag at time of writing. Always wrap in `@supports (animation-timeline: view())` and fall back to IntersectionObserver + classes.
   With a scroll timeline, `animation-duration` is ignored (use `1ms`/`auto`); the easing still applies.
4. **View Transitions API** for scene-to-scene transitions and shared elements: `document.startViewTransition(update)`
   (same-document) or `@view-transition { navigation: auto; }` (cross-document MPA), with `view-transition-name`.

Always respect reduced motion:
```css
@media (prefers-reduced-motion: reduce) { *, *::before, *::after { animation: none !important; transition: none !important; } }
```

### 10.1 Token translation (from `template/src/lib/tokens.ts`)
```css
:root {
  /* easing tokens (identical curves) */
  --ease-out:       cubic-bezier(0.16, 1, 0.3, 1);     /* entrances */
  --ease-in:        cubic-bezier(0.7, 0, 0.84, 0);     /* exits */
  --ease-in-out:    cubic-bezier(0.83, 0, 0.17, 1);    /* camera, transitions */
  --ease-snap:      cubic-bezier(0.2, 0.9, 0.1, 1);    /* UI snaps, counters */
  --ease-soft:      cubic-bezier(0.45, 0, 0.55, 1);    /* ambient, parallax */
  --ease-overshoot: cubic-bezier(0.34, 1.56, 0.64, 1); /* playful pop */
  /* duration tokens (s → ms) */
  --dur-micro: 150ms; --dur-short: 300ms; --dur-base: 500ms; --dur-long: 800ms;
  --dur-transition: 500ms; --stagger-char: 40ms; --stagger-word: 70ms; --hold: 500ms;
  /* colors */
  --bg:#0B0D17; --bg-alt:#141833; --surface:#1E2347; --text:#F5F7FF; --text-dim:#A9B0D6;
  --accent:#8B6CFF; --accent-2:#22D3EE; --warm:#FFB547; --danger:#FF5C7A; --ok:#3DDC97; --grey:#3A3F63;
}
```
- Frames → ms: `ms = frames / fps * 1000` (30 fps: 15 f = 500 ms). Transition defaults: cut 0, crossfade 400, push/pushUp/wipe 500,
  mask/cameraDive/zoomOut/slideOver 600, matchCut 300, whip 350 ms.
- Springs (`spring.snappy`/`gentle`/`bouncy`) have no cubic-bezier; use CSS `linear()` with sampled points, e.g. snappy ≈
  `linear(0, 0.35 8%, 0.75 18%, 1.02 32%, 1.04 40%, 1 60%, 1)` over ~500 ms, or `--ease-overshoot` as a close-enough stand-in.
- In WAAPI pass the same strings: `{easing: 'cubic-bezier(0.16,1,0.3,1)', duration: 500}`.
- Type scale is relative to the short side: on the web use `clamp()` with `vmin`, e.g. hero `font-size: clamp(48px, 12vmin, 160px)`.

### 10.2 Moves

**SplitText** (split into spans server-side or with JS; stagger via a custom property)
```html
<h1 class="split"><span style="--i:0">Make</span> <span style="--i:1">it</span> <span style="--i:2">move.</span></h1>
```
```css
.split span { display:inline-block; opacity:0; transform:translateY(.5em); filter:blur(8px);
  animation: rise var(--dur-base) var(--ease-out) forwards; animation-delay: calc(var(--i) * var(--stagger-word)); }
@keyframes rise { to { opacity:1; transform:none; filter:none; } }
/* scroll-driven version */
@supports (animation-timeline: view()) {
  .split span { animation-timeline: view(); animation-range: entry 10% cover 30%; animation-delay: 0s; animation-duration: auto; }
}
```
WAAPI: `spans.forEach((s,i)=>s.animate([{opacity:0,transform:'translateY(.5em)',filter:'blur(8px)'},{opacity:1,transform:'none',filter:'none'}],{duration:500,delay:i*70,easing:'cubic-bezier(.16,1,.3,1)',fill:'both'}))`

**MaskReveal**
```css
.mask { overflow:hidden; display:inline-block; }
.mask > * { display:block; transform:translateY(110%); transition: transform var(--dur-long) var(--ease-out); }
.mask.in > * { transform:none; }   /* add .in via IntersectionObserver */
/* or clip-path on one element: */
.reveal { clip-path: inset(100% 0 0 0); animation: clipUp var(--dur-long) var(--ease-out) forwards; }
@keyframes clipUp { to { clip-path: inset(0 0 0 0); } }
```

**Morph** (CSS `d:` animation works in Chromium for paths with the same command structure; otherwise use flubber or WAAPI)
```css
path.morph { d: path("M50,10 C72,10 90,28 90,50 C90,72 72,90 50,90 C28,90 10,72 10,50 C10,28 28,10 50,10 Z");
  transition: d var(--dur-long) var(--ease-in-out); }
.is-play path.morph { d: path("M30,15 C34,12 40,13 44,16 L84,44 …Z"); }  /* same number/type of commands */
```
Portable: `import {interpolate} from 'flubber'` and drive `path.setAttribute('d', interp(p))` from rAF or a scroll handler.
Simple shapes: animate `border-radius` (50% → 16px) + `clip-path: polygon()` on a div instead.

**PinnedScrub**: `position: sticky` + scroll timeline
```css
.pin-section { height: 300vh; view-timeline-name: --pin; }
.pin-section .pinned { position: sticky; top: 0; height: 100vh; }
.pin-section .list { animation: scrub linear both; animation-timeline: --pin; animation-range: contain 0% contain 100%; }
@keyframes scrub { from { transform: translateY(60vh); } to { transform: translateY(-100%); } }
```

**HorizontalRail**: vertical scroll drives horizontal pan
```css
.rail-section { height: 400vh; view-timeline-name: --rail; }
.rail-sticky { position: sticky; top: 0; height: 100vh; overflow: hidden; display:flex; align-items:center; }
.rail { display:flex; gap:4vmin; animation: pan linear both; animation-timeline: --rail; animation-range: contain; }
@keyframes pan { to { transform: translateX(calc(-100% + 100vw)); } }
```
(Non-scroll: a `transition: transform var(--dur-long) var(--ease-in-out)` on `.rail` when a step changes.)

**Parallax**
```css
.layer { animation: drift linear both; animation-timeline: scroll(root); }
.layer.far  { --d: -10vh; } .layer.mid { --d: -25vh; } .layer.near { --d: -50vh; }
@keyframes drift { to { transform: translateY(var(--d)); } }
```
Pointer parallax: `el.style.transform = translate(${dx*depth}px, ${dy*depth}px)` inside rAF with lerped values.

**Counter**: animatable custom property via `@property`
```css
@property --n { syntax: '<integer>'; initial-value: 0; inherits: false; }
.counter { --n: 0; counter-reset: n var(--n); transition: --n 1200ms var(--ease-snap); font-variant-numeric: tabular-nums; }
.counter.in { --n: 1250; }
.counter::after { content: counter(n); }
/* scroll-driven: animation: count linear both; animation-timeline: view(); @keyframes count { to { --n: 1250; } } */
```
(For decimals/locale formatting use WAAPI on a dummy element or rAF + `toLocaleString`.)

**PathDraw**
```css
.draw path { stroke-dasharray: 1; stroke-dashoffset: 1; animation: draw 1s var(--ease-in-out) forwards; }
/* add pathLength="1" on the <path> so dash values are normalized */
@keyframes draw { to { stroke-dashoffset: 0; } }
@supports (animation-timeline: view()) { .draw path { animation-timeline: view(); animation-range: entry 0% cover 50%; } }
```

**Highlight** (marker / underline / strike)
```css
.hl { background: linear-gradient(var(--warm), var(--warm)) no-repeat 0 85% / 0% 80%;
  transition: background-size var(--dur-base) var(--ease-out); }
.hl.in { background-size: 100% 80%; }           /* underline: 0 95% / x 10% ; strike: 0 52% / x 9% */
```

**RollingWord**
```html
<span class="roll"><span class="track"><span>flat.</span><span>dull.</span><span>forgettable.</span></span></span>
```
```css
.roll { display:inline-block; height:1.15em; overflow:hidden; vertical-align:bottom; }
.track { display:flex; flex-direction:column; animation: roll 1.8s var(--ease-in-out) forwards; }
.track span { height:1.15em; line-height:1.15em; }
@keyframes roll { 0%,30% { transform:translateY(0); } 40%,63% { transform:translateY(-1.15em); } 73%,100% { transform:translateY(-2.3em); } }
```

**StackCards**
```css
.card { opacity:0; transform: translateX(40vw) rotate(12deg);
  animation: deal 600ms var(--ease-overshoot) forwards; animation-delay: calc(var(--i) * 180ms); }
.card:nth-child(odd) { --r: -2deg; } .card:nth-child(even) { --r: 2deg; }
@keyframes deal { to { opacity:1; transform: translate(calc(var(--depth) * -22px), calc(var(--depth) * -22px)) rotate(var(--r)) scale(calc(1 - var(--depth) * .03)); } }
```
Scroll version: `animation-timeline: view(); animation-range: entry calc(var(--i) * 10%) cover 40%;`

### 10.3 Transitions (scene → scene)
On a site a "scene" is a full-viewport section, a route, or a state. Two patterns:
(a) **View Transitions** (state/route changes), with old/new snapshots animated by CSS;
(b) **scroll-driven** (`view()` on the section leaving/entering).

Base for View Transitions:
```js
function go(update, type) {               // type = 'push' | 'wipe' | 'mask' | 'dive' | …
  if (!document.startViewTransition) return update();
  document.documentElement.dataset.vt = type;
  document.startViewTransition(update).finished.finally(() => delete document.documentElement.dataset.vt);
}
```
```css
::view-transition-old(root), ::view-transition-new(root) { animation-duration: var(--dur-transition); animation-timing-function: var(--ease-in-out); }
```
| transition | View Transitions CSS (old = outgoing, new = incoming) |
|---|---|
| cut | `::view-transition-group(root){animation:none}` or just swap DOM without a transition |
| crossfade | default behavior; set `animation-duration:400ms; animation-timing-function:var(--ease-soft)` |
| push | `[data-vt=push]::view-transition-old(root){animation-name:outL} [data-vt=push]::view-transition-new(root){animation-name:inR}` with `@keyframes outL{to{transform:translateX(-100%)}} @keyframes inR{from{transform:translateX(100%)}}` |
| pushUp | same with `translateY(-100%)` / `translateY(100%)` |
| wipe | `::view-transition-old(root){animation:none} ::view-transition-new(root){animation-name:wipe}` `@keyframes wipe{from{clip-path:inset(0 100% 0 0)}to{clip-path:inset(0)}}` |
| mask | new: `@keyframes iris{from{clip-path:circle(0% at var(--x,50%) var(--y,50%))}to{clip-path:circle(75%)}}`; old: `scale(1.08)`. Set --x/--y to the click point for a "from the button" iris |
| cameraDive | old on top (`::view-transition-old(root){z-index:2}`), `@keyframes dive{to{transform:scale(4);opacity:0;filter:blur(12px)}}`; new: `from{transform:scale(.7);opacity:0;filter:blur(10px)}`; 600ms |
| zoomOut | old: `to{transform:scale(.5);opacity:0;filter:blur(6px)}` on top; new: `from{transform:scale(1.6);opacity:0}` |
| matchCut | give the shared element `view-transition-name: hero` in both states; root: `animation-duration:300ms; animation-timing-function:steps(1, jump-none)`. The `hero` group morphs position/size automatically |
| whip | old/new translateX ±100% + `filter: blur(24px)` at 50% keyframe, 350ms |
| slideOver | new: `from{transform:translateX(100%)}` + box-shadow; old: `to{transform:scale(.92);filter:brightness(.5)}` |

**Shared-element hand-off (handoff.json) = `view-transition-name`**:
```css
.dot-small { view-transition-name: dot; }      /* in state A */
.play-hero { view-transition-name: dot; }      /* in state B (only one element per name at a time) */
::view-transition-group(dot) { animation-duration: 600ms; animation-timing-function: var(--ease-in-out); }
```
The browser interpolates position, size and transform between the two, which is exactly what `<HandoffLayer>` does with `from`/`to` poses.

**Scroll-driven scene transitions** (long-scroll cinematic pages):
```css
.scene { height: 100vh; position: sticky; top: 0; }
.scene .content { animation: sceneOut linear both; animation-timeline: view(); animation-range: exit 0% exit 100%; }
@keyframes sceneOut { to { transform: scale(3); opacity: 0; filter: blur(12px); } }  /* cameraDive on scroll */
.scene + .scene { animation: irisIn linear both; animation-timeline: view(); animation-range: entry 0% entry 100%; }
@keyframes irisIn { from { clip-path: circle(0% at 50% 50%); } to { clip-path: circle(75% at 50% 50%); } }  /* mask on scroll */
```
Swap the keyframes for push (`translateX`), wipe (`clip-path: inset`), zoomOut (`scale(.5)`), etc., reusing the table above.

### 10.4 Lottie on the web
`lottie-web` (MIT): `lottie.loadAnimation({container, renderer:'svg', loop:true, autoplay:true, path:'/lottie/rocket.json'})`,
or `<dotlottie-wc>` / `@lottiefiles/dotlottie-web`. Scroll-scrub: `anim.goToAndStop(progress * anim.totalFrames, true)`
in a scroll handler. The same JSON files from `/workspace/motion/lottie/library` work as-is; credit rules are unchanged
(Noto needs CC BY attribution on the page, e.g. in the footer).

### 10.5 Rules that carry over to the web
Reading time (0.3 s/word + 0.5 s, min 1.2 s; max 42 characters per line), contrast (≥ 4.5:1 body), ≤ 3 flashes/s, one camera move per section, easing tokens only,
`prefers-reduced-motion`, and only animate `transform`, `opacity`, `filter` and `clip-path` for 60 fps
(avoid animating width/height/top/left).
