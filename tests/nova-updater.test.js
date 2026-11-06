'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { zipSync } = require('fflate');
const Database = require('better-sqlite3');
const updater = require('../desktop/nova-updater');

const sha = 'a'.repeat(40), prefix = `genz-hub-${sha}/`;
const string = value => Buffer.from(value);
function fixtureFiles(lock = 'old-lock') {
  return {
    'package.json': string('{"name":"example"}'), 'package-lock.json': string(lock),
    'src/server.js': string('// new server'), 'src/nova/router.js': string('// new router'),
    'public/nova/index.html': string('new page'), 'desktop/nova-updater.js': string('// new updater'),
    'desktop/nova-launch.bat': string('new launch'),
    'desktop/nova-agent.js': string('new bridge'),
    'data/nova/nova-vault.key': string('MALICIOUS'), 'desktop/nova-bridge.token': string('MALICIOUS'),
    'node_modules/existing': string('MALICIOUS'), 'START-NOVA.bat': string('REPLACED BOOTSTRAP'),
    'src/../../escape.js': string('BAD'),
  };
}
function archive(files = fixtureFiles()) { return Buffer.from(zipSync(Object.fromEntries(Object.entries(files).map(([k, v]) => [prefix + k, v])))); }
function put(root, file, content) { const f = path.join(root, ...file.split('/')); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, content); }
function read(root, file) { return fs.readFileSync(path.join(root, ...file.split('/')), 'utf8'); }
function makeRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'nova-updater-'));
  put(root, 'package.json', '{"name":"example"}'); put(root, 'package-lock.json', 'old-lock');
  put(root, 'src/server.js', '// old server'); put(root, 'src/nova/router.js', '// old router');
  put(root, 'public/nova/index.html', 'old page'); put(root, 'desktop/nova-updater.js', '// old updater');
  put(root, 'desktop/nova-launch.bat', 'old launch'); put(root, 'START-NOVA.bat', 'my bootstrap');
  put(root, 'desktop/nova-bridge.token', 'private bridge token'); put(root, 'data/nova/nova-vault.key', 'my vault key');
  put(root, 'data/nova/projects/project.txt', 'my website');
  put(root, 'node_modules/existing', 'my modules');
  for (const dep of ['express', 'fflate', 'better-sqlite3']) fs.symlinkSync(path.join(__dirname, '..', 'node_modules', dep), path.join(root, 'node_modules', dep), 'junction');
  put(root, 'node_modules/.nova-lock-sha256', crypto.createHash('sha256').update('old-lock').digest('hex'));
  const db = new Database(path.join(root, 'data/nova/nova.db')); db.exec('CREATE TABLE sample (value TEXT); INSERT INTO sample VALUES (\'private memory\')'); db.close();
  return root;
}
const clean = root => fs.rmSync(root, { recursive: true, force: true });
const options = downloads => ({ isBusy: async () => false, download: async url => { downloads.push(url); return url.includes('api.github.com') ? Buffer.from(JSON.stringify({ sha })) : archive(); }, installDependencies: () => true });

test('updater whitelist rejects secrets, ZIP traversal and Windows special paths', () => {
  for (const rel of ['../outside', 'src/../../escape.js', 'data/nova/nova.db', 'desktop/nova-bridge.token', '.env', 'public/NUL.txt', 'public/nova/x.', 'public/nova/x - Copy.js', 'node_modules/evil', 'START-NOVA.bat', 'src\\nova\\router.js']) assert.equal(updater.isAllowed(rel), false, rel);
  for (const rel of ['src/nova/router.js', 'public/nova/index.html', 'desktop/nova-updater.js', 'package-lock.json']) assert.equal(updater.isAllowed(rel), true, rel);
  const files = updater.extractFiles(archive(), sha);
  assert.equal(files.has('src/../../escape.js'), false); assert.equal(files.has('data/nova/nova-vault.key'), false);
  assert.equal(files.has('desktop/nova-bridge.token'), false); assert.equal(files.has('START-NOVA.bat'), false);
  assert.throws(() => updater.extractFiles(archive({ ...fixtureFiles(), 'src/NOVA/router.js': string('collision') }), sha), /Duplicate/);
  assert.throws(() => updater.extractFiles(archive({ 'src/server.js': string('incomplete') }), sha), /Incomplete/);
});

test('updater applies once, keeps private files and saves a consistent database and key backup', async () => {
  const root = makeRoot(), downloads = [];
  try {
    await updater.update(root, options(downloads));
    assert.equal(read(root, 'src/nova/router.js'), '// new router');
    assert.equal(read(root, 'public/nova/index.html'), 'new page');
    assert.equal(read(root, 'desktop/nova-bridge.token'), 'private bridge token');
    assert.equal(read(root, 'data/nova/nova-vault.key'), 'my vault key');
    assert.equal(read(root, 'data/nova/projects/project.txt'), 'my website');
    assert.equal(read(root, 'node_modules/existing'), 'my modules');
    assert.equal(read(root, 'START-NOVA.bat'), 'my bootstrap');
    const state = JSON.parse(read(root, 'data/nova-updater/state.json')); assert.equal(state.sha, sha);
    const paths = updater.statePaths(root); assert.equal(fs.existsSync(paths.pending), false);
    const backup = fs.readdirSync(paths.base).find(x => x.startsWith('backup-'));
    assert.equal(read(root, `data/nova-updater/${backup}/private-backup/nova/nova-vault.key`), 'my vault key');
    const snapshot = new Database(path.join(paths.base, backup, 'private-backup/nova/nova.db'), { readonly: true });
    assert.equal(snapshot.prepare('SELECT value FROM sample').get().value, 'private memory'); snapshot.close();
    assert.equal(downloads.length, 2);
    await updater.update(root, options(downloads)); assert.equal(downloads.length, 3); // metadata only; same commit
  } finally { clean(root); }
});

test('offline, busy port and paused auto-update never change application files', async () => {
  const root = makeRoot();
  try {
    await updater.update(root, { isBusy: async () => false, download: async () => { throw new Error('offline'); } });
    assert.equal(read(root, 'src/server.js'), '// old server');
    await assert.rejects(() => updater.update(root, { isBusy: async () => true }), /Port busy/);
    put(root, 'data/nova-updater/disabled', 'paused'); let calls = 0;
    await updater.update(root, { isBusy: async () => false, download: async () => { calls++; throw new Error(); } });
    assert.equal(calls, 0); assert.equal(read(root, 'src/server.js'), '// old server');
  } finally { clean(root); }
});

test('failed staged dependency install leaves previous code and dependencies untouched', async () => {
  const root = makeRoot(); let installs = 0;
  try {
    await updater.update(root, { isBusy: async () => false, download: async url => url.includes('api.github.com') ? Buffer.from(JSON.stringify({ sha })) : archive(fixtureFiles('changed-lock')), installDependencies: () => ++installs > 1 });
    assert.equal(installs, 1); assert.equal(read(root, 'src/server.js'), '// old server'); assert.equal(read(root, 'node_modules/existing'), 'my modules');
    assert.equal(read(root, 'package-lock.json'), 'old-lock');
    assert.equal(read(root, 'data/nova/nova-vault.key'), 'my vault key');
    assert.equal(fs.existsSync(updater.statePaths(root).pending), false);
    assert.equal(JSON.parse(read(root, 'data/nova-updater/state.json')).sha, null);
  } finally { clean(root); }
});

test('interrupted updates recover first and never overwrite later local edits', async () => {
  const root = makeRoot();
  try {
    const manifest = await updater.prepare(root, updater.extractFiles(archive(), sha), sha); updater.apply(root, manifest);
    let downloads = 0;
    await updater.update(root, { isBusy: async () => false, download: async () => { downloads++; throw new Error('should not download'); }, installDependencies: () => { throw new Error('should not install'); } });
    assert.equal(downloads, 0); assert.equal(read(root, 'src/server.js'), '// old server');
    assert.equal(fs.existsSync(updater.statePaths(root).pending), false);
    const second = await updater.prepare(root, updater.extractFiles(archive(), sha), sha); updater.apply(root, second);
    put(root, 'src/server.js', '// user modified this');
    assert.throws(() => updater.rollback(root, second), /manual recovery required/);
    assert.equal(read(root, 'src/server.js'), '// user modified this');
    assert.equal(read(root, 'data/nova/nova-vault.key'), 'my vault key');
  } finally { clean(root); }
});

test('updater refuses to follow a symlink in an application path', async () => {
  const root = makeRoot(); const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'nova-outside-'));
  try {
    fs.rmSync(path.join(root, 'src/nova'), { recursive: true }); fs.symlinkSync(outside, path.join(root, 'src/nova'), 'dir');
    await assert.rejects(() => updater.prepare(root, updater.extractFiles(archive(), sha), sha), /symlink/);
    assert.deepEqual(fs.readdirSync(outside), []);
  } finally { clean(root); clean(outside); }
});

test('successful dependency staging swaps modules, while interrupted swap restores original modules', async () => {
  const root = makeRoot(); let installs = 0;
  try {
    await updater.update(root, {
      isBusy: async () => false,
      download: async url => url.includes('api.github.com') ? Buffer.from(JSON.stringify({ sha })) : archive(fixtureFiles('changed-lock')),
      installDependencies: work => { installs++; put(work, 'node_modules/new-package', 'new module'); return true; },
      validateDependencies: () => true,
    });
    assert.equal(installs, 1); assert.equal(read(root, 'node_modules/new-package'), 'new module');
    const paths = updater.statePaths(root), backup = fs.readdirSync(paths.base).find(x => x.startsWith('backup-'));
    assert.equal(read(root, `data/nova-updater/${backup}/previous-node_modules/existing`), 'my modules');
    assert.equal(read(root, 'data/nova/nova-vault.key'), 'my vault key');
  } finally { clean(root); }
  const root2 = makeRoot();
  try {
    const manifest = await updater.prepare(root2, updater.extractFiles(archive(fixtureFiles('changed-lock')), sha), sha);
    const work = `data/nova-updater/${manifest.transactionName}/dependencies`;
    put(root2, `${work}/node_modules/.nova-update-transaction`, manifest.transactionName);
    put(root2, `${work}/node_modules/new-package`, 'new module');
    updater.apply(root2, manifest); updater.swapModules(root2, manifest);
    assert.equal(read(root2, 'node_modules/new-package'), 'new module');
    await updater.update(root2, { isBusy: async () => false, download: async () => { throw new Error('should not download'); } });
    assert.equal(read(root2, 'node_modules/existing'), 'my modules');
    assert.equal(read(root2, 'src/server.js'), '// old server');
    assert.equal(fs.existsSync(path.join(root2, 'node_modules/new-package')), false);
  } finally { clean(root2); }
});

test('updater retains its lock through launch, blocking simultaneous starts', async () => {
  const root = makeRoot(); let release, ready;
  const readyPromise = new Promise(r => { ready = r; }); const gate = new Promise(r => { release = r; });
  try {
    const first = updater.update(root, { isBusy: async () => false, download: async () => { throw new Error('offline'); }, afterUpdate: async () => { ready(); await gate; } });
    await readyPromise;
    assert.equal(fs.existsSync(updater.statePaths(root).lock), true);
    await assert.rejects(() => updater.update(root, { isBusy: async () => false }), /Another NOVA update is running/);
    release(); await first;
    assert.equal(fs.existsSync(updater.statePaths(root).lock), false);
  } finally { if (release) release(); clean(root); }
});

test('one-time installer modifies only the updater bootstrap and preserves the existing workspace', async () => {
  const { install, FILES } = require('../desktop/install-updater'); const target = makeRoot();
  try {
    await assert.rejects(() => install(path.join(__dirname, '..'), target, { isBusy: async () => true }), /Close the old NOVA/);
    assert.equal(read(target, 'START-NOVA.bat'), 'my bootstrap');
    await install(path.join(__dirname, '..'), target, { isBusy: async () => false });
    for (const rel of FILES) assert.equal(read(target, rel), read(path.join(__dirname, '..'), rel));
    assert.equal(read(target, 'src/nova/router.js'), '// old router');
    assert.equal(read(target, 'data/nova/nova-vault.key'), 'my vault key');
    assert.equal(read(target, 'desktop/nova-bridge.token'), 'private bridge token');
    const backup = fs.readdirSync(updater.statePaths(target).base).find(x => x.startsWith('bootstrap-backup-'));
    assert.equal(read(target, `data/nova-updater/${backup}/START-NOVA.bat`), 'my bootstrap');
    const db = new Database(path.join(target, 'data/nova/nova.db'), { readonly: true });
    assert.equal(db.prepare('SELECT value FROM sample').get().value, 'private memory'); db.close();
  } finally { clean(target); }
});
