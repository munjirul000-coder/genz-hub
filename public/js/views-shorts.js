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
        <button class="short-action ${p.my_reaction ? 'on' : ''}" data-react aria-label="Like">${G.icon('heart', 25)}<small data-count-r>${G.num(p.reaction_count || 0)}</small></button>
        <button class="short-action" data-comment aria-label="Comments">${G.icon('comment', 25)}<small data-count-c>${G.num(p.comment_count || 0)}</small></button>
        <button class="short-action" data-share aria-label="Share">${G.icon('send', 25)}<small>Share</small></button>
        <button class="short-action" data-repost aria-label="Repost">${G.icon('repost', 25)}<small>Repost</small></button>
        <button class="short-action ${p.is_saved ? 'on' : ''}" data-save aria-label="Save">${G.icon('bookmark', 25)}<small>${p.is_saved ? 'Saved' : 'Save'}</small></button>
      </div>
      <div class="short-comments" data-comments hidden></div>
    </article>`);
    const react = node.querySelector('[data-react]');
    react.onclick = async () => {
      try { const r = await G.post(`/posts/${p.id}/react`, { type: 'like' }); p.my_reaction = r.my_reaction; react.classList.toggle('on', !!r.my_reaction); react.innerHTML = `${G.icon('heart', 25)}<small data-count-r>${G.num(r.reaction_count)}</small>`; }
      catch (e) { G.err(e); }
    };
    let pressTimer = null;
    react.addEventListener('contextmenu', (e) => { e.preventDefault(); if (G.openReactionPicker) G.openReactionPicker(react, p, node); });
    react.addEventListener('touchstart', () => { pressTimer = setTimeout(() => G.openReactionPicker && G.openReactionPicker(react, p, node), 450); }, { passive: true });
    react.addEventListener('touchend', () => clearTimeout(pressTimer));
    node.querySelector('[data-comment]').onclick = () => {
      if (window.innerWidth > 900 && G.openShortCommentsRail) return G.openShortCommentsRail(p);
      G.toggleComments(node, p);
    };
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

  async function exportEditedVideo(file, edit, setStage) {
    if (!window.MediaRecorder || !HTMLCanvasElement.prototype.captureStream) {
      throw new Error('Your browser does not support in-browser video editing. Please use an updated Chrome, Edge or Safari.');
    }
    const url = URL.createObjectURL(file);
    const video = document.createElement('video');
    video.src = url; video.muted = false; video.playsInline = true; video.preload = 'auto';
    await new Promise((resolve, reject) => { video.onloadedmetadata = resolve; video.onerror = () => reject(new Error('Could not read this video.')); });
    const start = Math.max(0, Math.min(Number(edit.start) || 0, video.duration));
    const end = Math.max(start + 0.1, Math.min(Number(edit.end) || video.duration, video.duration));
    const speed = [0.5, 1, 1.5, 2].includes(Number(edit.speed)) ? Number(edit.speed) : 1;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 720; canvas.height = video.videoHeight || 1280;
    const ctx = canvas.getContext('2d');
    const stream = canvas.captureStream(30);
    if (video.captureStream) video.captureStream().getAudioTracks().forEach((track) => stream.addTrack(track));
    const mime = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'].find((x) => MediaRecorder.isTypeSupported(x)) || '';
    const recorder = new MediaRecorder(stream, mime ? { mimeType: mime, videoBitsPerSecond: 6000000 } : undefined);
    const chunks = [];
    recorder.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
    const filters = {
      none: 'none', vivid: 'contrast(1.15) saturate(1.35)', mono: 'grayscale(1) contrast(1.08)',
      warm: 'sepia(.22) saturate(1.25)', cool: 'hue-rotate(185deg) saturate(1.12)',
    };
    const drawText = (text) => {
      if (!text) return;
      ctx.font = `700 ${Math.max(20, Math.round(canvas.width / 24))}px sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
      ctx.fillStyle = 'rgba(0,0,0,.62)'; ctx.fillRect(0, canvas.height - Math.round(canvas.height / 7), canvas.width, Math.round(canvas.height / 7));
      ctx.fillStyle = '#fff'; ctx.fillText(String(text).slice(0, 80), canvas.width / 2, canvas.height - Math.round(canvas.height / 18));
    };
    let raf = 0;
    setStage('Rendering edit', 0);
    await new Promise((resolve, reject) => {
      recorder.onerror = () => reject(new Error('Video edit export failed.'));
      recorder.onstop = resolve;
      video.currentTime = start;
      video.playbackRate = speed;
      video.onended = () => { if (recorder.state !== 'inactive') recorder.stop(); };
      const frame = () => {
        if (video.currentTime >= end || video.ended) { if (recorder.state !== 'inactive') recorder.stop(); cancelAnimationFrame(raf); return; }
        ctx.save(); ctx.filter = filters[edit.filter] || 'none'; ctx.drawImage(video, 0, 0, canvas.width, canvas.height); ctx.restore(); drawText(edit.overlay);
        setStage('Rendering edit', Math.round(((video.currentTime - start) / (end - start)) * 100));
        raf = requestAnimationFrame(frame);
      };
      video.play().then(() => { recorder.start(200); frame(); }).catch(() => reject(new Error('The browser blocked video editing playback.')));
    });
    video.pause(); stream.getTracks().forEach((track) => track.stop()); URL.revokeObjectURL(url);
    return new File([new Blob(chunks, { type: mime || 'video/webm' })], 'bloom-short-edited.webm', { type: mime || 'video/webm' });
  }

  function openShortComposer() {
    if (!G.requireUser()) return;
    let cameraStream = null, recorder = null, chunks = [];
    const m = G.modal('Create a Short', `<div class="short-create">
      <p class="small muted" style="margin-top:0">Record with your camera or choose a video from your device.</p>
      <input type="file" id="short-file" accept="video/*,.mp4,.mov,.webm,.mkv,.m4v" hidden>
      <div class="row wrap" style="gap:9px"><button class="btn btn-primary" id="short-upload">🎞️ Upload video</button><button class="btn btn-ghost" id="short-camera">📹 Use camera</button></div>
      <video id="short-camera-preview" autoplay muted playsinline hidden style="width:100%;max-height:52vh;border-radius:16px;background:#000;margin-top:14px"></video>
      <div class="row" style="justify-content:center;margin-top:10px"><button class="btn btn-primary" id="short-record" hidden>Start recording</button></div>
      <div class="err" id="short-create-error" hidden></div></div>`, { onClose: () => { if (cameraStream) cameraStream.getTracks().forEach((track) => track.stop()); if (recorder && recorder.state !== 'inactive') recorder.stop(); } });
    const err = G.qs('#short-create-error', m.body);
    const showError = (text) => { err.textContent = text; err.hidden = false; };
    const openFileEditor = (file) => { if (!file) return; m.close(); openShortEditor(file); };
    G.qs('#short-upload', m.body).onclick = () => G.qs('#short-file', m.body).click();
    G.qs('#short-file', m.body).onchange = (e) => openFileEditor(e.target.files[0]);
    G.qs('#short-camera', m.body).onclick = async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) throw new Error('Camera recording is not supported in this browser.');
        cameraStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 720 }, height: { ideal: 1280 } }, audio: true });
        const preview = G.qs('#short-camera-preview', m.body); preview.srcObject = cameraStream; preview.hidden = false;
        const record = G.qs('#short-record', m.body); record.hidden = false;
        record.onclick = () => {
          if (recorder && recorder.state === 'recording') { recorder.stop(); record.disabled = true; record.textContent = 'Saving recording…'; return; }
          chunks = [];
          const mime = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'].find((x) => MediaRecorder.isTypeSupported(x)) || '';
          recorder = new MediaRecorder(cameraStream, mime ? { mimeType: mime } : undefined);
          recorder.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
          recorder.onstop = () => { const type = mime || 'video/webm'; openFileEditor(new File([new Blob(chunks, { type })], 'bloom-camera.webm', { type })); };
          recorder.start(); record.textContent = '⏹ Stop recording'; record.classList.add('btn-danger');
        };
      } catch (e) { showError(e.message || 'Camera permission was denied.'); }
    };
  }

  function openShortEditor(file) {
    const url = URL.createObjectURL(file);
    const m = G.modal('Edit Short', `<div class="short-editor">
      <video id="se-video" src="${esc(url)}" controls playsinline style="width:100%;max-height:48vh;border-radius:16px;background:#000"></video>
      <div class="row wrap" style="gap:8px;margin-top:12px"><label class="field grow"><span class="label">Start seconds</span><input class="input" id="se-start" type="number" min="0" step="0.1" value="0"></label><label class="field grow"><span class="label">End seconds</span><input class="input" id="se-end" type="number" min="0" step="0.1" value="0"></label></div>
      <div class="row wrap" style="gap:8px"><label class="field grow"><span class="label">Speed</span><select class="select" id="se-speed"><option value="0.5">0.5x</option><option value="1" selected>1x</option><option value="1.5">1.5x</option><option value="2">2x</option></select></label><label class="field grow"><span class="label">Filter</span><select class="select" id="se-filter"><option value="none">Original</option><option value="vivid">Vivid</option><option value="mono">Mono</option><option value="warm">Warm</option><option value="cool">Cool</option></select></label></div>
      <label class="field"><span class="label">Text overlay (optional)</span><input class="input" id="se-overlay" maxlength="80" placeholder="Add a short text overlay"></label>
      <label class="field"><span class="label">Caption and hashtags</span><textarea class="textarea" id="se-caption" maxlength="500" placeholder="Write a caption… #bloom"></textarea></label>
      <div id="se-progress" hidden><div style="height:6px;background:var(--surface-2);border-radius:6px;overflow:hidden"><div id="se-bar" style="height:100%;width:0;background:var(--accent-bg)"></div></div><div class="tiny muted" id="se-progress-text">Preparing…</div></div>
      <div class="err" id="se-error" hidden></div><div class="row" style="justify-content:flex-end"><button class="btn btn-primary" id="se-publish">Edit and publish</button></div></div>`, { onClose: () => URL.revokeObjectURL(url) });
    const video = G.qs('#se-video', m.body), end = G.qs('#se-end', m.body), filter = G.qs('#se-filter', m.body), progress = G.qs('#se-progress', m.body), bar = G.qs('#se-bar', m.body), ptext = G.qs('#se-progress-text', m.body), error = G.qs('#se-error', m.body), publish = G.qs('#se-publish', m.body);
    video.onloadedmetadata = () => { end.value = (video.duration || 0).toFixed(1); end.max = video.duration || 0; G.qs('#se-start', m.body).max = video.duration || 0; };
    filter.onchange = () => { video.style.filter = ({ none: 'none', vivid: 'contrast(1.15) saturate(1.35)', mono: 'grayscale(1) contrast(1.08)', warm: 'sepia(.22) saturate(1.25)', cool: 'hue-rotate(185deg) saturate(1.12)' })[filter.value]; };
    publish.onclick = async () => {
      error.hidden = true; publish.disabled = true; progress.hidden = false;
      try {
        const edited = await exportEditedVideo(file, { start: G.qs('#se-start', m.body).value, end: end.value, speed: G.qs('#se-speed', m.body).value, filter: filter.value, overlay: G.qs('#se-overlay', m.body).value }, (label, pct) => { bar.style.width = pct + '%'; ptext.textContent = `${label} — ${pct}%`; });
        ptext.textContent = 'Uploading video…'; const asset = await G.uploadVideo(edited, (pct) => { bar.style.width = pct * .6 + '%'; ptext.textContent = `Uploading video — ${pct}%`; });
        const caption = G.qs('#se-caption', m.body).value.trim();
        await G.post('/posts', { content: caption, hub: 'general', privacy: 'public', media: [{ type: 'video', asset_uid: asset.uid }] });
        m.close(); G.toast('Short published 🎉', 'ok'); G.render();
      } catch (e) { error.textContent = e.message || 'Could not publish this Short.'; error.hidden = false; progress.hidden = true; publish.disabled = false; }
    };
  }

  function shortsSidebar(scope) {
    return `<div class="shorts-side-brand"><a href="#/" aria-label="Bloom home"><span class="shorts-brand-mark">B</span><span>BLOOM</span></a></div>
      <form class="shorts-side-search" data-short-search role="search"><span>${G.icon('search', 18)}</span><input type="search" placeholder="Search" aria-label="Search Bloom"></form>
      <div class="shorts-side-nav">
        <a class="shorts-side-link" href="#/"><span>${G.icon('home', 23)}</span><b>Home</b></a>
        <a class="shorts-side-link ${scope === 'for-you' ? 'on' : ''}" href="#/shorts"><span>${G.icon('explore', 23)}</span><b>For You</b></a>
        <a class="shorts-side-link ${scope === 'following' ? 'on' : ''}" href="#/shorts?scope=following"><span>${G.icon('network', 23)}</span><b>Following</b></a>
        <a class="shorts-side-link" href="#/shorts"><span>${G.icon('gaming', 23)}</span><b>Shorts</b></a>
        <a class="shorts-side-link" href="#/explore?tab=people"><span>${G.icon('groups', 23)}</span><b>Friends</b></a>
        <a class="shorts-side-link" href="#/explore?tab=live"><span>${G.icon('camera', 23)}</span><b>LIVE</b></a>
        <a class="shorts-side-link" href="#/notifications"><span>${G.icon('bell', 23)}</span><b>Activity</b></a>
      </div>
      <div class="shorts-side-rule"></div>
      <div class="shorts-side-nav shorts-side-secondary">
        <button class="shorts-side-link" type="button" data-short-upload><span>${G.icon('plus', 23)}</span><b>Upload</b></button>
        <a class="shorts-side-link" href="#/u/${esc(S.user.username)}"><span>${G.icon('user', 23)}</span><b>Profile</b></a>
        <button class="shorts-side-link" type="button" data-short-more><span>${G.icon('more', 23)}</span><b>More</b></button>
      </div>
      <div class="shorts-side-footer">Bloom · Connect. Build. Play. Grow.</div>`;
  }

  function shortsRail() {
    return `<section class="short-comments-rail">
      <div class="short-comments-rail-head"><div><b>Comments</b><span id="short-rail-count">0</span></div><button class="short-rail-close" type="button" data-short-rail-close aria-label="Close comments">${G.icon('close', 19)}</button></div>
      <div class="short-comments-rail-sub" id="short-rail-sub">Share your thoughts on this Short.</div>
      <div class="short-comments-rail-body" id="short-rail-body"><div class="short-rail-empty">Comments will appear here when you open a Short.</div></div>
    </section>`;
  }

  G.route('shorts', async (parts, query) => {
    if (!G.requireUser()) return;
    const view = G.mountShell();
    const scope = query.scope === 'following' ? 'following' : 'for-you';
    document.body.classList.add('shorts-mode');

    const side = G.qs('#shorts-sidenav');
    if (side) {
      side.hidden = false;
      side.innerHTML = shortsSidebar(scope);
      G.qsa('[data-short-upload]', side).forEach((button) => { button.onclick = openShortComposer; });
      const more = G.qs('[data-short-more]', side);
      if (more) more.onclick = () => G.modal('More', `<div class="stack"><a class="row card pad" href="#/settings" data-close>${G.icon('settings', 19)} Settings</a><a class="row card pad" href="#/saved" data-close>${G.icon('saved', 19)} Saved</a><a class="row card pad" href="#/messages" data-close>${G.icon('messages', 19)} Messages</a></div>`);
      const search = G.qs('[data-short-search]', side);
      if (search) search.onsubmit = (event) => { event.preventDefault(); const value = search.querySelector('input').value.trim(); if (value) location.hash = '#/explore?q=' + encodeURIComponent(value); };
    }

    G.setRail(shortsRail());
    const railBody = G.qs('#short-rail-body');
    const railSub = G.qs('#short-rail-sub');
    const railCount = G.qs('#short-rail-count');
    const railEmpty = () => { if (railBody) railBody.innerHTML = '<div class="short-rail-empty">Comments will appear here when you open a Short.</div>'; };
    G.openShortCommentsRail = async (post) => {
      if (!railBody) return;
      if (railCount) railCount.textContent = G.num(post.comment_count || 0);
      if (railSub) railSub.textContent = `Comments on @${post.username}`;
      railBody.innerHTML = '';
      const holder = G.el('<div class="short-rail-holder"><div data-comments hidden></div></div>');
      railBody.appendChild(holder);
      await G.toggleComments(holder, post);
    };
    const railClose = G.qs('[data-short-rail-close]');
    if (railClose) railClose.onclick = () => { railEmpty(); if (railSub) railSub.textContent = 'Share your thoughts on this Short.'; if (railCount) railCount.textContent = '0'; };

    view.innerHTML = `<section class="shorts-page tiktok-shorts-page">
      <div class="shorts-mobile-head"><a class="shorts-mobile-brand" href="#/" aria-label="Bloom home"><span class="shorts-brand-mark">B</span><b>BLOOM</b></a><div class="shorts-mobile-tabs"><a class="${scope === 'for-you' ? 'on' : ''}" href="#/shorts">For You</a><a class="${scope === 'following' ? 'on' : ''}" href="#/shorts?scope=following">Following</a></div><button class="shorts-mobile-more" type="button" data-short-upload aria-label="Create a Short">${G.icon('plus', 20)}</button></div>
      <div class="shorts-desktop-head"><div class="shorts-desktop-spacer"></div><div class="shorts-feed-switcher"><a class="${scope === 'for-you' ? 'on' : ''}" href="#/shorts">For You</a><a class="${scope === 'following' ? 'on' : ''}" href="#/shorts?scope=following">Following</a></div><button class="shorts-header-upload" type="button" data-short-upload>${G.icon('plus', 17)} Upload</button></div>
      <div id="shorts-feed" class="shorts-feed"><div class="shorts-loading">Loading Shorts…</div></div>
      <nav class="shorts-mobile-nav" aria-label="Shorts navigation"><a href="#/" data-short-mobile="home"><span>${G.icon('home', 21)}</span><small>Home</small></a><a class="on" href="#/shorts" data-short-mobile="shorts"><span>${G.icon('explore', 21)}</span><small>For You</small></a><button type="button" data-short-upload aria-label="Create a Short"><span>${G.icon('plus', 22)}</span><small>Create</small></button><a href="#/messages" data-short-mobile="inbox"><span>${G.icon('messages', 21)}</span><small>Inbox</small></a><a href="#/u/${esc(S.user.username)}" data-short-mobile="profile"><span>${G.icon('user', 21)}</span><small>Profile</small></a></nav>
    </section>`;
    G.qsa('[data-short-upload]', view).forEach((button) => { button.onclick = openShortComposer; });
    const feed = G.qs('#shorts-feed', view);
    let cursor = null, loading = false, done = false;
    const sentinel = G.el('<div class="shorts-sentinel" aria-hidden="true"></div>');
    async function load() {
      if (loading || done) return;
      loading = true;
      try {
        const data = await G.get(`/shorts/feed?scope=${scope}&limit=8` + (cursor ? `&cursor=${cursor}` : ''));
        if (feed.querySelector('.shorts-loading')) feed.innerHTML = '';
        const hadCards = !!feed.querySelector('.short-card');
        const loadedPosts = (data.posts || []).filter((p) => p.media && p.media[0]);
        loadedPosts.forEach((p) => feed.appendChild(shortCard(p)));
        // TikTok opens the discussion rail beside the active video on desktop.
        if (!hadCards && loadedPosts[0] && window.innerWidth > 900) G.openShortCommentsRail(loadedPosts[0]);
        cursor = data.nextCursor;
        if (!feed.querySelector('.short-card') && !cursor) {
          done = true;
          feed.innerHTML = G.emptyState('🎬', 'No Shorts yet', 'Upload a video directly from this Shorts page to start your feed.', '<div style="margin-top:12px"><button class="btn btn-primary btn-sm" id="shorts-create-empty">＋ Create Short</button></div>');
          const emptyCreate = G.qs('#shorts-create-empty', feed);
          if (emptyCreate) emptyCreate.onclick = openShortComposer;
          return;
        }
        if (!cursor) { done = true; sentinel.textContent = 'You are all caught up ✨'; }
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
