/* Gen-Z Hub — app shell: topbar, sidebar, mobile tabbar, boot */
(function () {
  'use strict';
  const G = window.GZ, S = G.state, esc = G.esc;
  let shellMounted = false;
  let badges = { notifications: 0, messages: 0, requests: 0 };

  const NAV = [
    ['home', '🏠', 'Home', '#/'],
    ['explore', '🧭', 'Explore', '#/explore'],
    ['network', '🤝', 'Network', '#/network'],
    ['messages', '💬', 'Messages', '#/messages'],
    ['notifications', '🔔', 'Notifications', '#/notifications'],
    ['groups', '👥', 'Groups', '#/groups'],
    ['communities', '🌐', 'Communities', '#/communities'],
    ['business', '💼', 'Business Hub', '#/business'],
    ['gaming', '🎮', 'Gaming Hub', '#/gaming'],
    ['events', '📅', 'Events', '#/events'],
    ['saved', '🔖', 'Saved', '#/saved'],
    ['settings', '⚙️', 'Settings', '#/settings'],
  ];

  G.mountFull = function (html) {
    shellMounted = false;
    const root = G.qs('#root');
    root.innerHTML = '';
    const wrap = G.el('<div id="view"></div>');
    wrap.innerHTML = html || '';
    root.appendChild(wrap);
    return wrap;
  };

  G.mountShell = function () {
    if (shellMounted) return G.qs('#view');
    shellMounted = true;
    const u = S.user;
    const root = G.qs('#root');
    root.innerHTML = `
      <header class="topbar">
        <div class="topbar-in">
          <a class="logo" href="#/" aria-label="Gen-Z Hub home">
            <span class="logo-mark" aria-hidden="true">Z</span><span class="txt">GEN-Z HUB</span></a>
          <form class="searchbox" id="topsearch" role="search">
            <span class="si" aria-hidden="true">🔍</span>
            <input type="search" id="q" placeholder="${esc(G.t('Search'))} people, posts, #tags…" aria-label="Search Gen-Z Hub">
          </form>
          <div class="row" style="margin-left:auto;gap:8px">
            <button class="iconbtn" id="nav-theme" title="Toggle theme" aria-label="Toggle colour theme">🌓</button>
            <a class="iconbtn" href="#/messages" title="Messages" aria-label="Messages"><span aria-hidden="true">💬</span><span class="dot" id="b-messages" hidden></span></a>
            <a class="iconbtn" href="#/notifications" title="Notifications" aria-label="Notifications"><span aria-hidden="true">🔔</span><span class="dot" id="b-notifications" hidden></span></a>
            <div style="position:relative">
              <button class="iconbtn" id="nav-me" aria-label="Account menu" style="padding:0;overflow:hidden">${G.avatar(u, 38)}</button>
            </div>
          </div>
        </div>
      </header>
      <div class="shell">
        <nav class="side" aria-label="Main navigation"><div id="sidenav"></div></nav>
        <main id="view" tabindex="-1"></main>
        <aside class="rail rail-right side" id="rail" aria-label="Suggestions"></aside>
      </div>
      <nav class="tabbar" aria-label="Mobile navigation">
        <button data-go="#/" data-k="home"><span class="ti" aria-hidden="true">🏠</span>${esc(G.t('Home'))}</button>
        <button data-go="#/explore" data-k="explore"><span class="ti" aria-hidden="true">🧭</span>${esc(G.t('Explore'))}</button>
        <button data-go="create" data-k="create"><span class="ti" aria-hidden="true">➕</span>${esc(G.t('Create'))}</button>
        <button data-go="#/notifications" data-k="notifications"><span class="ti" aria-hidden="true">🔔</span>${esc(G.t('Notifications'))}<span class="dot" id="b-tab-notifications" hidden></span></button>
        <button data-go="#/menu" data-k="menu"><span class="ti" aria-hidden="true">☰</span>${esc(G.t('Menu'))}</button>
      </nav>`;

    G.qs('#sidenav').innerHTML = `
      <div class="card pad" style="margin-bottom:14px">
        <a class="row" href="#/u/${esc(u.username)}">${G.avatar(u, 42)}
          <div class="grow"><div class="bold" style="font-size:14.5px">${esc(u.full_name)}</div>
          <div class="tiny muted">@${esc(u.username)}</div></div></a>
      </div>
      <div class="card pad" style="padding:8px">${NAV.map((n) => `
        <a class="nav-item" data-k="${n[0]}" href="${n[3]}"><span class="ni" aria-hidden="true">${n[1]}</span>${esc(G.t(n[2]))}
        ${['messages', 'notifications', 'network'].includes(n[0]) ? `<span class="cnt" id="s-${n[0]}" hidden></span>` : ''}</a>`).join('')}
      </div>
      <button class="btn btn-primary btn-block" id="side-create" style="margin-top:14px">✏️ ${esc(G.t('Create'))} ${esc(G.t('Post'))}</button>
      ${u.role === 'admin' ? '<a class="btn btn-ghost btn-block" style="margin-top:8px" href="#/admin">🛡️ Admin Panel</a>' : ''}
      <p class="tiny muted" style="margin:14px 6px 0">Gen-Z Hub · Connect. Build. Play. Grow.</p>`;

    G.qs('#topsearch').addEventListener('submit', (e) => {
      e.preventDefault();
      const v = G.qs('#q').value.trim();
      if (v) location.hash = '#/explore?q=' + encodeURIComponent(v);
    });
    G.qs('#nav-theme').onclick = () => {
      const cur = (S.user && S.user.theme) || 'system';
      const next = cur === 'dark' ? 'light' : cur === 'light' ? 'system' : 'dark';
      G.applyTheme(next);
      if (S.user) { S.user.theme = next; G.patch('/me/settings', { theme: next }).catch(() => {}); }
      G.toast('Theme: ' + next);
    };
    G.qs('#nav-me').onclick = (e) => { e.stopPropagation(); accountMenu(e.currentTarget); };
    G.qs('#side-create').onclick = () => G.openComposer({});
    G.qsa('.tabbar button').forEach((b) => {
      b.onclick = () => {
        const go = b.dataset.go;
        if (go === 'create') return G.openComposer({});
        if (go === '#/menu') return mobileMenu();
        location.hash = go;
      };
    });
    return G.qs('#view');
  };

  function accountMenu(anchor) {
    const u = S.user;
    const box = G.el(`<div class="menu" role="menu">
      <button data-go="#/u/${esc(u.username)}">👤 ${esc(G.t('Profile'))}</button>
      <button data-go="#/saved">🔖 ${esc(G.t('Saved'))}</button>
      <button data-go="#/settings">⚙️ ${esc(G.t('Settings'))}</button>
      ${u.role === 'admin' ? '<button data-go="#/admin">🛡️ Admin Panel</button>' : ''}
      <button class="danger" data-logout>🚪 ${esc(G.t('Log out'))}</button></div>`);
    anchor.parentElement.appendChild(box);
    const off = (e) => { if (!box.contains(e.target)) { box.remove(); document.removeEventListener('click', off); } };
    setTimeout(() => document.addEventListener('click', off), 0);
    box.querySelectorAll('[data-go]').forEach((b) => b.onclick = () => { location.hash = b.dataset.go; box.remove(); });
    box.querySelector('[data-logout]').onclick = async () => { await G.post('/auth/logout'); location.hash = '#/auth'; location.reload(); };
  }

  function mobileMenu() {
    const u = S.user;
    const m = G.modal('Menu', `<div class="stack">
      <a class="row card pad" href="#/u/${esc(u.username)}" data-close>${G.avatar(u, 44)}<div><div class="bold">${esc(u.full_name)}</div>
        <div class="tiny muted">@${esc(u.username)} · View profile</div></div></a>
      <div class="card" style="padding:8px">${NAV.map((n) => `<a class="nav-item" href="${n[3]}" data-close><span class="ni">${n[1]}</span>${esc(G.t(n[2]))}</a>`).join('')}</div>
      ${u.role === 'admin' ? '<a class="btn btn-ghost btn-block" href="#/admin" data-close>🛡️ Admin Panel</a>' : ''}
      <button class="btn btn-danger btn-block" id="m-logout">🚪 ${esc(G.t('Log out'))}</button></div>`);
    G.qs('#m-logout', m.body).onclick = async () => { await G.post('/auth/logout'); location.reload(); };
  }

  G.setRail = function (html) {
    const rail = G.qs('#rail');
    if (rail) rail.innerHTML = html || '';
  };

  G.updateNavState = function () {
    const name = S.route.name || 'home';
    G.qsa('.nav-item[data-k]').forEach((a) => a.classList.toggle('on', a.dataset.k === name || (name === 'u' && false)));
    G.qsa('.tabbar button').forEach((b) => b.classList.toggle('on', b.dataset.k === name));
  };

  G.refreshBadges = async function () {
    if (!S.user) return;
    try {
      badges = await G.get('/notifications/count');
      const set = (id, n) => { const e = G.qs(id); if (e) { e.textContent = n > 99 ? '99+' : n; e.hidden = !n; } };
      set('#b-notifications', badges.notifications);
      set('#b-tab-notifications', badges.notifications);
      set('#b-messages', badges.messages);
      set('#s-notifications', badges.notifications);
      set('#s-messages', badges.messages);
      set('#s-network', badges.requests);
    } catch (e) { /* silent */ }
  };

  /* ---------------- boot ---------------- */
  G.boot = async function () {
    G.applyTheme();
    try {
      const data = await G.get('/bootstrap');
      S.user = data.user; S.interests = data.interests; S.counts = data.counts;
    } catch (e) {
      G.qs('#root').innerHTML = `<div class="empty" style="padding:80px 20px"><div class="ico">🔌</div>
        <div class="bold">Cannot reach the Gen-Z Hub server.</div><button class="btn btn-primary" style="margin-top:14px" onclick="location.reload()">Retry</button></div>`;
      return;
    }
    G.applyTheme();
    const h = (location.hash || '').slice(1);
    const PUBLIC_PATHS = ['/auth', '/reset', '/welcome', '/about', '/privacy', '/terms', '/guidelines', '/contact'];
    if (!S.user && !PUBLIC_PATHS.some((p) => h.startsWith(p))) location.hash = '#/welcome';
    else if (S.user && !S.user.onboarded && !h.startsWith('/onboarding')) location.hash = '#/onboarding';
    await G.render();
    if (S.user) { G.refreshBadges(); setInterval(G.refreshBadges, 20000); }
  };
})();
