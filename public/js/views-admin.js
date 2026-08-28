/* Gen-Z Hub — functional RBAC admin UI. Loaded after the legacy hub views so it owns #/admin. */
(function () {
  'use strict';
  const G = window.GZ, S = G.state, esc = G.esc;

  G.route('admin', async (parts, query) => {
    if (!G.requireUser()) return;
    const view = G.mountShell();
    G.setRail('');
    let access;
    try { access = await G.get('/admin/access'); }
    catch (e) { view.innerHTML = G.errorState(e.message); return; }
    if (!access.staff) { view.innerHTML = G.emptyState('🛡️', 'Staff access required', 'This area is restricted to authorized platform staff.'); return; }

    const perms = new Set(access.permissions || []);
    const can = (p) => perms.has(p);
    const active = query.tab || 'dashboard';
    const tabs = [
      ['dashboard', '📊 Overview', 'analytics.view'], ['users', '👤 Users', 'users.view'],
      ['posts', '📝 Posts', 'posts.view'], ['comments', '💬 Comments', 'comments.moderate'],
      ['reports', '🚩 Reports', 'reports.view'], ['communities', '🌐 Communities', 'communities.view'], ['groups', '👥 Groups', 'communities.view'], ['events', '📅 Events', 'communities.view'],
      ['categories', '🏷 Categories', 'categories.manage'], ['staff', '🧩 Staff', 'staff.view'], ['announcements', '📣 Announcements', 'announcements.manage'],
      ['notifications', '🔔 Notifications', 'notifications.manage'],
      ['audit', '🧾 Audit logs', 'audit_logs.view'], ['settings', '⚙️ Settings', 'settings.manage'],
      ['health', '🩺 Health', 'system.health'],
    ].filter((x) => can(x[2]));
    view.innerHTML = `<div class="card">
      <div class="pad between wrap"><div><h2 style="margin:0;font-size:21px">Admin Control Center</h2>
        <p class="muted small" style="margin:4px 0 0">${esc(access.role_name)} · permission-protected platform operations</p></div>
        <span class="badge badge-admin">${esc(access.role_name)}</span></div>
      <div class="tabs" style="overflow-x:auto">${tabs.map(([k, label]) => `<button class="tab ${active === k ? 'on' : ''}" data-tab="${k}">${label}</button>`).join('')}</div></div>
      <div id="admin-body" style="margin-top:14px">${G.skeletonList(4)}</div>`;
    G.qsa('[data-tab]', view).forEach((b) => b.onclick = () => { location.hash = '#/admin?tab=' + b.dataset.tab; });
    const body = G.qs('#admin-body', view);
    try { await renderTab(active, body, access, can, query); }
    catch (e) { body.innerHTML = G.errorState(e.message, 'admin-retry'); const b = G.qs('#admin-retry', body); if (b) b.onclick = () => G.render(); }
  });

  async function renderTab(tab, body, access, can, query) {
    if (tab === 'dashboard') return dashboard(body);
    if (tab === 'users') return users(body, can, query);
    if (tab === 'posts') return posts(body, can);
    if (tab === 'comments') return comments(body);
    if (tab === 'reports') return reports(body, can);
    if (tab === 'communities') return communities(body, can);
    if (tab === 'groups') return groups(body, can);
    if (tab === 'events') return events(body, can);
    if (tab === 'categories') return categories(body);
    if (tab === 'staff') return staff(body, access);
    if (tab === 'announcements') return announcements(body);
    if (tab === 'notifications') return notifications(body);
    if (tab === 'audit') return audit(body);
    if (tab === 'settings') return settings(body);
    if (tab === 'health') return health(body);
    body.innerHTML = G.emptyState('🛡️', 'Unknown admin section', 'Choose a section from the dashboard tabs.');
  }

  async function dashboard(body) {
    const [s, h] = await Promise.all([G.get('/admin/analytics'), G.get('/admin/health')]);
    const cards = [['Users', s.users], ['Active 24h', s.active_users], ['New today', s.new_users_today], ['Posts', s.posts],
      ['Comments', s.comments], ['Pending reports', s.pending_reports], ['Banned', s.banned_users], ['Communities', s.communities],
      ['Engagement', s.engagement], ['Video watch seconds', Math.round(s.video_watches || 0)]];
    body.innerHTML = `<div class="grid-cards">${cards.map(([l, v]) => `<div class="kpi"><span class="tiny muted">${l}</span><b>${G.num(v)}</b></div>`).join('')}</div>
      <div class="card pad" style="margin-top:14px"><div class="between"><b>System snapshot</b><a class="btn btn-ghost btn-sm" href="#/admin?tab=health">Details</a></div>
      <div class="small muted" style="margin-top:8px">Status: ${esc(h.status)} · Uptime: ${h.uptime_s}s · RSS memory: ${h.memory_mb.rss}MB · Video queue: ${h.video_queue}</div></div>`;
  }

  async function users(body, can, query) {
    const q = (query && query.q) || '';
    const status = (query && query.status) || '';
    const data = await G.get('/admin/users?q=' + encodeURIComponent(q) + '&status=' + encodeURIComponent(status));
    body.innerHTML = `<form class="card pad row wrap" id="admin-user-search" style="margin-bottom:14px"><input class="input grow" id="admin-user-q" placeholder="Search name, username or email" value="${esc(q)}"><select class="select" id="admin-user-status"><option value="">All statuses</option><option value="active" ${status === 'active' ? 'selected' : ''}>Active</option><option value="suspended" ${status === 'suspended' ? 'selected' : ''}>Suspended</option><option value="banned" ${status === 'banned' ? 'selected' : ''}>Banned</option></select><button class="btn btn-ghost">Search</button></form>
      <div class="card scroll-x"><table class="table"><thead><tr><th>User</th><th>Email</th><th>Staff role</th><th>Status</th><th>Posts</th><th>Actions</th></tr></thead><tbody></tbody></table></div>`;
    G.qs('#admin-user-search', body).onsubmit = (e) => { e.preventDefault(); const qs = new URLSearchParams({ q: G.qs('#admin-user-q', body).value.trim(), status: G.qs('#admin-user-status', body).value }); location.hash = '#/admin?tab=users&' + qs.toString(); };
    const tb = body.querySelector('tbody');
    data.users.forEach((u) => {
      const staff = u.staff_role || (u.role === 'admin' ? 'admin' : '');
      const action = u.status === 'banned' ? 'Unban' : u.status === 'suspended' ? 'Reinstate' : 'Suspend';
      const tr = G.el(`<tr><td><a class="link" href="#/u/${esc(u.username)}">${esc(u.full_name)}</a><div class="tiny muted">@${esc(u.username)}</div></td>
        <td class="tiny">${esc(u.email)}</td><td class="small">${esc(staff || 'Member')}</td><td><span class="pill">${esc(u.status)}</span></td><td>${u.post_count}</td><td><div class="row wrap">
        ${can('users.edit') ? '<button class="btn btn-sm btn-quiet" data-edit>Edit</button>' : ''}
        ${can('users.suspend') || can('users.ban') ? `<button class="btn btn-sm btn-ghost" data-status>${action}</button>` : ''}
        ${can('users.ban') && u.status === 'active' ? '<button class="btn btn-sm btn-danger" data-ban>Ban</button>' : ''}
        ${can('moderation.warn') ? '<button class="btn btn-sm btn-quiet" data-warn>Warn</button>' : ''}
        ${can('moderation.restrict') ? '<button class="btn btn-sm btn-quiet" data-restrict>Restrict</button>' : ''}
        ${can('users.delete') ? '<button class="btn btn-sm btn-danger" data-delete>Delete</button>' : ''}</div></td></tr>`);
      const ue = tr.querySelector('[data-edit]');
      if (ue) ue.onclick = async () => {
        const fullName = prompt('Edit full name', u.full_name);
        if (fullName === null) return;
        try { await G.patch(`/admin/users/${u.id}`, { full_name: fullName }); G.toast('User updated', 'ok'); G.render(); } catch (e) { G.err(e); }
      };
      const sb = tr.querySelector('[data-status]');
      if (sb) sb.onclick = async () => {
        const next = u.status === 'banned' || u.status === 'suspended' ? 'active' : 'suspended';
        if (!(await G.confirm(next === 'active' ? 'Restore account' : 'Suspend account', `Change @${u.username} to ${next}?`, 'Continue'))) return;
        try { await G.post(`/admin/users/${u.id}/status`, { status: next }); G.toast('User status updated', 'ok'); G.render(); } catch (e) { G.err(e); }
      };
      const ban = tr.querySelector('[data-ban]');
      if (ban) ban.onclick = async () => { const reason = prompt('Ban reason'); if (!reason) return; if (!(await G.confirm('Ban user', `Ban @${u.username}?`, 'Ban'))) return; try { await G.post(`/admin/users/${u.id}/status`, { status: 'banned', reason }); G.toast('User banned', 'ok'); G.render(); } catch (e) { G.err(e); } };
      const wb = tr.querySelector('[data-warn]');
      if (wb) wb.onclick = async () => { const reason = prompt('Warning reason'); if (reason) try { await G.post(`/admin/users/${u.id}/warn`, { reason }); G.toast('Warning issued', 'ok'); } catch (e) { G.err(e); } };
      const rb = tr.querySelector('[data-restrict]');
      if (rb) rb.onclick = async () => { const mins = prompt('Restriction duration in minutes', '60'); if (mins) try { await G.post(`/admin/users/${u.id}/restrict`, { minutes: Number(mins), reason: 'Staff restriction' }); G.toast('User restricted', 'ok'); } catch (e) { G.err(e); } };
      const db = tr.querySelector('[data-delete]');
      if (db) db.onclick = async () => { if (!(await G.confirm('Delete user permanently', `Delete @${u.username} and their content?`, 'Delete'))) return; try { await G.del(`/admin/users/${u.id}`); tr.remove(); G.toast('User deleted', 'ok'); } catch (e) { G.err(e); } };
      tb.appendChild(tr);
    });
    if (!data.users.length) body.innerHTML = G.emptyState('👤', 'No users found', 'Try another search.');
  }

  async function posts(body, can) {
    const data = await G.get('/admin/posts');
    body.innerHTML = `<div class="card scroll-x"><table class="table"><thead><tr><th>Post</th><th>Author</th><th>Engagement</th><th>Status</th><th>Actions</th></tr></thead><tbody></tbody></table></div>`;
    const tb = body.querySelector('tbody');
    data.posts.forEach((p) => {
      const tr = G.el(`<tr><td><a class="link small" href="#/post/${p.id}">${esc((p.content || '(media post)').slice(0, 90))}</a></td><td class="tiny">@${esc(p.username)}</td>
        <td class="tiny">${p.reaction_count} reactions · ${p.comment_count} comments</td><td><span class="pill">${p.removed ? 'removed' : 'live'}</span></td><td><div class="row">
        ${can('posts.moderate') ? `<button class="btn btn-sm btn-ghost" data-hide>${p.removed ? 'Restore' : 'Hide'}</button>` : ''}
        ${can('posts.edit') ? '<button class="btn btn-sm btn-quiet" data-edit>Edit</button>' : ''}
        ${can('posts.delete') ? '<button class="btn btn-sm btn-danger" data-delete>Delete</button>' : ''}</div></td></tr>`);
      const hb = tr.querySelector('[data-hide]'); if (hb) hb.onclick = async () => { try { await G.post(`/admin/posts/${p.id}/remove`, { removed: !p.removed }); G.toast('Post status updated', 'ok'); G.render(); } catch (e) { G.err(e); } };
      const eb = tr.querySelector('[data-edit]'); if (eb) eb.onclick = async () => { const content = prompt('Edit post content', p.content || ''); if (content === null) return; try { await G.patch(`/admin/posts/${p.id}`, { content }); G.toast('Post edited', 'ok'); G.render(); } catch (e) { G.err(e); } };
      const db = tr.querySelector('[data-delete]'); if (db) db.onclick = async () => { if (!(await G.confirm('Delete post', 'This cannot be undone.', 'Delete'))) return; try { await G.del(`/admin/posts/${p.id}`); tr.remove(); } catch (e) { G.err(e); } };
      tb.appendChild(tr);
    });
  }

  async function comments(body) {
    const data = await G.get('/admin/comments');
    body.innerHTML = `<div class="card scroll-x"><table class="table"><thead><tr><th>Comment</th><th>Author</th><th>Post</th><th>Action</th></tr></thead><tbody></tbody></table></div>`;
    const tb = body.querySelector('tbody');
    data.comments.forEach((c) => {
      const tr = G.el(`<tr><td class="small">${esc(c.content.slice(0, 160))}</td><td class="tiny">@${esc(c.username)}</td><td><a class="link" href="#/post/${c.post_id}">#${c.post_id}</a></td><td><button class="btn btn-sm btn-danger">Remove</button></td></tr>`);
      tr.querySelector('button').onclick = async () => { if (!(await G.confirm('Remove comment', 'Remove this comment/reply?', 'Remove'))) return; try { await G.del('/admin/comments/' + c.id); tr.remove(); } catch (e) { G.err(e); } };
      tb.appendChild(tr);
    });
  }

  async function reports(body, can) {
    const data = await G.get('/admin/reports?status=open');
    body.innerHTML = `<div class="between wrap" style="margin-bottom:10px"><h3 style="margin:0">Open reports</h3><span class="pill">${data.reports.length} pending</span></div><div id="report-list"></div>`;
    const list = G.qs('#report-list', body);
    data.reports.forEach((r) => {
      const card = G.el(`<div class="card pad" style="margin-bottom:10px"><div class="between wrap"><div><b>${esc(r.reason)}</b><span class="pill" style="margin-left:7px">${esc(r.target_type)} #${r.target_id}</span>
        <div class="small muted" style="margin-top:6px">${esc(r.preview || '')}</div><div class="tiny muted" style="margin-top:5px">Reported by @${esc(r.reporter)} · ${G.timeAgo(r.created_at)}</div></div><div class="row wrap" data-actions></div></div></div>`);
      const actions = card.querySelector('[data-actions]');
      if (!can('reports.manage')) { actions.innerHTML = '<span class="tiny muted">Read-only access</span>'; list.appendChild(card); return; }
      [['remove_content', 'Remove', 'btn-danger'], ['resolve', 'Resolve', 'btn-ghost'], ['dismiss', 'Dismiss', 'btn-quiet']].forEach(([a, label, cls]) => {
        const b = G.el(`<button class="btn btn-sm ${cls}">${label}</button>`); b.onclick = async () => { try { await G.post(`/admin/reports/${r.id}`, { action: a }); G.toast('Report handled', 'ok'); G.render(); } catch (e) { G.err(e); } }; actions.appendChild(b);
      });
      list.appendChild(card);
    });
    if (!data.reports.length) list.innerHTML = G.emptyState('✅', 'No open reports', 'The moderation queue is clear.');
  }

  async function communities(body, can) {
    const data = await G.get('/admin/communities');
    body.innerHTML = `<div class="card scroll-x"><table class="table"><thead><tr><th>Community</th><th>Hub</th><th>Members</th><th>Created</th><th></th></tr></thead><tbody></tbody></table></div>`;
    const tb = body.querySelector('tbody');
    data.communities.forEach((c) => {
      const tr = G.el(`<tr><td><a class="link" href="#/c/${esc(c.slug)}">${esc(c.name)}</a></td><td>${esc(c.hub)}</td><td>${c.member_count}</td><td class="tiny">${G.fmtDate(c.created_at)}</td><td>${can('communities.manage') ? '<button class="btn btn-sm btn-danger">Delete</button>' : ''}</td></tr>`);
      const b = tr.querySelector('button'); if (b) b.onclick = async () => { if (!(await G.confirm('Delete community', 'Remove community and its posts?', 'Delete'))) return; try { await G.del('/admin/communities/' + c.id); tr.remove(); } catch (e) { G.err(e); } };
      tb.appendChild(tr);
    });
  }

  async function groups(body, can) {
    const data = await G.get('/admin/groups');
    body.innerHTML = `<div class="card scroll-x"><table class="table"><thead><tr><th>Group</th><th>Hub</th><th>Owner</th><th>Members</th><th>Action</th></tr></thead><tbody></tbody></table></div>`;
    const tb = body.querySelector('tbody');
    data.groups.forEach((g) => {
      const tr = G.el(`<tr><td><a class="link" href="#/group/${g.id}">${esc(g.name)}</a></td><td>${esc(g.hub)}</td><td>@${esc(g.owner)}</td><td>${g.member_count}</td><td>${can('communities.manage') ? '<button class="btn btn-sm btn-danger">Delete</button>' : ''}</td></tr>`);
      const b = tr.querySelector('button'); if (b) b.onclick = async () => { if (!(await G.confirm('Delete group', 'Remove this group and its posts?', 'Delete'))) return; try { await G.del('/admin/groups/' + g.id); tr.remove(); } catch (e) { G.err(e); } };
      tb.appendChild(tr);
    });
  }

  async function events(body, can) {
    const data = await G.get('/admin/events');
    body.innerHTML = `<div class="card scroll-x"><table class="table"><thead><tr><th>Event</th><th>Host</th><th>Hub</th><th>When</th><th>Action</th></tr></thead><tbody></tbody></table></div>`;
    const tb = body.querySelector('tbody');
    data.events.forEach((ev) => {
      const tr = G.el(`<tr><td><a class="link" href="#/event/${ev.id}">${esc(ev.title)}</a></td><td>@${esc(ev.host)}</td><td>${esc(ev.hub)}</td><td class="tiny">${G.fmtDateTime(ev.starts_at)}</td><td>${can('communities.manage') ? '<button class="btn btn-sm btn-danger">Delete</button>' : ''}</td></tr>`);
      const b = tr.querySelector('button'); if (b) b.onclick = async () => { if (!(await G.confirm('Delete event', 'Remove this event?', 'Delete'))) return; try { await G.del('/admin/events/' + ev.id); tr.remove(); } catch (e) { G.err(e); } };
      tb.appendChild(tr);
    });
  }

  async function categories(body) {
    const data = await G.get('/admin/categories');
    body.innerHTML = `<div class="card pad"><p class="small muted" style="margin-top:0">Manage the recommendation categories used to classify and rank posts.</p><div id="category-list"></div></div>`;
    const list = G.qs('#category-list', body);
    data.categories.forEach((c) => {
      const row = G.el(`<form class="row wrap" style="padding:8px 0;border-top:1px solid var(--line-soft)"><input class="input grow" value="${esc(c.name)}" data-name><span class="pill">${esc(c.slug)}</span><label class="small"><input type="checkbox" data-active ${c.active ? 'checked' : ''}> Active</label><button class="btn btn-sm btn-ghost">Save</button></form>`);
      row.onsubmit = async (e) => { e.preventDefault(); try { await G.patch('/admin/categories/' + encodeURIComponent(c.slug), { name: row.querySelector('[data-name]').value, active: row.querySelector('[data-active]').checked }); G.toast('Category updated', 'ok'); } catch (x) { G.err(x); } };
      list.appendChild(row);
    });
  }

  async function staff(body, access) {
    const data = await G.get('/admin/staff');
    body.innerHTML = `<div class="card scroll-x"><table class="table"><thead><tr><th>Staff</th><th>Role</th><th>Status</th><th>Permissions</th><th>Actions</th></tr></thead><tbody></tbody></table></div>`;
    const tb = body.querySelector('tbody');
    data.staff.forEach((u) => {
      const options = Object.keys({ super_admin: 1, admin: 1, moderator: 1, support_staff: 1 }).map((r) => `<option value="${r}" ${u.staff_role === r ? 'selected' : ''}>${r}</option>`).join('');
      const editable = access.role === 'super_admin' && u.id !== S.user.id;
      const tr = G.el(`<tr><td><b>${esc(u.full_name)}</b><div class="tiny muted">@${esc(u.username)} · ${esc(u.email)}</div></td><td>${editable ? `<select class="select" data-role>${options}</select>` : `<span class="pill">${esc(u.staff_role)}</span>`}</td>
        <td><span class="pill">${esc(u.status)}</span></td><td class="tiny">${u.permissions.length} permissions</td><td>${editable ? '<div class="row"><button class="btn btn-sm btn-primary" data-save>Save role</button><button class="btn btn-sm btn-ghost" data-perms>Permissions</button></div>' : ''}</td></tr>`);
      const save = tr.querySelector('[data-save]'); if (save) save.onclick = async () => { try { await G.post(`/admin/staff/${u.id}/role`, { staff_role: tr.querySelector('[data-role]').value }); G.toast('Staff role updated', 'ok'); G.render(); } catch (e) { G.err(e); } };
      const pb = tr.querySelector('[data-perms]'); if (pb) pb.onclick = () => permissionModal(u);
      tb.appendChild(tr);
    });
  }

  async function permissionModal(staffUser) {
    try {
      const rbac = await G.get('/admin/rbac');
      const current = new Set(staffUser.permissions);
      const m = G.modal('Staff permissions', `<p class="small muted" style="margin-top:0">${esc(staffUser.full_name)} · unchecked permissions become explicit denials.</p>
        <div class="stack" style="max-height:52vh;overflow:auto">${rbac.permissions.map((p) => `<label class="row small"><input type="checkbox" data-perm="${esc(p.slug)}" ${current.has(p.slug) ? 'checked' : ''}> <span><b>${esc(p.name)}</b><br><span class="tiny muted">${esc(p.slug)}</span></span></label>`).join('')}</div>
        <div class="row" style="justify-content:flex-end;margin-top:14px"><button class="btn btn-primary" id="save-permissions">Save permissions</button></div>`);
      G.qs('#save-permissions', m.body).onclick = async () => {
        const overrides = rbac.permissions.map((p) => ({ permission: p.slug, allowed: !!G.qs(`[data-perm="${p.slug}"]`, m.body)?.checked }));
        try { await G.put(`/admin/staff/${staffUser.id}/permissions`, { overrides }); m.close(); G.toast('Permissions updated', 'ok'); G.render(); } catch (e) { G.err(e); }
      };
    } catch (e) { G.err(e); }
  }

  async function announcements(body) {
    const data = await G.get('/admin/announcements');
    body.innerHTML = `<div class="card pad" style="margin-bottom:14px"><h3 style="margin:0 0 12px">New announcement</h3><form id="ann-form" class="stack"><input class="input" id="ann-title" placeholder="Announcement title" maxlength="140"><textarea class="textarea" id="ann-body" placeholder="Message for the platform" maxlength="2000"></textarea><div class="row wrap"><select class="select" id="ann-audience"><option value="all">All active users</option><option value="staff">Staff only</option></select><select class="select" id="ann-status"><option value="draft">Save draft</option><option value="published">Publish now</option></select><button class="btn btn-primary" type="submit">Create announcement</button></div></form></div><div id="ann-list"></div>`;
    G.qs('#ann-form', body).onsubmit = async (e) => { e.preventDefault(); try { await G.post('/admin/announcements', { title: G.qs('#ann-title', body).value, body: G.qs('#ann-body', body).value, audience: G.qs('#ann-audience', body).value, status: G.qs('#ann-status', body).value }); G.toast('Announcement created', 'ok'); G.render(); } catch (x) { G.err(x); } };
    const list = G.qs('#ann-list', body);
    data.announcements.forEach((a) => list.appendChild(G.el(`<div class="card pad" style="margin-bottom:10px"><div class="between"><b>${esc(a.title)}</b><span class="pill">${esc(a.status)}</span></div><div class="small muted" style="margin-top:6px">${esc(a.body)}</div><div class="tiny muted" style="margin-top:6px">${G.fmtDateTime(a.created_at)} · ${esc(a.audience)}</div></div>`)));
  }

  async function notifications(body) {
    body.innerHTML = `<div class="card pad"><h3 style="margin:0 0 12px">Send platform notification</h3><form id="notify-form" class="stack"><input class="input" id="notify-user" placeholder="User ID (leave empty for everyone)"><textarea class="textarea" id="notify-text" maxlength="900" placeholder="Notification message"></textarea><input class="input" id="notify-link" maxlength="300" placeholder="Link (optional, for example #/admin)"><button class="btn btn-primary" type="submit">Send notification</button></form></div>`;
    G.qs('#notify-form', body).onsubmit = async (e) => { e.preventDefault(); try { const user = G.qs('#notify-user', body).value.trim(); const r = await G.post('/admin/notifications', { user_id: user ? Number(user) : null, text: G.qs('#notify-text', body).value, link: G.qs('#notify-link', body).value }); G.toast(`Notification sent to ${r.count} user(s)`, 'ok'); e.target.reset(); } catch (x) { G.err(x); } };
  }

  async function audit(body) {
    const data = await G.get('/admin/audit-logs?limit=150');
    body.innerHTML = `<div class="card scroll-x"><table class="table"><thead><tr><th>When</th><th>Actor</th><th>Action</th><th>Target</th><th>Result</th><th>Details</th></tr></thead><tbody></tbody></table></div>`;
    const tb = body.querySelector('tbody');
    data.logs.forEach((l) => tb.appendChild(G.el(`<tr><td class="tiny">${G.fmtDateTime(l.created_at)}</td><td>${esc(l.actor_name || l.actor_username || 'System')}</td><td class="small">${esc(l.action)}</td><td class="tiny">${esc(l.target_type)} ${l.target_id || ''}</td><td><span class="pill">${esc(l.result)}</span></td><td class="tiny">${esc(l.detail || '')}</td></tr>`)));
  }

  async function settings(body) {
    const data = await G.get('/admin/settings');
    const s = data.settings || {};
    body.innerHTML = `<div class="card pad"><h3 style="margin:0 0 12px">Platform settings</h3><form id="platform-settings" class="stack"><label class="field"><span class="label">Platform notice</span><input class="input" id="ps-notice" value="${esc(s.platform_notice || '')}" maxlength="300"></label><label class="field"><span class="label">Signup open</span><select class="select" id="ps-signup"><option value="1" ${s.signup_open !== '0' ? 'selected' : ''}>Yes</option><option value="0" ${s.signup_open === '0' ? 'selected' : ''}>No</option></select></label><label class="field"><span class="label">Recommendation exploration</span><input class="input" type="number" step="0.01" min="0.1" max="0.2" id="ps-explore" value="${esc(s.rec_exploration_pct || '0.15')}"></label><button class="btn btn-primary" type="submit">Save settings</button></form></div>`;
    G.qs('#platform-settings', body).onsubmit = async (e) => { e.preventDefault(); try { await G.put('/admin/settings', { platform_notice: G.qs('#ps-notice', body).value, signup_open: G.qs('#ps-signup', body).value, rec_exploration_pct: G.qs('#ps-explore', body).value }); G.toast('Settings saved', 'ok'); } catch (x) { G.err(x); } };
  }

  async function health(body) {
    const h = await G.get('/admin/health');
    body.innerHTML = `<div class="grid-cards">${[['Status', h.status], ['Uptime', h.uptime_s + 's'], ['Node', h.node], ['RSS memory', h.memory_mb.rss + ' MB'], ['Heap used', h.memory_mb.heap_used + ' MB'], ['Video queue', h.video_queue]].map(([l, v]) => `<div class="kpi"><span class="tiny muted">${esc(l)}</span><b style="font-size:19px">${esc(v)}</b></div>`).join('')}</div>`;
  }
})();
