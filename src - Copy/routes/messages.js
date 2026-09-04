'use strict';
const express = require('express');
const { db } = require('../db');
const U = require('../util');

const r = express.Router();
r.use(U.requireAuth);

function membership(convId, userId) {
  return db.prepare('SELECT * FROM conversation_members WHERE conversation_id=? AND user_id=?').get(convId, userId);
}

r.get('/', U.wrap((req, res) => {
  const me = req.user.id;
  const q = U.sanitizeText(req.query.q || '', 60).toLowerCase();
  const rows = db.prepare(`
    SELECT c.id, c.last_message_at, cm.last_read_at,
      u.id AS other_id, u.username, u.full_name, u.avatar, u.last_seen,
      (SELECT body FROM messages m WHERE m.conversation_id=c.id ORDER BY m.id DESC LIMIT 1) AS last_body,
      (SELECT media_type FROM messages m WHERE m.conversation_id=c.id ORDER BY m.id DESC LIMIT 1) AS last_media,
      (SELECT sender_id FROM messages m WHERE m.conversation_id=c.id ORDER BY m.id DESC LIMIT 1) AS last_sender,
      (SELECT COUNT(*) FROM messages m WHERE m.conversation_id=c.id AND m.created_at>cm.last_read_at AND m.sender_id<>@me) AS unread
    FROM conversations c
    JOIN conversation_members cm ON cm.conversation_id=c.id AND cm.user_id=@me AND cm.hidden=0
    JOIN conversation_members om ON om.conversation_id=c.id AND om.user_id<>@me
    JOIN users u ON u.id=om.user_id
    ORDER BY COALESCE(c.last_message_at, c.created_at) DESC LIMIT 100`).all({ me });
  const filtered = q ? rows.filter((x) => (x.full_name || '').toLowerCase().includes(q) || (x.username || '').toLowerCase().includes(q)) : rows;
  res.json({ conversations: filtered, unread_total: rows.reduce((a, b) => a + (b.unread || 0), 0) });
}));

r.post('/start', U.wrap((req, res) => {
  const other = Number(req.body.user_id);
  const target = db.prepare('SELECT * FROM users WHERE id=?').get(other);
  if (!target || target.id === req.user.id) return res.status(400).json({ error: 'Invalid user.' });
  if (U.isBlocked(req.user.id, target.id)) return res.status(403).json({ error: 'You cannot message this user.' });
  const existing = db.prepare(`SELECT c.id FROM conversations c
    JOIN conversation_members a ON a.conversation_id=c.id AND a.user_id=?
    JOIN conversation_members b ON b.conversation_id=c.id AND b.user_id=? LIMIT 1`).get(req.user.id, target.id);
  if (existing) {
    db.prepare('UPDATE conversation_members SET hidden=0 WHERE conversation_id=? AND user_id=?').run(existing.id, req.user.id);
    return res.json({ conversation_id: existing.id });
  }
  const info = db.prepare('INSERT INTO conversations (created_at) VALUES (?)').run(U.now());
  const ins = db.prepare('INSERT INTO conversation_members (conversation_id,user_id,last_read_at) VALUES (?,?,0)');
  ins.run(info.lastInsertRowid, req.user.id);
  ins.run(info.lastInsertRowid, target.id);
  res.json({ conversation_id: info.lastInsertRowid });
}));

r.get('/:id/messages', U.wrap((req, res) => {
  const id = Number(req.params.id);
  if (!membership(id, req.user.id)) return res.status(403).json({ error: 'You do not have access to this conversation.' });
  const after = Number(req.query.after || 0);
  const rows = db.prepare(`SELECT m.*, u.username, u.full_name, u.avatar FROM messages m JOIN users u ON u.id=m.sender_id
    WHERE m.conversation_id=? AND m.id>? ORDER BY m.id ASC LIMIT 200`).all(id, after);
  const other = db.prepare(`SELECT u.* FROM conversation_members cm JOIN users u ON u.id=cm.user_id WHERE cm.conversation_id=? AND cm.user_id<>?`).get(id, req.user.id);
  db.prepare('UPDATE conversation_members SET last_read_at=? WHERE conversation_id=? AND user_id=?').run(U.now(), id, req.user.id);
  const om = db.prepare('SELECT last_read_at FROM conversation_members WHERE conversation_id=? AND user_id<>?').get(id, req.user.id);
  res.json({ messages: rows, other: U.publicUser(other, req.user.id), other_last_read: om ? om.last_read_at : 0 });
}));

r.post('/:id/messages', U.rateLimit({ max: 120, windowMs: 60000, key: 'msg' }), U.wrap((req, res) => {
  const id = Number(req.params.id);
  if (!membership(id, req.user.id)) return res.status(403).json({ error: 'You do not have access to this conversation.' });
  const body = U.sanitizeText(req.body.body, 2000);
  const media_url = typeof req.body.media_url === 'string' && req.body.media_url.startsWith('/uploads/') ? req.body.media_url : null;
  const media_type = media_url ? (['image', 'video', 'file'].includes(req.body.media_type) ? req.body.media_type : 'file') : null;
  if (!body && !media_url) return res.status(400).json({ error: 'Message cannot be empty.' });
  const other = db.prepare('SELECT user_id FROM conversation_members WHERE conversation_id=? AND user_id<>?').get(id, req.user.id);
  if (other && U.isBlocked(req.user.id, other.user_id)) return res.status(403).json({ error: 'You cannot message this user.' });
  const info = db.prepare('INSERT INTO messages (conversation_id,sender_id,body,media_url,media_type,created_at) VALUES (?,?,?,?,?,?)')
    .run(id, req.user.id, body, media_url, media_type, U.now());
  db.prepare('UPDATE conversations SET last_message_at=? WHERE id=?').run(U.now(), id);
  db.prepare('UPDATE conversation_members SET hidden=0 WHERE conversation_id=?').run(id);
  if (other) U.notify({ userId: other.user_id, actorId: req.user.id, type: 'message', entityType: 'conversation', entityId: id, text: `${req.user.full_name} sent you a message`, link: `#/messages/${id}` });
  const m = db.prepare(`SELECT m.*, u.username,u.full_name,u.avatar FROM messages m JOIN users u ON u.id=m.sender_id WHERE m.id=?`).get(info.lastInsertRowid);
  res.json({ message: m });
}));

r.delete('/:id', U.wrap((req, res) => {
  const id = Number(req.params.id);
  if (!membership(id, req.user.id)) return res.status(403).json({ error: 'Not allowed.' });
  db.prepare('UPDATE conversation_members SET hidden=1, last_read_at=? WHERE conversation_id=? AND user_id=?').run(U.now(), id, req.user.id);
  res.json({ ok: true });
}));

module.exports = r;
