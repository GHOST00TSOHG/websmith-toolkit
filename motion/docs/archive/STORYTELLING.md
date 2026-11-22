> **ARCHIVED (Animator's original, 2026-11-19). Superseded by [../../PLAYBOOK.md](../../PLAYBOOK.md) (and [../../WEB.md](../../WEB.md) for §10). Paths below point at the old /workspace/motion toolkit. Do not edit; do not follow where it disagrees with PLAYBOOK.md.**

# Storytelling for motion graphics

Every video is a story with an arc, not an animated slide. Default arc:
**Hook → Problem → Build → Reveal → Payoff (→ CTA)**. 7 beats for ~20 s, 5 beats for ~12 s, 10–12 beats for 45–60 s.

## Beat recipes
| beat | job | duration (of 20 s) | recipe (moves) | energy / audio |
|---|---|---|---|---|
| Hook | Stop the scroll in < 1 s. A number, a question, a tension. | 2.5–3.5 s | `SplitText` + `Counter`, or a bold Noto emoji pop; motion in frame 0 (no fade-from-black) | pad + hats, light |
| Problem | Name the pain the viewer feels. | 2.5–3 s ×1–2 | `StackCards` (clutter), `Highlight mode="strike"`, `RollingWord` of bad adjectives, `danger` color, tired/thinking emoji | add bass, darker filter |
| Build | Show the mechanism, step by step. | 3–3.5 s ×1–2 | `PathDraw` (process/arc), `HorizontalRail` (ingredients/steps), `PinnedScrub` (feature list past a pinned title), useAnimations UI icons | add kick, filter opens |
| Reveal | The answer / product / insight, one hero shape. | 3–3.5 s | shared-element hand-off into `Morph`, `MaskReveal` headline, `Parallax` depth, hero Lottie (rocket/sparkles) | riser → duck → impact; full kit |
| Payoff | Result + emotion. | 3.5–4 s | `Counter` of the result, `SplitText` by char, `Highlight underline`, party/check icons | full + sparkle arps, ring-out |
| CTA (optional) | One action, in the safe zone. | 2–3 s | short line + logo; hold still | pad tail |

## Transitions catalog (`src/lib/transitions.ts`, set per scene in `timeline.json` → `transitionOut`)
| type | default | meaning / when |
|---|---|---|
| `cut` | 0 s | Hard cut on the beat. Most common. Energy, contrast. |
| `crossfade` | 0.4 s | Time passing, soft mood shift. Use rarely. |
| `push` | 0.5 s | "Next step": incoming pushes outgoing left. Sequences. |
| `pushUp` | 0.5 s | Vertical push: lists, vertical formats, "and then". |
| `wipe` | 0.5 s | Hard edge L→R: before/after, problem→problem. |
| `mask` | 0.6 s | Circle iris opens: focus, reveal from a point. |
| `cameraDive` | 0.6 s | Camera pushes INTO the scene and emerges in the next: going deeper, problem→solution. |
| `zoomOut` | 0.6 s | Camera pulls back: context, reveal→payoff. |
| `matchCut` | 0.3 s | Instant swap at midpoint while a shared shape persists; pair with `handoff.json`. |
| `whip` | 0.35 s | Fast pan + motion blur: montage energy. Max 2 per video. |
| `slideOver` | 0.6 s | New layer slides over, old recedes/dims: new chapter. |
Rules: vary transitions (never the same one 3× in a row); the transition must mean something (see table);
transitions overlap scenes (next scene starts `duration` of the transition early, handled by `computeWindows`).

## Shared-element hand-off (`src/handoff.json` + `lib/Handoff.tsx`)
An element (dot, logo, icon) leaves scene A from pose `from` and lands in scene B at pose `to` (x/y as 0–1 of frame,
scale, rotate, opacity) during the transition, drawn ABOVE both scenes. Scenes call
`ownsElement(id, sceneId, w.from + frame, timeline, specs, fps)` and only draw their own copy when it returns true.
This is what makes match cuts and reveals feel continuous. Demo: build2's dot flies up and becomes the reveal's play button.

## Camera
See MOTION_RULES §7. Story mapping: hook = static or slight push-in; problem = static/claustrophobic; build = lateral
(rail/push); reveal = dive or push-in; payoff = pull-out.

## Writing
- Script first: one sentence per beat, read aloud at a natural pace, then time scenes with `readingTime` (0.3 s/word + 0.5 s, min 1.2 s; max 42 characters per line).
- Concrete over abstract; numbers over adjectives; no fake statistics.
- Every scene answers "why should I keep watching?" for the next one.
