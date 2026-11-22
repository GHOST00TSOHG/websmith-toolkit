#!/usr/bin/env bash
# Renders stills of the LottieTest composition and pixel-compares cells. Exit 1 if any expectation fails.
set -euo pipefail
cd "$(dirname "$0")"; mkdir -p out
for f in 5 10 15 25 59 100; do npx remotion still src/index.ts LottieTest out/lt_$f.png --frame=$f --log=error; done
python3 - <<'PY'
from PIL import Image; import numpy as np, sys
def c(f, i): return np.asarray(Image.open(f'out/lt_{f}.png').convert('RGB').crop((i*400, 0, i*400+400, 400))).astype(int)
def d(a, b): return float(np.abs(a - b).mean())
A, B, C, D, E = range(5)
checks = [
  ('new delay: B@25 == A@5 (icon starts at its frame 0 at the delay)', d(c(25, B), c(5, A)), True),
  ('old bug:   C@25 == A@25 (old component started at icon frame 20)', d(c(25, C), c(25, A)), True),
  ('old != new: C@25 vs A@5', d(c(25, C), c(5, A)), False),
  ('trim in:   D@25 == A@15 (trim [10,40) starts at icon frame 10)', d(c(25, D), c(15, A)), True),
  ('play once: D@100 == D@59 (holds the last trimmed frame)', d(c(100, D), c(59, D)), True),
  ('nativeSpeed: E@25 == A@10 (60 fps icon at 2 icon frames per video frame)', d(c(25, E), c(10, A)), True),
]
ok = True
for name, diff, want_equal in checks:
    good = (diff < 0.5) if want_equal else (diff > 5)
    ok &= good
    print(f"{'PASS' if good else 'FAIL'}  {name}: mean abs diff {diff:.2f}")
Image.fromarray(np.vstack([np.asarray(Image.open('out/lt_5.png').convert('RGB')), np.asarray(Image.open('out/lt_25.png').convert('RGB'))]).astype('uint8')).save('out/lottie_proof.png')
sys.exit(0 if ok else 1)
PY
