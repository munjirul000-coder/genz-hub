'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const express = require('express');
const cookieParser = require('cookie-parser');
const { spawn } = require('child_process');
const { createNovaRouter } = require('../src/nova/router');

// The actual child/IPC flow is exercised in dry-run mode on Linux. Windows OS
// actions are deliberately not executed in the test environment.
test('one-click bridge is local-owner-only, confirmed, ephemeral, connected, and stoppable', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nova-easy-bridge-'));
  const children = []; let spawnOptions;
  const nova = createNovaRouter({ dataDir: dir, agentFile: path.join(__dirname, '../desktop/nova-agent.js'), localBridgeOptions: {
    platform: 'win32', waitMs: 6000,
    spawnChild: (bin, args, options) => { spawnOptions = { bin, args, options }; const child = spawn(bin, [...args, '--dry-run'], options); children.push(child); return child; },
  } });
  const app = express(); app.use(express.json()); app.use(cookieParser());
  app.use('/api/nova', (req, res, next) => { if (!['GET', 'HEAD'].includes(req.method) && req.get('X-GenZ-Client') !== '1') return res.status(403).json({ error: 'CSRF' }); next(); }, nova.router);
  const server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
  const origin = `http://127.0.0.1:${server.address().port}`, base = origin + '/api/nova';
  async function request(route, { token, headers = {}, body = {}, method = 'POST' } = {}) {
    const response = await fetch(base + route, { method, headers: { 'Content-Type': 'application/json', 'X-GenZ-Client': '1', ...(token ? { 'X-Nova-Session': token } : {}), ...headers }, ...(method === 'GET' ? {} : { body: JSON.stringify(body) }) });
    return { status: response.status, data: await response.json() };
  }
  try {
    const owner = nova.store.createWorkspace();
    const remote = nova.store.createSession(owner.workspaceId, 'remote').token;
    const opts = { token: owner.token, body: { confirm: true }, headers: { Origin: origin } };
    assert.equal((await request('/local-bridge/start', { body: { confirm: true }, headers: { Origin: origin } })).status, 401);
    assert.equal((await request('/local-bridge/start', { ...opts, headers: {} })).status, 403);
    assert.equal((await request('/local-bridge/start', { ...opts, headers: { Origin: 'https://evil.example', 'Sec-Fetch-Site': 'cross-site' } })).status, 403);
    assert.equal((await request('/local-bridge/start', { ...opts, headers: { Origin: origin, 'X-Forwarded-For': '192.0.2.1' } })).status, 403);
    assert.equal((await request('/local-bridge/start', { ...opts, headers: { Origin: 'http://evil.example', Host: 'evil.example' } })).status, 403);
    assert.equal((await request('/local-bridge/start', { ...opts, headers: { Origin: origin, 'X-GenZ-Client': '' } })).status, 403);
    assert.equal((await request('/local-bridge/start', { ...opts, token: remote })).status, 403);
    assert.equal((await request('/local-bridge/start', { ...opts, body: {} })).status, 400);
    assert.equal(children.length, 0);
    const old = nova.store.issueBridge(owner.workspaceId);
    const queued = nova.store.createAction(owner.workspaceId, 'open_notepad', {}, 'Open Notepad');
    const firstStart = request('/local-bridge/start', opts);
    while (!children.length) await new Promise(resolve => setTimeout(resolve, 10));
    const repeated = await request('/local-bridge/start', opts);
    assert.equal(repeated.data.ok, false); assert.equal(children.length, 1);
    const started = await firstStart;
    assert.equal(started.status, 200); assert.equal(started.data.ok, true); assert.equal(JSON.stringify(started.data).includes(old), false);
    assert.equal(nova.store.bridgeByToken(old), null); assert.equal(nova.store.action(queued.id).status, 'cancelled');
    assert.ok(spawnOptions.options.env.NOVA_BRIDGE_TOKEN); assert.ok(!spawnOptions.args.join(' ').includes(spawnOptions.options.env.NOVA_BRIDGE_TOKEN));
    assert.equal(spawnOptions.options.env.NOVA_AI_API_KEY, undefined); assert.equal(spawnOptions.options.shell, false); assert.equal(spawnOptions.options.stdio[3], 'ipc');
    assert.equal(fs.existsSync(path.join(dir, 'nova-bridge.token')), false);
    const state = await request('/state', { token: owner.token, method: 'GET' });
    assert.equal(state.data.bridge.online, true); assert.equal(state.data.bridge.managed, true); assert.equal(state.data.bridge.autoReconnect, true);
    const chat = await request('/chat', { token: owner.token, body: { message: 'open the firefox' }, headers: { Origin: origin } });
    assert.equal(chat.data.action.kind, 'open_firefox'); assert.equal(chat.data.action.status, 'pending');
    assert.equal((await request(`/actions/${chat.data.action.id}/approve`, opts)).data.action.status, 'approved');
    for (let i = 0; i < 60 && nova.store.action(chat.data.action.id).status !== 'completed'; i++) await new Promise(resolve => setTimeout(resolve, 100));
    assert.equal(nova.store.action(chat.data.action.id).status, 'completed'); assert.match(nova.store.action(chat.data.action.id).result, /DRY RUN/);
    const pending = nova.store.createAction(owner.workspaceId, 'open_notepad', {}, 'Open Notepad');
    assert.equal((await request('/local-bridge/stop', { ...opts, token: remote })).status, 403);
    assert.equal((await request('/local-bridge/stop', opts)).data.ok, true);
    assert.equal(nova.store.action(pending.id).status, 'cancelled'); assert.equal(nova.store.bridge(owner.workspaceId), undefined);
    const exited = new Promise(resolve => children[0].once('exit', resolve));
    await Promise.race([exited, new Promise((_, reject) => setTimeout(() => reject(new Error('managed bridge did not stop')), 5000))]);
    // With no managed child, stopping never revokes an unrelated manual token.
    const manual = nova.store.issueBridge(owner.workspaceId);
    assert.equal((await request('/local-bridge/stop', opts)).data.ok, false);
    assert.ok(nova.store.bridgeByToken(manual));
    const restart = await request('/local-bridge/start', opts); assert.equal(restart.data.ok, true);
    assert.equal(children.length, 2);
    const lastExit = new Promise(resolve => children[1].once('exit', resolve));
    nova.close(); assert.equal(nova.store.bridge(owner.workspaceId), undefined);
    await Promise.race([lastExit, new Promise((_, reject) => setTimeout(() => reject(new Error('bridge did not stop on shutdown')), 5000))]);
    assert.equal(nova.store.localBridgeEnabled(owner.workspaceId), true);
    nova.resumeLocalBridges(server.address().port);
    for (let i = 0; i < 70 && !(nova.store.bridge(owner.workspaceId)?.last_seen); i++) await new Promise(resolve => setTimeout(resolve, 100));
    assert.equal(children.length, 3); assert.ok(nova.store.bridge(owner.workspaceId)?.last_seen);
    assert.equal((await request('/local-bridge/stop', opts)).data.ok, true);
    assert.equal(nova.store.localBridgeEnabled(owner.workspaceId), false);
    nova.resumeLocalBridges(server.address().port); await new Promise(resolve => setTimeout(resolve, 250)); assert.equal(children.length, 3);
  } finally {
    nova.close(); for (const child of children) if (child.exitCode === null) child.kill('SIGKILL');
    await new Promise(resolve => server.close(resolve)); nova.store.close(); fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('a local bridge cannot start on a non-Windows server', async () => {
  const { NovaStore } = require('../src/nova/store'); const { createLocalBridge } = require('../src/nova/local-bridge');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nova-easy-platform-')); const store = new NovaStore(dir);
  try {
    const w = store.createWorkspace(); const manager = createLocalBridge({ store, agentFile: path.join(__dirname, '../desktop/nova-agent.js'), platform: 'linux' });
    assert.equal((await manager.start(w.workspaceId, 3000)).ok, false); assert.equal(store.bridge(w.workspaceId), undefined);
  } finally { store.close(); fs.rmSync(dir, { recursive: true, force: true }); }
});


test('startup errors and timeouts revoke only the managed token', async () => {
  const { NovaStore } = require('../src/nova/store'); const { createLocalBridge } = require('../src/nova/local-bridge');
  const { EventEmitter } = require('events');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nova-easy-failure-')); const store = new NovaStore(dir);
  const w = store.createWorkspace(); const agentFile = path.join(__dirname, '../desktop/nova-agent.js');
  try {
    const throwing = createLocalBridge({ store, agentFile, platform: 'win32', spawnChild: () => { throw new Error('sensitive details'); } });
    const failure = await throwing.start(w.workspaceId, 3000); assert.equal(failure.ok, false); assert.doesNotMatch(failure.error, /sensitive/); assert.equal(store.bridge(w.workspaceId), undefined);
    let killed = false;
    const stalled = createLocalBridge({ store, agentFile, platform: 'win32', waitMs: 50, spawnChild: () => Object.assign(new EventEmitter(), { connected: true, disconnect() { killed = true; } }) });
    const timeout = await stalled.start(w.workspaceId, 3000); assert.equal(timeout.ok, false); assert.equal(killed, true); assert.equal(store.bridge(w.workspaceId), undefined);
    // If a manual token replaced the managed one, shutdown must not revoke it.
    let child;
    const manager = createLocalBridge({ store, agentFile, platform: 'win32', waitMs: 50, spawnChild: () => (child = Object.assign(new EventEmitter(), { connected: true, disconnect() {} })) });
    const starting = manager.start(w.workspaceId, 3000); const replacement = store.issueBridge(w.workspaceId);
    manager.close(); await starting; child.emit('exit'); assert.ok(store.bridgeByToken(replacement));
  } finally { store.close(); fs.rmSync(dir, { recursive: true, force: true }); }
});

test('loopback peer, host, port and origin are all required', () => {
  const { isLocalRequest } = require('../src/nova/local-bridge');
  const headers = { host: 'localhost:3000', origin: 'http://localhost:3000' };
  const req = { socket: { remoteAddress: '127.0.0.1', localAddress: '127.0.0.1', localPort: 3000 }, get: name => headers[name.toLowerCase()] };
  assert.equal(isLocalRequest(req), true);
  req.socket.remoteAddress = '192.0.2.4'; assert.equal(isLocalRequest(req), false);
  req.socket.remoteAddress = '127.0.0.1'; req.socket.localAddress = '192.0.2.5'; assert.equal(isLocalRequest(req), false);
  req.socket.localAddress = '127.0.0.1'; headers.host = 'attacker.example:3000'; headers.origin = 'http://attacker.example:3000'; assert.equal(isLocalRequest(req), false);
  headers.host = 'localhost:3001'; headers.origin = 'http://localhost:3001'; assert.equal(isLocalRequest(req), false);
});
