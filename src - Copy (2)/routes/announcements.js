'use strict';
const express = require('express');
const { db } = require('../db');
const U = require('../util');
const r = express.Router();

r.get('/', U.wrap((req, res) => {
  const now = U.now();
  const rows = db.prepare(`SELECT id,title,body,audience,starts_at,ends_at,created_at FROM announcements
    WHERE status='published' AND (starts_at IS NULL OR starts_at<=?) AND (ends_at IS NULL OR ends_at>?)
    AND audience='all' ORDER BY created_at DESC LIMIT 20`).all(now, now);
  res.json({ announcements: rows });
}));
module.exports = r;
