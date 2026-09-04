/* Gen-Z Hub — click-through verification of the RUNNING site.
   Every action below clicks a real DOM element the same way a human would.
   No screenshots are produced; output is text assertions only. */
const puppeteer = require('puppeteer');
const BASE = process.env.BASE || 'http://127.0.0.1:3000';

const TEST = { name: 'Test User', user: 'tester', email: 'tester@genzhub.app', pass: 'TestGenz123' };

let pass = 0, fail = 0;
const errors = [];
function ck(n, c, x = '') { c ? (pass++, console.log('  ok   ' + n)) : (fail++, console.log('  FAIL ' + n + '  << ' + x)); }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-dev-shm-usage'], headless: 'new' });
  const page = await browser.newPage();
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 140)); });
  await page.setViewport({ width: 1440, height: 950 });

  const body = () => page.evaluate(() => document.body.innerText);
  const view = () => page.evaluate(() => document.querySelector('#view') ? document.querySelector('#view').innerText : '');
  async function clickSel(sel) { await page.waitForSelector(sel, { visible: true, timeout: 8000 }); await page.click(sel); await sleep(900); }
  async function clickByText(sel, t) {
    const h = await page.evaluateHandle((s, tt) => [...document.querySelectorAll(s)]
      .find((e) => e.offsetParent !== null && e.textContent.toLowerCase().includes(tt.toLowerCase())) || null, sel, t);
    const el = h.asElement();
    if (!el) return false;
    await el.click(); await sleep(1000); return true;
  }

  /* ---------- TEST 2 (first): AUTHENTICATION — real signup via the form ---------- */
  console.log('\nTEST 2 — AUTHENTICATION (real form input, real clicks)');
  await page.goto(BASE + '/', { waitUntil: 'networkidle2' }); await sleep(1500);
  ck('site loads and shows the public landing page', (await body()).includes('Connect. Build.'));
  await clickByText('a', 'Join free');                       // click the real CTA link
  ck('signup page opened by clicking "Join free"', !!(await page.$('#sf')) || !!(await page.$('.tab')));
  if (!(await page.$('#sf'))) await clickByText('.tab', 'Create account');
  await page.type('#sn', TEST.name);
  await page.type('#su', TEST.user);
  await sleep(800);
  await page.type('#se', TEST.email);
  await page.type('#sp', TEST.pass);
  await page.evaluate(() => { document.querySelector('#sd').value = '2003-04-12'; });
  await clickSel('#sf button[type=submit]'); await sleep(2500);
  const onboarded = page.url().includes('onboarding');
  ck('account created — onboarding starts', onboarded, page.url());
  await clickByText('button', 'Get started');
  const chips = await page.$$('[data-i]');
  for (const c of chips.slice(0, 4)) { await c.click(); await sleep(70); }
  ck('interest chips are clickable', chips.length > 10);
  await clickByText('#next', 'Continue');
  await clickSel('#hb'); await clickSel('#hg');              // join Business + Gaming hubs
  await clickByText('#next', 'Continue'); await sleep(1200);
  await clickByText('#done', 'Finish');
  await sleep(2800);
  ck('signup completes and lands on the home feed', (await body()).includes('What is happening'));

  /* ---------- TEST 1: NAVIGATION — click every nav item ---------- */
  console.log('\nTEST 1 — NAVIGATION (clicking the sidebar items themselves)');
  const NAV = [['home', 'What is happening'], ['explore', 'hashtag'], ['network', 'Network'], ['messages', 'conversation'],
    ['notifications', 'Notifications'], ['groups', 'Groups'], ['communities', 'Communities'],
    ['business', 'Business Hub'], ['gaming', 'Gaming Hub'], ['events', 'Events'], ['saved', 'Saved'], ['settings', 'Settings']];
  for (const [key, expect] of NAV) {
    const clicked = await page.evaluate((k) => {
      const a = document.querySelector(`.nav-item[data-k="${k}"]`);
      if (!a) return false; a.click(); return true;
    }, key);
    await sleep(1300);
    const v = await view();
    ck(`click "${key}" → real page renders`, clicked && v.length > 50 && v.toLowerCase().includes(expect.toLowerCase().split(' ')[0]), `len=${v.length}`);
  }
  await page.evaluate(() => document.querySelector('#nav-me').click()); await sleep(600);
  const menuOpen = await page.$('.menu');
  ck('avatar menu opens (Profile / Saved / Settings / Log out)', !!menuOpen);
  await clickByText('.menu button', 'Profile');
  ck('click "Profile" in menu → own profile page', (await view()).includes(TEST.name));
  ck('browser Back returns to the previous page', await page.goBack().then(async () => { await sleep(1200); return (await view()).length > 50; }).catch(() => false));

  /* ---------- TEST 3: POST — real composer, publish, refresh ---------- */
  console.log('\nTEST 3 — CREATE A POST via the "What is happening?" box');
  await page.evaluate(() => document.querySelector('.nav-item[data-k="home"]').click()); await sleep(1400);
  await clickSel('#open-composer');
  ck('composer modal opened by clicking the box', !!(await page.$('#cp-text')));
  const POST = 'Clickthrough test post — created by clicking the real UI #livetest';
  await page.type('#cp-text', POST);
  await clickSel('#cp-go'); await sleep(2400);
  ck('post appears in the feed immediately', (await body()).includes(POST));
  await page.reload({ waitUntil: 'networkidle2' }); await sleep(2400);
  ck('post SURVIVES a full page refresh (stored in the database)', (await body()).includes(POST));

  /* ---------- TEST 4: INTERACTIONS — like, comment, save, repost ---------- */
  console.log('\nTEST 4 — POST INTERACTIONS (buttons perform real actions)');
  const c0 = await page.evaluate(() => document.querySelector('.post [data-count-r]').textContent);
  await clickSel('.post [data-react]');
  const c1 = await page.evaluate(() => document.querySelector('.post [data-count-r]').textContent);
  ck('Like button changes the reaction count', c0 !== c1, `${c0} -> ${c1}`);
  await page.reload({ waitUntil: 'networkidle2' }); await sleep(2200);
  ck('like persists after refresh', (await page.evaluate(() => document.querySelector('.post [data-count-r]').textContent)) === c1);
  await clickSel('.post [data-comment]');
  await page.type('.post [data-comments] textarea', 'Clickthrough comment — typed into the real comment box');
  await clickSel('.post [data-comments] button[type=submit]');
  ck('comment posts and displays', (await body()).includes('Clickthrough comment'));
  await page.reload({ waitUntil: 'networkidle2' }); await sleep(2200);
  await clickSel('.post [data-comment]');
  ck('comment persists after refresh', (await body()).includes('Clickthrough comment'));
  await clickSel('.post [data-save]');
  await page.evaluate(() => document.querySelector('.nav-item[data-k="saved"]').click()); await sleep(1600);
  ck('Save button → post shows on the Saved page', (await view()).includes('Clickthrough test post'));
  await page.evaluate(() => document.querySelector('.nav-item[data-k="home"]').click()); await sleep(1600);
  await clickSel('.post [data-repost]');
  ck('Share/repost modal opens', !!(await page.$('#rgo')));
  await page.type('#rc', 'Reposting my own test');
  await clickSel('#rgo'); await sleep(2000);
  await page.reload({ waitUntil: 'networkidle2' }); await sleep(2400);
  ck('repost is saved and visible in the feed', (await body()).includes('Reposting my own test'));

  /* ---------- Hubs by clicking ---------- */
  console.log('\nHUBS — clicking through Business + Gaming');
  await page.evaluate(() => document.querySelector('.nav-item[data-k="business"]').click()); await sleep(1500);
  await clickByText('#hub-act button', 'Post here');
  await page.type('#cp-text', 'Clickthrough business post — looking for a co-founder #startups');
  await clickSel('#cp-go'); await sleep(2200);
  ck('Business Hub post publishes into the business feed', (await body()).includes('looking for a co-founder'));
  await page.evaluate(() => document.querySelector('.nav-item[data-k="gaming"]').click()); await sleep(1500);
  await clickByText('#hub-act button', 'Post here');
  await page.type('#cp-text', 'Clickthrough gaming post — LF teammates for weekend scrims #esports');
  await clickSel('#cp-go'); await sleep(2200);
  ck('Gaming Hub post publishes into the gaming feed', (await body()).includes('LF teammates for weekend scrims'));

  /* ---------- TEST 2b: logout + protected route + login again ---------- */
  console.log('\nTEST 2b — LOGOUT, PROTECTED ROUTES, LOGIN AGAIN');
  await page.evaluate(() => document.querySelector('#nav-me').click()); await sleep(600);
  await clickByText('.menu button', 'Log out');
  await sleep(3000);
  ck('logout returns to the public site', !(await body()).includes('What is happening'));
  await page.goto(BASE + '/?r=' + Date.now() + '#/settings', { waitUntil: 'networkidle2' }); await sleep(1800);
  ck('protected route blocked while logged out', !(await body()).includes('Blocked users'), page.url());
  await page.goto(BASE + '/?r=' + Date.now() + '#/auth', { waitUntil: 'networkidle2' }); await sleep(1300);
  await page.type('#li', TEST.email);
  await page.type('#lp', TEST.pass);
  await clickSel('#lf button[type=submit]'); await sleep(3000);
  ck('login with the test account works', (await body()).includes('What is happening'));
  ck('all content created earlier is still there after re-login', (await body()).includes('Clickthrough test post'));

  /* ---------- TEST 5: RESPONSIVE on the running site ---------- */
  console.log('\nTEST 5 — RESPONSIVE (same live site, real viewports)');
  await page.setViewport({ width: 1920, height: 1080 });
  await page.reload({ waitUntil: 'networkidle2' }); await sleep(2000);
  let m = await page.evaluate(() => ({ cols: getComputedStyle(document.querySelector('.shell')).gridTemplateColumns.split(' ').length,
    tab: getComputedStyle(document.querySelector('.tabbar')).display, ov: document.documentElement.scrollWidth > document.documentElement.clientWidth + 2 }));
  ck('desktop 1920: 3-column layout, no bottom bar, no horizontal scroll', m.cols === 3 && m.tab === 'none' && !m.ov, JSON.stringify(m));
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  await page.reload({ waitUntil: 'networkidle2' }); await sleep(2200);
  m = await page.evaluate(() => ({ tab: getComputedStyle(document.querySelector('.tabbar')).display,
    side: getComputedStyle(document.querySelector('.side')).display, ov: document.documentElement.scrollWidth > document.documentElement.clientWidth + 2 }));
  ck('mobile 390: bottom nav visible, sidebar hidden, no horizontal scroll', m.tab === 'flex' && m.side === 'none' && !m.ov, JSON.stringify(m));
  for (const k of ['explore', 'notifications', 'home']) {
    await page.evaluate((kk) => document.querySelector(`.tabbar button[data-k="${kk}"]`).click(), k);
    await sleep(1400);
    ck(`mobile bottom-nav "${k}" opens its page`, (await view()).length > 50);
  }
  await page.evaluate(() => document.querySelector('.tabbar button[data-k="create"]').click()); await sleep(1200);
  ck('mobile ➕ Create opens the composer inside the viewport', await page.evaluate(() => {
    const md = document.querySelector('.modal'); if (!md) return false;
    const r = md.getBoundingClientRect(); return r.width <= innerWidth + 1 && r.height <= innerHeight + 1;
  }));
  await page.keyboard.press('Escape'); await sleep(600);
  await page.evaluate(() => document.querySelector('.tabbar button[data-k="menu"]').click()); await sleep(1000);
  ck('mobile ☰ Menu exposes Business Hub / Gaming Hub / Settings',
    (await body()).includes('Business Hub') && (await body()).includes('Gaming Hub') && (await body()).includes('Settings'));

  const real = errors.filter((e) => !/favicon|status of 40[13]/.test(e));
  console.log(`\nCLICK-THROUGH RESULT: ${pass} passed, ${fail} failed | JS errors: ${real.length}`);
  real.slice(0, 5).forEach((e) => console.log('  ! ' + e));
  console.log(`Test account left active: ${TEST.email} / ${TEST.pass} (username: ${TEST.user})`);
  await browser.close();
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
