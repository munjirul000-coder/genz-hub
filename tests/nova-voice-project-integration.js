'use strict';
// Chromium + real isolated NOVA server and storage; mock only speech and Groq.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const net = require('node:net');
const { spawn } = require('node:child_process');
const puppeteer = require('puppeteer');
const root = path.join(__dirname, '..');
async function freePort() { const s = net.createServer(); await new Promise(r => s.listen(0, '127.0.0.1', r)); const p = s.address().port; await new Promise(r => s.close(r)); return p; }
(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nova-voice-real-')); const port = await freePort();
  const server = spawn(process.execPath, ['src/server.js'], { cwd: root, env: { ...process.env, PORT: String(port), DATA_DIR: dir, NODE_ENV: 'test', NODE_OPTIONS: '--require ' + path.join(__dirname, 'fixtures/nova-mock-groq.js') }, stdio: ['ignore', 'pipe', 'pipe'] });
  let browser;
  try {
    await new Promise((resolve, reject) => { const timeout = setTimeout(() => reject(new Error('server did not start')), 20000); server.stdout.on('data', data => { if (String(data).includes('Gen-Z Hub running')) { clearTimeout(timeout); resolve(); } }); server.once('exit', () => { clearTimeout(timeout); reject(new Error('server exited')); }); });
    console.log('Server started');
    let executablePath = puppeteer.executablePath(), args = ['--no-sandbox', '--disable-dev-shm-usage'];
    if (!fs.existsSync(executablePath)) { const { default: chromium, inflate } = await import('@sparticuz/chromium'); await inflate(path.join(root, 'node_modules/@sparticuz/chromium/bin/al2023.tar.br')); process.env.LD_LIBRARY_PATH = '/tmp/al2023/lib:' + (process.env.LD_LIBRARY_PATH || ''); executablePath = await chromium.executablePath(); args = chromium.args.filter(a => !['--disable-web-security', '--allow-running-insecure-content', '--single-process'].includes(a)); }
    browser = await puppeteer.launch({ headless: true, executablePath, args });
    console.log('Browser started');
    const page = await browser.newPage(); await page.setViewport({ width: 1000, height: 800 });
    await page.goto(`http://127.0.0.1:${port}/nova?voice=1#conversation`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('[data-action="continuous-voice"]');
    const connect = await page.evaluate(async () => {
      const r = await fetch('/api/nova/ai/connect', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-GenZ-Client': '1', 'X-Nova-Session': sessionStorage.getItem('nova.token') }, body: JSON.stringify({ apiKey: 'gsk_test_key_abcdefghijklmnopqrstuvwxyz' }) }); return r.json();
    });
    assert.equal(connect.ok, true, JSON.stringify(connect)); console.log('Connected mock provider');
    await page.evaluate(() => {
      window.__listen = false; window.__starts = 0; window.__spoken = [];
      window.SpeechRecognition = class {
        start() { window.__rec = this; window.__listen = true; window.__starts++; }
        stop() { window.__listen = false; setTimeout(() => this.onend?.(), 0); }
        abort() { this.stop(); }
        say(text) { this.onresult?.({ results: [Object.assign([{ transcript: text }], { isFinal: true })] }); }
      };
      window.SpeechSynthesisUtterance = class { constructor(text) { this.text = text; } };
      speechSynthesis.getVoices = () => [{ voiceURI: 'bn-test', lang: 'bn-BD', name: 'Test' }, { voiceURI: 'en-test', lang: 'en-US', name: 'Test' }];
      speechSynthesis.speak = u => { window.__spoken.push(u.text); setTimeout(() => u.onend?.(), 1); };
    });
    await page.click('[data-action="continuous-voice"]');
    const say = async text => {
      await page.waitForFunction(() => window.__listen, { timeout: 15000 }); const count = await page.evaluate(() => window.__starts);
      await page.evaluate(t => window.__rec.say(t), text);
      await page.waitForFunction(n => window.__listen && window.__starts > n, { timeout: 15000 }, count);
    };
    const list = () => page.evaluate(async () => (await (await fetch('/api/nova/builder/projects', { headers: { 'X-Nova-Session': sessionStorage.getItem('nova.token') } })).json()).projects);
    await say('নোভা একটা bakery ওয়েবসাইট তৈরি করো'); assert.equal((await list()).length, 0); console.log('Request requires approval');
    await say('নোভা অনুমতি দিচ্ছি');
    await page.waitForSelector('#voice-project-preview', { timeout: 15000 });
    let frame = await (await page.$('#voice-project-preview')).contentFrame();
    await frame.waitForFunction(() => document.querySelector('h1')?.textContent === 'Original bakery' && document.body.dataset.ready === 'yes');
    assert.equal((await list()).length, 1); console.log('Saved and previewed first project');
    await say('নোভা ওয়েবসাইটের রঙ নীল করো');
    await page.waitForFunction(() => document.querySelector('#voice-project-result')?.textContent.includes('Revision:'), { timeout: 15000 });
    frame = await (await page.$('#voice-project-preview')).contentFrame();
    await frame.waitForFunction(() => document.querySelector('h1')?.textContent === 'Revised bakery');
    assert.equal((await list()).length, 2); console.log('Saved and previewed revision');
    await page.waitForFunction(() => window.__spoken.filter(t => /সংরক্ষণ করেছি|static project was saved/.test(t)).length >= 2, { timeout: 15000 });
    await page.waitForFunction(() => window.__listen, { timeout: 15000 });
    await say('নোভা SLOW_FIXTURE ওয়েবসাইট তৈরি করো'); await say('নোভা অনুমতি দিচ্ছি');
    await page.waitForFunction(() => document.querySelector('#voice-project-result')?.textContent.includes('Building'), { timeout: 12000 });
    await say('নোভা কাজ বন্ধ করো');
    await page.waitForFunction(() => document.querySelector('#voice-project-result')?.textContent.includes('save already in progress'));
    assert.equal((await list()).length, 2);
    console.log('PASS real server: Bengali spoken approval, saved three-file project, sandbox preview, spoken revision and cancellable work (mocked speech + Groq)');
  } finally {
    if (browser) await browser.close();
    server.kill('SIGTERM'); await new Promise(r => { if (server.exitCode !== null) return r(); server.once('exit', r); setTimeout(r, 3000); });
    fs.rmSync(dir, { recursive: true, force: true });
  }
})().catch(err => { console.error(err); process.exitCode = 1; });
