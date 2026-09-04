const { JSDOM, VirtualConsole } = require('jsdom');
const BASE = 'http://127.0.0.1:3000';
(async () => {
  const errors = [];
  const vc = new VirtualConsole();
  vc.on('jsdomError', e => errors.push('jsdomError: ' + e.message));
  const html = await (await fetch(BASE + '/')).text();
  const dom = new JSDOM(html, { url: BASE + '/', runScripts: 'dangerously', resources: 'usable', pretendToBeVisual: true, virtualConsole: vc });
  const w = dom.window;
  w.IntersectionObserver = class { constructor(cb){this.cb=cb;} observe(){} disconnect(){} unobserve(){} };
  w.scrollTo = () => {};
  w.fetch = (url, opts = {}) => fetch(String(url).startsWith('http') ? url : BASE + url, opts);
  await new Promise(r => w.addEventListener('load', r));
  await new Promise(r => setTimeout(r, 900));
  const ck = (n, cond, extra='') => console.log(`  ${cond ? 'ok  ' : 'FAIL'} ${n} ${cond ? '' : extra}`) || (cond || errors.push(n));
  ck('guest redirected to landing', w.location.hash === '#/welcome', w.location.hash);
  const txt = w.document.body.textContent;
  ck('landing shows tagline', /Connect\. Build\./.test(txt));
  ck('landing shows hubs', /Business Hub/.test(txt) && /Gaming Hub/.test(txt));
  ck('landing shows signup CTA', !!w.document.querySelector('a[href="#/auth?mode=signup"]'));
  ck('footer legal links', !!w.document.querySelector('a[href="#/privacy"]') && !!w.document.querySelector('a[href="#/terms"]'));
  for (const p of ['#/about', '#/privacy', '#/terms', '#/guidelines', '#/contact']) {
    w.location.hash = p; await new Promise(r => setTimeout(r, 200));
    ck('public page ' + p, w.document.body.textContent.length > 800);
  }
  w.location.hash = '#/'; await new Promise(r => setTimeout(r, 350));
  ck('guest app route -> auth', w.location.hash === '#/auth', w.location.hash);
  w.location.hash = '#/admin'; await new Promise(r => setTimeout(r, 350));
  ck('guest admin route -> auth', w.location.hash === '#/auth', w.location.hash);
  w.location.hash = '#/messages'; await new Promise(r => setTimeout(r, 350));
  ck('guest messages -> auth', w.location.hash === '#/auth', w.location.hash);
  console.log(`\nGUEST RESULT: ${errors.length} problems`);
  process.exit(errors.length ? 1 : 0);
})();
