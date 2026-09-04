/* Tests the PUBLIC internet URL in a clean browser profile (no sandbox cookies/tokens). */
const puppeteer = require('puppeteer');
const URL = process.argv[2];
let pass = 0, fail = 0; const errs = [];
const ck = (n, c, x = '') => c ? (pass++, console.log('  ok   ' + n)) : (fail++, console.log('  FAIL ' + n + '  << ' + x));
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const b = await puppeteer.launch({ args: ['--no-sandbox', '--disable-dev-shm-usage', '--incognito'], headless: 'new' });
  const ctx = await b.createBrowserContext();           // clean session, no shared storage
  const p = await ctx.newPage();
  p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 120)); });
  const body = () => p.evaluate(() => document.body.innerText);
  await p.setViewport({ width: 1440, height: 900 });

  await p.goto(URL, { waitUntil: 'networkidle2', timeout: 60000 }); await sleep(2000);
  const t = await body();
  ck('1. landing page loads on the public URL', t.includes('Connect. Build.'), t.slice(0, 80));
  ck('   no "Sandbox Not Found" / error page', !/sandbox not found|not found|403|forbidden/i.test(t.slice(0, 200)));

  const u = 'pub' + Math.floor(Math.random() * 90000);
  await p.goto(URL + '/#/auth?mode=signup', { waitUntil: 'networkidle2' }); await sleep(1500);
  const tabs = await p.$$('.tab'); if (tabs[1]) { await tabs[1].click(); await sleep(700); }
  await p.type('#sn', 'Public Tester'); await p.type('#su', u);
  await p.type('#se', u + '@publictest.app'); await p.type('#sp', 'PublicPass123');
  await p.evaluate(() => { document.querySelector('#sd').value = '2003-01-01'; });
  await p.click('#sf button[type=submit]'); await sleep(3000);
  ck('2. signup works over the public URL', p.url().includes('onboarding'), p.url());
  const go = async (sel) => { const h = await p.evaluateHandle(s => [...document.querySelectorAll('button')].find(x => x.offsetParent && x.textContent.includes(s)), sel); if (h.asElement()) { await h.asElement().click(); await sleep(900);} };
  await go('Get started'); const chips = await p.$$('[data-i]'); for (const c of chips.slice(0, 3)) { await c.click(); await sleep(60); }
  await go('Continue'); await p.click('#hb'); await sleep(200); await go('Continue'); await sleep(1000); await go('Finish');
  await sleep(3000);
  ck('4. home feed loads after onboarding', (await body()).includes('What is happening'));

  const NAV = ['explore', 'messages', 'groups', 'communities', 'business', 'gaming', 'settings'];
  let navOk = true;
  for (const k of NAV) {
    await p.evaluate(kk => document.querySelector(`.nav-item[data-k="${kk}"]`).click(), k); await sleep(1200);
    const len = await p.evaluate(() => document.querySelector('#view').innerText.length);
    if (len < 50) { navOk = false; console.log('     nav problem:', k); }
  }
  ck('5. navigation works (7 sections opened)', navOk);

  await p.evaluate(() => document.querySelector('.nav-item[data-k="home"]').click()); await sleep(1400);
  await p.click('#open-composer'); await sleep(900);
  const POST = 'Public URL test post ' + Date.now();
  await p.type('#cp-text', POST); await p.click('#cp-go'); await sleep(2500);
  ck('6. create post works over the public URL', (await body()).includes(POST));
  await p.reload({ waitUntil: 'networkidle2' }); await sleep(2500);
  ck('7. refresh keeps the app working and the post persists', (await body()).includes(POST) && (await body()).includes('What is happening'));

  await p.evaluate(() => document.querySelector('.post [data-react]').click()); await sleep(1200);
  ck('   like button works over the public URL', await p.evaluate(() => document.querySelector('.post [data-react]').classList.contains('on')));

  // logout + login again through the public URL
  await p.evaluate(async () => { await window.GZ.post('/auth/logout'); });
  await p.goto(URL + '/?r=' + Date.now() + '#/auth', { waitUntil: 'networkidle2' }); await sleep(1500);
  await p.type('#li', u + '@publictest.app'); await p.type('#lp', 'PublicPass123');
  await p.click('#lf button[type=submit]'); await sleep(3000);
  ck('3. login works over the public URL', (await body()).includes('What is happening'));

  await p.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  await p.reload({ waitUntil: 'networkidle2' }); await sleep(2500);
  const m = await p.evaluate(() => ({ tab: getComputedStyle(document.querySelector('.tabbar')).display,
    ov: document.documentElement.scrollWidth > document.documentElement.clientWidth + 2 }));
  ck('8. mobile layout works (bottom nav, no horizontal scroll)', m.tab === 'flex' && !m.ov, JSON.stringify(m));
  await p.evaluate(() => document.querySelector('.tabbar button[data-k="explore"]').click()); await sleep(1500);
  ck('   mobile bottom-nav button opens a page', (await p.evaluate(() => document.querySelector('#view').innerText.length)) > 50);

  const real = errs.filter(e => !/favicon|status of 40[13]/.test(e));
  console.log(`\nPUBLIC URL RESULT: ${pass} passed, ${fail} failed | JS errors: ${real.length}`);
  real.slice(0, 5).forEach(e => console.log('  ! ' + e));
  console.log('public test account: ' + u + '@publictest.app / PublicPass123');
  await b.close(); process.exit(fail ? 1 : 0);
})().catch(e => { console.error('FATAL', e.message); process.exit(1); });
