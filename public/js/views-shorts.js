/* Bloom — Shorts: full-screen vertical video feed built on the existing VOLT player. */
(function () {
  'use strict';
  const G = window.GZ, S = G.state, esc = G.esc;

  function videoShell(m) {
    const data = { url: m.url, poster: m.poster || '', width: m.width || 0, height: m.height || 0,
      duration: m.duration || 0, variants: m.variants || [], asset_uid: m.asset_uid || '', status: m.status || 'ready' };
    const ar = data.width && data.height ? data.width / data.height : 9 / 16;
    return `<div class="short-video gzv${ar < 0.95 ? ' is-portrait' : ''}" style="--gzv-ar:${ar.toFixed(4)}" data-gzv="${esc(JSON.stringify(data))}"></div>`;
  }

  function shortCard(p) {
    const node = G.el(`<article class="short-card" data-post="${p.id}">
      <div class="short-media">${videoShell(p.media[0])}</div>
      <div class="short-shade"></div>
      <div class="short-top"><a href="#/u/${esc(p.username)}" class="short-creator">${G.avatar(p, 42)}<span><b>@${esc(p.username)}</b><small>${esc(p.full_name)}</small></span></a>
        <button class="short-follow btn btn-sm btn-primary" data-follow>${p.user_id === (S.user && S.user.id) ? 'You' : '+ Follow'}</button></div>
      <div class="short-copy">${p.content ? `<div>${G.linkify(p.content)}</div>` : '<div class="short-caption-muted">Short video</div>'}</div>
      <div class="short-actions">
        <button class="short-action ${p.my_reaction ? 'on' : ''}" data-react aria-label="Like">${p.my_reaction ? '❤️' : '♡'}<small data-count-r>${G.num(p.reaction_count || 0)}</small></button>
        <button class="short-action" data-comment aria-label="Comments">💬<small data-count-c>${G.num(p.comment_count || 0)}</small></button>
        <button class="short-action" data-share aria-label="Share">↗<small>Share</small></button>
        <button class="short-action" data-repost aria-label="Repost">🔁<small>Repost</small></button>
        <button class="short-action ${p.is_saved ? 'on' : ''}" data-save aria-label="Save">🔖<small>${p.is_saved ? 'Saved' : 'Save'}</small></button>
      </div>
      <div class="short-comments" data-comments hidden></div>
    </article>`);
    const react = node.querySelector('[data-react]');
    react.onclick = async () => {
      try { const r = await G.post(`/posts/${p.id}/react`, { type: 'like' }); p.my_reaction = r.my_reaction; react.classList.toggle('on', !!r.my_reaction); react.innerHTML = `${r.my_reaction ? '❤️' : '♡'}<small data-count-r>${G.num(r.reaction_count)}</small>`; }
      catch (e) { G.err(e); }
    };
    let pressTimer = null;
    react.addEventListener('contextmenu', (e) => { e.preventDefault(); if (G.openReactionPicker) G.openReactionPicker(react, p, node); });
    react.addEventListener('touchstart', () => { pressTimer = setTimeout(() => G.openReactionPicker && G.openReactionPicker(react, p, node), 450); }, { passive: true });
    react.addEventListener('touchend', () => clearTimeout(pressTimer));
    node.querySelector('[data-comment]').onclick = () => G.toggleComments(node, p);
    node.querySelector('[data-share]').onclick = async () => {
      const url = location.origin + '/#/post/' + p.id;
      try { await navigator.clipboard?.writeText(url); G.toast('Short link copied', 'ok'); } catch (e) { G.toast(url); }
    };
    node.querySelector('[data-repost]').onclick = async () => { try { await G.post(`/posts/${p.id}/repost`, { content: '' }); G.toast('Reposted to your feed', 'ok'); } catch (e) { G.err(e); } };
    node.querySelector('[data-save]').onclick = async () => {
      try { const r = await G.post(`/posts/${p.id}/save`); node.querySelector('[data-save]').classList.toggle('on', r.saved); node.querySelector('[data-save] small').textContent = r.saved ? 'Saved' : 'Save'; }
      catch (e) { G.err(e); }
    };
    node.querySelector('[data-follow]').onclick = async () => {
      if (p.user_id === (S.user && S.user.id)) return;
      try { const r = await G.post(`/users/${p.user_id}/follow`); node.querySelector('[data-follow]').textContent = r.following ? 'Following' : '+ Follow'; }
      catch (e) { G.err(e); }
    };
    if (G.observeRecommendationPost) G.observeRecommendationPost(node, p);
    return node;
  }

  G.route('shorts', async (parts, query) => {
    if (!G.requireUser()) return;
    const view = G.mountShell();
    G.setRail('');
    const scope = query.scope === 'following' ? 'following' : 'for-you';
    view.innerHTML = `<section class="shorts-page"><div class="shorts-head"><div><h1>Shorts</h1><p>Quick ideas, clips and moments from your hubs.</p></div><div class="shorts-tabs"><a class="${scope === 'for-you' ? 'on' : ''}" href="#/shorts">For you</a><a class="${scope === 'following' ? 'on' : ''}" href="#/shorts?scope=following">Following</a></div></div><div id="shorts-feed" class="shorts-feed"><div class="shorts-loading">Loading Shorts…</div></div></section>`;
    const feed = G.qs('#shorts-feed', view);
    let cursor = null, loading = false, done = false;
    const sentinel = G.el('<div class="shorts-sentinel" aria-hidden="true"></div>');
    async function load() {
      if (loading || done) return;
      loading = true;
      try {
        const data = await G.get(`/shorts/feed?scope=${scope}&limit=8` + (cursor ? `&cursor=${cursor}` : ''));
        if (feed.querySelector('.shorts-loading')) feed.innerHTML = '';
        (data.posts || []).forEach((p) => { if (p.media && p.media[0]) feed.appendChild(shortCard(p)); });
        cursor = data.nextCursor;
        if (!cursor) { done = true; sentinel.textContent = feed.children.length ? 'You are all caught up ✨' : 'No Shorts yet — publish a video post to start the feed.'; }
        if (!sentinel.parentNode) feed.appendChild(sentinel);
      } catch (e) {
        if (!feed.querySelector('.short-card')) feed.innerHTML = G.errorState(e.message, 'shorts-retry');
        done = true;
      }
      loading = false;
    }
    const io = new IntersectionObserver((entries) => { if (entries[0].isIntersecting) load(); }, { root: feed, rootMargin: '500px' });
    await load();
    io.observe(sentinel);
  });
})();
