/* Bloom — messages, notifications, network */
(function () {
  'use strict';
  const G = window.GZ, S = G.state, esc = G.esc;
  let pollTimer = null;

  /* ---------------- messages ---------------- */
  G.route('messages', async (parts) => {
    if (!G.requireUser()) return;
    const view = G.mountShell();
    G.setRail('');
    document.body.classList.add('chat-open');
    if (!G._chatCleanup) {
      G._chatCleanup = true;
      window.addEventListener('hashchange', () => {
        if (!(location.hash || '').startsWith('#/messages')) document.body.classList.remove('chat-open');
      });
    }
    const activeId = parts[0] ? Number(parts[0]) : null;
    view.innerHTML = `<div class="card chat-shell ${activeId ? 'has-active' : ''}" style="overflow:hidden">
      <div class="conv-list">
        <div class="pad" style="padding:12px"><input class="input" id="csearch" placeholder="Search conversations" aria-label="Search conversations"></div>
        <div id="clist">${G.skeletonList(4)}</div>
      </div>
      <div class="chat-main" id="cmain"></div></div>`;

    const listBox = G.qs('#clist', view);
    async function loadList(q) {
      try {
        const { conversations } = await G.get('/conversations' + (q ? '?q=' + encodeURIComponent(q) : ''));
        listBox.innerHTML = '';
        if (!conversations.length) {
          listBox.innerHTML = G.emptyState('💬', 'No conversations yet', 'Start a chat from someone\'s profile.',
            '<div style="margin-top:10px"><a class="btn btn-sm btn-primary" href="#/explore?tab=people">Find people</a></div>');
          return;
        }
        conversations.forEach((c) => {
          const node = G.el(`<a class="conv ${activeId === c.id ? 'on' : ''}" href="#/messages/${c.id}">
            ${G.avatar({ full_name: c.full_name, avatar: c.avatar, username: c.username }, 44)}
            <div class="grow" style="min-width:0">
              <div class="between"><span class="bold small">${esc(c.full_name)}</span><span class="tiny muted">${c.last_message_at ? G.timeAgo(c.last_message_at) : ''}</span></div>
              <div class="tiny muted" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">
                ${c.last_sender === S.user.id ? 'You: ' : ''}${esc(c.last_body || (c.last_media ? '📎 Attachment' : 'No messages yet'))}</div>
            </div>
            ${c.unread ? `<span class="cnt" style="background:var(--brand-3);color:#fff;padding:1px 7px;border-radius:99px;font-size:11px">${c.unread}</span>` : ''}</a>`);
          listBox.appendChild(node);
        });
      } catch (e) { listBox.innerHTML = G.errorState(e.message); }
    }
    let t;
    G.qs('#csearch', view).oninput = (e) => { clearTimeout(t); t = setTimeout(() => loadList(e.target.value.trim()), 250); };
    loadList('');

    const main = G.qs('#cmain', view);
    if (!activeId) {
      main.innerHTML = G.emptyState('✉️', 'Select a conversation', 'Your messages are private and only visible to you and the recipient.');
      return;
    }
    openChat(main, activeId);
  });

  async function openChat(main, id) {
    main.innerHTML = `<div class="pad">${G.skeletonList(3)}</div>`;
    let lastId = 0, other = null;
    try {
      const data = await G.get(`/conversations/${id}/messages`);
      other = data.other;
      main.innerHTML = `
        <div class="row pad" style="border-bottom:1px solid var(--border);padding:10px 14px">
          <a class="btn btn-sm btn-quiet chat-back" href="#/messages" aria-label="Back to conversations">${G.icon('back', 18)}</a>
          <a href="#/u/${esc(other.username)}">${G.avatar(other, 38)}</a>
          <div class="grow"><a class="bold small" href="#/u/${esc(other.username)}">${esc(other.full_name)}</a>
            <div class="tiny muted">@${esc(other.username)}</div></div>
          <button class="iconbtn" id="chat-del" title="Delete conversation" aria-label="Delete conversation">${G.icon('trash', 18)}</button>
        </div>
        <div class="chat-body" id="cbody"></div>
        <div class="emoji-bar" id="ebar" hidden>${['😀', '😂', '🔥', '👍', '🎮', '💼', '🚀', '❤️', '😎', '🙌', '✅', '🙏'].map((e) => `<button type="button" aria-label="Insert ${e}">${e}</button>`).join('')}</div>
        <form class="chat-input" id="cform">
          <label class="btn btn-ghost btn-icon" title="Attach file" style="cursor:pointer">${G.icon('image', 18)}<input type="file" id="cfile" hidden accept="image/*,video/*,.pdf,.txt"></label>
          <button type="button" class="btn btn-ghost btn-icon" id="etoggle" title="Emoji" aria-label="Emoji">🙂</button>
          <textarea class="textarea grow" id="cmsg" rows="1" style="min-height:44px;max-height:110px" placeholder="Write a message…" aria-label="Message"></textarea>
          <button class="btn btn-primary" type="submit" aria-label="Send">${G.icon('send', 18)}<span class="lbl-send">${esc(G.t('Send'))}</span></button>
        </form>`;
      const body = G.qs('#cbody', main);
      const render = (msgs) => {
        msgs.forEach((m) => {
          lastId = Math.max(lastId, m.id);
          const mine = m.sender_id === S.user.id;
          body.appendChild(G.el(`<div class="msg ${mine ? 'mine' : ''}">
            ${m.body ? `<div>${G.linkify(m.body)}</div>` : ''}
            ${m.media_url ? (m.media_type === 'image' ? `<img src="${esc(m.media_url)}" alt="Attachment" style="max-width:230px;border-radius:10px;margin-top:4px">`
              : m.media_type === 'video' ? `<video src="${esc(m.media_url)}" controls style="max-width:230px;border-radius:10px;margin-top:4px"></video>`
              : `<a class="link small" href="${esc(m.media_url)}" target="_blank" rel="noopener">📎 Open attachment</a>`) : ''}
            <div class="mt">${new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}${mine && m.created_at <= (data.other_last_read || 0) ? ' · Read' : ''}</div></div>`));
        });
        body.scrollTop = body.scrollHeight;
      };
      if (!data.messages.length) body.innerHTML = '<p class="center small muted" style="margin:auto">No messages yet. Say hi 👋</p>';
      render(data.messages);

      const ebar = G.qs('#ebar', main);
      G.qs('#etoggle', main).onclick = () => { ebar.hidden = !ebar.hidden; if (!ebar.hidden) body.scrollTop = body.scrollHeight; };
      G.qsa('#ebar button', main).forEach((b) => b.onclick = () => { const ta = G.qs('#cmsg', main); ta.value += b.textContent; ta.focus(); });
      const ta0 = G.qs('#cmsg', main);
      ta0.addEventListener('input', () => { ta0.style.height = 'auto'; ta0.style.height = Math.min(ta0.scrollHeight, 110) + 'px'; });
      ta0.addEventListener('focus', () => setTimeout(() => { body.scrollTop = body.scrollHeight; }, 250));
      G.qs('#chat-del', main).onclick = async () => {
        if (!(await G.confirm('Delete conversation', 'This hides the conversation from your inbox.', 'Delete'))) return;
        try { await G.del('/conversations/' + id); location.hash = '#/messages'; } catch (e) { G.err(e); }
      };
      let pendingFile = null;
      G.qs('#cfile', main).onchange = async (e) => {
        if (!e.target.files.length) return;
        try { pendingFile = (await G.uploadFiles(e.target.files))[0]; G.toast('Attachment ready — press Send', 'ok'); }
        catch (err) { G.err(err); }
      };
      const form = G.qs('#cform', main);
      form.onsubmit = async (e) => {
        e.preventDefault();
        const ta = G.qs('#cmsg', main);
        const v = ta.value.trim();
        if (!v && !pendingFile) return;
        const btn = form.querySelector('button[type=submit]');
        btn.disabled = true;
        try {
          const payload = { body: v };
          if (pendingFile) { payload.media_url = pendingFile.url; payload.media_type = pendingFile.type; }
          const r = await G.post(`/conversations/${id}/messages`, payload);
          if (body.querySelector('p')) body.innerHTML = '';
          ta.value = ''; ta.style.height = 'auto'; pendingFile = null;
          render([r.message]);
          body.scrollTop = body.scrollHeight;
          ta.focus();
        } catch (err) { G.err(err); }
        btn.disabled = false;
      };
      G.qs('#cmsg', main).addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey && window.innerWidth > 860) { e.preventDefault(); form.requestSubmit(); }
      });

      clearInterval(pollTimer);
      pollTimer = setInterval(async () => {
        if (S.route.name !== 'messages' || String(S.route.parts[1]) !== String(id)) { clearInterval(pollTimer); return; }
        try {
          const d = await G.get(`/conversations/${id}/messages?after=${lastId}`);
          if (d.messages.length) { if (body.querySelector('p')) body.innerHTML = ''; render(d.messages); }
        } catch (e) {}
      }, 4000);
    } catch (e) {
      main.innerHTML = G.errorState(e.message);
    }
  }

  /* ---------------- notifications ---------------- */
  const ICONS = { like: '❤️', comment: '💬', reply: '↩️', follow: '➕', connect: '🤝', message: '✉️', group: '👥', mention: '📣', repost: '🔁', event: '📅' };

  G.route('notifications', async () => {
    if (!G.requireUser()) return;
    const view = G.mountShell();
    view.innerHTML = `<div class="card pad between"><h2 style="margin:0;font-size:19px">${esc(G.t('Notifications'))}</h2>
      <button class="btn btn-ghost btn-sm" id="mark-all">Mark all as read</button></div><div id="nlist" style="margin-top:14px">${G.skeletonList(4)}</div>`;
    const box = G.qs('#nlist', view);
    async function load() {
      try {
        const { notifications } = await G.get('/notifications');
        box.innerHTML = '';
        if (!notifications.length) { box.innerHTML = G.emptyState('🔔', 'No notifications yet', 'Interactions with your posts and profile will show up here.'); return; }
        notifications.forEach((n) => {
          const node = G.el(`<div class="card pad row" style="margin-bottom:10px;cursor:pointer;${n.is_read ? '' : 'border-left:3px solid var(--brand-1)'}">
            <div style="font-size:20px">${ICONS[n.type] || '🔔'}</div>
            ${n.username ? G.avatar(n, 36) : ''}
            <div class="grow"><div class="small">${esc(n.text)}</div><div class="tiny muted">${G.timeAgo(n.created_at)}</div></div>
            ${n.is_read ? '' : '<span class="pill">New</span>'}</div>`);
          node.onclick = async () => {
            try { await G.post(`/notifications/${n.id}/read`); } catch (e) {}
            G.refreshBadges();
            if (n.link) location.hash = n.link;
            else G.render();
          };
          box.appendChild(node);
        });
      } catch (e) { box.innerHTML = G.errorState(e.message); }
    }
    G.qs('#mark-all', view).onclick = async () => {
      try { await G.post('/notifications/read-all'); G.refreshBadges(); load(); G.toast('All caught up', 'ok'); } catch (e) { G.err(e); }
    };
    load();
    G.buildRail();
  });

  /* ---------------- network ---------------- */
  G.route('network', async (parts, query) => {
    if (!G.requireUser()) return;
    const view = G.mountShell();
    const tab = query.tab || 'connections';
    view.innerHTML = `<div class="card"><div class="pad"><h2 style="margin:0;font-size:19px">${esc(G.t('Network'))}</h2>
        <p class="muted small" style="margin:4px 0 0">Manage connections, requests and people you follow.</p></div>
      <div class="tabs">${[['connections', 'Connections'], ['incoming', 'Requests'], ['outgoing', 'Sent'], ['suggested', 'Suggested']].map(([k, l]) =>
        `<button class="tab ${tab === k ? 'on' : ''}" data-t="${k}">${l}</button>`).join('')}</div></div>
      <div id="nwbox" style="margin-top:14px">${G.skeletonList(3)}</div>`;
    G.qsa('[data-t]', view).forEach((b) => b.onclick = () => { location.hash = '#/network?tab=' + b.dataset.t; });
    const box = G.qs('#nwbox', view);
    try {
      if (tab === 'suggested') {
        const { users } = await G.get('/users/suggestions?limit=20');
        box.innerHTML = '';
        if (!users.length) box.innerHTML = G.emptyState('🧭', 'No suggestions yet', 'Add interests in settings to get better matches.');
        const stack = G.el('<div class="stack"></div>');
        users.forEach((u) => stack.appendChild(G.userCard(u)));
        box.appendChild(stack);
      } else {
        const data = await G.get('/users/me/connections');
        const list = data[tab] || [];
        box.innerHTML = '';
        if (!list.length) {
          box.innerHTML = G.emptyState('🤝', tab === 'connections' ? 'No connections yet' : tab === 'incoming' ? 'No pending requests' : 'No sent requests',
            'Connect with people to build your Bloom network.',
            '<div style="margin-top:10px"><a class="btn btn-sm btn-primary" href="#/network?tab=suggested">See suggestions</a></div>');
          return;
        }
        const stack = G.el('<div class="stack"></div>');
        list.forEach((u) => {
          const card = G.el(`<div class="card pad row">
            <a href="#/u/${esc(u.username)}">${G.avatar(u, 44)}</a>
            <div class="grow"><a class="bold" href="#/u/${esc(u.username)}">${esc(u.full_name)}</a>
              <div class="tiny muted">@${esc(u.username)}</div></div>
            <div class="row" data-actions></div></div>`);
          const a = G.qs('[data-actions]', card);
          const mk = (cls, label, action) => {
            const b = G.el(`<button class="btn btn-sm ${cls}">${label}</button>`);
            b.onclick = async () => {
              b.disabled = true;
              try { await G.post(`/users/connections/${u.connection_id}/respond`, { action }); card.remove(); G.refreshBadges(); G.toast('Done', 'ok'); }
              catch (e) { G.err(e); b.disabled = false; }
            };
            a.appendChild(b);
          };
          if (tab === 'incoming') { mk('btn-primary', 'Accept', 'accept'); mk('btn-ghost', 'Decline', 'decline'); }
          else if (tab === 'outgoing') mk('btn-ghost', 'Cancel', 'cancel');
          else {
            const msg = G.el('<button class="btn btn-sm btn-ghost">💬</button>');
            msg.onclick = async () => { try { const r = await G.post('/conversations/start', { user_id: u.id }); location.hash = '#/messages/' + r.conversation_id; } catch (e) { G.err(e); } };
            a.appendChild(msg);
            mk('btn-ghost', 'Remove', 'remove');
          }
          stack.appendChild(card);
        });
        box.appendChild(stack);
      }
    } catch (e) { box.innerHTML = G.errorState(e.message); }
    G.buildRail();
  });
})();
