'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { PassThrough, Writable } = require('node:stream');
const { createNativeVoice, wakeText, speechText } = require('../src/nova/native-voice');
const { nativeVoiceArgs } = require('../src/nova/native-voice-script');
const delay = n => new Promise(r => setTimeout(r, n));
function fakeChild({ autoExit = true } = {}) {
  const child = new EventEmitter(); child.stdout = new PassThrough(); child.messages = []; child.killed = false;
  child.stdin = new Writable({ write(chunk, encoding, done) { child.messages.push(...chunk.toString().trim().split('\n').map(JSON.parse)); done(); }, final(done) { if (autoExit) setImmediate(() => child.emit('exit', 0)); done(); } });
  child.kill = () => { child.killed = true; setImmediate(() => child.emit('exit', 0)); return true; };
  child.send = obj => child.stdout.write(JSON.stringify(obj) + '\n');
  return child;
}
function harness(overrides = {}) {
  let child, spawned = 0, valid = true, spawnInfo;
  const utterances = [];
  const manager = createNativeVoice({ platform: 'win32', systemRoot: 'C:\\Windows', readyMs: 50, stopMs: 30, sessionCheckMs: 10,
    spawnChild: (...args) => { spawned++; spawnInfo = args; child = fakeChild(overrides); return child; },
    sessionActive: () => valid,
    onUtterance: async x => { utterances.push(x); return overrides.answer ? overrides.answer(x) : 'Hello!'; }, ...overrides.manager });
  return { manager, utterances, get child() { return child; }, get spawned() { return spawned; }, get spawnInfo() { return spawnInfo; }, invalidate() { valid = false; } };
}
async function started(h, language = 'en-US') {
  const pending = h.manager.start('w', 'hash', language); h.child.send({ type: 'ready', language }); assert.equal((await pending).ok, true);
}
function decodedSay(child) { const m = child.messages.filter(x => x.type === 'say').at(-1); return m && Buffer.from(m.text64, 'base64').toString('utf8'); }

test('static worker is restricted to supported languages, no interpolated commands', () => {
  assert.throws(() => nativeVoiceArgs('en-US;evil'));
  const script = Buffer.from(nativeVoiceArgs('bn-BD').at(-1), 'base64').toString('utf16le');
  assert.match(script, /NotifyIcon/); assert.match(script, /InstalledRecognizers/); assert.match(script, /OpenStandardInput/); assert.match(script, /bn-BD/); assert.match(script, /\^\\s\*/);
  assert.ok(script.indexOf('$icon.Visible = $true') < script.indexOf('SetInputToDefaultAudioDevice'));
});
test('wake prefix, sanitization and no false subsequence wake', () => {
  assert.equal(wakeText('hello Nova'), null); assert.equal(wakeText('supernova go'), null); assert.equal(wakeText('Nova, hello'), 'hello'); assert.equal(wakeText('নোভা, কেমন আছো'), 'কেমন আছো');
  assert.ok(speechText('x'.repeat(2000), 'en-US').length <= 651); assert.doesNotMatch(speechText('source https://example.com [N1]', 'en-US'), /https|\[N1\]/);
});
test('opt-in, OS, language, owner session and duplicate start restrictions', async () => {
  const h = harness(); h.invalidate(); assert.equal((await h.manager.start('w', 'h', 'en-US')).ok, false); assert.equal(h.spawned, 0);
  const other = createNativeVoice({ platform: 'linux', onUtterance() {}, sessionActive: () => true }); assert.equal((await other.start('w', 'h', 'en-US')).ok, false);
  const valid = harness(); assert.equal((await valid.manager.start('w', 'h', 'xx')).ok, false); assert.equal(valid.spawned, 0);
  await started(valid); assert.equal((await valid.manager.start('w', 'h', 'en-US')).ok, false); assert.equal(valid.manager.status('other').state, 'off');
  assert.equal(valid.spawnInfo[2].shell, false); assert.equal(valid.spawnInfo[2].env.NOVA_AI_API_KEY, undefined); assert.ok(!JSON.stringify(valid.spawnInfo).includes('hash')); valid.manager.close(); await delay(5);
});
test('wake gate, secrets and rate bounds keep transcripts away from AI', async () => {
  const h = harness(); await started(h);
  h.child.send({ type: 'heard', text: 'just talking', confidence: 0.9 }); await delay(2); assert.equal(h.utterances.length, 0); assert.match(decodedSay(h.child), /understand/);
  h.child.send({ type: 'turn-ready' }); h.child.send({ type: 'heard', text: 'Nova my password is private', confidence: 0.9 }); await delay(2); assert.equal(h.utterances.length, 0); assert.match(decodedSay(h.child), /passwords/);
  h.child.send({ type: 'turn-ready' }); h.child.send({ type: 'heard', text: 'Nova how are you', confidence: 0.9 }); await delay(2); assert.equal(h.utterances[0].text, 'how are you'); assert.equal(decodedSay(h.child), 'Hello!');
  h.child.send({ type: 'turn-ready' }); h.child.send({ type: 'heard', text: 'Nova stop listening', confidence: 0.9 }); await delay(5); assert.equal(h.manager.status('w').state, 'off'); assert.equal(h.utterances.length, 1);
});
test('stopping or revoking during async request never speaks the late reply', async () => {
  let complete; const h = harness({ answer: () => new Promise(r => { complete = r; }) }); await started(h);
  h.child.send({ type: 'heard', text: 'Nova hello', confidence: 0.9 }); await delay(2); assert.equal(h.manager.status('w').state, 'thinking'); h.invalidate(); complete('late reply'); await delay(20);
  assert.equal(h.child.messages.some(m => m.type === 'say'), false); assert.equal(h.manager.status('w').state, 'off');
});
test('missing recognizer, timeout, unexpected exit and kill fallback are visible and bounded', async () => {
  const h = harness(); let pending = h.manager.start('w', 'h', 'bn-BD'); h.child.send({ type: 'error', code: 'NO_RECOGNIZER' }); assert.match((await pending).error, /recognizer/); await delay(5); assert.match(h.manager.status('w').error, /recognizer/);
  const timed = harness({ autoExit: false }); pending = timed.manager.start('w', 'h', 'en-US'); await delay(60); assert.match((await pending).error, /time/); await delay(40); assert.equal(timed.child.killed, true); assert.equal(timed.manager.status('w').state, 'off');
  const gone = harness(); await started(gone); gone.child.emit('exit', 1); assert.match(gone.manager.status('w').error, /could not start/);
});

test('local owner consent, chat-only storage and workspace shutdown through API', async () => {
  const fs = require('node:fs'); const os = require('node:os'); const path = require('node:path');
  const express = require('express'); const cookies = require('cookie-parser'); const { createNovaRouter } = require('../src/nova/router');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nova-native-api-')); let child, calls = 0;
  const n = createNovaRouter({ dataDir: dir, nativeVoiceOptions: { platform: 'win32', systemRoot: 'C:\\Windows', spawnChild: () => { calls++; child = fakeChild(); setImmediate(() => child.send({ type: 'ready', language: 'en-US' })); return child; }, stopMs: 50, sessionCheckMs: 10 } });
  const app = express(); app.use(express.json()); app.use(cookies()); app.use('/api/nova', n.router);
  const server = await new Promise(r => { const s = app.listen(0, '127.0.0.1', () => r(s)); });
  const origin = `http://127.0.0.1:${server.address().port}`, base = origin + '/api/nova';
  async function req(route, { token, method = 'GET', body, headers = {} } = {}) {
    const res = await fetch(base + route, { method, headers: { 'Content-Type': 'application/json', Origin: origin, ...(token ? { 'X-Nova-Session': token } : {}), ...headers }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) }); return { status: res.status, data: await res.json() };
  }
  try {
    const owner = (await req('/session', { method: 'POST', body: {} })).data.token;
    const ownerRow = n.store.session(owner), remote = n.store.createSession(ownerRow.workspace_id, 'remote').token;
    assert.equal((await req('/native-voice/start', { method: 'POST', token: remote, body: { confirm: true, language: 'en-US' } })).status, 403);
    assert.equal((await req('/native-voice/start', { method: 'POST', token: owner, body: { language: 'en-US' } })).status, 400);
    assert.equal((await req('/native-voice/start', { method: 'POST', token: owner, body: { confirm: true, language: 'en-US' }, headers: { 'x-forwarded-for': '1.2.3.4' } })).status, 403);
    assert.equal(calls, 0);
    let result = await req('/native-voice/start', { method: 'POST', token: owner, body: { confirm: true, language: 'en-US' } }); assert.equal(result.data.ok, true);
    assert.equal((await req('/sync', { token: owner })).data.nativeVoice.state, 'listening');
    assert.equal((await req('/native-voice/stop', { method: 'POST', token: remote, body: {} })).status, 403);
    child.send({ type: 'heard', text: 'Nova open notepad', confidence: 0.9 }); await delay(10);
    assert.equal(n.store.actions(ownerRow.workspace_id).length, 0); assert.equal(n.store.memories(ownerRow.workspace_id).length, 0);
    assert.equal(n.store.messages(ownerRow.workspace_id).length, 2); assert.match(decodedSay(child), /chat-only/i);
    child.send({ type: 'turn-ready' }); child.send({ type: 'heard', text: 'Nova remember my name is Alice', confidence: 0.9 }); await delay(10);
    assert.equal(n.store.memories(ownerRow.workspace_id).length, 0);
    result = await req('/workspace', { method: 'DELETE', token: owner, body: { confirmation: 'DELETE' } }); assert.equal(result.data.ok, true); await delay(10);
    assert.ok(child.messages.some(x => x.type === 'stop'));
  } finally { n.close(); await new Promise(r => server.close(r)); n.store.close(); fs.rmSync(dir, { recursive: true, force: true }); }
});

test('native AI gets chat context; stopping during a reply prevents storing it', async () => {
  const fs = require('node:fs'); const os = require('node:os'); const path = require('node:path');
  const express = require('express'); const cookies = require('cookie-parser'); const { createNovaRouter } = require('../src/nova/router');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nova-native-ai-')); const oldFetch = global.fetch, oldKey = process.env.NOVA_AI_API_KEY, oldProvider = process.env.NOVA_AI_PROVIDER;
  process.env.NOVA_AI_API_KEY = 'fixture'; process.env.NOVA_AI_PROVIDER = 'groq'; let child, sent = [], release;
  global.fetch = async (url, options) => {
    if (!String(url).startsWith('https://api.groq.com/')) return oldFetch(url, options);
    sent.push(JSON.parse(options.body));
    if (sent.length === 2) await new Promise(r => { release = r; });
    return Response.json({ choices: [{ message: { content: 'A friendly reply.' } }] });
  };
  const n = createNovaRouter({ dataDir: dir, nativeVoiceOptions: { platform: 'win32', systemRoot: 'C:\\Windows', spawnChild: () => { child = fakeChild(); setImmediate(() => child.send({ type: 'ready', language: 'en-US' })); return child; } } });
  const app = express(); app.use(express.json()); app.use(cookies()); app.use('/api/nova', n.router);
  const server = await new Promise(r => { const s = app.listen(0, '127.0.0.1', () => r(s)); });
  const origin = `http://127.0.0.1:${server.address().port}`, base = origin + '/api/nova';
  async function req(route, token, body) { const res = await fetch(base + route, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: origin, ...(token ? { 'X-Nova-Session': token } : {}) }, body: JSON.stringify(body) }); return res.json(); }
  try {
    const owner = (await req('/session', null, {})).token, workspace = n.store.session(owner).workspace_id;
    n.store.addMessage(workspace, 'user', 'I enjoy reading'); n.store.addMemory(workspace, 'My name is Alice');
    assert.equal((await req('/native-voice/start', owner, { confirm: true, language: 'en-US' })).ok, true);
    child.send({ type: 'heard', text: 'Nova tell me a joke', confidence: 0.9 }); await delay(30);
    assert.equal(sent.length, 1); assert.match(JSON.stringify(sent[0]), /I enjoy reading/); assert.match(JSON.stringify(sent[0]), /My name is Alice/); assert.match(decodedSay(child), /friendly reply/);
    child.send({ type: 'turn-ready' }); child.send({ type: 'heard', text: 'Nova another joke', confidence: 0.9 });
    for (let i = 0; i < 50 && !release; i++) await delay(5);
    assert.ok(release); const count = n.store.messages(workspace).length;
    await req('/native-voice/stop', owner, {}); release(); await delay(30);
    assert.equal(n.store.messages(workspace).length, count); assert.equal(child.messages.filter(x => x.type === 'say').length, 1);
  } finally {
    n.close(); await new Promise(r => server.close(r)); n.store.close(); fs.rmSync(dir, { recursive: true, force: true }); global.fetch = oldFetch;
    if (oldKey === undefined) delete process.env.NOVA_AI_API_KEY; else process.env.NOVA_AI_API_KEY = oldKey;
    if (oldProvider === undefined) delete process.env.NOVA_AI_PROVIDER; else process.env.NOVA_AI_PROVIDER = oldProvider;
  }
});
