// Rounded-rectangle paths walked by arc length. The walk starts where CanvasRenderingContext2D.roundRect
// starts its sub-path, (x + r, y), and runs clockwise, so a dash offset of `s` lands on pointAt(s).
export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
  r: number;
}

export function perimeter(b: Box): number {
  return 2 * (b.w + b.h) - 8 * b.r + 2 * Math.PI * b.r;
}

/** Writes the point at arc length `s` (wrapped) into out.x, out.y. */
export function pointAt(b: Box, s: number, out: { x: number; y: number }): void {
  const { x, y, w, h, r } = b;
  const p = perimeter(b);
  let d = ((s % p) + p) % p;
  const q = (Math.PI * r) / 2;
  const top = w - 2 * r;
  const side = h - 2 * r;
  const arc = (cx: number, cy: number, a0: number, t: number): void => {
    const a = a0 + (t / q) * (Math.PI / 2);
    out.x = cx + Math.cos(a) * r;
    out.y = cy + Math.sin(a) * r;
  };
  if (d <= top) { out.x = x + r + d; out.y = y; return; }
  d -= top;
  if (d <= q) { arc(x + w - r, y + r, -Math.PI / 2, d); return; }
  d -= q;
  if (d <= side) { out.x = x + w; out.y = y + r + d; return; }
  d -= side;
  if (d <= q) { arc(x + w - r, y + h - r, 0, d); return; }
  d -= q;
  if (d <= top) { out.x = x + w - r - d; out.y = y + h; return; }
  d -= top;
  if (d <= q) { arc(x + r, y + h - r, Math.PI / 2, d); return; }
  d -= q;
  if (d <= side) { out.x = x; out.y = y + h - r - d; return; }
  d -= side;
  arc(x + r, y + r, Math.PI, Math.min(d, q));
}
