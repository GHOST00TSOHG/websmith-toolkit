// Safe-zone overlay. Toggle with inputProps {"safeZone": true} (studio or --props). Never ship it on.
import React from 'react';
import {AbsoluteFill, useVideoConfig} from 'remotion';
import {FormatId, SAFE} from './formats';

export const SafeZone: React.FC<{format: FormatId; show: boolean}> = ({format, show}) => {
  const {width, height} = useVideoConfig();
  if (!show) return null;
  const s = SAFE[format];
  const box = {top: s.top * height, bottom: s.bottom * height, left: s.left * width, right: s.right * width};
  const shade = 'rgba(255,0,80,0.28)';
  return (
    <AbsoluteFill style={{pointerEvents: 'none', zIndex: 9999}}>
      <div style={{position: 'absolute', left: 0, right: 0, top: 0, height: box.top, background: shade}} />
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 0, height: box.bottom, background: shade}} />
      <div style={{position: 'absolute', left: 0, top: box.top, bottom: box.bottom, width: box.left, background: shade}} />
      <div style={{position: 'absolute', right: 0, top: box.top, bottom: box.bottom, width: box.right, background: shade}} />
      <div style={{position: 'absolute', top: box.top, bottom: box.bottom, left: box.left, right: box.right, border: '3px dashed #00FF9C'}} />
      <div style={{position: 'absolute', top: box.top + 8, left: box.left + 12, color: '#00FF9C', font: '600 26px monospace'}}>SAFE {format}</div>
    </AbsoluteFill>
  );
};
