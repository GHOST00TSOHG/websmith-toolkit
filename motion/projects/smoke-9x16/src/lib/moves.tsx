// Reusable moves. Every move is frame-driven (no CSS animations, no Math.random) so renders are deterministic.
import React from 'react';
import {AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig} from 'remotion';
import {evolvePath, interpolatePath} from '@remotion/paths';
import {colors, durations, easing, fonts} from './tokens';
import {lerp, progress, sec, stagger, springIn} from './motion';
import {formatOf, SAFE} from './formats';

type Base = {delay?: number; style?: React.CSSProperties};

/** SplitText: per-word or per-char staggered rise + fade + de-blur. */
export const SplitText: React.FC<Base & {text: string; by?: 'word' | 'char'; each?: number; dur?: number; size?: number; color?: string; weight?: number}> = ({
  text, by = 'word', each, dur = durations.base, delay = 0, size = 80, color = colors.text, weight = 800, style,
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const parts = by === 'word' ? text.split(' ') : Array.from(text);
  const e = each ?? (by === 'word' ? 0.07 : durations.stagger);
  return (
    <div style={{fontFamily: fonts.display, fontSize: size, fontWeight: weight, color, lineHeight: 1.08, letterSpacing: '-0.02em', textAlign: 'center', ...style}}>
      {parts.map((p, i) => {
        const pr = progress(frame, delay + stagger(i, fps, e), sec(fps, dur), easing.out);
        return (
          <span key={i} style={{display: 'inline-block', whiteSpace: 'pre', opacity: pr, transform: `translateY(${(1 - pr) * 0.5}em)`, filter: `blur(${(1 - pr) * 8}px)`}}>
            {p}{by === 'word' && i < parts.length - 1 ? ' ' : ''}
          </span>
        );
      })}
    </div>
  );
};

/** MaskReveal: content slides up from behind a clipping line. */
export const MaskReveal: React.FC<Base & {children: React.ReactNode; dur?: number; direction?: 'up' | 'down' | 'left' | 'right'}> = ({children, delay = 0, dur = durations.long, direction = 'up', style}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const p = progress(frame, delay, sec(fps, dur), easing.out);
  const off = (1 - p) * 110;
  const t = {up: `translateY(${off}%)`, down: `translateY(${-off}%)`, left: `translateX(${off}%)`, right: `translateX(${-off}%)`}[direction];
  return (
    <div style={{overflow: 'hidden', display: 'inline-block', ...style}}>
      <div style={{transform: t}}>{children}</div>
    </div>
  );
};

/** Morph: SVG path morph between two shapes (any path pair; uses @remotion/paths interpolatePath). */
export const Morph: React.FC<Base & {from: string; to: string; dur?: number; size?: number; fill?: string; viewBox?: string}> = ({from, to, delay = 0, dur = durations.long, size = 300, fill = colors.accent, viewBox = '0 0 100 100', style}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const p = progress(frame, delay, sec(fps, dur), easing.inOut);
  return (
    <svg width={size} height={size} viewBox={viewBox} style={style}>
      <path d={interpolatePath(p, from, to)} fill={fill} />
    </svg>
  );
};
export const SHAPES = {
  circle: 'M50,10 C72,10 90,28 90,50 C90,72 72,90 50,90 C28,90 10,72 10,50 C10,28 28,10 50,10 Z',
  square: 'M18,10 L82,10 C86,10 90,14 90,18 L90,82 C90,86 86,90 82,90 L18,90 C14,90 10,86 10,82 L10,18 C10,14 14,10 18,10 Z',
  play: 'M30,15 L30,15 C34,12 40,13 44,16 L84,44 C88,47 88,53 84,56 L44,84 C40,87 34,88 30,85 C27,83 26,80 26,77 L26,23 C26,20 27,17 30,15 Z',
};

/** PinnedScrub: a pinned element while content scrolls past it, scrubbed by frame (like a pinned scroll section). */
export const PinnedScrub: React.FC<Base & {pinned: React.ReactNode; items: React.ReactNode[]; dur: number; itemGap?: number}> = ({pinned, items, dur, delay = 0, itemGap = 260, style}) => {
  const frame = useCurrentFrame();
  const {fps, height} = useVideoConfig();
  const p = progress(frame, delay, sec(fps, dur), easing.inOut);
  const total = items.length * itemGap;
  return (
    <AbsoluteFill style={style}>
      <AbsoluteFill style={{transform: `translateY(${lerp(p, height * 0.6, -total + height * 0.3)}px)`, alignItems: 'flex-end', paddingRight: '10%'}}>
        {items.map((it, i) => <div key={i} style={{height: itemGap, display: 'flex', alignItems: 'center'}}>{it}</div>)}
      </AbsoluteFill>
      <AbsoluteFill style={{justifyContent: 'center', paddingLeft: '10%'}}>{pinned}</AbsoluteFill>
    </AbsoluteFill>
  );
};

/** HorizontalRail: a row of items that pans horizontally (eased), like a carousel/timeline rail. */
export const HorizontalRail: React.FC<Base & {items: React.ReactNode[]; dur: number; itemWidth?: number; gap?: number}> = ({items, dur, delay = 0, itemWidth = 420, gap = 60, style}) => {
  const frame = useCurrentFrame();
  const {fps, width} = useVideoConfig();
  const p = progress(frame, delay, sec(fps, dur), easing.inOut);
  const total = items.length * (itemWidth + gap) - gap;
  const x = lerp(p, width * 0.55, Math.min(width * 0.1, width - total - width * 0.1));
  return (
    <AbsoluteFill style={{justifyContent: 'center', ...style}}>
      <div style={{display: 'flex', gap, transform: `translateX(${x}px)`, width: total}}>
        {items.map((it, i) => <div key={i} style={{width: itemWidth, flexShrink: 0}}>{it}</div>)}
      </div>
    </AbsoluteFill>
  );
};

/** Parallax: layers drift at different speeds (depth = 0 far ... 1 near). */
export const Parallax: React.FC<{layers: {node: React.ReactNode; depth: number}[]; distance?: number; dur: number; axis?: 'x' | 'y'}> = ({layers, distance = 200, dur, axis = 'x'}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const p = progress(frame, 0, sec(fps, dur), easing.soft);
  return (
    <AbsoluteFill>
      {layers.map((l, i) => {
        const d = (0.5 - p) * distance * (0.2 + l.depth);
        return <AbsoluteFill key={i} style={{transform: axis === 'x' ? `translateX(${d}px) scale(${1 + l.depth * 0.04 * p})` : `translateY(${d}px)`}}>{l.node}</AbsoluteFill>;
      })}
    </AbsoluteFill>
  );
};

/** Counter: eased number count-up with tabular figures. */
export const Counter: React.FC<Base & {from?: number; to: number; dur?: number; prefix?: string; suffix?: string; decimals?: number; size?: number; color?: string}> = ({
  from = 0, to, dur = 1.2, delay = 0, prefix = '', suffix = '', decimals = 0, size = 160, color = colors.text, style,
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const p = progress(frame, delay, sec(fps, dur), easing.snap);
  const v = lerp(p, from, to);
  return (
    <div style={{fontFamily: fonts.display, fontWeight: 900, fontSize: size, color, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.03em', ...style}}>
      {prefix}{v.toLocaleString('en-US', {minimumFractionDigits: decimals, maximumFractionDigits: decimals})}{suffix}
    </div>
  );
};

/** PathDraw: strokes an SVG path on (evolvePath). */
export const PathDraw: React.FC<Base & {d: string; dur?: number; width: number; height: number; stroke?: string; strokeWidth?: number; viewBox?: string}> = ({
  d, dur = 1, delay = 0, width, height, stroke = colors.accent2, strokeWidth = 6, viewBox, style,
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const p = progress(frame, delay, sec(fps, dur), easing.inOut);
  const {strokeDasharray, strokeDashoffset} = evolvePath(p, d);
  return (
    <svg width={width} height={height} viewBox={viewBox ?? `0 0 ${width} ${height}`} style={{overflow: 'visible', ...style}}>
      <path d={d} fill="none" stroke={stroke} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={strokeDasharray} strokeDashoffset={strokeDashoffset} />
    </svg>
  );
};

/** Highlight: marker sweep behind a word (or strike-through with mode='strike'). */
export const Highlight: React.FC<Base & {children: React.ReactNode; color?: string; dur?: number; mode?: 'marker' | 'underline' | 'strike'}> = ({children, color = colors.warm, delay = 0, dur = durations.base, mode = 'marker', style}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const p = progress(frame, delay, sec(fps, dur), easing.out);
  const geo = {marker: {top: '12%', height: '80%'}, underline: {top: '88%', height: '10%'}, strike: {top: '48%', height: '9%'}}[mode];
  return (
    <span style={{position: 'relative', display: 'inline-block', ...style}}>
      <span style={{position: 'absolute', left: '-0.08em', right: '-0.08em', ...geo, background: color, transformOrigin: 'left center', transform: `scaleX(${p})`, zIndex: mode === 'strike' ? 2 : 0, borderRadius: 6, opacity: mode === 'marker' ? 0.9 : 1}} />
      <span style={{position: 'relative', zIndex: 1}}>{children}</span>
    </span>
  );
};

/** RollingWord: cycles through words in a slot with a vertical roll (like an odometer word). */
export const RollingWord: React.FC<Base & {words: string[]; each?: number; size?: number; color?: string}> = ({words, each = 0.7, delay = 0, size = 90, color = colors.accent2, style}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const per = sec(fps, each);
  const local = Math.max(0, frame - delay);
  const idx = Math.min(words.length - 1, Math.floor(local / per));
  const within = idx === words.length - 1 ? 1 : progress(local - idx * per, per - sec(fps, 0.25), sec(fps, 0.25), easing.inOut);
  const y = (idx + (idx === words.length - 1 ? 0 : within)) * 1.15;
  return (
    <span style={{display: 'inline-block', height: `${1.15}em`, overflow: 'hidden', verticalAlign: 'bottom', fontSize: size, color, fontFamily: fonts.display, fontWeight: 900, ...style}}>
      <span style={{display: 'flex', flexDirection: 'column', transform: `translateY(${-y}em)`}}>
        {words.map((w) => <span key={w} style={{height: '1.15em', lineHeight: '1.15em'}}>{w}</span>)}
      </span>
    </span>
  );
};

/** StackCards: cards deal in and stack with depth offset. */
export const StackCards: React.FC<Base & {cards: React.ReactNode[]; each?: number; w?: number; h?: number}> = ({cards, each = 0.18, delay = 0, w = 520, h = 320, style}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  return (
    <div style={{position: 'relative', width: w, height: h, ...style}}>
      {cards.map((c, i) => {
        const s = springIn(frame, fps, delay + sec(fps, i * each), 'snappy');
        const depth = cards.length - 1 - i;
        return (
          <div key={i} style={{position: 'absolute', inset: 0, borderRadius: 28, background: colors.surface, border: `2px solid ${colors.grey}`, boxShadow: '0 30px 60px rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center',
            opacity: interpolate(s, [0, 0.3], [0, 1], {extrapolateRight: 'clamp'}),
            transform: `translate(${(1 - s) * 400 + depth * -22}px, ${depth * -22}px) rotate(${(1 - s) * 12 + (i % 2 ? 2 : -2)}deg) scale(${1 - depth * 0.03})`}}>
            {c}
          </div>
        );
      })}
    </div>
  );
};

/** Centered stage helper. Pads to the current format's safe zone (formats.ts) so text never sits under platform UI;
 *  pass safe={false} for the old uniform 6% padding. */
export const Stage: React.FC<{children: React.ReactNode; bg?: string; style?: React.CSSProperties; safe?: boolean}> = ({children, bg = colors.bg, style, safe = true}) => {
  const {width, height} = useVideoConfig();
  const z = SAFE[formatOf(width, height)];
  const padding = safe ? `${z.top * height}px ${z.right * width}px ${z.bottom * height}px ${z.left * width}px` : '6%';
  return <AbsoluteFill style={{background: bg, alignItems: 'center', justifyContent: 'center', padding, ...style}}>{children}</AbsoluteFill>;
};
