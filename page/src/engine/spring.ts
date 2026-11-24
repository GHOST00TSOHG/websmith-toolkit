// Spring solver sampled into a CSS linear() easing, so springs run on the compositor via WAAPI.
export interface SpringSpec {
  readonly k: number;
  readonly c: number;
}

export const SPRINGS = {
  snappy: { k: 420, c: 30 },
  gentle: { k: 170, c: 26 },
  bouncy: { k: 300, c: 14 },
} as const satisfies Record<string, SpringSpec>;

export interface SampledSpring {
  readonly durationMs: number;
  readonly easing: string;
}

const cache = new Map<string, SampledSpring>();

/** Simulates x'' = -k (x - 1) - c x' from rest and returns its duration and a linear() easing. */
export function sampleSpring(spec: SpringSpec): SampledSpring {
  const key = `${spec.k}/${spec.c}`;
  const hit = cache.get(key);
  if (hit !== undefined) return hit;

  const dt = 1 / 240;
  let x = 0;
  let v = 0;
  const values: number[] = [0];
  let settledFor = 0;
  let steps = 0;
  while (steps < 240 * 3) {
    v += (-spec.k * (x - 1) - spec.c * v) * dt;
    x += v * dt;
    steps += 1;
    values.push(x);
    settledFor = Math.abs(x - 1) < 0.002 && Math.abs(v) < 0.02 ? settledFor + 1 : 0;
    if (settledFor > 12) break;
  }
  const durationMs = Math.round((steps / 240) * 1000);
  const points = Math.min(48, Math.max(8, Math.round(durationMs / 14)));
  const parts: string[] = [];
  for (let i = 0; i <= points; i += 1) {
    const sample = values[Math.min(values.length - 1, Math.round((i / points) * (values.length - 1)))] ?? 1;
    parts.push(i === points ? "1" : sample.toFixed(4));
  }
  const result: SampledSpring = { durationMs, easing: `linear(${parts.join(", ")})` };
  cache.set(key, result);
  return result;
}
