// Frame probes. With ?perf=1 the numbers are exposed on window.__perf for tests. No allocation per frame.
const RING = 120;
const times = new Float32Array(RING);
let count = 0;

export const stats = { frames: 0, running: false, tickers: 0, lastFrameMs: 0 };
/** Named counters that effects bump per drawn frame, so tests can prove one effect paused. */
export const counters: Record<string, number> = {};
export function bump(name: string): void {
  counters[name] = (counters[name] ?? 0) + 1;
}

export const perfEnabled = new URLSearchParams(location.search).get("perf") === "1";
if (perfEnabled) Reflect.set(window, "__perf", { stats, counters, percentile });

function percentile(p: number): number {
  const n = Math.min(count, RING);
  if (n === 0) return 0;
  const sorted = Array.from(times.subarray(0, n)).sort((a, b) => a - b);
  return sorted[Math.min(n - 1, Math.floor(p * n))] ?? 0;
}

let previous = 0;
export const probe = {
  frame(now: number, dt: number): void {
    stats.frames += 1;
    stats.running = true;
    if (previous > 0 && dt > 0) {
      stats.lastFrameMs = now - previous;
      times[count % RING] = stats.lastFrameMs;
      count += 1;
    }
    previous = now;
  },
  sleeping(): void {
    stats.running = false;
    previous = 0;
  },
  tickers(n: number): void {
    stats.tickers = n;
  },
};

/** Rolling average of the last 60 frame times, in ms. Used by the quality tiers. */
export function averageFrameMs(): number {
  const n = Math.min(count, 60);
  if (n < 60) return 0;
  let sum = 0;
  for (let i = 1; i <= n; i += 1) sum += times[(count - i + RING * 2) % RING] ?? 0;
  return sum / n;
}
