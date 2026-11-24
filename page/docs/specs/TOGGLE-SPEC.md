# Dark/light toggle spec (from @kaolti reference video, study only; build our own)
- Track: pill, ~2.5-3:1, matte debossed inset shadow (dark top-left, light bottom-right).
- Knob: squircle, slightly taller than track (overlaps edges), flush at ends. Frosted glass: translucent fill + backdrop-filter blur ~10px.
- Shadows: tight drop shadow + large soft colored ambient glow bleeding onto page (orange-yellow light / electric blue-cyan-purple dark).
- Rim: crisp specular highlight, brightest on outer edge, travels/stretches along perimeter during slide; subtle pointer-tracking highlight on hover.
- Icon: sun (light) / crescent moon (dark) made of ~40-50 small squares. On click squares burst radially, rotate, shrink, swap color (black<->white), staggered spring back into the new icon.
- Motion: spring slide with overshoot + settle; total ~500-600 ms. Press: scale ~0.95.
- Page: background crossfades (warm off-white <-> near black) in sync.
