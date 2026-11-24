// Staged boot: first paint is static and light; heavy layers (the opening, the orb, the cloth)
// start one at a time after the page has loaded and gone idle. Phones (iOS WebKit has a tight memory
// and GPU budget per tab) get longer gaps between stages.

const phone = matchMedia("(pointer: coarse)").matches || window.innerWidth < 760;
const loaded = new Promise<void>((resolve) => {
  if (document.readyState === "complete") resolve();
  else window.addEventListener("load", () => resolve(), { once: true });
});
const frame = (): Promise<void> => new Promise((resolve) => requestAnimationFrame(() => resolve()));

let chain: Promise<void> = loaded.then(frame).then(frame);

/** Runs `task` after load and after every earlier stage, `gapMs` later (doubled on phones). */
export function stage(gapMs: number, task: () => unknown): void {
  chain = chain.then(
    () =>
      new Promise<void>((resolve) => {
        window.setTimeout(() => {
          try {
            const r = task();
            if (r instanceof Promise) void r.catch(() => undefined);
          } catch {
            // A stage that fails never blocks the next one.
          }
          resolve();
        }, phone ? gapMs * 2 : gapMs);
      }),
  );
}

/** Holds every later stage until `gate` settles (the opening owns the screen until then). */
export function holdStagesUntil(gate: Promise<unknown>): void {
  chain = chain.then(() => gate.then(() => undefined, () => undefined));
}

export const isPhone = phone;
