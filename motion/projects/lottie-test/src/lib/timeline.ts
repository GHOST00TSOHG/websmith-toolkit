// Timeline engine: reads timeline.json (seconds) and computes frame-accurate scene windows.
// Rule: scene i+1 starts at (start_i + duration_i - transitionOut_i.duration), i.e. transitions overlap.
import {TransitionType, TRANSITIONS} from './transitions';

export type Beat = 'hook' | 'problem' | 'build' | 'reveal' | 'payoff' | 'cta';
/** hit / accents are read by audio/generate.py (cinematic mood): seconds from the scene start. */
export type SceneSpec = {id: string; beat: Beat; duration: number; transitionOut?: {type: TransitionType; duration?: number}; sfx?: string[]; note?: string; hit?: number; accents?: number[]};
export type Timeline = {title: string; fps: number; music?: {bpm: number; key?: string; mood?: 'upbeat' | 'cinematic' | string; feel?: string}; scenes: SceneSpec[]};
export type SceneWindow = SceneSpec & {from: number; frames: number; outFrames: number; inFrames: number; inType?: TransitionType; outType?: TransitionType};

export const computeWindows = (t: Timeline): {windows: SceneWindow[]; total: number} => {
  const fps = t.fps;
  let cursor = 0;
  const windows: SceneWindow[] = [];
  t.scenes.forEach((s, i) => {
    const frames = Math.round(s.duration * fps);
    const outType = i < t.scenes.length - 1 ? s.transitionOut?.type ?? 'cut' : undefined;
    const outFrames = outType ? Math.round((s.transitionOut?.duration ?? TRANSITIONS[outType].defaultDur) * fps) : 0;
    const prev = windows[i - 1];
    windows.push({...s, from: cursor, frames, outFrames, inFrames: prev ? prev.outFrames : 0, inType: prev?.outType, outType});
    cursor += frames - outFrames;
  });
  const last = windows[windows.length - 1];
  return {windows, total: last ? last.from + last.frames : 1};
};
