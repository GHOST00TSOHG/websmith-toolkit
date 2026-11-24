#!/bin/sh
# find-my-login.sh: says whether Claude Code and Codex are signed in on THIS computer.
#
# Run by the owner's own Websmith bot, on the owner's own machine, only when the owner taps
# "Find my login" on the Websmith page. Prints exactly one JSON line, for example:
#   {"claude":"signed-in","codex":"not-installed"}
# Each value is signed-in, signed-out or not-installed.
#
# What it does: if a command exists, it runs `claude auth status` / `codex login status` with a short
# time limit, throws away everything the command prints, and keeps only its exit status
# (0 = signed in; anything else, or no answer in time, = signed out).
# What it never does: read, print, copy or send tokens, config or credential files (~/.claude,
# ~/.codex, keychains), environment variables, or the commands' own output. It writes no files and
# makes no network calls of its own.
set -u
LC_ALL=C
export LC_ALL

LIMIT=10 # seconds per check

# Runs a command with stdin closed and all output discarded; returns only its exit status.
# A watcher stops it after LIMIT seconds.
check() {
  "$@" </dev/null >/dev/null 2>&1 &
  pid=$!
  (sleep "$LIMIT"; kill -TERM "$pid" 2>/dev/null) </dev/null >/dev/null 2>&1 &
  watcher=$!
  wait "$pid"
  status=$?
  kill -TERM "$watcher" 2>/dev/null
  wait "$watcher" 2>/dev/null
  return "$status"
}

state() {
  tool=$1
  shift
  if ! command -v "$tool" >/dev/null 2>&1; then
    printf 'not-installed'
  elif check "$tool" "$@"; then
    printf 'signed-in'
  else
    printf 'signed-out'
  fi
}

claude_state=$(state claude auth status)
codex_state=$(state codex login status)
printf '{"claude":"%s","codex":"%s"}\n' "$claude_state" "$codex_state"
