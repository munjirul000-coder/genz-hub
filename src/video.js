'use strict';
/* Gen-Z Hub — video processing pipeline
   upload → validate → probe → transcode ladder → poster → store → deliver

   Design notes
   • Quality first: if the source is already a web-safe H.264/AAC stream at a sane bitrate we
     REMUX (stream copy) instead of re-encoding, so there is literally zero generation loss.
   • Otherwise we encode with CRF (constant quality) — never a fixed low bitrate — using a
     resolution ladder that is derived from the SOURCE. We never upscale and never invent a
     rendition the source cannot honestly fill.
   • The top rendition + poster make an asset playable ("ready"); the smaller adaptive
     renditions keep rendering in the background and are appended as they finish.
   • Everything runs through a small single-slot queue so a free-tier box never melts. */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn, spawnSync } = require('child_process');
const crypto = require('crypto');

/* ---------------------------------------------------------------- binaries */
function resolveBin(envName, mod, fallback) {
  if (process.env[envName] && fs.existsSync(process.env[envName])) return process.env[envName];
  try {
    const m = require(mod);
    const p = typeof m === 'string' ? m : (m && m.path);
    if (p && fs.existsSync(p)) { try { fs.chmodSync(p, 0o755); } catch (e) {} return p; }
  } catch (e) { /* module not installed → PATH */ }
  const which = spawnSync('sh', ['-c', `command -v ${fallback}`], { encoding: 'utf8' });
  const p = (which.stdout || '').trim();
  return p || null;
}

const FFMPEG = resolveBin('FFMPEG_PATH', 'ffmpeg-static', 'ffmpeg');
const FFPROBE = resolveBin('FFPROBE_PATH', 'ffprobe-static', 'ffprobe');
const AVAILABLE = !!(FFMPEG && FFPROBE);
const PRESET = process.env.VIDEO_PRESET || 'veryfast';
const TRANSCODE = process.env.VIDEO_TRANSCODE !== '0';
// Small boxes (Render free = 0.1 CPU / 512 MB) can cap the ladder without touching code.
const MAX_HEIGHT = Number(process.env.VIDEO_MAX_HEIGHT || 1080);
const THREADS = Number(process.env.VIDEO_THREADS || 0); // 0 = let ffmpeg decide

/* ---------------------------------------------------------------- ladder */
// CRF is a *quality* target, not a size target. Lower = better. These values are deliberately
// conservative (visually transparent-ish) so uploads never look blocky or washed out.
const LADDER = [
  { h: 1080, crf: 21, maxrate: 6500, bufsize: 11000, ab: 160 },
  { h: 720, crf: 22, maxrate: 3600, bufsize: 6500, ab: 128 },
  { h: 480, crf: 23, maxrate: 1700, bufsize: 3200, ab: 112 },
  { h: 360, crf: 24, maxrate: 900, bufsize: 1800, ab: 96 },
];

function even(n) { n = Math.round(n); return n % 2 ? n + 1 : n; }

/** Which renditions make sense for this source? Never upscale, never fake a resolution. */
function planLadder(src) {
  const shortSide = Math.min(src.width, src.height);            // true source quality
  const cap = Math.min(shortSide, MAX_HEIGHT);                  // what this host is willing to serve
  const portrait = src.height >= src.width;
  const rungs = LADDER.filter((r) => r.h <= cap * 1.02);
  if (!rungs.length) {
    // Source is smaller than 360p — keep it at its native size, single rendition.
    rungs.push({ h: cap, crf: 23, maxrate: 900, bufsize: 1800, ab: 96, native: true });
  }
  // The rung number is always the SHORT side (so 1080p == 1920x1080 landscape == 1080x1920 vertical).
  // Both dimensions are scaled by the same factor: the aspect ratio can never drift.
  return rungs.map((r) => {
    const scale = Math.min(1, r.h / shortSide);
    return {
      ...r,
      q: r.h,                       // ladder label = short side (720p, 1080p …)
      portrait,
      w: Math.min(even(src.width * scale), even(src.width)),
      h: Math.min(even(src.height * scale), even(src.height)),
    };
  });
}

/* ---------------------------------------------------------------- probe */
function probe(file) {
  return new Promise((resolve, reject) => {
    if (!AVAILABLE) return reject(new Error('ffprobe unavailable'));
    const ps = spawn(FFPROBE, ['-v', 'error', '-print_format', 'json', '-show_format', '-show_streams', file]);
    let out = '', err = '';
    ps.stdout.on('data', (d) => { out += d; });
    ps.stderr.on('data', (d) => { err += d; });
    ps.on('error', reject);
    ps.on('close', (code) => {
      if (code !== 0) return reject(new Error('probe failed: ' + err.slice(0, 300)));
      let j; try { j = JSON.parse(out); } catch (e) { return reject(new Error('probe parse failed')); }
      const v = (j.streams || []).find((s) => s.codec_type === 'video');
      const a = (j.streams || []).find((s) => s.codec_type === 'audio');
      if (!v) return reject(new Error('no video stream'));
      // Rotation may live in a side-data matrix (iPhone / Android portrait clips).
      let rotation = Number(v.tags && v.tags.rotate) || 0;
      const sd = (v.side_data_list || []).find((s) => s.rotation !== undefined);
      if (sd) rotation = Number(sd.rotation) || rotation;
      rotation = ((Math.round(rotation) % 360) + 360) % 360;
      const rot90 = rotation === 90 || rotation === 270;
      const rawW = Number(v.width) || 0, rawH = Number(v.height) || 0;
      const fpsParts = String(v.avg_frame_rate || v.r_frame_rate || '0/1').split('/');
      const fps = Number(fpsParts[1]) ? Number(fpsParts[0]) / Number(fpsParts[1]) : 0;
      return resolve({
        // display dimensions (rotation applied) — this is what the player must reason about
        width: rot90 ? rawH : rawW,
        height: rot90 ? rawW : rawH,
        rotation,
        duration: Number((j.format && j.format.duration) || v.duration || 0),
        bitrate: Number((j.format && j.format.bit_rate) || 0),
        fps: fps && isFinite(fps) ? Math.round(fps * 1000) / 1000 : 30,
        vcodec: v.codec_name || '',
        pix_fmt: v.pix_fmt || '',
        profile: v.profile || '',
        acodec: a ? a.codec_name : '',
        channels: a ? Number(a.channels) || 2 : 0,
        sample_rate: a ? Number(a.sample_rate) || 48000 : 0,
        size: Number((j.format && j.format.size) || 0),
      });
    });
  });
}

/* ---------------------------------------------------------------- runner */
function run(args, { duration, onProgress } = {}) {
  return new Promise((resolve, reject) => {
    const ps = spawn(FFMPEG, ['-hide_banner', '-nostdin', '-loglevel', 'error', '-progress', 'pipe:1', '-y', ...args]);
    let err = '';
    let buf = '';
    ps.stdout.on('data', (d) => {
      buf += d.toString();
      const lines = buf.split('\n'); buf = lines.pop();
      for (const line of lines) {
        const m = /^out_time_ms=(\d+)/.exec(line.trim());
        if (m && duration > 0 && onProgress) {
          const pct = Math.max(0, Math.min(1, (Number(m[1]) / 1e6) / duration));
          onProgress(pct);
        }
      }
    });
    ps.stderr.on('data', (d) => { err += d; if (err.length > 4000) err = err.slice(-4000); });
    ps.on('error', reject);
    ps.on('close', (code) => (code === 0 ? resolve() : reject(new Error(err.trim().slice(0, 400) || ('ffmpeg exited ' + code)))));
  });
}

/* ---------------------------------------------------------------- encoders */
function audioArgs(src, kbps) {
  if (!src.acodec) return ['-an'];
  const ch = Math.min(2, src.channels || 2) || 2;
  return ['-c:a', 'aac', '-b:a', `${kbps}k`, '-ar', String(src.sample_rate >= 44100 ? 48000 : 44100), '-ac', String(ch)];
}

/** Can we keep the original bytes for the top rendition? (best possible quality, ~zero CPU) */
function canRemux(src) {
  if (src.vcodec !== 'h264') return false;
  if (src.acodec && !['aac', 'mp3'].includes(src.acodec)) return false;
  if (src.pix_fmt && src.pix_fmt !== 'yuv420p' && src.pix_fmt !== 'yuvj420p') return false;
  if (Math.min(src.width, src.height) > MAX_HEIGHT) return false; // huge sources get a sane top rung
  if (src.fps > 62) return false;
  const px = src.width * src.height;
  const budget = Math.max(2.5e6, px * (src.fps > 40 ? 0.22 : 0.14)); // bits/s ceiling before it is worth re-encoding
  if (src.bitrate && src.bitrate > budget * 2.2) return false;
  return true;
}

async function makePoster(input, outFile, src, onProgress) {
  const at = src.duration > 2 ? Math.min(src.duration * 0.15, 3) : 0;
  const shortSide = Math.min(src.width, src.height);
  const target = Math.min(shortSide, 1080);
  const scale = target / shortSide;
  const w = even(src.width * scale), h = even(src.height * scale);
  await run(['-ss', String(at), '-i', input, '-frames:v', '1',
    '-vf', `scale=${w}:${h}:flags=lanczos`, '-q:v', '2', outFile]);
  if (onProgress) onProgress(1);
}

async function makeRendition(input, outFile, src, rung, onProgress) {
  const gop = Math.max(24, Math.round((src.fps || 30) * 2));
  const args = [
    ...(THREADS ? ['-threads', String(THREADS)] : []),
    '-i', input,
    '-c:v', 'libx264', '-preset', PRESET, '-crf', String(rung.crf),
    '-profile:v', 'high', '-level', '4.1', '-pix_fmt', 'yuv420p',
    '-maxrate', `${rung.maxrate}k`, '-bufsize', `${rung.bufsize}k`,
    '-vf', `scale=${rung.w}:${rung.h}:flags=lanczos`,
    '-g', String(gop), '-keyint_min', String(Math.round(gop / 2)), '-sc_threshold', '40',
    ...audioArgs(src, rung.ab),
    '-movflags', '+faststart', '-map_metadata', '-1', '-metadata', 'title=Gen-Z Hub',
    outFile,
  ];
  await run(args, { duration: src.duration, onProgress });
}

async function remux(input, outFile, src, onProgress) {
  const args = ['-i', input, '-c', 'copy', '-movflags', '+faststart', '-map_metadata', '-1', outFile];
  if (src.acodec === 'mp3') { args.splice(args.indexOf('-c'), 2, '-c:v', 'copy', ...audioArgs(src, 160)); }
  await run(args, { duration: src.duration, onProgress });
}

module.exports = {
  AVAILABLE, TRANSCODE, FFMPEG, FFPROBE, MAX_HEIGHT, PRESET,
  probe, planLadder, canRemux, makePoster, makeRendition, remux, even,
};
