# Roadmap

## Stage 1: Understand and tune
- [ ] Open the web demo; change spring frequency, damping and stagger using the tuning table.
- [ ] Make props reversible with hysteresis; check for flicker at the boundary.

## Stage 2: Look
- [ ] Add a fold crease to tree canopies and an unprinted back-face colour.
- [ ] Replace procedural fibres with a scanned paper texture.
- [ ] Depth-based bokeh instead of the screen-band tilt-shift.

## Stage 3: Interaction
- [ ] Keyboard + tap-to-walk control with auto-walk when idle.
- [ ] Confetti on `InstancedMesh`; fire bursts at the overshoot peak; add a paper "fwip" sound.

## Stage 4: Blender
- [ ] Run `paper_popup_scene.py`, fix any API drift, render 10 s with EEVEE.
- [ ] Rebuild the reveal with a Geometry Nodes simulation zone.
- [ ] Model real papercraft props (unfoldable UVs) and a cut-out character with a walk cycle.

## Stage 5: Ship
- [ ] Port to three.js with GLB props from Blender; reuse `popup.js` unchanged.
- [ ] Scroll-driven version as a website hero, with a poster fallback.
