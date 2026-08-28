'use strict';
/* Gen-Z Hub — functional staff dashboard APIs: RBAC, audit, moderation and announcements. */
const express = require('express');
const { db } = require('../db');
const U = require('../util');
const RBAC = require('../rbac');

const r = express.Router();
r.use(U.requireStaff);
const need = (permission) => U.requirePermission(permission);
const validRole = (role) => Object.prototype.hasOwnProperty.call(RBAC.ROLES, role);
const idOf = (v) => Number.isInteger(Number(v)) && Number(v) > 0 ? Number(v) : 0;

r.get('/access', U.wrap((req, res) => {
  const role = RBAC.staffRole(req.user);
  const def = RBAC.ROLES[role];
  res.json({
    staff: true, role, role_name: def ? def.name : role, level: def ? def.level : 0,
    permissions: RBAC.permissionsFor(req.user.id),
  });
}));

r.get('/rbac', U.requireSuperAdmin, U.wrap((req, res) => {
  res.json({
    roles: Object.entries(RBAC.ROLES).map(([slug, x]) => ({ slug, ...x, permissions: RBAC.ROLE_DEFAULTS[slug] || [] })),
    permissions: RBAC.PERMISSIONS.map(([slug, name, description, group_name]) => ({ slug, name, description, group_name })),
  });
}));

r.get('/analytics', need('analytics.view'), U.wrap((req, res) => {
  const t = U.now();
  const one = (sql, ...args) => {
    const row = db.prepare(sql).get(...args) || {};
    return Number(row.n !== undefined ? row.n : Object.values(row)[0] || 0);
  };
  const engagement = db.prepare(`SELECT
    (SELECT COUNT(*) FROM reactions) + (SELECT COUNT(*) FROM comments WHERE removed=0) +
    (SELECT COUNT(*) FROM posts WHERE repost_of IS NOT NULL AND removed=0) AS total`).get().total || 0;
  res.json({
    users: one('SELECT COUNT(*) FROM users'),
    active_users: one('SELECT COUNT(*) FROM users WHERE status=\'active\' AND last_seen>?', t - 24 * 3600e3),
    new_users_today: one('SELECT COUNT(*) FROM users WHERE created_at>?', t - 86400000),
    posts: one('SELECT COUNT(*) FROM posts WHERE removed=0'),
    comments: one('SELECT COUNT(*) FROM comments WHERE removed=0'),
    pending_reports: one("SELECT COUNT(*) FROM reports WHERE status='open'"),
    banned_users: one("SELECT COUNT(*) FROM users WHERE status='banned'"),
    suspended_users: one("SELECT COUNT(*) FROM users WHERE status='suspended'"),
    communities: one('SELECT COUNT(*) FROM communities'),
    groups: one('SELECT COUNT(*) FROM groups'),
    engagement,
    reactions: one('SELECT COUNT(*) FROM reactions'),
    saves: one("SELECT COUNT(*) FROM saved_items WHERE item_type='post'"),
    video_watches: one('SELECT COALESCE(SUM(watched_seconds),0) FROM video_watch_stats'),
  });
}));

r.get('/health', need('system.health'), U.wrap((req, res) => {
  let dbOk = true;
  try { db.prepare('SELECT 1').get(); } catch (e) { dbOk = false; }
  let queue = 0;
  try { queue = require('../video-jobs').queueLength(); } catch (e) {}
  const mem = process.memoryUsage();
  res.status(dbOk ? 200 : 503).json({
    status: dbOk ? 'ok' : 'degraded', uptime_s: Math.round(process.uptime()),
    node: process.version, pid: process.pid, video_queue: queue,
    memory_mb: { rss: Math.round(mem.rss / 1048576), heap_used: Math.round(mem.heapUsed / 1048576) },
    time: new Date().toISOString(),
  });
}));

r.get('/audit-logs', need('audit_logs.view'), U.wrap((req, res) => {
  const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 100));
  const action = U.sanitizeText(req.query.action, 80);
  const rows = db.prepare(`SELECT l.*, u.username AS actor_username, u.full_name AS actor_name, u.staff_role
    FROM admin_activity_logs l LEFT JOIN users u ON u.id=l.actor_id
    ${action ? 'WHERE l.action LIKE @action' : ''}
    ORDER BY l.created_at DESC LIMIT @limit`).all({ action: action ? `%${action}%` : '', limit });
  res.json({ logs: rows });
}));

r.get('/staff', need('staff.view'), U.wrap((req, res) => {
  const rows = db.prepare(`SELECT id,username,email,full_name,role,staff_role,status,created_at,last_seen
    FROM users WHERE staff_role IN ('super_admin','admin','moderator','support_staff') OR (role='admin' AND staff_role='')
    ORDER BY CASE staff_role WHEN 'super_admin' THEN 0 WHEN 'admin' THEN 1 WHEN 'moderator' THEN 2 ELSE 3 END, full_name`).all();
  res.json({ staff: rows.map((u) => ({ ...u, staff_role: RBAC.staffRole(u), permissions: RBAC.permissionsFor(u.id) })) });
}));

function canChangeStaff(actor, target, nextRole) {
  if (!validRole(nextRole)) return 'Invalid staff role.';
  if (target.id === actor.id) return 'You cannot change your own staff role.';
  const actorRole = RBAC.staffRole(actor);
  const targetRole = RBAC.staffRole(target);
  if (actorRole !== 'super_admin') return 'Only a Super Admin can manage staff roles.';
  if (targetRole === 'super_admin' && nextRole !== 'super_admin') {
    const count = db.prepare("SELECT COUNT(*) n FROM users WHERE staff_role='super_admin' AND status='active'").get().n;
    if (count <= 1) return 'At least one active Super Admin must remain.';
  }
  return null;
}

r.post('/staff', U.requireSuperAdmin, U.wrap((req, res) => {
  const target = req.body.user_id
    ? db.prepare('SELECT * FROM users WHERE id=?').get(idOf(req.body.user_id))
    : db.prepare('SELECT * FROM users WHERE email=?').get(U.sanitizeText(req.body.email, 120).toLowerCase());
  if (!target) return res.status(404).json({ error: 'User not found.' });
  const role = U.sanitizeText(req.body.staff_role, 30);
  const err = canChangeStaff(req.user, target, role);
  if (err) return res.status(403).json({ error: err });
  db.prepare("UPDATE users SET role='admin', staff_role=?, status='active' WHERE id=?").run(role, target.id);
  db.prepare('DELETE FROM sessions WHERE user_id=?').run(target.id);
  RBAC.audit(req, { action: 'staff.promote', targetType: 'user', targetId: target.id, detail: `${target.username} -> ${role}` });
  res.json({ ok: true, user: db.prepare('SELECT id,username,email,full_name,role,staff_role,status FROM users WHERE id=?').get(target.id) });
}));

r.post('/staff/:id/role', U.requireSuperAdmin, U.wrap((req, res) => {
  const target = db.prepare('SELECT * FROM users WHERE id=?').get(idOf(req.params.id));
  if (!target) return res.status(404).json({ error: 'User not found.' });
  const role = U.sanitizeText(req.body.staff_role || req.body.role, 30);
  const err = canChangeStaff(req.user, target, role);
  if (err) return res.status(403).json({ error: err });
  db.prepare("UPDATE users SET role='admin', staff_role=?, status='active' WHERE id=?").run(role, target.id);
  RBAC.audit(req, { action: 'staff.role_change', targetType: 'user', targetId: target.id, detail: `${target.username} -> ${role}` });
  res.json({ ok: true, staff_role: role });
}));

r.delete('/staff/:id', U.requireSuperAdmin, U.wrap((req, res) => {
  const target = db.prepare('SELECT * FROM users WHERE id=?').get(idOf(req.params.id));
  if (!target) return res.status(404).json({ error: 'User not found.' });
  const err = canChangeStaff(req.user, target, 'support_staff');
  if (err) return res.status(403).json({ error: err });
  db.prepare("UPDATE users SET role='user', staff_role='', status='active' WHERE id=?").run(target.id);
  db.prepare('DELETE FROM staff_permission_overrides WHERE user_id=?').run(target.id);
  RBAC.audit(req, { action: 'staff.downgrade', targetType: 'user', targetId: target.id, detail: target.username });
  res.json({ ok: true });
}));

r.put('/staff/:id/permissions', U.requireSuperAdmin, U.wrap((req, res) => {
  const target = db.prepare('SELECT * FROM users WHERE id=?').get(idOf(req.params.id));
  if (!target || !RBAC.isStaff(target)) return res.status(404).json({ error: 'Staff member not found.' });
  if (target.id === req.user.id) return res.status(400).json({ error: 'Use the role defaults for your own Super Admin account.' });
  const input = Array.isArray(req.body.overrides) ? req.body.overrides : [];
  const allowed = new Set(RBAC.ALL_PERMISSIONS);
  const tx = db.transaction(() => {
    db.prepare('DELETE FROM staff_permission_overrides WHERE user_id=?').run(target.id);
    const ins = db.prepare(`INSERT INTO staff_permission_overrides (user_id,permission_slug,allowed,updated_by,updated_at)
      VALUES (?,?,?,?,?)`);
    input.forEach((x) => {
      const permission = U.sanitizeText(x.permission, 80);
      if (allowed.has(permission)) ins.run(target.id, permission, x.allowed ? 1 : 0, req.user.id, U.now());
    });
  });
  tx();
  RBAC.audit(req, { action: 'staff.permissions_change', targetType: 'user', targetId: target.id, detail: JSON.stringify(input).slice(0, 900) });
  res.json({ ok: true, permissions: RBAC.permissionsFor(target.id) });
}));

r.post('/users/:id/warn', need('moderation.warn'), U.wrap((req, res) => {
  const target = db.prepare('SELECT id,username FROM users WHERE id=?').get(idOf(req.params.id));
  if (!target) return res.status(404).json({ error: 'User not found.' });
  const reason = U.sanitizeText(req.body.reason, 600);
  if (!reason) return res.status(400).json({ error: 'A warning reason is required.' });
  const severity = ['notice', 'serious', 'final'].includes(req.body.severity) ? req.body.severity : 'notice';
  db.prepare('INSERT INTO user_warnings (user_id,issued_by,reason,severity,created_at) VALUES (?,?,?,?,?)').run(target.id, req.user.id, reason, severity, U.now());
  RBAC.recordModeration(req, { targetType: 'user', targetId: target.id, action: 'warn', reason });
  res.json({ ok: true });
}));

r.post('/users/:id/restrict', need('moderation.restrict'), U.wrap((req, res) => {
  const target = db.prepare('SELECT id,username FROM users WHERE id=?').get(idOf(req.params.id));
  if (!target) return res.status(404).json({ error: 'User not found.' });
  if (target.id === req.user.id) return res.status(400).json({ error: 'You cannot restrict yourself.' });
  const minutes = Math.min(7 * 24 * 60, Math.max(0, Number(req.body.minutes) || 0));
  const until = minutes ? U.now() + minutes * 60000 : null;
  const reason = U.sanitizeText(req.body.reason, 600);
  db.prepare('UPDATE users SET moderation_until=?, moderation_reason=? WHERE id=?').run(until, reason, target.id);
  db.prepare('DELETE FROM sessions WHERE user_id=?').run(target.id);
  RBAC.recordModeration(req, { targetType: 'user', targetId: target.id, action: until ? 'restrict' : 'unrestrict', reason, expiresAt: until });
  res.json({ ok: true, moderation_until: until });
}));

r.get('/categories', need('categories.manage'), U.wrap((req, res) => {
  res.json({ categories: db.prepare('SELECT * FROM recommendation_categories ORDER BY position, slug').all() });
}));
r.patch('/categories/:slug', need('categories.manage'), U.wrap((req, res) => {
  const slug = U.sanitizeText(req.params.slug, 50).toLowerCase();
  const row = db.prepare('SELECT * FROM recommendation_categories WHERE slug=?').get(slug);
  if (!row) return res.status(404).json({ error: 'Category not found.' });
  db.prepare('UPDATE recommendation_categories SET name=?, active=?, position=? WHERE slug=?').run(
    U.sanitizeText(req.body.name, 80) || row.name, req.body.active === undefined ? row.active : (req.body.active ? 1 : 0),
    req.body.position === undefined ? row.position : Number(req.body.position) || 0, slug);
  RBAC.audit(req, { action: 'category.update', targetType: 'category', detail: slug });
  res.json({ category: db.prepare('SELECT * FROM recommendation_categories WHERE slug=?').get(slug) });
}));

r.get('/announcements', need('announcements.manage'), U.wrap((req, res) => {
  res.json({ announcements: db.prepare(`SELECT a.*, u.username AS created_by_username FROM announcements a JOIN users u ON u.id=a.created_by
    ORDER BY a.created_at DESC LIMIT 100`).all() });
}));
r.post('/announcements', need('announcements.manage'), U.wrap((req, res) => {
  const title = U.sanitizeText(req.body.title, 140);
  const body = U.sanitizeText(req.body.body, 2000);
  if (!title || !body) return res.status(400).json({ error: 'Title and message are required.' });
  const status = ['draft', 'published'].includes(req.body.status) ? req.body.status : 'draft';
  const starts = req.body.starts_at ? Number(req.body.starts_at) : U.now();
  const ends = req.body.ends_at ? Number(req.body.ends_at) : null;
  const audience = ['all', 'staff'].includes(req.body.audience) ? req.body.audience : 'all';
  const info = db.prepare(`INSERT INTO announcements (created_by,title,body,audience,status,starts_at,ends_at,created_at,updated_at)
    VALUES (?,?,?,?,?,?,?,?,?)`).run(req.user.id, title, body, audience, status, starts, ends, U.now(), U.now());
  if (status === 'published') sendAnnouncement(req, info.lastInsertRowid, title, body, audience);
  RBAC.audit(req, { action: 'announcement.create', targetType: 'announcement', targetId: Number(info.lastInsertRowid), detail: title });
  res.json({ announcement: db.prepare('SELECT * FROM announcements WHERE id=?').get(info.lastInsertRowid) });
}));
function sendAnnouncement(req, id, title, body, audience) {
  const where = audience === 'staff' ? "AND (staff_role<>'' OR role='admin')" : "AND status='active'";
  db.prepare(`INSERT INTO notifications (user_id,actor_id,type,entity_type,entity_id,text,link,created_at)
    SELECT id, ?, 'announcement', 'announcement', ?, ?, '#/announcements', ? FROM users WHERE status='active' ${where.replace("AND status='active'", '')}`).run(
      req.user.id, id, `${title}: ${body}`.slice(0, 900), U.now());
}
r.patch('/announcements/:id', need('announcements.manage'), U.wrap((req, res) => {
  const a = db.prepare('SELECT * FROM announcements WHERE id=?').get(idOf(req.params.id));
  if (!a) return res.status(404).json({ error: 'Announcement not found.' });
  const status = ['draft', 'published', 'archived'].includes(req.body.status) ? req.body.status : a.status;
  const title = req.body.title === undefined ? a.title : U.sanitizeText(req.body.title, 140);
  const body = req.body.body === undefined ? a.body : U.sanitizeText(req.body.body, 2000);
  db.prepare('UPDATE announcements SET title=?,body=?,status=?,updated_at=? WHERE id=?').run(title, body, status, U.now(), a.id);
  RBAC.audit(req, { action: 'announcement.update', targetType: 'announcement', targetId: a.id, detail: status });
  res.json({ announcement: db.prepare('SELECT * FROM announcements WHERE id=?').get(a.id) });
}));
r.delete('/announcements/:id', need('announcements.manage'), U.wrap((req, res) => {
  const id = idOf(req.params.id);
  if (!db.prepare('SELECT 1 FROM announcements WHERE id=?').get(id)) return res.status(404).json({ error: 'Announcement not found.' });
  db.prepare('DELETE FROM announcements WHERE id=?').run(id);
  RBAC.audit(req, { action: 'announcement.delete', targetType: 'announcement', targetId: id });
  res.json({ ok: true });
}));

r.post('/notifications', need('notifications.manage'), U.wrap((req, res) => {
  const text = U.sanitizeText(req.body.text, 900);
  if (!text) return res.status(400).json({ error: 'Notification text is required.' });
  const targetId = idOf(req.body.user_id);
  let count = 0;
  if (targetId) {
    db.prepare(`INSERT INTO notifications (user_id,actor_id,type,entity_type,entity_id,text,link,created_at) VALUES (?,?, 'platform','platform',NULL,?,?,?)`)
      .run(targetId, req.user.id, text, U.sanitizeText(req.body.link, 300), U.now());
    count = 1;
  } else {
    count = db.prepare(`SELECT COUNT(*) n FROM users WHERE status='active'`).get().n;
    db.prepare(`INSERT INTO notifications (user_id,actor_id,type,entity_type,entity_id,text,link,created_at)
      SELECT id, ?, 'platform','platform',NULL,?,?,? FROM users WHERE status='active'`).run(req.user.id, text, U.sanitizeText(req.body.link, 300), U.now());
  }
  RBAC.audit(req, { action: 'notification.send', targetType: targetId ? 'user' : 'platform', targetId: targetId || null, detail: text });
  res.json({ ok: true, count });
}));

module.exports = r;
