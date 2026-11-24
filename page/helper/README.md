# Find my login helper

`find-my-login.sh` tells the Websmith page whether Claude Code and Codex are signed in on your computer. A web page cannot see what is installed on your machine, so your own Websmith bot runs this script for you, on your computer, and passes back its one-line answer.

```sh
sh page/helper/find-my-login.sh
# {"claude":"signed-in","codex":"not-installed"}
```

Each value is `signed-in`, `signed-out` or `not-installed`.

## What it does

- Checks whether the `claude` and `codex` commands exist.
- If one exists, runs `claude auth status` or `codex login status` with a 10-second limit.
- Throws away everything those commands print and keeps only the exit status (0 means signed in).
- Prints one JSON line. Nothing else.

## What it never does

- Read, print, copy or send tokens, passwords, config or credential files (`~/.claude`, `~/.codex`, keychains), or environment variables.
- Keep the commands' own output.
- Write files or make network calls of its own.
- Sign you in. Signing in is always something you do yourself in Terminal (`claude`, then `/login`; or `codex login`).

## When it runs

Only when you tap **Find my login** on the Websmith page, and only on your own computer. Nothing is detected automatically. The bot rules are in `skills/websmith-page/SKILL.md`.

POSIX `sh`, for macOS and Linux.
