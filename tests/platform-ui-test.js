'use strict';
/* Gen-Z Hub — browser test for the v2 platform pages (desktop + mobile).
   Clicks through Shop, product, cart, Work, Arena, Poll Arena, Idea Arena, Hubs and
   verifies real rendering, working buttons and zero console errors. */

const puppeteer = require('/tmp/tools/node_modules/puppeteer');
const BASE = process.env.BASE || 'http://127.0.0.1:10071';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const out = [];
const ok = (c, m, e) => { out.push(!!c); console.log((c ? '  PASS  ' : '  FAIL  ') + m + (e ? '  ' + e : '')); };

const ROUTES = [
  ['#/hubs', 'Interest hubs', '.project-card'],
  ['#/shop', 'Shop', '.chip'],
  ['#/work', 'Work', '.chip'],
  ['#/work?tab=talent', 'Hire talent', '.chip'],
  ['#/work?tab=packages', 'Job packages', '.project-card'],
  ['#/arena', 'Arena overview', '.card'],
  ['#/arena?tab=challenges', 'Challenges', '.showcase,.empty'],
  ['#/arena?tab=leaderboard', 'Leaderboard', '.card'],
  ['#/arena?tab=badges', 'Badges', '.project-card'],
  ['#/polls', 'Poll Arena', '.card'],
  ['#/ideas', 'Idea Arena', '.card'],
  ['#/ads', 'Promote', '.card'],
  ['#/orders', 'Orders', '.card,.empty'],
  ['#/wishlist', 'Wishlist', '.showcase,.empty'],
  ['#/seller', 'Seller studio', '.card,.field'],
];

async function run(device) {
  console.log(`\n================ ${device.name.toUpperCase()} ================`);
  const browser = await puppeteer.launch({
    headless: 'shell',
    defaultViewport: { width: device.w, height: device.h, isMobile: !!device.mobile, hasTouch: !!device.mobile },
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--mute-audio', '--single-process',
      '--no-zygote', '--disable-extensions', '--autoplay-policy=no-user-gesture-required'],
  });
  const page = (await browser.pages())[0];
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  let expectErrors = 0;
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    // the test deliberately triggers one 400 (buying your own product) — do not count it
    if (expectErrors > 0 && /status of 40[039]/.test(m.text())) { expectErrors--; return; }
    errors.push(m.text());
  });

  await page.goto(BASE + '/#/login', { waitUntil: 'domcontentloaded' });
  const u = 'ui' + Math.floor(Math.random() * 900000);
  await page.evaluate((name) => fetch('/api/auth/signup', {
    method: 'POST', headers: { 'content-type': 'application/json', 'X-GenZ-Client': '1' },
    body: JSON.stringify({ full_name: 'UI Tester', username: name, email: name + '@test.io', password: 'passw0rd1', dob: '2004-01-01' }),
  }), u);
  await page.evaluate(() => fetch('/api/me/onboarding/complete', { method: 'POST', headers: { 'X-GenZ-Client': '1' } }));
  await page.goto(BASE + '/?t=' + Date.now() + '#/home', { waitUntil: 'domcontentloaded' });
  await sleep(2500);

  // nav entries exist (same design, new destinations)
  const navs = await page.evaluate(() => [...document.querySelectorAll('.rail-nav .nav-item, .tabbar button')].map((a) => a.getAttribute('href') || a.dataset.go));
  ok(navs.some((n) => n === '#/shop'), 'Shop is in the navigation');
  ok(navs.some((n) => n === '#/work'), 'Work is in the navigation');
  ok(navs.some((n) => n === '#/arena'), 'Arena is in the navigation');

  for (const [hash, label, sel] of ROUTES) {
    const before = errors.length;
    await page.evaluate((h) => { window.location.hash = h.slice(1); }, hash);
    await sleep(1400);
    const info = await page.evaluate((s) => ({
      text: document.body.innerText.length,
      found: !!document.querySelector(s),
      h1: (document.querySelector('#view h1') || {}).textContent || '',
    }), sel);
    ok(info.text > 120 && info.found && errors.length === before,
      `${label} renders`, `${info.text} chars · "${info.h1.trim().slice(0, 28)}"`);
  }

  // ---------- real seller flow through the UI ----------
  await page.evaluate(() => { window.location.hash = '/seller'; });
  await sleep(1500);
  await page.type('#st-name', 'UI Test Store');
  await page.type('#st-tag', 'Testing the seller flow');
  await page.click('#st-go');
  await sleep(2000);
  ok(await page.$('#new-product') !== null, 'store created through the UI → seller studio opens');

  await page.click('#new-product');
  await sleep(700);
  await page.type('#pd-title', 'UI Test Hoodie');
  await page.type('#pd-price', '1200');
  await page.type('#pd-stock', '4');
  await page.type('#pd-desc', 'Created by the automated UI test.');
  await page.click('#pd-go');
  await sleep(2200);
  const listed = await page.evaluate(() => document.body.innerText.includes('UI Test Hoodie'));
  ok(listed, 'product published through the composer modal and listed in the studio');

  // buy it as the same-user check (must be blocked), then verify shop shows it
  await page.evaluate(() => { window.location.hash = '/shop'; });
  await sleep(1800);
  const inShop = await page.evaluate(() => document.body.innerText.includes('UI Test Hoodie'));
  ok(inShop, 'new product appears in the public shop grid');

  const cardHref = await page.evaluate(() => {
    const a = [...document.querySelectorAll('.showcase a')].find((x) => x.textContent.includes('UI Test Hoodie'));
    return a ? a.getAttribute('href') : null;
  });
  if (cardHref) {
    await page.evaluate((h) => { window.location.hash = h.slice(1); }, cardHref);
    await sleep(1600);
    ok(await page.$('#add-cart') !== null, 'product detail page opens with buy actions');
    expectErrors = 1;
    await page.click('#add-cart');
    await sleep(1200);
    const msg = await page.evaluate(() => (document.querySelector('#p-err') || {}).textContent || '');
    ok(/own product/i.test(msg), 'buying your own product is blocked with a clear message');
  }

  // ---------- arena interactions ----------
  await page.evaluate(() => { window.location.hash = '/polls'; });
  await sleep(1500);
  await page.click('#new-poll');
  await sleep(600);
  await page.type('#po-q', 'Which hub should we build next?');
  await page.type('#po-o0', 'Photography');
  await page.type('#po-o1', 'Cooking');
  await page.click('#po-go');
  await sleep(2000);
  ok(await page.evaluate(() => document.body.innerText.includes('Which hub should we build next?')), 'poll created and rendered');

  const voted = await page.evaluate(async () => {
    const b = document.querySelector('[data-vote]');
    if (!b) return false;
    b.click();
    await new Promise((r) => setTimeout(r, 1400));
    return /%/.test(document.body.innerText);
  });
  ok(voted, 'voting in a poll shows live percentages');

  await page.evaluate(() => { window.location.hash = '/ideas'; });
  await sleep(1400);
  await page.click('#new-idea');
  await sleep(600);
  await page.type('#id-title', 'A note-swapping app for HSC students');
  await page.type('#id-body', 'Students upload notes and earn credits to unlock others.');
  await page.click('#id-go');
  await sleep(2200);
  ok(await page.evaluate(() => /note-swapping/i.test(document.body.innerText)), 'idea published and opens its detail page');

  await page.evaluate(() => { window.location.hash = '/arena'; });
  await sleep(1600);
  const xp = await page.evaluate(() => {
    const t = document.body.innerText;
    const m = t.match(/Level (\d+)/);
    return { level: m ? m[1] : null, hasMissions: /Daily missions/.test(t), hasRules: /How XP works/.test(t) };
  });
  ok(xp.level && xp.hasMissions && xp.hasRules, 'Arena shows level, daily missions and transparent XP rules', `level ${xp.level}`);

  ok(errors.length === 0, `no console errors across the whole run (${errors.length})`, errors[0] ? errors[0].slice(0, 120) : '');
  await browser.close();
}

(async () => {
  await run({ name: 'desktop', w: 1440, h: 900 });
  await run({ name: 'mobile', w: 390, h: 844, mobile: true });
  const fails = out.filter((x) => !x).length;
  console.log(`\n${out.length - fails}/${out.length} checks passed` + (fails ? ` — ${fails} FAILED` : ' — ALL GOOD'));
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error('ERROR', e); process.exit(1); });
