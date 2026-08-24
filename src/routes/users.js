'use strict';
const express = require('express');
const { db } = require('../db');
const U = require('../util');
const XP = require('../gamify');
const F = require('../feed');

const r = express.Router();

function profileOf(username, me) {
  const u = db.prepare('SELECT * FROM users WHERE username=?').get(username);
  if (!u) return null;
  const p = U.publicUser(u, me);
  p.interests = db.prepare('SELECT i.name,i.category FROM user_interests ui JOIN interests i ON i.id=ui.interest_id WHERE ui.user_id=?').all(u.id);
  p.counts = {
    posts: db.prepare('SELECT COUNT(*) n FROM posts WHERE user_id=? AND removed=0').get(u.id).n,
    followers: db.prepare('SELECT COUNT(*) n FROM follows WHERE following_id=?').get(u.id).n,
    following: db.prepare('SELECT COUNT(*) n FROM follows WHERE follower_id=?').get(u.id).n,
    connections: db.prepare(`SELECT COUNT(*) n FROM connections WHERE status='accepted' AND (requester_id=? OR addressee_id=?)`).get(u.id, u.id).n,
    groups: db.prepare(`SELECT COUNT(*) n FROM group_members WHERE user_id=? AND status='active'`).get(u.id).n,
    communities: db.prepare('SELECT COUNT(*) n FROM community_members WHERE user_id=?').get(u.id).n,
  };
  p.i_follow = me ? !!db.prepare('SELECT 1 FROM follows WHERE follower_id=? AND following_id=?').get(me, u.id) : false;
  p.follows_me = me ? !!db.prepare('SELECT 1 FROM follows WHERE follower_id=? AND following_id=?').get(u.id, me) : false;
  p.blocked_by_me = me ? !!db.prepare('SELECT 1 FROM blocks WHERE blocker_id=? AND blocked_id=?').get(me, u.id) : false;
  const conn = me ? db.prepare('SELECT * FROM connections WHERE (requester_id=? AND addressee_id=?) OR (requester_id=? AND addressee_id=?)').get(me, u.id, u.id, me) : null;
  p.connection = conn ? { status: conn.status, outgoing: conn.requester_id === me, id: conn.id } : null;
  p.restricted = false;
  if (u.profile_visibility === 'connections' && me !== u.id && !U.areConnected(me, u.id)) p.restricted = true;
  if (me && U.isBlocked(me, u.id) && !p.blocked_by_me) p.restricted = true;
  return p;
}

r.get('/suggestions', U.wrap((req, res) => {
  const me = req.user ? req.user.id : 0;
  const hub = req.query.hub;
  let sql = `SELECT u.* FROM users u WHERE u.id<>@me AND u.status='active'
    AND NOT EXISTS (SELECT 1 FROM follows f WHERE f.follower_id=@me AND f.following_id=u.id)
    AND NOT EXISTS (SELECT 1 FROM blocks b WHERE (b.blocker_id=@me AND b.blocked_id=u.id) OR (b.blocker_id=u.id AND b.blocked_id=@me))`;
  if (hub === 'business') sql += ' AND u.in_business=1';
  if (hub === 'gaming') sql += ' AND u.in_gaming=1';
  sql += ` ORDER BY (SELECT COUNT(*) FROM user_interests ui WHERE ui.user_id=u.id AND ui.interest_id IN
      (SELECT interest_id FROM user_interests WHERE user_id=@me)) DESC, u.created_at DESC LIMIT @limit`;
  const rows = db.prepare(sql).all({ me, limit: Math.min(Number(req.query.limit) || 6, 20) });
  res.json({ users: rows.map((u) => ({ ...U.publicUser(u, me), interests: db.prepare('SELECT i.name FROM user_interests ui JOIN interests i ON i.id=ui.interest_id WHERE ui.user_id=? LIMIT 3').all(u.id).map((x) => x.name) })) });
}));

r.get('/:username', U.wrap((req, res) => {
  const me = req.user ? req.user.id : 0;
  const p = profileOf(req.params.username, me);
  if (!p) return res.status(404).json({ error: 'User not found.' });
  res.json({ profile: p });
}));

r.get('/:username/posts', U.wrap((req, res) => {
  const me = req.user ? req.user.id : 0;
  const u = db.prepare('SELECT * FROM users WHERE username=?').get(req.params.username);
  if (!u) return res.status(404).json({ error: 'User not found.' });
  if (u.profile_visibility === 'connections' && me !== u.id && !U.areConnected(me, u.id)) return res.json({ posts: [], nextCursor: null, restricted: true });
  const where = ['p.user_id=@uid'];
  const params = { uid: u.id };
  if (req.query.media === '1') where.push('EXISTS (SELECT 1 FROM post_media pm WHERE pm.post_id=p.id)');
  const out = F.queryPosts({ me, where, params, limit: 10, cursor: req.query.cursor });
  res.json(out);
}));

r.get('/:username/groups', U.wrap((req, res) => {
  const u = db.prepare('SELECT id FROM users WHERE username=?').get(req.params.username);
  if (!u) return res.status(404).json({ error: 'User not found.' });
  const groups = db.prepare(`SELECT g.*, gm.role FROM group_members gm JOIN groups g ON g.id=gm.group_id WHERE gm.user_id=? AND gm.status='active'`).all(u.id);
  const communities = db.prepare(`SELECT c.*, cmm.role FROM community_members cmm JOIN communities c ON c.id=cmm.community_id WHERE cmm.user_id=?`).all(u.id);
  res.json({ groups, communities });
}));

r.get('/:username/follows/:type', U.wrap((req, res) => {
  const me = req.user ? req.user.id : 0;
  const u = db.prepare('SELECT id FROM users WHERE username=?').get(req.params.username);
  if (!u) return res.status(404).json({ error: 'User not found.' });
  const sql = req.params.type === 'followers'
    ? 'SELECT us.* FROM follows f JOIN users us ON us.id=f.follower_id WHERE f.following_id=? ORDER BY f.created_at DESC LIMIT 100'
    : 'SELECT us.* FROM follows f JOIN users us ON us.id=f.following_id WHERE f.follower_id=? ORDER BY f.created_at DESC LIMIT 100';
  res.json({ users: db.prepare(sql).all(u.id).map((x) => U.publicUser(x, me)) });
}));

// ---- follow ----
r.post('/:id/follow', U.requireAuth, U.wrap((req, res) => {
  const target = db.prepare('SELECT * FROM users WHERE id=?').get(req.params.id);
  if (!target) return res.status(404).json({ error: 'User not found.' });
  if (target.id === req.user.id) return res.status(400).json({ error: 'You cannot follow yourself.' });
  if (U.isBlocked(req.user.id, target.id)) return res.status(403).json({ error: 'Interaction is blocked between these accounts.' });
  const ex = db.prepare('SELECT 1 FROM follows WHERE follower_id=? AND following_id=?').get(req.user.id, target.id);
  if (ex) { db.prepare('DELETE FROM follows WHERE follower_id=? AND following_id=?').run(req.user.id, target.id); return res.json({ following: false }); }
  db.prepare('INSERT INTO follows (follower_id,following_id,created_at) VALUES (?,?,?)').run(req.user.id, target.id, U.now());
  U.notify({ userId: target.id, actorId: req.user.id, type: 'follow', entityType: 'user', entityId: req.user.id, text: `${req.user.full_name} started following you`, link: `#/u/${req.user.username}` });
  XP.award(target.id, 'follow_received', { refType: 'user', refId: req.user.id });
  res.json({ following: true });
}));

// ---- connections ----
r.post('/:id/connect', U.requireAuth, U.wrap((req, res) => {
  const target = db.prepare('SELECT * FROM users WHERE id=?').get(req.params.id);
  if (!target || target.id === req.user.id) return res.status(400).json({ error: 'Invalid user.' });
  if (U.isBlocked(req.user.id, target.id)) return res.status(403).json({ error: 'Interaction is blocked between these accounts.' });
  const ex = db.prepare('SELECT * FROM connections WHERE (requester_id=? AND addressee_id=?) OR (requester_id=? AND addressee_id=?)').get(req.user.id, target.id, target.id, req.user.id);
  if (ex) return res.status(409).json({ error: ex.status === 'accepted' ? 'You are already connected.' : 'A request is already pending.' });
  db.prepare(`INSERT INTO connections (requester_id,addressee_id,status,created_at) VALUES (?,?, 'pending', ?)`).run(req.user.id, target.id, U.now());
  U.notify({ userId: target.id, actorId: req.user.id, type: 'connect', entityType: 'user', entityId: req.user.id, text: `${req.user.full_name} sent you a connection request`, link: `#/network` });
  res.json({ ok: true, status: 'pending' });
}));

r.post('/connections/:id/respond', U.requireAuth, U.wrap((req, res) => {
  const c = db.prepare('SELECT * FROM connections WHERE id=?').get(req.params.id);
  if (!c) return res.status(404).json({ error: 'Request not found.' });
  const action = req.body.action;
  if (action === 'accept') {
    if (c.addressee_id !== req.user.id) return res.status(403).json({ error: 'Not allowed.' });
    db.prepare(`UPDATE connections SET status='accepted' WHERE id=?`).run(c.id);
    U.notify({ userId: c.requester_id, actorId: req.user.id, type: 'connect', entityType: 'user', entityId: req.user.id, text: `${req.user.full_name} accepted your connection request`, link: `#/u/${req.user.username}` });
    return res.json({ ok: true, status: 'accepted' });
  }
  if (c.addressee_id !== req.user.id && c.requester_id !== req.user.id) return res.status(403).json({ error: 'Not allowed.' });
  db.prepare('DELETE FROM connections WHERE id=?').run(c.id);
  res.json({ ok: true, status: 'none' });
}));

r.get('/me/connections', U.requireAuth, U.wrap((req, res) => {
  const me = req.user.id;
  const accepted = db.prepare(`SELECT c.id AS cid, u.* FROM connections c JOIN users u ON u.id = CASE WHEN c.requester_id=? THEN c.addressee_id ELSE c.requester_id END
    WHERE c.status='accepted' AND (c.requester_id=? OR c.addressee_id=?)`).all(me, me, me);
  const incoming = db.prepare(`SELECT c.id AS cid, u.* FROM connections c JOIN users u ON u.id=c.requester_id WHERE c.status='pending' AND c.addressee_id=?`).all(me);
  const outgoing = db.prepare(`SELECT c.id AS cid, u.* FROM connections c JOIN users u ON u.id=c.addressee_id WHERE c.status='pending' AND c.requester_id=?`).all(me);
  const shape = (rows) => rows.map((x) => ({ ...U.publicUser(x, me), connection_id: x.cid }));
  res.json({ connections: shape(accepted), incoming: shape(incoming), outgoing: shape(outgoing) });
}));

// ---- block ----
r.post('/:id/block', U.requireAuth, U.wrap((req, res) => {
  const target = db.prepare('SELECT * FROM users WHERE id=?').get(req.params.id);
  if (!target || target.id === req.user.id) return res.status(400).json({ error: 'Invalid user.' });
  const ex = db.prepare('SELECT 1 FROM blocks WHERE blocker_id=? AND blocked_id=?').get(req.user.id, target.id);
  if (ex) { db.prepare('DELETE FROM blocks WHERE blocker_id=? AND blocked_id=?').run(req.user.id, target.id); return res.json({ blocked: false }); }
  db.prepare('INSERT INTO blocks (blocker_id,blocked_id,created_at) VALUES (?,?,?)').run(req.user.id, target.id, U.now());
  db.prepare('DELETE FROM follows WHERE (follower_id=? AND following_id=?) OR (follower_id=? AND following_id=?)').run(req.user.id, target.id, target.id, req.user.id);
  db.prepare('DELETE FROM connections WHERE (requester_id=? AND addressee_id=?) OR (requester_id=? AND addressee_id=?)').run(req.user.id, target.id, target.id, req.user.id);
  res.json({ blocked: true });
}));

r.get('/me/blocked', U.requireAuth, U.wrap((req, res) => {
  const rows = db.prepare('SELECT u.* FROM blocks b JOIN users u ON u.id=b.blocked_id WHERE b.blocker_id=?').all(req.user.id);
  res.json({ users: rows.map((u) => U.publicUser(u, req.user.id)) });
}));

module.exports = { router: r, profileOf };
