'use strict';
/* Gen-Z Hub — admin controls for the v2 platform: hubs, packages, ads, marketplace,
   jobs, challenges, badges, XP rules and platform settings. Every action is audit-logged. */

const express = require('express');
const { db } = require('../db');
const U = require('../util');

const r = express.Router();
r.use(U.requireAdmin);

function log(req, action, targetType, targetId, detail) {
  db.prepare('INSERT INTO admin_logs (admin_id,action,target_type,target_id,detail,created_at) VALUES (?,?,?,?,?,?)')
    .run(req.user.id, action, targetType || '', targetId || null, String(detail || '').slice(0, 500), U.now());
}
const money = (v) => Math.max(0, Math.round(Number(v || 0) * 100));

/* ---------------------------------------------------------------- overview */
r.get('/overview', U.wrap((req, res) => {
  const n = (sql, ...p) => db.prepare(sql).get(...p).n;
  res.json({
    marketplace: {
      stores: n('SELECT COUNT(*) n FROM stores'),
      products: n("SELECT COUNT(*) n FROM products WHERE status='active'"),
      orders: n('SELECT COUNT(*) n FROM orders'),
      gmv: (db.prepare("SELECT COALESCE(SUM(total_cents),0) s FROM orders WHERE status<>'cancelled'").get().s) / 100,
    },
    work: {
      jobs: n("SELECT COUNT(*) n FROM job_posts WHERE status='open'"),
      proposals: n('SELECT COUNT(*) n FROM job_proposals'),
      freelancers: n('SELECT COUNT(*) n FROM freelancer_profiles'),
    },
    ads: {
      pending: n("SELECT COUNT(*) n FROM ad_campaigns WHERE status='pending'"),
      active: n("SELECT COUNT(*) n FROM ad_campaigns WHERE status='active'"),
      impressions: db.prepare('SELECT COALESCE(SUM(impressions),0) s FROM ad_campaigns').get().s,
    },
    arena: {
      challenges: n("SELECT COUNT(*) n FROM challenges WHERE status='open'"),
      entries: n('SELECT COUNT(*) n FROM challenge_entries'),
      ideas: n("SELECT COUNT(*) n FROM ideas WHERE status='active'"),
      polls: n('SELECT COUNT(*) n FROM polls'),
      xp_awarded: db.prepare('SELECT COALESCE(SUM(amount),0) s FROM xp_events').get().s,
    },
    hubs: db.prepare(`SELECT h.slug,h.name,h.emoji,(SELECT COUNT(*) FROM user_hubs uh WHERE uh.hub_id=h.id) AS members
      FROM hubs h WHERE h.active=1 ORDER BY members DESC`).all(),
  });
}));

r.get('/logs', U.wrap((req, res) => {
  res.json({
    logs: db.prepare(`SELECT l.*, u.username FROM admin_logs l LEFT JOIN users u ON u.id=l.admin_id
      ORDER BY l.created_at DESC LIMIT 100`).all(),
  });
}));

/* ---------------------------------------------------------------- hubs */
r.get('/hubs', U.wrap((req, res) => res.json({ hubs: db.prepare('SELECT * FROM hubs ORDER BY position, id').all() })));

r.post('/hubs', U.wrap((req, res) => {
  const name = U.sanitizeText(req.body.name, 40);
  if (name.length < 2) return res.status(400).json({ error: 'Hub name is required.' });
  const slug = U.sanitizeText(req.body.slug, 40).toLowerCase().replace(/[^a-z0-9-]/g, '-') || name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  try {
    db.prepare('INSERT INTO hubs (slug,name,emoji,tagline,accent,position,created_at) VALUES (?,?,?,?,?,?,?)')
      .run(slug, name, U.sanitizeText(req.body.emoji, 8), U.sanitizeText(req.body.tagline, 120),
        U.sanitizeText(req.body.accent, 20), Number(req.body.position) || 99, U.now());
  } catch (e) { return res.status(409).json({ error: 'A hub with that slug already exists.' }); }
  log(req, 'hub.create', 'hub', null, slug);
  res.json({ hub: db.prepare('SELECT * FROM hubs WHERE slug=?').get(slug) });
}));

r.patch('/hubs/:id', U.wrap((req, res) => {
  const h = db.prepare('SELECT * FROM hubs WHERE id=?').get(req.params.id);
  if (!h) return res.status(404).json({ error: 'Hub not found.' });
  const set = {};
  ['name', 'emoji', 'tagline', 'accent'].forEach((f) => { if (req.body[f] !== undefined) set[f] = U.sanitizeText(req.body[f], 120); });
  if (req.body.active !== undefined) set.active = req.body.active ? 1 : 0;
  if (req.body.position !== undefined) set.position = Number(req.body.position) || 0;
  if (Object.keys(set).length) db.prepare(`UPDATE hubs SET ${Object.keys(set).map((k) => `${k}=@${k}`).join(',')} WHERE id=@id`).run({ ...set, id: h.id });
  log(req, 'hub.update', 'hub', h.id, JSON.stringify(set));
  res.json({ hub: db.prepare('SELECT * FROM hubs WHERE id=?').get(h.id) });
}));

/* ---------------------------------------------------------------- packages (configurable prices) */
r.get('/packages', U.wrap((req, res) => {
  res.json({ packages: db.prepare('SELECT * FROM packages ORDER BY kind, position, price_cents').all().map((p) => ({ ...p, price: p.price_cents / 100 })) });
}));

r.post('/packages', U.wrap((req, res) => {
  const kind = ['job', 'ad', 'cosmetic'].includes(req.body.kind) ? req.body.kind : 'job';
  const code = U.sanitizeText(req.body.code, 40).toLowerCase().replace(/[^a-z0-9-]/g, '-');
  if (!code) return res.status(400).json({ error: 'Package code is required.' });
  try {
    db.prepare(`INSERT INTO packages (kind,code,name,description,price_cents,quantity,duration_days,perks,position,updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?)`).run(kind, code, U.sanitizeText(req.body.name, 60),
      U.sanitizeText(req.body.description, 400), money(req.body.price), Number(req.body.quantity) || 0,
      Number(req.body.duration_days) || 30, U.sanitizeText(req.body.perks, 300), Number(req.body.position) || 0, U.now());
  } catch (e) { return res.status(409).json({ error: 'That package code already exists.' }); }
  log(req, 'package.create', 'package', null, code);
  res.json({ package: db.prepare('SELECT * FROM packages WHERE code=?').get(code) });
}));

r.patch('/packages/:id', U.wrap((req, res) => {
  const p = db.prepare('SELECT * FROM packages WHERE id=?').get(req.params.id);
  if (!p) return res.status(404).json({ error: 'Package not found.' });
  const set = { updated_at: U.now() };
  if (req.body.name !== undefined) set.name = U.sanitizeText(req.body.name, 60);
  if (req.body.description !== undefined) set.description = U.sanitizeText(req.body.description, 400);
  if (req.body.price !== undefined) set.price_cents = money(req.body.price);
  if (req.body.quantity !== undefined) set.quantity = Number(req.body.quantity) || 0;
  if (req.body.duration_days !== undefined) set.duration_days = Number(req.body.duration_days) || 30;
  if (req.body.perks !== undefined) set.perks = U.sanitizeText(req.body.perks, 300);
  if (req.body.active !== undefined) set.active = req.body.active ? 1 : 0;
  db.prepare(`UPDATE packages SET ${Object.keys(set).map((k) => `${k}=@${k}`).join(',')} WHERE id=@id`).run({ ...set, id: p.id });
  log(req, 'package.update', 'package', p.id, JSON.stringify(set));
  res.json({ package: db.prepare('SELECT * FROM packages WHERE id=?').get(p.id) });
}));

/* ---------------------------------------------------------------- ads review */
r.get('/ads', U.wrap((req, res) => {
  const status = ['pending', 'active', 'paused', 'rejected', 'finished'].includes(req.query.status) ? req.query.status : null;
  res.json({
    campaigns: db.prepare(`SELECT a.*, u.username, u.full_name FROM ad_campaigns a JOIN users u ON u.id=a.advertiser_id
      ${status ? 'WHERE a.status=@status' : ''} ORDER BY a.created_at DESC LIMIT 60`).all({ status })
      .map((c) => ({ ...c, budget: c.budget_cents / 100 })),
  });
}));

r.post('/ads/:id/review', U.wrap((req, res) => {
  const c = db.prepare('SELECT * FROM ad_campaigns WHERE id=?').get(req.params.id);
  if (!c) return res.status(404).json({ error: 'Campaign not found.' });
  const status = ['active', 'rejected', 'paused', 'finished'].includes(req.body.status) ? req.body.status : null;
  if (!status) return res.status(400).json({ error: 'Invalid status.' });
  db.prepare('UPDATE ad_campaigns SET status=?, review_note=? WHERE id=?').run(status, U.sanitizeText(req.body.note, 300), c.id);
  U.notify({
    userId: c.advertiser_id, actorId: req.user.id, type: 'ad', entityType: 'ad', entityId: c.id,
    text: `Your campaign "${c.title}" was ${status}`, link: '#/ads',
  });
  log(req, 'ad.review', 'ad', c.id, status);
  res.json({ ok: true, status });
}));

/* ---------------------------------------------------------------- marketplace moderation */
r.get('/market', U.wrap((req, res) => {
  res.json({
    stores: db.prepare(`SELECT s.*, u.username, (SELECT COUNT(*) FROM products p WHERE p.store_id=s.id) AS products
      FROM stores s JOIN users u ON u.id=s.owner_id ORDER BY s.created_at DESC LIMIT 60`).all(),
    products: db.prepare(`SELECT p.id,p.title,p.price_cents,p.status,p.category,p.created_at,s.name AS store_name
      FROM products p JOIN stores s ON s.id=p.store_id ORDER BY p.created_at DESC LIMIT 60`).all()
      .map((p) => ({ ...p, price: p.price_cents / 100 })),
    orders: db.prepare(`SELECT o.*, u.username AS buyer FROM orders o JOIN users u ON u.id=o.buyer_id
      ORDER BY o.created_at DESC LIMIT 40`).all().map((o) => ({ ...o, total: o.total_cents / 100 })),
  });
}));

r.post('/stores/:id/status', U.wrap((req, res) => {
  const status = ['active', 'suspended'].includes(req.body.status) ? req.body.status : null;
  if (!status) return res.status(400).json({ error: 'Invalid status.' });
  db.prepare('UPDATE stores SET status=? WHERE id=?').run(status, req.params.id);
  log(req, 'store.status', 'store', Number(req.params.id), status);
  res.json({ ok: true, status });
}));

r.post('/products/:id/status', U.wrap((req, res) => {
  const status = ['active', 'hidden', 'removed'].includes(req.body.status) ? req.body.status : null;
  if (!status) return res.status(400).json({ error: 'Invalid status.' });
  db.prepare('UPDATE products SET status=? WHERE id=?').run(status, req.params.id);
  log(req, 'product.status', 'product', Number(req.params.id), status);
  res.json({ ok: true, status });
}));

/* ---------------------------------------------------------------- jobs */
r.get('/jobs', U.wrap((req, res) => {
  res.json({
    jobs: db.prepare(`SELECT j.*, u.username FROM job_posts j JOIN users u ON u.id=j.client_id
      ORDER BY j.created_at DESC LIMIT 60`).all().map((j) => ({ ...j, budget_min: j.budget_min_cents / 100, budget_max: j.budget_max_cents / 100 })),
  });
}));

r.post('/jobs/:id/status', U.wrap((req, res) => {
  const status = ['open', 'closed', 'filled', 'removed'].includes(req.body.status) ? req.body.status : null;
  if (!status) return res.status(400).json({ error: 'Invalid status.' });
  db.prepare('UPDATE job_posts SET status=? WHERE id=?').run(status, req.params.id);
  log(req, 'job.status', 'job', Number(req.params.id), status);
  res.json({ ok: true, status });
}));

/* ---------------------------------------------------------------- challenges + badges + XP */
r.post('/challenges/:id/status', U.wrap((req, res) => {
  const status = ['open', 'judging', 'closed'].includes(req.body.status) ? req.body.status : null;
  if (!status) return res.status(400).json({ error: 'Invalid status.' });
  db.prepare('UPDATE challenges SET status=? WHERE id=?').run(status, req.params.id);
  log(req, 'challenge.status', 'challenge', Number(req.params.id), status);
  res.json({ ok: true, status });
}));

r.post('/challenges/entries/:id/winner', U.wrap((req, res) => {
  const XP = require('../gamify');
  const e = db.prepare('SELECT e.*, c.title, c.xp_reward FROM challenge_entries e JOIN challenges c ON c.id=e.challenge_id WHERE e.id=?').get(req.params.id);
  if (!e) return res.status(404).json({ error: 'Entry not found.' });
  db.prepare('UPDATE challenge_entries SET winner=1 WHERE id=?').run(e.id);
  XP.award(e.user_id, 'challenge_win', { refType: 'challenge', refId: e.challenge_id });
  U.notify({
    userId: e.user_id, actorId: req.user.id, type: 'challenge', entityType: 'challenge', entityId: e.challenge_id,
    text: `You won the challenge "${e.title}" 🏆`, link: '#/arena?tab=challenges',
  });
  log(req, 'challenge.winner', 'entry', e.id, e.title);
  res.json({ ok: true });
}));

r.get('/badges', U.wrap((req, res) => res.json({ badges: db.prepare('SELECT * FROM badges ORDER BY rule_type, rule_value').all() })));

r.post('/badges', U.wrap((req, res) => {
  const code = U.sanitizeText(req.body.code, 40).toLowerCase().replace(/[^a-z0-9-]/g, '-');
  if (!code) return res.status(400).json({ error: 'Badge code is required.' });
  try {
    db.prepare('INSERT INTO badges (code,name,emoji,description,rule_type,rule_value) VALUES (?,?,?,?,?,?)')
      .run(code, U.sanitizeText(req.body.name, 60), U.sanitizeText(req.body.emoji, 8) || '🏅',
        U.sanitizeText(req.body.description, 200), U.sanitizeText(req.body.rule_type, 30) || 'manual', Number(req.body.rule_value) || 1);
  } catch (e) { return res.status(409).json({ error: 'That badge code already exists.' }); }
  log(req, 'badge.create', 'badge', null, code);
  res.json({ badge: db.prepare('SELECT * FROM badges WHERE code=?').get(code) });
}));

/* ---------------------------------------------------------------- settings */
r.get('/settings', U.wrap((req, res) => {
  const pay = require('../payments');
  const rows = db.prepare('SELECT * FROM platform_settings').all();
  const settings = {};
  rows.forEach((row) => { settings[row.key] = row.value; });
  res.json({ settings, payment: pay.status() });
}));

r.put('/settings', U.wrap((req, res) => {
  const body = req.body || {};
  const allowed = ['job_free_quota', 'marketplace_commission_pct', 'ads_enabled', 'marketplace_enabled',
    'work_enabled', 'arena_enabled', 'signup_open', 'platform_notice'];
  const stmt = db.prepare(`INSERT INTO platform_settings (key,value,updated_at) VALUES (?,?,?)
    ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at`);
  Object.keys(body).filter((k) => allowed.includes(k)).forEach((k) => stmt.run(k, String(body[k]).slice(0, 300), U.now()));
  log(req, 'settings.update', 'settings', null, Object.keys(body).join(','));
  const rows = db.prepare('SELECT * FROM platform_settings').all();
  const settings = {};
  rows.forEach((row) => { settings[row.key] = row.value; });
  res.json({ settings });
}));

module.exports = r;
