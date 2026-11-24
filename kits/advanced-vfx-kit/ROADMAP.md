# Advanced VFX Roadmap

## Stage 1: Solvers you understand completely
- [ ] Convert `Smoke2D` to a staggered MAC grid with a conjugate-gradient pressure solve.
- [ ] Add fuel + combustion expansion: a fireball.
- [ ] Self-collision for `XPBDCloth` with a spatial hash; tear constraints over a threshold.
- [ ] 2D FLIP liquid (dam break) reusing the projection.

## Stage 2: Look development
- [ ] Replace `to_display` with OpenColorIO ACES 2.0; compare with the fitted curve.
- [ ] Volume-render the smoke with a light direction (shadow-march density).
- [ ] SDF neon glow + anamorphic bloom streaks.

## Stage 3: GPU
- [ ] Port advection + projection to NVIDIA Warp or Taichi; run 1024² in real time.
- [ ] Write the SDF scene as a GLSL shader (moderngl) and render 4K.
- [ ] MLS-MPM snow in Taichi or Warp.

## Stage 4: Characters
- [ ] Motion matching on a procedural 2D walker with inertialized transitions.
- [ ] Foot locking with two-bone IK.
- [ ] Try Unreal 5.7's Game Animation Sample (GASP) and read its Chooser + Pose Search setup.

## Stage 5: Neural
- [ ] Fit 2D Gaussian splats to an image with PyTorch autograd.
- [ ] Capture a real object, train 3DGS, bring it into Houdini 22 (Apprentice) or Blender.
- [ ] Controlled generative pass: render depth/pose from Blender, drive a ComfyUI
      video workflow, comp the result with grain matching.

## Stage 6: Production tools
- [ ] Houdini Apprentice: Pyro, Vellum and FLIP versions of every kit demo; compare.
- [ ] Blender 5 Geometry Nodes: SDF grid modeling + volume advection.
