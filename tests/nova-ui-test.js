'use strict';
/* Real Chromium walk-through. Spawns an isolated server + temporary database. */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const net = require('node:net');
const { spawn } = require('node:child_process');
const assert = require('node:assert/strict');
const puppeteer = require('puppeteer');

const ROOT = path.join(__dirname, '..');
const SHOTS = path.join(ROOT, 'screenshots');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const results = [];
function ok(name, cond, extra = '') { results.push(!!cond); console.log(`${cond ? 'PASS' : 'FAIL'} ${name}${extra ? ' · ' + extra : ''}`); }
async function freePort() { const s = net.createServer(); await new Promise(r => s.listen(0, '127.0.0.1', r)); const p = s.address().port; await new Promise(r => s.close(r)); return p; }
async function launchBrowser() {
  if (fs.existsSync(puppeteer.executablePath())) return puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const { default: chromium, inflate } = await import('@sparticuz/chromium');
  await inflate(path.join(ROOT, 'node_modules/@sparticuz/chromium/bin/al2023.tar.br'));
  process.env.LD_LIBRARY_PATH = '/tmp/al2023/lib:' + (process.env.LD_LIBRARY_PATH || '');
  return puppeteer.launch({ headless: true, executablePath: await chromium.executablePath(), args: chromium.args.filter(a => !['--disable-web-security', '--allow-running-insecure-content', '--single-process'].includes(a)) });
}
async function click(page, selector) { await page.waitForSelector(selector, { visible: true }); await page.click(selector); }
async function text(page) { return page.evaluate(() => document.body.innerText); }
async function go(page, view) { await page.evaluate(v => { location.hash = v; }, view); await sleep(350); }
async function noOverflow(page, label) { const r = await page.evaluate(() => ({ s: document.documentElement.scrollWidth, c: document.documentElement.clientWidth })); ok('no horizontal overflow · ' + label, r.s <= r.c + 1, `${r.s}/${r.c}`); }

(async () => {
  fs.mkdirSync(SHOTS, { recursive: true });
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nova-ui-'));
  const port = await freePort(); const base = `http://127.0.0.1:${port}`;
  const server = spawn(process.execPath, ['src/server.js'], { cwd: ROOT, env: { ...process.env, PORT: String(port), DATA_DIR: dir, NOVA_HOME: '1', NODE_ENV: 'test', NOVA_AI_API_KEY: '' }, stdio: ['ignore', 'pipe', 'pipe'] });
  let serverLog = ''; server.stdout.on('data', d => serverLog += d); server.stderr.on('data', d => serverLog += d);
  let browser;
  try {
    let ready = false;
    for (let i = 0; i < 60; i++) { try { const r = await fetch(base + '/api/health'); if (r.ok) { ready = true; break; } } catch {} await sleep(250); }
    assert.ok(ready, 'server started: ' + serverLog);
    browser = await launchBrowser();
    const page = await browser.newPage(); const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error' && !/40[0139]/.test(m.text())) errors.push(m.text()); });
    await page.setViewport({ width: 1440, height: 1000 });
    await page.goto(base + '/', { waitUntil: 'networkidle0' });
    await page.waitForSelector('.core-card');
    ok('root opens NOVA when NOVA_HOME=1', page.url().endsWith('/nova#overview'));
    ok('animated core renders', await page.$('#orb-canvas') !== null);
    await noOverflow(page, 'desktop overview');
    await page.screenshot({ path: path.join(SHOTS, 'nova-desktop.png'), fullPage: true });

    // Conversation: deterministic local reply persists.
    await page.type('#chat-input', 'What is 128 * 4?'); await page.keyboard.press('Enter');
    await page.waitForFunction(() => document.querySelector('#messages')?.innerText.includes('512'));
    ok('chat returns a real local calculation', (await text(page)).includes('512'));
    await page.reload({ waitUntil: 'networkidle0' }); await page.waitForSelector('#messages');
    ok('conversation survives reload', (await text(page)).includes('512'));

    // Website generation is explicit; AI output is previewed in an isolated frame.
    await go(page, 'conversation');
    const workspaceId = await page.evaluate(async () => (await (await fetch('/api/nova/state', { headers: { 'X-Nova-Session': sessionStorage.getItem('nova.token') } })).json()).workspace.id);
    const projectId = '00000000-0000-4000-8000-000000000001';
    const projectDir = path.join(dir, 'nova', 'projects', workspaceId, projectId);
    const fixtureHtml = '<!doctype html><html><body><h1>Bakery preview</h1><script>document.querySelector("h1").textContent = "Interactive bakery"</script></body></html>';
    fs.mkdirSync(projectDir, { recursive: true });
    fs.writeFileSync(path.join(projectDir, 'index.html'), fixtureHtml);
    fs.writeFileSync(path.join(projectDir, 'project.json'), JSON.stringify({ id: projectId, name: 'A bakery', createdAt: Date.now() }));
    await page.evaluate((projectId, html) => {
      const realFetch = window.fetch;
      const project = { id: projectId, name: 'A bakery', createdAt: Date.now() };
      window.fetch = (url, options) => {
        if (String(url).endsWith('/website/generate')) return Promise.resolve(new Response(JSON.stringify({ ok: true, html, project }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
        if (String(url).endsWith('/website/projects')) return Promise.resolve(new Response(JSON.stringify({ projects: [project] }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
        if (String(url).endsWith('/website/projects/' + projectId)) return Promise.resolve(new Response(JSON.stringify({ project, html }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
        return realFetch(url, options);
      };
    }, projectId, fixtureHtml);
    await click(page, '[data-action="build-website"]');
    await page.type('#website-brief', 'A bakery'); await click(page, '#website-submit');
    await page.waitForSelector('#website-preview');
    const preview = await page.$('#website-preview'); const previewFrame = await preview.contentFrame();
    await previewFrame.waitForFunction(() => document.querySelector('h1')?.textContent === 'Interactive bakery');
    ok('website preview runs interactive scripts', await previewFrame.$eval('h1', el => el.textContent) === 'Interactive bakery');
    ok('website preview denies same-origin access', await page.$eval('#website-preview', el => el.getAttribute('sandbox')) === 'allow-scripts');
    ok('website download requires explicit click', await page.$('#website-download') !== null);
    await click(page, '#website-saved'); await click(page, '.website-project');
    await page.waitForSelector('#website-preview');
    ok('saved website reopens in preview', await page.$('#website-preview') !== null);
    await click(page, '.modal [data-close]');
    await page.evaluate(() => {
      const realFetch = window.fetch;
      window.fetch = (url, options) => {
        if (String(url).endsWith('/chat') && options?.body && ['ekta bakery website banao', 'website change the title'].includes(JSON.parse(options.body).message)) {
          const now = Date.now(), body = JSON.parse(options.body);
          if (body.message === 'website change the title') window.__websiteEditTarget = body.websiteProjectId;
          return Promise.resolve(new Response(JSON.stringify({ userMessage: { id: 'web-user', role: 'user', content: body.message, created_at: now }, message: { id: 'web-ai', role: 'assistant', content: 'Website saved', created_at: now }, website: { html: '<!doctype html><html><body><h1>Chat website</h1></body></html>', project: { id: '00000000-0000-4000-8000-000000000001' } } }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
        }
        return realFetch(url, options);
      };
    });
    await page.type('#chat-input', 'ekta bakery website banao'); await page.keyboard.press('Enter');
    await page.waitForSelector('#website-preview');
    const chatFrame = await (await page.$('#website-preview')).contentFrame(); await chatFrame.waitForSelector('h1');
    ok('website requested in chat opens its preview', await chatFrame.$eval('h1', el => el.textContent) === 'Interactive bakery');
    await click(page, '.modal [data-close]');
    await page.type('#chat-input', 'website change the title'); await page.keyboard.press('Enter');
    await page.waitForSelector('#website-preview');
    ok('website edit targets the website last opened', await page.evaluate(() => window.__websiteEditTarget) === projectId);
    await click(page, '.modal [data-close]');

    // Memory CRUD through the UI.
    await go(page, 'memory'); await click(page, '.page-heading [data-action="add-memory"]');
    await page.type('#memory-content', 'I prefer concise Bengali answers'); await page.select('#memory-category', 'preference');
    await click(page, '#memory-form button[type="submit"]');
    await page.waitForFunction(() => !document.querySelector('#memory-form') && document.body.innerText.includes('I prefer concise Bengali answers'), { timeout: 10000 });
    ok('memory created through modal', (await text(page)).includes('I prefer concise Bengali answers'));
    await click(page, '[data-edit-memory]'); await page.waitForSelector('#memory-content');
    await page.evaluate(() => document.querySelector('#memory-content').value = ''); await page.type('#memory-content', 'I prefer short answers');
    await click(page, '#memory-form button[type="submit"]'); await sleep(350);
    ok('memory edited', (await text(page)).includes('I prefer short answers'));
    await page.type('#memory-search', 'nothing-matches'); ok('memory search filters', (await text(page)).includes('No matching memories'));
    await page.evaluate(() => { const i = document.querySelector('#memory-search'); i.value = ''; i.dispatchEvent(new Event('input', { bubbles: true })); });
    await click(page, '[data-delete-memory]'); await click(page, '#confirm-action'); await sleep(350);
    ok('memory deleted with confirmation', (await text(page)).includes('Some things are worth remembering'));

    // Explicit chat memory.
    await go(page, 'conversation'); await page.type('#chat-input', 'Remember my name is Rafi'); await page.keyboard.press('Enter');
    await page.waitForFunction(() => document.querySelector('#messages')?.innerText.includes('Saved to your memory vault'));
    ok('chat saves explicit memory', (await text(page)).includes('My name is Rafi'));

    // Settings persist and persona changes the core accent.
    await go(page, 'settings'); await page.waitForSelector('#setting-name');
    await page.evaluate(() => document.querySelector('#setting-name').value = ''); await page.type('#setting-name', 'Rafi');
    await click(page, '#settings-form button[type="submit"]'); await sleep(350);
    await click(page, '[data-persona="atlas"]'); await sleep(350);
    ok('persona switches to ATLAS', (await text(page)).includes('ATLAS is ready'));
    await page.reload({ waitUntil: 'networkidle0' }); await page.waitForSelector('#setting-name');
    ok('settings survive reload', await page.$eval('#setting-name', el => el.value) === 'Rafi');
    ok('ATLAS persona survives reload', await page.$('[data-persona="atlas"].selected') !== null);
    await click(page, '[data-persona="nova"]'); await sleep(250);

    // In-app AI connect: secure field, no .env required, and chat never accepts a key.
    await page.waitForSelector('[data-action="connect-ai"]');
    await click(page, '[data-action="connect-ai"]'); await page.waitForSelector('#ai-api-key');
    ok('AI connect modal uses a password field', await page.$eval('#ai-api-key', el => el.type === 'password'));
    ok('AI connect modal defaults to Groq model', await page.$eval('#ai-model', el => el.value === 'llama-3.3-70b-versatile'));
    await page.keyboard.press('Escape'); await page.waitForFunction(() => !document.querySelector('#ai-api-key'));
    await go(page, 'conversation');
    const fakeKey = 'gsk_ui_test_abcdefghijklmnopqrstuvwxyz';
    await page.type('#chat-input', fakeKey); await page.keyboard.press('Enter');
    await page.waitForSelector('#ai-api-key');
    ok('pasting a key into chat opens the secure connect field', await page.$eval('#ai-api-key', (el, key) => el.value === key, fakeKey));
    ok('key-like chat text is not added to the conversation', !(await page.$eval('#messages', el => el.innerText)).includes(fakeKey));
    await page.keyboard.press('Escape'); await page.waitForFunction(() => !document.querySelector('#ai-api-key'));

    // Command palette keyboard navigation.
    await page.keyboard.down('Control'); await page.keyboard.press('KeyK'); await page.keyboard.up('Control');
    await page.waitForSelector('#palette-input'); await page.type('#palette-input', 'memory vault'); await page.keyboard.press('Enter'); await sleep(300);
    ok('command palette navigates', await page.evaluate(() => location.hash) === '#memory');

    // Focus timer starts and pauses.
    await go(page, 'overview'); await page.$eval('#focus-toggle', el => el.scrollIntoView({ block: 'center' })); await click(page, '#focus-toggle');
    try { await page.waitForFunction(() => document.querySelector('#focus-time')?.textContent !== '25:00', { timeout: 4000 }); } catch {}
    ok('focus timer counts down', await page.$eval('#focus-time', el => el.textContent) !== '25:00', await page.$eval('#focus-toggle', el => el.textContent));
    await click(page, '#focus-toggle'); const paused = await page.$eval('#focus-time', el => el.textContent); await sleep(1100);
    ok('focus timer pauses', await page.$eval('#focus-time', el => el.textContent) === paused);

    // Desktop action requires approval and cannot run while offline.
    await click(page, '[data-quick="open_youtube"]'); await page.waitForSelector('.modal');
    ok('quick action opens approval review', (await text(page)).includes('A quick check before we act'));
    ok('offline bridge blocks approval', (await text(page)).includes('Desktop bridge is offline') && await page.$('#approve-action') === null);
    await page.screenshot({ path: path.join(SHOTS, 'nova-approval.png') });
    await click(page, '[data-action-cancel]'); await click(page, '#confirm-action'); await sleep(300);
    await go(page, 'activity'); ok('cancelled action appears in activity', (await text(page)).includes('Cancelled'));
    await go(page, 'desktop'); ok('desktop setup instructions render', (await text(page)).includes('Download nova-agent.js'));
    await noOverflow(page, 'desktop control');
    await page.screenshot({ path: path.join(SHOTS, 'nova-desktop-control.png'), fullPage: true });

    // Phone pairing in a separate browser context, then revocation.
    await click(page, '.main-nav [data-action="remote"]'); await page.waitForSelector('.pair-code');
    const code = await page.$eval('.pair-code', el => el.textContent.trim()); ok('pairing code generated', /^[A-F0-9]{10}$/.test(code));
    await page.keyboard.press('Escape');
    const phoneContext = await browser.createBrowserContext(); const phone = await phoneContext.newPage();
    await phone.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
    await phone.goto(base + '/nova#remote=' + code, { waitUntil: 'networkidle0' }); await phone.waitForSelector('#pair-code');
    await click(phone, '#pair-form button'); await phone.waitForSelector('.remote-banner');
    ok('phone pairs into the same workspace', (await text(phone)).includes('controlling this workspace remotely'));
    ok('remote sees shared conversation', (await text(phone)).includes('128 * 4'));
    await noOverflow(phone, 'paired phone'); await phone.screenshot({ path: path.join(SHOTS, 'nova-remote.png'), fullPage: true });
    await go(phone, 'settings'); ok('remote cannot edit owner settings', await phone.$eval('#setting-name', el => el.matches(':disabled')));
    ok('remote cannot connect an AI key', await phone.$eval('[data-action="connect-ai"]', el => el.matches(':disabled')));
    await phoneContext.close();
    await go(page, 'settings'); await sleep(800); await page.evaluate(() => window.dispatchEvent(new Event('visibilitychange'))); await sleep(500);
    if (!await page.$('[data-revoke-remote]')) { await go(page, 'overview'); await go(page, 'settings'); }
    await page.waitForSelector('[data-revoke-remote]'); await click(page, '[data-revoke-remote]'); await click(page, '#confirm-action'); await sleep(300);
    ok('owner can revoke paired phone', (await text(page)).includes('No phones paired yet'));

    // Responsive shell and every view at mobile width.
    await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
    for (const view of ['overview', 'conversation', 'memory', 'desktop', 'activity', 'settings']) { await go(page, view); await noOverflow(page, 'mobile ' + view); }
    await click(page, '#mobile-menu'); await sleep(350); ok('mobile navigation opens', await page.$eval('#sidebar', el => el.classList.contains('open')));
    await click(page, '#sidebar [data-view="overview"]'); await sleep(350);
    ok('mobile navigation closes after selection', await page.$eval('#sidebar', el => !el.classList.contains('open')));
    await page.screenshot({ path: path.join(SHOTS, 'nova-mobile.png'), fullPage: true });
    await page.setViewport({ width: 375, height: 667, isMobile: true, hasTouch: true }); await noOverflow(page, 'small mobile');
    await page.setViewport({ width: 768, height: 1024 }); await noOverflow(page, 'tablet');
    ok('no uncaught browser errors', errors.length === 0, errors.join(' | '));
  } finally {
    if (browser) await browser.close();
    server.kill('SIGTERM'); await new Promise(r => { if (server.exitCode !== null) return r(); server.once('exit', r); setTimeout(r, 3000); });
    fs.rmSync(dir, { recursive: true, force: true });
  }
  const failed = results.filter(x => !x).length;
  console.log(`\n${results.length - failed}/${results.length} UI checks passed.`);
  if (failed) process.exitCode = 1;
})().catch(e => { console.error(e); process.exitCode = 1; });
