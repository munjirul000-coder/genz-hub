'use strict';
/* Gen-Z Hub — Work: freelancer profiles, job posts, proposals, hiring and job packages. */

const express = require('express');
const { db } = require('../db');
const U = require('../util');
const XP = require('../gamify');
const pay = require('../payments');

const r = express.Router();

const CATEGORIES = ['Web development', 'App development', 'Graphic design', 'Logo design',
  'Video editing', 'Photo editing', 'Writing', 'Programming', 'Social media', 'Marketing',
  'Voice over', 'Data entry', 'Other'];

const money = (v) => Math.max(0, Math.round(Number(v || 0) * 100));
const cleanList = (s, max = 10) => U.sanitizeText(s, 300).split(',').map((x) => x.trim()).filter(Boolean).slice(0, max).join(', ');

/** Free job posts every user gets before they need a package. */
function freeQuota() {
  const row = db.prepare("SELECT value FROM platform_settings WHERE key='job_free_quota'").get();
  return row ? Number(row.value) : 2;
}

function jobCredits(userId) {
  const rows = db.prepare(`SELECT COALESCE(SUM(credits_left),0) c FROM package_purchases
    WHERE user_id=? AND kind='job' AND payment_status='paid' AND (expires_at IS NULL OR expires_at>?)`).get(userId, U.now());
  return rows.c || 0;
}

function usedFreePosts(userId) {
  return db.prepare("SELECT COUNT(*) c FROM job_posts WHERE client_id=? AND status<>'removed'").get(userId).c;
}

/* ---------------------------------------------------------------- jobs */
r.get('/jobs', U.wrap((req, res) => {
  const where = ["j.status='open'"];
  const params = { limit: Math.min(Number(req.query.limit) || 20, 40), offset: Number(req.query.offset) || 0 };
  if (req.query.category) { where.push('j.category=@category'); params.category = String(req.query.category); }
  if (req.query.q) { where.push('(j.title LIKE @q OR j.description LIKE @q OR j.skills LIKE @q)'); params.q = '%' + String(req.query.q).slice(0, 60) + '%'; }
  if (req.query.budget_min) { where.push('j.budget_max_cents>=@bmin'); params.bmin = money(req.query.budget_min); }
  if (req.query.mine === '1' && req.user) { where.length = 0; where.push('j.client_id=@me'); params.me = req.user.id; }
  const rows = db.prepare(`SELECT j.*, u.username, u.full_name, u.avatar FROM job_posts j JOIN users u ON u.id=j.client_id
    WHERE ${where.join(' AND ')} ORDER BY j.created_at DESC LIMIT @limit OFFSET @offset`).all(params);
  res.json({
    jobs: rows.map((j) => ({ ...j, budget_min: j.budget_min_cents / 100, budget_max: j.budget_max_cents / 100 })),
    categories: CATEGORIES,
  });
}));

r.get('/jobs/:id', U.wrap((req, res) => {
  const me = req.user ? req.user.id : 0;
  const j = db.prepare(`SELECT j.*, u.username, u.full_name, u.avatar FROM job_posts j JOIN users u ON u.id=j.client_id WHERE j.id=?`).get(req.params.id);
  if (!j) return res.status(404).json({ error: 'Job not found.' });
  const isClient = me === j.client_id;
  const proposals = isClient || (req.user && req.user.role === 'admin')
    ? db.prepare(`SELECT p.*, u.username, u.full_name, u.avatar, fp.headline, fp.skills, fp.rating, fp.jobs_done
        FROM job_proposals p JOIN users u ON u.id=p.freelancer_id
        LEFT JOIN freelancer_profiles fp ON fp.user_id=p.freelancer_id
        WHERE p.job_id=? ORDER BY p.created_at DESC`).all(j.id)
    : [];
  res.json({
    job: { ...j, budget_min: j.budget_min_cents / 100, budget_max: j.budget_max_cents / 100, is_client: isClient },
    proposals: proposals.map((p) => ({ ...p, bid: p.bid_cents / 100 })),
    my_proposal: me ? db.prepare('SELECT * FROM job_proposals WHERE job_id=? AND freelancer_id=?').get(j.id, me) || null : null,
  });
}));

r.post('/jobs', U.requireAuth, U.rateLimit({ max: 20, windowMs: 24 * 3600 * 1000, key: 'job' }), U.wrap((req, res) => {
  const title = U.sanitizeText(req.body.title, 120);
  if (title.length < 6) return res.status(400).json({ error: 'Job title must be at least 6 characters.' });

  const credits = jobCredits(req.user.id);
  const free = Math.max(0, freeQuota() - usedFreePosts(req.user.id));
  if (!free && !credits) {
    return res.status(402).json({
      error: 'You have used your free job posts. Buy a job package to post more.',
      need_package: true,
    });
  }

  const durationDays = Math.min(90, Math.max(3, Number(req.body.duration_days) || 30));
  const info = db.prepare(`INSERT INTO job_posts
    (client_id,title,description,category,skills,budget_min_cents,budget_max_cents,budget_type,location,expires_at,created_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?)`).run(req.user.id, title, U.sanitizeText(req.body.description, 5000),
    CATEGORIES.includes(req.body.category) ? req.body.category : 'Other', cleanList(req.body.skills),
    money(req.body.budget_min), money(req.body.budget_max),
    req.body.budget_type === 'hourly' ? 'hourly' : 'fixed', U.sanitizeText(req.body.location, 60) || 'Remote',
    U.now() + durationDays * 86400000, U.now());

  if (!free && credits) {
    const purchase = db.prepare(`SELECT * FROM package_purchases WHERE user_id=? AND kind='job' AND payment_status='paid'
      AND credits_left>0 AND (expires_at IS NULL OR expires_at>?) ORDER BY expires_at ASC LIMIT 1`).get(req.user.id, U.now());
    if (purchase) db.prepare('UPDATE package_purchases SET credits_left=credits_left-1 WHERE id=?').run(purchase.id);
  }
  XP.award(req.user.id, 'job_posted', { refType: 'job', refId: Number(info.lastInsertRowid) });
  res.json({ job: db.prepare('SELECT * FROM job_posts WHERE id=?').get(info.lastInsertRowid), free_left: Math.max(0, free - 1), credits: jobCredits(req.user.id) });
}));

r.patch('/jobs/:id', U.requireAuth, U.wrap((req, res) => {
  const j = db.prepare('SELECT * FROM job_posts WHERE id=?').get(req.params.id);
  if (!j) return res.status(404).json({ error: 'Job not found.' });
  if (j.client_id !== req.user.id && req.user.role !== 'admin') return res.status(403).json({ error: 'Not your job post.' });
  const status = ['open', 'closed', 'filled'].includes(req.body.status) ? req.body.status : j.status;
  db.prepare('UPDATE job_posts SET status=? WHERE id=?').run(status, j.id);
  res.json({ ok: true, status });
}));

/* ---------------------------------------------------------------- proposals */
r.post('/jobs/:id/proposals', U.requireAuth, U.rateLimit({ max: 30, windowMs: 24 * 3600 * 1000, key: 'proposal' }), U.wrap((req, res) => {
  const j = db.prepare('SELECT * FROM job_posts WHERE id=?').get(req.params.id);
  if (!j || j.status !== 'open') return res.status(404).json({ error: 'This job is no longer open.' });
  if (j.client_id === req.user.id) return res.status(400).json({ error: 'You cannot apply to your own job.' });
  const cover = U.sanitizeText(req.body.cover, 2000);
  if (cover.length < 20) return res.status(400).json({ error: 'Write at least 20 characters in your proposal.' });
  const exists = db.prepare('SELECT 1 FROM job_proposals WHERE job_id=? AND freelancer_id=?').get(j.id, req.user.id);
  if (exists) return res.status(409).json({ error: 'You already applied to this job.' });
  db.prepare(`INSERT INTO job_proposals (job_id,freelancer_id,cover,bid_cents,days,created_at) VALUES (?,?,?,?,?,?)`)
    .run(j.id, req.user.id, cover, money(req.body.bid), Math.max(1, Math.min(180, Number(req.body.days) || 7)), U.now());
  db.prepare('UPDATE job_posts SET proposals_count=proposals_count+1 WHERE id=?').run(j.id);
  U.notify({
    userId: j.client_id, actorId: req.user.id, type: 'proposal', entityType: 'job', entityId: j.id,
    text: `${req.user.full_name} sent a proposal for "${j.title}"`, link: `#/job/${j.id}`,
  });
  XP.award(req.user.id, 'proposal_sent', { refType: 'job', refId: j.id });
  res.json({ ok: true });
}));

r.get('/proposals/mine', U.requireAuth, U.wrap((req, res) => {
  const rows = db.prepare(`SELECT p.*, j.title, j.status AS job_status, j.category, u.username AS client_username, u.full_name AS client_name
    FROM job_proposals p JOIN job_posts j ON j.id=p.job_id JOIN users u ON u.id=j.client_id
    WHERE p.freelancer_id=? ORDER BY p.created_at DESC LIMIT 50`).all(req.user.id);
  res.json({ proposals: rows.map((p) => ({ ...p, bid: p.bid_cents / 100 })) });
}));

r.post('/proposals/:id/status', U.requireAuth, U.wrap((req, res) => {
  const allowed = ['shortlisted', 'hired', 'declined'];
  const status = String(req.body.status || '');
  if (!allowed.includes(status)) return res.status(400).json({ error: 'Invalid status.' });
  const p = db.prepare(`SELECT p.*, j.client_id, j.title FROM job_proposals p JOIN job_posts j ON j.id=p.job_id WHERE p.id=?`).get(req.params.id);
  if (!p) return res.status(404).json({ error: 'Proposal not found.' });
  if (p.client_id !== req.user.id) return res.status(403).json({ error: 'Only the client can do that.' });
  db.prepare('UPDATE job_proposals SET status=? WHERE id=?').run(status, p.id);
  if (status === 'hired') {
    db.prepare("UPDATE job_posts SET status='filled' WHERE id=?").run(p.job_id);
    db.prepare(`INSERT INTO freelancer_profiles (user_id,jobs_done,updated_at) VALUES (?,1,?)
      ON CONFLICT(user_id) DO UPDATE SET jobs_done=jobs_done+1, updated_at=excluded.updated_at`).run(p.freelancer_id, U.now());
    XP.award(p.freelancer_id, 'helpful_reply', { refType: 'job', refId: p.job_id });
  }
  U.notify({
    userId: p.freelancer_id, actorId: req.user.id, type: 'proposal', entityType: 'job', entityId: p.job_id,
    text: `Your proposal for "${p.title}" was ${status}`, link: `#/job/${p.job_id}`,
  });
  res.json({ ok: true });
}));

/* ---------------------------------------------------------------- freelancers */
r.get('/freelancers', U.wrap((req, res) => {
  const params = { limit: Math.min(Number(req.query.limit) || 24, 40) };
  const where = ["u.status='active'", "fp.availability<>'closed'"];
  if (req.query.skill) { where.push('fp.skills LIKE @skill'); params.skill = '%' + String(req.query.skill).slice(0, 40) + '%'; }
  if (req.query.q) { where.push('(u.full_name LIKE @q OR u.username LIKE @q OR fp.headline LIKE @q OR fp.skills LIKE @q)'); params.q = '%' + String(req.query.q).slice(0, 40) + '%'; }
  const rows = db.prepare(`SELECT u.id,u.username,u.full_name,u.avatar,u.bio,u.location, fp.*, st.level, st.xp
    FROM freelancer_profiles fp JOIN users u ON u.id=fp.user_id LEFT JOIN user_stats st ON st.user_id=u.id
    WHERE ${where.join(' AND ')} ORDER BY fp.rating DESC, fp.jobs_done DESC LIMIT @limit`).all(params);
  res.json({ freelancers: rows.map((f) => ({ ...f, hourly: f.hourly_cents / 100, min_budget: f.min_budget_cents / 100 })) });
}));

r.get('/freelancers/:username', U.wrap((req, res) => {
  const u = db.prepare('SELECT id,username,full_name,avatar,bio,location,skills,portfolio_url FROM users WHERE username=?').get(req.params.username);
  if (!u) return res.status(404).json({ error: 'User not found.' });
  const fp = db.prepare('SELECT * FROM freelancer_profiles WHERE user_id=?').get(u.id);
  const portfolio = db.prepare(`SELECT id,content,created_at FROM posts WHERE user_id=? AND kind IN ('collab','team') AND removed=0 ORDER BY created_at DESC LIMIT 8`).all(u.id);
  res.json({
    user: u,
    profile: fp ? { ...fp, hourly: fp.hourly_cents / 100, min_budget: fp.min_budget_cents / 100 } : null,
    portfolio,
    stats: XP.profileFor(u.id),
  });
}));

r.put('/freelancer', U.requireAuth, U.wrap((req, res) => {
  const availability = ['open', 'busy', 'closed'].includes(req.body.availability) ? req.body.availability : 'open';
  db.prepare(`INSERT INTO freelancer_profiles (user_id,headline,about,skills,hourly_cents,min_budget_cents,availability,portfolio_url,updated_at)
    VALUES (@u,@h,@a,@s,@hc,@mb,@av,@p,@t)
    ON CONFLICT(user_id) DO UPDATE SET headline=@h, about=@a, skills=@s, hourly_cents=@hc, min_budget_cents=@mb,
      availability=@av, portfolio_url=@p, updated_at=@t`)
    .run({
      u: req.user.id, h: U.sanitizeText(req.body.headline, 120), a: U.sanitizeText(req.body.about, 2000),
      s: cleanList(req.body.skills, 15), hc: money(req.body.hourly), mb: money(req.body.min_budget),
      av: availability, p: U.sanitizeText(req.body.portfolio_url, 300), t: U.now(),
    });
  db.prepare("UPDATE users SET skills=?, work_status=CASE WHEN work_status='client' THEN 'both' ELSE 'freelancer' END WHERE id=?")
    .run(cleanList(req.body.skills, 15), req.user.id);
  res.json({ ok: true, profile: db.prepare('SELECT * FROM freelancer_profiles WHERE user_id=?').get(req.user.id) });
}));

/* ---------------------------------------------------------------- packages */
r.get('/packages', U.wrap((req, res) => {
  const kind = ['job', 'ad', 'cosmetic'].includes(req.query.kind) ? req.query.kind : 'job';
  const rows = db.prepare('SELECT * FROM packages WHERE kind=? AND active=1 ORDER BY position, price_cents').all(kind);
  res.json({
    packages: rows.map((p) => ({ ...p, price: p.price_cents / 100 })),
    payment: pay.status(),
    my_credits: req.user ? jobCredits(req.user.id) : 0,
    free_left: req.user ? Math.max(0, freeQuota() - usedFreePosts(req.user.id)) : freeQuota(),
  });
}));

r.post('/packages/:id/buy', U.requireAuth, U.wrap((req, res) => {
  const p = db.prepare('SELECT * FROM packages WHERE id=? AND active=1').get(req.params.id);
  if (!p) return res.status(404).json({ error: 'Package not found.' });
  const info = db.prepare(`INSERT INTO package_purchases
    (user_id,package_id,kind,credits_total,credits_left,amount_cents,payment_status,expires_at,created_at)
    VALUES (?,?,?,?,?,?,?,?,?)`).run(req.user.id, p.id, p.kind, p.quantity, p.quantity, p.price_cents,
    'pending', U.now() + p.duration_days * 86400000, U.now());
  const purchase = db.prepare('SELECT * FROM package_purchases WHERE id=?').get(info.lastInsertRowid);
  const intent = pay.createIntent({ amount_cents: p.price_cents, ref: 'PKG' + purchase.id, userId: req.user.id, purpose: 'package' });
  db.prepare('UPDATE package_purchases SET payment_ref=? WHERE id=?').run('PKG' + purchase.id, purchase.id);
  res.json({ purchase, payment: intent });
}));

r.get('/purchases', U.requireAuth, U.wrap((req, res) => {
  const rows = db.prepare(`SELECT pp.*, p.name, p.kind AS package_kind FROM package_purchases pp
    JOIN packages p ON p.id=pp.package_id WHERE pp.user_id=? ORDER BY pp.created_at DESC LIMIT 30`).all(req.user.id);
  res.json({ purchases: rows.map((x) => ({ ...x, amount: x.amount_cents / 100 })) });
}));

module.exports = { router: r, CATEGORIES, jobCredits, freeQuota };
