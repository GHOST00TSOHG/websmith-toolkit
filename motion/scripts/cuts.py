#!/usr/bin/env python3
"""Print the transition windows of a timeline.json (same frame math as src/lib/timeline.ts and audio/generate.py).
Usage: cuts.py <timeline.json> [--pad 0.3]
Output, one line per cut:  <index> <fromScene> <toScene> <type> <out_start_s> <end_s> <close-up start> <close-up end>
The close-up window is the transition +/- pad seconds (for 0 s cuts: the cut +/- pad)."""
import argparse, json, os, sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'audio'))
from generate import windows  # noqa: E402

ap = argparse.ArgumentParser(); ap.add_argument('timeline'); ap.add_argument('--pad', type=float, default=0.3)
a = ap.parse_args()
tl = json.load(open(a.timeline))
ws, total = windows(tl)
for i, w in enumerate(ws[:-1]):
    nxt = ws[i + 1]
    s, e = w['out_start'], w['out_start'] + w['out_dur']
    print(i + 1, w['id'], nxt['id'], w['ttype'], f'{s:.3f}', f'{e:.3f}', f'{max(0, s - a.pad):.3f}', f'{min(total, e + a.pad):.3f}')
