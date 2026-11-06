'use strict';
// Owner-triggered local bridge. No token is written to disk or sent to the UI.
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

function isLocalRequest(req) {
  const loopback = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);
  if (!loopback.has(req.socket.remoteAddress) || !loopback.has(req.socket.localAddress)) return false;
  if (req.get('x-forwarded-host') || req.get('x-forwarded-for') || req.get('x-forwarded-proto')) return false;
  if (req.get('sec-fetch-site') === 'cross-site') return false;
  try {
    const host = new URL('http://' + req.get('host'));
    const origin = new URL(req.get('origin'));
    return ['localhost', '127.0.0.1', '[::1]'].includes(host.hostname) &&
      host.host === req.get('host') && origin.origin === req.get('origin') && host.host === origin.host && origin.protocol === 'http:' &&
      Number(host.port || 80) === req.socket.localPort;
  } catch { return false; }
}

function createLocalBridge({ store, agentFile, platform = process.platform, spawnChild = spawn, waitMs = 12000 }) {
  const children = new Map();
  const supported = () => platform === 'win32';
  const online = workspace => { const row = store.bridge(workspace); return !!(row?.last_seen && Date.now() - row.last_seen < 15000); };
  const managed = workspace => children.has(workspace);
  function stop(workspace) {
    const entry = children.get(workspace); if (!entry) return false;
    children.delete(workspace); entry.stopped = true;
    // Revoke only this managed token; never invalidate a newer manual token.
    store.revokeManagedBridge(workspace, entry.tokenHash);
    try { if (entry.child.connected) entry.child.disconnect(); else entry.child.kill(); } catch { /* already gone */ }
    return true;
  }
  async function start(workspace, port) {
    if (!supported()) return { ok: false, error: 'This shortcut works only on the Windows PC running NOVA.' };
    if (children.has(workspace)) return { ok: false, error: 'The local bridge is already starting or running.' };
    if (online(workspace)) return { ok: true, alreadyConnected: true };
    if (!agentFile || !fs.existsSync(agentFile) || !Number.isInteger(port) || port < 1 || port > 65535) return { ok: false, error: 'Bridge files are missing. Restart NOVA and try again.' };
    const token = store.issueBridge(workspace); const tokenHash = store.bridge(workspace).token_hash;
    // Only pass OS variables required by Windows and process startup; do not
    // forward any AI keys or other secrets from the server environment.
    const env = {};
    for (const name of ['SystemRoot', 'SYSTEMROOT', 'WINDIR', 'PATH', 'Path', 'PATHEXT', 'COMSPEC', 'TEMP', 'TMP', 'USERPROFILE', 'HOMEDRIVE', 'HOMEPATH']) if (process.env[name]) env[name] = process.env[name];
    env.NOVA_BRIDGE_TOKEN = token;
    let child;
    try {
      child = spawnChild(process.execPath, [path.resolve(agentFile), '--server', `http://127.0.0.1:${port}`], { cwd: path.dirname(path.resolve(agentFile)), env, shell: false, windowsHide: true, stdio: ['ignore', 'ignore', 'ignore', 'ipc'] });
    } catch {
      store.revokeManagedBridge(workspace, tokenHash);
      return { ok: false, error: 'Could not start the local bridge. Restart NOVA and try again.' };
    }
    const entry = { child, tokenHash, stopped: false, exited: false }; children.set(workspace, entry);
    const end = () => {
      entry.exited = true;
      if (children.get(workspace) === entry) { children.delete(workspace); store.revokeManagedBridge(workspace, tokenHash); }
    };
    child.once('exit', end); child.once('error', end);
    const until = Date.now() + waitMs;
    while (Date.now() < until && !entry.exited && !entry.stopped) {
      if (online(workspace) && store.bridge(workspace)?.token_hash === tokenHash) return { ok: true };
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    if (children.get(workspace) === entry) stop(workspace);
    return { ok: false, error: 'The bridge did not connect. Keep NOVA open, then try again.' };
  }
  function close() { for (const workspace of [...children.keys()]) stop(workspace); }
  return { supported, managed, start, stop, close };
}
module.exports = { createLocalBridge, isLocalRequest };
