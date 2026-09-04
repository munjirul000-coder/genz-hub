'use strict';
const express = require('express');
const bcrypt = require('bcryptjs');
const { db } = require('../db');
const U = require('../util');
const RBAC = require('../rbac');

const r = express.Router();
r.post('/login', U.rateLimit({ max: 15, windowMs: 10 * 60 * 1000, key: 'admin-login' }), U.wrap((req, res) => {
  const identifier = U.sanitizeText(req.body.identifier, 120).toLowerCase();
  const password = req.body.password || '';
  const user = db.prepare('SELECT * FROM users WHERE email=? OR username=?').get(identifier, identifier);
  if (!user || !bcrypt.compareSync(password, user.password_hash)) return res.status(401).json({ error: 'Incorrect staff username/email or password.' });
  if (user.status !== 'active') return res.status(403).json({ error: `This account is ${user.status || 'restricted'}.` });
  if (!RBAC.isStaff(user)) return res.status(403).json({ error: 'This account does not have staff access.' });
  U.createSession(user.id, res, true);
  RBAC.audit({ user, ip: req.ip, headers: req.headers, get: (x) => req.get(x) }, { action: 'staff.login', targetType: 'user', targetId: user.id, detail: RBAC.staffRole(user) });
  res.json({ user: require('./auth').me(user) });
}));
r.get('/me', U.requireStaff, U.wrap((req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id=?').get(req.user.id);
  res.json({ user: require('./auth').me(user), role: RBAC.staffRole(user), permissions: RBAC.permissionsFor(user.id) });
}));
module.exports = r;
