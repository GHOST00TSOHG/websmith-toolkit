# Data cables spec (original build; ref flandermaxx video is study-only, never publish)
Owner request: "cables flowing data to the next card".
- Cables: thin 1.5px cubic beziers, exit card right edge horizontally, enter next card left edge. Color = source card accent, neon glow (blue liquid-glass palette; light mode = ink on blueprint paper).
- Draw-on: cable strokes itself left->right over ~500ms (stroke-dashoffset or canvas path progress), drafted by helper cursors during intro.
- Data: small bright glowing dots (no trails), steady rhythmic stream, ~0.5–1s per cable, one direction (source -> next).
- Arrival: target card gets a quick glow-ring pulse; task chips flip to a check. Final/Done node: expanding ring pulse.
- Counters tick up as dots land; optional mono log line ("12:04:31 ui-builder → tests ok").
- Where: skill chips -> Plan sheet, Plan -> worker (Claude/ChatGPT), and the status trail Planned→Sent→Building→Done; idle ambient flow between related toolkit cards (on hover, highlight that card's cables).
- Our twist vs ref: no chaotic mesh; organized blueprint wiring with dimension ticks at cable ends.
- Perf: one canvas/SVG layer, rAF, pause offscreen; positions from getBoundingClientRect, recompute on resize/scroll.
