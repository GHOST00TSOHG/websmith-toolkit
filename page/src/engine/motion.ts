// The page's one motion language, shared by CSS (tokens.css) and JS. Everything that moves uses EASE;
// the few moments that should overshoot use SPRING. Keep these strings identical to --ease and --spring.
export const EASE = "cubic-bezier(0.22, 1, 0.36, 1)";
export const SPRING =
  "linear(0, 0.135, 0.417, 0.708, 0.933, 1.067, 1.122, 1.121, 1.091, 1.053, 1.02, 0.998, 0.987, 0.984, 0.987, 0.991, 0.996, 0.999, 1.001, 1.002, 1.002, 1.001, 1.001, 1, 1)";

/** Durations in ms, matching --t-1..--t-4. */
export const T1 = 180;
export const T2 = 320;
export const T3 = 560;
export const T4 = 900;

// cubic-bezier(0.22, 1, 0.36, 1) solved for y(x): Newton steps with a bisection fallback.
const X1 = 0.22;
const Y1 = 1;
const X2 = 0.36;
const Y2 = 1;
const bez = (t: number, a: number, b: number): number => {
  const u = 1 - t;
  return 3 * u * u * t * a + 3 * u * t * t * b + t * t * t;
};
const bezD = (t: number, a: number, b: number): number => {
  const u = 1 - t;
  return 3 * u * u * a + 6 * u * t * (b - a) + 3 * t * t * (1 - b);
};

/** The shared ease, for per-frame code. Input and output are 0..1. */
export function ease(x: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  let t = x;
  for (let i = 0; i < 6; i += 1) {
    const d = bezD(t, X1, X2);
    if (Math.abs(d) < 1e-6) break;
    const nt = t - (bez(t, X1, X2) - x) / d;
    if (nt < 0 || nt > 1) break;
    t = nt;
  }
  if (Math.abs(bez(t, X1, X2) - x) > 1e-4) {
    let lo = 0;
    let hi = 1;
    for (let i = 0; i < 24; i += 1) {
      t = (lo + hi) / 2;
      if (bez(t, X1, X2) < x) lo = t;
      else hi = t;
    }
  }
  return bez(t, Y1, Y2);
}

/** Critically damped follow, frame-rate independent: moves `value` toward `target` with velocity state. */
export function follow(value: number, velocity: number, target: number, omega: number, dt: number): [number, number] {
  const x = omega * dt;
  const exp = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);
  const change = value - target;
  const temp = (velocity + omega * change) * dt;
  return [target + (change + temp) * exp, (velocity - omega * temp) * exp];
}

/** True when the user asked the system for less motion. */
export function prefersReducedMotion(): boolean {
  return matchMedia("(prefers-reduced-motion: reduce)").matches;
}
