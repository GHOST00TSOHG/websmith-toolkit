# PLAYBOOK: Websmith motion graphics (single source of truth)

Code-driven animation: Remotion/React scenes rendered frame by frame in headless Chromium, encoded with ffmpeg,
with a generated royalty-free soundtrack, a two-pass loudness mux and blocking automated QA. Never a single animated
card; every piece is a short film with an arc.

**Precedence.** This file merges Animator's storytelling skill (with its "lessons" section), MOTION_RULES.md,
STORYTELLING.md, WORKFLOW.md and HANDOFF_FOR_WEBSMITH.md §1–9. Where they disagreed, **the skill won**
(reading time 0.3 s/word + 0.5 s, min 1.2 s; AAC 192k; SFX 0–2 frames before the visual; 1 fps contact sheet + 0.1 s
cut close-ups). The old files now only point here. Web mapping lives in [WEB.md](WEB.md). Toolkit root: this `motion/` folder (forked from an earlier Remotion motion kit on 2026-11-19).

---------------------------------------------------------------------------------------------------------------------
## 1. Defaults (hard)
- On screen from frame 0 (no fade from black); hook by 1.5 s; brand + promise by 3 s. One idea / focal point per beat.
- Text on screen >= **0.3 s/word + 0.5 s, min 1.2 s**, counted from when the last word lands; <= **42 chars/line**,
  ~7 words per headline line, max 2 lines per scene. Motion in, hold still while read, motion out.
- Easing by intent, from tokens only; exits ~60–70 % of the entrance time.
- Every cut is a named transition with a meaning, never a random crossfade; one camera move at a time.
- Contrast >= 4.5:1 (3:1 for large text). Platform safe zones (vertical especially). <= 3 flashes/s, no red flashing.
- Audio **-14 LUFS** integrated ±1 for social (-16 for Apple/podcast), true peak <= -1 dBTP, **AAC 192k** 48 kHz stereo.
  Impulsive SFX land **0–2 frames before** the visual (toolkit default 1).

## 2. Process (10 steps)
1. **Brief**: message, audience, platform, length (20–45 s), aspect (16:9 1920x1080, 1:1 1080x1080, 4:5 1080x1350,
   9:16 1080x1920), end-frame CTA. Pick sensibly if missing and say so.
2. **SCRIPT.md beat table before any code**: 6–9 beats (hook, problem, build, reveal, payoff, cta), 3–6 s each, end on
   one takeaway held 2–3 s, chapters end on proof. Per beat: signature move + transition type + reading-time check.
   One object travels through the film changing role at each cut (§5). Mark Lottie beats and sound cues. Then write
   `src/timeline.json` (the audio and the transitions both read it). Only then write scenes.
3. `./new.sh <name> [--preset starter]` then `cd projects/<name>`.
4. **Lottie**: library first (`lottie/library/INDEX.md`); new ones from useAnimations (MIT), Google Noto animated emoji
   (CC BY 4.0, credit "Emoji animations: Animated Noto Emoji by Google, CC BY 4.0"), free LottieFiles. **No Lordicon.**
   Credits in the project's `CREDITS.md`. Recolour line icons only, never emoji.
5. **Code**: tokens, helpers, moves, transitions (§6). No invented easing/durations. Timings in timeline.json;
   colours/fonts in `lib/tokens.ts`; shared-element poses in `handoff.json`. One file per scene, `Story` component,
   register in `src/Root.tsx`. Last frame of each scene = first frame of the next. SafeZone overlay on while laying
   out vertical, off before render.
6. **Preview**: `npx tsc --noEmit`; draft at 0.5x; **1 fps contact sheet** `out/review/sheet.png` (tile 6xN) and
   **close-ups every 0.1 s around each cut** `out/review/cut_*.png` (render.sh does all of this). Fix ghost doubles,
   clipped/overlapping text, dead stretches, blur, blank icons.
7. **Sound**: generated royalty-free bed + SFX on the cuts from the timeline (§7), or a custom track.
8. **Final**: h264 crf 17 yuv420p, two-pass loudnorm mux, AAC 192k → `<name>.mp4` in the toolkit root.
   One command: `bash scripts/render.sh projects/<name> 16x9 <name>.mp4`.
9. **Rules QA (blocking)**: `scripts/qa.sh` (loudness, true peak, unexpected black/frozen frames, streams) **plus**
   looking at the sheet and the cut close-ups. Fail → fix and re-render.
10. **Deliver** the MP4 + a scene-by-scene note with "Rules QA: passed (n/n)"; CC BY credit; flag mockup numbers;
    real handles only; upload to the owner's animation Drive folder if there is one.

## 3. Rules
### 3.1 Reading time & type
- `readingTime(text)` / `fitsLineLength(text)` in `lib/motion.ts`. Captions never smaller than `type.caption`
  (2.8 % of the short side ≈ 30 px at 1080). Never animate text while it must be read.
- Fonts are bundled in `public/fonts` (Inter 4.1 + Jost 300–500, both SIL OFL 1.1; see its README) and loaded in
  `tokens.ts` with `@remotion/fonts` `loadFont` + `staticFile`. **Renders never fetch fonts** (no `@remotion/google-fonts`).
### 3.2 Safe zones (`lib/formats.ts`; overlay `--props='{"safeZone":true}'`)
| format | size | keep text/logos inside |
|---|---|---|
| 16:9 | 1920×1080 | 5 % each side (title-safe 90 %) |
| 1:1 | 1080×1080 | 6 % each side |
| 4:5 | 1080×1350 | 6 % sides/top, 8 % bottom |
| 9:16 | 1080×1920 | top 13 % (~250 px), bottom 18 % (~340 px captions/CTA), left 6 %, right 17 % (~180 px button rail) |
- `Stage` pads to the current format's safe zone by default; `safeRect(width, height)` gives the rect in px.
- A 16:9 layout does not carry to 9:16 by itself: lay out each format with the overlay on and look at a still of
  every scene. Layout is relative (`useVideoConfig()`, `type.*` × short side), never hard-coded pixels.
### 3.3 Contrast
Body/caption >= 4.5:1 against the real background, large text (>= 3 % short side, bold) >= 3:1 (`contrast(a, b)`).
Default tokens vs bg #0B0D17: text 18.1, textDim 9.1, accent 5.2, accent2 10.7, warm 11.0, danger 6.5, ok 11.0, grey 1.9
(decoration only). Text over imagery gets a scrim. Never colour alone.
### 3.4 Flashes (WCAG 2.3.1)
<= 3 flashes in any 1 s; no full-screen white/red flash transitions; dark↔light full-frame swaps take >= 0.2 s
(crossfade/mask) and at most once per 2 s; no high-contrast flicker > 3 Hz; whip/blur transitions max 2 per video.
### 3.5 Loudness & audio
-14 LUFS ±1, TP <= -1 dBTP (loudnorm targets **-2.0**: AAC encoding added up to 0.8 dB of true peak on noisy upbeat beds), AAC 192k, 48 kHz stereo. Two-pass
loudnorm at mux only (never normalise the WAV on its own). Music ducks into the reveal. Royalty-free only: the generator
(fully synthesised) or a licensed track documented in CREDITS.
### 3.6 Motion & easing
Tokens only: `out` entrances, `in` exits, `inOut` camera + transitions, `snap` UI/counters, `soft` ambient/parallax,
`overshoot` rare playful pops, `linear` only for matchCut/progress bars. Durations: micro 150 ms, short 300, base 500,
long 800, transition 500, stagger 40 ms/letter or 70 ms/word. Everything frame-driven (`useCurrentFrame`): no CSS
animations, no `Math.random()` (use `rand(seed)`), no `Date.now()`, no `setTimeout`. 30 fps (60 only for UI demos).
### 3.7 Camera
One camera move per scene, always motivated (push-in = focus, pull-out = context/payoff, lateral = sequence/time,
dive = deeper/reveal). Hold still while text is read; ease with `inOut`; progress moves left→right; parallax 3 layers
max, far layer <= 20 % of near. Story mapping: hook static/slight push, problem static, build lateral, reveal dive/push,
payoff pull-out.
### 3.8 Lottie
Max 1 hero + 2–3 supporting icons per scene. Every icon in the project's CREDITS.md (Noto needs attribution in the
post or end card). `<LottieIcon>` **plays once by default** (looped icons look broken: the Noto party popper shows a bare
cone, the useAnimations check draws then undraws); use `trim={[in, out]}` (the Lottie's own frames) for a clean range,
`loop` only for icons that loop cleanly. `delay` (frames) starts the icon at **its frame 0** at that moment.
`nativeSpeed` plays 60 fps Noto emoji at their designed speed (off by default: @remotion/lottie advances one Lottie
frame per video frame, so they play at half speed in a 30 fps video). useAnimations icons: recolour, size >= 8 % of
the short side.

## 4. Storytelling
Default arc **Hook → Problem → Build → Reveal → Payoff (→ CTA)**: 5 beats for ~12 s, 7 for ~20 s, 10–12 for 45–60 s.

| beat | job | duration (of 20 s) | recipe (moves) | energy / audio |
|---|---|---|---|---|
| Hook | Stop the scroll in < 1 s: a number, a question, a tension. | 2.5–3.5 s | `SplitText` + `Counter`, or a bold Noto emoji pop; motion at frame 0 | pad + hats, light |
| Problem | Name the pain the viewer feels. | 2.5–3 s ×1–2 | `StackCards`, `Highlight mode="strike"`, `RollingWord`, `danger`, tired/thinking emoji | + bass, darker |
| Build | Show the mechanism, step by step. | 3–3.5 s ×1–2 | `PathDraw`, `HorizontalRail`, `PinnedScrub`, useAnimations UI icons | + kick, filter opens |
| Reveal | The answer / product / insight, one hero shape. | 3–3.5 s | shared-element hand-off into `Morph`, `MaskReveal` headline, `Parallax`, hero Lottie | riser → duck → impact |
| Payoff | Result + emotion. | 3.5–4 s | `Counter`, `SplitText` by char, `Highlight underline`, party/check icons | full + sparkle, ring-out |
| CTA | One action, in the safe zone. | 2–3 s | short line + logo; hold still | pad tail |

**Transitions** (`lib/transitions.ts`, per scene in `timeline.json` → `transitionOut`):
| type | default | meaning / when |
|---|---|---|
| `cut` | 0 s | Hard cut on the beat. Energy, contrast. |
| `crossfade` | 0.4 s | Time passing, soft mood shift. Rarely. |
| `push` / `pushUp` | 0.5 s | "Next step" / "and then" (lists, vertical). |
| `wipe` | 0.5 s | Hard edge L→R: before/after. |
| `mask` | 0.6 s | Circle iris: focus, reveal from a point. |
| `cameraDive` | 0.6 s | Into the scene and out in the next: going deeper, problem → solution. |
| `zoomOut` | 0.6 s | Camera pulls back: context, reveal → payoff. |
| `matchCut` | 0.3 s | Instant swap at the midpoint while a shared shape persists (pair with handoff.json). |
| `whip` | 0.35 s | Fast pan + blur: montage energy. Max 2 per video. |
| `slideOver` | 0.6 s | New layer slides over, old dims: new chapter. |

Vary them (never the same 3× in a row). They overlap scenes (`computeWindows`). `inOut` is steep: check transition
midpoints, not starts. `zoomOut`/`cameraDive` show the incoming scene around the outgoing one: stagger the incoming
text in or it reads as a double exposure.

**Writing**: one sentence per beat, read aloud, timed with `readingTime`; concrete over abstract; numbers over
adjectives; no fake statistics; every scene answers "why keep watching?".

## 5. Shared element through every cut
The film's continuity comes from ONE object (a dot, a logo, a light) that never cuts: it changes role at each
beat but is visibly the same thing. Mechanics (`lib/Handoff.tsx`, `src/handoff.json`):
1. **Chain the specs**: one spec per cut, same `id`: `hook>problem`, `problem>build`, `build>reveal`, … Each spec's
   `from` is where scene A leaves it; `to` is where scene B picks it up. Specs are **keyed by scene pair**
   (`id:fromScene>toScene`), so many specs can share an id; `validateHandoffs()` (called in Root.tsx) throws if two
   specs for one id overlap in time or a pair is declared twice. `HANDOFF_ELEMENTS` may give a per-pair variant under
   the key `id:from>to` (falls back to `id`).
2. **The layer draws it during each cut**: `<HandoffLayer>` renders above both scenes from `leadIn` s before A's
   outgoing transition until `tail` s after B's incoming one, interpolating position, scale, rotate, opacity with `inOut`.
3. **Scenes draw it the rest of the time**, at exactly the spec's pose: `ownsElement(id, sceneId, w.from + frame, …)`
   tells a scene when it owns it, and `<Placed pose={spec.from}>` / `resolvePose()` place it the same way the layer
   does. Read poses from handoff.json in the scene (never retype numbers), and when a scene moves the element
   (orbit, glide), start at the incoming `to` and end at the outgoing `from`.
4. **Poses that survive every aspect ratio**: `{"x": .5, "y": .42}` = fractions of width/height (default);
   `{"units": "short", "x": 0, "y": -0.08}` = offset from the frame centre in short-side units (right for centred
   layouts in 16:9, 1:1, 4:5 and 9:16); `"formats": {"9x16": {"y": 0.46}}` = per-format partial override for layouts
   that change shape. Size the element itself from the short side (e.g. `s * 0.083`), never in px.
5. **Check it** in the cut close-ups: no double (scene copy + layer copy), no jump at the start/end of a cut.
The template's Starter scenes and the starter preset both carry their element through every cut as working examples.

## 6. Template reference (`template/`)
- `src/timeline.json` → `lib/timeline.ts` `computeWindows()`: `duration` includes the outgoing transition; next scene
  starts at `start + duration - transitionOut.duration`; total = Σ durations − Σ transitions. Scene fields: `id`,
  `beat` (hook|problem|build|reveal|payoff|cta), `duration`, `transitionOut {type, duration}`, `sfx?`, `note?`,
  `hit?`, `accents?` (§7). `music {bpm, key, mood: "upbeat"|"cinematic", feel}`.
- `lib/Story.tsx` `<Story>`: one `<Sequence>` per scene with the transition styles; incoming above outgoing except
  `cameraDive`/`zoomOut`. Scenes get `{w}` and use scene-local `useCurrentFrame()`.
- `src/Root.tsx`: `Story-16x9`, `Story-1x1`, `Story-4x5`, `Story-9x16`; props `{format, safeZone, withAudio}`
  (`withAudio` is Studio preview only; final audio is always muxed by ffmpeg).
- `lib/moves.tsx` (all take `delay` frames, `dur` seconds): `SplitText` (text, by, each, dur, size, color),
  `MaskReveal` (direction), `Morph` (+`SHAPES`), `PinnedScrub`, `HorizontalRail`, `Parallax`, `Counter`, `PathDraw`,
  `Highlight` (marker|underline|strike), `RollingWord`, `StackCards`, `Stage` (safe-zone padded).
- `lib/motion.ts`: `sec, progress, tween, lerp, stagger, springIn, inOut, readingTime, fitsLineLength, contrast, rand`.
- `lib/tokens.ts`: colours, `fonts` (display/body Inter, `jost`, mono), type scale (× short side), easing, durations, springs.
- `lib/formats.ts`: `FORMATS`, `SAFE`, `formatOf(w, h)`, `safeRect(w, h)`. `lib/SafeZone.tsx`: overlay.
- `lib/LottieIcon.tsx`: `<LottieIcon src size color loop|playOnce trim nativeSpeed playbackRate delay pop />`, `recolorLottie`, `trimLottie`.
- `lib/Handoff.tsx`: §5.

Async assets use `delayRender`/`continueRender` (and `cancelRender` on failure or the render hangs).
Keep every `@remotion/*` package on the same version as `remotion` (4.0.545).

## 7. Sound (`audio/generate.py`)
`python3 audio/generate.py src/timeline.json public/audio/soundtrack.wav [--mood upbeat|cinematic] [--seed N]
[--no-music] [--no-sfx] [--lead-frames 0..2] [--cues out/cues.json]` → 16-bit 48 kHz stereo WAV exactly the video
length, peak -3 dBFS (loudness is set at the mux).
- **upbeat** (default): A-minor i–VI–III–VII at `music.bpm`; pads, bass from `problem`, kick from `build`, snare +
  arps on `reveal`/`payoff`; whoosh on moving cuts, tick on cuts, riser + impact into the first reveal; 25 Hz
  high-pass and a 4 dB look-ahead peak limiter so loudnorm can stay linear.
- **cinematic**: slow pads (detuned saw + vibrato strings) and a sub drone,
  **no drums**, hall reverb. Chords by beat (Am(add9) → Fmaj7 → Dm9 → Esus4 tension → Am(add9) bloom → F(add9) → Am(add9)).
  A soft bell on matchCuts, soft air centred on moving cuts, a low swell into the reveal **`hit`** (seconds from the
  reveal start, default 0.3) with a bloom + shimmer on it, soft rising bells on each scene's **`accents`** (seconds
  from scene start, e.g. one per word). Mastering: 28 Hz high-pass, duck into the hit, 1.2 s fade, soft-knee limiter.
- **SFX timing**: impulsive sounds (tick, pop, impact, bell, bloom, shimmer) start `--lead-frames` (default 1) before
  their visual; swells (whoosh, air) are centred on the transition midpoint; a riser ends lead-frames before its hit.
  Per-scene override: `"sfx": ["whoosh", "impact", …]` (whoosh, swoosh_up, impact, riser, pop, tick, shimmer).
- **Custom soundtrack**: `render.sh … --soundtrack file.wav`, or put `audio/soundtrack.wav` in the project, or a
  project score script `audio/score.py` (same CLI as generate.py; it may import the toolkit synth).
  `--music generate` forces the generator. The track must be at least the
  video length (render.sh checks).

## 8. Render, review, QA
```bash
bash scripts/render.sh <project> [16x9|1x1|4x5|9x16] [out.mp4] [--skip-draft] [--soundtrack f.wav] [--music generate]
```
tsc → soundtrack → draft (0.5x) → review images from the draft → final (h264 crf 17 yuv420p, muted) → two-pass
loudnorm mux (I -14, TP -2.0, LRA 11, linear; AAC 192k 48 kHz stereo) → `qa.sh` (exit code = QA result).
`--skip-draft` makes the review images from the final instead (use for re-renders, not the first delivery).
- **Review** (`scripts/review.sh <video> <timeline> <outdir>`): `sheet.png` = 1 frame per second, tile 6xN, with
  timestamps; `cut_<n>_<from>-<to>_<type>.png` = every 0.1 s from 0.3 s before to 0.3 s after each transition
  (windows from `scripts/cuts.py`, same math as the timeline). Look at all of them.
- **QA** (`scripts/qa.sh <mp4> [qa.json]`, render.sh passes `<project>/qa.json`): streams (h264 yuv420p + AAC 48 kHz
  stereo), integrated -14 ±1 LUFS, TP <= -1 dBTP, blackdetect (d 0.5 s, pix_th 0.05, pic_th 0.98) and freezedetect
  (noise -60 dB, **2.5 s**). **Any** failure exits 1. Calm films may hold a still up to 2.5 s; longer intentional
  holds (end card, reading holds) are listed in qa.json `allow` windows instead of hiding them under heavy grain:
  ```json
  {"freeze": {"noise": "-60dB", "min_duration": 2.5},
   "black": {"pix_th": 0.035},
   "allow": [{"type": "freeze", "start": 18.5, "end": null, "why": "end card hold"}]}
  ```
  (`end: null` = to the end.) Dark brand palettes: set `black.pix_th` just above the background's luma so
  background-only frames still fail (a near-black background may need about 0.035).
- Then look: sheet, cut close-ups, safe-zone stills (vertical), contrast, flashes, reading times.
- Stills: `npx remotion still src/index.ts Story-9x16 out/safe.png --frame=120 --props='{"format":"9x16","safeZone":true,"withAudio":false}'`.
- Speed on this box: ~25–45 s for a 7–22 s 1080p film (draft + final), concurrency 4 (`remotion.config.ts`).

## 9. Presets
`./new.sh <name>` copies the plain template. `./new.sh <name> --preset starter` then overlays `presets/starter/`
(see its PRESET.md): a starter SCRIPT.md and a default `qa.json`. Tokens, scenes, and the shared-dot hand-off stay
as they are in the template.

## 10. Lottie library & credits
```bash
cd lottie
node fetch.mjs ua-list                     # list useAnimations icon names
node fetch.mjs ua thumbsUp share2          # add useAnimations icons (MIT)
node fetch.mjs noto 1f4aa:flexed-biceps    # add Noto animated emoji (CC BY 4.0) by codepoint[:name]
node fetch.mjs                             # re-fetch the default set
```
useAnimations from `react-useanimations@3.1.1` (MIT); Noto from `https://fonts.gstatic.com/s/e/notoemoji/latest/<codepoint>/lottie.json`.
Files are verified and `library/INDEX.md` regenerated (codepoints added via the CLI must be added to INDEX.md by hand).
Copy an icon to `projects/<name>/public/lottie/`; copy `lottie/CREDITS_TEMPLATE.md` to the project's `CREDITS.md`.

## 11. HTML → MP4 fallback
`node html-render/render.mjs page.html out.mp4 --w 1920 --h 1080 --fps 30 --dur 10 [--crf 17] [--audio a.wav] [--chrome /usr/bin/google-chrome]`:
virtual clock (rAF, performance.now, Date.now), seeks every CSS/WAAPI animation, awaits `window.__seek(t)` if defined
(GSAP, lottie-web, canvas), screenshots, pipes to ffmpeg. Scroll-driven CSS: `window.__seek = t => scrollTo(0, t * pxPerSecond)`.
Then run the loudnorm mux + `qa.sh` as for Remotion.

## 12. Dependencies (local only, nothing global)
Node 24 / npm 11 (system); remotion + @remotion/{cli,lottie,paths,shapes,fonts} 4.0.545, react 19.1, lottie-web 5.13,
typescript 5.8 in `template/node_modules` (projects symlink it); puppeteer-core 24.10 in `html-render/node_modules`;
system Chrome for html-render; ffmpeg/ffprobe 7.1 (libx264, aac, loudnorm, ebur128, drawtext, blackdetect,
freezedetect); Python 3 + numpy + scipy (+ Pillow for the Lottie test). No rsync on the box (new.sh uses tar).
**node_modules and out/ are git-ignored and were wiped once by a box reset (2026-11-19 ~08:07 ET).** If renders fail
with missing modules: `cd template && npm ci` and `cd html-render && npm ci` (exact versions from the lockfiles;
needs network). npm's esbuild install-script warning is harmless.

## 13. Lessons
From Animator's first build (2026-11-19):
- Looped Lottie icons can look broken → play once (now the default) or trim to a clean in/out range.
- A 16:9 layout doesn't carry to 9:16 (the reveal headline left the safe zone) → lay out each format with the overlay.
- Fetching fonts at render time is fragile → all fonts are bundled.
- Write SCRIPT.md and timeline.json before any scene code.
- Ghost doubles and blank icons only show on the 1 fps sheet plus the 0.1 s close-ups at the cuts.

From later toolkit work (2026-11-19):
- `qa.sh` used to print PASS with frozen frames; it now fails on them. Don't add heavy grain to pass QA: allow the
  intended holds in qa.json.
- `LottieIcon delay` used to start the icon at frame `delay` of its own animation; fixed (proof: projects/lottie-test).
- Same-id hand-offs collided (React keys by id); they're keyed by scene pair now and validated.
- Dark palettes trip blackdetect's defaults on near-empty frames; tune `black.pix_th` per brand, keep bg-only frames failing.
- A period after an inline-block `Highlight` can wrap onto its own line in narrow formats: keep it in a nowrap span.
