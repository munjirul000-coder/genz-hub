'use strict';
const express = require('express');
const U = require('../util');
const { NovaStore } = require('./store');
const { CATALOG, validateAction } = require('./catalog');
const { respond, aiConfig, testAiConnection } = require('./assistant');
const { Vault } = require('./vault');

const DEFAULT_SETTINGS = { assistantName: 'NOVA', userName: '', language: 'auto', persona: 'nova', voiceEnabled: false, voiceGender: 'feminine', voiceURI: '', speechRate: 1, timezone: 'Asia/Dhaka' };
const clean = (v, max) => typeof v === 'string' ? v.replace(/\u0000/g, '').trim().slice(0, max) : '';
const COOKIE = 'nova_session';

function createNovaRouter({ dataDir, agentFile }) {
  const store = new NovaStore(dataDir);
  const vault = new Vault(dataDir);
  const router = express.Router();
  const timer = setInterval(() => store.cleanup(), 60000); timer.unref();
  const bridgeOnline = (row) => !!(row?.last_seen && Date.now() - row.last_seen < 15000);
  const bridgeState = (workspaceId) => {
    const row = store.bridge(workspaceId);
    let info = {}; try { info = JSON.parse(row?.system_info || '{}'); } catch {}
    return { configured: !!row, online: bridgeOnline(row), lastSeen: row?.last_seen || null, system: info };
  };
  const cookieOptions = (req) => ({ httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production' || req.secure, path: '/api/nova', maxAge: 30 * 86400000 });
  const setSession = (req, res, session) => { res.cookie(COOKIE, session.token, { ...cookieOptions(req), maxAge: session.expiresAt - Date.now() }); };

  // The global API guard requires X-GenZ-Client. Also reject browser cross-site
  // writes. The desktop agent uses a separate Bearer credential, not cookies.
  router.use((req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) && !req.path.startsWith('/bridge/')) {
      const origin = req.get('origin');
      const host = (req.get('x-forwarded-host') || req.get('host') || '').split(',')[0].trim();
      if (req.get('sec-fetch-site') === 'cross-site') return res.status(403).json({ error: 'Cross-site requests are not allowed.' });
      if (origin) { try { if (new URL(origin).host !== host) return res.status(403).json({ error: 'Invalid request origin.' }); } catch { return res.status(403).json({ error: 'Invalid request origin.' }); } }
    }
    next();
  });

  function bridgeAuth(req, res, next) {
    const match = (req.get('authorization') || '').match(/^Bearer ([A-Za-z0-9_-]{40,100})$/);
    const row = match && store.bridgeByToken(match[1]);
    if (!row) return res.status(401).json({ error: 'Invalid bridge token. Generate a new token in NOVA → Desktop control.' });
    req.bridge = row; next();
  }
  function auth(req, res, next) {
    const raw = req.get('x-nova-session') || req.cookies?.[COOKIE];
    const session = store.session(raw);
    if (!session) return res.status(401).json({ error: 'Your workspace session expired. Refresh to start a new workspace.' });
    req.nova = session; next();
  }
  function owner(req, res, next) { if (req.nova.role !== 'owner') return res.status(403).json({ error: 'Only the workspace owner can change this setting.' }); next(); }
  const ownMemory = (req) => { const m = store.memory(req.params.id); return m && m.workspace_id === req.nova.workspace_id ? m : null; };
  const ownAction = (req) => { const a = store.action(req.params.id); return a && a.workspace_id === req.nova.workspace_id ? a : null; };
  const settingsOf = (workspaceId) => ({ ...DEFAULT_SETTINGS, ...store.settings(workspaceId) });
  const validTimezone = (value) => { try { new Intl.DateTimeFormat('en', { timeZone: value }).format(); return true; } catch { return false; } };

  // Saved workspace credentials override server env. The raw key is never sent back to the browser.
  const SECRET_IN_CHAT = /(?:gsk_[A-Za-z0-9_-]{20,}|sk-(?:proj-)?[A-Za-z0-9_-]{20,})/;
  const AI_PRESETS = { groq: { base: 'https://api.groq.com/openai/v1', model: 'llama-3.3-70b-versatile' }, openai: { base: 'https://api.openai.com/v1', model: 'gpt-4.1-mini' } };
  function workspaceAi(workspaceId) {
    const row = store.aiProvider(workspaceId);
    if (row) {
      try { return aiConfig({ provider: row.provider, model: row.model, base: row.base_url, key: vault.decrypt(row, workspaceId) }); }
      catch { /* A changed/corrupt vault key should not expose or reuse old ciphertext. */ }
    }
    return aiConfig();
  }
  const aiState = (workspaceId) => {
    const c = workspaceAi(workspaceId);
    return { configured: c.configured, provider: c.provider, model: c.configured ? c.model : null, source: c.configured ? c.source : 'none', hasKey: c.configured && c.source === 'workspace' };
  };

  router.post('/session', U.rateLimit({ max: 20, windowMs: 60000, key: 'nova-session' }), (req, res) => {
    const existing = store.session(req.get('x-nova-session') || req.cookies?.[COOKIE]);
    if (existing) return res.json({ token: req.get('x-nova-session') || req.cookies[COOKIE], role: existing.role });
    const session = store.createWorkspace(); setSession(req, res, session);
    res.status(201).json({ token: session.token, role: session.role });
  });
  router.get('/state', auth, (req, res) => {
    const w = store.workspace(req.nova.workspace_id);
    res.json({ workspace: { id: w.id, name: w.name, role: req.nova.role }, settings: settingsOf(w.id), catalog: CATALOG,
      ai: aiState(w.id),
      ...snapshot(w.id, req.nova) });
  });
  function snapshot(workspaceId, session) {
    return { messages: store.messages(workspaceId), memories: store.memories(workspaceId), actions: store.actions(workspaceId), bridge: bridgeState(workspaceId),
      ai: aiState(workspaceId), remotes: session.role === 'owner' ? store.remotes(workspaceId) : [], serverTime: Date.now() };
  }
  router.get('/sync', auth, (req, res) => { store.expireActions(); res.json(snapshot(req.nova.workspace_id, req.nova)); });

  router.patch('/settings', auth, owner, (req, res) => {
    const current = settingsOf(req.nova.workspace_id); const b = req.body || {}; const next = { ...current };
    if (b.assistantName !== undefined) { if (!['NOVA', 'ATLAS'].includes(b.assistantName)) return res.status(400).json({ error: 'Choose NOVA or ATLAS.' }); next.assistantName = b.assistantName; }
    if (b.userName !== undefined) next.userName = clean(b.userName, 40);
    if (b.language !== undefined) { if (!['auto', 'en', 'bn'].includes(b.language)) return res.status(400).json({ error: 'Unsupported language.' }); next.language = b.language; }
    if (b.persona !== undefined) { if (!['nova', 'atlas'].includes(b.persona)) return res.status(400).json({ error: 'Unsupported persona.' }); next.persona = b.persona; }
    if (b.voiceEnabled !== undefined) next.voiceEnabled = b.voiceEnabled === true;
    if (b.voiceGender !== undefined) { if (!['feminine', 'masculine', 'auto'].includes(b.voiceGender)) return res.status(400).json({ error: 'Unsupported voice preference.' }); next.voiceGender = b.voiceGender; }
    if (b.voiceURI !== undefined) next.voiceURI = clean(b.voiceURI, 300);
    if (b.speechRate !== undefined) { const rate = Number(b.speechRate); if (!Number.isFinite(rate) || rate < 0.7 || rate > 1.3) return res.status(400).json({ error: 'Speech rate must be between 0.7 and 1.3.' }); next.speechRate = rate; }
    if (b.timezone !== undefined) { if (typeof b.timezone !== 'string' || !validTimezone(b.timezone)) return res.status(400).json({ error: 'Invalid timezone.' }); next.timezone = b.timezone; }
    if (b.workspaceName !== undefined) { const name = clean(b.workspaceName, 50); if (!name) return res.status(400).json({ error: 'Workspace name is required.' }); store.saveSettings(req.nova.workspace_id, next, name); }
    else store.saveSettings(req.nova.workspace_id, next, store.workspace(req.nova.workspace_id).name);
    res.json({ settings: next });
  });

  router.post('/chat', auth, U.rateLimit({ max: 30, windowMs: 60000, key: 'nova-chat' }), U.wrap(async (req, res) => {
    const text = clean(req.body?.message, 4000);
    if (!text) return res.status(400).json({ error: 'Write a message first.' });
    if (SECRET_IN_CHAT.test(text)) return res.status(400).json({ error: 'Don’t paste API keys into chat. Use Settings → Intelligence → Connect Groq. This message was not saved or sent.' });
    const workspaceId = req.nova.workspace_id; const settings = settingsOf(workspaceId);
    const history = store.messages(workspaceId, 14); const memories = store.memories(workspaceId);
    const result = await respond({ text, settings, memories, history, timezone: settings.timezone, config: workspaceAi(workspaceId) });
    // A workspace may be deleted while a cloud request is in flight.
    if (!store.workspace(workspaceId)) return res.status(401).json({ error: 'This workspace no longer exists.' });
    if (result.memory && memories.length >= 200) return res.status(400).json({ error: 'Memory vault is full (200 items). Delete an old memory first.' });
    const userMessage = store.addMessage(workspaceId, 'user', text);
    let memory = null, action = null;
    if (result.memory) memory = store.addMemory(workspaceId, result.memory.content, result.memory.category);
    if (result.action) action = store.createAction(workspaceId, result.action.kind, result.action.params, CATALOG[result.action.kind].label);
    const assistant = store.addMessage(workspaceId, 'assistant', result.content, result.engine, action?.id || null);
    res.json({ message: assistant, userMessage, memory, action, uiAction: result.uiAction || null, engine: result.engine });
  }));
  router.delete('/messages', auth, owner, (req, res) => { store.clearMessages(req.nova.workspace_id); res.json({ ok: true }); });
  // Provider test failures return 200 {ok:false,error}: some hosting proxies replace
  // 5xx bodies with their own error page, hiding the real reason from the UI.
  router.post('/ai/test', auth, owner, U.rateLimit({ max: 6, windowMs: 60000, key: 'nova-ai-test' }), U.wrap(async (req, res) => {
    const result = await testAiConnection(workspaceAi(req.nova.workspace_id));
    res.json(result);
  }));
  router.post('/ai/connect', auth, owner, U.rateLimit({ max: 6, windowMs: 60000, key: 'nova-ai-connect' }), U.wrap(async (req, res) => {
    const provider = clean(req.body?.provider || 'groq', 20).toLowerCase();
    const preset = AI_PRESETS[provider];
    if (!preset) return res.status(400).json({ error: 'Choose Groq or OpenAI.' });
    const key = clean(req.body?.apiKey, 300);
    const model = clean(req.body?.model, 100) || preset.model;
    if (!key || key.length < 20 || /\s/.test(key)) return res.status(400).json({ error: 'Paste a valid API key in the secure key field (not chat).' });
    if (!/^[A-Za-z0-9._\/-]+$/.test(model)) return res.status(400).json({ error: 'Model name contains unsupported characters.' });
    const config = aiConfig({ provider, model, base: preset.base, key });
    const result = await testAiConnection(config);
    if (!result.ok) return res.json({ ok: false, error: result.error });
    const workspaceId = req.nova.workspace_id;
    if (!store.workspace(workspaceId)) return res.status(401).json({ error: 'This workspace no longer exists.' });
    store.saveAiProvider(workspaceId, { provider, model, base_url: preset.base, ...vault.encrypt(key, workspaceId) });
    res.json({ ok: true, ai: aiState(workspaceId), latencyMs: result.latencyMs });
  }));
  router.post('/ai/disconnect', auth, owner, U.rateLimit({ max: 10, windowMs: 60000, key: 'nova-ai-disconnect' }), (req, res) => {
    store.deleteAiProvider(req.nova.workspace_id);
    res.json({ ok: true, ai: aiState(req.nova.workspace_id) });
  });

  router.post('/memories', auth, (req, res) => {
    const content = clean(req.body?.content, 500); const category = clean(req.body?.category, 20) || 'note';
    if (!content) return res.status(400).json({ error: 'Memory content is required.' });
    if (!['personal', 'preference', 'work', 'note'].includes(category)) return res.status(400).json({ error: 'Unsupported memory category.' });
    if (store.memories(req.nova.workspace_id).length >= 200) return res.status(400).json({ error: 'Memory vault is full (200 items).' });
    res.status(201).json({ memory: store.addMemory(req.nova.workspace_id, content, category) });
  });
  router.patch('/memories/:id', auth, (req, res) => {
    if (!ownMemory(req)) return res.status(404).json({ error: 'Memory not found.' });
    const content = clean(req.body?.content, 500); const category = clean(req.body?.category, 20);
    if (!content || !['personal', 'preference', 'work', 'note'].includes(category)) return res.status(400).json({ error: 'Provide content and a valid category.' });
    res.json({ memory: store.updateMemory(req.params.id, content, category) });
  });
  router.delete('/memories/:id', auth, (req, res) => { if (!ownMemory(req)) return res.status(404).json({ error: 'Memory not found.' }); store.deleteMemory(req.params.id); res.json({ ok: true }); });

  router.post('/actions', auth, (req, res) => {
    const kind = clean(req.body?.kind, 50); const valid = validateAction(kind, req.body?.params || {});
    if (valid.error) return res.status(400).json({ error: valid.error });
    store.expireActions();
    const pending = store.actions(req.nova.workspace_id).filter(a => ['pending', 'approved', 'running'].includes(a.status));
    if (pending.length >= 10) return res.status(429).json({ error: 'Resolve your pending actions before preparing another.' });
    res.status(201).json({ action: store.createAction(req.nova.workspace_id, kind, valid.params, CATALOG[kind].label) });
  });
  router.post('/actions/:id/approve', auth, (req, res) => {
    const action = ownAction(req); if (!action) return res.status(404).json({ error: 'Action not found.' });
    store.expireActions();
    const current = store.action(action.id);
    if (current.status !== 'pending') return res.status(409).json({ error: `This action is already ${current.status}.` });
    if (!bridgeOnline(store.bridge(req.nova.workspace_id))) return res.status(409).json({ error: 'Connect the Windows desktop bridge before approving an action.' });
    const approved = store.transitionAction(action.id, ['pending'], 'approved');
    if (!approved) return res.status(409).json({ error: 'This action was already resolved.' });
    res.json({ action: approved });
  });
  router.post('/actions/:id/cancel', auth, (req, res) => {
    const action = ownAction(req); if (!action) return res.status(404).json({ error: 'Action not found.' });
    if (!['pending', 'approved'].includes(action.status)) return res.status(409).json({ error: 'Only pending or queued actions can be cancelled.' });
    const cancelled = store.transitionAction(action.id, ['pending', 'approved'], 'cancelled');
    if (!cancelled) return res.status(409).json({ error: 'This action already started or was resolved.' });
    res.json({ action: cancelled });
  });

  router.post('/bridge/token', auth, owner, U.rateLimit({ max: 5, windowMs: 60000, key: 'nova-bridge-token' }), (req, res) => {
    res.json({ token: store.issueBridge(req.nova.workspace_id), warning: 'Shown once. Keep this secret private. Generating a new token disconnects the previous agent.' });
  });
  router.get('/bridge/agent', (req, res) => { if (agentFile) res.download(agentFile, 'nova-agent.js'); else res.status(404).json({ error: 'Agent not available.' }); });
  router.post('/bridge/poll', bridgeAuth, U.rateLimit({ max: 90, windowMs: 60000, key: 'nova-bridge-poll' }), (req, res) => {
    const s = req.body?.system || {};
    const info = { hostname: clean(s.hostname, 100), os: clean(s.os, 100), arch: clean(s.arch, 20), cpu: clean(s.cpu, 150), cores: Math.max(0, Math.min(256, Number(s.cores) || 0)), memoryGB: Math.max(0, Math.min(4096, Number(s.memoryGB) || 0)), freeMemoryGB: Math.max(0, Math.min(4096, Number(s.freeMemoryGB) || 0)), uptimeHours: Math.max(0, Math.min(100000, Number(s.uptimeHours) || 0)), agentVersion: clean(s.agentVersion, 20) };
    store.heartbeat(req.bridge.workspace_id, info); store.expireActions();
    res.json({ action: store.claimAction(req.bridge.workspace_id) });
  });
  router.post('/bridge/result', bridgeAuth, (req, res) => {
    const action = store.action(clean(req.body?.id, 60));
    if (!action || action.workspace_id !== req.bridge.workspace_id || action.status !== 'running') return res.status(409).json({ error: 'Action is not running on this bridge.' });
    const ok = req.body?.ok === true; const result = clean(req.body?.result, 1500) || (ok ? 'Completed on your desktop.' : 'The agent could not complete this action.');
    store.heartbeat(req.bridge.workspace_id, JSON.parse(store.bridge(req.bridge.workspace_id).system_info || '{}'));
    res.json({ action: store.setAction(action.id, ok ? 'completed' : 'failed', result) });
  });

  router.post('/remote/create', auth, owner, U.rateLimit({ max: 10, windowMs: 60000, key: 'nova-pair-create' }), (req, res) => res.status(201).json(store.createPairing(req.nova.workspace_id)));
  router.post('/remote/pair', U.rateLimit({ max: 10, windowMs: 60000, key: 'nova-pair' }), (req, res) => {
    const code = clean(req.body?.code, 20).toUpperCase();
    if (!/^[A-F0-9]{10}$/.test(code)) return res.status(400).json({ error: 'Enter the 10-character code shown on your desktop.' });
    const session = store.redeemPairing(code);
    if (!session) return res.status(400).json({ error: 'That code is invalid, expired or already used. Generate a new one on your desktop.' });
    setSession(req, res, session); res.json({ token: session.token, role: 'remote' });
  });
  router.delete('/remote/:id', auth, owner, (req, res) => {
    const remote = store.remotes(req.nova.workspace_id).find(r => r.token_hash === req.params.id);
    if (!remote) return res.status(404).json({ error: 'Remote not found.' });
    store.revokeSession(remote.token_hash); res.json({ ok: true });
  });
  router.post('/remote/revoke-all', auth, owner, (req, res) => { store.revokeRemotes(req.nova.workspace_id); res.json({ ok: true }); });
  router.get('/export', auth, owner, (req, res) => {
    const w = store.workspace(req.nova.workspace_id);
    res.setHeader('Content-Disposition', 'attachment; filename="nova-workspace.json"');
    res.json({ exportedAt: new Date().toISOString(), workspace: { name: w.name, settings: settingsOf(w.id) }, messages: store.messages(w.id, 1000), memories: store.memories(w.id), actions: store.actions(w.id, 200) });
  });
  router.delete('/workspace', auth, owner, (req, res) => {
    if (req.body?.confirmation !== 'DELETE') return res.status(400).json({ error: 'Type DELETE to confirm workspace deletion.' });
    store.deleteWorkspace(req.nova.workspace_id); res.clearCookie(COOKIE, { path: '/api/nova' }); res.json({ ok: true });
  });
  router.use((req, res) => res.status(404).json({ error: 'NOVA endpoint not found.' }));
  router.use((err, req, res, next) => { console.error('[nova]', err.message); res.status(err.status || 500).json({ error: err.status ? err.message : 'NOVA could not complete that request. Please try again.' }); });
  return { router, store };
}
module.exports = { createNovaRouter, DEFAULT_SETTINGS };
