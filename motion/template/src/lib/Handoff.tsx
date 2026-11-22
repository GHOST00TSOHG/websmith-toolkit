// Shared-element hand-off: an element (logo, icon, the "light") that travels from its spot in scene A to its spot
// in scene B across the transition window, drawn ABOVE both scenes so it never cuts.
// Config: src/handoff.json. See PLAYBOOK.md "Shared element through every cut".
//
// Poses are aspect-independent and can be overridden per format:
//   {"x": 0.5, "y": 0.42, "scale": 1}                    x/y = fractions of width/height (default units "frame")
//   {"units": "short", "x": 0, "y": -0.08, "scale": 1}   x/y = offsets from the frame CENTRE in short-side units,
//                                                         so a pose sits at the same spot relative to centred layouts in 16:9, 1:1, 4:5 and 9:16
//   {"x": 0.5, "y": 0.42, "scale": 1, "formats": {"9x16": {"y": 0.36}}}   per-format partial override
// Several specs may share one id (one element carried through every cut): each is keyed by its scene pair
// (`id:fromScene>toScene`), and elements can be given per pair with the same key (falls back to `id`).
import React from 'react';
import {AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig} from 'remotion';
import {computeWindows, Timeline} from './timeline';
import {easing} from './tokens';
import {FormatId, formatOf} from './formats';

export type Pose = {x: number; y: number; scale: number; rotate?: number; opacity?: number; units?: 'frame' | 'short'};
export type PoseSpec = Pose & {formats?: Partial<Record<FormatId, Partial<Pose>>>};
export type HandoffSpec = {id: string; fromScene: string; toScene: string; from: PoseSpec; to: PoseSpec; leadIn?: number; tail?: number};
/** A pose resolved to pixels for one composition size. */
export type PixelPose = {px: number; py: number; scale: number; rotate: number; opacity: number};

export const handoffKey = (s: Pick<HandoffSpec, 'id' | 'fromScene' | 'toScene'>) => `${s.id}:${s.fromScene}>${s.toScene}`;

/** Resolve a pose (with per-format overrides and units) to pixels. */
export const resolvePose = (pose: PoseSpec, width: number, height: number, format: FormatId = formatOf(width, height)): PixelPose => {
  const p = {...pose, ...(pose.formats?.[format] ?? {})};
  const short = Math.min(width, height);
  const short_ = (p.units ?? 'frame') === 'short';
  return {
    px: short_ ? width / 2 + p.x * short : p.x * width,
    py: short_ ? height / 2 + p.y * short : p.y * height,
    scale: p.scale ?? 1,
    rotate: p.rotate ?? 0,
    opacity: p.opacity ?? 1,
  };
};

/** CSS for an absolutely placed element centred on a pixel pose (used by both the layer and scene copies). */
export const poseStyle = (q: PixelPose): React.CSSProperties => ({
  position: 'absolute', left: q.px, top: q.py, opacity: q.opacity,
  transform: `translate(-50%,-50%) scale(${q.scale}) rotate(${q.rotate}deg)`,
});

/** Draw a scene's own copy of a shared element exactly where the hand-off layer would. */
export const Placed: React.FC<{pose: PoseSpec; children: React.ReactNode}> = ({pose, children}) => {
  const {width, height} = useVideoConfig();
  return <div style={poseStyle(resolvePose(pose, width, height))}>{children}</div>;
};

/** Frame range [start, end] during which the layer owns the element for one spec. */
export const handoffRange = (s: HandoffSpec, timeline: Timeline, fps: number) => {
  const {windows} = computeWindows(timeline);
  const a = windows.find((w) => w.id === s.fromScene);
  const b = windows.find((w) => w.id === s.toScene);
  if (!a || !b) return null;
  const start = a.from + a.frames - a.outFrames - Math.round((s.leadIn ?? 0.15) * fps);
  const end = b.from + Math.max(b.inFrames, 1) + Math.round((s.tail ?? 0.1) * fps);
  return {start, end};
};

/** Throws if two specs for the same id overlap in time or a pair is declared twice (they would clash). */
export const validateHandoffs = (timeline: Timeline, specs: HandoffSpec[]) => {
  const seen = new Set<string>();
  for (const s of specs) {
    const k = handoffKey(s);
    if (seen.has(k)) throw new Error(`handoff.json: duplicate spec ${k}`);
    seen.add(k);
    const r = handoffRange(s, timeline, timeline.fps);
    if (!r) throw new Error(`handoff.json: ${k} names a scene that is not in timeline.json`);
    for (const o of specs) {
      if (o === s || o.id !== s.id) continue;
      const q = handoffRange(o, timeline, timeline.fps);
      if (q && r.start <= q.end && q.start <= r.end) throw new Error(`handoff.json: ${k} overlaps ${handoffKey(o)}; shorten leadIn/tail`);
    }
  }
};

export const HandoffLayer: React.FC<{timeline: Timeline; specs: HandoffSpec[]; elements: Record<string, React.ReactNode>}> = ({timeline, specs, elements}) => {
  const frame = useCurrentFrame();
  const {width, height, fps} = useVideoConfig();
  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      {specs.map((s) => {
        const key = handoffKey(s);
        const el = elements[key] ?? elements[s.id];
        const r = handoffRange(s, timeline, fps);
        if (!r || !el || frame < r.start || frame > r.end) return null;
        const p = interpolate(frame, [r.start, r.end], [0, 1], {easing: easing.inOut, extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
        const A = resolvePose(s.from, width, height);
        const B = resolvePose(s.to, width, height);
        const L = (k: keyof PixelPose) => A[k] + (B[k] - A[k]) * p;
        return (
          <div key={key} style={poseStyle({px: L('px'), py: L('py'), scale: L('scale'), rotate: L('rotate'), opacity: L('opacity')})}>
            {el}
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

/** Should a scene draw its own copy of a shared element right now? (false while the hand-off layer owns it,
 *  and false in A after it left / in B before it arrived). Call inside a scene with the scene's window `from` + local frame. */
export const ownsElement = (id: string, sceneId: string, globalFrame: number, timeline: Timeline, specs: HandoffSpec[], fps: number) => {
  for (const s of specs.filter((x) => x.id === id)) {
    const r = handoffRange(s, timeline, fps);
    if (!r) continue;
    if (globalFrame >= r.start && globalFrame <= r.end) return false;
    if (sceneId === s.fromScene && globalFrame > r.end) return false;
    if (sceneId === s.toScene && globalFrame < r.start) return false;
  }
  return true;
};
