// Shut down and Wake. Shut down folds the page into the glowing hex mark (opacity and scale only) and
// shows the Wake button. Wake brings the page back: with motion, the opening plays again (the cursors
// redraw what is on screen and the sheet opens); with reduced motion, a plain cross-fade.
import { prefersReducedMotion } from "../engine/motion.ts";
import { playOpening } from "../opening/opening.ts";

export function mountPower(seed: number): void {
  const root = document.documentElement;
  const screen = document.getElementById("power-screen");
  const wakeBtn = document.getElementById("wake");
  const powerBtn = document.getElementById("shutdown");
  if (screen === null || wakeBtn === null || powerBtn === null) return;
  const parts = [...document.querySelectorAll<HTMLElement>(".site-head, #main, .footer, .sync-status")];
  let down = false;

  const shutdown = (): void => {
    if (down) return;
    down = true;
    root.dataset["stage"] = "down";
    const origin = `50% ${Math.round(window.scrollY + window.innerHeight * 0.42)}px`;
    for (const el of parts) {
      el.style.setProperty("transform-origin", el.id === "main" ? origin : "50% 50%");
      el.classList.add("powered-off");
    }
    screen.hidden = false;
    requestAnimationFrame(() => screen.classList.add("on"));
    window.setTimeout(() => wakeBtn.focus(), 400);
  };

  const wake = (): void => {
    if (!down) return;
    down = false;
    screen.classList.remove("on");
    screen.classList.add("waking");
    window.setTimeout(() => {
      screen.hidden = true;
      screen.classList.remove("waking");
    }, 700);
    for (const el of parts) el.classList.remove("powered-off");
    if (prefersReducedMotion()) root.dataset["stage"] = "live";
    else void playOpening({ quick: true, seed: seed + 1 });
    window.setTimeout(() => powerBtn.focus({ preventScroll: true }), 900);
  };

  powerBtn.addEventListener("click", shutdown);
  wakeBtn.addEventListener("click", wake);
  document.addEventListener("keydown", (e) => {
    if (down && (e.key === "Escape" || e.key === "Enter")) wake();
  });
}
