'use strict';
const express = require('express');
const { db } = require('../db');
const U = require('../util');
const R = require('../recommendations');

const r = express.Router();
r.use(U.requireAuth);

const cleanEvent = (event) => ({
  action: typeof event.action === 'string' ? event.action : '',
  postId: event.post_id ? Number(event.post_id) : null,
  targetId: event.target_id ? Number(event.target_id) : null,
  category: typeof event.category === 'string' && R.CATEGORIES.includes(event.category) ? event.category : null,
  value: Number.isFinite(Number(event.value)) ? Number(event.value) : 1,
  metadata: event.metadata && typeof event.metadata === 'object' ? event.metadata : {},
});

/* One small batch endpoint keeps video/feed telemetry cheap on Render Free. */
r.post('/activity', U.rateLimit({ max: 120, windowMs: 60 * 1000, key: 'rec-activity' }), U.wrap((req, res) => {
  const events = Array.isArray(req.body && req.body.events) ? req.body.events.slice(0, 25) : [req.body || {}];
  // A request may batch many events, so enforce a second event budget in addition to the
  // route rate limiter. Normal scrolling/player usage stays far below this; tight fake loops do not.
  const recent = db.prepare("SELECT COUNT(*) c FROM user_activity WHERE user_id=? AND created_at>? AND metadata LIKE '%\"source\":\"client\"%'")
    .get(req.user.id, U.now() - 60000).c;
  let budget = Math.max(0, 120 - recent);
  let accepted = 0;
  for (const event of events) {
    if (!budget) break;
    const e = cleanEvent(event);
    if (!R.CLIENT_ACTIONS.has(e.action)) continue;
    e.metadata = Object.assign({}, e.metadata, { source: 'client' });
    const out = R.recordActivity({ userId: req.user.id, ...e });
    if (out.ok) { accepted++; budget--; }
  }
  res.json({ ok: true, accepted });
}));

r.get('/interests', U.wrap((req, res) => {
  const scores = R.interestScores(req.user.id);
  res.json({ interests: Object.values(scores).sort((a, b) => b.score - a.score).map((x) => ({
    ...x, score: Math.round(x.score * 10) / 10,
  })) });
}));

r.post('/feedback', U.rateLimit({ max: 60, windowMs: 10 * 60 * 1000, key: 'rec-feedback' }), U.wrap((req, res) => {
  const postId = Number(req.body && req.body.post_id);
  const kind = typeof (req.body && req.body.kind) === 'string' ? req.body.kind : '';
  // Hide is an authoritative user action; fast skips are accepted only from the
  // bounded client telemetry endpoint above, not as an unlimited score-writing API.
  if (!postId || kind !== 'hide') return res.status(400).json({ error: 'Invalid recommendation feedback.' });
  res.json(R.feedback(req.user.id, postId, kind));
}));

r.post('/reset', U.wrap((req, res) => {
  res.json(R.reset(req.user.id));
}));

module.exports = r;
