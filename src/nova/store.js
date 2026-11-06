'use strict';
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const hash = (value) => crypto.createHash('sha256').update(String(value)).digest('hex');
const token = () => crypto.randomBytes(32).toString('base64url');
const id = () => crypto.randomUUID();
const DAY = 86400000;

class NovaStore {
  constructor(dataDir) {
    fs.mkdirSync(dataDir, { recursive: true });
    this.db = new Database(path.join(dataDir, 'nova.db'));
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS workspaces (
        id TEXT PRIMARY KEY, name TEXT NOT NULL DEFAULT 'My workspace',
        settings TEXT NOT NULL DEFAULT '{}', created_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS sessions (
        token_hash TEXT PRIMARY KEY, workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        role TEXT NOT NULL CHECK(role IN ('owner','remote')), label TEXT NOT NULL DEFAULT 'This browser',
        created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL, revoked INTEGER NOT NULL DEFAULT 0
      );
      CREATE INDEX IF NOT EXISTS idx_nova_sessions_workspace ON sessions(workspace_id);
      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        role TEXT NOT NULL CHECK(role IN ('user','assistant')), content TEXT NOT NULL,
        engine TEXT, action_id TEXT, created_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_nova_messages_workspace ON messages(workspace_id, created_at);
      CREATE TABLE IF NOT EXISTS memories (
        id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        content TEXT NOT NULL, category TEXT NOT NULL DEFAULT 'personal',
        created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_nova_memories_workspace ON memories(workspace_id, updated_at);
      CREATE TABLE IF NOT EXISTS actions (
        id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        kind TEXT NOT NULL, params TEXT NOT NULL DEFAULT '{}', label TEXT NOT NULL,
        status TEXT NOT NULL CHECK(status IN ('pending','approved','running','completed','failed','cancelled','expired')),
        result TEXT, created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_nova_actions_workspace ON actions(workspace_id, created_at);
      CREATE TABLE IF NOT EXISTS bridge (
        workspace_id TEXT PRIMARY KEY REFERENCES workspaces(id) ON DELETE CASCADE,
        token_hash TEXT NOT NULL UNIQUE, last_seen INTEGER, system_info TEXT NOT NULL DEFAULT '{}',
        created_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS pairings (
        id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        code_hash TEXT NOT NULL UNIQUE, created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL,
        used INTEGER NOT NULL DEFAULT 0
      );
      CREATE TABLE IF NOT EXISTS ai_providers (
        workspace_id TEXT PRIMARY KEY REFERENCES workspaces(id) ON DELETE CASCADE,
        provider TEXT NOT NULL, model TEXT NOT NULL, base_url TEXT NOT NULL,
        cipher TEXT NOT NULL, iv TEXT NOT NULL, tag TEXT NOT NULL,
        created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
      );
    `);
  }
  close() { this.db.close(); }
  workspace(workspaceId) { return this.db.prepare('SELECT * FROM workspaces WHERE id=?').get(workspaceId); }
  createSession(workspaceId, role = 'owner', label = 'This browser', ttl = 30 * DAY) {
    const raw = token(); const now = Date.now();
    this.db.prepare('INSERT INTO sessions (token_hash,workspace_id,role,label,created_at,expires_at) VALUES (?,?,?,?,?,?)')
      .run(hash(raw), workspaceId, role, label, now, now + ttl);
    return { token: raw, expiresAt: now + ttl, role };
  }
  createWorkspace(name = 'My workspace') {
    const workspaceId = id();
    this.db.prepare('INSERT INTO workspaces (id,name,created_at) VALUES (?,?,?)').run(workspaceId, name, Date.now());
    return { workspaceId, ...this.createSession(workspaceId) };
  }
  session(raw) {
    if (!raw || typeof raw !== 'string' || raw.length > 200) return null;
    return this.db.prepare(`SELECT s.*, w.name, w.settings FROM sessions s JOIN workspaces w ON w.id=s.workspace_id
      WHERE s.token_hash=? AND s.revoked=0 AND s.expires_at>?`).get(hash(raw), Date.now()) || null;
  }
  revokeSession(tokenHash) { this.db.prepare('UPDATE sessions SET revoked=1 WHERE token_hash=?').run(tokenHash); }
  revokeRemotes(workspaceId) { this.db.prepare("UPDATE sessions SET revoked=1 WHERE workspace_id=? AND role='remote'").run(workspaceId); }
  remotes(workspaceId) {
    return this.db.prepare("SELECT token_hash, label, created_at, expires_at FROM sessions WHERE workspace_id=? AND role='remote' AND revoked=0 AND expires_at>? ORDER BY created_at DESC").all(workspaceId, Date.now());
  }
  settings(workspaceId) {
    const row = this.workspace(workspaceId);
    try { return JSON.parse(row.settings); } catch { return {}; }
  }
  saveSettings(workspaceId, settings, name) {
    this.db.prepare('UPDATE workspaces SET settings=?, name=? WHERE id=?').run(JSON.stringify(settings), name, workspaceId);
  }
  addMessage(workspaceId, role, content, engine = null, actionId = null) {
    const messageId = id();
    this.db.prepare('INSERT INTO messages (id,workspace_id,role,content,engine,action_id,created_at) VALUES (?,?,?,?,?,?,?)')
      .run(messageId, workspaceId, role, content, engine, actionId, Date.now());
    return this.message(messageId);
  }
  message(messageId) { return this.db.prepare('SELECT * FROM messages WHERE id=?').get(messageId); }
  messages(workspaceId, limit = 100) {
    return this.db.prepare('SELECT * FROM messages WHERE workspace_id=? ORDER BY created_at DESC, rowid DESC LIMIT ?').all(workspaceId, limit).reverse();
  }
  clearMessages(workspaceId) { this.db.prepare('DELETE FROM messages WHERE workspace_id=?').run(workspaceId); }
  memories(workspaceId) { return this.db.prepare('SELECT * FROM memories WHERE workspace_id=? ORDER BY updated_at DESC').all(workspaceId); }
  memory(memoryId) { return this.db.prepare('SELECT * FROM memories WHERE id=?').get(memoryId); }
  addMemory(workspaceId, content, category = 'personal') {
    const memoryId = id(); const now = Date.now();
    this.db.prepare('INSERT INTO memories (id,workspace_id,content,category,created_at,updated_at) VALUES (?,?,?,?,?,?)')
      .run(memoryId, workspaceId, content, category, now, now);
    return this.memory(memoryId);
  }
  updateMemory(memoryId, content, category) {
    this.db.prepare('UPDATE memories SET content=?,category=?,updated_at=? WHERE id=?').run(content, category, Date.now(), memoryId);
    return this.memory(memoryId);
  }
  deleteMemory(memoryId) { this.db.prepare('DELETE FROM memories WHERE id=?').run(memoryId); }
  createAction(workspaceId, kind, params, label, ttl = 120000) {
    const actionId = id(); const now = Date.now();
    this.db.prepare('INSERT INTO actions (id,workspace_id,kind,params,label,status,created_at,expires_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)')
      .run(actionId, workspaceId, kind, JSON.stringify(params), label, 'pending', now, now + ttl, now);
    return this.action(actionId);
  }
  action(actionId) {
    const row = this.db.prepare('SELECT * FROM actions WHERE id=?').get(actionId);
    return row ? { ...row, params: JSON.parse(row.params) } : null;
  }
  actions(workspaceId, limit = 40) {
    return this.db.prepare('SELECT * FROM actions WHERE workspace_id=? ORDER BY created_at DESC LIMIT ?').all(workspaceId, limit)
      .map((row) => ({ ...row, params: JSON.parse(row.params) }));
  }
  setAction(actionId, status, result = null) {
    this.db.prepare('UPDATE actions SET status=?,result=?,updated_at=? WHERE id=?').run(status, result, Date.now(), actionId);
    return this.action(actionId);
  }
  transitionAction(actionId, fromStatuses, status, result = null) {
    const marks = fromStatuses.map(() => '?').join(',');
    const changed = this.db.prepare(`UPDATE actions SET status=?,result=?,updated_at=? WHERE id=? AND status IN (${marks})`).run(status, result, Date.now(), actionId, ...fromStatuses);
    return changed.changes ? this.action(actionId) : null;
  }
  expireActions() {
    const now = Date.now();
    this.db.prepare("UPDATE actions SET status='expired',updated_at=? WHERE status IN ('pending','approved') AND expires_at<?").run(now, now);
    this.db.prepare("UPDATE actions SET status='failed',result='The desktop bridge did not finish in time.',updated_at=? WHERE status='running' AND updated_at<?").run(now, now - 90000);
    this.db.prepare('DELETE FROM pairings WHERE expires_at<?').run(now);
  }
  issueBridge(workspaceId) {
    const raw = token(); const now = Date.now();
    this.db.prepare(`INSERT INTO bridge (workspace_id,token_hash,created_at) VALUES (?,?,?)
      ON CONFLICT(workspace_id) DO UPDATE SET token_hash=excluded.token_hash,last_seen=NULL,system_info='{}',created_at=excluded.created_at`)
      .run(workspaceId, hash(raw), now);
    this.db.prepare("UPDATE actions SET status='cancelled',result='Bridge credentials were reset.',updated_at=? WHERE workspace_id=? AND status IN ('pending','approved','running')").run(now, workspaceId);
    return raw;
  }
  revokeManagedBridge(workspaceId, tokenHash) {
    return this.db.transaction(() => {
      const removed = this.db.prepare('DELETE FROM bridge WHERE workspace_id=? AND token_hash=?').run(workspaceId, tokenHash);
      if (removed.changes) this.db.prepare("UPDATE actions SET status='cancelled',result='Local bridge disconnected.',updated_at=? WHERE workspace_id=? AND status IN ('pending','approved')").run(Date.now(), workspaceId);
      return removed.changes > 0;
    })();
  }
  bridgeByToken(raw) {
    if (!raw || raw.length > 200) return null;
    return this.db.prepare('SELECT * FROM bridge WHERE token_hash=?').get(hash(raw)) || null;
  }
  bridge(workspaceId) { return this.db.prepare('SELECT * FROM bridge WHERE workspace_id=?').get(workspaceId); }
  heartbeat(workspaceId, info) {
    this.db.prepare('UPDATE bridge SET last_seen=?,system_info=? WHERE workspace_id=?').run(Date.now(), JSON.stringify(info), workspaceId);
  }
  claimAction(workspaceId) {
    const row = this.db.prepare("SELECT id FROM actions WHERE workspace_id=? AND status='approved' AND expires_at>? ORDER BY created_at LIMIT 1").get(workspaceId, Date.now());
    if (!row) return null;
    const changed = this.db.prepare("UPDATE actions SET status='running',updated_at=? WHERE id=? AND status='approved'").run(Date.now(), row.id);
    return changed.changes ? this.action(row.id) : null;
  }
  createPairing(workspaceId) {
    const code = crypto.randomBytes(5).toString('hex').toUpperCase();
    const pairingId = id(); const now = Date.now();
    this.db.prepare('UPDATE pairings SET used=1 WHERE workspace_id=? AND used=0').run(workspaceId);
    this.db.prepare('INSERT INTO pairings (id,workspace_id,code_hash,created_at,expires_at) VALUES (?,?,?,?,?)')
      .run(pairingId, workspaceId, hash(code), now, now + 300000);
    return { id: pairingId, code, expiresAt: now + 300000 };
  }
  redeemPairing(code) {
    const row = this.db.prepare('SELECT * FROM pairings WHERE code_hash=? AND used=0 AND expires_at>?').get(hash(code), Date.now());
    if (!row) return null;
    const used = this.db.prepare('UPDATE pairings SET used=1 WHERE id=? AND used=0').run(row.id);
    if (!used.changes) return null;
    return this.createSession(row.workspace_id, 'remote', 'Paired phone', DAY);
  }
  aiProvider(workspaceId) { return this.db.prepare('SELECT * FROM ai_providers WHERE workspace_id=?').get(workspaceId) || null; }
  saveAiProvider(workspaceId, p) {
    const now = Date.now();
    this.db.prepare(`INSERT INTO ai_providers (workspace_id,provider,model,base_url,cipher,iv,tag,created_at,updated_at)
      VALUES (?,?,?,?,?,?,?,?,?) ON CONFLICT(workspace_id) DO UPDATE SET provider=excluded.provider,model=excluded.model,base_url=excluded.base_url,cipher=excluded.cipher,iv=excluded.iv,tag=excluded.tag,updated_at=excluded.updated_at`)
      .run(workspaceId, p.provider, p.model, p.base_url, p.cipher, p.iv, p.tag, now, now);
  }
  deleteAiProvider(workspaceId) { this.db.prepare('DELETE FROM ai_providers WHERE workspace_id=?').run(workspaceId); }
  deleteWorkspace(workspaceId) { this.db.prepare('DELETE FROM workspaces WHERE id=?').run(workspaceId); }
  cleanup() {
    this.db.prepare('DELETE FROM workspaces WHERE id IN (SELECT w.id FROM workspaces w WHERE NOT EXISTS (SELECT 1 FROM sessions s WHERE s.workspace_id=w.id AND s.expires_at>?) AND w.created_at<?)').run(Date.now(), Date.now() - 30 * DAY);
    this.db.prepare('DELETE FROM sessions WHERE expires_at<?').run(Date.now() - DAY);
    this.expireActions();
  }
}
module.exports = { NovaStore, hash, token };
