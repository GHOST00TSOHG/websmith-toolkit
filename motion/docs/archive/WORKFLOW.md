> **ARCHIVED (Animator's original, 2026-11-19). Superseded by [../../PLAYBOOK.md](../../PLAYBOOK.md) (and [../../WEB.md](../../WEB.md) for §10). Paths below point at the old /workspace/motion toolkit. Do not edit; do not follow where it disagrees with PLAYBOOK.md.**

# Workflow: brief → story → render → QA

## 0. Brief
Topic, length (default 20 s), format(s) (16:9 / 1:1 / 4:5 / 9:16), platform, brand colors if any.

## 1. Story (STORYTELLING.md)
Write one line per beat (hook, problem, build, reveal, payoff). Time each line with `readingTime()` rules
(0.3 s/word + 0.5 s, min 1.2 s, max 42 characters per line). Pick a transition per cut from the catalog. Pick icons from `lottie/library/INDEX.md`.

## 2. Create the project
```bash
/workspace/motion/new.sh <name>              # → /workspace/motion/projects/<name>, node_modules symlinked
cd /workspace/motion/projects/<name>
```

## 3. Edit
- `src/timeline.json`: scenes `{id, beat, duration (s, includes outgoing transition), transitionOut {type, duration}, sfx?}` + `music.bpm`.
- `src/scenes/*.tsx`: one component per scene id; export `SCENES` and `HANDOFF_ELEMENTS`; point `src/Root.tsx` at the file.
- `src/handoff.json`: shared elements between scenes.
- Icons: copy JSON from `/workspace/motion/lottie/library/...` into `public/lottie/`, use `<LottieIcon src="lottie/x.json" />`.
  Add each to the project's `CREDITS.md` (copy `lottie/CREDITS_TEMPLATE.md`).
- Preview: `npx remotion studio` (port 3000) or stills:
  `npx remotion still src/index.ts Story-16x9 out/f.jpg --frame=120`
- Safe zones (vertical): `npx remotion still src/index.ts Story-9x16 out/safe.jpg --frame=120 --props='{"format":"9x16","safeZone":true,"withAudio":false}'`

## 4. Render (one command)
```bash
bash /workspace/motion/scripts/render.sh /workspace/motion/projects/<name> 16x9 /workspace/motion/<name>.mp4
```
It runs, in order:
1. `npx tsc --noEmit`
2. `python3 /workspace/motion/audio/generate.py src/timeline.json public/audio/soundtrack.wav --cues out/cues.json`
3. Draft: `npx remotion render src/index.ts Story-16x9 out/draft.mp4 --scale=0.5 --crf=28 --codec=h264`
4. Contact sheet (24 frames, 6×4, timestamps): `ffmpeg -i out/draft.mp4 -vf "fps=24/DUR,scale=480:-1,drawtext=...,tile=6x4" -frames:v 1 out/contact_sheet.jpg`
5. Final: `npx remotion render src/index.ts Story-16x9 out/video_noaudio.mp4 --codec=h264 --crf=17 --pixel-format=yuv420p --muted`
6. Two-pass loudnorm mux:
   ```bash
   ffmpeg -i public/audio/soundtrack.wav -af loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json -f null -   # pass 1 → measured_*
   ffmpeg -i out/video_noaudio.mp4 -i public/audio/soundtrack.wav -map 0:v -map 1:a -c:v copy \
     -af "loudnorm=I=-14:TP=-1.5:LRA=11:measured_I=..:measured_TP=..:measured_LRA=..:measured_thresh=..:offset=..:linear=true,aresample=48000" \
     -c:a aac -b:a 192k -ar 48000 -shortest -movflags +faststart OUT.mp4
   ```
7. `bash /workspace/motion/scripts/qa.sh OUT.mp4`
Pass `--skip-draft` as 4th arg to skip steps 3–4 on re-renders (do not skip for the first delivery).

## 5. QA (scripts/qa.sh); all must pass
```bash
ffprobe -v error -show_entries stream=codec_name,profile,width,height,pix_fmt,r_frame_rate,sample_rate,channels:format=duration -of default=nw=1 OUT.mp4
ffmpeg -i OUT.mp4 -map 0:a -af ebur128=peak=true -f null -      # I = -14 ±1 LUFS, true peak <= -1 dBTP
ffmpeg -i OUT.mp4 -vf blackdetect=d=0.5:pix_th=0.05 -an -f null -   # no unintended black
ffmpeg -i OUT.mp4 -vf freezedetect=n=0.001:d=1.5 -an -f null -      # no frozen stretches
```
Then LOOK: open the contact sheet, then spot-check full-res frames at every transition midpoint:
`ffmpeg -ss <t> -i OUT.mp4 -frames:v 1 out/check.jpg`. Check reading time, safe zones, contrast, flashes (MOTION_RULES).

## 6. Deliver
MP4 + contact sheet + CREDITS lines (Noto attribution is required). Upload to Drive if asked.

## HTML fallback
If a design is easier as a web page (or Remotion can't be used): build a self-contained HTML page whose animations
are CSS/WAAPI (or expose `window.__seek(t)`), then
`node /workspace/motion/html-render/render.mjs page.html out.mp4 --w 1920 --h 1080 --fps 30 --dur 10 [--audio track.wav]`
and run the same loudnorm mux + QA.
