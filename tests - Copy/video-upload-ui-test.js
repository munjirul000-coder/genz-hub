'use strict';
/* Gen-Z Hub — composer video upload UI test: Uploading → Processing → Optimizing → Ready ✓ */
const puppeteer = require('/tmp/tools/node_modules/puppeteer');
const BASE = process.env.BASE || 'http://127.0.0.1:10071';
const FILE = process.argv[2] || '/tmp/vids/srcvert.mp4';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const out = [];
const ok = (c, m, e) => { out.push(!!c); console.log((c ? '  PASS  ' : '  FAIL  ') + m + (e ? '  ' + e : '')); };

(async () => {
  const browser = await puppeteer.launch({
    headless: 'shell',
    defaultViewport: { width: 1280, height: 900 },
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--autoplay-policy=no-user-gesture-required',
      '--disable-gpu', '--mute-audio', '--single-process', '--no-zygote', '--disable-extensions'],
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
  await page.goto(BASE + '/?t=' + Date.now() + '#/home', { waitUntil: 'domcontentloaded' });
  await sleep(2500);

  // open the composer
  await page.evaluate(() => window.GZ.openComposer({ contentType: 'video' }));
  await sleep(900);
  ok(await page.$('#cp-file') !== null, 'composer opens with a file picker');

  const input = await page.$('#cp-file');
  await input.uploadFile(FILE);

  // watch the staged progress text
  const stages = new Set();
  const t0 = Date.now();
  let ready = false;
  while (Date.now() - t0 < 240000) {
    const txt = await page.evaluate(() => {
      const p = document.querySelector('#cp-ptext');
      const hidden = document.querySelector('#cp-progress').hidden;
      const bar = document.querySelector('#cp-bar');
      return { text: p ? p.textContent.trim() : '', hidden, width: bar ? bar.style.width : '' };
    });
    if (txt.text) stages.add(txt.text.replace(/\d+/g, 'N'));
    if (/Ready/.test(txt.text)) ready = true;
    if (txt.hidden && stages.size) break;
    await sleep(400);
  }
  const list = [...stages];
  console.log('  observed stages:', list.join('  →  '));
  ok(list.some((s) => /Uploading/i.test(s)), 'shows "Uploading — N%"');
  ok(list.some((s) => /Processing|Optimizing/i.test(s)), 'shows "Processing / Optimizing" with a percentage');
  ok(ready, 'shows "Ready ✓" when the video can be published');

  // thumbnail preview + publish
  const thumb = await page.evaluate(() => {
    const t = document.querySelector('#cp-preview .cp-thumb');
    return t ? { img: !!t.querySelector('img'), tag: (t.querySelector('.cp-thumb-tag') || {}).textContent } : null;
  });
  ok(thumb && thumb.img, 'composer shows the generated video thumbnail before publishing');

  await page.evaluate(() => { document.querySelector('#cp-text').value = 'UI upload test — vertical clip #video'; });
  await page.evaluate(() => document.querySelector('#cp-go').click());
  await sleep(4000);

  const posted = await page.evaluate(() => {
    const first = document.querySelector('.post .gzv');
    if (!first) return null;
    const d = JSON.parse(first.getAttribute('data-gzv') || '{}');
    return { variants: (d.variants || []).length, poster: !!d.poster, w: d.width, h: d.height };
  });
  console.log('  published post media:', posted);
  ok(posted && posted.variants >= 1, `published video has ${posted && posted.variants} playback rendition(s)`);
  ok(posted && posted.poster, 'published video has a poster');
  ok(posted && posted.w > 0 && posted.h > 0, `intrinsic size known → no layout shift (${posted && posted.w}x${posted && posted.h})`);

  await sleep(2500);
  const playing = await page.evaluate(() => [...document.querySelectorAll('video')].filter((v) => !v.paused).length);
  ok(playing <= 1, `feed still plays at most one video (${playing})`);
  ok(errors.length === 0, `no console errors (${errors.length})` + (errors[0] ? ' → ' + errors[0].slice(0, 140) : ''));

  await browser.close();
  const fails = out.filter((x) => !x).length;
  console.log(`\n${out.length - fails}/${out.length} checks passed` + (fails ? ` — ${fails} FAILED` : ' — ALL GOOD'));
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error('ERROR', e); process.exit(1); });
