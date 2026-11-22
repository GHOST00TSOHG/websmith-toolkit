// Lottie player built on @remotion/lottie. Loads JSON from public/ via staticFile with delayRender,
// optional recolor (useAnimations icons ship black strokes; recolor them for dark backgrounds),
// entrance pop, and frame-synced playback (deterministic in renders).
import React, {useEffect, useMemo, useState} from 'react';
import {cancelRender, continueRender, delayRender, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
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

export const LottieIcon: React.FC<{
  src: string;            // path inside public/, e.g. 'lottie/rocket.json'
  size?: number;
  color?: string;         // recolor (for monochrome icons)
  loop?: boolean;
  playbackRate?: number;
  delay?: number;         // frames before it pops in & starts
  pop?: boolean;
  style?: React.CSSProperties;
}> = ({src, size = 240, color, loop = true, playbackRate = 1, delay = 0, pop = true, style}) => {
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

  const anim = useMemo(() => (data && color ? recolorLottie(data, color) : data), [data, color]);
  const s = pop ? springIn(frame, fps, delay, 'snappy') : 1;
  if (!anim) return null;
  return (
    <div style={{width: size, height: size, transform: `scale(${s})`, opacity: Math.min(1, s * 2), ...style}}>
      {frame >= delay ? <Lottie animationData={anim} loop={loop} playbackRate={playbackRate} style={{width: '100%', height: '100%'}} /> : null}
    </div>
  );
};
