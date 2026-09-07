'use strict';

// End-to-end smoke test.
//
// Spawns the real server in a child process with a fresh temporary database,
// then walks the entire visitor → submit → admin → analyze → export flow and
// asserts every step. Run with:  npm test

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

const PORT = 4577;
const BASE = `http://127.0.0.1:${PORT}`;
const ROOT = path.join(__dirname, '..');
const DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'ideapulse-test-'));

const ADMIN_EMAIL = 'admin@test.local';
const ADMIN_PASSWORD = 'a-strong-test-password-123';

let failures = 0;
function check(name, cond, extra) {
  if (cond) console.log(`  ✓ ${name}`);
  else {
    failures++;
    console.log(`  ✗ ${name}${extra ? ' — ' + extra : ''}`);
  }
}

// Minimal cookie jar.
class Jar {
  constructor() { this.map = {}; }
  setFrom(res) {
    const cookies = res.headers.getSetCookie ? res.headers.getSetCookie() : [];
    for (const c of cookies) {
      const first = c.split(';')[0];
      const eq = first.indexOf('=');
      if (eq > 0) this.map[first.slice(0, eq).trim()] = first.slice(eq + 1).trim();
    }
  }
  header() {
    return Object.entries(this.map).map(([k, v]) => `${k}=${v}`).join('; ');
  }
}

async function waitForServer(child) {
  const deadline = Date.now() + 15000;
  return new Promise((resolve, reject) => {
    child.stdout.on('data', (d) => {
      if (String(d).includes('listening')) resolve();
    });
    child.stderr.on('data', () => {});
    child.on('exit', (code) => reject(new Error(`server exited early (${code})`)));
    const iv = setInterval(() => {
      if (Date.now() > deadline) {
        clearInterval(iv);
        reject(new Error('timeout waiting for server'));
      }
    }, 100);
  });
}

async function req(method, url, jar, body, csrf) {
  const headers = {};
  if (jar) headers.Cookie = jar.header();
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    if (csrf) headers['X-CSRF-Token'] = csrf;
  }
  const res = await fetch(BASE + url, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    redirect: 'manual',
  });
  if (jar) jar.setFrom(res);
  let data = null;
  try { data = await res.json(); } catch { /* not json */ }
  return { status: res.status, data, res };
}

async function main() {
  console.log(`\nIdeaPulse smoke test (port ${PORT}, data ${DATA_DIR})\n`);

  const child = spawn(process.execPath, ['src/server.js'], {
    cwd: ROOT,
    env: {
      ...process.env,
      PORT: String(PORT),
      DATA_DIR,
      ADMIN_EMAIL,
      ADMIN_PASSWORD,
      NODE_ENV: 'development',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  await waitForServer(child);

  try {
    // 1. Landing page
    let r = await req('GET', '/', null);
    check('landing page loads (200)', r.status === 200, `got ${r.status}`);

    // 2. Public pages
    r = await req('GET', '/submit', null);
    check('submit page loads (200)', r.status === 200, `got ${r.status}`);
    r = await req('GET', '/admin/login', null);
    check('admin login page loads (200)', r.status === 200, `got ${r.status}`);

    // 3. Admin protected without session
    r = await req('GET', '/admin/dashboard', new Jar());
    check('admin dashboard redirects unauthenticated (302 → /admin/login)', r.status === 302 && String(r.res.headers.get('location')).includes('/admin/login'));

    r = await req('GET', '/api/admin/overview', new Jar());
    check('admin API rejects unauthenticated (401)', r.status === 401);

    // 4. Anonymous submission with CSRF
    const visitor = new Jar();
    r = await req('GET', '/api/csrf', visitor);
    const csrf = r.data.csrfToken;
    check('CSRF token issued', !!csrf);

    r = await req('POST', '/api/submissions', visitor, {
      problem: "I can't find reliable organic food in my area.",
      desiredSolution: 'A trusted service that delivers genuinely organic food at reasonable prices.',
      category: 'food',
      broadLocation: 'Dhaka',
    }, csrf);
    check('anonymous submission accepted (201)', r.status === 201 && r.data.ok, `got ${r.status}`);

    r = await req('POST', '/api/submissions', visitor, {
      problem: 'Good organic food is difficult to find.',
      desiredSolution: 'A reliable organic food delivery company.',
      category: 'food',
      broadLocation: 'Dhaka',
    }, csrf);
    check('second related submission accepted', r.status === 201);

    // 5. Submission rejected without CSRF
    const noCsrf = new Jar();
    r = await req('POST', '/api/submissions', noCsrf, {
      problem: 'some problem text here',
      desiredSolution: 'a solution idea',
    });
    check('submission without CSRF rejected (403)', r.status === 403);

    // 6. Admin login (wrong then right)
    const admin = new Jar();
    r = await req('GET', '/api/csrf', admin);
    const acsrf = r.data.csrfToken;
    r = await req('POST', '/api/login', admin, { email: ADMIN_EMAIL, password: 'wrong-password' }, acsrf);
    check('wrong password rejected (401)', r.status === 401);

    r = await req('POST', '/api/login', admin, { email: ADMIN_EMAIL, password: ADMIN_PASSWORD }, acsrf);
    check('admin login succeeds', r.status === 200 && r.data.ok);

    r = await req('GET', '/api/session', admin);
    check('session authenticated', r.data.authenticated === true);

    // 7. Admin dashboard HTML
    r = await req('GET', '/admin/dashboard', admin);
    check('admin dashboard loads with session (200)', r.status === 200, `got ${r.status}`);

    // 8. Overview
    r = await req('GET', '/api/admin/overview', admin);
    check('overview returns metrics', r.data.total >= 2 && typeof r.data.today === 'number');

    // 9. Search / filter
    r = await req('GET', '/api/admin/submissions?q=organic', admin);
    check('search "organic" returns matches', r.data.total >= 2);
    r = await req('GET', '/api/admin/submissions?category=food&sort=oldest', admin);
    check('filter by category works', r.data.items.every((s) => s.category === 'food'));

    // 10. Opportunities
    r = await req('GET', '/api/admin/opportunities', admin);
    const organic = (r.data.items || []).find((c) => /organic/i.test(c.title));
    check('organic submissions grouped into an opportunity', !!organic, 'titles: ' + (r.data.items || []).map((c) => c.title).join(', '));

    if (organic) {
      r = await req('GET', `/api/admin/opportunities/${organic.id}`, admin);
      check('opportunity detail includes related submissions', r.data.submissions.length >= 2);

      r = await req('POST', `/api/admin/opportunities/${organic.id}/report`, admin, {}, acsrf);
      check('business report generated', r.status === 200 && typeof r.data.content === 'string' && r.data.content.includes('## Problem summary'));
    }

    // 11. Analytics
    r = await req('GET', '/api/admin/analytics', admin);
    check('analytics returns chart data', Array.isArray(r.data.categories) && Array.isArray(r.data.timelineMonthly));

    // 12. Export (raw bodies)
    let exp = await fetch(BASE + '/api/admin/submissions/export?format=csv', { headers: { Cookie: admin.header() } });
    const csvText = await exp.text();
    check('CSV export contains header + rows', csvText.includes('Anonymous ID') && csvText.includes('organic'));
    exp = await fetch(BASE + '/api/admin/submissions/export?format=xls', { headers: { Cookie: admin.header() } });
    const xlsText = await exp.text();
    check('Excel export is a SpreadsheetML workbook', xlsText.includes('<Workbook'));

    // 13. Re-analyze
    r = await req('POST', '/api/admin/reanalyze', admin, {}, acsrf);
    check('re-analyze succeeds', r.status === 200 && typeof r.data.clusters === 'number');

    // 14. Logout
    r = await req('POST', '/api/logout', admin, {}, acsrf);
    check('logout succeeds', r.data.ok === true);
    r = await req('GET', '/api/session', admin);
    check('session cleared after logout', r.data.authenticated === false);

  } finally {
    child.kill('SIGTERM');
  }

  console.log(failures === 0 ? '\n✅ All smoke tests passed.' : `\n❌ ${failures} test(s) failed.`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error('\n❌ smoke test crashed:', err.message);
  process.exit(1);
});
