# Skill usage log

Format: skill | where | file(s) | round. A skill that does not fit is marked "not used here" with one honest line (D15). Updated before every commit.

| Skill | Where | File(s) | Round |
|---|---|---|---|
| `thinking-orbs` | The ThinkingOrbs card demo (both the skill card and the animation card): all nine presets in a pickable grid, plus the chosen one at 64 and 20 on a dark and a light patch. Drawn by the vendored thinking-orbs 0.3.2 engine through `resolvePreset` and `MODE_DRAWS`, driven by time (not randomness), with its NOTICE and LICENSE kept next to the code. Chat orbs and the picker come in R3. | `src/demos/orbs.ts`, `src/vendor/thinking-orbs/` | R2 |
| `iphone-safari-touch-haptics` | `viewport-fit=cover`, safe-area padding and `100dvh` on the body. The theme toggle is a real `<input type="checkbox" switch>` that the user's own tap flips (iOS 18 tick, never a scripted click). Hero wake and liquid-chip drag use Pointer Events with `setPointerCapture`, no Touch Events; chips use `touch-action: pan-y`. The touch-pad card demo uses `touch-action: none` on that canvas only (page zoom stays on, checked by a test) and a real switch input; `navigator.vibrate` is feature-detected (Android only). | `index.html`, `src/styles/layout.css`, `src/theme/toggle.ts`, `src/hero/ascii-wake.ts`, `src/fusion/chips.ts`, `src/demos/touch.ts` | R2 |
| `audio-reactive-visuals` | The audio card demo only (D9): one `AudioContext`, created and resumed in the tap on Play (with a "Tap to turn sound on" fallback where the browser needs the tap itself), an `AnalyserNode` read into one reused `Uint8Array`, smoothed bass, mid and high values driving the bars, a mute control, a look-ahead scheduler on the audio clock, a synthesised beat (no audio files), no autoplay. No sound anywhere else. | `src/demos/audio.ts` | R2 |
| `stylized-water-sky-weather` | The weather card demo only, in our own WebGL2 (D8, no three.js): one sun direction shared by sky, water reflection and glitter, procedural clouds on one wind value, rain streaks, half resolution on phones, wind and rain sliders, draws only while playing and on screen. Rain is shader streaks rather than a points pass, and there is no calm toggle (item 34). | `src/demos/weather.ts` | R2 |
| `web-motion-libraries` | Decision recorded: no GSAP (its licence is not on the allowed list, and nothing here needs ScrollTrigger); no three.js and no WebGPU (WebGPU is still experimental), so our own WebGL2 is used for the liquid chips and the weather demo. Motion is CSS, Web Animations, the one rAF loop and a small spring solver. The card for this skill shows the same reasoning as a before and after. | `docs/PLAN.md` section 6, `src/engine/spring.ts`, `src/demos/before-after.ts` | R2 |
| `installable-pwa` | Waits for R4 (manifest, icons, service worker, offline shell). Nothing built in R2; the card shows a before and after. | (R4) | R4 |
| `admin-backoffice` | Decide in R3 (activity log, autonomy columns). Not used in R2; the card shows a before and after. | | R3 |
| `payments-test-mode` | Not used here: there are no payments. | | n/a |
| `ship-whole-app` | Not used here: it is about Cloudflare; this page ships to GitHub Pages. | | n/a |
| `swiftui-home-widgets` | Not used here: a web page cannot build a widget. | | n/a |

The skill cards themselves (all ten) are on the page with a plain-English line and a demo that shows what the skill is about, built from `vendor/websmith-toolkit` by `scripts/build-manifest.ts`.

## R3 visual rebuild (Nov 24 2026)

- `motion-and-interaction-design`: one easing curve plus a spring, motion for every state change, reduced motion as crossfades.
- `interpolation-and-easing-math`: the cubic-bezier solver, the critically damped `follow()` and the `linear()` spring samples.
- `iphone-safari-touch-haptics`: switch-input haptics on the filter chips and the theme toggle, 44px taps, `touch-action`.
- `procedural-fx-patterns`: builder sparks, cable packet trails and the card preview recipes.
- `paper-particles-and-secondary-motion`: overshoot and settle on the ASCII lock-in and the sun dip.
- `thinking-orbs` (vendored engine): the hero orb, the card previews and the agent picker orbs.

## R3 polish 3
- procedural-and-physics-animation: fixed-timestep Verlet cloth with constraint projection (src/cloth/cloth.ts).
- procedural-fx-patterns: quintic gradient noise and fBm for the wind field and its gusts; weave shader.
- motion-and-interaction-design: one-shot depth reveals, 60 fps cap, reduced-motion drape.
- iphone-safari-touch-haptics: the cloth's tap ticks a real switch input; `touch-action: pan-y` keeps scrolling.
