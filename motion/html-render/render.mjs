#!/usr/bin/env node
// HTML -> MP4 fallback renderer (Puppeteer frame capture + ffmpeg).
// Deterministic: time is virtualized. Every frame we (1) set the virtual clock used by
// requestAnimationFrame / performance.now / Date.now, (2) pause and seek every CSS + Web Animations API
// animation via document.getAnimations(), (3) call window.__seek(t) if the page defines it (for GSAP,
// canvas, Lottie-web: e.g. gsap.globalTimeline.seek(t) / anim.goToAndStop(t*1000)), then screenshot.
//
// Usage:
//   node render.mjs <page.html|url> <out.mp4> [--w 1920 --h 1080 --fps 30 --dur 10 --crf 17 --audio track.wav --chrome /usr/bin/google-chrome]
// If --dur is omitted, uses window.__duration (seconds) from the page, else 5 s.
import puppeteer from 'puppeteer-core';
import {spawn} from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';

const args = process.argv.slice(2);
const pos = args.filter((a, i) => !a.startsWith('--') && !(args[i - 1] || '').startsWith('--'));
const opt = (k, d) => { const i = args.indexOf(`--${k}`); return i >= 0 ? args[i + 1] : d; };
const [input, out] = pos;
if (!input || !out) { console.error('usage: node render.mjs <page.html|url> <out.mp4> [--w --h --fps --dur --crf --audio --chrome]'); process.exit(1); }
const W = +opt('w', 1920), H = +opt('h', 1080), FPS = +opt('fps', 30), CRF = opt('crf', '17');
const AUDIO = opt('audio'), CHROME = opt('chrome', process.env.CHROME_PATH || '/usr/bin/google-chrome');
const url = /^https?:|^file:/.test(input) ? input : 'file://' + path.resolve(input);

const CLOCK = `(() => {
  let now = 0; const rafs = new Map(); let id = 0;
  window.__vt = { set(t){ now = t; const cbs=[...rafs.values()]; rafs.clear(); cbs.forEach(cb=>{ try{cb(now)}catch(e){console.error(e)} }); } };
  window.requestAnimationFrame = cb => { rafs.set(++id, cb); return id; };
  window.cancelAnimationFrame = i => rafs.delete(i);
  const t0 = Date.now();
  performance.now = () => now;
  Date.now = () => t0 + now;
})();`;

const browser = await puppeteer.launch({executablePath: CHROME, headless: true, args: ['--no-sandbox', '--disable-gpu', '--hide-scrollbars', '--force-color-profile=srgb', '--autoplay-policy=no-user-gesture-required']});
const page = await browser.newPage();
await page.setViewport({width: W, height: H, deviceScaleFactor: 1});
await page.evaluateOnNewDocument(CLOCK);
page.on('console', m => m.type() === 'error' && console.error('[page]', m.text()));
await page.goto(url, {waitUntil: 'networkidle0'});
await page.evaluate(() => document.fonts.ready);
const DUR = +opt('dur', 0) || (await page.evaluate(() => window.__duration)) || 5;
const N = Math.round(DUR * FPS);

const ff = spawn('ffmpeg', ['-v', 'error', '-y', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'png', '-i', '-',
  ...(AUDIO ? ['-i', AUDIO, '-map', '0:v', '-map', '1:a', '-c:a', 'aac', '-b:a', '192k', '-shortest'] : []),
  '-c:v', 'libx264', '-preset', 'slow', '-crf', CRF, '-pix_fmt', 'yuv420p', '-movflags', '+faststart', out], {stdio: ['pipe', 'inherit', 'inherit']});

for (let f = 0; f < N; f++) {
  const tMs = (f / FPS) * 1000;
  await page.evaluate(async (t) => {
    window.__vt.set(t);
    for (const a of document.getAnimations()) { a.pause(); a.currentTime = t; }
    if (typeof window.__seek === 'function') await window.__seek(t / 1000);
  }, tMs);
  const buf = await page.screenshot({type: 'png', clip: {x: 0, y: 0, width: W, height: H}, captureBeyondViewport: false});
  if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
  if (f % FPS === 0) process.stdout.write(`\rframe ${f}/${N}`);
}
ff.stdin.end();
await new Promise((r, j) => ff.on('close', c => (c === 0 ? r() : j(new Error('ffmpeg exit ' + c)))));
await browser.close();
console.log(`\nwrote ${out} (${N} frames @ ${FPS}fps, ${W}x${H})`);
