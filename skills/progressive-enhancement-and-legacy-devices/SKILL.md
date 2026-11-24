---
name: progressive-enhancement-and-legacy-devices
description: Building web experiences that work on old and constrained devices and degrade gracefully everywhere: HTML-first forms, server rendering, tiny CSS, no-JS paths, legacy TLS, feature detection and resilient networking. Use for low-end or old devices, flaky networks, or any "works everywhere" requirement.
---

# Progressive Enhancement & Legacy Devices

Reference: `code/site/lite.html` (under 1 KB, no JavaScript, tested with JS
disabled) and `@supports` patterns in `styles.css`.

## The layered model
1. **HTML:** content plus real links and `<form method="post">`. Works on any browser
   since the 1990s.
2. **CSS:** layout and look. Old browsers ignore what they don't understand.
3. **JS:** enhancement only (live updates, optimistic UI), and feature-detected.
The modern showcase and the lite page share the same approach; the lite page
just stops at layer 1.5.

## Supporting genuinely old browsers
- **TLS:** old mobile browsers can lack modern ciphers, TLS 1.2+ and current
  root certificates. Test the handshake early (`openssl s_client`, SSL Labs). Where
  you control the server, a compatible TLS profile on a dedicated hostname
  is safer than weakening your main site.
- **HTML/CSS:** basic forms, simple CSS (no reliance on flex/grid or custom
  properties), system fonts, 16px inputs, and a simple viewport meta.
- **Interactivity without JS:** Post/Redirect/Get forms. Use
  `<meta http-equiv="refresh">` only where periodic refresh is truly needed.
- **Keep it tiny:** under about 10 KB per page; no web fonts; cache aggressively; gzip.

## Resilience patterns for modern clients
- Feature detection (`@supports`, `'startViewTransition' in document`), never
  user-agent sniffing.
- Offline: service worker caching for the app shell; queue writes in IndexedDB.
- Networks: timeouts, retries with exponential backoff and jitter, optimistic UI
  with reconciliation.
- Test with JS disabled, CSS disabled, slow-3G throttling, and 320px width.

## Server side
Render HTML on the server (for example FastAPI or Flask with Jinja templates). The
same endpoints can serve a modern page (JSON plus enhancement) and a lite page
(plain HTML).

## Exercises
1. Turn `lite.html` into a server-rendered template with a Post/Redirect/Get form.
2. Check your server's TLS against an old client profile and document a
   compatible configuration.
3. Add a service-worker offline queue to the modern page.

Part of `kits/advanced-web-ui-kit`. Code paths in this skill (such as `code/...`) are relative to that folder.
