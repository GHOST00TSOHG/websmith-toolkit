// Lottie player built on @remotion/lottie. Loads JSON from public/ via staticFile with delayRender,
// optional recolor (useAnimations icons ship black strokes; recolor them for dark backgrounds),
// entrance pop, frame-synced playback (deterministic in renders), a delay that starts the icon at its own
// frame 0, play-once by default and an optional clean in/out trim.
import React, {useEffect, useMemo, useState} from 'react';
import {cancelRender, continueRender, delayRender, Sequence, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {Lottie, LottieAnimationData} from '@remotion/lottie';
import {springIn} from './motion';

const hexToRgb01 = (hex: string) => {
  const n = hex.replace('#', '');
  return [0, 2, 4].map((i) => parseInt(n.slice(i, i + 2), 16) / 255);
};

/** Replace every solid fill/stroke color in a Lottie JSON (static colors only). */
export const recolorLottie = (data: LottieAnimationData, hex: string): LottieAnimationData => {
  const [r, g, b] = hexToRgb01(hex);
  const clone = JSON.parse(JSON.stringify(data));
  const walk = (o: unknown) => {
    if (Array.isArray(o)) return o.forEach(walk);
    if (o && typeof o === 'object') {
      const obj = o as Record<string, any>;
      if ((obj.ty === 'st' || obj.ty === 'fl') && obj.c && obj.c.a === 0 && Array.isArray(obj.c.k)) obj.c.k = [r, g, b, obj.c.k[3] ?? 1];
      Object.values(obj).forEach(walk);
    }
  };
  walk(clone);
  return clone;
};

/** Trim a Lottie to [inFrame, outFrame) of its own timeline (lottie-web plays ip..op, so this is a clean in/out range). */
export const trimLottie = (data: LottieAnimationData, inFrame?: number, outFrame?: number): LottieAnimationData => {
  if (inFrame === undefined && outFrame === undefined) return data;
  const ip = typeof data.ip === 'number' ? data.ip : 0;
  const lo = Math.max(ip, inFrame ?? ip);
  const hi = Math.min(data.op, outFrame ?? data.op);
  if (!(hi > lo)) throw new Error(`LottieIcon trim [${inFrame}, ${outFrame}) is outside the animation (${ip}..${data.op})`);
  return {...data, ip: lo, op: hi};
};

export const LottieIcon: React.FC<{
  src: string;            // path inside public/, e.g. 'lottie/rocket.json'
  size?: number;
  color?: string;         // recolor (monochrome line icons only, never emoji)
  /** Loop the animation. Default false: most icons look broken mid-loop (party popper = bare cone,
   *  check draws then undraws), so the default plays once and holds the last frame of the range. */
  loop?: boolean;
  /** Same as loop={false}; kept for readability at call sites. */
  playOnce?: boolean;
  /** Clean in/out range in the Lottie's OWN frames: [inFrame, outFrame). Use it to cut a reset pose off a looping emoji. */
  trim?: [number, number];
  playbackRate?: number;
  /** @remotion/lottie advances ONE Lottie frame per video frame, so a 60 fps Noto emoji plays at half speed in a
   *  30 fps video. nativeSpeed scales playback by (lottie fr / video fps) to play at the designer's speed. Default off
   *  (keeps the slower, calmer timing existing projects were tuned with). */
  nativeSpeed?: boolean;
  delay?: number;         // scene frames before it pops in; the Lottie starts at ITS frame 0 (or trim[0]) at this moment
  pop?: boolean;
  style?: React.CSSProperties;
}> = ({src, size = 240, color, loop = false, playOnce, trim, playbackRate = 1, nativeSpeed = false, delay = 0, pop = true, style}) => {
  const [data, setData] = useState<LottieAnimationData | null>(null);
  const [handle] = useState(() => delayRender(`Loading Lottie ${src}`));
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();

  useEffect(() => {
    fetch(staticFile(src))
      .then((r) => {
        if (!r.ok) throw new Error(`Lottie ${src}: HTTP ${r.status}`);
        return r.json();
      })
      .then((j) => {
        setData(j);
        continueRender(handle);
      })
      .catch((e) => cancelRender(e));
  }, [src, handle]);

  const anim = useMemo(() => {
    if (!data) return null;
    const trimmed = trimLottie(data, trim?.[0], trim?.[1]);
    return color ? recolorLottie(trimmed, color) : trimmed;
  }, [data, color, trim?.[0], trim?.[1]]);
  const s = pop ? springIn(frame, fps, delay, 'snappy') : 1;
  if (!anim) return null;
  const looping = playOnce ? false : loop;
  const rate = playbackRate * (nativeSpeed && anim.fr ? anim.fr / fps : 1);
  return (
    <div style={{width: size, height: size, transform: `scale(${s})`, opacity: Math.min(1, s * 2), ...style}}>
      {/* The Sequence shifts time so the Lottie sees frame 0 exactly at `delay` (the old version started it at frame `delay`). */}
      <Sequence from={Math.round(delay)} layout="none" name={`Lottie ${src}`}>
        <Lottie animationData={anim} loop={looping} playbackRate={rate} style={{width: '100%', height: '100%'}} />
      </Sequence>
    </div>
  );
};
