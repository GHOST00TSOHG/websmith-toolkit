// Demo story: "Make it move." 7 beats, ~20 s. hook → problem ×2 → build ×2 → reveal → payoff.
import React from 'react';
import {AbsoluteFill, useCurrentFrame, useVideoConfig} from 'remotion';
import {Stage, SplitText, Highlight, Counter, MaskReveal, StackCards, RollingWord, PathDraw, HorizontalRail, Morph, SHAPES, Parallax} from '../lib/moves';
import {colors, fonts, type, easing} from '../lib/tokens';
import {LottieIcon} from '../lib/LottieIcon';
import {SceneProps} from '../lib/Story';
import {ownsElement, HandoffSpec} from '../lib/Handoff';
import {Timeline} from '../lib/timeline';
import {progress, sec, rand} from '../lib/motion';
import timelineJson from '../timeline.json';
import handoffJson from '../handoff.json';

const timeline = timelineJson as Timeline;
const specs = (handoffJson as {specs: HandoffSpec[]}).specs;
const useS = () => {
  const {width, height} = useVideoConfig();
  return Math.min(width, height);
};
const H: React.FC<{size: number; color?: string; children: React.ReactNode; style?: React.CSSProperties}> = ({size, color = colors.text, children, style}) => (
  <div style={{fontFamily: fonts.display, fontWeight: 800, fontSize: size, color, letterSpacing: '-0.02em', textAlign: 'center', lineHeight: 1.1, ...style}}>{children}</div>
);

// 1. HOOK: countdown pressure
const Hook: React.FC<SceneProps> = () => {
  const s = useS();
  return (
    <Stage>
      <LottieIcon src="lottie/alarm-clock.json" size={s * 0.22} delay={2} />
      <div style={{display: 'flex', alignItems: 'baseline', gap: s * 0.03, marginTop: s * 0.02}}>
        <SplitText text="You have" size={s * type.h1} />
        <Counter from={10} to={3} dur={1.3} delay={8} size={s * type.hero * 1.2} color={colors.warm} />
        <SplitText text="seconds." size={s * type.h1} delay={10} />
      </div>
    </Stage>
  );
};

// 2. PROBLEM: slides stack up, nobody reads
const Slide: React.FC<{s: number}> = ({s}) => (
  <div style={{width: '80%'}}>
    {[0.9, 0.7, 0.8, 0.5].map((w, i) => (
      <div key={i} style={{height: s * 0.018, width: `${w * 100}%`, background: colors.grey, borderRadius: 8, margin: `${s * 0.022}px 0`}} />
    ))}
  </div>
);
const Problem: React.FC<SceneProps> = () => {
  const s = useS();
  return (
    <Stage style={{flexDirection: 'row', gap: s * 0.12}}>
      <StackCards cards={[0, 1, 2].map((i) => <Slide key={i} s={s} />)} w={s * 0.48} h={s * 0.3} />
      <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center'}}>
        <LottieIcon src="lottie/tired-face.json" size={s * 0.2} delay={10} />
        <H size={s * type.h1}>
          Slides don't get <Highlight mode="strike" color={colors.danger} delay={30}>read</Highlight>.
        </H>
      </div>
    </Stage>
  );
};

// 3. PROBLEM 2: static is forgettable
const Problem2: React.FC<SceneProps> = () => {
  const s = useS();
  return (
    <Stage bg={colors.bgAlt}>
      <H size={s * type.h1}>
        Static is <RollingWord words={['flat.', 'dull.', 'forgettable.']} each={0.6} delay={8} size={s * type.h1} color={colors.danger} />
      </H>
    </Stage>
  );
};

// 4. BUILD: the story arc draws itself
const Build: React.FC<SceneProps> = () => {
  const s = useS();
  const {width, height} = useVideoConfig();
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const W = width * 0.8, Hh = height * 0.4;
  const pts = [[0, 0.75], [0.25, 0.6], [0.5, 0.45], [0.75, 0.05], [1, 0.3]].map(([x, y]) => [x * W, y * Hh]);
  const d = `M ${pts[0][0]} ${pts[0][1]} C ${W * 0.12} ${Hh * 0.7}, ${W * 0.18} ${Hh * 0.62}, ${pts[1][0]} ${pts[1][1]} S ${W * 0.42} ${Hh * 0.5}, ${pts[2][0]} ${pts[2][1]} S ${W * 0.68} ${Hh * 0.0}, ${pts[3][0]} ${pts[3][1]} S ${W * 0.92} ${Hh * 0.28}, ${pts[4][0]} ${pts[4][1]}`;
  const labels = ['Hook', 'Problem', 'Build', 'Reveal', 'Payoff'];
  return (
    <Stage style={{justifyContent: 'flex-start', paddingTop: '9%'}}>
      <SplitText text="So tell a story." size={s * type.h1} />
      <div style={{position: 'relative', width: W, height: Hh, marginTop: s * 0.08}}>
        <PathDraw d={d} width={W} height={Hh} delay={10} dur={1.6} strokeWidth={s * 0.008} />
        {pts.map(([x, y], i) => {
          const p = progress(frame, 10 + sec(fps, 0.32 * i), sec(fps, 0.4), easing.overshoot);
          return (
            <div key={i} style={{position: 'absolute', left: x, top: y, transform: `translate(-50%,-50%) scale(${p})`, display: 'flex', flexDirection: 'column', alignItems: 'center'}}>
              <div style={{width: s * 0.035, height: s * 0.035, borderRadius: '50%', background: i === 3 ? colors.warm : colors.accent2, boxShadow: `0 0 ${s * 0.03}px ${i === 3 ? colors.warm : colors.accent2}`}} />
              <div style={{position: 'absolute', top: s * 0.045, fontFamily: fonts.body, fontWeight: 600, fontSize: s * type.caption * 1.2, color: colors.textDim, whiteSpace: 'nowrap'}}>{labels[i]}</div>
            </div>
          );
        })}
      </div>
    </Stage>
  );
};

// 5. BUILD 2: the ingredients rail, then the dot hands off to the reveal
const Dot: React.FC<{s: number}> = ({s}) => (
  <div style={{width: s * 0.28 * 0.8, height: s * 0.28 * 0.8, borderRadius: '50%', background: colors.accent, boxShadow: `0 0 ${s * 0.06}px ${colors.accent}`}} />
);
export const HandoffDot: React.FC = () => <Dot s={useS()} />;

const Build2: React.FC<SceneProps> = ({w}) => {
  const s = useS();
  const frame = useCurrentFrame();
  const {fps, width, height} = useVideoConfig();
  const items: [string, string][] = [['Code', 'lottie/settings.json'], ['Timing', 'lottie/activity.json'], ['Sound', 'lottie/loading.json'], ['Icons', 'lottie/star.json']];
  const card = (label: string, src: string, i: number) => (
    <div style={{height: s * 0.36, borderRadius: s * 0.03, background: colors.surface, border: `2px solid ${colors.grey}`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: s * 0.02}}>
      <LottieIcon src={src} size={s * 0.16} color={colors.accent2} delay={6 + i * 5} />
      <H size={s * type.h2}>{label}</H>
    </div>
  );
  const owns = ownsElement('dot', 'build2', w.from + frame, timeline, specs, fps);
  const dotIn = progress(frame, sec(fps, 1.6), sec(fps, 0.4), easing.overshoot);
  return (
    <AbsoluteFill style={{background: colors.bg}}>
      <HorizontalRail items={items.map(([l, src], i) => card(l, src, i))} dur={2.4} itemWidth={s * 0.36} gap={s * 0.05} style={{top: '-8%'}} />
      {owns ? (
        <div style={{position: 'absolute', left: width * 0.5, top: height * 0.84, transform: `translate(-50%,-50%) scale(${0.22 * dotIn})`}}><Dot s={s} /></div>
      ) : null}
    </AbsoluteFill>
  );
};

// 6. REVEAL: dot morphs into a play button; parallax depth; rocket
const Reveal: React.FC<SceneProps> = ({w}) => {
  const s = useS();
  const frame = useCurrentFrame();
  const {fps, width, height} = useVideoConfig();
  const owns = ownsElement('dot', 'reveal', w.from + frame, timeline, specs, fps);
  const bgDots = Array.from({length: 24}, (_, i) => ({x: rand(i) * width, y: rand(i + 50) * height, r: 4 + rand(i + 99) * 10, depth: rand(i + 7)}));
  return (
    <AbsoluteFill style={{background: colors.bg}}>
      <Parallax dur={3.4} distance={width * 0.25} layers={[0, 1, 2].map((layer) => ({
        depth: layer / 2,
        node: <>{bgDots.filter((_, i) => i % 3 === layer).map((d, i) => <div key={i} style={{position: 'absolute', left: d.x, top: d.y, width: d.r * (1 + layer), height: d.r * (1 + layer), borderRadius: '50%', background: layer === 2 ? colors.accent2 : colors.grey, opacity: 0.25 + layer * 0.2}} />)}</>,
      }))} />
      {owns ? (
        <div style={{position: 'absolute', left: width * 0.5, top: height * 0.36, transform: 'translate(-50%,-50%)'}}>
          <Morph from={SHAPES.circle} to={SHAPES.play} delay={4} dur={0.6} size={s * 0.28} fill={colors.accent} style={{filter: `drop-shadow(0 0 ${s * 0.04}px ${colors.accent})`}} />
        </div>
      ) : null}
      <LottieIcon src="lottie/rocket.json" size={s * 0.16} delay={18} style={{position: 'absolute', left: width * 0.5 + s * 0.2, top: height * 0.36 - s * 0.2}} />
      <AbsoluteFill style={{top: '62%', alignItems: 'center', padding: '0 8%'}}>
        <MaskReveal delay={14}>
          <H size={s * type.h1}>Motion that <span style={{color: colors.accent2}}>tells a story.</span></H>
        </MaskReveal>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// 7. PAYOFF
const Payoff: React.FC<SceneProps> = () => {
  const s = useS();
  return (
    <Stage>
      <div style={{display: 'flex', alignItems: 'center', gap: s * 0.03}}>
        <LottieIcon src="lottie/party-popper.json" size={s * 0.22} delay={4} />
        <SplitText text="Make it move." size={s * type.hero} by="char" delay={8} />
      </div>
      <div style={{display: 'flex', alignItems: 'center', gap: s * 0.015, marginTop: s * 0.05}}>
        <LottieIcon src="lottie/check.json" size={s * 0.09} color={colors.ok} delay={34} loop={false} />
        <MaskReveal delay={28}>
          <H size={s * type.h2} color={colors.textDim}>
            Story-driven <Highlight mode="underline" color={colors.ok} delay={44}>motion graphics</Highlight>, built in code.
          </H>
        </MaskReveal>
      </div>
    </Stage>
  );
};

export const SCENES = {hook: Hook, problem: Problem, problem2: Problem2, build: Build, build2: Build2, reveal: Reveal, payoff: Payoff};
export const HANDOFF_ELEMENTS = {dot: <HandoffDot />};
