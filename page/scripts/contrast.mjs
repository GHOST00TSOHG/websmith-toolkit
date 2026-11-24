// Computes WCAG contrast for every text/background token pair in both themes.
// Fails (exit 1) below AA: 4.5:1 for text, 3:1 for large text and lines.
import { readFileSync } from "node:fs";

const css = readFileSync("src/styles/tokens.css", "utf8");

function themeTokens(theme) {
  const block = new RegExp(`html\\[data-theme="${theme}"\\]\\s*\\{([^}]*)\\}`).exec(css);
  if (!block) throw new Error(`theme block ${theme} not found`);
  const out = {};
  for (const m of block[1].matchAll(/--([a-z0-9-]+):\s*(#[0-9a-f]{6})\s*;/gi)) out[m[1]] = m[2];
  return out;
}

function luminance(hex) {
  const channels = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const lin = channels.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
}

function ratio(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

// [foreground, background, minimum]
const PAIRS = [
  ["text", "bg", 4.5],
  ["text", "surface", 4.5],
  ["text", "surface-2", 4.5],
  ["text-dim", "bg", 4.5],
  ["text-dim", "surface", 4.5],
  ["text-dim", "surface-2", 4.5],
  ["line", "bg", 3],
  ["line", "surface", 3],
  ["neon", "bg", 4.5],
  ["neon", "surface", 4.5],
  ["ok", "surface", 4.5],
  ["warn", "surface", 4.5],
  ["danger", "surface", 4.5],
  ["focus", "bg", 3],
  ["on-neon", "neon-fill", 4.5],
  ["accent-skill", "surface", 4.5],
  ["accent-animation", "surface", 4.5],
  ["accent-motion", "surface", 4.5],
  ["accent-installer", "surface", 4.5],
];

let failed = false;
for (const theme of ["dark", "light"]) {
  const t = themeTokens(theme);
  for (const [fg, bg, min] of PAIRS) {
    const fgHex = t[fg];
    const bgHex = t[bg];
    if (!fgHex || !bgHex) throw new Error(`${theme}: missing token ${fg} or ${bg}`);
    const r = ratio(fgHex, bgHex);
    if (r < min) {
      failed = true;
      console.error(`contrast FAIL ${theme}: ${fg} on ${bg} is ${r.toFixed(2)}:1 (needs ${min}:1)`);
    }
  }
}
if (failed) process.exit(1);
console.log("contrast ok: every token pair meets AA in both themes");
