'use strict';

// Security primitives: scrypt password hashing (no bcryptjs native dep needed),
// constant-time comparison, session + CSRF token helpers, and rate limiting.

const crypto = require('crypto');
const { db } = require('./db');
const config = require('./config');

const SCRYPT = { N: 16384, r: 8, p: 1, keylen: 64, saltBytes: 16 };

function hashPassword(password) {
  const salt = crypto.randomBytes(SCRYPT.saltBytes).toString('hex');
  const derived = crypto.scryptSync(String(password), salt, SCRYPT.keylen, {
    N: SCRYPT.N,
    r: SCRYPT.r,
    p: SCRYPT.p,
  });
  return `scrypt$${SCRYPT.N}$${SCRYPT.r}$${SCRYPT.p}$${salt}$${derived.toString('hex')}`;
}

function verifyPassword(password, stored) {
  try {
    const parts = String(stored).split('$');
    if (parts[0] !== 'scrypt' || parts.length !== 6) return false;
    const N = Number(parts[1]);
    const r = Number(parts[2]);
    const p = Number(parts[3]);
    const salt = parts[4];
    const expected = Buffer.from(parts[5], 'hex');
    const derived = crypto.scryptSync(String(password), salt, expected.length, { N, r, p });
    return crypto.timingSafeEqual(derived, expected);
  } catch {
    return false;
  }
}

function sha256(input) {
  return crypto.createHash('sha256').update(String(input)).digest('hex');
}

function randomToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString('hex');
}

// ── Sessions (httpOnly, SameSite, Secure cookie in production) ────────────────
function createSession(res, adminId) {
  const token = randomToken();
  const expiresAt = new Date(Date.now() + config.SESSION_TTL_MS).toISOString();
  db.prepare(
    'INSERT INTO sessions (token_hash, admin_id, expires_at, created_at) VALUES (?,?,?,?)'
  ).run(sha256(token), adminId, expiresAt, new Date().toISOString());
  res.cookie(config.SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.PROD,
    path: '/',
    maxAge: config.SESSION_TTL_MS,
  });
  return token;
}

function destroySession(req, res) {
  const token = req.cookies && req.cookies[config.SESSION_COOKIE];
  if (token) {
    db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(sha256(token));
    res.clearCookie(config.SESSION_COOKIE, { path: '/' });
  }
}

function getSessionAdmin(req) {
  const token = req.cookies && req.cookies[config.SESSION_COOKIE];
  if (!token) return null;
  const row = db
    .prepare(
      `SELECT a.id, a.email, a.role, s.expires_at
         FROM sessions s JOIN admin_users a ON a.id = s.admin_id
        WHERE s.token_hash = ?`
    )
    .get(sha256(token));
  if (!row) return null;
  if (new Date(row.expires_at).getTime() < Date.now()) {
    db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(sha256(token));
    return null;
  }
  return { id: row.id, email: row.email, role: row.role };
}

// ── CSRF (double-submit cookie) ──────────────────────────────────────────────
function getCsrfToken(req, res) {
  let token = req.cookies && req.cookies[config.CSRF_COOKIE];
  if (!token || token.length !== 64) {
    token = randomToken();
    res.cookie(config.CSRF_COOKIE, token, {
      httpOnly: false, // the frontend must be able to read it to echo it back
      sameSite: 'lax',
      secure: config.PROD,
      path: '/',
      maxAge: config.SESSION_TTL_MS,
    });
  }
  return token;
}

function csrfProtection(req, res, next) {
  // State-changing methods must carry a valid CSRF token. The raw token is in a
  // non-httpOnly cookie; the request must echo it in the X-CSRF-Token header
  // (which a cross-origin attacker cannot read or set).
  const method = (req.method || '').toUpperCase();
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) return next();
  const cookieToken = req.cookies && req.cookies[config.CSRF_COOKIE];
  const headerToken = req.get('x-csrf-token') || req.body?._csrf;
  if (!cookieToken || !headerToken) {
    return res.status(403).json({ error: 'Missing CSRF token. Refresh the page and try again.' });
  }
  const a = Buffer.from(String(cookieToken));
  const b = Buffer.from(String(headerToken));
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return res.status(403).json({ error: 'Invalid CSRF token. Refresh the page and try again.' });
  }
  next();
}

// ── Rate limiting (in-memory sliding window; no IP stored on disk) ────────────
const buckets = new Map();
function rateLimit({ name = 'default', max = 30, windowMs = 60_000 } = {}) {
  return function rateLimiter(req, res, next) {
    // Key by IP, but we never persist it anywhere.
    const ip = req.ip || 'unknown';
    const key = `${name}:${ip}`;
    const now = Date.now();
    const entry = buckets.get(key);
    if (!entry || now - entry.start > windowMs) {
      buckets.set(key, { start: now, count: 1 });
      return next();
    }
    entry.count += 1;
    if (entry.count > max) {
      const retry = Math.ceil((entry.start + windowMs - now) / 1000);
      res.set('Retry-After', String(retry));
      return res.status(429).json({
        error: `Too many requests. Please wait ${retry}s and try again.`,
      });
    }
    return next();
  };
}

// Periodic cleanup so the in-memory buckets don't grow unbounded.
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of buckets) {
    if (now - entry.start > 60 * 60 * 1000) buckets.delete(key);
  }
}, 60 * 60 * 1000).unref();

// Clean up expired sessions periodically.
setInterval(() => {
  try {
    db.prepare('DELETE FROM sessions WHERE expires_at < ?').run(new Date().toISOString());
  } catch {
    /* ignore */
  }
}, 60 * 60 * 1000).unref();

module.exports = {
  hashPassword,
  verifyPassword,
  sha256,
  randomToken,
  createSession,
  destroySession,
  getSessionAdmin,
  getCsrfToken,
  csrfProtection,
  rateLimit,
};
