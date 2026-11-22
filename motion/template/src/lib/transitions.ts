// Named transitions catalog. Each returns styles for the outgoing ('out') or incoming ('in') scene
// given eased progress p (0..1) across the overlap window. Used by <Story> via timeline.json.
import React from 'react';
import {easing} from './tokens';

export type TransitionType =
  | 'cut' | 'crossfade' | 'push' | 'pushUp' | 'wipe' | 'mask' | 'cameraDive' | 'zoomOut'
  | 'matchCut' | 'whip' | 'slideOver';

export type Role = 'in' | 'out';
type Fn = (p: number, role: Role, w: number, h: number) => React.CSSProperties;

export const TRANSITIONS: Record<TransitionType, {fn: Fn; ease: (t: number) => number; desc: string; defaultDur: number}> = {
  cut: {desc: 'Hard cut on the beat. No overlap.', defaultDur: 0, ease: easing.linear, fn: () => ({})},
  crossfade: {desc: 'Dissolve. Use for time passing / soft mood shifts only.', defaultDur: 0.4, ease: easing.soft,
    fn: (p, r) => ({opacity: r === 'in' ? p : 1 - p})},
  push: {desc: 'Incoming pushes outgoing off to the left (sequence / next step).', defaultDur: 0.5, ease: easing.inOut,
    fn: (p, r, w) => ({transform: `translateX(${r === 'in' ? (1 - p) * w : -p * w}px)`})},
  pushUp: {desc: 'Vertical push (vertical formats, lists, “and then”).', defaultDur: 0.5, ease: easing.inOut,
    fn: (p, r, _w, h) => ({transform: `translateY(${r === 'in' ? (1 - p) * h : -p * h}px)`})},
  wipe: {desc: 'Hard-edged wipe left→right (contrast: before/after).', defaultDur: 0.5, ease: easing.inOut,
    fn: (p, r) => (r === 'in' ? {clipPath: `inset(0 ${(1 - p) * 100}% 0 0)`} : {})},
  mask: {desc: 'Circular iris opens from center (focus / reveal).', defaultDur: 0.6, ease: easing.inOut,
    fn: (p, r) => (r === 'in' ? {clipPath: `circle(${p * 75}% at 50% 50%)`} : {transform: `scale(${1 + p * 0.08})`})},
  cameraDive: {desc: 'Camera pushes INTO the outgoing scene and emerges in the next (go deeper / reveal).', defaultDur: 0.6, ease: easing.inOut,
    fn: (p, r) => (r === 'out'
      ? {transform: `scale(${1 + p * 3})`, opacity: 1 - Math.max(0, (p - 0.4) / 0.6), filter: `blur(${p * 12}px)`}
      : {transform: `scale(${0.7 + p * 0.3})`, opacity: Math.min(1, p * 1.6), filter: `blur(${(1 - p) * 10}px)`})},
  zoomOut: {desc: 'Camera pulls back to show the bigger picture (context / payoff).', defaultDur: 0.6, ease: easing.inOut,
    fn: (p, r) => (r === 'out'
      ? {transform: `scale(${1 - p * 0.5})`, opacity: 1 - p, filter: `blur(${p * 6}px)`}
      : {transform: `scale(${1.6 - p * 0.6})`, opacity: Math.min(1, p * 1.5)})},
  matchCut: {desc: 'Instant swap at midpoint while a shared shape stays put (continuity). Pair with handoff.json.', defaultDur: 0.3, ease: easing.linear,
    fn: (p, r) => (r === 'out' ? {opacity: p < 0.5 ? 1 : 0, transform: `scale(${1 + p * 0.04})`} : {opacity: p < 0.5 ? 0 : 1, transform: `scale(${0.98 + p * 0.02})`})},
  whip: {desc: 'Fast whip pan with motion blur (energy / montage). Max 1–2 per video.', defaultDur: 0.35, ease: easing.inOut,
    fn: (p, r, w) => ({transform: `translateX(${r === 'in' ? (1 - p) * w : -p * w}px)`, filter: `blur(${Math.sin(p * Math.PI) * 24}px)`})},
  slideOver: {desc: 'Incoming slides over; outgoing recedes and dims (new layer / chapter).', defaultDur: 0.6, ease: easing.inOut,
    fn: (p, r, w) => (r === 'in' ? {transform: `translateX(${(1 - p) * w}px)`, boxShadow: '-40px 0 80px rgba(0,0,0,0.5)'} : {transform: `scale(${1 - p * 0.08})`, filter: `brightness(${1 - p * 0.5})`})},
};
