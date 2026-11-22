// Shared-element hand-off: an element (logo, icon, shape) that travels from its spot in scene A
// to its spot in scene B across the transition window, rendered ABOVE both scenes so it never cuts.
// Config: src/handoff.json. Positions are fractions of width/height (0..1), so all formats work.
import React from 'react';
import {AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig} from 'remotion';
import {computeWindows, Timeline} from './timeline';
import {easing} from './tokens';

export type Pose = {x: number; y: number; scale: number; rotate?: number; opacity?: number};
export type HandoffSpec = {id: string; fromScene: string; toScene: string; from: Pose; to: Pose; leadIn?: number; tail?: number};

export const HandoffLayer: React.FC<{timeline: Timeline; specs: HandoffSpec[]; elements: Record<string, React.ReactNode>}> = ({timeline, specs, elements}) => {
  const frame = useCurrentFrame();
  const {width, height, fps} = useVideoConfig();
  const {windows} = computeWindows(timeline);
  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      {specs.map((s) => {
        const a = windows.find((w) => w.id === s.fromScene);
        const b = windows.find((w) => w.id === s.toScene);
        if (!a || !b || !elements[s.id]) return null;
        const start = a.from + a.frames - a.outFrames - Math.round((s.leadIn ?? 0.15) * fps);
        const end = b.from + Math.max(b.inFrames, 1) + Math.round((s.tail ?? 0.1) * fps);
        if (frame < start || frame > end) return null;
        const p = interpolate(frame, [start, end], [0, 1], {easing: easing.inOut, extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
        const L = (k: keyof Pose, d = 0) => ((s.from[k] ?? d) as number) + (((s.to[k] ?? d) as number) - ((s.from[k] ?? d) as number)) * p;
        return (
          <div key={s.id} style={{position: 'absolute', left: L('x') * width, top: L('y') * height, transform: `translate(-50%,-50%) scale(${L('scale', 1)}) rotate(${L('rotate')}deg)`, opacity: L('opacity', 1)}}>
            {elements[s.id]}
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

/** Should a scene draw its own copy of a shared element right now? (false while the hand-off layer owns it)
 *  Call inside a scene with the scene's window `from` + local frame. */
export const ownsElement = (id: string, sceneId: string, globalFrame: number, timeline: Timeline, specs: HandoffSpec[], fps: number) => {
  const {windows} = computeWindows(timeline);
  for (const s of specs.filter((x) => x.id === id)) {
    const a = windows.find((w) => w.id === s.fromScene);
    const b = windows.find((w) => w.id === s.toScene);
    if (!a || !b) continue;
    const start = a.from + a.frames - a.outFrames - Math.round((s.leadIn ?? 0.15) * fps);
    const end = b.from + Math.max(b.inFrames, 1) + Math.round((s.tail ?? 0.1) * fps);
    if (globalFrame >= start && globalFrame <= end) return false;
    if (sceneId === s.fromScene && globalFrame > end) return false;
    if (sceneId === s.toScene && globalFrame < start) return false;
  }
  return true;
};
