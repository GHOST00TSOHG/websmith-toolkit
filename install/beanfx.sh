#!/usr/bin/env bash
# Enable the baenv/beanfx Claude Code plugin at project scope by writing .claude/settings.json.
# Does not install Rust; run install/rust.sh first if cargo is missing.
# Does not edit shell profiles or PATH.
# Usage: bash beanfx.sh [project-dir]
# project-dir defaults to the current directory. The project folder should live under ~/builds/<name>.
set -euo pipefail

PROJECT="${1:-.}"
PROJECT="$(cd "$PROJECT" && pwd)"
SETTINGS="$PROJECT/.claude/settings.json"

echo "== beanfx project plugin (baenv/beanfx)"
echo "project: $PROJECT"
echo "This writes $SETTINGS and does not change PATH or shell profiles."

mkdir -p "$PROJECT/.claude"

python3 - "$SETTINGS" <<'PY'
import json, sys
from pathlib import Path
path = Path(sys.argv[1])
data = {}
if path.exists():
    data = json.loads(path.read_text())
    if not isinstance(data, dict):
        sys.exit(f"{path} is not a JSON object")

markets = data.setdefault("extraKnownMarketplaces", {})
markets["beanfx"] = {"source": {"source": "github", "repo": "baenv/beanfx"}}
enabled = data.setdefault("enabledPlugins", {})
enabled["beanfx@beanfx"] = True
path.write_text(json.dumps(data, indent=2) + "\n")
print(f"wrote {path}")
PY

CARGO_BIN="${CARGO_HOME:-$HOME/.cargo}/bin"
echo
echo "==== install summary ===="
echo "settings: $SETTINGS"
echo "plugin:   beanfx@beanfx from GitHub baenv/beanfx (see that repo for its licence)"
echo "Rust for this session only:"
echo "  export PATH=\"$CARGO_BIN:\$PATH\""
if [ -x "$CARGO_BIN/cargo" ]; then
  echo -n "cargo:    "
  "$CARGO_BIN/cargo" --version
else
  echo "cargo was not found in $CARGO_BIN."
  echo "Run install/rust.sh first, then export PATH as above before using beanfx."
fi
echo "Open this folder as a Claude Code project so the plugin can load from .claude/settings.json."
echo "done."
