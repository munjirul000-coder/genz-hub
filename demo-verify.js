const puppeteer = require('puppeteer');
const URL = process.argv[2];
let ok = 0, bad = 0;
const ck = (n, c, x = '') => c ? (ok++, console.log('  ok   ' + n)) : (bad++, console.log('  FAIL ' + n + ' << ' + x));
const s = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const b = await puppeteer.launch({ args: ['--no-sandbox', '--disable-dev-shm-usage'], headless: 'new' });
  const ctx = await b.createBrowserContext(); const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 100)); });
  await p.setViewport({ width: 1440, height: 950 });
  const T = () => p.evaluate(() => document.body.innerText);
  const V = () => p.evaluate(() => document.querySelector('#view') ? document.querySelector('#view').innerText : '');
  const go = async h => { await p.evaluate(x => window.location.hash = x, h); await s(1400); };

  await p.goto(URL + '/?d=' + Date.now() + '#/auth', { waitUntil: 'networkidle2' }); await s(1500);
  await p.type('#li', 'demo@genzhub.app'); await p.type('#lp', 'Demo12345');
  await p.click('#lf button[type=submit]'); await s(3200);
  ck('demo account logs in', (await T()).includes('What is happening'));

  const home = await p.evaluate(() => ({
    stories: document.querySelectorAll('.stories .story').length,
    posts: document.querySelectorAll('.post').length,
    notif: (document.querySelector('#b-notifications') || {}).textContent,
    msgs: (document.querySelector('#b-messages') || {}).textContent,
    rail: document.querySelector('#rail').innerText.length,
  }));
  ck('stories bar has real stories', home.stories >= 4, JSON.stringify(home));
  ck('feed is populated with posts', home.posts >= 5, 'posts=' + home.posts);
  ck('unread notification badge visible', /[1-9]/.test(home.notif || ''), 'badge=' + home.notif);
  ck('unread message badge visible', /[1-9]/.test(home.msgs || ''), 'badge=' + home.msgs);
  ck('right rail has suggestions/trending/events', home.rail > 200);

  await go('#/notifications');
  const n = await V();
  ck('notifications list populated', (n.match(/ago|m\b|h\b/g) || []).length > 3 && n.length > 200);
  ck('  has follow + reaction + connection notifications', /following you/i.test(n) && /reacted/i.test(n) && /connection request/i.test(n));

  await go('#/network?tab=incoming');
  ck('pending connection requests waiting to accept', (await V()).includes('Mahiya') || (await V()).includes('Tahmid'));
  await go('#/network');
  ck('accepted connections listed', (await V()).includes('Ayesha') || (await V()).includes('Shakib'));

  await go('#/messages');
  ck('inbox has conversations', (await p.evaluate(() => document.querySelectorAll('.conv').length)) >= 3);
  await p.evaluate(() => document.querySelector('.conv').click()); await s(2000);
  ck('conversation opens with message history', (await V()).length > 100);

  await go('#/business');
  ck('Business Hub feed populated', (await p.evaluate(() => document.querySelectorAll('.post').length)) >= 3);
  await go('#/business?tab=collab');
  ck('collaboration board has co-founder posts', /co-founder|developer|editor/i.test(await V()));
  await go('#/gaming');
  ck('Gaming Hub feed populated', (await p.evaluate(() => document.querySelectorAll('.post').length)) >= 2);
  await go('#/gaming?tab=teams');
  ck('team recruitment posts present', /teammates|squad|5-stack/i.test(await V()));

  await go('#/groups');
  ck('groups list populated', (await p.evaluate(() => document.querySelectorAll('.card').length)) >= 4);
  await go('#/groups?tab=mine');
  ck('demo user is a member of groups', /Dhaka Startup Circle|Demo Private Group|Valorant/i.test(await V()));
  const gid = await p.evaluate(() => { const a = [...document.querySelectorAll('a[href^="#/group/"]')].find(x => x.textContent.includes('Demo Private Group')); return a ? a.getAttribute('href') : null; });
  if (gid) { await go(gid.slice(1) + '?tab=manage'); ck('private group has join requests to approve', /Fahim|Arif/i.test(await V())); }
  else ck('private group has join requests to approve', false, 'group link not found');

  await go('#/communities');
  ck('communities populated with members', /members/i.test(await V()));
  await go('#/events');
  ck('upcoming events listed', /Meetup|Scrim|Workshop|Cup/i.test(await V()));
  await go('#/saved');
  ck('saved posts present', (await p.evaluate(() => document.querySelectorAll('.post').length)) >= 2);
  await go('#/explore');
  ck('explore shows trending hashtags + people', /#/.test(await V()) && (await V()).length > 300);
  await go('#/u/demo');
  ck('demo profile shows posts + followers', /Posts|Followers/i.test(await V()));

  // admin
  await p.evaluate(async () => { await window.GZ.post('/auth/logout'); });
  await p.goto(URL + '/?d=' + Date.now() + '#/auth', { waitUntil: 'networkidle2' }); await s(1500);
  await p.type('#li', 'admin@genzhub.app'); await p.type('#lp', 'AdminGenz2026');
  await p.click('#lf button[type=submit]'); await s(3200);
  await go('#/admin');
  const st = await V();
  ck('admin dashboard shows real numbers', /Total users/.test(st) && /1[0-9]/.test(st));
  await go('#/admin?tab=reports');
  ck('admin report queue has open reports', /Spam|Impersonation/i.test(await V()));

  const real = errs.filter(e => !/favicon|40[13]/.test(e));
  console.log(`\nDEMO SITE CHECK: ${ok} passed, ${bad} failed | JS errors: ${real.length}`);
  real.slice(0, 4).forEach(e => console.log('  ! ' + e));
  await b.close(); process.exit(bad ? 1 : 0);
})().catch(e => { console.error('FATAL', e.message); process.exit(1); });
