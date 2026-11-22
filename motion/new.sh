#!/usr/bin/env bash
# Usage: ./new.sh <name> [--preset starter]
# Copies the Remotion template into projects/<name> and symlinks node_modules from the template (no reinstall; ~1 s).
# --preset <p> then overlays presets/<p>/ (tokens, components, starter scenes, timeline, handoff, qa.json, SCRIPT.md).
# Run `npm install` inside the project only if it needs extra deps (delete the node_modules symlink first).
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
NAME=""; PRESET=""
while [ $# -gt 0 ]; do
  case "$1" in
    --preset) PRESET="${2:?--preset needs a name (available: $(ls "$ROOT/presets" | tr '\n' ' '))}"; shift ;;
    --preset=*) PRESET="${1#--preset=}" ;;
    -*) echo "unknown option $1"; exit 1 ;;
    *) NAME="$1" ;;
  esac
  shift
done
[ -n "$NAME" ] || { echo "usage: new.sh <name> [--preset starter]"; exit 1; }
[[ "$NAME" =~ ^[a-zA-Z0-9._-]+$ ]] || { echo "name must be [a-zA-Z0-9._-]"; exit 1; }
SRC="$ROOT/template"
DST="$ROOT/projects/$NAME"
[ -e "$DST" ] && { echo "exists: $DST"; exit 1; }
[ -d "$SRC/node_modules" ] || { echo "template deps missing: cd $SRC && npm install"; exit 1; }
if [ -n "$PRESET" ]; then [ -d "$ROOT/presets/$PRESET" ] || { echo "no preset '$PRESET' (available: $(ls "$ROOT/presets" | tr '\n' ' '))"; exit 1; }; fi
mkdir -p "$DST" && (cd "$SRC" && tar cf - --exclude=./node_modules --exclude=./out .) | (cd "$DST" && tar xf -)
if [ -n "$PRESET" ]; then
  (cd "$ROOT/presets/$PRESET" && tar cf - --exclude=./PRESET.md .) | (cd "$DST" && tar xf -)
  echo "Applied preset: $PRESET (see $ROOT/presets/$PRESET/PRESET.md)"
fi
ln -s "$SRC/node_modules" "$DST/node_modules"
mkdir -p "$DST/out"
sed -i "s/\"name\": \"motion-template\"/\"name\": \"motion-$NAME\"/" "$DST/package.json"
echo "Created $DST"
echo "Next: write SCRIPT.md + src/timeline.json first, then: cd $DST && npx remotion studio   (see $ROOT/PLAYBOOK.md)"
