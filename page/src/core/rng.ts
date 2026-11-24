/** Small seeded PRNG (mulberry32). Tests pass ?seed= to make effects repeatable. */
export function makeRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function seedFromLocation(): number {
  const raw = new URLSearchParams(location.search).get("seed");
  const n = raw === null ? NaN : Number(raw);
  return Number.isFinite(n) ? n : Math.floor(Math.random() * 2 ** 31);
}
