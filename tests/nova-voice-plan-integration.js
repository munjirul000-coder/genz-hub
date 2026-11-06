'use strict';
// Real NOVA server/API + SQLite + real Chromium. Only Groq and browser speech
// are mocked; the bridge protocol is exercised using a simulated Windows agent.
const assert = require('node:assert/strict');
const fs = require('node:fs'); const os = require('node:os'); const path = require('node:path'); const net = require('node:net');
const { spawn } = require('node:child_process'); const puppeteer = require('puppeteer');
const root = path.join(__dirname, '..');
async function freePort() { const s = net.createServer(); await new Promise(r => s.listen(0, '127.0.0.1', r)); const port = s.address().port; await new Promise(r => s.close(r)); return port; }
(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nova-voice-plan-')); const port = await freePort();
  const server = spawn(process.execPath, ['src/server.js'], { cwd: root, env: { ...process.env, PORT: String(port), DATA_DIR: dir, NODE_ENV: 'test', DISABLE_RATE_LIMIT: '1', NODE_OPTIONS: '--require ' + path.join(__dirname, 'fixtures/nova-mock-groq.js') }, stdio: ['ignore', 'pipe', 'pipe'] }); let browser;
  try {
    await new Promise((resolve, reject) => { const timer = setTimeout(() => reject(Error('server startup timeout')), 20000); server.stdout.on('data', b => { if (String(b).includes('Gen-Z Hub running')) { clearTimeout(timer); resolve(); } }); server.once('exit', () => { clearTimeout(timer); reject(Error('server exited')); }); });
    let executablePath = puppeteer.executablePath(), args = ['--no-sandbox', '--disable-dev-shm-usage'];
    if (!fs.existsSync(executablePath)) { const { default: chromium, inflate } = await import('@sparticuz/chromium'); await inflate(path.join(root, 'node_modules/@sparticuz/chromium/bin/al2023.tar.br')); process.env.LD_LIBRARY_PATH = '/tmp/al2023/lib:' + (process.env.LD_LIBRARY_PATH || ''); executablePath = await chromium.executablePath(); args = chromium.args.filter(a => !['--disable-web-security', '--allow-running-insecure-content', '--single-process'].includes(a)); }
    browser = await puppeteer.launch({ headless: true, executablePath, args }); const page = await browser.newPage(); const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(`http://127.0.0.1:${port}/nova?voice=1#conversation`, { waitUntil: 'domcontentloaded' }); await page.waitForSelector('[data-action="continuous-voice"]');
    await page.evaluate(() => {
      window.__heard = false; window.__starts = 0; window.__spoken = []; window.__planRequests = 0; window.__approveRequests = 0; window.__stopRequests = 0;
      const realFetch = window.fetch;
      window.fetch = (url, options = {}) => {
        if (String(url).endsWith('/goal-plans') && options.method === 'POST') window.__planRequests++;
        if (String(url).includes('/goal-plans/') && String(url).endsWith('/approve')) window.__approveRequests++;
        if (String(url).includes('/goal-plans/') && String(url).endsWith('/stop')) window.__stopRequests++;
        return realFetch(url, options);
      };
      window.SpeechRecognition = class { start() { window.__rec = this; window.__heard = true; window.__starts++; } stop() { window.__heard = false; setTimeout(() => this.onend?.(), 0); } abort() { this.stop(); } say(text) { this.onresult?.({ results: [Object.assign([{ transcript: text }], { isFinal: true })] }); } };
      window.SpeechSynthesisUtterance = class { constructor(text) { this.text = text; } };
      speechSynthesis.getVoices = () => [{ voiceURI: 'bn-test', lang: 'bn-BD', name: 'Test' }, { voiceURI: 'en-test', lang: 'en-US', name: 'Test' }];
      speechSynthesis.speak = u => { window.__spoken.push(u.text); setTimeout(() => u.onend?.(), 1); };
    });
    const setup = await page.evaluate(async () => {
      const headers = { 'Content-Type': 'application/json', 'X-GenZ-Client': '1', 'X-Nova-Session': sessionStorage.getItem('nova.token') };
      const ai = await (await fetch('/api/nova/ai/connect', { method: 'POST', headers, body: JSON.stringify({ apiKey: 'gsk_test_key_abcdefghijklmnopqrstuvwxyz' }) })).json();
      const bridge = await (await fetch('/api/nova/bridge/token', { method: 'POST', headers, body: '{}' })).json();
      return { ai: ai.ok, token: bridge.token };
    }); assert.equal(setup.ai, true); const bridgeToken = setup.token;
    async function bridge(route, body) { const r = await fetch(`http://127.0.0.1:${port}/api/nova/bridge/${route}`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-GenZ-Client': '1', Authorization: 'Bearer ' + bridgeToken }, body: JSON.stringify(body) }); assert.equal(r.status, 200); return r.json(); }
    await bridge('poll', {}); await page.click('[data-action="continuous-voice"]');
    const say = async value => { await page.waitForFunction(() => window.__heard, { timeout: 15000 }); const count = await page.evaluate(() => window.__starts); await page.evaluate(t => window.__rec.say(t), value); await page.waitForFunction(n => window.__heard && window.__starts > n, { timeout: 15000 }, count); };
    const actions = () => page.evaluate(async () => (await (await fetch('/api/nova/state', { headers: { 'X-Nova-Session': sessionStorage.getItem('nova.token') } })).json()).actions);
    const spoken = sub => page.waitForFunction(t => window.__spoken.some(x => x.includes(t)), { timeout: 15000 }, sub);
    await say('নোভা পরিকল্পনা করো আমার কাজ শুরু'); await spoken('পরিকল্পনার অনুমতি দিচ্ছি');
    assert.equal(await page.evaluate(() => window.__planRequests), 0); assert.equal((await actions()).length, 0);
    await say('নোভা অনুমতি দিচ্ছি'); assert.equal(await page.evaluate(() => window.__planRequests), 0);
    await say('নোভা পরিকল্পনার অনুমতি দিচ্ছি'); await spoken('Open Notepad');
    let list = await actions(); assert.equal(list.length, 1); assert.equal(list[0].status, 'pending'); assert.equal(list[0].kind, 'open_notepad');
    await say('approve this step'); assert.equal(await page.evaluate(() => window.__approveRequests), 0);
    await say('নোভা অনুমতি দিচ্ছি'); assert.equal(await page.evaluate(() => window.__approveRequests), 0);
    // A status request may be in flight when consent arrives. It must be
    // aborted/ignored rather than overwrite the just-approved state.
    await page.evaluate(() => {
      const original = window.fetch; window.__pollBaseFetch = original; window.__holdPoll = true;
      window.fetch = (url, opts = {}) => {
        if (window.__holdPoll && /\/goal-plans\/[^/]+$/.test(String(url)) && (opts.method || 'GET') === 'GET') {
          window.__holdPoll = false; window.__pollHeld = true;
          return new Promise((resolve, reject) => opts.signal.addEventListener('abort', () => { window.__pollAborted = true; reject(new DOMException('Aborted', 'AbortError')); }, { once: true }));
        }
        return original(url, opts);
      };
    });
    await page.waitForFunction(() => window.__pollHeld, { timeout: 10000 });
    await say('নোভা এই ধাপ অনুমোদন করো'); await spoken('Agent এর ফলের অপেক্ষায়');
    assert.equal(await page.evaluate(() => window.__pollAborted), true); await page.evaluate(() => { window.fetch = window.__pollBaseFetch; });
    assert.equal(await page.evaluate(() => window.__approveRequests), 1); let job = (await bridge('poll', {})).action; assert.equal(job.kind, 'open_notepad');
    await bridge('result', { id: job.id, ok: true, result: 'Notepad opened.' }); await spoken('System information');
    assert.ok(await page.evaluate(() => window.__spoken.some(x => x.includes('Notepad opened.'))));
    list = await actions(); assert.equal(list.find(x => x.kind === 'system_info').status, 'pending');
    await say('নোভা এই ধাপ অনুমোদন করো'); job = (await bridge('poll', {})).action; assert.equal(job.kind, 'system_info');
    await bridge('result', { id: job.id, ok: true, result: 'System information received.' }); await spoken('Write your own notes');
    await say('নোভা আমি এই ধাপ শেষ করেছি'); await spoken('পুরো লক্ষ্য স্বাধীনভাবে যাচাই করা হয়নি');
    assert.equal(await page.evaluate(() => window.__approveRequests), 2); console.log('PASS: spoken consent, separate fixed-action approval, agent results and unverified manual step');

    await say('নোভা পরিকল্পনা করো আরেকটি কাজ'); await say('নোভা পরিকল্পনার অনুমতি দিচ্ছি');
    await page.waitForFunction(() => document.querySelector('#voice-plan-result')?.innerText.includes('Actual fixed action: Open Notepad'), { timeout: 15000 });
    await page.waitForFunction(() => window.__heard); await say('নোভা পরিকল্পনা বন্ধ করো');
    assert.ok(await page.evaluate(() => window.__stopRequests >= 1)); list = await actions(); assert.ok(list.some(x => x.kind === 'open_notepad' && x.status === 'cancelled'));
    assert.equal((await bridge('poll', {})).action, null); console.log('PASS: stop cancels a prepared step');

    const before = await page.evaluate(() => window.__planRequests);
    await say('নোভা পরিকল্পনা করো SLOW_PLAN_FIXTURE'); await say('নোভা পরিকল্পনার অনুমতি দিচ্ছি');
    await page.waitForFunction(n => window.__planRequests > n, { timeout: 10000 }, before);
    await say('নোভা পরিকল্পনা বন্ধ করো'); assert.equal((await bridge('poll', {})).action, null);
    await say('নোভা পরিকল্পনা করো পাসওয়ার্ড গোপন'); assert.equal(await page.evaluate(() => window.__planRequests), before + 1);
    console.log('PASS: stopping in-flight planning and secret keyword rejection');
    const beforeFailure = await page.evaluate(() => window.__planRequests); const cancelledBefore = (await actions()).filter(x => x.kind === 'open_notepad' && x.status === 'cancelled').length;
    await page.evaluate(() => { window.__goodSpeech = speechSynthesis.speak; speechSynthesis.speak = u => { if (u.text.includes('Open Notepad')) setTimeout(() => u.onerror?.({ error: 'synthesis-failed' }), 1); else window.__goodSpeech(u); }; });
    await say('নোভা পরিকল্পনা করো একটি নতুন কাজ'); await say('নোভা পরিকল্পনার অনুমতি দিচ্ছি');
    await page.waitForFunction(() => document.querySelector('#voice-plan-result')?.innerText.includes('Voice output was unavailable'), { timeout: 15000 });
    await page.waitForFunction(() => window.__heard);
    const afterFailure = await actions(); assert.equal(afterFailure.filter(x => x.kind === 'open_notepad' && x.status === 'cancelled').length, cancelledBefore + 1);
    assert.equal(await page.evaluate(() => window.__planRequests), beforeFailure + 1); assert.equal(await page.evaluate(() => window.__approveRequests), 2);
    assert.equal((await bridge('poll', {})).action, null); await page.evaluate(() => { speechSynthesis.speak = window.__goodSpeech; });
    console.log('PASS: interrupted action announcement cancels without voice approval');
    assert.deepEqual(errors, []);
  } finally { if (browser) await browser.close(); server.kill('SIGTERM'); await new Promise(r => { if (server.exitCode !== null) return r(); server.once('exit', r); setTimeout(r, 3000); }); fs.rmSync(dir, { recursive: true, force: true }); }
})().catch(e => { console.error(e); process.exitCode = 1; });
