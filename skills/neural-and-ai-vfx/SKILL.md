---
name: neural-and-ai-vfx
description: Neural and AI techniques for VFX: 3D/4D Gaussian splatting, NeRFs, differentiable rendering and simulation, ML up-res and deformers, and controlled generative video (ComfyUI with open video models), plus rights and integration practice. Use when capturing real scenes, using ML in effects, or adding generative video to a pipeline.
---

# Neural & AI VFX

Reference: `code/vfx/splats.py` (2D Gaussian splat renderer).

## Gaussian splatting (3DGS) explained
- Scene = millions of anisotropic 3D Gaussians (position, covariance as
  scale + rotation quaternion, opacity, view-dependent color via spherical
  harmonics).
- Render: project each Gaussian to a 2D screen-space Gaussian (Jacobian of the
  projection), sort by depth, alpha-composite front to back. `splats.render`
  is this pipeline in 2D.
- Train: start from structure-from-motion points; optimize every parameter by
  gradient descent against photos; adaptively clone, split and prune Gaussians.
- Why covariance = R S Sᵀ Rᵀ: it stays valid (positive definite) during
  optimization (`covariance_2d`).
- **4D splats** add time (deformation fields or native 4D primitives) for dynamic
  scenes. Wētā FX + AWS showed 4D reconstruction of VFX plates (DigiPro 2026).
- **Production status:** Houdini 22 makes splats native (train, edit, relight,
  rig, animate, render); OpenUSD 26.03 has a splat schema.

## NeRF vs splats
NeRFs store a neural field and are queried by ray marching: compact but slow.
Splats are explicit, fast to render (hundreds of FPS) and easier to edit, which is
why production moved toward them.

## Differentiable rendering & simulation
If every step is differentiable you can **optimize the inputs**: fit materials to
photos, find the initial velocity that makes smoke hit a target shape, or tune
cloth parameters to match a reference. Tools: NVIDIA Warp (autodiff kernels),
PyTorch, Mitsuba 3 (differentiable path tracing). SIGGRAPH 2026 had new work on
gradients for differentiable volume rendering.

## ML inside classic VFX tools
Houdini 21 includes ML Volume Upres for Pyro (simulate coarse, add learned detail)
and ML deformers. Houdini 22 adds ML nodes in Copernicus and Solaris.
Denoisers (OIDN, OptiX) are standard in every renderer.

## Controlled generative video
- ComfyUI graphs with open models (Wan 2.x family including Animate, Fun Control
  and VACE variants, LTX-2, HunyuanVideo). Control comes from depth, pose, edges,
  first/last frames, motion paths and reference images.
- The production pattern is **CG for control, generative for detail**: render
  layout, depth and pose passes in Blender or Houdini, drive the model with them,
  then comp the result with traditional tools (grain, color, edges).
- Practice: lock seeds, version graphs, keep provenance; check model licences and
  the rights to any reference footage, likenesses or styles before commercial use.

## Exercises
1. Write a gradient-descent fitter for `splats.render` (use PyTorch for autograd)
   that approximates an image with 200 Gaussians.
2. Animate splats by moving their means along a curl-noise field: "rigging" a splat
   cloud.
3. Render depth and pose passes from Blender for a ComfyUI control workflow.

Part of `kits/advanced-vfx-kit`. Code paths in this skill (such as `code/...`) are relative to that folder.
