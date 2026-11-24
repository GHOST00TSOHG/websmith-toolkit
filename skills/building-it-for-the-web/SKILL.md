---
name: building-it-for-the-web
description: Building the paper pop-up world as a real-time web experience: the kit's dependency-free WebGL2 implementation (architecture, render passes, testing), how to port it to three.js (Groups as hinges, instancing, EffectComposer/TSL post), React Three Fiber, keyboard/touch control, performance budgets and accessibility. Use when making this effect interactive in a browser or as a site hero.
---

# Building It for the Web

Reference: `code/web/` is a working WebGL2 implementation with no libraries.
- `popup.js`: triggers, spring, pose, spatial hash, path (tested in Node).
- `world.js`: geometry builder, props, paper shader, contact shadows, confetti, follow camera, tilt-shift post pass.
- `index.html`: boot, reduced motion, WebGL fallback, and `?t=SECONDS` to fast-forward
  (simulate without drawing, then render one frame) for tests and screenshots.
- `demo/paper_popup_demo.mp4`: 12 s capture of the result.

## Architecture (per frame)
1. Update the walker on its path → query nearby props (spatial hash) → update
   triggers → spawn confetti on "popped".
2. **Pass 1** into an offscreen framebuffer (half-float if available): ground,
   blended contact shadows (no depth write), props with their hinge pose, character, confetti.
3. **Pass 2** to the screen: tilt-shift blur, ACES tonemap, sRGB encode, warm grade,
   vignette, grain.

## Porting to three.js
| Kit | three.js |
|---|---|
| `Geo` boxes/prisms/cards | `BoxGeometry`, `ExtrudeGeometry`, `ShapeGeometry`; or model in Blender → GLB |
| Hinge pose | Prop meshes inside a `Group` positioned at the base; animate `group.rotation.x` and `scale` |
| Paper shader | `MeshStandardMaterial` + `onBeforeCompile`, or a TSL node material (fibre noise, edge factor) |
| Contact shadows | `ContactShadows` (drei) or a transparent radial-gradient plane |
| Confetti | `InstancedMesh` with per-instance matrix updates |
| Tilt-shift | Postprocessing `TiltShiftEffect` / custom pass, or TSL post with `WebGPURenderer` |
| `popup.js` | Reuse unchanged: it's engine-agnostic |

React Three Fiber: one `<Prop>` component reading `progress` from a store, with
`useFrame` driving the pose; drei helpers for contact shadows and environment.

## Interaction
Let the player drive: WASD/arrow keys, tap-to-move (raycast the ground), or
scroll-driven walking along the path for a site hero. Keep the auto-walk as an
attract mode when idle.

## Budgets and performance
Cap devicePixelRatio at 2, instance repeated props, keep draw calls ≲ 100,
pause when hidden or off-screen, and don't block LCP (load the 3D after
the content, show a poster first). The blur pass is the most expensive step,
so reduce samples on low-end GPUs.

## Accessibility
`prefers-reduced-motion`: no overshoot, no confetti, no camera lag (tested).
Give the canvas a text description; never put essential info only in the 3D scene.

## Testing approach (in the kit)
Node tests for the logic; Playwright + headless Chrome for rendering: props pop as
time advances, the frame isn't blank (pixel statistics), reduced motion has zero
confetti, and the no-WebGL fallback shows. Fast-forward with `?t=` keeps tests quick.

## Exercises
1. Add keyboard control and tap-to-walk; keep auto-walk when idle.
2. Port to three.js with GLB props exported from the Blender scene.
3. Turn it into a scroll-driven landing page where scrolling walks the cat.

Part of `kits/paper-popup-world-kit`. Code paths in this skill (such as `code/...`) are relative to that folder.
