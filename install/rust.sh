#!/usr/bin/env bash
# Install Rust via official rustup, minimal profile, without touching shell profiles or PATH.
# Writes ~/.cargo and ~/.rustup (this is rustup's layout; it is not kept under ~/builds).
# Idempotent. For Apple Silicon macOS. Usage: bash rust.sh
set -euo pipefail

[ "$(uname -s)" = Darwin ] || { echo "This installer is for macOS only." >&2; exit 1; }
[ "$(uname -m)" = arm64 ] || { echo "This installer is for Apple Silicon (arm64) only." >&2; exit 1; }
command -v curl >/dev/null 2>&1 || { echo "missing command: curl" >&2; exit 1; }
command -v shasum >/dev/null 2>&1 || { echo "missing command: shasum" >&2; exit 1; }

CARGO_BIN="${CARGO_HOME:-$HOME/.cargo}/bin"
INIT_URL="https://static.rust-lang.org/rustup/dist/aarch64-apple-darwin/rustup-init"
SUM_URL="${INIT_URL}.sha256"

echo "== rustup installer (minimal profile, --no-modify-path)"
echo "This writes files under ~/.cargo and ~/.rustup."
echo "It does not edit shell profiles and does not change PATH."

if [ -x "$CARGO_BIN/rustc" ] && [ -x "$CARGO_BIN/cargo" ] && [ -x "$CARGO_BIN/rustup" ]; then
  echo "Rust is already installed:"
  "$CARGO_BIN/rustc" --version
  "$CARGO_BIN/cargo" --version
  "$CARGO_BIN/rustup" --version
  echo
  echo "==== install summary ===="
  echo "cargo:   $CARGO_BIN"
  echo "rustup:  ${RUSTUP_HOME:-$HOME/.rustup}"
  echo "For this session only:"
  echo "  export PATH=\"$CARGO_BIN:\$PATH\""
  echo "done."
  exit 0
fi

TMP="$(mktemp -d "${TMPDIR:-/tmp}/rustup-init.XXXXXX")"
cleanup() { rm -rf "$TMP"; }
trap cleanup EXIT

echo "== downloading rustup-init (aarch64-apple-darwin)"
curl -fL --retry 3 --retry-delay 2 -o "$TMP/rustup-init" "$INIT_URL"
curl -fL --retry 3 --retry-delay 2 -o "$TMP/rustup-init.sha256" "$SUM_URL"
# Official file is: "<sha256>  rustup-init" or a path; compare the first field to our file.
EXPECT="$(awk '{print $1}' "$TMP/rustup-init.sha256")"
GOT="$(shasum -a 256 "$TMP/rustup-init" | awk '{print $1}')"
if [ "$GOT" != "$EXPECT" ]; then
  echo "checksum failed for rustup-init" >&2
  echo "  expected $EXPECT" >&2
  echo "  got      $GOT" >&2
  exit 1
fi
echo "   checksum ok"
chmod +x "$TMP/rustup-init"

echo "== running rustup-init"
"$TMP/rustup-init" -y --profile minimal --no-modify-path --default-toolchain stable

echo
echo "==== install summary ===="
echo "cargo:   $CARGO_BIN"
echo "rustup:  ${RUSTUP_HOME:-$HOME/.rustup}"
"$CARGO_BIN/rustc" --version
"$CARGO_BIN/cargo" --version
echo "For this session only (do not add this to a shell profile from this script):"
echo "  export PATH=\"$CARGO_BIN:\$PATH\""
echo "done."
