/* Gen-Z Hub — shared components: post card, composer, comments, feeds, cards */
(function () {
  'use strict';
  const G = window.GZ, S = G.state, esc = G.esc;

  const REACTIONS = { like: '👍', fire: '🔥', clap: '👏', mind: '🤯' };

  /* ---------------- media ---------------- */
  function mediaHtml(media) {
    if (!media || !media.length) return '';
    const n = Math.min(media.length, 4);
    const items = media.slice(0, 4);
    const soloVideo = items.length === 1 && items[0].type === 'video';
    return `<div class="media-grid n${n}${soloVideo ? ' solo-video' : ''}">` + items.map((m) => m.type === 'video'
      ? videoHtml(m)
      : `<img src="${esc(m.url)}" alt="Post attachment" loading="lazy" decoding="async" data-lightbox="${esc(m.url)}">`).join('') + '</div>';
  }

  /* Lazy video shell — the player engine (js/video.js) hydrates it only when it nears the
     viewport, so a feed with 50 videos still creates at most 3 <video> elements. */
  function videoHtml(m) {
    const data = {
      url: m.url, poster: m.poster || '', width: m.width || 0, height: m.height || 0,
      duration: m.duration || 0, variants: m.variants || [], asset_uid: m.asset_uid || '',
      status: m.status || 'ready',
    };
    const ar = data.width && data.height ? data.width / data.height : 16 / 9;
    return `<div class="gzv${ar < 0.95 ? ' is-portrait' : ''}" style="--gzv-ar:${ar.toFixed(4)}" data-gzv="${esc(JSON.stringify(data))}"></div>`;
  }

  function hubTag(p) {
    const tags = [];
    if (p.hub === 'business') tags.push('<span class="badge badge-biz">Business</span>');
    if (p.hub === 'gaming') tags.push('<span class="badge badge-game">Gaming</span>');
    if (p.kind === 'collab') tags.push('<span class="pill">🤝 Collaboration</span>');
    if (p.kind === 'team') tags.push('<span class="pill">🎯 Team recruitment</span>');
    if (p.kind === 'event') tags.push('<span class="pill">📅 Event</span>');
    if (p.topic) tags.push(`<span class="pill">${esc(p.topic)}</span>`);
    if (p.group_name) tags.push(`<a class="pill" href="#/group/${p.group_id}">👥 ${esc(p.group_name)}</a>`);
    if (p.community_name) tags.push(`<a class="pill" href="#/c/${esc(p.community_slug)}">🌐 ${esc(p.community_name)}</a>`);
    if (p.privacy === 'connections') tags.push('<span class="pill">🔒 Connections</span>');
    if (p.privacy === 'private') tags.push('<span class="pill">🙈 Only me</span>');
    return tags.join(' ');
  }

  /* ---------------- post card ---------------- */
  G.postCard = function (p) {
    const mine = S.user && p.user_id === S.user.id;
    const inner = p.original;
    const node = G.el(`<article class="card post fade-in" data-post="${p.id}">
      <div class="post-head">
        <a href="#/u/${esc(p.username)}" aria-label="${esc(p.full_name)} profile">${G.avatar(p, 46)}</a>
        <div class="grow">
          <a class="nm" href="#/u/${esc(p.username)}">${esc(p.full_name)}</a>
          <div class="post-meta"><span>@${esc(p.username)}</span><span>·</span><span>${G.timeAgo(p.created_at)}</span>${p.updated_at ? '<span>· edited</span>' : ''}</div>
          <div class="row wrap" style="gap:6px;margin-top:8px">${hubTag(p)}</div>
        </div>
        <div style="position:relative"><button class="iconbtn" data-menu aria-label="Post options" style="width:36px;height:36px;border-radius:12px">${G.icon('more', 17)}</button></div>
      </div>
      ${p.content ? `<div class="post-body">${G.linkify(p.content)}</div>` : ''}
      ${p.link_url ? `<a class="quote row" href="${esc(p.link_url)}" target="_blank" rel="noopener nofollow"><span>🔗</span><span class="grow small" style="word-break:break-all">${esc(p.link_url)}</span></a>` : ''}
      ${mediaHtml(p.media)}
      ${inner ? `<div class="quote"><div class="row" style="gap:8px">${G.avatar(inner, 28)}
          <a class="bold small" href="#/u/${esc(inner.username)}">${esc(inner.full_name)}</a>
          <span class="tiny muted">· ${G.timeAgo(inner.created_at)}</span></div>
        <div class="post-body small">${G.linkify(inner.content || '')}</div>${mediaHtml(inner.media)}</div>` : ''}
      <div class="post-stats">
        <span data-count-r class="num">${G.num(p.reaction_count)} reactions</span>
        <span data-count-c class="num">${G.num(p.comment_count)} comments</span>
        <span class="num">${G.num(p.repost_count)} reposts</span>
      </div>
      <div class="post-actions">
        <button class="pa ${p.my_reaction ? 'on' : ''}" data-react>${p.my_reaction ? REACTIONS[p.my_reaction] : G.icon('heart', 18)} <span class="lbl">${esc(G.t('Like'))}</span></button>
        <button class="pa" data-comment>${G.icon('comment', 18)} <span class="lbl">${esc(G.t('Comment'))}</span></button>
        <button class="pa" data-repost>${G.icon('repost', 18)} <span class="lbl">${esc(G.t('Share'))}</span></button>
        <button class="pa ${p.is_saved ? 'on' : ''}" data-save>${G.icon('bookmark', 18)} <span class="lbl">${esc(G.t('Save'))}</span></button>
      </div>
      <div data-comments hidden></div>
    </article>`);

    // reactions
    const rBtn = G.qs('[data-react]', node);
    rBtn.onclick = async () => {
      if (!G.requireUser()) return;
      try {
        const r = await G.post(`/posts/${p.id}/react`, { type: 'like' });
        p.my_reaction = r.my_reaction; p.reaction_count = r.reaction_count;
        rBtn.classList.toggle('on', !!r.my_reaction);
        rBtn.innerHTML = `${r.my_reaction ? REACTIONS[r.my_reaction] : G.icon('heart', 18)} <span class="lbl">${esc(G.t('Like'))}</span>`;
        G.qs('[data-count-r]', node).textContent = G.num(r.reaction_count) + ' reactions';
      } catch (e) { G.err(e); }
    };
    let pressTimer = null;
    rBtn.addEventListener('contextmenu', (e) => { e.preventDefault(); reactionPicker(rBtn, p, node); });
    rBtn.addEventListener('touchstart', () => { pressTimer = setTimeout(() => reactionPicker(rBtn, p, node), 450); }, { passive: true });
    rBtn.addEventListener('touchend', () => clearTimeout(pressTimer));

    G.qs('[data-comment]', node).onclick = () => toggleComments(node, p);
    G.qs('[data-repost]', node).onclick = () => repostModal(p);
    const sBtn = G.qs('[data-save]', node);
    sBtn.onclick = async () => {
      if (!G.requireUser()) return;
      try {
        const r = await G.post(`/posts/${p.id}/save`);
        p.is_saved = r.saved;
        sBtn.classList.toggle('on', r.saved);
        sBtn.innerHTML = `${G.icon('bookmark', 18)} <span class="lbl">${esc(G.t('Save'))}</span>`;
        G.toast(r.saved ? 'Saved to your library' : 'Removed from saved', 'ok');
        if (S.route.name === 'saved' && !r.saved) node.remove();
      } catch (e) { G.err(e); }
    };
    G.qs('[data-menu]', node).onclick = (e) => { e.stopPropagation(); postMenu(e.currentTarget, p, node, mine); };
    G.qsa('[data-lightbox]', node).forEach((img) => img.onclick = () => G.lightbox(img.dataset.lightbox));
    if (G.attachVideos) setTimeout(() => G.attachVideos(node), 0);
    return node;
  };

  function reactionPicker(anchor, p, node) {
    const box = G.el(`<div class="menu" style="right:auto;left:0;display:flex;gap:4px;padding:6px">
      ${Object.entries(REACTIONS).map(([k, v]) => `<button data-r="${k}" style="font-size:20px;width:40px;justify-content:center" aria-label="React ${k}">${v}</button>`).join('')}</div>`);
    anchor.parentElement.style.position = 'relative';
    anchor.parentElement.appendChild(box);
    const off = (e) => { if (!box.contains(e.target)) { box.remove(); document.removeEventListener('click', off); } };
    setTimeout(() => document.addEventListener('click', off), 0);
    box.querySelectorAll('[data-r]').forEach((b) => b.onclick = async () => {
      try {
        const r = await G.post(`/posts/${p.id}/react`, { type: b.dataset.r });
        p.my_reaction = r.my_reaction;
        anchor.classList.toggle('on', !!r.my_reaction);
        anchor.innerHTML = `${r.my_reaction ? REACTIONS[r.my_reaction] : G.icon('heart', 18)} <span class="lbl">${esc(G.t('Like'))}</span>`;
        G.qs('[data-count-r]', node).textContent = G.num(r.reaction_count) + ' reactions';
      } catch (e) { G.err(e); }
      box.remove();
    });
  }

  function postMenu(anchor, p, node, mine) {
    const box = G.el(`<div class="menu" role="menu">
      <button data-copy>🔗 Copy link</button>
      <button data-open>↗️ Open post</button>
      ${mine ? '<button data-edit>✏️ Edit post</button>' : ''}
      ${!mine ? '<button data-report>🚩 Report post</button>' : ''}
      ${mine || (S.user && S.user.role === 'admin') ? '<button class="danger" data-del>🗑️ Delete post</button>' : ''}
    </div>`);
    anchor.parentElement.appendChild(box);
    const off = (e) => { if (!box.contains(e.target)) { box.remove(); document.removeEventListener('click', off); } };
    setTimeout(() => document.addEventListener('click', off), 0);
    const q = (s) => box.querySelector(s);
    q('[data-copy]').onclick = () => {
      const url = location.origin + '/#/post/' + p.id;
      navigator.clipboard?.writeText(url).then(() => G.toast('Link copied', 'ok'), () => G.toast(url));
      box.remove();
    };
    q('[data-open]').onclick = () => { location.hash = '#/post/' + p.id; box.remove(); };
    if (q('[data-edit]')) q('[data-edit]').onclick = () => { box.remove(); editPost(p, node); };
    if (q('[data-report]')) q('[data-report]').onclick = () => { box.remove(); G.reportModal('post', p.id); };
    if (q('[data-del]')) q('[data-del]').onclick = async () => {
      box.remove();
      if (!(await G.confirm('Delete post', 'This permanently removes the post, its comments and reactions.', 'Delete'))) return;
      try { await G.del('/posts/' + p.id); node.remove(); G.toast('Post deleted', 'ok'); } catch (e) { G.err(e); }
    };
  }

  function editPost(p, node) {
    const m = G.modal('Edit post', `<div class="field"><label class="label" for="ep">Content</label>
      <textarea class="textarea" id="ep" maxlength="5000">${esc(p.content)}</textarea></div>
      <div class="field"><label class="label" for="epv">Privacy</label>
      <select class="select" id="epv">
        <option value="public">🌍 Public</option><option value="connections">🤝 Connections only</option><option value="private">🔒 Only me</option>
      </select></div>
      <div class="row" style="justify-content:flex-end"><button class="btn btn-primary" id="epsave">Save changes</button></div>`);
    G.qs('#epv', m.body).value = p.privacy;
    G.qs('#epsave', m.body).onclick = async (e) => {
      e.target.disabled = true;
      try {
        const r = await G.patch('/posts/' + p.id, { content: G.qs('#ep', m.body).value, privacy: G.qs('#epv', m.body).value });
        node.replaceWith(G.postCard(r.post));
        m.close(); G.toast('Post updated', 'ok');
      } catch (err) { G.err(err); e.target.disabled = false; }
    };
  }

  function repostModal(p) {
    if (!G.requireUser()) return;
    const m = G.modal('Repost to your feed', `<div class="field">
      <textarea class="textarea" id="rc" placeholder="Add your thoughts (optional)" maxlength="1000"></textarea></div>
      <div class="quote small"><b>${esc(p.full_name)}</b><div>${esc((p.content || '').slice(0, 200))}</div></div>
      <div class="row" style="justify-content:flex-end;margin-top:14px"><button class="btn btn-primary" id="rgo">🔁 Repost</button></div>`);
    G.qs('#rgo', m.body).onclick = async (e) => {
      e.target.disabled = true;
      try { await G.post(`/posts/${p.id}/repost`, { content: G.qs('#rc', m.body).value }); m.close(); G.toast('Reposted to your feed', 'ok'); if (S.route.name === 'home') G.render(); }
      catch (err) { G.err(err); e.target.disabled = false; }
    };
  }

  /* ---------------- comments ---------------- */
  async function toggleComments(node, p) {
    const box = G.qs('[data-comments]', node);
    if (!box.hidden) { box.hidden = true; return; }
    box.hidden = false;
    box.innerHTML = `<div class="divider"></div>${G.skeletonList(2)}`;
    try {
      const { comments } = await G.get(`/posts/${p.id}/comments`);
      renderComments(box, p, comments, node);
    } catch (e) {
      box.innerHTML = G.errorState(e.message);
    }
  }
  G.toggleComments = toggleComments;

  function commentNode(c, p, box, node) {
    const mine = S.user && c.user_id === S.user.id;
    const el = G.el(`<div class="comment" data-c="${c.id}">
      <a href="#/u/${esc(c.username)}">${G.avatar(c, 32)}</a>
      <div class="grow">
        <div class="bubble"><a class="bold small" href="#/u/${esc(c.username)}">${esc(c.full_name)}</a>
          <div class="small" data-body>${G.linkify(c.content)}</div></div>
        <div class="row tiny muted" style="gap:12px;margin-top:3px">
          <span>${G.timeAgo(c.created_at)}${c.updated_at ? ' · edited' : ''}</span>
          <button class="link tiny" data-reply style="background:none;border:0;padding:0">${esc(G.t('Reply'))}</button>
          ${mine ? `<button class="link tiny" data-edit style="background:none;border:0;padding:0">${esc(G.t('Edit'))}</button>` : ''}
          ${mine || (S.user && S.user.id === p.user_id) ? `<button class="link tiny" data-del style="background:none;border:0;padding:0;color:var(--danger)">${esc(G.t('Delete'))}</button>` : `<button class="link tiny" data-rep style="background:none;border:0;padding:0">${esc(G.t('Report'))}</button>`}
        </div>
        <div data-replies class="reply-list"></div>
      </div></div>`);
    G.qs('[data-reply]', el).onclick = () => {
      const holder = G.qs('[data-replies]', el);
      if (G.qs('form', holder)) return;
      holder.appendChild(commentForm(p, box, node, c.parent_id || c.id, `Replying to @${c.username} `));
    };
    if (G.qs('[data-edit]', el)) G.qs('[data-edit]', el).onclick = () => {
      const body = G.qs('[data-body]', el);
      const inp = G.el(`<div><textarea class="textarea" style="min-height:60px">${esc(c.content)}</textarea>
        <div class="row" style="margin-top:6px"><button class="btn btn-primary btn-sm">Save</button><button class="btn btn-ghost btn-sm">Cancel</button></div></div>`);
      body.replaceWith(inp);
      const [sv, cn] = inp.querySelectorAll('button');
      cn.onclick = () => inp.replaceWith(body);
      sv.onclick = async () => {
        try {
          const v = inp.querySelector('textarea').value;
          await G.patch('/posts/comments/' + c.id, { content: v });
          c.content = v; body.innerHTML = G.linkify(v); inp.replaceWith(body); G.toast('Comment updated', 'ok');
        } catch (e) { G.err(e); }
      };
    };
    if (G.qs('[data-del]', el)) G.qs('[data-del]', el).onclick = async () => {
      if (!(await G.confirm('Delete comment', 'This comment and its replies will be removed.', 'Delete'))) return;
      try { await G.del('/posts/comments/' + c.id); el.remove(); } catch (e) { G.err(e); }
    };
    if (G.qs('[data-rep]', el)) G.qs('[data-rep]', el).onclick = () => G.reportModal('comment', c.id);
    return el;
  }

  function commentForm(p, box, node, parentId, prefill) {
    const f = G.el(`<form class="row" style="margin-top:10px;align-items:flex-start">
      ${G.avatar(S.user, 32)}
      <textarea class="textarea grow" style="min-height:42px" placeholder="Write a ${parentId ? 'reply' : 'comment'}…" maxlength="1000" aria-label="Comment text"></textarea>
      <button class="btn btn-primary btn-sm" type="submit">${esc(G.t('Send'))}</button></form>`);
    const ta = f.querySelector('textarea');
    if (prefill) ta.value = prefill;
    setTimeout(() => ta.focus(), 30);
    f.onsubmit = async (e) => {
      e.preventDefault();
      const v = ta.value.trim();
      if (!v) return;
      const btn = f.querySelector('button');
      btn.disabled = true;
      try {
        const { comment } = await G.post(`/posts/${p.id}/comments`, { content: v, parent_id: parentId || null });
        ta.value = '';
        const holder = parentId ? f.parentElement : G.qs('[data-list]', box);
        holder.appendChild(commentNode(comment, p, box, node));
        if (parentId) f.remove();
        p.comment_count = (p.comment_count || 0) + 1;
        const cc = G.qs('[data-count-c]', node); if (cc) cc.textContent = G.num(p.comment_count) + ' comments';
      } catch (err) { G.err(err); }
      btn.disabled = false;
    };
    return f;
  }

  function renderComments(box, p, comments, node) {
    box.innerHTML = '<div class="divider"></div><div data-list></div>';
    const list = G.qs('[data-list]', box);
    const tops = comments.filter((c) => !c.parent_id);
    const kids = comments.filter((c) => c.parent_id);
    if (!tops.length) list.innerHTML = `<p class="small muted center" style="padding:8px">No comments yet. Start the conversation.</p>`;
    tops.forEach((c) => {
      const n = commentNode(c, p, box, node);
      list.appendChild(n);
      kids.filter((k) => k.parent_id === c.id).forEach((k) => G.qs('[data-replies]', n).appendChild(commentNode(k, p, box, node)));
    });
    if (S.user) box.appendChild(commentForm(p, box, node, null));
  }

  /* ---------------- lightbox ---------------- */
  G.lightbox = function (url) {
    const ov = G.el(`<div class="overlay" style="align-items:center;padding:20px"><img src="${esc(url)}" alt="Full size attachment"
      style="max-width:96vw;max-height:92vh;border-radius:12px"></div>`);
    ov.onclick = () => ov.remove();
    document.body.appendChild(ov);
  };

  /* ---------------- report ---------------- */
  G.reportModal = function (type, id) {
    if (!G.requireUser()) return;
    const reasons = ['Spam', 'Harassment', 'Impersonation', 'Inappropriate content', 'Other'];
    const m = G.modal('Report ' + type, `<div class="field"><label class="label" for="rr">Why are you reporting this?</label>
      <select class="select" id="rr">${reasons.map((r) => `<option>${r}</option>`).join('')}</select></div>
      <div class="field"><label class="label" for="rd">Details (optional)</label>
      <textarea class="textarea" id="rd" maxlength="600" placeholder="Add context for our moderators"></textarea></div>
      <div class="row" style="justify-content:flex-end"><button class="btn btn-primary" id="rsend">Submit report</button></div>`);
    G.qs('#rsend', m.body).onclick = async (e) => {
      e.target.disabled = true;
      try {
        await G.post('/reports', { target_type: type, target_id: id, reason: G.qs('#rr', m.body).value, details: G.qs('#rd', m.body).value });
        m.close(); G.toast('Report submitted. Our moderators will review it.', 'ok');
      } catch (err) { G.err(err); e.target.disabled = false; }
    };
  };

  /* ---------------- composer ---------------- */
  G.openComposer = function (opts) {
    if (!G.requireUser()) return;
    opts = opts || {};
    const u = S.user;
    const m = G.modal('Create', `
      <div class="row" style="align-items:flex-start">${G.avatar(u, 46)}
        <div class="grow"><div class="bold">${esc(u.full_name)}</div><div class="tiny muted">@${esc(u.username)}</div></div></div>
      <div class="type-row" id="cp-types" style="margin-top:14px">
        <button type="button" class="type-btn on" data-ct="text">${G.icon('edit', 15)} Text</button>
        <button type="button" class="type-btn" data-ct="photo">${G.icon('image', 15)} Photo</button>
        <button type="button" class="type-btn" data-ct="video">${G.icon('gaming', 15)} Video</button>
        <button type="button" class="type-btn" data-ct="project">${G.icon('target', 15)} Project</button>
        ${u.in_business ? `<button type="button" class="type-btn" data-ct="business">${G.icon('business', 15)} Business</button>` : ''}
        ${u.in_gaming ? `<button type="button" class="type-btn" data-ct="gaming">${G.icon('gaming', 15)} Gaming</button>` : ''}
        <button type="button" class="type-btn" data-ct="question">${G.icon('sparkle', 15)} Question</button>
      </div>
      <div class="field" style="margin-top:12px">
        <label class="sr-only" for="cp-text">Post content</label>
        <textarea class="textarea" id="cp-text" style="min-height:120px" maxlength="5000"
          placeholder="${esc(G.t('What is happening?'))} Use #hashtags and @mentions."></textarea>
        <div class="between"><span class="tiny muted" id="cp-count">0 / 5000</span>
          <span class="tiny muted">Tip: #startups #esports</span></div>
      </div>
      <div class="field"><label class="label" for="cp-link">Link (optional)</label>
        <input class="input" id="cp-link" type="url" placeholder="https://…"></div>
      <div id="cp-preview" class="row wrap" style="gap:8px"></div>
      <div id="cp-progress" hidden style="margin:8px 0"><div style="height:6px;background:var(--surface-2);border-radius:4px;overflow:hidden">
        <div id="cp-bar" style="height:100%;width:0;background:linear-gradient(90deg,var(--brand-1),var(--brand-2));transition:.2s"></div></div>
        <div class="tiny muted" id="cp-ptext">Uploading…</div></div>
      <div class="row wrap" style="gap:8px;margin:12px 0">
        <label class="btn btn-ghost btn-sm" style="cursor:pointer">🖼️ Photo / Video
          <input type="file" id="cp-file" accept="image/*,video/*" multiple hidden></label>
        <select class="select btn-sm" id="cp-dest" style="width:auto">
          <option value="general">🌍 General Feed</option>
          ${u.in_business ? '<option value="business">💼 Business Hub</option>' : ''}
          ${u.in_gaming ? '<option value="gaming">🎮 Gaming Hub</option>' : ''}
          <optgroup label="Groups" id="cp-groups"></optgroup>
          <optgroup label="Communities" id="cp-comms"></optgroup>
        </select>
        <select class="select btn-sm" id="cp-priv" style="width:auto">
          <option value="public">🌍 Public</option><option value="connections">🤝 Connections</option><option value="private">🔒 Only me</option>
        </select>
        <select class="select btn-sm" id="cp-kind" style="width:auto">
          <option value="post">📝 Normal post</option><option value="collab">🤝 Looking for collaboration</option><option value="team">🎯 Looking for teammates</option>
        </select>
      </div>
      <div id="cp-topicwrap" hidden class="field"><label class="label" for="cp-topic">Topic</label>
        <select class="select" id="cp-topic"></select></div>
      <div class="err" id="cp-err" hidden></div>
      <div class="row" style="justify-content:flex-end"><button class="btn btn-primary" id="cp-go">${G.icon('send', 16)} Publish</button></div>`);

    const b = m.body;
    const ta = G.qs('#cp-text', b), dest = G.qs('#cp-dest', b), priv = G.qs('#cp-priv', b);
    priv.value = u.default_post_privacy || 'public';
    let media = [];

    ta.addEventListener('input', () => { G.qs('#cp-count', b).textContent = ta.value.length + ' / 5000'; });

    const PLACEHOLDER = {
      text: "Share an idea, a win, or what you're building…",
      photo: 'Add a caption for your photo…',
      video: 'Tell people what this video is about…',
      project: 'What are you building? Who do you need on the team?',
      business: 'Share a business insight, number, or lesson…',
      gaming: 'Clip, rank-up, squad call — what happened?',
      question: 'Ask the community something specific…',
    };
    function applyType(t) {
      G.qsa('[data-ct]', b).forEach((x) => x.classList.toggle('on', x.dataset.ct === t));
      ta.placeholder = PLACEHOLDER[t] || PLACEHOLDER.text;
      const kindSel = G.qs('#cp-kind', b);
      if (t === 'project') { if (u.in_business) dest.value = 'business'; kindSel.value = 'collab'; }
      else if (t === 'business') { dest.value = 'business'; kindSel.value = 'post'; }
      else if (t === 'gaming') { dest.value = 'gaming'; kindSel.value = 'post'; }
      else if (t === 'question') { kindSel.value = 'post'; }
      else kindSel.value = 'post';
      syncTopic();
      if ((t === 'photo' || t === 'video') && !ta.dataset.picked) { ta.dataset.picked = '1'; G.qs('#cp-file', b).click(); }
    }
    G.qsa('[data-ct]', b).forEach((x) => x.onclick = () => applyType(x.dataset.ct));

    // destination options
    G.get('/groups?mine=1').then((r) => {
      const og = G.qs('#cp-groups', b);
      (r.groups || []).forEach((g) => og.appendChild(G.el(`<option value="g:${g.id}">👥 ${esc(g.name)}</option>`)));
      if (!og.children.length) og.remove();
      if (opts.group_id) dest.value = 'g:' + opts.group_id;
    }).catch(() => {});
    G.get('/communities?mine=1').then((r) => {
      const oc = G.qs('#cp-comms', b);
      (r.communities || []).forEach((c) => oc.appendChild(G.el(`<option value="c:${c.id}">🌐 ${esc(c.name)}</option>`)));
      if (!oc.children.length) oc.remove();
      if (opts.community_id) dest.value = 'c:' + opts.community_id;
    }).catch(() => {});
    if (opts.hub) dest.value = opts.hub;
    if (opts.kind) G.qs('#cp-kind', b).value = opts.kind;
    setTimeout(() => { if (opts.contentType) applyType(opts.contentType); }, 40);

    const BIZ = ['Startups', 'Freelancing', 'Marketing', 'E-commerce', 'Technology', 'Business Ideas', 'Networking'];
    const GAME = ['Esports', 'Mobile Gaming', 'PC Gaming', 'Console Gaming', 'Tournaments', 'Teams'];
    function syncTopic() {
      const v = dest.value;
      const wrap = G.qs('#cp-topicwrap', b), sel = G.qs('#cp-topic', b);
      const list = v === 'business' ? BIZ : v === 'gaming' ? GAME : null;
      wrap.hidden = !list;
      if (list) sel.innerHTML = '<option value="">No topic</option>' + list.map((x) => `<option>${x}</option>`).join('');
    }
    dest.addEventListener('change', syncTopic); syncTopic();
    if (opts.topic) { const s = G.qs('#cp-topic', b); if (s) s.value = opts.topic; }

    function drawPreview() {
      const box = G.qs('#cp-preview', b);
      box.innerHTML = media.map((f, i) => `<div class="cp-thumb">
        ${f.type === 'video'
          ? (f.poster ? `<img src="${esc(f.poster)}" alt="Video thumbnail">` : '<div class="cp-thumb-blank">🎬</div>') + '<span class="cp-thumb-tag">HD</span>'
          : `<img src="${esc(f.url)}" alt="Attachment preview">`}
        <button class="iconbtn" data-rm="${i}" aria-label="Remove attachment">✕</button></div>`).join('');
      box.querySelectorAll('[data-rm]').forEach((x) => x.onclick = () => { media.splice(Number(x.dataset.rm), 1); drawPreview(); });
    }

    G.qs('#cp-file', b).onchange = async (e) => {
      const files = [...e.target.files];
      if (!files.length) return;
      if (media.length + files.length > 6) return G.toast('Maximum 6 attachments per post.', 'error');
      const prog = G.qs('#cp-progress', b), bar = G.qs('#cp-bar', b), ptext = G.qs('#cp-ptext', b);
      const goBtn = G.qs('#cp-go', b);
      const setStage = (label, pct) => {
        bar.style.width = Math.max(0, Math.min(100, pct)) + '%';
        ptext.textContent = pct >= 100 && /Ready/.test(label) ? label : `${label} — ${Math.round(pct)}%`;
      };
      prog.hidden = false;
      goBtn.disabled = true;

      const videos = files.filter((f) => (f.type || '').startsWith('video/'));
      const others = files.filter((f) => !(f.type || '').startsWith('video/'));

      try {
        // --- images / files: plain upload ---
        if (others.length) {
          setStage('Uploading', 0);
          const up = await G.uploadFiles(others, (pc) => setStage('Uploading', pc));
          media = media.concat(up.filter((f) => f.type !== 'file'));
          drawPreview();
        }
        // --- videos: upload → process → optimise → ready ---
        for (const file of videos) {
          const asset = await uploadVideo(file, setStage);
          if (asset) {
            media.push({
              type: 'video', url: asset.url, poster: asset.poster, asset_uid: asset.uid,
              width: asset.width, height: asset.height, duration: asset.duration, variants: asset.variants,
            });
            drawPreview();
          }
        }
        if (videos.length) { setStage('Ready ✓', 100); ptext.textContent = 'Ready ✓'; await new Promise((r) => setTimeout(r, 700)); }
      } catch (err) { G.err(err); }
      prog.hidden = true; bar.style.width = '0'; goBtn.disabled = false; e.target.value = '';
    };

    /* Upload one video and follow the server-side pipeline until it can be published. */
    async function uploadVideo(file, setStage) {
      setStage('Uploading video', 0);
      let asset;
      try {
        asset = await G.uploadVideo(file, (pc) => setStage('Uploading video', pc * 0.6));
      } catch (err) { throw err; }
      if (!asset) return null;
      if (asset.status === 'ready' && asset.variants.length) return asset;

      // poll processing progress
      for (let i = 0; i < 600; i++) {
        await new Promise((r) => setTimeout(r, 1200));
        let d;
        try { d = await G.get('/media/video/' + asset.uid); } catch (e) { continue; }
        const a = d.asset;
        if (!a) continue;
        if (a.status === 'failed') {
          const retry = await confirmRetry(asset.uid);
          if (retry) { asset = retry; i = 0; continue; }
          throw new Error('Video processing failed.');
        }
        const label = a.stage === 'analysing' ? 'Processing video'
          : a.stage === 'transcoding' ? 'Optimizing video' : 'Optimizing';
        setStage(label, 60 + (a.progress || 0) * 0.4);
        if (a.status === 'ready' && a.variants.length) return a;
      }
      throw new Error('Video processing is taking too long. Please try again.');
    }

    async function confirmRetry(uid) {
      if (!window.confirm('Video processing failed. Try again?')) return null;
      try { const d = await G.post('/media/video/' + uid + '/retry', {}); return d.asset; }
      catch (e) { return null; }
    }

    G.qs('#cp-go', b).onclick = async (e) => {
      const errBox = G.qs('#cp-err', b);
      errBox.hidden = true;
      const content = ta.value.trim();
      if (!content && !media.length) { errBox.textContent = 'Write something or attach a photo/video.'; errBox.hidden = false; return; }
      const activeType = (G.qs('[data-ct].on', b) || {}).dataset;
      let finalContent = content;
      if (activeType && activeType.ct === 'question' && !/#question/i.test(finalContent)) finalContent += '\n\n#question';
      const payload = { content: finalContent, media, privacy: priv.value, kind: G.qs('#cp-kind', b).value, link_url: G.qs('#cp-link', b).value.trim() };
      const d = dest.value;
      if (d.startsWith('g:')) { payload.group_id = Number(d.slice(2)); payload.hub = 'general'; }
      else if (d.startsWith('c:')) { payload.community_id = Number(d.slice(2)); payload.hub = 'general'; }
      else payload.hub = d;
      const topicSel = G.qs('#cp-topic', b);
      if (topicSel && !G.qs('#cp-topicwrap', b).hidden) payload.topic = topicSel.value;
      e.target.disabled = true; e.target.textContent = 'Publishing…';
      try {
        const r = await G.post('/posts', payload);
        m.close();
        G.toast('Post published 🎉', 'ok');
        if (opts.onDone) opts.onDone(r.post);
        else if (['home', 'business', 'gaming'].includes(S.route.name)) G.render();
      } catch (err) {
        errBox.textContent = err.message; errBox.hidden = false;
        e.target.disabled = false; e.target.innerHTML = G.icon('send', 16) + ' Publish';
      }
    };
  };

  /* ---------------- feed list with infinite scroll ---------------- */
  G.feedList = function (container, url, opts) {
    opts = opts || {};
    let cursor = null, loading = false, done = false;
    container.innerHTML = G.skeletonPost() + G.skeletonPost();
    const list = G.el('<div></div>');
    const sentinel = G.el('<div style="height:40px" aria-hidden="true"></div>');
    let first = true;

    async function load() {
      if (loading || done) return;
      loading = true;
      try {
        const sep = url.includes('?') ? '&' : '?';
        const data = await G.get(url + (cursor ? `${sep}cursor=${cursor}` : ''));
        if (first) { container.innerHTML = ''; container.appendChild(list); container.appendChild(sentinel); first = false; }
        if (data.restricted) { container.innerHTML = G.emptyState('🔒', 'This content is private', 'You need access to view these posts.'); done = true; return; }
        (data.posts || []).forEach((p) => list.appendChild(G.postCard(p)));
        cursor = data.nextCursor;
        if (!cursor) {
          done = true;
          if (!list.children.length) container.innerHTML = opts.empty || G.emptyState('📭', 'No posts yet', 'Be the first to share something here.',
            `<div style="margin-top:12px"><button class="btn btn-primary btn-sm" data-compose>Create a post</button></div>`);
          else sentinel.innerHTML = '<p class="center tiny muted">You are all caught up ✨</p>';
          const cb = container.querySelector('[data-compose]');
          if (cb) cb.onclick = () => G.openComposer(opts.composeOpts || {});
        }
      } catch (e) {
        if (first) { container.innerHTML = G.errorState(e.message, 'feed-retry'); const r = G.qs('#feed-retry', container); if (r) r.onclick = () => { first = true; done = false; G.feedList(container, url, opts); }; }
        else sentinel.innerHTML = `<p class="center small muted">Could not load more. <button class="link" id="more-retry">Retry</button></p>`;
        const mr = G.qs('#more-retry', container); if (mr) mr.onclick = () => { loading = false; load(); };
        done = true;
      }
      loading = false;
    }
    const io = new IntersectionObserver((entries) => { if (entries[0].isIntersecting) load(); }, { rootMargin: '400px' });
    load().then(() => io.observe(sentinel));
    return { reload: () => { cursor = null; done = false; first = true; container.innerHTML = ''; load(); } };
  };

  /* ---------------- small cards ---------------- */
  G.userCard = function (u, opts) {
    opts = opts || {};
    const node = G.el(`<div class="card pad row" style="align-items:flex-start;gap:11px">
      <a href="#/u/${esc(u.username)}">${G.avatar(u, 44)}</a>
      <div class="grow">
        <a class="bold" href="#/u/${esc(u.username)}">${esc(u.full_name)}</a>
        <div class="tiny muted">@${esc(u.username)}</div>
        ${u.bio ? `<div class="small muted" style="margin-top:4px">${esc(u.bio.slice(0, 90))}</div>` : ''}
        <div class="row wrap" style="gap:5px;margin-top:6px">
          ${u.in_business ? '<span class="badge badge-biz">Business</span>' : ''}
          ${u.in_gaming ? '<span class="badge badge-game">Gaming</span>' : ''}
          ${(u.interests || []).map((i) => `<span class="pill">${esc(i)}</span>`).join('')}
        </div>
      </div>
      ${S.user && S.user.id !== u.id ? `<button class="btn btn-sm ${u.i_follow ? 'btn-ghost' : 'btn-primary'}" data-follow>${u.i_follow ? 'Following' : 'Follow'}</button>` : ''}
    </div>`);
    const fb = G.qs('[data-follow]', node);
    if (fb) fb.onclick = async () => {
      fb.disabled = true;
      try {
        const r = await G.post(`/users/${u.id}/follow`);
        u.i_follow = r.following;
        fb.textContent = r.following ? 'Following' : 'Follow';
        fb.className = 'btn btn-sm ' + (r.following ? 'btn-ghost' : 'btn-primary');
      } catch (e) { G.err(e); }
      fb.disabled = false;
    };
    return node;
  };

  G.projectCard = function (p) {
    const cover = (p.media && p.media[0] && p.media[0].type === 'image') ? p.media[0].url : null;
    const title = (p.content || '').split('\n')[0].replace(/#\S+/g, '').trim().slice(0, 70) || 'Untitled project';
    const desc = (p.content || '').replace(title, '').replace(/#\S+/g, '').trim().slice(0, 130);
    const tags = (p.content.match(/#([\p{L}0-9_]{2,24})/gu) || []).slice(0, 3);
    const node = G.el(`<article class="project-card fade-in">
      <div class="project-cover">${cover ? `<img src="${esc(cover)}" alt="">` : esc(title.slice(0, 42))}
        <span class="status-tag">${p.kind === 'collab' ? 'Recruiting' : p.hub === 'gaming' ? 'Team' : 'Active'}</span></div>
      <div class="project-body">
        <div class="bold" style="font-size:15.5px;line-height:1.3">${esc(title)}</div>
        ${desc ? `<p class="small muted" style="margin:0">${esc(desc)}</p>` : ''}
        <div class="row wrap" style="gap:6px">${tags.map((t) => `<span class="pill">${esc(t)}</span>`).join('')}</div>
        <div class="between" style="margin-top:auto;padding-top:12px;border-top:1px solid var(--line-soft)">
          <a class="row" href="#/u/${esc(p.username)}" style="gap:8px">${G.avatar(p, 28)}
            <span class="tiny bold">${esc(p.full_name)}</span></a>
          <span class="tiny muted num">${G.num(p.reaction_count)} · ${G.num(p.comment_count)} 💬</span>
        </div>
        <div class="row" style="gap:8px">
          <button class="btn btn-sm btn-primary grow" data-open>View</button>
          <button class="btn btn-sm btn-ghost" data-msg>${G.icon('messages', 15)}</button>
        </div>
      </div></article>`);
    G.qs('[data-open]', node).onclick = () => { location.hash = '#/post/' + p.id; };
    G.qs('[data-msg]', node).onclick = async () => {
      try { const r = await G.post('/conversations/start', { user_id: p.user_id }); location.hash = '#/messages/' + r.conversation_id; }
      catch (e) { G.err(e); }
    };
    return node;
  };

  G.communityCard = function (c) {
    const node = G.el(`<div class="card pad">
      <div class="row"><div class="avatar" style="width:42px;height:42px;background:linear-gradient(135deg,var(--brand-1),var(--brand-2));font-size:17px">${esc(c.name[0])}</div>
        <div class="grow"><a class="bold" href="#/c/${esc(c.slug)}">${esc(c.name)}</a>
          <div class="tiny muted">${G.num(c.member_count)} members · ${esc(c.category || c.hub)}</div></div></div>
      <p class="small muted" style="margin:9px 0">${esc((c.description || '').slice(0, 110))}</p>
      <button class="btn btn-sm ${c.my_role ? 'btn-ghost' : 'btn-primary'} btn-block" data-join>${c.my_role ? (c.my_role === 'owner' ? 'Owner' : 'Leave') : 'Join'}</button></div>`);
    const jb = G.qs('[data-join]', node);
    jb.onclick = async () => {
      if (!G.requireUser()) return;
      jb.disabled = true;
      try {
        const r = await G.post(`/communities/${c.id}/join`);
        c.my_role = r.joined ? 'member' : null;
        jb.textContent = r.joined ? 'Leave' : 'Join';
        jb.className = 'btn btn-sm btn-block ' + (r.joined ? 'btn-ghost' : 'btn-primary');
        c.member_count += r.joined ? 1 : -1;
      } catch (e) { G.err(e); }
      jb.disabled = false;
    };
    return node;
  };

  G.groupCard = function (g) {
    return G.el(`<a class="card pad" href="#/group/${g.id}" style="display:block">
      <div class="row"><div class="avatar" style="width:42px;height:42px;background:linear-gradient(135deg,#ff5c8a,#7c5cff);font-size:17px">${esc(g.name[0])}</div>
        <div class="grow"><div class="bold">${esc(g.name)}</div>
          <div class="tiny muted">${G.num(g.member_count)} members · ${esc(g.category)} · ${g.privacy === 'private' ? '🔒 Private' : '🌍 Public'}</div></div>
        ${g.my_role ? `<span class="pill">${esc(g.my_role)}</span>` : ''}</div>
      <p class="small muted" style="margin:9px 0 0">${esc((g.description || '').slice(0, 110))}</p></a>`);
  };

  G.eventCard = function (ev, onChange) {
    const node = G.el(`<div class="card pad">
      <div class="row" style="align-items:flex-start">
        <div class="center" style="background:var(--surface-2);border-radius:12px;padding:8px 12px;min-width:62px">
          <div class="tiny muted">${new Date(ev.starts_at).toLocaleString('en', { month: 'short' })}</div>
          <div class="bold" style="font-size:20px">${new Date(ev.starts_at).getDate()}</div></div>
        <div class="grow"><a class="bold" href="#/event/${ev.id}">${esc(ev.title)}</a>
          <div class="tiny muted">${G.fmtDateTime(ev.starts_at)} · ${ev.mode === 'online' ? '💻 Online' : '📍 ' + esc(ev.location || 'In person')}</div>
          <div class="tiny muted">Hosted by ${esc(ev.full_name)} · ${G.num(ev.going_count || 0)} going</div></div>
      </div>
      <div class="row" style="margin-top:10px;gap:6px">
        <button class="btn btn-sm ${ev.my_status === 'going' ? 'btn-primary' : 'btn-ghost'}" data-rsvp="going">✅ Going</button>
        <button class="btn btn-sm ${ev.my_status === 'interested' ? 'btn-primary' : 'btn-ghost'}" data-rsvp="interested">⭐ Interested</button>
        <button class="btn btn-sm ${ev.my_status === 'not_going' ? 'btn-primary' : 'btn-ghost'}" data-rsvp="not_going">✖️ Can't go</button>
      </div></div>`);
    G.qsa('[data-rsvp]', node).forEach((b) => b.onclick = async () => {
      if (!G.requireUser()) return;
      try {
        const r = await G.post(`/events/${ev.id}/rsvp`, { status: b.dataset.rsvp });
        node.replaceWith(G.eventCard(r.event, onChange));
        if (onChange) onChange();
      } catch (e) { G.err(e); }
    });
    return node;
  };
})();
