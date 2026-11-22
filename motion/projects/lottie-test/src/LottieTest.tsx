// Proof for the LottieIcon fixes (Noto party popper, 60 fps Lottie, 92 frames). 400 px cells, pop off, so only the
// Lottie frame differs. A = new, delay 0 | B = new, delay 20 | C = OLD (Animator's) component, delay 20 |
// D = new, delay 20, trim [10, 40), play once | E = new, delay 20, nativeSpeed.
// Expected: B@20+k == A@k; C@20+k == A@20+k (the old bug); D@20+k == A@10+k, holding A@39; E@20+k == A@2k.
import React from 'react';
import {AbsoluteFill} from 'remotion';
import {LottieIcon} from './lib/LottieIcon';
import {LottieIcon as OldLottieIcon} from './lib/LottieIconOld';
const cell: React.CSSProperties = {width: 400, height: 400, background: '#fff'};
const SRC = 'lottie/party-popper.json';
export const LottieTest: React.FC = () => (
  <AbsoluteFill style={{flexDirection: 'row', background: '#fff'}}>
    <div style={cell}><LottieIcon src={SRC} size={400} delay={0} pop={false} /></div>
    <div style={cell}><LottieIcon src={SRC} size={400} delay={20} pop={false} /></div>
    <div style={cell}><OldLottieIcon src={SRC} size={400} delay={20} pop={false} loop={false} /></div>
    <div style={cell}><LottieIcon src={SRC} size={400} delay={20} pop={false} trim={[10, 40]} playOnce /></div>
    <div style={cell}><LottieIcon src={SRC} size={400} delay={20} pop={false} nativeSpeed /></div>
  </AbsoluteFill>
);
