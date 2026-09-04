'use strict';
/* Gen-Z Hub — full video verification matrix (brief §16 + §17).
   A) quality matrix: every source shape/codec/size → what is actually delivered
   B) scale matrix:   5 / 10 / 20 / 50 video feeds × mobile / laptop / desktop × fast / slow net
   C) stability:      re-render safety, console errors, memory, bandwidth                        */
const fs = require('fs');
const { execFileSync } = require('child_process');
const puppeteer = require('/tmp/tools/node_modules/puppeteer');
const BASE = process.env.BASE || 'http://127.0.0.1:10071';
const FFPROBE = require('/home/user/genz-hub/node_modules/ffprobe-static').path;
const { db } = require('/home/user/genz-hub/src/db');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
const ok = (c, m, extra) => { results.push(!!c); console.log(`  ${c ? 'PASS' : 'FAIL'}  ${m}${extra ? '  ' + extra : ''}`); };

let cookie = '';
async function api(p, o = {}) {
  const r = await fetch(BASE + p, { ...o, headers: { 'X-GenZ-Client': '1', ...(o.headers || {}), ...(cookie ? { cookie } : {}) } });
  const sc = r.headers.getSetCookie ? r.headers.getSetCookie() : [];
  if (sc.length) cookie = sc.map((c) => c.split(';')[0]).join('; ');
  const t = await r.text();
  try { return { s: r.status, j: JSON.parse(t) }; } catch (e) { return { s: r.status, j: { raw: t.slice(0, 150) } }; }
}

function probe(f) {
  const j = JSON.parse(execFileSync(FFPROBE, ['-v', 'error', '-print_format', 'json', '-show_format', '-show_streams', f], { encoding: 'utf8' }));
  const v = j.streams.find((s) => s.codec_type === 'video');
  const a = j.streams.find((s) => s.codec_type === 'audio');
  return {
    w: v.width, h: v.height, codec: v.codec_name, pix: v.pix_fmt, fps: eval(v.avg_frame_rate),
    dur: +j.format.duration, br: +j.format.bit_rate, size: +j.format.size,
    acodec: a && a.codec_name, ach: a && a.channels, asr: a && a.sample_rate,
  };
}

async function uploadAndWait(file) {
  const fd = new FormData();
  const type = file.endsWith('.webm') ? 'video/webm' : file.endsWith('.mov') ? 'video/quicktime' : 'video/mp4';
  fd.append('file', new Blob([fs.readFileSync(file)], { type }), file.split('/').pop());
  const up = await api('/api/media/video', { method: 'POST', body: fd });
  if (up.s !== 200) throw new Error('upload failed ' + JSON.stringify(up.j));
  const uid = up.j.asset.uid;
  for (let i = 0; i < 900; i++) {
    await sleep(700);
    const st = await api('/api/media/video/' + uid);
    const a = st.j.asset;
    if (!a) continue;
    if (a.status === 'failed') throw new Error('processing failed');
    if (a.stage === 'done') return a;
  }
  throw new Error('timeout');
}

function ar(w, h) { return w / h; }
function shape(w, h) {
  const r = ar(w, h);
  if (Math.abs(r - 16 / 9) < 0.03) return '16:9';
  if (Math.abs(r - 9 / 16) < 0.03) return '9:16';
  if (Math.abs(r - 1) < 0.02) return '1:1';
  if (Math.abs(r - 4 / 5) < 0.03) return '4:5';
  return r.toFixed(2);
}

/* ------------------------------------------------------------------ feed control */
function resetVideoPosts(n, uids) {
  db.prepare("DELETE FROM posts WHERE content LIKE 'MATRIX clip%'").run();
  const me = db.prepare("SELECT id FROM users WHERE email='demo@genzhub.app'").get().id;
  const ins = db.prepare('INSERT INTO posts (user_id,content,hub,kind,topic,privacy,link_url,created_at) VALUES (?,?,?,?,?,?,?,?)');
  const insM = db.prepare('INSERT INTO post_media (post_id,url,type,position,asset_uid,poster,width,height,duration) VALUES (?,?,?,?,?,?,?,?,?)');
  for (let i = 0; i < n; i++) {
    const uid = uids[i % uids.length];
    const a = db.prepare('SELECT * FROM video_assets WHERE uid=?').get(uid);
    const v = JSON.parse(a.variants || '[]').sort((x, y) => y.h - x.h)[0];
    const id = ins.run(me, `MATRIX clip ${i + 1} #video`, 'general', 'post', '', 'public', null, Date.now() - i * 1000).lastInsertRowid;
    insM.run(id, v.url, 'video', 0, uid, a.poster, a.width, a.height, a.duration);
  }
}
function clearVideoPosts() {
  db.prepare("DELETE FROM posts WHERE content LIKE 'MATRIX clip%'").run();
}

/* ------------------------------------------------------------------ browser run */
async function feedRun({ w, h, mobile, net, label, expectVideos }) {
  const browser = await puppeteer.launch({
    headless: 'shell',
    defaultViewport: { width: w, height: h, isMobile: !!mobile, hasTouch: !!mobile, deviceScaleFactor: mobile ? 3 : 1 },
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--autoplay-policy=no-user-gesture-required',
      '--disable-gpu', '--mute-audio', '--single-process', '--no-zygote', '--disable-extensions', '--disable-background-networking'],
  });
  const page = (await browser.pages())[0];
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  let bytes = 0, files = new Set();
  page.on('response', (r) => {
    if (/\/uploads\/v\/.*\.mp4/.test(r.url())) { bytes += Number(r.headers()['content-length'] || 0); files.add(r.url()); }
  });

  await page.goto(BASE + '/#/login', { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => fetch('/api/auth/login', {
    method: 'POST', headers: { 'content-type': 'application/json', 'X-GenZ-Client': '1' },
    body: JSON.stringify({ identifier: 'demo@genzhub.app', password: 'Demo12345', remember: true }),
  }));
  if (net) {
    const cdp = await page.createCDPSession();
    await cdp.send('Network.enable');
    await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: net.latency, downloadThroughput: net.down, uploadThroughput: net.up });
  }
  await page.goto(BASE + '/?t=' + Date.now() + '#/home', { waitUntil: 'domcontentloaded' });
  await sleep(net ? 5000 : 2800);

  // load the whole feed (infinite scroll) — keep hitting the bottom until it stops growing
  let stale = 0, seenCount = 0;
  for (let i = 0; i < 60; i++) {
    const n = await page.evaluate(() => document.querySelectorAll('.gzv').length);
    if (n >= expectVideos) break;
    stale = n === seenCount ? stale + 1 : 0;
    seenCount = n;
    if (stale >= 6) break;
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await sleep(net ? 900 : 550);
  }
  await page.evaluate(() => window.scrollTo(0, 0));
  await sleep(1400);
  await page.evaluate(() => {
    window.__lt = 0;
    try { new PerformanceObserver((l) => { window.__lt += l.getEntries().length; }).observe({ entryTypes: ['longtask'] }); } catch (e) {}
  });

  const shells = await page.evaluate(() => document.querySelectorAll('.gzv').length);
  let maxAttached = 0, multiPlay = 0, played = new Set(), steps = 0;
  const t0 = Date.now();
  const visit = Math.min(shells, 12);
  for (let i = 0; i < visit; i++) {
    await page.evaluate((idx) => { const b = document.querySelectorAll('.gzv')[idx]; if (b) b.scrollIntoView({ block: 'center' }); }, i);
    await sleep(net ? 2000 : 1200);
    steps++;
    const s = await page.evaluate(() => {
      const vids = [...document.querySelectorAll('video.gzv-video')];
      return {
        attached: vids.length,
        playing: vids.filter((v) => !v.paused).length,
        src: vids.filter((v) => !v.paused).map((v) => v.currentSrc.split('/').slice(-2).join('/'))[0] || '',
        audible: vids.some((v) => !v.paused && !v.muted),
      };
    });
    maxAttached = Math.max(maxAttached, s.attached);
    if (s.playing > 1) multiPlay++;
    if (s.src) played.add(s.src);
  }
  const perStep = Math.round((Date.now() - t0) / Math.max(1, steps));
  const fin = await page.evaluate(() => ({
    lt: window.__lt || 0,
    heap: performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1e6) : -1,
    attached: document.querySelectorAll('video.gzv-video').length,
    playing: [...document.querySelectorAll('video')].filter((v) => !v.paused).length,
  }));
  await browser.close();
  return { label, shells, maxAttached, multiPlay, distinct: played.size, perStep, bytesMB: +(bytes / 1e6).toFixed(1), files: files.size, ...fin, errors: errors.length, firstError: errors[0] };
}

/* ------------------------------------------------------------------ main */
(async () => {
  const login = await api('/api/auth/login', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ identifier: 'demo@genzhub.app', password: 'Demo12345', remember: true }),
  });
  console.log('login:', login.s);

  // ============================ A. QUALITY MATRIX ============================
  console.log('\n================= A. QUALITY MATRIX (source → delivered) =================');
  const SOURCES = process.env.QUICK ? ['/tmp/vids/src1080.mp4'] : [
    '/tmp/vids/src1080.mp4', '/tmp/vids/srcvert.mp4', '/tmp/vids/src1x1.mp4', '/tmp/vids/src4x5.mp4',
    '/tmp/vids/src720p60.mp4', '/tmp/vids/src480.mp4', '/tmp/vids/src360.mp4', '/tmp/vids/src1440.mp4',
    '/tmp/vids/srcweb.webm', '/tmp/vids/srchevc.mp4', '/tmp/vids/srcmov.mov',
  ].filter((f) => fs.existsSync(f));

  const uids = [];
  const rows = [];
  if (process.env.PART === 'B') {
    db.prepare("SELECT uid FROM video_assets WHERE status='ready' ORDER BY id DESC LIMIT 8").all().forEach((r) => uids.push(r.uid));
    console.log('  (reusing ' + uids.length + ' already-processed assets)');
  }
  for (const f of (process.env.PART === 'B' ? [] : SOURCES)) {
    const src = probe(f);
    const t0 = Date.now();
    const a = await uploadAndWait(f);
    const secs = ((Date.now() - t0) / 1000).toFixed(1);
    uids.push(a.uid);
    const dir = `/home/user/genz-hub/data/uploads/v/${a.uid}`;
    const top = probe(dir + '/' + a.variants[0].url.split('/').pop());
    const poster = fs.existsSync(dir + '/poster.jpg') ? fs.statSync(dir + '/poster.jpg').size : 0;
    rows.push({ f: f.split('/').pop(), src, top, a, secs, poster });
    console.log(`\n  ${f.split('/').pop()}`);
    console.log(`    source    : ${src.w}x${src.h} ${shape(src.w, src.h)} ${src.codec} ${src.fps.toFixed(0)}fps ${(src.br / 1e6).toFixed(2)}Mbps ${(src.size / 1e6).toFixed(1)}MB ${src.acodec}/${src.ach}ch/${src.asr}Hz`);
    console.log(`    delivered : ${top.w}x${top.h} ${shape(top.w, top.h)} ${top.codec} ${top.fps.toFixed(0)}fps ${(top.br / 1e6).toFixed(2)}Mbps ${(top.size / 1e6).toFixed(1)}MB ${top.acodec}/${top.ach}ch/${top.asr}Hz ${a.variants[0].source === 'original' ? '(stream copy — zero loss)' : ''}`);
    console.log(`    ladder    : ${a.variants.map((v) => v.label).join(', ')} · poster ${(poster / 1024).toFixed(0)}KB · pipeline ${secs}s`);
  }

  console.log('\n  --- assertions ---');
  for (const r of rows) {
    const sShort = Math.min(r.src.w, r.src.h), tShort = Math.min(r.top.w, r.top.h);
    const name = r.f.padEnd(16);
    ok(tShort >= Math.min(sShort, 1080) * 0.98, `${name} resolution preserved (${sShort}p → ${tShort}p)`);
    ok(Math.abs(ar(r.top.w, r.top.h) - ar(r.src.w, r.src.h)) < 0.02, `${name} aspect ${shape(r.src.w, r.src.h)} kept, no stretching`);
    ok(Math.abs(r.top.fps - r.src.fps) < 1.2, `${name} frame rate ${r.src.fps.toFixed(0)} → ${r.top.fps.toFixed(0)}`);
    ok(Math.abs(r.top.dur - r.src.dur) < 0.5, `${name} duration/A-V sync kept (${r.top.dur.toFixed(2)}s)`);
    ok(r.top.codec === 'h264' && r.top.pix === 'yuv420p', `${name} H.264 yuv420p (plays everywhere)`);
    ok(r.top.acodec === 'aac' && r.top.ach === r.src.ach && r.top.asr >= 44100, `${name} audio AAC ${r.top.ach}ch ${r.top.asr}Hz`);
    const bpp = r.top.br / (r.top.w * r.top.h * r.top.fps);
    ok(bpp > 0.02, `${name} not over-compressed (${bpp.toFixed(3)} bits/px)`);
    ok(r.poster > 8000, `${name} sharp poster (${(r.poster / 1024).toFixed(0)}KB)`);
    ok(!r.a.variants.some((v) => v.h > sShort * 1.02), `${name} no fake upscaled rendition`);
    const expected = [1080, 720, 480, 360].filter((x) => x <= Math.min(sShort, 1080) * 1.02).length || 1;
    ok(r.a.variants.length === expected, `${name} ladder = ${r.a.variants.map((v) => v.label).join('/')}`);
  }

  if (process.env.PART === 'A') {
    const f1 = results.filter((x) => !x).length;
    console.log(`\n================= PART A: ${results.length - f1}/${results.length} checks passed${f1 ? ` — ${f1} FAILED` : ' — ALL GOOD'} =================`);
    process.exit(f1 ? 1 : 0);
  }

  // ============================ B. SCALE MATRIX ============================
  console.log('\n================= B. SCALE MATRIX (feed size × device × network) =================');
  const DEVICES = [
    { name: 'mobile', w: 390, h: 844, mobile: true },
    { name: 'laptop', w: 1366, h: 768 },
    { name: 'desktop', w: 1920, h: 1080 },
  ];
  const COUNTS = process.env.COUNTS ? process.env.COUNTS.split(',').map(Number) : (process.env.QUICK ? [5] : [5, 10, 20, 50]);
  const table = [];
  for (const count of COUNTS) {
    resetVideoPosts(count, uids);
    for (const d of DEVICES) {
      const r = await feedRun({ ...d, label: `${count} videos · ${d.name}`, expectVideos: count });
      table.push({ count, device: d.name, net: 'fast', ...r });
      console.log(`  ${String(count).padStart(2)} videos · ${d.name.padEnd(7)} → shells ${String(r.shells).padStart(2)} · peak <video> ${r.maxAttached} · simultaneous-play violations ${r.multiPlay} · ${r.bytesMB}MB/${r.files} files · ${r.perStep}ms per step · longtasks ${r.lt} · heap ${r.heap}MB · errors ${r.errors}`);
    }
  }
  // slow network at the largest size
  resetVideoPosts(COUNTS[COUNTS.length - 1], uids);
  const slow = await feedRun({ name: 'mobile', w: 390, h: 844, mobile: true, expectVideos: 10, label: 'slow', net: { latency: 400, down: 400 * 1024 / 8, up: 200 * 1024 / 8 } });
  table.push({ count: COUNTS[COUNTS.length - 1], device: 'mobile', net: 'slow 3G', ...slow });
  console.log(`  ${COUNTS[COUNTS.length - 1]} videos · mobile · SLOW 3G → peak <video> ${slow.maxAttached} · ${slow.bytesMB}MB · errors ${slow.errors}`);

  console.log('\n  --- assertions ---');
  for (const r of table) {
    const n = `${String(r.count).padStart(2)}v ${r.device}/${r.net}`.padEnd(20);
    ok(r.multiPlay === 0, `${n} never two videos playing at once`);
    ok(r.maxAttached <= 3, `${n} ≤3 live <video> elements (peak ${r.maxAttached})`);
    ok(r.playing <= 1, `${n} one active video at rest`);
    ok(r.errors === 0, `${n} zero console errors` + (r.firstError ? ' → ' + r.firstError.slice(0, 90) : ''));
    ok(r.heap < 0 || r.heap < 250, `${n} JS heap ${r.heap}MB`);
    ok(r.files <= Math.max(4, r.shells), `${n} only ${r.files} of ${r.shells} clips fetched (no full-feed download)`);
    ok(r.lt <= Math.max(6, r.shells / 2), `${n} ${r.lt} long tasks while scrolling`);
  }

  clearVideoPosts();
  const fails = results.filter((x) => !x).length;
  console.log(`\n================= ${results.length - fails}/${results.length} checks passed${fails ? ` — ${fails} FAILED` : ' — ALL GOOD'} =================`);
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error('ERROR', e); process.exit(1); });
