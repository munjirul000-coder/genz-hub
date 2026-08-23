/* Headless UI smoke test: boots the SPA in jsdom against the live server and walks every route. */
const { JSDOM, VirtualConsole } = require('jsdom');

const BASE = process.env.BASE || 'http://127.0.0.1:3000';
const ROUTES = ['#/', '#/?scope=following', '#/explore', '#/explore?tab=people&q=rafi', '#/explore?tab=posts&q=startup',
  '#/network', '#/network?tab=suggested', '#/messages', '#/notifications', '#/groups', '#/groups?tab=mine',
  '#/communities', '#/business', '#/business?tab=collab', '#/business?tab=people', '#/business?tab=events', '#/business?tab=network',
  '#/gaming', '#/gaming?tab=teams', '#/gaming?tab=games', '#/gaming?tab=communities', '#/events', '#/saved',
  '#/settings', '#/settings?tab=profile', '#/settings?tab=privacy', '#/settings?tab=notifications', '#/settings?tab=appearance', '#/settings?tab=language',
  '#/u/rafi', '#/u/rafi?tab=about', '#/u/rafi?tab=media', '#/u/rafi?tab=groups', '#/u/rafi?tab=followers',
  '#/c/young-founders', '#/group/1', '#/post/1', '#/hashtag/startups', '#/admin', '#/admin?tab=users', '#/admin?tab=posts',
  '#/admin?tab=reports', '#/admin?tab=groups', '#/admin?tab=communities', '#/admin?tab=comments', '#/admin?tab=events', '#/admin?tab=settings',
  '#/welcome', '#/about', '#/privacy', '#/terms', '#/guidelines', '#/contact', '#/nonsense-route'];

(async () => {
  const login = await fetch(BASE + '/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'X-GenZ-Client': '1' },
    body: JSON.stringify({ identifier: process.argv[2] || 'admin@genzhub.app', password: process.argv[3] || 'AdminGenz2026' }),
  });
  const cookie = (login.headers.getSetCookie ? login.headers.getSetCookie() : [login.headers.get('set-cookie')])[0].split(';')[0];
  if (login.status !== 200) throw new Error('login failed');

  const errors = [];
  const vc = new VirtualConsole();
  vc.on('jsdomError', (e) => errors.push('jsdomError: ' + (e.message || e)));
  vc.on('error', (m) => errors.push('console.error: ' + m));

  const html = await (await fetch(BASE + '/')).text();
  const dom = new JSDOM(html, {
    url: BASE + '/', runScripts: 'dangerously', resources: 'usable', pretendToBeVisual: true, virtualConsole: vc,
  });
  const w = dom.window;
  w.document.cookie = cookie;
  // jsdom lacks these
  w.IntersectionObserver = class { constructor(cb) { this.cb = cb; } observe() { this.cb([{ isIntersecting: false }]); } disconnect() {} unobserve() {} };
  w.scrollTo = () => {};
  w.HTMLElement.prototype.scrollIntoView = () => {};
  const origFetch = w.fetch ? w.fetch.bind(w) : null;
  w.fetch = (url, opts = {}) => {
    const u = String(url).startsWith('http') ? url : BASE + url;
    opts.headers = Object.assign({}, opts.headers, { cookie });
    return fetch(u, opts);
  };

  await new Promise((r) => w.addEventListener('load', r));
  await new Promise((r) => setTimeout(r, 900));

  let checked = 0;
  for (const route of ROUTES) {
    w.location.hash = route;
    await new Promise((r) => setTimeout(r, 260));
    const view = w.document.querySelector('#view');
    const text = view ? view.textContent.trim() : '';
    const hasSkeletonOnly = view && view.children.length && !text;
    if (!view) errors.push(`${route}: no #view rendered`);
    else if (text.length < 5) errors.push(`${route}: view looks empty (${text.length} chars)`);
    else if (/undefined|NaN|\[object Object\]/.test(text)) errors.push(`${route}: suspicious text -> ${text.slice(0, 120)}`);
    checked++;
    process.stdout.write(`  ${errors.length && errors[errors.length - 1].startsWith(route) ? 'FAIL' : 'ok  '} ${route}\n`);
  }

  // interaction: open composer modal, reaction button, comment toggle
  w.location.hash = '#/';
  await new Promise((r) => setTimeout(r, 700));
  w.GZ.openComposer({});
  await new Promise((r) => setTimeout(r, 250));
  if (!w.document.querySelector('.overlay .modal')) errors.push('composer modal did not open');
  else process.stdout.write('  ok   composer modal opens\n');
  w.document.querySelector('[data-close]').click();
  const react = w.document.querySelector('[data-react]');
  if (!react) errors.push('no post cards rendered on home feed');
  else {
    react.click();
    await new Promise((r) => setTimeout(r, 400));
    process.stdout.write('  ok   reaction click handled\n');
  }
  const cbtn = w.document.querySelector('[data-comment]');
  if (cbtn) { cbtn.click(); await new Promise((r) => setTimeout(r, 500));
    const shown = w.document.querySelector('[data-comments]');
    if (!shown || shown.hidden) errors.push('comments did not expand');
    else process.stdout.write('  ok   comments expand\n'); }

  console.log(`\nUI RESULT: ${checked} routes walked, ${errors.length} problems`);
  errors.forEach((e) => console.log('  ! ' + e));
  process.exit(errors.length ? 1 : 0);
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
