---
name: production-ops
description: Running the bot reliably and safely: configuration and secrets, structured logging, health checks, deployment (systemd, Docker, Raspberry Pi/VPS), updates, security hardening and networking considerations. Use when deploying, securing or monitoring the bot.
---

# Running the Bot in Production

## Where it runs
The bot must be always online: a cheap VPS, a Raspberry Pi at home, or an old PC.
Chat clients never connect to the bot directly; both talk to the chat server.

## Configuration and secrets
- Twelve-factor style: all config from environment variables (`code/.env.example`).
- Load `.env` locally with `python-dotenv`; in production use systemd
  `EnvironmentFile=` or Docker secrets.
- `.env` goes in `.gitignore`. If a key ever lands in git or a chat, revoke it.
- Validate config at startup (pydantic-settings) and fail fast with a clear error.

## Logging
- Use `logging`, never `print`, with a level from `LOG_LEVEL`.
- JSON logs for servers (one object per line: time, level, conversation, latency_ms,
  tokens) make problems searchable.
- Never log API keys or full message contents if the chat is private.
- `log.exception(...)` inside `except` records the traceback.

## systemd service (Linux / Raspberry Pi)
```ini
# /etc/systemd/system/mybot.service
[Unit]
Description=My AI bot
After=network-online.target

[Service]
WorkingDirectory=/opt/mybot/code
EnvironmentFile=/opt/mybot/.env
ExecStart=/opt/mybot/.venv/bin/python -m botcore.adapters.<your_adapter>
Restart=always
RestartSec=5
User=mybot
NoNewPrivileges=true

[Install]
WantedBy=multi-user.target
```
`sudo systemctl enable --now mybot` · logs: `journalctl -u mybot -f`

## Docker (alternative)
Slim base image, non-root user, `restart: unless-stopped`, config through env vars.

## Health and monitoring
- `/ping` and `/uptime` are built-in liveness checks.
- Add a heartbeat: write a timestamp every minute and alert if it goes stale
  (e.g. a free uptime-ping service).
- Track per day: messages handled, LLM calls, tokens, errors.

## Security checklist
- [ ] Secrets only in env vars; nothing sensitive in the system prompt
- [ ] Admin commands checked in code (`msg.author == cfg.owner`)
- [ ] Per-user rate limits on, and `ignore_bots` on (bots replying to bots can run up bills)
- [ ] Tool inputs validated and allow-listed (no arbitrary shell/file access)
- [ ] Spending cap set in the AI provider's console
- [ ] Dependencies pinned; update monthly (`pip list --outdated`)

## Networking note
Public Wi-Fi often blocks unusual ports, so if you self-host the chat server, run
it on standard ports (443, or 6697 for IRC over TLS).

Part of `kits/bot-learning-kit`. Code paths in this skill (such as `code/...`) are relative to that folder.
