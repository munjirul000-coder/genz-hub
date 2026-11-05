/* NOVA — dependency-free workspace UI. All user content is escaped before rendering. */
(() => {
  'use strict';
  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => [...root.querySelectorAll(s)];
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const icons = {
    grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
    message: '<path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8z"/>',
    brain: '<path d="M12 18V5a3 3 0 0 0-5.8-1A4 4 0 0 0 3 10a4 4 0 0 0 .5 7.5A4 4 0 0 0 12 18Zm0 0V5a3 3 0 0 1 5.8-1A4 4 0 0 1 21 10a4 4 0 0 1-.5 7.5A4 4 0 0 1 12 18Z"/><path d="M8 8a4 4 0 0 1-2-1M16 8a4 4 0 0 0 2-1M8 15a4 4 0 0 0-3 3M16 15a4 4 0 0 1 3 3"/>',
    monitor: '<rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>',
    activity: '<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>',
    settings: '<path d="M12.2 2h-.4a2 2 0 0 0-2 1.7l-.2 1.1a2 2 0 0 1-1 1.4l-.3.2a2 2 0 0 1-1.7.1l-1-.4a2 2 0 0 0-2.5.9l-.2.3a2 2 0 0 0 .5 2.6l.9.7a2 2 0 0 1 .7 1.6v.4a2 2 0 0 1-.7 1.6l-.9.7a2 2 0 0 0-.5 2.6l.2.3a2 2 0 0 0 2.5.9l1-.4a2 2 0 0 1 1.7.1l.3.2a2 2 0 0 1 1 1.4l.2 1.1a2 2 0 0 0 2 1.7h.4a2 2 0 0 0 2-1.7l.2-1.1a2 2 0 0 1 1-1.4l.3-.2a2 2 0 0 1 1.7-.1l1 .4a2 2 0 0 0 2.5-.9l.2-.3a2 2 0 0 0-.5-2.6l-.9-.7a2 2 0 0 1-.7-1.6v-.4a2 2 0 0 1 .7-1.6l.9-.7a2 2 0 0 0 .5-2.6l-.2-.3a2 2 0 0 0-2.5-.9l-1 .4a2 2 0 0 1-1.7-.1l-.3-.2a2 2 0 0 1-1-1.4l-.2-1.1a2 2 0 0 0-2-1.7Z"/><circle cx="12" cy="12" r="3"/>',
    phone: '<rect x="6" y="2" width="12" height="20" rx="2"/><path d="M11 18h2"/>',
    'chevron-down': '<path d="m6 9 6 6 6-6"/>', 'chevron-right': '<path d="m9 18 6-6-6-6"/>',
    'arrow-up-right': '<path d="M7 17 17 7M7 7h10v10"/>', 'arrow-right': '<path d="M5 12h14m-6-6 6 6-6 6"/>',
    search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
    help: '<circle cx="12" cy="12" r="10"/><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3M12 17h.01"/>',
    menu: '<path d="M4 6h16M4 12h16M4 18h16"/>', shield: '<path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11Z"/><path d="m9 12 2 2 4-4"/>',
    sparkle: '<path d="m12 3 1.9 5.8L20 11l-6.1 2.2L12 19l-1.9-5.8L4 11l6.1-2.2Z"/><path d="M20 2v4m-2-2h4"/>',
    mic: '<rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3M8 22h8"/>',
    send: '<path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/>',
    play: '<path d="m6 3 14 9-14 9Z"/>', pause: '<path d="M8 4v16M16 4v16"/>',
    music: '<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>',
    note: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6M8 13h8M8 17h6"/>',
    folder: '<path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2Z"/>',
    cpu: '<rect x="4" y="4" width="16" height="16" rx="2"/><rect x="9" y="9" width="6" height="6"/><path d="M9 1v3M15 1v3M9 20v3M15 20v3M20 9h3M20 14h3M1 9h3M1 14h3"/>',
    clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>', calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
    plus: '<path d="M12 5v14M5 12h14"/>', close: '<path d="m18 6-12 12M6 6l12 12"/>',
    check: '<path d="m20 6-11 11-5-5"/>', 'check-circle': '<circle cx="12" cy="12" r="10"/><path d="m8 12 3 3 5-6"/>',
    alert: '<path d="m10.3 3.9-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.7-3.1l-8-14a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4M12 17h.01"/>',
    trash: '<path d="M3 6h18M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M10 10v7M14 10v7"/>',
    edit: '<path d="M17 3a2.8 2.8 0 0 1 4 4L7 21l-4 1 1-4Z"/><path d="m15 5 4 4"/>',
    copy: '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
    download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>',
    lock: '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
    user: '<path d="M20 21v-2a7 7 0 0 0-14 0v2"/><circle cx="13" cy="7" r="4"/>',
    globe: '<circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15 15 0 0 1 0 20 15 15 0 0 1 0-20Z"/>',
    refresh: '<path d="M21 12a9 9 0 1 1-2.6-6.4M21 3v6h-6"/>',
    link: '<path d="M10 13a5 5 0 0 0 7 .1l3-3a5 5 0 0 0-7-7l-1.7 1.7M14 11a5 5 0 0 0-7-.1l-3 3a5 5 0 0 0 7 7l1.7-1.7"/>',
    timer: '<circle cx="12" cy="14" r="8"/><path d="M12 10v4l2 2M9 2h6M12 2v4M18 6l2-2"/>',
    volume: '<path d="m11 5-6 4H2v6h3l6 4Z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M19 5a10 10 0 0 1 0 14"/>',
    logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
  };
  const icon = (name, cls = '') => `<svg class="icon ${cls}" viewBox="0 0 24 24" aria-hidden="true">${icons[name] || icons.sparkle}</svg>`;
  function hydrateIcons(root = document) { $$('[data-icon]', root).forEach(el => { el.innerHTML = icon(el.dataset.icon); }); }
  const S = { state: null, view: 'overview', token: sessionStorage.getItem('nova.token') || '', busy: false, memoryFilter: 'all', memorySearch: '', modal: null, websiteProjectId: null, focus: { minutes: 25, remaining: 1500, running: false, endAt: 0 }, orb: null, recognition: null, listening: false, lastSnapshot: '', paletteIndex: 0, paletteItems: [] };
  const fmtTime = ts => new Date(ts).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  const fmtDate = ts => new Date(ts).toLocaleDateString([], { month: 'short', day: 'numeric' });
  const name = () => S.state?.settings.assistantName || 'NOVA';
  const isOwner = () => S.state?.workspace.role === 'owner';
  const online = () => !!S.state?.bridge.online;
  const SECRET_IN_CHAT = /(?:gsk_[A-Za-z0-9_-]{20,}|sk-(?:proj-)?[A-Za-z0-9_-]{20,})/;
  const statusPill = status => { const map = { pending: ['amber', 'Awaiting approval'], approved: ['violet', 'Queued'], running: ['violet', 'Running'], completed: ['mint', 'Completed'], failed: ['red', 'Failed'], cancelled: ['', 'Cancelled'], expired: ['', 'Expired'] }; const [color, label] = map[status] || ['', status]; return `<span class="pill pill-${color}">${label}</span>`; };

  async function api(path, { method = 'GET', body, raw = false } = {}) {
    const headers = { 'X-GenZ-Client': '1', 'X-Nova-Session': S.token };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    let res;
    try { res = await fetch('/api/nova' + path, { method, headers, credentials: 'same-origin', body: body === undefined ? undefined : JSON.stringify(body) }); }
    catch { throw new Error('Cannot reach NOVA. Check your connection and try again.'); }
    if (raw) { if (!res.ok) throw new Error('Export failed.'); return res.blob(); }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) { const err = new Error(data.error || `Request failed (${res.status}).`); err.status = res.status; throw err; }
    return data;
  }
  function toast(message, type = 'success') {
    const el = document.createElement('div'); el.className = 'toast ' + type;
    el.innerHTML = `${icon(type === 'error' ? 'alert' : type === 'info' ? 'sparkle' : 'check-circle')}<span>${esc(message)}</span><button class="icon-button" aria-label="Dismiss">${icon('close')}</button>`;
    $('#toast-root').appendChild(el); $('button', el).onclick = () => el.remove(); setTimeout(() => el.remove(), 5500);
  }
  async function copy(text, label = 'Copied to clipboard.') {
    try { await navigator.clipboard.writeText(text); toast(label); }
    catch { modal('Copy manually', `<p>Select and copy the text below.</p><div class="field"><textarea readonly>${esc(text)}</textarea></div>`); }
  }
  function downloadBlob(blob, filename) { const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = filename; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }

  /* Modal with focus trap and restore. */
  let previousFocus = null;
  function modal(title, body, { className = '', onClose } = {}) {
    closeModal(false); previousFocus = document.activeElement;
    $('#modal-root').innerHTML = `<div class="modal-backdrop"><section class="modal ${className}" role="dialog" aria-modal="true" aria-labelledby="modal-title"><header class="modal-header"><h2 id="modal-title">${esc(title)}</h2><button class="icon-button" data-close aria-label="Close dialog">${icon('close')}</button></header><div class="modal-body">${body}</div></section></div>`;
    S.modal = { onClose }; document.body.style.overflow = 'hidden';
    $('.modal-backdrop').addEventListener('click', e => { if (e.target.classList.contains('modal-backdrop') || e.target.closest('[data-close]')) closeModal(); });
    setTimeout(() => { const first = $('.modal input:not([readonly]), .modal textarea, .modal select, .modal .btn-primary, .modal button'); first?.focus(); }, 30);
  }
  function closeModal(restore = true) { const old = S.modal; $('#modal-root').innerHTML = ''; S.modal = null; document.body.style.overflow = ''; if (old?.onClose) old.onClose(); if (restore && previousFocus?.isConnected) previousFocus.focus(); }
  function confirmDialog(title, text, label, fn, danger = false) {
    modal(title, `<div class="modal-icon">${icon(danger ? 'alert' : 'shield')}</div><p>${esc(text)}</p><div class="modal-footer"><button class="btn btn-ghost" data-close>Cancel</button><button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" id="confirm-action">${esc(label)}</button></div>`);
    $('#confirm-action').onclick = async e => { e.target.disabled = true; closeModal(); try { await fn(); } catch (err) { toast(err.message, 'error'); } };
  }
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') { closeModal(); $('#sidebar').classList.remove('open'); }
    if (S.modal && e.key === 'Tab') {
      const items = $$('.modal button:not(:disabled), .modal input, .modal textarea, .modal select, .modal a[href]').filter(el => el.offsetParent !== null);
      if (!items.length) return; const first = items[0], last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); if (S.state) openPalette(); }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'j') { e.preventDefault(); if (S.state) navigate('conversation'); }
  });

  /* Boot / remote pairing */
  async function boot() {
    hydrateIcons();
    const pair = location.hash.match(/^#remote=([A-Fa-f0-9]{10})$/);
    if (pair) return renderPairScreen(pair[1].toUpperCase());
    try {
      const session = await api('/session', { method: 'POST', body: {} });
      S.token = session.token; sessionStorage.setItem('nova.token', S.token);
      S.state = await api('/state');
      const saved = localStorage.getItem('nova.focus.' + S.state.workspace.id);
      if (saved) { try { const f = JSON.parse(saved); if (f.endAt || f.remaining > 0) S.focus = { ...S.focus, ...f, running: !!f.endAt }; } catch {} }
      renderShell(); navigate(['overview', 'conversation', 'memory', 'desktop', 'activity', 'settings'].includes(location.hash.slice(1)) ? location.hash.slice(1) : 'overview');
      setInterval(sync, 4000); setInterval(tickFocus, 1000); tickFocus();
      document.addEventListener('visibilitychange', () => { if (!document.hidden) sync(); });
    } catch (err) {
      $('#view').innerHTML = `<div class="empty-state">${icon('alert')}<h2>NOVA couldn’t start</h2><p>${esc(err.message)}</p><button class="btn btn-primary" id="retry-boot">Try again</button></div>`;
      $('#retry-boot').onclick = () => { sessionStorage.removeItem('nova.token'); S.token = ''; boot(); };
    }
  }
  function renderPairScreen(code = '') {
    $('#app-shell').hidden = true;
    const wrap = document.createElement('div'); wrap.className = 'remote-pair-screen';
    wrap.innerHTML = `<section class="card remote-pair-card"><div class="brand"><span class="brand-mark"><i></i><i></i><i></i></span><span>NOVA<span class="brand-sub">PERSONAL AI</span></span></div><div class="modal-icon" style="margin:0 auto 18px">${icon('phone')}</div><h1>Your desktop, within reach.</h1><p>Enter the pairing code from NOVA on your computer. Codes expire after 5 minutes and work once.</p><form id="pair-form"><div class="field"><label for="pair-code">Pairing code</label><input id="pair-code" class="pair-input" maxlength="10" minlength="10" required autocomplete="off" spellcheck="false" placeholder="A1B2C3D4E5" value="${esc(code)}"></div><div class="form-error" id="pair-error" role="alert"></div><button class="btn btn-primary btn-block" type="submit">${icon('link')}Pair with workspace</button></form><p class="privacy-note">${icon('lock')}Access is limited to this workspace. Revoke anytime.</p></section>`;
    document.body.appendChild(wrap);
    $('#pair-form').onsubmit = async e => {
      e.preventDefault(); const btn = $('button', e.target); btn.disabled = true; $('#pair-error').textContent = '';
      try { const data = await api('/remote/pair', { method: 'POST', body: { code: $('#pair-code').value.trim() } }); S.token = data.token; sessionStorage.setItem('nova.token', S.token); location.hash = ''; location.reload(); }
      catch (err) { $('#pair-error').textContent = err.message; btn.disabled = false; }
    };
  }
  async function sync() {
    if (!S.token || !S.state || S.busy) return;
    try {
      const data = await api('/sync');
      const previousActions = S.state.actions;
      S.state = { ...S.state, ...data };
      renderShell();
      for (const a of data.actions) { const old = previousActions.find(x => x.id === a.id); if (old && old.status !== a.status && ['completed', 'failed'].includes(a.status)) toast(`${a.label}: ${a.status}. ${a.result || ''}`, a.status === 'failed' ? 'error' : 'success'); }
      const signature = JSON.stringify([data.messages.map(m => m.id), data.actions.map(a => [a.id, a.status]), data.memories.map(m => [m.id, m.updated_at]), data.bridge.online, data.remotes.map(r => r.token_hash)]);
      if (signature !== S.lastSnapshot) {
        S.lastSnapshot = signature;
        if (S.view === 'overview' || S.view === 'conversation') renderMessages();
        if (S.view === 'memory') renderMemoryGrid();
        if (S.view === 'activity') renderActivityList();
        if (S.view === 'desktop') renderDesktopStatus();
        if (S.view === 'overview') renderOverviewDynamic();
        if (S.view === 'settings') renderRemoteDevices();
      }
    } catch (err) { if (err.status === 401) { $('#engine-pill').innerHTML = '<i class="status-dot"></i>Session expired'; } }
  }
  function renderShell() {
    const s = S.state; if (!s) return;
    $('#workspace-name').textContent = s.workspace.name;
    $('#memory-count').textContent = s.memories.length;
    const initial = (s.settings.userName || 'Y').charAt(0).toUpperCase();
    $('#user-avatar').textContent = initial; $('.top-avatar').textContent = initial;
    $('#profile-name').textContent = s.settings.userName || 'Your workspace';
    $('#profile-role').textContent = isOwner() ? 'Owner · Local session' : 'Remote · Paired phone';
    $('#sidebar-bridge-status').innerHTML = `<i class="status-dot" style="color:${online() ? 'var(--mint)' : 'var(--subtle)'}"></i>${online() ? 'Connected' : 'Not connected'}`;
    const engineLabel = s.ai.configured ? (s.ai.provider === 'groq' ? 'Groq + local' : 'AI + local') : 'Local engine';
    $('#engine-pill').innerHTML = `<i class="status-dot"></i>${engineLabel}`;
    document.documentElement.style.setProperty('--violet', s.settings.persona === 'atlas' ? '#7dd3fc' : '#a78bfa');
    document.documentElement.style.setProperty('--violet-soft', s.settings.persona === 'atlas' ? 'rgba(125,211,252,.12)' : 'rgba(167,139,250,.12)');
  }
  function navigate(view) {
    S.view = view; location.hash = view;
    $$('.nav-item[data-view]').forEach(el => { el.classList.toggle('active', el.dataset.view === view); if (el.dataset.view === view) el.setAttribute('aria-current', 'page'); else el.removeAttribute('aria-current'); });
    $('#breadcrumb-current').textContent = { overview: 'Overview', conversation: 'Conversation', memory: 'Memory vault', desktop: 'Desktop control', activity: 'Activity', settings: 'Settings' }[view];
    $('#sidebar').classList.remove('open');
    if (S.orb) { S.orb.destroy(); S.orb = null; }
    const views = { overview: renderOverview, conversation: renderConversation, memory: renderMemory, desktop: renderDesktop, activity: renderActivity, settings: renderSettings };
    views[view](); hydrateIcons($('#view')); window.scrollTo({ top: 0, behavior: 'instant' });
  }
  const remoteBanner = () => !isOwner() ? `<div class="remote-banner">${icon('phone')}You’re controlling this workspace remotely. Desktop actions still need approval.</div>` : '';
  const heading = (title, sub, action = '') => `<div class="page-heading"><div><h1>${title}</h1><p>${sub}</p></div>${action}</div>`;

  /* Overview */
  function renderOverview() {
    const s = S.state; const hour = new Date().getHours(); const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
    $('#view').innerHTML = `${remoteBanner()}${heading(`${greeting}${s.settings.userName ? ', ' + esc(s.settings.userName) : ''}.`, 'A clear mind. A connected world. What shall we do today?', `<span class="date-label">${icon('calendar')}${new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}</span>`)}
      <div class="overview-top">
        <section class="core-card"><div class="core-copy"><div class="eyebrow"><i class="status-dot"></i>YOUR PERSONAL AI COMPANION</div><h2>Your mind,<br><span>amplified.</span></h2><p>A little less friction. A lot more possibility. Meet ${esc(name())} — ready when you are.</p><div class="core-buttons"><button class="btn btn-primary" data-action="start-chat">${icon('sparkle')}Let’s talk</button><button class="btn btn-ghost" data-action="voice">${icon('mic')}Voice mode</button></div></div><div class="core-visual"><canvas class="orb-canvas" id="orb-canvas" aria-label="Animated AI core"></canvas><span class="core-ring-label">${esc(name())} CORE / 01</span><span class="core-state"><i class="status-dot"></i><span id="core-state-text">READY WHEN YOU ARE</span></span></div></section>
        <section class="card space-card"><div class="between"><h2>Your space, at a glance</h2>${icon('activity', 'muted')}</div><p class="space-sub">Everything connected. Nothing assumed.</p><div class="space-stats"><div class="stat-box"><span class="stat-label">${icon('brain')}Memories</span><div class="stat-value" id="stat-memories">${s.memories.length}<small>saved</small></div></div><div class="stat-box"><span class="stat-label">${icon('check-circle')}Actions done</span><div class="stat-value" id="stat-actions">${s.actions.filter(a => a.status === 'completed').length}<small>this session</small></div></div></div><div class="connection-row"><span class="connection-icon">${icon('monitor')}</span><div><strong>Windows desktop</strong><small id="overview-bridge-sub">Connect your local bridge</small></div><span class="pill" id="overview-bridge-pill">Offline</span></div><div class="connection-row"><span class="connection-icon">${icon('cpu')}</span><div><strong>Intelligence</strong><small>${s.ai.configured ? (s.ai.provider === 'groq' ? 'Groq AI + local commands' : 'Cloud AI + local commands') : 'Local commands · no API key needed'}</small></div><span class="pill pill-mint">Ready</span></div></section>
      </div>
      <div class="section-heading"><h2>Less clicking. More doing.</h2><span>QUICK ACTIONS</span></div>
      <div class="quick-grid"><button class="quick-card" data-quick="open_youtube"><span class="quick-icon">${icon('play')}</span><span><strong>Open YouTube</strong><small>Find your next rabbit hole</small></span>${icon('arrow-up-right')}</button><button class="quick-card" data-quick="open_notepad"><span class="quick-icon">${icon('note')}</span><span><strong>Capture a thought</strong><small>Open a fresh Notepad</small></span>${icon('arrow-up-right')}</button><button class="quick-card" data-quick="system_info"><span class="quick-icon">${icon('cpu')}</span><span><strong>System check</strong><small>See how your PC is doing</small></span>${icon('arrow-up-right')}</button><button class="quick-card" data-action="focus"><span class="quick-icon">${icon('timer')}</span><span><strong>Find your focus</strong><small>One task. Zero distractions.</small></span>${icon('arrow-up-right')}</button></div>
      <div class="overview-bottom"><section class="card chat-card" id="chat-card">${chatHeader()}<div class="messages" id="messages" role="log" aria-live="polite"></div><div id="chat-suggestions"></div>${composer()}</section><div class="overview-right">${focusCard()}<section class="card memory-preview"><div class="card-header"><h3>${icon('brain')}Recently remembered</h3><button class="text-button" data-view="memory">View all ${icon('arrow-right')}</button></div><div class="memory-preview-list" id="memory-preview-list"></div></section></div></div>`;
    S.orb = createOrb($('#orb-canvas')); renderMessages(); renderOverviewDynamic(); bindComposer(); tickFocus();
  }
  function renderOverviewDynamic() {
    if (S.view !== 'overview') return;
    const s = S.state;
    if ($('#stat-memories')) $('#stat-memories').innerHTML = `${s.memories.length}<small>saved</small>`;
    if ($('#stat-actions')) $('#stat-actions').innerHTML = `${s.actions.filter(a => a.status === 'completed').length}<small>this session</small>`;
    if ($('#overview-bridge-pill')) { $('#overview-bridge-pill').textContent = online() ? 'Online' : 'Offline'; $('#overview-bridge-pill').className = 'pill ' + (online() ? 'pill-mint' : ''); $('#overview-bridge-sub').textContent = online() ? esc(s.bridge.system.hostname || 'Windows agent connected') : 'Connect your local bridge'; }
    if ($('#memory-preview-list')) $('#memory-preview-list').innerHTML = s.memories.length ? s.memories.slice(0, 3).map(m => `<div class="memory-mini">${icon('sparkle')}<div><p>${esc(m.content)}</p><small>${esc(m.category)} · ${fmtDate(m.updated_at)}</small></div></div>`).join('') : `<div class="empty-mini">${icon('brain')}<p>A memory worth keeping?</p><small>Say “Remember…” or add one yourself.</small><button class="text-button" data-action="add-memory" style="margin-top:8px">${icon('plus')}Add a memory</button></div>`;
  }
  function chatHeader() { return `<div class="card-header"><h2>${icon('sparkle')}Conversation</h2><div class="chat-header-meta"><span class="pill pill-violet" id="chat-engine">${S.state.ai.configured ? 'AI + LOCAL' : 'LOCAL MODE'}</span>${S.view === 'conversation' && isOwner() ? `<button class="icon-button" data-action="clear-chat" aria-label="Clear conversation">${icon('trash')}</button>` : ''}</div></div>`; }
  function composer() { return `<div class="composer-wrap"><form class="composer" id="chat-form"><label class="sr-only" for="chat-input">Message ${esc(name())}</label><textarea id="chat-input" rows="1" name="message" placeholder="Ask ${esc(name())}, or tell me what to do…" maxlength="4000" autocomplete="off"></textarea><button type="button" class="icon-button mic-button" data-action="voice" aria-label="Start voice input">${icon('mic')}</button><button type="submit" class="icon-button send-button" aria-label="Send message">${icon('send')}</button></form><div class="composer-note"><span>${icon('lock')}Private workspace · you approve desktop actions</span><span>Enter to send · Shift + Enter for a new line</span></div></div>`; }
  function renderConversation() {
    $('#view').innerHTML = `${remoteBanner()}${heading('A conversation, not a command line.', `Think out loud. ${esc(name())} is listening.`, `${isOwner() ? `<button class="btn btn-primary" data-action="build-website">${icon('globe')}Build website</button>` : ''}`)}<div class="conversation-layout"><section class="card chat-card">${chatHeader()}<div class="messages" id="messages" role="log" aria-live="polite"></div><div id="chat-suggestions"></div>${composer()}</section></div>`;
    renderMessages(); bindComposer();
  }
  // Generated code is untrusted. Preview it in an opaque sandboxed iframe with
  // a restrictive server-side CSP; never install packages or run host commands.
  function websiteBuilder() {
    modal('Build a website', `<p>Describe a simple website in Bangla or English. Your description is sent to your connected AI provider. NOVA saves a new static HTML project on this computer; it does not create a backend or deploy the site.</p><form id="website-form"><div class="field"><label for="website-brief">What should the website look like?</label><textarea id="website-brief" required maxlength="3000" rows="5" placeholder="Example: a colourful bakery website with a menu and contact section"></textarea></div><p class="form-error" id="website-error" role="alert"></p><div class="modal-footer"><button type="button" class="btn btn-ghost" id="website-saved">Saved websites</button><button class="btn btn-primary" id="website-submit" type="submit">Generate website</button></div></form>`, { className: 'website-modal' });
    $('#website-saved').onclick = savedWebsites;
    $('#website-form').onsubmit = async e => {
      e.preventDefault();
      const brief = $('#website-brief').value.trim();
      if (!brief) return;
      const form = e.currentTarget, btn = $('#website-submit');
      btn.disabled = true; btn.textContent = 'Generating…'; $('#website-error').textContent = '';
      try {
        const data = await api('/website/generate', { method: 'POST', body: { brief } });
        if (!data.ok) throw new Error(data.error || 'Could not generate website.');
        if (!form.isConnected) return;
        showWebsite(data);
      } catch (err) {
        if (form.isConnected) { $('#website-error').textContent = err.message; btn.disabled = false; btn.textContent = 'Generate website'; }
      }
    };
  }
  function showWebsite(data) {
    S.websiteProjectId = data.project.id;
    modal('Your website preview', `<p>Saved as a new project in NOVA. Interactive preview runs in isolation with network and forms blocked. Do not enter private information. Review AI-generated code before opening it elsewhere. This is a static prototype, not a deployed website.</p><iframe id="website-preview" sandbox="allow-scripts" title="Generated website preview"></iframe><div class="modal-footer"><button class="btn btn-ghost" id="website-saved">Saved websites</button><button class="btn btn-primary" id="website-download">Download index.html</button></div>`, { className: 'website-modal' });
    $('#website-preview').src = '/api/nova/website/projects/' + encodeURIComponent(data.project.id) + '/preview';
    $('#website-saved').onclick = savedWebsites;
    $('#website-download').onclick = () => downloadBlob(new Blob([data.html], { type: 'text/html;charset=utf-8' }), 'index.html');
  }
  async function savedWebsites() {
    modal('Saved websites', '<p>Loading your websites…</p>', { className: 'website-modal' });
    const currentModal = $('.modal');
    try {
      const data = await api('/website/projects');
      if (!currentModal.isConnected) return;
      modal('Saved websites', `<p>These projects are saved on the NOVA server. They are not published online.</p><div class="website-list">${data.projects.length ? data.projects.map(p => `<button class="btn btn-ghost website-project" data-project-id="${esc(p.id)}"><span>${esc(p.name)}</span><small>${esc(fmtDate(p.createdAt))}</small></button>`).join('') : '<p>No saved websites yet.</p>'}</div><div class="modal-footer"><button class="btn btn-primary" data-action="build-website">Build a website</button></div>`, { className: 'website-modal' });
      $$('.website-project').forEach(btn => { btn.onclick = async () => { btn.disabled = true; try { const result = await api('/website/projects/' + encodeURIComponent(btn.dataset.projectId)); if (btn.isConnected) showWebsite(result); } catch (err) { toast(err.message, 'error'); if (btn.isConnected) btn.disabled = false; } }; });
    } catch (err) { if (currentModal.isConnected) modal('Saved websites', `<p>${esc(err.message)}</p><div class="modal-footer"><button class="btn btn-ghost" data-action="build-website">Back</button></div>`); }
  }
  function renderMessages() {
    const box = $('#messages'); if (!box) return;
    const messages = S.state.messages;
    if (!messages.length) {
      box.innerHTML = S.view === 'conversation' ? `<div class="conversation-intro"><div class="intro-orb">${icon('sparkle')}</div><h2>What’s on your mind?</h2><p>Ask a question, save a thought, or prepare a desktop action. This is your space.</p></div>` : `<div class="message"><span class="message-avatar">${icon('sparkle')}</span><div class="message-body"><div class="message-meta">${esc(name())}<time>Ready now</time></div><div class="message-content">Hey${S.state.settings.userName ? ' ' + esc(S.state.settings.userName) : ''} 👋 I’m ${esc(name())}. Your thoughts, plans and everyday actions — a little more connected. What would you like to do?</div></div></div>`;
    } else {
      box.innerHTML = messages.map(m => {
        const action = m.action_id && S.state.actions.find(a => a.id === m.action_id);
        const content = esc(m.content).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
        return `<div class="message ${m.role === 'user' ? 'user' : ''}"><span class="message-avatar">${icon(m.role === 'user' ? 'user' : 'sparkle')}</span><div class="message-body"><div class="message-meta">${esc(m.role === 'user' ? 'You' : name())}<time>${fmtTime(m.created_at)}</time>${m.engine === 'cloud' ? '<span class="subtle">· AI</span>' : ''}</div><div class="message-content">${content}</div>${action ? `<div class="action-attachment">${icon('shield')}<div><strong>${esc(action.label)}</strong><small>${esc(action.status === 'pending' ? 'Needs your approval' : action.status)}</small></div>${['pending', 'approved'].includes(action.status) ? `<button class="btn btn-sm btn-ghost" data-action-review="${action.id}">${action.status === 'pending' ? 'Review' : 'Cancel'}</button>` : statusPill(action.status)}</div>` : ''}</div></div>`;
      }).join('');
    }
    if (S.busy) box.insertAdjacentHTML('beforeend', `<div class="message"><span class="message-avatar">${icon('sparkle')}</span><div class="message-body"><div class="message-meta">${esc(name())}<time>Thinking</time></div><div class="typing"><i></i><i></i><i></i></div></div></div>`);
    const suggestions = $('#chat-suggestions');
    if (suggestions) suggestions.innerHTML = messages.length < 3 ? `<div class="chat-suggestions"><button class="suggestion" data-prompt="What can you do?">What can you do?</button><button class="suggestion" data-prompt="Remember my name is ${esc(S.state.settings.userName || 'Rafi')}">Remember my name</button><button class="suggestion" data-prompt="Focus for 25 minutes">Let’s focus</button></div>` : '';
    box.scrollTop = box.scrollHeight;
  }
  function bindComposer() {
    const form = $('#chat-form'), input = $('#chat-input'); if (!form) return;
    form.onsubmit = e => { e.preventDefault(); sendMessage(input.value); };
    input.onkeydown = e => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); sendMessage(input.value); } };
    input.oninput = () => { input.style.height = 'auto'; input.style.height = Math.min(120, input.scrollHeight) + 'px'; };
  }
  async function sendMessage(text) {
    text = text.trim(); if (!text || S.busy) return;
    const input = $('#chat-input');
    const secret = text.match(SECRET_IN_CHAT);
    if (secret) {
      if (input) { input.value = ''; input.style.height = 'auto'; }
      toast('API key chat-e pathano hoy ni. Secure field-e connect korun.', 'info');
      return connectAiModal(secret[0]);
    }
    S.busy = true; if (input) { input.value = ''; input.style.height = 'auto'; }
    const send = $('.send-button'); if (send) send.disabled = true;
    if (S.view !== 'conversation' && S.view !== 'overview') navigate('conversation');
    S.state.messages.push({ id: 'temp-user', role: 'user', content: text, created_at: Date.now() }); renderMessages();
    if ($('#core-state-text')) $('#core-state-text').textContent = 'THINKING WITH YOU';
    try {
      const data = await api('/chat', { method: 'POST', body: { message: text, ...(S.websiteProjectId ? { websiteProjectId: S.websiteProjectId } : {}) } });
      S.state.messages = S.state.messages.filter(m => m.id !== 'temp-user'); S.state.messages.push(data.userMessage, data.message);
      if (data.memory) S.state.memories.unshift(data.memory);
      if (data.action) S.state.actions.unshift(data.action);
      if (data.website) showWebsite(data.website);
      if (data.uiAction?.type === 'focus') startFocus(data.uiAction.minutes);
      speak(data.message.content);
    } catch (err) { S.state.messages = S.state.messages.filter(m => m.id !== 'temp-user'); toast(err.message, 'error'); if (input) input.value = text; }
    finally { S.busy = false; if (send) send.disabled = false; renderMessages(); renderShell(); renderOverviewDynamic(); if ($('#core-state-text')) $('#core-state-text').textContent = 'READY WHEN YOU ARE'; $('#chat-input')?.focus(); }
  }

  /* Procedural particle core — no image, WebGL or external dependency. */
  function createOrb(canvas) {
    const ctx = canvas.getContext('2d'); if (!ctx) return { destroy() {} };
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    let frame = 0, t = 0, w = 0, h = 0, alive = true;
    const points = []; const N = 650;
    for (let i = 0; i < N; i++) { const y = 1 - (i / (N - 1)) * 2; const r = Math.sqrt(1 - y * y); const theta = i * 2.399963; points.push({ x: Math.cos(theta) * r, y, z: Math.sin(theta) * r, s: .5 + Math.random() * 1.1 }); }
    function resize() { const rect = canvas.getBoundingClientRect(); const dpr = Math.min(devicePixelRatio || 1, 2); w = rect.width; h = rect.height; canvas.width = w * dpr; canvas.height = h * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); }
    resize(); const ro = new ResizeObserver(resize); ro.observe(canvas);
    function draw() {
      if (!alive) return;
      ctx.clearRect(0, 0, w, h); const cx = w / 2, cy = h / 2 - 3; const R = Math.min(w * .34, h * .31); const atlas = S.state.settings.persona === 'atlas'; const rgb = atlas ? '125,211,252' : '167,139,250';
      const glow = ctx.createRadialGradient(cx, cy, R * .1, cx, cy, R * 1.65); glow.addColorStop(0, `rgba(${rgb},.10)`); glow.addColorStop(.55, `rgba(${rgb},.055)`); glow.addColorStop(1, `rgba(${rgb},0)`); ctx.fillStyle = glow; ctx.fillRect(0, 0, w, h);
      // Orbital rings.
      ctx.save(); ctx.translate(cx, cy); ctx.rotate(-.38); ctx.strokeStyle = `rgba(${rgb},.20)`; ctx.lineWidth = .7; ctx.beginPath(); ctx.ellipse(0, 0, R * 1.42, R * .48, 0, 0, Math.PI * 2); ctx.stroke(); ctx.rotate(.85); ctx.strokeStyle = `rgba(${rgb},.12)`; ctx.beginPath(); ctx.ellipse(0, 0, R * 1.3, R * .55, 0, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
      const a = t * .0022; const projected = points.map(p => { const x = p.x * Math.cos(a) + p.z * Math.sin(a); const z = -p.x * Math.sin(a) + p.z * Math.cos(a); const tilt = -.22; const y = p.y * Math.cos(tilt) - z * Math.sin(tilt); const zz = p.y * Math.sin(tilt) + z * Math.cos(tilt); const scale = 1 + zz * .12; return { x: cx + x * R * scale, y: cy + y * R * scale, z: zz, s: p.s }; }).sort((p, q) => p.z - q.z);
      for (const p of projected) { const alpha = .13 + (p.z + 1) * .34; ctx.fillStyle = `rgba(${rgb},${alpha})`; ctx.beginPath(); ctx.arc(p.x, p.y, p.s * (p.z > 0 ? 1 : .7), 0, Math.PI * 2); ctx.fill(); }
      // Fine latitude contours make the sphere read as a hologram.
      ctx.strokeStyle = `rgba(${rgb},.07)`; ctx.lineWidth = .6;
      for (let j = -2; j <= 2; j++) { const y = j * R / 3; const rr = Math.sqrt(R * R - y * y); ctx.beginPath(); ctx.ellipse(cx, cy + y, rr, rr * .18, -.08, 0, Math.PI * 2); ctx.stroke(); }
      const sat = t * .006; ctx.fillStyle = `rgba(${rgb},.9)`; ctx.shadowColor = `rgba(${rgb},.8)`; ctx.shadowBlur = 9; ctx.beginPath(); ctx.arc(cx + Math.cos(sat) * R * 1.35, cy + Math.sin(sat) * R * .5, 2, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;
      if (!reduced) { t += 1; frame = requestAnimationFrame(draw); }
    }
    draw(); return { destroy() { alive = false; cancelAnimationFrame(frame); ro.disconnect(); } };
  }

  /* Memory vault */
  function renderMemory() {
    $('#view').innerHTML = `${remoteBanner()}${heading('A memory that stays yours.', 'The details you choose to keep. Edit or forget them anytime.', `<button class="btn btn-primary" data-action="add-memory">${icon('plus')}Add memory</button>`)}<div class="toolbar"><label class="search-field">${icon('search')}<input id="memory-search" type="search" placeholder="Search your memories…" value="${esc(S.memorySearch)}" aria-label="Search memories"></label><div class="filter-chips">${['all', 'personal', 'preference', 'work', 'note'].map(c => `<button class="chip ${S.memoryFilter === c ? 'active' : ''}" data-memory-filter="${c}">${c === 'all' ? 'All memories' : c[0].toUpperCase() + c.slice(1)}</button>`).join('')}</div></div><div class="memory-grid" id="memory-grid"></div>`;
    $('#memory-search').oninput = e => { S.memorySearch = e.target.value; renderMemoryGrid(); };
    renderMemoryGrid();
  }
  function renderMemoryGrid() {
    const grid = $('#memory-grid'); if (!grid) return;
    const list = S.state.memories.filter(m => (S.memoryFilter === 'all' || m.category === S.memoryFilter) && m.content.toLowerCase().includes(S.memorySearch.toLowerCase()));
    grid.innerHTML = list.length ? list.map(m => `<article class="card memory-card"><div class="memory-top"><span class="pill pill-violet">${esc(m.category)}</span>${icon('brain')}</div><p>${esc(m.content)}</p><footer><span>${fmtDate(m.updated_at)}</span><div class="row"><button class="icon-button" data-edit-memory="${m.id}" aria-label="Edit memory">${icon('edit')}</button><button class="icon-button" data-delete-memory="${m.id}" aria-label="Delete memory">${icon('trash')}</button></div></footer></article>`).join('') : `<div class="empty-state">${icon('brain')}<h2>${S.memorySearch || S.memoryFilter !== 'all' ? 'No matching memories' : 'Some things are worth remembering.'}</h2><p>${S.memorySearch || S.memoryFilter !== 'all' ? 'Try another search or category.' : 'Your favorite tools, the way you work, a name you never want to forget. Save it here — only when you choose to.'}</p><button class="btn btn-primary" data-action="add-memory">${icon('plus')}Add your first memory</button></div>`;
  }
  function memoryModal(memory = null) {
    modal(memory ? 'Edit memory' : 'Keep a thought', `<p>Only save what you want NOVA to remember. Don’t store passwords, API keys or other secrets.</p><form id="memory-form"><div class="form-grid"><div class="field full"><label for="memory-content">What should I remember?</label><textarea id="memory-content" maxlength="500" required placeholder="e.g. I prefer concise answers in Bengali.">${esc(memory?.content || '')}</textarea></div><div class="field full"><label for="memory-category">Category</label><select id="memory-category">${['personal', 'preference', 'work', 'note'].map(c => `<option value="${c}" ${memory?.category === c ? 'selected' : ''}>${c[0].toUpperCase() + c.slice(1)}</option>`).join('')}</select></div></div><div class="modal-footer"><button type="button" class="btn btn-ghost" data-close>Cancel</button><button class="btn btn-primary" type="submit">${icon('check')}${memory ? 'Save changes' : 'Save memory'}</button></div></form>`);
    $('#memory-form').onsubmit = async e => {
      e.preventDefault(); const btn = $('button[type=submit]', e.target); btn.disabled = true;
      try { const data = await api(memory ? '/memories/' + memory.id : '/memories', { method: memory ? 'PATCH' : 'POST', body: { content: $('#memory-content').value, category: $('#memory-category').value } }); if (memory) S.state.memories = S.state.memories.map(m => m.id === memory.id ? data.memory : m); else S.state.memories.unshift(data.memory); closeModal(); toast(memory ? 'Memory updated.' : 'Saved to your memory vault.'); renderShell(); renderOverviewDynamic(); if (S.view === 'memory') renderMemoryGrid(); }
      catch (err) { toast(err.message, 'error'); btn.disabled = false; }
    };
  }

  /* Desktop control and approvals */
  function renderDesktop() {
    const command = `node nova-agent.js --server ${location.origin} --token-file nova-bridge.token`;
    $('#view').innerHTML = `${remoteBanner()}${heading('Your PC. Still in your hands.', 'A permission-first bridge between NOVA and your Windows desktop.', `<button class="btn btn-ghost" data-action="help">${icon('shield')}Safety first</button>`)}<div class="info-banner">${icon('shield')}<div><strong>Nothing runs without your approval.</strong><p>Only the allowlisted actions below are supported. No arbitrary shell commands, screen recording or automatic message sending. Mouse clicks can trigger actions, including deletion, so check the screen before approval. The preview server cannot control your PC by itself.</p></div></div><div class="desktop-layout"><div class="stack"><section class="card"><div class="bridge-hero"><span class="bridge-hero-icon">${icon('monitor')}</span><div><h2>Windows desktop bridge</h2><p id="desktop-bridge-description">Connect the agent on the PC you want to control.</p><span class="pill" id="desktop-bridge-pill">Not connected</span></div></div><div class="setup-steps"><div class="setup-step"><span class="step-number">1</span><div><strong>Download the bridge agent</strong><p>Windows 10/11 with Node.js 20+ installed. The agent is a small, readable Node.js script.</p><a class="btn btn-sm btn-ghost" href="/api/nova/bridge/agent" download style="margin-top:9px">${icon('download')}Download nova-agent.js</a></div></div><div class="setup-step"><span class="step-number">2</span><div><strong>Generate a private bridge token</strong><p>Shown once. Save it as <span class="mono">nova-bridge.token</span> next to the agent. Never share it.</p>${isOwner() ? `<button class="btn btn-sm btn-ghost" data-action="bridge-token" style="margin-top:9px">${icon('lock')}Generate token</button>` : '<p>Ask the workspace owner to connect the desktop.</p>'}</div></div><div class="setup-step"><span class="step-number">3</span><div><strong>Run the agent on your Windows PC</strong><p>Keep this terminal open while you want desktop control. Ctrl+C disconnects it.</p><div class="code-block">${esc(command)}<button class="icon-button" data-copy="${esc(command)}" aria-label="Copy agent command">${icon('copy')}</button></div></div></div></div></section><div class="section-heading" style="margin-top:4px"><h2>Approved capabilities</h2><span>ALLOWLIST ONLY</span></div><div class="action-catalog">${Object.entries(S.state.catalog).filter(([k]) => k !== 'whatsapp_draft' && !k.startsWith('mouse_')).map(([kind, item]) => `<button class="catalog-item" data-quick="${kind}"><span class="quick-icon">${icon(item.icon)}</span><span><strong>${esc(item.label)}</strong><small>${esc(item.group)} · approval required</small></span></button>`).join('')}</div><section class="card card-body"><h3 style="font-size:13px">Mouse control</h3><p class="muted" style="font-size:10px;margin:5px 0 15px">NOVA cannot see your screen. Check coordinates carefully: a click can delete files or trigger other actions. Each action needs owner approval.</p>${isOwner() ? `<form id="mouse-form"><div class="form-grid"><div class="field"><label for="mouse-x">X coordinate</label><input id="mouse-x" type="number" min="-32768" max="32767" step="1" required placeholder="e.g. 500"></div><div class="field"><label for="mouse-y">Y coordinate</label><input id="mouse-y" type="number" min="-32768" max="32767" step="1" required placeholder="e.g. 300"></div></div><div class="settings-actions"><button class="btn btn-ghost" type="submit" name="mouse-kind" value="mouse_move">Review move</button><button class="btn btn-ghost" type="submit" name="mouse-kind" value="mouse_click">Review left click</button></div></form>` : '<p>Mouse control is available to the workspace owner only.</p>'}</section><section class="card card-body"><h3 style="font-size:13px">Prepare a WhatsApp draft</h3><p class="muted" style="font-size:10px;margin:5px 0 15px">Opens a draft on your PC. NOVA never presses Send.</p><form id="whatsapp-form"><div class="form-grid"><div class="field"><label for="wa-phone">Phone with country code</label><input id="wa-phone" placeholder="+8801XXXXXXXXX" required maxlength="20"></div><div class="field"><label for="wa-text">Draft message</label><input id="wa-text" placeholder="Hey, are you free?" required maxlength="500"></div></div><div class="settings-actions"><button class="btn btn-ghost" type="submit">${icon('message')}Review draft action</button></div></form></section></div><div class="stack"><section class="card"><div class="card-header"><h3>${icon('cpu')}Connected system</h3></div><div class="system-details" id="system-details"></div></section><section class="card card-body"><h3 style="font-size:14px">Built to respect boundaries.</h3><ul class="safety-list"><li>${icon('check')}Every action is reviewed before it runs.</li><li>${icon('check')}Approvals expire after 2 minutes.</li><li>${icon('check')}One action at a time on your PC.</li><li>${icon('check')}Tokens can be replaced anytime.</li><li>${icon('check')}No direct delete command; clicks may trigger deletion.</li><li>${icon('check')}WhatsApp messages are never auto-sent.</li></ul></section><section class="card card-body"><h3 style="font-size:13px">Testing without a PC?</h3><p class="muted" style="font-size:10px;margin-top:6px">Run the agent with <span class="mono">--dry-run</span>. It exercises the approval flow but never executes a desktop action.</p></section></div></div>`;
    if ($('#mouse-form')) $('#mouse-form').onsubmit = e => { e.preventDefault(); const kind = e.submitter?.value || 'mouse_move'; prepareAction(kind, { x: Number($('#mouse-x').value), y: Number($('#mouse-y').value) }); };
    $('#whatsapp-form').onsubmit = e => { e.preventDefault(); prepareAction('whatsapp_draft', { phone: $('#wa-phone').value, text: $('#wa-text').value }); };
    renderDesktopStatus();
  }
  function renderDesktopStatus() {
    if (!$('#system-details')) return;
    const b = S.state.bridge; const sys = b.system || {};
    $('#desktop-bridge-pill').textContent = b.online ? 'Connected' : b.configured ? 'Waiting for agent' : 'Not connected';
    $('#desktop-bridge-pill').className = 'pill ' + (b.online ? 'pill-mint' : 'pill-amber');
    $('#desktop-bridge-description').textContent = b.online ? `${sys.hostname || 'Your PC'} is connected and listening for approved actions.` : 'Connect the agent on the PC you want to control.';
    const rows = b.online ? [['Computer', sys.hostname], ['Operating system', sys.os], ['Architecture', sys.arch], ['Processor', sys.cpu], ['Logical cores', sys.cores], ['Memory', `${sys.freeMemoryGB} GB free / ${sys.memoryGB} GB`], ['Uptime', `${sys.uptimeHours} hours`], ['Agent version', sys.agentVersion]] : [['Status', 'No active connection'], ['Platform', 'Windows 10 / 11'], ['Execution', 'Local agent only']];
    $('#system-details').innerHTML = rows.map(([k, v]) => `<div class="system-row"><span>${esc(k)}</span><strong>${esc(v ?? '—')}</strong></div>`).join('');
  }
  async function prepareAction(kind, params = {}) {
    try { const data = await api('/actions', { method: 'POST', body: { kind, params } }); S.state.actions.unshift(data.action); reviewAction(data.action.id); if (S.view === 'activity') renderActivityList(); }
    catch (err) { toast(err.message, 'error'); }
  }
  function reviewAction(actionId) {
    const a = S.state.actions.find(x => x.id === actionId); if (!a) return toast('This action is no longer available.', 'info');
    if (a.status === 'approved') return confirmDialog('Cancel queued action?', `${a.label} is waiting for the desktop agent. Cancel it before it starts?`, 'Cancel action', () => cancelAction(a.id));
    if (a.status !== 'pending') return modal(a.label, `<div class="approval-detail">${statusPill(a.status)}<p style="white-space:pre-wrap">${esc(a.result || 'This action has already been resolved.')}</p></div>`);
    const item = S.state.catalog[a.kind];
    modal('A quick check before we act.', `<div class="modal-icon">${icon('shield')}</div><p>You’re about to approve this action on the connected Windows PC. It will not run automatically.</p><div class="approval-detail"><strong>${esc(a.label)}</strong><p>${esc(item.detail)}</p>${a.kind === 'whatsapp_draft' ? `<div class="draft-text"><strong>To: ${esc(a.params.phone)}</strong>${esc(a.params.text)}</div>` : ''}${a.kind.startsWith('mouse_') ? `<div class="draft-text"><strong>Screen coordinates: X ${esc(a.params.x)}, Y ${esc(a.params.y)}</strong>${a.kind === 'mouse_click' ? 'A click may delete files or trigger other actions. Check the screen and approve only if you intend the result.' : 'NOVA cannot see the screen.'}</div>` : ''}</div>${online() ? `<div class="row" style="font-size:10px;color:var(--muted)">${icon('monitor')}Connected to ${esc(S.state.bridge.system.hostname || 'your PC')} · expires in 2 minutes</div>` : `<div class="info-banner warning" style="margin:14px 0 0">${icon('alert')}<div><strong>Desktop bridge is offline</strong><p>Connect the agent on your PC before approving. This request stays pending for 2 minutes.</p></div></div>`}<div class="modal-footer"><button class="btn btn-ghost" data-action-cancel="${a.id}">Cancel request</button>${online() ? `<button class="btn btn-primary" id="approve-action">${icon('check')}Approve & run</button>` : `<button class="btn btn-primary" id="go-connect">${icon('monitor')}Connect desktop</button>`}</div>`);
    if ($('#approve-action')) $('#approve-action').onclick = async e => { e.target.disabled = true; try { const data = await api(`/actions/${a.id}/approve`, { method: 'POST', body: {} }); updateAction(data.action); closeModal(); toast('Approved. Your desktop agent will run it shortly.'); } catch (err) { toast(err.message, 'error'); e.target.disabled = false; } };
    if ($('#go-connect')) $('#go-connect').onclick = () => { closeModal(); navigate('desktop'); };
  }
  function updateAction(action) { S.state.actions = S.state.actions.map(a => a.id === action.id ? action : a); if (!S.state.actions.some(a => a.id === action.id)) S.state.actions.unshift(action); if (S.view === 'activity') renderActivityList(); renderMessages(); }
  async function cancelAction(actionId) { const data = await api(`/actions/${actionId}/cancel`, { method: 'POST', body: {} }); updateAction(data.action); toast('Action cancelled.'); }
  function bridgeTokenModal() {
    confirmDialog('Generate a new bridge token?', 'This disconnects any previously connected agent and cancels queued actions. The new token is shown only once.', 'Generate token', async () => {
      const data = await api('/bridge/token', { method: 'POST', body: {} });
      modal('Your private bridge token', `<div class="modal-icon">${icon('lock')}</div><p>Save this token in a file named <span class="mono">nova-bridge.token</span> next to the agent on your Windows PC. Keep it secret.</p><div class="code-block" style="font-size:12px;user-select:all">${esc(data.token)}</div><p class="token-warning">${esc(data.warning)}</p><div class="modal-footer"><button class="btn btn-ghost" id="copy-token">${icon('copy')}Copy token</button><button class="btn btn-primary" id="download-token">${icon('download')}Save token file</button></div>`);
      $('#copy-token').onclick = () => copy(data.token, 'Bridge token copied. Keep it private.');
      $('#download-token').onclick = () => downloadBlob(new Blob([data.token], { type: 'text/plain' }), 'nova-bridge.token');
      S.state.bridge = { ...S.state.bridge, configured: true, online: false }; renderShell();
    });
  }

  /* Activity */
  function renderActivity() {
    $('#view').innerHTML = `${remoteBanner()}${heading('Every action, accounted for.', 'A transparent record of what you asked for and what happened.', `<button class="btn btn-ghost" data-action="refresh">${icon('refresh')}Refresh</button>`)}<div id="pending-actions"></div><section class="card table-scroll"><table class="activity-table"><thead><tr><th>ACTION</th><th>STATUS</th><th>REQUESTED</th><th style="text-align:right">CONTROL</th></tr></thead><tbody id="activity-body"></tbody></table></section><div id="activity-empty"></div>`;
    renderActivityList();
  }
  function renderActivityList() {
    if (!$('#activity-body')) return;
    const actions = S.state.actions; const pending = actions.filter(a => ['pending', 'approved', 'running'].includes(a.status));
    $('#pending-actions').innerHTML = pending.length ? `<div class="pending-list">${pending.map(a => `<div class="pending-item">${icon(a.status === 'running' ? 'activity' : 'shield')}<div><strong>${esc(a.label)}</strong><small>${a.status === 'pending' ? 'Waiting for your approval' : a.status === 'approved' ? 'Queued for the desktop agent' : 'Running on your desktop'}</small></div><div class="row">${a.status === 'pending' ? `<button class="btn btn-sm btn-primary" data-action-review="${a.id}">Review</button>` : ''}${['pending', 'approved'].includes(a.status) ? `<button class="btn btn-sm btn-ghost" data-action-cancel="${a.id}">Cancel</button>` : ''}</div></div>`).join('')}</div>` : '';
    $('#activity-body').innerHTML = actions.map(a => `<tr><td><div class="action-name">${icon(S.state.catalog[a.kind]?.icon || 'activity')}<div><strong>${esc(a.label)}</strong>${a.result ? `<div class="action-result">${esc(a.result)}</div>` : ''}</div></div></td><td>${statusPill(a.status)}</td><td><time>${fmtDate(a.created_at)} · ${fmtTime(a.created_at)}</time></td><td style="text-align:right">${a.status === 'pending' ? `<button class="btn btn-sm btn-ghost" data-action-review="${a.id}">Review</button>` : ['approved'].includes(a.status) ? `<button class="btn btn-sm btn-ghost" data-action-cancel="${a.id}">Cancel</button>` : '<span class="subtle">—</span>'}</td></tr>`).join('');
    $('#activity-empty').innerHTML = actions.length ? '' : `<div class="empty-state" style="margin-top:16px">${icon('activity')}<h2>A clean slate.</h2><p>Desktop actions appear here with their approval status and result. Nothing is hidden.</p><button class="btn btn-primary" data-view="desktop">Explore desktop actions</button></div>`;
  }

  /* Settings */
  function renderSettings() {
    const s = S.state.settings; const owner = isOwner();
    $('#view').innerHTML = `${remoteBanner()}${heading('Make it feel like you.', 'A companion that fits the way you think, speak and work.')}<div class="settings-layout"><div class="stack"><section class="card settings-card"><h2>Your companion</h2><p class="settings-sub">A familiar presence, with a personality you choose.</p><div class="persona-grid"><button class="persona-option ${s.persona === 'nova' ? 'selected' : ''}" data-persona="nova" ${!owner ? 'disabled' : ''}><span class="persona-orb"></span><span><strong>NOVA</strong><small>Warm · intuitive · bright</small></span>${s.persona === 'nova' ? icon('check-circle') : ''}</button><button class="persona-option ${s.persona === 'atlas' ? 'selected' : ''}" data-persona="atlas" ${!owner ? 'disabled' : ''}><span class="persona-orb atlas"></span><span><strong>ATLAS</strong><small>Calm · grounded · clear</small></span>${s.persona === 'atlas' ? icon('check-circle') : ''}</button></div><form id="settings-form"><fieldset ${!owner ? 'disabled' : ''} style="border:0;padding:0;margin:0"><div class="form-grid"><div class="field"><label for="setting-name">What should I call you?</label><input id="setting-name" maxlength="40" value="${esc(s.userName)}" placeholder="Your name"></div><div class="field"><label for="setting-workspace">Workspace name</label><input id="setting-workspace" maxlength="50" required value="${esc(S.state.workspace.name)}"></div><div class="field"><label for="setting-language">Conversation language</label><select id="setting-language"><option value="auto" ${s.language === 'auto' ? 'selected' : ''}>Match my language</option><option value="en" ${s.language === 'en' ? 'selected' : ''}>English</option><option value="bn" ${s.language === 'bn' ? 'selected' : ''}>বাংলা</option></select></div><div class="field"><label for="setting-timezone">Timezone</label><select id="setting-timezone">${[...new Set([s.timezone, 'Asia/Dhaka', 'UTC', 'America/New_York', 'Europe/London', 'Asia/Kolkata', 'Asia/Singapore'])].map(tz => `<option value="${esc(tz)}" ${s.timezone === tz ? 'selected' : ''}>${esc(tz)}</option>`).join('')}</select></div></div><div class="divider"></div><div class="setting-row"><div><strong>Spoken replies</strong><p>Read responses aloud using your browser’s available voices.</p></div><label class="toggle"><input type="checkbox" id="setting-voice" ${s.voiceEnabled ? 'checked' : ''} aria-label="Spoken replies"><span></span></label></div><div class="form-grid" style="margin-top:16px"><div class="field"><label for="setting-gender">Voice preference</label><select id="setting-gender"><option value="feminine" ${s.voiceGender === 'feminine' ? 'selected' : ''}>Feminine</option><option value="masculine" ${s.voiceGender === 'masculine' ? 'selected' : ''}>Masculine</option><option value="auto" ${s.voiceGender === 'auto' ? 'selected' : ''}>System default</option></select><small>Actual voices depend on your browser and OS.</small></div><div class="field"><label for="setting-rate">Speaking pace <span id="rate-value">${s.speechRate}×</span></label><input type="range" id="setting-rate" min="0.7" max="1.3" step="0.1" value="${s.speechRate}" style="padding:12px 0"></div><div class="field full"><label for="setting-voice-uri">Installed voice</label><select id="setting-voice-uri"><option value="">Choose automatically</option></select></div></div><div class="settings-actions"><button type="button" class="btn btn-ghost" id="test-voice" style="margin-right:auto">${icon('volume')}Test voice</button><button type="submit" class="btn btn-primary">${icon('check')}Save preferences</button></div></fieldset></form></section><section class="card settings-card"><h2>Intelligence</h2><p class="settings-sub">Local commands work out of the box. Open-ended AI is optional.</p><div class="provider-status">${icon('cpu')}<div><strong>${S.state.ai.configured ? (S.state.ai.provider === 'groq' ? 'Groq connected' : 'AI provider connected') : 'Local command mode'}</strong><p>${S.state.ai.configured ? `Model: ${esc(S.state.ai.model)}. ${S.state.ai.source === 'workspace' ? 'Your key is encrypted in this workspace.' : 'Using the server environment key.'} Open-ended replies are sent to ${S.state.ai.provider === 'groq' ? 'Groq' : 'the configured provider'}; local commands stay deterministic.` : 'Memory, calculations, time, focus timers and desktop commands work without an API key. I won’t invent answers to open-ended questions.'}</p></div></div>${S.state.ai.configured ? `<div class="settings-actions" style="justify-content:flex-start;margin-top:0;gap:8px;flex-wrap:wrap"><button class="btn btn-sm btn-ghost" id="test-ai" data-action="test-ai" ${!owner ? 'disabled' : ''}>${icon('activity')}Test AI connection</button>${S.state.ai.hasKey ? `<button class="btn btn-sm btn-ghost" data-action="disconnect-ai" ${!owner ? 'disabled' : ''}>${icon('logout')}Disconnect</button>` : ''}<button class="btn btn-sm btn-ghost" data-action="connect-ai" ${!owner ? 'disabled' : ''}>${icon('refresh')}Change key</button></div>` : `<div class="info-banner" style="margin:14px 0 0">${icon('sparkle')}<div><strong>Have a Groq API key?</strong><p>Connect it here in a secure field — no <span class="mono">.env</span> file needed. NOVA will test it and connect automatically. Never paste your key into chat.</p></div></div><div class="settings-actions" style="justify-content:flex-start;margin-top:12px"><button class="btn btn-primary" data-action="connect-ai" ${!owner ? 'disabled' : ''}>${icon('link')}Connect Groq</button></div>`}<p class="muted" style="font-size:10px;margin-top:12px">Keys are sent only to this NOVA server, encrypted at rest, and never returned to the browser. Groq free tiers have rate limits; if you hit them, NOVA will say so. Advanced: server env presets are documented in <span class="mono">NOVA.md</span>.</p></section></div><div class="stack"><section class="card settings-card"><div class="between"><h2>Paired phones</h2>${owner ? `<button class="text-button" data-action="remote">${icon('plus')}Pair phone</button>` : ''}</div><p class="settings-sub" style="margin-bottom:8px">Your workspace, from your pocket.</p><div id="remote-devices"></div></section><section class="card settings-card"><h2>Your data</h2><p class="settings-sub">Stored in this workspace’s SQLite database on the server. Not shared with other workspaces.</p><div class="setting-row"><div><strong>Export workspace</strong><p>Memories, conversation and action history.</p></div><button class="btn btn-sm btn-ghost" data-action="export" ${!owner ? 'disabled' : ''}>${icon('download')}Export</button></div><div class="setting-row"><div><strong>Clear conversation</strong><p>Memories stay in your vault.</p></div><button class="btn btn-sm btn-ghost" data-action="clear-chat" ${!owner ? 'disabled' : ''}>${icon('trash')}Clear</button></div></section>${owner ? `<section class="card settings-card danger-zone"><h2>Danger zone</h2><div class="setting-row"><div><strong>Delete this workspace</strong><p>Permanently removes memories, chats, pairings and bridge access.</p></div><button class="btn btn-sm btn-danger" data-action="delete-workspace">Delete</button></div></section>` : ''}<section class="card settings-card"><h2>About this build</h2><p class="settings-sub" style="margin-bottom:10px">NOVA v0.1 · Working MVP</p><p class="muted" style="font-size:10px">An original companion inspired by the idea of a personal AI desktop. Not affiliated with Stonic AI. Windows actions require the local agent. Voice input uses your browser’s speech service. Screen awareness, a live world monitor and always-on wake word are not included in this build.</p><a class="text-button" href="/" style="margin-top:12px">Back to Gen-Z Hub ${icon('arrow-up-right')}</a></section></div></div>`;
    populateVoices();
    $('#setting-rate').oninput = e => { $('#rate-value').textContent = e.target.value + '×'; };
    $('#test-voice').onclick = () => speak(`Hi${s.userName ? ' ' + s.userName : ''}. I’m ${name()}. Your mind, amplified.`, true);
    $('#settings-form').onsubmit = async e => {
      e.preventDefault(); const btn = $('button[type=submit]', e.target); btn.disabled = true;
      try {
        const data = await api('/settings', { method: 'PATCH', body: { userName: $('#setting-name').value, workspaceName: $('#setting-workspace').value, language: $('#setting-language').value, timezone: $('#setting-timezone').value, voiceEnabled: $('#setting-voice').checked, voiceGender: $('#setting-gender').value, speechRate: Number($('#setting-rate').value), voiceURI: $('#setting-voice-uri').value } });
        S.state.settings = data.settings; S.state.workspace.name = $('#setting-workspace').value; renderShell(); toast('Preferences saved. Make yourself at home.');
      } catch (err) { toast(err.message, 'error'); } finally { btn.disabled = false; }
    };
    renderRemoteDevices();
  }
  function renderRemoteDevices() {
    const box = $('#remote-devices'); if (!box) return;
    box.innerHTML = S.state.remotes.length ? S.state.remotes.map(r => `<div class="remote-device">${icon('phone')}<div><strong>${esc(r.label)}</strong><small>Paired ${fmtDate(r.created_at)} · expires ${fmtDate(r.expires_at)}</small></div><button class="icon-button" data-revoke-remote="${r.token_hash}" aria-label="Revoke paired phone">${icon('logout')}</button></div>`).join('') + `<button class="text-button" data-action="revoke-remotes" style="margin-top:12px">Revoke all phones</button>` : `<div class="empty-mini">${icon('phone')}<p>No phones paired yet.</p><small>Generate a one-time code to connect.</small></div>`;
  }
  function connectAiModal(prefill = '') {
    if (!isOwner()) return toast('Only the workspace owner can connect an AI provider.', 'info');
    const model = S.state.ai.provider === 'groq' && S.state.ai.model ? S.state.ai.model : 'llama-3.3-70b-versatile';
    modal('Connect Groq', `<div class="modal-icon">${icon('lock')}</div><p>Paste your Groq API key into this secure field. NOVA will test it and connect automatically. The key is encrypted on the server and never returned to this browser. <strong>Never paste it into chat.</strong></p><form id="ai-connect-form"><div class="field"><label for="ai-api-key">Groq API key</label><input id="ai-api-key" type="password" required minlength="20" maxlength="300" autocomplete="off" spellcheck="false" placeholder="gsk_…" value="${esc(prefill)}"><small>Create a key at <span class="mono">console.groq.com/keys</span>. Free-tier keys work.</small></div><div class="field" style="margin-top:14px"><label for="ai-model">Model</label><input id="ai-model" maxlength="100" autocomplete="off" spellcheck="false" value="${esc(model)}"><small>Reasoning models like <span class="mono">openai/gpt-oss-120b</span> are supported. For the fastest setup, try <span class="mono">llama-3.3-70b-versatile</span>.</small></div><div class="form-error" id="ai-connect-error" role="alert"></div><div class="modal-footer"><button type="button" class="btn btn-ghost" data-close>Cancel</button><button type="submit" class="btn btn-primary" id="ai-connect-submit">${icon('link')}Connect &amp; test</button></div></form>`);
    $('#ai-connect-form').onsubmit = async e => {
      e.preventDefault();
      const btn = $('#ai-connect-submit'); const err = $('#ai-connect-error');
      btn.disabled = true; err.textContent = '';
      const original = btn.innerHTML; btn.innerHTML = `${icon('refresh')}Testing…`;
      try {
        const data = await api('/ai/connect', { method: 'POST', body: { provider: 'groq', apiKey: $('#ai-api-key').value.trim(), model: $('#ai-model').value.trim() } });
        if (!data.ok) { err.textContent = data.error || 'Connection test failed. Try again.'; return; }
        S.state.ai = data.ai;
        closeModal(); renderShell();
        if (S.view === 'settings') renderSettings();
        toast(`Groq connected · ${data.ai.model} · ${data.latencyMs} ms`);
      } catch (ex) { err.textContent = ex.message; }
      finally { btn.disabled = false; btn.innerHTML = original; }
    };
  }
  async function remoteModal() {
    if (!isOwner()) return toast('Only the workspace owner can pair a phone.', 'info');
    try {
      const data = await api('/remote/create', { method: 'POST', body: {} });
      const link = `${location.origin}/nova#remote=${data.code}`;
      modal('Your workspace, to go.', `<div class="modal-icon">${icon('phone')}</div><p>Open this link on your phone, or visit <strong>${esc(location.origin)}/nova</strong> and enter the code. It expires in 5 minutes and can be used once.</p><div class="pair-code">${esc(data.code)}</div><div class="pair-expiry" id="pair-expiry">Expires in 5:00</div><div class="pair-link">${esc(link)}</div><div class="modal-footer"><button class="btn btn-ghost" id="copy-pair-code">${icon('copy')}Copy code</button><button class="btn btn-primary" id="copy-pair-link">${icon('link')}Copy pairing link</button></div><p style="font-size:9px;color:var(--subtle);margin:16px 0 0">Paired phones can chat, manage memories and approve desktop actions. Revoke access in Settings → Paired phones.</p>`);
      $('#copy-pair-code').onclick = () => copy(data.code, 'Pairing code copied.'); $('#copy-pair-link').onclick = () => copy(link, 'Pairing link copied. Open it on your phone.');
      const interval = setInterval(() => { if (!$('#pair-expiry')) return clearInterval(interval); const left = Math.max(0, data.expiresAt - Date.now()); $('#pair-expiry').textContent = left ? `Expires in ${Math.floor(left / 60000)}:${String(Math.floor(left % 60000 / 1000)).padStart(2, '0')}` : 'Code expired. Generate a new one.'; }, 1000);
    } catch (err) { toast(err.message, 'error'); }
  }

  /* Focus timer */
  function focusCard() { return `<section class="card focus-card"><div class="between"><h3>${icon('timer')}A little room to focus</h3><button class="icon-button" data-action="focus-reset" aria-label="Reset focus timer" style="width:24px;height:24px">${icon('refresh')}</button></div><p>One thing at a time is enough.</p><div class="focus-display"><div class="focus-time"><span id="focus-time">25:00</span><small id="focus-label">READY WHEN YOU ARE</small></div><div class="focus-ring">${icon('sparkle')}</div></div><div class="focus-controls"><button class="btn btn-primary" id="focus-toggle" data-action="focus-toggle">${icon('play')}Start focus</button></div><div class="focus-presets">${[15, 25, 50].map(m => `<button data-focus-minutes="${m}" class="${S.focus.minutes === m ? 'active' : ''}">${m} min</button>`).join('')}</div></section>`; }
  function saveFocus() { if (S.state) localStorage.setItem('nova.focus.' + S.state.workspace.id, JSON.stringify(S.focus)); }
  function startFocus(minutes) { S.focus = { minutes, remaining: minutes * 60, running: true, endAt: Date.now() + minutes * 60000 }; saveFocus(); tickFocus(); }
  function tickFocus() {
    const f = S.focus;
    if (f.running) { f.remaining = Math.max(0, Math.ceil((f.endAt - Date.now()) / 1000)); if (!f.remaining) { f.running = false; f.endAt = 0; saveFocus(); toast('Focus session complete. Take a breath — you earned it.'); speak('Focus session complete. Take a breath. You earned it.'); } }
    if ($('#focus-time')) { $('#focus-time').textContent = `${String(Math.floor(f.remaining / 60)).padStart(2, '0')}:${String(f.remaining % 60).padStart(2, '0')}`; $('#focus-label').textContent = f.running ? 'IN YOUR FOCUS ZONE' : f.remaining === 0 ? 'SESSION COMPLETE' : 'READY WHEN YOU ARE'; $('#focus-toggle').innerHTML = `${icon(f.running ? 'pause' : 'play')}${f.running ? 'Pause' : f.remaining < f.minutes * 60 && f.remaining > 0 ? 'Resume' : 'Start focus'}`; }
  }
  function toggleFocus() { const f = S.focus; if (f.running) { f.running = false; f.endAt = 0; } else { if (f.remaining <= 0) f.remaining = f.minutes * 60; f.running = true; f.endAt = Date.now() + f.remaining * 1000; } saveFocus(); tickFocus(); }

  /* Browser voice: explicit push-to-talk, never an always-on microphone. */
  function populateVoices() {
    const select = $('#setting-voice-uri'); if (!select || !('speechSynthesis' in window)) return;
    const fill = () => { if (!select.isConnected) return; const voices = speechSynthesis.getVoices(); const current = S.state.settings.voiceURI; select.innerHTML = '<option value="">Choose automatically</option>' + voices.map(v => `<option value="${esc(v.voiceURI)}" ${v.voiceURI === current ? 'selected' : ''}>${esc(v.name)} · ${esc(v.lang)}</option>`).join(''); };
    fill(); speechSynthesis.addEventListener('voiceschanged', fill, { once: true });
  }
  function speak(text, force = false) {
    if (!('speechSynthesis' in window)) { if (force) toast('Speech output is not supported in this browser.', 'info'); return; }
    const s = { ...S.state.settings, ...(S.view === 'settings' && $('#setting-voice-uri') ? { voiceURI: $('#setting-voice-uri').value, voiceGender: $('#setting-gender').value, speechRate: Number($('#setting-rate').value), voiceEnabled: $('#setting-voice').checked } : {}) };
    if (!s.voiceEnabled && !force) return;
    speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(text.replace(/\*\*/g, '').replace(/[•#]/g, '').slice(0, 1200));
    const voices = speechSynthesis.getVoices(); const lang = /[\u0980-\u09FF]/.test(text) ? 'bn' : 'en';
    u.lang = lang === 'bn' ? 'bn-BD' : 'en-US'; u.rate = s.speechRate || 1;
    const chosen = voices.find(v => v.voiceURI === s.voiceURI) || voices.find(v => v.lang.startsWith(lang) && (s.voiceGender === 'auto' || new RegExp(s.voiceGender === 'feminine' ? 'female|samantha|zira|aria|jenny|sonia|ava|google.*english' : 'male|david|daniel|guy|alex|mark', 'i').test(v.name))) || voices.find(v => v.lang.startsWith(lang));
    if (chosen) u.voice = chosen;
    u.onerror = e => { if (force && e.error !== 'interrupted' && e.error !== 'canceled') toast('Voice playback failed. Check your browser’s speech settings.', 'error'); };
    speechSynthesis.speak(u);
  }
  function startVoice() {
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition) return modal('Voice input isn’t available here', `<div class="modal-icon">${icon('mic')}</div><p>This browser doesn’t support speech recognition. Try Chrome or Edge on HTTPS, or use the text box. Voice input may use your browser vendor’s speech service; it is not a local wake-word listener.</p><div class="modal-footer"><button class="btn btn-primary" data-close>Got it</button></div>`);
    if (S.listening) { S.recognition?.stop(); return; }
    if (S.view !== 'overview' && S.view !== 'conversation') navigate('conversation');
    const rec = new Recognition(); S.recognition = rec; S.listening = true;
    rec.lang = S.state.settings.language === 'bn' ? 'bn-BD' : /[\u0980-\u09FF]/.test($('#chat-input')?.value || '') ? 'bn-BD' : 'en-US';
    rec.interimResults = true; rec.continuous = false;
    $$('.mic-button').forEach(b => b.classList.add('listening')); if ($('#core-state-text')) $('#core-state-text').textContent = 'LISTENING…';
    rec.onresult = e => { const transcript = [...e.results].map(r => r[0].transcript).join(''); if ($('#chat-input')) $('#chat-input').value = transcript; if (e.results[e.results.length - 1].isFinal) { rec.stop(); sendMessage(transcript); } };
    rec.onerror = e => { const messages = { 'not-allowed': 'Microphone permission was denied. Allow it in your browser settings.', 'no-speech': 'I didn’t catch that. Try again when you’re ready.', 'audio-capture': 'No microphone was found.', network: 'The browser speech service is unavailable. You can still type.' }; if (e.error !== 'aborted') toast(messages[e.error] || 'Voice input stopped. Please try again.', 'info'); };
    rec.onend = () => { S.listening = false; $$('.mic-button').forEach(b => b.classList.remove('listening')); if ($('#core-state-text')) $('#core-state-text').textContent = 'READY WHEN YOU ARE'; };
    try { rec.start(); toast('Listening. Speak now; tap the microphone again to stop.', 'info'); } catch { S.listening = false; toast('Could not start the microphone.', 'error'); }
  }

  /* Command palette */
  function openPalette() {
    closeModal(false); previousFocus = document.activeElement; S.paletteIndex = 0;
    $('#modal-root').innerHTML = `<div class="modal-backdrop"><section class="modal palette" role="dialog" aria-modal="true" aria-label="Command palette"><div class="palette-search">${icon('search')}<input id="palette-input" placeholder="Search actions, pages, memories…" autocomplete="off" aria-label="Search commands"><kbd>ESC</kbd></div><div class="palette-results" id="palette-results"></div></section></div>`;
    S.modal = {}; document.body.style.overflow = 'hidden';
    $('.modal-backdrop').onclick = e => { if (e.target.classList.contains('modal-backdrop')) closeModal(); };
    $('#palette-input').oninput = e => { S.paletteIndex = 0; renderPalette(e.target.value); };
    $('#palette-input').onkeydown = e => { if (['ArrowDown', 'ArrowUp'].includes(e.key)) { e.preventDefault(); S.paletteIndex = Math.max(0, Math.min(S.paletteItems.length - 1, S.paletteIndex + (e.key === 'ArrowDown' ? 1 : -1))); $$('.palette-item').forEach((el, i) => el.classList.toggle('selected', i === S.paletteIndex)); } if (e.key === 'Enter') { e.preventDefault(); $('.palette-item.selected')?.click(); } };
    renderPalette(''); setTimeout(() => $('#palette-input')?.focus(), 30);
  }
  function renderPalette(query) {
    const q = query.toLowerCase();
    const pages = [['overview', 'grid', 'Overview'], ['conversation', 'message', 'Conversation'], ['memory', 'brain', 'Memory vault'], ['desktop', 'monitor', 'Desktop control'], ['activity', 'activity', 'Activity'], ['settings', 'settings', 'Settings']].map(([view, ic, label]) => ({ label, detail: 'Go to page', icon: ic, run: () => navigate(view) }));
    const actions = Object.entries(S.state.catalog).filter(([k]) => k !== 'whatsapp_draft' && !k.startsWith('mouse_')).map(([kind, item]) => ({ label: item.label, detail: 'Desktop action · approval required', icon: item.icon, run: () => prepareAction(kind) }));
    const memories = S.state.memories.map(m => ({ label: m.content, detail: 'Memory · ' + m.category, icon: 'brain', run: () => memoryModal(m) }));
    S.paletteItems = [...pages, ...actions, ...memories, { label: 'Add a memory', detail: 'Save something worth keeping', icon: 'plus', run: () => memoryModal() }, { label: 'Start focus timer', detail: `${S.focus.minutes} minutes`, icon: 'timer', run: () => { startFocus(S.focus.minutes); navigate('overview'); } }].filter(item => (item.label + ' ' + item.detail).toLowerCase().includes(q)).slice(0, 14);
    $('#palette-results').innerHTML = S.paletteItems.length ? S.paletteItems.map((item, i) => `<button class="palette-item ${i === S.paletteIndex ? 'selected' : ''}" data-palette-index="${i}">${icon(item.icon)}<div><strong>${esc(item.label)}</strong><small>${esc(item.detail)}</small></div>${icon('arrow-right')}</button>`).join('') : '<div class="palette-empty">No matches. Try “memory”, “focus” or “YouTube”.</div>';
  }
  function helpModal() {
    modal('A little help, a lot of possibility.', `<div class="modal-icon">${icon('sparkle')}</div><p>NOVA is a working MVP, not a claim of magic. Here’s what works today:</p><ul class="safety-list"><li>${icon('message')}Chat in English or বাংলা. Open-ended AI needs a configured provider.</li><li>${icon('brain')}Explicit memories, saved in your private workspace.</li><li>${icon('monitor')}Allowlisted Windows actions through the local bridge, with approval.</li><li>${icon('mic')}Push-to-talk voice input and optional spoken replies, where your browser supports them.</li><li>${icon('phone')}One-time phone pairing with revocable access.</li><li>${icon('timer')}A focus timer that keeps time even when you switch pages.</li></ul><div class="divider"></div><p style="font-size:10px">Try: “Remember my favorite editor is VS Code”, “What’s 128 × 4?”, “Focus for 25 minutes”, or “Open YouTube”. Desktop actions never run from chat alone.</p><div class="modal-footer"><button class="btn btn-primary" id="help-try">Try a conversation ${icon('arrow-right')}</button></div>`);
    $('#help-try').onclick = () => { closeModal(); navigate('conversation'); };
  }
  async function exportWorkspace() { try { const blob = await api('/export', { raw: true }); downloadBlob(blob, 'nova-workspace.json'); toast('Workspace exported.'); } catch (err) { toast(err.message, 'error'); } }
  function deleteWorkspaceModal() {
    modal('Delete this workspace?', `<div class="modal-icon" style="color:var(--red)">${icon('alert')}</div><p>This permanently deletes your memories, conversation, action history, paired phones and bridge access. Export first if you want a copy. Type <strong>DELETE</strong> to confirm.</p><div class="field"><label for="delete-confirm">Confirmation</label><input id="delete-confirm" autocomplete="off" placeholder="DELETE"></div><div class="modal-footer"><button class="btn btn-ghost" data-close>Keep workspace</button><button class="btn btn-danger" id="delete-workspace-confirm" disabled>Delete permanently</button></div>`);
    $('#delete-confirm').oninput = e => { $('#delete-workspace-confirm').disabled = e.target.value !== 'DELETE'; };
    $('#delete-workspace-confirm').onclick = async () => { try { await api('/workspace', { method: 'DELETE', body: { confirmation: 'DELETE' } }); sessionStorage.removeItem('nova.token'); localStorage.removeItem('nova.focus.' + S.state.workspace.id); location.reload(); } catch (err) { toast(err.message, 'error'); } };
  }

  /* One delegated event layer for all rendered views and modals. */
  document.addEventListener('click', async e => {
    const el = e.target.closest('button, a'); if (!el || el.disabled) return;
    if (el.dataset.view) return navigate(el.dataset.view);
    if (el.dataset.quick) return prepareAction(el.dataset.quick);
    if (el.dataset.prompt) return sendMessage(el.dataset.prompt);
    if (el.dataset.copy) return copy(el.dataset.copy);
    if (el.dataset.actionReview) return reviewAction(el.dataset.actionReview);
    if (el.dataset.actionCancel) return confirmDialog('Cancel this action?', 'It will not run on your desktop.', 'Cancel action', () => cancelAction(el.dataset.actionCancel));
    if (el.dataset.editMemory) return memoryModal(S.state.memories.find(m => m.id === el.dataset.editMemory));
    if (el.dataset.deleteMemory) { const m = S.state.memories.find(x => x.id === el.dataset.deleteMemory); return confirmDialog('Forget this memory?', m.content, 'Delete memory', async () => { await api('/memories/' + m.id, { method: 'DELETE' }); S.state.memories = S.state.memories.filter(x => x.id !== m.id); renderMemoryGrid(); renderShell(); toast('Memory deleted.'); }, true); }
    if (el.dataset.memoryFilter) { S.memoryFilter = el.dataset.memoryFilter; $$('[data-memory-filter]').forEach(b => b.classList.toggle('active', b === el)); return renderMemoryGrid(); }
    if (el.dataset.focusMinutes) { S.focus = { minutes: +el.dataset.focusMinutes, remaining: +el.dataset.focusMinutes * 60, running: false, endAt: 0 }; saveFocus(); $$('[data-focus-minutes]').forEach(b => b.classList.toggle('active', b === el)); return tickFocus(); }
    if (el.dataset.persona && isOwner()) { try { const data = await api('/settings', { method: 'PATCH', body: { persona: el.dataset.persona, assistantName: el.dataset.persona === 'atlas' ? 'ATLAS' : 'NOVA', voiceGender: el.dataset.persona === 'atlas' ? 'masculine' : 'feminine' } }); S.state.settings = data.settings; renderShell(); renderSettings(); toast(`${data.settings.assistantName} is ready.`); } catch (err) { toast(err.message, 'error'); } return; }
    if (el.dataset.revokeRemote) return confirmDialog('Revoke this phone?', 'It will immediately lose access to this workspace.', 'Revoke access', async () => { await api('/remote/' + el.dataset.revokeRemote, { method: 'DELETE' }); S.state.remotes = S.state.remotes.filter(r => r.token_hash !== el.dataset.revokeRemote); renderRemoteDevices(); toast('Phone access revoked.'); });
    if (el.dataset.paletteIndex !== undefined) { const item = S.paletteItems[+el.dataset.paletteIndex]; closeModal(); return item?.run(); }
    const action = el.dataset.action; if (!action) return;
    const handlers = {
      workspace: () => navigate('settings'), palette: openPalette, help: helpModal, remote: remoteModal,
      'connect-desktop': () => navigate('desktop'), 'start-chat': () => { navigate('conversation'); $('#chat-input')?.focus(); },
      voice: startVoice, 'connect-ai': () => connectAiModal(), 'build-website': websiteBuilder,
      'disconnect-ai': () => confirmDialog('Disconnect Groq?', 'NOVA will remove the encrypted key from this workspace and return to local command mode (unless a server environment key is configured).', 'Disconnect', async () => {
        const data = await api('/ai/disconnect', { method: 'POST', body: {} });
        S.state.ai = data.ai; renderShell(); if (S.view === 'settings') renderSettings();
        toast(data.ai.configured ? 'Workspace key removed. A server environment key is still active.' : 'Groq disconnected. Local commands still work.');
      }),
      'test-ai': async () => {
        const btn = $('#test-ai'); if (btn) { btn.disabled = true; btn.innerHTML = `${icon('refresh')}Testing…`; }
        try { const r = await api('/ai/test', { method: 'POST', body: {} }); if (!r.ok) throw new Error(r.error || 'Connection test failed.'); toast(`${r.provider === 'groq' ? 'Groq' : 'AI'} connection OK · ${r.model} · ${r.latencyMs} ms`); }
        catch (err) { toast(err.message, 'error'); }
        finally { if (btn) { btn.disabled = false; btn.innerHTML = `${icon('activity')}Test AI connection`; } }
      }, focus: () => { navigate('overview'); $('.focus-card')?.scrollIntoView({ behavior: 'smooth', block: 'center' }); },
      'focus-toggle': toggleFocus, 'focus-reset': () => { S.focus = { minutes: S.focus.minutes, remaining: S.focus.minutes * 60, running: false, endAt: 0 }; saveFocus(); tickFocus(); },
      'add-memory': () => memoryModal(), 'bridge-token': bridgeTokenModal, refresh: async () => { await sync(); toast('Activity refreshed.'); },
      'clear-chat': () => confirmDialog('Clear this conversation?', 'Your memories and action history stay intact. This cannot be undone.', 'Clear conversation', async () => { await api('/messages', { method: 'DELETE' }); S.state.messages = []; renderMessages(); toast('Conversation cleared.'); }, true),
      export: exportWorkspace, 'delete-workspace': deleteWorkspaceModal,
      'revoke-remotes': () => confirmDialog('Revoke all paired phones?', 'Every paired phone will lose access immediately.', 'Revoke all', async () => { await api('/remote/revoke-all', { method: 'POST', body: {} }); S.state.remotes = []; renderRemoteDevices(); toast('All phone access revoked.'); }),
    };
    handlers[action]?.();
  });
  $('#mobile-menu').onclick = () => $('#sidebar').classList.toggle('open');
  $('#sidebar-scrim').onclick = () => $('#sidebar').classList.remove('open');
  window.addEventListener('hashchange', () => { const v = location.hash.slice(1); if (S.state && ['overview', 'conversation', 'memory', 'desktop', 'activity', 'settings'].includes(v) && v !== S.view) navigate(v); });
  boot();
})();
