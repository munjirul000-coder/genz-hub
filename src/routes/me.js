'use strict';
const express = require('express');
const { db } = require('../db');
const U = require('../util');
const { me } = require('./auth');

const r = express.Router();
r.use(U.requireAuth);

r.get('/interests', U.wrap((req, res) => {
  res.json({ interests: db.prepare('SELECT * FROM interests ORDER BY category, name').all() });
}));

r.patch('/profile', U.wrap((req, res) => {
  const b = req.body;
  const full_name = U.sanitizeText(b.full_name, 60);
  if (full_name && full_name.length < 2) return res.status(400).json({ error: 'Name is too short.' });
  const fields = {
    full_name: full_name || req.user.full_name,
    bio: U.sanitizeText(b.bio, 300),
    location: U.sanitizeText(b.location, 80),
    business_role: U.sanitizeText(b.business_role, 40),
    fav_games: U.sanitizeText(b.fav_games, 200),
    platform: U.sanitizeText(b.platform, 40),
    gamer_tag: U.sanitizeText(b.gamer_tag, 40),
  };
  if (typeof b.avatar === 'string' && (b.avatar.startsWith('/uploads/') || b.avatar === '')) fields.avatar = b.avatar || null;
  if (typeof b.cover === 'string' && (b.cover.startsWith('/uploads/') || b.cover === '')) fields.cover = b.cover || null;
  const sets = Object.keys(fields).map((k) => `${k}=@${k}`).join(',');
  db.prepare(`UPDATE users SET ${sets} WHERE id=@id`).run({ ...fields, id: req.user.id });
  res.json({ user: me(db.prepare('SELECT * FROM users WHERE id=?').get(req.user.id)) });
}));

r.patch('/settings', U.wrap((req, res) => {
  const b = req.body;
  const u = db.prepare('SELECT * FROM users WHERE id=?').get(req.user.id);
  const vals = {
    theme: ['light', 'dark', 'system'].includes(b.theme) ? b.theme : u.theme,
    lang: ['en', 'bn'].includes(b.lang) ? b.lang : u.lang,
    profile_visibility: ['public', 'connections'].includes(b.profile_visibility) ? b.profile_visibility : u.profile_visibility,
    default_post_privacy: ['public', 'connections', 'private'].includes(b.default_post_privacy) ? b.default_post_privacy : u.default_post_privacy,
    notif_prefs: u.notif_prefs,
  };
  if (b.notif_prefs && typeof b.notif_prefs === 'object') {
    const cur = JSON.parse(u.notif_prefs || '{}');
    ['like', 'comment', 'message', 'follow', 'group'].forEach((k) => { if (k in b.notif_prefs) cur[k] = b.notif_prefs[k] ? 1 : 0; });
    vals.notif_prefs = JSON.stringify(cur);
  }
  db.prepare('UPDATE users SET theme=@theme, lang=@lang, profile_visibility=@profile_visibility, default_post_privacy=@default_post_privacy, notif_prefs=@notif_prefs WHERE id=@id')
    .run({ ...vals, id: req.user.id });
  res.json({ user: me(db.prepare('SELECT * FROM users WHERE id=?').get(req.user.id)) });
}));

r.post('/username', U.wrap((req, res) => {
  const username = U.sanitizeText(req.body.username, 20);
  if (!/^[a-z0-9_]{3,20}$/i.test(username)) return res.status(400).json({ error: 'Username must be 3-20 chars: letters, numbers, underscore.' });
  if (db.prepare('SELECT 1 FROM users WHERE username=? AND id<>?').get(username, req.user.id)) return res.status(409).json({ error: 'Username already taken.' });
  db.prepare('UPDATE users SET username=? WHERE id=?').run(username, req.user.id);
  res.json({ ok: true, username });
}));

r.post('/email', U.wrap((req, res) => {
  const email = U.sanitizeText(req.body.email, 120).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(email)) return res.status(400).json({ error: 'Enter a valid email address.' });
  if (db.prepare('SELECT 1 FROM users WHERE email=? AND id<>?').get(email, req.user.id)) return res.status(409).json({ error: 'That email is already in use.' });
  db.prepare('UPDATE users SET email=? WHERE id=?').run(email, req.user.id);
  res.json({ ok: true, email });
}));

r.put('/interests', U.wrap((req, res) => {
  const ids = Array.isArray(req.body.interest_ids) ? req.body.interest_ids.map(Number).filter(Boolean).slice(0, 30) : [];
  const tx = db.transaction(() => {
    db.prepare('DELETE FROM user_interests WHERE user_id=?').run(req.user.id);
    const ins = db.prepare('INSERT OR IGNORE INTO user_interests (user_id,interest_id) VALUES (?,?)');
    ids.forEach((i) => ins.run(req.user.id, i));
  });
  tx();
  res.json({ ok: true });
}));

r.post('/hubs', U.wrap((req, res) => {
  const hub = req.body.hub;
  const join = !!req.body.join;
  if (!['business', 'gaming'].includes(hub)) return res.status(400).json({ error: 'Unknown hub.' });
  const col = hub === 'business' ? 'in_business' : 'in_gaming';
  db.prepare(`UPDATE users SET ${col}=? WHERE id=?`).run(join ? 1 : 0, req.user.id);
  res.json({ ok: true, joined: join });
}));

r.post('/onboarding/complete', U.wrap((req, res) => {
  db.prepare('UPDATE users SET onboarded=1 WHERE id=?').run(req.user.id);
  res.json({ user: me(db.prepare('SELECT * FROM users WHERE id=?').get(req.user.id)) });
}));

r.delete('/account', U.wrap((req, res) => {
  db.prepare('DELETE FROM users WHERE id=?').run(req.user.id);
  res.clearCookie('gz_session', { path: '/' });
  res.json({ ok: true });
}));

module.exports = r;
