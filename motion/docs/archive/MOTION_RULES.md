> **ARCHIVED (Animator's original, 2026-11-19). Superseded by [../../PLAYBOOK.md](../../PLAYBOOK.md) (and [../../WEB.md](../../WEB.md) for §10). Paths below point at the old /workspace/motion toolkit. Do not edit; do not follow where it disagrees with PLAYBOOK.md.**

# Motion rules (hard constraints)

These are checked on every video before delivery. Source of truth for numbers: `template/src/lib/tokens.ts`,
`template/src/lib/formats.ts`, `scripts/qa.sh`.

## 1. Reading time
- On-screen time for any text >= `0.3 s per word + 0.5 s`, minimum 1.2 s.
  Helper: `readingTime(text)` in `src/lib/motion.ts`. Count from the moment the LAST word has landed.
- Max 42 characters per line, max ~7 words per line of headline, max 2 lines per scene. One idea per scene.
- Never animate text while it must be read (no drifting/rotating paragraphs). Motion in, hold still, motion out.
- Captions/body never smaller than `type.caption` (2.8% of the short side ≈ 30 px at 1080).
- Typeface: Inter 4.1, bundled in `public/fonts` (SIL OFL 1.1), loaded with `@remotion/fonts` `loadFont` + `staticFile`. Renders must not fetch Google Fonts.

## 2. Safe zones (`src/lib/formats.ts`, overlay: `--props='{"safeZone":true}'`)
| format | size | keep text/logos inside |
|---|---|---|
| 16:9 | 1920×1080 | 5% each side (title-safe 90%) |
| 1:1 | 1080×1080 | 6% each side |
| 4:5 | 1080×1350 | 6% sides/top, 8% bottom |
| 9:16 | 1080×1920 | top 13% (~250 px), bottom 18% (~340 px captions/CTA), left 6%, right 17% (~180 px button rail) |
- Render a still of every scene with the overlay ON for vertical deliverables and look at it. Never ship with it on.
- Layout must be relative (`useVideoConfig()` width/height, `type.*` × short side). No hard-coded pixel layouts.

## 3. Contrast
- Body/caption text >= 4.5:1 against its actual background; large text (>= 3% short side, bold) >= 3:1.
  Helper: `contrast(a, b)` in `motion.ts`. Token ratios vs `bg #0B0D17`: text 18.1, textDim 9.1, accent 5.2,
  accent2 10.7, warm 11.0, danger 6.5, ok 11.0, grey 1.9 (decoration only, never text).
- Text over imagery/video gets a scrim (gradient or 60%+ dark plate).
- Never rely on color alone (problem = red AND strike-through/icon).

## 4. Flashes and photosensitivity (WCAG 2.3.1)
- No more than 3 flashes in any 1-second window. No full-screen white/red flash transitions at all.
- Large luminance swaps (dark↔light full frame) must take >= 0.2 s (use crossfade/mask, not a cut) and happen at most once per 2 s.
- No high-contrast stripes/checkerboards flickering > 3 Hz. Whip/blur transitions: max 2 per video.

## 5. Loudness and audio
- Deliver at **-14 LUFS integrated (±1)**, **true peak <= -1.0 dBTP** (we target -1.5 at loudnorm), AAC 192k, 48 kHz stereo.
- Two-pass `loudnorm` at mux time (never normalize per clip). Verified by `scripts/qa.sh` with `ebur128=peak=true`.
- SFX land on cuts (generator places them from the timeline); music ducks ~6 dB for 0.25 s into the reveal impact.
- Music and SFX must be royalty-free: use `audio/generate.py` (fully synthesized) or a licensed track documented in CREDITS.

## 6. Motion and easing
- Only the easing tokens: `out` (entrances), `in` (exits), `inOut` (camera + transitions), `snap` (UI/counters),
  `soft` (ambient/parallax), `overshoot` (rare playful pops), `linear` (only for matchCut/progress bars).
- Durations: micro 150 ms, short 300 ms, base 500 ms, long 800 ms, transition 500 ms, stagger 40 ms/letter or 70 ms/word.
- Entrances are faster to start than exits; exits are shorter than entrances (~60%).
- Everything is frame-driven (`useCurrentFrame`). No CSS animations, no `Math.random()` (use `rand(seed)`), no `Date.now()`.
- 30 fps default (60 fps only for UI-demo content). h264 yuv420p.

## 7. Camera rules
- One camera move per scene max; the camera always has a motivation (follow, reveal, go deeper, step back).
- Push-in = focus/importance; pull-out = context/payoff; lateral = sequence/time; dive = going deeper/reveal.
- Hold the camera still while text is read. Ease every camera move with `inOut`; never linear.
- Keep direction consistent: progress moves left→right (push left), going "deeper" = scale up.
- Parallax: 3 layers max, far layer moves <= 20% of near layer.

## 8. Lottie
- Sources: **useAnimations (MIT)** and **Google Noto Animated Emoji (CC BY 4.0)** only. **No Lordicon.**
- Every icon used must be listed in the project's `CREDITS.md` (template: `lottie/CREDITS_TEMPLATE.md`).
  Noto requires attribution in the post description or end card.
- Max 1 hero Lottie + 2–3 supporting icons per scene. Recolor monochrome icons to tokens (`color` prop).
- Lottie plays from the frame it appears (`delay`), synced to the Remotion frame, so renders are deterministic.

## 9. Delivery checklist
`tsc` clean · draft watched · contact sheet reviewed · final h264 crf 17 · loudnorm mux · `qa.sh` PASS ·
no black/frozen frames · safe-zone stills checked (vertical) · CREDITS filled in.
