#!/usr/bin/env bash
# Review images for a render (PLAYBOOK step "Preview"):
#   <outdir>/sheet.png              1 frame per second, tile=6xN, timestamped (the contact sheet)
#   <outdir>/cut_<n>_<from>-<to>_<type>.png   close-ups every 0.1 s across each transition (+/- 0.3 s), from timeline.json
# Usage: review.sh <video.mp4> <timeline.json> <outdir>
set -euo pipefail
V="${1:?usage: review.sh <video.mp4> <timeline.json> <outdir>}"; TL="${2:?timeline.json}"; O="${3:?outdir}"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
mkdir -p "$O"; rm -f "$O"/sheet.png "$O"/cut_*.png
DUR=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$V")
ROWS=$(python3 -c "import math;print(max(1, math.ceil(math.floor(float('$DUR'))/6)))")
TS="drawtext=text='%{pts\:hms}':x=6:y=6:fontsize=18:fontcolor=white:box=1:boxcolor=black@0.6"
ffmpeg -v error -y -i "$V" -vf "fps=1,scale=480:-2,$TS,tile=6x$ROWS:padding=6:margin=6" -frames:v 1 -update 1 "$O/sheet.png"
echo "   sheet: $O/sheet.png (1 fps, 6x$ROWS)"
python3 "$HERE/cuts.py" "$TL" --pad 0.3 | while read -r n a b t s e cs ce; do
  N=$(python3 -c "import math;print(max(1, round((float('$ce')-float('$cs'))*10)))")
  R=$(( (N + 5) / 6 ))
  f="$O/cut_${n}_${a}-${b}_${t}.png"
  ffmpeg -v error -y -ss "$cs" -to "$ce" -i "$V" -copyts -vf "fps=10,scale=480:-2,$TS,tile=6x$R:padding=4:margin=4" -frames:v 1 -update 1 "$f"
  echo "   cut $n $a->$b ($t, ${s}-${e}s): $f ($N frames, every 0.1 s)"
done
