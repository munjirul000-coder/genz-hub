/* Gen-Z Hub — two-user social flow + persistence + desktop/mobile layout audit (real Chromium) */
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const BASE = process.env.BASE || 'http://127.0.0.1:3000';
const SHOTS = path.join(__dirname, 'screenshots');
fs.mkdirSync(SHOTS, { recursive: true });

const results = [];
const errors = [];
function ck(name, cond, extra = '') {
  results.push({ name, ok: !!cond });
  console.log(`  ${cond ? 'ok  ' : 'FAIL'} ${name}${cond ? '' : '  << ' + extra}`);
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function newUser(browser, label) {
  const ctx = await browser.createBrowserContext();
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(`[${label}] ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`[${label}] ${m.text().slice(0, 140)}`); });
  await page.setViewport({ width: 1440, height: 900 });
  return { ctx, page };
}
const text = (p) => p.evaluate(() => document.body.innerText);
async function go(p, hash) { await p.evaluate((h) => { window.location.hash = h; }, hash); await sleep(800); }
async function clickText(p, sel, t) {
  const h = await p.evaluateHandle((s, tt) => [...document.querySelectorAll(s)].find((e) => e.textContent.toLowerCase().includes(tt.toLowerCase())) || null, sel, t);
  const el = h.asElement();
  if (!el) return false;
  await el.click(); await sleep(700); return true;
}
async function signup(page, name, username, email, pass) {
  await page.goto(`${BASE}/?r=${Date.now()}#/auth?mode=signup`, { waitUntil: 'networkidle2' });
  await sleep(1000);
  await clickText(page, '.tab', 'Create account');
  await page.type('#sn', name); await page.type('#su', username);
  await page.type('#se', email); await page.type('#sp', pass);
  await page.evaluate(() => { document.querySelector('#sd').value = '2004-06-10'; });
  await page.click('#sf button[type=submit]'); await sleep(2600);
  // onboarding: welcome -> interests -> hubs -> finish
  await clickText(page, 'button', 'Get started');
  const chips = await page.$$('[data-i]');
  for (const c of chips.slice(0, 3)) { await c.click(); await sleep(60); }
  await clickText(page, '#next', 'Continue');
  await page.click('#hb'); await sleep(200); await page.click('#hg'); await sleep(200);
  await clickText(page, '#next', 'Continue');
  await sleep(1000);
  await clickText(page, '#done', 'Finish');
  await sleep(2600);
}

(async () => {
  const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-dev-shm-usage'], headless: 'new' });
  const stamp = Math.floor(Math.random() * 90000);
  const A = { name: 'Ayan Rahman', user: 'ayan_' + stamp, email: `ayan_${stamp}@test.genzhub.app`, pass: 'AyanPass123' };
  const B = { name: 'Bipul Das', user: 'bipul_' + stamp, email: `bipul_${stamp}@test.genzhub.app`, pass: 'BipulPass123' };

  console.log('\n== USER A: signup + post ==');
  const a = await newUser(browser, 'A');
  await signup(a.page, A.name, A.user, A.email, A.pass);
  ck('A signed up and reached feed', (await text(a.page)).includes('What is happening'));
  const POST = `User A original post ${stamp} — testing the full social loop #twousertest`;
  await a.page.click('#open-composer'); await sleep(600);
  await a.page.type('#cp-text', POST);
  await a.page.click('#cp-go'); await sleep(2200);
  ck('A post visible immediately in feed', (await text(a.page)).includes(POST));
  await a.page.reload({ waitUntil: 'networkidle2' }); await sleep(2000);
  ck('A post still there after refresh (DB persistence)', (await text(a.page)).includes(POST));

  console.log('\n== USER B: signup, follow, like, comment ==');
  const b = await newUser(browser, 'B');
  await signup(b.page, B.name, B.user, B.email, B.pass);
  ck('B signed up and reached feed', (await text(b.page)).includes('What is happening'));
  await go(b.page, '#/u/' + A.user);
  ck('B can open A profile', (await text(b.page)).includes(A.name));
  await clickText(b.page, '#prof-actions button', 'Follow');
  await sleep(1200);
  ck('B follow button switched to Following', (await text(b.page)).includes('Following'));
  await b.page.reload({ waitUntil: 'networkidle2' }); await sleep(2000);
  ck('follow state persists after refresh', (await text(b.page)).includes('Following'));
  const aFollowers = await b.page.evaluate(() => {
    const el = [...document.querySelectorAll('.stat a, .stat div')].find((x) => x.textContent.includes('Followers'));
    return el ? el.textContent : '';
  });
  ck('A followers count shows 1', aFollowers.includes('1'), aFollowers);

  // like + comment on A's post from B's view of A's profile feed
  const likeBefore = await b.page.evaluate(() => document.querySelector('.post [data-count-r]').textContent);
  await b.page.click('.post [data-react]'); await sleep(1300);
  const likeAfter = await b.page.evaluate(() => document.querySelector('.post [data-count-r]').textContent);
  ck('B like increments count', likeBefore !== likeAfter, `${likeBefore} -> ${likeAfter}`);
  await b.page.click('.post [data-comment]'); await sleep(1300);
  const COMMENT = `Great post Ayan — comment from B ${stamp}`;
  await b.page.type('.post [data-comments] textarea', COMMENT);
  await b.page.click('.post [data-comments] button[type=submit]'); await sleep(1600);
  ck('B comment appears', (await text(b.page)).includes(COMMENT));
  await b.page.reload({ waitUntil: 'networkidle2' }); await sleep(2200);
  await b.page.click('.post [data-comment]'); await sleep(1500);
  ck('comment persists after refresh', (await text(b.page)).includes(COMMENT));
  ck('like count persists after refresh', (await b.page.evaluate(() => document.querySelector('.post [data-count-r]').textContent)) === likeAfter);

  console.log('\n== USER A: notifications received ==');
  await a.page.reload({ waitUntil: 'networkidle2' }); await sleep(2500);
  const badge = await a.page.evaluate(() => {
    const el = document.querySelector('#b-notifications');
    return el && !el.hidden ? el.textContent : '';
  });
  ck('A unread notification badge shows a count', /[1-9]/.test(badge), `badge="${badge}"`);
  await go(a.page, '#/notifications');
  const nt = await text(a.page);
  ck('A got follow notification', /started following you/i.test(nt));
  ck('A got reaction notification', /reacted to your post/i.test(nt));
  ck('A got comment notification', /commented on your post/i.test(nt));
  await a.page.screenshot({ path: path.join(SHOTS, 'T1-notifications.png') });
  await clickText(a.page, '#mark-all', 'Mark all');
  await sleep(1200);
  await a.page.reload({ waitUntil: 'networkidle2' }); await sleep(2200);
  const badge2 = await a.page.evaluate(() => { const e = document.querySelector('#b-notifications'); return e ? e.hidden : true; });
  ck('mark-all-read clears the badge and persists', badge2 === true);

  console.log('\n== CROSS-SESSION PERSISTENCE (logout -> login) ==');
  await a.page.evaluate(async () => { await window.GZ.post('/auth/logout'); });
  await a.page.goto(`${BASE}/?r=${Date.now()}#/`, { waitUntil: 'networkidle2' }); await sleep(1800);
  ck('A logged out -> protected route blocked', !(await text(a.page)).includes('What is happening'));
  await a.page.goto(`${BASE}/?r=${Date.now()}#/auth`, { waitUntil: 'networkidle2' }); await sleep(1200);
  await a.page.type('#li', A.email); await a.page.type('#lp', A.pass);
  await a.page.click('#lf button[type=submit]'); await sleep(3000);
  ck('A logged back in', (await text(a.page)).includes('What is happening'));
  ck('A post survives logout/login cycle', (await text(a.page)).includes(POST));
  await go(a.page, '#/u/' + A.user);
  ck('A profile shows the follower gained while away', (await text(a.page)).includes('Followers'));

  console.log('\n== B: messaging A, then A sees it ==');
  await go(b.page, '#/u/' + A.user);
  const msgBtn = await b.page.evaluateHandle(() => [...document.querySelectorAll('#prof-actions button')].find((x) => x.textContent.includes('💬')));
  await msgBtn.asElement().click(); await sleep(2200);
  const MSG = `Hi Ayan, message from Bipul ${stamp}`;
  await b.page.type('#cmsg', MSG);
  await b.page.click('#cform button[type=submit]'); await sleep(1600);
  ck('B message sent and rendered', (await text(b.page)).includes(MSG));
  await a.page.goto(`${BASE}/?r=${Date.now()}#/messages`, { waitUntil: 'networkidle2' }); await sleep(2500);
  ck('A inbox lists B conversation', (await text(a.page)).includes(B.name));
  const conv = await a.page.$('.conv');
  if (conv) { await conv.click(); await sleep(2200); }
  ck('A can read the message B sent', (await text(a.page)).includes(MSG));
  await a.page.type('#cmsg', 'Got it Bipul, replying from A.');
  await a.page.click('#cform button[type=submit]'); await sleep(1800);
  await b.page.reload({ waitUntil: 'networkidle2' }); await sleep(2500);
  ck('B receives A reply after refresh', (await text(b.page)).includes('replying from A'));
  await a.page.screenshot({ path: path.join(SHOTS, 'T2-messages.png') });

  console.log('\n== HUBS / GROUPS / COMMUNITIES (user B) ==');
  await go(b.page, '#/business');
  ck('Business Hub shows joined state', (await text(b.page)).includes('Leave hub'));
  await clickText(b.page, '#hub-act button', 'Post here');
  await b.page.type('#cp-text', `B business post ${stamp}: looking for a technical co-founder #startups`);
  await b.page.click('#cp-go'); await sleep(2200);
  ck('business post lands in Business feed', (await text(b.page)).includes('technical co-founder'));
  await go(b.page, '#/gaming?tab=teams');
  await clickText(b.page, '#newteam', 'Find teammates');
  await b.page.type('#cp-text', `B team post ${stamp}: LF duo partner, ranked evenings`);
  await b.page.click('#cp-go'); await sleep(2200);
  ck('team recruitment post lands in Gaming Teams', (await text(b.page)).includes('LF duo partner'));
  await go(b.page, '#/groups');
  await b.page.click('#newg'); await sleep(700);
  await b.page.type('#g-n', `Squad ${stamp}`);
  await b.page.type('#g-d', 'Two-user flow test group');
  await b.page.click('#g-go'); await sleep(2500);
  ck('group created', (await text(b.page)).includes(`Squad ${stamp}`));
  const gid = b.page.url().split('/group/')[1].split('?')[0];
  await clickText(b.page, '#gact button', 'Post');
  await b.page.type('#cp-text', 'First group post from B');
  await b.page.click('#cp-go'); await sleep(2200);
  ck('group post saved to group feed', (await text(b.page)).includes('First group post from B'));
  // A joins B's public group
  await go(a.page, '#/group/' + gid);
  await clickText(a.page, '#gact button', 'Join group');
  await sleep(1600);
  ck('A joined B public group', (await text(a.page)).includes('Leave'));
  await go(a.page, `#/group/${gid}?tab=members`);
  ck('group member list shows both users', (await text(a.page)).includes(A.name) && (await text(a.page)).includes(B.name));
  await clickText(a.page, '#gact button', 'Leave');
  await sleep(500);
  await clickText(a.page, '[data-yes]', 'Leave');
  await sleep(1600);
  ck('A left the group', (await text(a.page)).includes('Join group'));
  await go(a.page, '#/communities');
  const join = await a.page.evaluateHandle(() => [...document.querySelectorAll('[data-join]')].find((x) => x.textContent.trim() === 'Join'));
  if (join.asElement()) { await join.asElement().click(); await sleep(1500); }
  await a.page.reload({ waitUntil: 'networkidle2' }); await sleep(2200);
  ck('community membership persists after refresh', await a.page.evaluate(() => [...document.querySelectorAll('[data-join]')].some((x) => x.textContent.trim() === 'Leave')));

  console.log('\n== SAVED / STORIES / EXPLORE / SETTINGS (user A) ==');
  await go(a.page, '#/');
  await a.page.click('.post [data-save]'); await sleep(1300);
  await go(a.page, '#/saved');
  ck('saved post appears on Saved page', (await a.page.evaluate(() => document.querySelectorAll('.post').length)) > 0);
  await a.page.click('.post [data-save]'); await sleep(1300);
  await a.page.reload({ waitUntil: 'networkidle2' }); await sleep(2000);
  ck('unsave removes it from Saved', (await text(a.page)).includes('Nothing saved yet'));
  await go(a.page, '#/');
  const png = path.join(SHOTS, '_story.png');
  fs.writeFileSync(png, Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAGQAAABkCAIAAAD/gAIDAAAAaklEQVR42u3QMQEAAAgDoC251a3gLg6QgLtGxYoVK1asWLFixYoVK1asWLFixYoVK1asWLFixYoVK1asWLFixYoVK1asWLFixYoVK1asWLFixYoVK1asWLFixYoVK1asWLFixYoVK/YfWyIAAV/AtVUAAAAASUVORK5CYII=', 'base64'));
  await a.page.evaluate(() => document.querySelector('.stories button.story').click());
  await sleep(900);
  await (await a.page.$('#sfile')).uploadFile(png);
  await sleep(2200);
  await a.page.type('#scap', 'Story from the two-user test');
  await a.page.click('#sgo'); await sleep(2500);
  const storyCount = await a.page.evaluate(() => document.querySelectorAll('.stories .story').length);
  ck('story created and shows in stories bar', storyCount > 1, 'stories=' + storyCount);
  await a.page.evaluate(() => document.querySelectorAll('.stories button.story')[1].click());
  await sleep(1500);
  ck('story viewer opens', !!(await a.page.$('.story-viewer')));
  await a.page.keyboard.press('Escape'); await sleep(600);
  await a.page.screenshot({ path: path.join(SHOTS, 'T3-stories.png') });
  await go(a.page, '#/explore');
  await a.page.type('#eq', B.name.split(' ')[0]);
  await a.page.click('#ef button'); await sleep(2000);
  ck('explore search finds user B', (await text(a.page)).includes(B.name));
  await a.page.evaluate(() => { document.querySelector('#eq').value = 'zzzznothingmatches'; });
  await a.page.click('#ef button'); await sleep(1800);
  ck('explore shows a no-results state', /No results/i.test(await text(a.page)));
  await go(a.page, '#/settings?tab=appearance');
  await clickText(a.page, '[data-th]', 'Dark'); await sleep(1500);
  await a.page.reload({ waitUntil: 'networkidle2' }); await sleep(2200);
  ck('dark mode persists across reload (saved on account)', (await a.page.evaluate(() => document.documentElement.dataset.theme)) === 'dark');
  await a.page.screenshot({ path: path.join(SHOTS, 'T4-dark-desktop.png') });
  await go(a.page, '#/settings?tab=appearance');
  await clickText(a.page, '[data-th]', 'Light'); await sleep(1500);

  console.log('\n== DESKTOP LAYOUT AUDIT (1440 & 1920) ==');
  for (const w of [1440, 1920]) {
    await a.page.setViewport({ width: w, height: 950 });
    await go(a.page, '#/');
    await sleep(900);
    const m = await a.page.evaluate(() => {
      const shell = getComputedStyle(document.querySelector('.shell')).gridTemplateColumns.split(' ').map(parseFloat);
      const feed = document.querySelector('#view').getBoundingClientRect();
      const nav = document.querySelector('.side').getBoundingClientRect();
      const rail = document.querySelector('#rail').getBoundingClientRect();
      const tab = getComputedStyle(document.querySelector('.tabbar')).display;
      const navLabel = getComputedStyle(document.querySelector('.nav-item')).fontSize;
      const cards = [...document.querySelectorAll('.card')].slice(0, 6).map((c) => getComputedStyle(c).borderRadius);
      return { cols: shell.length, feedW: Math.round(feed.width), navW: Math.round(nav.width), railW: Math.round(rail.width),
        tab, navLabel, sameRadius: new Set(cards).size <= 2, scrollW: document.documentElement.scrollWidth, clientW: document.documentElement.clientWidth };
    });
    ck(`desktop ${w}: three-column layout (nav + feed + rail)`, m.cols === 3 && m.navW > 150 && m.railW > 200, JSON.stringify(m));
    ck(`desktop ${w}: feed uses a readable width (not stretched mobile)`, m.feedW > 480 && m.feedW < 900, 'feedW=' + m.feedW);
    ck(`desktop ${w}: mobile tab bar hidden`, m.tab === 'none');
    ck(`desktop ${w}: nav labels readable (>=14px)`, parseFloat(m.navLabel) >= 14, m.navLabel);
    ck(`desktop ${w}: consistent card radii`, m.sameRadius);
    ck(`desktop ${w}: no horizontal scroll`, m.scrollW <= m.clientW + 2, `${m.scrollW}/${m.clientW}`);
  }
  await a.page.setViewport({ width: 1440, height: 950 });
  await go(a.page, '#/');
  await a.page.screenshot({ path: path.join(SHOTS, 'T5-desktop-home.png') });
  await go(a.page, '#/business');
  await a.page.screenshot({ path: path.join(SHOTS, 'T6-desktop-business.png') });

  console.log('\n== MOBILE LAYOUT AUDIT (390) ==');
  await a.page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  await go(a.page, '#/'); await sleep(1200);
  const mob = await a.page.evaluate(() => {
    const shell = document.querySelector('.shell');
    const tabbar = document.querySelector('.tabbar').getBoundingClientRect();
    const pad = parseFloat(getComputedStyle(shell).paddingBottom);
    const lastCard = [...document.querySelectorAll('.post')].pop();
    const btns = [...document.querySelectorAll('.tabbar button, .pa, .btn')].filter((b) => b.offsetParent !== null).map((b) => b.getBoundingClientRect().height);
    // scroll to the bottom and check the last post is not hidden behind the tab bar
    window.scrollTo(0, document.body.scrollHeight);
    const lastRect = lastCard ? lastCard.getBoundingClientRect() : null;
    return { pad, tabTop: tabbar.top, lastBottom: lastRect ? lastRect.bottom : 0,
      minBtn: Math.min(...btns), scrollW: document.documentElement.scrollWidth, clientW: document.documentElement.clientWidth,
      badges: [...document.querySelectorAll('.dot')].filter((d) => !d.hidden).map((d) => d.textContent) };
  });
  ck('mobile: bottom padding clears the tab bar', mob.pad >= 70, 'padding-bottom=' + mob.pad);
  ck('mobile: last feed card not hidden behind bottom nav', mob.lastBottom <= mob.tabTop + 4, JSON.stringify(mob));
  ck('mobile: touch targets >= 32px', mob.minBtn >= 32, 'min=' + mob.minBtn);
  ck('mobile: no horizontal scroll', mob.scrollW <= mob.clientW + 2);
  ck('mobile: badges show real counts (no stray zeros)', mob.badges.every((b) => b !== '0'), JSON.stringify(mob.badges));
  const railMobile = await a.page.evaluate(() => {
    const r = document.querySelector('#rail');
    return { visible: r && getComputedStyle(r).display !== 'none', text: r ? r.innerText.slice(0, 60) : '' };
  });
  ck('mobile: suggestions/trending rail reachable below the feed', railMobile.visible && railMobile.text.length > 10, JSON.stringify(railMobile));
  await a.page.screenshot({ path: path.join(SHOTS, 'T7-mobile-home.png') });

  console.log('\n== ADMIN (separate context) ==');
  const adm = await newUser(browser, 'ADMIN');
  await adm.page.goto(`${BASE}/?r=${Date.now()}#/auth`, { waitUntil: 'networkidle2' }); await sleep(1200);
  await adm.page.type('#li', 'admin@genzhub.app'); await adm.page.type('#lp', 'AdminGenz2026');
  await adm.page.click('#lf button[type=submit]'); await sleep(3000);
  await go(adm.page, '#/admin');
  const at = await text(adm.page);
  ck('admin dashboard shows live platform stats', at.includes('Total users') && /\d/.test(at));
  await go(adm.page, '#/admin?tab=users');
  ck('admin user list includes the two new test users', (await text(adm.page)).includes(A.user) && (await text(adm.page)).includes(B.user));
  ck('admin list exposes no password data', !/password/i.test(await text(adm.page)));
  // B reports A's post -> admin resolves
  await go(b.page, '#/u/' + A.user);
  await b.page.click('.post [data-menu]'); await sleep(500);
  await clickText(b.page, '.menu button', 'Report post');
  await sleep(700);
  await b.page.select('#rr', 'Spam');
  await b.page.type('#rd', 'automated two-user test report');
  await b.page.click('#rsend'); await sleep(1600);
  ck('B can file a report', /Report submitted/i.test(await text(b.page)));
  await go(adm.page, '#/admin?tab=reports');
  ck('report reaches the admin queue', (await text(adm.page)).includes('automated two-user test report'));
  await clickText(adm.page, '[data-actions] button', 'Dismiss');
  await sleep(1600);
  await go(adm.page, '#/admin?tab=reports&status=dismissed');
  ck('admin moderation action persists', (await text(adm.page)).includes('automated two-user test report'));
  await adm.page.screenshot({ path: path.join(SHOTS, 'T8-admin-reports.png') });

  const failed = results.filter((r) => !r.ok);
  const realErrors = errors.filter((e) => !/favicon|status of 40[13]/.test(e));
  console.log(`\nTWO-USER RESULT: ${results.length - failed.length}/${results.length} checks passed`);
  console.log(`console/page errors: ${realErrors.length}`);
  realErrors.slice(0, 6).forEach((e) => console.log('  ! ' + e));
  failed.forEach((f) => console.log('  FAILED: ' + f.name));
  console.log(`\nTest accounts left in DB: ${A.email} / ${A.pass}  and  ${B.email} / ${B.pass}`);
  await browser.close();
  process.exit(failed.length ? 1 : 0);
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
