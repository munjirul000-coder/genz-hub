/* Gen-Z Hub — groups, communities, events, saved, settings */
(function () {
  'use strict';
  const G = window.GZ, S = G.state, esc = G.esc;

  /* ---------------- groups list ---------------- */
  G.route('groups', async (parts, query) => {
    if (!G.requireUser()) return;
    const view = G.mountShell();
    const tab = query.tab || 'discover';
    view.innerHTML = `<div class="card pad between wrap"><div><h2 style="margin:0;font-size:19px">${esc(G.t('Groups'))}</h2>
        <p class="muted small" style="margin:4px 0 0">Private and public spaces with roles, rules and their own feed.</p></div>
      <button class="btn btn-primary" id="newg">＋ Create group</button></div>
      <div class="tabs" style="margin:14px 0">
        <button class="tab ${tab === 'discover' ? 'on' : ''}" data-t="discover">Discover</button>
        <button class="tab ${tab === 'mine' ? 'on' : ''}" data-t="mine">My groups</button></div>
      <div class="grid-cards" id="glist">${G.skeletonList(3)}</div>`;
    G.qsa('[data-t]', view).forEach((b) => b.onclick = () => { location.hash = '#/groups?tab=' + b.dataset.t; });
    G.qs('#newg', view).onclick = createGroup;
    const box = G.qs('#glist', view);
    try {
      const { groups } = await G.get('/groups' + (tab === 'mine' ? '?mine=1' : ''));
      box.innerHTML = '';
      if (!groups.length) {
        box.innerHTML = G.emptyState('👥', tab === 'mine' ? 'You have not joined any groups' : 'No groups yet',
          'Create the first one and invite your people.');
        return;
      }
      groups.forEach((g) => box.appendChild(G.groupCard(g)));
    } catch (e) { box.innerHTML = G.errorState(e.message); }
    G.buildRail();
  });

  function createGroup() {
    const m = G.modal('Create a group', `
      <div class="field"><label class="label" for="g-n">Group name</label><input class="input" id="g-n" maxlength="60"></div>
      <div class="field"><label class="label" for="g-d">Description</label><textarea class="textarea" id="g-d" maxlength="800"></textarea></div>
      <div class="row" style="gap:10px">
        <div class="field grow"><label class="label" for="g-c">Category</label><input class="input" id="g-c" placeholder="Startups, Esports…" maxlength="40"></div>
        <div class="field grow"><label class="label" for="g-h">Hub</label><select class="select" id="g-h">
          <option value="general">General</option><option value="business">Business</option><option value="gaming">Gaming</option></select></div>
      </div>
      <div class="field"><label class="label" for="g-p">Privacy</label><select class="select" id="g-p">
        <option value="public">🌍 Public — anyone can join and read</option>
        <option value="private">🔒 Private — requests must be approved</option></select></div>
      <div class="field"><label class="label" for="g-r">Rules</label><textarea class="textarea" id="g-r" maxlength="1000" placeholder="1. Be respectful…"></textarea></div>
      <div class="field"><label class="label" for="g-cov">Cover image (optional)</label><input class="input" type="file" id="g-cov" accept="image/*"></div>
      <div class="err" id="g-err" hidden></div>
      <button class="btn btn-primary btn-block" id="g-go">Create group</button>`);
    G.qs('#g-go', m.body).onclick = async (e) => {
      e.target.disabled = true;
      const err = G.qs('#g-err', m.body); err.hidden = true;
      try {
        const body = {
          name: G.qs('#g-n', m.body).value, description: G.qs('#g-d', m.body).value, category: G.qs('#g-c', m.body).value,
          hub: G.qs('#g-h', m.body).value, privacy: G.qs('#g-p', m.body).value, rules: G.qs('#g-r', m.body).value,
        };
        const f = G.qs('#g-cov', m.body).files;
        if (f.length) body.cover = (await G.uploadFiles(f))[0].url;
        const r = await G.post('/groups', body);
        m.close(); location.hash = '#/group/' + r.group.id;
      } catch (ex) { err.textContent = ex.message; err.hidden = false; e.target.disabled = false; }
    };
  }

  /* ---------------- group detail ---------------- */
  G.route('group', async (parts, query) => {
    if (!G.requireUser()) return;
    const view = G.mountShell();
    G.setRail('');
    const id = Number(parts[0]);
    const tab = query.tab || 'feed';
    view.innerHTML = G.skeletonPost();
    let g;
    try { g = (await G.get('/groups/' + id)).group; }
    catch (e) { view.innerHTML = G.emptyState('🚫', 'Group unavailable', e.message); return; }
    const isMember = !!g.my_role;
    const isAdmin = ['owner', 'admin'].includes(g.my_role);
    view.innerHTML = `<div class="card" style="overflow:hidden">
        <div class="cover" style="height:150px">${g.cover ? `<img src="${esc(g.cover)}" alt="${esc(g.name)} cover">` : ''}</div>
        <div class="pad">
          <div class="between wrap"><div><h2 style="margin:0">${esc(g.name)}</h2>
            <div class="muted small">${G.num(g.member_count)} members · ${esc(g.category)} · ${g.privacy === 'private' ? '🔒 Private group' : '🌍 Public group'}
            ${g.hub !== 'general' ? ` · ${g.hub === 'business' ? '💼 Business' : '🎮 Gaming'}` : ''}</div></div>
            <div class="row wrap" id="gact"></div></div>
          <p class="small" style="margin:10px 0 0">${esc(g.description || '')}</p>
        </div>
        <div class="tabs">${['feed', 'about', 'members', 'rules', 'media'].map((t) => `<button class="tab ${tab === t ? 'on' : ''}" data-t="${t}">${t[0].toUpperCase() + t.slice(1)}</button>`).join('')}
        ${isAdmin ? `<button class="tab ${tab === 'manage' ? 'on' : ''}" data-t="manage">⚙️ Manage</button>` : ''}</div>
      </div><div id="gbox" style="margin-top:14px"></div>`;
    G.qsa('[data-t]', view).forEach((b) => b.onclick = () => { location.hash = `#/group/${id}?tab=` + b.dataset.t; });

    const act = G.qs('#gact', view);
    if (isMember) {
      const post = G.el('<button class="btn btn-primary">✏️ Post</button>');
      post.onclick = () => G.openComposer({ group_id: id, onDone: () => G.render() });
      act.appendChild(post);
      if (g.my_role !== 'owner') {
        const leave = G.el('<button class="btn btn-ghost">Leave</button>');
        leave.onclick = async () => {
          if (!(await G.confirm('Leave group', 'You will lose access to member-only posts.', 'Leave'))) return;
          try { await G.post(`/groups/${id}/leave`); G.render(); } catch (e) { G.err(e); }
        };
        act.appendChild(leave);
      }
    } else {
      const join = G.el(`<button class="btn btn-primary">${g.my_status === 'pending' ? '⏳ Requested' : g.privacy === 'private' ? 'Request to join' : 'Join group'}</button>`);
      join.disabled = g.my_status === 'pending';
      join.onclick = async () => {
        try { const r = await G.post(`/groups/${id}/join`); G.toast(r.status === 'pending' ? 'Request sent to admins' : 'Joined!', 'ok'); G.render(); }
        catch (e) { G.err(e); }
      };
      act.appendChild(join);
    }
    const rep = G.el('<button class="btn btn-ghost">🚩</button>');
    rep.onclick = () => G.reportModal('group', id);
    act.appendChild(rep);

    const box = G.qs('#gbox', view);
    if (tab === 'feed' || tab === 'media') {
      if (g.privacy === 'private' && !isMember) { box.innerHTML = G.emptyState('🔒', 'This group is private', 'Join to see posts and members.'); return; }
      G.feedList(box, `/groups/${id}/feed`, { empty: G.emptyState('📝', 'No posts in this group yet', isMember ? 'Start the first discussion.' : 'Join to participate.'), composeOpts: { group_id: id } });
    } else if (tab === 'about') {
      box.innerHTML = `<div class="card pad stack">
        <div><div class="label">Description</div><div>${esc(g.description || '—')}</div></div>
        <div><div class="label">Category</div><div>${esc(g.category)}</div></div>
        <div><div class="label">Privacy</div><div>${g.privacy === 'private' ? 'Private — approval required' : 'Public — open to everyone'}</div></div>
        <div><div class="label">Owner</div><div><a class="link" href="#/u/${esc(g.owner_username)}">${esc(g.owner_name)}</a></div></div>
        <div><div class="label">Created</div><div>${G.fmtDate(g.created_at)}</div></div></div>`;
    } else if (tab === 'rules') {
      box.innerHTML = `<div class="card pad"><h3 style="margin-top:0">Group rules</h3>
        <div style="white-space:pre-wrap">${esc(g.rules || 'No rules have been set for this group yet.')}</div></div>`;
    } else if (tab === 'members' || tab === 'manage') {
      box.innerHTML = G.skeletonList(3);
      const { members, pending } = await G.get(`/groups/${id}/members`);
      box.innerHTML = '';
      if (tab === 'manage') {
        const pendBox = G.el(`<div class="card pad" style="margin-bottom:14px"><h3 style="margin-top:0">Join requests (${pending.length})</h3></div>`);
        if (!pending.length) pendBox.appendChild(G.el('<p class="small muted">No pending requests.</p>'));
        pending.forEach((u) => {
          const row = G.el(`<div class="row" style="padding:6px 0">${G.avatar(u, 36)}
            <div class="grow"><div class="bold small">${esc(u.full_name)}</div><div class="tiny muted">@${esc(u.username)}</div></div>
            <button class="btn btn-sm btn-primary" data-a="approve">Approve</button>
            <button class="btn btn-sm btn-ghost" data-a="decline">Decline</button></div>`);
          G.qsa('[data-a]', row).forEach((b) => b.onclick = async () => {
            try { await G.post(`/groups/${id}/members/${u.id}`, { action: b.dataset.a }); row.remove(); G.toast('Updated', 'ok'); } catch (e) { G.err(e); }
          });
          pendBox.appendChild(row);
        });
        box.appendChild(pendBox);
        const editBtn = G.el('<button class="btn btn-ghost btn-block" style="margin-bottom:14px">✏️ Edit group info</button>');
        editBtn.onclick = () => editGroup(g);
        box.appendChild(editBtn);
        if (g.my_role === 'owner') {
          const del = G.el('<button class="btn btn-danger btn-block" style="margin-bottom:14px">🗑 Delete group</button>');
          del.onclick = async () => {
            if (!(await G.confirm('Delete group', 'All group posts and memberships will be removed.', 'Delete'))) return;
            try { await G.del('/groups/' + id); location.hash = '#/groups'; } catch (e) { G.err(e); }
          };
          box.appendChild(del);
        }
      }
      const list = G.el(`<div class="card pad"><h3 style="margin-top:0">Members (${members.length})</h3></div>`);
      members.forEach((u) => {
        const row = G.el(`<div class="row" style="padding:7px 0">
          <a href="#/u/${esc(u.username)}">${G.avatar(u, 36)}</a>
          <div class="grow"><a class="bold small" href="#/u/${esc(u.username)}">${esc(u.full_name)}</a>
            <div class="tiny muted">@${esc(u.username)} · ${esc(u.role)}</div></div>
          <div class="row" data-act></div></div>`);
        if (tab === 'manage' && u.role !== 'owner' && u.id !== S.user.id) {
          const sel = G.el(`<select class="select btn-sm" style="width:auto" aria-label="Role for ${esc(u.username)}">
            ${['member', 'moderator', 'admin'].map((r) => `<option ${u.role === r ? 'selected' : ''}>${r}</option>`).join('')}</select>`);
          sel.onchange = async () => { try { await G.post(`/groups/${id}/members/${u.id}`, { action: sel.value }); G.toast('Role updated', 'ok'); } catch (e) { G.err(e); } };
          const rm = G.el('<button class="btn btn-sm btn-danger">Remove</button>');
          rm.onclick = async () => { try { await G.post(`/groups/${id}/members/${u.id}`, { action: 'remove' }); row.remove(); } catch (e) { G.err(e); } };
          G.qs('[data-act]', row).append(sel, rm);
        }
        list.appendChild(row);
      });
      box.appendChild(list);
    }
  });

  function editGroup(g) {
    const m = G.modal('Edit group', `
      <div class="field"><label class="label" for="eg-n">Name</label><input class="input" id="eg-n" value="${esc(g.name)}"></div>
      <div class="field"><label class="label" for="eg-d">Description</label><textarea class="textarea" id="eg-d">${esc(g.description || '')}</textarea></div>
      <div class="field"><label class="label" for="eg-c">Category</label><input class="input" id="eg-c" value="${esc(g.category)}"></div>
      <div class="field"><label class="label" for="eg-p">Privacy</label><select class="select" id="eg-p">
        <option value="public" ${g.privacy === 'public' ? 'selected' : ''}>Public</option>
        <option value="private" ${g.privacy === 'private' ? 'selected' : ''}>Private</option></select></div>
      <div class="field"><label class="label" for="eg-r">Rules</label><textarea class="textarea" id="eg-r">${esc(g.rules || '')}</textarea></div>
      <div class="field"><label class="label" for="eg-cov">Cover image</label><input class="input" type="file" id="eg-cov" accept="image/*"></div>
      <button class="btn btn-primary btn-block" id="eg-go">Save changes</button>`);
    G.qs('#eg-go', m.body).onclick = async (e) => {
      e.target.disabled = true;
      try {
        const body = { name: G.qs('#eg-n', m.body).value, description: G.qs('#eg-d', m.body).value, category: G.qs('#eg-c', m.body).value,
          privacy: G.qs('#eg-p', m.body).value, rules: G.qs('#eg-r', m.body).value };
        const f = G.qs('#eg-cov', m.body).files;
        if (f.length) body.cover = (await G.uploadFiles(f))[0].url;
        await G.patch('/groups/' + g.id, body);
        m.close(); G.toast('Group updated', 'ok'); G.render();
      } catch (ex) { G.err(ex); e.target.disabled = false; }
    };
  }

  /* ---------------- communities ---------------- */
  G.route('communities', async (parts, query) => {
    if (!G.requireUser()) return;
    const view = G.mountShell();
    const q = query.q || '';
    view.innerHTML = `<div class="card pad between wrap"><div><h2 style="margin:0;font-size:19px">${esc(G.t('Communities'))}</h2>
        <p class="muted small" style="margin:4px 0 0">Topic-focused spaces open to everyone on Gen-Z Hub.</p></div>
      <button class="btn btn-primary" id="newc">＋ Create community</button></div>
      <form class="card pad row" id="cf" style="margin:14px 0"><input class="input grow" id="cq" placeholder="Search communities" value="${esc(q)}">
        <button class="btn btn-ghost">Search</button></form>
      <div class="grid-cards" id="clist">${G.skeletonList(3)}</div>`;
    G.qs('#cf', view).onsubmit = (e) => { e.preventDefault(); location.hash = '#/communities?q=' + encodeURIComponent(G.qs('#cq', view).value.trim()); };
    G.qs('#newc', view).onclick = createCommunity;
    const box = G.qs('#clist', view);
    try {
      const { communities } = await G.get('/communities' + (q ? '?q=' + encodeURIComponent(q) : ''));
      box.innerHTML = '';
      if (!communities.length) { box.innerHTML = G.emptyState('🌐', 'No communities found', 'Try another search or create one.'); return; }
      communities.forEach((c) => box.appendChild(G.communityCard(c)));
    } catch (e) { box.innerHTML = G.errorState(e.message); }
    G.buildRail();
  });

  function createCommunity() {
    const m = G.modal('Create a community', `
      <div class="field"><label class="label" for="c-n">Name</label><input class="input" id="c-n" maxlength="60"></div>
      <div class="field"><label class="label" for="c-d">Description</label><textarea class="textarea" id="c-d" maxlength="600"></textarea></div>
      <div class="row" style="gap:10px">
        <div class="field grow"><label class="label" for="c-h">Hub</label><select class="select" id="c-h">
          <option value="general">General</option><option value="business">Business</option><option value="gaming">Gaming</option></select></div>
        <div class="field grow"><label class="label" for="c-c">Category</label><input class="input" id="c-c" maxlength="40"></div></div>
      <div class="field"><label class="label" for="c-r">Rules</label><textarea class="textarea" id="c-r" maxlength="1000"></textarea></div>
      <div class="err" id="c-err" hidden></div>
      <button class="btn btn-primary btn-block" id="c-go">Create community</button>`);
    G.qs('#c-go', m.body).onclick = async (e) => {
      e.target.disabled = true;
      const err = G.qs('#c-err', m.body); err.hidden = true;
      try {
        const r = await G.post('/communities', { name: G.qs('#c-n', m.body).value, description: G.qs('#c-d', m.body).value,
          hub: G.qs('#c-h', m.body).value, category: G.qs('#c-c', m.body).value, rules: G.qs('#c-r', m.body).value });
        m.close(); location.hash = '#/c/' + r.community.slug;
      } catch (ex) { err.textContent = ex.message; err.hidden = false; e.target.disabled = false; }
    };
  }

  G.route('c', async (parts, query) => {
    if (!G.requireUser()) return;
    const view = G.mountShell();
    G.setRail('');
    const slug = parts[0];
    const tab = query.tab || 'feed';
    view.innerHTML = G.skeletonPost();
    let c;
    try { c = (await G.get('/communities/' + encodeURIComponent(slug))).community; }
    catch (e) { view.innerHTML = G.emptyState('🚫', 'Community unavailable', e.message); return; }
    view.innerHTML = `<div class="card">
        <div class="pad"><div class="between wrap">
          <div class="row"><div class="avatar" style="width:54px;height:54px;font-size:22px;background:linear-gradient(135deg,var(--brand-1),var(--brand-2))">${esc(c.name[0])}</div>
            <div><h2 style="margin:0">${esc(c.name)}</h2>
            <div class="muted small">${G.num(c.member_count)} members · ${esc(c.category || '')} ${c.hub !== 'general' ? '· ' + (c.hub === 'business' ? '💼 Business Hub' : '🎮 Gaming Hub') : ''}</div></div></div>
          <div class="row" id="cact"></div></div>
          <p class="small" style="margin:10px 0 0">${esc(c.description || '')}</p></div>
        <div class="tabs">${['feed', 'about', 'members', 'rules'].map((t) => `<button class="tab ${tab === t ? 'on' : ''}" data-t="${t}">${t[0].toUpperCase() + t.slice(1)}</button>`).join('')}</div>
      </div><div id="cbox" style="margin-top:14px"></div>`;
    G.qsa('[data-t]', view).forEach((b) => b.onclick = () => { location.hash = `#/c/${slug}?tab=` + b.dataset.t; });
    const act = G.qs('#cact', view);
    const join = G.el(`<button class="btn ${c.my_role ? 'btn-ghost' : 'btn-primary'}">${c.my_role ? (c.my_role === 'owner' ? 'Owner' : 'Leave') : 'Join'}</button>`);
    join.onclick = async () => { try { await G.post(`/communities/${c.id}/join`); G.render(); } catch (e) { G.err(e); } };
    act.appendChild(join);
    if (c.my_role) {
      const p = G.el('<button class="btn btn-primary">✏️ Post</button>');
      p.onclick = () => G.openComposer({ community_id: c.id, onDone: () => G.render() });
      act.appendChild(p);
    }
    const rp = G.el('<button class="btn btn-ghost">🚩</button>');
    rp.onclick = () => G.reportModal('community', c.id);
    act.appendChild(rp);

    const box = G.qs('#cbox', view);
    if (tab === 'feed') {
      G.feedList(box, `/communities/${c.id}/feed`, { empty: G.emptyState('💬', 'No posts in this community yet', c.my_role ? 'Start the first discussion.' : 'Join to post here.'), composeOpts: { community_id: c.id } });
    } else if (tab === 'about') {
      box.innerHTML = `<div class="card pad stack"><div><div class="label">About</div><div>${esc(c.description || '—')}</div></div>
        <div><div class="label">Hub</div><div>${esc(c.hub)}</div></div>
        <div><div class="label">Created</div><div>${G.fmtDate(c.created_at)}</div></div></div>`;
    } else if (tab === 'rules') {
      box.innerHTML = `<div class="card pad"><h3 style="margin-top:0">Community rules</h3>
        <div style="white-space:pre-wrap">${esc(c.rules || 'Be respectful, stay on topic, and no spam.')}</div></div>`;
    } else {
      box.innerHTML = G.skeletonList(3);
      const { members } = await G.get(`/communities/${c.id}/members`);
      box.innerHTML = '';
      if (!members.length) { box.innerHTML = G.emptyState('👥', 'No members yet', 'Be the first to join.'); return; }
      const card = G.el(`<div class="card pad"><h3 style="margin-top:0">Members (${members.length})</h3></div>`);
      members.forEach((u) => card.appendChild(G.el(`<div class="row" style="padding:6px 0">
        <a href="#/u/${esc(u.username)}">${G.avatar(u, 36)}</a>
        <div class="grow"><a class="bold small" href="#/u/${esc(u.username)}">${esc(u.full_name)}</a>
        <div class="tiny muted">@${esc(u.username)} · ${esc(u.role)}</div></div></div>`)));
      box.appendChild(card);
    }
  });

  /* ---------------- events ---------------- */
  G.route('events', async (parts, query) => {
    if (!G.requireUser()) return;
    const view = G.mountShell();
    const hub = query.hub || '';
    view.innerHTML = `<div class="card pad between wrap"><div><h2 style="margin:0;font-size:19px">${esc(G.t('Events'))}</h2>
        <p class="muted small" style="margin:4px 0 0">Meetups, workshops, scrims and tournaments.</p></div>
      <button class="btn btn-primary" id="newe">＋ Create event</button></div>
      <div class="tabs" style="margin:14px 0">${[['', 'All'], ['business', '💼 Business'], ['gaming', '🎮 Gaming'], ['general', '🌍 General']].map(([k, l]) =>
        `<button class="tab ${hub === k ? 'on' : ''}" data-h="${k}">${l}</button>`).join('')}</div>
      <div class="stack" id="elist">${G.skeletonList(3)}</div>`;
    G.qsa('[data-h]', view).forEach((b) => b.onclick = () => { location.hash = '#/events' + (b.dataset.h ? '?hub=' + b.dataset.h : ''); });
    G.qs('#newe', view).onclick = createEvent;
    const box = G.qs('#elist', view);
    try {
      const { events } = await G.get('/events' + (hub ? '?hub=' + hub : ''));
      box.innerHTML = '';
      if (!events.length) { box.innerHTML = G.emptyState('📅', 'No upcoming events', 'Create the first one for your community.'); return; }
      events.forEach((ev) => box.appendChild(G.eventCard(ev)));
    } catch (e) { box.innerHTML = G.errorState(e.message); }
    G.buildRail();
  });

  function createEvent(prefHub) {
    const m = G.modal('Create an event', `
      <div class="field"><label class="label" for="ev-t">Title</label><input class="input" id="ev-t" maxlength="100"></div>
      <div class="field"><label class="label" for="ev-d">Description</label><textarea class="textarea" id="ev-d" maxlength="1500"></textarea></div>
      <div class="row" style="gap:10px"><div class="field grow"><label class="label" for="ev-dt">Date & time</label><input class="input" type="datetime-local" id="ev-dt"></div>
        <div class="field grow"><label class="label" for="ev-m">Type</label><select class="select" id="ev-m"><option value="online">💻 Online</option><option value="physical">📍 In person</option></select></div></div>
      <div class="field"><label class="label" for="ev-l">Location / link (optional)</label><input class="input" id="ev-l" maxlength="120"></div>
      <div class="field"><label class="label" for="ev-h">Hub</label><select class="select" id="ev-h">
        <option value="general">General</option><option value="business">Business</option><option value="gaming">Gaming</option></select></div>
      <div class="field"><label class="label" for="ev-c">Cover image (optional)</label><input class="input" type="file" id="ev-c" accept="image/*"></div>
      <div class="err" id="ev-err" hidden></div>
      <button class="btn btn-primary btn-block" id="ev-go">Create event</button>`);
    if (prefHub) G.qs('#ev-h', m.body).value = prefHub;
    G.qs('#ev-go', m.body).onclick = async (e) => {
      const err = G.qs('#ev-err', m.body); err.hidden = true;
      const dt = G.qs('#ev-dt', m.body).value;
      if (!dt) { err.textContent = 'Choose a date and time.'; err.hidden = false; return; }
      e.target.disabled = true;
      try {
        const body = { title: G.qs('#ev-t', m.body).value, description: G.qs('#ev-d', m.body).value, starts_at: new Date(dt).getTime(),
          mode: G.qs('#ev-m', m.body).value, location: G.qs('#ev-l', m.body).value, hub: G.qs('#ev-h', m.body).value };
        const f = G.qs('#ev-c', m.body).files;
        if (f.length) body.cover = (await G.uploadFiles(f))[0].url;
        const r = await G.post('/events', body);
        m.close(); location.hash = '#/event/' + r.event.id;
      } catch (ex) { err.textContent = ex.message; err.hidden = false; e.target.disabled = false; }
    };
  }
  G.createEvent = createEvent;

  G.route('event', async (parts) => {
    if (!G.requireUser()) return;
    const view = G.mountShell();
    const id = Number(parts[0]);
    view.innerHTML = G.skeletonPost();
    let ev;
    try { ev = (await G.get('/events/' + id)).event; }
    catch (e) { view.innerHTML = G.emptyState('🚫', 'Event unavailable', e.message); return; }
    view.innerHTML = `<div class="card" style="overflow:hidden">
      <div class="cover" style="height:170px">${ev.cover ? `<img src="${esc(ev.cover)}" alt="">` : ''}</div>
      <div class="pad">
        <h2 style="margin:0 0 6px">${esc(ev.title)}</h2>
        <div class="muted small">${G.fmtDateTime(ev.starts_at)} · ${ev.mode === 'online' ? '💻 Online' : '📍 ' + esc(ev.location || 'In person')}</div>
        <div class="row" style="margin:10px 0">${G.avatar(ev, 34)}<div class="small">Hosted by <a class="link" href="#/u/${esc(ev.username)}">${esc(ev.full_name)}</a></div></div>
        <p style="white-space:pre-wrap">${esc(ev.description || '')}</p>
        <div class="row small muted" style="gap:14px"><span>${G.num(ev.going_count)} going</span><span>${G.num(ev.interested_count)} interested</span></div>
        <div id="evact" style="margin-top:12px"></div>
      </div></div>`;
    const act = G.qs('#evact', view);
    act.appendChild(G.eventCard(ev, () => G.render()));
    const row = G.el('<div class="row wrap" style="margin-top:10px;gap:8px"></div>');
    const share = G.el('<button class="btn btn-ghost btn-sm">🔁 Share to feed</button>');
    share.onclick = async () => { try { await G.post(`/events/${id}/share`, { content: 'Joining this 👇' }); G.toast('Shared to your feed', 'ok'); } catch (e) { G.err(e); } };
    const save = G.el(`<button class="btn btn-ghost btn-sm">${ev.is_saved ? '🔖 Saved' : '📑 Save'}</button>`);
    save.onclick = async () => { try { const r = await G.post(`/events/${id}/save`); save.textContent = r.saved ? '🔖 Saved' : '📑 Save'; } catch (e) { G.err(e); } };
    row.append(share, save);
    if (S.user.id === ev.host_id || S.user.role === 'admin') {
      const del = G.el('<button class="btn btn-danger btn-sm">🗑 Delete event</button>');
      del.onclick = async () => {
        if (!(await G.confirm('Delete event', 'Attendees will lose access to this event.', 'Delete'))) return;
        try { await G.del('/events/' + id); location.hash = '#/events'; } catch (e) { G.err(e); }
      };
      row.appendChild(del);
    }
    act.appendChild(row);
    G.buildRail();
  });

  /* ---------------- saved ---------------- */
  G.route('saved', async () => {
    if (!G.requireUser()) return;
    const view = G.mountShell();
    view.innerHTML = `<div class="card pad"><h2 style="margin:0;font-size:19px">${esc(G.t('Saved'))}</h2>
      <p class="muted small" style="margin:4px 0 0">Posts and events you bookmarked. Only you can see this.</p></div>
      <div id="sbox" style="margin-top:14px">${G.skeletonPost()}</div>`;
    const box = G.qs('#sbox', view);
    try {
      const { posts, events } = await G.get('/posts/saved');
      box.innerHTML = '';
      if (!posts.length && !events.length) { box.innerHTML = G.emptyState('🔖', 'Nothing saved yet', 'Tap Save on any post or event to keep it here.'); return; }
      if (events.length) {
        box.appendChild(G.el('<h3 style="margin:6px 0 10px">Saved events</h3>'));
        events.forEach((ev) => {
          const card = G.el(`<div class="card pad between" style="margin-bottom:10px"><div><a class="bold" href="#/event/${ev.id}">${esc(ev.title)}</a>
            <div class="tiny muted">${G.fmtDateTime(ev.starts_at)}</div></div>
            <button class="btn btn-sm btn-ghost">Remove</button></div>`);
          card.querySelector('button').onclick = async () => { try { await G.post(`/events/${ev.id}/save`); card.remove(); } catch (e) { G.err(e); } };
          box.appendChild(card);
        });
      }
      if (posts.length) {
        box.appendChild(G.el('<h3 style="margin:16px 0 10px">Saved posts</h3>'));
        posts.forEach((p) => box.appendChild(G.postCard(p)));
      }
    } catch (e) { box.innerHTML = G.errorState(e.message); }
    G.buildRail();
  });

  /* ---------------- settings ---------------- */
  G.route('settings', async (parts, query) => {
    if (!G.requireUser()) return;
    const view = G.mountShell();
    G.setRail('');
    const tab = query.tab || 'account';
    const u = S.user;
    view.innerHTML = `<div class="card"><div class="pad"><h2 style="margin:0;font-size:19px">${esc(G.t('Settings'))}</h2></div>
      <div class="tabs">${[['account', 'Account'], ['profile', 'Profile'], ['privacy', 'Privacy'], ['notifications', 'Notifications'], ['appearance', 'Appearance'], ['language', 'Language']]
        .map(([k, l]) => `<button class="tab ${tab === k ? 'on' : ''}" data-t="${k}">${l}</button>`).join('')}</div></div>
      <div id="sview" style="margin-top:14px"></div>`;
    G.qsa('[data-t]', view).forEach((b) => b.onclick = () => { location.hash = '#/settings?tab=' + b.dataset.t; });
    const box = G.qs('#sview', view);

    const save = async (body, msg) => {
      try { const r = await G.patch('/me/settings', body); S.user = r.user; G.toast(msg || 'Saved', 'ok'); return true; }
      catch (e) { G.err(e); return false; }
    };

    if (tab === 'account') {
      box.innerHTML = `<div class="card pad stack">
        <div><div class="label">Email</div><form class="row" id="f-email"><input class="input grow" id="s-email" value="${esc(u.email)}" type="email"><button class="btn btn-ghost">Update</button></form></div>
        <div><div class="label">Username</div><form class="row" id="f-user"><input class="input grow" id="s-user" value="${esc(u.username)}"><button class="btn btn-ghost">Update</button></form></div>
        <div class="divider"></div>
        <div><div class="label">Change password</div><form class="stack" id="f-pw">
          <input class="input" id="s-cur" type="password" placeholder="Current password" autocomplete="current-password">
          <input class="input" id="s-new" type="password" placeholder="New password (min 8, letters + numbers)" autocomplete="new-password">
          <button class="btn btn-primary">Change password</button></form></div>
        <div class="divider"></div>
        <div><div class="label">Danger zone</div>
          <button class="btn btn-danger" id="s-del">Delete my account permanently</button>
          <p class="tiny muted">This removes your profile, posts, messages and memberships.</p></div></div>`;
      G.qs('#f-email', box).onsubmit = async (e) => { e.preventDefault(); try { await G.post('/me/email', { email: G.qs('#s-email', box).value }); G.toast('Email updated', 'ok'); } catch (ex) { G.err(ex); } };
      G.qs('#f-user', box).onsubmit = async (e) => { e.preventDefault(); try { const r = await G.post('/me/username', { username: G.qs('#s-user', box).value }); S.user.username = r.username; G.toast('Username updated', 'ok'); } catch (ex) { G.err(ex); } };
      G.qs('#f-pw', box).onsubmit = async (e) => {
        e.preventDefault();
        try { await G.post('/auth/change-password', { current: G.qs('#s-cur', box).value, next: G.qs('#s-new', box).value }); G.toast('Password changed. Other sessions signed out.', 'ok'); e.target.reset(); }
        catch (ex) { G.err(ex); }
      };
      G.qs('#s-del', box).onclick = async () => {
        if (!(await G.confirm('Delete account', 'This cannot be undone. All your content will be permanently deleted.', 'Delete account'))) return;
        try { await G.del('/me/account'); location.hash = '#/auth'; location.reload(); } catch (e) { G.err(e); }
      };
    } else if (tab === 'profile') {
      const chosen = new Set((u.interests || []).map((i) => i.id));
      box.innerHTML = `<div class="card pad stack">
        <button class="btn btn-primary" id="s-editp">✏️ Edit profile details</button>
        <div><div class="label">Your interests</div>
          <div class="row wrap" style="gap:7px" id="s-ints">${S.interests.map((i) => `<button class="chip ${chosen.has(i.id) ? 'on' : ''}" data-i="${i.id}">${esc(i.name)}</button>`).join('')}</div>
          <button class="btn btn-ghost btn-sm" id="s-saveint" style="margin-top:10px">Save interests</button></div>
        <div class="divider"></div>
        <div><div class="label">Hubs</div>
          <div class="row wrap" style="gap:8px">
            <button class="btn ${u.in_business ? 'btn-ghost' : 'btn-primary'}" data-hub="business">${u.in_business ? 'Leave Business Hub' : 'Join Business Hub'}</button>
            <button class="btn ${u.in_gaming ? 'btn-ghost' : 'btn-primary'}" data-hub="gaming">${u.in_gaming ? 'Leave Gaming Hub' : 'Join Gaming Hub'}</button>
          </div></div></div>`;
      G.qs('#s-editp', box).onclick = () => G.editProfile(u);
      G.qsa('[data-i]', box).forEach((b) => b.onclick = () => { const id = Number(b.dataset.i); chosen.has(id) ? chosen.delete(id) : chosen.add(id); b.classList.toggle('on'); });
      G.qs('#s-saveint', box).onclick = async () => {
        try { await G.put('/me/interests', { interest_ids: [...chosen] }); G.toast('Interests updated', 'ok'); } catch (e) { G.err(e); }
      };
      G.qsa('[data-hub]', box).forEach((b) => b.onclick = async () => {
        const hub = b.dataset.hub;
        const joining = !(hub === 'business' ? u.in_business : u.in_gaming);
        try { await G.post('/me/hubs', { hub, join: joining }); location.reload(); } catch (e) { G.err(e); }
      });
    } else if (tab === 'privacy') {
      box.innerHTML = `<div class="card pad stack">
        <div><div class="label" >Profile visibility</div>
          <select class="select" id="s-pv"><option value="public" ${u.profile_visibility === 'public' ? 'selected' : ''}>Public — anyone on Gen-Z Hub</option>
            <option value="connections" ${u.profile_visibility === 'connections' ? 'selected' : ''}>Connections only</option></select></div>
        <div><div class="label">Default post privacy</div>
          <select class="select" id="s-dp">${['public', 'connections', 'private'].map((x) => `<option value="${x}" ${u.default_post_privacy === x ? 'selected' : ''}>${x}</option>`).join('')}</select></div>
        <button class="btn btn-primary" id="s-psave">Save privacy settings</button>
        <div class="divider"></div>
        <div><div class="label">Blocked users</div><div id="s-blocked">${G.skeletonList(1)}</div></div></div>`;
      G.qs('#s-psave', box).onclick = () => save({ profile_visibility: G.qs('#s-pv', box).value, default_post_privacy: G.qs('#s-dp', box).value }, 'Privacy updated');
      G.get('/users/me/blocked').then(({ users }) => {
        const bb = G.qs('#s-blocked', box);
        bb.innerHTML = users.length ? '' : '<p class="small muted">You have not blocked anyone.</p>';
        users.forEach((bu) => {
          const row = G.el(`<div class="row" style="padding:6px 0">${G.avatar(bu, 34)}<div class="grow"><div class="bold small">${esc(bu.full_name)}</div>
            <div class="tiny muted">@${esc(bu.username)}</div></div><button class="btn btn-sm btn-ghost">Unblock</button></div>`);
          row.querySelector('button').onclick = async () => { try { await G.post(`/users/${bu.id}/block`); row.remove(); G.toast('Unblocked', 'ok'); } catch (e) { G.err(e); } };
          bb.appendChild(row);
        });
      }).catch(() => {});
    } else if (tab === 'notifications') {
      const p = u.notif_prefs || {};
      box.innerHTML = `<div class="card pad stack">
        ${[['like', 'Likes and reactions'], ['comment', 'Comments, replies and mentions'], ['message', 'Direct messages'], ['follow', 'Follows and connections'], ['group', 'Group and community activity']]
          .map(([k, l]) => `<label class="between"><span>${l}</span><input type="checkbox" data-n="${k}" ${p[k] === 0 ? '' : 'checked'}></label>`).join('')}
        <button class="btn btn-primary" id="s-nsave">Save notification settings</button></div>`;
      G.qs('#s-nsave', box).onclick = () => {
        const prefs = {};
        G.qsa('[data-n]', box).forEach((c) => prefs[c.dataset.n] = c.checked ? 1 : 0);
        save({ notif_prefs: prefs }, 'Notification settings saved');
      };
    } else if (tab === 'appearance') {
      box.innerHTML = `<div class="card pad stack"><div class="label">Theme</div>
        <div class="row wrap" style="gap:8px">${[['light', '☀️ Light'], ['dark', '🌙 Dark'], ['system', '🖥️ System']].map(([k, l]) =>
          `<button class="chip ${u.theme === k ? 'on' : ''}" data-th="${k}">${l}</button>`).join('')}</div>
        <p class="small muted">Your theme preference is stored on your account and applied on every device.</p></div>`;
      G.qsa('[data-th]', box).forEach((b) => b.onclick = async () => {
        G.applyTheme(b.dataset.th);
        if (await save({ theme: b.dataset.th }, 'Theme updated')) G.render();
      });
    } else {
      box.innerHTML = `<div class="card pad stack"><div class="label">Language</div>
        <div class="row wrap" style="gap:8px">${[['en', '🇬🇧 English'], ['bn', '🇧🇩 বাংলা']].map(([k, l]) =>
          `<button class="chip ${u.lang === k ? 'on' : ''}" data-lg="${k}">${l}</button>`).join('')}</div>
        <p class="small muted">Navigation and common labels switch to the selected language.</p></div>`;
      G.qsa('[data-lg]', box).forEach((b) => b.onclick = async () => { if (await save({ lang: b.dataset.lg }, 'Language updated')) location.reload(); });
    }
  });
})();
