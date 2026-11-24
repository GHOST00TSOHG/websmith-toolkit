// The one rAF loop. Every effect registers a ticker here; no effect calls requestAnimationFrame itself.
// The loop sleeps completely when nothing is awake, and stops while the tab is hidden.
import { probe } from "./perf.ts";

/** Returns true while it still has work to do; false puts the ticker to sleep until it is woken. */
export type TickFn = (dt: number, now: number) => boolean;

export interface TickerHandle {
  wake(): void;
  sleep(): void;
  remove(): void;
}

interface Slot {
  readonly order: number;
  readonly fn: TickFn;
  awake: boolean;
}

const MAX_DT = 0.05; // seconds: a long pause must not make things jump

const slots: Slot[] = [];
let raf = 0;
let last = -1;

// 60 fps cap: on 120 Hz screens every other vsync is skipped, which halves the canvas work and keeps
// the frame budget steady. The threshold sits well under 16.7 ms so 60 Hz screens never skip.
const MIN_FRAME_MS = 12;

function frame(now: number): void {
  raf = 0;
  if (last >= 0 && now - last < MIN_FRAME_MS) {
    raf = requestAnimationFrame(frame);
    return;
  }
  const dt = last < 0 ? 0 : Math.min(MAX_DT, (now - last) / 1000);
  last = now;
  let anyAwake = false;
  for (let i = 0; i < slots.length; i += 1) {
    const slot = slots[i];
    if (slot === undefined || !slot.awake) continue;
    let more: boolean;
    try {
      more = slot.fn(dt, now);
    } catch (err) {
      // A ticker that throws is dropped for good (never retried every frame) and the error is reported.
      slots.splice(i, 1);
      i -= 1;
      reportError(err);
      continue;
    }
    if (more) anyAwake = true;
    else slot.awake = false;
  }
  probe.frame(now, dt);
  if (anyAwake) schedule();
  else {
    last = -1;
    probe.sleeping();
  }
}

let halted = false;

/** Safe mode: stops the loop for the rest of the visit. */
export function haltAll(): void {
  halted = true;
  if (raf !== 0) cancelAnimationFrame(raf);
  raf = 0;
  for (const s of slots) s.awake = false;
}

function schedule(): void {
  if (raf !== 0 || document.hidden || halted) return;
  raf = requestAnimationFrame(frame);
}

document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    if (raf !== 0) cancelAnimationFrame(raf);
    raf = 0;
    last = -1; // resuming resets dt so nothing jumps
    probe.sleeping();
  } else if (slots.some((s) => s.awake)) {
    schedule();
  }
});

/** Registers a ticker. Lower `order` runs first (simulation before drawing). Starts awake. */
export function addTicker(order: number, fn: TickFn): TickerHandle {
  const slot: Slot = { order, fn, awake: true };
  let at = slots.length;
  while (at > 0 && (slots[at - 1]?.order ?? 0) > order) at -= 1;
  slots.splice(at, 0, slot);
  schedule();
  probe.tickers(slots.length);
  return {
    wake() {
      slot.awake = true;
      schedule();
    },
    sleep() {
      slot.awake = false;
    },
    remove() {
      const i = slots.indexOf(slot);
      if (i >= 0) slots.splice(i, 1);
      probe.tickers(slots.length);
    },
  };
}
