---
name: stylized-water-sky-weather
description: >-
  Use this when adding stylized water, sky, clouds, rain, snow, fog, or
  wind-swayed grass and trees to a three.js scene, in WebGL or WebGPU/TSL.
---
# Stylized water, sky, and weather

Build weather from the official **three.js** addons (MIT), self-hosted, with a WebGL path that runs in Safari on an iPhone 15. Don't pull in a third-party scene kit unless its licence has been checked and is permissive.

## What to use

- **Sky:** `Sky` on `WebGLRenderer`, or `SkyMesh` on `WebGPURenderer` (only `SkyMesh` has cloud uniforms). Import from `three/addons/objects/Sky.js` or `SkyMesh.js`.
- **Water:** `Water`, or the flowing `Water2`, on WebGL; `WaterMesh` on WebGPU. Use the same sun direction as the sky, and keep the reflection resolution modest on phones.
- **Fog:** core `THREE.Fog` or `THREE.FogExp2`, matched to the horizon colour.
- **Rain and snow:** the official compute-particle examples only work on WebGPU. For iPhone 15, use `Points` or `InstancedMesh` with a simple fall-and-drift shader, because compute particles won't run on WebGL.
- **Grass and trees:** there's no official addon. Instance the grass blades or tree cards, and drive them all from one shared wind field in world space. Bend blades more at the tip, with a little droop so they keep their length. Sway the tree crowns, not the trunks.

Safari 26 added WebGPU, but Apple's own pages don't confirm it on the base iPhone 15. Ship WebGL and treat TSL and compute-based weather as optional extras.

Never put `Sky` or `Water` on `WebGPURenderer`, or `SkyMesh` or `WaterMesh` on `WebGLRenderer`.

## Vendor

Pin a three.js version. Copy into `vendor/` the build files, the addons you import (plus anything they import locally) and the `LICENSE`, then point the import map there. No CDNs. Only use normal maps and particle sprites you have the rights to, and don't assume the example textures are cleared until you've checked their credits.

## Build order

1. Lock a stylized palette. Drive the sun position, clouds, wind and precipitation from uniforms, fed by the time of day or live weather.
2. Add the sky at a large scale. Hide the sun disc while baking an environment map, then show it again.
3. Add water and fog in the same colour family, at a resolution phones can handle.
4. Add instanced rain or snow, with particles in the low thousands. Honour `prefers-reduced-motion` and offer a calm-mode toggle.
5. Add instanced grass and swaying foliage on the same wind field, with distance limits.

## Don't

- Overload phones with huge water render targets, full Retina resolution, or unlimited grass.
- Keep weather moving when the user has asked for reduced motion.
- Load three.js from a CDN.
