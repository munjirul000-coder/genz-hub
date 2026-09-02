/* Bloom — core: state, API client, helpers, i18n, UI primitives */
(function () {
  'use strict';
  const G = window.GZ = {};

  /* ---------------- state ---------------- */
  const S = G.state = { user: null, interests: [], counts: {}, route: {}, cache: {} };

  /* ---------------- api ---------------- */
  async function api(path, opts = {}) {
    const o = Object.assign({ headers: {}, credentials: 'same-origin' }, opts);
    o.headers['X-GenZ-Client'] = '1';
    if (o.body && !(o.body instanceof FormData)) {
      o.headers['Content-Type'] = 'application/json';
      o.body = JSON.stringify(o.body);
    }
    let res;
    try { res = await fetch('/api' + path, o); }
    catch (e) { throw new Error('Network error. Check your connection and try again.'); }
    let data = {};
    const ctype = res.headers.get('content-type') || '';
    if (ctype.includes('application/json')) { try { data = await res.json(); } catch (e) {} }
    else if (!res.ok) {
      // A proxy/CDN answered instead of Bloom (e.g. Cloudflare 5xx while the demo link sleeps)
      data.error = res.status >= 500
        ? 'Bloom server is not reachable right now (error ' + res.status + '). The demo link may be asleep — refresh in a moment, or use the backup link.'
        : 'Unexpected response from the server (' + res.status + ').';
    }
    if (!res.ok) {
      // Session expired / signed out elsewhere → return to sign-in instead of showing a dead page.
      if (res.status === 401 && !path.startsWith('/auth')) {
        S.user = null;
        const h = (location.hash || '').slice(1);
        const OPEN = ['/auth', '/reset', '/welcome', '/about', '/privacy', '/terms', '/guidelines', '/contact'];
        if (!OPEN.some((p) => h.startsWith(p))) location.hash = '#/auth';
      }
      const err = new Error(data.error || 'Request failed (' + res.status + ')');
      err.status = res.status; err.field = data.field;
      throw err;
    }
    return data;
  }
  G.api = api;
  G.get = (p) => api(p);
  G.post = (p, body) => api(p, { method: 'POST', body: body || {} });
  G.patch = (p, body) => api(p, { method: 'PATCH', body: body || {} });
  G.put = (p, body) => api(p, { method: 'PUT', body: body || {} });
  G.del = (p) => api(p, { method: 'DELETE' });

  G.uploadFiles = async function (files, onProgress) {
    return new Promise((resolve, reject) => {
      const fd = new FormData();
      [...files].forEach((f) => fd.append('files', f));
      const xhr = new XMLHttpRequest();
      xhr.open('POST', '/api/upload');
      xhr.setRequestHeader('X-GenZ-Client', '1');
      xhr.withCredentials = true;
      xhr.upload.onprogress = (e) => { if (e.lengthComputable && onProgress) onProgress(Math.round((e.loaded / e.total) * 100)); };
      xhr.onload = () => {
        let d = {}; try { d = JSON.parse(xhr.responseText); } catch (e) {}
        if (xhr.status >= 200 && xhr.status < 300) resolve(d.files || []);
        else reject(new Error(d.error || 'Upload failed.'));
      };
      xhr.onerror = () => reject(new Error('Upload failed. Check your connection.'));
      xhr.send(fd);
    });
  };

  // Single high-quality video upload → returns the server-side asset (processed in background)
  G.uploadVideo = function (file, onProgress) {
    return new Promise((resolve, reject) => {
      const fd = new FormData();
      fd.append('file', file);
      const xhr = new XMLHttpRequest();
      xhr.open('POST', '/api/media/video');
      xhr.setRequestHeader('X-GenZ-Client', '1');
      xhr.withCredentials = true;
      xhr.upload.onprogress = (e) => { if (e.lengthComputable && onProgress) onProgress(Math.round((e.loaded / e.total) * 100)); };
      xhr.onload = () => {
        let d = {}; try { d = JSON.parse(xhr.responseText); } catch (e) {}
        if (xhr.status >= 200 && xhr.status < 300 && d.asset) resolve(d.asset);
        else reject(new Error(d.error || 'Video upload failed.'));
      };
      xhr.onerror = () => reject(new Error('Video upload failed. Check your connection.'));
      xhr.send(fd);
    });
  };

  /* ---------------- helpers ---------------- */
  const esc = G.esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  G.el = (html) => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; };
  G.qs = (s, r) => (r || document).querySelector(s);
  G.qsa = (s, r) => [...(r || document).querySelectorAll(s)];

  /* ---------------- lightweight recommendation telemetry ---------------- */
  const activityQueue = [];
  let activityTimer = 0;
  async function flushActivity() {
    activityTimer = 0;
    if (!S.user || !activityQueue.length) return;
    const events = activityQueue.splice(0, 25);
    try { await api('/recommendations/activity', { method: 'POST', body: { events } }); }
    catch (e) { /* telemetry must never break the UI */ }
  }
  G.trackActivity = function (action, data) {
    if (!S.user || !action) return;
    activityQueue.push(Object.assign({ action }, data || {}));
    if (activityQueue.length >= 10) flushActivity();
    else if (!activityTimer) activityTimer = setTimeout(flushActivity, 900);
  };
  window.addEventListener('pagehide', () => { if (activityQueue.length) flushActivity(); });

  let recommendationObserver = null;
  const recommendationSeen = new WeakMap();
  G.observeRecommendationPost = function (node, post) {
    if (!S.user || !node || !post || !window.IntersectionObserver) return;
    if (!recommendationObserver) {
      recommendationObserver = new IntersectionObserver((entries) => entries.forEach((entry) => {
        const state = recommendationSeen.get(entry.target);
        if (!state) return;
        if (entry.isIntersecting) {
          state.entered = Date.now();
          state.maxRatio = Math.max(state.maxRatio || 0, entry.intersectionRatio || 0);
        } else if (state.entered) {
          const seconds = (Date.now() - state.entered) / 1000;
          if (seconds < 1.2 && state.maxRatio >= 0.25) G.trackActivity('skip', { post_id: state.postId, value: 1, metadata: { source: 'fast_scroll' } });
          else if (seconds >= 1.2) G.trackActivity('impression', { post_id: state.postId, value: Math.min(seconds, 30) });
          state.entered = 0;
          state.maxRatio = 0;
          if (!document.body.contains(entry.target)) recommendationObserver.unobserve(entry.target);
        }
      }), { threshold: [0, 0.25, 0.5] });
    }
    if (recommendationSeen.has(node)) return;
    recommendationSeen.set(node, { postId: Number(post.id), entered: 0, maxRatio: 0 });
    recommendationObserver.observe(node);
  };

  G.timeAgo = function (ts) {
    const d = Math.floor((Date.now() - ts) / 1000);
    if (d < 45) return G.t('just now');
    const u = [[31536000, 'y'], [2592000, 'mo'], [604800, 'w'], [86400, 'd'], [3600, 'h'], [60, 'm']];
    for (const [s, l] of u) if (d >= s) return Math.floor(d / s) + l;
    return d + 's';
  };
  G.fmtDate = (ts) => new Date(ts).toLocaleDateString(S.user && S.user.lang === 'bn' ? 'bn-BD' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  G.fmtDateTime = (ts) => new Date(ts).toLocaleString(S.user && S.user.lang === 'bn' ? 'bn-BD' : 'en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  G.num = (n) => (n >= 1000000 ? (n / 1000000).toFixed(1) + 'M' : n >= 1000 ? (n / 1000).toFixed(1) + 'K' : String(n || 0));

  const COLORS = ['#7c5cff', '#12d6c8', '#ff5c8a', '#f5a524', '#3ba6ff', '#18b981'];
  G.avatar = function (u, size) {
    size = size || 40;
    const name = (u && (u.full_name || u.username)) || '?';
    const init = name.trim().slice(0, 1);
    const col = COLORS[(name.charCodeAt(0) + name.length) % COLORS.length];
    const st = `width:${size}px;height:${size}px;font-size:${Math.round(size * 0.42)}px`;
    if (u && u.avatar) return `<img class="avatar" style="${st}" src="${esc(u.avatar)}" alt="${esc(name)}" loading="lazy">`;
    return `<div class="avatar" style="${st};background:${col}" aria-hidden="true">${esc(init)}</div>`;
  };
  G.userLink = (u) => `<a class="bold" href="#/u/${esc(u.username)}">${esc(u.full_name)}</a>`;

  G.linkify = function (text) {
    return esc(text)
      .replace(/(https?:\/\/[^\s<]+)/g, (m) => `<a class="tag" href="${m}" target="_blank" rel="noopener noreferrer nofollow">${m}</a>`)
      .replace(/#([\p{L}0-9_]{2,40})/gu, (m, t) => `<a class="tag" href="#/hashtag/${t.toLowerCase()}">#${t}</a>`)
      .replace(/@([a-zA-Z0-9_]{3,20})/g, (m, u) => `<a class="tag" href="#/u/${u}">@${u}</a>`);
  };

  /* ---------------- i18n ---------------- */
  const BN = {
    'Home': 'হোম', 'Explore': 'এক্সপ্লোর', 'Messages': 'মেসেজ', 'Notifications': 'নোটিফিকেশন', 'Groups': 'গ্রুপ',
    'Communities': 'কমিউনিটি', 'Business Hub': 'বিজনেস হাব', 'Gaming Hub': 'গেমিং হাব', 'Saved': 'সেভড',
    'Settings': 'সেটিংস', 'Profile': 'প্রোফাইল', 'Network': 'নেটওয়ার্ক', 'Events': 'ইভেন্ট', 'Create': 'তৈরি করুন',
    'Post': 'পোস্ট', 'Comment': 'কমেন্ট', 'Share': 'শেয়ার', 'Save': 'সেভ', 'Like': 'লাইক', 'Follow': 'ফলো',
    'Following': 'ফলোয়িং', 'Followers': 'ফলোয়ার', 'Log out': 'লগ আউট', 'Search': 'সার্চ',
    'What is happening?': 'কী চলছে?', 'Loading…': 'লোড হচ্ছে…', 'just now': 'এইমাত্র', 'Menu': 'মেনু',
    'Suggested people': 'প্রস্তাবিত মানুষ', 'Trending': 'ট্রেন্ডিং', 'Upcoming events': 'আসন্ন ইভেন্ট',
    'For you': 'তোমার জন্য', 'Posts': 'পোস্ট', 'About': 'সম্পর্কে', 'Media': 'মিডিয়া', 'Admin': 'অ্যাডমিন',
    'Edit profile': 'প্রোফাইল এডিট', 'Nothing here yet': 'এখনও কিছু নেই', 'Retry': 'আবার চেষ্টা করুন',
    'Send': 'পাঠান', 'Reply': 'রিপ্লাই', 'Delete': 'ডিলিট', 'Edit': 'এডিট', 'Report': 'রিপোর্ট', 'Cancel': 'বাতিল',
  };
  G.t = (s) => (S.user && S.user.lang === 'bn' && BN[s]) || s;

  /* ---------------- theme ---------------- */
  G.applyTheme = function (theme) {
    const requested = theme || (S.user && S.user.theme) || localStorage.getItem('gz_theme') || 'dark';
    const t = ['light', 'dark', 'crimson', 'system'].includes(requested) ? requested : 'dark';
    const mq = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)');
    const sys = mq && mq.matches ? 'dark' : 'light';
    document.documentElement.dataset.theme = t === 'system' ? sys : t;
    localStorage.setItem('gz_theme', t);
  };
  if (window.matchMedia) {
    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    if (mql.addEventListener) mql.addEventListener('change', () => G.applyTheme());
  }

  /* ---------------- toast ---------------- */
  G.toast = function (msg, kind) {
    let box = G.qs('.toasts');
    if (!box) { box = G.el('<div class="toasts" role="status" aria-live="polite"></div>'); document.body.appendChild(box); }
    const t = G.el(`<div class="toast ${kind || ''}">${esc(msg)}</div>`);
    box.appendChild(t);
    setTimeout(() => { t.style.opacity = '0'; setTimeout(() => t.remove(), 250); }, 3200);
  };
  G.err = (e) => G.toast(e && e.message ? e.message : 'Something went wrong.', 'error');

  /* ---------------- modal ---------------- */
  G.modal = function (title, bodyHtml, opts) {
    opts = opts || {};
    const ov = G.el(`<div class="overlay" role="dialog" aria-modal="true" aria-label="${esc(title)}">
      <div class="modal">
        <div class="modal-head"><h3 style="margin:0;font-size:17px">${esc(title)}</h3>
          <button class="iconbtn" data-close aria-label="Close dialog">✕</button></div>
        <div class="modal-body"></div>
      </div></div>`);
    const body = G.qs('.modal-body', ov);
    if (typeof bodyHtml === 'string') body.innerHTML = bodyHtml; else body.appendChild(bodyHtml);
    const close = () => { ov.remove(); document.removeEventListener('keydown', onKey); if (opts.onClose) opts.onClose(); };
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    ov.addEventListener('click', (e) => { if (e.target === ov || e.target.closest('[data-close]')) close(); });
    document.addEventListener('keydown', onKey);
    document.body.appendChild(ov);
    const first = body.querySelector('input,textarea,select,button');
    if (first) setTimeout(() => first.focus(), 60);
    return { el: ov, body, close };
  };

  G.confirm = function (title, message, confirmLabel) {
    return new Promise((resolve) => {
      const m = G.modal(title, `<p class="muted" style="margin-top:0">${esc(message)}</p>
        <div class="row" style="justify-content:flex-end;margin-top:16px">
          <button class="btn btn-ghost" data-no>${esc(G.t('Cancel'))}</button>
          <button class="btn btn-danger" data-yes>${esc(confirmLabel || 'Confirm')}</button></div>`,
        { onClose: () => resolve(false) });
      G.qs('[data-no]', m.body).onclick = () => m.close();
      G.qs('[data-yes]', m.body).onclick = () => { resolve(true); m.el.remove(); };
    });
  };

  /* ---------------- states ---------------- */
  G.skeletonPost = () => `<div class="card post"><div class="row"><div class="skel" style="width:42px;height:42px;border-radius:50%"></div>
    <div class="grow"><div class="skel" style="height:11px;width:38%"></div><div class="skel" style="height:9px;width:22%;margin-top:7px"></div></div></div>
    <div class="skel" style="height:11px;width:92%;margin-top:14px"></div><div class="skel" style="height:11px;width:74%;margin-top:8px"></div>
    <div class="skel" style="height:150px;margin-top:12px"></div></div>`;
  G.skeletonList = (n) => Array.from({ length: n || 3 }, () => `<div class="row" style="padding:10px 0"><div class="skel" style="width:40px;height:40px;border-radius:50%"></div>
    <div class="grow"><div class="skel" style="height:10px;width:52%"></div><div class="skel" style="height:9px;width:32%;margin-top:7px"></div></div></div>`).join('');
  G.emptyState = (icon, title, sub, action) => `<div class="empty"><div class="ico">${icon}</div><div class="bold">${esc(title)}</div>
    ${sub ? `<div class="small" style="margin-top:4px">${esc(sub)}</div>` : ''}${action || ''}</div>`;
  G.errorState = (msg, retryId) => `<div class="empty"><div class="ico">⚠️</div><div class="bold">${esc(msg)}</div>
    <button class="btn btn-ghost btn-sm" style="margin-top:12px" id="${retryId || 'gz-retry'}">${esc(G.t('Retry'))}</button></div>`;

  /* ---------------- router ---------------- */
  const routes = G.routes = {};
  G.route = (pattern, handler) => { routes[pattern] = handler; };
  G.navigate = (hash) => { if (location.hash === hash) G.render(); else location.hash = hash; };

  G.parseHash = function () {
    const raw = (location.hash || '#/').slice(1);
    const [pathPart, queryPart] = raw.split('?');
    const parts = pathPart.split('/').filter(Boolean);
    const query = {};
    (queryPart || '').split('&').filter(Boolean).forEach((kv) => { const [k, v] = kv.split('='); query[decodeURIComponent(k)] = decodeURIComponent(v || ''); });
    return { parts, query, path: '/' + parts.join('/') };
  };

  G.render = async function () {
    const { parts, query } = G.parseHash();
    const name = parts[0] || 'home';
    S.route = { name, parts, query };
    const handler = routes[name] || routes['404'];
    const main = G.qs('#view');
    window.scrollTo({ top: 0 });
    document.querySelectorAll('.overlay').forEach((o) => o.remove());
    try { await handler(parts.slice(1), query, main); }
    catch (e) { console.error(e); main.innerHTML = G.errorState(e.message || 'Failed to load this page.'); const b = G.qs('#gz-retry'); if (b) b.onclick = () => G.render(); }
    G.updateNavState();
  };

  G.requireUser = function () {
    if (!S.user) { location.hash = '#/auth'; return false; }
    return true;
  };

  window.addEventListener('hashchange', () => G.render());
})();
