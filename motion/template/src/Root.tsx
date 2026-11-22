// Registers the story in 4 formats. Duration comes from timeline.json (transitions overlap).
// Toggle safe-zone overlay: --props='{"safeZone":true}' or in Studio's props panel.
import React from 'react';
import {Audio, Composition, staticFile} from 'remotion';
import timelineJson from './timeline.json';
import handoffJson from './handoff.json';
import {computeWindows, Timeline} from './lib/timeline';
import {Story} from './lib/Story';
import {HandoffLayer, HandoffSpec, validateHandoffs} from './lib/Handoff';
import {SafeZone} from './lib/SafeZone';
import {FORMATS, FormatId} from './lib/formats';
import {SCENES, HANDOFF_ELEMENTS} from './scenes/Starter';

const timeline = timelineJson as Timeline;
const specs = (handoffJson as {specs: HandoffSpec[]}).specs;
const {total} = computeWindows(timeline);
validateHandoffs(timeline, specs); // fails fast on clashing hand-offs

type Props = {format: FormatId; safeZone: boolean; withAudio: boolean};

const Main: React.FC<Props> = ({format, safeZone, withAudio}) => (
  <>
    <Story timeline={timeline} scenes={SCENES} overlay={<HandoffLayer timeline={timeline} specs={specs} elements={HANDOFF_ELEMENTS} />} />
    {/* Preview only. Final audio is muxed with ffmpeg (loudnorm) after render, see PLAYBOOK.md. */}
    {withAudio ? <Audio src={staticFile('audio/soundtrack.wav')} /> : null}
    <SafeZone format={format} show={safeZone} />
  </>
);

export const RemotionRoot: React.FC = () => (
  <>
    {(Object.keys(FORMATS) as FormatId[]).map((f) => (
      <Composition
        key={f}
        id={`Story-${f}`}
        component={Main}
        durationInFrames={total}
        fps={timeline.fps}
        width={FORMATS[f].width}
        height={FORMATS[f].height}
        defaultProps={{format: f, safeZone: false, withAudio: false}}
      />
    ))}
  </>
);
