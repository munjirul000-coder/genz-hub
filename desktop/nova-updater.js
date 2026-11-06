'use strict';
// Startup updater: repository and branch are hard-coded, HTTPS only. Archive is
// pinned to the exact commit returned by GitHub, not a moving archive URL.
// Only application files are changed. Never include data, keys, tokens or node_modules.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const https = require('https');
const net = require('net');
const { spawn, spawnSync } = require('child_process');
const { unzipSync } = require('fflate');

const ROOT = path.resolve(__dirname, '..');
const META_URL = 'https://api.github.com/repos/munjirul000-coder/genz-hub/commits/arena%2F549dbb1e-genz-hub';
const ARCHIVE_URL = sha => `https://codeload.github.com/munjirul000-coder/genz-hub/zip/${sha}`;
const MAX_ARCHIVE = 100 * 1024 * 1024, MAX_UNPACKED = 40 * 1024 * 1024, MAX_FILE = 8 * 1024 * 1024;
const hash = data => crypto.createHash('sha256').update(data).digest('hex');

function isAllowed(rel) {
  if (typeof rel !== 'string' || !rel || rel.includes('\\') || rel.startsWith('/') || rel.includes(':')) return false;
  const parts = rel.split('/');
  if (parts.some(p => !p || p === '.' || p === '..' || p.startsWith('.') || / - Copy(?: \(\d+\))?/i.test(p) || /^(?:data|node_modules)$/i.test(p) || /[. ]$/.test(p) || /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(p))) return false;
  if (/\.(?:token|key|pem|p12|pfx|db|sqlite|log)$/i.test(rel)) return false;
  return /^src\/[A-Za-z0-9_/-]+\.js$/.test(rel) || /^public\/[A-Za-z0-9_.\/-]+$/.test(rel) ||
    ['package.json', 'package-lock.json', 'desktop/nova-updater.js', 'desktop/nova-launch.bat', 'desktop/nova-agent.js', 'desktop/START-BRIDGE.bat', 'desktop/STOP-AUTO-UPDATE.bat', 'desktop/START-AUTO-UPDATE.bat'].includes(rel);
}
function inside(root, rel) {
  if (!isAllowed(rel)) throw new Error('Unsafe update path');
  const target = path.resolve(root, ...rel.split('/'));
  if (!target.startsWith(path.resolve(root) + path.sep)) throw new Error('Update path outside NOVA');
  // Do not follow symlinks in the installed application or overwrite a symlink.
  let current = path.resolve(root);
  for (const part of rel.split('/')) {
    current = path.join(current, part);
    try { if (fs.lstatSync(current).isSymbolicLink()) throw new Error('Update target contains a symlink'); }
    catch (err) { if (err.code !== 'ENOENT') throw err; }
  }
  return target;
}
function extractFiles(bytes, sha) {
  if (!/^[a-f0-9]{40}$/.test(sha)) throw new Error('Invalid commit ID');
  const prefix = `genz-hub-${sha}/`; let total = 0, count = 0; const seen = new Set();
  const selected = unzipSync(bytes, { filter(entry) {
    if (!entry.name.startsWith(prefix)) throw new Error('Unexpected archive root');
    const rel = entry.name.slice(prefix.length);
    if (!isAllowed(rel)) return false;
    if (seen.has(rel.toLowerCase())) throw new Error('Duplicate update path');
    seen.add(rel.toLowerCase());
    if (entry.originalSize > MAX_FILE || !Number.isSafeInteger(entry.originalSize) || entry.originalSize < 0) throw new Error('Update file too large');
    total += entry.originalSize; count++;
    if (count > 600 || total > MAX_UNPACKED) throw new Error('Update too large');
    return true;
  } });
  const files = new Map();
  for (const [name, bytes] of Object.entries(selected)) {
    const rel = name.slice(prefix.length);
    if (!isAllowed(rel) || files.has(rel)) throw new Error('Invalid archive entry');
    files.set(rel, Buffer.from(bytes));
  }
  for (const required of ['package.json', 'package-lock.json', 'src/server.js', 'src/nova/router.js', 'public/nova/index.html', 'desktop/nova-updater.js', 'desktop/nova-launch.bat']) {
    if (!files.has(required)) throw new Error('Incomplete NOVA update: ' + required);
  }
  return files;
}
function mkdir(file) { fs.mkdirSync(path.dirname(file), { recursive: true }); }
function atomicWrite(file, content) {
  mkdir(file);
  const temp = file + '.nova-update-' + crypto.randomBytes(8).toString('hex') + '.tmp';
  try { fs.writeFileSync(temp, content, { flag: 'wx' }); fs.renameSync(temp, file); }
  finally { try { fs.unlinkSync(temp); } catch {} }
}
function readJson(file, fallback = null) { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (err) { if (err.code === 'ENOENT') return fallback; throw err; } }
function statePaths(root) {
  const base = path.join(root, 'data', 'nova-updater');
  return { base, lock: path.join(base, 'updater.lock'), pending: path.join(base, 'pending.json'), state: path.join(base, 'state.json') };
}
async function backupData(root, transaction) {
  // SQLite's backup API makes a consistent snapshot, including committed WAL
  // data. The vault key is copied alongside the database, never uploaded.
  const data = path.resolve(process.env.DATA_DIR || path.join(root, 'data'));
  for (const rel of ['genzhub.db', 'nova/nova.db']) {
    const source = path.join(data, ...rel.split('/'));
    if (!fs.existsSync(source)) continue;
    if (fs.lstatSync(source).isSymbolicLink()) throw new Error('Cannot back up a symlinked database');
    const dest = path.join(transaction, 'private-backup', ...rel.split('/')); mkdir(dest);
    // Load the native SQLite module in a short-lived child. Windows can keep a
    // loaded .node DLL locked, preventing a later node_modules directory swap.
    const sqlite = require.resolve('better-sqlite3', { paths: [root] });
    const code = `const D=require(process.argv[3]);const db=new D(process.argv[1],{readonly:true,fileMustExist:true});db.backup(process.argv[2]).then(()=>db.close(),e=>{console.error(e.message);db.close();process.exitCode=1})`;
    const result = spawnSync(process.execPath, ['-e', code, source, dest, sqlite], { cwd: root, timeout: 120000, encoding: 'utf8', windowsHide: true });
    if (result.error || result.status !== 0) throw new Error('Database backup failed; update was not applied.');
    try { fs.chmodSync(dest, 0o600); } catch {}
  }
  const key = path.join(data, 'nova', 'nova-vault.key');
  if (fs.existsSync(key)) {
    if (fs.lstatSync(key).isSymbolicLink()) throw new Error('Cannot back up a symlinked vault key');
    const dest = path.join(transaction, 'private-backup', 'nova', 'nova-vault.key'); mkdir(dest); fs.copyFileSync(key, dest);
    try { fs.chmodSync(dest, 0o600); } catch {}
  }
}
async function prepare(root, files, sha) {
  const paths = statePaths(root); fs.mkdirSync(paths.base, { recursive: true });
  if (fs.existsSync(paths.pending)) throw new Error('Pending update needs recovery');
  const transactionName = `backup-${Date.now()}-${crypto.randomBytes(6).toString('hex')}`;
  const transaction = path.join(paths.base, transactionName);
  fs.mkdirSync(transaction, { recursive: false });
  try { fs.chmodSync(transaction, 0o700); } catch {}
  await backupData(root, transaction);
  const entries = [];
  for (const [rel, content] of files) {
    const target = inside(root, rel);
    const exists = fs.existsSync(target);
    if (exists && !fs.statSync(target).isFile()) throw new Error('Update target is not a file: ' + rel);
    if (exists && fs.statSync(target).size > MAX_FILE) throw new Error('Installed app file too large: ' + rel);
    const before = exists ? fs.readFileSync(target) : null;
    if (before && before.equals(content)) continue;
    const backup = path.join(transaction, 'app', ...rel.split('/'));
    const staged = path.join(transaction, 'stage', ...rel.split('/'));
    if (before) { mkdir(backup); fs.writeFileSync(backup, before); }
    mkdir(staged); fs.writeFileSync(staged, content);
    entries.push({ rel, existed: exists, beforeHash: before ? hash(before) : null, afterHash: hash(content) });
  }
  const manifest = { version: 1, transactionName, target: sha, entries, modules: null };
  atomicWrite(paths.pending, JSON.stringify(manifest));
  return manifest;
}
function transactionPath(root, manifest) {
  if (!manifest || manifest.version !== 1 || !/^backup-\d+-[a-f0-9]{12}$/.test(manifest.transactionName) || !Array.isArray(manifest.entries) || manifest.entries.length > 600 || !/^[a-f0-9]{40}$/.test(manifest.target)) throw new Error('Invalid updater recovery record');
  return path.join(statePaths(root).base, manifest.transactionName);
}
function apply(root, manifest) {
  const transaction = transactionPath(root, manifest);
  for (const entry of manifest.entries) {
    const target = inside(root, entry.rel), stage = path.join(transaction, 'stage', ...entry.rel.split('/'));
    const current = fs.existsSync(target) ? hash(fs.readFileSync(target)) : null;
    if (current !== entry.beforeHash) throw new Error('File changed during update: ' + entry.rel);
    const data = fs.readFileSync(stage); if (hash(data) !== entry.afterHash) throw new Error('Staged file changed');
    atomicWrite(target, data);
  }
}
function modulePaths(root, manifest) {
  const transaction = transactionPath(root, manifest);
  return { current: path.join(root, 'node_modules'), previous: path.join(transaction, 'previous-node_modules'), staged: path.join(transaction, 'dependencies', 'node_modules'), failed: path.join(transaction, 'recovered-new-node_modules') };
}
function moduleMarker(folder) {
  try { return fs.readFileSync(path.join(folder, '.nova-update-transaction'), 'utf8'); } catch { return null; }
}
function swapModules(root, manifest) {
  const paths = statePaths(root), dirs = modulePaths(root, manifest);
  const existed = fs.existsSync(dirs.current);
  if (existed && (fs.lstatSync(dirs.current).isSymbolicLink() || !fs.statSync(dirs.current).isDirectory())) throw new Error('Cannot update a symlinked node_modules folder');
  if (fs.existsSync(dirs.previous) || !fs.existsSync(dirs.staged) || moduleMarker(dirs.staged) !== manifest.transactionName) throw new Error('Invalid staged dependencies');
  manifest.modules = { existed };
  atomicWrite(paths.pending, JSON.stringify(manifest));
  if (existed) fs.renameSync(dirs.current, dirs.previous);
  fs.renameSync(dirs.staged, dirs.current);
}
function restoreModules(root, manifest) {
  if (!manifest.modules) return;
  if (typeof manifest.modules.existed !== 'boolean') throw new Error('Invalid dependency recovery record');
  const dirs = modulePaths(root, manifest), previous = fs.existsSync(dirs.previous), current = fs.existsSync(dirs.current);
  if (current && fs.lstatSync(dirs.current).isSymbolicLink()) throw new Error('Cannot restore over symlinked dependencies');
  if (previous) {
    if (!manifest.modules.existed) throw new Error('Unexpected dependency backup');
    if (current) {
      if (moduleMarker(dirs.current) !== manifest.transactionName || fs.existsSync(dirs.failed)) throw new Error('Dependencies changed after update; manual recovery required');
      fs.renameSync(dirs.current, dirs.failed);
    }
    fs.renameSync(dirs.previous, dirs.current);
  } else if (!manifest.modules.existed && current) {
    if (moduleMarker(dirs.current) !== manifest.transactionName || fs.existsSync(dirs.failed)) throw new Error('Dependencies changed after update; manual recovery required');
    fs.renameSync(dirs.current, dirs.failed);
  } else if (manifest.modules.existed && !current) throw new Error('Previous dependencies are missing');
}
function rollback(root, manifest) {
  const paths = statePaths(root), transaction = transactionPath(root, manifest);
  // Inspect all files first; never overwrite user modifications made during recovery.
  for (const e of manifest.entries) {
    const target = inside(root, e.rel), current = fs.existsSync(target) ? hash(fs.readFileSync(target)) : null;
    if (current !== e.beforeHash && current !== e.afterHash) throw new Error('A file changed after the update; manual recovery required: ' + e.rel);
    if (e.existed) { const backup = fs.readFileSync(path.join(transaction, 'app', ...e.rel.split('/'))); if (hash(backup) !== e.beforeHash) throw new Error('Backup integrity check failed'); }
  }
  for (const e of manifest.entries) {
    const target = inside(root, e.rel), current = fs.existsSync(target) ? hash(fs.readFileSync(target)) : null;
    if (current === e.beforeHash) continue;
    if (e.existed) atomicWrite(target, fs.readFileSync(path.join(transaction, 'app', ...e.rel.split('/'))));
    else if (current === e.afterHash) fs.unlinkSync(target); // Only the updater-created app file.
  }
  restoreModules(root, manifest);
  // The caller removes the marker after recovery succeeds.
  return paths.pending;
}
function finalize(root, manifest) {
  const paths = statePaths(root); transactionPath(root, manifest);
  atomicWrite(paths.state, JSON.stringify({ sha: manifest.target, updatedAt: Date.now() }));
  fs.unlinkSync(paths.pending);
}
function fetchBytes(url, limit, timeout = 25000) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    if (u.protocol !== 'https:' || !['api.github.com', 'codeload.github.com'].includes(u.hostname)) return reject(new Error('Invalid update host'));
    const req = https.get(u, { headers: { 'User-Agent': 'NOVA-Updater/1.0', 'Accept': 'application/vnd.github+json' }, timeout }, res => {
      if (res.statusCode !== 200) { res.resume(); return reject(new Error('Update server HTTP ' + res.statusCode)); }
      const chunks = []; let size = 0;
      res.on('data', chunk => { size += chunk.length; if (size > limit) req.destroy(new Error('Update download too large')); else chunks.push(chunk); });
      res.on('end', () => resolve(Buffer.concat(chunks))); res.on('error', reject);
    });
    req.on('timeout', () => req.destroy(new Error('Update request timed out'))); req.on('error', reject);
  });
}
function portBusy(port) {
  return new Promise(resolve => {
    const socket = net.createConnection({ host: '127.0.0.1', port });
    socket.setTimeout(1500); socket.on('connect', () => { socket.destroy(); resolve(true); });
    socket.on('timeout', () => { socket.destroy(); resolve(true); });
    socket.on('error', err => { socket.destroy(); resolve(err.code !== 'ECONNREFUSED'); });
  });
}
function acquireLock(file) {
  mkdir(file);
  for (let attempt = 0; attempt < 2; attempt++) {
    try { const fd = fs.openSync(file, 'wx', 0o600); fs.writeFileSync(fd, JSON.stringify({ pid: process.pid })); fs.closeSync(fd); return; }
    catch (err) {
      if (err.code !== 'EEXIST' || attempt) throw err;
      let pid; try { pid = JSON.parse(fs.readFileSync(file, 'utf8')).pid; } catch {
        if (Date.now() - fs.statSync(file).mtimeMs < 300000) throw new Error('Another NOVA update may be starting. Please wait and try again.');
        fs.unlinkSync(file); continue;
      }
      if (!Number.isSafeInteger(pid) || pid <= 0) throw new Error('Invalid update lock. Manual recovery required.');
      try { process.kill(pid, 0); throw new Error('Another NOVA update is running.'); }
      catch (e) { if (e.code !== 'ESRCH') throw e; }
      fs.unlinkSync(file);
    }
  }
}
function install(root) {
  console.log('NOVA dependencies update hocche. Ektu opekkha korun...');
  const result = process.platform === 'win32'
    ? spawnSync(process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', 'npm ci --omit=dev'], { cwd: root, stdio: 'inherit', timeout: 600000, windowsHide: false })
    : spawnSync('npm', ['ci', '--omit=dev'], { cwd: root, stdio: 'inherit', timeout: 600000 });
  return result.status === 0 && !result.error;
}
function verifyDependencies(root) {
  // Test native modules in a child so Windows can rename the staged folder.
  const code = `const p=require('path');const root=process.argv[1];for(const x of ['express','fflate','better-sqlite3'])require(p.join(root,'node_modules',x));const D=require(p.join(root,'node_modules','better-sqlite3'));const db=new D(':memory:');db.close()`;
  const result = spawnSync(process.execPath, ['-e', code, root], { cwd: root, timeout: 30000, encoding: 'utf8', windowsHide: true });
  return result.status === 0 && !result.error;
}
function setDependencyStamp(root) {
  const h = hash(fs.readFileSync(path.join(root, 'package-lock.json')));
  atomicWrite(path.join(root, 'node_modules', '.nova-lock-sha256'), h);
}
async function updateContents(root, { download, installDependencies, validateDependencies }) {
    const paths = statePaths(root);
    const pending = readJson(paths.pending);
    if (pending) {
      console.log('Interrupted update recover hocche...');
      rollback(root, pending);
      atomicWrite(paths.state, JSON.stringify({ sha: null, recoveredAt: Date.now() }));
      fs.unlinkSync(paths.pending);
      console.log('Previous version restored; starting it now.');
      return;
    }
    if (fs.existsSync(path.join(paths.base, 'disabled'))) { console.log('Automatic updates paused.'); return; }
    let sha, archive;
    try {
      const metadata = JSON.parse((await download(META_URL, 1024 * 1024)).toString('utf8'));
      sha = metadata.sha;
      if (!/^[a-f0-9]{40}$/.test(sha)) throw new Error('Invalid update version');
      const state = readJson(paths.state, {});
      if (state.sha === sha) { console.log('NOVA is up to date.'); return; }
      console.log('NOVA update download hocche...');
      archive = await download(ARCHIVE_URL(sha), MAX_ARCHIVE, 90000);
    } catch (err) {
      console.log('Update check unavailable; existing NOVA will start. (' + err.message + ')');
      return;
    }
    let manifest, files;
    try { files = extractFiles(archive, sha); manifest = await prepare(root, files, sha); }
    catch (err) { console.log('Update could not be prepared; existing NOVA will start. (' + err.message + ')'); return; }
    try {
      const lockChanged = manifest.entries.some(e => e.rel === 'package-lock.json' || e.rel === 'package.json');
      let dependenciesReady = false;
      try {
        const stamp = fs.readFileSync(path.join(root, 'node_modules', '.nova-lock-sha256'), 'utf8');
        dependenciesReady = stamp === hash(fs.readFileSync(path.join(root, 'package-lock.json')));
        for (const dep of ['express', 'fflate', 'better-sqlite3']) require.resolve(dep, { paths: [root] });
      } catch { dependenciesReady = false; }
      if (lockChanged || !dependenciesReady) {
        // Install in a separate folder first. A failed npm install cannot damage
        // the currently working dependencies, even if internet drops midway.
        const work = path.join(transactionPath(root, manifest), 'dependencies'); fs.mkdirSync(work, { recursive: true });
        fs.writeFileSync(path.join(work, 'package.json'), files.get('package.json'));
        fs.writeFileSync(path.join(work, 'package-lock.json'), files.get('package-lock.json'));
        if (!installDependencies(work) || !validateDependencies(work)) throw new Error('Dependency update failed');
        setDependencyStamp(work);
        fs.writeFileSync(path.join(work, 'node_modules', '.nova-update-transaction'), manifest.transactionName);
      }
      console.log('NOVA update apply hocche. Private data alada thakbe...');
      apply(root, manifest);
      if (lockChanged || !dependenciesReady) swapModules(root, manifest);
      finalize(root, manifest);
      console.log('NOVA update complete.');
    } catch (err) {
      console.log('Update failed; previous version restore hocche...');
      rollback(root, manifest);
      atomicWrite(paths.state, JSON.stringify({ sha: null, recoveredAt: Date.now() }));
      fs.unlinkSync(paths.pending);
      console.log('Previous version restored. ' + err.message);
    }
}
async function update(root = ROOT, { download = fetchBytes, isBusy = portBusy, installDependencies = install, validateDependencies = verifyDependencies, afterUpdate = null } = {}) {
  const port = Number(process.env.PORT || 3000);
  if (!Number.isInteger(port) || port < 1 || port > 65535 || await isBusy(port)) throw new Error('Port busy: close the other running NOVA window first.');
  const paths = statePaths(root); acquireLock(paths.lock);
  try {
    await updateContents(root, { download, installDependencies, validateDependencies });
    // Keep the lock throughout startup and while NOVA runs, so a second launch
    // cannot update files in the gap before the server binds its port.
    if (afterUpdate) await afterUpdate(root);
  } finally { try { fs.unlinkSync(paths.lock); } catch {} }
}
function launch(root) {
  return new Promise((resolve, reject) => {
    if (process.platform !== 'win32') return reject(new Error('The desktop launcher requires Windows.'));
    const child = spawn(process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', 'desktop\\nova-launch.bat'], { cwd: root, stdio: 'inherit', windowsHide: false });
    child.on('error', reject);
    child.on('exit', (code, signal) => code === 0 || signal ? resolve() : reject(new Error('NOVA launcher exited with code ' + code)));
  });
}
if (require.main === module) update(ROOT, { afterUpdate: launch }).catch(err => { console.error('NOVA updater:', err.message); process.exitCode = 1; });
module.exports = { isAllowed, inside, extractFiles, prepare, apply, rollback, finalize, statePaths, update, acquireLock, swapModules, restoreModules };
