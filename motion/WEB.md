# WEB.md: every move and transition on a plain web page

Websmith motion toolkit. Kept from Animator's HANDOFF_FOR_WEBSMITH.md section 10 (web mapping). Rules, timings and tokens
come from [PLAYBOOK.md](PLAYBOOK.md); where they differ, PLAYBOOK.md wins. Token values: `template/src/lib/tokens.ts`.

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

## 1 Token translation (from `template/src/lib/tokens.ts`)
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

## 2 Moves

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

## 3 Transitions (scene → scene)
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

## 4 Lottie on the web
`lottie-web` (MIT): `lottie.loadAnimation({container, renderer:'svg', loop:true, autoplay:true, path:'/lottie/rocket.json'})`,
or `<dotlottie-wc>` / `@lottiefiles/dotlottie-web`. Scroll-scrub: `anim.goToAndStop(progress * anim.totalFrames, true)`
in a scroll handler. The same JSON files from `lottie/library` work as-is; credit rules are unchanged
(Noto needs CC BY attribution on the page, e.g. in the footer).

## 5 Rules that carry over to the web
Reading time (0.3 s/word + 0.5 s, min 1.2 s; max 42 characters per line), contrast (≥ 4.5:1 body), ≤ 3 flashes/s, one camera move per section, easing tokens only,
`prefers-reduced-motion`, and only animate `transform`, `opacity`, `filter` and `clip-path` for 60 fps
(avoid animating width/height/top/left).

## 6 One shared element through every cut (web)
Same idea as PLAYBOOK.md "Shared element through every cut": give the travelling element the SAME
`view-transition-name` in every state/route (only one element per name per state). Each View Transition morphs it
from its old box to its new box while the rest of the page uses the cut's named transition. On scroll-driven pages,
pin it (`position: sticky` or `fixed`) and animate its `transform` per section with `animation-timeline: view()` on
the section, so it never cuts.
