---
name: iphone-safari-touch-haptics
description: >-
  Use this when building touch controls, drag or pinch gestures, haptic
  feedback, or full-screen safe-area layouts for websites on iPhone Safari or
  Home Screen web apps.
---
# Touch and haptics on iPhone Safari

Use **Pointer Events** and the CSS **`touch-action`** property; no library is required. If you need combined drag and pinch gestures, you can add **@use-gesture/vanilla 10.3.1 (MIT)**, self-hosted from npm. Nothing needs installing on the Mac beyond the project itself.

## Input

Listen for `pointerdown`, `pointermove`, `pointerup` and **`pointercancel`** on the element that handles the gesture. Capture the pointer if moves should keep counting after the finger leaves the element. Don't also wire Touch Events to the same logic.

- For buttons and ordinary UI, use `touch-action: manipulation`, which removes the double-tap-to-zoom delay.
- For a custom canvas, map or joystick, use `touch-action: none` on that element only. Don't disable zoom for the whole page.
- Prefer `touch-action` over calling `preventDefault()` in `touchmove`. If you must call it, register the listener with `{ passive: false }`.

If you use @use-gesture, set `touch-action` on the draggable element (usually `none`), and call `destroy()` when the element is removed.

## Haptics

**`navigator.vibrate` doesn't exist in Safari or in iOS web views**, according to MDN's browser compatibility data. WebKit's official position on the Vibration API is that it opposes it. Feature-detect it so Android phones can use it, but never rely on it for iPhone.

The only official web haptic on iPhone is the system tick on `<input type="checkbox" switch>`, added in **iOS 18**. It plays only when the **user's own real tap** flips the switch. It's a single tick, not a pattern, and it doesn't fire during a drag. Since May 2026, WebKit requires a real, trusted tap, so **don't use `label.click()` or any other scripted click to fake a haptic**. A transparent label that the user actually taps can still trigger the tick. Test on a real iPhone.

## Layout

Add `viewport-fit=cover` to the viewport meta tag. Then pad the edges of the interface with `env(safe-area-inset-top)` (and the right, bottom and left versions), plus a fallback such as `0px`. Don't hard-code inset sizes in pixels.

- `svh` is the small viewport height, with the toolbars showing. It stays stable.
- `lvh` and `vh` are the large viewport height, with the toolbars hidden, so content can sit under the toolbar.
- `dvh` follows the visible viewport and can change size while the page scrolls.

Size a full-screen layout with `min-height: 100vh; min-height: 100dvh`. A Home Screen web app has no Safari toolbar, but still test it when the phone rotates and when the keyboard opens.
