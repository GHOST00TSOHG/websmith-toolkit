#!/usr/bin/env python3
"""QA a finished MP4 (Websmith motion toolkit). Exit 0 = PASS, 1 = FAIL, 2 = usage/tool error.

Checks (all blocking):
  1. streams: one h264 yuv420p video stream and one audio stream (AAC 48 kHz stereo)
  2. loudness: EBU R128 integrated -14 +/-1 LUFS, true peak <= -1.0 dBTP (ffmpeg ebur128=peak=true)
  3. black frames: blackdetect; any black run not inside an allowed window fails
  4. frozen frames: freezedetect; any frozen run not inside an allowed window fails

Thresholds and allowed windows come from an optional qa.json (render.sh passes <project>/qa.json if it exists):
{
  "loudness": {"target": -14, "tolerance": 1, "max_true_peak": -1.0},
  "black":  {"min_duration": 0.5, "pix_th": 0.05, "pic_th": 0.98},
  "freeze": {"noise": "-60dB", "min_duration": 2.5},
  "allow": [
    {"type": "freeze", "start": 18.6, "end": null, "why": "end card hold"},   # end null = end of video
    {"type": "black",  "start": 0, "end": 0.4, "why": "fade from black"}
  ]
}
Defaults are those numbers. The freeze defaults (-60 dB, 2.5 s) let calm films hold a still for up to 2.5 s without
grain; longer intentional holds (end card, reading holds) go in "allow" instead of adding noise to the picture.
A run passes if it lies inside an allowed window of the same type (1-frame tolerance).
"""
import json, re, subprocess, sys

def run(cmd):
    return subprocess.run(cmd, capture_output=True, text=True)

def main():
    if len(sys.argv) < 2:
        print(__doc__); sys.exit(2)
    f = sys.argv[1]
    cfg = {}
    if len(sys.argv) > 2 and sys.argv[2]:
        cfg = json.load(open(sys.argv[2]))
        print(f'-- config {sys.argv[2]}')
    L = {'target': -14, 'tolerance': 1, 'max_true_peak': -1.0, **cfg.get('loudness', {})}
    B = {'min_duration': 0.5, 'pix_th': 0.05, 'pic_th': 0.98, **cfg.get('black', {})}
    Z = {'noise': '-60dB', 'min_duration': 2.5, **cfg.get('freeze', {})}
    allow = cfg.get('allow', [])
    fails, notes = [], []

    pr = run(['ffprobe', '-v', 'error', '-show_entries',
              'stream=index,codec_type,codec_name,profile,width,height,pix_fmt,r_frame_rate,sample_rate,channels,bit_rate:format=duration,size',
              '-of', 'json', f])
    if pr.returncode: print(pr.stderr); sys.exit(2)
    info = json.loads(pr.stdout)
    dur = float(info['format']['duration'])
    vs = [s for s in info['streams'] if s['codec_type'] == 'video']
    aus = [s for s in info['streams'] if s['codec_type'] == 'audio']
    print('-- streams')
    for s in info['streams']:
        print('  ' + ', '.join(f'{k}={v}' for k, v in s.items() if k != 'index'))
    print(f'  duration={dur:.3f}s size={int(info["format"]["size"]) / 1e6:.1f} MB')
    fps = 30.0
    if not vs: fails.append('no video stream')
    else:
        v = vs[0]; n, d = v['r_frame_rate'].split('/'); fps = float(n) / float(d)
        if v.get('codec_name') != 'h264' or v.get('pix_fmt') != 'yuv420p': fails.append(f"video is {v.get('codec_name')}/{v.get('pix_fmt')}, want h264/yuv420p")
    if not aus: fails.append('no audio stream')
    else:
        a = aus[0]
        if a.get('codec_name') != 'aac' or a.get('sample_rate') != '48000' or a.get('channels') != 2:
            fails.append(f"audio is {a.get('codec_name')} {a.get('sample_rate')} Hz {a.get('channels')} ch, want aac 48000 Hz 2 ch")

    I = TP = None
    if aus:
        r = run(['ffmpeg', '-hide_banner', '-nostats', '-i', f, '-map', '0:a:0', '-af', 'ebur128=peak=true', '-f', 'null', '-'])
        summ = r.stderr[r.stderr.rfind('Summary:'):]
        m = re.search(r'I:\s+(-?[\d.]+) LUFS', summ); I = float(m.group(1)) if m else None
        m = re.search(r'Peak:\s+(-?[\d.]+|-inf) dBFS', summ); TP = float(m.group(1)) if m else None
        okI = I is not None and abs(I - L['target']) <= L['tolerance']
        okT = TP is not None and TP <= L['max_true_peak']
        print(f"-- loudness: integrated {I} LUFS -> {'PASS' if okI else 'FAIL'} (target {L['target']} +/-{L['tolerance']}); "
              f"true peak {TP} dBTP -> {'PASS' if okT else 'FAIL'} (<= {L['max_true_peak']})")
        if not okI: fails.append(f'integrated loudness {I} LUFS')
        if not okT: fails.append(f'true peak {TP} dBTP')

    tol = 1.0 / fps + 1e-3
    def allowed(kind, s, e):
        for w in allow:
            if w.get('type') != kind: continue
            ws = float(w.get('start', 0)); we = dur if w.get('end') is None else float(w['end'])
            if s >= ws - tol and e <= we + tol: return w.get('why', 'allowed')
        return None

    def runs(vf, key):
        r = run(['ffmpeg', '-hide_banner', '-nostats', '-i', f, '-vf', vf, '-an', '-f', 'null', '-'])
        out = []
        if key == 'black':
            for m in re.finditer(r'black_start:([\d.]+) black_end:([\d.]+)', r.stderr):
                out.append((float(m.group(1)), float(m.group(2))))
        else:
            starts = [float(x) for x in re.findall(r'freeze_start: ([\d.]+)', r.stderr)]
            ends = [float(x) for x in re.findall(r'freeze_end: ([\d.]+)', r.stderr)]
            for i, s in enumerate(starts):
                out.append((s, ends[i] if i < len(ends) else dur))  # frozen to the end: no freeze_end is logged
        return out

    for kind, vf in (('black', f"blackdetect=d={B['min_duration']}:pix_th={B['pix_th']}:pic_th={B['pic_th']}"),
                     ('freeze', f"freezedetect=n={Z['noise']}:d={Z['min_duration']}")):
        found = runs(vf, kind)
        print(f'-- {kind} ({vf}): {len(found)} run(s)')
        for s, e in found:
            why = allowed(kind, s, e)
            print(f"   {s:7.3f}-{e:7.3f}s ({e - s:.2f}s) -> {'allowed: ' + why if why else 'FAIL (unexpected)'}")
            if not why: fails.append(f'{kind} {s:.2f}-{e:.2f}s')

    if fails:
        print('QA FAIL: ' + '; '.join(fails)); sys.exit(1)
    print(f'QA PASS ({I} LUFS, {TP} dBTP, no unexpected black/frozen frames)')

if __name__ == '__main__':
    main()
