/* Gen-Z Hub — Business Hub, Gaming Hub, Admin panel, 404 */
(function () {
  'use strict';
  const G = window.GZ, S = G.state, esc = G.esc;

  const BIZ_TOPICS = ['Startups', 'Freelancing', 'Marketing', 'E-commerce', 'Technology', 'Business Ideas', 'Networking'];
  const GAME_TOPICS = ['Esports', 'Mobile Gaming', 'PC Gaming', 'Console Gaming', 'Tournaments', 'Teams'];
  const GAMES = ['Valorant', 'PUBG Mobile', 'Free Fire', 'CS2', 'FIFA / FC', 'Dota 2', 'League of Legends', 'Call of Duty Mobile', 'Minecraft', 'GTA'];

  async function hubView(kind, parts, query) {
    if (!G.requireUser()) return;
    const view = G.mountShell();
    const biz = kind === 'business';
    const joined = biz ? S.user.in_business : S.user.in_gaming;
    const tab = query.tab || 'feed';
    const topic = query.topic || '';
    const nav = biz
      ? [['feed', 'Business Feed'], ['people', 'Discover People'], ['communities', 'Communities'], ['events', 'Events'], ['collab', 'Collaboration'], ['network', 'My Network']]
      : [['feed', 'Gaming Feed'], ['people', 'Discover Gamers'], ['games', 'Games'], ['teams', 'Teams'], ['communities', 'Communities'], ['events', 'Events']];

    view.innerHTML = `
      <div class="hero ${biz ? 'biz' : 'game'}">
        <div class="between wrap" style="gap:14px">
          <div><h1>${biz ? '💼 Business Hub' : '🎮 Gaming Hub'}</h1>
            <p style="margin:0;opacity:.85;max-width:520px">${biz
              ? 'Founders, freelancers and builders. Share ideas, find collaborators and grow your network — no selling, just building.'
              : 'Squads, scrims and clips across mobile, PC and console. Find teammates and join tournaments.'}</p></div>
          <div class="row wrap" id="hub-act"></div>
        </div>
      </div>
      <div class="tabs" style="margin:14px 0">${nav.map(([k, l]) => `<button class="tab ${tab === k ? 'on' : ''}" data-t="${k}">${l}</button>`).join('')}</div>
      <div id="hubbox"></div>`;
    G.qsa('[data-t]', view).forEach((b) => b.onclick = () => { location.hash = `#/${kind}?tab=` + b.dataset.t; });

    const act = G.qs('#hub-act', view);
    const jb = G.el(`<button class="btn ${joined ? 'btn-ghost' : 'btn-accent'}">${joined ? 'Leave hub' : 'Join hub'}</button>`);
    jb.onclick = async () => {
      try {
        await G.post('/me/hubs', { hub: kind, join: !joined });
        G.toast(joined ? 'You left the hub' : 'Welcome to the hub 🎉', 'ok');
        location.reload();
      } catch (e) { G.err(e); }
    };
    act.appendChild(jb);
    if (joined) {
      const pb = G.el('<button class="btn btn-primary">✏️ Post here</button>');
      pb.onclick = () => G.openComposer({ hub: kind, onDone: () => G.render() });
      act.appendChild(pb);
    }

    const box = G.qs('#hubbox', view);
    if (!joined && tab === 'feed') {
      box.innerHTML = `<div class="card pad" style="margin-bottom:14px">${G.emptyState(biz ? '💼' : '🎮',
        `You have not joined the ${biz ? 'Business' : 'Gaming'} Hub yet`,
        'You can still browse public posts below, but joining lets you post and get matched with people.')}</div>`;
    }

    if (tab === 'feed') {
      const feedBox = G.el('<div></div>');
      const topics = biz ? BIZ_TOPICS : GAME_TOPICS;
      box.appendChild(G.el(`<div class="card pad row wrap" style="gap:7px;margin-bottom:14px">
        <a class="chip ${!topic ? 'on' : ''}" href="#/${kind}?tab=feed">All</a>
        ${topics.map((t) => `<a class="chip ${topic === t ? 'on' : ''}" href="#/${kind}?tab=feed&topic=${encodeURIComponent(t)}">${esc(t)}</a>`).join('')}</div>`));
      box.appendChild(feedBox);
      G.feedList(feedBox, `/posts/feed?hub=${kind}` + (topic ? '&topic=' + encodeURIComponent(topic) : ''), {
        empty: G.emptyState('📭', 'No posts here yet', joined ? 'Be the first to post in this hub.' : 'Join the hub to start posting.'),
        composeOpts: { hub: kind, topic },
      });
    } else if (tab === 'people') {
      box.innerHTML = G.skeletonList(4);
      const { users } = await G.get('/users/suggestions?limit=20&hub=' + kind);
      box.innerHTML = '';
      if (!users.length) { box.innerHTML = G.emptyState('🧭', 'No members to show yet', 'Invite friends to join this hub.'); return; }
      const stack = G.el('<div class="stack"></div>');
      users.forEach((u) => stack.appendChild(G.userCard(u)));
      box.appendChild(stack);
    } else if (tab === 'communities') {
      box.innerHTML = G.skeletonList(3);
      const { communities } = await G.get('/communities?hub=' + kind);
      box.innerHTML = '';
      if (!communities.length) { box.innerHTML = G.emptyState('🌐', 'No communities in this hub yet', 'Create one from the Communities page.'); return; }
      const grid = G.el('<div class="grid-cards"></div>');
      communities.forEach((c) => grid.appendChild(G.communityCard(c)));
      box.appendChild(grid);
    } else if (tab === 'events') {
      box.innerHTML = G.skeletonList(2);
      const { events } = await G.get('/events?hub=' + kind);
      box.innerHTML = '';
      const head = G.el(`<div class="between" style="margin-bottom:12px"><h3 style="margin:0">Upcoming ${biz ? 'business' : 'gaming'} events</h3>
        <button class="btn btn-sm btn-primary">＋ Create</button></div>`);
      head.querySelector('button').onclick = () => G.createEvent(kind);
      box.appendChild(head);
      if (!events.length) box.appendChild(G.el(`<div>${G.emptyState('📅', 'No events scheduled', 'Host the first one.')}</div>`));
      const stack = G.el('<div class="stack"></div>');
      events.forEach((ev) => stack.appendChild(G.eventCard(ev)));
      box.appendChild(stack);
    } else if (tab === 'collab') {
      const wrap = G.el(`<div><div class="card pad between wrap" style="margin-bottom:14px">
          <div><h3 style="margin:0">Collaboration board</h3>
          <p class="small muted" style="margin:4px 0 0">Looking for a co-founder, developer, designer or team member? Post it here. This is for networking — not buying or selling.</p></div>
          <button class="btn btn-primary" id="newcollab">＋ Post a collaboration</button></div>
        <div id="collabfeed"></div></div>`);
      box.appendChild(wrap);
      G.qs('#newcollab', wrap).onclick = () => {
        if (!joined) return G.toast('Join Business Hub first.', 'error');
        G.openComposer({ hub: 'business', kind: 'collab', onDone: () => G.render() });
      };
      G.feedList(G.qs('#collabfeed', wrap), '/posts/feed?hub=business&kind=collab', {
        empty: G.emptyState('🤝', 'No collaboration posts yet', 'Describe what you are building and who you need.'),
        composeOpts: { hub: 'business', kind: 'collab' },
      });
    } else if (tab === 'network') {
      box.innerHTML = G.skeletonList(3);
      const data = await G.get('/users/me/connections');
      box.innerHTML = `<div class="card pad between"><div><h3 style="margin:0">My network</h3>
        <p class="small muted" style="margin:4px 0 0">${data.connections.length} connections · ${data.incoming.length} pending requests</p></div>
        <a class="btn btn-ghost btn-sm" href="#/network">Manage</a></div>`;
      const stack = G.el('<div class="stack" style="margin-top:14px"></div>');
      if (!data.connections.length) stack.appendChild(G.el(`<div>${G.emptyState('🤝', 'No connections yet', 'Send requests from the Discover People tab.')}</div>`));
      data.connections.forEach((u) => stack.appendChild(G.userCard(u)));
      box.appendChild(stack);
    } else if (tab === 'games') {
      const fav = (S.user.fav_games || '').split(',').map((x) => x.trim()).filter(Boolean);
      box.innerHTML = `<div class="card pad"><h3 style="margin-top:0">Your games & platform</h3>
        <div class="row wrap" style="gap:7px">${GAMES.map((g) => `<button class="chip ${fav.includes(g) ? 'on' : ''}" data-g="${esc(g)}">${esc(g)}</button>`).join('')}</div>
        <div class="row" style="gap:10px;margin-top:12px">
          <select class="select" id="g-plat" style="width:auto">${['', 'Mobile', 'PC', 'Console'].map((p) => `<option ${S.user.platform === p ? 'selected' : ''}>${p || 'Platform'}</option>`).join('')}</select>
          <input class="input grow" id="g-tag" placeholder="Gamer tag" value="${esc(S.user.gamer_tag || '')}">
          <button class="btn btn-primary" id="g-save">Save</button></div></div>
        <h3 style="margin:18px 0 10px">Game categories</h3>
        <div class="grid-cards">${GAME_TOPICS.map((t) => `<a class="card pad" href="#/${kind}?tab=feed&topic=${encodeURIComponent(t)}">
          <div class="bold">${esc(t)}</div><div class="tiny muted">Browse posts</div></a>`).join('')}</div>`;
      const sel = new Set(fav);
      G.qsa('[data-g]', box).forEach((b) => b.onclick = () => { sel.has(b.dataset.g) ? sel.delete(b.dataset.g) : sel.add(b.dataset.g); b.classList.toggle('on'); });
      G.qs('#g-save', box).onclick = async () => {
        try {
          const r = await G.patch('/me/profile', { full_name: S.user.full_name, bio: S.user.bio, location: S.user.location,
            fav_games: [...sel].join(', '), platform: G.qs('#g-plat', box).value, gamer_tag: G.qs('#g-tag', box).value });
          S.user = r.user; G.toast('Gaming profile saved', 'ok');
        } catch (e) { G.err(e); }
      };
    } else if (tab === 'teams') {
      const wrap = G.el(`<div><div class="card pad between wrap" style="margin-bottom:14px">
          <div><h3 style="margin:0">Team recruitment</h3>
          <p class="small muted" style="margin:4px 0 0">Looking for teammates, running scrims or entering a tournament? Post it here.</p></div>
          <button class="btn btn-primary" id="newteam">＋ Find teammates</button></div><div id="teamfeed"></div></div>`);
      box.appendChild(wrap);
      G.qs('#newteam', wrap).onclick = () => {
        if (!joined) return G.toast('Join Gaming Hub first.', 'error');
        G.openComposer({ hub: 'gaming', kind: 'team', onDone: () => G.render() });
      };
      G.feedList(G.qs('#teamfeed', wrap), '/posts/feed?hub=gaming&kind=team', {
        empty: G.emptyState('🎯', 'No team posts yet', 'Post your role, rank and availability.'),
        composeOpts: { hub: 'gaming', kind: 'team' },
      });
    }
    G.buildRail(kind);
  }

  G.route('business', (p, q) => hubView('business', p, q));
  G.route('gaming', (p, q) => hubView('gaming', p, q));

  /* ---------------- admin ---------------- */
  G.route('admin', async (parts, query) => {
    if (!G.requireUser()) return;
    const view = G.mountShell();
    G.setRail('');
    if (S.user.role !== 'admin') {
      view.innerHTML = G.emptyState('🛡️', 'Admin access required', 'This area is restricted to platform administrators.',
        '<div style="margin-top:12px"><a class="btn btn-ghost btn-sm" href="#/">Back home</a></div>');
      return;
    }
    const tab = query.tab || 'dashboard';
    const TABS = [['dashboard', '📊 Dashboard'], ['users', '👤 Users'], ['posts', '📝 Posts'], ['comments', '💬 Comments'],
      ['groups', '👥 Groups'], ['communities', '🌐 Communities'], ['reports', '🚩 Reports'], ['events', '📅 Events'], ['moderation', '🛡 Moderation'], ['settings', '⚙️ Settings']];
    view.innerHTML = `<div class="card"><div class="pad between wrap"><div><h2 style="margin:0;font-size:19px">Admin Panel</h2>
        <p class="muted small" style="margin:4px 0 0">Role-protected. All actions are verified server-side.</p></div>
        <span class="badge badge-admin">Admin</span></div>
      <div class="tabs">${TABS.map(([k, l]) => `<button class="tab ${tab === k ? 'on' : ''}" data-t="${k}">${l}</button>`).join('')}</div></div>
      <div id="abox" style="margin-top:14px">${G.skeletonList(4)}</div>`;
    G.qsa('[data-t]', view).forEach((b) => b.onclick = () => { location.hash = '#/admin?tab=' + b.dataset.t; });
    const box = G.qs('#abox', view);

    try {
      if (tab === 'dashboard') {
        const s = await G.get('/admin/stats');
        box.innerHTML = `<div class="grid-cards">
          ${[['Total users', s.users], ['Active (24h)', s.active_users], ['New users (7d)', s.signups_7d], ['Suspended', s.suspended],
             ['Posts', s.posts], ['Comments', s.comments], ['Groups', s.groups], ['Communities', s.communities],
             ['Events', s.events], ['Messages', s.messages], ['Open reports', s.open_reports]]
            .map(([l, v]) => `<div class="kpi"><span class="tiny muted">${l}</span><b>${G.num(v)}</b></div>`).join('')}</div>
          <h3 style="margin:20px 0 10px">Recent reports</h3>
          <div class="card pad">${s.recent_reports.length ? s.recent_reports.map((r) => `<div class="between" style="padding:7px 0;border-bottom:1px solid var(--border)">
            <div><b class="small">${esc(r.reason)}</b> <span class="tiny muted">on ${esc(r.target_type)} #${r.target_id} by @${esc(r.reporter)}</span></div>
            <span class="pill">${esc(r.status)}</span></div>`).join('') : '<p class="small muted">No reports submitted.</p>'}
            <a class="btn btn-ghost btn-sm" href="#/admin?tab=reports" style="margin-top:10px">Open report queue</a></div>`;
      } else if (tab === 'users') {
        box.innerHTML = `<form class="card pad row" id="af"><input class="input grow" id="aq" placeholder="Search users by name, username or email" value="${esc(query.q || '')}">
          <button class="btn btn-ghost">Search</button></form><div class="card scroll-x" style="margin-top:14px" id="atbl">${G.skeletonList(3)}</div>`;
        G.qs('#af', box).onsubmit = (e) => { e.preventDefault(); location.hash = '#/admin?tab=users&q=' + encodeURIComponent(G.qs('#aq', box).value.trim()); };
        const { users } = await G.get('/admin/users?q=' + encodeURIComponent(query.q || ''));
        const tbl = G.qs('#atbl', box);
        tbl.innerHTML = `<table class="table"><thead><tr><th>User</th><th>Email</th><th>Role</th><th>Status</th><th>Posts</th><th>Joined</th><th>Actions</th></tr></thead><tbody></tbody></table>`;
        const tb = tbl.querySelector('tbody');
        users.forEach((u) => {
          const tr = G.el(`<tr><td><a class="link" href="#/u/${esc(u.username)}">${esc(u.full_name)}</a><div class="tiny muted">@${esc(u.username)}</div></td>
            <td class="tiny">${esc(u.email)}</td><td>${esc(u.role)}</td>
            <td>${u.status === 'suspended' ? '<span class="badge badge-admin">suspended</span>' : '<span class="pill">active</span>'}</td>
            <td>${u.post_count}</td><td class="tiny">${G.fmtDate(u.created_at)}</td>
            <td><div class="row"><button class="btn btn-sm btn-ghost" data-s>${u.status === 'suspended' ? 'Reinstate' : 'Suspend'}</button>
            <button class="btn btn-sm btn-quiet" data-r>${u.role === 'admin' ? 'Make user' : 'Make admin'}</button></div></td></tr>`);
          G.qs('[data-s]', tr).onclick = async () => {
            try { await G.post(`/admin/users/${u.id}/status`, { status: u.status === 'suspended' ? 'active' : 'suspended' }); G.toast('Updated', 'ok'); G.render(); }
            catch (e) { G.err(e); }
          };
          G.qs('[data-r]', tr).onclick = async () => {
            if (!(await G.confirm('Change role', `Change @${u.username} to ${u.role === 'admin' ? 'user' : 'admin'}?`, 'Change'))) return;
            try { await G.post(`/admin/users/${u.id}/role`, { role: u.role === 'admin' ? 'user' : 'admin' }); G.render(); } catch (e) { G.err(e); }
          };
          tb.appendChild(tr);
        });
        if (!users.length) tbl.innerHTML = G.emptyState('🔍', 'No users found', '');
      } else if (tab === 'posts' || tab === 'moderation') {
        const { posts } = await G.get('/admin/posts');
        box.innerHTML = `<div class="card scroll-x"><table class="table"><thead><tr><th>Author</th><th>Content</th><th>Hub</th><th>Engagement</th><th>Status</th><th>Actions</th></tr></thead><tbody></tbody></table></div>`;
        const tb = box.querySelector('tbody');
        posts.forEach((p) => {
          const tr = G.el(`<tr><td class="tiny">@${esc(p.username)}</td>
            <td><a class="link small" href="#/post/${p.id}">${esc((p.content || '(media only)').slice(0, 70))}</a></td>
            <td class="tiny">${esc(p.hub)}</td><td class="tiny">${p.reaction_count}❤ ${p.comment_count}💬</td>
            <td>${p.removed ? '<span class="badge badge-admin">removed</span>' : '<span class="pill">live</span>'}</td>
            <td><div class="row"><button class="btn btn-sm btn-ghost" data-h>${p.removed ? 'Restore' : 'Hide'}</button>
            <button class="btn btn-sm btn-danger" data-d>Delete</button></div></td></tr>`);
          G.qs('[data-h]', tr).onclick = async () => { try { await G.post(`/admin/posts/${p.id}/remove`, { removed: !p.removed }); G.render(); } catch (e) { G.err(e); } };
          G.qs('[data-d]', tr).onclick = async () => {
            if (!(await G.confirm('Delete post', 'Permanently delete this post?', 'Delete'))) return;
            try { await G.del('/admin/posts/' + p.id); tr.remove(); } catch (e) { G.err(e); }
          };
          tb.appendChild(tr);
        });
        if (!posts.length) box.innerHTML = G.emptyState('📝', 'No posts on the platform yet', '');
      } else if (tab === 'comments') {
        const { comments } = await G.get('/admin/comments');
        box.innerHTML = `<div class="card scroll-x"><table class="table"><thead><tr><th>Author</th><th>Comment</th><th>When</th><th></th></tr></thead><tbody></tbody></table></div>`;
        const tb = box.querySelector('tbody');
        comments.forEach((c) => {
          const tr = G.el(`<tr><td class="tiny">@${esc(c.username)}</td><td class="small">${esc(c.content.slice(0, 90))}</td>
            <td class="tiny">${G.timeAgo(c.created_at)}</td><td><button class="btn btn-sm btn-danger">Delete</button></td></tr>`);
          tr.querySelector('button').onclick = async () => { try { await G.del('/admin/comments/' + c.id); tr.remove(); } catch (e) { G.err(e); } };
          tb.appendChild(tr);
        });
        if (!comments.length) box.innerHTML = G.emptyState('💬', 'No comments yet', '');
      } else if (tab === 'groups' || tab === 'communities') {
        const isG = tab === 'groups';
        const data = await G.get('/admin/' + tab);
        const rows = isG ? data.groups : data.communities;
        box.innerHTML = `<div class="card scroll-x"><table class="table"><thead><tr><th>Name</th><th>Hub</th><th>Members</th><th>Created</th><th></th></tr></thead><tbody></tbody></table></div>`;
        const tb = box.querySelector('tbody');
        rows.forEach((r) => {
          const tr = G.el(`<tr><td><a class="link" href="#/${isG ? 'group/' + r.id : 'c/' + r.slug}">${esc(r.name)}</a></td>
            <td class="tiny">${esc(r.hub)}</td><td>${r.member_count}</td><td class="tiny">${G.fmtDate(r.created_at)}</td>
            <td><button class="btn btn-sm btn-danger">Delete</button></td></tr>`);
          tr.querySelector('button').onclick = async () => {
            if (!(await G.confirm('Delete ' + (isG ? 'group' : 'community'), 'This removes it and all its posts.', 'Delete'))) return;
            try { await G.del(`/admin/${tab}/${r.id}`); tr.remove(); } catch (e) { G.err(e); }
          };
          tb.appendChild(tr);
        });
        if (!rows.length) box.innerHTML = G.emptyState(isG ? '👥' : '🌐', 'Nothing here yet', '');
      } else if (tab === 'events') {
        const { events } = await G.get('/admin/events');
        box.innerHTML = `<div class="card scroll-x"><table class="table"><thead><tr><th>Event</th><th>Host</th><th>When</th><th>Hub</th><th></th></tr></thead><tbody></tbody></table></div>`;
        const tb = box.querySelector('tbody');
        events.forEach((ev) => {
          const tr = G.el(`<tr><td><a class="link" href="#/event/${ev.id}">${esc(ev.title)}</a></td><td class="tiny">@${esc(ev.host)}</td>
            <td class="tiny">${G.fmtDateTime(ev.starts_at)}</td><td class="tiny">${esc(ev.hub)}</td>
            <td><button class="btn btn-sm btn-danger">Delete</button></td></tr>`);
          tr.querySelector('button').onclick = async () => { try { await G.del('/admin/events/' + ev.id); tr.remove(); } catch (e) { G.err(e); } };
          tb.appendChild(tr);
        });
        if (!events.length) box.innerHTML = G.emptyState('📅', 'No events yet', '');
      } else if (tab === 'reports') {
        const status = query.status || 'open';
        box.innerHTML = `<div class="tabs" style="margin-bottom:14px">${['open', 'resolved', 'dismissed'].map((s) =>
          `<button class="tab ${status === s ? 'on' : ''}" data-s="${s}">${s}</button>`).join('')}</div><div id="rlist">${G.skeletonList(3)}</div>`;
        G.qsa('[data-s]', box).forEach((b) => b.onclick = () => { location.hash = '#/admin?tab=reports&status=' + b.dataset.s; });
        const { reports } = await G.get('/admin/reports?status=' + status);
        const list = G.qs('#rlist', box);
        list.innerHTML = '';
        if (!reports.length) { list.innerHTML = G.emptyState('✅', `No ${status} reports`, 'The moderation queue is clear.'); return; }
        reports.forEach((r) => {
          const card = G.el(`<div class="card pad" style="margin-bottom:10px">
            <div class="between wrap"><div><b>${esc(r.reason)}</b> <span class="pill">${esc(r.target_type)} #${r.target_id}</span>
              <div class="small muted" style="margin-top:4px">${esc(r.preview || '')}</div>
              ${r.details ? `<div class="small" style="margin-top:6px">“${esc(r.details)}”</div>` : ''}
              <div class="tiny muted" style="margin-top:4px">Reported by @${esc(r.reporter)} · ${G.timeAgo(r.created_at)}</div></div>
              <div class="row wrap" data-actions></div></div></div>`);
          const a = G.qs('[data-actions]', card);
          if (r.status === 'open') {
            [['remove_content', 'Remove content', 'btn-danger'], ['resolve', 'Mark resolved', 'btn-ghost'], ['dismiss', 'Dismiss', 'btn-quiet']].forEach(([action, label, cls]) => {
              const b = G.el(`<button class="btn btn-sm ${cls}">${label}</button>`);
              b.onclick = async () => { try { await G.post('/admin/reports/' + r.id, { action }); G.toast('Report handled', 'ok'); G.render(); } catch (e) { G.err(e); } };
              a.appendChild(b);
            });
          } else a.appendChild(G.el(`<span class="pill">${esc(r.status)}</span>`));
          list.appendChild(card);
        });
      } else {
        const s = await G.get('/admin/stats');
        box.innerHTML = `<div class="card pad stack">
          <div><div class="label">Platform</div><div class="small">Gen-Z Hub · Connect. Build. Play. Grow.</div></div>
          <div><div class="label">Storage</div><div class="small">${G.num(s.posts)} posts · ${G.num(s.messages)} messages · uploads stored on the server file system.</div></div>
          <div><div class="label">Security</div><ul class="small muted" style="margin:0;padding-left:18px;line-height:1.8">
            <li>Passwords hashed with bcrypt (cost 12) — never stored or exposed in plaintext.</li>
            <li>Session tokens in httpOnly cookies with server-side expiry.</li>
            <li>All admin endpoints re-check the admin role server-side.</li>
            <li>Uploads restricted by MIME type and 25 MB size limit.</li>
            <li>Rate limiting on auth, posting, commenting, messaging and uploads.</li></ul></div>
          <div><div class="label">Admin credentials</div><div class="small muted">Configured via ADMIN_EMAIL / ADMIN_PASSWORD environment variables.</div></div></div>`;
      }
    } catch (e) {
      box.innerHTML = G.errorState(e.message, 'ad-retry');
      const b = G.qs('#ad-retry', box); if (b) b.onclick = () => G.render();
    }
  });

  /* ---------------- 404 ---------------- */
  G.route('404', async () => {
    const view = S.user ? G.mountShell() : G.mountFull('');
    view.innerHTML = G.emptyState('🧭', 'Page not found', 'That link does not exist on Gen-Z Hub.',
      '<div style="margin-top:12px"><a class="btn btn-primary btn-sm" href="#/">Go home</a></div>');
  });
})();
