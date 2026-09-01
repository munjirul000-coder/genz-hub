/* Gen-Z Hub — Shorts: immersive TikTok-style vertical video feed.
   Layout reference: centred portrait video, right action rail with counters,
   bottom-left creator info, thin progress bar, snap scrolling. */
(function () {
  'use strict';
  const G = window.GZ, S = G.state, esc = G.esc;

  /* ------------------------------------------------------------- icons */
  const I = {
    heart: '<svg viewBox="0 0 24 24" width="30" height="30" aria-hidden="true"><path fill="currentColor" d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>',
    comment: '<svg viewBox="0 0 24 24" width="29" height="29" aria-hidden="true"><path fill="currentColor" d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/></svg>',
    bookmark: '<svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true"><path fill="currentColor" d="M17 3H7c-1.1 0-2 .9-2 2v16l7-3 7 3V5c0-1.1-.9-2-2-2z"/></svg>',
    share: '<svg viewBox="0 0 24 24" width="30" height="30" aria-hidden="true"><path fill="currentColor" d="M10 9V5l-7 7 7 7v-4.1c5 0 8.5 1.6 11 5.1-1-5-4-10-11-11z"/></svg>',
    note: '<svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true"><path fill="currentColor" d="M12 3v10.55A4 4 0 1 0 14 17V7h4V3h-6z"/></svg>',
    plus: '<svg viewBox="0 0 24 24" width="13" height="13" aria-hidden="true"><path fill="currentColor" d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>',
    check: '<svg viewBox="0 0 24 24" width="13" height="13" aria-hidden="true"><path fill="currentColor" d="M9 16.2L4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2z"/></svg>',
  };
  const heartBig = '<svg viewBox="0 0 24 24" width="110" height="110" aria-hidden="true"><path fill="#fe2c55" d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>';

  /* ------------------------------------------------------------- video shell (VOLT) */
  function videoShell(m) {
    const data = { url: m.url, poster: m.poster || '', width: m.width || 0, height: m.height || 0,
      duration: m.duration || 0, variants: m.variants || [], asset_uid: m.asset_uid || '', status: m.status || 'ready' };
    const ar = data.width && data.height ? data.width / data.height : 9 / 16;
    return `<div class="short-video gzv${ar < 0.95 ? ' is-portrait' : ''}" style="--gzv-ar:${ar.toFixed(4)}" data-gzv="${esc(JSON.stringify(data))}"></div>`;
  }

  function railBtn({ id, icon, count, label, on }) {
    return `<button class="tt-btn${on ? ' on' : ''}" ${id ? `data-${id}` : ''} aria-label="${label}">
      <span class="tt-ic">${icon}</span><span class="tt-count" ${id === 'share' ? 'data-count-share' : `data-count-${id}`}>${count}</span>
    </button>`;
  }

  /* ------------------------------------------------------------- card */
  function shortCard(p) {
    const mine = S.user && p.user_id === S.user.id;
    const caption = G.linkify(p.content || '');
    const long = (p.content || '').length > 92;
    const firstTag = (p.content.match(/#([\p{L}\p{N}_]+)/u) || [])[1] || '';
    const node = G.el(`<article class="short-card tt" data-post="${p.id}">
      <div class="short-media">${videoShell(p.media[0])}</div>
      <div class="short-shade"></div>

      <nav class="tt-tabs" aria-label="Shorts feed">
        <a class="${S.shortsScope !== 'following' ? 'on' : ''}" href="#/shorts" data-scope="for-you">For You</a>
        <a class="${S.shortsScope === 'following' ? 'on' : ''}" href="#/shorts?scope=following" data-scope="following">Following</a>
      </nav>

      <div class="tt-info">
        <a class="tt-author" href="#/u/${esc(p.username)}">@${esc(p.username)}</a>
        <div class="tt-caption${long ? ' clamp' : ''}" data-caption>${caption}</div>
        ${long ? '<button class="tt-more" data-more>more</button>' : ''}
        <div class="tt-sound"><a href="#/u/${esc(p.username)}">${I.note}<span class="tt-sound-text">original sound — <b>${esc(p.full_name)}</b></span></a></div>
      </div>

      <div class="tt-rail">
        <div class="tt-creator">
          <a href="#/u/${esc(p.username)}" aria-label="${esc(p.username)}">${G.avatar(p, 46)}</a>
          ${mine ? '' : `<button class="tt-follow${p.is_following ? ' done' : ''}" data-follow aria-label="Follow">${p.is_following ? I.check : I.plus}</button>`}
        </div>
        ${railBtn({ id: 'react', icon: I.heart, count: G.num(p.reaction_count || 0), label: 'Like', on: !!p.my_reaction })}
        ${railBtn({ id: 'comment', icon: I.comment, count: G.num(p.comment_count || 0), label: 'Comments' })}
        ${railBtn({ id: 'save', icon: I.bookmark, count: G.num(p.save_count || 0), label: 'Save', on: !!p.is_saved })}
        ${railBtn({ id: 'share', icon: I.share, count: G.num(p.repost_count || 0), label: 'Repost' })}
        <a class="tt-disc${mine ? '' : ''}" href="#/u/${esc(p.username)}" aria-label="Sound" title="original sound — ${esc(p.full_name)}"><span>${I.note}</span></a>
      </div>

      <div class="tt-progress"><i data-prog></i></div>
      <div class="tt-burst" data-burst hidden>${heartBig}</div>
      <div class="short-comments" data-comments hidden></div>
    </article>`);

    const q = (s) => node.querySelector(s);
    const setCount = (name, n) => { const el = q(`[data-count-${name}]`); if (el) el.textContent = G.num(n); };

    /* like */
    const reactBtn = q('[data-react]');
    const doLike = async () => {
      try {
        const r = await G.post(`/posts/${p.id}/react`, { type: 'like' });
        p.my_reaction = r.my_reaction;
        reactBtn.classList.toggle('on', !!r.my_reaction);
        setCount('react', r.reaction_count);
      } catch (e) { G.err(e); }
    };
    reactBtn.onclick = doLike;

    /* double-tap / double-click on the video → like + heart burst (TikTok behaviour) */
    const stage = q('.short-media');
    let lastTap = 0;
    stage.addEventListener('click', () => {
      const now = Date.now();
      if (now - lastTap < 320) {
        const burst = q('[data-burst]');
        if (!p.my_reaction) doLike();
        burst.hidden = false;
        burst.classList.remove('pop'); void burst.offsetWidth; burst.classList.add('pop');
        clearTimeout(burst._t); burst._t = setTimeout(() => { burst.hidden = true; }, 750);
      }
      lastTap = now;
    });

    /* comments */
    q('[data-comment]').onclick = () => G.toggleComments(node, p);

    /* save */
    q('[data-save]').onclick = async () => {
      try {
        const r = await G.post(`/posts/${p.id}/save`);
        q('[data-save]').classList.toggle('on', r.saved);
        setCount('save', r.saved ? (p.save_count || 0) + 1 : Math.max(0, (p.save_count || 1) - 1));
        p.save_count = r.saved ? (p.save_count || 0) + 1 : Math.max(0, (p.save_count || 1) - 1);
      } catch (e) { G.err(e); }
    };

    /* repost (counted under the share arrow) */
    q('[data-share]').onclick = async () => {
      try {
        await G.post(`/posts/${p.id}/repost`, { content: '' });
        p.repost_count = (p.repost_count || 0) + 1;
        setCount('share', p.repost_count);
        G.toast('Reposted to your feed', 'ok');
      } catch (e) { G.err(e); }
    };

    /* follow — avatar badge */
    const follow = q('[data-follow]');
    if (follow) follow.onclick = async () => {
      try {
        const r = await G.post(`/users/${p.user_id}/follow`);
        follow.classList.toggle('done', r.following);
        follow.innerHTML = r.following ? I.check : I.plus;
      } catch (e) { G.err(e); }
    };

    /* caption more/less */
    const more = q('[data-more]');
    if (more) more.onclick = () => {
      const cap = q('[data-caption]');
      const open = cap.classList.toggle('clamp');
      more.textContent = open ? 'more' : 'less';
    };

    /* thin progress bar — media events don't bubble, capture them instead */
    node.addEventListener('timeupdate', (e) => {
      const v = e.target;
      const bar = q('[data-prog]');
      if (bar && v.duration > 0) bar.style.width = `${Math.min(100, (v.currentTime / v.duration) * 100)}%`;
    }, true);
    node.addEventListener('ended', (e) => { const bar = q('[data-prog]'); if (bar) bar.style.width = '0%'; }, true);

    if (G.observeRecommendationPost) G.observeRecommendationPost(node, p);
    return node;
  }

  /* ------------------------------------------------------------- route */
  G.route('shorts', async (parts, query) => {
    if (!G.requireUser()) return;
    const scope = query.scope === 'following' ? 'following' : 'for-you';
    S.shortsScope = scope;
    const view = G.mountShell();
    G.setRail('');
    view.innerHTML = `<section class="shorts-page tt-page"><div id="shorts-feed" class="shorts-feed"><div class="shorts-loading">Loading Shorts…</div></div></section>`;
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
