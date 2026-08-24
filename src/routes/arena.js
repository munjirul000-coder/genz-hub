'use strict';
/* Gen-Z Hub — Arena: challenges, polls, idea arena, leaderboards, daily missions, XP profile.
   Plus interest hubs (listing + join/leave) and the ad-serving endpoint. */

const express = require('express');
const { db } = require('../db');
const U = require('../util');
const XP = require('../gamify');
const pay = require('../payments');

const slugify = (s, extra) => (String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50) || 'item')
  + (extra ? '-' + extra : '');

/* ================================================================ HUBS */
const hubs = express.Router();

hubs.get('/', U.wrap((req, res) => {
  const me = req.user ? req.user.id : 0;
  const rows = db.prepare(`SELECT h.*,
      (SELECT COUNT(*) FROM user_hubs uh WHERE uh.hub_id=h.id) AS members,
      (SELECT COUNT(*) FROM communities c WHERE c.category=h.name) AS communities,
      (SELECT 1 FROM user_hubs uh WHERE uh.hub_id=h.id AND uh.user_id=@me) AS joined
    FROM hubs h WHERE h.active=1 ORDER BY h.position, h.id`).all({ me });
  res.json({ hubs: rows.map((h) => ({ ...h, joined: !!h.joined })) });
}));

hubs.get('/:slug', U.wrap((req, res) => {
  const me = req.user ? req.user.id : 0;
  const h = db.prepare('SELECT * FROM hubs WHERE slug=? AND active=1').get(req.params.slug);
  if (!h) return res.status(404).json({ error: 'Hub not found.' });
  const communities = db.prepare(`SELECT c.*, (SELECT COUNT(*) FROM community_members cm WHERE cm.community_id=c.id) AS member_count
    FROM communities c WHERE c.category=? ORDER BY member_count DESC LIMIT 12`).all(h.name);
  const people = db.prepare(`SELECT u.id,u.username,u.full_name,u.avatar,u.bio FROM user_hubs uh JOIN users u ON u.id=uh.user_id
    WHERE uh.hub_id=? AND u.status='active' ORDER BY uh.created_at DESC LIMIT 12`).all(h.id);
  const products = db.prepare(`SELECT p.*, s.name AS store_name, s.slug AS store_slug,
      (SELECT url FROM product_images pi WHERE pi.product_id=p.id ORDER BY position LIMIT 1) AS image
    FROM products p JOIN stores s ON s.id=p.store_id WHERE p.hub_slug=? AND p.status='active'
    ORDER BY p.created_at DESC LIMIT 8`).all(h.slug);
  const challenges = db.prepare("SELECT * FROM challenges WHERE hub_slug=? AND status='open' ORDER BY created_at DESC LIMIT 5").all(h.slug);
  res.json({
    hub: {
      ...h,
      members: db.prepare('SELECT COUNT(*) c FROM user_hubs WHERE hub_id=?').get(h.id).c,
      joined: me ? !!db.prepare('SELECT 1 FROM user_hubs WHERE hub_id=? AND user_id=?').get(h.id, me) : false,
    },
    communities, people,
    products: products.map((p) => ({ ...p, price: p.price_cents / 100 })),
    challenges,
  });
}));

hubs.post('/:slug/join', U.requireAuth, U.wrap((req, res) => {
  const h = db.prepare('SELECT * FROM hubs WHERE slug=? AND active=1').get(req.params.slug);
  if (!h) return res.status(404).json({ error: 'Hub not found.' });
  const has = db.prepare('SELECT 1 FROM user_hubs WHERE hub_id=? AND user_id=?').get(h.id, req.user.id);
  if (has) db.prepare('DELETE FROM user_hubs WHERE hub_id=? AND user_id=?').run(h.id, req.user.id);
  else {
    db.prepare('INSERT INTO user_hubs (user_id,hub_id,created_at) VALUES (?,?,?)').run(req.user.id, h.id, U.now());
    XP.award(req.user.id, 'hub_join', { refType: 'hub', refId: h.id });
  }
  // keep the legacy hub flags in sync so Business/Gaming pages keep working
  if (h.slug === 'business') db.prepare('UPDATE users SET in_business=? WHERE id=?').run(has ? 0 : 1, req.user.id);
  if (h.slug === 'gaming') db.prepare('UPDATE users SET in_gaming=? WHERE id=?').run(has ? 0 : 1, req.user.id);
  res.json({ joined: !has });
}));

/* ================================================================ CHALLENGES */
const challenges = express.Router();

challenges.get('/', U.wrap((req, res) => {
  const status = ['open', 'judging', 'closed'].includes(req.query.status) ? req.query.status : null;
  const rows = db.prepare(`SELECT c.*, u.username AS creator, u.full_name AS creator_name,
      (SELECT COUNT(*) FROM challenge_entries ce WHERE ce.challenge_id=c.id) AS entries
    FROM challenges c LEFT JOIN users u ON u.id=c.created_by
    ${status ? 'WHERE c.status=@status' : ''} ORDER BY (c.status='open') DESC, c.created_at DESC LIMIT 40`).all({ status });
  res.json({ challenges: rows });
}));

challenges.get('/:slug', U.wrap((req, res) => {
  const me = req.user ? req.user.id : 0;
  const c = db.prepare('SELECT * FROM challenges WHERE slug=?').get(req.params.slug);
  if (!c) return res.status(404).json({ error: 'Challenge not found.' });
  const entries = db.prepare(`SELECT e.*, u.username, u.full_name, u.avatar,
      (SELECT 1 FROM challenge_votes v WHERE v.entry_id=e.id AND v.user_id=@me) AS voted
    FROM challenge_entries e JOIN users u ON u.id=e.user_id WHERE e.challenge_id=@id
    ORDER BY e.winner DESC, e.votes DESC, e.created_at DESC LIMIT 60`).all({ id: c.id, me });
  res.json({
    challenge: { ...c, entries: entries.length },
    entries: entries.map((e) => ({ ...e, voted: !!e.voted })),
    my_entry: me ? db.prepare('SELECT * FROM challenge_entries WHERE challenge_id=? AND user_id=?').get(c.id, me) || null : null,
  });
}));

challenges.post('/', U.requireAuth, U.rateLimit({ max: 5, windowMs: 24 * 3600 * 1000, key: 'challenge' }), U.wrap((req, res) => {
  const title = U.sanitizeText(req.body.title, 120);
  if (title.length < 6) return res.status(400).json({ error: 'Challenge title must be at least 6 characters.' });
  const days = Math.min(60, Math.max(1, Number(req.body.days) || 14));
  const info = db.prepare(`INSERT INTO challenges (slug,title,description,category,hub_slug,xp_reward,created_by,starts_at,ends_at,created_at)
    VALUES (?,?,?,?,?,?,?,?,?,?)`).run(slugify(title, String(Date.now()).slice(-4)), title,
    U.sanitizeText(req.body.description, 3000), U.sanitizeText(req.body.category, 40) || 'Creative',
    U.sanitizeText(req.body.hub_slug, 40), Math.min(500, Math.max(10, Number(req.body.xp_reward) || 100)),
    req.user.id, U.now(), U.now() + days * 86400000, U.now());
  res.json({ challenge: db.prepare('SELECT * FROM challenges WHERE id=?').get(info.lastInsertRowid) });
}));

challenges.post('/:slug/entries', U.requireAuth, U.rateLimit({ max: 10, windowMs: 24 * 3600 * 1000, key: 'entry' }), U.wrap((req, res) => {
  const c = db.prepare('SELECT * FROM challenges WHERE slug=?').get(req.params.slug);
  if (!c) return res.status(404).json({ error: 'Challenge not found.' });
  if (c.status !== 'open') return res.status(400).json({ error: 'This challenge is closed for entries.' });
  const body = U.sanitizeText(req.body.body, 3000);
  if (body.length < 10) return res.status(400).json({ error: 'Describe your entry in at least 10 characters.' });
  const exists = db.prepare('SELECT 1 FROM challenge_entries WHERE challenge_id=? AND user_id=?').get(c.id, req.user.id);
  if (exists) return res.status(409).json({ error: 'You already submitted an entry.' });
  const link = U.sanitizeText(req.body.link_url, 400);
  if (link && !/^https?:\/\//i.test(link)) return res.status(400).json({ error: 'Link must start with http:// or https://' });
  const info = db.prepare(`INSERT INTO challenge_entries (challenge_id,user_id,post_id,title,body,link_url,created_at)
    VALUES (?,?,?,?,?,?,?)`).run(c.id, req.user.id, req.body.post_id ? Number(req.body.post_id) : null,
    U.sanitizeText(req.body.title, 120), body, link, U.now());
  const xp = XP.award(req.user.id, 'challenge_entry', { refType: 'challenge', refId: c.id });
  res.json({ entry: db.prepare('SELECT * FROM challenge_entries WHERE id=?').get(info.lastInsertRowid), xp });
}));

challenges.post('/entries/:id/vote', U.requireAuth, U.wrap((req, res) => {
  const e = db.prepare('SELECT * FROM challenge_entries WHERE id=?').get(req.params.id);
  if (!e) return res.status(404).json({ error: 'Entry not found.' });
  if (e.user_id === req.user.id) return res.status(400).json({ error: 'You cannot vote for your own entry.' });
  const has = db.prepare('SELECT 1 FROM challenge_votes WHERE entry_id=? AND user_id=?').get(e.id, req.user.id);
  if (has) {
    db.prepare('DELETE FROM challenge_votes WHERE entry_id=? AND user_id=?').run(e.id, req.user.id);
    db.prepare('UPDATE challenge_entries SET votes=MAX(0,votes-1) WHERE id=?').run(e.id);
  } else {
    db.prepare('INSERT INTO challenge_votes (entry_id,user_id,created_at) VALUES (?,?,?)').run(e.id, req.user.id, U.now());
    db.prepare('UPDATE challenge_entries SET votes=votes+1 WHERE id=?').run(e.id);
  }
  res.json({ voted: !has, votes: db.prepare('SELECT votes FROM challenge_entries WHERE id=?').get(e.id).votes });
}));

/* ================================================================ POLLS */
const polls = express.Router();

function pollPayload(p, me) {
  const options = db.prepare('SELECT * FROM poll_options WHERE poll_id=? ORDER BY position').all(p.id);
  const mine = me ? db.prepare('SELECT option_id FROM poll_votes WHERE poll_id=? AND user_id=?').all(p.id, me).map((r) => r.option_id) : [];
  const total = options.reduce((n, o) => n + o.votes, 0);
  return {
    ...p,
    total_votes: total,
    voted: mine.length > 0,
    my_options: mine,
    closed: !!(p.closes_at && p.closes_at < U.now()),
    options: options.map((o) => ({ id: o.id, label: o.label, votes: o.votes, pct: total ? Math.round((o.votes / total) * 100) : 0 })),
  };
}

polls.get('/', U.wrap((req, res) => {
  const me = req.user ? req.user.id : 0;
  const rows = db.prepare(`SELECT p.*, u.username, u.full_name, u.avatar FROM polls p JOIN users u ON u.id=p.user_id
    ${req.query.hub ? 'WHERE p.hub_slug=@hub' : ''} ORDER BY p.created_at DESC LIMIT 30`).all({ hub: req.query.hub || '' });
  res.json({ polls: rows.map((p) => pollPayload(p, me)) });
}));

polls.post('/', U.requireAuth, U.rateLimit({ max: 10, windowMs: 24 * 3600 * 1000, key: 'poll' }), U.wrap((req, res) => {
  const question = U.sanitizeText(req.body.question, 200);
  const options = (Array.isArray(req.body.options) ? req.body.options : [])
    .map((o) => U.sanitizeText(o, 80)).filter(Boolean).slice(0, 6);
  if (question.length < 5) return res.status(400).json({ error: 'Write a clear question.' });
  if (options.length < 2) return res.status(400).json({ error: 'Add at least two options.' });
  const hours = Math.min(720, Math.max(1, Number(req.body.hours) || 72));
  const info = db.prepare('INSERT INTO polls (user_id,question,hub_slug,multi,closes_at,created_at) VALUES (?,?,?,?,?,?)')
    .run(req.user.id, question, U.sanitizeText(req.body.hub_slug, 40), req.body.multi ? 1 : 0, U.now() + hours * 3600000, U.now());
  const id = info.lastInsertRowid;
  options.forEach((label, i) => db.prepare('INSERT INTO poll_options (poll_id,label,position) VALUES (?,?,?)').run(id, label, i));
  XP.award(req.user.id, 'poll_created', { refType: 'poll', refId: Number(id) });
  res.json({ poll: pollPayload(db.prepare('SELECT * FROM polls WHERE id=?').get(id), req.user.id) });
}));

polls.post('/:id/vote', U.requireAuth, U.wrap((req, res) => {
  const p = db.prepare('SELECT * FROM polls WHERE id=?').get(req.params.id);
  if (!p) return res.status(404).json({ error: 'Poll not found.' });
  if (p.closes_at && p.closes_at < U.now()) return res.status(400).json({ error: 'This poll has closed.' });
  const optionId = Number(req.body.option_id);
  const opt = db.prepare('SELECT * FROM poll_options WHERE id=? AND poll_id=?').get(optionId, p.id);
  if (!opt) return res.status(400).json({ error: 'Invalid option.' });
  const already = db.prepare('SELECT option_id FROM poll_votes WHERE poll_id=? AND user_id=?').all(p.id, req.user.id);
  if (already.length && !p.multi) return res.status(409).json({ error: 'You already voted in this poll.' });
  if (already.some((a) => a.option_id === optionId)) return res.status(409).json({ error: 'You already picked this option.' });
  db.prepare('INSERT INTO poll_votes (poll_id,option_id,user_id,created_at) VALUES (?,?,?,?)').run(p.id, optionId, req.user.id, U.now());
  db.prepare('UPDATE poll_options SET votes=votes+1 WHERE id=?').run(optionId);
  db.prepare('UPDATE polls SET total_votes=total_votes+1 WHERE id=?').run(p.id);
  XP.award(req.user.id, 'poll_vote', { refType: 'poll', refId: p.id });
  res.json({ poll: pollPayload(db.prepare('SELECT * FROM polls WHERE id=?').get(p.id), req.user.id) });
}));

/* ================================================================ IDEA ARENA */
const ideas = express.Router();

ideas.get('/', U.wrap((req, res) => {
  const me = req.user ? req.user.id : 0;
  const sort = req.query.sort === 'top' ? 'i.supports DESC, i.created_at DESC'
    : req.query.sort === 'trending' ? 'i.supports DESC, i.comments_count DESC' : 'i.created_at DESC';
  const rows = db.prepare(`SELECT i.*, u.username, u.full_name, u.avatar,
      (SELECT 1 FROM idea_supports s WHERE s.idea_id=i.id AND s.user_id=@me) AS supported
    FROM ideas i JOIN users u ON u.id=i.user_id WHERE i.status='active'
    ${req.query.hub ? 'AND i.hub_slug=@hub' : ''} ORDER BY ${sort} LIMIT 40`).all({ me, hub: req.query.hub || '' });
  res.json({ ideas: rows.map((i) => ({ ...i, supported: !!i.supported })) });
}));

ideas.get('/:id', U.wrap((req, res) => {
  const me = req.user ? req.user.id : 0;
  const i = db.prepare(`SELECT i.*, u.username, u.full_name, u.avatar,
      (SELECT 1 FROM idea_supports s WHERE s.idea_id=i.id AND s.user_id=@me) AS supported
    FROM ideas i JOIN users u ON u.id=i.user_id WHERE i.id=@id`).get({ id: req.params.id, me });
  if (!i) return res.status(404).json({ error: 'Idea not found.' });
  const comments = db.prepare(`SELECT c.*, u.username, u.full_name, u.avatar FROM idea_comments c JOIN users u ON u.id=c.user_id
    WHERE c.idea_id=? ORDER BY c.created_at ASC LIMIT 100`).all(i.id);
  res.json({ idea: { ...i, supported: !!i.supported }, comments });
}));

ideas.post('/', U.requireAuth, U.rateLimit({ max: 10, windowMs: 24 * 3600 * 1000, key: 'idea' }), U.wrap((req, res) => {
  const title = U.sanitizeText(req.body.title, 140);
  if (title.length < 8) return res.status(400).json({ error: 'Give your idea a clear title (8+ characters).' });
  const info = db.prepare(`INSERT INTO ideas (user_id,title,body,hub_slug,looking_for,stage,created_at) VALUES (?,?,?,?,?,?,?)`)
    .run(req.user.id, title, U.sanitizeText(req.body.body, 4000), U.sanitizeText(req.body.hub_slug, 40),
      U.sanitizeText(req.body.looking_for, 200), ['idea', 'building', 'launched'].includes(req.body.stage) ? req.body.stage : 'idea', U.now());
  XP.award(req.user.id, 'idea', { refType: 'idea', refId: Number(info.lastInsertRowid) });
  res.json({ idea: db.prepare('SELECT * FROM ideas WHERE id=?').get(info.lastInsertRowid) });
}));

ideas.post('/:id/support', U.requireAuth, U.wrap((req, res) => {
  const i = db.prepare('SELECT * FROM ideas WHERE id=?').get(req.params.id);
  if (!i) return res.status(404).json({ error: 'Idea not found.' });
  const has = db.prepare('SELECT 1 FROM idea_supports WHERE idea_id=? AND user_id=?').get(i.id, req.user.id);
  if (has) {
    db.prepare('DELETE FROM idea_supports WHERE idea_id=? AND user_id=?').run(i.id, req.user.id);
    db.prepare('UPDATE ideas SET supports=MAX(0,supports-1) WHERE id=?').run(i.id);
  } else {
    db.prepare('INSERT INTO idea_supports (idea_id,user_id,created_at) VALUES (?,?,?)').run(i.id, req.user.id, U.now());
    db.prepare('UPDATE ideas SET supports=supports+1 WHERE id=?').run(i.id);
    if (i.user_id !== req.user.id) {
      XP.award(i.user_id, 'idea_support_received', { refType: 'idea', refId: i.id });
      U.notify({ userId: i.user_id, actorId: req.user.id, type: 'idea', entityType: 'idea', entityId: i.id,
        text: `${req.user.full_name} supports your idea "${i.title}"`, link: `#/idea/${i.id}` });
    }
  }
  res.json({ supported: !has, supports: db.prepare('SELECT supports FROM ideas WHERE id=?').get(i.id).supports });
}));

ideas.post('/:id/comments', U.requireAuth, U.rateLimit({ max: 60, windowMs: 3600 * 1000, key: 'ideacomment' }), U.wrap((req, res) => {
  const i = db.prepare('SELECT * FROM ideas WHERE id=?').get(req.params.id);
  if (!i) return res.status(404).json({ error: 'Idea not found.' });
  const body = U.sanitizeText(req.body.body, 1500);
  if (!body) return res.status(400).json({ error: 'Write a comment.' });
  db.prepare('INSERT INTO idea_comments (idea_id,user_id,body,created_at) VALUES (?,?,?,?)').run(i.id, req.user.id, body, U.now());
  db.prepare('UPDATE ideas SET comments_count=comments_count+1 WHERE id=?').run(i.id);
  if (i.user_id !== req.user.id) {
    U.notify({ userId: i.user_id, actorId: req.user.id, type: 'idea', entityType: 'idea', entityId: i.id,
      text: `${req.user.full_name} commented on your idea`, link: `#/idea/${i.id}` });
  }
  XP.award(req.user.id, 'helpful_reply', { refType: 'idea', refId: i.id });
  res.json({ ok: true });
}));

/* ================================================================ ARENA (xp/missions/board) */
const arena = express.Router();

arena.get('/me', U.requireAuth, U.wrap((req, res) => {
  XP.award(req.user.id, 'daily_login');
  res.json({
    stats: XP.profileFor(req.user.id),
    missions: XP.missionsFor(req.user.id),
    rules: Object.entries(XP.ACTIONS).map(([action, v]) => ({ action, xp: v.xp, daily_cap: v.cap })),
  });
}));

arena.post('/missions/:id/claim', U.requireAuth, U.wrap((req, res) => {
  const out = XP.claimMission(req.user.id, Number(req.params.id));
  if (out.error) return res.status(400).json(out);
  res.json(out);
}));

arena.get('/leaderboard', U.wrap((req, res) => {
  res.json({
    ...XP.leaderboard(req.query.board, req.query.range, Math.min(Number(req.query.limit) || 20, 50)),
    boards: Object.entries(XP.BOARDS).map(([k, v]) => ({ key: k, label: v.label })),
  });
}));

arena.get('/badges', U.wrap((req, res) => {
  const all = db.prepare('SELECT * FROM badges WHERE active=1 ORDER BY rule_type, rule_value').all();
  const mine = req.user
    ? new Set(db.prepare('SELECT badge_id FROM user_badges WHERE user_id=?').all(req.user.id).map((r) => r.badge_id))
    : new Set();
  res.json({ badges: all.map((b) => ({ ...b, earned: mine.has(b.id) })) });
}));

/* ================================================================ ADS */
const ads = express.Router();

ads.get('/packages', U.wrap((req, res) => {
  const rows = db.prepare("SELECT * FROM packages WHERE kind='ad' AND active=1 ORDER BY position, price_cents").all();
  res.json({ packages: rows.map((p) => ({ ...p, price: p.price_cents / 100 })), payment: pay.status() });
}));

// Serve a relevant ad for the current context. Targeting uses hub/category interest only —
// never private profile data — and every campaign is admin-reviewed before it can run.
ads.get('/serve', U.wrap((req, res) => {
  const hub = U.sanitizeText(req.query.hub, 40);
  const now = U.now();
  const rows = db.prepare(`SELECT a.*, u.username, u.full_name, u.avatar FROM ad_campaigns a JOIN users u ON u.id=a.advertiser_id
    WHERE a.status='active' AND (a.ends_at IS NULL OR a.ends_at>@now)
      AND (@hub='' OR a.target_hubs='' OR a.target_hubs LIKE '%'||@hub||'%')
    ORDER BY RANDOM() LIMIT 1`).get({ now, hub: hub || '' });
  if (!rows) return res.json({ ad: null });
  db.prepare('UPDATE ad_campaigns SET impressions=impressions+1 WHERE id=?').run(rows.id);
  res.json({ ad: { id: rows.id, title: rows.title, body: rows.body, image: rows.image, cta_label: rows.cta_label, cta_url: rows.cta_url, product_id: rows.product_id, advertiser: rows.full_name } });
}));

ads.post('/:id/click', U.wrap((req, res) => {
  db.prepare('UPDATE ad_campaigns SET clicks=clicks+1 WHERE id=?').run(req.params.id);
  res.json({ ok: true });
}));

ads.get('/mine', U.requireAuth, U.wrap((req, res) => {
  const rows = db.prepare('SELECT * FROM ad_campaigns WHERE advertiser_id=? ORDER BY created_at DESC LIMIT 30').all(req.user.id);
  res.json({ campaigns: rows.map((c) => ({ ...c, budget: c.budget_cents / 100 })) });
}));

ads.post('/', U.requireAuth, U.rateLimit({ max: 10, windowMs: 24 * 3600 * 1000, key: 'ad' }), U.wrap((req, res) => {
  const title = U.sanitizeText(req.body.title, 100);
  if (title.length < 5) return res.status(400).json({ error: 'Ad title must be at least 5 characters.' });
  const url = U.sanitizeText(req.body.cta_url, 400);
  if (url && !/^https?:\/\//i.test(url) && !url.startsWith('#/')) return res.status(400).json({ error: 'CTA link must be a valid URL.' });
  const pkg = req.body.package_id ? db.prepare("SELECT * FROM packages WHERE id=? AND kind='ad' AND active=1").get(req.body.package_id) : null;
  const days = pkg ? pkg.duration_days : Math.min(60, Math.max(1, Number(req.body.days) || 7));
  const info = db.prepare(`INSERT INTO ad_campaigns
    (advertiser_id,title,body,image,cta_label,cta_url,product_id,target_hubs,target_categories,package_id,budget_cents,status,starts_at,ends_at,created_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(req.user.id, title, U.sanitizeText(req.body.body, 500),
    U.sanitizeText(req.body.image, 300), U.sanitizeText(req.body.cta_label, 40) || 'Learn more', url,
    req.body.product_id ? Number(req.body.product_id) : null,
    U.sanitizeText(Array.isArray(req.body.target_hubs) ? req.body.target_hubs.join(',') : req.body.target_hubs, 200),
    U.sanitizeText(Array.isArray(req.body.target_categories) ? req.body.target_categories.join(',') : req.body.target_categories, 200),
    pkg ? pkg.id : null, pkg ? pkg.price_cents : 0, 'pending', U.now(), U.now() + days * 86400000, U.now());
  const campaign = db.prepare('SELECT * FROM ad_campaigns WHERE id=?').get(info.lastInsertRowid);
  const intent = pkg ? pay.createIntent({ amount_cents: pkg.price_cents, ref: 'AD' + campaign.id, userId: req.user.id, purpose: 'ad' }) : null;
  res.json({
    campaign,
    payment: intent,
    note: 'Your campaign is queued for admin review. Estimated reach depends on how many people follow the hubs you targeted — we never guarantee a fixed number of views.',
  });
}));

module.exports = { hubs, challenges, polls, ideas, arena, ads };
