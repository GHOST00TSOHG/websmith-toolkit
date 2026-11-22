---
name: installable-pwa
description: >-
  Use this when making a website installable to the iPhone Home Screen as a
  Progressive Web App, with offline caching, Web Push, and app badges,
  especially on Cloudflare Pages.
---
# Installable PWAs (iPhone + Cloudflare Pages)

A Progressive Web App is an HTTPS site with a manifest, a service worker for offline use and, optionally, Web Push. On iPhone, people install it themselves from Safari: Share > **Add to Home Screen** > **Open as Web App**. iOS has no `beforeinstallprompt` event to trigger an install prompt. You don't need Xcode or an Apple Developer Program membership, even for Web Push.

On iOS 26, every site added to the Home Screen opens as a web app by default; the user can turn that off and get a plain bookmark instead. A manifest is still worth shipping for the name, icons, theme colour and start URL. A Home Screen web app has no Safari toolbar, so give it its own navigation.

## Manifest and icons

Link `/manifest.webmanifest` from every page. Include `name` and `short_name`, `start_url`, `scope`, `display: "standalone"`, `theme_color`, PNG icons at 192 and 512 px, and a 180x180 `apple-touch-icon`. Self-host every file.

To tell whether the site is running as an installed app, check `window.matchMedia("(display-mode: standalone)").matches` or `navigator.standalone`. Don't assume iOS 26 follows the manifest's `display` value.

## Service worker and Workbox

Register `/sw.js` at the site root with scope `/`. Cache the app's core files ahead of time and provide an offline fallback page. **Workbox 7.4.1 (MIT)** is the recommended toolkit. Add `workbox-cli` as a project devDependency and self-host its output; never load it from a CDN. Use `generateSW` for a simple caching-only worker. If you also need Web Push, use **`injectManifest`** or write the worker by hand.

On Cloudflare Pages, put a `_headers` file in the build output that serves `/sw.js` with `Cache-Control: no-cache`. Make sure a broader cache rule or the single-page-app HTML fallback doesn't catch `/sw.js`.

## Web Push on iOS

Web Push works only in a **Home Screen web app** on **iOS 16.4 or later**. Ask for permission from a Subscribe button the user taps, then call `pushManager.subscribe({ userVisibleOnly: true, applicationServerKey })`. Safari has **no silent push**: show a notification right away for every push, or Safari revokes the site's permission. Payloads are limited to 4 KB. Send them with VAPID to the subscription endpoint, which should be on `*.push.apple.com`.

On iOS 18.4 or later, prefer **Declarative Web Push**. You can subscribe with `window.pushManager`, then send JSON with `"web_push": 8030`, a `notification.title` and `notification.navigate`. A service worker is then optional for showing the notification.

Set or clear the number badge on the app icon with `navigator.setAppBadge` and `clearAppBadge`.
