'use strict';
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const express = require('express');
const cookieParser = require('cookie-parser');
const { createNovaRouter } = require('../src/nova/router');
const { calculate, localReply, actionIntent, aiConfig, providerError, testAiConnection } = require('../src/nova/assistant');
const { Vault } = require('../src/nova/vault');
const agent = require('../desktop/nova-agent');

let server, base, store, dir;
before(async () => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nova-test-'));
  const nova = createNovaRouter({ dataDir: dir }); store = nova.store;
  const app = express(); app.use(express.json()); app.use(cookieParser());
  app.use('/api/nova', (req, res, next) => { if (!['GET', 'HEAD'].includes(req.method) && req.get('X-GenZ-Client') !== '1') return res.status(403).json({ error: 'CSRF' }); next(); }, nova.router);
  await new Promise(r => { server = app.listen(0, '127.0.0.1', r); }); base = `http://127.0.0.1:${server.address().port}/api/nova`;
});
after(async () => { await new Promise(r => server.close(r)); store.close(); fs.rmSync(dir, { recursive: true, force: true }); });
async function req(route, { method = 'GET', token, body, headers = {} } = {}) {
  const res = await fetch(base + route, { method, headers: { 'Content-Type': 'application/json', 'X-GenZ-Client': '1', ...(token ? { 'X-Nova-Session': token } : {}), ...headers }, body: body === undefined ? undefined : JSON.stringify(body) });
  return { status: res.status, data: await res.json() };
}
async function workspace() { const r = await req('/session', { method: 'POST', body: {} }); assert.equal(r.status, 201); return r.data.token; }

test('arithmetic parser is safe and correct', () => {
  assert.equal(calculate('2 + 3 * 4'), 14); assert.equal(calculate('(2+3)*4'), 20); assert.equal(calculate('128 × 4'), 512);
  assert.equal(calculate('10 / 0'), null); assert.equal(calculate('process.exit()'), null); assert.equal(calculate('constructor.constructor'), null);
});
test('local engine supports Bengali, explicit memory and action proposals', () => {
  const settings = { language: 'auto', assistantName: 'NOVA' };
  assert.match(localReply('হ্যালো', settings, [], 'Asia/Dhaka').content, /NOVA/);
  assert.equal(localReply('Remember my name is Rafi', settings, [], 'Asia/Dhaka').memory.content, 'My name is Rafi');
  assert.equal(localReply('আমার নাম রাফি মনে রাখো', settings, [], 'Asia/Dhaka').memory.content, 'আমার নাম রাফি');
  assert.equal(localReply('নোটপ্যাড খোলো', settings, [], 'Asia/Dhaka').action.kind, 'open_notepad');
  assert.equal(localReply('ইউটিউব খোলো', settings, [], 'Asia/Dhaka').action.kind, 'open_youtube');
  assert.equal(localReply('Open YouTube', settings, [], 'Asia/Dhaka').action.kind, 'open_youtube');
  assert.equal(actionIntent('delete my files'), null);
  assert.match(localReply('Remember my password is abc', settings, [], 'Asia/Dhaka').content, /password manager/);
});
test('Groq preset uses the OpenAI-compatible endpoint and clear rate-limit errors', () => {
  const old = { provider: process.env.NOVA_AI_PROVIDER, key: process.env.NOVA_AI_API_KEY, base: process.env.NOVA_AI_BASE_URL, model: process.env.NOVA_AI_MODEL };
  process.env.NOVA_AI_PROVIDER = 'groq'; process.env.NOVA_AI_API_KEY = 'gsk_test'; delete process.env.NOVA_AI_BASE_URL; delete process.env.NOVA_AI_MODEL;
  const c = aiConfig(); assert.equal(c.configured, true); assert.equal(c.provider, 'groq'); assert.equal(c.base, 'https://api.groq.com/openai/v1'); assert.equal(c.model, 'llama-3.3-70b-versatile');
  assert.match(providerError(429), /rate limit|quota/i); assert.match(providerError(401), /API key/i);
  for (const [k, v] of Object.entries({ NOVA_AI_PROVIDER: old.provider, NOVA_AI_API_KEY: old.key, NOVA_AI_BASE_URL: old.base, NOVA_AI_MODEL: old.model })) { if (v === undefined) delete process.env[k]; else process.env[k] = v; }
});
test('agent allowlist rejects arbitrary commands, URLs and prototype keys', () => {
  for (const kind of ['shell', '__proto__', 'constructor', 'open_url']) assert.throws(() => agent.validate(kind, {}));
  assert.throws(() => agent.validate('open_youtube', { url: 'https://evil.example' }));
  assert.throws(() => agent.validate('whatsapp_draft', { phone: '123', text: 'x' }));
  assert.deepEqual(agent.validate('whatsapp_draft', { phone: '+8801712345678', text: 'Hello' }), { phone: '+8801712345678', text: 'Hello' });
});
test('agent dry-run never executes a desktop operation', async () => {
  const result = await agent.execute({ kind: 'open_notepad', params: {} }, true); assert.match(result, /DRY RUN/);
});
test('workspace creation requires CSRF header and isolates sessions', async () => {
  assert.equal((await req('/session', { method: 'POST', body: {}, headers: { 'X-GenZ-Client': '' } })).status, 403);
  const a = await workspace(), b = await workspace();
  const sa = await req('/state', { token: a }), sb = await req('/state', { token: b });
  assert.notEqual(sa.data.workspace.id, sb.data.workspace.id); assert.equal(sa.data.messages.length, 0);
  assert.equal((await req('/state')).status, 401);
});
test('cross-site browser writes are rejected', async () => {
  const token = await workspace();
  assert.equal((await req('/memories', { method: 'POST', token, body: { content: 'x' }, headers: { Origin: 'https://evil.example', 'Sec-Fetch-Site': 'cross-site' } })).status, 403);
});
test('memory CRUD is persistent and workspace-scoped', async () => {
  const a = await workspace(), b = await workspace();
  const created = await req('/memories', { method: 'POST', token: a, body: { content: 'I prefer Bengali', category: 'preference' } });
  assert.equal(created.status, 201); const id = created.data.memory.id;
  assert.equal((await req('/state', { token: a })).data.memories[0].content, 'I prefer Bengali');
  assert.equal((await req('/state', { token: b })).data.memories.length, 0);
  assert.equal((await req('/memories/' + id, { method: 'PATCH', token: b, body: { content: 'hack', category: 'note' } })).status, 404);
  assert.equal((await req('/memories/' + id, { method: 'PATCH', token: a, body: { content: 'I prefer concise Bengali', category: 'preference' } })).status, 200);
  assert.equal((await req('/memories/' + id, { method: 'DELETE', token: a })).status, 200);
  assert.equal((await req('/state', { token: a })).data.memories.length, 0);
});
test('chat saves messages and explicit memories, never auto-executes actions', async () => {
  const token = await workspace();
  const r = await req('/chat', { method: 'POST', token, body: { message: 'Remember my name is Rafi' } });
  assert.equal(r.status, 200); assert.equal(r.data.engine, 'local'); assert.equal(r.data.memory.content, 'My name is Rafi');
  const a = await req('/chat', { method: 'POST', token, body: { message: 'Open YouTube' } });
  assert.equal(a.data.action.status, 'pending'); assert.equal(a.data.action.kind, 'open_youtube');
  const state = await req('/state', { token }); assert.equal(state.data.messages.length, 4); assert.equal(state.data.actions[0].status, 'pending');
  assert.equal((await req('/actions/' + a.data.action.id + '/approve', { method: 'POST', token, body: {} })).status, 409);
});
test('invalid actions and settings are rejected', async () => {
  const token = await workspace();
  assert.equal((await req('/actions', { method: 'POST', token, body: { kind: 'shell', params: { command: 'rm -rf' } } })).status, 400);
  assert.equal((await req('/actions', { method: 'POST', token, body: { kind: 'open_youtube', params: { url: 'https://evil.example' } } })).status, 400);
  assert.equal((await req('/settings', { method: 'PATCH', token, body: { timezone: 'Not/AZone' } })).status, 400);
  assert.equal((await req('/settings', { method: 'PATCH', token, body: { speechRate: 99 } })).status, 400);
});
test('bridge requires a secret, claims approved actions once, and records results', async () => {
  const token = await workspace();
  const issued = await req('/bridge/token', { method: 'POST', token, body: {} }); assert.equal(issued.status, 200);
  const bridgeToken = issued.data.token;
  const auth = { Authorization: `Bearer ${bridgeToken}` };
  assert.equal((await req('/bridge/poll', { method: 'POST', body: { system: {} } })).status, 401);
  const action = (await req('/actions', { method: 'POST', token, body: { kind: 'system_info' } })).data.action;
  assert.equal((await req('/actions/' + action.id + '/approve', { method: 'POST', token, body: {} })).status, 409);
  const poll = await req('/bridge/poll', { method: 'POST', headers: auth, body: { system: { hostname: 'TEST-PC', os: 'win32 10.0', memoryGB: 16 } } });
  assert.equal(poll.data.action, null);
  assert.equal((await req('/state', { token })).data.bridge.online, true);
  assert.equal((await req('/actions/' + action.id + '/approve', { method: 'POST', token, body: {} })).status, 200);
  const claimed = await req('/bridge/poll', { method: 'POST', headers: auth, body: { system: {} } }); assert.equal(claimed.data.action.id, action.id);
  assert.equal((await req('/bridge/poll', { method: 'POST', headers: auth, body: { system: {} } })).data.action, null);
  assert.equal((await req('/bridge/result', { method: 'POST', headers: auth, body: { id: action.id, ok: true, result: '16 GB RAM' } })).status, 200);
  const state = await req('/state', { token }); assert.equal(state.data.actions[0].status, 'completed'); assert.equal(state.data.actions[0].result, '16 GB RAM');
  assert.equal((await req('/bridge/result', { method: 'POST', headers: auth, body: { id: action.id, ok: true, result: 'replay' } })).status, 409);
});
test('token replacement revokes the old bridge and cancels queued work', async () => {
  const token = await workspace();
  const old = (await req('/bridge/token', { method: 'POST', token, body: {} })).data.token;
  const action = (await req('/actions', { method: 'POST', token, body: { kind: 'open_notepad' } })).data.action;
  await req('/bridge/token', { method: 'POST', token, body: {} });
  assert.equal((await req('/bridge/poll', { method: 'POST', headers: { Authorization: `Bearer ${old}` }, body: { system: {} } })).status, 401);
  assert.equal((await req('/state', { token })).data.actions.find(a => a.id === action.id).status, 'cancelled');
});
test('remote pairing is one-time, scoped, revocable and not owner-admin', async () => {
  const owner = await workspace();
  const pair = await req('/remote/create', { method: 'POST', token: owner, body: {} }); assert.equal(pair.status, 201);
  assert.equal((await req('/remote/pair', { method: 'POST', body: { code: 'FFFFFFFFFF' } })).status, 400);
  const remote = await req('/remote/pair', { method: 'POST', body: { code: pair.data.code } }); assert.equal(remote.status, 200);
  assert.equal((await req('/remote/pair', { method: 'POST', body: { code: pair.data.code } })).status, 400);
  const rt = remote.data.token;
  assert.equal((await req('/state', { token: rt })).data.workspace.id, (await req('/state', { token: owner })).data.workspace.id);
  assert.equal((await req('/bridge/token', { method: 'POST', token: rt, body: {} })).status, 403);
  assert.equal((await req('/settings', { method: 'PATCH', token: rt, body: { userName: 'hack' } })).status, 403);
  assert.equal((await req('/remote/create', { method: 'POST', token: rt, body: {} })).status, 403);
  assert.equal((await req('/remote/revoke-all', { method: 'POST', token: owner, body: {} })).status, 200);
  assert.equal((await req('/state', { token: rt })).status, 401);
});
test('approvals expire and cannot be approved later', async () => {
  const token = await workspace();
  const action = (await req('/actions', { method: 'POST', token, body: { kind: 'open_notepad' } })).data.action;
  store.db.prepare('UPDATE actions SET expires_at=? WHERE id=?').run(Date.now() - 1, action.id);
  store.expireActions();
  assert.equal(store.action(action.id).status, 'expired');
  assert.equal((await req('/actions/' + action.id + '/approve', { method: 'POST', token, body: {} })).status, 409);
});
test('AI connection test is owner-only and does not leak a key when unconfigured', async () => {
  const owner = await workspace();
  const r = await req('/ai/test', { method: 'POST', token: owner, body: {} });
  assert.equal(r.status, 200); assert.equal(r.data.ok, false); assert.ok(r.data.error); assert.ok(!JSON.stringify(r.data).includes('gsk_'));
  const pair = await req('/remote/create', { method: 'POST', token: owner, body: {} });
  const remote = await req('/remote/pair', { method: 'POST', body: { code: pair.data.code } });
  assert.equal((await req('/ai/test', { method: 'POST', token: remote.data.token, body: {} })).status, 403);
});

test('vault encrypts credentials at rest and binds them to the workspace', () => {
  const v = new Vault(dir);
  const row = v.encrypt('gsk_super_secret_value_123456', 'workspace-a');
  assert.ok(!JSON.stringify(row).includes('gsk_super_secret_value_123456'));
  assert.equal(v.decrypt(row, 'workspace-a'), 'gsk_super_secret_value_123456');
  assert.throws(() => v.decrypt(row, 'workspace-b'));
});
test('in-app Groq connect tests, encrypts, uses and disconnects the workspace key', async () => {
  const originalFetch = global.fetch;
  const seen = [];
  global.fetch = async (url, opts = {}) => {
    if (String(url).startsWith('https://api.groq.com/')) {
      seen.push({ url: String(url), auth: opts.headers?.Authorization || opts.headers?.authorization });
      const body = JSON.parse(opts.body || '{}');
      if (body.model === 'no-such-model') return new Response(JSON.stringify({ error: { message: 'model not found' } }), { status: 404, headers: { 'Content-Type': 'application/json' } });
      return new Response(JSON.stringify({ choices: [{ message: { content: 'OK' } }] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    return originalFetch(url, opts);
  };
  try {
    const owner = await workspace();
    const state = await req('/state', { token: owner });
    const workspaceId = state.data.workspace.id;
    const key = 'gsk_test_key_abcdefghijklmnopqrstuvwxyz';
    const remotePair = await req('/remote/create', { method: 'POST', token: owner, body: {} });
    const remote = await req('/remote/pair', { method: 'POST', body: { code: remotePair.data.code } });
    assert.equal((await req('/ai/connect', { method: 'POST', token: remote.data.token, body: { apiKey: key } })).status, 403);
    assert.equal((await req('/ai/connect', { method: 'POST', token: owner, body: { apiKey: 'short' } })).status, 400);
    const unreachable = await req('/ai/connect', { method: 'POST', token: owner, body: { apiKey: key, model: 'no-such-model' } });
    assert.equal(unreachable.status, 200); assert.equal(unreachable.data.ok, false); assert.ok(unreachable.data.error);
    assert.equal(store.aiProvider(workspaceId), null);
    const connected = await req('/ai/connect', { method: 'POST', token: owner, body: { provider: 'groq', apiKey: key, model: 'llama-3.3-70b-versatile' } });
    assert.equal(connected.status, 200);
    assert.equal(connected.data.ai.configured, true);
    assert.equal(connected.data.ai.source, 'workspace');
    assert.equal(connected.data.ai.hasKey, true);
    assert.ok(!JSON.stringify(connected.data).includes(key));
    assert.ok(seen.some(x => x.auth === `Bearer ${key}`));
    const row = store.aiProvider(workspaceId);
    assert.ok(row && !JSON.stringify(row).includes(key));
    assert.equal(new Vault(dir).decrypt(row, workspaceId), key);
    const chat = await req('/chat', { method: 'POST', token: owner, body: { message: 'Tell me a short joke' } });
    assert.equal(chat.status, 200); assert.equal(chat.data.engine, 'cloud');
    const secretChat = await req('/chat', { method: 'POST', token: owner, body: { message: `here is my key ${key}` } });
    assert.equal(secretChat.status, 400);
    assert.ok(!(await req('/state', { token: owner })).data.messages.some(m => m.content.includes(key)));
    assert.equal((await req('/ai/disconnect', { method: 'POST', token: remote.data.token, body: {} })).status, 403);
    const disconnected = await req('/ai/disconnect', { method: 'POST', token: owner, body: {} });
    assert.equal(disconnected.status, 200); assert.equal(disconnected.data.ai.configured, false);
    assert.equal(store.aiProvider(workspaceId), null);
  } finally { global.fetch = originalFetch; }
});

test('reasoning-model probe uses a real completion budget and accepts hidden reasoning', async () => {
  const originalFetch = global.fetch;
  let probe = null;
  global.fetch = async (url, opts = {}) => {
    if (String(url).startsWith('https://api.groq.com/')) {
      probe = JSON.parse(opts.body || '{}');
      return new Response(JSON.stringify({ choices: [{ message: { content: '', reasoning: 'hidden thought' }, finish_reason: 'stop' }] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    return originalFetch(url, opts);
  };
  try {
    const config = aiConfig({ provider: 'groq', model: 'openai/gpt-oss-120b', base: 'https://api.groq.com/openai/v1', key: 'gsk_reasoning_test_key_123456789' });
    const result = await testAiConnection(config);
    assert.equal(result.ok, true);
    assert.ok(probe.max_completion_tokens >= 1024);
    assert.equal(probe.max_tokens, undefined);
    assert.equal(probe.reasoning_effort, 'low');
  } finally { global.fetch = originalFetch; }
});

test('export and destructive deletion require owner confirmation', async () => {
  const token = await workspace();
  await req('/memories', { method: 'POST', token, body: { content: 'Export me', category: 'note' } });
  const exported = await req('/export', { token }); assert.equal(exported.data.memories[0].content, 'Export me');
  assert.equal((await req('/workspace', { method: 'DELETE', token, body: { confirmation: 'no' } })).status, 400);
  assert.equal((await req('/workspace', { method: 'DELETE', token, body: { confirmation: 'DELETE' } })).status, 200);
  assert.equal((await req('/state', { token })).status, 401);
});

test('website generator uses connected AI, rejects incomplete output and never runs it', async () => {
  const { generateWebsite } = require('../src/nova/assistant');
  assert.equal((await generateWebsite({ configured: false }, 'site')).ok, false);
  const originalFetch = global.fetch;
  const config = { configured: true, base: 'https://example.invalid', model: 'llama-3.3-70b-versatile', key: 'test' };
  try {
    let sent;
    global.fetch = async (url, options) => { sent = JSON.parse(options.body); return { ok: true, json: async () => ({ choices: [{ finish_reason: 'stop', message: { content: '```html\n<!doctype html><html><body>Hello</body></html>\n```' } }] }) }; };
    const result = await generateWebsite(config, 'A bakery website');
    assert.equal(result.ok, true); assert.match(result.html, /Hello/); assert.equal(sent.messages[1].content, 'A bakery website');
    global.fetch = async () => ({ ok: true, json: async () => ({ choices: [{ finish_reason: 'length', message: { content: '<!doctype html><html></html>' } }] }) });
    assert.equal((await generateWebsite(config, 'site')).ok, false);
    global.fetch = async () => ({ ok: true, json: async () => ({ choices: [{ finish_reason: 'stop', message: { content: '<!doctype html><html>unfinished' } }] }) });
    assert.equal((await generateWebsite(config, 'site')).ok, false);
  } finally { global.fetch = originalFetch; }
});

test('website generation requires an owner, a safe brief and configured AI', async () => {
  const owner = await workspace();
  assert.equal((await req('/website/generate', { method: 'POST', body: { brief: 'site' } })).status, 401);
  assert.equal((await req('/website/generate', { method: 'POST', token: owner, body: { brief: '' } })).status, 400);
  assert.equal((await req('/website/generate', { method: 'POST', token: owner, body: { brief: 'gsk_test_key_abcdefghijklmnopqrstuvwxyz' } })).status, 400);
  const result = await req('/website/generate', { method: 'POST', token: owner, body: { brief: 'site' } });
  assert.equal(result.status, 200); assert.equal(result.data.ok, false);
  const pair = await req('/remote/create', { method: 'POST', token: owner, body: {} });
  const remote = await req('/remote/pair', { method: 'POST', body: { code: pair.data.code } });
  assert.equal((await req('/website/generate', { method: 'POST', token: remote.data.token, body: { brief: 'site' } })).status, 403);
});

test('repeated invalid bridge credentials are limited without blocking valid agents', async () => {
  const owner = await workspace();
  const issued = await req('/bridge/token', { method: 'POST', token: owner, body: {} });
  let limited = false;
  for (let i = 0; i < 20; i++) {
    const result = await req('/bridge/result', { method: 'POST', body: {}, headers: { Authorization: 'Bearer ' + 'x'.repeat(43) } });
    if (result.status === 429) { limited = true; break; }
    assert.equal(result.status, 401);
  }
  assert.equal(limited, true);
  const valid = await req('/bridge/poll', { method: 'POST', body: {}, headers: { Authorization: `Bearer ${issued.data.token}` } });
  assert.equal(valid.status, 200);
});

test('website projects are saved separately and only accessible to their owner', async () => {
  const owner = await workspace(), other = await workspace();
  const workspaceId = (await req('/state', { token: owner })).data.workspace.id;
  const realFetch = global.fetch;
  global.fetch = async (url, options) => {
    if (String(url).startsWith('https://api.groq.com/')) {
      const sent = JSON.parse(options.body);
      const content = sent.messages[0].role === 'system' ? (sent.messages.length > 2 ? '<!doctype html><html><body><h1>Updated bakery</h1></body></html>' : '<!doctype html><html><body><h1>Test bakery</h1></body></html>') : 'OK';
      return new Response(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content } }] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    return realFetch(url, options);
  };
  try {
    const connected = await req('/ai/connect', { method: 'POST', token: owner, body: { apiKey: 'gsk_test_key_abcdefghijklmnopqrstuvwxyz' } });
    assert.equal(connected.data.ok, true);
    const generated = await req('/website/generate', { method: 'POST', token: owner, body: { brief: 'A bakery site' } });
    assert.equal(generated.data.ok, true); const id = generated.data.project.id;
    assert.match(await fs.promises.readFile(path.join(dir, 'projects', workspaceId, id, 'index.html'), 'utf8'), /Test bakery/);
    const list = await req('/website/projects', { token: owner });
    assert.equal(list.data.projects.length, 1); assert.equal(list.data.projects[0].id, id);
    assert.match((await req('/website/projects/' + id, { token: owner })).data.html, /Test bakery/);
    const preview = await realFetch(base + '/website/projects/' + id + '/preview', { headers: { 'X-Nova-Session': owner } });
    assert.equal(preview.status, 200);
    assert.match(preview.headers.get('content-security-policy'), /sandbox allow-scripts/);
    assert.match(preview.headers.get('content-security-policy'), /connect-src 'none'/);
    assert.match(await preview.text(), /Test bakery/);
    assert.equal((await realFetch(base + '/website/projects/' + id + '/preview', { headers: { 'X-Nova-Session': other } })).status, 404);
    assert.equal((await realFetch(base + '/website/projects/' + id + '/preview')).status, 401);
    assert.equal((await req('/website/projects/' + id, { token: other })).status, 404);
    assert.equal((await req('/website/projects/not-a-uuid', { token: owner })).status, 404);
    const pair = await req('/remote/create', { method: 'POST', token: owner, body: {} });
    const remote = await req('/remote/pair', { method: 'POST', body: { code: pair.data.code } });
    assert.equal((await req('/website/projects', { token: remote.data.token })).status, 403);
    assert.equal((await req('/website/projects/' + id, { token: remote.data.token })).status, 403);
    const second = await req('/website/generate', { method: 'POST', token: owner, body: { brief: 'A bakery site' } });
    assert.notEqual(second.data.project.id, id); // Never overwrite an existing project.
    const viaChat = await req('/chat', { method: 'POST', token: owner, body: { message: 'ekta bakery website banao' } });
    assert.equal(viaChat.status, 200); assert.ok(viaChat.data.website.project.id);
    assert.match(viaChat.data.website.html, /Test bakery/);
    assert.match(viaChat.data.message.content, /static website/);
    assert.equal((await req('/website/projects', { token: owner })).data.projects.length, 3);
    const revised = await req('/chat', { method: 'POST', token: owner, body: { message: 'website change the title', websiteProjectId: id } });
    assert.match(revised.data.website.html, /Updated bakery/);
    assert.notEqual(revised.data.website.project.id, id);
    assert.match((await req('/website/projects/' + id, { token: owner })).data.html, /Test bakery/);
    assert.equal((await req('/website/projects', { token: owner })).data.projects.length, 4);
    const badTarget = await req('/chat', { method: 'POST', token: owner, body: { message: 'edit website', websiteProjectId: 'bad-id' } });
    assert.equal(badTarget.data.website, null); assert.match(badTarget.data.message.content, /No selected website/);
    assert.equal((await req('/chat', { method: 'POST', token: remote.data.token, body: { message: 'make a website' } })).status, 403);
    assert.equal((await req('/chat', { method: 'POST', token: remote.data.token, body: { message: 'edit website' } })).status, 403);
    const advice = await req('/chat', { method: 'POST', token: owner, body: { message: 'How do I make a website?' } });
    assert.equal(advice.data.website, null);
    assert.equal((await req('/website/projects', { token: owner })).data.projects.length, 4);
  } finally { global.fetch = realFetch; }
});


test('website build intent requires explicit creation and respects negation', () => {
  const { websiteIntent } = require('../src/nova/assistant');
  for (const text of ['make a bakery website', 'ekta website banao', 'একটা ওয়েবসাইট বানাও']) assert.equal(websiteIntent(text), true, text);
  for (const text of ['how to make a website', 'do not make a website', 'website ideas', 'website বানিও না']) assert.equal(websiteIntent(text), false, text);
});


test('website edit intent requires an explicit edit and a website', () => {
  const { websiteEditIntent } = require('../src/nova/assistant');
  for (const text of ['website change the title', 'edit website', 'ওয়েবসাইট বদলাও']) assert.equal(websiteEditIntent(text), true, text);
  for (const text of ['how to edit website', 'do not edit the website', 'change my password', 'make a website']) assert.equal(websiteEditIntent(text), false, text);
});

test('mouse commands require valid coordinates, owner consent and a connected bridge', async () => {
  const { mouseIntent } = require('../src/nova/assistant');
  const { validateAction } = require('../src/nova/catalog');
  assert.deepEqual(mouseIntent('mouse move 500 300'), { kind: 'mouse_move', params: { x: 500, y: 300 } });
  assert.deepEqual(mouseIntent('click mouse at -120, 50'), { kind: 'mouse_click', params: { x: -120, y: 50 } });
  assert.equal(mouseIntent('click delete'), null);
  assert.equal(mouseIntent('mouse click 99999 3'), null);
  for (const params of [{ x: 1.2, y: 3 }, { x: '1', y: 2 }, { x: 1, y: 2, command: 'x' }, { x: 99999, y: 1 }, { x: 1 }]) {
    assert.ok(validateAction('mouse_click', params).error);
    assert.throws(() => agent.validate('mouse_click', params));
  }
  assert.match(await agent.execute({ kind: 'mouse_click', params: { x: 10, y: 20 } }, true), /DRY RUN/);
  const owner = await workspace();
  const pair = await req('/remote/create', { method: 'POST', token: owner, body: {} });
  const remote = (await req('/remote/pair', { method: 'POST', body: { code: pair.data.code } })).data.token;
  assert.equal((await req('/actions', { method: 'POST', token: remote, body: { kind: 'mouse_click', params: { x: 10, y: 20 } } })).status, 403);
  assert.equal((await req('/chat', { method: 'POST', token: remote, body: { message: 'mouse click 10 20' } })).status, 403);
  const bridge = await req('/bridge/token', { method: 'POST', token: owner, body: {} });
  const proposed = await req('/chat', { method: 'POST', token: owner, body: { message: 'mouse click 10 20' } });
  assert.equal(proposed.data.action.kind, 'mouse_click'); assert.equal(proposed.data.action.status, 'pending');
  const id = proposed.data.action.id;
  assert.equal((await req('/actions/' + id + '/approve', { method: 'POST', token: remote, body: {} })).status, 403);
  assert.equal((await req('/actions/' + id + '/approve', { method: 'POST', token: owner, body: {} })).status, 409);
  const headers = { Authorization: 'Bearer ' + bridge.data.token };
  await req('/bridge/poll', { method: 'POST', headers, body: {} });
  assert.equal((await req('/actions/' + id + '/approve', { method: 'POST', token: owner, body: {} })).status, 200);
  const claimed = await req('/bridge/poll', { method: 'POST', headers, body: {} });
  assert.equal(claimed.data.action.kind, 'mouse_click'); assert.deepEqual(claimed.data.action.params, { x: 10, y: 20 });
});

test('Notepad typing is owner-only, reviewed and rejects secrets and unsafe controls', async () => {
  const { keyboardIntent } = require('../src/nova/assistant');
  const { validateAction } = require('../src/nova/catalog');
  assert.deepEqual(keyboardIntent('type notepad: Hello NOVA'), { kind: 'keyboard_type', params: { text: 'Hello NOVA' } });
  assert.equal(keyboardIntent('type notepad: gsk_test_key_abcdefghijklmnopqrstuvwxyz'), null);
  for (const params of [{ text: '' }, { text: 'a\nb' }, { text: 'a\tb' }, { text: 'x'.repeat(301) }, { text: 'gsk_test_key_abcdefghijklmnopqrstuvwxyz' }, { text: 'hello', command: 'x' }]) {
    assert.ok(validateAction('keyboard_type', params).error);
    assert.throws(() => agent.validate('keyboard_type', params));
  }
  assert.match(await agent.execute({ kind: 'keyboard_type', params: { text: 'Hello' } }, true), /DRY RUN/);
  const owner = await workspace();
  const ownerId = (await req('/state', { token: owner })).data.workspace.id;
  const bridge = { data: { token: store.issueBridge(ownerId) } };
  const pair = await req('/remote/create', { method: 'POST', token: owner, body: {} });
  const remote = (await req('/remote/pair', { method: 'POST', body: { code: pair.data.code } })).data.token;
  assert.equal((await req('/actions', { method: 'POST', token: remote, body: { kind: 'keyboard_type', params: { text: 'Hello' } } })).status, 403);
  assert.equal((await req('/chat', { method: 'POST', token: remote, body: { message: 'type notepad: Hello' } })).status, 403);
  const proposed = await req('/chat', { method: 'POST', token: owner, body: { message: 'type notepad: Hello' } });
  assert.equal(proposed.data.action.kind, 'keyboard_type'); assert.equal(proposed.data.action.status, 'pending');
  const id = proposed.data.action.id;
  assert.equal((await req('/actions/' + id + '/approve', { method: 'POST', token: remote, body: {} })).status, 403);
  assert.equal((await req('/actions/' + id + '/approve', { method: 'POST', token: owner, body: {} })).status, 409);
  const headers = { Authorization: 'Bearer ' + bridge.data.token };
  await req('/bridge/poll', { method: 'POST', headers, body: {} });
  assert.equal((await req('/actions/' + id + '/approve', { method: 'POST', token: owner, body: {} })).status, 200);
  const claimed = await req('/bridge/poll', { method: 'POST', headers, body: {} });
  assert.equal(claimed.data.action.kind, 'keyboard_type'); assert.deepEqual(claimed.data.action.params, { text: 'Hello' });
});

test('world feeds parse sourced events and reject untrusted links', () => {
  const { quakeItems, newsItems } = require('../src/nova/world');
  const features = [{ geometry: { coordinates: [90.4, 23.7] }, properties: { mag: 4.3, time: 1700000000000, place: 'Near Dhaka', url: 'https://earthquake.usgs.gov/earthquakes/eventpage/test' } }, { geometry: { coordinates: [300, 0] }, properties: { mag: 3, time: 1700000000000 } }, null];
  const q = quakeItems({ features }); assert.equal(q.length, 1); assert.equal(q[0].lat, 23.7); assert.equal(q[0].magnitude, 4.3);
  assert.equal(quakeItems({ features: [{ ...features[0], properties: { ...features[0].properties, url: 'https://evil.example/' } }] })[0].url, '');
  const rss = '<rss><channel><item><title><![CDATA[World &amp; News]]></title><link>https://www.bbc.com/news/test</link><pubDate>Mon, 01 Jan 2024 00:00:00 GMT</pubDate></item><item><title>Bad</title><link>https://evil.example/</link></item></channel></rss>';
  const news = newsItems(rss); assert.equal(news.length, 1); assert.equal(news[0].title, 'World & News'); assert.match(news[0].url, /^https:\/\/www\.bbc\.com/);
  assert.throws(() => newsItems('not xml')); assert.throws(() => quakeItems({}));
});

test('world endpoint fetches fixed public sources, reports real source status and requires a session', async () => {
  const existingOwner = store.createWorkspace().token;
  assert.equal((await req('/world')).status, 401);
  const realFetch = global.fetch;
  global.fetch = async (url, options) => {
    if (String(url).startsWith('https://earthquake.usgs.gov/')) return new Response(JSON.stringify({ features: [{ geometry: { coordinates: [90.4, 23.7] }, properties: { mag: 4.2, time: 1700000000000, place: 'Near Dhaka', url: 'https://earthquake.usgs.gov/earthquakes/eventpage/test' } }] }), { status: 200 });
    if (String(url).startsWith('https://feeds.bbci.co.uk/')) throw new Error('offline');
    return realFetch(url, options);
  };
  try {
    const response = await req('/world', { token: existingOwner });
    assert.equal(response.status, 200); assert.equal(response.data.quakes.ok, true); assert.equal(response.data.quakes.items.length, 1);
    assert.equal(response.data.news.ok, false); assert.deepEqual(response.data.news.items, []);
  } finally { global.fetch = realFetch; }
});

test('character settings support custom persona, persist and remain owner-only', async () => {
  const owner = store.createWorkspace().token;
  const saved = await req('/settings', { method: 'PATCH', token: owner, body: { persona: 'custom', assistantName: 'Luna', customCharacterName: 'Luna', customInstructions: 'Patient and concise', voiceGender: 'feminine' } });
  assert.equal(saved.status, 200); assert.equal(saved.data.settings.persona, 'custom');
  const state = await req('/state', { token: owner }); assert.equal(state.data.settings.assistantName, 'Luna'); assert.equal(state.data.settings.customInstructions, 'Patient and concise');
  for (const persona of ['jarvis', 'mentor', 'nova', 'atlas']) assert.equal((await req('/settings', { method: 'PATCH', token: owner, body: { persona } })).status, 200);
  assert.equal((await req('/settings', { method: 'PATCH', token: owner, body: { persona: 'invalid' } })).status, 400);
  const pair = await req('/remote/create', { method: 'POST', token: owner, body: {} });
  const remote = (await req('/remote/pair', { method: 'POST', body: { code: pair.data.code } })).data.token;
  assert.equal((await req('/settings', { method: 'PATCH', token: remote, body: { persona: 'jarvis' } })).status, 403);
});

test('Banglish explicit memories and name recall work without cloud access', async () => {
  const { respond } = require('../src/nova/assistant');
  const settings = { language: 'auto', assistantName: 'NOVA' };
  const memory = localReply('amar nam Rafi mone rakho', settings, [], 'Asia/Dhaka').memory;
  assert.equal(memory.content, 'My name is Rafi'); assert.equal(memory.category, 'personal');
  assert.equal(localReply('amar blue colour pochondo mone rakho', settings, [], 'Asia/Dhaka').memory.category, 'preference');
  const answer = await respond({ text: 'amar nam ki?', settings, memories: [memory], history: [], timezone: 'Asia/Dhaka', config: { configured: true } });
  assert.match(answer.content, /Rafi/); assert.equal(answer.engine, 'local');
});

test('expanded PC skills use fixed destinations and require approval', async () => {
  for (const [message, kind] of [['Open Google Maps', 'open_google_maps'], ['Open Gmail', 'open_gmail'], ['Open GitHub', 'open_github'], ['Open Paint', 'open_paint'], ['Open Task Manager', 'open_task_manager']]) {
    assert.equal(actionIntent(message), kind);
    assert.match(await agent.execute({ kind, params: {} }, true), /DRY RUN/);
    assert.throws(() => agent.validate(kind, { url: 'https://evil.example' }));
  }
});

test('one project approval creates isolated files, sandboxed preview and ZIP', async () => {
  const realFetch = global.fetch; let generationCalls = 0;
  const html = '<!doctype html><html><head><link rel="stylesheet" href="styles.css"></head><body><h1>Bakery</h1><button id="go">Go</button><script src="app.js" defer></script></body></html>';
  const css = 'body { color: purple; }';
  const js = 'document.querySelector("#go").onclick = () => document.querySelector("h1").textContent = "Done";';
  global.fetch = async (url, options = {}) => {
    if (String(url).startsWith('https://api.groq.com/')) {
      const body = JSON.parse(options.body);
      const isProbe = body.messages.length === 1;
      const content = isProbe ? 'OK' : [html, css, js][generationCalls++];
      return new Response(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content } }] }), { status: 200 });
    }
    return realFetch(url, options);
  };
  try {
    const owner = store.createWorkspace().token, stranger = store.createWorkspace().token;
    const workspaceId = (await req('/state', { token: owner })).data.workspace.id;
    const pair = store.createPairing((await req('/state', { token: owner })).data.workspace.id);
    const remote = store.redeemPairing(pair.code).token;
    await req('/ai/connect', { method: 'POST', token: owner, body: { apiKey: 'gsk_test_key_abcdefghijklmnopqrstuvwxyz' } });
    assert.equal((await req('/builder/generate', { method: 'POST', token: owner, body: { brief: 'Bakery' } })).status, 400);
    assert.equal((await req('/builder/generate', { method: 'POST', token: remote, body: { brief: 'Bakery', confirm: true } })).status, 403);
    assert.equal(generationCalls, 0);
    const result = await req('/builder/generate', { method: 'POST', token: owner, body: { brief: 'Bakery', confirm: true } });
    assert.equal(result.data.ok, true); assert.equal(generationCalls, 3);
    const id = result.data.project.id;
    assert.equal((await req('/builder/projects/' + id, { token: stranger })).status, 404);
    assert.equal((await req('/builder/projects/' + id, { token: remote })).status, 403);
    assert.deepEqual(fs.readdirSync(path.join(dir, 'built-projects', workspaceId, id)).sort(), ['app.js', 'index.html', 'project.json', 'styles.css']);
    assert.deepEqual((await req('/builder/projects', { token: owner })).data.projects.map(p => p.id), [id]);
    const preview = await realFetch(base + '/builder/projects/' + id + '/preview', { headers: { 'X-Nova-Session': owner } });
    assert.match(preview.headers.get('content-security-policy'), /connect-src 'none'/);
    const page = await preview.text(); assert.match(page, /color: purple/); assert.match(page, /querySelector/);
    const zip = await realFetch(base + '/builder/projects/' + id + '/download', { headers: { 'X-Nova-Session': owner } });
    const unpacked = require('fflate').unzipSync(new Uint8Array(await zip.arrayBuffer()));
    assert.deepEqual(Object.keys(unpacked).sort(), ['app.js', 'index.html', 'styles.css']);
    assert.equal(require('fflate').strFromU8(unpacked['app.js']), js);
    assert.equal((await req('/builder/projects/not-a-uuid', { token: owner })).status, 404);
  } finally { global.fetch = realFetch; }
});

test('project builder rejects incomplete and syntactically invalid code without saving', async () => {
  const { generateProject } = require('../src/nova/project-builder');
  const oldFetch = global.fetch; let i = 0;
  try {
    global.fetch = async () => ({ ok: true, json: async () => ({ choices: [{ finish_reason: 'stop', message: { content: ['<!doctype html><html><head><link href="styles.css"></head><body><script src="app.js"></script></body></html>', 'body{}', 'function {'][i++] } }] }) });
    const r = await generateProject({ configured: true, base: 'https://example.test', model: 'test' }, 'test');
    assert.equal(r.ok, false); assert.match(r.error, /syntax/i);
    i = 0; global.fetch = async () => ({ ok: true, json: async () => ({ choices: [{ finish_reason: 'length', message: { content: 'partial' } }] }) });
    assert.equal((await generateProject({ configured: true, base: 'https://example.test', model: 'test' }, 'test')).ok, false);
    const controller = new AbortController(); controller.abort();
    assert.match((await generateProject({ configured: true }, 'test', controller.signal)).error, /stopped/i);
  } finally { global.fetch = oldFetch; }
});

test('screen analysis is owner-only, explicitly requested and not saved', async () => {
  const realFetch = global.fetch; const seen = [];
  global.fetch = async (url, options = {}) => {
    if (String(url).startsWith('https://api.groq.com/')) {
      seen.push(JSON.parse(options.body));
      return new Response(JSON.stringify({ choices: [{ message: { content: seen.length === 1 ? 'OK' : 'A test screen.' } }] }), { status: 200 });
    }
    return realFetch(url, options);
  };
  try {
    const owner = store.createWorkspace().token;
    const pair = store.createPairing((await req('/state', { token: owner })).data.workspace.id);
    const remote = store.redeemPairing(pair.code).token;
    await req('/ai/connect', { method: 'POST', token: owner, body: { apiKey: 'gsk_test_key_abcdefghijklmnopqrstuvwxyz' } });
    const image = 'data:image/jpeg;base64,' + Buffer.from([255, 216, 255, 1, 2, 3]).toString('base64');
    assert.equal((await req('/screen/analyze', { method: 'POST', token: remote, body: { image, model: 'vision' } })).status, 403);
    assert.equal((await req('/screen/analyze', { method: 'POST', token: owner, body: { image: 'data:image/jpeg;base64,YmFk', model: 'vision' } })).status, 400);
    assert.equal((await req('/screen/analyze', { method: 'POST', token: owner, body: { image, model: 'https://bad.example' } })).status, 400);
    const result = await req('/screen/analyze', { method: 'POST', token: owner, body: { image, model: 'vision', question: 'What is here?' } });
    assert.equal(result.data.answer, 'A test screen.'); assert.equal(seen.length, 2);
    assert.equal(seen[1].messages[1].content[1].image_url.url, image);
    assert.ok(!JSON.stringify((await req('/state', { token: owner })).data).includes(image));
  } finally { global.fetch = realFetch; }
});

test('stopping a project aborts its in-flight AI request', async () => {
  const { generateProject } = require('../src/nova/project-builder'); const original = global.fetch;
  const controller = new AbortController(); let entered = false;
  global.fetch = async (url, options) => new Promise((resolve, reject) => {
    entered = true; options.signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true });
  });
  try {
    const pending = generateProject({ configured: true, base: 'https://example.test', model: 'test' }, 'Build a site', controller.signal);
    assert.equal(entered, true); controller.abort();
    assert.match((await pending).error, /stopped/i);
  } finally { global.fetch = original; }
});

test('vision can suggest a click but only owner can separately approve a short-lived action', async () => {
  const ownerSession = store.createWorkspace(); const owner = ownerSession.token;
  const pair = store.createPairing(ownerSession.workspaceId); const remote = store.redeemPairing(pair.code).token;
  store.saveAiProvider(ownerSession.workspaceId, { provider: 'groq', model: 'llama-3.3-70b-versatile', base_url: 'https://api.groq.com/openai/v1', ...new Vault(dir).encrypt('gsk_test_key_abcdefghijklmnopqrstuvwxyz', ownerSession.workspaceId) });
  const realFetch = global.fetch; let aiOutput = JSON.stringify({ action: 'click', x: 2500, y: 7500, reason: 'Open button' });
  global.fetch = async (url, options = {}) => String(url).startsWith('https://api.groq.com/') ? new Response(JSON.stringify({ choices: [{ message: { content: aiOutput } }] }), { status: 200 }) : realFetch(url, options);
  try {
    const image = 'data:image/jpeg;base64,' + Buffer.from([255, 216, 255, 1, 2, 3]).toString('base64');
    const body = { image, model: 'vision-model', question: 'Open the button', mode: 'suggest-click' };
    assert.equal((await req('/screen/analyze', { method: 'POST', token: remote, body })).status, 403);
    const suggestion = await req('/screen/analyze', { method: 'POST', token: owner, body });
    assert.deepEqual(suggestion.data.proposal, { x: 2500, y: 7500, reason: 'Open button' });
    assert.equal((await req('/state', { token: owner })).data.actions.length, 0, 'analysis never creates or runs an action');
    aiOutput = JSON.stringify({ action: 'click', x: 10001, y: 0 });
    assert.equal((await req('/screen/analyze', { method: 'POST', token: owner, body })).data.ok, false);
    aiOutput = '{"action":"none","reason":"unclear"}';
    assert.equal((await req('/screen/analyze', { method: 'POST', token: owner, body })).data.proposal, null);
    const payload = { kind: 'mouse_click_primary', params: { x: 2500, y: 7500 } };
    assert.equal((await req('/actions', { method: 'POST', token: remote, body: payload })).status, 403);
    const created = (await req('/actions', { method: 'POST', token: owner, body: payload })).data.action;
    assert.equal(created.status, 'pending'); assert.ok(created.expires_at - created.created_at <= 30000);
    assert.equal((await req('/actions/' + created.id + '/approve', { method: 'POST', token: owner, body: {} })).status, 409, 'offline agent cannot run');
    assert.deepEqual(agent.validate('mouse_click_primary', payload.params), payload.params);
    for (const p of [{ x: -1, y: 1 }, { x: 1, y: 10001 }, { x: 2.5, y: 1 }, { x: 1, y: 2, extra: 3 }]) {
      assert.throws(() => agent.validate('mouse_click_primary', p));
      assert.equal((await req('/actions', { method: 'POST', token: owner, body: { kind: 'mouse_click_primary', params: p } })).status, 400);
    }
    assert.match(await agent.execute(payload, true), /DRY RUN/);
  } finally { global.fetch = realFetch; }
});

test('keyboard can target fixed supported apps only with owner approval', async () => {
  const w = store.createWorkspace(), owner = w.token;
  const pair = store.createPairing(w.workspaceId), remote = store.redeemPairing(pair.code).token;
  const payload = { kind: 'keyboard_type_app', params: { target: 'code', text: 'hello' } };
  assert.deepEqual(agent.validate(payload.kind, payload.params), payload.params);
  assert.match(await agent.execute(payload, true), /DRY RUN/);
  for (const params of [{ target: 'cmd', text: 'hello' }, { target: 'powershell', text: 'x' }, { target: 'code', text: 'x\ny' }, { target: 'code', text: 'gsk_abcdefghijklmnopqrstuvwxyz123456' }, { target: 'code', text: 'x', extra: true }]) {
    assert.throws(() => agent.validate('keyboard_type_app', params));
    assert.equal((await req('/actions', { method: 'POST', token: owner, body: { kind: 'keyboard_type_app', params } })).status, 400);
  }
  assert.equal((await req('/actions', { method: 'POST', token: remote, body: payload })).status, 403);
  const result = await req('/actions', { method: 'POST', token: owner, body: payload });
  assert.equal(result.data.action.status, 'pending');
  assert.equal((await req('/actions/' + result.data.action.id + '/approve', { method: 'POST', token: remote, body: {} })).status, 403);
  assert.equal((await req('/actions/' + result.data.action.id + '/approve', { method: 'POST', token: owner, body: {} })).status, 409);
});

test('project builder repairs invalid JavaScript once without another approval', async () => {
  const { generateProject } = require('../src/nova/project-builder');
  const original = global.fetch; let calls = 0;
  const files = ['<!doctype html><html><head><link href="styles.css"></head><body><script src="app.js"></script></body></html>', 'body{}', 'function {', 'document.body.textContent = "Ready";'];
  global.fetch = async () => ({ ok: true, json: async () => ({ choices: [{ finish_reason: 'stop', message: { content: files[calls++] } }] }) });
  try {
    const result = await generateProject({ configured: true, base: 'https://example.test', model: 'test' }, 'Build a site');
    assert.equal(result.ok, true); assert.equal(calls, 4); assert.match(result.files['app.js'], /Ready/);
  } finally { global.fetch = original; }
});

test('one authorization drives multiple observed desktop steps and builds a project', async () => {
  const w = store.createWorkspace(), owner = w.token, other = store.createWorkspace().token;
  const remote = store.redeemPairing(store.createPairing(w.workspaceId).code).token;
  store.saveAiProvider(w.workspaceId, { provider: 'groq', model: 'text-model', base_url: 'https://api.groq.com/openai/v1', ...new Vault(dir).encrypt('gsk_test_key_abcdefghijklmnopqrstuvwxyz', w.workspaceId) });
  const bridgeToken = store.issueBridge(w.workspaceId), bridge = { Authorization: 'Bearer ' + bridgeToken };
  const image = 'data:image/jpeg;base64,' + Buffer.from([255, 216, 255, 1, 2, 3]).toString('base64');
  const realFetch = global.fetch; let visions = 0, generations = 0;
  const decisions = [
    { action: 'click', x: 3500, y: 5000, risk: 'low', reason: 'Open editor' },
    { action: 'type', target: 'code', text: 'Hello', risk: 'low', reason: 'Enter title' },
    { action: 'build_site', reason: 'Create static website' },
    { action: 'finish', reason: 'The static project is ready for review' },
  ];
  const generated = ['<!doctype html><html><head><link href="styles.css"></head><body><h1>Hi</h1><script src="app.js"></script></body></html>', 'body{}', 'console.log("hello")'];
  global.fetch = async (url, opts = {}) => {
    if (!String(url).startsWith('https://api.groq.com/')) return realFetch(url, opts);
    const body = JSON.parse(opts.body);
    const content = body.model === 'vision-model' ? JSON.stringify(decisions[visions++]) : generated[generations++];
    return new Response(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content } }] }), { status: 200 });
  };
  try {
    const start = { goal: 'build a bakery website', model: 'vision-model', confirm: true, primary: true };
    assert.equal((await req('/autonomy/start', { method: 'POST', token: owner, body: { ...start, confirm: false } })).status, 400);
    assert.equal((await req('/autonomy/start', { method: 'POST', token: remote, body: start })).status, 403);
    assert.equal((await req('/autonomy/start', { method: 'POST', token: owner, body: start })).data.ok, false);
    await req('/bridge/poll', { method: 'POST', headers: bridge, body: { system: {} } });
    const started = await req('/autonomy/start', { method: 'POST', token: owner, body: start });
    assert.equal(started.data.ok, true); const id = started.data.session.id;
    assert.equal((await req('/autonomy/' + id, { token: other })).status, 404);
    assert.equal((await req('/autonomy/start', { method: 'POST', token: owner, body: start })).data.ok, false);
    const step1 = await req('/autonomy/' + id + '/step', { method: 'POST', token: owner, body: { image } });
    assert.equal(step1.data.session.action.status, 'approved'); assert.equal(step1.data.session.action.kind, 'mouse_click_primary');
    assert.equal((await req('/autonomy/' + id + '/step', { method: 'POST', token: owner, body: { image } })).data.ok, false);
    const claim1 = (await req('/bridge/poll', { method: 'POST', headers: bridge, body: { system: {} } })).data.action;
    assert.equal(claim1.id, step1.data.session.action.id);
    await req('/bridge/result', { method: 'POST', headers: bridge, body: { id: claim1.id, ok: true, result: 'click sent' } });
    const step2 = await req('/autonomy/' + id + '/step', { method: 'POST', token: owner, body: { image } });
    assert.equal(step2.data.session.action.kind, 'keyboard_type_app'); assert.equal(step2.data.session.action.status, 'approved');
    const claim2 = (await req('/bridge/poll', { method: 'POST', headers: bridge, body: { system: {} } })).data.action;
    await req('/bridge/result', { method: 'POST', headers: bridge, body: { id: claim2.id, ok: true, result: 'typed' } });
    const step3 = await req('/autonomy/' + id + '/step', { method: 'POST', token: owner, body: { image } });
    assert.equal(step3.data.session.project.files.length, 3); assert.equal(generations, 3);
    assert.equal((await req('/builder/projects/' + step3.data.session.project.id, { token: owner })).status, 200);
    const done = await req('/autonomy/' + id + '/step', { method: 'POST', token: owner, body: { image } });
    assert.equal(done.data.session.state, 'complete'); assert.equal(done.data.session.steps, 3);
    assert.match(done.data.session.message, /AI reports/); assert.equal(visions, 4);
    assert.ok(!JSON.stringify((await req('/state', { token: owner })).data).includes(image));
  } finally { global.fetch = realFetch; }
});

test('visual work pauses for risky actions and stop cancels queued work', async () => {
  const w = store.createWorkspace(), owner = w.token;
  const remote = store.redeemPairing(store.createPairing(w.workspaceId).code).token;
  store.saveAiProvider(w.workspaceId, { provider: 'groq', model: 'text-model', base_url: 'https://api.groq.com/openai/v1', ...new Vault(dir).encrypt('gsk_test_key_abcdefghijklmnopqrstuvwxyz', w.workspaceId) });
  const bridgeToken = store.issueBridge(w.workspaceId), bridge = { Authorization: 'Bearer ' + bridgeToken };
  await req('/bridge/poll', { method: 'POST', headers: bridge, body: { system: {} } });
  const realFetch = global.fetch;
  global.fetch = async (url, opts) => String(url).startsWith('https://api.groq.com/') ? new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ action: 'click', x: 100, y: 100, risk: 'low', reason: 'Delete file' }) } }] }), { status: 200 }) : realFetch(url, opts);
  try {
    const id = (await req('/autonomy/start', { method: 'POST', token: owner, body: { goal: 'work on files', model: 'vision', confirm: true, primary: true } })).data.session.id;
    const image = 'data:image/jpeg;base64,' + Buffer.from([255, 216, 255, 1, 2]).toString('base64');
    const step = await req('/autonomy/' + id + '/step', { method: 'POST', token: owner, body: { image } });
    assert.equal(step.data.session.state, 'review'); assert.equal(step.data.session.action.status, 'pending');
    assert.equal((await req('/bridge/poll', { method: 'POST', headers: bridge, body: { system: {} } })).data.action, null);
    assert.equal((await req('/autonomy/' + id + '/approve', { method: 'POST', token: remote, body: { confirm: true } })).status, 403);
    assert.equal((await req('/autonomy/' + id + '/approve', { method: 'POST', token: owner, body: { confirm: false } })).status, 400);
    assert.equal((await req('/autonomy/' + id + '/approve', { method: 'POST', token: owner, body: { confirm: true } })).data.session.action.status, 'approved');
    assert.equal((await req('/autonomy/' + id + '/stop', { method: 'POST', token: owner, body: {} })).data.session.state, 'stopped');
    assert.equal((await req('/bridge/poll', { method: 'POST', headers: bridge, body: { system: {} } })).data.action, null);
    assert.equal(store.action(step.data.session.action.id).status, 'cancelled');
  } finally { global.fetch = realFetch; }
});

test('stopping a visual session aborts in-flight AI and cannot queue a later action', async () => {
  const w = store.createWorkspace(), owner = w.token;
  store.saveAiProvider(w.workspaceId, { provider: 'groq', model: 'text-model', base_url: 'https://api.groq.com/openai/v1', ...new Vault(dir).encrypt('gsk_test_key_abcdefghijklmnopqrstuvwxyz', w.workspaceId) });
  const bridge = { Authorization: 'Bearer ' + store.issueBridge(w.workspaceId) };
  await req('/bridge/poll', { method: 'POST', headers: bridge, body: { system: {} } });
  const realFetch = global.fetch; let started; const entered = new Promise(resolve => { started = resolve; });
  global.fetch = async (url, opts) => {
    if (!String(url).startsWith('https://api.groq.com/')) return realFetch(url, opts);
    started(); return new Promise((resolve, reject) => opts.signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true }));
  };
  try {
    const id = (await req('/autonomy/start', { method: 'POST', token: owner, body: { goal: 'Open a website', model: 'vision', confirm: true, primary: true } })).data.session.id;
    const image = 'data:image/jpeg;base64,' + Buffer.from([255, 216, 255, 1, 2]).toString('base64');
    const pending = req('/autonomy/' + id + '/step', { method: 'POST', token: owner, body: { image } });
    await entered;
    assert.equal((await req('/autonomy/' + id + '/stop', { method: 'POST', token: owner, body: {} })).data.session.state, 'stopped');
    assert.equal((await pending).data.ok, false);
    assert.equal((await req('/bridge/poll', { method: 'POST', headers: bridge, body: { system: {} } })).data.action, null);
    assert.equal((await req('/autonomy/' + id + '/step', { method: 'POST', token: owner, body: { image } })).data.ok, false);
  } finally { global.fetch = realFetch; }
});

test('visual session can revise its saved project without overwriting the original', async () => {
  const w = store.createWorkspace(), owner = w.token;
  store.saveAiProvider(w.workspaceId, { provider: 'groq', model: 'text-model', base_url: 'https://api.groq.com/openai/v1', ...new Vault(dir).encrypt('gsk_test_key_abcdefghijklmnopqrstuvwxyz', w.workspaceId) });
  const bridge = { Authorization: 'Bearer ' + store.issueBridge(w.workspaceId) };
  await req('/bridge/poll', { method: 'POST', headers: bridge, body: { system: {} } });
  const realFetch = global.fetch; let vision = 0, files = 0; let revisionHadContext = false;
  const decisions = [{ action: 'build_site', reason: 'Create site' }, { action: 'revise_site', changes: 'Make the heading bigger', reason: 'Improve heading' }, { action: 'finish', reason: 'Site is ready to review' }];
  const contents = ['<!doctype html><html><head><link href="styles.css"></head><body><h1>Original</h1><script src="app.js"></script></body></html>', 'h1{font-size:12px}', 'console.log("old")', '<!doctype html><html><head><link href="styles.css"></head><body><h1>Revised</h1><script src="app.js"></script></body></html>', 'h1{font-size:32px}', 'console.log("new")'];
  global.fetch = async (url, opts = {}) => {
    if (!String(url).startsWith('https://api.groq.com/')) return realFetch(url, opts);
    const request = JSON.parse(opts.body); let content;
    if (request.model === 'vision') content = JSON.stringify(decisions[vision++]);
    else { if (files >= 3 && JSON.stringify(request.messages).includes('Original')) revisionHadContext = true; content = contents[files++]; }
    return new Response(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content } }] }), { status: 200 });
  };
  try {
    const id = (await req('/autonomy/start', { method: 'POST', token: owner, body: { goal: 'Build a website', model: 'vision', confirm: true, primary: true } })).data.session.id;
    const image = 'data:image/jpeg;base64,' + Buffer.from([255, 216, 255, 1, 2]).toString('base64');
    const first = (await req('/autonomy/' + id + '/step', { method: 'POST', token: owner, body: { image } })).data.session.project;
    const second = (await req('/autonomy/' + id + '/step', { method: 'POST', token: owner, body: { image } })).data.session.project;
    assert.notEqual(first.id, second.id); assert.equal(revisionHadContext, true);
    assert.match((await req('/builder/projects/' + first.id, { token: owner })).data.files['index.html'], /Original/);
    assert.match((await req('/builder/projects/' + second.id, { token: owner })).data.files['index.html'], /Revised/);
    assert.equal((await req('/autonomy/' + id + '/step', { method: 'POST', token: owner, body: { image } })).data.session.state, 'complete');
  } finally { global.fetch = realFetch; }
});

test('restart cancels queued auto actions without cancelling ordinary actions', async () => {
  const { createAutonomy } = require('../src/nova/autonomy');
  const w = store.createWorkspace();
  const queued = store.createAction(w.workspaceId, 'mouse_click_primary', { x: 10, y: 10 }, 'NOVA AUTO: queued', 30000);
  store.transitionAction(queued.id, ['pending'], 'approved');
  const ordinary = store.createAction(w.workspaceId, 'open_youtube', {}, 'Open YouTube');
  store.transitionAction(ordinary.id, ['pending'], 'approved');
  createAutonomy({ store, dataDir: dir, workspaceAi: () => ({ configured: true }), bridgeOnline: () => true });
  assert.equal(store.action(queued.id).status, 'cancelled');
  assert.equal(store.action(ordinary.id).status, 'approved');
  store.transitionAction(ordinary.id, ['approved'], 'cancelled');
});

test('visual session rejects malformed, unsupported or out-of-range AI steps', async () => {
  const w = store.createWorkspace(), owner = w.token;
  store.saveAiProvider(w.workspaceId, { provider: 'groq', model: 'text-model', base_url: 'https://api.groq.com/openai/v1', ...new Vault(dir).encrypt('gsk_test_key_abcdefghijklmnopqrstuvwxyz', w.workspaceId) });
  const bridge = { Authorization: 'Bearer ' + store.issueBridge(w.workspaceId) };
  await req('/bridge/poll', { method: 'POST', headers: bridge, body: { system: {} } });
  const realFetch = global.fetch; let result = '{"action":"click","x":10001,"y":1,"risk":"low"}';
  global.fetch = async (url, opts) => String(url).startsWith('https://api.groq.com/') ? new Response(JSON.stringify({ choices: [{ message: { content: result } }] }), { status: 200 }) : realFetch(url, opts);
  try {
    const image = 'data:image/jpeg;base64,' + Buffer.from([255, 216, 255, 1, 2]).toString('base64');
    const id = (await req('/autonomy/start', { method: 'POST', token: owner, body: { goal: 'click a button', model: 'vision', confirm: true, primary: true } })).data.session.id;
    assert.equal((await req('/autonomy/' + id + '/step', { method: 'POST', token: owner, body: { image: 'not an image' } })).data.ok, false);
    const step = await req('/autonomy/' + id + '/step', { method: 'POST', token: owner, body: { image } });
    assert.equal(step.data.session.state, 'failed'); assert.equal((await req('/state', { token: owner })).data.actions.length, 0);
    const id2 = (await req('/autonomy/start', { method: 'POST', token: owner, body: { goal: 'work', model: 'vision', confirm: true, primary: true } })).data.session.id;
    result = '{"action":"shell","command":"bad","risk":"low"}';
    const step2 = await req('/autonomy/' + id2 + '/step', { method: 'POST', token: owner, body: { image } });
    assert.equal(step2.data.session.state, 'failed'); assert.equal((await req('/state', { token: owner })).data.actions.length, 0);
  } finally { global.fetch = realFetch; }
});

test('visual session cannot claim a website was completed before a project is saved', async () => {
  const w = store.createWorkspace(), owner = w.token;
  store.saveAiProvider(w.workspaceId, { provider: 'groq', model: 'text-model', base_url: 'https://api.groq.com/openai/v1', ...new Vault(dir).encrypt('gsk_test_key_abcdefghijklmnopqrstuvwxyz', w.workspaceId) });
  const bridge = { Authorization: 'Bearer ' + store.issueBridge(w.workspaceId) };
  await req('/bridge/poll', { method: 'POST', headers: bridge, body: { system: {} } });
  const realFetch = global.fetch;
  global.fetch = async (url, opts) => String(url).startsWith('https://api.groq.com/') ? new Response(JSON.stringify({ choices: [{ message: { content: '{"action":"finish","reason":"done"}' } }] }), { status: 200 }) : realFetch(url, opts);
  try {
    const id = (await req('/autonomy/start', { method: 'POST', token: owner, body: { goal: 'build a website', model: 'vision', confirm: true, primary: true } })).data.session.id;
    const image = 'data:image/jpeg;base64,' + Buffer.from([255, 216, 255, 1, 2]).toString('base64');
    const result = (await req('/autonomy/' + id + '/step', { method: 'POST', token: owner, body: { image } })).data.session;
    assert.equal(result.state, 'stopped'); assert.match(result.message, /No website project was saved/);
    assert.deepEqual((await req('/builder/projects', { token: owner })).data.projects, []);
  } finally { global.fetch = realFetch; }
});
