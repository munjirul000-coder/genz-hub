'use strict';
/* Gen-Z Hub — video pipeline quality test (server side).
   Uploads real videos, waits for processing, then compares source vs. delivered renditions. */
const fs = require('fs');
const { execFileSync } = require('child_process');
const BASE = process.env.BASE || 'http://127.0.0.1:10071';
const FFPROBE = require('/home/user/genz-hub/node_modules/ffprobe-static').path;

let cookie = '';
async function api(path, opts = {}) {
  const res = await fetch(BASE + path, {
    ...opts,
    headers: { 'X-GenZ-Client': '1', ...(opts.headers || {}), ...(cookie ? { cookie } : {}) },
  });
  const sc = res.headers.getSetCookie ? res.headers.getSetCookie() : [];
  if (sc.length) cookie = sc.map((c) => c.split(';')[0]).join('; ');
  const text = await res.text();
  let json; try { json = JSON.parse(text); } catch (e) { json = { raw: text.slice(0, 200) }; }
  return { status: res.status, json };
}

function probe(file) {
  const out = execFileSync(FFPROBE, ['-v', 'error', '-print_format', 'json', '-show_format', '-show_streams', file], { encoding: 'utf8' });
  const j = JSON.parse(out);
  const v = j.streams.find((s) => s.codec_type === 'video');
  const a = j.streams.find((s) => s.codec_type === 'audio');
  return {
    w: v.width, h: v.height, codec: v.codec_name, profile: v.profile, pix: v.pix_fmt,
    fps: eval(v.avg_frame_rate), dur: Number(j.format.duration), bitrate: Number(j.format.bit_rate),
    size: Number(j.format.size), acodec: a ? a.codec_name : '', ach: a ? a.channels : 0, asr: a ? a.sample_rate : 0,
  };
}

async function uploadVideo(file) {
  const fd = new FormData();
  const buf = fs.readFileSync(file);
  const type = file.endsWith('.webm') ? 'video/webm' : file.endsWith('.mov') ? 'video/quicktime' : 'video/mp4';
  fd.append('file', new Blob([buf], { type }), file.split('/').pop());
  const r = await api('/api/media/video', { method: 'POST', body: fd });
  if (r.status !== 200) throw new Error('upload failed: ' + JSON.stringify(r.json));
  return r.json.asset;
}

async function waitReady(uid, { full = false } = {}) {
  for (let i = 0; i < 900; i++) {
    const r = await api('/api/media/video/' + uid);
    const a = r.json.asset;
    if (a.status === 'failed') throw new Error('processing failed');
    if (a.status === 'ready' && (!full || a.stage === 'done')) return a;
    await new Promise((r2) => setTimeout(r2, 700));
  }
  throw new Error('timeout');
}

(async () => {
  const login = await api('/api/auth/login', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ identifier: "demo@genzhub.app", password: "Demo12345" }),
  });
  console.log('login:', login.status, login.json.user ? login.json.user.username : login.json);

  const caps = await api('/api/media/capabilities');
  console.log('capabilities:', caps.json);

  const files = process.argv.slice(2);
  const results = [];
  for (const f of files) {
    const src = probe(f);
    const t0 = Date.now();
    const asset = await uploadVideo(f);
    const ready = await waitReady(asset.uid, { full: true });
    const secs = ((Date.now() - t0) / 1000).toFixed(1);
    const dir = `/home/user/genz-hub/data/uploads/v/${ready.uid}`;
    const rows = ready.variants.map((v) => {
      const p = probe(dir + '/' + v.url.split('/').pop());
      return { label: v.label, ...p };
    });
    const top = rows[0];
    results.push({ file: f, src, top, rows, secs, poster: ready.poster, uid: ready.uid });
    console.log('\n=== ' + f + ' ===');
    console.log(`source : ${src.w}x${src.h} ${src.codec} ${src.fps.toFixed(2)}fps ${(src.bitrate / 1e6).toFixed(2)}Mbps ${(src.size / 1e6).toFixed(1)}MB audio=${src.acodec}/${src.ach}ch/${src.asr}Hz`);
    rows.forEach((r) => console.log(`  ${String(r.label).padEnd(7)} ${r.w}x${r.h} ${r.codec}/${r.profile} ${r.fps.toFixed(2)}fps ${(r.bitrate / 1e6).toFixed(2)}Mbps ${(r.size / 1e6).toFixed(1)}MB audio=${r.acodec}/${r.ach}ch/${r.asr}Hz dur=${r.dur.toFixed(2)}s`));
    console.log(`  poster: ${ready.poster} | processing time ${secs}s`);

    // create a post with this video
    const post = await api('/api/posts', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ content: `Video pipeline test — ${f.split('/').pop()} #video`, media: [{ type: 'video', asset_uid: ready.uid }], privacy: 'public' }),
    });
    console.log('  post:', post.status, post.json.post ? '#' + post.json.post.id : post.json);
  }

  // ---- assertions ----
  let fail = 0;
  const ok = (cond, msg) => { console.log((cond ? '  PASS  ' : '  FAIL  ') + msg); if (!cond) fail++; };
  console.log('\n---------------- QUALITY ASSERTIONS ----------------');
  for (const r of results) {
    console.log(r.file.split('/').pop() + ':');
    const srcShort = Math.min(r.src.w, r.src.h);
    const topShort = Math.min(r.top.w, r.top.h);
    ok(topShort >= Math.min(srcShort, 1080) * 0.98, `top rendition keeps resolution (${srcShort}p → ${topShort}p)`);
    ok(Math.abs((r.top.w / r.top.h) - (r.src.w / r.src.h)) < 0.02, 'aspect ratio preserved');
    ok(Math.abs(r.top.fps - r.src.fps) < 1.2, `frame rate preserved (${r.src.fps.toFixed(1)} → ${r.top.fps.toFixed(1)})`);
    ok(Math.abs(r.top.dur - r.src.dur) < 0.5, 'duration / AV sync length preserved');
    ok(r.top.codec === 'h264' && r.top.pix === 'yuv420p', 'H.264 yuv420p (universally playable)');
    ok(!r.src.acodec || (r.top.acodec === 'aac' && r.top.asr >= 44100), `audio AAC ${r.top.asr}Hz ${r.top.ach}ch preserved`);
    const perPx = r.top.bitrate / (r.top.w * r.top.h * r.top.fps);
    ok(perPx > 0.02, `bitrate not over-compressed (${(r.top.bitrate / 1e6).toFixed(2)} Mbps, ${perPx.toFixed(3)} bpp)`);
    ok(!!r.poster, 'poster generated');
    ok(r.rows.length >= 1, `adaptive ladder: ${r.rows.map((x) => x.label).join(', ')}`);
    const asc = r.rows.every((x, i, arr) => i === 0 || Math.min(x.w, x.h) <= Math.min(arr[i - 1].w, arr[i - 1].h));
    ok(asc, 'ladder sorted high → low, no upscaled fakes');
    ok(!r.rows.some((x) => Math.min(x.w, x.h) > srcShort * 1.02), 'never upscales above source');
  }
  console.log(fail ? `\n${fail} FAILURES` : '\nALL QUALITY ASSERTIONS PASSED');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('ERROR', e); process.exit(1); });
