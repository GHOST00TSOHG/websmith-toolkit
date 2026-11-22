// Motion helpers: time conversion, eased interpolation, staggering, reading time, contrast.
import {interpolate, spring as rSpring, EasingFunction} from 'remotion';
import {easing, durations, spring as springTokens} from './tokens';

export const sec = (fps: number, s: number) => Math.round(s * fps);

/** Eased 0..1 progress between two frames (clamped). */
export const progress = (frame: number, start: number, dur: number, ease: EasingFunction = easing.out) =>
  interpolate(frame, [start, start + Math.max(1, dur)], [0, 1], {
    easing: ease,
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

/** Map progress to a range. */
export const lerp = (p: number, a: number, b: number) => a + (b - a) * p;

/** Eased interpolation over frames with clamping. */
export const tween = (frame: number, input: [number, number], output: [number, number], ease: EasingFunction = easing.out) =>
  interpolate(frame, input, output, {easing: ease, extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});

/** Start frame for the i-th staggered item. */
export const stagger = (i: number, fps: number, each: number = durations.stagger, start = 0) => start + Math.round(i * each * fps);

export const springIn = (frame: number, fps: number, delay = 0, cfg: keyof typeof springTokens = 'gentle') =>
  rSpring({frame: frame - delay, fps, config: springTokens[cfg]});

/** Enter + exit envelope: 0 -> 1 (in) ... 1 -> 0 (out) for a scene of length total. */
export const inOut = (frame: number, total: number, inDur: number, outDur: number) =>
  Math.min(progress(frame, 0, inDur, easing.out), 1 - progress(frame, total - outDur, outDur, easing.in));

/** Max characters on any one line of on-screen text. */
export const MAX_CHARS_PER_LINE = 42;

/** Reading time rule: 0.3 s per word + 0.5 s, minimum 1.2 s. Returns seconds. Count from the moment the last word has landed. */
export const readingTime = (text: string) => {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1.2, words * 0.3 + 0.5);
};

/** True when every line is within the 42-character limit. */
export const fitsLineLength = (text: string) =>
  text.split(/\n/).every((line) => line.length <= MAX_CHARS_PER_LINE);

// WCAG contrast
const lum = (hex: string) => {
  const n = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(n.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
export const contrast = (a: string, b: string) => {
  const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
};

/** Deterministic pseudo-random (never use Math.random in renders). */
export const rand = (seed: number) => {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
};
