'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { PassThrough } = require('node:stream');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const net = require('node:net');
const { createCompanion, openWindow, localUrl, trayArgs } = require('../src/nova/desktop-companion');

class Child extends EventEmitter {
  constructor() { super(); this.stdout = new PassThrough(); this.killed = false; this.connected = true; this.messages = []; }
  kill() { this.killed = true; return true; }
  send(message, cb) { this.messages.push(message); cb?.(null); }
  unref() { this.unreferenced = true; }
}
function setup(options = {}) {
  const server = new Child(), tray = new Child(), shown = [], events = [], launches = [];
  const c = createCompanion({ root: '/test', platform: 'win32', systemRoot: 'C:/Windows', port: 3000, log: { log: x => events.push(x), error: x => events.push(x) }, open: v => shown.push(v), spawnChild: (exe, args, opts) => { launches.push({ exe, args, opts }); return launches.length === 1 ? server : tray; }, ...options });
  const done = c.start(); return { c, done, server, tray, shown, events, launches };
}
const wait = ms => new Promise(r => setTimeout(r, ms));

test('companion offers only fixed local windows and static tray commands', () => {
  assert.equal(localUrl(3000, 'voice'), 'http://localhost:3000/nova?voice=1#conversation');
  for (const [port, view] of [[0, 'main'], [65536, 'main'], [3000, 'https://evil.test'], [3000, '../']]) assert.throws(() => localUrl(port, view));
  let call; const child = new Child();
  openWindow(3000, 'voice', { systemRoot: 'C:/Windows', spawnChild: (...args) => { call = args; return child; } });
  assert.match(call[0], /rundll32\.exe$/); assert.deepEqual(call[1], ['url.dll,FileProtocolHandler', localUrl(3000, 'voice')]); assert.equal(call[2].shell, false); assert.equal(child.unreferenced, true);
  const decoded = Buffer.from(trayArgs().at(-1), 'base64').toString('utf16le');
  assert.match(decoded, /Open voice page/); assert.match(decoded, /GetProcessById\(\d+\)/); assert.throws(() => trayArgs('1; bad'));  assert.match(decoded, /Stop NOVA/); assert.doesNotMatch(decoded, /SpeechRecognition|capture|password|token/i);
  assert.throws(() => createCompanion({ platform: 'linux' }), /Windows/);
});

test('tray opens only fixed windows and shuts down the owned server through IPC', async () => {
  const x = setup();
  assert.equal(x.launches.length, 1); assert.equal(x.launches[0].opts.shell, false); assert.ok(x.launches[0].args.includes('--desktop-companion'));
  x.server.emit('message', { type: 'nova-server-ready', port: 9999 }); assert.equal(x.launches.length, 1);
  x.server.emit('message', { type: 'nova-server-ready', port: 3000 }); assert.equal(x.launches.length, 2);
  assert.equal(x.launches[1].opts.shell, false);
  x.tray.stdout.write('RE'); x.tray.stdout.write('ADY\n'); assert.deepEqual(x.shown, ['main']);
  x.tray.stdout.write('OPEN_VOICE\nOPEN_MAIN\nOPEN_URL https://bad.test\n'); assert.deepEqual(x.shown, ['main', 'voice', 'main']);
  x.tray.stdout.write('STOP\n'); assert.deepEqual(x.server.messages, [{ type: 'nova-companion-stop' }]); assert.equal(x.tray.killed, true);
  x.server.emit('exit', 0); assert.equal(await x.done, 0);
});

test('tray failure falls back once to visible console; unexpected tray loss stops server', async () => {
  const x = setup(); x.server.emit('message', { type: 'nova-server-ready', port: 3000 });
  x.tray.emit('error', new Error('unavailable')); x.tray.emit('exit', 1); x.tray.stdout.write('READY\n');
  assert.deepEqual(x.shown, ['main']); assert.match(x.events.join(' '), /tray unavailable/i);
  x.c.stop(); x.server.emit('exit', 0); assert.equal(await x.done, 0);
  const y = setup(); y.server.emit('message', { type: 'nova-server-ready', port: 3000 }); y.tray.stdout.write('READY\n'); y.tray.emit('exit', 1);
  assert.deepEqual(y.server.messages, [{ type: 'nova-companion-stop' }]); y.server.emit('exit', 0); assert.equal(await y.done, 1);
});

test('server startup failure never opens a browser and timeout stops the owned child', async () => {
  const x = setup(); x.server.emit('exit', 1); assert.equal(await x.done, 1); assert.deepEqual(x.shown, []);
  const y = setup({ readyMs: 10 }); await wait(30); assert.deepEqual(y.server.messages, [{ type: 'nova-companion-stop' }]); y.server.emit('exit', 0); assert.equal(await y.done, 1); assert.deepEqual(y.shown, []);
});

test('real server announces readiness and supports graceful companion IPC shutdown', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nova-desktop-server-'));
  const s = net.createServer(); await new Promise(r => s.listen(0, '127.0.0.1', r)); const port = s.address().port; await new Promise(r => s.close(r));
  const child = spawn(process.execPath, [path.join(__dirname, '../src/server.js'), '--nova-home', '--desktop-companion'], { env: { ...process.env, PORT: String(port), DATA_DIR: dir, NODE_ENV: 'test' }, stdio: ['ignore', 'ignore', 'pipe', 'ipc'] });
  let stderr = ''; child.stderr.on('data', d => { stderr += d; });
  try {
    const ready = await Promise.race([new Promise((resolve, reject) => { child.on('message', resolve); child.once('exit', code => reject(new Error('server exited ' + code + ' ' + stderr))); }), new Promise((_, reject) => { const timer = setTimeout(() => reject(new Error('server readiness timed out')), 20000); timer.unref(); })]);
    assert.deepEqual(ready, { type: 'nova-server-ready', port });
    const health = await fetch(`http://127.0.0.1:${port}/api/health`); assert.equal(health.status, 200);
    const ended = new Promise(r => child.once('exit', (code, signal) => r({ code, signal })));
    child.send({ type: 'nova-companion-stop' }); assert.deepEqual(await ended, { code: 0, signal: null });
  } finally { if (child.exitCode === null) child.kill(); fs.rmSync(dir, { recursive: true, force: true }); }
});

test('real server exits when its companion IPC connection disappears', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nova-desktop-disconnect-'));
  const s = net.createServer(); await new Promise(r => s.listen(0, '127.0.0.1', r)); const port = s.address().port; await new Promise(r => s.close(r));
  const child = spawn(process.execPath, [path.join(__dirname, '../src/server.js'), '--desktop-companion'], { env: { ...process.env, PORT: String(port), DATA_DIR: dir, NODE_ENV: 'test' }, stdio: ['ignore', 'ignore', 'ignore', 'ipc'] });
  try {
    await Promise.race([new Promise((resolve, reject) => { child.once('message', resolve); child.once('exit', () => reject(new Error('server exited before ready'))); }), new Promise((_, reject) => { const timer = setTimeout(() => reject(new Error('startup timeout')), 20000); timer.unref(); })]);
    const ended = new Promise(resolve => child.once('exit', (code, signal) => resolve({ code, signal })));
    child.disconnect(); assert.deepEqual(await ended, { code: 0, signal: null });
  } finally { if (child.exitCode === null) child.kill(); fs.rmSync(dir, { recursive: true, force: true }); }
});
