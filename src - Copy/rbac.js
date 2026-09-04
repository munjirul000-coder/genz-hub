'use strict';
/* Gen-Z Hub — staff RBAC, audit logging and moderation helpers. */
const { db } = require('./db');

const ROLES = {
  super_admin: { name: 'Super Admin', level: 100, description: 'Unrestricted platform owner access.' },
  admin: { name: 'Admin', level: 70, description: 'Operational platform administration.' },
  moderator: { name: 'Moderator', level: 40, description: 'Content and community moderation.' },
  support_staff: { name: 'Support Staff', level: 20, description: 'User support and read-only case handling.' },
};

const PERMISSIONS = [
  ['users.view', 'View users', 'Read user profiles and status', 'users'],
  ['users.edit', 'Edit users', 'Edit non-sensitive user account fields', 'users'],
  ['users.suspend', 'Suspend users', 'Temporarily suspend accounts', 'users'],
  ['users.ban', 'Ban users', 'Ban or unban accounts', 'users'],
  ['users.delete', 'Delete users', 'Permanently delete accounts', 'users'],
  ['posts.view', 'View posts', 'Read moderation content', 'content'],
  ['posts.edit', 'Edit posts', 'Edit or correct content', 'content'],
  ['posts.delete', 'Delete posts', 'Delete or remove posts', 'content'],
  ['posts.moderate', 'Moderate posts', 'Hide violating posts', 'content'],
  ['comments.moderate', 'Moderate comments', 'Remove comments and replies', 'content'],
  ['reports.view', 'View reports', 'Read reports and complaints', 'moderation'],
  ['reports.manage', 'Manage reports', 'Resolve or dismiss reports', 'moderation'],
  ['moderation.warn', 'Warn users', 'Issue moderation warnings', 'moderation'],
  ['moderation.restrict', 'Restrict users', 'Temporarily restrict posting access', 'moderation'],
  ['communities.view', 'View communities', 'Read communities and groups', 'communities'],
  ['communities.manage', 'Manage communities', 'Create, edit or remove communities', 'communities'],
  ['communities.moderate', 'Moderate communities', 'Handle community-level moderation', 'communities'],
  ['categories.manage', 'Manage categories', 'Manage hubs and recommendation categories', 'platform'],
  ['announcements.manage', 'Manage announcements', 'Publish platform announcements', 'platform'],
  ['notifications.manage', 'Manage notifications', 'Send platform notifications', 'platform'],
  ['staff.view', 'View staff', 'See staff accounts and roles', 'staff'],
  ['staff.manage', 'Manage staff', 'Promote or downgrade staff', 'staff'],
  ['staff.permissions', 'Manage permissions', 'Grant or revoke staff overrides', 'staff'],
  ['settings.manage', 'Manage settings', 'Change platform configuration', 'platform'],
  ['analytics.view', 'View analytics', 'Read platform analytics', 'analytics'],
  ['audit_logs.view', 'View audit logs', 'Read administrative audit history', 'security'],
  ['system.health', 'View system health', 'Read service and database health', 'security'],
];
const ALL_PERMISSIONS = PERMISSIONS.map((p) => p[0]);

const ROLE_DEFAULTS = {
  super_admin: ALL_PERMISSIONS,
  admin: ALL_PERMISSIONS.filter((p) => !['staff.manage', 'staff.permissions', 'users.delete'].includes(p)),
  moderator: ['users.view', 'posts.view', 'posts.moderate', 'comments.moderate', 'reports.view', 'reports.manage', 'moderation.warn', 'moderation.restrict', 'communities.view', 'communities.moderate', 'analytics.view', 'audit_logs.view'],
  support_staff: ['users.view', 'posts.view', 'reports.view', 'analytics.view'],
};

let ready = false;
function ensure() {
  if (ready) return;
  const role = db.prepare('INSERT OR IGNORE INTO staff_roles (slug,name,level,description,active) VALUES (?,?,?,?,1)');
  Object.entries(ROLES).forEach(([slug, r]) => role.run(slug, r.name, r.level, r.description));
  const perm = db.prepare('INSERT OR IGNORE INTO permissions (slug,name,description,group_name,active) VALUES (?,?,?,?,1)');
  PERMISSIONS.forEach((p) => perm.run(...p));
  const link = db.prepare('INSERT OR IGNORE INTO role_permissions (role_slug,permission_slug) VALUES (?,?)');
  Object.entries(ROLE_DEFAULTS).forEach(([r, ps]) => ps.forEach((p) => link.run(r, p)));
  ready = true;
}

function getUser(userOrId) {
  if (!userOrId) return null;
  if (typeof userOrId === 'object') return userOrId;
  return db.prepare('SELECT id,role,staff_role,status FROM users WHERE id=?').get(Number(userOrId));
}
function staffRole(userOrId) {
  ensure();
  const u = getUser(userOrId);
  if (!u || u.status === 'deleted') return '';
  if (ROLES[u.staff_role]) return u.staff_role;
  return u.role === 'admin' ? 'admin' : '';
}
function isStaff(userOrId) { return !!staffRole(userOrId); }
function isSuperAdmin(userOrId) { return staffRole(userOrId) === 'super_admin'; }
function roleLevel(role) { return ROLES[role] ? ROLES[role].level : 0; }

function permissionsFor(userOrId) {
  ensure();
  const u = getUser(userOrId);
  const role = staffRole(u);
  if (!role) return [];
  const base = new Set(db.prepare('SELECT permission_slug FROM role_permissions WHERE role_slug=?').all(role).map((x) => x.permission_slug));
  db.prepare('SELECT permission_slug,allowed FROM staff_permission_overrides WHERE user_id=?').all(u.id).forEach((x) => {
    if (x.allowed) base.add(x.permission_slug); else base.delete(x.permission_slug);
  });
  return [...base].sort();
}
function hasPermission(userOrId, permission) {
  const role = staffRole(userOrId);
  if (!role) return false;
  return permissionsFor(userOrId).includes(permission);
}
function requireStaff(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'You must be signed in.' });
  if (!isStaff(req.user)) return res.status(403).json({ error: 'Staff access required.' });
  next();
}
function requireAdmin(req, res, next) { return requireStaff(req, res, next); }
function requireSuperAdmin(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'You must be signed in.' });
  if (!isSuperAdmin(req.user)) return res.status(403).json({ error: 'Super Admin access required.' });
  next();
}
function requirePermission(permission) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'You must be signed in.' });
    if (!isStaff(req.user)) return res.status(403).json({ error: 'Staff access required.' });
    if (!hasPermission(req.user, permission)) return res.status(403).json({ error: `Permission required: ${permission}` });
    next();
  };
}
function requireAnyPermission(permissions) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'You must be signed in.' });
    if (!isStaff(req.user)) return res.status(403).json({ error: 'Staff access required.' });
    if (!permissions.some((p) => hasPermission(req.user, p))) return res.status(403).json({ error: 'You do not have permission for this action.' });
    next();
  };
}

function audit(req, { action, targetType = '', targetId = null, detail = '', result = 'success' }) {
  ensure();
  const actor = req && req.user ? req.user.id : null;
  const ip = req ? String(req.ip || req.headers?.['x-forwarded-for'] || '').slice(0, 120) : '';
  const ua = req ? String(req.get?.('user-agent') || '').slice(0, 300) : '';
  const text = String(detail || '').slice(0, 1000);
  db.prepare(`INSERT INTO admin_activity_logs
    (actor_id,action,target_type,target_id,detail,ip_address,user_agent,result,created_at)
    VALUES (?,?,?,?,?,?,?,?,?)`).run(actor, action, targetType, targetId || null, text, ip, ua, result, Date.now());
  // Keep the original admin log endpoint/data compatible with the existing app.
  db.prepare('INSERT INTO admin_logs (admin_id,action,target_type,target_id,detail,created_at) VALUES (?,?,?,?,?,?)')
    .run(actor, action, targetType, targetId || null, text.slice(0, 500), Date.now());
}

function recordModeration(req, { targetType, targetId, action, reason = '', expiresAt = null }) {
  db.prepare(`INSERT INTO moderation_actions (actor_id,target_type,target_id,action,reason,expires_at,created_at)
    VALUES (?,?,?,?,?,?,?)`).run(req.user.id, targetType, targetId, action, String(reason).slice(0, 600), expiresAt, Date.now());
  audit(req, { action: `moderation.${action}`, targetType, targetId, detail: reason });
}

module.exports = {
  ROLES, PERMISSIONS, ALL_PERMISSIONS, ROLE_DEFAULTS, ensure, staffRole, isStaff, isSuperAdmin,
  roleLevel, permissionsFor, hasPermission, requireStaff, requireAdmin, requireSuperAdmin,
  requirePermission, requireAnyPermission, audit, recordModeration,
};
