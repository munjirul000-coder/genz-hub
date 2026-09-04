'use strict';
/* Gen-Z Hub — dedicated Shorts candidate feed. */
const express = require('express');
const U = require('../util');
const F = require('../feed');
const R = require('../recommendations');

const r = express.Router();
r.get('/feed', U.requireAuth, U.wrap((req, res) => {
  const scope = ['for-you', 'following'].includes(req.query.scope) ? req.query.scope : 'for-you';
  const me = req.user.id;
  try {
    return res.json(R.shortsFeed({ me, scope, limit: Math.min(Number(req.query.limit) || 6, 12), cursor: req.query.cursor }));
  } catch (e) {
    console.error('[shorts] recommendation fallback:', e.message);
    const where = ["EXISTS (SELECT 1 FROM post_media pm WHERE pm.post_id=p.id AND pm.type='video')", 'p.group_id IS NULL'];
    if (scope === 'following') where.push('(p.user_id=@me OR EXISTS (SELECT 1 FROM follows f WHERE f.follower_id=@me AND f.following_id=p.user_id))');
    const out = F.queryPosts({ me, where, limit: Math.min(Number(req.query.limit) || 6, 12), cursor: req.query.cursor, order: 'p.created_at DESC,p.id DESC' });
    res.json({ ...out, shorts: true, personalized: false, recommendationFallback: true });
  }
}));
module.exports = r;
