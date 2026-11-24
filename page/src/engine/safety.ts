// Degrade, never loop: repeated errors put the page into a static safe mode (every ticker stops and CSS
// animations end). Safe mode is one-way for the visit, so a failing effect can never restart itself.
import { haltAll } from "./loop.ts";

let errors = 0;
let first = 0;

export function enterSafeMode(): void {
  const root = document.documentElement;
  if (root.classList.contains("safe-mode")) return;
  root.classList.add("safe-mode");
  root.classList.remove("opening", "opening-live");
  haltAll();
}

export function mountSafety(): void {
  const count = (): void => {
    const now = performance.now();
    if (now - first > 5000) {
      first = now;
      errors = 0;
    }
    errors += 1;
    if (errors >= 3) enterSafeMode();
  };
  window.addEventListener("error", count);
  window.addEventListener("unhandledrejection", count);
}
