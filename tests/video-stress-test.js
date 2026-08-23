'use strict';
/* Gen-Z Hub — long-feed stress + slow-network behaviour.
   50 video posts, measured scroll cost, memory, and adaptive downshift on a throttled link. */
const puppeteer = require('/tmp/tools/node_modules/puppeteer');
const BASE = process.env.BASE || 'http://127.0.0.1:10071';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const out = [];
const ok = (c, m, extra) => { out.push(!!c); console.log((c ? '  PASS  ' : '  FAIL  ') + m + (extra ? '  ' + extra : '')); };

async function session(device, netProfile) {
  const browser = await puppeteer.launch({
    headless: 'shell',
    defaultViewport: { width: device.w, height: device.h, isMobile: !!device.mobile, hasTouch: !!device.mobile, deviceScaleFactor: device.mobile ? 3 : 1 },
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--autoplay-policy=no-user-gesture-required',
      '--disable-gpu', '--mute-audio', '--single-process', '--no-zygote', '--disable-extensions', '--disable-background-networking'],
  });
  const page = (await browser.pages())[0];
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

  await page.goto(BASE + '/#/login', { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => fetch('/api/auth/login', {
    method: 'POST', headers: { 'content-type': 'application/json', 'X-GenZ-Client': '1' },
    body: JSON.stringify({ identifier: 'demo@genzhub.app', password: 'Demo12345', remember: true }),
  }));

  const client = await page.createCDPSession();
  if (netProfile) {
    await client.send('Network.enable');
    await client.send('Network.emulateNetworkConditions', {
      offline: false, latency: netProfile.latency,
      downloadThroughput: netProfile.down, uploadThroughput: netProfile.up,
    });
  }
  await page.goto(BASE + '/?t=' + Date.now() + '#/home', { waitUntil: 'domcontentloaded' });
  await sleep(3000);
  return { browser, page, client, errors };
}

(async () => {
  // ---------- 1. long feed (50 videos) ----------
  console.log('\n============ LONG FEED — 50 videos, desktop ============');
  {
    const { browser, page, client, errors } = await session({ w: 1440, h: 900 });
    let bytes = 0;
    page.on('response', (r) => { if (/\.mp4/.test(r.url())) bytes += Number(r.headers()['content-length'] || 0); });

    // load enough pages of the feed
    for (let i = 0; i < 14; i++) {
      await page.evaluate(() => window.scrollBy(0, window.innerHeight * 2));
      await sleep(650);
    }
    const shells = await page.evaluate(() => document.querySelectorAll('.gzv').length);
    console.log(`  feed loaded ${shells} video shells`);

    await page.evaluate(() => window.scrollTo(0, 0));
    await sleep(1200);
    await page.evaluate(() => {
      window.__longTasks = 0;
      try { new PerformanceObserver((l) => { window.__longTasks += l.getEntries().length; }).observe({ entryTypes: ['longtask'] }); } catch (e) {}
    });

    const t0 = Date.now();
    let maxAttached = 0;
    const steps = 40;
    for (let i = 0; i < steps; i++) {
      await page.evaluate(() => window.scrollBy(0, 700));
      await sleep(120);
      const a = await page.evaluate(() => document.querySelectorAll('video.gzv-video').length);
      maxAttached = Math.max(maxAttached, a);
    }
    const elapsed = Date.now() - t0;
    // land on a real video (the fast scroll ends at the page bottom, where no video is on screen)
    await page.evaluate(() => { const g = document.querySelectorAll('.gzv'); const b = g[Math.floor(g.length / 2)]; if (b) b.scrollIntoView({ block: 'center' }); });
    await sleep(2200); // scroll settles → the video in view takes over
    const stats = await page.evaluate(() => ({
      longTasks: window.__longTasks || 0,
      heap: performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1e6) : -1,
      attached: document.querySelectorAll('video.gzv-video').length,
      shells: document.querySelectorAll('.gzv').length,
      playing: [...document.querySelectorAll('video')].filter((v) => !v.paused).length,
    }));
    console.log(`  scrolled ${steps} steps in ${elapsed}ms · long tasks: ${stats.longTasks} · JS heap: ${stats.heap}MB · downloaded ${(bytes / 1e6).toFixed(1)}MB`);
    ok(shells >= 20, `long feed rendered (${shells} videos)`);
    ok(maxAttached <= 3, `at most 3 <video> elements alive during a 40-step scroll (peak ${maxAttached})`);
    ok(stats.playing === 1, `exactly one video resumes once scrolling stops (${stats.playing})`);
    ok(stats.longTasks <= steps, `scrolling stays responsive (${stats.longTasks} long tasks over ${steps} scroll steps)`);
    ok(stats.heap < 0 || stats.heap < 220, `memory stays sane (JS heap ${stats.heap}MB)`);
    ok(bytes / 1e6 < shells * 2, `bandwidth bounded: ${(bytes / 1e6).toFixed(1)}MB for ${shells} videos (no full-feed download)`);
    ok(errors.length === 0, `no console errors (${errors.length})` + (errors[0] ? ' → ' + errors[0].slice(0, 120) : ''));
    await browser.close();
  }

  // ---------- 2. slow network ----------
  console.log('\n============ SLOW NETWORK — 400 kbps / 400ms RTT, mobile ============');
  {
    const { browser, page, errors } = await session({ w: 390, h: 844, mobile: true },
      { latency: 400, down: (400 * 1024) / 8, up: (200 * 1024) / 8 });
    await sleep(3000);
    await page.evaluate(() => { const b = document.querySelectorAll('.gzv')[0]; if (b) b.scrollIntoView({ block: 'center' }); });
    await sleep(9000);
    const s = await page.evaluate(() => {
      const v = document.querySelector('video.gzv-video');
      return v ? { src: v.currentSrc.split('/').pop(), rs: v.readyState, paused: v.paused, attached: document.querySelectorAll('video.gzv-video').length } : null;
    });
    console.log('  slow-network state:', s);
    ok(!!s, 'a video still loads on a slow link');
    ok(s && /360p|480p/.test(s.src), `adaptive picks a low rendition on a slow link (${s && s.src})`);
    ok(s && s.attached <= 2, `no preloading of extra videos while bandwidth is scarce (${s && s.attached} attached)`);
    ok(errors.length === 0, `no console errors on slow network (${errors.length})`);
    await browser.close();
  }

  const fails = out.filter((x) => !x).length;
  console.log(`\n${out.length - fails}/${out.length} checks passed` + (fails ? ` — ${fails} FAILED` : ' — ALL GOOD'));
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error('ERROR', e); process.exit(1); });
