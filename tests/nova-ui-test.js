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
async function click(page, selector) {
  await page.waitForSelector(selector, { visible: true });
  // Don't click a moving modal while its entrance animation is still running.
  await page.evaluate(async s => {
    const el = document.querySelector(s); const animations = [];
    for (let node = el; node; node = node.parentElement) animations.push(...node.getAnimations().filter(a => a.playState === 'running' && a.effect.getTiming().iterations !== Infinity));
    await Promise.all(animations.map(a => a.finished.catch(() => {})));
  }, selector);
  await page.click(selector);
}
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
    await click(page, '[data-action="native-voice"]');
    ok('background voice requires explicit consent and explains privacy', (await text(page)).includes('I agree · start microphone') && (await text(page)).includes('Do not speak passwords') && (await text(page)).includes('not yet been tested on Windows hardware'));
    ok('background voice offers Bengali and English', await page.$$eval('#native-language option', options => options.map(o => o.value).join(',') === 'bn-BD,en-US'));
    await click(page, '#native-confirm'); await page.waitForFunction(() => document.body.innerText.includes('available only on this Windows PC'), { timeout: 8000 });
    ok('non-Windows start reports an honest error', (await text(page)).includes('available only on this Windows PC'));
    await click(page, '.modal [data-close]');

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

    // Plan UI uses mocked server responses; actual plan security is API-tested separately.
    await go(page, 'conversation');
    await page.evaluate(() => {
      const original = window.fetch; window.__planFetch = original; window.__planApprovals = 0; window.__planStop = 0; window.__planPoll = 0;
      window.SpeechRecognition = class { constructor() { window.__planRec = this; } start() {} stop() { this.onend?.(); } abort() { this.onend?.(); } say(text) { this.onresult?.({ results: [Object.assign([{ transcript: text }], { isFinal: true })] }); } };
      const steps = [{ description: '<img src=x onerror="window.__planXss=true"> Open Notepad', kind: 'open_notepad', label: 'Open Notepad', detail: 'Launches a new, empty Windows Notepad window.', status: 'waiting', result: null }, { description: 'Write notes yourself', kind: 'manual', status: 'waiting', result: null }];
      const state = (index = 0, action = null, final = false) => ({ id: 'ui-plan', summary: 'Get ready', index, action, state: final ? 'complete' : 'active', message: final ? 'Overall goal not verified.' : 'Review the next step.', steps, expiresAt: Date.now() + 60000 });
      const pending = { id: 'ui-action', kind: 'open_notepad', status: 'pending', params: {} };
      window.fetch = (url, opts = {}) => {
        const u = String(url); let plan;
        if (u.endsWith('/goal-plans')) { window.__planStartBody = JSON.parse(opts.body); plan = state(); }
        else if (u.endsWith('/goal-plans/ui-plan/prepare')) { steps[0].status = 'pending'; plan = state(0, pending); }
        else if (u.endsWith('/goal-plans/ui-plan/approve')) { window.__planApprovals++; steps[0].status = 'approved'; plan = state(0, { ...pending, status: 'approved' }); }
        else if (u.endsWith('/goal-plans/ui-plan/manual-done')) { steps[1].status = 'user-confirmed'; steps[1].result = 'User confirmed, not verified.'; plan = state(2, null, true); }
        else if (u.endsWith('/goal-plans/ui-plan/stop')) { window.__planStop++; plan = { ...state(), state: 'stopped' }; }
        else if (u.endsWith('/goal-plans/ui-plan')) { window.__planPoll++; steps[0].status = 'completed'; steps[0].result = 'Agent reported launch.'; plan = state(1); }
        else return original(url, opts);
        return Promise.resolve(new Response(JSON.stringify({ ok: true, plan }), { status: 200 }));
      };
    });
    await click(page, '[data-action="goal-plan"]');
    ok('goal planning explains consent and limited capabilities', (await text(page)).includes('No screenshot, chat history or memory') && (await text(page)).includes('No typing, clicking'));
    await page.setViewport({ width: 390, height: 844 }); await noOverflow(page, 'mobile goal plan'); await page.setViewport({ width: 1440, height: 1000 });
    await page.type('#goal-plan-input', 'Help me get ready'); await click(page, '#goal-plan-create'); await page.waitForSelector('#goal-prepare');
    ok('plan output is escaped and no action is approved on creation', await page.evaluate(() => !window.__planXss && !document.querySelector('#goal-plan-result img') && window.__planApprovals === 0 && window.__planStartBody.confirm));
    await click(page, '#goal-prepare'); await page.waitForSelector('#goal-approve');
    ok('fixed action is shown before approval', (await text(page)).includes('Open Notepad') && await page.evaluate(() => window.__planApprovals === 0));
    await click(page, '#goal-approve-voice'); await page.evaluate(() => window.__planRec.say('not approved'));
    ok('unrecognized voice never approves a planned action', await page.evaluate(() => window.__planApprovals === 0));
    await click(page, '#goal-approve-voice'); await page.evaluate(() => window.__planRec.say('অনুমতি দিচ্ছি')); await page.waitForSelector('#goal-manual', { timeout: 10000 });
    ok('next step waits for agent result', await page.evaluate(() => window.__planApprovals === 1 && window.__planPoll > 0) && (await text(page)).includes('Agent reported launch.'));
    await click(page, '#goal-manual'); await page.waitForFunction(() => document.querySelector('#goal-plan-status')?.textContent.includes('COMPLETE'));
    ok('manual completion is clearly user confirmed, not independently verified', (await text(page)).includes('User confirmed, not verified.') && (await text(page)).includes('Overall goal not verified.'));
    await click(page, '.modal [data-close]'); await page.evaluate(() => { window.fetch = window.__planFetch; delete window.SpeechRecognition; });

    // Chat shows only trusted World Monitor links, with all other content escaped.
    await go(page, 'conversation');
    await page.evaluate(() => {
      const original = window.fetch; window.__worldXss = false; window.__worldLinkSafe = false;
      window.__linkObserver = new MutationObserver(() => {
        const links = [...document.querySelectorAll('#messages a')];
        if (links.length === 1 && links[0].hostname === 'www.bbc.com' && links[0].rel.includes('noopener') && !window.__worldXss && !document.querySelector('#messages img')) window.__worldLinkSafe = true;
      });
      window.__linkObserver.observe(document.querySelector('#messages'), { childList: true, subtree: true });
      window.fetch = (url, opts = {}) => {
        if (String(url).endsWith('/chat') && JSON.parse(opts.body || '{}').message === 'latest news ui fixture') {
          const now = Date.now();
          return Promise.resolve(new Response(JSON.stringify({ userMessage: { id: 'world-u', role: 'user', content: 'latest news ui fixture', created_at: now }, message: { id: 'world-a', role: 'assistant', created_at: now, content: 'BBC World News\nhttps://www.bbc.com/news/test\nhttps://www.bbc.com.evil.example/test\n<img src=x onerror=\"window.__worldXss=true\">' }, engine: 'local' }), { status: 200 }));
        }
        return original(url, opts);
      };
    });
    await page.type('#chat-input', 'latest news ui fixture'); await page.keyboard.press('Enter');
    await page.waitForFunction(() => window.__worldLinkSafe);
    ok('world chat shows a clickable sourced link without rendering unsafe content', await page.evaluate(() => { window.__linkObserver.disconnect(); return window.__worldLinkSafe; }));

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
    await click(page, '#memory-form button[type="submit"]'); await page.waitForFunction(() => !document.querySelector('#memory-form') && document.body.innerText.includes('I prefer short answers'), { timeout: 10000 });
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
    await click(page, '[data-persona="jarvis"]'); await page.waitForSelector('[data-persona="jarvis"].selected');
    ok('JARVIS personality is selectable', await page.$('[data-persona="jarvis"].selected') !== null);
    await click(page, '[data-persona="mentor"]'); await page.waitForSelector('[data-persona="mentor"].selected');
    ok('mentor personality is selectable', await page.$('[data-persona="mentor"].selected') !== null);
    await click(page, '[data-persona="custom"]'); await page.waitForSelector('[data-persona="custom"].selected');
    await page.$eval('#character-name', el => el.value = ''); await page.type('#character-name', 'Luna');
    await page.type('#character-style', 'Patient and concise'); await click(page, '#settings-form button[type="submit"]'); await sleep(350);
    await page.reload({ waitUntil: 'networkidle0' }); await page.waitForSelector('#character-name');
    ok('custom personality and behaviour survive reload', await page.$eval('#character-name', el => el.value) === 'Luna' && await page.$eval('#character-style', el => el.value) === 'Patient and concise');
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

    // Explicit continuous voice session, using a mocked browser speech engine.
    await go(page, 'conversation');
    await page.evaluate(() => {
      window.__voiceStarts = 0; window.__spoken = [];
      const voiceFetch = window.fetch;
      window.fetch = (url, options = {}) => {
        if (String(url).endsWith('/chat') && JSON.parse(options.body || '{}').message === 'latest news voice test') {
          const now = Date.now(); return Promise.resolve(new Response(JSON.stringify({ userMessage: { id: 'voice-news-u', role: 'user', content: 'latest news voice test', created_at: now }, message: { id: 'voice-news-a', role: 'assistant', created_at: now, content: '| ID | বাংলা সংবাদ |\n|---|---|\n| N1 | প্রথম খবর বাংলায়। |\n| N2 | দ্বিতীয় খবর বাংলায়। |\n\nWorld Monitor · checked 2026-11-06 UTC\n[N1] https://www.bbc.com/news/test' }, engine: 'cloud' }), { status: 200 }));
        }
        if (String(url).endsWith('/chat') && JSON.parse(options.body || '{}').message === 'local news voice test') {
          const now = Date.now(); return Promise.resolve(new Response(JSON.stringify({ userMessage: { id: 'local-voice-u', role: 'user', content: 'local news voice test', created_at: now }, message: { id: 'local-voice-a', role: 'assistant', created_at: now, content: 'World Monitor · checked 2026-11-06 UTC\n[N1] প্রথম খবর। · 2026-11-06T00:00:00.000Z\nhttps://www.bbc.com/news/first\n[N2] দ্বিতীয় খবর।\n[N3] তৃতীয় খবর।\n[N4] চতুর্থ খবর।' }, engine: 'local' }), { status: 200 }));
        }
        return voiceFetch(url, options);
      };
      window.SpeechRecognition = class {
        constructor() { window.__voiceRec = this; }
        start() { window.__voiceStarts++; } stop() { this.onend?.(); } abort() { this.onend?.(); }
        say(text) { this.onresult?.({ results: [Object.assign([{ transcript: text }], { isFinal: true })] }); }
      };
      window.__realSpeak = speechSynthesis.speak.bind(speechSynthesis);
      window.__realGetVoices = speechSynthesis.getVoices.bind(speechSynthesis);
      window.__RealUtterance = window.SpeechSynthesisUtterance; window.__hasBanglaVoice = true;
      window.SpeechSynthesisUtterance = class { constructor(text) { this.text = text; } };
      speechSynthesis.getVoices = () => window.__hasBanglaVoice ? [{ voiceURI: 'bn-test', lang: 'bn-BD', name: 'Bangla test' }] : [{ voiceURI: 'en-test', lang: 'en-US', name: 'English test' }];
      speechSynthesis.speak = utterance => { window.__spoken.push(utterance.text); setTimeout(() => utterance.onend?.(), 10); };
    });
    await click(page, '[data-action="continuous-voice"]');
    ok('continuous voice starts only on explicit opt-in', await page.$eval('[data-action="continuous-voice"]', el => el.getAttribute('aria-pressed')) === 'true');
    await page.evaluate(() => window.__voiceRec.say('Nova what is 2 + 2?'));
    await page.waitForFunction(() => document.querySelector('#messages')?.innerText.includes('what is 2 + 2') && window.__voiceStarts >= 2, { timeout: 10000 });
    ok('continuous voice resumes after the assistant reply', await page.evaluate(() => window.__voiceStarts >= 2));
    await page.evaluate(() => window.__voiceRec.say('Nova latest news voice test'));
    await page.waitForFunction(() => window.__spoken.some(t => t.includes('প্রথম খবর বাংলায়')), { timeout: 10000 });
    ok('spoken news removes source numbers, tables and URLs but keeps the Bengali news', await page.evaluate(() => {
      const t = window.__spoken.find(x => x.includes('প্রথম খবর বাংলায়'));
      return t.includes('দ্বিতীয় খবর বাংলায়') && !/N1|N2|\||https?:/i.test(t);
    }));
    await page.waitForFunction(() => window.__voiceStarts >= 3, { timeout: 10000 });
    await page.evaluate(() => window.__voiceRec.say('Nova local news voice test'));
    await page.waitForFunction(() => window.__spoken.some(t => t.includes('তৃতীয় খবর')), { timeout: 10000 });
    ok('local news fallback speaks three headlines without IDs or links', await page.evaluate(() => {
      const t = window.__spoken.find(x => x.includes('তৃতীয় খবর'));
      return t.includes('প্রথম খবর') && t.includes('দ্বিতীয় খবর') && !/N1|N2|N3|https?:|চতুর্থ/.test(t);
    }));
    await page.waitForFunction(() => window.__voiceStarts >= 4, { timeout: 10000 });
    await page.evaluate(() => { window.__hasBanglaVoice = false; window.__spokenBeforeNoBangla = window.__spoken.length; window.__voiceRec.say('Nova latest news voice test'); });
    await page.waitForFunction(() => document.body.innerText.includes('বাংলা voice পাওয়া যায়নি'), { timeout: 10000 });
    ok('missing Bengali voice is reported instead of reading only English source IDs', await page.evaluate(() => window.__spoken.length === window.__spokenBeforeNoBangla));

    await click(page, '[data-action="continuous-voice"]'); const voiceCount = await page.evaluate(() => window.__voiceStarts); await sleep(1100);
    ok('continuous voice stops on request', await page.evaluate(() => window.__voiceStarts) === voiceCount && await page.$eval('[data-action="continuous-voice"]', el => el.getAttribute('aria-pressed')) === 'false');
    await page.evaluate(() => { speechSynthesis.speak = window.__realSpeak; speechSynthesis.getVoices = window.__realGetVoices; window.SpeechSynthesisUtterance = window.__RealUtterance; delete window.SpeechRecognition; });

    // One voice approval starts exactly one isolated multi-file project build.
    const builtId = '00000000-0000-4000-8000-000000000002';
    const builtDir = path.join(dir, 'nova', 'built-projects', workspaceId, builtId);
    fs.mkdirSync(builtDir, { recursive: true });
    fs.writeFileSync(path.join(builtDir, 'index.html'), '<!doctype html><html><head><link rel="stylesheet" href="styles.css"></head><body><h1>Before</h1><script src="app.js"></script></body></html>');
    fs.writeFileSync(path.join(builtDir, 'styles.css'), 'h1 { color: purple }');
    fs.writeFileSync(path.join(builtDir, 'app.js'), 'document.querySelector("h1").textContent="Built";');
    fs.writeFileSync(path.join(builtDir, 'project.json'), JSON.stringify({ id: builtId, name: 'Bakery project', createdAt: Date.now() }));
    await page.evaluate((builtId) => {
      const realFetch = window.fetch; window.__buildRequests = [];
      window.fetch = (url, options) => {
        if (String(url).endsWith('/builder/generate')) {
          window.__buildRequests.push(JSON.parse(options.body));
          if (window.__holdBuild) return new Promise((resolve, reject) => options.signal.addEventListener('abort', () => { window.__buildAborted = true; reject(new DOMException('Aborted', 'AbortError')); }, { once: true }));
          return Promise.resolve(new Response(JSON.stringify({ ok: true, project: { id: builtId, name: 'Bakery project', createdAt: Date.now() } }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
        }
        return realFetch(url, options);
      };
      window.SpeechRecognition = class {
        constructor() { window.__projectRec = this; }
        start() {} stop() { this.onend?.(); } abort() { this.onend?.(); }
        say(text) { this.onresult?.({ results: [Object.assign([{ transcript: text }], { isFinal: true })] }); }
      };
    }, builtId);
    await click(page, '[data-action="project-builder"]'); await page.type('#project-brief', 'Build a bakery');
    await page.setViewport({ width: 390, height: 844 }); await noOverflow(page, 'mobile project approval'); await page.setViewport({ width: 1440, height: 1000 });
    await click(page, '#project-voice-approve'); await page.evaluate(() => window.__projectRec.say('do not approve'));
    ok('unrecognised project voice does not start work', await page.evaluate(() => window.__buildRequests.length) === 0);
    await click(page, '#project-voice-approve'); await page.evaluate(() => window.__projectRec.say('অনুমতি দিচ্ছি'));
    await page.waitForSelector('#project-preview');
    const builtFrame = await (await page.$('#project-preview')).contentFrame();
    await builtFrame.waitForFunction(() => document.querySelector('h1')?.textContent === 'Built');
    ok('one spoken permission builds and previews a three-file project', await page.evaluate(() => window.__buildRequests.length === 1 && window.__buildRequests[0].confirm === true));
    ok('multi-file preview runs inside opaque sandbox', await page.$eval('#project-preview', e => e.getAttribute('sandbox')) === 'allow-scripts');
    await click(page, '.modal [data-close]');
    await page.evaluate(() => window.__holdBuild = true);
    await click(page, '[data-action="project-builder"]'); await page.type('#project-brief', 'Build a small site'); await click(page, '#project-approve');
    await click(page, '#project-stop');
    ok('project Stop aborts the in-flight request', await page.evaluate(() => window.__buildAborted === true));
    await page.evaluate(() => { window.__holdBuild = false; document.querySelectorAll('.toast').forEach(el => el.remove()); });
    // Spoken website request opens project authorization with the brief prefilled.
    await click(page, '[data-action="voice"]'); await page.evaluate(() => window.__projectRec.say('build a flower website'));
    await page.waitForSelector('#project-brief');
    ok('spoken website request opens the project permission', await page.$eval('#project-brief', e => e.value) === 'build a flower website');
    await click(page, '.modal [data-close]'); await page.evaluate(() => delete window.SpeechRecognition);

    // Screen is shared only after browser selection; analysis sends one explicit frame.
    await go(page, 'desktop');
    await page.evaluate(() => {
      const realFetch = window.fetch; window.__screenRequests = 0;
      const canvas = document.createElement('canvas'); canvas.width = 400; canvas.height = 250; canvas.getContext('2d').fillRect(0, 0, 400, 250);
      const draw = CanvasRenderingContext2D.prototype.drawImage; CanvasRenderingContext2D.prototype.drawImage = function(source, ...args) { if (['screen-video', 'auto-video'].includes(source.id)) return this.fillRect(0, 0, 400, 250); return draw.call(this, source, ...args); };
      navigator.mediaDevices.getDisplayMedia = async () => { window.__screenStream = canvas.captureStream(2); window.__screenStream.getVideoTracks()[0].getSettings = () => ({ displaySurface: 'monitor' }); return window.__screenStream; };
      window.fetch = (url, options) => { if (String(url).endsWith('/screen/analyze')) { window.__screenRequests++; const payload = JSON.parse(options.body); const result = payload.mode === 'suggest-click' ? { ok: true, proposal: { x: 2500, y: 7500, reason: 'The button' } } : { ok: true, answer: 'A test screen.' }; return Promise.resolve(new Response(JSON.stringify(result), { status: 200, headers: { 'Content-Type': 'application/json' } })); } return realFetch(url, options); };
    });
    await click(page, '[data-action="screen-viewer"]');
    ok('screen viewer starts with sharing off', await page.$eval('#screen-analyze', e => e.disabled));
    await click(page, '#screen-start'); await page.evaluate(() => { const v = document.querySelector('#screen-video'); Object.defineProperty(v, 'videoWidth', { value: 400 }); Object.defineProperty(v, 'videoHeight', { value: 250 }); });
    ok('screen sharing does not send a frame automatically', await page.evaluate(() => window.__screenRequests === 0));
    await click(page, '#screen-analyze'); await page.waitForFunction(() => document.querySelector('#screen-answer')?.textContent === 'A test screen.');
    ok('screen analysis requires explicit click', await page.evaluate(() => window.__screenRequests === 1));
    await click(page, '#screen-suggest');
    ok('screen click suggestion requires primary monitor confirmation', await page.evaluate(() => window.__screenRequests === 1));
    await click(page, '#screen-primary'); await click(page, '#screen-suggest'); await page.waitForSelector('#screen-review-click');
    ok('AI click proposal marks an explicit captured frame', await page.evaluate(() => window.__screenRequests === 2) && await page.$eval('#screen-marker', e => e.style.left === '25%' && e.style.top === '75%'));
    await click(page, '#screen-review-click'); await page.waitForSelector('.approval-detail');
    ok('screen click requires separate approval and displays the target', (await text(page)).includes('Primary screen point: 25%, 75%') && await page.$('#approve-action') === null);
    ok('closing screen viewer stops sharing', await page.evaluate(() => window.__screenStream.getTracks().every(t => t.readyState === 'ended')));
    await click(page, '[data-action-cancel]'); await click(page, '#confirm-action'); await page.waitForFunction(() => document.body.innerText.includes('Action cancelled.'));

    // A single spoken grant drives a multi-step visual loop (all OS/provider calls mocked).
    await page.evaluate((builtId) => {
      const realFetch = window.fetch; window.__autoStepCount = 0; window.__autoStartCount = 0; window.__autoStopCount = 0; window.__autoMode = 'normal'; window.__autoApprovals = 0;
      const state = (state = 'active', action = null) => ({ id: 'test-session', state, message: 'Working', steps: window.__autoStepCount, maxSteps: 12, expiresAt: Date.now() + 100000, action, project: state === 'complete' && window.__autoMode === 'normal' ? { id: builtId, name: 'Bakery project' } : null });
      window.fetch = (url, options = {}) => {
        const u = String(url);
        if (u.endsWith('/autonomy/start')) { window.__autoStartCount++; window.__autoStartBody = JSON.parse(options.body); return Promise.resolve(new Response(JSON.stringify({ ok: true, session: state() }), { status: 200 })); }
        if (u.endsWith('/autonomy/test-session/step')) {
          window.__autoStepCount++;
          if (window.__autoMode === 'hold') return new Promise((resolve, reject) => options.signal.addEventListener('abort', () => { window.__autoAborted = true; reject(new DOMException('Aborted', 'AbortError')); }, { once: true }));
          const action = { id: 'action', label: 'Review deletion', status: 'pending', kind: 'mouse_click_primary', params: { x: 2000, y: 2000 } };
          const s = window.__autoMode === 'review' && window.__autoStepCount === 1 ? state('review', action) : window.__autoStepCount === 1 ? state('active', { ...action, status: 'approved' }) : state('complete');
          return Promise.resolve(new Response(JSON.stringify({ ok: true, session: s }), { status: 200 }));
        }
        if (u.endsWith('/autonomy/test-session/approve')) { window.__autoApprovals++; return Promise.resolve(new Response(JSON.stringify({ ok: true, session: state() }), { status: 200 })); }
        if (u.endsWith('/autonomy/test-session/stop')) { window.__autoStopCount++; return Promise.resolve(new Response(JSON.stringify({ ok: true, session: state('stopped') }), { status: 200 })); }
        if (u.endsWith('/autonomy/test-session')) return Promise.resolve(new Response(JSON.stringify({ session: state() }), { status: 200 }));
        return realFetch(url, options);
      };
      window.SpeechRecognition = class { constructor() { window.__autoRec = this; } start() {} stop() { this.onend?.(); } abort() { this.onend?.(); } say(text) { this.onresult?.({ results: [Object.assign([{ transcript: text }], { isFinal: true })] }); } };
    }, builtId);
    await click(page, '[data-action="auto-work"]'); await page.type('#auto-goal', 'Build a bakery website');
    await page.setViewport({ width: 390, height: 844 }); await noOverflow(page, 'mobile visual work consent'); await page.setViewport({ width: 1440, height: 1000 });
    await click(page, '#auto-share'); await page.evaluate(() => { const v = document.querySelector('#auto-video'); Object.defineProperty(v, 'videoWidth', { value: 400 }); Object.defineProperty(v, 'videoHeight', { value: 250 }); });
    await click(page, '#auto-primary'); await click(page, '#auto-voice'); await page.evaluate(() => window.__autoRec.say('do not approve'));
    ok('visual work does not start on unrecognised speech', await page.evaluate(() => window.__autoStartCount === 0));
    await click(page, '#auto-voice'); await page.evaluate(() => window.__autoRec.say('অনুমতি দিচ্ছি'));
    await page.waitForFunction(() => document.querySelector('#auto-status')?.textContent.includes('COMPLETE'), { timeout: 20000 });
    ok('one spoken grant drives multiple visual loop steps', await page.evaluate(() => window.__autoStartCount === 1 && window.__autoStartBody.confirm && window.__autoStartBody.primary && window.__autoStepCount === 2));
    const autoPreview = await (await page.$('#auto-project-preview')).contentFrame(); await autoPreview.waitForFunction(() => document.querySelector('h1')?.textContent === 'Built');
    ok('visual work shows a sandboxed project preview and download', await page.$eval('#auto-project-preview', e => e.getAttribute('sandbox')) === 'allow-scripts' && await page.$('#auto-project-download') !== null);
    await click(page, '.modal [data-close]');
    ok('visual work stops screen sharing on close', await page.evaluate(() => window.__screenStream.getTracks().every(t => t.readyState === 'ended')));
    await page.evaluate(() => { window.__autoMode = 'review'; window.__autoStepCount = 0; });
    await click(page, '[data-action="auto-work"]'); await page.type('#auto-goal', 'Work on my project'); await click(page, '#auto-share');
    await page.evaluate(() => { const v = document.querySelector('#auto-video'); Object.defineProperty(v, 'videoWidth', { value: 400 }); Object.defineProperty(v, 'videoHeight', { value: 250 }); });
    await click(page, '#auto-primary'); await click(page, '#auto-start'); await page.waitForSelector('#auto-approve-risk');
    ok('visual loop pauses for a risky step', await page.evaluate(() => window.__autoStepCount === 1 && window.__autoApprovals === 0));
    await click(page, '#auto-approve-risk'); await page.waitForFunction(() => document.querySelector('#auto-status')?.textContent.includes('COMPLETE'), { timeout: 20000 });
    ok('visual loop resumes only after separate approval', await page.evaluate(() => window.__autoApprovals === 1 && window.__autoStepCount === 2));
    await click(page, '.modal [data-close]');
    await page.evaluate(() => { window.__autoMode = 'hold'; window.__autoStepCount = 0; window.__autoAborted = false; });
    await click(page, '[data-action="auto-work"]'); await page.type('#auto-goal', 'Work on my project'); await click(page, '#auto-share');
    await page.evaluate(() => { const v = document.querySelector('#auto-video'); Object.defineProperty(v, 'videoWidth', { value: 400 }); Object.defineProperty(v, 'videoHeight', { value: 250 }); });
    await click(page, '#auto-primary'); await click(page, '#auto-start'); await page.waitForFunction(() => window.__autoStepCount === 1);
    await click(page, '#auto-stop'); await page.waitForFunction(() => window.__autoAborted === true);
    ok('visual work Stop aborts the current request and stops sharing', await page.evaluate(() => window.__autoAborted && window.__screenStream.getTracks().every(t => t.readyState === 'ended')));
    await click(page, '.modal [data-close]'); await page.evaluate(() => delete window.SpeechRecognition);

    // World monitor uses sourced data and never invents events on failure.
    await page.evaluate(() => {
      const realFetch = window.fetch; window.__worldOffline = false;
      window.fetch = (url, options) => {
        if (new URL(String(url), location.href).pathname.endsWith('/world')) {
          const data = window.__worldOffline ? { fetchedAt: Date.now(), quakes: { ok: false, items: [], error: 'Feed unavailable' }, news: { ok: false, items: [], error: 'Feed unavailable' } } : { fetchedAt: Date.now(), quakes: { ok: true, items: [{ lat: 23.7, lon: 90.4, magnitude: 4.2, time: 1700000000000, place: 'Near Dhaka', url: 'https://earthquake.usgs.gov/earthquakes/eventpage/test' }] }, news: { ok: true, sources: [{ name: 'BBC World', ok: true }, { name: 'The Guardian', ok: false }], items: [{ title: 'BBC test headline', url: 'https://www.bbc.com/news/test', time: 1700000000000, source: 'BBC World', image: 'https://ichef.bbci.co.uk/ace/test.jpg' }, { title: 'Guardian test headline', url: 'https://www.theguardian.com/world/test', time: 1700000000000, source: 'The Guardian', image: '' }] }, bangladesh: { ok: true, items: [{ title: 'বাংলাদেশ পরীক্ষা সংবাদ', url: 'https://www.jagonews24.com/national/news/123', time: Date.now(), source: 'Jago News 24', image: '' }] } };
          return Promise.resolve(new Response(JSON.stringify(data), { status: 200, headers: { 'Content-Type': 'application/json' } }));
        }
        return realFetch(url, options);
      };
    });
    // Supply a tiny test image without contacting publisher hosts in this sandbox.
    await page.setRequestInterception(true);
    page.on('request', request => {
      if (request.url() === 'https://ichef.bbci.co.uk/ace/test.jpg') request.respond({ status: 200, contentType: 'image/png', body: fs.readFileSync(path.join(ROOT, 'public/nova/assets/nova-emblem.png')) });
      else request.continue();
    });
    await go(page, 'world'); await page.waitForSelector('.world-event');
    ok('world monitor renders live source events and headlines', (await text(page)).includes('Near Dhaka') && (await text(page)).includes('BBC test headline'));
    ok('news cards show publisher images, attribution and image fallback', await page.evaluate(() => {
      const cards = [...document.querySelectorAll('#world-news .news-card')];
      return cards.length === 2 && cards[0].querySelector('.news-image').getBoundingClientRect().height > 50 && cards[0].querySelector('img')?.src === 'https://ichef.bbci.co.uk/ace/test.jpg' && cards[0].querySelector('img')?.getAttribute('referrerpolicy') === 'no-referrer' && cards[1].querySelector('.news-image').getBoundingClientRect().height > 50 && cards[1].textContent.includes('IMAGE UNAVAILABLE') && cards[1].textContent.includes('The Guardian') && document.querySelector('#news-source-status').textContent.includes('Unavailable');
    }));
    ok('Bangladesh headlines show their actual publisher and article link', (await text(page)).includes('বাংলাদেশ পরীক্ষা সংবাদ') && await page.$eval('#bangladesh-news a', a => a.href.startsWith('https://www.jagonews24.com/')));
    ok('new NOVA brand logo loads in sidebar', await page.$eval('.brand-emblem', e => e.complete && e.naturalWidth > 0));
    await click(page, '[data-world-mode="map"]');
    ok('world monitor switches to 2D map', await page.$eval('[data-world-mode="map"]', el => el.classList.contains('active')));
    await click(page, '.world-event'); ok('world event opens source details', (await text(page)).includes('USGS details'));
    await noOverflow(page, 'world monitor');
    await page.screenshot({ path: path.join(SHOTS, 'nova-world.png'), fullPage: true });
    await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
    await go(page, 'overview'); await go(page, 'world'); await page.waitForSelector('.world-event');
    await click(page, '[data-world-mode="map"]'); await sleep(500);
    const mapBox = await page.$eval('#world-canvas', el => { const b = el.getBoundingClientRect(); return { x: b.left, y: b.top, w: b.width, h: b.height }; });
    await page.mouse.click(mapBox.x + (90.4 + 180) * mapBox.w / 360, mapBox.y + (90 - 23.7) * mapBox.h / 180);
    ok('reduced-motion map still draws and selects the real feed marker', (await text(page)).includes('USGS details'));
    await click(page, '[data-world-mode="globe"]');
    ok('globe keyboard rotation remains available with reduced motion', await page.$eval('#world-canvas', el => !el.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }))));
    await page.emulateMediaFeatures([]);
    await page.evaluate(() => window.__worldOffline = true); await click(page, '#world-refresh');
    await page.waitForFunction(() => document.querySelector('#world-quakes')?.innerText.includes('Feed unavailable'));
    ok('world monitor shows source failure without fake events', await page.$('.world-event') === null && (await text(page)).includes('Feed unavailable'));

    // Command palette keyboard navigation.
    await page.keyboard.down('Control'); await page.keyboard.press('KeyK'); await page.keyboard.up('Control');
    await page.waitForSelector('#palette-input'); await page.type('#palette-input', 'memory vault'); await page.keyboard.press('Enter'); await sleep(300);
    ok('command palette navigates', await page.evaluate(() => location.hash) === '#memory');

    // Focus timer starts and pauses.
    await go(page, 'overview'); await page.evaluate(() => document.querySelectorAll('.toast').forEach(el => el.remove())); await page.$eval('#focus-toggle', el => el.scrollIntoView({ block: 'center' })); await click(page, '#focus-toggle');
    try { await page.waitForFunction(() => document.querySelector('#focus-time')?.textContent !== '25:00', { timeout: 4000 }); } catch {}
    ok('focus timer counts down', await page.$eval('#focus-time', el => el.textContent) !== '25:00', await page.$eval('#focus-toggle', el => el.textContent));
    await click(page, '#focus-toggle'); const paused = await page.$eval('#focus-time', el => el.textContent); await sleep(1100);
    ok('focus timer pauses', await page.$eval('#focus-time', el => el.textContent) === paused);

    // Desktop action requires approval and cannot run while offline.
    await click(page, '[data-quick="open_youtube"]'); await page.waitForSelector('.modal');
    ok('quick action opens approval review', (await text(page)).includes('A quick check before we act'));
    ok('offline bridge blocks approval', (await text(page)).includes('Desktop bridge is offline') && await page.$('#approve-action') === null);
    await page.screenshot({ path: path.join(SHOTS, 'nova-approval.png') });
    await click(page, '[data-action-cancel]'); await click(page, '#confirm-action'); await page.waitForFunction(() => document.body.innerText.includes('Action cancelled.'));  await sleep(300);
    await go(page, 'activity'); ok('cancelled action appears in activity', (await text(page)).includes('Cancelled'));
    const realLocalCheck = await page.evaluate(async () => {
      const response = await fetch('/api/nova/local-bridge/start', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-GenZ-Client': '1', 'X-Nova-Session': sessionStorage.getItem('nova.token') || '' }, body: JSON.stringify({ confirm: true }) });
      return { status: response.status, data: await response.json() };
    });
    ok('same-origin browser request reaches local-only Windows check', realLocalCheck.status === 200 && realLocalCheck.data.ok === false && /only on the Windows PC/.test(realLocalCheck.data.error));
    await page.evaluate(() => {
      window.__beforeEasyBridge = window.fetch; window.__easyBridgeOn = false; window.__easyStarts = 0;
      window.fetch = async (url, options = {}) => {
        if (String(url).endsWith('/local-bridge/start')) { window.__easyStarts++; window.__easyBridgeOn = true; return new Response(JSON.stringify({ ok: true }), { status: 200 }); }
        if (String(url).endsWith('/local-bridge/stop')) { window.__easyBridgeOn = false; return new Response(JSON.stringify({ ok: true }), { status: 200 }); }
        const response = await window.__beforeEasyBridge(url, options);
        if (String(url).endsWith('/sync')) { const data = await response.json(); data.bridge = { ...data.bridge, online: window.__easyBridgeOn, managed: window.__easyBridgeOn }; return new Response(JSON.stringify(data), { status: 200 }); }
        return response;
      };
    });
    await go(page, 'desktop'); ok('desktop setup instructions render', (await text(page)).includes('Download nova-agent.js'));
    ok('simple Windows bridge connection is visible without token setup', (await text(page)).includes('Connect this PC') && (await text(page)).includes('No downloads, token copying'));
    await click(page, '#local-bridge-button'); await page.waitForSelector('#confirm-action');
    ok('connecting the local bridge asks for informed confirmation', (await text(page)).includes('previous bridge token will be replaced') && (await page.evaluate(() => window.__easyStarts)) === 0);
    await click(page, '#confirm-action'); await page.waitForFunction(() => document.querySelector('#local-bridge-button')?.innerText.includes('Disconnect this PC'));
    ok('one-click bridge connects and provides a stop control', (await text(page)).includes('Connected. Keep NOVA open.') && (await page.evaluate(() => window.__easyStarts)) === 1);
    await click(page, '#local-bridge-button'); await click(page, '#confirm-action'); await page.waitForFunction(() => document.querySelector('#local-bridge-button')?.innerText.includes('Connect this PC'));
    ok('one-click bridge can be disconnected', (await text(page)).includes('Local bridge disconnected.'));
    await page.evaluate(() => { window.fetch = window.__beforeEasyBridge; });
    await page.type('#mouse-x', '500'); await page.type('#mouse-y', '300');
    await click(page, '#mouse-form button[value="mouse_click"]'); await page.waitForSelector('.approval-detail');
    ok('mouse click review displays coordinates and deletion warning', (await text(page)).includes('Screen coordinates: X 500, Y 300') && (await text(page)).includes('A click may delete files'));
    ok('mouse click cannot run while bridge offline', await page.$('#approve-action') === null);
    await click(page, '[data-action-cancel]'); await click(page, '#confirm-action'); await page.waitForFunction(() => document.body.innerText.includes('Action cancelled.'));  await sleep(300);
    await page.type('#keyboard-text', 'Hello NOVA');
    await click(page, '#keyboard-form button[type="submit"]'); await page.waitForSelector('.approval-detail');
    ok('keyboard action review shows text and requires Notepad', (await text(page)).includes('Hello NOVA') && (await text(page)).includes('focus Notepad within 5 seconds'));
    ok('keyboard action cannot run while bridge offline', await page.$('#approve-action') === null);
    await click(page, '[data-action-cancel]'); await click(page, '#confirm-action'); await page.waitForFunction(() => document.body.innerText.includes('Action cancelled.'));  await sleep(300);
    await page.select('#keyboard-target', 'code');
    await click(page, '#keyboard-form button[type="submit"]'); await page.waitForSelector('.approval-detail');
    ok('keyboard review targets the selected supported app', (await text(page)).includes('focus code and the intended text field within 5 seconds'));
    await click(page, '[data-action-cancel]'); await click(page, '#confirm-action'); await page.waitForFunction(() => document.body.innerText.includes('Action cancelled.'));  await sleep(300);
    await page.select('#keyboard-target', 'notepad');
    // Simulate a connected bridge and browser speech recognition; no OS inputs are executed.
    const onlineResult = await page.evaluate(async () => {
      const token = sessionStorage.getItem('nova.token');
      const h = { 'Content-Type': 'application/json', 'X-GenZ-Client': '1', 'X-Nova-Session': token };
      const issue = await fetch('/api/nova/bridge/token', { method: 'POST', headers: h, body: '{}' });
      const issued = await issue.json();
      const poll = await fetch('/api/nova/bridge/poll', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-GenZ-Client': '1', Authorization: 'Bearer ' + issued.token }, body: '{}' });
      return poll.status;
    });
    assert.equal(onlineResult, 200);
    await page.waitForFunction(() => document.querySelector('#desktop-bridge-pill')?.textContent === 'Connected', { timeout: 10000 });
    await page.evaluate(() => {
      window.SpeechRecognition = class {
        constructor() { window.__approvalRecognition = this; }
        start() {} stop() { this.onend?.(); } abort() { this.onend?.(); }
        say(text) { this.onresult?.({ results: [Object.assign([{ transcript: text }], { isFinal: true })] }); }
      };
    });
    await click(page, '#keyboard-form button[type="submit"]'); await page.waitForSelector('#voice-approve');
    await page.setViewport({ width: 390, height: 844 }); await noOverflow(page, 'mobile voice approval');
    await page.setViewport({ width: 1440, height: 1000 });
    await click(page, '#voice-approve'); await page.evaluate(() => window.__approvalRecognition.say('do not approve'));
    ok('unrecognised voice does not approve the action', (await text(page)).includes('nothing was approved') && await page.$('#approve-action') !== null);
    await click(page, '#voice-approve'); await page.evaluate(() => window.__approvalRecognition.say('অনুমতি দিচ্ছি'));
    await page.waitForSelector('.modal', { hidden: true });
    ok('exact spoken confirmation approves a reviewed action', (await text(page)).includes('Approved. Your desktop agent will run it shortly.'));
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
    for (const view of ['overview', 'conversation', 'memory', 'world', 'desktop', 'activity', 'settings']) { await go(page, view); await noOverflow(page, 'mobile ' + view); }
    await click(page, '#mobile-menu'); await sleep(350); ok('mobile navigation opens', await page.$eval('#sidebar', el => el.classList.contains('open')));
    await click(page, '#sidebar [data-view="overview"]'); await sleep(350);
    ok('mobile navigation closes after selection', await page.$eval('#sidebar', el => !el.classList.contains('open')));
    await page.screenshot({ path: path.join(SHOTS, 'nova-mobile.png'), fullPage: true });
    await page.setViewport({ width: 375, height: 667, isMobile: true, hasTouch: true }); await noOverflow(page, 'small mobile');
    await page.setViewport({ width: 768, height: 1024 }); await noOverflow(page, 'tablet');
    // Separate voice window remains open when its opener tab closes. Speech is mocked;
    // real Windows background listening and microphone service still require user testing.
    const parent = await browser.newPage(); await parent.setViewport({ width: 1200, height: 900 });
    await parent.goto(base + '/nova#conversation', { waitUntil: 'networkidle0' }); await parent.waitForSelector('[data-action="voice-window"]');
    await click(parent, '[data-action="voice-window"]');
    ok('voice window explains continuous audio privacy before opening', (await text(parent)).includes('audio may be sent') && (await text(parent)).includes('recording cannot prove identity'));
    const popupPromise = new Promise(resolve => parent.once('popup', resolve)); await click(parent, '#confirm-action'); const voice = await popupPromise;
    await voice.waitForSelector('.voice-window-note');
    ok('voice window opens independently with explicit start and safety note', (await text(voice)).includes('say “নোভা” or “Nova”') && (await text(voice)).includes('Anyone nearby'));
    await parent.close(); ok('voice window remains after the main tab closes', !voice.isClosed());
    await voice.evaluate(() => {
      window.__voiceFetch = window.fetch; window.__voiceMessages = []; window.__voiceApprovals = 0; window.__voiceCancels = 0; window.__voiceStartCount = 0; window.__alertCalls = 0; window.__voiceSpoken = [];
      window.fetch = async (url, opts = {}) => {
        const target = String(url);
        if (target.endsWith('/chat')) { window.__lastChatBody = JSON.parse(opts.body); window.__voiceMessages.push(window.__lastChatBody.message); const now = Date.now(); const mouse = window.__voiceMessages.at(-1).includes('mouse'); const action = { id: mouse ? 'mock-mouse' : 'mock-app', kind: mouse ? 'mouse_click' : 'open_firefox', label: mouse ? 'Left click mouse' : 'Open Firefox', params: mouse ? { x: 10, y: 10 } : {}, status: 'pending', created_at: now }; return new Response(JSON.stringify({ userMessage: { id: 'mock-user-' + now, role: 'user', content: window.__voiceMessages.at(-1), created_at: now }, message: { id: 'mock-assistant-' + now, role: 'assistant', content: 'Review Open Firefox', action_id: action.id, created_at: now }, action, engine: 'local' }), { status: 200 }); }
        if (/\/actions\/mock-(?:app|mouse)\/approve$/.test(target)) { window.__voiceApprovals++; const mouse = target.includes('mock-mouse'); return new Response(JSON.stringify({ action: { id: mouse ? 'mock-mouse' : 'mock-app', kind: mouse ? 'mouse_click' : 'open_firefox', label: mouse ? 'Left click mouse' : 'Open Firefox', params: mouse ? { x: 10, y: 10 } : {}, status: 'approved', created_at: Date.now() } }), { status: 200 }); }
        if (target.endsWith('/actions/mock-app/cancel')) { window.__voiceCancels++; return new Response(JSON.stringify({ action: { id: 'mock-app', kind: 'open_firefox', label: 'Open Firefox', params: {}, status: 'cancelled', created_at: Date.now() } }), { status: 200 }); }
        if (target.endsWith('/world')) { const items = ++window.__alertCalls < 2 ? [] : [{ source: 'BBC World', title: 'World war fears in test report', url: 'https://www.bbc.com/news/alert-test', time: Date.now() }]; return new Response(JSON.stringify({ fetchedAt: Date.now(), news: { ok: true, sources: [{ name: 'BBC World', ok: true }], items }, bangladesh: { ok: true, items: [] }, quakes: { ok: true, items: [] } }), { status: 200 }); }
        const response = await window.__voiceFetch(url, opts);
        if (target.endsWith('/sync')) { const data = await response.json(); data.bridge = { ...data.bridge, online: true, managed: true }; return new Response(JSON.stringify(data), { status: 200 }); }
        return response;
      };
      window.SpeechRecognition = class {
        start() { window.__voiceRecognition = this; window.__voiceListening = true; window.__voiceStartCount++; }
        stop() { window.__voiceListening = false; setTimeout(() => this.onend?.(), 0); }
        abort() { window.__voiceListening = false; setTimeout(() => this.onend?.(), 0); }
        say(value) { this.onresult?.({ results: [Object.assign([{ transcript: value }], { isFinal: true })] }); }
      };
      window.__voiceRealSetTimeout = window.setTimeout;
      window.setTimeout = (fn, ms, ...args) => window.__voiceRealSetTimeout(fn, ms === 180000 ? 100 : ms, ...args);
      window.SpeechSynthesisUtterance = class { constructor(text) { this.text = text; } };
      speechSynthesis.getVoices = () => [{ voiceURI: 'test-en', lang: 'en-US', name: 'Test' }, { voiceURI: 'test-bn', lang: 'bn-BD', name: 'Test' }];
      speechSynthesis.speak = utterance => { window.__voiceSpoken.push(utterance.text); setTimeout(() => utterance.onend?.(), 1); };
    });
    await voice.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
    await voice.waitForFunction(() => document.querySelector('#sidebar-bridge-status')?.textContent.includes('Connected'), { timeout: 10000 });
    await click(voice, '[data-action="continuous-voice"]');
    await voice.evaluate(() => window.__voiceRecognition.say('background conversation not addressed to assistant')); await voice.waitForFunction(() => window.__voiceStartCount >= 2);
    ok('wake window ignores speech without NOVA', await voice.evaluate(() => window.__voiceMessages.length === 0));
    await voice.evaluate(() => window.__voiceRecognition.say('নোভা open firefox'));
    await voice.waitForFunction(() => window.__voiceMessages.length === 1); await voice.waitForFunction(() => window.__voiceStartCount >= 3);
    ok('wake phrase sends request but does not auto approve by default', await voice.evaluate(() => window.__voiceMessages[0] === 'open firefox' && window.__voiceApprovals === 0));
    ok('voice explicitly asks for approval of the prepared action', (await text(voice)).includes('Nova approve') || (await text(voice)).includes('নোভা অনুমতি দিচ্ছি'));
    await voice.evaluate(() => window.__voiceRecognition.say('Nova cancel')); await voice.waitForFunction(() => window.__voiceCancels === 1 && window.__voiceStartCount >= 4);
    ok('wake-word voice cancellation does not approve the action', await voice.evaluate(() => window.__voiceApprovals === 0));
    await click(voice, '#voice-app-permission'); await voice.waitForSelector('#confirm-action');
    ok('automatic opening requires separate informed session consent', (await text(voice)).includes('Anyone nearby or a recording'));
    await click(voice, '#confirm-action');
    await voice.evaluate(() => window.__voiceRecognition.say('Nova open firefox'));
    await voice.waitForFunction(() => window.__voiceApprovals === 1 && window.__voiceStartCount >= 5);
    ok('only after consent can a supported voice app request be approved', await voice.evaluate(() => window.__voiceMessages.length === 2 && window.__voiceApprovals === 1));
    await voice.evaluate(() => window.__voiceRecognition.say('Nova mouse click'));
    await voice.waitForFunction(() => window.__voiceMessages.length === 3 && window.__voiceStartCount >= 6);
    ok('mouse clicks are not auto-approved by app-only voice consent', await voice.evaluate(() => window.__voiceApprovals === 1));
    await voice.evaluate(() => window.__voiceRecognition.say('approve')); await voice.waitForFunction(() => window.__voiceStartCount >= 7);
    ok('approval without the wake word is ignored', await voice.evaluate(() => window.__voiceApprovals === 1));
    await voice.evaluate(() => window.__voiceRecognition.say('Nova approve')); await voice.waitForFunction(() => window.__voiceApprovals === 2 && window.__voiceStartCount >= 8);
    ok('a pending action can be approved by voice without a mouse', await voice.evaluate(() => window.__voiceApprovals === 2));
    // Hands-free project flow: fake browser speech and model; actual owner server,
    // sandbox and real Windows speech service are tested separately where possible.
    await voice.setRequestInterception(true);
    voice.on('request', request => {
      if (/\/builder\/projects\/[0-9a-f-]+\/preview$/.test(request.url())) request.respond({ status: 200, contentType: 'text/html', headers: { 'Content-Security-Policy': "sandbox allow-scripts; default-src 'none'" }, body: '<h1>Mock project preview</h1>' });
      else request.continue();
    });
    await voice.evaluate(() => {
      const baseFetch = window.fetch; window.__buildRequests = []; window.__revisionRequests = []; window.__revokeRequests = 0; window.__buildMode = 'success';
      const id1 = '11111111-1111-4111-8111-111111111111', id2 = '22222222-2222-4222-8222-222222222222';
      window.fetch = async (url, opts = {}) => {
        const target = String(url);
        if (target.endsWith('/builder/revoke-grant')) { window.__revokeRequests++; return new Response('{"ok":true}'); }
        if (target.endsWith('/builder/generate')) {
          window.__buildRequests.push(JSON.parse(opts.body));
          if (window.__buildMode === 'delay') return new Promise((resolve, reject) => opts.signal.addEventListener('abort', () => { window.__buildAborted = true; reject(new Error('aborted')); }, { once: true }));
          if (window.__buildMode === 'fail') return new Response(JSON.stringify({ ok: false, error: 'Mock provider failure' }));
          return new Response(JSON.stringify({ ok: true, project: { id: id1, name: 'Test site' }, grant: { token: 'a'.repeat(43), expiresAt: Date.now() + 900000, remaining: 2 } }));
        }
        if (target.endsWith('/builder/revise')) { window.__revisionRequests.push(JSON.parse(opts.body)); return new Response(JSON.stringify({ ok: true, project: { id: id2, name: 'Updated site' }, remaining: 1 })); }
        return baseFetch(url, opts);
      };
    });
    async function sayProject(command) {
      await voice.waitForFunction(() => window.__voiceListening === true, { timeout: 10000 });
      const starts = await voice.evaluate(() => window.__voiceStartCount);
      await voice.evaluate(c => window.__voiceRecognition.say(c), command);
      await voice.waitForFunction(n => window.__voiceStartCount > n && window.__voiceListening === true, { timeout: 15000 }, starts);
    }
    await sayProject('Nova chat mode on');
    ok('chat-only mode turns off app-opening consent', await voice.$eval('#voice-chat-only', e => e.getAttribute('aria-pressed')) === 'true' && (await text(voice)).includes('Allow voice app opening for this session'));
    await sayProject('Nova open firefox');
    ok('chat-only speech is marked and cannot auto-approve even if a response contains an action', await voice.evaluate(() => window.__lastChatBody?.conversationMode === 'chat' && window.__lastChatBody?.inputMode === 'voice' && window.__voiceApprovals === 2));
    await sayProject('Nova chat mode off');
    ok('chat-only mode can be ended by voice', await voice.$eval('#voice-chat-only', e => e.getAttribute('aria-pressed')) === 'false');
    const beforeAmbient = await voice.evaluate(() => window.__voiceMessages.length);
    await sayProject('আমি নোভাকে নিয়ে গল্প করছি');
    ok('a mid-sentence mention or Bengali name suffix does not trigger voice', await voice.evaluate(n => window.__voiceMessages.length === n, beforeAmbient));
    await sayProject('নোভা একটা bakery ওয়েবসাইট তৈরি করো');
    const projectPrompt = await text(voice);
    ok('Bengali website voice request asks scoped permission without stopping continuous voice', (projectPrompt.includes('two requested revisions') || projectPrompt.includes('দুটি পরিবর্তন')) && await voice.evaluate(() => window.__buildRequests.length === 0));
    await sayProject('Nova chat mode on');
    ok('chat-only mode refuses to start while project permission is pending', await voice.$eval('#voice-chat-only', e => e.getAttribute('aria-pressed')) === 'false' && await voice.evaluate(() => window.__buildRequests.length === 0));
    await sayProject('approve');
    ok('project approval without wake word cannot start work', await voice.evaluate(() => window.__buildRequests.length === 0));
    await sayProject('Nova do not approve');
    ok('ambiguous project approval cannot start work', await voice.evaluate(() => window.__buildRequests.length === 0));
    await sayProject('Nova cancel');
    ok('spoken cancellation of project approval starts nothing', await voice.evaluate(() => window.__buildRequests.length === 0));
    await sayProject('নোভা একটা bakery ওয়েবসাইট তৈরি করো');
    await sayProject('নোভা অনুমতি দিচ্ছি');
    await voice.waitForSelector('#voice-project-preview', { timeout: 15000 });
    const vframe = await (await voice.$('#voice-project-preview')).contentFrame(); await vframe.waitForSelector('h1');
    ok('spoken approval starts one build and a sandboxed preview', await voice.evaluate(() => window.__buildRequests.length === 1 && window.__buildRequests[0].confirm === true && window.__buildRequests[0].allowRevisions === true) && await voice.$eval('#voice-project-preview', el => el.getAttribute('sandbox')) === 'allow-scripts');
    await sayProject('নোভা ওয়েবসাইটের রঙ নীল করো');
    await voice.waitForFunction(() => window.__revisionRequests.length === 1 && document.querySelector('#voice-project-result')?.textContent.includes('Updated site'));
    ok('one scoped voice permission allows an explicitly requested revision', await voice.evaluate(() => window.__revisionRequests[0].projectId === '11111111-1111-4111-8111-111111111111'));
    await voice.evaluate(() => { window.__buildMode = 'delay'; });
    await sayProject('Nova build a second website'); await sayProject('Nova approve');
    await voice.waitForFunction(() => window.__buildRequests.length === 2);
    const chatsBeforeDuplicate = await voice.evaluate(() => window.__voiceMessages.length);
    await sayProject('Nova build another website');
    ok('a running voice project does not start a duplicate or fall through to chat', await voice.evaluate(n => window.__buildRequests.length === 2 && window.__voiceMessages.length === n, chatsBeforeDuplicate));
    await sayProject('Nova stop project');
    await voice.waitForFunction(() => window.__buildAborted === true);
    ok('voice stop aborts project request and reports save race honestly', (await text(voice)).includes('save already in progress may finish'));
    await voice.evaluate(() => { window.__buildMode = 'fail'; });
    await sayProject('Nova build a failed website'); await sayProject('Nova approve');
    await voice.waitForFunction(() => document.querySelector('#voice-project-result')?.textContent.includes('Mock provider failure'));
    ok('project provider error is shown instead of claiming success', (await text(voice)).includes('Mock provider failure'));
    await sayProject('Nova build an expired website');
    await voice.evaluate(() => { window.__realNow = Date.now; Date.now = () => window.__realNow() + 61000; });
    await sayProject('Nova approve');
    await voice.evaluate(() => { Date.now = window.__realNow; });
    ok('expired spoken approval cannot start work', await voice.evaluate(() => window.__buildRequests.length === 3));
    await voice.evaluate(() => window.__voiceRecognition.say('Nova news alerts on'));
    await voice.waitForFunction(() => document.querySelector('#voice-news-proof a')?.href === 'https://www.bbc.com/news/alert-test', { timeout: 15000 });
    ok('new relevant report is announced with its source link and emergency disclaimer', await voice.evaluate(() => window.__voiceSpoken.some(t => t.includes('World war fears in test report') && /not an official emergency alert/i.test(t))));
    await sleep(400); ok('unchanged news is not announced repeatedly', await voice.evaluate(() => window.__voiceSpoken.filter(t => t.includes('World war fears in test report')).length === 1));
    await voice.waitForFunction(() => window.__voiceListening === true, { timeout: 10000 });
    const beforeRetry = await voice.evaluate(() => window.__voiceStartCount);
    await voice.evaluate(() => { window.__voiceRecognition.onerror?.({ error: 'network' }); window.__voiceRecognition.stop(); });
    await voice.waitForFunction(count => window.__voiceStartCount > count && window.__voiceListening, { timeout: 10000 }, beforeRetry);
    ok('temporary speech network failure retries without turning off the voice session', await voice.$eval('[data-action="continuous-voice"]', el => el.getAttribute('aria-pressed') === 'true'));
    await voice.evaluate(() => window.__voiceRecognition.say('Nova stop listening'));
    await voice.waitForFunction(() => document.querySelector('[data-action="continuous-voice"]')?.getAttribute('aria-pressed') === 'false');
    ok('voice stop clears session app-opening permission and news monitoring', (await text(voice)).includes('Allow voice app opening for this session') && (await text(voice)).includes('News alerts are off'));
    await voice.close();
    ok('no uncaught browser errors', errors.length === 0, errors.join(' | '));
  } finally {
    if (browser) { const child = browser.process(); await Promise.race([browser.close().catch(() => {}), sleep(5000).then(() => child?.kill('SIGKILL'))]); }
    server.kill('SIGTERM'); await new Promise(r => { if (server.exitCode !== null) return r(); server.once('exit', r); setTimeout(r, 3000); });
    fs.rmSync(dir, { recursive: true, force: true });
  }
  const failed = results.filter(x => !x).length;
  console.log(`\n${results.length - failed}/${results.length} UI checks passed.`);
  if (failed) process.exitCode = 1;
})().catch(e => { console.error(e); process.exitCode = 1; });
