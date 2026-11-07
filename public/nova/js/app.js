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
  const voiceCompanion = new URLSearchParams(location.search).get('voice') === '1';
  if (voiceCompanion) document.title = 'NOVA · Voice window';
  const S = { state: null, view: 'overview', token: sessionStorage.getItem('nova.token') || '', busy: false, memoryFilter: 'all', memorySearch: '', modal: null, websiteProjectId: null, focus: { minutes: 25, remaining: 1500, running: false, endAt: 0 }, orb: null, recognition: null, listening: false, voiceSession: { active: false, timer: null, wakeUntil: 0, allowAppOpen: false, chatOnly: false, pendingAction: null, pendingProject: null, projectWork: null, projectGrant: null, projectStatus: null, projectBengali: false, voicePlan: null, recognitionLanguage: null, monitorTimer: null, monitorAbort: null, monitorEpoch: 0, retryDelay: 800, lastNetworkWarning: 0, alerts: { enabled: false, epoch: 0, timer: null, deliverTimer: null, seen: new Set(), baseline: false, queue: [], inFlight: false } }, lastSnapshot: '', paletteIndex: 0, paletteItems: [] };
  const fmtTime = ts => new Date(ts).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  const fmtDate = ts => new Date(ts).toLocaleDateString([], { month: 'short', day: 'numeric' });
  const name = () => S.state?.settings.assistantName || 'NOVA';
  const isOwner = () => S.state?.workspace.role === 'owner';
  const online = () => !!S.state?.bridge.online;
  const SECRET_IN_CHAT = /(?:gsk_[A-Za-z0-9_-]{20,}|sk-(?:proj-)?[A-Za-z0-9_-]{20,})/;
  const statusPill = status => { const map = { pending: ['amber', 'Awaiting approval'], approved: ['violet', 'Queued'], running: ['violet', 'Running'], completed: ['mint', 'Completed'], failed: ['red', 'Failed'], cancelled: ['', 'Cancelled'], expired: ['', 'Expired'] }; const [color, label] = map[status] || ['', status]; return `<span class="pill pill-${color}">${label}</span>`; };

  // Never let an older sync snapshot overwrite a locally completed write.
  let writeVersion = 0, writesInFlight = 0;
  async function api(path, { method = 'GET', body, raw = false, signal } = {}) {
    const headers = { 'X-GenZ-Client': '1', 'X-Nova-Session': S.token };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    const write = !['GET', 'HEAD'].includes(method.toUpperCase());
    if (write) writesInFlight++;
    try {
      let res;
      try { res = await fetch('/api/nova' + path, { method, headers, credentials: 'same-origin', signal, body: body === undefined ? undefined : JSON.stringify(body) }); }
      catch { throw new Error('Cannot reach NOVA. Check your connection and try again.'); }
      if (raw) { if (!res.ok) throw new Error('Export failed.'); if (write) writeVersion++; return await res.blob(); }
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { const err = new Error(data.error || `Request failed (${res.status}).`); err.status = res.status; throw err; }
      if (write) writeVersion++;
      return data;
    } finally { if (write) writesInFlight--; }
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
    const dialog = $('.modal');
    setTimeout(() => { if (!dialog.isConnected || dialog.contains(document.activeElement)) return; const first = $('input:not([readonly]), textarea, select, .btn-primary, button', dialog); first?.focus(); }, 30);
  }
  function closeModal(restore = true) { const old = S.modal; $('#modal-root').innerHTML = ''; S.modal = null; document.body.style.overflow = ''; if (old?.onClose) old.onClose(); if (restore && previousFocus?.isConnected) previousFocus.focus(); if (old && S.voiceSession.active && !S.busy && !S.listening) scheduleVoiceTurn(); }
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
      renderShell(); navigate(['overview', 'conversation', 'memory', 'world', 'desktop', 'activity', 'settings'].includes(location.hash.slice(1)) ? location.hash.slice(1) : 'overview');
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
    wrap.innerHTML = `<section class="card remote-pair-card"><div class="brand"><img class="brand-emblem" src="/nova/assets/nova-emblem.png?v=1" alt="" width="58" height="58"><span>NOVA<span class="brand-sub">PERSONAL AI</span></span></div><div class="modal-icon" style="margin:0 auto 18px">${icon('phone')}</div><h1>Your desktop, within reach.</h1><p>Enter the pairing code from NOVA on your computer. Codes expire after 5 minutes and work once.</p><form id="pair-form"><div class="field"><label for="pair-code">Pairing code</label><input id="pair-code" class="pair-input" maxlength="10" minlength="10" required autocomplete="off" spellcheck="false" placeholder="A1B2C3D4E5" value="${esc(code)}"></div><div class="form-error" id="pair-error" role="alert"></div><button class="btn btn-primary btn-block" type="submit">${icon('link')}Pair with workspace</button></form><p class="privacy-note">${icon('lock')}Access is limited to this workspace. Revoke anytime.</p></section>`;
    document.body.appendChild(wrap);
    $('#pair-form').onsubmit = async e => {
      e.preventDefault(); const btn = $('button', e.target); btn.disabled = true; $('#pair-error').textContent = '';
      try { const data = await api('/remote/pair', { method: 'POST', body: { code: $('#pair-code').value.trim() } }); S.token = data.token; sessionStorage.setItem('nova.token', S.token); location.hash = ''; location.reload(); }
      catch (err) { $('#pair-error').textContent = err.message; btn.disabled = false; }
    };
  }
  async function sync() {
    if (!S.token || !S.state || S.busy || writesInFlight) return;
    const version = writeVersion;
    try {
      const data = await api('/sync');
      if (writesInFlight || version !== writeVersion || S.busy) return;
      const previousActions = S.state.actions;
      S.state = { ...S.state, ...data };
      renderShell();
      for (const a of data.actions) { const old = previousActions.find(x => x.id === a.id); if (old && old.status !== a.status && ['completed', 'failed'].includes(a.status)) toast(`${a.label}: ${a.status}. ${a.result || ''}`, a.status === 'failed' ? 'error' : 'success'); }
      const signature = JSON.stringify([data.messages.map(m => m.id), data.actions.map(a => [a.id, a.status]), data.memories.map(m => [m.id, m.updated_at]), data.bridge.online, data.bridge.managed, data.bridge.autoReconnect, data.remotes.map(r => r.token_hash)]);
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
    $$('[data-action="continuous-voice"]').forEach(b => { b.setAttribute('aria-pressed', String(S.voiceSession.active)); b.innerHTML = `${icon('mic')}${S.voiceSession.active ? 'Stop voice conversation' : 'Start voice conversation'}`; const label = b.parentElement?.querySelector('span'); if (label) label.textContent = S.voiceSession.active ? 'Say NOVA before each request' : 'Optional · uses browser speech service'; });
    const nativeStatus = $('#native-voice-status'); if (nativeStatus) { const nv = s.nativeVoice || { state: 'off' }; nativeStatus.textContent = nv.state === 'off' ? (nv.error || 'Off · manual opt-in') : `${nv.state} · ${nv.language || ''} · tray icon can stop`; }
    renderNativePower();
    const ns = s.nativeScreen || { state: 'off' }; const banner = $('#native-screen-banner'); if (banner) { banner.hidden = !isOwner() || ns.state === 'off'; $('#native-screen-indicator').textContent = `Windows screen permission ${ns.state.toUpperCase()} · one frame per request · may be sent to AI`; }
    $('#sidebar-bridge-status').innerHTML = `<i class="status-dot" style="color:${online() ? 'var(--mint)' : 'var(--subtle)'}"></i>${online() ? 'Connected' : 'Not connected'}`;
    const engineLabel = s.ai.configured ? (s.ai.provider === 'groq' ? 'Groq + local' : 'AI + local') : 'Local engine';
    $('#engine-pill').innerHTML = `<i class="status-dot"></i>${engineLabel}`;
    document.documentElement.style.setProperty('--violet', s.settings.persona === 'atlas' ? '#7dd3fc' : '#a78bfa');
    document.documentElement.style.setProperty('--violet-soft', s.settings.persona === 'atlas' ? 'rgba(125,211,252,.12)' : 'rgba(167,139,250,.12)');
  }
  function navigate(view) {
    if (S.voiceSession.active && !['overview', 'conversation'].includes(view)) stopVoiceConversation();
    S.view = view; location.hash = view;
    $$('.nav-item[data-view]').forEach(el => { el.classList.toggle('active', el.dataset.view === view); if (el.dataset.view === view) el.setAttribute('aria-current', 'page'); else el.removeAttribute('aria-current'); });
    $('#breadcrumb-current').textContent = { overview: 'Overview', conversation: 'Conversation', memory: 'Memory vault', world: 'World monitor', desktop: 'Desktop control', activity: 'Activity', settings: 'Settings' }[view];
    $('#sidebar').classList.remove('open');
    if (S.orb) { S.orb.destroy(); S.orb = null; }
    const views = { overview: renderOverview, conversation: renderConversation, memory: renderMemory, world: renderWorld, desktop: renderDesktop, activity: renderActivity, settings: renderSettings };
    views[view](); renderShell(); hydrateIcons($('#view')); window.scrollTo({ top: 0, behavior: 'instant' });
  }
  const remoteBanner = () => !isOwner() ? `<div class="remote-banner">${icon('phone')}You’re controlling this workspace remotely. Desktop actions still need approval.</div>` : '';
  const heading = (title, sub, action = '') => `<div class="page-heading"><div><h1>${title}</h1><p>${sub}</p></div>${action ? `<div class="heading-actions">${action}</div>` : ''}</div>`;

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
  function composer() { return `<div class="composer-wrap"><form class="composer" id="chat-form"><label class="sr-only" for="chat-input">Message ${esc(name())}</label><textarea id="chat-input" rows="1" name="message" placeholder="Ask ${esc(name())}, or tell me what to do…" maxlength="4000" autocomplete="off"></textarea><button type="button" class="icon-button mic-button" data-action="voice" aria-label="Start voice input">${icon('mic')}</button><button type="submit" class="icon-button send-button" aria-label="Send message">${icon('send')}</button></form><div class="composer-note"><span>${icon('lock')}Private workspace · you approve desktop actions</span><span>Enter to send · Shift + Enter for a new line</span></div><div class="voice-session-row"><button type="button" class="text-button" data-action="continuous-voice" aria-pressed="${S.voiceSession.active}">${icon('mic')}${S.voiceSession.active ? 'Stop voice conversation' : 'Start voice conversation'}</button><span>${S.voiceSession.active ? 'Say NOVA before each request' : 'Optional · uses browser speech service'}</span></div>${isOwner() && !voiceCompanion ? `<button type="button" class="text-button" data-action="voice-window">${icon('mic')}Open separate voice window</button>` : ''}${isOwner() && !voiceCompanion ? `<div class="voice-session-row"><button type="button" class="text-button" data-action="native-voice">${icon('mic')}Windows background voice (experimental)</button><span id="native-voice-status" role="status"></span></div>` : ''}${voiceCompanion ? `<div class="voice-window-note"><strong>Separate voice window</strong><p id="voice-handsfree-status" role="status" aria-live="polite">Say Nova before each request. Spoken approvals do not verify identity.</p><p>Start voice conversation here and say “নোভা” or “Nova” before each request. You may close the other NOVA tab and minimize this window; keep this window, Chrome and NOVA running. Audio may be sent to your browser’s speech service while listening. Anyone nearby or a recording can trigger it; it does not verify your identity. Listening may stop if the browser suspends it.</p><label for="voice-language">Recognition language</label> <select id="voice-language" aria-label="Voice recognition language"><option value="bn-BD" ${voiceRecognitionLanguage() === 'bn-BD' ? 'selected' : ''}>বাংলা (Bangladesh)</option><option value="en-US" ${voiceRecognitionLanguage() === 'en-US' ? 'selected' : ''}>English</option></select><p>Choose the language you will speak. Auto does not detect languages reliably.</p><button type="button" class="btn btn-sm btn-ghost" data-action="voice-chat-only" id="voice-chat-only" aria-pressed="${S.voiceSession.chatOnly}">${S.voiceSession.chatOnly ? 'আড্ডা মোড বন্ধ করো' : 'আড্ডা মোড চালু করো'}</button><p id="voice-chat-status">${S.voiceSession.chatOnly ? 'আড্ডা মোড: এই window-র chat থেকে desktop কাজ বা memory save হবে না। অন্য window ও বোতাম প্রভাবিত নয়।' : 'আড্ডা মোডে এই window-র chat থেকে desktop কাজ বা memory save হয় না। কথার আগে নোভা বলতে হবে।'}</p><p>কথার text এই workspace-এ থাকে। AI যুক্ত থাকলে সাম্প্রতিক আলাপ ও তোমার সংরক্ষিত memory সংযুক্ত AI provider-এ পাঠানো হয়। Microphone browser-এর speech service ব্যবহার করতে পারে।</p><button type="button" class="btn btn-sm btn-ghost" data-action="voice-app-permission" id="voice-app-permission">${S.voiceSession.allowAppOpen ? 'Turn off voice app opening' : 'Allow voice app opening for this session'}</button><p>Optional: direct, locally recognized requests to open Firefox, Chrome, Edge, Notepad and Calculator may run without another review. AI-interpreted requests and other desktop actions still need review.</p><button type="button" class="btn btn-sm btn-ghost" data-action="voice-news-alerts" id="voice-news-alerts">${S.voiceSession.alerts.enabled ? 'Turn off news alerts' : 'Enable news alerts for this session'}</button><div id="voice-news-status" role="status" aria-live="polite">Optional headlines, not an official emergency alert. Sources can be delayed or unavailable.</div><div id="voice-news-proof"></div><div id="voice-project-result" role="status" aria-live="polite">${voiceProjectMarkup()}</div><div id="voice-plan-result" role="status" aria-live="polite"></div><p>Voice planning: say “নোভা পরিকল্পনা করো” and your goal. Each request and each fixed action needs separate spoken consent. This window must stay open; voice does not identify you.</p></div>` : ''}</div>`; }
  function renderConversation() {
    $('#view').innerHTML = `${remoteBanner()}${heading('A conversation, not a command line.', `Think out loud. ${esc(name())} is listening.`, `${isOwner() ? `<button class="btn btn-primary" data-action="website-studio">${icon('sparkle')}Website studio</button> <button class="btn btn-ghost" data-action="build-website">${icon('globe')}Build website</button> <button class="btn btn-ghost" data-action="project-builder">${icon('folder')}Project builder</button> <button class="btn btn-ghost" data-action="goal-plan">${icon('sparkle')}Plan a goal</button> <button class="btn btn-ghost" data-action="auto-work">${icon('monitor')}Visual work</button>` : ''}`)}<div class="conversation-layout"><section class="card chat-card">${chatHeader()}<div class="messages" id="messages" role="log" aria-live="polite"></div><div id="chat-suggestions"></div>${composer()}</section></div>`;
    renderMessages(); bindComposer();
  }
  // Authorization is scoped to one new static project, never to desktop control.
  function websiteStudio(initialBrief = '') {
    if (!isOwner()) return toast('Only the workspace owner can build a project.', 'info');
    if (S.voiceSession.active) stopVoiceConversation();
    modal('Website studio · design & build', `<p>Describe the website in Bangla or English. NOVA first plans a visual direction, then generates coordinated HTML, CSS and JavaScript for a new static project. This can take several minutes and several AI requests; your brief and generated content go to your connected AI provider.</p><p class="muted">Preview is isolated and blocks network and form submissions. No backend, real payments, hosting, installs, commands or desktop work. Review generated code before using it. Quality depends on the AI model; do not include secrets.</p><form id="studio-form"><div class="field"><label for="studio-brief">What would you like to build?</label><textarea id="studio-brief" required maxlength="3000" rows="6" placeholder="Describe the brand, audience, sections, style and interactions…">${esc(initialBrief)}</textarea></div><div class="modal-footer"><button type="button" class="btn btn-ghost" id="studio-saved">Saved projects</button><button type="submit" class="btn btn-primary" id="studio-submit">Approve &amp; build</button></div></form>`, { className: 'website-modal' });
    $('#studio-saved').onclick = listBuiltProjects;
    $('#studio-form').onsubmit = e => { e.preventDefault(); const brief = $('#studio-brief').value.trim(); if (brief) runProject(brief, { studio: true }); };
  }
  function projectBuilder(initialBrief = '') {
    if (!isOwner()) return toast('Only the workspace owner can build a project.', 'info');
    if (S.voiceSession.active) stopVoiceConversation();
    let recognition = null;
    modal('Project builder · one permission', `<p>Describe a static website. One approval lets NOVA generate <strong>index.html, styles.css and app.js</strong> in a new project folder. The brief and generated files are sent to your connected AI provider. No existing files are changed or deleted; no packages, commands or desktop actions run. This is not a full app/backend.</p><div class="field"><label for="project-brief">Website description</label><textarea id="project-brief" maxlength="3000" rows="4" placeholder="A responsive bakery website with menu and theme toggle">${esc(initialBrief)}</textarea></div><p id="project-approval-status" class="muted" role="status">Voice approval uses the browser speech service and does not verify who is speaking.</p><div class="modal-footer"><button type="button" class="btn btn-ghost" id="project-saved">Saved projects</button><button type="button" class="btn btn-ghost" id="project-voice-approve">${icon('mic')}Approve by voice</button><button type="button" class="btn btn-primary" id="project-approve">Approve &amp; build</button></div>`, { className: 'website-modal', onClose: () => { if (recognition) { recognition.onresult = recognition.onend = recognition.onerror = null; try { recognition.abort(); } catch {} recognition = null; S.listening = false; } } });
    const submit = () => { const brief = $('#project-brief').value.trim(); if (!brief) { $('#project-approval-status').textContent = 'Describe the project before approving.'; return; } runProject(brief); };
    $('#project-approve').onclick = submit; $('#project-saved').onclick = listBuiltProjects;
    $('#project-voice-approve').onclick = () => {
      if (!$('#project-brief').value.trim()) { $('#project-approval-status').textContent = 'Describe the project before approving.'; return; }
      const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      const status = $('#project-approval-status'), btn = $('#project-voice-approve');
      if (!Recognition) { status.textContent = 'Voice recognition unavailable. Use Approve & build.'; return; }
      if (S.listening || recognition) { status.textContent = 'Microphone already in use.'; return; }
      if ('speechSynthesis' in window) speechSynthesis.cancel();
      const rec = new Recognition(); recognition = rec; S.listening = true;
      rec.lang = S.state.settings.language === 'en' ? 'en-US' : 'bn-BD'; rec.interimResults = false; rec.continuous = false; btn.disabled = true;
      status.textContent = rec.lang === 'bn-BD' ? 'Listening. Say “অনুমতি দিচ্ছি”. Anyone nearby can approve.' : 'Listening. Say “approve”. Anyone nearby can approve.';
      rec.onresult = e => {
        const result = e.results[e.results.length - 1]; if (!result?.isFinal || recognition !== rec) return;
        const spoken = String(result[0]?.transcript || '').toLowerCase().trim().replace(/[.!?।]+$/g, '').trim();
        if (['approve', 'অনুমতি দিচ্ছি', 'অনুমতি দিলাম'].includes(spoken)) { try { rec.stop(); } catch {} recognition = null; S.listening = false; submit(); }
        else { status.textContent = 'Approval not recognised. Nothing started.'; try { rec.stop(); } catch {} }
      };
      rec.onerror = () => { if (status.isConnected) status.textContent = 'Voice recognition failed. Nothing started.'; };
      rec.onend = () => { if (recognition === rec) recognition = null; S.listening = false; if (btn.isConnected) btn.disabled = false; };
      try { rec.start(); } catch { recognition = null; S.listening = false; btn.disabled = false; status.textContent = 'Could not start microphone.'; }
    };
  }
  async function runProject(brief, options = {}) {
    const abort = new AbortController();
    modal('Building your project', `<p>${options.studio ? 'NOVA is planning the design, then generating and checking three files.' : 'NOVA is generating and checking three files.'} This may take a few minutes. Closing this dialog or pressing Stop requests cancellation.</p><p class="muted">No desktop actions, package installs or existing file changes are authorized.</p><p id="project-progress" role="status">Working…</p><div class="modal-footer"><button class="btn btn-ghost" id="project-stop">Stop</button></div>`, { className: 'website-modal', onClose: () => abort.abort() });
    const status = $('#project-progress'); $('#project-stop').onclick = () => { abort.abort(); closeModal(); toast('Stop requested. Check Saved projects in case saving already started.', 'info'); };
    try {
      const result = await api('/builder/generate', { method: 'POST', body: { brief, confirm: true, ...(options.studio ? { studio: true } : {}) }, signal: abort.signal });
      if (!status.isConnected || abort.signal.aborted) return;
      if (!result.ok) throw new Error(result.error || 'Project build failed.');
      showBuiltProject(result.project, result.checks);
    } catch (err) { if (status.isConnected && !abort.signal.aborted) { status.textContent = err.message; $('#project-stop').textContent = 'Close'; } }
  }
  function showBuiltProject(project, report) {
    const checks = Array.isArray(report?.checks) ? report.checks : [];
    modal('Project ready', `<p><strong>${esc(project.name)}</strong> · Three files saved in your NOVA data folder. Review AI-generated code before you run or publish it.</p><div class="studio-preview-toolbar" aria-label="Preview sizes"><span>Preview width</span><button type="button" class="btn btn-sm btn-ghost" id="preview-wide" aria-pressed="true">Wide</button><button type="button" class="btn btn-sm btn-ghost" id="preview-mobile" aria-pressed="false">Mobile</button></div><iframe id="project-preview" title="Sandboxed project preview" sandbox="allow-scripts" src="/api/nova/builder/projects/${encodeURIComponent(project.id)}/preview"></iframe><p class="muted" style="margin-top:10px">Preview blocks network and forms. No backend, hosting, installs or desktop work was performed.</p>${checks.length ? `<details class="studio-checks"><summary>Basic code checks (not a quality or security audit)</summary><ul>${checks.map(c => `<li>${c.ok ? '✓' : '○'} ${esc(c.label)}${c.ok ? '' : ' — not detected'}</li>`).join('')}</ul>${report.externalReferencePossible ? '<p>Possible external reference detected; preview blocks network. Inspect the code before use.</p>' : ''}<p>These checks do not verify layout, accessibility, interactions, security or whether the site works.</p></details>` : ''}<div class="modal-footer"><button class="btn btn-ghost" id="project-list">Saved projects</button><button class="btn btn-ghost" id="project-revise">Request changes</button><button class="btn btn-primary" id="project-download">${icon('download')}Download project ZIP</button></div>`, { className: 'website-modal' });
    $('#preview-wide').onclick = () => { $('#project-preview').classList.remove('studio-mobile'); $('#preview-wide').setAttribute('aria-pressed', 'true'); $('#preview-mobile').setAttribute('aria-pressed', 'false'); };
    $('#preview-mobile').onclick = () => { $('#project-preview').classList.add('studio-mobile'); $('#preview-wide').setAttribute('aria-pressed', 'false'); $('#preview-mobile').setAttribute('aria-pressed', 'true'); };
    $('#project-revise').onclick = () => reviseBuiltProject(project, report);
    $('#project-list').onclick = listBuiltProjects;
    $('#project-download').onclick = async e => { const btn = e.currentTarget; btn.disabled = true; try { const blob = await api('/builder/projects/' + encodeURIComponent(project.id) + '/download', { raw: true }); downloadBlob(blob, 'nova-project.zip'); } catch (err) { toast(err.message, 'error'); } finally { btn.disabled = false; } };
  }
  function reviseBuiltProject(project, report) {
    modal('Request changes', `<p>Describe changes to <strong>${esc(project.name)}</strong>. The existing project files and your request will be sent to your connected AI provider. A new version is saved; the previous version stays unchanged. No commands, installation or deployment.</p><form id="studio-revision-form"><div class="field"><label for="studio-changes">Changes</label><textarea id="studio-changes" maxlength="3000" rows="5" required placeholder="Make the hero more editorial and add a working mobile menu…"></textarea></div><div class="modal-footer"><button type="button" id="revision-back" class="btn btn-ghost">Back</button><button type="submit" class="btn btn-primary">Approve &amp; create new version</button></div></form>`, { className: 'website-modal' });
    $('#revision-back').onclick = () => showBuiltProject(project, report);
    $('#studio-revision-form').onsubmit = e => { e.preventDefault(); const changes = $('#studio-changes').value.trim(); if (changes) runStudioRevision(project, changes); };
  }
  async function runStudioRevision(project, changes) {
    const abort = new AbortController();
    modal('Creating a new version', `<p>NOVA is planning and generating a revision. This may take several minutes. The original remains unchanged. Closing this window or pressing Stop requests cancellation.</p><p id="revision-progress" role="status">Working…</p><div class="modal-footer"><button type="button" id="revision-stop" class="btn btn-ghost">Stop</button></div>`, { className: 'website-modal', onClose: () => abort.abort() });
    const status = $('#revision-progress'); $('#revision-stop').onclick = () => { abort.abort(); closeModal(); toast('Stop requested. Check Saved projects in case saving already started.', 'info'); };
    try {
      const result = await api('/builder/revise-manual', { method: 'POST', body: { projectId: project.id, changes, confirm: true }, signal: abort.signal });
      if (!status.isConnected || abort.signal.aborted) return;
      if (!result.ok) throw new Error(result.error || 'Revision failed.');
      showBuiltProject(result.project, result.checks);
    } catch (err) { if (status.isConnected && !abort.signal.aborted) { status.textContent = err.message; $('#revision-stop').textContent = 'Close'; } }
  }
  async function listBuiltProjects() {
    modal('Saved projects', '<p id="project-list-status">Loading…</p>', { className: 'website-modal' });
    const status = $('#project-list-status');
    try {
      const data = await api('/builder/projects'); if (!status.isConnected) return;
      modal('Saved projects', `<p>These static projects are stored on this NOVA server.</p><div class="website-list">${data.projects.length ? data.projects.map(p => `<button class="btn btn-ghost built-project" data-project-id="${esc(p.id)}"><span>${esc(p.name)}</span><small>${esc(fmtDate(p.createdAt))}</small></button>`).join('') : '<p>No projects yet.</p>'}</div><div class="modal-footer"><button class="btn btn-primary" data-action="project-builder">New project</button></div>`, { className: 'website-modal' });
      $$('.built-project').forEach(btn => { btn.onclick = async () => { try { const p = await api('/builder/projects/' + encodeURIComponent(btn.dataset.projectId)); if (btn.isConnected) showBuiltProject(p.project, p.checks); } catch (err) { if (btn.isConnected) toast(err.message, 'error'); } }; });
    } catch (err) { if (status.isConnected) status.textContent = err.message; }
  }

  // Browser screen sharing always requires a browser picker; no hidden capture.
  function screenShareModal() {
    if (!isOwner()) return toast('Only the owner can share the screen.', 'info');
    let stream = null, proposal = null;
    modal('Screen viewer & click assistant', `<p>Choose a screen or window. Nothing goes to AI until you press Analyze or Suggest click; each sends one still image and your question to your AI provider. Close private windows first. For a click, share your <strong>entire primary monitor</strong>, verify the marked point, and approve it separately. AI can be wrong; a click can delete or send things. Screen changes can make the point unsafe.</p><div class="modal-footer"><button class="btn btn-ghost" id="screen-start">Share screen</button><button class="btn btn-ghost" id="screen-stop" disabled>Stop sharing</button></div><video id="screen-video" autoplay muted playsinline style="width:100%;max-height:40vh;background:#05070c;margin:12px 0;border-radius:8px"></video><div class="field"><label for="vision-model">Vision model (must be supported by your provider)</label><input id="vision-model" maxlength="100" value="${esc(S.state.ai.provider === 'openai' ? 'gpt-4.1-mini' : 'meta-llama/llama-4-scout-17b-16e-instruct')}"></div><div class="field"><label for="screen-question">Question or target to click</label><input id="screen-question" maxlength="500" value="Describe what you see and the visible controls."></div><label class="screen-check"><input type="checkbox" id="screen-primary"> I selected the entire primary monitor, not a window or another display.</label><div class="modal-footer"><button class="btn btn-ghost" id="screen-suggest" disabled>Suggest click</button><button class="btn btn-primary" id="screen-analyze" disabled>Analyze screen</button></div><p id="screen-status" class="muted" role="status">Not sharing.</p><p id="screen-answer" style="white-space:pre-wrap"></p><div id="screen-proposal"></div>`, { className: 'website-modal', onClose: () => { stream?.getTracks().forEach(t => t.stop()); stream = null; } });
    const video = $('#screen-video'), status = $('#screen-status'), analyze = $('#screen-analyze'), suggest = $('#screen-suggest'), start = $('#screen-start'), stop = $('#screen-stop');
    function ended() { stream?.getTracks().forEach(t => t.stop()); stream = null; proposal = null; if (video.isConnected) { video.srcObject = null; status.textContent = 'Screen sharing stopped.'; start.disabled = false; stop.disabled = true; analyze.disabled = suggest.disabled = true; $('#screen-proposal').innerHTML = ''; } }
    start.onclick = async () => {
      if (!navigator.mediaDevices?.getDisplayMedia) { status.textContent = 'Screen sharing needs a supported browser on localhost or HTTPS.'; return; }
      start.disabled = true;
      try { const selected = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false }); if (!video.isConnected) { selected.getTracks().forEach(t => t.stop()); return; } stream = selected; video.srcObject = stream; stream.getVideoTracks()[0].onended = ended; stop.disabled = false; analyze.disabled = suggest.disabled = false; status.textContent = 'Sharing locally. No image is sent until Analyze or Suggest click is pressed.'; }
      catch { if (status.isConnected) { status.textContent = 'Screen sharing was cancelled or unavailable.'; start.disabled = false; } }
    };
    stop.onclick = ended;
    async function inspect(mode) {
      if (!stream || !video.videoWidth || !video.videoHeight) { status.textContent = 'Wait for the shared screen to appear.'; return; }
      if (mode === 'suggest-click' && (!$('#screen-primary').checked || stream.getVideoTracks()[0].getSettings().displaySurface !== 'monitor')) { status.textContent = 'Choose the entire primary monitor in the browser picker and confirm it above. Window or tab sharing cannot be used for clicking.'; return; }
      const scale = Math.min(1, 1024 / video.videoWidth, 768 / video.videoHeight); const canvas = document.createElement('canvas'); canvas.width = Math.max(1, Math.round(video.videoWidth * scale)); canvas.height = Math.max(1, Math.round(video.videoHeight * scale)); canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
      const image = canvas.toDataURL('image/jpeg', .65), capturedAt = Date.now();
      proposal = null; $('#screen-proposal').innerHTML = ''; analyze.disabled = suggest.disabled = true; status.textContent = 'Sending one frame to your AI provider…'; $('#screen-answer').textContent = '';
      try {
        const r = await api('/screen/analyze', { method: 'POST', body: { image, question: $('#screen-question').value, model: $('#vision-model').value.trim(), mode } });
        if (!status.isConnected || !stream) return; if (!r.ok) throw new Error(r.error);
        if (mode !== 'suggest-click') { $('#screen-answer').textContent = r.answer; status.textContent = 'Analysis complete. Nothing was clicked or typed.'; return; }
        if (!r.proposal) { status.textContent = r.reason || 'No target found. Nothing was clicked.'; return; }
        proposal = { ...r.proposal, image, capturedAt };
        $('#screen-answer').textContent = r.proposal.reason || 'AI suggested this point.';
        const box = $('#screen-proposal'); box.innerHTML = `<p class="muted">This is a still image, not a live screen. Compare the marked point with your current primary screen. Suggestions expire quickly and can be wrong.</p><div class="screen-snapshot"><img id="screen-snapshot-image" alt="Shared screen with AI suggested click point"><span id="screen-marker" aria-hidden="true"></span></div><div class="modal-footer"><button id="screen-review-click" class="btn btn-primary">Review suggested click</button></div>`;
        $('#screen-snapshot-image').src = image; $('#screen-marker').style.left = (r.proposal.x / 100) + '%'; $('#screen-marker').style.top = (r.proposal.y / 100) + '%';
        status.textContent = 'No click has happened. Verify this point on your actual screen.';
        $('#screen-review-click').onclick = () => {
          if (!proposal || !stream || !$('#screen-primary').checked || Date.now() - proposal.capturedAt > 60000) { status.textContent = 'The image is too old or sharing stopped. Suggest the click again.'; box.innerHTML = ''; proposal = null; return; }
          prepareAction('mouse_click_primary', { x: proposal.x, y: proposal.y }, proposal.image);
        };
      } catch (err) { if (status.isConnected) status.textContent = err.message; }
      finally { if (analyze.isConnected) analyze.disabled = suggest.disabled = !stream; }
    }
    analyze.onclick = () => inspect('describe'); suggest.onclick = () => inspect('suggest-click');
  }

  // AI output is advisory; only the server's fixed catalog actions can be
  // prepared, and each action still needs its own explicit approval.
  function goalPlanDialog(initialGoal = '') {
    if (!isOwner()) return toast('Only the owner can create a goal plan.', 'error');
    if (S.voiceSession.active) stopVoiceConversation();
    let plan = null, disposed = false, recognition = null, polling = null, working = false;
    const controller = new AbortController();
    const path = () => '/goal-plans/' + encodeURIComponent(plan.id);
    const pageHide = () => { if (plan?.state === 'active') fetch('/api/nova' + path() + '/stop', { method: 'POST', keepalive: true, credentials: 'same-origin', headers: { 'Content-Type': 'application/json', 'X-GenZ-Client': '1', 'X-Nova-Session': S.token }, body: '{}' }).catch(() => {}); };
    window.addEventListener('pagehide', pageHide);
    function dispose() {
      if (disposed) return; disposed = true; window.removeEventListener('pagehide', pageHide); clearTimeout(polling); controller.abort();
      if (recognition) { recognition.onresult = recognition.onend = recognition.onerror = null; try { recognition.abort(); } catch {} recognition = null; S.listening = false; }
      if (plan?.state === 'active') api(path() + '/stop', { method: 'POST', body: {} }).catch(() => {});
    }
    modal('Plan a goal · step by step', `<p>Write or speak a goal. Creating a plan sends the goal to your connected AI provider; do not include passwords or keys. No screenshot, chat history or memory is sent for planning.</p><p>The AI suggests up to six steps and can be wrong. Only fixed app/site opening and system information actions are supported; each needs a separate approval. Other steps are for you to do or clarify. No typing, clicking, installing, sending, deleting or automatic execution. Plans last ten minutes and are not saved; prepared actions and their results appear in activity history.</p><div class="field"><label for="goal-plan-input">Your goal</label><textarea id="goal-plan-input" maxlength="1000" rows="3" placeholder="উদাহরণ: আমাকে কাজ শুরু করতে সাহায্য করো">${esc(initialGoal)}</textarea></div><div class="modal-footer"><button class="btn btn-ghost" id="goal-plan-voice">${icon('mic')}Speak goal</button><button class="btn btn-primary" id="goal-plan-create">Send goal &amp; make plan</button></div><p id="goal-plan-status" role="status" aria-live="polite">Browser speech may use an online speech service. Voice does not identify the speaker.</p><div id="goal-plan-result"></div>`, { className: 'website-modal', onClose: dispose });
    const status = $('#goal-plan-status'), result = $('#goal-plan-result'), create = $('#goal-plan-create');
    function paint() {
      if (disposed || !plan) return;
      status.textContent = `${plan.state.toUpperCase()} · ${plan.message || ''}`;
      result.innerHTML = `<p><strong>Suggested plan:</strong> ${esc(plan.summary)}</p><ol class="goal-plan-list">${plan.steps.map((step, i) => `<li><strong>${esc(step.description)}</strong><p>${step.kind === 'manual' ? 'Your step / clarification · NOVA cannot do this automatically.' : `Fixed action: ${esc(step.label)} · ${esc(step.detail)}`}</p><small>${esc(step.status)}${step.result ? ' · ' + esc(step.result) : ''}</small>${plan.state === 'active' && i === plan.index ? '<span> · current step</span>' : ''}</li>`).join('')}</ol><div id="goal-plan-controls" class="modal-footer"></div>`;
      const controls = $('#goal-plan-controls');
      if (plan.state !== 'active') return;
      const step = plan.steps[plan.index];
      if (step.kind === 'manual') controls.innerHTML = '<button class="btn btn-ghost" id="goal-manual">I did this step</button>';
      else if (!plan.action) controls.innerHTML = '<button class="btn btn-ghost" id="goal-prepare">Review this action</button>';
      else if (plan.action.status === 'pending') controls.innerHTML = `<button class="btn btn-ghost" id="goal-approve-voice">${icon('mic')}Approve by voice</button><button class="btn btn-primary" id="goal-approve">Approve this action</button>`;
      else controls.innerHTML = '<span class="muted">Waiting for the agent’s actual result…</span>';
      controls.insertAdjacentHTML('beforeend', '<button class="btn btn-danger" id="goal-stop">Stop plan</button>');
      if ($('#goal-prepare')) $('#goal-prepare').onclick = () => operate('prepare');
      if ($('#goal-approve')) $('#goal-approve').onclick = () => operate('approve', { confirm: true });
      if ($('#goal-approve-voice')) $('#goal-approve-voice').onclick = () => listen('approve');
      if ($('#goal-manual')) $('#goal-manual').onclick = () => operate('manual-done', { confirm: true });
      $('#goal-stop').onclick = () => operate('stop');
    }
    async function refresh() {
      if (disposed || !plan || plan.state !== 'active') return;
      try { const data = await api(path(), { signal: controller.signal }); if (disposed) return; plan = data.plan; paint(); }
      catch (err) { if (!disposed) status.textContent = 'Could not check the result. ' + err.message; }
      if (!disposed && plan?.state === 'active' && plan.action && plan.action.status !== 'pending') polling = setTimeout(refresh, 1500);
    }
    async function operate(op, body = {}) {
      if (working || disposed) return; working = true; clearTimeout(polling);
      try { const data = await api(path() + '/' + op, { method: 'POST', body, signal: controller.signal }); if (disposed) return; if (data.plan) plan = data.plan; paint(); if (!data.ok) throw new Error(data.error || 'Could not complete this step.'); if (plan.action && plan.action.status !== 'pending') polling = setTimeout(refresh, 1500); }
      catch (err) { if (!disposed) status.textContent = err.message; }
      finally { working = false; }
    }
    function listen(mode) {
      const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!Recognition || recognition || S.listening) { status.textContent = 'Speech recognition is unavailable or busy; use the buttons.'; return; }
      const rec = new Recognition(); recognition = rec; S.listening = true;
      rec.lang = S.state.settings.language === 'en' ? 'en-US' : 'bn-BD'; rec.interimResults = false; rec.continuous = false;
      status.textContent = mode === 'goal' ? 'Listening for your goal. Browser speech service may receive audio.' : 'Say “approve” or “অনুমতি দিচ্ছি” for this one fixed action. Voice does not verify identity.';
      rec.onresult = e => {
        const item = e.results[e.results.length - 1]; if (!item?.isFinal || disposed || recognition !== rec) return;
        const spoken = String(item[0]?.transcript || '').trim();
        if (mode === 'goal') { $('#goal-plan-input').value = spoken.slice(0, 1000); status.textContent = 'Check the recognized goal, then send it for planning.'; }
        else if (['approve', 'অনুমতি দিচ্ছি', 'অনুমতি দিলাম'].includes(spoken.toLowerCase().replace(/[.!?।]+$/g, '').trim()) && plan?.action?.status === 'pending') operate('approve', { confirm: true });
        else status.textContent = 'Approval not recognized; nothing was approved.';
        try { rec.stop(); } catch {}
      };
      rec.onerror = () => { if (!disposed) status.textContent = 'Speech recognition failed; nothing was approved.'; };
      rec.onend = () => { if (recognition === rec) recognition = null; S.listening = false; };
      try { rec.start(); } catch { recognition = null; S.listening = false; status.textContent = 'Microphone could not start.'; }
    }
    $('#goal-plan-voice').onclick = () => listen('goal');
    create.onclick = async () => {
      const goal = $('#goal-plan-input').value.trim(); if (!goal) { status.textContent = 'Describe your goal first.'; return; }
      create.disabled = true; status.textContent = 'Asking the connected AI to suggest a plan…';
      try { const data = await api('/goal-plans', { method: 'POST', body: { goal, confirm: true }, signal: controller.signal }); if (disposed) return; if (!data.ok) throw new Error(data.error || 'Planning failed.'); plan = data.plan; create.disabled = true; $('#goal-plan-input').disabled = true; $('#goal-plan-voice').disabled = true; paint(); }
      catch (err) { if (!disposed) { status.textContent = err.message; create.disabled = false; } }
    };
  }

  // One explicit, time-limited authorization drives a see/act/check loop. The
  // browser must remain open and share the primary monitor throughout.
  function autonomousWorkModal() {
    if (!isOwner()) return toast('Only the workspace owner can start visual work.', 'info');
    if (S.voiceSession.active) stopVoiceConversation();
    let stream = null, sessionId = null, recognition = null, disposed = false, looping = false, lastImage = '', controller = new AbortController();
    const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
    const pageHide = () => { if (sessionId && !disposed) fetch('/api/nova/autonomy/' + encodeURIComponent(sessionId) + '/stop', { method: 'POST', keepalive: true, credentials: 'same-origin', headers: { 'Content-Type': 'application/json', 'X-GenZ-Client': '1', 'X-Nova-Session': S.token }, body: '{}' }).catch(() => {}); };
    window.addEventListener('pagehide', pageHide);
    function stopLocal() {
      if (disposed) return; disposed = true; window.removeEventListener('pagehide', pageHide); controller.abort();
      if (recognition) { recognition.onresult = recognition.onend = recognition.onerror = null; try { recognition.abort(); } catch {} recognition = null; S.listening = false; }
      stream?.getTracks().forEach(t => t.stop()); stream = null;
      if (sessionId) api('/autonomy/' + encodeURIComponent(sessionId) + '/stop', { method: 'POST', body: {} }).catch(() => {});
    }
    modal('Visual project work · experimental', `<p>One approval starts a session of up to 12 steps or 4 minutes. NOVA repeatedly sends a screenshot and your goal to the selected vision provider, chooses a step, uses the connected Windows bridge, and checks again. <strong>AI can click the wrong thing or misclassify a delete; separate deletion confirmation is not guaranteed.</strong> Close private windows and watch the screen. Stop cannot undo an action already running.</p><p>Supported: clicks on the primary screen, single-line typing in supported apps, and one new three-file static website project with up to two revisions. No shell, package install, backend or automatic deployment. Destructive, sending, purchase, install and uncertain steps are intended to pause for review; detection can fail. Action labels and typed text are saved in activity.</p><div class="field"><label for="auto-goal">What should NOVA do?</label><textarea id="auto-goal" maxlength="1000" rows="3" placeholder="Build a responsive bakery website"></textarea></div><div class="field"><label for="auto-model">Vision model on your connected AI provider</label><input id="auto-model" maxlength="100" value="${esc(S.state.ai.provider === 'openai' ? 'gpt-4.1-mini' : 'meta-llama/llama-4-scout-17b-16e-instruct')}"></div><div class="modal-footer"><button type="button" id="auto-share" class="btn btn-ghost">Share entire primary screen</button></div><video id="auto-video" autoplay muted playsinline style="width:100%;max-height:25vh;background:#05070c;margin:10px 0;border-radius:8px"></video><label class="screen-check"><input type="checkbox" id="auto-primary"> I selected the entire primary monitor, understand screenshots go to my AI provider, and will watch the session.</label><div class="modal-footer"><button type="button" id="auto-voice" class="btn btn-ghost" disabled>${icon('mic')}Approve by voice</button><button type="button" id="auto-start" class="btn btn-primary" disabled>Approve &amp; start</button><button type="button" id="auto-stop" class="btn btn-danger" disabled>Stop</button></div><p id="auto-status" class="muted" role="status">Share your primary screen to begin. Voice does not verify identity.</p><div id="auto-review"></div><div id="auto-preview"></div>`, { className: 'website-modal', onClose: stopLocal });
    const video = $('#auto-video'), status = $('#auto-status'), start = $('#auto-start'), voice = $('#auto-voice'), stop = $('#auto-stop'), share = $('#auto-share'), review = $('#auto-review'), preview = $('#auto-preview');
    function showSession(session) {
      if (!status.isConnected || disposed) return;
      status.textContent = `${session.state.toUpperCase()} · ${session.steps}/${session.maxSteps} steps · ${session.message || ''}${session.action ? ` · ${session.action.status}` : ''}`;
      if (session.project && !$('#auto-project-preview')) {
        preview.innerHTML = `<p class="muted">New static website saved. Preview is sandboxed; check it before use.</p><iframe id="auto-project-preview" title="Generated project preview" sandbox="allow-scripts" data-project-id="${esc(session.project.id)}" src="/api/nova/builder/projects/${encodeURIComponent(session.project.id)}/preview"></iframe><div class="modal-footer"><button id="auto-project-download" class="btn btn-ghost">Download project ZIP</button></div>`;
        $('#auto-project-download').onclick = async e => { const btn = e.currentTarget; btn.disabled = true; try { const id = $('#auto-project-preview').dataset.projectId; downloadBlob(await api('/builder/projects/' + encodeURIComponent(id) + '/download', { raw: true }), 'nova-project.zip'); } catch (err) { toast(err.message, 'error'); } finally { btn.disabled = false; } };
      } else if (session.project && $('#auto-project-preview').dataset.projectId !== session.project.id) {
        $('#auto-project-preview').dataset.projectId = session.project.id; $('#auto-project-preview').src = '/api/nova/builder/projects/' + encodeURIComponent(session.project.id) + '/preview';
      }
      if (session.state === 'review' && session.action) {
        const action = session.action;
        review.innerHTML = `<div class="approval-detail"><strong>Additional approval required</strong><p>${esc(action.label)}</p>${action.kind.startsWith('keyboard_') ? `<p>Text: ${esc(action.params.text)}</p>` : ''}<p>AI may be wrong. Check the live screen before approving. The screen can change after this image.</p></div>${lastImage && action.kind === 'mouse_click_primary' ? `<div class="screen-snapshot"><img src="${esc(lastImage)}" alt="Screen when action was proposed"><span aria-hidden="true" style="left:${action.params.x / 100}%;top:${action.params.y / 100}%"></span></div>` : ''}<div class="modal-footer"><button class="btn btn-ghost" id="auto-approve-risk">Approve this step</button></div>`;
        $('#auto-approve-risk').onclick = async e => {
          e.currentTarget.disabled = true;
          try { const r = await api('/autonomy/' + encodeURIComponent(sessionId) + '/approve', { method: 'POST', body: { confirm: true }, signal: controller.signal }); if (!r.ok) throw new Error(r.error); review.innerHTML = ''; showSession(r.session); runLoop(); }
          catch (err) { if (status.isConnected && !disposed) { status.textContent = err.message; e.currentTarget.disabled = false; } }
        };
      }
      if (['complete', 'stopped', 'failed'].includes(session.state)) { stream?.getTracks().forEach(t => t.stop()); stream = null; stop.disabled = true; start.disabled = voice.disabled = true; }
    }
    async function runLoop() {
      if (looping || disposed || !sessionId) return; looping = true;
      try {
        while (!disposed && stream && sessionId) {
          const current = (await api('/autonomy/' + encodeURIComponent(sessionId), { signal: controller.signal })).session;
          if (disposed) return; showSession(current);
          if (current.state !== 'active') return;
          if (current.action) { await sleep(1200); continue; }
          for (let tries = 0; tries < 20 && !disposed && (!video.videoWidth || !video.videoHeight); tries++) await sleep(500);
          if (disposed || !stream) return;
          if (!video.videoWidth || !video.videoHeight) throw new Error('The shared screen is not ready. Session stopped.');
          const scale = Math.min(1, 1024 / video.videoWidth, 768 / video.videoHeight), canvas = document.createElement('canvas');
          canvas.width = Math.max(1, Math.round(video.videoWidth * scale)); canvas.height = Math.max(1, Math.round(video.videoHeight * scale)); canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
          lastImage = canvas.toDataURL('image/jpeg', .65); status.textContent = 'Looking at the screen and deciding the next step…';
          const r = await api('/autonomy/' + encodeURIComponent(sessionId) + '/step', { method: 'POST', body: { image: lastImage }, signal: controller.signal });
          if (disposed) return; if (r.session) showSession(r.session); if (!r.ok) throw new Error(r.error || 'The visual step failed.');
          if (r.session.state !== 'active') return;
          await sleep(1200);
        }
      } catch (err) { if (!disposed && status.isConnected) { status.textContent = err.message; stopLocal(); stop.disabled = true; } }
      finally { looping = false; }
    }
    share.onclick = async () => {
      if (!navigator.mediaDevices?.getDisplayMedia) { status.textContent = 'Screen sharing requires a supported browser on localhost or HTTPS.'; return; }
      share.disabled = true;
      try {
        const chosen = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
        if (disposed || !video.isConnected) { chosen.getTracks().forEach(t => t.stop()); return; }
        if (chosen.getVideoTracks()[0].getSettings().displaySurface !== 'monitor') { chosen.getTracks().forEach(t => t.stop()); throw new Error('Choose the entire primary monitor, not a window or browser tab.'); }
        stream = chosen; video.srcObject = stream;
        stream.getVideoTracks()[0].onended = () => { if (!disposed) { if (status.isConnected) status.textContent = 'Screen sharing stopped; ending the session.'; stopLocal(); if (stop.isConnected) stop.disabled = true; } };
        start.disabled = voice.disabled = false; status.textContent = 'Screen shared locally. No frame has been sent yet. Confirm the primary monitor and approve the session.';
      } catch (err) { if (!disposed && status.isConnected) { share.disabled = false; status.textContent = err.message || 'Screen sharing was cancelled.'; } }
    };
    async function begin() {
      if (!stream || !$('#auto-primary').checked) { status.textContent = 'Share the entire primary monitor and confirm it first.'; return; }
      const goal = $('#auto-goal').value.trim(), model = $('#auto-model').value.trim();
      if (!goal) { status.textContent = 'Describe the task first.'; return; }
      start.disabled = voice.disabled = true; status.textContent = 'Starting authorized visual session…';
      try {
        const r = await api('/autonomy/start', { method: 'POST', body: { goal, model, confirm: true, primary: true } });
        if (!r.ok) throw new Error(r.error);
        sessionId = r.session.id;
        if (disposed) { api('/autonomy/' + encodeURIComponent(sessionId) + '/stop', { method: 'POST', body: {} }).catch(() => {}); return; }
        stop.disabled = false; share.disabled = true; $('#auto-goal').disabled = $('#auto-model').disabled = $('#auto-primary').disabled = true;
        for (const el of [video, $('#auto-goal').closest('.field'), $('#auto-model').closest('.field'), $('#auto-primary').closest('label'), share, start, voice, ...$$('.modal-body > p:not(#auto-status)')]) if (el) el.style.display = 'none';
        $('#modal-title').textContent = 'Visual work is running';
        showSession(r.session); runLoop();
      } catch (err) { if (!disposed && status.isConnected) { status.textContent = err.message; start.disabled = voice.disabled = false; } }
    }
    start.onclick = begin;
    stop.onclick = () => { stopLocal(); status.textContent = 'Stop requested. A step already running on Windows may finish.'; stop.disabled = true; };
    voice.onclick = () => {
      const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!Recognition) { status.textContent = 'Voice recognition unavailable; use Approve & start.'; return; }
      if (!stream || !$('#auto-primary').checked || !$('#auto-goal').value.trim()) { status.textContent = 'Share the primary screen, confirm it and describe the task first.'; return; }
      if (recognition || S.listening) { status.textContent = 'Microphone is already in use.'; return; }
      if ('speechSynthesis' in window) speechSynthesis.cancel();
      const rec = new Recognition(); recognition = rec; S.listening = true; voice.disabled = true;
      rec.lang = S.state.settings.language === 'en' ? 'en-US' : 'bn-BD'; rec.interimResults = false; rec.continuous = false;
      status.textContent = rec.lang === 'bn-BD' ? 'Say “অনুমতি দিচ্ছি” to start the session. Voice does not verify identity.' : 'Say “approve” to start the session. Voice does not verify identity.';
      rec.onresult = e => { const result = e.results[e.results.length - 1]; if (!result?.isFinal || recognition !== rec) return; const spoken = String(result[0]?.transcript || '').toLowerCase().trim().replace(/[.!?।]+$/g, '').trim(); if (['approve', 'অনুমতি দিচ্ছি', 'অনুমতি দিলাম'].includes(spoken)) { try { rec.stop(); } catch {} recognition = null; S.listening = false; begin(); } else { status.textContent = 'Approval not recognised. Nothing started.'; try { rec.stop(); } catch {} } };
      rec.onerror = () => { if (status.isConnected) status.textContent = 'Voice recognition failed. Nothing started.'; };
      rec.onend = () => { if (recognition === rec) recognition = null; S.listening = false; if (voice.isConnected && !sessionId) voice.disabled = false; };
      try { rec.start(); } catch { recognition = null; S.listening = false; voice.disabled = false; status.textContent = 'Could not start microphone.'; }
    };
  }

  // Generated code is untrusted. Preview it in an opaque sandboxed iframe with
  // a restrictive server-side CSP; never install packages or run host commands.
  function websiteBuilder() {
    modal('Build a website', `<p>Describe a simple website in Bangla or English. Your description is sent to your connected AI provider. NOVA saves a new static HTML project on this computer; it does not create a backend or deploy the site.</p><form id="website-form"><div class="field"><label for="website-brief">What should the website look like?</label><textarea id="website-brief" required maxlength="3000" rows="5" placeholder="Example: a colourful bakery website with a menu and contact section"></textarea></div><p class="form-error" id="website-error" role="alert"></p><div class="modal-footer"><button type="button" class="btn btn-ghost" id="website-saved">Saved websites</button><button type="button" class="btn btn-ghost" id="website-studio-link">Try Website studio</button><button class="btn btn-primary" id="website-submit" type="submit">Generate website</button></div></form>`, { className: 'website-modal' });
    $('#website-saved').onclick = savedWebsites;
    $('#website-studio-link').onclick = () => websiteStudio($('#website-brief').value);
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
        // Only link the fixed, validated World Monitor sources; all message text remains escaped.
        const sourceUrl = /(https:\/\/(?:[a-z0-9-]+\.)*(?:bbc\.com|bbc\.co\.uk)\/[^\s<>"']+|https:\/\/(?:www\.)?theguardian\.com\/[^\s<>"']+|https:\/\/(?:www\.)?jagonews24\.com\/[^\s<>"']+|https:\/\/earthquake\.usgs\.gov\/[^\s<>"']+)/gi;
        const content = String(m.content).split(sourceUrl).map((part, i) => i % 2 && m.role === 'assistant'
          ? `<a href="${esc(part)}" target="_blank" rel="noopener noreferrer">${esc(part)}</a>`
          : esc(part).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')).join('');
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
    const lang = $('#voice-language'); if (lang) lang.onchange = () => {
      S.voiceSession.recognitionLanguage = lang.value === 'en-US' ? 'en-US' : 'bn-BD';
      if (S.voiceSession.active && S.listening && S.recognition) { try { S.recognition.stop(); } catch {} }
    };
  }
  async function sendMessage(text, fromVoice = false) {
    text = text.trim();
    if (!text || S.busy) return;
    const input = $('#chat-input');
    const secret = text.match(SECRET_IN_CHAT);
    if (secret) {
      if (input) { input.value = ''; input.style.height = 'auto'; }
      toast('API key chat-e pathano hoy ni. Secure field-e connect korun.', 'info');
      return connectAiModal(secret[0]);
    }
    const voiceSite = fromVoice && !(voiceCompanion && S.voiceSession.chatOnly) && isOwner() && /(?:\b(?:website|web ?site|web ?page)\b|ওয়েবসাইট|ওয়েবসাইট|ওয়েবপেজ|ওয়েবপেজ)/i.test(text) && !/(?:\b(?:don't|do not|never|not|delete|remove|install)\b|করো না|বানিও না|মুছে|ডিলিট)/i.test(text) && !/(?:^|\s)না(?:\s|$|[।.,!?])/.test(text);
    const voiceEdit = voiceSite && /(?:\b(?:edit|update|modify|change|improve|redesign|fix|color|colour)\b|বদল|পরিবর্তন|আপডেট|ঠিক কর|যোগ কর|রঙ|রং|কালার|শিরোনাম)/i.test(text) && !/(?:\b(?:how|why|what)\b|কিভাবে|কীভাবে|কেন)/i.test(text);
    if (voiceCompanion && S.voiceSession.active && voiceEdit) { if (input) input.value = ''; reviseVoiceProject(text); return; }
    if (voiceSite && /(?:build|create|make|design|banao|banaw|banai|baniye|বানাও|বানিয়ে|বানিয়ে|তৈরি কর|ডিজাইন কর)/i.test(text) && !/(?:\b(?:how|why|what)\b|কিভাবে|কীভাবে|কেন)/i.test(text)) {
      if (input) input.value = '';
      if (voiceCompanion && S.voiceSession.active) prepareVoiceProject(text); else projectBuilder(text);
      return;
    }
    S.busy = true; if (S.voiceSession.active && S.listening) { try { S.recognition?.stop(); } catch {} } if (input) { input.value = ''; input.style.height = 'auto'; }
    const send = $('.send-button'); if (send) send.disabled = true;
    if (S.view !== 'conversation' && S.view !== 'overview') navigate('conversation');
    S.state.messages.push({ id: 'temp-user', role: 'user', content: text, created_at: Date.now() }); renderMessages();
    if ($('#core-state-text')) $('#core-state-text').textContent = 'THINKING WITH YOU';
    try {
      const data = await api('/chat', { method: 'POST', body: { message: text, ...(fromVoice ? { inputMode: 'voice' } : {}), ...(voiceCompanion && S.voiceSession.chatOnly ? { conversationMode: 'chat' } : {}), ...(S.websiteProjectId ? { websiteProjectId: S.websiteProjectId } : {}) } });
      S.state.messages = S.state.messages.filter(m => m.id !== 'temp-user'); S.state.messages.push(data.userMessage, data.message);
      if (data.memory) S.state.memories.unshift(data.memory);
      if (data.action) S.state.actions.unshift(data.action);
      let autoOpened = false;
      if (voiceCompanion && isOwner() && fromVoice && S.voiceSession.active && !S.voiceSession.chatOnly && S.voiceSession.allowAppOpen && online() && data.engine === 'local' && data.action && ['open_firefox', 'open_chrome', 'open_edge', 'open_notepad', 'open_calculator'].includes(data.action.kind)) {
        try { const approved = await api(`/actions/${data.action.id}/approve`, { method: 'POST', body: {} }); updateAction(approved.action); autoOpened = true; }
        catch { toast('Could not approve the app request; review it in this window.', 'error'); }
      }
      if (voiceCompanion && isOwner() && fromVoice && S.voiceSession.active && !S.voiceSession.chatOnly && data.action && !autoOpened && online()) {
        const a = data.action;
        S.voiceSession.pendingAction = { id: a.id, expiresAt: Math.min(Number(a.expires_at) || Date.now() + 60000, Date.now() + 60000) };
        const label = ({ open_firefox: 'ফায়ারফক্স খোলা', open_chrome: 'ক্রোম খোলা', open_edge: 'এজ খোলা', open_notepad: 'নোটপ্যাড খোলা', open_calculator: 'ক্যালকুলেটর খোলা', mouse_click: 'মাউস ক্লিক', mouse_move: 'মাউস সরানো', mouse_click_primary: 'স্ক্রিনে ক্লিক', keyboard_type: 'নোটপ্যাডে লেখা', keyboard_type_app: 'অ্যাপে লেখা', whatsapp_draft: 'হোয়াটসঅ্যাপ খসড়া খোলা' })[a.kind] || a.label;
        const coords = a.kind === 'mouse_click_primary' ? `${a.params?.x / 100}%, ${a.params?.y / 100}%` : `${a.params?.x}, ${a.params?.y}`;
        const target = a.params?.target || 'Notepad';
        const detail = a.kind.startsWith('mouse_') ? ` স্থানাঙ্ক ${coords}। ভুল ক্লিকে তথ্য মুছে যেতে পারে, স্ক্রিন দেখে নিশ্চিত হও।` : a.kind.startsWith('keyboard_') ? ` অ্যাপ ${target}। লেখাটি: ${String(a.params?.text || '').slice(0, 300)}।` : a.kind === 'whatsapp_draft' ? ` নম্বর ${a.params?.phone}। খসড়া ${String(a.params?.text || '').slice(0, 500)}। বার্তা নিজে পাঠাবে না।` : '';
        const englishDetail = a.kind.startsWith('mouse_') ? `Coordinates ${coords}. A wrong click can delete data; check the screen. ` : a.kind.startsWith('keyboard_') ? `Target ${target}. The text is ${String(a.params?.text || '').slice(0, 300)}. ` : a.kind === 'whatsapp_draft' ? `Number ${a.params?.phone}. Draft ${String(a.params?.text || '').slice(0, 500)}. The message will not be sent. ` : '';
        const prompt = S.state.settings.language === 'bn' ? `${label} করতে চাই।${detail} অনুমতি দিতে বলো, নোভা অনুমতি দিচ্ছি। বাতিল করতে বলো, নোভা বাতিল।` : `I prepared ${a.label}. ${englishDetail}Say Nova approve, or Nova cancel.`;
        const status = $('#voice-handsfree-status'); if (status) status.textContent = prompt;
        await speak(prompt, true);
      } else {
        // Voice speaks the summary, not source IDs, table dividers or URLs.
        await speak(autoOpened ? (S.state.settings.language === 'bn' ? 'অনুমতি দেওয়া অ্যাপ খোলার অনুরোধ পাঠিয়েছি।' : 'The permitted app request was sent to your PC.') : data.message.content, S.voiceSession.active, data.engine);
      }
      if (data.website) showWebsite(data.website);
      if (data.uiAction?.type === 'focus') startFocus(data.uiAction.minutes);

    } catch (err) { S.state.messages = S.state.messages.filter(m => m.id !== 'temp-user'); if (voiceCompanion && S.voiceSession.active && /Cannot reach NOVA/.test(err.message)) { stopVoiceConversation(); toast('NOVA disconnected; the voice microphone was stopped.', 'error'); } else toast(err.message, 'error'); if (input) input.value = text; }
    finally { S.busy = false; if (send) send.disabled = false; renderMessages(); renderShell(); renderOverviewDynamic(); if ($('#core-state-text')) $('#core-state-text').textContent = 'READY WHEN YOU ARE'; $('#chat-input')?.focus(); if (S.voiceSession.active) scheduleVoiceTurn(); }
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
  /* Live world monitor. All markers and headlines come from named sources;
     no sample events are displayed when feeds are unavailable. */
  function renderWorld() {
    $('#view').innerHTML = `${remoteBanner()}<div class="world-command">
      <header class="wm-header"><div><div class="wm-brandline"><span class="wm-brand-icon">✳</span><span>NOVA / WORLD INTELLIGENCE</span><i></i><span>MONITOR 01</span></div><h1>World <em>monitor.</em></h1><p>এক নজরে পৃথিবী · A connected view of our changing world</p></div><div class="wm-header-right"><span class="wm-clock" id="world-clock">--:--:-- UTC</span><button class="wm-refresh" id="world-refresh">${icon('refresh')} Refresh data</button></div></header>
      <div class="wm-summary"><div><small>SEISMIC ACTIVITY <span>↗</span></small><strong id="wm-quake-count">—</strong><p>USGS · LATEST 40 / 24H</p></div><div><small>NHC CYCLONES <span>↗</span></small><strong id="wm-storm-count">—</strong><p>NHC · SELECT BASINS</p></div><div><small>RAIN LOCATIONS <span>↗</span></small><strong id="wm-rain-count">—</strong><p>MODEL · 10 CITIES</p></div><div><small>AIR TRAFFIC <span>↗</span></small><strong id="wm-flight-count">—</strong><p id="wm-flight-summary">TURN ON TO LOAD</p></div></div>
      <div class="wm-grid"><aside class="wm-left">
        <section class="wm-panel wm-weather"><div class="wm-panel-head"><div><span class="wm-kicker">01 / ATMOSPHERE</span><h2>Weather watch</h2></div><span class="wm-head-icon">☼</span></div><p class="wm-hint"><a href="https://open-meteo.com/" target="_blank" rel="noopener noreferrer">Open-Meteo</a> · selected cities · model estimates, not radar</p><div id="wm-weather-list" class="wm-scroll"><p class="world-empty">Loading weather…</p></div><div class="wm-panel-foot" id="wm-weather-time">Waiting for source</div></section>
        <section class="wm-panel wm-seismic"><div class="wm-panel-head"><div><span class="wm-kicker">02 / EARTH SYSTEMS</span><h2>Seismic activity</h2></div><span class="wm-head-icon seismic">⌁</span></div><p class="wm-hint">USGS M2.5+ · latest 40 / 24 hours</p><div id="world-quakes" class="world-list wm-scroll"><p class="world-empty">Loading earthquakes…</p></div></section>
      </aside><section class="wm-globe-panel"><div class="wm-globe-head"><div><span class="wm-kicker"><i class="wm-live-dot"></i> GLOBAL OBSERVATION</span><h2>Planetary overview</h2></div><div class="world-modes"><button class="chip active" data-world-mode="globe" aria-pressed="true">3D GLOBE</button><button class="chip" data-world-mode="map" aria-pressed="false">2D MAP</button></div></div>
        <div class="world-viewport wm-viewport"><div class="wm-corner-label left"><span>LIVE DATA / SNAPSHOTS</span><strong>EARTH · 01</strong></div><div class="wm-corner-label right"><span>COORDINATE SYSTEM</span><strong>WGS 84</strong></div><canvas id="world-canvas" tabindex="0" aria-label="Interactive world globe. Use left and right arrow keys to rotate; choose events from the lists for details."></canvas><div class="wm-cross wm-cross-a"></div><div class="wm-cross wm-cross-b"></div><div class="wm-globe-bottom"><span>DRAG TO ROTATE</span><span>VISUALIZATION / 3D</span></div></div>
        <div class="wm-legend"><span><i class="legend-quake"></i> EARTHQUAKE</span><span><i class="legend-storm"></i> CYCLONE REPORT</span><span><i class="legend-weather"></i> CITY WEATHER</span><span><i class="legend-flight"></i> AIRCRAFT</span></div><div id="world-selected" class="world-selection">Select a marker or an item in the lists for source details.</div><div class="wm-data-status" id="world-time">Checking sources…</div>
      </section><aside class="wm-right">
        <section class="wm-panel wm-flights"><div class="wm-panel-head"><div><span class="wm-kicker">03 / AIRSPACE</span><h2>Flight tracker</h2></div><span class="wm-head-icon flight">✈</span></div><p class="wm-hint">ADS-B snapshots · 250 nautical miles around one region · select a flight to follow snapshots · incomplete coverage. The selected region is sent to adsb.lol; device location is not used.</p><div class="wm-flight-controls"><label class="sr-only" for="wm-region">Flight region</label><select id="wm-region"><option value="dhaka">Dhaka</option><option value="dubai">Dubai</option><option value="singapore">Singapore</option><option value="london">London</option><option value="newyork">New York</option></select><button class="wm-toggle" id="wm-flight-toggle" aria-pressed="false">TURN ON</button></div><div id="wm-flight-status" class="wm-source-line">Tracking is off. Select a region and turn on.</div><button class="wm-untrack" id="wm-flight-untrack" hidden>Stop following selected flight</button><div id="wm-flight-list" class="wm-scroll"></div><div class="wm-panel-foot">© <a href="https://www.adsb.lol/" target="_blank" rel="noopener noreferrer">adsb.lol contributors</a> · <a href="https://opendatacommons.org/licenses/odbl/1-0/" target="_blank" rel="noopener noreferrer">ODbL 1.0</a> · not for navigation</div></section>
        <section class="wm-panel wm-storms"><div class="wm-panel-head"><div><span class="wm-kicker">04 / TROPICAL SYSTEMS</span><h2>Storm watch</h2></div><span class="wm-head-icon storm">◉</span></div><p class="wm-hint">NHC advisories: Atlantic, eastern & central Pacific only; not Bangladesh or worldwide.</p><div id="wm-storm-list" class="wm-scroll"><p class="world-empty">Checking advisories…</p></div><div class="wm-panel-foot" id="wm-storm-time">Waiting for source</div></section>
        <section class="wm-panel wm-storms"><div class="wm-panel-head"><div><span class="wm-kicker">05 / GLOBAL ALERTS</span><h2>Cyclone reports</h2></div><span class="wm-head-icon storm">◉</span></div><p class="wm-hint">GDACS global reports · last 7 days. Points are reported event centroids, not live storm tracks.</p><div id="wm-cyclone-list" class="wm-scroll"><p class="world-empty">Checking reports…</p></div><div class="wm-panel-foot" id="wm-cyclone-time"><a href="https://www.gdacs.org/" target="_blank" rel="noopener noreferrer">GDACS / European Union</a> · <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener noreferrer">CC BY 4.0</a> · <span id="wm-cyclone-checked">WAITING FOR SOURCE</span></div></section>
        <section class="wm-panel wm-network"><div class="wm-panel-head"><div><span class="wm-kicker">06 / SOURCE NETWORK</span><h2>News intelligence</h2></div><span class="wm-head-icon">⌁</span></div><p class="wm-hint">Publisher reports and images, independently sourced.</p><div id="news-source-status" class="news-source-status" role="status">Checking sources…</div></section>
      </aside></div>
      <section class="card news-feed"><div class="news-feed-heading"><div><span class="world-eyebrow">THE WORLD, IN FOCUS</span><h2>Latest headlines</h2><p>Stories and images from named public feeds</p></div><span class="news-feed-label">BBC WORLD / THE GUARDIAN</span></div><div id="world-news" class="news-grid"><p class="world-empty">Loading news…</p></div></section>
      <section class="card news-feed"><div class="news-feed-heading"><div><span class="world-eyebrow">BANGLADESH</span><h2>বাংলাদেশের খবর</h2><p>National, regional, politics and economy headlines.</p></div><span class="news-feed-label">JAGO NEWS 24</span></div><div id="bangladesh-news" class="news-grid"><p class="world-empty">Loading Bangladesh news…</p></div></section>
      <p class="world-disclaimer">Not an emergency, aviation or navigation service. Sources can be delayed, incomplete or unavailable. Weather is a model estimate at selected cities, not live rainfall radar. NHC covers only its basins; GDACS provides limited worldwide cyclone reports, not an all-clear. Aircraft positions are snapshots, not routes; coverage and updates vary. Use local official weather and emergency authorities for safety. Globe stars/orbits are decoration. Map outlines: Natural Earth / world-atlas.</p></div>`;
    const canvas = $('#world-canvas'), frame = $('#view');
    let quakes = [], weather = [], storms = [], cyclones = [], flights = [], flightEnabled = false, flightVersion = 0, trackedFlightId = null, flightTimer = null, destroyed = false;
    const present = () => !destroyed && frame.contains(canvas);
    const stamp = value => Number.isFinite(value) ? new Date(value).toLocaleString() : 'Time unavailable';
    const weatherName = code => code >= 95 ? 'Thunderstorm' : code >= 80 && code <= 86 ? 'Showers' : code >= 71 && code <= 77 ? 'Snow' : code >= 51 && code <= 67 ? 'Rain / drizzle' : code >= 45 && code <= 48 ? 'Fog' : code >= 1 && code <= 3 ? 'Clouds' : code === 0 ? 'Clear' : 'Conditions';
    function selectEvent(event) {
      if (!present()) return;
      if (!event) { $('#world-selected').textContent = 'Coastline map is unavailable; check the local files.'; return; }
      const kind = event.kind || 'quake'; let html = '';
      trackedFlightId = kind === 'flight' ? event.id : null; $('#wm-flight-untrack').hidden = !trackedFlightId;
      $$('#wm-flight-list [data-flight-id]').forEach(b => { const selected = b.dataset.flightId === trackedFlightId; b.classList.toggle('wm-selected', selected); b.setAttribute('aria-pressed', String(selected)); });
      if (kind === 'quake') html = `<strong>M ${esc(event.magnitude)} · ${esc(event.place)}</strong><span>${esc(stamp(event.time))} ${event.url ? `· <a href="${esc(event.url)}" target="_blank" rel="noopener noreferrer">USGS details ↗</a>` : ''}</span>`;
      if (kind === 'weather') html = `<strong>${esc(event.name)} · ${esc(weatherName(event.code))}</strong><span>Open-Meteo model · ${esc(event.temperature)}°C · ${esc(event.precipitation)} mm · ${esc(event.wind)} km/h wind · ${esc(stamp(event.time))}</span>`;
      if (kind === 'storm') html = `<strong>${esc(event.name)} · ${esc(event.classification || 'Cyclone')}</strong><span>NHC advisory · ${event.wind == null ? 'Wind unavailable' : esc(event.wind) + ' kt wind'} · ${esc(stamp(event.time))} ${event.url ? `· <a href="${esc(event.url)}" target="_blank" rel="noopener noreferrer">Official advisory ↗</a>` : ''}</span>`;
      if (kind === 'cyclone') html = `<strong>${esc(event.name)} · GDACS report</strong><span>${esc(event.country || 'Location unspecified')} · ${esc(event.severity || 'Severity unavailable')} · reported centroid · updated ${esc(stamp(event.time))} ${event.url ? `· <a href="${esc(event.url)}" target="_blank" rel="noopener noreferrer">GDACS report ↗</a>` : ''}</span>`;
      if (kind === 'flight') html = `<strong>${esc(event.callsign)} · ${esc(event.id)}</strong><span>adsb.lol snapshot · ${event.altitude == null ? 'Altitude unavailable' : esc(event.altitude) + ' ft'} · ${event.speed == null ? 'Speed unavailable' : esc(event.speed) + ' kt'} · position ${esc(stamp(event.time))}</span>`;
      $('#world-selected').innerHTML = html;
    }
    const visual = window.NovaWorld.create(canvas, selectEvent); S.orb = visual;
    const updatePoints = () => visual.setPoints([...quakes.map(x => ({ ...x, kind: 'quake' })), ...weather.map(x => ({ ...x, kind: 'weather' })), ...storms.map(x => ({ ...x, kind: 'storm' })), ...cyclones.map(x => ({ ...x, kind: 'cyclone' })), ...flights.map(x => ({ ...x, kind: 'flight' }))]);
    const focus = item => { visual.focus(item.lon); selectEvent(item); };
    $$('#view [data-world-mode]').forEach(btn => { btn.onclick = () => { visual.setMode(btn.dataset.worldMode); $$('#view [data-world-mode]').forEach(b => { b.classList.toggle('active', b === btn); b.setAttribute('aria-pressed', String(b === btn)); }); }; });
    function updateClock() { if (present()) $('#world-clock').textContent = new Date().toISOString().slice(11, 19) + ' UTC'; } updateClock();
    async function load(force = false) {
      const button = $('#world-refresh'); if (!button || !present()) return; button.disabled = true;
      try {
        const data = await api(force ? '/world?refresh=1' : '/world'); if (!present()) return;
        quakes = data.quakes.ok ? data.quakes.items : []; updatePoints();
        $('#wm-quake-count').textContent = data.quakes.ok ? String(quakes.length).padStart(2, '0') : '—';
        $('#world-time').textContent = `News & USGS checked ${stamp(data.fetchedAt)} · cache up to 5 min`;
        $('#world-quakes').innerHTML = data.quakes.ok ? (quakes.length ? quakes.map((q, i) => `<button class="world-event" data-quake-index="${i}"><span class="quake-mag">${esc(q.magnitude.toFixed(1))}</span><span><strong>${esc(q.place)}</strong><small>${esc(stamp(q.time))}</small></span></button>`).join('') : '<p class="world-empty">No qualifying earthquakes in this feed.</p>') : `<p class="world-empty warning">${esc(data.quakes.error)}</p>`;
        $$('#world-quakes .world-event').forEach(btn => { btn.onclick = () => { const q = quakes[Number(btn.dataset.quakeIndex)]; if (q) focus({ ...q, kind: 'quake' }); }; });
        const statuses = data.news.sources || [];
        $('#news-source-status').innerHTML = statuses.length ? statuses.map(source => `<span class="news-source ${source.ok ? 'available' : 'unavailable'}"><i></i>${esc(source.name)} · ${source.ok ? 'Available' : 'Unavailable'}</span>`).join('') : '';
        $('#world-news').innerHTML = data.news.ok ? (data.news.items.length ? data.news.items.map(n => `<a class="world-headline news-card" href="${esc(n.url)}" target="_blank" rel="noopener noreferrer"><div class="news-image"><span class="news-image-fallback" aria-hidden="true">${icon('globe')}<small>IMAGE UNAVAILABLE</small></span>${n.image ? `<img src="${esc(n.image)}" alt="" loading="lazy" referrerpolicy="no-referrer">` : ''}</div><div class="news-copy"><span class="news-publisher">${esc(n.source || 'BBC World')}</span><strong>${esc(n.title)}</strong><small>${n.time ? esc(stamp(n.time)) : 'Publication time unavailable'} <span>READ STORY ↗</span></small></div></a>`).join('') : '<p class="world-empty">No headlines returned by the available feeds. Try Refresh.</p>') : `<p class="world-empty warning">${esc(data.news.error || 'News sources unavailable. Check internet and try Refresh.')}</p>`;
        $$('#world-news img').forEach(img => img.addEventListener('error', () => img.remove()));
        const bd = data.bangladesh;
        $('#bangladesh-news').innerHTML = bd?.ok ? (bd.items.length ? bd.items.map(n => `<a class="world-headline news-card" href="${esc(n.url)}" target="_blank" rel="noopener noreferrer"><div class="news-copy"><span class="news-publisher">${esc(n.source)}</span><strong>${esc(n.title)}</strong><small>${n.time ? esc(stamp(n.time)) : 'Publication time unavailable'} <span>READ STORY ↗</span></small></div></a>`).join('') : '<p class="world-empty">No Bangladesh headlines returned.</p>') : `<p class="world-empty warning">${esc(bd?.error || 'Bangladesh news feed unavailable. Try Refresh.')}</p>`;
      } catch (err) { if (present()) { quakes = []; updatePoints(); $('#wm-quake-count').textContent = '—'; $('#world-time').textContent = 'News / USGS unavailable'; $('#world-quakes').textContent = err.message; $('#world-news').textContent = err.message; $('#news-source-status').textContent = 'News status unavailable.'; $('#bangladesh-news').textContent = err.message; } }
      finally { if (button.isConnected) button.disabled = false; }
    }
    async function loadSignals() {
      try {
        const data = await api('/world/signals'); if (!present()) return;
        weather = data.weather.ok ? data.weather.items : []; storms = data.storms.ok ? data.storms.items : []; cyclones = data.cyclones?.ok ? data.cyclones.items : []; updatePoints();
        $('#wm-rain-count').textContent = data.weather.ok ? String(weather.filter(w => w.precipitation > 0).length).padStart(2,'0') : '—';
        $('#wm-storm-count').textContent = data.storms.ok ? String(storms.length).padStart(2,'0') : '—';
        $('#wm-weather-list').innerHTML = data.weather.ok ? (weather.length ? weather.map((w,i) => `<button class="wm-item" data-weather="${i}"><span class="wm-weather-icon">${w.precipitation > 0 ? '◉' : w.code >= 95 ? 'ϟ' : '◌'}</span><span><strong>${esc(w.name)}</strong><small>${esc(weatherName(w.code))} · ${esc(w.precipitation)} mm / interval</small></span><b>${esc(Math.round(w.temperature))}°</b></button>`).join('') : '<p class="world-empty">No city weather returned.</p>') : `<p class="world-empty warning">${esc(data.weather.error)}</p>`;
        $$('#wm-weather-list [data-weather]').forEach(b => b.onclick = () => focus({ ...weather[Number(b.dataset.weather)], kind:'weather' }));
        $('#wm-storm-list').innerHTML = data.storms.ok ? (storms.length ? storms.map((s,i) => `<button class="wm-item" data-storm="${i}"><span class="wm-storm-icon">◉</span><span><strong>${esc(s.name)}</strong><small>${esc(s.classification)} · ${esc(stamp(s.time))}</small></span><b>${s.wind == null ? '—' : esc(s.wind) + ' kt'}</b></button>`).join('') : '<p class="world-empty">No active NHC advisories in its covered basins.</p>') : `<p class="world-empty warning">${esc(data.storms.error)}</p>`;
        $$('#wm-storm-list [data-storm]').forEach(b => b.onclick = () => focus({ ...storms[Number(b.dataset.storm)], kind:'storm' }));
        $('#wm-cyclone-list').innerHTML = data.cyclones?.ok ? (cyclones.length ? cyclones.map((c,i) => `<button class="wm-item" data-cyclone="${i}"><span class="wm-storm-icon">◉</span><span><strong>${esc(c.name)}</strong><small>${esc(c.country || 'Location unspecified')} · ${esc(stamp(c.time))}</small></span><b>${esc(c.alert)}</b></button>`).join('') : '<p class="world-empty">No recent cyclone reports returned; absence is not an all-clear.</p>') : `<p class="world-empty warning">${esc(data.cyclones?.error || 'GDACS source unavailable.')}</p>`;
        $$('#wm-cyclone-list [data-cyclone]').forEach(b => b.onclick = () => focus({ ...cyclones[Number(b.dataset.cyclone)], kind:'cyclone' }));
        $('#wm-weather-time').textContent = `OPEN-METEO · CHECKED ${stamp(data.fetchedAt)} · 15 MIN CACHE`;
        $('#wm-storm-time').textContent = `NOAA NHC · CHECKED ${stamp(data.fetchedAt)} · 15 MIN CACHE`;
        $('#wm-cyclone-checked').textContent = `CHECKED ${stamp(data.fetchedAt)} · 15 MIN CACHE`;
      } catch { if (present()) { weather = []; storms = []; cyclones = []; updatePoints(); $('#wm-rain-count').textContent = '—'; $('#wm-storm-count').textContent = '—'; $('#wm-weather-list').textContent = 'Weather source unavailable.'; $('#wm-storm-list').textContent = 'Storm source unavailable.'; $('#wm-cyclone-list').textContent = 'GDACS source unavailable.'; } }
    }
    async function loadFlights() {
      if (!flightEnabled || !present()) return;
      const version = ++flightVersion, region = $('#wm-region').value;
      flights = []; updatePoints(); $('#wm-flight-count').textContent = '—'; $('#wm-flight-summary').textContent = 'LOADING SNAPSHOT'; $('#wm-flight-list').innerHTML = ''; $('#wm-flight-status').textContent = 'Loading ADS-B snapshot…';
      try {
        const data = await api('/world/flights?region=' + encodeURIComponent(region)); if (!present() || !flightEnabled || version !== flightVersion) return;
        flights = data.ok ? data.items : []; updatePoints();
        $('#wm-flight-count').textContent = data.ok ? String(flights.length).padStart(2,'0') : '—'; $('#wm-flight-summary').textContent = data.ok ? 'SHOWN · MAX 100 / REGION' : 'SOURCE UNAVAILABLE';
        $('#wm-flight-status').textContent = data.ok ? `${data.region} · ${data.radiusNm} nm · checked ${stamp(data.fetchedAt)} · 5 min cache` : data.error;
        $('#wm-flight-list').innerHTML = data.ok ? (flights.length ? flights.map((f,i) => `<button class="wm-item ${f.id === trackedFlightId ? 'wm-selected' : ''}" data-flight="${i}" data-flight-id="${esc(f.id)}" aria-pressed="${f.id === trackedFlightId}"><span class="wm-plane-icon">✈</span><span><strong>${esc(f.callsign)}</strong><small>${esc(f.id)} · ${esc(stamp(f.time))}</small></span><b>${f.altitude == null ? '—' : esc(Math.round(f.altitude / 1000)) + 'k ft'}</b></button>`).join('') : '<p class="world-empty">No reported aircraft in this snapshot. Coverage may be incomplete.</p>') : `<p class="world-empty warning">${esc(data.error)}</p>`;
        $$('#wm-flight-list [data-flight]').forEach(b => b.onclick = () => focus({ ...flights[Number(b.dataset.flight)], kind:'flight' }));
        if (trackedFlightId) { const tracked = flights.find(f => f.id === trackedFlightId); if (tracked) selectEvent({ ...tracked, kind:'flight' }); else $('#world-selected').textContent = data.ok ? `Selected flight ${trackedFlightId} is not in this snapshot. Coverage is incomplete.` : 'Selected flight unavailable because the source failed.'; }
      } catch { if (present() && flightEnabled && version === flightVersion) { flights = []; updatePoints(); $('#wm-flight-summary').textContent = 'SOURCE UNAVAILABLE'; $('#wm-flight-status').textContent = 'Flight source unavailable.'; } }
    }
    $('#wm-flight-toggle').onclick = e => { flightEnabled = !flightEnabled; e.currentTarget.setAttribute('aria-pressed', String(flightEnabled)); e.currentTarget.textContent = flightEnabled ? 'TURN OFF' : 'TURN ON'; if (flightEnabled) { loadFlights(); clearInterval(flightTimer); flightTimer = setInterval(loadFlights, 5 * 60000); } else { clearInterval(flightTimer); flightTimer = null; flightVersion++; trackedFlightId = null; $('#wm-flight-untrack').hidden = true; flights = []; updatePoints(); $('#wm-flight-count').textContent = '—'; $('#wm-flight-summary').textContent = 'TRACKING OFF'; $('#wm-flight-status').textContent = 'Tracking is off.'; $('#wm-flight-list').innerHTML = ''; $('#world-selected').textContent = 'Flight tracker is off. Select another marker or item for details.'; } };
    $('#wm-region').onchange = () => { trackedFlightId = null; $('#wm-flight-untrack').hidden = true; $('#world-selected').textContent = 'Select a marker or an item in the lists for source details.'; if (flightEnabled) { loadFlights(); clearInterval(flightTimer); flightTimer = setInterval(loadFlights, 5 * 60000); } };
    $('#wm-flight-untrack').onclick = () => { trackedFlightId = null; $('#wm-flight-untrack').hidden = true; $$('#wm-flight-list [data-flight-id]').forEach(b => { b.classList.remove('wm-selected'); b.setAttribute('aria-pressed', 'false'); }); $('#world-selected').textContent = 'Flight following stopped. Aircraft snapshots remain on until you turn tracking off.'; };
    $('#world-refresh').onclick = () => { load(true); loadSignals(); if (flightEnabled) loadFlights(); };
    load(); loadSignals(); const timer = setInterval(() => { load(); loadSignals(); }, 5 * 60000); const clock = setInterval(updateClock, 1000); const destroy = visual.destroy;
    visual.destroy = () => { destroyed = true; flightVersion++; clearInterval(timer); clearInterval(clock); clearInterval(flightTimer); destroy(); };
  }

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
    $('#view').innerHTML = `${remoteBanner()}${heading('Your PC. Still in your hands.', 'A permission-first bridge between NOVA and your Windows desktop.', `<button class="btn btn-ghost" data-action="help">${icon('shield')}Safety first</button>`)}<div class="info-banner">${icon('shield')}<div><strong>Nothing runs without your approval.</strong><p>Only the allowlisted actions below are supported. No arbitrary shell commands or automatic message sending. Optional screen sharing requires your browser permission. Mouse clicks can trigger actions, including deletion, so check the screen before approval. The preview server cannot control your PC by itself.</p></div></div><div class="desktop-layout"><div class="stack"><section class="card"><div class="bridge-hero"><span class="bridge-hero-icon">${icon('monitor')}</span><div><h2>Windows desktop bridge</h2><p id="desktop-bridge-description">Connect the agent on the PC you want to control.</p><span class="pill" id="desktop-bridge-pill">Not connected</span></div></div>${isOwner() ? `<div class="bridge-easy"><div><span class="bridge-easy-tag">SIMPLE SETUP · WINDOWS</span><h3>Connect this PC in one step.</h3><p>No downloads, token copying, or extra terminal. Keeps running if this browser tab closes. Reconnects when NOVA starts again until you disconnect.</p></div><button type="button" class="btn btn-primary" data-action="local-bridge" id="local-bridge-button">${icon('monitor')}Connect this PC</button><button type="button" class="btn btn-ghost" data-action="local-bridge-disable" id="local-bridge-disable" hidden>Turn off auto-reconnect</button><p id="local-bridge-status" role="status" aria-live="polite"></p></div>` : ''}<div class="setup-steps"><div class="manual-bridge-label">MANUAL SETUP · OPTIONAL</div><div class="setup-step"><span class="step-number">1</span><div><strong>Download the bridge agent</strong><p>Windows 10/11 with Node.js 20+ installed. This is a Node.js script; do not double-click the .js file.</p><a class="btn btn-sm btn-ghost" href="/api/nova/bridge/agent" download style="margin-top:9px">${icon('download')}Download nova-agent.js</a></div></div><div class="setup-step"><span class="step-number">2</span><div><strong>Generate a private bridge token</strong><p>Shown once. Save it as <span class="mono">nova-bridge.token</span> next to the agent. Never share it.</p>${isOwner() ? `<button class="btn btn-sm btn-ghost" data-action="bridge-token" style="margin-top:9px">${icon('lock')}Generate token</button>` : '<p>Ask the workspace owner to connect the desktop.</p>'}</div></div><div class="setup-step"><span class="step-number">3</span><div><strong>Run the agent on your Windows PC</strong><p>Keep this terminal open while you want desktop control. Ctrl+C disconnects it.</p><div class="code-block">${esc(command)}<button class="icon-button" data-copy="${esc(command)}" aria-label="Copy agent command">${icon('copy')}</button></div></div></div></div></section>${isOwner() ? `<section class="card card-body"><h3>Windows power · experimental</h3><p class="muted" style="margin:8px 0">Local owner only. Review, confirm and keep this page active during a cancellable countdown. Unsaved work can be lost.</p><button class="btn btn-ghost" data-action="native-power">${icon('settings')}Windows power options</button></section><section class="card card-body"><h3>Windows native screen · experimental</h3><p class="muted" style="margin:8px 0">No browser screen picker. Separate permission for on-demand primary-screen images sent to your vision provider; no desktop control. Windows hardware has not been tested.</p><button class="btn btn-primary" data-action="native-screen">${icon('monitor')}Native screen permission &amp; view</button></section><section class="card card-body"><h3>Screen viewer</h3><p class="muted" style="margin:8px 0">Choose what to share, then optionally send one frame to a vision model. Use reviewed click suggestions, or explicitly start a limited visual work session.</p><button class="btn btn-ghost" data-action="screen-viewer">${icon('monitor')}Share screen</button> <button class="btn btn-primary" data-action="auto-work">${icon('sparkle')}Visual work session</button></section>` : ''}<div class="section-heading" style="margin-top:4px"><h2>Approved capabilities</h2><span>ALLOWLIST ONLY</span></div><div class="action-catalog">${Object.entries(S.state.catalog).filter(([k]) => k !== 'whatsapp_draft' && !k.startsWith('keyboard_') && !k.startsWith('mouse_')).map(([kind, item]) => `<button class="catalog-item" data-quick="${kind}"><span class="quick-icon">${icon(item.icon)}</span><span><strong>${esc(item.label)}</strong><small>${esc(item.group)} · approval required</small></span></button>`).join('')}</div><section class="card card-body"><h3 style="font-size:13px">Mouse control</h3><p class="muted" style="font-size:10px;margin:5px 0 15px">Mouse actions do not use the screen viewer. Check coordinates carefully: a click can delete files or trigger other actions. Each action needs owner approval.</p>${isOwner() ? `<form id="mouse-form"><div class="form-grid"><div class="field"><label for="mouse-x">X coordinate</label><input id="mouse-x" type="number" min="-32768" max="32767" step="1" required placeholder="e.g. 500"></div><div class="field"><label for="mouse-y">Y coordinate</label><input id="mouse-y" type="number" min="-32768" max="32767" step="1" required placeholder="e.g. 300"></div></div><div class="settings-actions"><button class="btn btn-ghost" type="submit" name="mouse-kind" value="mouse_move">Review move</button><button class="btn btn-ghost" type="submit" name="mouse-kind" value="mouse_click">Review left click</button></div></form>` : '<p>Mouse control is available to the workspace owner only.</p>'}</section><section class="card card-body"><h3 style="font-size:13px">Keyboard: type in a supported app</h3><p class="muted" style="font-size:10px;margin:5px 0 15px">Text is stored in action history and visible to paired devices. Never enter passwords or keys. After approval, focus the selected app and correct text field within 5 seconds. Shortcuts and Enter are not supported.</p>${isOwner() ? `<form id="keyboard-form"><div class="field"><label for="keyboard-target">Target app</label><select id="keyboard-target"><option value="notepad">Notepad</option><option value="chrome">Google Chrome</option><option value="msedge">Microsoft Edge</option><option value="firefox">Firefox</option><option value="code">Visual Studio Code</option><option value="winword">Microsoft Word</option><option value="excel">Microsoft Excel</option><option value="powerpnt">Microsoft PowerPoint</option></select></div><div class="field"><label for="keyboard-text">Text to type (single line)</label><input id="keyboard-text" maxlength="300" required placeholder="Hello from NOVA"></div><div class="settings-actions"><button class="btn btn-ghost" type="submit">Review typing</button></div></form>` : '<p>Keyboard control is available to the workspace owner only.</p>'}</section><section class="card card-body"><h3 style="font-size:13px">Prepare a WhatsApp draft</h3><p class="muted" style="font-size:10px;margin:5px 0 15px">Opens a draft on your PC. NOVA never presses Send.</p><form id="whatsapp-form"><div class="form-grid"><div class="field"><label for="wa-phone">Phone with country code</label><input id="wa-phone" placeholder="+8801XXXXXXXXX" required maxlength="20"></div><div class="field"><label for="wa-text">Draft message</label><input id="wa-text" placeholder="Hey, are you free?" required maxlength="500"></div></div><div class="settings-actions"><button class="btn btn-ghost" type="submit">${icon('message')}Review draft action</button></div></form></section></div><div class="stack"><section class="card"><div class="card-header"><h3>${icon('cpu')}Connected system</h3></div><div class="system-details" id="system-details"></div></section><section class="card card-body"><h3 style="font-size:14px">Built to respect boundaries.</h3><ul class="safety-list"><li>${icon('check')}Manual actions are reviewed; visual work can run ordinary steps under its session approval.</li><li>${icon('check')}Approvals expire after 2 minutes.</li><li>${icon('check')}One action at a time on your PC.</li><li>${icon('check')}Tokens can be replaced anytime.</li><li>${icon('check')}No direct delete command; clicks may trigger deletion.</li><li>${icon('check')}WhatsApp messages are never auto-sent.</li></ul></section><section class="card card-body"><h3 style="font-size:13px">Testing without a PC?</h3><p class="muted" style="font-size:10px;margin-top:6px">Run the agent with <span class="mono">--dry-run</span>. It exercises the approval flow but never executes a desktop action.</p></section></div></div>`;
    if ($('#mouse-form')) $('#mouse-form').onsubmit = e => { e.preventDefault(); const kind = e.submitter?.value || 'mouse_move'; prepareAction(kind, { x: Number($('#mouse-x').value), y: Number($('#mouse-y').value) }); };
    if ($('#keyboard-form')) $('#keyboard-form').onsubmit = e => { e.preventDefault(); const target = $('#keyboard-target').value, text = $('#keyboard-text').value; prepareAction(target === 'notepad' ? 'keyboard_type' : 'keyboard_type_app', target === 'notepad' ? { text } : { target, text }); };
    $('#whatsapp-form').onsubmit = e => { e.preventDefault(); prepareAction('whatsapp_draft', { phone: $('#wa-phone').value, text: $('#wa-text').value }); };
    renderDesktopStatus();
  }
  function renderDesktopStatus() {
    if (!$('#system-details')) return;
    const b = S.state.bridge; const sys = b.system || {};
    $('#desktop-bridge-pill').textContent = b.online ? 'Connected' : b.configured ? 'Waiting for agent' : 'Not connected';
    $('#desktop-bridge-pill').className = 'pill ' + (b.online ? 'pill-mint' : 'pill-amber');
    const localBtn = $('#local-bridge-button');
    if (localBtn && !localBtn.dataset.busy) {
      localBtn.disabled = !!b.online && !b.managed;
      localBtn.innerHTML = icon('monitor') + (b.managed ? 'Disconnect this PC' : b.online ? 'Bridge already connected' : b.autoReconnect ? 'Reconnect this PC' : 'Connect this PC');
      const disable = $('#local-bridge-disable'); if (disable) disable.hidden = !b.autoReconnect || !!b.managed;
    }
    $('#desktop-bridge-description').textContent = b.online ? `${sys.hostname || 'Your PC'} is connected and listening for approved actions.` : 'Connect the agent on the PC you want to control.';
    const rows = b.online ? [['Computer', sys.hostname], ['Operating system', sys.os], ['Architecture', sys.arch], ['Processor', sys.cpu], ['Logical cores', sys.cores], ['Memory', `${sys.freeMemoryGB} GB free / ${sys.memoryGB} GB`], ['Uptime', `${sys.uptimeHours} hours`], ['Agent version', sys.agentVersion]] : [['Status', 'No active connection'], ['Platform', 'Windows 10 / 11'], ['Execution', 'Local agent only']];
    $('#system-details').innerHTML = rows.map(([k, v]) => `<div class="system-row"><span>${esc(k)}</span><strong>${esc(v ?? '—')}</strong></div>`).join('');
  }
  async function prepareAction(kind, params = {}, snapshot = null) {
    try { const data = await api('/actions', { method: 'POST', body: { kind, params } }); S.state.actions.unshift(data.action); reviewAction(data.action.id, snapshot); if (S.view === 'activity') renderActivityList(); }
    catch (err) { toast(err.message, 'error'); }
  }
  function reviewAction(actionId, snapshot = null) {
    const a = S.state.actions.find(x => x.id === actionId); if (!a) return toast('This action is no longer available.', 'info');
    if (a.status === 'approved') return confirmDialog('Cancel queued action?', `${a.label} is waiting for the desktop agent. Cancel it before it starts?`, 'Cancel action', () => cancelAction(a.id));
    if (a.status !== 'pending') return modal(a.label, `<div class="approval-detail">${statusPill(a.status)}<p style="white-space:pre-wrap">${esc(a.result || 'This action has already been resolved.')}</p></div>`);
    const item = S.state.catalog[a.kind];
    let approvalRecognition = null;
    modal('A quick check before we act.', `<div class="modal-icon">${icon('shield')}</div><p>You’re about to approve this action on the connected Windows PC. It will not run automatically.</p><div class="approval-detail"><strong>${esc(a.label)}</strong><p>${esc(item.detail)}</p>${a.kind === 'whatsapp_draft' ? `<div class="draft-text"><strong>To: ${esc(a.params.phone)}</strong>${esc(a.params.text)}</div>` : ''}${a.kind.startsWith('mouse_') ? `<div class="draft-text"><strong>${a.kind === 'mouse_click_primary' ? `Primary screen point: ${esc(a.params.x / 100)}%, ${esc(a.params.y / 100)}%` : `Screen coordinates: X ${esc(a.params.x)}, Y ${esc(a.params.y)}`}</strong>${a.kind === 'mouse_move' ? 'This action does not use the screen viewer.' : 'A click may delete files or trigger other actions. Check the current screen and approve only if you intend the result.'}${a.kind === 'mouse_click_primary' ? ' This request expires in 30 seconds; the screen can change even sooner.' : ''}</div>${snapshot && a.kind === 'mouse_click_primary' ? `<div class="screen-snapshot"><img src="${esc(snapshot)}" alt="Screen at the time of AI suggestion"><span aria-hidden="true" style="left:${a.params.x / 100}%;top:${a.params.y / 100}%"></span></div>` : ''}` : ''}${a.kind.startsWith('keyboard_') ? `<div class="draft-text"><strong>Text to type:</strong>${esc(a.params.text)}<p>After approval, ${a.kind === 'keyboard_type' ? 'focus Notepad within 5 seconds.' : `focus ${esc(a.params.target)} and the intended text field within 5 seconds.`} Text is stored in activity history.</p></div>` : ''}</div>${online() ? `<div class="row" style="font-size:10px;color:var(--muted)">${icon('monitor')}Connected to ${esc(S.state.bridge.system.hostname || 'your PC')} · expires in ${a.kind === 'mouse_click_primary' ? '30 seconds' : '2 minutes'}</div>` : `<div class="info-banner warning" style="margin:14px 0 0">${icon('alert')}<div><strong>Desktop bridge is offline</strong><p>Connect the agent on your PC before approving. This request stays pending for ${a.kind === 'mouse_click_primary' ? '30 seconds' : '2 minutes'}.</p></div></div>`}<div class="modal-footer"><button class="btn btn-ghost" data-action-cancel="${a.id}">Cancel request</button>${online() ? `${isOwner() ? `<button class="btn btn-ghost" id="voice-approve">${icon('mic')}Approve by voice</button>` : ''}<button class="btn btn-primary" id="approve-action">${icon('check')}Approve & run</button>` : `<button class="btn btn-primary" id="go-connect">${icon('monitor')}Connect desktop</button>`}</div>${online() && isOwner() ? `<p id="voice-approval-status" class="muted" style="font-size:10px;margin-top:12px">Voice uses your browser’s speech service and does not verify who is speaking.</p>` : ''}`, { onClose: () => { if (approvalRecognition) { approvalRecognition.onresult = null; approvalRecognition.onerror = null; approvalRecognition.onend = null; try { approvalRecognition.abort(); } catch {} approvalRecognition = null; S.listening = false; } } });
    if ($('#voice-approve')) $('#voice-approve').onclick = () => {
      const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      const status = $('#voice-approval-status'), voiceBtn = $('#voice-approve'), approveBtn = $('#approve-action');
      if (!Recognition) { status.textContent = 'Voice recognition is unavailable. Use Approve & run instead.'; return; }
      if (approvalRecognition || S.listening) { status.textContent = 'Microphone is already in use.'; return; }
      if ('speechSynthesis' in window) speechSynthesis.cancel();
      const rec = new Recognition(); approvalRecognition = rec; S.listening = true;
      rec.lang = S.state.settings.language === 'en' ? 'en-US' : 'bn-BD'; rec.interimResults = false; rec.continuous = false;
      voiceBtn.disabled = true; status.textContent = rec.lang === 'bn-BD' ? 'Listening. Say “অনুমতি দিচ্ছি”. This does not verify your identity.' : 'Listening. Say “approve”. This does not verify your identity.';
      rec.onresult = e => {
        const result = e.results[e.results.length - 1];
        if (!result?.isFinal) return;
        const spoken = String(result[0]?.transcript || '').toLowerCase().trim().replace(/[.!?।]+$/g, '').trim();
        if (!approveBtn.isConnected || approvalRecognition !== rec) return;
        if (['approve', 'অনুমতি দিচ্ছি', 'অনুমতি দিলাম'].includes(spoken)) { approvalRecognition = null; approveBtn.click(); }
        else status.textContent = 'Approval not recognised; nothing was approved. Try again or use the button.';
        try { rec.stop(); } catch {}
      };
      rec.onerror = () => { if (status.isConnected) status.textContent = 'Voice recognition failed; nothing was approved. Try again or use the button.'; };
      rec.onend = () => { if (approvalRecognition === rec) approvalRecognition = null; S.listening = false; if (voiceBtn.isConnected) voiceBtn.disabled = false; };
      try { rec.start(); } catch { approvalRecognition = null; S.listening = false; voiceBtn.disabled = false; status.textContent = 'Could not start the microphone; nothing was approved.'; }
    };
    if ($('#approve-action')) $('#approve-action').onclick = async e => { e.target.disabled = true; try { const data = await api(`/actions/${a.id}/approve`, { method: 'POST', body: {} }); updateAction(data.action); closeModal(); toast('Approved. Your desktop agent will run it shortly.'); } catch (err) { toast(err.message, 'error'); e.target.disabled = false; } };
    if ($('#go-connect')) $('#go-connect').onclick = () => { closeModal(); navigate('desktop'); };
  }
  function updateAction(action) { S.state.actions = S.state.actions.map(a => a.id === action.id ? action : a); if (!S.state.actions.some(a => a.id === action.id)) S.state.actions.unshift(action); if (S.view === 'activity') renderActivityList(); renderMessages(); }
  async function cancelAction(actionId) { const data = await api(`/actions/${actionId}/cancel`, { method: 'POST', body: {} }); updateAction(data.action); toast('Action cancelled.'); }
  function localBridgeModal(forceDisable = false) {
    const managed = forceDisable || !!S.state.bridge.managed;
    const title = managed ? 'Disconnect this PC?' : 'Connect this Windows PC?';
    const description = managed
      ? 'This stops the one-click bridge, turns off automatic reconnection and cancels queued actions. An action already running may still finish.'
      : 'NOVA will start its local Windows bridge in the background. Normal desktop actions require review; an approved visual work session can run multiple ordinary steps. A previous bridge token will be replaced and queued actions cancelled; an action already running may still finish. The bridge stays connected when this browser tab closes and reconnects when NOVA starts, until you disconnect. It cannot run while NOVA or Windows is shut down.';
    confirmDialog(title, description, managed ? 'Disconnect' : 'Connect', async () => {
      const button = $('#local-bridge-button'), status = $('#local-bridge-status');
      if (button) { button.dataset.busy = '1'; button.disabled = true; }
      if (status) status.textContent = managed ? 'Disconnecting…' : 'Connecting this PC…';
      try {
        const result = await api('/local-bridge/' + (managed ? 'stop' : 'start'), { method: 'POST', body: { confirm: true } });
        if (!result.ok) throw new Error(result.error || 'Could not connect this PC.');
        await sync();
        if (status?.isConnected) status.textContent = managed ? 'Local bridge disconnected.' : result.alreadyConnected ? 'A bridge is already connected.' : 'Connected. Keep NOVA open.';
        toast(managed ? 'Local bridge disconnected.' : 'This PC is connected.');
      } catch (err) { if (status?.isConnected) status.textContent = err.message; toast(err.message, 'error'); }
      finally { if (button?.isConnected) { delete button.dataset.busy; renderDesktopStatus(); } }
    }, managed);
  }
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
    $('#view').innerHTML = `${remoteBanner()}${heading('Make it feel like you.', 'A companion that fits the way you think, speak and work.')}<div class="settings-layout"><div class="stack"><section class="card settings-card"><h2>Your companion</h2><p class="settings-sub">A familiar presence, with a personality you choose.</p><div class="persona-grid"><button class="persona-option ${s.persona === 'nova' ? 'selected' : ''}" data-persona="nova" ${!owner ? 'disabled' : ''}><span class="persona-orb"></span><span><strong>NOVA</strong><small>Warm · intuitive · bright</small></span>${s.persona === 'nova' ? icon('check-circle') : ''}</button><button class="persona-option ${s.persona === 'atlas' ? 'selected' : ''}" data-persona="atlas" ${!owner ? 'disabled' : ''}><span class="persona-orb atlas"></span><span><strong>ATLAS</strong><small>Calm · grounded · clear</small></span>${s.persona === 'atlas' ? icon('check-circle') : ''}</button><button class="persona-option ${s.persona === 'jarvis' ? 'selected' : ''}" data-persona="jarvis" ${!owner ? 'disabled' : ''}><span class="persona-orb atlas"></span><span><strong>JARVIS</strong><small>Polished · precise</small></span>${s.persona === 'jarvis' ? icon('check-circle') : ''}</button><button class="persona-option ${s.persona === 'mentor' ? 'selected' : ''}" data-persona="mentor" ${!owner ? 'disabled' : ''}><span class="persona-orb"></span><span><strong>Mentor</strong><small>Patient · encouraging</small></span>${s.persona === 'mentor' ? icon('check-circle') : ''}</button><button class="persona-option ${s.persona === 'custom' ? 'selected' : ''}" data-persona="custom" ${!owner ? 'disabled' : ''}><span class="persona-orb"></span><span><strong>Custom</strong><small>Your own character</small></span>${s.persona === 'custom' ? icon('check-circle') : ''}</button></div><form id="settings-form"><fieldset ${!owner ? 'disabled' : ''} style="border:0;padding:0;margin:0"><div class="form-grid"><div class="field"><label for="setting-name">What should I call you?</label><input id="setting-name" maxlength="40" value="${esc(s.userName)}" placeholder="Your name"></div><div class="field"><label for="setting-workspace">Workspace name</label><input id="setting-workspace" maxlength="50" required value="${esc(S.state.workspace.name)}"></div><div class="field"><label for="setting-language">Conversation language</label><select id="setting-language"><option value="auto" ${s.language === 'auto' ? 'selected' : ''}>Match my language</option><option value="en" ${s.language === 'en' ? 'selected' : ''}>English</option><option value="bn" ${s.language === 'bn' ? 'selected' : ''}>বাংলা</option></select></div><div class="field"><label for="setting-timezone">Timezone</label><select id="setting-timezone">${[...new Set([s.timezone, 'Asia/Dhaka', 'UTC', 'America/New_York', 'Europe/London', 'Asia/Kolkata', 'Asia/Singapore'])].map(tz => `<option value="${esc(tz)}" ${s.timezone === tz ? 'selected' : ''}>${esc(tz)}</option>`).join('')}</select></div></div><div class="divider"></div><div class="form-grid"><div class="field"><label for="character-name">Custom character name</label><input id="character-name" maxlength="40" required value="${esc(s.customCharacterName || 'MY ASSISTANT')}"></div><div class="field"><label for="character-style">Custom behaviour</label><textarea id="character-style" maxlength="500" rows="2" placeholder="e.g. patient, upbeat and concise">${esc(s.customInstructions || '')}</textarea></div></div><p class="muted" style="font-size:10px;margin-top:8px">Used when Custom is selected. These preferences are sent to your connected AI provider and cannot override safety rules.</p><div class="divider"></div><div class="setting-row"><div><strong>Spoken replies</strong><p>Read responses aloud using your browser’s available voices.</p></div><label class="toggle"><input type="checkbox" id="setting-voice" ${s.voiceEnabled ? 'checked' : ''} aria-label="Spoken replies"><span></span></label></div><div class="form-grid" style="margin-top:16px"><div class="field"><label for="setting-gender">Voice preference</label><select id="setting-gender"><option value="feminine" ${s.voiceGender === 'feminine' ? 'selected' : ''}>Feminine</option><option value="masculine" ${s.voiceGender === 'masculine' ? 'selected' : ''}>Masculine</option><option value="auto" ${s.voiceGender === 'auto' ? 'selected' : ''}>System default</option></select><small>Actual voices depend on your browser and OS.</small></div><div class="field"><label for="setting-rate">Speaking pace <span id="rate-value">${s.speechRate}×</span></label><input type="range" id="setting-rate" min="0.7" max="1.3" step="0.1" value="${s.speechRate}" style="padding:12px 0"></div><div class="field full"><label for="setting-voice-uri">Installed voice</label><select id="setting-voice-uri"><option value="">Choose automatically</option></select></div></div><div class="settings-actions"><button type="button" class="btn btn-ghost" id="test-voice" style="margin-right:auto">${icon('volume')}Test voice</button><button type="submit" class="btn btn-primary">${icon('check')}Save preferences</button></div></fieldset></form></section><section class="card settings-card"><h2>Intelligence</h2><p class="settings-sub">Local commands work out of the box. Open-ended AI is optional.</p><div class="provider-status">${icon('cpu')}<div><strong>${S.state.ai.configured ? (S.state.ai.provider === 'groq' ? 'Groq connected' : 'AI provider connected') : 'Local command mode'}</strong><p>${S.state.ai.configured ? `Model: ${esc(S.state.ai.model)}. ${S.state.ai.source === 'workspace' ? 'Your key is encrypted in this workspace.' : 'Using the server environment key.'} Open-ended replies are sent to ${S.state.ai.provider === 'groq' ? 'Groq' : 'the configured provider'}; local commands stay deterministic.` : 'Memory, calculations, time, focus timers and desktop commands work without an API key. I won’t invent answers to open-ended questions.'}</p></div></div>${S.state.ai.configured ? `<div class="settings-actions" style="justify-content:flex-start;margin-top:0;gap:8px;flex-wrap:wrap"><button class="btn btn-sm btn-ghost" id="test-ai" data-action="test-ai" ${!owner ? 'disabled' : ''}>${icon('activity')}Test AI connection</button>${S.state.ai.hasKey ? `<button class="btn btn-sm btn-ghost" data-action="disconnect-ai" ${!owner ? 'disabled' : ''}>${icon('logout')}Disconnect</button>` : ''}<button class="btn btn-sm btn-ghost" data-action="connect-ai" ${!owner ? 'disabled' : ''}>${icon('refresh')}Change key</button></div>` : `<div class="info-banner" style="margin:14px 0 0">${icon('sparkle')}<div><strong>Have a Groq API key?</strong><p>Connect it here in a secure field — no <span class="mono">.env</span> file needed. NOVA will test it and connect automatically. Never paste your key into chat.</p></div></div><div class="settings-actions" style="justify-content:flex-start;margin-top:12px"><button class="btn btn-primary" data-action="connect-ai" ${!owner ? 'disabled' : ''}>${icon('link')}Connect Groq</button></div>`}<p class="muted" style="font-size:10px;margin-top:12px">Keys are sent only to this NOVA server, encrypted at rest, and never returned to the browser. Groq free tiers have rate limits; if you hit them, NOVA will say so. Advanced: server env presets are documented in <span class="mono">NOVA.md</span>.</p></section></div><div class="stack"><section class="card settings-card"><div class="between"><h2>Paired phones</h2>${owner ? `<button class="text-button" data-action="remote">${icon('plus')}Pair phone</button>` : ''}</div><p class="settings-sub" style="margin-bottom:8px">Your workspace, from your pocket.</p><div id="remote-devices"></div></section><section class="card settings-card"><h2>Your data</h2><p class="settings-sub">Stored in this workspace’s SQLite database on the server. Not shared with other workspaces.</p><div class="setting-row"><div><strong>Export workspace</strong><p>Memories, conversation and action history.</p></div><button class="btn btn-sm btn-ghost" data-action="export" ${!owner ? 'disabled' : ''}>${icon('download')}Export</button></div><div class="setting-row"><div><strong>Clear conversation</strong><p>Memories stay in your vault.</p></div><button class="btn btn-sm btn-ghost" data-action="clear-chat" ${!owner ? 'disabled' : ''}>${icon('trash')}Clear</button></div></section>${owner ? `<section class="card settings-card danger-zone"><h2>Danger zone</h2><div class="setting-row"><div><strong>Delete this workspace</strong><p>Permanently removes memories, chats, pairings and bridge access.</p></div><button class="btn btn-sm btn-danger" data-action="delete-workspace">Delete</button></div></section>` : ''}<section class="card settings-card"><h2>About this build</h2><p class="settings-sub" style="margin-bottom:10px">NOVA v0.1 · Working MVP</p><p class="muted" style="font-size:10px">An original companion inspired by the idea of a personal AI desktop. Not affiliated with Stonic AI. Windows actions require the local agent. Voice input uses your browser’s speech service. Optional screen analysis can suggest a click for separate review and approval; it uses a browser-selected frame and a compatible vision model. The experimental wake-word window must remain open and uses the browser speech service. The world monitor uses external public feeds when available.</p><a class="text-button" href="/" style="margin-top:12px">Back to Gen-Z Hub ${icon('arrow-up-right')}</a></section></div></div>`;
    populateVoices();
    $('#setting-rate').oninput = e => { $('#rate-value').textContent = e.target.value + '×'; };
    $('#test-voice').onclick = () => speak(`Hi${s.userName ? ' ' + s.userName : ''}. I’m ${name()}. Your mind, amplified.`, true);
    $('#settings-form').onsubmit = async e => {
      e.preventDefault(); const btn = $('button[type=submit]', e.target); btn.disabled = true;
      try {
        const data = await api('/settings', { method: 'PATCH', body: { customCharacterName: $('#character-name').value, customInstructions: $('#character-style').value, ...(s.persona === 'custom' ? { assistantName: $('#character-name').value } : {}), userName: $('#setting-name').value, workspaceName: $('#setting-workspace').value, language: $('#setting-language').value, timezone: $('#setting-timezone').value, voiceEnabled: $('#setting-voice').checked, voiceGender: $('#setting-gender').value, speechRate: Number($('#setting-rate').value), voiceURI: $('#setting-voice-uri').value } });
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
      modal('Your workspace, to go.', `<div class="modal-icon">${icon('phone')}</div><p>The code expires in 5 minutes and can be used once. Your phone needs a reachable server address: <strong>localhost means the phone itself</strong>, not your PC. Use your PC’s LAN address on the same Wi-Fi, or a private VPN / HTTPS address for access outside. NOVA does not set up a public connection automatically.</p><div class="pair-code">${esc(data.code)}</div><div class="pair-expiry" id="pair-expiry">Expires in 5:00</div><div class="pair-link">${esc(link)}</div><div class="modal-footer"><button class="btn btn-ghost" id="copy-pair-code">${icon('copy')}Copy code</button><button class="btn btn-primary" id="copy-pair-link">${icon('link')}Copy pairing link</button></div><p style="font-size:9px;color:var(--subtle);margin:16px 0 0">Paired phones can chat, manage memories and approve desktop actions. Revoke access in Settings → Paired phones.</p>`);
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

  /* Browser voice requires an explicit session; the optional wake window stays visible/minimizable and may use the browser speech service. */
  function populateVoices() {
    const select = $('#setting-voice-uri'); if (!select || !('speechSynthesis' in window)) return;
    const fill = () => { if (!select.isConnected) return; const voices = speechSynthesis.getVoices(); const current = S.state.settings.voiceURI; select.innerHTML = '<option value="">Choose automatically</option>' + voices.map(v => `<option value="${esc(v.voiceURI)}" ${v.voiceURI === current ? 'selected' : ''}>${esc(v.name)} · ${esc(v.lang)}</option>`).join(''); };
    fill(); speechSynthesis.addEventListener('voiceschanged', fill, { once: true });
  }
  function voiceText(text, engine) {
    let value = String(text || '');
    const marker = 'World Monitor · checked ';
    if (value.includes(marker)) {
      if (engine === 'cloud' && value.includes('\n\n' + marker)) value = value.split('\n\n' + marker)[0];
      else {
        const records = value.split('\n').filter(line => /^\s*\[(?:N|Q)\d+\]/i.test(line)).slice(0, 3);
        if (records.length) value = records.join('\n').replace(/\s*·\s*\d{4}-\d\d-\d\dT[^\s]+/g, '');
        else value = value.replace(/^https?:\/\/\S+$/gm, '');
      }
    }
    value = value.replace(/^\s*\|?\s*:?-{2,}[-:|\s]*\|?\s*$/gm, '')
      .replace(/^\s*\|\s*(?:আইডি|id)\s*\|[^\n]*$/gim, '')
      .replace(/\|\s*[NQ]\d+\s*\|/gi, '|')
      .replace(/\[(?:N|Q)\d+\]/gi, '')
      .replace(/^\s*(?:N|Q)\d+\s*[:|]\s*/gim, '')
      .replace(/https?:\/\/\S+/gi, '')
      .replace(/[|*#•]/g, ' ').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
    if (value.length > 1200) {
      const excerpt = value.slice(0, 1200); const end = Math.max(excerpt.lastIndexOf('।'), excerpt.lastIndexOf('.'), excerpt.lastIndexOf('?'), excerpt.lastIndexOf('!'));
      value = end > 450 ? excerpt.slice(0, end + 1) : excerpt.slice(0, Math.max(1, excerpt.lastIndexOf(' '))) + '…';
    }
    return value;
  }
  function availableVoices() {
    const voices = speechSynthesis.getVoices(); if (voices.length) return Promise.resolve(voices);
    return new Promise(resolve => {
      let done = false; const finish = () => { if (done) return; done = true; clearTimeout(timer); speechSynthesis.removeEventListener?.('voiceschanged', finish); resolve(speechSynthesis.getVoices()); };
      const timer = setTimeout(finish, 1500); speechSynthesis.addEventListener?.('voiceschanged', finish, { once: true });
    });
  }
  async function speak(text, force = false, engine = null) {
    if (!('speechSynthesis' in window)) { if (force) toast('Speech output is not supported in this browser.', 'info'); return; }
    const s = { ...S.state.settings, ...(S.view === 'settings' && $('#setting-voice-uri') ? { voiceURI: $('#setting-voice-uri').value, voiceGender: $('#setting-gender').value, speechRate: Number($('#setting-rate').value), voiceEnabled: $('#setting-voice').checked } : {}) };
    if (!s.voiceEnabled && !force) return;
    const spoken = voiceText(text, engine); if (!spoken) return;
    const activeSession = S.voiceSession.active; const voices = await availableVoices();
    if (activeSession && !S.voiceSession.active) return;
    const lang = /[\u0980-\u09FF]/.test(spoken) ? 'bn' : 'en';
    const matches = v => String(v.lang || '').toLowerCase().split('-')[0] === lang;
    let chosen = voices.find(v => v.voiceURI === s.voiceURI && (lang !== 'bn' || matches(v))) || voices.find(v => matches(v) && (s.voiceGender === 'auto' || new RegExp(s.voiceGender === 'feminine' ? 'female|samantha|zira|aria|jenny|sonia|ava|google.*english' : 'male|david|daniel|guy|alex|mark', 'i').test(v.name))) || voices.find(matches);
    if (lang === 'bn' && !chosen) { toast('বাংলা voice পাওয়া যায়নি বা লোড হয়নি। Settings-এর Installed voice দেখো; browser বা Windows-এ বাংলা text-to-speech voice লাগবে।', 'info'); return; }
    S.voiceSession.finishSpeech?.(false); speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(spoken); u.lang = lang === 'bn' ? (chosen?.lang || 'bn-BD') : 'en-US'; u.rate = s.speechRate || 1;
    if (chosen) u.voice = chosen;
    return new Promise(resolve => {
      let done = false; const finish = (success = false) => { if (done) return; done = true; clearTimeout(timer); if (S.voiceSession.finishSpeech === finish) S.voiceSession.finishSpeech = null; resolve(success === true); };
      S.voiceSession.finishSpeech = finish;
      const timer = setTimeout(() => finish(false), 45000);
      u.onend = () => finish(true); u.onerror = e => { if (force && !['interrupted', 'canceled'].includes(e.error)) toast('Voice playback failed. Check your browser’s speech settings.', 'error'); finish(false); };
      try { speechSynthesis.speak(u); } catch { finish(false); }
    });
  }
  function voiceRecognitionLanguage() {
    return S.voiceSession.recognitionLanguage || (S.state?.settings.language === 'en' ? 'en-US' : 'bn-BD');
  }
  // The browser owns the microphone. Stop it if this voice companion loses its
  // authenticated NOVA server; do not leave a silent, orphaned listener.
  function monitorVoiceServer() {
    if (!voiceCompanion || !S.voiceSession.active) return;
    const epoch = ++S.voiceSession.monitorEpoch;
    const check = async () => {
      if (!S.voiceSession.active || epoch !== S.voiceSession.monitorEpoch) return;
      const controller = new AbortController(); S.voiceSession.monitorAbort = controller;
      const timeout = setTimeout(() => controller.abort(), 5000);
      try {
        await api('/sync', { signal: controller.signal });
      } catch {
        if (S.voiceSession.active && epoch === S.voiceSession.monitorEpoch) {
          stopVoiceConversation();
          const status = $('#voice-handsfree-status'); if (status) status.textContent = 'NOVA disconnected; microphone stopped. Restart voice when NOVA is available.';
          toast('NOVA disconnected; the voice microphone was stopped.', 'error');
        }
        return;
      } finally { clearTimeout(timeout); if (S.voiceSession.monitorAbort === controller) S.voiceSession.monitorAbort = null; }
      if (S.voiceSession.active && epoch === S.voiceSession.monitorEpoch) S.voiceSession.monitorTimer = setTimeout(check, 4000);
    };
    S.voiceSession.monitorTimer = setTimeout(check, 4000);
  }
  function stopVoiceConversation() {
    S.voiceSession.monitorEpoch++; clearTimeout(S.voiceSession.monitorTimer); S.voiceSession.monitorTimer = null;
    S.voiceSession.monitorAbort?.abort(); S.voiceSession.monitorAbort = null;
    setVoiceAlerts(false);
    clearPendingProject(); stopVoiceProject(); stopVoicePlan();
    const pending = S.voiceSession.pendingAction; S.voiceSession.pendingAction = null; if (pending) api(`/actions/${encodeURIComponent(pending.id)}/cancel`, { method: 'POST', body: {} }).catch(() => {});
    S.voiceSession.active = false; S.voiceSession.allowAppOpen = false; S.voiceSession.chatOnly = false; const chatButton = $('#voice-chat-only'); if (chatButton) { chatButton.setAttribute('aria-pressed', 'false'); chatButton.textContent = 'আড্ডা মোড চালু করো'; } const chatStatus = $('#voice-chat-status'); if (chatStatus) chatStatus.textContent = 'আড্ডা মোড বন্ধ।'; S.voiceSession.wakeUntil = 0; S.voiceSession.retryDelay = 800; const permission = $('#voice-app-permission'); if (permission) permission.textContent = 'Allow voice app opening for this session'; clearTimeout(S.voiceSession.timer); S.voiceSession.timer = null;
    if (S.listening && S.recognition) { try { S.recognition.abort(); } catch {} }
    if ('speechSynthesis' in window) speechSynthesis.cancel();
    S.voiceSession.finishSpeech?.();
    renderShell();
  }
  function scheduleVoiceTurn() {
    clearTimeout(S.voiceSession.timer);
    if (!S.voiceSession.active) return;
    S.voiceSession.timer = setTimeout(() => {
      if (!S.voiceSession.active) return;
      if (!S.busy && !S.listening && !S.modal) startVoice();
      else scheduleVoiceTurn();
    }, S.voiceSession.retryDelay || 800);
  }
  function openVoiceWindow() {
    confirmDialog('Open separate voice window?', 'A separate Chrome window can keep listening when you close the main NOVA tab, but must remain open (you may minimize it). Start its microphone yourself. While listening, audio may be sent to your browser’s speech service; a voice or recording cannot prove identity. Keep NOVA and Chrome running. This is experimental and can stop listening unexpectedly.', 'Open window', () => {
      const win = window.open('/nova?voice=1#conversation', 'nova-voice-window', 'popup=yes,width=620,height=800');
      if (!win) toast('The voice window was blocked. Allow pop-ups for NOVA and try again.', 'error');
      else { win.focus(); toast('Start voice conversation in the new window. You can minimize it.', 'info'); }
    });
  }
  // Power countdown requires this exact page to keep sending heartbeats. It
  // fails closed if the page hides, disconnects, closes, or the server stops.
  let powerTimer = null, powerTicker = null, powerRequest = null;
  function renderNativePower() {
    const banner = $('#native-power-banner'); if (!banner) return;
    const p = S.state?.nativePower; banner.hidden = !isOwner() || !p;
    if (!p) return;
    const remain = p.state === 'countdown' ? ` · ${Math.max(0, Math.ceil((p.executeAt - Date.now()) / 1000))} seconds` : '';
    $('#native-power-indicator').textContent = `${p.label} · ${p.state.toUpperCase()}${remain} · ${p.message || ''}`;
    $('#native-power-cancel').hidden = !['prepared', 'countdown'].includes(p.state);
  }
  function stopPowerHeartbeat() { clearInterval(powerTimer); clearInterval(powerTicker); powerTimer = null; powerTicker = null; powerRequest = null; }
  function powerHeartbeat(id) {
    stopPowerHeartbeat(); powerRequest = id;
    powerTicker = setInterval(renderNativePower, 1000);
    powerTimer = setInterval(async () => {
      if (powerRequest !== id) return;
      if (document.hidden) return cancelNativePower();
      try {
        const result = await api('/native-power/heartbeat', { method: 'POST', body: { id } });
        if (powerRequest !== id) return;
        if (!result.ok) { stopPowerHeartbeat(); await sync(); return; }
        S.state.nativePower = result.request; renderNativePower();
      } catch { stopPowerHeartbeat(); toast('Power countdown connection lost; cancellation requested by timeout.', 'error'); await sync(); }
    }, 2000);
  }
  async function cancelNativePower(keepalive = false) {
    const id = powerRequest || S.state?.nativePower?.id; if (!id) return;
    stopPowerHeartbeat();
    if (keepalive) { fetch('/api/nova/native-power/cancel', { method:'POST', keepalive:true, credentials:'same-origin', headers:{ 'Content-Type':'application/json', 'X-GenZ-Client':'1', 'X-Nova-Session':S.token }, body:JSON.stringify({id}) }).catch(() => {}); return; }
    try { const data = await api('/native-power/cancel', { method:'POST', body:{id} }); if (!data.ok) throw new Error(data.error); S.state.nativePower = data.request; renderNativePower(); toast('Power request cancelled before it was sent to Windows.'); await sync(); }
    catch (err) { toast(err.message + ' The request may already have reached Windows.', 'error'); await sync(); }
  }
  window.addEventListener('pagehide', () => { if (powerRequest) cancelNativePower(true); });
  document.addEventListener('visibilitychange', () => { if (document.hidden && powerRequest) cancelNativePower(true); });
  function nativePowerDialog() {
    if (S.state.nativePower && ['prepared', 'countdown', 'executing'].includes(S.state.nativePower.state)) return toast('A power request is already active. Use the red banner to cancel before it starts.', 'info');
    modal('Windows power · experimental', `<p>Choose a Windows power request to review. Nothing happens at this step.</p><p><strong>Save your work first.</strong> Shutdown or restart can close applications and lose unsaved work. Sleep may be unavailable or behave differently depending on Windows configuration.</p><div class="field"><label for="native-power-kind">Action to review</label><select id="native-power-kind"><option value="shutdown">Shut down Windows</option><option value="restart">Restart Windows</option><option value="sleep">Sleep Windows</option></select></div><div class="modal-footer"><button class="btn btn-ghost" data-close>Cancel</button><button class="btn btn-primary" id="native-power-review">Review request</button></div>`);
    $('#native-power-review').onclick = async e => {
      const button = e.currentTarget, kind = $('#native-power-kind').value; button.disabled = true;
      try {
        const data = await api('/native-power/prepare', { method:'POST', body:{ kind, confirm:true } }); if (!data.ok) throw new Error(data.error);
        const request = data.request;
        if (!button.isConnected) { await api('/native-power/cancel', { method:'POST', body:{id:request.id} }); return; }
        S.state.nativePower = request; renderNativePower(); let committed = false;
        modal('Confirm Windows power request', `<p><strong>${esc(request.label)}</strong> will be requested after a 30-second countdown. Save your work first; unsaved changes can be lost.</p><p>Keep this NOVA page visible and active. Hiding or closing it, disconnecting, or stopping NOVA requests cancellation before the countdown ends. You can also use the red Cancel banner. Once the request is sent to Windows, it may be too late to cancel and NOVA cannot guarantee the final power state.</p><p>Only this local owner session may confirm. This experimental feature has not been tested on Windows hardware. It does not work by voice in this first phase.</p><div class="modal-footer"><button class="btn btn-ghost" data-close>Cancel</button><button class="btn btn-danger" id="native-power-confirm">Confirm ${esc(request.label)} · start countdown</button></div>`, { onClose: () => { if (!committed) api('/native-power/cancel', { method:'POST', body:{id:request.id} }).then(r => { if (r.ok) { S.state.nativePower = r.request; renderNativePower(); } }).catch(() => {}); } });
        $('#native-power-confirm').onclick = async ev => {
          const confirmButton = ev.currentTarget; confirmButton.disabled = true;
          try {
            const r = await api('/native-power/confirm', { method:'POST', body:{id:request.id, kind, confirm:true} }); if (!r.ok) throw new Error(r.error);
            if (!confirmButton.isConnected || document.hidden) { await api('/native-power/cancel', {method:'POST',body:{id:request.id}}); return; }
            committed = true; S.state.nativePower = r.request; closeModal(); powerHeartbeat(request.id); renderNativePower(); toast('Power countdown started. Keep this page visible; use Cancel to stop.', 'info');
          } catch (err) { toast(err.message, 'error'); if (confirmButton.isConnected) confirmButton.disabled = false; await sync(); }
        };
      } catch (err) { toast(err.message, 'error'); if (button.isConnected) button.disabled = false; }
    };
  }
  async function stopNativeScreen() {
    try { const data = await api('/native-screen/stop', { method: 'POST', body: {} }); toast(data.ok ? 'Stopping screen permission. An image already sent cannot be recalled.' : 'Screen permission was already stopped.', 'info'); await sync(); }
    catch (err) { toast(err.message, 'error'); }
  }
  function nativeScreenDialog() {
    const state = S.state.nativeScreen || { state: 'off' };
    if (state.state !== 'off') {
      modal('Windows native screen · permission ON', `<p><strong>Screen access ${esc(state.state)}</strong> · expires after one hour. Orange tray icon may be under hidden icons. Stop here or from the tray. An image already sent to the provider cannot be recalled.</p>${state.owned ? `<p>This request captures one still image of the primary screen and sends it with your question to your connected vision provider. Close private content first. NOVA does not save images, but your provider may retain them according to its policies. Model results can be wrong or reveal sensitive content.</p><div class="field"><label for="native-screen-question">What should NOVA describe?</label><input id="native-screen-question" maxlength="500" value="স্ক্রিনে সাধারণভাবে কী দেখা যাচ্ছে?"></div><div class="modal-footer"><button class="btn btn-ghost" id="native-screen-off">Stop permission</button><button class="btn btn-primary" id="native-screen-view">Capture &amp; describe once</button></div><p role="status" id="native-screen-result" style="white-space:pre-wrap"></p>` : `<p>This permission belongs to another owner session. Stop it and start a new one here to request a frame.</p><div class="modal-footer"><button class="btn btn-danger" id="native-screen-off">Stop permission</button></div>`}`);
      $('#native-screen-off').onclick = async () => { closeModal(); await stopNativeScreen(); };
      const view = $('#native-screen-view'); if (view) view.onclick = async () => { view.disabled = true; const result = $('#native-screen-result'); result.textContent = 'Capturing and analyzing one image…'; try { const data = await api('/native-screen/describe', { method: 'POST', body: { confirm: true, question: $('#native-screen-question').value.trim() } }); if (result.isConnected) result.textContent = data.ok ? data.answer : data.error; } catch (err) { if (result.isConnected) result.textContent = err.message; } finally { if (view.isConnected) view.disabled = false; sync(); } };
      return;
    }
    const model = S.state.ai.provider === 'openai' ? 'gpt-4.1-mini' : 'meta-llama/llama-4-scout-17b-16e-instruct';
    modal('Windows native screen · experimental', `<p><strong>Screen permission is separate from desktop control and microphone permission.</strong> On this Windows PC, NOVA can capture the primary screen on request without a browser picker for up to one hour, even if this tab closes. An orange screen-access tray icon appears (possibly in hidden icons); use it or the Stop banner. Stop cannot recall a frame already sent.</p><p>Each request sends one still image and the question to your connected AI vision provider. Screen content can contain passwords, messages or other sensitive information. Close private content first. NOVA does not save screenshots; the provider may retain data under its own policies. Do not type or speak passwords or keys. This experimental feature has not been tested on Windows hardware.</p><p>No clicks, settings changes, installs or power actions are granted by this permission. The selected model must support vision on your provider; availability is not guaranteed.</p><div class="field"><label for="native-screen-model">Provider vision model</label><input id="native-screen-model" maxlength="100" value="${esc(model)}"></div><label class="screen-check"><input type="checkbox" id="native-screen-voice"> Separately allow Windows background voice to request screen descriptions during this permission. Anyone nearby or a recording can trigger it; voice does not verify identity. Start background voice in this same owner session.</label><div class="modal-footer"><button class="btn btn-ghost" data-close>Cancel</button><button class="btn btn-primary" id="native-screen-start">I agree · enable screen permission</button></div>`);
    $('#native-screen-start').onclick = async e => { const button = e.currentTarget; button.disabled = true; try { const data = await api('/native-screen/start', { method: 'POST', body: { confirm: true, model: $('#native-screen-model').value.trim(), voiceRequests: $('#native-screen-voice').checked } }); if (!data.ok) throw new Error(data.error); closeModal(); toast('Screen permission enabled. No frame is captured until requested.'); await sync(); } catch (err) { toast(err.message, 'error'); if (button.isConnected) button.disabled = false; await sync(); } };
  }
  function nativeVoiceDialog() {
    const state = S.state.nativeVoice || { state: 'off' };
    if (state.state !== 'off') return confirmDialog('Stop Windows background voice?', 'The background microphone will stop. NOVA and the desktop connection stay running.', 'Stop listening', async () => {
      const data = await api('/native-voice/stop', { method: 'POST', body: {} });
      if (!data.ok) throw new Error('Background voice was already stopped.');
      toast('Stopping background voice.'); await sync();
    });
    modal('Windows background voice · experimental', `<p><strong>Microphone permission:</strong> NOVA will keep listening on this Windows PC even after you close the browser. A separate red microphone tray icon appears (it may be in hidden icons); right-click it and choose Stop, say “Nova stop listening” while listening, or use this button again. Stop may take a moment during speech. Keep NOVA running; it does not restart automatically.</p><p>Windows local speech recognition listens for a “Nova” prefix. It can miss words or trigger on nearby speech and recordings; it does not identify you. Recognition pauses while NOVA replies. Do not speak passwords, keys or private secrets.</p><p>Only recognized requests addressed to NOVA are processed. Their text and replies are stored in this workspace; recent chat and saved memories may be sent to your connected AI. NOVA does not save audio. This mode is chat only except for exact screen-description phrases if separately enabled in native screen permission. No desktop actions, project building, voice approvals or new memory.</p><p>Windows must have a matching speech recognizer and text-to-speech voice installed. Bengali is often unavailable in native Windows recognition; if so, use the separate browser voice window. Microphone permission, sleep, and recognition errors may stop it. This experimental feature has not yet been tested on Windows hardware.</p><div class="field"><label for="native-language">Language</label><select id="native-language"><option value="bn-BD">বাংলা (Bangladesh)</option><option value="en-US">English (US)</option></select></div><div class="modal-footer"><button class="btn btn-ghost" data-close>Cancel</button><button class="btn btn-primary" id="native-confirm">I agree · start microphone</button></div>`);
    $('#native-confirm').onclick = async e => {
      const language = $('#native-language').value; e.currentTarget.disabled = true;
      try {
        const data = await api('/native-voice/start', { method: 'POST', body: { confirm: true, language } });
        if (!data.ok) throw new Error(data.error || 'Could not start.');
        closeModal(); toast('Background voice started. Say Nova before each request.'); await sync();
      } catch (err) { toast(err.message, 'error'); if ($('#native-confirm')) $('#native-confirm').disabled = false; await sync(); }
    };
  }
  function voiceAppPermission() {
    if (!isOwner()) return toast('Only the workspace owner can enable voice app opening.', 'error');
    if (S.voiceSession.allowAppOpen) { S.voiceSession.allowAppOpen = false; $('#voice-app-permission').textContent = 'Allow voice app opening for this session'; toast('Voice app opening disabled.'); return; }
    if (!S.voiceSession.active) return toast('Start voice conversation in this window first.', 'info');
    if (S.voiceSession.chatOnly) return toast('Turn off chat-only mode before enabling app opening.', 'info');
    confirmDialog('Allow voice app opening?', 'Until this voice session stops, a direct spoken NOVA request may open Firefox, Chrome, Edge, Notepad or Calculator without another review. Anyone nearby or a recording can trigger this; voice does not verify identity. AI-interpreted requests and other actions still require review. An action already sent may finish after stopping. You can turn this off here at any time.', 'Allow for this session', () => { S.voiceSession.allowAppOpen = true; const button = $('#voice-app-permission'); if (button) button.textContent = 'Turn off voice app opening'; });
  }
  function toggleVoiceConversation() {
    if (S.voiceSession.active) { stopVoiceConversation(); toast('Voice conversation stopped.'); return; }
    if (!(window.SpeechRecognition || window.webkitSpeechRecognition)) { startVoice(); return; }
    if (S.listening) { toast('Stop the current microphone session first.', 'info'); return; }
    S.voiceSession.active = true; if (!['overview', 'conversation'].includes(S.view)) navigate('conversation');
    monitorVoiceServer(); renderShell(); toast('Voice conversation is on. Use Stop voice conversation to end it.', 'info'); startVoice();
  }
  // Optional, conservative headline monitoring. The publishers' own links are
  // shown as evidence of what they reported, not proof an emergency occurred.
  function setVoiceAlerts(enabled) {
    const a = S.voiceSession.alerts;
    a.enabled = enabled; a.epoch++; clearTimeout(a.timer); clearTimeout(a.deliverTimer);
    a.timer = a.deliverTimer = null; a.seen = new Set(); a.baseline = false; a.queue = [];
    const button = $('#voice-news-alerts'); if (button) button.textContent = enabled ? 'Turn off news alerts' : 'Enable news alerts for this session';
    const status = $('#voice-news-status'); if (status) status.textContent = enabled ? 'Checking sources. This is not an official emergency alert.' : 'News alerts are off. Sources can be delayed or unavailable.';
    if (enabled) pollVoiceAlerts(a.epoch);
  }
  async function pollVoiceAlerts(epoch) {
    const a = S.voiceSession.alerts;
    if (!a.enabled || !S.voiceSession.active || a.epoch !== epoch || a.inFlight) return;
    a.inFlight = true;
    try {
      const data = await api('/world', { signal: AbortSignal.timeout(15000) });
      if (!a.enabled || !S.voiceSession.active || a.epoch !== epoch) return;
      const sourcesOk = !!data.news?.ok || !!data.bangladesh?.ok || !!data.quakes?.ok;
      const current = window.NovaVoiceAlerts.collect(data);
      const status = $('#voice-news-status');
      const recent = Number.isFinite(data.fetchedAt) && data.fetchedAt <= Date.now() + 60000 && data.fetchedAt >= Date.now() - 600000;
      if (!sourcesOk || !recent) { if (status) status.textContent = 'News alert sources unavailable or stale. Do not rely on NOVA for emergencies.'; return; }
      if (!a.baseline) { current.forEach(item => a.seen.add(item.key)); a.baseline = true; }
      else for (const item of current) if (!a.seen.has(item.key)) {
        a.seen.add(item.key); if (a.queue.length < 3) a.queue.push(item);
      }
      if (a.seen.size > 500) a.seen = new Set([...a.seen].slice(-300));
      const partial = !data.news?.ok || !data.bangladesh?.ok || !data.quakes?.ok || data.news?.sources?.some(source => !source.ok);
      if (status) status.textContent = partial ? 'Monitoring with some sources unavailable. Reports can be delayed or missed; follow official alerts.' : 'Monitoring selected headlines and major USGS earthquakes. Reports can be delayed or missed; follow official alerts.';
      deliverVoiceAlert(epoch);
    } catch {
      if (a.enabled && a.epoch === epoch) { const status = $('#voice-news-status'); if (status) status.textContent = 'News alert sources unavailable. Do not rely on NOVA for emergencies.'; }
    } finally {
      a.inFlight = false;
      if (a.enabled && S.voiceSession.active) { clearTimeout(a.timer); const next = a.epoch; a.timer = setTimeout(() => pollVoiceAlerts(next), next === epoch ? 180000 : 0); }
    }
  }
  async function deliverVoiceAlert(epoch) {
    const a = S.voiceSession.alerts; clearTimeout(a.deliverTimer); a.deliverTimer = null;
    if (!a.enabled || !S.voiceSession.active || a.epoch !== epoch || !a.queue.length) return;
    if (S.busy || S.modal || S.voiceSession.pendingAction || S.voiceSession.pendingProject || S.voiceSession.voicePlan) { a.deliverTimer = setTimeout(() => deliverVoiceAlert(epoch), 3000); return; }
    const item = a.queue.shift(); S.busy = true;
    if (S.listening && S.recognition) { try { S.recognition.stop(); } catch {} }
    const proof = $('#voice-news-proof'); if (proof) proof.innerHTML = `<p><strong>${esc(item.source)}</strong> · ${esc(item.title)}</p><a class="text-button" href="${esc(item.url)}" target="_blank" rel="noopener noreferrer">Open source report ↗</a>`;
    const user = String(S.state.settings.userName || '').trim();
    const intro = S.state.settings.language === 'bn'
      ? `${user ? user + ', ' : ''}${item.source} থেকে একটি নতুন প্রতিবেদন: ${item.title}। এটি সরকারি জরুরি সতর্কবার্তা নয়। বিস্তারিত মূল সূত্রে দেখো এবং স্থানীয় কর্তৃপক্ষের নির্দেশ অনুসরণ করো।`
      : `${user ? user + ', ' : ''}${item.source} has a new report: ${item.title}. This is not an official emergency alert. Check the source and follow local authorities.`;
    try { await speak(intro, true); }
    finally { S.busy = false; if (a.enabled && a.epoch === epoch) { if (a.queue.length) a.deliverTimer = setTimeout(() => deliverVoiceAlert(epoch), 3000); if (S.voiceSession.active) scheduleVoiceTurn(); } }
  }
  function voiceNewsAlerts() {
    if (!voiceCompanion || !isOwner()) return;
    if (S.voiceSession.alerts.enabled) { setVoiceAlerts(false); return; }
    if (!S.voiceSession.active) return toast('Start voice conversation first.', 'info');
    confirmDialog('Enable news alerts?', 'While this voice window is open, NOVA checks selected publisher headlines and major USGS earthquakes about every three minutes; data may be cached for five minutes. It can miss, delay or misinterpret news, is not an official emergency warning, and cannot confirm an attack or provide location-specific safety instructions. Follow official local alerts. Stop voice or turn this off to stop monitoring.', 'Enable alerts', () => setVoiceAlerts(true));
  }
  async function voiceAlertCommand(enabled) {
    S.busy = true;
    try { setVoiceAlerts(enabled); await speak(S.state.settings.language === 'bn' ? (enabled ? 'খবর সতর্কতা চালু করেছি। এটি সরকারি জরুরি সতর্কতা নয়, সংবাদ বাদ পড়তে বা দেরি হতে পারে।' : 'খবর সতর্কতা বন্ধ করেছি।') : (enabled ? 'News alerts enabled. These are not official emergency alerts and may miss or delay reports.' : 'News alerts are off.'), true); }
    finally { S.busy = false; if (S.voiceSession.active) scheduleVoiceTurn(); }
  }
  function clearPendingProject() { clearTimeout(S.voiceSession.pendingProject?.timer); S.voiceSession.pendingProject = null; }
  function voiceProjectBengali() { return S.state.settings.language === 'bn' || (S.state.settings.language === 'auto' && S.voiceSession.projectBengali); }
  function voiceProjectMarkup() {
    const result = S.voiceSession.projectStatus;
    if (!result) return '';
    if (!result.project) return esc(result.message || '');
    return `<p><strong>${esc(result.project.name)}</strong> · saved static project. Preview is sandboxed; review before use. Not published.</p><iframe id="voice-project-preview" title="Sandboxed project preview" sandbox="allow-scripts" src="/api/nova/builder/projects/${encodeURIComponent(result.project.id)}/preview"></iframe>`;
  }
  function setVoiceProjectStatus(result) {
    S.voiceSession.projectStatus = result;
    const el = $('#voice-project-result'); if (el) el.innerHTML = voiceProjectMarkup();
  }
  function revokeProjectGrant() {
    const grant = S.voiceSession.projectGrant; S.voiceSession.projectGrant = null;
    if (grant?.token) api('/builder/revoke-grant', { method: 'POST', body: { grant: grant.token } }).catch(() => {});
  }
  function stopVoiceProject() {
    const work = S.voiceSession.projectWork;
    if (work) { work.cancelled = true; work.abort.abort(); S.voiceSession.projectWork = null; }
    revokeProjectGrant();
    if (work) setVoiceProjectStatus({ message: 'Stop requested. A save already in progress may finish; check Saved projects.' });
  }
  window.addEventListener('pagehide', () => {
    const work = S.voiceSession.projectWork; if (work) { work.cancelled = true; work.abort.abort(); S.voiceSession.projectWork = null; }
    clearPendingProject();
    const grant = S.voiceSession.projectGrant; S.voiceSession.projectGrant = null;
    if (grant?.token) fetch('/api/nova/builder/revoke-grant', { method: 'POST', keepalive: true, credentials: 'same-origin', headers: { 'Content-Type': 'application/json', 'X-GenZ-Client': '1', 'X-Nova-Session': S.token }, body: JSON.stringify({ grant: grant.token }) }).catch(() => {});
    if (voiceCompanion && S.voiceSession.active) { stopVoicePlan(true); stopVoiceConversation(); }
  });
  async function voiceNotice(message) {
    for (let i = 0; i < 80 && S.voiceSession.active && (S.busy || S.modal); i++) await new Promise(resolve => setTimeout(resolve, 250));
    if (!S.voiceSession.active || S.busy || S.modal) return;
    S.busy = true; if (S.listening && S.recognition) { try { S.recognition.stop(); } catch {} }
    try { return await speak(message, true); } finally { S.busy = false; if (S.voiceSession.active) scheduleVoiceTurn(); }
  }
  // Voice plans never run model-selected code. The server exposes fixed
  // actions only; every action is announced and separately approved.
  function voicePlanCurrent(p) { return S.voiceSession.active && S.voiceSession.voicePlan === p; }
  function voicePlanBn() { return voiceRecognitionLanguage() === 'bn-BD'; }
  const voicePlanBnActions = { open_google: 'গুগল সার্চ খুলব', open_google_maps: 'গুগল ম্যাপ খুলব', open_gmail: 'জিমেইল খুলব, কোনো মেইল পাঠাব না', open_google_calendar: 'গুগল ক্যালেন্ডার খুলব', open_github: 'গিটহাব খুলব', open_wikipedia: 'উইকিপিডিয়া খুলব', open_firefox: 'ফায়ারফক্স খুলব', open_chrome: 'ক্রোম খুলব', open_edge: 'মাইক্রোসফট এজ খুলব', open_paint: 'পেইন্ট খুলব', open_task_manager: 'টাস্ক ম্যানেজার খুলব, কোনো প্রক্রিয়া বন্ধ করব না', open_onscreen_keyboard: 'অন স্ক্রিন কিবোর্ড খুলব', open_youtube: 'ইউটিউব খুলব', open_spotify: 'স্পটিফাই খুলব', open_whatsapp: 'হোয়াটসঅ্যাপ ওয়েব খুলব, বার্তা পাঠাব না', open_notepad: 'নোটপ্যাড খুলব', open_calculator: 'ক্যালকুলেটর খুলব', open_explorer: 'ডাউনলোড ফোল্ডার খুলব', system_info: 'কম্পিউটারের সিস্টেম তথ্য নেব' };
  function voicePlanStatus(message, plan = null) {
    const el = $('#voice-plan-result'); if (!el) return;
    el.innerHTML = `<p>${esc(message)}</p>${plan ? `<ol class="goal-plan-list">${plan.steps.map(step => `<li>${esc(step.description)}<p>${step.kind === 'manual' ? 'Your step, not verified by NOVA' : `Actual fixed action: ${esc(step.label)} · ${esc(step.detail)}`}</p><small>${esc(step.status)}${step.result ? ' · ' + esc(step.result) : ''}</small></li>`).join('')}</ol>` : ''}`;
  }
  function stopVoicePlan(keepalive = false) {
    const p = S.voiceSession.voicePlan; if (!p) return;
    S.voiceSession.voicePlan = null; clearTimeout(p.timer); clearTimeout(p.poll); p.abort?.abort();
    if (p.plan?.id && p.plan.state === 'active') {
      const route = '/goal-plans/' + encodeURIComponent(p.plan.id) + '/stop';
      if (keepalive) fetch('/api/nova' + route, { method: 'POST', keepalive: true, credentials: 'same-origin', headers: { 'Content-Type': 'application/json', 'X-GenZ-Client': '1', 'X-Nova-Session': S.token }, body: '{}' }).catch(() => {});
      else api(route, { method: 'POST', body: {} }).catch(() => {});
    }
    voicePlanStatus('Voice plan stopped. An action already running may still finish.', p.plan);
  }
  async function planNotice(p, message) {
    if (!voicePlanCurrent(p)) return false;
    voicePlanStatus(message, p.plan);
    const said = await voiceNotice(message);
    if (!voicePlanCurrent(p)) return false;
    if (!said) {
      stopVoicePlan();
      voicePlanStatus('Voice output was unavailable or interrupted; stop requested without approving another action. An action already running may finish. Use the visible Plan a goal window instead.', p.plan);
      return false;
    }
    return true;
  }
  async function prepareVoicePlan(goal) {
    if (!isOwner()) return voiceNotice(voicePlanBn() ? 'শুধু workspace মালিক পরিকল্পনা করতে পারে।' : 'Only the workspace owner can create a plan.');
    if (!goal || goal.length > 400 || /(?:gsk_[A-Za-z0-9_-]{20,}|sk-(?:proj-)?[A-Za-z0-9_-]{20,}|\b(?:password|api[ -]?key|secret|token)\b|পাসওয়ার্ড|পাসওয়ার্ড)/i.test(goal)) return voiceNotice(voicePlanBn() ? 'গোপন তথ্য বাদ দিয়ে ছোট করে লক্ষ্য বলো।' : 'Please give a short goal without passwords or keys.');
    if (S.voiceSession.pendingAction || S.voiceSession.pendingProject || S.voiceSession.projectWork) return voiceNotice(voicePlanBn() ? 'আগের কাজ বা অনুমতি আগে শেষ বা বাতিল করো।' : 'Finish or cancel the previous work first.');
    const p = { goal, plan: null, phase: 'announcing', abort: null, poll: null, timer: null, approvalId: null, seq: 0 }; S.voiceSession.voicePlan = p;
    const message = voicePlanBn()
      ? `তোমার লক্ষ্য: ${goal}। অনুমতি পেলে এই লক্ষ্য সংযুক্ত AI তে পাঠাব। স্ক্রিন বা আগের আলাপ পাঠাব না। পরিকল্পনা কেবল পরামর্শ, প্রতিটি নির্দিষ্ট কাজের জন্য আলাদা অনুমতি চাইব। কণ্ঠে পরিচয় যাচাই হয় না। পাঠাতে বলো নোভা পরিকল্পনার অনুমতি দিচ্ছি, অথবা বলো নোভা পরিকল্পনা বন্ধ করো।`
      : `Your goal: ${goal}. With your permission I will send this goal to the connected AI, not your screen or past chat. The plan is only a suggestion. I will ask separately for every fixed action. Voice does not verify identity. Say Nova consent to plan, or Nova stop plan.`;
    if (!await planNotice(p, message)) return;
    p.phase = 'consent'; p.timer = setTimeout(() => { if (voicePlanCurrent(p) && p.phase === 'consent') { stopVoicePlan(); voiceNotice(voicePlanBn() ? 'পরিকল্পনার অনুমতির সময় শেষ।' : 'Plan consent expired.'); } }, 60000);
  }
  async function voicePlanCreate(p) {
    if (!voicePlanCurrent(p) || p.phase !== 'consent') return;
    clearTimeout(p.timer); p.phase = 'creating'; p.abort = new AbortController();
    voicePlanStatus('Sending the goal to your AI provider. Say Nova stop plan to cancel.');
    try {
      const response = await api('/goal-plans', { method: 'POST', body: { goal: p.goal, confirm: true }, signal: p.abort.signal });
      if (!voicePlanCurrent(p)) { if (response.ok && response.plan?.id) api('/goal-plans/' + encodeURIComponent(response.plan.id) + '/stop', { method: 'POST', body: {} }).catch(() => {}); return; }
      if (!response.ok || !response.plan?.id) throw new Error(response.error || 'Plan could not be created.');
      p.plan = response.plan; p.abort = null; await advanceVoicePlan(p);
    } catch (err) {
      if (!voicePlanCurrent(p)) return;
      stopVoicePlan(); voicePlanStatus(err.message); await voiceNotice(voicePlanBn() ? 'পরিকল্পনা তৈরি হয়নি। বিস্তারিত স্ক্রিনে দেখো।' : 'The plan could not be created. Check the screen for details.');
    }
  }
  async function advanceVoicePlan(p) {
    if (!voicePlanCurrent(p) || !p.plan) return;
    if (p.plan.state !== 'active') {
      const failed = p.plan.state !== 'complete';
      const message = voicePlanBn() ? (failed ? 'পরিকল্পনাটি শেষ হয়নি। বিস্তারিত স্ক্রিনে দেখো।' : 'ধাপগুলো রিপোর্ট বা তোমার দ্বারা নিশ্চিত হয়েছে। পুরো লক্ষ্য স্বাধীনভাবে যাচাই করা হয়নি।') : (failed ? 'The plan did not complete. Check the screen for details.' : 'Steps were reported or confirmed by you. The overall goal was not independently verified.');
      const finalPlan = p.plan; S.voiceSession.voicePlan = null; clearTimeout(p.poll); voicePlanStatus(message, finalPlan); await voiceNotice(message); return;
    }
    let step = p.plan.steps[p.plan.index];
    if (!step) { stopVoicePlan(); return; }
    if (step.kind !== 'manual' && !p.plan.action) {
      p.phase = 'preparing'; p.abort = new AbortController(); voicePlanStatus('Preparing a review only; no action has run.', p.plan);
      try {
        const r = await api('/goal-plans/' + encodeURIComponent(p.plan.id) + '/prepare', { method: 'POST', body: {}, signal: p.abort.signal });
        if (!voicePlanCurrent(p)) return;
        p.abort = null; if (r.plan) p.plan = r.plan;
        if (!r.ok) throw new Error(r.error || 'Could not prepare the step.');
        if (p.plan.state !== 'active') return void await advanceVoicePlan(p);
        step = p.plan.steps[p.plan.index];
      } catch (err) {
        if (!voicePlanCurrent(p)) return;
        const plan = p.plan; stopVoicePlan(); voicePlanStatus(err.message, plan);
        await voiceNotice(voicePlanBn() ? 'ধাপ প্রস্তুত করা যায়নি। পরিকল্পনা থামিয়েছে, স্ক্রিনে দেখো।' : 'The step could not be prepared. The plan has stopped; check the screen.'); return;
      }
    }
    if (step.kind === 'manual') {
      p.phase = 'announcing';
      const message = voicePlanBn() ? `পরের ধাপের পরামর্শ: ${step.description}। এটি আমাকে দিয়ে করা যাবে না, তুমি যাচাই করে করবে। শেষ করলে বলো নোভা আমি এই ধাপ শেষ করেছি। বন্ধ করতে বলো নোভা পরিকল্পনা বন্ধ করো।` : `Suggested manual step: ${step.description}. I cannot do or verify it. If you complete it, say Nova I completed this step. To stop, say Nova stop plan.`;
      if (await planNotice(p, message)) { p.phase = 'manual'; schedulePlanPoll(p); }
    } else if (p.plan.action?.status === 'pending') {
      p.phase = 'announcing'; p.approvalId = null;
      // The actual action label and details come from the fixed server catalog,
      // not from the model's free-form step description.
      const message = voicePlanBn() ? `ধাপ ${p.plan.index + 1}। নির্দিষ্ট কাজ: ${voicePlanBnActions[step.kind] || step.label}। ${step.label}। ${step.detail}। এটি এখনও চালু হয়নি। কণ্ঠ পরিচয় যাচাই করে না। এই একটি কাজ অনুমোদন করতে বলো নোভা এই ধাপ অনুমোদন করো। বন্ধ করতে বলো নোভা পরিকল্পনা বন্ধ করো।` : `Step ${p.plan.index + 1}. Fixed action: ${step.label}. ${step.detail}. It has not run. Voice does not verify identity. To approve only this action say Nova approve this step. To stop say Nova stop plan.`;
      if (await planNotice(p, message)) { p.approvalId = p.plan.action.id; p.phase = 'approval'; schedulePlanPoll(p); }
    } else { p.phase = 'waiting'; schedulePlanPoll(p); }
  }
  function schedulePlanPoll(p) {
    clearTimeout(p.poll); if (!voicePlanCurrent(p)) return;
    p.poll = setTimeout(() => pollVoicePlan(p), 3000);
  }
  async function pollVoicePlan(p) {
    if (!voicePlanCurrent(p) || !p.plan || !['waiting', 'approval', 'manual'].includes(p.phase)) return;
    const oldIndex = p.plan.index, oldId = p.plan.action?.id, seq = ++p.seq; p.abort = new AbortController();
    try {
      const r = await api('/goal-plans/' + encodeURIComponent(p.plan.id), { signal: p.abort.signal });
      if (!voicePlanCurrent(p) || p.seq !== seq) return; p.abort = null; p.plan = r.plan;
      if (p.plan.state !== 'active' || p.plan.index !== oldIndex || (oldId && p.plan.action?.id !== oldId)) {
        p.approvalId = null; p.phase = 'announcing';
        if (p.plan.index > oldIndex) {
          const result = p.plan.steps[oldIndex];
          const message = voicePlanBn() ? `আগের ধাপের ফল: ${result.result || 'Agent সম্পন্ন বলেছে'}।` : `Previous step result: ${result.result || 'The agent reported completion.'}`;
          if (!await planNotice(p, message)) return;
        }
        await advanceVoicePlan(p); return;
      }
      if (p.phase === 'approval' && p.plan.action?.status !== 'pending') { p.phase = 'waiting'; p.approvalId = null; }
      const hint = p.phase === 'approval' ? 'Say Nova approve this step / নোভা এই ধাপ অনুমোদন করো, or Nova stop plan.' : p.phase === 'manual' ? 'Say Nova I completed this step / নোভা আমি এই ধাপ শেষ করেছি, or Nova stop plan.' : 'Waiting for the agent result. Say Nova stop plan to stop.';
      voicePlanStatus(hint, p.plan); schedulePlanPoll(p);
    } catch {
      if (!voicePlanCurrent(p) || p.seq !== seq) return;
      const plan = p.plan; stopVoicePlan(); voicePlanStatus('Could not check plan status; plan stopped. A running action may still finish.', plan);
      await voiceNotice(voicePlanBn() ? 'অবস্থা যাচাই করা যায়নি, পরিকল্পনা থামানোর অনুরোধ দিয়েছি। চলমান কাজ শেষ হতে পারে।' : 'Could not check status, so I requested a stop. An action already running may finish.');
    }
  }
  async function voicePlanOperation(p, op) {
    if (!voicePlanCurrent(p)) return;
    const expected = p.phase;
    if (op === 'approve' && (expected !== 'approval' || !p.approvalId || p.plan.action?.id !== p.approvalId || p.plan.action.status !== 'pending')) return;
    if (op === 'manual-done' && expected !== 'manual') return;
    clearTimeout(p.poll); p.seq++; p.abort?.abort(); p.approvalId = null; p.phase = op === 'approve' ? 'approving' : 'confirming'; p.abort = new AbortController();
    try {
      const r = await api('/goal-plans/' + encodeURIComponent(p.plan.id) + '/' + op, { method: 'POST', body: { confirm: true }, signal: p.abort.signal });
      if (!voicePlanCurrent(p)) return; p.abort = null; if (r.plan) p.plan = r.plan;
      if (!r.ok) throw new Error(r.error || 'Step was not accepted.');
      if (op === 'approve') {
        if (p.plan.state !== 'active' || !p.plan.action || !['approved', 'running'].includes(p.plan.action.status)) return void await advanceVoicePlan(p);
        p.phase = 'waiting';
        if (await planNotice(p, voicePlanBn() ? 'অনুমোদিত কাজ পাঠানো হয়েছে। Agent এর ফলের অপেক্ষায় আছি; এখনও সম্পন্ন বলছি না।' : 'The approved action is queued. I will wait for the agent result; it is not yet complete.')) schedulePlanPoll(p);
      } else {
        p.phase = 'announcing';
        if (await planNotice(p, voicePlanBn() ? 'তুমি বলেছ ধাপটি শেষ। আমি এটি যাচাই করিনি।' : 'You reported that step done. I did not verify it.')) await advanceVoicePlan(p);
      }
    } catch (err) {
      if (!voicePlanCurrent(p)) return;
      const plan = p.plan; stopVoicePlan(); voicePlanStatus(err.message, plan);
      await voiceNotice(voicePlanBn() ? 'ধাপ অনুমোদন বা নিশ্চিত করা যায়নি। পরিকল্পনা থামানোর অনুরোধ দিয়েছি।' : 'The step could not be approved or confirmed. I requested a stop.');
    }
  }
  async function decideVoicePlan(text) {
    const p = S.voiceSession.voicePlan; if (!p) return;
    const answer = text.toLowerCase().trim().replace(/[.!?।]+$/g, '').trim();
    if (p.phase === 'consent' && ['consent to plan', 'পরিকল্পনার অনুমতি দিচ্ছি'].includes(answer)) return void voicePlanCreate(p);
    if (p.phase === 'approval' && ['approve this step', 'এই ধাপ অনুমোদন করো'].includes(answer)) return void voicePlanOperation(p, 'approve');
    if (p.phase === 'manual' && ['i completed this step', 'আমি এই ধাপ শেষ করেছি'].includes(answer)) return void voicePlanOperation(p, 'manual-done');
    if (['plan status', 'পরিকল্পনার অবস্থা'].includes(answer)) {
      if (p.phase === 'approval' || p.phase === 'manual') { clearTimeout(p.poll); p.seq++; p.abort?.abort(); p.abort = null; return void advanceVoicePlan(p); }
      return voiceNotice(voicePlanBn() ? 'পরিকল্পনার বর্তমান কাজ চলছে। বন্ধ করতে বলো নোভা পরিকল্পনা বন্ধ করো।' : 'The plan is in progress. Say Nova stop plan to stop.');
    }
    return voiceNotice(voicePlanBn() ? 'এই পরিকল্পনার জন্য স্ক্রিনে দেখানো কথাটি বলো, অথবা নোভা পরিকল্পনা বন্ধ করো।' : 'Use the specific plan phrase shown on screen, or say Nova stop plan.');
  }

  async function prepareVoiceProject(brief) {
    if (S.voiceSession.projectWork) return voiceNotice(voiceProjectBengali() ? 'একটি প্রজেক্টের কাজ চলছে। বন্ধ করতে বলো নোভা কাজ বন্ধ করো।' : 'A project is running. Say Nova stop project to stop it.');
    revokeProjectGrant();
    S.voiceSession.projectBengali = /[\u0980-\u09ff]/.test(brief);
    clearPendingProject();
    const pending = { brief: brief.slice(0, 3000), expiresAt: Date.now() + 60000 };
    S.voiceSession.pendingProject = pending;
    pending.timer = setTimeout(() => { if (S.voiceSession.pendingProject === pending) { clearPendingProject(); setVoiceProjectStatus({ message: 'Project request expired; ask again if you still want it.' }); } }, 60000);
    const message = voiceProjectBengali()
      ? 'আমি নতুন তিন ফাইলের static website তৈরি করব এবং তোমার অনুরোধ AI provider এ পাঠাব। এই অনুমতিতে পরবর্তী পনেরো মিনিটে তোমার অনুরোধে দুটি পরিবর্তন করা যাবে। কোনো পুরোনো ফাইল মুছব না, সফটওয়্যার ইনস্টল বা সাইট প্রকাশ করব না। অনুমতি দিতে বলো, নোভা অনুমতি দিচ্ছি। বাতিল করতে বলো, নোভা বাতিল।'
      : 'I will create a new three-file static website and send your request to your AI provider. This permission also covers two requested revisions for fifteen minutes. I will not delete existing files, install software, or publish it. Say Nova approve or Nova cancel.';
    setVoiceProjectStatus({ message });
    await voiceNotice(message);
  }
  async function decideVoiceProject(text) {
    const p = S.voiceSession.pendingProject; if (!p) return;
    const answer = text.toLowerCase().trim().replace(/[.!?।]+$/g, '').trim();
    const approve = ['approve', 'অনুমতি দিচ্ছি', 'অনুমতি দিলাম'].includes(answer);
    const cancel = ['cancel', 'বাতিল', 'বাতিল করো', 'না'].includes(answer);
    if (Date.now() >= p.expiresAt || cancel) {
      clearPendingProject();
      setVoiceProjectStatus({ message: 'Project request cancelled or expired.' });
      return voiceNotice(voiceProjectBengali() ? 'প্রজেক্টের অনুরোধ বাতিল হয়েছে।' : 'The project request was cancelled or expired.');
    }
    if (!approve) return voiceNotice(voiceProjectBengali() ? 'অনুমতির জন্য নোভা অনুমতি দিচ্ছি অথবা নোভা বাতিল বলো।' : 'Say Nova approve or Nova cancel for the project.');
    clearPendingProject();
    await voiceNotice(voiceProjectBengali() ? 'অনুমতি পেয়েছি। প্রজেক্ট তৈরি করছি। বন্ধ করতে বলো নোভা কাজ বন্ধ করো।' : 'Approved. I am building the project. Say Nova stop project to stop.');
    if (S.voiceSession.active) runVoiceProject('create', p.brief);
  }
  async function reviseVoiceProject(changes) {
    const grant = S.voiceSession.projectGrant;
    if (S.voiceSession.projectWork) return voiceNotice(voiceProjectBengali() ? 'প্রজেক্টের কাজ এখনও চলছে।' : 'Project work is still running.');
    if (!grant || grant.expiresAt <= Date.now() || grant.remaining <= 0) return voiceNotice(voiceProjectBengali() ? 'এই প্রজেক্টের পরিবর্তনের অনুমতি নেই বা শেষ হয়েছে। নতুন প্রজেক্টের অনুমতি দরকার।' : 'This project has no active revision permission. Authorize a new project.');
    runVoiceProject('revise', changes.slice(0, 1500));
  }
  async function runVoiceProject(mode, description) {
    if (!S.voiceSession.active || S.voiceSession.projectWork) return;
    const grant = S.voiceSession.projectGrant;
    if (mode === 'revise' && !grant) return;
    const work = { abort: new AbortController(), cancelled: false }; S.voiceSession.projectWork = work;
    setVoiceProjectStatus({ message: mode === 'create' ? 'Building a new static website… Say Nova stop project to stop.' : 'Creating a new revision; the earlier project is preserved…' });
    if (mode === 'revise') voiceNotice(voiceProjectBengali() ? 'প্রজেক্টের পরিবর্তন শুরু করেছি। আগের সংস্করণ থাকবে।' : 'I am creating a revised copy. The earlier version will be kept.');
    try {
      const result = await api(mode === 'create' ? '/builder/generate' : '/builder/revise', { method: 'POST', signal: work.abort.signal, body: mode === 'create' ? { brief: description, confirm: true, allowRevisions: true } : { projectId: grant.projectId, grant: grant.token, changes: description } });
      if (work.cancelled || !S.voiceSession.active || S.voiceSession.projectWork !== work) return;
      if (!result.ok || !result.project?.id) throw new Error(result.error || 'Project was not saved.');
      if (mode === 'create') {
        if (result.grant?.token && Number.isFinite(result.grant.expiresAt)) S.voiceSession.projectGrant = { ...result.grant, projectId: result.project.id };
        else toast('Project was saved, but revision permission was not established.', 'info');
      } else { grant.projectId = result.project.id; grant.remaining = result.remaining; }
      setVoiceProjectStatus({ project: result.project });
      await voiceNotice(voiceProjectBengali() ? 'তিন ফাইলের প্রজেক্ট তৈরি করে সংরক্ষণ করেছি। প্রিভিউ দেখতে পারো। এটি প্রকাশ করা হয়নি।' : 'The three-file static project was saved. The preview is available. It is not published.');
    } catch (err) {
      if (!work.cancelled && S.voiceSession.active) { setVoiceProjectStatus({ message: err.message }); await voiceNotice(voiceProjectBengali() ? 'প্রজেক্টের কাজ সম্পন্ন হয়নি। বিস্তারিত স্ক্রিনে দেখো।' : 'The project could not be completed. See the screen for details.'); }
    } finally { if (S.voiceSession.projectWork === work) S.voiceSession.projectWork = null; }
  }
  async function setVoiceChatOnly(enabled) {
    if (!voiceCompanion || !S.voiceSession.active) return toast('Start voice conversation first.', 'info');
    if (S.busy) return toast('Wait for the current reply before changing modes.', 'info');
    const bn = voiceRecognitionLanguage() === 'bn-BD' || S.state.settings.language === 'bn';
    if (enabled && (S.voiceSession.pendingAction || S.voiceSession.pendingProject || S.voiceSession.projectWork || S.voiceSession.voicePlan)) {
      return voiceNotice(bn ? 'আগের কাজ বা অনুমতি আগে শেষ বা বাতিল করো, তারপর আড্ডা মোড চালু হবে।' : 'Finish or cancel the pending work before turning on chat-only mode.');
    }
    S.voiceSession.chatOnly = enabled;
    if (enabled) { revokeProjectGrant(); S.voiceSession.allowAppOpen = false; const button = $('#voice-app-permission'); if (button) button.textContent = 'Allow voice app opening for this session'; }
    const button = $('#voice-chat-only'), status = $('#voice-chat-status');
    if (button) { button.setAttribute('aria-pressed', String(enabled)); button.textContent = enabled ? 'আড্ডা মোড বন্ধ করো' : 'আড্ডা মোড চালু করো'; }
    if (status) status.textContent = enabled ? 'আড্ডা মোড: এই window-র chat থেকে desktop কাজ বা memory save হবে না। অন্য window ও বোতাম প্রভাবিত নয়।' : 'আড্ডা মোড বন্ধ। স্বাভাবিক কাজের অনুমতি নিয়ম চালু আছে।';
    await voiceNotice(bn ? (enabled ? 'আড্ডা মোড চালু। চলো গল্প করি! প্রতিবার নোভা বলে ডাকবে। এই আড্ডা থেকে desktop কাজ বা নতুন memory চালু হবে না।' : 'আড্ডা মোড বন্ধ করেছি। এখন আগের মতো কাজ চাইতে পারো।') : (enabled ? 'Chat-only mode is on. Let’s talk! Say Nova before each turn. This chat will not start desktop tasks or save new memories.' : 'Chat-only mode is off. You can request tasks again.'));
  }
  async function decideVoiceAction(text) {
    const pending = S.voiceSession.pendingAction;
    if (!pending) return false;
    const cleaned = text.toLowerCase().trim().replace(/[.!?।]+$/g, '').trim();
    const approve = ['approve', 'অনুমতি দিচ্ছি', 'অনুমতি দিলাম'].includes(cleaned);
    const cancel = ['cancel', 'বাতিল', 'বাতিল করো', 'না'].includes(cleaned);
    S.busy = true;
    try {
      if (Date.now() >= pending.expiresAt) {
        S.voiceSession.pendingAction = null;
        await api(`/actions/${encodeURIComponent(pending.id)}/cancel`, { method: 'POST', body: {} }).catch(() => {});
        await speak(S.state.settings.language === 'bn' ? 'অনুমতির সময় শেষ। আবার অনুরোধ করো।' : 'The approval expired. Please request it again.', true);
      } else if (approve || cancel) {
        S.voiceSession.pendingAction = null;
        const result = await api(`/actions/${encodeURIComponent(pending.id)}/${approve ? 'approve' : 'cancel'}`, { method: 'POST', body: {} });
        if (result.action) updateAction(result.action);
        const status = $('#voice-handsfree-status'); if (status) status.textContent = approve ? 'Approved and queued; check Activity for the result.' : 'Request cancelled.';
        await speak(S.state.settings.language === 'bn' ? (approve ? 'অনুমতি পেয়েছি, কাজটি পাঠিয়েছি। ফলাফল Activity-তে দেখো।' : 'অনুরোধ বাতিল করেছি।') : (approve ? 'Approved and queued. Check Activity for the result.' : 'Request cancelled.'), true);
      } else {
        await speak(S.state.settings.language === 'bn' ? 'আগের অনুরোধের জন্য নোভা অনুমতি দিচ্ছি অথবা নোভা বাতিল বলো।' : 'For the pending request, say Nova approve or Nova cancel.', true);
      }
    } catch (err) { S.voiceSession.pendingAction = null; toast(err.message, 'error'); await speak(S.state.settings.language === 'bn' ? 'কাজটি অনুমোদন করা যায়নি। Activity দেখো।' : 'The action could not be approved. Check Activity.', true); }
    finally { S.busy = false; if (S.voiceSession.active) scheduleVoiceTurn(); }
    return true;
  }
  function startVoice() {
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition) return modal('Voice input isn’t available here', `<div class="modal-icon">${icon('mic')}</div><p>This browser doesn’t support speech recognition. Try Chrome or Edge on HTTPS, or use the text box. Voice input may use your browser vendor’s speech service; it is not a local wake-word listener.</p><div class="modal-footer"><button class="btn btn-primary" data-close>Got it</button></div>`);
    if (S.listening) { if (S.voiceSession.active) stopVoiceConversation(); else S.recognition?.stop(); return; }
    if (S.view !== 'overview' && S.view !== 'conversation') navigate('conversation');
    const rec = new Recognition(); S.recognition = rec; S.listening = true;
    rec.lang = voiceCompanion ? voiceRecognitionLanguage() : S.state.settings.language === 'bn' ? 'bn-BD' : /[\u0980-\u09FF]/.test($('#chat-input')?.value || '') ? 'bn-BD' : 'en-US';
    rec.interimResults = true; rec.continuous = false;
    $$('.mic-button').forEach(b => b.classList.add('listening')); if ($('#core-state-text')) $('#core-state-text').textContent = 'LISTENING…';
    rec.onresult = e => {
      S.voiceSession.retryDelay = 800;
      let transcript = [...e.results].map(r => r[0].transcript).join('').trim();
      const final = e.results[e.results.length - 1].isFinal;
      if (S.voiceSession.active) {
        if (!final) return;
        const wake = transcript.match(/^\s*(?:(?:hey|হেই|আচ্ছা)\s+)?(?:nova\b|নোভা|নভা)(?=$|[\s,।.!?:-])(?:[\s,।.!?:-]*)([\s\S]*)$/i);
        if (wake) { transcript = wake[1].trim(); S.voiceSession.wakeUntil = transcript ? 0 : Date.now() + 12000; }
        else if (S.voiceSession.wakeUntil > Date.now()) { S.voiceSession.wakeUntil = 0; }
        else { rec.stop(); return; }
        if (!transcript) { toast('NOVA is listening for your request.', 'info'); rec.stop(); return; }
      } else if ($('#chat-input')) $('#chat-input').value = transcript;
      if (final) {
        rec.stop();
        if (S.voiceSession.active && /^(?:stop listening|stop voice|শোনা বন্ধ করো|শোনা বন্ধ|কথা শোনা বন্ধ করো)[।.!]?$/i.test(transcript)) { stopVoiceConversation(); speak(S.state.settings.language === 'bn' ? 'শোনা বন্ধ করেছি।' : 'Voice listening stopped.', true); }
        else if (voiceCompanion && S.voiceSession.active && /^(?:stop|stop project|stop work|stop plan|কাজ বন্ধ করো|কাজ থামাও|পরিকল্পনা বন্ধ করো|প্রজেক্ট বন্ধ করো|থামো)[।.!]?$/i.test(transcript)) { clearPendingProject(); stopVoiceProject(); stopVoicePlan(); voiceNotice(voiceRecognitionLanguage() === 'bn-BD' ? 'কাজ বা পরিকল্পনা থামানোর অনুরোধ দিয়েছি। ইতিমধ্যে চলা কাজ শেষ হতে পারে।' : 'Stop requested. An action or save already underway may finish.'); }
        else if (voiceCompanion && S.voiceSession.active && /^(?:(?:আড্ডা|গল্প)(?:\s*মোড)?\s*চালু(?: করো)?|(?:chat|friend) mode on)[।.!]?$/i.test(transcript)) setVoiceChatOnly(true);
        else if (voiceCompanion && S.voiceSession.active && /^(?:(?:আড্ডা|গল্প)(?:\s*মোড)?\s*বন্ধ(?: করো)?|(?:chat|friend) mode off)[।.!]?$/i.test(transcript)) setVoiceChatOnly(false);
        else if (voiceCompanion && S.voiceSession.active && S.voiceSession.voicePlan) decideVoicePlan(transcript);
        else if (voiceCompanion && S.voiceSession.active && S.voiceSession.pendingProject) decideVoiceProject(transcript);
        else if (voiceCompanion && S.voiceSession.active && S.voiceSession.pendingAction) decideVoiceAction(transcript);
        else if (voiceCompanion && S.voiceSession.active && !S.voiceSession.chatOnly && /^(?:plan (?:a goal|this|for)|পরিকল্পনা করো|পরিকল্পনা তৈরি করো)\s+/i.test(transcript)) prepareVoicePlan(transcript.replace(/^(?:plan (?:a goal|this|for)|পরিকল্পনা করো|পরিকল্পনা তৈরি করো)\s+/i, '').trim());
        else if (voiceCompanion && S.voiceSession.active && /^(?:খবর|নিউজ|news)\s*(?:সতর্কতা|alert|alerts)\s*(?:চালু(?: করো)?|start|on)[।.!]?$/i.test(transcript)) voiceAlertCommand(true);
        else if (voiceCompanion && S.voiceSession.active && /^(?:খবর|নিউজ|news)\s*(?:সতর্কতা|alert|alerts)\s*(?:বন্ধ(?: করো)?|stop|off)[।.!]?$/i.test(transcript)) voiceAlertCommand(false);
        else sendMessage(transcript, true);
      }
    };
    rec.onerror = e => {
      const messages = { 'not-allowed': 'Microphone permission was denied. Allow it in your browser settings.', 'no-speech': 'I didn’t catch that. Try again when you’re ready.', 'audio-capture': 'No microphone was found.', network: 'Speech service unavailable; retrying while voice is on.' };
      if (e.error === 'network' && S.voiceSession.active) {
        S.voiceSession.retryDelay = Math.min(30000, Math.max(2000, S.voiceSession.retryDelay * 2));
        if (Date.now() - S.voiceSession.lastNetworkWarning > 30000) { toast(messages.network, 'info'); S.voiceSession.lastNetworkWarning = Date.now(); }
        const status = $('#voice-handsfree-status'); if (status) status.textContent = messages.network;
      } else {
        if (e.error === 'no-speech') S.voiceSession.retryDelay = 800;
        if (e.error !== 'aborted' && (e.error !== 'no-speech' || !S.voiceSession.active)) toast(messages[e.error] || 'Voice input stopped. Please try again.', 'info');
        if (['not-allowed', 'audio-capture', 'service-not-allowed'].includes(e.error)) stopVoiceConversation();
      }
    };
    rec.onend = () => { if (S.recognition !== rec) return; S.recognition = null; S.listening = false; $$('.mic-button').forEach(b => b.classList.remove('listening')); if ($('#core-state-text')) $('#core-state-text').textContent = 'READY WHEN YOU ARE'; if (S.voiceSession.active && !S.busy) scheduleVoiceTurn(); };
    try { rec.start(); if (!S.voiceSession.active) toast('Listening. Speak now; tap the microphone again to stop.', 'info'); }
    catch {
      if (S.recognition === rec) S.recognition = null; S.listening = false;
      if (S.voiceSession.active) { S.voiceSession.retryDelay = Math.min(30000, Math.max(2000, S.voiceSession.retryDelay * 2)); const status = $('#voice-handsfree-status'); if (status) status.textContent = 'Microphone could not start; retrying. Check browser permissions if it continues.'; scheduleVoiceTurn(); }
      else toast('Could not start the microphone.', 'error');
    }
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
    const pages = [['overview', 'grid', 'Overview'], ['conversation', 'message', 'Conversation'], ['memory', 'brain', 'Memory vault'], ['world', 'globe', 'World monitor'], ['desktop', 'monitor', 'Desktop control'], ['activity', 'activity', 'Activity'], ['settings', 'settings', 'Settings']].map(([view, ic, label]) => ({ label, detail: 'Go to page', icon: ic, run: () => navigate(view) }));
    const actions = Object.entries(S.state.catalog).filter(([k]) => k !== 'whatsapp_draft' && !k.startsWith('keyboard_') && !k.startsWith('mouse_')).map(([kind, item]) => ({ label: item.label, detail: 'Desktop action · approval required', icon: item.icon, run: () => prepareAction(kind) }));
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
    if (el.dataset.persona && isOwner()) { try { const persona = el.dataset.persona; const names = { nova: 'NOVA', atlas: 'ATLAS', jarvis: 'JARVIS', mentor: 'MENTOR', custom: S.state.settings.customCharacterName || 'MY ASSISTANT' }; const data = await api('/settings', { method: 'PATCH', body: { persona, assistantName: names[persona], ...(persona === 'atlas' || persona === 'jarvis' ? { voiceGender: 'masculine' } : persona === 'nova' ? { voiceGender: 'feminine' } : {}) } }); S.state.settings = data.settings; renderShell(); renderSettings(); toast(`${data.settings.assistantName} is ready.`); } catch (err) { toast(err.message, 'error'); } return; }
    if (el.dataset.revokeRemote) return confirmDialog('Revoke this phone?', 'It will immediately lose access to this workspace.', 'Revoke access', async () => { await api('/remote/' + el.dataset.revokeRemote, { method: 'DELETE' }); S.state.remotes = S.state.remotes.filter(r => r.token_hash !== el.dataset.revokeRemote); renderRemoteDevices(); toast('Phone access revoked.'); });
    if (el.dataset.paletteIndex !== undefined) { const item = S.paletteItems[+el.dataset.paletteIndex]; closeModal(); return item?.run(); }
    const action = el.dataset.action; if (!action) return;
    const handlers = {
      workspace: () => navigate('settings'), palette: openPalette, help: helpModal, remote: remoteModal,
      'connect-desktop': () => navigate('desktop'), 'local-bridge': () => localBridgeModal(), 'local-bridge-disable': () => localBridgeModal(true), 'start-chat': () => { navigate('conversation'); $('#chat-input')?.focus(); },
      'goal-plan': goalPlanDialog, 'native-voice': nativeVoiceDialog, 'native-screen': nativeScreenDialog, 'native-screen-stop': stopNativeScreen, 'native-power': nativePowerDialog, 'native-power-cancel': cancelNativePower, voice: startVoice, 'continuous-voice': toggleVoiceConversation, 'voice-window': openVoiceWindow, 'voice-app-permission': voiceAppPermission, 'voice-chat-only': () => setVoiceChatOnly(!S.voiceSession.chatOnly), 'voice-news-alerts': voiceNewsAlerts, 'connect-ai': () => connectAiModal(), 'build-website': websiteBuilder, 'website-studio': websiteStudio, 'project-builder': projectBuilder, 'screen-viewer': screenShareModal, 'auto-work': autonomousWorkModal,
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
  window.addEventListener('hashchange', () => { const v = location.hash.slice(1); if (S.state && ['overview', 'conversation', 'memory', 'world', 'desktop', 'activity', 'settings'].includes(v) && v !== S.view) navigate(v); });
  boot();
})();
