/* Username flows, driven through the real SPA in jsdom against a running server.
 *
 * Covers the two user-reported problems:
 *   1. signup would not accept the username the user typed
 *   2. Settings -> Username -> Update silently did nothing
 *
 * Usage: node tests/username-ui-test.js   (server must be running on $BASE)
 */
const { JSDOM, VirtualConsole } = require('jsdom');

const BASE = process.env.BASE || 'http://127.0.0.1:3000';
const H = { 'Content-Type': 'application/json', 'X-GenZ-Client': '1' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const RUN = Date.now().toString(36);

let pass = 0, fail = 0;
function ck(label, got, want) {
  const ok = String(got) === String(want);
  ok ? pass++ : fail++;
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${label}${ok ? '' : `  (got ${JSON.stringify(got)}, want ${JSON.stringify(want)})`}`);
}

async function bootDom(cookie) {
  const vc = new VirtualConsole();
  const jsErrors = [];
  vc.on('jsdomError', (e) => { const m = String(e.message || e); if (!/Not implemented|Could not load|Could not parse CSS/.test(m)) jsErrors.push(m); });
  vc.on('error', (m) => jsErrors.push('console.error: ' + m));
  const html = await (await fetch(BASE + '/')).text();
  const dom = new JSDOM(html, { url: BASE + '/', runScripts: 'dangerously', resources: 'usable', pretendToBeVisual: true, virtualConsole: vc });
  const w = dom.window;
  if (cookie) w.document.cookie = cookie;
  w.IntersectionObserver = class { constructor(cb) { this.cb = cb; } observe() {} disconnect() {} unobserve() {} };
  w.scrollTo = () => {};
  w.HTMLElement.prototype.scrollIntoView = () => {};
  // jsdom has no real navigation; the SPA calls these after a successful auth change.
  try { Object.defineProperty(w.location, 'reload', { value: () => {}, configurable: true }); } catch (e) {}
  const calls = [];
  w.fetch = (url, opts = {}) => {
    const abs = String(url).startsWith('http') ? url : BASE + url;
    calls.push((opts.method || 'GET') + ' ' + String(url).replace(/^https?:\/\/[^/]+/, ''));
    if (cookie) opts.headers = Object.assign({}, opts.headers, { cookie });
    return fetch(abs, opts);
  };
  await new Promise((r) => w.addEventListener('load', r));
  await sleep(1100);
  return { w, calls, jsErrors };
}

async function api(path, body, cookie) {
  const res = await fetch(BASE + '/api' + path, {
    method: body ? 'POST' : 'GET', headers: cookie ? Object.assign({ cookie }, H) : H,
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = {}; try { data = await res.json(); } catch (e) {}
  return { status: res.status, data };
}

(async () => {
  /* ---------------- 1. signup form in the DOM ---------------- */
  console.log('\n== SIGNUP FORM (typed name -> stored handle) ==');
  {
    const { w, jsErrors } = await bootDom(null);
    w.location.hash = '#/auth?mode=signup';
    await sleep(600);
    const panel = w.document.querySelector('#auth-panel');
    const typed = 'Rafi Ahmed ' + RUN;          // exactly what a user types: a real name, with a space
    panel.querySelector('#sn').value = 'Rafi Ahmed';
    panel.querySelector('#se').value = 'rafi_' + RUN + '@t.io';
    panel.querySelector('#sp').value = 'Passw0rd123';
    panel.querySelector('#sd').value = '2000-01-01';
    const u = panel.querySelector('#su');
    u.value = typed;
    u.dispatchEvent(new w.Event('input', { bubbles: true }));
    await sleep(900);                            // let the debounced availability check land
    const hint = panel.querySelector('#suh').textContent;
    console.log('    typed: ' + JSON.stringify(typed) + '\n    hint : ' + hint);
    ck('form is not blocked by native validation', panel.querySelector('#sf').noValidate, true);
    ck('live hint shows the handle that will be stored', /@rafi_ahmed_[a-z0-9]+ is available/.test(hint), true);

    panel.querySelector('#sf').dispatchEvent(new w.Event('submit', { bubbles: true, cancelable: true }));
    await sleep(900);
    const expected = 'rafi_ahmed_' + RUN;
    const row = await (await fetch(BASE + '/api/users/' + encodeURIComponent(expected))).json();
    ck('account created under the typed name (normalized)', row && row.profile && row.profile.username, expected);
    if (jsErrors.length) console.log('    js errors:', jsErrors.slice(0, 3));
    w.close();
  }

  /* ---------------- 2. signup API accepts friendly input ---------------- */
  console.log('\n== SIGNUP API ==');
  for (const [typed, want] of [['Munir BH', 'munir_bh'], ['rafi.ahmed', 'rafi_ahmed'], ['  spaced  out  ', 'spaced_out'], ['RafiAhmed99', 'rafiAhmed99'.toLowerCase()]]) {
    const u = 'sg' + Math.random().toString(36).slice(2, 9);
    const res = await api('/auth/signup', { full_name: 'T T', username: typed + ' ' + u, email: u + Math.random().toString(36).slice(2, 6) + '@t.io', password: 'Passw0rd123', dob: '2000-01-01' });
    const got = res.data.user ? res.data.user.username : res.data.error;
    ck(`"${typed} …" accepted`, res.status === 200 && got.startsWith(want), true);
  }
  {
    const res = await api('/auth/signup', { full_name: 'T T', username: 'রাফি', email: 'bn' + Math.random().toString(36).slice(2, 8) + '@t.io', password: 'Passw0rd123', dob: '2000-01-01' });
    ck('non-Latin handle rejected with a clear rule', res.status, 400);
    console.log('    message: ' + res.data.error);
  }

  /* ---------------- 3. settings -> username -> Update ---------------- */
  console.log('\n== SETTINGS: type a name, click Update ==');
  {
    const u = 'st' + Math.random().toString(36).slice(2, 9);
    const su = await api('/auth/signup', { full_name: 'UI Test', username: u, email: u + '@t.io', password: 'Passw0rd123', dob: '2000-01-01' });
    if (su.status !== 200) throw new Error('could not create the settings test user: ' + JSON.stringify(su.data));
    const cookie = await login(u);
    const { w, calls, jsErrors } = await bootDom(cookie);
    w.location.hash = '#/settings?tab=account';
    await sleep(700);
    const box = w.document.querySelector('#sview');
    const input = box.querySelector('#s-user');
    const form = box.querySelector('#f-user');

    async function clickUpdate(label, value, wantStored) {
      calls.length = 0;
      input.value = value;
      input.dispatchEvent(new w.Event('input', { bubbles: true }));
      const hintTxt = box.querySelector('#s-user-hint').textContent;
      form.querySelector('button').click();
      await sleep(800);
      const fired = calls.some((c) => c.includes('/me/username'));
      const now = (await api('/auth/me', null, cookie)).data.user;
      ck(label + ' -> request fired', fired, true);
      ck(label + ' -> stored on server', now.username, wantStored);
      ck(label + ' -> preview matched reality', hintTxt.includes('@' + wantStored), true);
      const card = w.document.querySelector('#sidenav .me-card');
      ck(label + ' -> sidebar handle refreshed', card && card.querySelector('.tiny.muted').textContent, '@' + wantStored);
      ck(label + ' -> sidebar link points at new profile', card && card.getAttribute('href'), '#/u/' + wantStored);
    }

    await clickUpdate('name with a space', 'Munir BH ' + RUN, 'munir_bh_' + RUN);
    await clickUpdate('name with a dot', 'rafi.ahmed' + RUN, 'rafi_ahmed' + RUN);
    await clickUpdate('plain handle', 'plain' + RUN, 'plain' + RUN);

    // duplicates must still be refused, loudly
    calls.length = 0;
    const dup = await api('/auth/signup', { full_name: 'Other', username: 'taken' + RUN, email: 'tk' + Math.random().toString(36).slice(2, 8) + '@t.io', password: 'Passw0rd123', dob: '2000-01-01' });
    ck('duplicate holder created', dup.status, 200);
    input.value = 'taken' + RUN;
    input.dispatchEvent(new w.Event('input', { bubbles: true }));
    form.querySelector('button').click();
    await sleep(700);
    ck('duplicate rejected, user told why', box.querySelector('#s-user-hint').textContent, 'Username already taken.');
    ck('username unchanged after duplicate attempt', (await api('/auth/me', null, cookie)).data.user.username, 'plain' + RUN);

    if (jsErrors.length) console.log('    js errors:', jsErrors.slice(0, 3));
    w.close();
  }

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('FATAL', e); process.exit(1); });

async function login(username) {
  const res = await fetch(BASE + '/api/auth/login', { method: 'POST', headers: H, body: JSON.stringify({ identifier: username + '@t.io', password: 'Passw0rd123' }) });
  const sc = res.headers.getSetCookie ? res.headers.getSetCookie() : [res.headers.get('set-cookie')];
  return sc[0].split(';')[0];
}
