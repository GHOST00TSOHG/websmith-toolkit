---
name: audio-reactive-visuals
description: >-
  Use this when driving a three.js or canvas scene from music, including live
  Web Audio analysis, beat or onset detection, iOS Safari unlock, and offline
  audio-driven video.
---
# Audio-reactive visuals

Make the picture move with the sound, in a WebGL three.js scene on Cloudflare Pages with self-hosted libraries and iPhone 15 Safari as the minimum.

## Live path

Use the browser's built-in **`AnalyserNode`**; no package is needed. Create **one** `AudioContext` and unlock it inside a user tap or click, as the browser autoplay rules require. If `state === "suspended"`, `await audioCtx.resume()`, then start playback in that same handler. Reuse that context, listen for `statechange`, and resume again after interruptions. Put `playsinline` on media elements and offer a mute control.

Connect the audio source to the analyser and the analyser to the destination. Each frame, read frequency or waveform data into a typed array you reuse. Reduce it to a few smoothed values (bass, mids, highs, overall level) and feed those into three.js uniforms, instance scales or bloom. Time the motion from `audioCtx.currentTime` or the media element's `currentTime`, not just `performance.now()`.

Honour `prefers-reduced-motion`, and never flash the screen at rates that could trigger seizures.

## Onsets and beats

- For live onsets, a simple spectral-flux peak picker on the analyser's frequency bins is enough.
- For onset times worked out ahead of playback, use `@audio/beat-onset` 1.0.4 (MIT on npm). Its repo's licence file also adds a "Krishnized License" line that isn't clearly defined, so write your own flux picker if that's a concern.
- To get BPM from an `AudioBuffer`, use `web-audio-beat-detector` 8.2.39 (MIT).
- `meyda` 5.6.3 (MIT) offers richer audio features, but its analyser still uses the deprecated `ScriptProcessorNode`, so don't use it for per-frame work when `AnalyserNode` is enough.

For a known track, precompute the cues into a small JSON file and use the live analyser only for overall loudness.

Vendor any helper library into `vendor/` with its `LICENSE`. No CDNs.

## Offline video

`@remotion/media-utils` 4.0.545 is **MIT**. It provides `getAudioData`, `visualizeAudio` and related helpers, though its hooks only work inside Remotion. Remotion's renderer, CLI and core preview are under the separate **Remotion License**: free for individuals and for-profit companies with up to 3 employees, while larger companies need a paid Company License. If the free terms don't apply, analyse the audio with media-utils or Web Audio, render the frames yourself, and encode them with a tool whose licence is cleared, or with `MediaRecorder`.

## Don't

- Start audio on page load and expect iOS to play it.
- Allocate new analyser arrays every frame, or time the visuals only from the wall clock.
- Pull `@remotion/renderer` into a production web app, or render with Remotion when the company doesn't meet the free licence terms.
