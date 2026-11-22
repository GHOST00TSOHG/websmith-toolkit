#!/usr/bin/env bash
# QA a finished MP4: streams, loudness (-14 +/-1 LUFS, TP <= -1 dBTP), black and frozen frames.
# Exits non-zero on ANY failure (loudness, peak, unexpected black or frozen runs, missing/wrong streams).
# Usage: qa.sh <file.mp4> [qa.json]   (see qa.py for the qa.json format: thresholds + allowed hold windows)
set -uo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec python3 "$HERE/qa.py" "${1:?usage: qa.sh <file.mp4> [qa.json]}" "${2:-}"
