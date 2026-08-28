'use strict';
const express = require('express');
const bcrypt = require('bcryptjs');
const { db } = require('../db');
const U = require('../util');
const RBAC = require('../rbac');

const r = express.Router();
const RESERVED = ['admin', 'root', 'genzhub', 'support', 'null', 'undefined', 'api'];

function validUsername(u) { return /^[a-z0-9_]{3,20}$/i.test(u) && !RESERVED.includes(u.toLowerCase()); }
function validEmail(e) { return /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(e); }
function passwordIssue(p) {
  if (typeof p !== 'string' || p.length < 8) return 'Password must be at least 8 characters.';
  if (!/[a-z]/i.test(p) || !/[0-9]/.test(p)) return 'Password must include letters and numbers.';
  return null;
}
function age(dob) {
  const d = new Date(dob);
  if (isNaN(d)) return -1;
  const diff = Date.now() - d.getTime();
  return Math.floor(diff / (365.2425 * 24 * 3600 * 1000));
}

r.get('/username-available', U.wrap((req, res) => {
  const u = U.sanitizeText(req.query.username, 30);
  if (!validUsername(u)) return res.json({ available: false, reason: '3-20 chars, letters/numbers/underscore only.' });
  const exists = db.prepare('SELECT 1 FROM users WHERE username=?').get(u);
  res.json({ available: !exists, reason: exists ? 'Username already taken.' : 'Available' });
}));

r.post('/signup', U.rateLimit({ max: 25, windowMs: 10 * 60 * 1000, key: 'signup' }), U.wrap((req, res) => {
  const full_name = U.sanitizeText(req.body.full_name, 60);
  const username = U.sanitizeText(req.body.username, 20);
  const email = U.sanitizeText(req.body.email, 120).toLowerCase();
  const password = req.body.password || '';
  const dob = U.sanitizeText(req.body.dob, 20);

  if (full_name.length < 2) return res.status(400).json({ error: 'Please enter your full name.', field: 'full_name' });
  if (!validUsername(username)) return res.status(400).json({ error: 'Username must be 3-20 chars: letters, numbers, underscore.', field: 'username' });
  if (!validEmail(email)) return res.status(400).json({ error: 'Enter a valid email address.', field: 'email' });
  const pi = passwordIssue(password);
  if (pi) return res.status(400).json({ error: pi, field: 'password' });
  const a = age(dob);
  if (a < 0) return res.status(400).json({ error: 'Enter a valid date of birth.', field: 'dob' });
  if (a < 13) return res.status(400).json({ error: 'You must be at least 13 years old to join Gen-Z Hub.', field: 'dob' });

  if (db.prepare('SELECT 1 FROM users WHERE username=?').get(username)) return res.status(409).json({ error: 'Username already taken.', field: 'username' });
  if (db.prepare('SELECT 1 FROM users WHERE email=?').get(email)) return res.status(409).json({ error: 'An account with this email already exists.', field: 'email' });

  const hash = bcrypt.hashSync(password, 12);
  const info = db.prepare(`INSERT INTO users (username,email,password_hash,full_name,dob,created_at,last_seen) VALUES (?,?,?,?,?,?,?)`)
    .run(username, email, hash, full_name, dob, U.now(), U.now());
  U.createSession(info.lastInsertRowid, res, true);
  const user = db.prepare('SELECT * FROM users WHERE id=?').get(info.lastInsertRowid);
  res.json({ user: me(user) });
}));

r.post('/login', U.rateLimit({ max: 15, windowMs: 10 * 60 * 1000, key: 'login' }), U.wrap((req, res) => {
  const id = U.sanitizeText(req.body.identifier, 120).toLowerCase();
  const password = req.body.password || '';
  const remember = !!req.body.remember;
  const user = db.prepare('SELECT * FROM users WHERE email=? OR username=?').get(id, id);
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'Incorrect username/email or password.' });
  }
  if (user.status !== 'active') return res.status(403).json({ error: `This account is ${user.status || 'restricted'}.` });
  U.createSession(user.id, res, remember);
  res.json({ user: me(user) });
}));

r.post('/logout', U.wrap((req, res) => {
  const t = req.cookies && req.cookies.gz_session;
  if (t) db.prepare('DELETE FROM sessions WHERE token=?').run(t);
  res.clearCookie('gz_session', { path: '/' });
  res.json({ ok: true });
}));

r.post('/forgot', U.rateLimit({ max: 8, windowMs: 10 * 60 * 1000, key: 'forgot' }), U.wrap((req, res) => {
  const email = U.sanitizeText(req.body.email, 120).toLowerCase();
  const user = db.prepare('SELECT * FROM users WHERE email=?').get(email);
  const resp = { ok: true, message: 'If an account exists for that email, a reset link has been generated.' };
  if (!user) return res.json(resp);
  const t = U.token();
  db.prepare('UPDATE users SET reset_token=?, reset_expires=? WHERE id=?').run(t, U.now() + 3600e3, user.id);
  // No mail server in this environment: the token is surfaced for the demo flow only.
  resp.dev_token = t;
  res.json(resp);
}));

r.post('/reset', U.rateLimit({ max: 10, windowMs: 10 * 60 * 1000, key: 'reset' }), U.wrap((req, res) => {
  const t = U.sanitizeText(req.body.token, 200);
  const pw = req.body.password || '';
  const pi = passwordIssue(pw);
  if (pi) return res.status(400).json({ error: pi });
  const user = db.prepare('SELECT * FROM users WHERE reset_token=? AND reset_expires>?').get(t, U.now());
  if (!user) return res.status(400).json({ error: 'This reset link is invalid or has expired.' });
  db.prepare('UPDATE users SET password_hash=?, reset_token=NULL, reset_expires=NULL WHERE id=?').run(bcrypt.hashSync(pw, 12), user.id);
  db.prepare('DELETE FROM sessions WHERE user_id=?').run(user.id);
  res.json({ ok: true });
}));

r.post('/change-password', U.requireAuth, U.wrap((req, res) => {
  const cur = req.body.current || '';
  const next = req.body.next || '';
  const user = db.prepare('SELECT * FROM users WHERE id=?').get(req.user.id);
  if (!bcrypt.compareSync(cur, user.password_hash)) return res.status(400).json({ error: 'Current password is incorrect.' });
  const pi = passwordIssue(next);
  if (pi) return res.status(400).json({ error: pi });
  db.prepare('UPDATE users SET password_hash=? WHERE id=?').run(bcrypt.hashSync(next, 12), user.id);
  const keep = req.cookies.gz_session;
  db.prepare('DELETE FROM sessions WHERE user_id=? AND token<>?').run(user.id, keep);
  res.json({ ok: true });
}));

function me(u) {
  const interests = db.prepare('SELECT i.id,i.name,i.category FROM user_interests ui JOIN interests i ON i.id=ui.interest_id WHERE ui.user_id=?').all(u.id);
  let prefs = {}; try { prefs = JSON.parse(u.notif_prefs || '{}'); } catch (e) {}
  return {
    id: u.id, username: u.username, email: u.email, full_name: u.full_name, avatar: u.avatar, cover: u.cover,
    bio: u.bio, location: u.location, role: u.role, staff_role: RBAC.staffRole(u), is_staff: RBAC.isStaff(u),
    permissions: RBAC.permissionsFor(u.id), status: u.status, onboarded: !!u.onboarded,
    in_business: !!u.in_business, in_gaming: !!u.in_gaming, business_role: u.business_role,
    fav_games: u.fav_games, platform: u.platform, gamer_tag: u.gamer_tag,
    theme: u.theme, lang: u.lang, profile_visibility: u.profile_visibility,
    default_post_privacy: u.default_post_privacy, notif_prefs: prefs,
    created_at: u.created_at, interests,
  };
}

r.get('/me', U.wrap((req, res) => {
  if (!req.user) return res.json({ user: null });
  res.json({ user: me(req.user) });
}));

module.exports = { router: r, me };
