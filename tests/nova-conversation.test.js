'use strict';
process.env.DISABLE_RATE_LIMIT = '1'; process.env.NODE_ENV = 'test';
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'); const os = require('node:os'); const path = require('node:path');
const express = require('express'); const cookieParser = require('cookie-parser');
const { createNovaRouter } = require('../src/nova/router');
const { Vault } = require('../src/nova/vault');
const { respond, actionIntent, worldIntent } = require('../src/nova/assistant');
let nova, server, base, dir;
before(async () => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nova-friend-test-')); nova = createNovaRouter({ dataDir: dir });
  const app = express(); app.use(express.json()); app.use(cookieParser()); app.use('/api/nova', nova.router);
  await new Promise(resolve => { server = app.listen(0, '127.0.0.1', resolve); }); base = `http://127.0.0.1:${server.address().port}/api/nova`;
});
after(async () => { await new Promise(r => server.close(r)); nova.close(); nova.store.close(); fs.rmSync(dir, { recursive: true, force: true }); });
async function req(route, token, body) {
  const response = await fetch(base + route, { method: body === undefined ? 'GET' : 'POST', headers: { 'Content-Type': 'application/json', 'X-GenZ-Client': '1', 'X-Nova-Session': token }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  return { status: response.status, data: await response.json() };
}
function newOwner() {
  const ws = nova.store.createWorkspace(); const vault = new Vault(dir);
  nova.store.saveAiProvider(ws.workspaceId, { provider: 'groq', model: 'llama-3.3-70b-versatile', base_url: 'https://api.groq.com/openai/v1', ...vault.encrypt('gsk_fixture_abcdefghijklmnopqrstuvwxyz', ws.workspaceId) }); return ws;
}

test('natural conversation uses recent owner-only history and memories, with short spoken Bengali style', async () => {
  const owner = newOwner(), other = newOwner(), original = global.fetch, requests = [];
  nova.store.addMemory(owner.workspaceId, 'আমি ক্রিকেট পছন্দ করি');
  nova.store.addMemory(other.workspaceId, 'অন্য ব্যক্তির গোপন পছন্দ');
  global.fetch = async (url, options) => {
    if (!String(url).startsWith('https://api.groq.com/')) return original(url, options);
    const body = JSON.parse(options.body); requests.push(body);
    return Response.json({ choices: [{ message: { content: requests.length === 1 ? 'চলো গল্প করি! ক্রিকেটের কোন দলটা ভালো লাগে?' : 'ও, বাংলাদেশ দল! শেষ কোন ম্যাচটা দেখেছ?' }, finish_reason: 'stop' }] });
  };
  try {
    const one = await req('/chat', owner.token, { message: 'চলো ক্রিকেট নিয়ে আড্ডা দিই', inputMode: 'voice' });
    const two = await req('/chat', owner.token, { message: 'বাংলাদেশ দল', inputMode: 'voice' });
    assert.equal(one.data.engine, 'cloud'); assert.equal(two.data.engine, 'cloud');
    assert.match(two.data.message.content, /বাংলাদেশ দল/); assert.equal(two.data.action, null); assert.equal(two.data.memory, null);
    assert.equal(requests.length, 2);
    const sys = requests[1].messages[0].content;
    assert.match(sys, /friendly, respectful AI companion/); assert.match(sys, /one to three natural, speakable sentences/);
    assert.match(sys, /Do not encourage exclusivity/); assert.match(sys, /Do not ask for passwords or API keys/);
    assert.match(sys, /ক্রিকেট পছন্দ করি/); assert.doesNotMatch(sys, /অন্য ব্যক্তির গোপন পছন্দ/);
    assert.deepEqual(requests[1].messages.slice(-3).map(m => m.content), ['চলো ক্রিকেট নিয়ে আড্ডা দিই', 'চলো গল্প করি! ক্রিকেটের কোন দলটা ভালো লাগে?', 'বাংলাদেশ দল']);
    assert.equal(nova.store.messages(owner.workspaceId).length, 4); assert.equal(nova.store.memories(owner.workspaceId).length, 1);
  } finally { global.fetch = original; }
});

test('chat-only requests cannot create desktop actions, projects, timers or memories', async () => {
  const owner = newOwner(), original = global.fetch, sent = [];
  global.fetch = async (url, options) => {
    if (!String(url).startsWith('https://api.groq.com/')) return original(url, options);
    sent.push(JSON.parse(options.body)); return Response.json({ choices: [{ message: { content: 'চলো কথা বলি!' } }] });
  };
  try {
    for (const message of ['open firefox', 'ফায়ারফক্সটা আমার জন্য চালিয়ে দাও', 'remember my name is Rafi', 'focus 25 minutes', 'একটা ওয়েবসাইট বানাও', 'edit website']) {
      const r = await req('/chat', owner.token, { message, conversationMode: 'chat', inputMode: 'voice' });
      assert.equal(r.status, 200, message); assert.equal(r.data.action, null, message); assert.equal(r.data.memory, null, message); assert.equal(r.data.uiAction, null, message); assert.equal(r.data.website, null, message);
      assert.match(r.data.message.content, /chat-only mode|আড্ডা মোড/);
    }
    assert.equal(sent.length, 0); assert.equal(nova.store.actions(owner.workspaceId).length, 0); assert.equal(nova.store.memories(owner.workspaceId).length, 0);
    assert.deepEqual((await req('/builder/projects', owner.token)).data.projects, []);
    const talking = await req('/chat', owner.token, { message: 'ক্রোম না ফায়ারফক্স, কোনটা পছন্দ?', conversationMode: 'chat', inputMode: 'voice' });
    assert.equal(talking.data.engine, 'cloud'); assert.equal(talking.data.action, null);
    assert.match(sent[0].messages[0].content, /conversation-only mode/);
    const normal = await req('/chat', owner.token, { message: 'open firefox' });
    assert.equal(normal.data.action.kind, 'open_firefox'); assert.equal(normal.data.action.status, 'pending');
  } finally { global.fetch = original; }
});

test('casual browser mentions do not create actions, even with an over-eager AI classifier', async () => {
  const texts = ['I opened firefox yesterday', 'I like open source and firefox', 'গতকাল ফায়ারফক্স খুলেছিলাম', 'ফায়ারফক্স খুলে দাও বলেছিলাম', 'how do I open firefox', 'do not open firefox'];
  const original = global.fetch; let classifierCalls = 0;
  global.fetch = async (url, opts) => { const msg = JSON.parse(opts.body).messages; if (msg[0].content.startsWith('Classify only')) classifierCalls++; return Response.json({ choices: [{ message: { content: 'YES' } }] }); };
  try {
    for (const text of texts) {
      assert.equal(actionIntent(text), null, text);
      const answer = await respond({ text, settings: { language: 'auto' }, memories: [], history: [], timezone: 'Asia/Dhaka', config: { configured: true, base: 'https://mock.ai', model: 'test' } });
      assert.equal(answer.action, undefined, text);
    }
    assert.equal(classifierCalls, 0);
    assert.equal(actionIntent('open firefox'), 'open_firefox'); assert.equal(actionIntent('ফায়ারফক্স খুলে দাও'), 'open_firefox');
  } finally { global.fetch = original; }
});

test('limited offline small talk is honest and does not save memories', async () => {
  const common = { settings: { language: 'auto', assistantName: 'NOVA' }, memories: [], history: [], timezone: 'Asia/Dhaka', config: { configured: false } };
  assert.equal(worldIntent('কি খবর?'), null); assert.equal(worldIntent('তোমার কী খবর'), null); assert.equal(worldIntent('ki khobor'), null); assert.equal(worldIntent('বাংলাদেশের খবর'), 'bangladesh');
  for (const text of ['তুমি কেমন আছো', 'চলো আড্ডা দিই', 'আমার মন খারাপ', 'তোমার কী খবর', 'tumi kemon acho']) {
    const r = await respond({ ...common, text }); assert.equal(r.engine, 'local'); assert.equal(r.memory, undefined); assert.equal(r.action, undefined); assert.doesNotMatch(r.content, /local command mode/);
  }
  const unknown = await respond({ ...common, text: 'আমার প্রিয় গানের নাম কী?' }); assert.match(unknown.content, /local command mode/);
});


test('provider failure is honest and never fabricates a friendly response or action', async () => {
  const original = global.fetch; global.fetch = async () => { throw new Error('offline'); };
  try {
    const answer = await respond({ text: 'আজকে গল্প করি', settings: { language: 'auto' }, memories: [], history: [], timezone: 'Asia/Dhaka', config: { configured: true, base: 'https://mock.ai', model: 'test' }, chatOnly: true, voice: true });
    assert.equal(answer.engine, 'local'); assert.match(answer.content, /AI এখন উত্তর দিতে পারছে না/); assert.equal(answer.action, undefined); assert.equal(answer.memory, undefined);
  } finally { global.fetch = original; }
});
