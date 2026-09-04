'use strict';
const crypto = require('crypto');
const { db } = require('./db');
const RBAC = require('./rbac');

const now = () => Date.now();

function escapeHtml(s = '') {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function sanitizeText(s, max = 5000) {
  if (typeof s !== 'string') return '';
  return s.replace(/\u0000/g, '').trim().slice(0, max);
}

const token = () => crypto.randomBytes(32).toString('hex');

class HttpError extends Error {
  constructor(status, message, code) { super(message); this.status = status; this.code = code; }
}
const bad = (msg) => { throw new HttpError(400, msg); };

function wrap(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

// ---- rate limiting (in-memory sliding window) ----
const buckets = new Map();
// Automated test runs hammer the same endpoints from one IP; DISABLE_RATE_LIMIT=1 is a local /
// CI-only escape hatch and is never set in production.
const RATE_LIMIT_OFF = process.env.DISABLE_RATE_LIMIT === '1' && process.env.NODE_ENV !== 'production';

function rateLimit({ windowMs = 60000, max = 60, key = 'g' } = {}) {
  return (req, res, next) => {
    if (RATE_LIMIT_OFF) return next();
    const id = `${key}:${req.ip}:${req.user ? req.user.id : ''}`;
    const t = now();
    let arr = buckets.get(id) || [];
    arr = arr.filter((x) => t - x < windowMs);
    if (arr.length >= max) return res.status(429).json({ error: 'Too many requests. Please slow down.' });
    arr.push(t);
    buckets.set(id, arr);
    next();
  };
}

// ---- auth ----
const SESSION_MS = 1000 * 60 * 60 * 24 * 30;

function createSession(userId, res, remember = true) {
  const t = token();
  const exp = now() + (remember ? SESSION_MS : 1000 * 60 * 60 * 12);
  db.prepare('INSERT INTO sessions (token,user_id,created_at,expires_at,last_activity) VALUES (?,?,?,?,?)').run(t, userId, now(), exp, now());
  res.cookie('gz_session', t, {
    httpOnly: true, sameSite: 'lax', path: '/',
    maxAge: remember ? SESSION_MS : undefined,
    secure: process.env.NODE_ENV === 'production',
  });
  return t;
}

function loadUser(req, res, next) {
  const t = req.cookies && req.cookies.gz_session;
  req.user = null;
  if (t) {
    const row = db.prepare(`SELECT s.last_activity,s.created_at AS session_created_at,u.* FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token=? AND s.expires_at>?`).get(t, now());
    if (row) {
      const staffIdle = RBAC.isStaff(row) && (now() - (row.last_activity || row.session_created_at) > 2 * 3600e3);
      if (staffIdle) {
        db.prepare('DELETE FROM sessions WHERE token=?').run(t);
        return next();
      }
      if (row.status !== 'active') {
        req.user = null;
        req.suspended = true;
        req.accountStatus = row.status;
      } else {
        req.user = row;
        db.prepare('UPDATE users SET last_seen=? WHERE id=?').run(now(), row.id);
        db.prepare('UPDATE sessions SET last_activity=? WHERE token=?').run(now(), t);
      }
    }
  }
  next();
}

function requireAuth(req, res, next) {
  if (req.suspended) return res.status(403).json({ error: `Your account is ${req.accountStatus || 'restricted'}.` });
  if (!req.user) return res.status(401).json({ error: 'You must be signed in.' });
  next();
}
function requirePostingAccess(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'You must be signed in.' });
  if (req.user.moderation_until && req.user.moderation_until > now()) {
    return res.status(403).json({ error: `Posting is restricted until ${new Date(req.user.moderation_until).toISOString()}.` });
  }
  next();
}
function requireAdmin(req, res, next) { return RBAC.requireStaff(req, res, next); }
function requireStaff(req, res, next) { return RBAC.requireStaff(req, res, next); }
function requireSuperAdmin(req, res, next) { return RBAC.requireSuperAdmin(req, res, next); }
const requirePermission = (permission) => RBAC.requirePermission(permission);
const requireAnyPermission = (permissions) => RBAC.requireAnyPermission(permissions);

// CSRF: double-submit style — require custom header on mutating requests
function csrfGuard(req, res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  if (req.get('X-GenZ-Client') !== '1') return res.status(403).json({ error: 'Invalid request origin.' });
  next();
}

function publicUser(u, viewerId) {
  if (!u) return null;
  return {
    id: u.id, username: u.username, full_name: u.full_name, avatar: u.avatar, cover: u.cover,
    bio: u.bio, location: u.location, role: u.role, status: u.status,
    in_business: !!u.in_business, in_gaming: !!u.in_gaming,
    business_role: u.business_role, fav_games: u.fav_games, platform: u.platform, gamer_tag: u.gamer_tag,
    created_at: u.created_at, last_seen: u.last_seen,
    is_self: viewerId === u.id,
  };
}

function isBlocked(a, b) {
  return !!db.prepare('SELECT 1 FROM blocks WHERE (blocker_id=? AND blocked_id=?) OR (blocker_id=? AND blocked_id=?)').get(a, b, b, a);
}

function areConnected(a, b) {
  if (a === b) return true;
  return !!db.prepare(`SELECT 1 FROM connections WHERE status='accepted' AND ((requester_id=? AND addressee_id=?) OR (requester_id=? AND addressee_id=?))`).get(a, b, b, a);
}

function notify({ userId, actorId, type, entityType, entityId, text, link }) {
  if (!userId || userId === actorId) return;
  const u = db.prepare('SELECT notif_prefs FROM users WHERE id=?').get(userId);
  if (u) {
    let prefs = {};
    try { prefs = JSON.parse(u.notif_prefs || '{}'); } catch (e) { prefs = {}; }
    const map = { like: 'like', comment: 'comment', reply: 'comment', message: 'message', follow: 'follow', connect: 'follow', group: 'group', community: 'group', mention: 'comment', event: 'group' };
    const k = map[type];
    if (k && prefs[k] === 0) return;
  }
  db.prepare('INSERT INTO notifications (user_id,actor_id,type,entity_type,entity_id,text,link,created_at) VALUES (?,?,?,?,?,?,?,?)')
    .run(userId, actorId || null, type, entityType || null, entityId || null, text, link || null, now());
}

function extractHashtags(text) {
  const out = new Set();
  const re = /#([\p{L}0-9_]{2,40})/gu;
  let m;
  while ((m = re.exec(text || ''))) out.add(m[1].toLowerCase());
  return [...out].slice(0, 15);
}

function linkHashtags(postId, content) {
  const tags = extractHashtags(content);
  const ins = db.prepare('INSERT OR IGNORE INTO hashtags (tag) VALUES (?)');
  const get = db.prepare('SELECT id FROM hashtags WHERE tag=?');
  const rel = db.prepare('INSERT OR IGNORE INTO post_hashtags (post_id,hashtag_id) VALUES (?,?)');
  db.prepare('DELETE FROM post_hashtags WHERE post_id=?').run(postId);
  for (const t of tags) { ins.run(t); const h = get.get(t); if (h) rel.run(postId, h.id); }
}

module.exports = {
  now, escapeHtml, sanitizeText, token, HttpError, bad, wrap, rateLimit,
  createSession, loadUser, requireAuth, requirePostingAccess, requireAdmin, requireStaff, requireSuperAdmin,
  requirePermission, requireAnyPermission, isStaff: RBAC.isStaff, staffRole: RBAC.staffRole, hasPermission: RBAC.hasPermission, csrfGuard,
  publicUser, isBlocked, areConnected, notify, linkHashtags, extractHashtags, SESSION_MS,
};
