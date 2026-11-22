// Design tokens: the single source of truth for color, type, easing and timing.
import {Easing, staticFile} from 'remotion';
import {loadFont} from '@remotion/fonts';

// Inter 4.1 is bundled in public/fonts (SIL OFL 1.1). loadFont blocks the render until each face is ready.
const INTER = 'Inter';
for (const [weight, file] of [
  ['400', 'Inter-Regular.woff2'],
  ['600', 'Inter-SemiBold.woff2'],
  ['800', 'Inter-ExtraBold.woff2'],
  ['900', 'Inter-Black.woff2'],
] as const) {
  loadFont({
    family: INTER,
    url: staticFile(`fonts/${file}`),
    weight,
    style: 'normal',
  });
}

export const colors = {
  bg: '#0B0D17',        // near-black navy (base)
  bgAlt: '#141833',     // raised surface
  surface: '#1E2347',
  text: '#F5F7FF',      // 18.1:1 on bg
  textDim: '#A9B0D6',   // 9.1:1 on bg (secondary text only)
  accent: '#8B6CFF',    // violet, 5.2:1 on bg (large text / shapes)
  accent2: '#22D3EE',   // cyan, 10.7:1 on bg
  warm: '#FFB547',      // amber highlight, 11.0:1 on bg
  danger: '#FF5C7A',    // problem beats, 6.5:1 on bg
  ok: '#3DDC97',        // payoff, 11.0:1 on bg
  grey: '#3A3F63',     // 1.9:1: decoration only, NEVER text
} as const;

export const fonts = {
  display: INTER,
  body: INTER,
  mono: 'ui-monospace, SFMono-Regular, Menlo, monospace',
} as const;

// Type scale as a fraction of the composition's short side (so all formats scale together).
export const type = {
  hero: 0.12,
  h1: 0.085,
  h2: 0.06,
  body: 0.038,
  caption: 0.028, // never smaller than this: ~30px on 1080 short side
} as const;

// Easing tokens. Use these names, never ad-hoc beziers in scenes.
export const easing = {
  out: Easing.bezier(0.16, 1, 0.3, 1),        // expo-out: entrances
  in: Easing.bezier(0.7, 0, 0.84, 0),         // expo-in: exits
  inOut: Easing.bezier(0.83, 0, 0.17, 1),     // camera moves, transitions
  snap: Easing.bezier(0.2, 0.9, 0.1, 1.0),    // UI snaps, counters
  soft: Easing.bezier(0.45, 0, 0.55, 1),      // ambient drift, parallax
  overshoot: Easing.bezier(0.34, 1.56, 0.64, 1), // playful pops (use sparingly)
  linear: Easing.linear,
} as const;

// Duration tokens in seconds. Convert with sec(fps, d.x) from motion.ts.
export const durations = {
  micro: 0.15,      // hover-like UI ticks
  short: 0.3,       // small elements in
  base: 0.5,        // standard entrance
  long: 0.8,        // hero entrance / camera move
  transition: 0.5,  // default scene transition
  stagger: 0.04,    // per-letter / per-item delay
  hold: 0.5,        // padding in the reading-time formula (0.3 s/word + hold, min 1.2 s)
} as const;

export const spring = {
  gentle: {damping: 200, stiffness: 100, mass: 1},
  snappy: {damping: 18, stiffness: 180, mass: 0.6},
  bouncy: {damping: 10, stiffness: 120, mass: 0.8},
} as const;
