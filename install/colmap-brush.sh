#!/usr/bin/env bash
# Install COLMAP 4.2.1 and Brush 0.3.0 into ~/builds/splat-tools on Apple Silicon macOS.
# Idempotent. Verifies published SHA-256 checksums. Does not edit shell profiles or PATH.
# Usage: bash colmap-brush.sh
# Optional: SPLAT_TOOLS_PREFIX=/path/to/splat-tools bash colmap-brush.sh
set -euo pipefail

PREFIX="${SPLAT_TOOLS_PREFIX:-$HOME/builds/splat-tools}"
COLMAP_VERSION="4.2.1"
BRUSH_VERSION="0.3.0"
COLMAP_ZIP="colmap-arm64-macos.zip"
BRUSH_TAR="brush-app-aarch64-apple-darwin.tar.xz"
COLMAP_URL="https://github.com/colmap/colmap/releases/download/${COLMAP_VERSION}/${COLMAP_ZIP}"
BRUSH_URL="https://github.com/ArthurBrussee/brush/releases/download/v${BRUSH_VERSION}/${BRUSH_TAR}"
COLMAP_SHA256="1fe9d65bddd61e0598f3087641cb14c4d4d4c74529e9f58911e8a5238a140a04"
BRUSH_SHA256="65b2631398c839be3c1d4d7160fe2326389dec87830aac0710985e6690a1048c"
COLMAP_COPYING_URL="https://raw.githubusercontent.com/colmap/colmap/${COLMAP_VERSION}/COPYING.txt"
BRUSH_LICENSE_URL="https://raw.githubusercontent.com/ArthurBrussee/brush/v${BRUSH_VERSION}/LICENSE"

need_cmd() { command -v "$1" >/dev/null 2>&1 || { echo "missing command: $1" >&2; exit 1; }; }

echo "== splat-tools installer (COLMAP ${COLMAP_VERSION} + Brush ${BRUSH_VERSION})"

[ "$(uname -s)" = Darwin ] || { echo "This installer is for macOS only." >&2; exit 1; }
[ "$(uname -m)" = arm64 ] || { echo "This installer is for Apple Silicon (arm64) only." >&2; exit 1; }
need_cmd curl
need_cmd shasum
need_cmd unzip
need_cmd tar
need_cmd mkdir

mkdir -p "$PREFIX/downloads" "$PREFIX/bin" "$PREFIX/colmap" "$PREFIX/licenses"
DOWN="$PREFIX/downloads"

fetch() {
  # fetch <url> <dest> <sha256>
  local url="$1" dest="$2" expect="$3"
  if [ -f "$dest" ]; then
    local got
    got="$(shasum -a 256 "$dest" | awk '{print $1}')"
    if [ "$got" = "$expect" ]; then
      echo "   already have $(basename "$dest") (checksum ok)"
      return 0
    fi
    echo "   $(basename "$dest") checksum mismatch; re-downloading"
    rm -f "$dest"
  fi
  echo "   downloading $(basename "$dest")"
  curl -fL --retry 3 --retry-delay 2 -o "$dest" "$url"
  local got
  got="$(shasum -a 256 "$dest" | awk '{print $1}')"
  if [ "$got" != "$expect" ]; then
    echo "checksum failed for $(basename "$dest")" >&2
    echo "  expected $expect" >&2
    echo "  got      $got" >&2
    rm -f "$dest"
    exit 1
  fi
  echo "   checksum ok"
}

echo "== COLMAP ${COLMAP_VERSION}"
fetch "$COLMAP_URL" "$DOWN/$COLMAP_ZIP" "$COLMAP_SHA256"
APP="$PREFIX/colmap/COLMAP.app"
BIN_COLMAP="$APP/Contents/MacOS/colmap"
if [ -x "$BIN_COLMAP" ]; then
  echo "   COLMAP.app already extracted"
else
  echo "   extracting COLMAP.app"
  rm -rf "$PREFIX/colmap"
  mkdir -p "$PREFIX/colmap"
  TMP="$(mktemp -d "${TMPDIR:-/tmp}/colmap.XXXXXX")"
  unzip -q "$DOWN/$COLMAP_ZIP" -d "$TMP"
  INNER="$(find "$TMP" -name 'COLMAP-mac.zip' -o -name 'COLMAP.app' | head -n 1)"
  if [ -z "$INNER" ]; then
    echo "COLMAP archive layout unexpected. Contents:" >&2
    find "$TMP" -maxdepth 3 -print >&2
    rm -rf "$TMP"
    exit 1
  fi
  if [ -d "$INNER" ]; then
    mv "$INNER" "$PREFIX/colmap/COLMAP.app"
  else
    unzip -q "$INNER" -d "$TMP/inner"
    FOUND="$(find "$TMP/inner" -name 'COLMAP.app' -type d | head -n 1)"
    [ -n "$FOUND" ] || { echo "COLMAP.app missing from inner zip" >&2; rm -rf "$TMP"; exit 1; }
    mv "$FOUND" "$PREFIX/colmap/COLMAP.app"
  fi
  rm -rf "$TMP"
  [ -x "$BIN_COLMAP" ] || { echo "extracted COLMAP.app is missing $BIN_COLMAP" >&2; exit 1; }
fi

echo "== Brush ${BRUSH_VERSION}"
fetch "$BRUSH_URL" "$DOWN/$BRUSH_TAR" "$BRUSH_SHA256"
BRUSH_BIN="$PREFIX/brush-app-aarch64-apple-darwin/brush_app"
if [ -x "$BRUSH_BIN" ]; then
  echo "   Brush already extracted"
else
  echo "   extracting Brush"
  rm -rf "$PREFIX/brush-app-aarch64-apple-darwin"
  tar -xJf "$DOWN/$BRUSH_TAR" -C "$PREFIX"
  [ -x "$BRUSH_BIN" ] || { echo "extracted Brush is missing $BRUSH_BIN" >&2; exit 1; }
  chmod +x "$BRUSH_BIN"
fi

echo "== wrappers"
cat > "$PREFIX/bin/colmap" <<'WRAP'
#!/bin/bash
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
exec "$ROOT/colmap/COLMAP.app/Contents/MacOS/colmap" "$@"
WRAP
cat > "$PREFIX/bin/brush" <<'WRAP'
#!/bin/bash
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
exec "$ROOT/brush-app-aarch64-apple-darwin/brush_app" "$@"
WRAP
chmod +x "$PREFIX/bin/colmap" "$PREFIX/bin/brush"

if [ -z "${SKIP_LICENSE_FETCH:-}" ]; then
  echo "== licences"
  curl -fsSL "$COLMAP_COPYING_URL" -o "$PREFIX/licenses/COLMAP-COPYING.txt" || echo "   could not fetch COLMAP COPYING.txt (non-fatal)"
  if [ -f "$PREFIX/brush-app-aarch64-apple-darwin/LICENSE" ]; then
    cp "$PREFIX/brush-app-aarch64-apple-darwin/LICENSE" "$PREFIX/licenses/BRUSH-LICENSE"
  else
    curl -fsSL "$BRUSH_LICENSE_URL" -o "$PREFIX/licenses/BRUSH-LICENSE" || echo "   could not fetch Brush LICENSE (non-fatal)"
  fi
fi

if command -v xattr >/dev/null 2>&1; then
  echo "== clearing quarantine xattr on $PREFIX only"
  xattr -dr com.apple.quarantine "$PREFIX" 2>/dev/null || true
fi

echo
echo "==== install summary ===="
echo "prefix:  $PREFIX"
echo "COLMAP:  $COLMAP_VERSION  (New BSD / BSD-3; third-party libs in the app bundle may use other licences)"
echo "Brush:   $BRUSH_VERSION   (Apache License 2.0)"
echo "wrappers are not on PATH. Call them by full path, or for this session only:"
echo "  export PATH=\"$PREFIX/bin:\$PATH\""
if [ -x "$PREFIX/bin/colmap" ]; then
  echo -n "colmap version: "
  "$PREFIX/bin/colmap" version 2>/dev/null || echo "(could not run; open the app once if Gatekeeper blocked it)"
fi
if [ -x "$PREFIX/bin/brush" ]; then
  echo -n "brush version:  "
  "$PREFIX/bin/brush" --version 2>/dev/null || echo "(could not run)"
fi
echo "done."
