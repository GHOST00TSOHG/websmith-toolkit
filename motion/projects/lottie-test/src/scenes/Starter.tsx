// Starter scenes: replace these per project. Each scene gets {w} (its timeline window) and lays out relative to
// useVideoConfig() and the format's safe zone (Stage pads to it) so it works in 16:9, 1:1, 4:5 and 9:16.
// Pattern shown here: ONE shared element (the dot) carried through every cut. handoff.json chains
// hook>problem>reveal>payoff; each scene draws its own copy with <Placed> only while ownsElement() says so.
import React from 'react';
import {useCurrentFrame, useVideoConfig} from 'remotion';
import {Stage, SplitText, Highlight, Counter, MaskReveal} from '../lib/moves';
import {colors, fonts, type} from '../lib/tokens';
import {LottieIcon} from '../lib/LottieIcon';
import {SceneProps} from '../lib/Story';
import {HandoffSpec, ownsElement, Placed} from '../lib/Handoff';
import {Timeline} from '../lib/timeline';
import timelineJson from '../timeline.json';
import handoffJson from '../handoff.json';

const timeline = timelineJson as Timeline;
const specs = (handoffJson as {specs: HandoffSpec[]}).specs;
const useScale = () => {
  const {width, height} = useVideoConfig();
  return Math.min(width, height);
};
/** Pose of the dot at the start (`to` of the incoming spec) or end (`from` of the outgoing spec) of a scene. */
const poseIn = (scene: string) => specs.find((s) => s.id === 'dot' && s.toScene === scene)?.to;
const poseOut = (scene: string) => specs.find((s) => s.id === 'dot' && s.fromScene === scene)?.from;

const Dot: React.FC = () => {
  const s = useScale();
  return <div style={{width: s * 0.083, height: s * 0.083, borderRadius: '50%', background: colors.accent}} />;
};
/** The scene's own copy of the dot, held at the scene's pose while the hand-off layer is not drawing it. */
const SceneDot: React.FC<{scene: string; w: SceneProps['w']}> = ({scene, w}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const pose = poseOut(scene) ?? poseIn(scene);
  if (!pose || !ownsElement('dot', scene, w.from + frame, timeline, specs, fps)) return null;
  return <Placed pose={pose}><Dot /></Placed>;
};

export const Hook: React.FC<SceneProps> = ({w}) => {
  const s = useScale();
  return (
    <>
      <Stage><SplitText text="Start with a hook." size={s * type.hero} /></Stage>
      <SceneDot scene="hook" w={w} />
    </>
  );
};
export const Problem: React.FC<SceneProps> = ({w}) => {
  const s = useScale();
  return (
    <>
      <Stage>
        <LottieIcon src="lottie/tired-face.json" size={s * 0.25} delay={4} />
        <div style={{fontFamily: fonts.display, fontWeight: 800, fontSize: s * type.h1, color: colors.text, textAlign: 'center'}}>
          Name the <span style={{whiteSpace: 'nowrap'}}><Highlight color={colors.danger} delay={12}>problem</Highlight>.</span>
        </div>
      </Stage>
      <SceneDot scene="problem" w={w} />
    </>
  );
};
export const Reveal: React.FC<SceneProps> = ({w}) => {
  const s = useScale();
  return (
    <>
      <Stage>
        <LottieIcon src="lottie/rocket.json" size={s * 0.3} delay={6} />
        <MaskReveal delay={10}><div style={{fontFamily: fonts.display, fontWeight: 900, fontSize: s * type.h1, color: colors.accent2, textAlign: 'center'}}>Reveal the answer.</div></MaskReveal>
      </Stage>
      <SceneDot scene="reveal" w={w} />
    </>
  );
};
export const Payoff: React.FC<SceneProps> = ({w}) => {
  const s = useScale();
  return (
    <>
      <Stage>
        <Counter to={100} suffix="%" size={s * type.hero} color={colors.ok} />
        <SplitText text="Land the payoff." size={s * type.h2} delay={20} />
      </Stage>
      <SceneDot scene="payoff" w={w} />
    </>
  );
};
export const SCENES = {hook: Hook, problem: Problem, reveal: Reveal, payoff: Payoff};
// One element per id; per-pair variants can be keyed 'dot:problem>reveal' (handoffKey) if a leg needs a different look.
export const HANDOFF_ELEMENTS: Record<string, React.ReactNode> = {dot: <Dot />};
