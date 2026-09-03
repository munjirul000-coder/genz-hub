/* Bloom — home feed, stories, post page, explore, profile */
(function () {
  'use strict';
  const G = window.GZ, S = G.state, esc = G.esc;

  /* ---------------- right rail ---------------- */
  async function buildRail(hub) {
    G.setRail(`<div class="card pad"><div class="bold small">${esc(G.t('Suggested people'))}</div>${G.skeletonList(2)}</div>`);
    const parts = [];
    try {
      const { users } = await G.get('/users/suggestions?limit=4' + (hub ? '&hub=' + hub : ''));
      parts.push(`<div class="card pad"><div class="between" style="margin-bottom:10px"><span class="bold small">${esc(G.t('Suggested people'))}</span>
        <a class="link tiny" href="#/explore?tab=people">See all</a></div>
        ${users.length ? users.map((u) => `<div class="row" style="margin-bottom:10px">
          <a href="#/u/${esc(u.username)}">${G.avatar(u, 36)}</a>
          <div class="grow" style="min-width:0"><a class="bold small" href="#/u/${esc(u.username)}">${esc(u.full_name)}</a>
            <div class="tiny muted" style="overflow:hidden;text-overflow:ellipsis">@${esc(u.username)}</div></div>
          <button class="btn btn-sm btn-primary" data-f="${u.id}">Follow</button></div>`).join('')
        : '<p class="tiny muted">No suggestions right now.</p>'}</div>`);
    } catch (e) { parts.push('<div class="card pad tiny muted">Could not load suggestions.</div>'); }
    try {
      const { hashtags } = await G.get('/posts/trending-hashtags');
      parts.push(`<div class="card pad"><div class="bold small" style="margin-bottom:8px">🔥 ${esc(G.t('Trending'))}</div>
        ${hashtags.length ? hashtags.map((h) => `<a class="between" href="#/hashtag/${esc(h.tag)}" style="padding:5px 0">
          <span class="small bold">#${esc(h.tag)}</span><span class="tiny muted">${h.n} posts</span></a>`).join('')
        : '<p class="tiny muted">No trending tags yet.</p>'}</div>`);
    } catch (e) {}
    try {
      const { communities } = await G.get('/communities' + (hub ? '?hub=' + hub : ''));
      parts.push(`<div class="card pad"><div class="bold small" style="margin-bottom:8px">🌐 Communities to join</div>
        ${communities.slice(0, 4).map((c) => `<a class="between" href="#/c/${esc(c.slug)}" style="padding:5px 0">
          <span class="small bold">${esc(c.name)}</span><span class="tiny muted">${G.num(c.member_count)}</span></a>`).join('') || '<p class="tiny muted">No communities yet.</p>'}</div>`);
    } catch (e) {}
    try {
      const { events } = await G.get('/events' + (hub ? '?hub=' + hub : ''));
      parts.push(`<div class="card pad"><div class="between" style="margin-bottom:8px"><span class="bold small">📅 ${esc(G.t('Upcoming events'))}</span>
        <a class="link tiny" href="#/events">All</a></div>
        ${events.slice(0, 3).map((ev) => `<a href="#/event/${ev.id}" style="display:block;padding:6px 0">
          <div class="small bold">${esc(ev.title)}</div><div class="tiny muted">${G.fmtDateTime(ev.starts_at)}</div></a>`).join('')
        || '<p class="tiny muted">No upcoming events.</p>'}</div>`);
    } catch (e) {}
    G.setRail(parts.join(''));
    G.qsa('#rail [data-f]').forEach((b) => b.onclick = async () => {
      b.disabled = true;
      try { const r = await G.post(`/users/${b.dataset.f}/follow`); b.textContent = r.following ? 'Following' : 'Follow'; b.className = 'btn btn-sm ' + (r.following ? 'btn-ghost' : 'btn-primary'); }
      catch (e) { G.err(e); }
      b.disabled = false;
    });
  }
  G.buildRail = buildRail;

  /* ---------------- stories ---------------- */
  async function storiesBar(container) {
    container.innerHTML = `<div class="card stories">${Array.from({ length: 5 }, () => '<div class="story"><div class="skel" style="width:66px;height:66px;border-radius:50%"></div></div>').join('')}</div>`;
    try {
      const { stories } = await G.get('/stories');
      const bar = G.el('<div class="card stories"></div>');
      const add = G.el(`<button class="story" aria-label="Create a story"><div class="ring" style="background:var(--border)">
        <div class="inner" style="display:grid;place-items:center;font-size:22px;background:var(--surface-2)">＋</div></div>
        <div class="nm">Your story</div></button>`);
      add.onclick = createStory;
      bar.appendChild(add);
      stories.forEach((g, i) => {
        const seen = g.items.every((x) => x.seen);
        const st = G.el(`<button class="story ${seen ? 'seen' : ''}" aria-label="View ${esc(g.full_name)}'s story">
          <div class="ring"><div class="inner">${G.avatar(g, 60)}</div></div>
          <div class="nm">${esc(g.user_id === (S.user && S.user.id) ? 'You' : g.full_name.split(' ')[0])}</div></button>`);
        st.onclick = () => openStories(stories, i);
        bar.appendChild(st);
      });
      container.innerHTML = '';
      container.appendChild(bar);
    } catch (e) { container.innerHTML = ''; }
  }

  function createStory() {
    if (!G.requireUser()) return;
    const m = G.modal('Create a story', `<p class="small muted" style="margin-top:0">Stories disappear automatically after 24 hours.</p>
      <div class="field"><label class="label" for="sfile">Photo or video</label><input class="input" type="file" id="sfile" accept="image/*,video/*"></div>
      <div class="field"><label class="label" for="scap">Caption (optional)</label><input class="input" id="scap" maxlength="200"></div>
      <div id="sprev"></div><div class="err" id="serr" hidden></div>
      <button class="btn btn-primary btn-block" id="sgo">Share story</button>`);
    let uploaded = null;
    G.qs('#sfile', m.body).onchange = async (e) => {
      if (!e.target.files.length) return;
      const prev = G.qs('#sprev', m.body);
      prev.innerHTML = '<p class="small muted">Uploading…</p>';
      try {
        const files = await G.uploadFiles(e.target.files);
        uploaded = files[0];
        prev.innerHTML = uploaded.type === 'video'
          ? `<video src="${esc(uploaded.url)}" controls style="max-height:200px;border-radius:12px"></video>`
          : `<img src="${esc(uploaded.url)}" alt="Story preview" style="max-height:200px;border-radius:12px">`;
      } catch (err) { prev.innerHTML = ''; G.err(err); }
    };
    G.qs('#sgo', m.body).onclick = async (e) => {
      const err = G.qs('#serr', m.body);
      if (!uploaded) { err.textContent = 'Choose a photo or video first.'; err.hidden = false; return; }
      e.target.disabled = true;
      try {
        await G.post('/stories', { media_url: uploaded.url, media_type: uploaded.type, caption: G.qs('#scap', m.body).value });
        m.close(); G.toast('Story shared ✨', 'ok'); G.render();
      } catch (ex) { err.textContent = ex.message; err.hidden = false; e.target.disabled = false; }
    };
  }

  function openStories(groups, gi) {
    let idx = 0;
    const ov = G.el(`<div class="story-viewer"><div class="frame">
        <div class="sbars"></div>
        <div class="row" style="position:absolute;top:22px;left:12px;right:12px;z-index:3;color:#fff">
          <div id="sv-av"></div><div class="grow"><div class="bold small" id="sv-name"></div><div class="tiny" id="sv-time" style="opacity:.8"></div></div>
          <button class="iconbtn" id="sv-close" aria-label="Close stories" style="background:rgba(255,255,255,.15);color:#fff">✕</button></div>
        <div id="sv-media" style="width:100%;height:100%;display:grid;place-items:center"></div>
        <div id="sv-cap" style="position:absolute;bottom:60px;left:16px;right:16px;color:#fff;text-shadow:0 2px 8px #000"></div>
        <div id="sv-foot" style="position:absolute;bottom:14px;left:16px;right:16px;color:#fff;display:flex;gap:10px;align-items:center"></div>
        <button id="sv-prev" aria-label="Previous story" style="position:absolute;left:0;top:0;bottom:0;width:32%;background:none;border:0;cursor:pointer"></button>
        <button id="sv-next" aria-label="Next story" style="position:absolute;right:0;top:0;bottom:0;width:32%;background:none;border:0;cursor:pointer"></button>
      </div></div>`);
    document.body.appendChild(ov);
    let timer;
    function close() { clearTimeout(timer); ov.remove(); document.removeEventListener('keydown', key); }
    function key(e) { if (e.key === 'Escape') close(); if (e.key === 'ArrowRight') next(); if (e.key === 'ArrowLeft') prev(); }
    document.addEventListener('keydown', key);
    G.qs('#sv-close', ov).onclick = close;
    ov.addEventListener('click', (e) => { if (e.target === ov) close(); });
    function next() { const g = groups[gi]; if (idx < g.items.length - 1) { idx++; draw(); } else if (gi < groups.length - 1) { gi++; idx = 0; draw(); } else close(); }
    function prev() { if (idx > 0) { idx--; draw(); } else if (gi > 0) { gi--; idx = 0; draw(); } }
    G.qs('#sv-next', ov).onclick = next;
    G.qs('#sv-prev', ov).onclick = prev;
    function draw() {
      clearTimeout(timer);
      const g = groups[gi], it = g.items[idx];
      G.qs('.sbars', ov).innerHTML = g.items.map((x, i) => `<div class="sbar ${i < idx ? 'done' : ''} ${i === idx ? 'active' : ''}"><i></i></div>`).join('');
      G.qs('#sv-av', ov).innerHTML = G.avatar(g, 34);
      G.qs('#sv-name', ov).textContent = g.full_name;
      G.qs('#sv-time', ov).textContent = G.timeAgo(it.created_at);
      G.qs('#sv-cap', ov).textContent = it.caption || '';
      G.qs('#sv-media', ov).innerHTML = it.media_type === 'video'
        ? `<video src="${esc(it.media_url)}" autoplay controls playsinline></video>`
        : `<img src="${esc(it.media_url)}" alt="Story by ${esc(g.full_name)}">`;
      const foot = G.qs('#sv-foot', ov);
      foot.innerHTML = '';
      if (S.user && g.user_id === S.user.id) {
        const vb = G.el('<button class="btn btn-sm btn-ghost" style="color:#fff;border-color:rgba(255,255,255,.4)">👁 Viewers</button>');
        vb.onclick = async () => {
          clearTimeout(timer);
          try {
            const { viewers } = await G.get(`/stories/${it.id}/viewers`);
            G.modal('Story viewers', viewers.length ? viewers.map((v) => `<div class="row" style="padding:6px 0">${G.avatar(v, 34)}
              <div><div class="bold small">${esc(v.full_name)}</div><div class="tiny muted">@${esc(v.username)}</div></div></div>`).join('')
              : '<p class="muted small">No views yet.</p>');
          } catch (e) { G.err(e); }
        };
        const db = G.el('<button class="btn btn-sm btn-danger">🗑 Delete</button>');
        db.onclick = async () => { try { await G.del('/stories/' + it.id); close(); G.render(); } catch (e) { G.err(e); } };
        foot.append(vb, db);
      }
      G.post(`/stories/${it.id}/view`).catch(() => {});
      if (it.media_type !== 'video') timer = setTimeout(next, 6000);
    }
    draw();
  }

  /* ---------------- home ---------------- */
  G.route('home', async (parts, query) => {
    if (!G.requireUser()) return;
    const view = G.mountShell();
    const scope = query.scope || 'for-you';
    const hour = new Date().getHours();
    const greeting = hour < 5 ? 'Late night' : hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : hour < 22 ? 'Good evening' : 'Late night';
    const firstName = esc(S.user.full_name.split(' ')[0]);
    const myInterests = (S.user.interests || []).slice(0, 4);
    view.innerHTML = `
      <section class="greet rise">
        <div class="between wrap" style="align-items:flex-start">
          <div>
            <h1>${greeting}, ${firstName}</h1>
            <div class="sub">What's happening in your world today?</div>
            ${myInterests.length ? `<div class="row wrap" style="gap:6px;margin-top:12px">${myInterests.map((i) => `<span class="pill">${esc(i.name)}</span>`).join('')}</div>` : ''}
          </div>
          <div class="row" style="gap:10px">${G.avatar(S.user, 52)}</div>
        </div>
        <div class="quick">
          <button class="btn btn-primary btn-sm" data-quick="post">${G.icon('edit', 16)} Create post</button>
          <a class="btn btn-ghost btn-sm" href="#/explore?tab=people">${G.icon('network', 16)} Find people</a>
          <a class="btn btn-ghost btn-sm" href="#/gaming?tab=teams">${G.icon('target', 16)} Find team</a>
          <a class="btn btn-ghost btn-sm" href="#/communities">${G.icon('communities', 16)} Explore communities</a>
        </div>
      </section>
      <div id="stories"></div>
      <div class="card pad composer-shell" style="margin:var(--gap) 0">
        <button class="composer-trigger" id="open-composer" style="border:0;box-shadow:none;padding:0;background:none">
          ${G.avatar(S.user, 44)}<span class="ph">Share an idea, a win, or what you're building…</span>
          <span class="btn btn-primary btn-sm" aria-hidden="true">${G.icon('send', 15)} Post</span>
        </button>
        <div class="type-row">
          <button class="type-btn" data-type="photo">${G.icon('image', 16)} Photo</button>
          <button class="type-btn" data-type="video">${G.icon('gaming', 16)} Video</button>
          <button class="type-btn" data-type="project">${G.icon('target', 16)} Project</button>
          ${S.user.in_business ? `<button class="type-btn" data-type="business">${G.icon('business', 16)} Business</button>` : ''}
          ${S.user.in_gaming ? `<button class="type-btn" data-type="gaming">${G.icon('gaming', 16)} Gaming</button>` : ''}
          <button class="type-btn" data-type="question">${G.icon('sparkle', 16)} Question</button>
          <button class="type-btn" data-type="story">${G.icon('camera', 16)} Story</button>
        </div>
      </div>
      <div class="between" style="margin-bottom:14px">
        <div class="tabs" style="display:inline-flex">
          <button class="tab ${scope === 'for-you' ? 'on' : ''}" data-scope="for-you">For You</button>
          <button class="tab ${scope === 'following' ? 'on' : ''}" data-scope="following">Following</button>
          <a class="tab" href="#/shorts">Shorts</a>
        </div>
      </div>
      <div id="feed"></div>`;
    storiesBar(G.qs('#stories', view));
    G.qs('#open-composer', view).onclick = () => G.openComposer({});
    G.qsa('[data-quick]', view).forEach((b) => b.onclick = () => G.openComposer({}));
    G.qsa('[data-type]', view).forEach((b) => b.onclick = () => {
      const t = b.dataset.type;
      if (t === 'story') return createStory();
      const map = {
        photo: { openFile: true }, video: { openFile: true },
        project: { hub: S.user.in_business ? 'business' : 'general', kind: 'collab', label: 'project' },
        business: { hub: 'business' }, gaming: { hub: 'gaming' },
        question: { prefill: '', label: 'question' },
      };
      G.openComposer(Object.assign({ contentType: t }, map[t] || {}));
    });
    G.qsa('[data-scope]', view).forEach((b) => b.onclick = () => { location.hash = '#/?scope=' + b.dataset.scope; });
    G.feedList(G.qs('#feed', view), `/posts/feed?scope=${encodeURIComponent(scope)}`, {
      empty: G.emptyState('🌱', scope === 'following' ? 'Your following feed is empty' : 'No posts yet',
        scope === 'following' ? 'Follow more people to fill this feed.' : 'Be the first to post on Bloom today.',
        `<div style="margin-top:12px"><button class="btn btn-primary btn-sm" data-compose>Create a post</button>
         <a class="btn btn-ghost btn-sm" href="#/explore?tab=people">Find people</a></div>`),
    });
    buildRail();
  });

  /* ---------------- single post ---------------- */
  G.route('post', async (parts) => {
    const view = S.user ? G.mountShell() : G.mountFull('');
    view.innerHTML = G.skeletonPost();
    try {
      const { post } = await G.get('/posts/' + parts[0]);
      view.innerHTML = '';
      const card = G.postCard(post);
      view.appendChild(card);
      G.toggleComments(card, post);
      if (S.user) G.buildRail();
    } catch (e) {
      view.innerHTML = G.emptyState('🔒', 'Post unavailable', e.message, '<div style="margin-top:12px"><a class="btn btn-ghost btn-sm" href="#/">Back home</a></div>');
    }
  });

  G.route('hashtag', async (parts) => {
    if (!G.requireUser()) return;
    const view = G.mountShell();
    const tag = parts[0] || '';
    view.innerHTML = `<div class="card pad" style="margin-bottom:14px"><h2 style="margin:0">#${esc(tag)}</h2>
      <p class="muted small" style="margin:4px 0 0">Public posts tagged with #${esc(tag)}</p></div><div id="feed"></div>`;
    G.feedList(G.qs('#feed', view), '/posts/hashtag/' + encodeURIComponent(tag), {
      empty: G.emptyState('🔍', 'No posts with this hashtag', 'Try another tag or create the first post using it.'),
    });
    G.buildRail();
  });

  /* ---------------- explore ---------------- */
  G.route('explore', async (parts, query) => {
    if (!G.requireUser()) return;
    const view = G.mountShell();
    const q = query.q || '';
    const tab = query.tab || (q ? 'all' : 'discover');
    view.innerHTML = `<div class="card pad" style="margin-bottom:14px">
        <form id="ef" class="row"><input class="input grow" id="eq" placeholder="Search people, posts, groups, communities, #hashtags" value="${esc(q)}" aria-label="Search">
        <button class="btn btn-primary">Search</button></form></div>
      <div class="tabs" style="margin-bottom:14px">
        ${['discover', 'all', 'people', 'posts', 'groups', 'communities', 'hashtags'].map((t) =>
          `<button class="tab ${tab === t ? 'on' : ''}" data-t="${t}">${t[0].toUpperCase() + t.slice(1)}</button>`).join('')}
      </div><div id="eres"></div>`;
    G.qs('#ef', view).onsubmit = (e) => { e.preventDefault(); location.hash = `#/explore?tab=${tab === 'discover' ? 'all' : tab}&q=` + encodeURIComponent(G.qs('#eq', view).value.trim()); };
    G.qsa('[data-t]', view).forEach((b) => b.onclick = () => { location.hash = `#/explore?tab=${b.dataset.t}` + (q ? '&q=' + encodeURIComponent(q) : ''); });
    const box = G.qs('#eres', view);
    if (tab === 'discover' || !q) return discover(box);
    box.innerHTML = G.skeletonList(4);
    try {
      const r = await G.get(`/search?type=${encodeURIComponent(tab)}&q=` + encodeURIComponent(q));
      const total = r.users.length + r.posts.length + r.groups.length + r.communities.length + r.hashtags.length;
      if (!total) { box.innerHTML = G.emptyState('🕵️', 'No results for "' + q + '"', 'Try different keywords or check the spelling.'); return; }
      box.innerHTML = '';
      if (r.users.length) { box.appendChild(G.el('<h3 style="margin:8px 0">People</h3>')); const g = G.el('<div class="stack"></div>'); r.users.forEach((u) => g.appendChild(G.userCard(u))); box.appendChild(g); }
      if (r.communities.length) { box.appendChild(G.el('<h3 style="margin:18px 0 8px">Communities</h3>')); const g = G.el('<div class="grid-cards"></div>'); r.communities.forEach((c) => g.appendChild(G.communityCard(c))); box.appendChild(g); }
      if (r.groups.length) { box.appendChild(G.el('<h3 style="margin:18px 0 8px">Groups</h3>')); const g = G.el('<div class="grid-cards"></div>'); r.groups.forEach((x) => g.appendChild(G.groupCard(x))); box.appendChild(g); }
      if (r.hashtags.length) {
        box.appendChild(G.el('<h3 style="margin:18px 0 8px">Hashtags</h3>'));
        box.appendChild(G.el(`<div class="card pad">${r.hashtags.map((h) => `<a class="between" href="#/hashtag/${esc(h.tag)}" style="padding:6px 0">
          <span class="bold">#${esc(h.tag)}</span><span class="tiny muted">${h.n} posts</span></a>`).join('')}</div>`));
      }
      if (r.posts.length) { box.appendChild(G.el('<h3 style="margin:18px 0 8px">Posts</h3>')); r.posts.forEach((p) => box.appendChild(G.postCard(p))); }
    } catch (e) {
      box.innerHTML = G.errorState(e.message, 'ex-retry');
      G.qs('#ex-retry', box).onclick = () => G.render();
    }
    G.buildRail();
  });

  async function discover(box) {
    box.innerHTML = G.skeletonList(4);
    try {
      const [sug, coms, tags, biz, game] = await Promise.all([
        G.get('/users/suggestions?limit=6'), G.get('/communities'), G.get('/posts/trending-hashtags'),
        G.get('/posts/feed?hub=business&limit=3'), G.get('/posts/feed?hub=gaming&limit=3'),
      ]);
      box.innerHTML = `<h3 style="margin:4px 0 10px">🔥 Popular hashtags</h3>
        <div class="card pad row wrap" style="gap:8px">${tags.hashtags.map((h) => `<a class="chip" href="#/hashtag/${esc(h.tag)}">#${esc(h.tag)} · ${h.n}</a>`).join('') || '<span class="small muted">No hashtags yet.</span>'}</div>
        <h3 style="margin:20px 0 10px">✨ New & suggested people</h3><div class="stack" id="d-people"></div>
        <h3 style="margin:20px 0 10px">🌐 Popular communities</h3><div class="grid-cards" id="d-coms"></div>
        <h3 style="margin:20px 0 10px">💼 Business content</h3><div id="d-biz"></div>
        <h3 style="margin:20px 0 10px">🎮 Gaming content</h3><div id="d-game"></div>`;
      const p = G.qs('#d-people', box);
      sug.users.length ? sug.users.forEach((u) => p.appendChild(G.userCard(u))) : p.innerHTML = '<p class="small muted">No suggestions yet.</p>';
      const c = G.qs('#d-coms', box);
      coms.communities.slice(0, 6).forEach((x) => c.appendChild(G.communityCard(x)));
      const bz = G.qs('#d-biz', box);
      biz.posts.length ? biz.posts.forEach((x) => bz.appendChild(G.postCard(x))) : bz.innerHTML = '<p class="small muted">No business posts yet.</p>';
      const gm = G.qs('#d-game', box);
      game.posts.length ? game.posts.forEach((x) => gm.appendChild(G.postCard(x))) : gm.innerHTML = '<p class="small muted">No gaming posts yet.</p>';
    } catch (e) {
      box.innerHTML = G.errorState(e.message, 'd-retry');
      G.qs('#d-retry', box).onclick = () => discover(box);
    }
    G.buildRail();
  }

  /* ---------------- profile ---------------- */
  G.route('u', async (parts, query) => {
    if (!G.requireUser()) return;
    const view = G.mountShell();
    const username = parts[0];
    const tab = query.tab || 'posts';
    view.innerHTML = `<div class="card"><div class="skel" style="height:180px"></div><div class="pad">${G.skeletonList(1)}</div></div>`;
    let p;
    try { p = (await G.get('/users/' + encodeURIComponent(username))).profile; }
    catch (e) { view.innerHTML = G.emptyState('🚫', 'Profile unavailable', e.message); return; }

    const mine = p.is_self;
    view.innerHTML = `
      <div class="card prof-hero rise">
        <div class="cover">${p.cover ? `<img src="${esc(p.cover)}" alt="${esc(p.full_name)} cover">` : ''}</div>
        <div class="prof-head">
          <div class="prof-av">${G.avatar(p, 104)}</div>
          <div class="prof-id">
            <h2>${esc(p.full_name)}</h2>
            <div class="prof-badges">
              ${p.in_business ? '<span class="badge badge-biz">Business</span>' : ''}
              ${p.in_gaming ? '<span class="badge badge-game">Gaming</span>' : ''}
              ${p.role === 'admin' ? '<span class="badge badge-admin">Admin</span>' : ''}
              ${p.business_role ? `<span class="pill">${esc(p.business_role)}</span>` : ''}
            </div>
            <div class="prof-meta">
              <span>@${esc(p.username)}</span>
              <span class="sep">·</span><span>Joined ${G.fmtDate(p.created_at)}</span>
              ${p.location ? `<span class="sep">·</span><span>${G.icon('globe', 14)} ${esc(p.location)}</span>` : ''}
            </div>
          </div>
          <div class="prof-actions" id="prof-actions"></div>
        </div>
        ${p.bio ? `<p class="prof-bio">${esc(p.bio)}</p>` : ''}
        ${(p.interests || []).length ? `<div class="prof-tags">${p.interests.map((i) => `<span class="chip static">${esc(i.name)}</span>`).join('')}</div>` : ''}
        <div class="stat small">
          <div><b class="num">${G.num(p.counts.posts)}</b><span>Posts</span></div>
          <a href="#/u/${esc(p.username)}?tab=followers"><b class="num">${G.num(p.counts.followers)}</b><span>Followers</span></a>
          <a href="#/u/${esc(p.username)}?tab=following"><b class="num">${G.num(p.counts.following)}</b><span>Following</span></a>
          <div><b class="num">${G.num(p.counts.connections)}</b><span>Connections</span></div>
          <div><b class="num">${G.num(p.counts.communities)}</b><span>Communities</span></div>
        </div>
        <div class="prof-tabs"><div class="tabs">${['posts', 'about', 'media', 'groups', 'communities'].map((t) =>
          `<button class="tab ${tab === t ? 'on' : ''}" data-t="${t}">${t[0].toUpperCase() + t.slice(1)}</button>`).join('')}</div></div>
      </div>
      <div id="ptab" style="margin-top:14px"></div>`;

    G.qsa('[data-t]', view).forEach((b) => b.onclick = () => { location.hash = `#/u/${encodeURIComponent(username)}?tab=` + b.dataset.t; });

    // actions
    const act = G.qs('#prof-actions', view);
    if (mine) {
      act.appendChild(btn('btn-primary', '✏️ ' + G.t('Edit profile'), () => editProfile(p)));
      act.appendChild(btn('btn-ghost', '⚙️', () => location.hash = '#/settings'));
    } else {
      const fb = btn(p.i_follow ? 'btn-ghost' : 'btn-primary', p.i_follow ? '✓ Following' : '+ Follow', async () => {
        try {
          const r = await G.post(`/users/${p.id}/follow`);
          p.i_follow = r.following;
          fb.textContent = r.following ? '✓ Following' : '+ Follow';
          fb.className = 'btn ' + (r.following ? 'btn-ghost' : 'btn-primary');
        } catch (e) { G.err(e); }
      });
      act.appendChild(fb);
      const cs = p.connection;
      const cb = btn('btn-ghost', cs ? (cs.status === 'accepted' ? '🤝 Connected' : cs.outgoing ? '⏳ Requested' : '✅ Accept') : '🤝 Connect', async () => {
        try {
          if (!cs) { await G.post(`/users/${p.id}/connect`); G.toast('Connection request sent', 'ok'); }
          else if (cs.status === 'pending' && !cs.outgoing) { await G.post(`/users/connections/${cs.id}/respond`, { action: 'accept' }); G.toast('Connected!', 'ok'); }
          else if (cs.status === 'pending') { await G.post(`/users/connections/${cs.id}/respond`, { action: 'cancel' }); G.toast('Request cancelled'); }
          else { if (await G.confirm('Remove connection', 'You will no longer be connected.', 'Remove')) await G.post(`/users/connections/${cs.id}/respond`, { action: 'remove' }); }
          G.render();
        } catch (e) { G.err(e); }
      });
      act.appendChild(cb);
      act.appendChild(btn('btn-ghost', '💬', async () => {
        try { const r = await G.post('/conversations/start', { user_id: p.id }); location.hash = '#/messages/' + r.conversation_id; }
        catch (e) { G.err(e); }
      }));
      const more = G.el('<div style="position:relative"><button class="btn btn-ghost" aria-label="More options">⋯</button></div>');
      more.firstChild.onclick = (e) => {
        e.stopPropagation();
        const box = G.el(`<div class="menu"><button data-b>${p.blocked_by_me ? '✅ Unblock user' : '🚫 Block user'}</button>
          <button data-r>🚩 Report user</button></div>`);
        more.appendChild(box);
        const off = (ev) => { if (!box.contains(ev.target)) { box.remove(); document.removeEventListener('click', off); } };
        setTimeout(() => document.addEventListener('click', off), 0);
        box.querySelector('[data-b]').onclick = async () => {
          box.remove();
          try { const r = await G.post(`/users/${p.id}/block`); G.toast(r.blocked ? 'User blocked' : 'User unblocked', 'ok'); G.render(); } catch (e) { G.err(e); }
        };
        box.querySelector('[data-r]').onclick = () => { box.remove(); G.reportModal('user', p.id); };
      };
      act.appendChild(more);
    }

    const tabBox = G.qs('#ptab', view);
    if (p.restricted && !mine) {
      tabBox.innerHTML = G.emptyState('🔒', 'This profile is private', 'Only connections can see this profile content.');
      G.buildRail();
      return;
    }
    if (tab === 'posts') {
      G.feedList(tabBox, `/users/${encodeURIComponent(username)}/posts`, { empty: G.emptyState('📝', 'No posts yet', mine ? 'Share your first post.' : 'This user has not posted yet.') });
    } else if (tab === 'media') {
      G.feedList(tabBox, `/users/${encodeURIComponent(username)}/posts?media=1`, { empty: G.emptyState('🖼️', 'No photos or videos yet', '') });
    } else if (tab === 'about') {
      tabBox.innerHTML = `<div class="card pad stack">
        <div><div class="label">Bio</div><div>${p.bio ? esc(p.bio) : '<span class="muted small">Not added.</span>'}</div></div>
        <div><div class="label">Location</div><div>${p.location ? esc(p.location) : '<span class="muted small">Not shared.</span>'}</div></div>
        <div><div class="label">Interests</div><div class="row wrap" style="gap:6px">${(p.interests || []).map((i) => `<span class="chip static">${esc(i.name)}</span>`).join('') || '<span class="muted small">None selected.</span>'}</div></div>
        ${p.in_business ? `<div><div class="label">Business profile</div><div>${esc(p.business_role || 'Member of Business Hub')}</div></div>` : ''}
        ${p.in_gaming ? `<div><div class="label">Gaming profile</div><div class="small">Favourite games: ${esc(p.fav_games || '—')}<br>Platform: ${esc(p.platform || '—')}${p.gamer_tag ? '<br>Tag: ' + esc(p.gamer_tag) : ''}</div></div>` : ''}
        <div><div class="label">Joined</div><div>${G.fmtDate(p.created_at)}</div></div></div>`;
    } else if (tab === 'followers' || tab === 'following') {
      tabBox.innerHTML = G.skeletonList(3);
      const { users } = await G.get(`/users/${encodeURIComponent(username)}/follows/${tab}`);
      tabBox.innerHTML = '';
      if (!users.length) tabBox.innerHTML = G.emptyState('👥', 'No ' + tab + ' yet', '');
      const stack = G.el('<div class="stack"></div>');
      users.forEach((u) => stack.appendChild(G.userCard(u)));
      tabBox.appendChild(stack);
    } else {
      tabBox.innerHTML = G.skeletonList(3);
      const { groups, communities } = await G.get(`/users/${encodeURIComponent(username)}/groups`);
      const items = tab === 'groups' ? groups : communities;
      tabBox.innerHTML = '';
      if (!items.length) { tabBox.innerHTML = G.emptyState(tab === 'groups' ? '👥' : '🌐', `No ${tab} joined yet`, ''); }
      else {
        const grid = G.el('<div class="grid-cards"></div>');
        items.forEach((x) => grid.appendChild(tab === 'groups' ? G.groupCard(Object.assign({ member_count: 0, category: x.category || '' }, x)) : G.communityCard(Object.assign({ member_count: 0 }, x))));
        tabBox.appendChild(grid);
      }
    }
    G.buildRail();
  });

  function btn(cls, label, fn) {
    const b = G.el(`<button class="btn ${cls}">${label}</button>`);
    b.onclick = fn; return b;
  }

  function editProfile(p) {
    const u = S.user;
    const m = G.modal('Edit profile', `
      <div class="field"><label class="label" for="e-name">Full name</label><input class="input" id="e-name" value="${esc(u.full_name)}" maxlength="60"></div>
      <div class="field"><label class="label" for="e-bio">Bio</label><textarea class="textarea" id="e-bio" maxlength="300">${esc(u.bio || '')}</textarea></div>
      <div class="field"><label class="label" for="e-loc">Location</label><input class="input" id="e-loc" value="${esc(u.location || '')}" maxlength="80" placeholder="City, Country"></div>
      <div class="field"><label class="label" for="e-av">Profile photo</label><input class="input" type="file" id="e-av" accept="image/*"></div>
      <div class="field"><label class="label" for="e-cv">Cover image</label><input class="input" type="file" id="e-cv" accept="image/*"></div>
      ${u.in_business ? `<div class="field"><label class="label" for="e-br">Business role</label>
        <select class="select" id="e-br">${['', 'Entrepreneur', 'Founder', 'Freelancer', 'Marketer', 'Developer', 'Designer', 'Student', 'Investor interest'].map((x) => `<option ${u.business_role === x ? 'selected' : ''}>${x}</option>`).join('')}</select></div>` : ''}
      ${u.in_gaming ? `<div class="field"><label class="label" for="e-fg">Favourite games</label><input class="input" id="e-fg" value="${esc(u.fav_games || '')}" placeholder="Valorant, FIFA, PUBG">
        <div class="row" style="margin-top:10px;gap:8px">
        <select class="select" id="e-pf">${['', 'Mobile', 'PC', 'Console'].map((x) => `<option ${u.platform === x ? 'selected' : ''}>${x || 'Platform'}</option>`).join('')}</select>
        <input class="input" id="e-gt" value="${esc(u.gamer_tag || '')}" placeholder="Gamer tag"></div></div>` : ''}
      <div class="err" id="e-err" hidden></div>
      <button class="btn btn-primary btn-block" id="e-save">Save profile</button>`);

    G.qs('#e-save', m.body).onclick = async (e) => {
      e.target.disabled = true; e.target.textContent = 'Saving…';
      const body = {
        full_name: G.qs('#e-name', m.body).value, bio: G.qs('#e-bio', m.body).value, location: G.qs('#e-loc', m.body).value,
      };
      const br = G.qs('#e-br', m.body); if (br) body.business_role = br.value;
      const fg = G.qs('#e-fg', m.body);
      if (fg) { body.fav_games = fg.value; body.platform = G.qs('#e-pf', m.body).value; body.gamer_tag = G.qs('#e-gt', m.body).value; }
      try {
        const av = G.qs('#e-av', m.body).files, cv = G.qs('#e-cv', m.body).files;
        if (av.length) body.avatar = (await G.uploadFiles(av))[0].url;
        if (cv.length) body.cover = (await G.uploadFiles(cv))[0].url;
        const r = await G.patch('/me/profile', body);
        S.user = r.user;
        m.close(); G.toast('Profile updated', 'ok');
        location.reload();
      } catch (ex) {
        const er = G.qs('#e-err', m.body); er.textContent = ex.message; er.hidden = false;
        e.target.disabled = false; e.target.textContent = 'Save profile';
      }
    };
  }
  G.editProfile = editProfile;
})();
