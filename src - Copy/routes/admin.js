'use strict';
const express = require('express');
const { db } = require('../db');
const U = require('../util');
const RBAC = require('../rbac');
const R = require('../recommendations');

const r = express.Router();
r.use(U.requireStaff);

r.get('/stats', U.requirePermission('analytics.view'), U.wrap((req, res) => {
  const one = (sql, ...p) => db.prepare(sql).get(...p).n;
  const dayAgo = U.now() - 24 * 3600e3;
  res.json({
    users: one('SELECT COUNT(*) n FROM users'),
    active_users: one('SELECT COUNT(*) n FROM users WHERE last_seen>?', dayAgo),
    suspended: one(`SELECT COUNT(*) n FROM users WHERE status='suspended'`),
    posts: one('SELECT COUNT(*) n FROM posts WHERE removed=0'),
    comments: one('SELECT COUNT(*) n FROM comments WHERE removed=0'),
    groups: one('SELECT COUNT(*) n FROM groups'),
    communities: one('SELECT COUNT(*) n FROM communities'),
    events: one('SELECT COUNT(*) n FROM events WHERE removed=0'),
    messages: one('SELECT COUNT(*) n FROM messages'),
    open_reports: one(`SELECT COUNT(*) n FROM reports WHERE status='open'`),
    signups_7d: db.prepare(`SELECT COUNT(*) n FROM users WHERE created_at>?`).get(U.now() - 7 * 24 * 3600e3).n,
    recent_reports: db.prepare(`SELECT r.*, u.username AS reporter FROM reports r JOIN users u ON u.id=r.reporter_id ORDER BY r.created_at DESC LIMIT 5`).all(),
  });
}));

r.get('/users', U.requirePermission('users.view'), U.wrap((req, res) => {
  const like = `%${U.sanitizeText(req.query.q || '', 60)}%`;
  const status = ['active', 'suspended', 'banned', 'deleted'].includes(req.query.status) ? req.query.status : null;
  const rows = db.prepare(`SELECT id,username,email,full_name,role,staff_role,status,banned_until,ban_reason,created_at,last_seen,in_business,in_gaming,
    (SELECT COUNT(*) FROM posts p WHERE p.user_id=users.id AND p.removed=0) AS post_count
    FROM users WHERE (full_name LIKE @like OR username LIKE @like OR email LIKE @like)
      AND (@status='' OR status=@status) ORDER BY created_at DESC LIMIT 100`).all({ like, status: status || '' });
  res.json({ users: rows });
}));

r.patch('/users/:id', U.requirePermission('users.edit'), U.wrap((req, res) => {
  const target = db.prepare('SELECT * FROM users WHERE id=?').get(req.params.id);
  if (!target) return res.status(404).json({ error: 'User not found.' });
  const full_name = U.sanitizeText(req.body.full_name, 60) || target.full_name;
  const bio = req.body.bio === undefined ? target.bio : U.sanitizeText(req.body.bio, 300);
  const location = req.body.location === undefined ? target.location : U.sanitizeText(req.body.location, 80);
  db.prepare('UPDATE users SET full_name=?,bio=?,location=? WHERE id=?').run(full_name, bio, location, target.id);
  RBAC.audit(req, { action: 'user.edit', targetType: 'user', targetId: target.id });
  res.json({ ok: true, user: db.prepare('SELECT id,username,email,full_name,bio,location,status,staff_role FROM users WHERE id=?').get(target.id) });
}));

r.post('/users/:id/status', U.requireAnyPermission(['users.suspend', 'users.ban']), U.wrap((req, res) => {
  const target = db.prepare('SELECT * FROM users WHERE id=?').get(req.params.id);
  if (!target) return res.status(404).json({ error: 'User not found.' });
  if (target.id === req.user.id) return res.status(400).json({ error: 'You cannot change your own status.' });
  const status = ['active', 'suspended', 'banned'].includes(req.body.status) ? req.body.status : null;
  if (!status) return res.status(400).json({ error: 'Invalid status.' });
  if (status === 'banned' && !RBAC.hasPermission(req.user, 'users.ban')) return res.status(403).json({ error: 'Ban permission required.' });
  if (status === 'suspended' && !RBAC.hasPermission(req.user, 'users.suspend')) return res.status(403).json({ error: 'Suspend permission required.' });
  const reason = U.sanitizeText(req.body.reason, 600);
  const until = status === 'banned' && req.body.banned_until ? Number(req.body.banned_until) : null;
  db.prepare('UPDATE users SET status=?, banned_until=?, ban_reason=? WHERE id=?').run(status, until, reason, target.id);
  if (status !== 'active') db.prepare('DELETE FROM sessions WHERE user_id=?').run(target.id);
  RBAC.audit(req, { action: `user.${status}`, targetType: 'user', targetId: target.id, detail: reason });
  res.json({ ok: true, status });
}));

r.post('/users/:id/role', U.requireSuperAdmin, U.wrap((req, res) => {
  const target = db.prepare('SELECT * FROM users WHERE id=?').get(req.params.id);
  if (!target) return res.status(404).json({ error: 'User not found.' });
  if (target.id === req.user.id) return res.status(400).json({ error: 'You cannot change your own role.' });
  const role = ['user', 'admin'].includes(req.body.role) ? req.body.role : null;
  if (!role) return res.status(400).json({ error: 'Invalid role.' });
  db.prepare("UPDATE users SET role=?, staff_role=? WHERE id=?").run(role, role === 'admin' ? 'admin' : '', target.id);
  RBAC.audit(req, { action: 'staff.legacy_role_change', targetType: 'user', targetId: target.id, detail: role });
  res.json({ ok: true, role });
}));

r.delete('/users/:id', U.requirePermission('users.delete'), U.wrap((req, res) => {
  const target = db.prepare('SELECT id,username FROM users WHERE id=?').get(req.params.id);
  if (!target) return res.status(404).json({ error: 'User not found.' });
  if (target.id === req.user.id) return res.status(400).json({ error: 'You cannot delete your own account here.' });
  RBAC.audit(req, { action: 'user.delete', targetType: 'user', targetId: target.id, detail: target.username });
  db.prepare('DELETE FROM users WHERE id=?').run(target.id);
  res.json({ ok: true });
}));

r.get('/posts', U.requirePermission('posts.view'), U.wrap((req, res) => {
  const like = `%${U.sanitizeText(req.query.q || '', 60)}%`;
  res.json({ posts: db.prepare(`SELECT p.id,p.content,p.hub,p.created_at,p.removed,u.username,u.full_name,
    (SELECT COUNT(*) FROM reactions rr WHERE rr.post_id=p.id) AS reaction_count,
    (SELECT COUNT(*) FROM comments cc WHERE cc.post_id=p.id) AS comment_count
    FROM posts p JOIN users u ON u.id=p.user_id WHERE p.content LIKE ? OR u.username LIKE ? ORDER BY p.created_at DESC LIMIT 100`).all(like, like) });
}));

r.patch('/posts/:id', U.requirePermission('posts.edit'), U.wrap((req, res) => {
  const post = db.prepare('SELECT * FROM posts WHERE id=?').get(req.params.id);
  if (!post) return res.status(404).json({ error: 'Post not found.' });
  const content = U.sanitizeText(req.body.content, 5000);
  const media = db.prepare('SELECT COUNT(*) n FROM post_media WHERE post_id=?').get(post.id).n;
  if (!content && !media) return res.status(400).json({ error: 'Post cannot be empty.' });
  db.prepare('UPDATE posts SET content=?, updated_at=? WHERE id=?').run(content, U.now(), post.id);
  U.linkHashtags(post.id, content);
  R.refreshPostCategories({ id: post.id, content, hub: post.hub, topic: post.topic });
  RBAC.audit(req, { action: 'post.edit', targetType: 'post', targetId: post.id });
  res.json({ ok: true, post: db.prepare('SELECT id,content,updated_at FROM posts WHERE id=?').get(post.id) });
}));

r.post('/posts/:id/remove', U.requireAnyPermission(['posts.moderate', 'posts.delete']), U.wrap((req, res) => {
  const removed = req.body.removed ? 1 : 0;
  const id = Number(req.params.id);
  db.prepare('UPDATE posts SET removed=? WHERE id=?').run(removed, id);
  RBAC.audit(req, { action: removed ? 'post.hide' : 'post.restore', targetType: 'post', targetId: id });
  res.json({ ok: true, removed });
}));
r.delete('/posts/:id', U.requirePermission('posts.delete'), U.wrap((req, res) => {
  const id = Number(req.params.id);
  db.prepare('DELETE FROM posts WHERE id=?').run(id);
  RBAC.audit(req, { action: 'post.delete', targetType: 'post', targetId: id });
  res.json({ ok: true });
}));

r.get('/comments', U.requirePermission('comments.moderate'), U.wrap((req, res) => {
  res.json({ comments: db.prepare(`SELECT c.id,c.content,c.created_at,c.removed,c.post_id,u.username FROM comments c JOIN users u ON u.id=c.user_id
    ORDER BY c.created_at DESC LIMIT 100`).all() });
}));
r.delete('/comments/:id', U.requirePermission('comments.moderate'), U.wrap((req, res) => {
  const id = Number(req.params.id);
  db.prepare('DELETE FROM comments WHERE id=?').run(id);
  RBAC.audit(req, { action: 'comment.delete', targetType: 'comment', targetId: id });
  res.json({ ok: true });
}));

r.get('/groups', U.requirePermission('communities.view'), U.wrap((req, res) => {
  res.json({ groups: db.prepare(`SELECT g.*, u.username AS owner, (SELECT COUNT(*) FROM group_members gm WHERE gm.group_id=g.id) AS member_count
    FROM groups g JOIN users u ON u.id=g.owner_id ORDER BY g.created_at DESC LIMIT 100`).all() });
}));
r.delete('/groups/:id', U.requirePermission('communities.manage'), U.wrap((req, res) => {
  const id = Number(req.params.id);
  db.prepare('DELETE FROM groups WHERE id=?').run(id);
  RBAC.audit(req, { action: 'group.delete', targetType: 'group', targetId: id });
  res.json({ ok: true });
}));

r.get('/communities', U.requirePermission('communities.view'), U.wrap((req, res) => {
  res.json({ communities: db.prepare(`SELECT c.*, (SELECT COUNT(*) FROM community_members cm WHERE cm.community_id=c.id) AS member_count
    FROM communities c ORDER BY c.created_at DESC LIMIT 100`).all() });
}));
r.delete('/communities/:id', U.requirePermission('communities.manage'), U.wrap((req, res) => {
  const id = Number(req.params.id);
  db.prepare('DELETE FROM communities WHERE id=?').run(id);
  RBAC.audit(req, { action: 'community.delete', targetType: 'community', targetId: id });
  res.json({ ok: true });
}));

r.get('/events', U.requirePermission('communities.view'), U.wrap((req, res) => {
  res.json({ events: db.prepare(`SELECT e.*, u.username AS host FROM events e JOIN users u ON u.id=e.host_id ORDER BY e.starts_at DESC LIMIT 100`).all() });
}));
r.delete('/events/:id', U.requirePermission('communities.manage'), U.wrap((req, res) => {
  const id = Number(req.params.id);
  db.prepare('DELETE FROM events WHERE id=?').run(id);
  RBAC.audit(req, { action: 'event.delete', targetType: 'event', targetId: id });
  res.json({ ok: true });
}));

r.get('/reports', U.requirePermission('reports.view'), U.wrap((req, res) => {
  const status = ['open', 'resolved', 'dismissed'].includes(req.query.status) ? req.query.status : null;
  const rows = db.prepare(`SELECT r.*, u.username AS reporter FROM reports r JOIN users u ON u.id=r.reporter_id
    ${status ? 'WHERE r.status=@status' : ''} ORDER BY r.created_at DESC LIMIT 100`).all({ status });
  rows.forEach((row) => {
    if (row.target_type === 'post') {
      const p = db.prepare('SELECT p.content, p.removed, u.username FROM posts p JOIN users u ON u.id=p.user_id WHERE p.id=?').get(row.target_id);
      row.preview = p ? `@${p.username}: ${(p.content || '').slice(0, 120)}` : 'Deleted post';
      row.target_removed = p ? !!p.removed : true;
    } else if (row.target_type === 'comment') {
      const cRow = db.prepare('SELECT c.content, u.username FROM comments c JOIN users u ON u.id=c.user_id WHERE c.id=?').get(row.target_id);
      row.preview = cRow ? `@${cRow.username}: ${cRow.content.slice(0, 120)}` : 'Deleted comment';
    } else if (row.target_type === 'user') {
      const u2 = db.prepare('SELECT username, status FROM users WHERE id=?').get(row.target_id);
      row.preview = u2 ? `@${u2.username} (${u2.status})` : 'Deleted user';
    } else if (row.target_type === 'group') {
      const gr = db.prepare('SELECT name FROM groups WHERE id=?').get(row.target_id);
      row.preview = gr ? gr.name : 'Deleted group';
    } else {
      const cm = db.prepare('SELECT name FROM communities WHERE id=?').get(row.target_id);
      row.preview = cm ? cm.name : 'Deleted community';
    }
  });
  res.json({ reports: rows });
}));

r.post('/reports/:id', U.requirePermission('reports.manage'), U.wrap((req, res) => {
  const rep = db.prepare('SELECT * FROM reports WHERE id=?').get(req.params.id);
  if (!rep) return res.status(404).json({ error: 'Report not found.' });
  const action = req.body.action;
  if (action === 'remove_content') {
    if (rep.target_type === 'post') db.prepare('UPDATE posts SET removed=1 WHERE id=?').run(rep.target_id);
    else if (rep.target_type === 'comment') db.prepare('UPDATE comments SET removed=1 WHERE id=?').run(rep.target_id);
    else if (rep.target_type === 'group') db.prepare('DELETE FROM groups WHERE id=?').run(rep.target_id);
    else if (rep.target_type === 'community') db.prepare('DELETE FROM communities WHERE id=?').run(rep.target_id);
    else if (rep.target_type === 'user') db.prepare(`UPDATE users SET status='suspended' WHERE id=? AND id<>?`).run(rep.target_id, req.user.id);
    db.prepare(`UPDATE reports SET status='resolved', resolved_at=? WHERE id=?`).run(U.now(), rep.id);
  } else if (action === 'resolve') {
    db.prepare(`UPDATE reports SET status='resolved', resolved_at=? WHERE id=?`).run(U.now(), rep.id);
  } else if (action === 'dismiss') {
    db.prepare(`UPDATE reports SET status='dismissed', resolved_at=? WHERE id=?`).run(U.now(), rep.id);
  } else return res.status(400).json({ error: 'Unknown action.' });
  RBAC.audit(req, { action: `report.${action}`, targetType: rep.target_type, targetId: rep.target_id, detail: `report #${rep.id}` });
  res.json({ ok: true });
}));

module.exports = r;
