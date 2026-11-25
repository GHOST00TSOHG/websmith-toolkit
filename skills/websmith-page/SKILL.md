---
name: websmith-page
description: >-
  Use this when your owner opens the public Websmith page: connecting it to
  you through a webhook, answering its find-my-login request with the local
  helper, and the privacy rules for doing that.
---
# The Websmith page and your webhook

The Websmith page is one public, static page that lists this toolkit. Every owner opens the same page, called PAGE_URL below. It is a placeholder until GitHub Pages is turned on for this repository; then it is the repository's Pages address (`<github-user>.github.io/websmith-toolkit/`, over https).

Everything an owner sets there (name, theme, your webhook address and key, the AI tools they connected) is kept only in their own browser. The page has no server, no analytics and no cookies. Its only network call is to the webhook the owner pastes, which is you.

## Connecting the owner's page to you

1. Send the owner a private setup link (next section). It fills in your webhook address and a key made just for the page. If they would rather type them, they can paste both under **Settings > Connect your bot** (**Webhook address** and **Key**), then **Save**.
2. Apart from the private setup link, never put the key in a URL, a query string, a chat log or a file in a repository. The page sends it only as `Authorization: Bearer <key>`.
3. The page accepts `https://` only (`http://localhost` for testing). Allow CORS for the page's origin:
   - `Access-Control-Allow-Origin: https://<github-user>.github.io` (not `*`)
   - `Access-Control-Allow-Headers: authorization, content-type`
   - `Access-Control-Allow-Methods: POST, OPTIONS`; answer the `OPTIONS` preflight with 204, and send the same headers on errors.

## The private setup link

1. Build it: `PAGE_URL + "#setup=" + base64url(JSON)`, where the JSON is exactly `{"webhook":"https://...","key":"..."}` (UTF-8, base64url, padding optional).
2. Send it **only to your own owner, in a private channel**. Never post it publicly, in a repository, an issue, a log or a group chat.
3. Tell the owner: "This link is private. It contains your key. Don't share it." Opening it saves the bot in their browser; the page removes the `#setup=` part from the address at once and shows "Your bot is connected." (or "That setup link didn't work.").
4. If the key or the link may have leaked, rotate the key and send a new link.

Every request is a JSON `POST` with `{ "v": 1, "op": "...", "requestId": "<uuid>" }`. Answer `{ "v": 1, "ok": true, "data": { ... } }` or `{ "v": 1, "ok": false, "error": { "code": "...", "message": "short, plain words" } }`. Treat a repeated `requestId` as the same request.

## find-my-login

The owner taps **Find my login**. The page sends:

```json
{ "v": 1, "op": "find-my-login", "requestId": "1b4e..." }
```

You run the helper from this repository on the owner's own computer and reply with its one line as `data`:

```sh
sh page/helper/find-my-login.sh
# {"claude":"signed-in","codex":"not-installed"}
```

```json
{ "v": 1, "ok": true, "data": { "claude": "signed-in", "codex": "not-installed" } }
```

Each value is `signed-in`, `signed-out` or `not-installed`. Without a webhook, the page shows the owner a message to send you ("Run the find-my-login helper ... and send me the one line it prints"); reply with just that line so they can paste it back.

When the owner then chooses **Connect** for a signed-in tool, the page sends `{ "op": "connect-agent", "agent": "claude" | "codex" }`. Record the choice and reply `{ "ok": true, "data": {} }`.

## Rules

- Run the helper only on the owner's own machine, and only when the owner asked (a `find-my-login` request or their own message). Never on a schedule, never on someone else's machine.
- Never read, print, copy or send tokens, passwords, config or credential files (`~/.claude`, `~/.codex`, keychains) or environment variables. The helper keeps only exit codes; do the same. Return its line and nothing else.
- Never sign the owner in yourself. If nothing is signed in, the page asks the owner "Connect through Terminal?" and, only if they say yes, shows them the command to run themselves (`claude`, then `/login`; or `codex login`).
- Do not ask the owner for their webhook key in chat once it is set up, and never echo it back.
