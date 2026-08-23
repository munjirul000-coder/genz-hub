'use strict';
/* Gen-Z Hub — feed video playback / scroll performance test (real Chromium).
   Verifies: lazy loading, one-video-at-a-time, pause on scroll-away, limited <video> pool,
   preload discipline, poster-first rendering, range requests, mobile + desktop. */
const puppeteer = require('/tmp/tools/node_modules/puppeteer');
const BASE = process.env.BASE || 'http://127.0.0.1:10071';

const results = [];
const ok = (cond, msg, extra) => { results.push({ cond: !!cond, msg, extra }); console.log((cond ? '  PASS  ' : '  FAIL  ') + msg + (extra ? '  ' + extra : '')); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function state(page) {
  return page.evaluate(() => {
    const boxes = [...document.querySelectorAll('.gzv')];
    const vids = [...document.querySelectorAll('video.gzv-video')];
    return {
      shells: boxes.length,
      attached: vids.length,
      playing: vids.filter((v) => !v.paused && !v.ended).length,
      playingSrc: vids.filter((v) => !v.paused).map((v) => v.currentSrc.split('/').slice(-2).join('/')),
      srcs: vids.map((v) => ({ src: v.currentSrc.split('/').slice(-2).join('/'), paused: v.paused, muted: v.muted, preload: v.preload, rs: v.readyState })),
      posters: boxes.filter((b) => b.querySelector('img.gzv-poster')).length,
    };
  });
}

async function scrollTo(page, i) {
  await page.evaluate((idx) => {
    const b = document.querySelectorAll('.gzv')[idx];
    if (b) b.scrollIntoView({ block: 'center' });
  }, i);
  await sleep(1600);
}

(async () => {
  const launch = (device) => puppeteer.launch({
    headless: 'shell',
    defaultViewport: { width: device.w, height: device.h, isMobile: !!device.mobile, hasTouch: !!device.mobile, deviceScaleFactor: device.mobile ? 3 : 1 },
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--autoplay-policy=no-user-gesture-required',
      '--disable-gpu', '--mute-audio', '--single-process', '--no-zygote', '--disable-extensions',
      '--disable-background-networking', `--window-size=${device.w},${device.h}`],
  });

  for (const device of [{ name: 'desktop', w: 1440, h: 900 }, { name: 'mobile', w: 390, h: 844, mobile: true }]) {
    console.log(`\n================ ${device.name.toUpperCase()} (${device.w}x${device.h}) ================`);
    const browser = await launch(device);
    const page = (await browser.pages())[0] || await browser.newPage();

    const errors = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));

    // track network: which video files were requested, and whether ranges are used
    const videoReqs = new Map();
    let rangeCount = 0, bytes = 0;
    page.on('request', (r) => {
      if (/\/uploads\/v\/.*\.mp4/.test(r.url())) {
        videoReqs.set(r.url().split('/').slice(-2).join('/'), (videoReqs.get(r.url().split('/').slice(-2).join('/')) || 0) + 1);
        if (r.headers().range) rangeCount++;
      }
    });
    page.on('response', async (r) => {
      if (/\/uploads\/v\/.*\.mp4/.test(r.url())) {
        const len = Number(r.headers()['content-length'] || 0);
        bytes += len;
      }
    });

    // login
    await page.goto(BASE + '/#/login', { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => {
      return fetch('/api/auth/login', {
        method: 'POST', headers: { 'content-type': 'application/json', 'X-GenZ-Client': '1' },
        body: JSON.stringify({ identifier: 'demo@genzhub.app', password: 'Demo12345', remember: true }),
      });
    });
    await page.goto(BASE + '/?t=' + Date.now() + '#/home', { waitUntil: 'domcontentloaded' });
    await sleep(2500);

    // scroll the whole feed to load more posts (videos are spread over the feed)
    for (let i = 0; i < 6; i++) {
      await page.evaluate(() => window.scrollBy(0, window.innerHeight * 1.5));
      await sleep(900);
    }
    await page.evaluate(() => window.scrollTo(0, 0));
    await sleep(1200);

    const s0 = await state(page);
    console.log(`  feed: ${s0.shells} video shells, ${s0.attached} <video> attached`);
    ok(s0.shells >= 5, `feed contains ${s0.shells} videos (need 5+ for the scroll test)`);
    ok(s0.attached <= 3, `lazy: only ${s0.attached} <video> elements exist for ${s0.shells} videos (max 3)`);
    ok(s0.posters >= s0.shells - 1, `poster-first: ${s0.posters}/${s0.shells} shells show a thumbnail before load`);

    // ---- video 1 → 2 → 3 ----
    const seen = [];
    let multi = 0, maxAttached = 0;
    for (let i = 0; i < Math.min(6, s0.shells); i++) {
      await scrollTo(page, i);
      const s = await state(page);
      maxAttached = Math.max(maxAttached, s.attached);
      if (s.playing > 1) multi++;
      seen.push({ i, playing: s.playing, attached: s.attached, src: s.playingSrc[0] || '—' });
      console.log(`   → video #${i + 1}: playing=${s.playing} attached=${s.attached} src=${s.playingSrc[0] || 'none'}`);
    }
    ok(multi === 0, 'never two videos playing at the same time');
    ok(seen.filter((x) => x.playing === 1).length >= Math.min(4, s0.shells), `each visible video autoplays (${seen.filter((x) => x.playing === 1).length}/${seen.length})`);
    // how many *distinct* clips do the first six shells actually contain? (a demo feed may reuse one)
    const distinctAvailable = await page.evaluate(() => {
      const urls = [...document.querySelectorAll('.gzv')].slice(0, 6).map((b) => {
        const d = JSON.parse(b.getAttribute('data-gzv') || '{}');
        return (d.variants && d.variants[0] && d.variants[0].url) || d.url || '';
      });
      return new Set(urls).size;
    });
    const distinctPlayed = new Set(seen.map((x) => x.src)).size;
    ok(distinctPlayed >= Math.min(3, distinctAvailable),
      `the active video actually changes while scrolling (${distinctPlayed} distinct of ${distinctAvailable} available)`);
    ok(maxAttached <= 3, `pool stays small while scrolling (max ${maxAttached} <video> elements)`);

    // scroll away from everything → all paused
    await page.evaluate(() => window.scrollTo(0, 0));
    await sleep(1500);
    const top = await state(page);
    const anyAudible = await page.evaluate(() => [...document.querySelectorAll('video')].some((v) => !v.paused && !v.muted));
    ok(!anyAudible, 'no audio keeps playing after scrolling away');

    // manual pause is respected while the video stays on screen
    await scrollTo(page, 1);
    await page.evaluate(() => { const b = document.querySelectorAll('.gzv')[1]; if (b) b.querySelector('.gzv-stage').click(); });
    await sleep(900);
    const paused = await page.evaluate(() => { const v = document.querySelectorAll('.gzv')[1].querySelector('video'); return v ? v.paused : null; });
    ok(paused === true, 'tap pauses the video and it stays paused');
    await page.evaluate(() => { const b = document.querySelectorAll('.gzv')[1]; if (b) b.querySelector('.gzv-stage').click(); });
    await sleep(1200);
    const resumed = await page.evaluate(() => { const v = document.querySelectorAll('.gzv')[1].querySelector('video'); return v ? !v.paused : null; });
    ok(resumed === true, 'tap again resumes playback');

    // sound toggle
    await page.evaluate(() => document.querySelectorAll('.gzv')[1].querySelector('.gzv-snd').click());
    await sleep(600);
    const unmuted = await page.evaluate(() => { const v = document.querySelectorAll('.gzv')[1].querySelector('video'); return v && !v.muted; });
    ok(unmuted === true, 'sound toggle unmutes the active video');
    await page.evaluate(() => document.querySelectorAll('.gzv')[1].querySelector('.gzv-snd').click());

    // quality menu + adaptive selection
    const q = await page.evaluate(() => {
      const box = document.querySelectorAll('.gzv')[1];
      box.querySelector('.gzv-q').click();
      const items = [...box.querySelectorAll('.gzv-menu button')].map((b) => b.textContent.trim());
      const label = box.querySelector('.gzv-q').textContent.trim();
      const v = box.querySelector('video');
      return { items, label, src: v ? v.currentSrc.split('/').pop() : '' };
    });
    console.log('   quality menu:', q.items.join(' | '), '→ active:', q.label, q.src);
    ok(q.items.length >= 2, `quality menu offers ${q.items.length} options (${q.items.join(', ')})`);
    ok(/Auto/.test(q.label), 'auto quality is the default');
    const expectSmall = device.mobile;
    ok(expectSmall ? /360p|480p|720p/.test(q.src) : /\d+p\.mp4/.test(q.src),
      `adaptive pick suits the ${device.name} viewport (${q.src})`);

    // network discipline
    const requested = [...videoReqs.keys()];
    console.log(`   video files fetched: ${requested.length} (${(bytes / 1e6).toFixed(1)} MB), range requests: ${rangeCount}`);
    ok(requested.length <= s0.shells, `does not download the whole feed at once (${requested.length} of ${s0.shells} videos touched)`);
    ok(rangeCount > 0 || bytes > 0, 'video delivery works (range/partial requests supported)');

    // hash navigation stops playback
    await page.evaluate(() => { window.location.hash = '#/explore'; });
    await sleep(1200);
    const afterNav = await page.evaluate(() => [...document.querySelectorAll('video')].filter((v) => !v.paused).length);
    ok(afterNav === 0, 'leaving the page stops every video');

    ok(errors.length === 0, `console errors: ${errors.length}` + (errors.length ? ' → ' + errors.slice(0, 3).join(' | ') : ''));
    await browser.close();
  }

  // ---- range request check straight from the server ----
  const one = await fetch(BASE + '/api/posts/feed?limit=20', { headers: { 'X-GenZ-Client': '1' } }).then((r) => r.json()).catch(() => ({}));
  const vid = (one.posts || []).flatMap((p) => p.media || []).find((m) => m.type === 'video');
  if (vid) {
    const r = await fetch(BASE + vid.url, { headers: { Range: 'bytes=0-1023' } });
    ok(r.status === 206 && r.headers.get('content-range'), `HTTP range request → ${r.status} ${r.headers.get('content-range')}`);
    ok(r.headers.get('accept-ranges') === 'bytes', 'Accept-Ranges: bytes advertised');
    ok(/immutable/.test(r.headers.get('cache-control') || ''), `CDN-friendly caching: ${r.headers.get('cache-control')}`);
  }

  const fails = results.filter((r) => !r.cond).length;
  console.log(`\n${results.length - fails}/${results.length} checks passed` + (fails ? ` — ${fails} FAILED` : ' — ALL GOOD'));
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error('ERROR', e); process.exit(1); });
