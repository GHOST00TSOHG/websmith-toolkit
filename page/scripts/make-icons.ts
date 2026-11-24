// Draws the app icons (192, 512 and the 180 apple-touch-icon) from the brand mark in index.html: a hexagon
// with a plus inside, in the accent colour on the page colour. No dependencies: a tiny anti-aliased line
// rasteriser and a PNG writer (node:zlib). The PNGs are committed in public/icons/; run this only when the
// mark changes:  npx tsx scripts/make-icons.ts
import { mkdirSync, writeFileSync } from "node:fs";
import { deflateSync } from "node:zlib";

type Point = readonly [number, number];
type Rgb = readonly [number, number, number];

// The mark's paths in its 24-unit box (same as the header SVG).
const HEX: readonly Point[] = [[12, 2.5], [20.5, 7.5], [20.5, 16.5], [12, 21.5], [3.5, 16.5], [3.5, 7.5], [12, 2.5]];
const PLUS: readonly (readonly [Point, Point])[] = [[[12, 8], [12, 16]], [[8, 12], [16, 12]]];
const BG: Rgb = [0x04, 0x09, 0x14];
const LINE: Rgb = [0x4d, 0xe3, 0xff];
const STROKE = 1.6; // units of the 24 box
const MARK_SHARE = 0.62; // the mark fills this much of the icon, inside the maskable safe zone

function segments(): (readonly [Point, Point])[] {
  const out: (readonly [Point, Point])[] = [];
  for (let i = 0; i + 1 < HEX.length; i += 1) {
    const a = HEX[i];
    const b = HEX[i + 1];
    if (a !== undefined && b !== undefined) out.push([a, b]);
  }
  return [...out, ...PLUS];
}

function distToSegment(px: number, py: number, [a, b]: readonly [Point, Point]): number {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const t = Math.max(0, Math.min(1, ((px - a[0]) * dx + (py - a[1]) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(px - (a[0] + t * dx), py - (a[1] + t * dy));
}

function draw(size: number): Buffer {
  const segs = segments();
  const unit = (size * MARK_SHARE) / 19; // the hex spans 19 units tall (2.5 to 21.5)
  const offset = size / 2 - 12 * unit;
  const half = (STROKE * unit) / 2;
  const rows: Buffer[] = [];
  for (let y = 0; y < size; y += 1) {
    const row = Buffer.alloc(1 + size * 3); // filter byte 0, then RGB
    for (let x = 0; x < size; x += 1) {
      const ux = (x + 0.5 - offset) / unit;
      const uy = (y + 0.5 - offset) / unit;
      const d = Math.min(...segs.map((s) => distToSegment(ux, uy, s))) * unit; // in pixels
      const ink = Math.max(0, Math.min(1, half - d + 0.5));
      const glow = 0.28 * Math.exp(-Math.max(0, d - half) / (unit * 1.1));
      const a = Math.min(1, ink + glow * (1 - ink));
      for (let c = 0; c < 3; c += 1) {
        const v = (BG[c] ?? 0) * (1 - a) + (LINE[c] ?? 0) * a;
        row[1 + x * 3 + c] = Math.round(v);
      }
    }
    rows.push(row);
  }
  return png(size, Buffer.concat(rows));
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (const byte of buf) c = (CRC_TABLE[(c ^ byte) & 0xff] ?? 0) ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}
function png(size: number, raw: Buffer): Buffer {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

mkdirSync("public/icons", { recursive: true });
for (const [name, size] of [["icon-192.png", 192], ["icon-512.png", 512], ["apple-touch-icon.png", 180]] as const) {
  writeFileSync(`public/icons/${name}`, draw(size));
  process.stdout.write(`wrote public/icons/${name} (${size}x${size})\n`);
}
