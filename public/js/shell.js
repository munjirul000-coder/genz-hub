/* Bloom — app shell: topbar, sidebar, mobile tabbar, boot */
(function () {
  'use strict';
  const G = window.GZ, S = G.state, esc = G.esc;
  let shellMounted = false;
  let badges = { notifications: 0, messages: 0, requests: 0 };

  const NAV = [
    ['home', 'home', 'Home', '#/'],
    ['explore', 'explore', 'Discover', '#/explore'],
    ['shorts', 'gaming', 'Shorts', '#/shorts'],
    ['communities', 'communities', 'Communities', '#/communities'],
    ['hubs', 'sparkle', 'Interest hubs', '#/hubs'],
    ['shop', 'saved', 'Shop', '#/shop'],
    ['work', 'business', 'Work', '#/work'],
    ['arena', 'target', 'Arena', '#/arena'],
    ['ideas', 'sparkle', 'Idea Arena', '#/ideas'],
    ['business', 'business', 'Business', '#/business'],
    ['gaming', 'gaming', 'Gaming', '#/gaming'],
    ['projects', 'target', 'Projects', '#/projects'],
    ['network', 'network', 'Connections', '#/network'],
    ['groups', 'groups', 'Groups', '#/groups'],
    ['events', 'events', 'Events', '#/events'],
    ['messages', 'messages', 'Messages', '#/messages'],
    ['saved', 'saved', 'Saved', '#/saved'],
    ['settings', 'settings', 'Settings', '#/settings'],
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
          <a class="logo" href="#/" aria-label="Bloom home">
            <span class="logo-mark" aria-hidden="true">B</span><span class="txt">BLOOM</span></a>
          <form class="searchbox" id="topsearch" role="search">
            <span class="si" aria-hidden="true">${G.icon('search', 17)}</span>
            <input type="search" id="q" placeholder="${esc(G.t('Search'))} people, posts, #tags…" aria-label="Search Bloom">
          </form>
          <div class="row" style="margin-left:auto;gap:8px">
            <button class="iconbtn" id="nav-theme" title="Toggle theme" aria-label="Toggle colour theme">${G.icon('theme', 19)}</button>
            <a class="iconbtn" href="#/messages" title="Messages" aria-label="Messages">${G.icon('messages', 19)}<span class="dot" id="b-messages" hidden></span></a>
            <a class="iconbtn" href="#/notifications" title="Notifications" aria-label="Notifications">${G.icon('bell', 19)}<span class="dot" id="b-notifications" hidden></span></a>
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
        <button data-go="#/" data-k="home"><span class="ti">${G.icon('home', 21)}</span>${esc(G.t('Home'))}</button>
        <button data-go="#/explore" data-k="explore"><span class="ti">${G.icon('explore', 21)}</span>Discover</button>
        <button data-go="create" data-k="create" class="tab-create"><span class="ti">${G.icon('plus', 21)}</span>${esc(G.t('Create'))}</button>
        <button data-go="#/messages" data-k="messages"><span class="ti">${G.icon('messages', 21)}</span>Chats<span class="dot" id="b-tab-messages" hidden></span></button>
        <button data-go="#/menu" data-k="menu"><span class="ti">${G.icon('menu', 21)}</span>${esc(G.t('Menu'))}</button>
      </nav>`;

    G.qs('#sidenav').innerHTML = `
      <a class="me-card" href="#/u/${esc(u.username)}">${G.avatar(u, 44)}
        <span class="grow" style="min-width:0"><span class="bold" style="display:block;font-size:14.5px">${esc(u.full_name)}</span>
        <span class="tiny muted">@${esc(u.username)}</span></span></a>
      <div class="rail-nav">${NAV.map((n) => `
        <a class="nav-item" data-k="${n[0]}" href="${n[3]}"><span class="ni">${G.icon(n[1], 20)}</span>${esc(G.t(n[2]))}
        ${['messages', 'notifications', 'network'].includes(n[0]) ? `<span class="cnt" id="s-${n[0]}" hidden></span>` : ''}</a>`).join('')}
      </div>
      <button class="btn btn-primary btn-block" id="side-create" style="margin-top:14px">${G.icon('edit', 18)} ${esc(G.t('Create'))} ${esc(G.t('Post'))}</button>
      ${u.role === 'admin' ? '<a class="btn btn-ghost btn-block" style="margin-top:8px" href="#/admin">' + G.icon('shield', 18) + ' Admin Panel</a>' : ''}
      <p class="tiny muted" style="margin:14px 6px 0">Bloom · Connect. Build. Play. Grow.</p>`;

    G.qs('#topsearch').addEventListener('submit', (e) => {
      e.preventDefault();
      const v = G.qs('#q').value.trim();
      if (v) location.hash = '#/explore?q=' + encodeURIComponent(v);
    });
    G.qs('#nav-theme').onclick = () => {
      const cur = (S.user && S.user.theme) || 'system';
      const next = cur === 'dark' ? 'crimson' : cur === 'crimson' ? 'light' : cur === 'light' ? 'system' : 'dark';
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
      <button data-go="#/u/${esc(u.username)}">${G.icon('user', 18)} ${esc(G.t('Profile'))}</button>
      <button data-go="#/saved">${G.icon('saved', 18)} ${esc(G.t('Saved'))}</button>
      <button data-go="#/orders">${G.icon('saved', 18)} My orders</button>
      <button data-go="#/seller">${G.icon('business', 18)} Seller studio</button>
      <button data-go="#/arena">${G.icon('target', 18)} Arena &amp; XP</button>
      <button data-go="#/settings">${G.icon('settings', 18)} ${esc(G.t('Settings'))}</button>
      ${u.role === 'admin' ? '<button data-go="#/admin">' + G.icon('shield', 18) + ' Admin Panel</button>' : ''}
      <button class="danger" data-logout>${G.icon('logout', 18)} ${esc(G.t('Log out'))}</button></div>`);
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
      <div class="card" style="padding:8px">${NAV.map((n) => `<a class="nav-item" href="${n[3]}" data-close><span class="ni">${G.icon(n[1], 20)}</span>${esc(G.t(n[2]))}</a>`).join('')}</div>
      ${u.role === 'admin' ? '<a class="btn btn-ghost btn-block" href="#/admin" data-close>' + G.icon('shield', 18) + ' Admin Panel</a>' : ''}
      <button class="btn btn-danger btn-block" id="m-logout">${G.icon('logout', 18)} ${esc(G.t('Log out'))}</button></div>`);
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
      set('#b-tab-messages', badges.messages);
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
        <div class="bold">Cannot reach the Bloom server.</div><button class="btn btn-primary" style="margin-top:14px" onclick="location.reload()">Retry</button></div>`;
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
