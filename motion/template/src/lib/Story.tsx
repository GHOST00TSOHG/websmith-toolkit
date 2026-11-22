// <Story>: renders scenes from timeline.json with the named transitions between them,
// plus the shared-element hand-off layer and optional safe-zone overlay.
import React from 'react';
import {AbsoluteFill, Sequence, useCurrentFrame, useVideoConfig, interpolate} from 'remotion';
import {computeWindows, SceneWindow, Timeline} from './timeline';
import {TRANSITIONS} from './transitions';
import {colors} from './tokens';

export type SceneProps = {w: SceneWindow};
export type SceneRegistry = Record<string, React.FC<SceneProps>>;

const SceneShell: React.FC<{w: SceneWindow; Comp: React.FC<SceneProps>}> = ({w, Comp}) => {
  const frame = useCurrentFrame(); // local to the Sequence
  const {width, height} = useVideoConfig();
  let style: React.CSSProperties = {};
  if (w.inType && w.inFrames > 0 && frame < w.inFrames) {
    const t = TRANSITIONS[w.inType];
    style = {...style, ...t.fn(t.ease(interpolate(frame, [0, w.inFrames], [0, 1], {extrapolateRight: 'clamp'})), 'in', width, height)};
  }
  if (w.outType && w.outFrames > 0 && frame >= w.frames - w.outFrames) {
    const t = TRANSITIONS[w.outType];
    style = {...style, ...t.fn(t.ease(interpolate(frame, [w.frames - w.outFrames, w.frames], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'})), 'out', width, height)};
  }
  return (
    <AbsoluteFill style={{...style, background: colors.bg, willChange: 'transform'}}>
      <Comp w={w} />
    </AbsoluteFill>
  );
};

export const Story: React.FC<{timeline: Timeline; scenes: SceneRegistry; overlay?: React.ReactNode}> = ({timeline, scenes, overlay}) => {
  const {windows} = computeWindows(timeline);
  // Incoming scene must render ABOVE outgoing for clip/slide transitions; outgoing on top for cameraDive/zoomOut.
  const order = windows.map((w, i) => ({w, i, z: i}));
  windows.forEach((w, i) => {
    if (w.outType === 'cameraDive' || w.outType === 'zoomOut') order[i].z = i + 1.5; // outgoing over incoming during dive
  });
  return (
    <AbsoluteFill style={{background: colors.bg}}>
      {order.sort((a, b) => a.z - b.z).map(({w}) => {
        const Comp = scenes[w.id];
        if (!Comp) throw new Error(`No scene component registered for "${w.id}"`);
        return (
          <Sequence key={w.id} from={w.from} durationInFrames={w.frames} name={`${w.beat}: ${w.id}`}>
            <SceneShell w={w} Comp={Comp} />
          </Sequence>
        );
      })}
      {overlay}
    </AbsoluteFill>
  );
};
