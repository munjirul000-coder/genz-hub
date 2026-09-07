'use strict';

// Admin authentication routes + auth guards.
//
// Security model:
//   • Passwords are hashed with scrypt (never stored in the DB or frontend).
//   • On login, a random session token is issued; only its SHA-256 hash is
//     stored server-side, and the raw token is set in an httpOnly cookie.
//   • Every /api/admin/* route is protected by `requireAdmin` (server-side).
//   • Login is rate-limited to slow down credential guessing.

const express = require('express');
const security = require('../security');
const config = require('../config');

const router = express.Router();

// Server-side authorization guard for the entire admin API surface.
function requireAdmin(req, res, next) {
  const admin = security.getSessionAdmin(req);
  if (!admin) return res.status(401).json({ error: 'Not authenticated.' });
  req.admin = admin;
  next();
}

// The session is returned for the admin SPA to know it is authenticated.
router.get('/session', (req, res) => {
  const admin = security.getSessionAdmin(req);
  if (!admin) return res.json({ authenticated: false });
  res.json({ authenticated: true, email: admin.email, role: admin.role });
});

// Provides the CSRF token the SPA echoes on state-changing requests.
router.get('/csrf', (req, res) => {
  res.json({ csrfToken: security.getCsrfToken(req, res) });
});

router.post(
  '/login',
  security.rateLimit({ name: 'admin-login', max: 8, windowMs: 5 * 60_000 }),
  (req, res) => {
    const email = String(req.body && req.body.email ? req.body.email : '').trim().toLowerCase();
    const password = String(req.body && req.body.password ? req.body.password : '');

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const { db } = require('../db');
    const user = db.prepare('SELECT * FROM admin_users WHERE email = ?').get(email);

    // Always run the comparison so timing is similar whether or not the user exists.
    const hash = user ? user.password_hash : security.hashPassword('dummy-password-for-timing');
    const ok = user ? security.verifyPassword(password, user.password_hash) : false;
    security.verifyPassword(password, hash); // burn similar CPU on the dummy path

    if (!user || !ok) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    security.createSession(res, user.id);
    res.json({ ok: true, email: user.email });
  }
);

router.post('/logout', (req, res) => {
  security.destroySession(req, res);
  res.json({ ok: true });
});

// Boot-time admin provisioning helper (also exported for tests).
function ensureAdminUser(db) {
  if (!config.ADMIN_EMAIL || !config.ADMIN_PASSWORD) return null;
  const existing = db.prepare('SELECT id FROM admin_users WHERE email = ?').get(config.ADMIN_EMAIL);
  if (existing) return null;
  const info = db
    .prepare('INSERT INTO admin_users (email, password_hash, role, created_at) VALUES (?,?,?,?)')
    .run(config.ADMIN_EMAIL, security.hashPassword(config.ADMIN_PASSWORD), 'admin', new Date().toISOString());
  return { id: Number(info.lastInsertRowid), email: config.ADMIN_EMAIL };
}

module.exports = { router, requireAdmin, ensureAdminUser };
