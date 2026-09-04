/* Gen-Z Hub — real browser E2E + responsive suite (Chromium via puppeteer) */
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const BASE = process.env.BASE || 'http://127.0.0.1:3000';
const SHOTS = path.join(__dirname, 'screenshots');
fs.mkdirSync(SHOTS, { recursive: true });

const results = [];
const consoleErrors = [];
let browser, page;

function ck(name, cond, extra = '') {
  results.push({ name, ok: !!cond, extra });
  console.log(`  ${cond ? 'ok  ' : 'FAIL'} ${name}${cond ? '' : '  << ' + extra}`);
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const txt = () => page.evaluate(() => document.body.innerText);
const hasText = async (s) => (await txt()).includes(s);

async function go(hash) {
  await page.evaluate((h) => { window.location.hash = h; }, hash);
  await sleep(700);
}
async function shot(name) { await page.screenshot({ path: path.join(SHOTS, name + '.png'), fullPage: false }); }

async function clickText(selector, text) {
  const handle = await page.evaluateHandle((sel, t) => {
    const els = [...document.querySelectorAll(sel)];
    return els.find((e) => e.textContent.trim().toLowerCase().includes(t.toLowerCase())) || null;
  }, selector, text);
  const el = handle.asElement();
  if (!el) return false;
  await el.click();
  await sleep(600);
  return true;
}

async function overflowCheck(label) {
  const r = await page.evaluate(() => ({
    scrollW: document.documentElement.scrollWidth,
    clientW: document.documentElement.clientWidth,
    offenders: [...document.querySelectorAll('body *')]
      .filter((e) => e.getBoundingClientRect().right > document.documentElement.clientWidth + 2)
      .slice(0, 3).map((e) => e.tagName + '.' + (e.className || '').toString().slice(0, 40)),
  }));
  ck(`no horizontal overflow — ${label}`, r.scrollW <= r.clientW + 2, `scrollW=${r.scrollW} clientW=${r.clientW} ${r.offenders.join(' | ')}`);
}

(async () => {
  browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-dev-shm-usage'], headless: 'new' });
  page = await browser.newPage();
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
  page.on('pageerror', (e) => consoleErrors.push('pageerror: ' + e.message));

  const USER = 'browser_' + Math.floor(Math.random() * 100000);
  const EMAIL = USER + '@test.genzhub.app';
  const PASS = 'TestPass123';

  /* ============ 1. PUBLIC SITE + RESPONSIVE ============ */
  console.log('\n== PUBLIC SITE & RESPONSIVE ==');
  const VIEWPORTS = [['desktop-1920', 1920, 1080], ['desktop-1366', 1366, 768], ['tablet-768', 768, 1024], ['mobile-390', 390, 844], ['mobile-375', 375, 667]];
  for (const [label, w, h] of VIEWPORTS) {
    await page.setViewport({ width: w, height: h, isMobile: w < 800, hasTouch: w < 800 });
    await page.goto(BASE + '/#/welcome', { waitUntil: 'networkidle2' });
    await sleep(700);
    ck(`landing renders — ${label}`, await hasText('Connect. Build.'));
    await overflowCheck('landing ' + label);
    await shot('01-landing-' + label);
  }
  await page.setViewport({ width: 1366, height: 900 });
  await page.goto(BASE + '/#/welcome', { waitUntil: 'networkidle2' }); await sleep(500);
  ck('landing has signup CTA', !!(await page.$('a[href="#/auth?mode=signup"]')));
  for (const p of ['about', 'privacy', 'terms', 'guidelines', 'contact']) {
    await go('#/' + p);
    ck('public page /' + p, (await txt()).length > 700);
  }
  await go('#/');
  ck('guest redirected from app to auth', page.url().includes('#/auth'), page.url());

  /* ============ 2. SIGNUP THROUGH THE UI ============ */
  console.log('\n== SIGNUP / ONBOARDING ==');
  await page.goto(BASE + '/#/auth?mode=signup', { waitUntil: 'networkidle2' }); await sleep(600);
  await clickText('.tab', 'Create account');
  await page.type('#sn', 'Browser Tester');
  await page.type('#su', USER);
  await sleep(600);
  ck('live username availability check', (await txt()).includes('Available') || (await txt()).includes('✅'));
  await page.type('#se', EMAIL);
  await page.type('#sp', PASS);
  await page.evaluate(() => { document.querySelector('#sd').value = '2004-03-15'; });
  await Promise.all([page.click('#sf button[type=submit]'), sleep(2500)]);
  ck('signup succeeds and lands on onboarding', page.url().includes('onboarding'), page.url());
  await shot('02-onboarding');
  await clickText('button', 'Get started');
  const chips = await page.$$('[data-i]');
  for (const c of chips.slice(0, 4)) { await c.click(); await sleep(80); }
  ck('interest chips selectable', chips.length > 10);
  await clickText('#next', 'Continue');
  await sleep(500);
  await page.click('#hb'); await sleep(300);   // Business Hub
  await page.click('#hg'); await sleep(300);   // Gaming Hub
  await clickText('#next', 'Continue');
  await sleep(1200);
  ck('onboarding step 4 shows suggestions', await hasText('People & communities'));
  await clickText('#done', 'Finish');
  await sleep(2500);
  ck('lands on home feed after onboarding', await hasText('What is happening'), page.url());
  await shot('03-home-feed');

  /* ============ 3. POSTS ============ */
  console.log('\n== POSTS ==');
  await page.click('#open-composer'); await sleep(600);
  ck('composer opens', !!(await page.$('#cp-text')));
  const POST_TEXT = 'E2E text post from the browser suite #e2etest';
  await page.type('#cp-text', POST_TEXT);
  await shot('04-composer');
  await page.click('#cp-go'); await sleep(2000);
  ck('text post appears in feed', await hasText(POST_TEXT));

  // image post
  const imgPath = path.join(__dirname, 'screenshots', '_fixture.png');
  fs.writeFileSync(imgPath, Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAGQAAABkCAIAAAD/gAIDAAAAaklEQVR42u3QMQEAAAgDoC251a3gLg6QgLtGxYoVK1asWLFixYoVK1asWLFixYoVK1asWLFixYoVK1asWLFixYoVK1asWLFixYoVK1asWLFixYoVK1asWLFixYoVK1asWLFixYoVK/YfWyIAAV/AtVUAAAAASUVORK5CYII=', 'base64'));
  await page.click('#open-composer'); await sleep(500);
  await page.type('#cp-text', 'E2E image post with attachment');
  const fileInput = await page.$('#cp-file');
  await fileInput.uploadFile(imgPath);
  await sleep(2500);
  ck('image preview shown before publishing', (await page.$$('#cp-preview img')).length === 1);
  await page.click('#cp-go'); await sleep(2200);
  const imgInFeed = await page.evaluate(() => !!document.querySelector('.post .media-grid img'));
  ck('image post renders in feed', imgInFeed);
  await shot('05-feed-with-image');

  // react
  const before = await page.evaluate(() => document.querySelector('.post [data-count-r]').textContent);
  await page.click('.post [data-react]'); await sleep(1200);
  const after = await page.evaluate(() => document.querySelector('.post [data-count-r]').textContent);
  ck('reaction increments count', before !== after, `${before} -> ${after}`);
  await page.click('.post [data-react]'); await sleep(900);
  ck('reaction toggles off', (await page.evaluate(() => document.querySelector('.post [data-count-r]').textContent)) === before);

  // comment
  await page.click('.post [data-comment]'); await sleep(1200);
  await page.type('.post [data-comments] textarea', 'E2E comment from the browser');
  await page.click('.post [data-comments] button[type=submit]'); await sleep(1500);
  ck('comment saves and displays', await hasText('E2E comment from the browser'));
  const replyClicked = await clickText('.post [data-comments] [data-reply]', 'Reply');
  if (replyClicked) {
    await page.type('.post [data-replies] textarea', 'E2E reply');
    await page.click('.post [data-replies] button[type=submit]'); await sleep(1400);
  }
  ck('threaded reply saves', await hasText('E2E reply'));
  await shot('06-comments');

  // save
  await page.click('.post [data-save]'); await sleep(1000);
  await go('#/saved');
  ck('saved post appears on Saved page', await hasText('E2E image post') || await hasText(POST_TEXT));
  await shot('07-saved');

  // edit + delete own post
  await go('#/');
  await page.click('.post [data-menu]'); await sleep(400);
  await clickText('.menu button', 'Edit post');
  await sleep(600);
  await page.evaluate(() => { document.querySelector('#ep').value = 'E2E post EDITED by the browser suite'; });
  await page.click('#epsave'); await sleep(1500);
  ck('post edit persists', await hasText('E2E post EDITED'));
  await page.click('.post [data-menu]'); await sleep(400);
  await clickText('.menu button', 'Delete post');
  await sleep(500);
  await clickText('[data-yes]', 'Delete');
  await sleep(1500);
  ck('post delete removes it from feed', !(await hasText('E2E post EDITED')));

  /* ============ 4. PROFILE ============ */
  console.log('\n== PROFILE ==');
  await go('#/u/' + USER);
  ck('own profile opens', await hasText('Browser Tester'));
  await clickText('#prof-actions button', 'Edit profile');
  await sleep(700);
  await page.type('#e-bio', 'Testing Gen-Z Hub end to end. Founder + gamer.');
  await page.type('#e-loc', 'Dhaka, BD');
  await (await page.$('#e-av')).uploadFile(imgPath);
  await (await page.$('#e-cv')).uploadFile(imgPath);
  await page.click('#e-save'); await sleep(3500);
  await page.goto(BASE + '/#/u/' + USER, { waitUntil: 'networkidle2' }); await sleep(1500);
  ck('profile bio persists after reload', await hasText('Testing Gen-Z Hub end to end'));
  ck('profile location persists', await hasText('Dhaka, BD'));
  ck('avatar image uploaded', await page.evaluate(() => !!document.querySelector('.prof-av img')));
  await shot('08-profile');
  for (const t of ['about', 'media', 'groups', 'communities']) {
    await go(`#/u/${USER}?tab=${t}`);
    ck('profile tab ' + t, (await txt()).length > 200);
  }

  /* ============ 5. SOCIAL GRAPH ============ */
  console.log('\n== FOLLOW / CONNECT ==');
  await go('#/u/rafi');
  ck('other profile opens', await hasText('Rafi Ahmed'));
  await clickText('#prof-actions button', 'Follow');
  await sleep(1200);
  ck('follow state updates', await hasText('Following'));
  await clickText('#prof-actions button', 'Connect');
  await sleep(1400);
  await go('#/network?tab=outgoing');
  ck('connection request appears in Sent', await hasText('Rafi Ahmed'));
  await go('#/network?tab=suggested');
  ck('suggested people load', (await page.$$('.card')).length > 1);
  await shot('09-network');

  /* ============ 6. MESSAGING ============ */
  console.log('\n== MESSAGING ==');
  await go('#/u/rafi');
  const msgBtn = await page.evaluateHandle(() => [...document.querySelectorAll('#prof-actions button')].find((b) => b.textContent.includes('💬')));
  await msgBtn.asElement().click();
  await sleep(2000);
  ck('conversation opens from profile', page.url().includes('#/messages/'), page.url());
  await page.type('#cmsg', 'Hello Rafi — this is an automated E2E message.');
  await page.click('#cform button[type=submit]'); await sleep(1600);
  ck('message sends and renders', await hasText('automated E2E message'));
  await go('#/messages');
  ck('inbox lists the conversation', await hasText('Rafi Ahmed'));
  await shot('10-messages');

  /* ============ 7. BUSINESS HUB ============ */
  console.log('\n== BUSINESS HUB ==');
  await go('#/business');
  ck('business hub opens', await hasText('Business Hub'));
  ck('joined state shown (from onboarding)', await hasText('Leave hub'));
  await clickText('#hub-act button', 'Post here');
  await sleep(800);
  await page.type('#cp-text', 'E2E business post: shipped our first paying customer #startups');
  await page.click('#cp-go'); await sleep(2200);
  ck('business post publishes into business feed', await hasText('E2E business post'));
  await go('#/business?tab=collab');
  await clickText('#newcollab', 'Post a collaboration');
  await sleep(800);
  await page.type('#cp-text', 'Looking for a developer to build an MVP with me. Equity split.');
  await page.click('#cp-go'); await sleep(2200);
  ck('collaboration post publishes', await hasText('Looking for a developer'));
  await go('#/business?tab=people');
  ck('discover business people', (await txt()).length > 300);
  await go('#/business?tab=communities');
  ck('business communities list', await hasText('Entrepreneurs') || await hasText('Founders'));
  await shot('11-business-hub');
  await go('#/business?tab=feed&topic=Startups');
  ck('business topic filter works', await hasText('Startups'));

  /* ============ 8. GAMING HUB ============ */
  console.log('\n== GAMING HUB ==');
  await go('#/gaming');
  ck('gaming hub opens', await hasText('Gaming Hub'));
  await clickText('#hub-act button', 'Post here');
  await sleep(800);
  await page.type('#cp-text', 'E2E gaming post: ranked grind finished for the week #esports');
  await page.click('#cp-go'); await sleep(2200);
  ck('gaming post publishes', await hasText('E2E gaming post'));
  await go('#/gaming?tab=teams');
  await clickText('#newteam', 'Find teammates');
  await sleep(800);
  await page.type('#cp-text', 'LF teammates: need a controller main for weekend scrims.');
  await page.click('#cp-go'); await sleep(2200);
  ck('team recruitment post publishes', await hasText('LF teammates'));
  await go('#/gaming?tab=games');
  const gchips = await page.$$('[data-g]');
  await gchips[0].click(); await gchips[1].click();
  await page.click('#g-save'); await sleep(1500);
  await page.goto(BASE + '/#/gaming?tab=games', { waitUntil: 'networkidle2' }); await sleep(1500);
  ck('favourite games persist', await page.evaluate(() => document.querySelectorAll('[data-g].on').length >= 2));
  await shot('12-gaming-hub');

  /* ============ 9. GROUPS & COMMUNITIES ============ */
  console.log('\n== GROUPS & COMMUNITIES ==');
  await go('#/groups');
  await page.click('#newg'); await sleep(700);
  await page.type('#g-n', 'E2E Test Group');
  await page.type('#g-d', 'Group created by the automated browser suite.');
  await page.type('#g-c', 'Testing');
  await page.type('#g-r', '1. Be nice. 2. No spam.');
  await page.click('#g-go'); await sleep(2500);
  ck('group created and opened', await hasText('E2E Test Group'), page.url());
  await clickText('#gact button', 'Post');
  await sleep(800);
  await page.type('#cp-text', 'First post inside the E2E group.');
  await page.click('#cp-go'); await sleep(2200);
  ck('group post publishes to group feed', await hasText('First post inside the E2E group'));
  const gid = page.url().split('/group/')[1].split('?')[0];
  await go(`#/group/${gid}?tab=members`);
  ck('group members list shows owner', await hasText('Browser Tester'));
  await go(`#/group/${gid}?tab=manage`);
  ck('owner sees manage tab', await hasText('Join requests'));
  await shot('13-group');
  await go('#/communities');
  ck('communities list loads', await hasText('Community') || await hasText('members'));
  const joinBtn = await page.evaluateHandle(() => [...document.querySelectorAll('[data-join]')].find((b) => b.textContent.trim() === 'Join'));
  if (joinBtn.asElement()) { await joinBtn.asElement().click(); await sleep(1400); }
  ck('community join toggles to Leave', await page.evaluate(() => [...document.querySelectorAll('[data-join]')].some((b) => b.textContent.trim() === 'Leave')));
  await shot('14-communities');

  /* ============ 10. EVENTS ============ */
  console.log('\n== EVENTS ==');
  await go('#/events');
  await page.click('#newe'); await sleep(700);
  await page.type('#ev-t', 'E2E Founders Meetup');
  await page.type('#ev-d', 'Automated test event.');
  await page.evaluate(() => { document.querySelector('#ev-dt').value = '2027-01-15T18:30'; });
  await page.click('#ev-go'); await sleep(2500);
  ck('event created and opened', await hasText('E2E Founders Meetup'), page.url());
  await clickText('[data-rsvp]', 'Interested');
  await sleep(1400);
  ck('RSVP recorded', await hasText('interested'));
  await shot('15-event');

  /* ============ 11. NOTIFICATIONS / EXPLORE / SETTINGS ============ */
  console.log('\n== NOTIFICATIONS, EXPLORE, SETTINGS ==');
  await go('#/notifications');
  ck('notifications page loads', (await txt()).includes('Notifications'));
  await go('#/explore');
  ck('explore discover loads', await hasText('Popular hashtags') || await hasText('suggested people'));
  await page.type('#eq', 'rafi');
  await page.click('#ef button'); await sleep(1800);
  ck('search returns people results', await hasText('Rafi'));
  await shot('16-explore');
  await go('#/settings?tab=appearance');
  await clickText('[data-th]', 'Dark');
  await sleep(1500);
  ck('dark theme applies', (await page.evaluate(() => document.documentElement.dataset.theme)) === 'dark');
  await shot('17-settings-dark');
  await clickText('[data-th]', 'Light'); await sleep(1200);
  await go('#/settings?tab=language');
  await clickText('[data-lg]', 'বাংলা');
  await sleep(2500);
  ck('bangla language switches nav labels', await hasText('হোম') || await hasText('সেটিংস'));
  await shot('18-bangla');
  await go('#/settings?tab=language');
  await clickText('[data-lg]', 'English'); await sleep(2500);
  await go('#/settings?tab=privacy');
  ck('privacy settings render', await hasText('Profile visibility'));

  /* ============ 12. ADMIN PROTECTION ============ */
  console.log('\n== ADMIN ROLE PROTECTION ==');
  await go('#/admin');
  ck('non-admin blocked from admin panel', await hasText('Admin access required'));

  /* ============ 13. LOGOUT / LOGIN ============ */
  console.log('\n== LOGOUT / LOGIN ==');
  await page.evaluate(async () => { await window.GZ.post('/auth/logout'); });
  await page.goto(BASE + '/?r=' + Date.now() + '#/', { waitUntil: 'networkidle2' }); await sleep(1800);
  ck('after logout protected route redirects', page.url().includes('#/auth') || page.url().includes('#/welcome'), page.url());
  await go('#/messages'); await sleep(800);
  ck('logged-out user cannot open messages', !(await page.$('#cform')) , page.url());
  await page.goto(BASE + '/?r=' + Date.now() + '#/auth', { waitUntil: 'networkidle2' }); await sleep(1400);
  await page.type('#li', EMAIL);
  await page.type('#lp', PASS);
  await Promise.all([page.click('#lf button[type=submit]'), sleep(3000)]);
  ck('login with created account works', await hasText('What is happening'), page.url());

  /* ============ 14. MOBILE UX ============ */
  console.log('\n== MOBILE LAYOUT (390px) ==');
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  await page.goto(BASE + '/#/', { waitUntil: 'networkidle2' }); await sleep(1500);
  ck('bottom tab bar visible on mobile', await page.evaluate(() => {
    const t = document.querySelector('.tabbar'); return t && getComputedStyle(t).display !== 'none';
  }));
  ck('desktop sidebar hidden on mobile', await page.evaluate(() => {
    const s = document.querySelector('.side'); return s && getComputedStyle(s).display === 'none';
  }));
  await overflowCheck('mobile home');
  await shot('19-mobile-home');
  await page.evaluate(() => [...document.querySelectorAll('.tabbar button')].find((b) => b.dataset.k === 'create').click());
  await sleep(900);
  const modalFits = await page.evaluate(() => {
    const m = document.querySelector('.modal');
    if (!m) return false;
    const r = m.getBoundingClientRect();
    return r.width <= window.innerWidth + 1 && r.height <= window.innerHeight + 1;
  });
  ck('mobile composer modal fits viewport', modalFits);
  await shot('20-mobile-composer');
  await page.keyboard.press('Escape'); await sleep(500);
  await go('#/messages');
  await sleep(1200);
  const convo = await page.$('.conv');
  if (convo) { await convo.click(); await sleep(1800); }
  ck('mobile chat opens full screen', await page.evaluate(() => {
    const cl = document.querySelector('.conv-list');
    return !cl || getComputedStyle(cl).display === 'none';
  }));
  await overflowCheck('mobile chat');
  await shot('21-mobile-chat');
  await page.evaluate(() => [...document.querySelectorAll('.tabbar button')].find((b) => b.dataset.k === 'menu').click());
  await sleep(800);
  ck('mobile menu sheet opens with all nav links', await hasText('Business Hub') && await hasText('Gaming Hub'));
  await shot('22-mobile-menu');
  await page.keyboard.press('Escape');
  for (const [hash, label] of [['#/business', 'mobile business'], ['#/gaming', 'mobile gaming'], ['#/explore', 'mobile explore'], ['#/u/rafi', 'mobile profile'], ['#/groups', 'mobile groups'], ['#/settings', 'mobile settings']]) {
    await go(hash); await overflowCheck(label);
  }
  await shot('23-mobile-business');

  /* ============ 15. TABLET ============ */
  console.log('\n== TABLET LAYOUT (768px) ==');
  await page.setViewport({ width: 768, height: 1024 });
  for (const hash of ['#/', '#/business', '#/messages', '#/groups', '#/admin']) {
    await go(hash); await overflowCheck('tablet ' + hash);
  }
  await shot('24-tablet-home');

  /* ============ 16. ADMIN PANEL AS ADMIN ============ */
  console.log('\n== ADMIN PANEL ==');
  await page.setViewport({ width: 1366, height: 900 });
  await page.evaluate(async () => { await window.GZ.post('/auth/logout'); });
  await page.goto(BASE + '/?r=' + Date.now() + '#/auth', { waitUntil: 'networkidle2' }); await sleep(1400);
  await page.type('#li', 'admin@genzhub.app');
  await page.type('#lp', 'AdminGenz2026');
  await Promise.all([page.click('#lf button[type=submit]'), sleep(3000)]);
  await go('#/admin');
  ck('admin dashboard loads with stats', await hasText('Total users'));
  await shot('25-admin-dashboard');
  for (const t of ['users', 'posts', 'comments', 'groups', 'communities', 'reports', 'events', 'moderation', 'settings']) {
    await go('#/admin?tab=' + t);
    ck('admin tab ' + t, (await txt()).length > 300);
  }
  ck('admin never exposes passwords', !(await txt()).toLowerCase().includes('password_hash'));
  await go('#/admin?tab=users');
  await shot('26-admin-users');

  /* ============ RESULT ============ */
  const failed = results.filter((r) => !r.ok);
  const realErrors = consoleErrors.filter((e) => !/favicon|manifest|Failed to load resource: the server responded with a status of 40[13]/.test(e));
  console.log(`\nBROWSER RESULT: ${results.length - failed.length}/${results.length} checks passed`);
  console.log(`Console errors: ${realErrors.length}`);
  realErrors.slice(0, 8).forEach((e) => console.log('  ! ' + e));
  failed.forEach((f) => console.log('  FAILED: ' + f.name + ' — ' + f.extra));
  console.log(`Screenshots: ${SHOTS}`);
  await browser.close();
  process.exit(failed.length ? 1 : 0);
})().catch(async (e) => {
  console.error('FATAL', e);
  try { await page.screenshot({ path: path.join(SHOTS, 'fatal.png') }); await browser.close(); } catch (x) {}
  process.exit(1);
});
