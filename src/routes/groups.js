'use strict';
const express = require('express');
const { db } = require('../db');
const U = require('../util');
const XP = require('../gamify');
const F = require('../feed');

/* ================= GROUPS ================= */
const g = express.Router();

function groupRow(id, me) {
  const row = db.prepare(`SELECT g.*, u.username AS owner_username, u.full_name AS owner_name,
    (SELECT COUNT(*) FROM group_members gm WHERE gm.group_id=g.id AND gm.status='active') AS member_count
    FROM groups g JOIN users u ON u.id=g.owner_id WHERE g.id=?`).get(id);
  if (!row) return null;
  const m = me ? db.prepare('SELECT * FROM group_members WHERE group_id=? AND user_id=?').get(id, me) : null;
  row.my_role = m && m.status === 'active' ? m.role : null;
  row.my_status = m ? m.status : null;
  return row;
}
const canManage = (row) => row && ['owner', 'admin', 'moderator'].includes(row.my_role);

g.get('/', U.wrap((req, res) => {
  const me = req.user ? req.user.id : 0;
  const mine = req.query.mine === '1';
  const hub = req.query.hub;
  let sql = `SELECT g.*, (SELECT COUNT(*) FROM group_members gm WHERE gm.group_id=g.id AND gm.status='active') AS member_count,
    (SELECT gm.role FROM group_members gm WHERE gm.group_id=g.id AND gm.user_id=@me AND gm.status='active') AS my_role
    FROM groups g WHERE 1=1`;
  if (mine) sql += ` AND EXISTS (SELECT 1 FROM group_members gm WHERE gm.group_id=g.id AND gm.user_id=@me AND gm.status='active')`;
  if (['general', 'business', 'gaming'].includes(hub)) sql += ' AND g.hub=@hub';
  if (req.query.q) sql += ' AND g.name LIKE @like';
  sql += ' ORDER BY member_count DESC, g.created_at DESC LIMIT 50';
  res.json({ groups: db.prepare(sql).all({ me, hub: hub || '', like: `%${U.sanitizeText(req.query.q || '', 50)}%` }) });
}));

g.post('/', U.requireAuth, U.rateLimit({ max: 10, windowMs: 3600e3, key: 'newgroup' }), U.wrap((req, res) => {
  const name = U.sanitizeText(req.body.name, 60);
  if (name.length < 3) return res.status(400).json({ error: 'Group name must be at least 3 characters.' });
  const privacy = ['public', 'private'].includes(req.body.privacy) ? req.body.privacy : 'public';
  const hub = ['general', 'business', 'gaming'].includes(req.body.hub) ? req.body.hub : 'general';
  const cover = typeof req.body.cover === 'string' && req.body.cover.startsWith('/uploads/') ? req.body.cover : null;
  const info = db.prepare(`INSERT INTO groups (name,description,category,privacy,hub,cover,rules,owner_id,created_at) VALUES (?,?,?,?,?,?,?,?,?)`)
    .run(name, U.sanitizeText(req.body.description, 800), U.sanitizeText(req.body.category, 40) || 'General', privacy, hub, cover, U.sanitizeText(req.body.rules, 1000), req.user.id, U.now());
  db.prepare(`INSERT INTO group_members (group_id,user_id,role,status,created_at) VALUES (?,?, 'owner','active',?)`).run(info.lastInsertRowid, req.user.id, U.now());
  res.json({ group: groupRow(info.lastInsertRowid, req.user.id) });
}));

g.get('/:id', U.wrap((req, res) => {
  const row = groupRow(Number(req.params.id), req.user ? req.user.id : 0);
  if (!row) return res.status(404).json({ error: 'Group not found.' });
  res.json({ group: row });
}));

g.patch('/:id', U.requireAuth, U.wrap((req, res) => {
  const row = groupRow(Number(req.params.id), req.user.id);
  if (!row) return res.status(404).json({ error: 'Group not found.' });
  if (!['owner', 'admin'].includes(row.my_role) && req.user.role !== 'admin') return res.status(403).json({ error: 'Only group admins can edit this group.' });
  const cover = typeof req.body.cover === 'string' && req.body.cover.startsWith('/uploads/') ? req.body.cover : row.cover;
  db.prepare('UPDATE groups SET name=?, description=?, category=?, privacy=?, rules=?, cover=? WHERE id=?')
    .run(U.sanitizeText(req.body.name, 60) || row.name, U.sanitizeText(req.body.description, 800), U.sanitizeText(req.body.category, 40) || row.category,
      ['public', 'private'].includes(req.body.privacy) ? req.body.privacy : row.privacy, U.sanitizeText(req.body.rules, 1000), cover, row.id);
  res.json({ group: groupRow(row.id, req.user.id) });
}));

g.delete('/:id', U.requireAuth, U.wrap((req, res) => {
  const row = groupRow(Number(req.params.id), req.user.id);
  if (!row) return res.status(404).json({ error: 'Group not found.' });
  if (row.my_role !== 'owner' && req.user.role !== 'admin') return res.status(403).json({ error: 'Only the owner can delete this group.' });
  db.prepare('DELETE FROM groups WHERE id=?').run(row.id);
  res.json({ ok: true });
}));

g.post('/:id/join', U.requireAuth, U.wrap((req, res) => {
  const row = groupRow(Number(req.params.id), req.user.id);
  if (!row) return res.status(404).json({ error: 'Group not found.' });
  if (row.my_status) return res.status(409).json({ error: row.my_status === 'pending' ? 'Your request is already pending.' : 'You are already a member.' });
  const status = row.privacy === 'private' ? 'pending' : 'active';
  db.prepare('INSERT INTO group_members (group_id,user_id,role,status,created_at) VALUES (?,?,?,?,?)').run(row.id, req.user.id, 'member', status, U.now());
  if (status === 'pending') U.notify({ userId: row.owner_id, actorId: req.user.id, type: 'group', entityType: 'group', entityId: row.id, text: `${req.user.full_name} requested to join ${row.name}`, link: `#/group/${row.id}` });
  res.json({ status });
}));

g.post('/:id/leave', U.requireAuth, U.wrap((req, res) => {
  const row = groupRow(Number(req.params.id), req.user.id);
  if (!row) return res.status(404).json({ error: 'Group not found.' });
  if (row.my_role === 'owner') return res.status(400).json({ error: 'Transfer ownership or delete the group instead.' });
  db.prepare('DELETE FROM group_members WHERE group_id=? AND user_id=?').run(row.id, req.user.id);
  res.json({ ok: true });
}));

g.get('/:id/members', U.wrap((req, res) => {
  const id = Number(req.params.id);
  const rows = db.prepare(`SELECT u.id,u.username,u.full_name,u.avatar, gm.role, gm.status FROM group_members gm JOIN users u ON u.id=gm.user_id
    WHERE gm.group_id=? ORDER BY CASE gm.role WHEN 'owner' THEN 0 WHEN 'admin' THEN 1 WHEN 'moderator' THEN 2 ELSE 3 END, u.full_name`).all(id);
  res.json({ members: rows.filter((x) => x.status === 'active'), pending: rows.filter((x) => x.status === 'pending') });
}));

g.post('/:id/members/:uid', U.requireAuth, U.wrap((req, res) => {
  const row = groupRow(Number(req.params.id), req.user.id);
  if (!row) return res.status(404).json({ error: 'Group not found.' });
  if (!['owner', 'admin'].includes(row.my_role)) return res.status(403).json({ error: 'Only group admins can manage members.' });
  const uid = Number(req.params.uid);
  const action = req.body.action;
  const target = db.prepare('SELECT * FROM group_members WHERE group_id=? AND user_id=?').get(row.id, uid);
  if (!target) return res.status(404).json({ error: 'Member not found.' });
  if (target.role === 'owner') return res.status(403).json({ error: 'The owner cannot be modified.' });
  if (action === 'approve') {
    db.prepare(`UPDATE group_members SET status='active' WHERE group_id=? AND user_id=?`).run(row.id, uid);
    U.notify({ userId: uid, actorId: req.user.id, type: 'group', entityType: 'group', entityId: row.id, text: `You were approved to join ${row.name}`, link: `#/group/${row.id}` });
  } else if (action === 'remove' || action === 'decline') {
    db.prepare('DELETE FROM group_members WHERE group_id=? AND user_id=?').run(row.id, uid);
  } else if (['admin', 'moderator', 'member'].includes(action)) {
    db.prepare('UPDATE group_members SET role=? WHERE group_id=? AND user_id=?').run(action, row.id, uid);
  } else return res.status(400).json({ error: 'Unknown action.' });
  res.json({ ok: true });
}));

g.post('/:id/invite', U.requireAuth, U.wrap((req, res) => {
  const row = groupRow(Number(req.params.id), req.user.id);
  if (!row || !row.my_role) return res.status(403).json({ error: 'Join the group before inviting others.' });
  const uid = Number(req.body.user_id);
  const target = db.prepare('SELECT * FROM users WHERE id=?').get(uid);
  if (!target) return res.status(404).json({ error: 'User not found.' });
  U.notify({ userId: uid, actorId: req.user.id, type: 'group', entityType: 'group', entityId: row.id, text: `${req.user.full_name} invited you to join ${row.name}`, link: `#/group/${row.id}` });
  res.json({ ok: true });
}));

g.get('/:id/feed', U.wrap((req, res) => {
  const me = req.user ? req.user.id : 0;
  const row = groupRow(Number(req.params.id), me);
  if (!row) return res.status(404).json({ error: 'Group not found.' });
  if (row.privacy === 'private' && !row.my_role) return res.json({ posts: [], nextCursor: null, restricted: true });
  res.json(F.queryPosts({ me, where: ['p.group_id=@gid'], params: { gid: row.id }, limit: 10, cursor: req.query.cursor }));
}));

/* ================= COMMUNITIES ================= */
const c = express.Router();

function commRow(idOrSlug, me) {
  const row = db.prepare(`SELECT c.*, (SELECT COUNT(*) FROM community_members cm WHERE cm.community_id=c.id) AS member_count
    FROM communities c WHERE c.id=? OR c.slug=?`).get(Number(idOrSlug) || 0, String(idOrSlug));
  if (!row) return null;
  const m = me ? db.prepare('SELECT * FROM community_members WHERE community_id=? AND user_id=?').get(row.id, me) : null;
  row.my_role = m ? m.role : null;
  return row;
}

c.get('/', U.wrap((req, res) => {
  const me = req.user ? req.user.id : 0;
  const hub = req.query.hub;
  let sql = `SELECT c.*, (SELECT COUNT(*) FROM community_members cm WHERE cm.community_id=c.id) AS member_count,
    (SELECT cm.role FROM community_members cm WHERE cm.community_id=c.id AND cm.user_id=@me) AS my_role FROM communities c WHERE 1=1`;
  if (['general', 'business', 'gaming'].includes(hub)) sql += ' AND c.hub=@hub';
  if (req.query.mine === '1') sql += ' AND EXISTS (SELECT 1 FROM community_members cm WHERE cm.community_id=c.id AND cm.user_id=@me)';
  if (req.query.q) sql += ' AND (c.name LIKE @like OR c.description LIKE @like)';
  sql += ' ORDER BY member_count DESC, c.name LIMIT 60';
  res.json({ communities: db.prepare(sql).all({ me, hub: hub || '', like: `%${U.sanitizeText(req.query.q || '', 50)}%` }) });
}));

c.post('/', U.requireAuth, U.rateLimit({ max: 8, windowMs: 3600e3, key: 'newcomm' }), U.wrap((req, res) => {
  const name = U.sanitizeText(req.body.name, 60);
  if (name.length < 3) return res.status(400).json({ error: 'Community name must be at least 3 characters.' });
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50);
  if (db.prepare('SELECT 1 FROM communities WHERE name=? OR slug=?').get(name, slug)) return res.status(409).json({ error: 'A community with that name already exists.' });
  const hub = ['general', 'business', 'gaming'].includes(req.body.hub) ? req.body.hub : 'general';
  const info = db.prepare('INSERT INTO communities (name,slug,description,hub,category,rules,created_by,created_at) VALUES (?,?,?,?,?,?,?,?)')
    .run(name, slug, U.sanitizeText(req.body.description, 600), hub, U.sanitizeText(req.body.category, 40), U.sanitizeText(req.body.rules, 1000), req.user.id, U.now());
  db.prepare(`INSERT INTO community_members (community_id,user_id,role,created_at) VALUES (?,?, 'owner',?)`).run(info.lastInsertRowid, req.user.id, U.now());
  res.json({ community: commRow(info.lastInsertRowid, req.user.id) });
}));

c.get('/:id', U.wrap((req, res) => {
  const row = commRow(req.params.id, req.user ? req.user.id : 0);
  if (!row) return res.status(404).json({ error: 'Community not found.' });
  res.json({ community: row });
}));

c.get('/:id/members', U.wrap((req, res) => {
  const row = commRow(req.params.id, 0);
  if (!row) return res.status(404).json({ error: 'Community not found.' });
  res.json({ members: db.prepare(`SELECT u.id,u.username,u.full_name,u.avatar,cm.role FROM community_members cm JOIN users u ON u.id=cm.user_id
    WHERE cm.community_id=? ORDER BY CASE cm.role WHEN 'owner' THEN 0 WHEN 'moderator' THEN 1 ELSE 2 END LIMIT 200`).all(row.id) });
}));

c.post('/:id/join', U.requireAuth, U.wrap((req, res) => {
  const row = commRow(req.params.id, req.user.id);
  if (!row) return res.status(404).json({ error: 'Community not found.' });
  if (row.my_role) { 
    if (row.my_role === 'owner') return res.status(400).json({ error: 'Owners cannot leave their own community.' });
    db.prepare('DELETE FROM community_members WHERE community_id=? AND user_id=?').run(row.id, req.user.id);
    return res.json({ joined: false });
  }
  db.prepare('INSERT INTO community_members (community_id,user_id,role,created_at) VALUES (?,?,?,?)').run(row.id, req.user.id, 'member', U.now());
  XP.award(req.user.id, 'community_join', { refType: 'community', refId: row.id });
  res.json({ joined: true });
}));

c.get('/:id/feed', U.wrap((req, res) => {
  const me = req.user ? req.user.id : 0;
  const row = commRow(req.params.id, me);
  if (!row) return res.status(404).json({ error: 'Community not found.' });
  res.json(F.queryPosts({ me, where: ['p.community_id=@cid'], params: { cid: row.id }, limit: 10, cursor: req.query.cursor }));
}));

/* ================= EVENTS ================= */
const e = express.Router();

function eventRow(id, me) {
  const row = db.prepare(`SELECT e.*, u.username,u.full_name,u.avatar,
    (SELECT COUNT(*) FROM event_attendees a WHERE a.event_id=e.id AND a.status='going') AS going_count,
    (SELECT COUNT(*) FROM event_attendees a WHERE a.event_id=e.id AND a.status='interested') AS interested_count,
    (SELECT a.status FROM event_attendees a WHERE a.event_id=e.id AND a.user_id=@me) AS my_status,
    (SELECT 1 FROM saved_items s WHERE s.user_id=@me AND s.item_type='event' AND s.item_id=e.id) AS is_saved
    FROM events e JOIN users u ON u.id=e.host_id WHERE e.id=@id AND e.removed=0`).get({ id, me });
  return row || null;
}

e.get('/', U.wrap((req, res) => {
  const me = req.user ? req.user.id : 0;
  const hub = req.query.hub;
  let sql = `SELECT e.*, u.username,u.full_name,
    (SELECT COUNT(*) FROM event_attendees a WHERE a.event_id=e.id AND a.status='going') AS going_count,
    (SELECT a.status FROM event_attendees a WHERE a.event_id=e.id AND a.user_id=@me) AS my_status
    FROM events e JOIN users u ON u.id=e.host_id WHERE e.removed=0`;
  if (['general', 'business', 'gaming'].includes(hub)) sql += ' AND e.hub=@hub';
  if (req.query.upcoming !== '0') sql += ' AND e.starts_at > @now';
  sql += ' ORDER BY e.starts_at ASC LIMIT 40';
  res.json({ events: db.prepare(sql).all({ me, hub: hub || '', now: U.now() - 3600e3 }) });
}));

e.post('/', U.requireAuth, U.rateLimit({ max: 10, windowMs: 3600e3, key: 'newevent' }), U.wrap((req, res) => {
  const title = U.sanitizeText(req.body.title, 100);
  if (title.length < 3) return res.status(400).json({ error: 'Event title is required.' });
  const starts_at = Number(req.body.starts_at);
  if (!starts_at || isNaN(starts_at)) return res.status(400).json({ error: 'Pick a valid date and time.' });
  const mode = ['online', 'physical'].includes(req.body.mode) ? req.body.mode : 'online';
  const hub = ['general', 'business', 'gaming'].includes(req.body.hub) ? req.body.hub : 'general';
  const cover = typeof req.body.cover === 'string' && req.body.cover.startsWith('/uploads/') ? req.body.cover : null;
  const info = db.prepare(`INSERT INTO events (title,description,starts_at,mode,location,cover,hub,host_id,created_at) VALUES (?,?,?,?,?,?,?,?,?)`)
    .run(title, U.sanitizeText(req.body.description, 1500), starts_at, mode, U.sanitizeText(req.body.location, 120), cover, hub, req.user.id, U.now());
  db.prepare(`INSERT INTO event_attendees (event_id,user_id,status,created_at) VALUES (?,?, 'going', ?)`).run(info.lastInsertRowid, req.user.id, U.now());
  res.json({ event: eventRow(info.lastInsertRowid, req.user.id) });
}));

e.get('/:id', U.wrap((req, res) => {
  const row = eventRow(Number(req.params.id), req.user ? req.user.id : 0);
  if (!row) return res.status(404).json({ error: 'Event not found.' });
  res.json({ event: row });
}));

e.post('/:id/rsvp', U.requireAuth, U.wrap((req, res) => {
  const id = Number(req.params.id);
  if (!eventRow(id, req.user.id)) return res.status(404).json({ error: 'Event not found.' });
  const status = ['going', 'interested', 'not_going'].includes(req.body.status) ? req.body.status : null;
  if (!status) return res.status(400).json({ error: 'Invalid RSVP.' });
  const ex = db.prepare('SELECT * FROM event_attendees WHERE event_id=? AND user_id=?').get(id, req.user.id);
  if (ex && ex.status === status) db.prepare('DELETE FROM event_attendees WHERE event_id=? AND user_id=?').run(id, req.user.id);
  else if (ex) db.prepare('UPDATE event_attendees SET status=? WHERE event_id=? AND user_id=?').run(status, id, req.user.id);
  else db.prepare('INSERT INTO event_attendees (event_id,user_id,status,created_at) VALUES (?,?,?,?)').run(id, req.user.id, status, U.now());
  res.json({ event: eventRow(id, req.user.id) });
}));

e.post('/:id/save', U.requireAuth, U.wrap((req, res) => {
  const id = Number(req.params.id);
  if (!eventRow(id, req.user.id)) return res.status(404).json({ error: 'Event not found.' });
  const ex = db.prepare(`SELECT * FROM saved_items WHERE user_id=? AND item_type='event' AND item_id=?`).get(req.user.id, id);
  if (ex) { db.prepare('DELETE FROM saved_items WHERE id=?').run(ex.id); return res.json({ saved: false }); }
  db.prepare(`INSERT INTO saved_items (user_id,item_type,item_id,created_at) VALUES (?,'event',?,?)`).run(req.user.id, id, U.now());
  res.json({ saved: true });
}));

e.post('/:id/share', U.requireAuth, U.wrap((req, res) => {
  const id = Number(req.params.id);
  const ev = eventRow(id, req.user.id);
  if (!ev) return res.status(404).json({ error: 'Event not found.' });
  const content = `${U.sanitizeText(req.body.content, 500)}\n\nEvent: ${ev.title}`.trim();
  const info = db.prepare(`INSERT INTO posts (user_id,content,hub,kind,privacy,event_id,created_at) VALUES (?,?,?, 'event','public',?,?)`)
    .run(req.user.id, content, ev.hub, id, U.now());
  res.json({ ok: true, post_id: info.lastInsertRowid });
}));

e.delete('/:id', U.requireAuth, U.wrap((req, res) => {
  const ev = db.prepare('SELECT * FROM events WHERE id=?').get(req.params.id);
  if (!ev) return res.status(404).json({ error: 'Event not found.' });
  if (ev.host_id !== req.user.id && req.user.role !== 'admin') return res.status(403).json({ error: 'Only the host can delete this event.' });
  db.prepare('DELETE FROM events WHERE id=?').run(ev.id);
  res.json({ ok: true });
}));

module.exports = { groups: g, communities: c, events: e };
