'use strict';
// One-time bootstrap for the laptop installation used in this session. No data
// or credentials are copied, replaced, or sent anywhere.
const fs = require('fs');
const path = require('path');
const os = require('os');
const net = require('net');
const crypto = require('crypto');
const SOURCE = path.resolve(__dirname, '..');
const FOLDER = 'genz-hub-arena-549dbb1e-genz-hub';
const FILES = ['desktop/nova-updater.js', 'desktop/nova-launch.bat', 'desktop/STOP-AUTO-UPDATE.bat', 'desktop/START-AUTO-UPDATE.bat', 'START-NOVA.bat'];
function defaultTarget() { return path.join(os.homedir(), 'Documents', FOLDER, FOLDER); }
function busy() { return new Promise(resolve => {
  const s = net.createConnection({ host: '127.0.0.1', port: 3000 });
  s.setTimeout(1500); s.on('connect', () => { s.destroy(); resolve(true); });
  s.on('timeout', () => { s.destroy(); resolve(true); });
  s.on('error', e => { s.destroy(); resolve(e.code !== 'ECONNREFUSED'); });
}); }
function targetFile(root, rel) {
  if (!FILES.includes(rel)) throw new Error('Invalid bootstrap file');
  let current = path.resolve(root);
  for (const part of rel.split('/')) {
    current = path.join(current, part);
    try { if (fs.lstatSync(current).isSymbolicLink()) throw new Error('A target is a symlink.'); }
    catch (err) { if (err.code !== 'ENOENT') throw err; }
  }
  return current;
}
function writeAtomic(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = file + '.nova-setup-' + crypto.randomBytes(8).toString('hex') + '.tmp';
  try { fs.writeFileSync(tmp, data, { flag: 'wx' }); fs.renameSync(tmp, file); }
  finally { try { fs.unlinkSync(tmp); } catch {} }
}
async function install(source = SOURCE, target = defaultTarget(), { isBusy = busy } = {}) {
  if (await isBusy()) throw new Error('Close the old NOVA terminal first, then run this setup again.');
  if (!fs.existsSync(path.join(target, 'package.json')) || !fs.existsSync(path.join(target, 'src', 'nova', 'router.js'))) throw new Error('Existing NOVA folder was not found. Please show a screenshot of this message.');
  const contents = FILES.map(rel => ({ rel, content: fs.readFileSync(path.join(source, ...rel.split('/'))) }));
  if (path.resolve(source).toLowerCase() === path.resolve(target).toLowerCase()) { console.log('Auto-update files are already in the NOVA folder.'); return; }
  // Store only overwritten application files, never credentials or databases.
  const backup = path.join(target, 'data', 'nova-updater', `bootstrap-backup-${Date.now()}-${crypto.randomBytes(5).toString('hex')}`);
  fs.mkdirSync(backup, { recursive: true });
  const entries = contents.map(({ rel, content }) => {
    const file = targetFile(target, rel), before = fs.existsSync(file) ? fs.readFileSync(file) : null;
    if (before) { const saved = path.join(backup, ...rel.split('/')); fs.mkdirSync(path.dirname(saved), { recursive: true }); fs.writeFileSync(saved, before); }
    return { file, before, content };
  });
  let written = 0;
  try { for (const e of entries) { writeAtomic(e.file, e.content); written++; } }
  catch (err) {
    for (const e of entries.slice(0, written).reverse()) {
      if (e.before) writeAtomic(e.file, e.before);
      else if (fs.existsSync(e.file) && fs.readFileSync(e.file).equals(e.content)) fs.unlinkSync(e.file);
    }
    throw err;
  }
  console.log('Auto-update installed in: ' + target);
}
if (require.main === module) install().catch(err => { console.error('NOVA setup:', err.message); process.exitCode = 1; });
module.exports = { install, defaultTarget, FILES };
