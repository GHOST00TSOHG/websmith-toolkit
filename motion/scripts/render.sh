#!/usr/bin/env bash
# Full render pipeline for one project (Websmith motion toolkit). See PLAYBOOK.md.
# Usage: render.sh <project-dir> [format=16x9] [out.mp4] [--skip-draft] [--soundtrack <file.wav>] [--music generate]
#
# Steps: tsc -> soundtrack -> draft (0.5x, crf 28) + review (out/review/sheet.png 1 fps 6xN, cut close-ups every 0.1 s)
#        -> final (h264 crf 17, yuv420p, no audio) -> 2-pass loudnorm mux (-14 LUFS, -2.0 dBTP target, AAC 192k 48 kHz)
#        -> qa.sh (blocking; uses <project>/qa.json if present) -> exit code = QA result.
# Soundtrack, first match wins:
#   --soundtrack <file>          use this audio file as-is (copied to public/audio/soundtrack.wav)
#   <project>/audio/soundtrack.wav   a project-provided track
#   <project>/audio/score.py     a project score script: python3 audio/score.py src/timeline.json public/audio/soundtrack.wav --cues out/cues.json
#   audio/generate.py            the toolkit generator; mood from timeline music.mood (upbeat | cinematic)
#   --music generate forces the generator even if the project provides a track or score.
# --skip-draft: no draft; the review images are made from the final video instead.
set -euo pipefail
M="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
POS=(); SKIP_DRAFT=0; SOUNDTRACK=""; FORCE_GEN=0
while [ $# -gt 0 ]; do
  case "$1" in
    --skip-draft) SKIP_DRAFT=1 ;;
    --soundtrack) SOUNDTRACK="$(cd "$(dirname "${2:?--soundtrack needs a file}")" && pwd)/$(basename "$2")"; shift ;;
    --music) [ "${2:-}" = generate ] || { echo "--music only accepts 'generate'"; exit 2; }; FORCE_GEN=1; shift ;;
    -*) echo "unknown option $1"; exit 2 ;;
    *) POS+=("$1") ;;
  esac
  shift
done
P="$(cd "${POS[0]:?usage: render.sh <project-dir> [format] [out.mp4] [--skip-draft] [--soundtrack f.wav] [--music generate]}" && pwd)"
F="${POS[1]:-16x9}"
OUT="${POS[2]:-$P/out/final.mp4}"
case "$OUT" in /*) ;; *) OUT="$PWD/$OUT" ;; esac
COMP="Story-$F"
QAJ=""; [ -f "$P/qa.json" ] && QAJ="$P/qa.json"
cd "$P"
mkdir -p out out/review public/audio "$(dirname "$OUT")"
WAV=public/audio/soundtrack.wav

echo "== 1/6 typecheck"; npx tsc --noEmit
echo "== 2/6 soundtrack"
if [ -n "$SOUNDTRACK" ] && [ $FORCE_GEN = 0 ]; then
  [ -f "$SOUNDTRACK" ] || { echo "no such soundtrack: $SOUNDTRACK"; exit 2; }
  [ "$SOUNDTRACK" -ef "$WAV" ] || cp "$SOUNDTRACK" "$WAV"; echo "   custom: $SOUNDTRACK"
elif [ -f audio/soundtrack.wav ] && [ $FORCE_GEN = 0 ]; then
  cp audio/soundtrack.wav "$WAV"; echo "   project track: audio/soundtrack.wav"
elif [ -f audio/score.py ] && [ $FORCE_GEN = 0 ]; then
  echo "   project score: audio/score.py"; python3 audio/score.py src/timeline.json "$WAV" --cues out/cues.json
else
  python3 "$M/audio/generate.py" src/timeline.json "$WAV" --cues out/cues.json
fi
VDUR=$(python3 -c "
import json,sys; sys.path.insert(0,'$M/audio'); from generate import windows
print(f'{windows(json.load(open(\"src/timeline.json\")))[1]:.3f}')")
ADUR=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$WAV")
python3 -c "import sys; v,a=float('$VDUR'),float('$ADUR'); print(f'   video {v:.2f}s, audio {a:.2f}s'); sys.exit(0 if a >= v - 0.05 else 1)" \
  || { echo "   soundtrack is shorter than the video; the mux would cut the picture (-shortest). Fix the track."; exit 1; }

if [ $SKIP_DRAFT = 0 ]; then
  echo "== 3/6 draft (half res)"; npx remotion render src/index.ts "$COMP" out/draft.mp4 --scale=0.5 --crf=28 --codec=h264 --muted --log=error
  echo "== 4/6 review images (from the draft)"; bash "$M/scripts/review.sh" out/draft.mp4 src/timeline.json out/review
fi
echo "== 5/6 final video (h264 crf17)"
npx remotion render src/index.ts "$COMP" out/video_noaudio.mp4 --codec=h264 --crf=17 --pixel-format=yuv420p --muted --log=error
echo "== 6/6 loudnorm mux (2-pass)"
J=$(ffmpeg -hide_banner -nostats -i "$WAV" -af loudnorm=I=-14:TP=-2.0:LRA=11:print_format=json -f null - 2>&1 | sed -n '/^{/,/^}/p')
g(){ echo "$J" | python3 -c "import json,sys;print(json.load(sys.stdin)['$1'])"; }
LN="loudnorm=I=-14:TP=-2.0:LRA=11:measured_I=$(g input_i):measured_TP=$(g input_tp):measured_LRA=$(g input_lra):measured_thresh=$(g input_thresh):offset=$(g target_offset):linear=true:print_format=summary"
ffmpeg -v error -y -i out/video_noaudio.mp4 -i "$WAV" -map 0:v:0 -map 1:a:0 -c:v copy \
  -af "$LN,aresample=48000" -c:a aac -b:a 192k -ar 48000 -ac 2 -shortest -movflags +faststart "$OUT"
if [ $SKIP_DRAFT = 1 ]; then echo "== review images (from the final)"; bash "$M/scripts/review.sh" "$OUT" src/timeline.json out/review; fi
echo "== QA${QAJ:+ ($QAJ)}"; bash "$M/scripts/qa.sh" "$OUT" "$QAJ"
echo "-> $OUT"
