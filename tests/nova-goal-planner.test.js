'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'); const os = require('node:os'); const path = require('node:path');
process.env.DISABLE_RATE_LIMIT = '1'; process.env.NODE_ENV = 'test';
const express = require('express'); const cookies = require('cookie-parser');
const { createNovaRouter } = require('../src/nova/router');
const delay = ms => new Promise(r => setTimeout(r, ms));
async function fixture(handler) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nova-plan-test-'));
  const realFetch = global.fetch, oldKey = process.env.NOVA_AI_API_KEY, oldProvider = process.env.NOVA_AI_PROVIDER;
  process.env.NOVA_AI_API_KEY = 'test-fixture'; process.env.NOVA_AI_PROVIDER = 'groq';
  const calls = [];
  global.fetch = (url, opts) => {
    if (!String(url).startsWith('https://api.groq.com/')) return realFetch(url, opts);
    calls.push(JSON.parse(opts.body)); return handler(opts, calls);
  };
  const nova = createNovaRouter({ dataDir: dir }); const app = express(); app.use(express.json()); app.use(cookies()); app.use('/api/nova', nova.router);
  const server = await new Promise(r => { const s = app.listen(0, '127.0.0.1', () => r(s)); }); const base = `http://127.0.0.1:${server.address().port}/api/nova`;
  async function req(route, { token, method = 'GET', body, headers = {} } = {}) {
    const response = await realFetch(base + route, { method, headers: { 'Content-Type': 'application/json', ...(token ? { 'X-Nova-Session': token } : {}), ...headers }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    return { status: response.status, data: await response.json() };
  }
  async function session() { return (await req('/session', { method: 'POST', body: {} })).data.token; }
  async function close() {
    nova.close(); await new Promise(r => server.close(r)); nova.store.close(); fs.rmSync(dir, { recursive: true, force: true }); global.fetch = realFetch;
    if (oldKey === undefined) delete process.env.NOVA_AI_API_KEY; else process.env.NOVA_AI_API_KEY = oldKey;
    if (oldProvider === undefined) delete process.env.NOVA_AI_PROVIDER; else process.env.NOVA_AI_PROVIDER = oldProvider;
  }
  return { nova, req, session, close, calls };
}
const ai = value => Response.json({ choices: [{ message: { content: JSON.stringify(value) } }] });
const template = { summary: 'Prepare workspace', steps: [{ description: 'Open Notepad', kind: 'open_notepad' }, { description: 'Write your notes', kind: 'manual' }] };
test('goal plan is owner-only, consent-based, session-bound and each fixed step requires approval and an actual result', async () => {
  const f = await fixture(() => ai(template));
  try {
    const owner = await f.session(), other = await f.session(), row = f.nova.store.session(owner), w = row.workspace_id;
    const remote = f.nova.store.createSession(w, 'remote').token; f.nova.store.issueBridge(w);
    assert.equal((await f.req('/goal-plans', { token: owner, method: 'POST', body: { goal: 'prepare workspace' } })).status, 400);
    assert.equal((await f.req('/goal-plans', { token: remote, method: 'POST', body: { goal: 'prepare', confirm: true } })).status, 403);
    assert.equal(f.calls.length, 0);
    const r = await f.req('/goal-plans', { token: owner, method: 'POST', body: { goal: 'prepare workspace', confirm: true } });
    assert.equal(r.data.ok, true); const id = r.data.plan.id, url = '/goal-plans/' + id;
    assert.equal(f.calls.length, 1); assert.equal(f.calls[0].messages.length, 2); assert.equal(f.calls[0].messages[1].content, 'prepare workspace');
    assert.equal(f.nova.store.actions(w).length, 0);
    assert.equal((await f.req(url, { token: other })).status, 404);
    const secondOwner = f.nova.store.createSession(w, 'owner').token; assert.equal((await f.req(url, { token: secondOwner })).status, 404);
    assert.equal((await f.req(url + '/approve', { token: owner, method: 'POST', body: {} })).status, 400);
    assert.equal((await f.req(url + '/manual-done', { token: owner, method: 'POST', body: { confirm: true } })).data.ok, false);
    const p = await f.req(url + '/prepare', { token: owner, method: 'POST', body: {} }); assert.equal(p.data.plan.action.kind, 'open_notepad'); assert.equal(p.data.plan.action.status, 'pending');
    const idAction = p.data.plan.action.id;
    assert.equal((await f.req('/actions/' + idAction + '/approve', { token: remote, method: 'POST', body: {} })).status, 403);
    assert.equal((await f.req('/actions/' + idAction + '/approve', { token: owner, method: 'POST', body: {} })).status, 403);
    assert.equal((await f.req(url + '/approve', { token: owner, method: 'POST', body: { confirm: true } })).data.ok, false);
    f.nova.store.heartbeat(w, {});
    const approved = await f.req(url + '/approve', { token: owner, method: 'POST', body: { confirm: true } }); assert.equal(approved.data.plan.action.status, 'approved');
    assert.equal((await f.req(url + '/manual-done', { token: owner, method: 'POST', body: { confirm: true } })).data.ok, false);
    f.nova.store.claimAction(w); f.nova.store.setAction(idAction, 'completed', 'Opened Notepad.');
    const updated = await f.req(url, { token: owner }); assert.equal(updated.data.plan.index, 1); assert.equal(updated.data.plan.steps[0].result, 'Opened Notepad.');
    const done = await f.req(url + '/manual-done', { token: owner, method: 'POST', body: { confirm: true } }); assert.equal(done.data.plan.state, 'complete'); assert.match(done.data.plan.message, /not been independently verified/); assert.equal(done.data.plan.steps[1].status, 'user-confirmed');
  } finally { await f.close(); }
});
test('untrusted provider output cannot inject actions, parameters, HTML or secrets into execution', async () => {
  const f = await fixture(() => ai({ summary: '<script>alert(1)</script>', steps: [{ description: 'Delete files', kind: 'mouse_click', params: { x: 1, y: 2 } }, { description: 'Open browser', kind: 'open_chrome', params: { command: 'evil' } }] }));
  try {
    const owner = await f.session(), w = f.nova.store.session(owner).workspace_id;
    assert.equal((await f.req('/goal-plans', { token: owner, method: 'POST', body: { goal: 'my password is abc', confirm: true } })).data.ok, false); assert.equal(f.calls.length, 0);
    const r = await f.req('/goal-plans', { token: owner, method: 'POST', body: { goal: 'help me', confirm: true } }); const plan = r.data.plan;
    assert.equal(plan.steps[0].kind, 'manual'); assert.equal(plan.steps[1].kind, 'open_chrome'); assert.equal(plan.steps[1].params, undefined); assert.equal(f.nova.store.actions(w).length, 0);
    assert.equal((await f.req(`/goal-plans/${plan.id}/prepare`, { token: owner, method: 'POST', body: {} })).data.ok, false);
    await f.req(`/goal-plans/${plan.id}/manual-done`, { token: owner, method: 'POST', body: { confirm: true } });
    const action = (await f.req(`/goal-plans/${plan.id}/prepare`, { token: owner, method: 'POST', body: {} })).data.plan.action;
    assert.deepEqual(action.params, {}); assert.equal(action.kind, 'open_chrome');
    await f.req(`/goal-plans/${plan.id}/stop`, { token: owner, method: 'POST', body: {} }); assert.equal(f.nova.store.action(action.id).status, 'cancelled');
  } finally { await f.close(); }
});
test('invalid plans and provider failures do not create actions or fake results', async () => {
  let count = 0; const f = await fixture(() => { count++; return count === 1 ? ai({ summary: 'bad', steps: Array(7).fill({ description: 'x', kind: 'open_notepad' }) }) : new Response('bad', { status: 503 }); });
  try { const owner = await f.session(), w = f.nova.store.session(owner).workspace_id;
    const request = () => f.req('/goal-plans', { token: owner, method: 'POST', body: { goal: 'help', confirm: true } });
    assert.match((await request()).data.error, /invalid plan/); assert.match((await request()).data.error, /provider/); assert.equal(f.nova.store.actions(w).length, 0);
  } finally { await f.close(); }
});
test('stop, workspace deletion and session invalidation prevent further queued work', async () => {
  const f = await fixture(() => ai(template));
  try { const owner = await f.session(), row = f.nova.store.session(owner), w = row.workspace_id; const bridgeToken = f.nova.store.issueBridge(w); f.nova.store.heartbeat(w, {});
    const plan = (await f.req('/goal-plans', { token: owner, method: 'POST', body: { goal: 'help', confirm: true } })).data.plan;
    const url = '/goal-plans/' + plan.id; const a = (await f.req(url + '/prepare', { token: owner, method: 'POST', body: {} })).data.plan.action;
    await f.req(url + '/approve', { token: owner, method: 'POST', body: { confirm: true } });
    f.nova.store.revokeSession(row.token_hash);
    // Actual agent poll guards session before claiming the queued action.
    const poll = await f.req('/bridge/poll', { method: 'POST', body: {}, headers: { Authorization: 'Bearer ' + bridgeToken } });
    assert.equal(poll.data.action, null); assert.equal(f.nova.store.action(a.id).status, 'cancelled');
  } finally { await f.close(); }
});
test('late provider response after workspace deletion does not create a plan', async () => {
  let release; const f = await fixture(() => new Promise(r => { release = () => r(ai(template)); }));
  try { const owner = await f.session(), row = f.nova.store.session(owner); const pending = f.req('/goal-plans', { token: owner, method: 'POST', body: { goal: 'help', confirm: true } });
    for (let i = 0; i < 100 && !release; i++) await delay(5); assert.ok(release);
    await f.req('/workspace', { token: owner, method: 'DELETE', body: { confirmation: 'DELETE' } }); release(); const r = await pending;
    assert.equal(r.data.ok, false); assert.equal(f.nova.store.workspace(row.workspace_id), undefined); assert.equal(f.nova.store.actions(row.workspace_id).length, 0);
  } finally { await f.close(); }
});

test('plan expiry and failed agent results stop future steps', async () => {
  const f = await fixture(() => ai(template));
  try {
    const owner = await f.session(), w = f.nova.store.session(owner).workspace_id; f.nova.store.issueBridge(w); f.nova.store.heartbeat(w, {});
    let plan = (await f.req('/goal-plans', { token: owner, method: 'POST', body: { goal: 'start my work', confirm: true } })).data.plan;
    let url = '/goal-plans/' + plan.id; let action = (await f.req(url + '/prepare', { token: owner, method: 'POST', body: {} })).data.plan.action;
    await f.req(url + '/approve', { token: owner, method: 'POST', body: { confirm: true } }); f.nova.store.claimAction(w); f.nova.store.setAction(action.id, 'failed', 'App is not installed.');
    let status = (await f.req(url, { token: owner })).data.plan;
    assert.equal(status.state, 'failed'); assert.equal(status.index, 0); assert.match(status.steps[0].result, /not installed/);
    assert.equal((await f.req(url + '/manual-done', { token: owner, method: 'POST', body: { confirm: true } })).data.ok, false);
    plan = (await f.req('/goal-plans', { token: owner, method: 'POST', body: { goal: 'try again', confirm: true } })).data.plan;
    url = '/goal-plans/' + plan.id; action = (await f.req(url + '/prepare', { token: owner, method: 'POST', body: {} })).data.plan.action;
    const originalNow = Date.now; Date.now = () => originalNow() + 11 * 60000;
    try { status = (await f.req(url, { token: owner })).data.plan; assert.equal(status.state, 'stopped'); assert.equal(f.nova.store.action(action.id).status, 'cancelled'); }
    finally { Date.now = originalNow; }
  } finally { await f.close(); }
});
test('server close cancels approved plans before a bridge can claim them', async () => {
  const f = await fixture(() => ai(template));
  try {
    const owner = await f.session(), w = f.nova.store.session(owner).workspace_id; f.nova.store.issueBridge(w); f.nova.store.heartbeat(w, {});
    const plan = (await f.req('/goal-plans', { token: owner, method: 'POST', body: { goal: 'prepare', confirm: true } })).data.plan;
    const url = '/goal-plans/' + plan.id; const action = (await f.req(url + '/prepare', { token: owner, method: 'POST', body: {} })).data.plan.action;
    await f.req(url + '/approve', { token: owner, method: 'POST', body: { confirm: true } }); f.nova.close();
    assert.equal(f.nova.store.action(action.id).status, 'cancelled'); assert.equal(f.nova.store.claimAction(w), null);
  } finally { await f.close(); }
});
