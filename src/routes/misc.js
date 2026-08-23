'use strict';
const express = require('express');
const { db } = require('../db');
const U = require('../util');
const F = require('../feed');

const r = express.Router();

/* ---------------- NOTIFICATIONS ---------------- */
const n = express.Router();
n.use(U.requireAuth);
n.get('/', U.wrap((req, res) => {
  const rows = db.prepare(`SELECT n.*, u.username, u.full_name, u.avatar FROM notifications n LEFT JOIN users u ON u.id=n.actor_id
    WHERE n.user_id=? ORDER BY n.created_at DESC LIMIT 60`).all(req.user.id);
  const unread = db.prepare('SELECT COUNT(*) c FROM notifications WHERE user_id=? AND is_read=0').get(req.user.id).c;
  res.json({ notifications: rows, unread });
}));
n.get('/count', U.wrap((req, res) => {
  const unread = db.prepare('SELECT COUNT(*) c FROM notifications WHERE user_id=? AND is_read=0').get(req.user.id).c;
  const msgs = db.prepare(`SELECT COUNT(*) c FROM messages m JOIN conversation_members cm ON cm.conversation_id=m.conversation_id AND cm.user_id=?
    WHERE m.sender_id<>? AND m.created_at>cm.last_read_at AND cm.hidden=0`).get(req.user.id, req.user.id).c;
  const reqs = db.prepare(`SELECT COUNT(*) c FROM connections WHERE addressee_id=? AND status='pending'`).get(req.user.id).c;
  res.json({ notifications: unread, messages: msgs, requests: reqs });
}));
n.post('/:id/read', U.wrap((req, res) => {
  db.prepare('UPDATE notifications SET is_read=1 WHERE id=? AND user_id=?').run(req.params.id, req.user.id);
  res.json({ ok: true });
}));
n.post('/read-all', U.wrap((req, res) => {
  db.prepare('UPDATE notifications SET is_read=1 WHERE user_id=?').run(req.user.id);
  res.json({ ok: true });
}));

/* ---------------- STORIES ---------------- */
const s = express.Router();
s.get('/', U.wrap((req, res) => {
  const me = req.user ? req.user.id : 0;
  db.prepare('DELETE FROM stories WHERE expires_at<?').run(U.now());
  const rows = db.prepare(`SELECT st.*, u.username,u.full_name,u.avatar,
      (SELECT 1 FROM story_views sv WHERE sv.story_id=st.id AND sv.user_id=@me) AS seen
    FROM stories st JOIN users u ON u.id=st.user_id
    WHERE st.expires_at>@now
      AND NOT EXISTS (SELECT 1 FROM blocks b WHERE (b.blocker_id=@me AND b.blocked_id=st.user_id) OR (b.blocker_id=st.user_id AND b.blocked_id=@me))
    ORDER BY st.created_at ASC`).all({ me, now: U.now() });
  const groups = [];
  const idx = {};
  rows.forEach((st) => {
    if (!idx[st.user_id]) { idx[st.user_id] = { user_id: st.user_id, username: st.username, full_name: st.full_name, avatar: st.avatar, items: [] }; groups.push(idx[st.user_id]); }
    idx[st.user_id].items.push({ id: st.id, media_url: st.media_url, media_type: st.media_type, caption: st.caption, created_at: st.created_at, seen: !!st.seen });
  });
  if (me) groups.sort((a, b) => (a.user_id === me ? -1 : b.user_id === me ? 1 : 0));
  res.json({ stories: groups });
}));
s.post('/', U.requireAuth, U.wrap((req, res) => {
  const url = req.body.media_url;
  if (typeof url !== 'string' || !url.startsWith('/uploads/')) return res.status(400).json({ error: 'A photo or video is required for a story.' });
  const type = req.body.media_type === 'video' ? 'video' : 'image';
  const caption = U.sanitizeText(req.body.caption, 200);
  const t = U.now();
  const info = db.prepare('INSERT INTO stories (user_id,media_url,media_type,caption,created_at,expires_at) VALUES (?,?,?,?,?,?)')
    .run(req.user.id, url, type, caption, t, t + 24 * 3600 * 1000);
  res.json({ id: info.lastInsertRowid });
}));
s.post('/:id/view', U.requireAuth, U.wrap((req, res) => {
  db.prepare('INSERT OR IGNORE INTO story_views (story_id,user_id,created_at) VALUES (?,?,?)').run(req.params.id, req.user.id, U.now());
  res.json({ ok: true });
}));
s.get('/:id/viewers', U.requireAuth, U.wrap((req, res) => {
  const st = db.prepare('SELECT * FROM stories WHERE id=?').get(req.params.id);
  if (!st) return res.status(404).json({ error: 'Story not found.' });
  if (st.user_id !== req.user.id) return res.status(403).json({ error: 'Only the story owner can see viewers.' });
  const rows = db.prepare('SELECT u.id,u.username,u.full_name,u.avatar FROM story_views sv JOIN users u ON u.id=sv.user_id WHERE sv.story_id=?').all(st.id);
  res.json({ viewers: rows });
}));
s.delete('/:id', U.requireAuth, U.wrap((req, res) => {
  const st = db.prepare('SELECT * FROM stories WHERE id=?').get(req.params.id);
  if (!st) return res.status(404).json({ error: 'Story not found.' });
  if (st.user_id !== req.user.id && req.user.role !== 'admin') return res.status(403).json({ error: 'Not allowed.' });
  db.prepare('DELETE FROM stories WHERE id=?').run(st.id);
  res.json({ ok: true });
}));

/* ---------------- SEARCH ---------------- */
const q = express.Router();
q.get('/', U.wrap((req, res) => {
  const me = req.user ? req.user.id : 0;
  const term = U.sanitizeText(req.query.q || '', 60);
  const type = req.query.type || 'all';
  const like = '%' + term.replace(/[\\%_]/g, (c) => '\\' + c) + '%';
  const out = {};
  if (!term) return res.json({ users: [], posts: [], groups: [], communities: [], hashtags: [] });
  if (type === 'all' || type === 'people') {
    out.users = db.prepare(`SELECT * FROM users WHERE status='active' AND (full_name LIKE ? ESCAPE '\\' OR username LIKE ? ESCAPE '\\' OR bio LIKE ? ESCAPE '\\')
      AND NOT EXISTS (SELECT 1 FROM blocks b WHERE (b.blocker_id=? AND b.blocked_id=users.id) OR (b.blocker_id=users.id AND b.blocked_id=?)) LIMIT 20`)
      .all(like, like, like, me, me).map((u) => U.publicUser(u, me));
  }
  if (type === 'all' || type === 'posts') {
    out.posts = F.queryPosts({ me, where: ["p.content LIKE @like ESCAPE '\\'"], params: { like }, limit: 12 }).posts;
  }
  if (type === 'all' || type === 'groups') {
    out.groups = db.prepare(`SELECT g.*, (SELECT COUNT(*) FROM group_members gm WHERE gm.group_id=g.id AND gm.status='active') AS member_count
      FROM groups g WHERE g.name LIKE ? ESCAPE '\\' OR g.description LIKE ? ESCAPE '\\' LIMIT 20`).all(like, like);
  }
  if (type === 'all' || type === 'communities') {
    out.communities = db.prepare(`SELECT c.*, (SELECT COUNT(*) FROM community_members cm WHERE cm.community_id=c.id) AS member_count
      FROM communities c WHERE c.name LIKE ? ESCAPE '\\' OR c.description LIKE ? ESCAPE '\\' LIMIT 20`).all(like, like);
  }
  if (type === 'all' || type === 'hashtags') {
    out.hashtags = db.prepare(`SELECT h.tag, COUNT(*) n FROM hashtags h JOIN post_hashtags ph ON ph.hashtag_id=h.id
      WHERE h.tag LIKE ? ESCAPE '\\' GROUP BY h.tag ORDER BY n DESC LIMIT 20`).all(like.replace(/#/g, ''));
  }
  res.json({ users: [], posts: [], groups: [], communities: [], hashtags: [], ...out });
}));

/* ---------------- REPORTS ---------------- */
const rep = express.Router();
rep.use(U.requireAuth);
rep.post('/', U.rateLimit({ max: 20, windowMs: 10 * 60 * 1000, key: 'report' }), U.wrap((req, res) => {
  const types = ['post', 'comment', 'user', 'group', 'community'];
  const target_type = types.includes(req.body.target_type) ? req.body.target_type : null;
  const target_id = Number(req.body.target_id);
  const reasons = ['Spam', 'Harassment', 'Impersonation', 'Inappropriate content', 'Other'];
  const reason = reasons.includes(req.body.reason) ? req.body.reason : null;
  if (!target_type || !target_id || !reason) return res.status(400).json({ error: 'Please choose what you are reporting and why.' });
  const details = U.sanitizeText(req.body.details, 600);
  db.prepare('INSERT INTO reports (reporter_id,target_type,target_id,reason,details,created_at) VALUES (?,?,?,?,?,?)')
    .run(req.user.id, target_type, target_id, reason, details, U.now());
  res.json({ ok: true });
}));

module.exports = { notifications: n, stories: s, search: q, reports: rep };
