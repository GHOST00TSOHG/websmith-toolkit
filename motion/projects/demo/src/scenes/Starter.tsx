// Starter scenes: replace these per project. Each scene gets {w} (its timeline window) and lays out
// relative to useVideoConfig() so it works in every format.
import React from 'react';
import {useVideoConfig} from 'remotion';
import {Stage, SplitText, Highlight, Counter, MaskReveal} from '../lib/moves';
import {colors, fonts, type} from '../lib/tokens';
import {LottieIcon} from '../lib/LottieIcon';
import {SceneProps} from '../lib/Story';

const useScale = () => {
  const {width, height} = useVideoConfig();
  return Math.min(width, height);
};

export const Hook: React.FC<SceneProps> = () => {
  const s = useScale();
  return <Stage><SplitText text="Start with a hook." size={s * type.hero} /></Stage>;
};
export const Problem: React.FC<SceneProps> = () => {
  const s = useScale();
  return (
    <Stage>
      <LottieIcon src="lottie/tired-face.json" size={s * 0.25} />
      <div style={{fontFamily: fonts.display, fontWeight: 800, fontSize: s * type.h1, color: colors.text, textAlign: 'center'}}>
        Name the <Highlight color={colors.danger} delay={12}>problem</Highlight>.
      </div>
    </Stage>
  );
};
export const Reveal: React.FC<SceneProps> = () => {
  const s = useScale();
  return (
    <Stage>
      <LottieIcon src="lottie/rocket.json" size={s * 0.3} delay={6} />
      <MaskReveal delay={10}><div style={{fontFamily: fonts.display, fontWeight: 900, fontSize: s * type.h1, color: colors.accent2}}>Reveal the answer.</div></MaskReveal>
    </Stage>
  );
};
export const Payoff: React.FC<SceneProps> = () => {
  const s = useScale();
  return (
    <Stage>
      <Counter to={100} suffix="%" size={s * type.hero} color={colors.ok} />
      <SplitText text="Land the payoff." size={s * type.h2} delay={20} />
    </Stage>
  );
};
export const SCENES = {hook: Hook, problem: Problem, reveal: Reveal, payoff: Payoff};
export const HANDOFF_ELEMENTS = {
  dot: <div style={{width: 90, height: 90, borderRadius: 45, background: colors.accent}} />,
};
