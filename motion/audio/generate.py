#!/usr/bin/env python3
"""Procedural royalty-free soundtrack generator (Websmith motion toolkit).

Reads a Remotion timeline.json (same schema as template/src/timeline.json) and writes a stereo 48 kHz WAV exactly the
video length: a music bed whose energy follows the story beats, plus sound effects placed on the scene transitions
(same frame math as src/lib/timeline.ts).

Usage:
  python3 generate.py <timeline.json> <out.wav> [--mood upbeat|cinematic] [--seed 7] [--no-music] [--no-sfx]
                      [--lead-frames 1] [--cues cues.json]

Mood (timeline.json music.mood, or --mood to override; unknown text falls back by keyword, default upbeat):
  upbeat     A-minor i-VI-III-VII at music.bpm: detuned-saw pads, bass, kick/snare/hats, pluck arps on reveal/payoff,
             riser + impact on the first reveal. Beat -> energy: hook=pad+hat, problem=+bass, build=+kick,
             reveal=full kit + impact, payoff=full + bright, cta=pad tail.
  cinematic  slow A-minor pads (detuned saw + vibrato strings) with a sub drone, no drums, synthetic hall reverb.
             Chords by beat: hook Am(add9), problem Fmaj7 (darker), build Dm9, Esus4 tension into the reveal,
             reveal Am(add9) bloom, payoff F(add9), cta Am(add9) home. A soft bell on matchCuts, soft air on moving
             cuts, a low swell into the reveal "hit" and a bloom + shimmer on it, rising soft bells on scene "accents".
             Mastering: 28 Hz high-pass (low-end cleanup), duck into the hit, 1.2 s fade, gentle soft-knee limiter.
             (Cinematic mood: pads, sub drone, no drums.)
  Scene fields read by cinematic: "hit": seconds from scene start where the reveal lands (default 0.3 on the first
  reveal beat); "accents": [seconds from scene start] for soft rising bells (e.g. one per word).

SFX timing: impulsive sounds (tick, pop, impact, bell, bloom, shimmer) start --lead-frames (default 1, allowed 0-2)
BEFORE the visual they belong to; swells (whoosh, air) are centred on the transition midpoint; a riser ends
lead-frames before its hit.
SFX names (timeline scenes[].sfx): whoosh, swoosh_up, impact, riser, pop, tick, shimmer. 'impact'/'shimmer' land on
the scene START, 'riser' ends there, 'pop' 0.2 s after it, the rest on the scene's OUT transition.
Default SFX if none given (upbeat): whoosh on push/pushUp/whip/slideOver/cameraDive/zoomOut/wipe/mask, tick on
cut/matchCut, riser + impact on the first 'reveal' beat. (cinematic: see above.)
No samples are used; everything is synthesized, so the output is original and royalty-free.
"""
import argparse, json, math, sys
import numpy as np
from scipy.signal import butter, sosfilt, sosfiltfilt, fftconvolve
from scipy.ndimage import minimum_filter1d, uniform_filter1d
from scipy.io import wavfile

SR = 48000
DEFAULT_DUR = {'cut': 0, 'crossfade': .4, 'push': .5, 'pushUp': .5, 'wipe': .5, 'mask': .6, 'cameraDive': .6,
               'zoomOut': .6, 'matchCut': .3, 'whip': .35, 'slideOver': .6}
ENERGY = {'hook': .35, 'problem': .45, 'build': .7, 'reveal': 1.0, 'payoff': .95, 'cta': .5}

def windows(tl):
    fps = tl['fps']; cur = 0; out = []
    scenes = tl['scenes']
    for i, s in enumerate(scenes):
        frames = round(s['duration'] * fps)
        last = i == len(scenes) - 1
        ttype = None if last else (s.get('transitionOut') or {}).get('type', 'cut')
        tdur = 0 if last else (s.get('transitionOut') or {}).get('duration', DEFAULT_DUR.get(ttype, 0))
        outf = round(tdur * fps) if ttype else 0
        out.append(dict(s, start=cur / fps, end=(cur + frames) / fps, out_start=(cur + frames - outf) / fps,
                        out_dur=outf / fps, ttype=ttype))
        cur += frames - outf
    return out, cur / fps

def lp(x, fc, order=2):
    return sosfilt(butter(order, min(fc, SR / 2 - 100) / (SR / 2), 'low', output='sos'), x)
def hp(x, fc, order=2):
    return sosfilt(butter(order, fc / (SR / 2), 'high', output='sos'), x)
def bp(x, lo, hi, order=2):
    return sosfilt(butter(order, [lo / (SR / 2), min(hi, SR / 2 - 100) / (SR / 2)], 'band', output='sos'), x)
def env_adsr(n, a=.01, d=.1, s=.7, r=.2):
    t = np.arange(n) / SR; T = n / SR
    e = np.where(t < a, t / max(a, 1e-4), np.where(t < a + d, 1 - (1 - s) * (t - a) / max(d, 1e-4), s))
    rel = np.clip((T - t) / max(r, 1e-4), 0, 1)
    return e * rel
def midi(m): return 440 * 2 ** ((m - 69) / 12)
def saw(f, n, phase=0.0):
    t = np.arange(n) / SR
    return 2 * ((f * t + phase) % 1) - 1

def add(buf, x, t0, gain=1.0, pan=0.0):
    i = int(t0 * SR)
    if i >= buf.shape[0] or i + len(x) <= 0: return
    if i < 0: x = x[-i:]; i = 0
    x = x[:buf.shape[0] - i]
    l, r = math.cos((pan + 1) * math.pi / 4), math.sin((pan + 1) * math.pi / 4)
    buf[i:i + len(x), 0] += x * gain * l * 1.414
    buf[i:i + len(x), 1] += x * gain * r * 1.414

# ---------- instruments ----------
def kick(rng):
    n = int(.45 * SR); t = np.arange(n) / SR
    f = 45 + 110 * np.exp(-t * 28)
    ph = 2 * np.pi * np.cumsum(f) / SR
    return np.sin(ph) * np.exp(-t * 7) + 0.25 * lp(rng.standard_normal(n), 3000) * np.exp(-t * 90)
def snare(rng):
    n = int(.3 * SR); t = np.arange(n) / SR
    return 0.6 * bp(rng.standard_normal(n), 1500, 9000) * np.exp(-t * 18) + 0.4 * np.sin(2 * np.pi * 190 * t) * np.exp(-t * 25)
def hat(rng, open_=False):
    n = int((.25 if open_ else .06) * SR); t = np.arange(n) / SR
    return hp(rng.standard_normal(n), 7000) * np.exp(-t * (12 if open_ else 70))
def pad(notes, dur, bright):
    n = int(dur * SR); x = np.zeros(n)
    for m in notes:
        for det in (-0.08, 0.0, 0.08):
            x += saw(midi(m + det), n, phase=(m * 0.137 + det) % 1)
    x = lp(x / (len(notes) * 3), 500 + 3500 * bright, 2)
    return x * env_adsr(n, a=min(.4, dur / 3), d=.2, s=.85, r=min(.5, dur / 3))
def bass(m, dur):
    n = int(dur * SR); t = np.arange(n) / SR
    x = np.sin(2 * np.pi * midi(m) * t) + .3 * lp(saw(midi(m), n), 900)
    return x * env_adsr(n, .005, .08, .6, .05)
def pluck(m, dur=.4):
    n = int(dur * SR); t = np.arange(n) / SR
    x = sum(np.sin(2 * np.pi * midi(m) * k * t) / k ** 1.5 for k in (1, 2, 3, 4))
    return x * np.exp(-t * 9)

# ---------- sfx ----------
def whoosh(rng, dur=.5, up=False):
    n = int(dur * SR); t = np.arange(n) / SR; x = rng.standard_normal(n)
    out = np.zeros(n); seg = 512
    for i in range(0, n, seg):
        p = i / n; fc = (300 + 5000 * p) if up else (500 + 4500 * math.sin(math.pi * p))
        out[i:i + seg] = bp(x[max(0, i - 2048):i + seg], fc * .6, fc * 1.6, 2)[-len(out[i:i + seg]):]
    return out * np.sin(np.pi * t / dur) ** 2
def impact(rng):
    n = int(1.6 * SR); t = np.arange(n) / SR
    sub = np.sin(2 * np.pi * (38 + 60 * np.exp(-t * 10)) * t) * np.exp(-t * 2.6)
    crack = lp(rng.standard_normal(n), 6000) * np.exp(-t * 14)
    return sub * .9 + crack * .45
def riser(rng, dur=1.5):
    n = int(dur * SR); t = np.arange(n) / SR
    noise = whoosh(rng, dur, up=True) * (t / dur) ** 2 * 2
    tone = np.sin(2 * np.pi * np.cumsum(200 + 600 * (t / dur) ** 2) / SR) * (t / dur) ** 3 * .25
    return (noise + tone) * np.minimum(1, (dur - t) / .02)
def pop():
    n = int(.12 * SR); t = np.arange(n) / SR
    return np.sin(2 * np.pi * (900 - 500 * t / .12) * t) * np.exp(-t * 40)
def tick():
    n = int(.05 * SR); t = np.arange(n) / SR
    return np.sin(2 * np.pi * 2400 * t) * np.exp(-t * 120)
def shimmer():
    return sum(pluck(m, 1.2) * .3 for m in (84, 88, 91, 96))

# ---------- cinematic voices ----------
def slow_env(n, a, r):
    t = np.arange(n) / SR; T = n / SR
    return np.clip(t / max(a, 1e-4), 0, 1) ** 1.5 * np.clip((T - t) / max(r, 1e-4), 0, 1) ** 1.2
def pad_chord(notes, dur, bright, a=1.4, r=1.8):
    n = int(dur * SR); t = np.arange(n) / SR
    x = pad(notes, dur, bright)
    strings = sum(np.sin(2 * np.pi * midi(m + 12) * t + 0.3 * np.sin(2 * np.pi * 4.6 * t + m)) for m in notes) / len(notes)
    return (x + 0.6 * strings) * slow_env(n, a, r)
def sub(m, dur, a=1.0, r=1.5):
    n = int(dur * SR); t = np.arange(n) / SR
    return np.sin(2 * np.pi * midi(m) * t) * slow_env(n, a, r)
def bell(m, dur=3.0):
    n = int(dur * SR); t = np.arange(n) / SR
    x = sum(np.sin(2 * np.pi * midi(m) * k * t) * np.exp(-t * (1.6 + 1.2 * k)) / k ** 1.8 for k in (1, 2, 3, 4.01))
    return x * np.minimum(1, t / 0.004)
def air(rng, dur):
    return lp(whoosh(rng, dur), 2200)
def swell(rng, dur):
    n = int(dur * SR); t = np.arange(n) / SR
    noise = lp(rng.standard_normal(n), 900) * (t / dur) ** 3
    tone = sum(np.sin(2 * np.pi * midi(m) * t) for m in (45, 52, 57)) / 3 * (t / dur) ** 2.5
    return (0.6 * noise + tone) * np.minimum(1, (dur - t) / 0.08)
def bloom(rng):
    n = int(3.5 * SR); t = np.arange(n) / SR
    return np.sin(2 * np.pi * (41 + 30 * np.exp(-t * 6)) * t) * np.exp(-t * 1.4) * np.minimum(1, t / 0.01)
def reverb(x, rng, secs=3.2, mix=0.32):
    n = int(secs * SR); t = np.arange(n) / SR
    ir = np.stack([lp(rng.standard_normal(n), 5000) * np.exp(-t * 3.0 / secs * 2.3) for _ in range(2)], 1)
    ir /= np.sqrt((ir ** 2).sum(0))
    wet = np.stack([fftconvolve(x[:, c], ir[:, c])[:len(x)] for c in range(2)], 1)
    return x * (1 - mix) + wet * mix * 1.4
def soft_limit(buf, th=0.55):
    buf = buf / (np.max(np.abs(buf)) or 1)
    over = np.abs(buf) > th
    buf[over] = np.sign(buf[over]) * (th + (1 - th) * np.tanh((np.abs(buf[over]) - th) / (1 - th)))
    return buf

def peak_limit(buf, reduce_db=4.0, win_s=0.005):
    """Look-ahead peak limiter: caps peaks reduce_db below the current max with a smooth gain curve (min-filter then
    moving average over the same window, so the gain never exceeds what a sample needs; ~5 ms ramps, no clicks)."""
    peak = np.max(np.abs(buf)) or 1
    th = peak * 10 ** (-reduce_db / 20)
    w = max(3, int(win_s * SR) | 1)
    level = np.max(np.abs(buf), axis=1)
    g = np.minimum(1.0, th / np.maximum(level, 1e-9))
    g = uniform_filter1d(minimum_filter1d(g, w), w)
    return buf * g[:, None]

MOODS = ('upbeat', 'cinematic')
def resolve_mood(tl, override=None):
    m = (override or (tl.get('music') or {}).get('mood') or 'upbeat').lower()
    if m in MOODS: return m
    return 'cinematic' if any(k in m for k in ('cinematic', 'slow', 'calm', 'documentary', 'ambient')) else 'upbeat'

# Chords for the cinematic mood: (notes, sub-bass midi, brightness)
CINE = {
    'hook':    ([57, 60, 64, 71], 33, .18),       # Am(add9)
    'problem': ([53, 57, 60, 64], 29, .12),       # Fmaj7, darker
    'build':   ([50, 53, 57, 64], 26, .20),       # Dm9
    'tension': ([52, 57, 59, 64], 28, .26),       # Esus4 into the reveal
    'reveal':  ([57, 60, 64, 71, 76], 33, .40),   # Am(add9) bloom
    'payoff':  ([53, 57, 60, 67], 29, .34),       # F(add9), warm
    'cta':     ([57, 60, 64, 69, 71], 33, .28),   # Am(add9), home
}
ACCENT_NOTES = (69, 72, 76, 79, 81)

def sfx_voice(nm, rng, w):
    if nm == 'whoosh': return whoosh(rng, max(.35, w['out_dur'] + .2)), .55
    if nm == 'swoosh_up': return whoosh(rng, .5, up=True), .5
    if nm == 'impact': return impact(rng), .9
    if nm == 'riser': return riser(rng, 1.5), .45
    if nm == 'pop': return pop(), .4
    if nm == 'tick': return tick(), .35
    if nm == 'shimmer': return shimmer(), .5
    return None, 0

def sfx_time(nm, w, i, x_len, lead):
    """Onset time of a named SFX for scene window w (see module doc for the timing rules)."""
    if nm in ('impact', 'shimmer'): return max(0.0, w['start'] - lead) if i else 0.0
    if nm == 'riser': return max(0.0, w['start'] - lead - 1.5)
    if nm == 'pop': return w['start'] + .2 - lead
    if nm in ('whoosh', 'swoosh_up'):  # swell: centre on the transition midpoint
        mid = (w['out_start'] + w['out_dur'] / 2) if w['ttype'] else w['end'] - .2
        return max(0.0, mid - x_len / SR / 2)
    # impulsive, on the out transition (a cut changes picture at out_start)
    return max(0.0, (w['out_start'] if w['ttype'] else w['end'] - .3) - lead)

def upbeat(tl, ws, total, rng, a, lead, cues):
    buf = np.zeros((int(round(total * SR)), 2))
    bpm = (tl.get('music') or {}).get('bpm', 112)
    beat = 60 / bpm; bar = beat * 4
    root = 57  # A3; progression i-VI-III-VII (Am F C G)
    prog = [[0, 3, 7], [-4, 0, 3], [3, 7, 10], [-2, 2, 5]]
    prog_roots = [0, -4, 3, -2]
    def energy(t):
        for w in reversed(ws):
            if t >= w['start']: return ENERGY.get(w['beat'], .6)
        return .4
    first_reveal = next((w for w in ws if w['beat'] == 'reveal'), None)
    if not a.no_music:
        nb = int(math.ceil(total / bar))
        for b in range(nb):
            t0 = b * bar; e = energy(t0 + .01); ci = b % 4
            add(buf, pad([root + 12 + n for n in prog[ci]], bar + .3, e), t0, .22 + .1 * e, 0)
            for k in range(8):
                tt = t0 + k * beat / 2; ek = energy(tt)
                if ek >= .45: add(buf, bass(root - 12 + prog_roots[ci], beat / 2 * .9), tt, .32 * min(1, ek + .2))
            for k in range(4):
                tt = t0 + k * beat; ek = energy(tt)
                if ek >= .7: add(buf, kick(rng), tt, .9)
                if ek >= .95 and k % 2 == 1: add(buf, snare(rng), tt, .45, .1)
                add(buf, hat(rng), tt + beat / 2, .10 + .08 * ek, .3)
                if ek >= .9: add(buf, hat(rng), tt, .07, -.3)
            if energy(t0) >= .9:
                for k in range(8):
                    add(buf, pluck(root + 24 + prog[ci][k % 3] + (12 if k % 4 == 3 else 0)), t0 + k * beat / 2, .08, (-1) ** k * .4)
        add(buf, pad([root + 12 + n for n in prog[0]] + [root + 24], 1.6, .6), total - 1.6, .28)
        if first_reveal is not None:
            t = np.arange(buf.shape[0]) / SR
            d = 1 - .5 * np.clip(1 - np.abs(t - (first_reveal['start'] - .15)) / .25, 0, 1)
            buf *= d[:, None]
        n_f = int(.8 * SR); buf[-n_f:] *= np.linspace(1, 0, n_f)[:, None]
    if not a.no_sfx:
        for i, w in enumerate(ws):
            names = w.get('sfx')
            if names is None:
                names = []
                if w['ttype'] in ('push', 'pushUp', 'whip', 'slideOver', 'cameraDive', 'zoomOut', 'wipe', 'mask'): names.append('whoosh')
                if w['ttype'] in ('cut', 'matchCut'): names.append('tick')
                if first_reveal is not None and w is first_reveal: names += ['riser', 'impact']
            for nm in names:
                x, g = sfx_voice(nm, rng, w)
                if x is None: print('unknown sfx', nm, file=sys.stderr); continue
                t0 = sfx_time(nm, w, i, len(x), lead)
                add(buf, x, t0, g, 0)
                cues.append({'scene': w['id'], 'sfx': nm, 't': round(t0, 3)})
    buf = hp(buf.T, 25).T  # low-end cleanup
    # transparent peak limiter on the impact/kick transients (4 dB): lowers the crest factor so the linear 2-pass
    # loudnorm can reach -14 LUFS under its -2.0 dBTP target (it was landing at -14.7 LUFS)
    return peak_limit(buf, 4.0)

def cinematic(tl, ws, total, rng, a, lead, cues):
    buf = np.zeros((int(round(total * SR)) + SR * 4, 2))  # room for tails; trimmed below
    def put(name, x, t0, g, pan=0.0, scene=None):
        add(buf, x, t0, g, pan); cues.append({'scene': scene, 'sfx': name, 't': round(t0, 3)})
    reveal = next((w for w in ws if w['beat'] == 'reveal'), None)
    hit = None
    if reveal is not None:
        hit = reveal['start'] + float(reveal.get('hit', 0.3))
    if not a.no_music:
        # chord plan: one segment per scene (by beat), Esus4 tension from ~2 s before the reveal until the hit
        segs = []
        for i, w in enumerate(ws):
            nxt = ws[i + 1]['start'] if i + 1 < len(ws) else total + 2.5
            segs.append([w['start'], nxt + .3, w['beat']])
        if reveal is not None:
            t_ten = max(reveal['start'] - 2.0, ws[0]['start'] + 1.0)
            out = []
            for t0, t1, b in segs:
                if b == 'reveal':
                    if hit - t0 > 0.6: out.append([t0, hit + .2, 'tension'])
                    out.append([hit, t1, 'reveal']); continue
                if t0 < t_ten < t1 and b != 'hook':
                    out.append([t0, t_ten + .2, b]); out.append([t_ten, t1, 'tension']); continue
                out.append([t0, t1, b])
            segs = out
        for i, (t0, t1, b) in enumerate(segs):
            notes, bass_m, br = CINE.get(b, CINE['hook'])
            t0s = max(0.0, t0 - (0.0 if i == 0 else 0.35))
            dur = t1 - t0s + 1.6
            put(f'pad_{b}', pad_chord(notes, dur, br + 0.12, a=0.05 if i == 0 else 1.2), t0s, 0.34)
            put(f'sub_{b}', sub(bass_m + 12, dur, a=0.05 if i == 0 else 1.0), t0s, 0.06)
    if not a.no_sfx:
        for i, w in enumerate(ws):
            if w.get('sfx') is not None:  # explicit names still work in cinematic
                for nm in w['sfx']:
                    x, g = sfx_voice(nm, rng, w)
                    if x is None: print('unknown sfx', nm, file=sys.stderr); continue
                    put(nm, x, sfx_time(nm, w, i, len(x), lead), g * .6, 0, w['id'])
            elif w['ttype'] == 'matchCut':  # one soft note as the shared element holds
                put('bell_match', bell(69), w['out_start'] + w['out_dur'] / 2 - lead, 0.10, -0.15, w['id'])
            elif w['ttype'] == 'cut':
                put('bell_cut', bell(76, 2.0), w['out_start'] - lead, 0.06, 0.1, w['id'])
            elif w['ttype']:  # moving cut: soft air centred on the transition
                x = air(rng, w['out_dur'] + 0.5)
                put(f'air_{w["ttype"]}', x, w['out_start'] + w['out_dur'] / 2 - len(x) / SR / 2, 0.16 if w['ttype'] != 'crossfade' else 0.10, 0, w['id'])
            for k, at in enumerate(w.get('accents') or []):
                put(f'bell_accent{k}', bell(ACCENT_NOTES[k % len(ACCENT_NOTES)]), w['start'] + float(at) - lead, 0.10, (-0.3, 0.0, 0.3)[k % 3], w['id'])
        if hit is not None:
            sw = min(2.5, max(1.0, hit - reveal['start'] + 0.4))
            put('swell', swell(rng, sw), hit - sw, 0.14, 0, reveal['id'])
            put('bloom', bloom(rng), hit - lead, 0.20, 0, reveal['id'])
            put('shimmer', shimmer(), hit + 0.05, 0.07, 0.15, reveal['id'])
    buf = reverb(buf, rng)
    if hit is not None:
        t = np.arange(buf.shape[0]) / SR
        buf *= (1 - 0.35 * np.clip(1 - np.abs(t - (hit - 0.2)) / 0.25, 0, 1))[:, None]
    buf = buf[:int(round(total * SR))]
    n_f = min(int(1.2 * SR), len(buf)); buf[-n_f:] *= np.linspace(1, 0, n_f)[:, None] ** 1.5
    n_i = int(0.02 * SR); buf[:n_i] *= np.linspace(0, 1, n_i)[:, None]
    buf = hp(buf.T, 28).T           # remove sub-sonic rumble
    return soft_limit(buf)          # gentle soft-knee limiter so the 2-pass loudnorm can stay linear

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('timeline'); ap.add_argument('out')
    ap.add_argument('--mood', choices=MOODS, help='override timeline music.mood')
    ap.add_argument('--seed', type=int, default=None, help='default 7 (upbeat) / 11 (cinematic)')
    ap.add_argument('--no-music', action='store_true'); ap.add_argument('--no-sfx', action='store_true')
    ap.add_argument('--lead-frames', type=int, default=1, help='impulsive SFX land this many frames before the visual (0-2)')
    ap.add_argument('--cues', help='write the computed cue list (JSON) here')
    a = ap.parse_args()
    if not 0 <= a.lead_frames <= 2: ap.error('--lead-frames must be 0, 1 or 2')
    tl = json.load(open(a.timeline))
    mood = resolve_mood(tl, a.mood)
    rng = np.random.default_rng(a.seed if a.seed is not None else (11 if mood == 'cinematic' else 7))
    ws, total = windows(tl)
    lead = a.lead_frames / tl['fps']
    cues = []
    buf = (cinematic if mood == 'cinematic' else upbeat)(tl, ws, total, rng, a, lead, cues)
    peak = np.max(np.abs(buf)) or 1
    buf = buf / peak * 10 ** (-3 / 20)  # -3 dBFS peak; loudness is set at mux with loudnorm
    wavfile.write(a.out, SR, (buf * 32767).astype(np.int16))
    if a.cues:
        json.dump({'total': total, 'mood': mood, 'lead_frames': a.lead_frames,
                   'scenes': [{k: w[k] for k in ('id', 'beat', 'start', 'out_start', 'end', 'ttype')} for w in ws], 'cues': cues},
                  open(a.cues, 'w'), indent=1)
    print(f'wrote {a.out}: {buf.shape[0] / SR:.2f}s (video {total:.2f}s), mood {mood}, {len(cues)} cues, sfx lead {a.lead_frames} frame(s)')

if __name__ == '__main__':
    main()
