/* Gen-Z Hub — Arena: XP dashboard, daily missions, badges, leaderboards, challenges,
   Poll Arena, Idea Arena and the interest-hub directory. Same VOLT design language. */
(function () {
  'use strict';
  const G = window.GZ, S = G.state, esc = G.esc;

  /* ================================================================ HUBS directory */
  G.route('hubs', async () => {
    const view = G.mountShell();
    view.innerHTML = `<section class="greet rise">
        <h1>Interest hubs</h1><div class="sub">One account, many worlds — follow as many as you like.</div>
      </section><div id="hb" style="margin-top:16px">${G.skeletonList(4)}</div>`;
    const d = await G.get('/hubs');
    G.qs('#hb', view).innerHTML = `<div class="showcase">${d.hubs.map((h) => `
      <div class="project-card"><div class="project-body">
        <div class="between"><div style="font-size:30px">${esc(h.emoji)}</div>
          ${h.joined ? '<span class="pill">Joined</span>' : ''}</div>
        <a class="bold" style="font-size:16px;display:block;margin-top:6px" href="#/hub/${esc(h.slug)}">${esc(h.name)}</a>
        <div class="small muted">${esc(h.tagline || '')}</div>
        <div class="tiny muted" style="margin-top:8px">${h.members} member(s) · ${h.communities} communities</div>
        <button class="btn ${h.joined ? 'btn-ghost' : 'btn-primary'} btn-block" style="margin-top:12px" data-join="${esc(h.slug)}">${h.joined ? 'Leave hub' : 'Join hub'}</button>
      </div></div>`).join('')}</div>`;
    G.qsa('[data-join]', view).forEach((b) => b.onclick = async () => {
      if (!G.requireUser()) return;
      try { const r = await G.post(`/hubs/${b.dataset.join}/join`, {}); G.toast(r.joined ? 'Joined hub ✓' : 'Left hub'); G.render(); }
      catch (e) { G.err(e); }
    });
  });

  G.route('hub', async (parts) => {
    const view = G.mountShell();
    view.innerHTML = G.skeletonPost();
    const d = await G.get('/hubs/' + parts[0]);
    const h = d.hub;
    view.innerHTML = `
      <section class="greet rise">
        <div class="between wrap" style="align-items:flex-start">
          <div><h1>${esc(h.emoji)} ${esc(h.name)}</h1><div class="sub">${esc(h.tagline || '')}</div>
            <div class="tiny muted" style="margin-top:6px">${h.members} member(s)</div></div>
          <button class="btn ${h.joined ? 'btn-ghost' : 'btn-primary'}" id="hjoin">${h.joined ? 'Leave hub' : 'Join hub'}</button>
        </div>
        <div class="quick">
          <a class="chip" href="#/shop?hub=${esc(h.slug)}">🛍️ Shop this hub</a>
          <a class="chip" href="#/arena?tab=challenges">🏆 Challenges</a>
          <a class="chip" href="#/ideas">💡 Ideas</a>
          <a class="chip" href="#/polls">📊 Polls</a>
        </div>
      </section>
      ${d.communities.length ? `<div class="card" style="margin-top:16px"><h2 style="font-size:17px;margin:0 0 10px">Communities</h2>
        <div class="row wrap" style="gap:8px">${d.communities.map((c) => `<a class="pill" href="#/c/${esc(c.slug)}">${esc(c.name)} · ${c.member_count}</a>`).join('')}</div></div>` : ''}
      ${d.products.length ? `<div style="margin-top:16px"><h2 style="font-size:17px;margin:0 0 10px">Products in this hub</h2>
        <div class="showcase">${d.products.map((p) => `<a class="project-card" href="#/product/${p.id}" style="text-decoration:none;color:inherit">
          <div style="aspect-ratio:1/1;background:var(--surface-2)">${p.image ? `<img src="${esc(p.image)}" alt="" style="width:100%;height:100%;object-fit:cover">` : ''}</div>
          <div class="project-body"><div class="bold small">${esc(p.title)}</div><div class="bold">৳${p.price}</div></div></a>`).join('')}</div></div>` : ''}
      ${d.people.length ? `<div class="card" style="margin-top:16px"><h2 style="font-size:17px;margin:0 0 10px">People in this hub</h2>
        ${d.people.map((u) => `<a class="row" href="#/u/${esc(u.username)}" style="gap:10px;padding:8px 0;text-decoration:none;color:inherit">
          ${G.avatar(u, 36)}<div><div class="bold small">${esc(u.full_name)}</div><div class="tiny muted">@${esc(u.username)}</div></div></a>`).join('')}</div>` : ''}`;
    G.qs('#hjoin', view).onclick = async () => {
      if (!G.requireUser()) return;
      await G.post(`/hubs/${h.slug}/join`, {}); G.render();
    };
  });

  /* ================================================================ ARENA (XP hub) */
  G.route('arena', async (parts, query) => {
    if (!G.requireUser()) return;
    const view = G.mountShell();
    const tab = query.tab || 'overview';
    view.innerHTML = `<section class="greet rise" style="background:linear-gradient(135deg,color-mix(in srgb,var(--volt) 16%,var(--surface)),var(--surface) 60%,color-mix(in srgb,var(--iris) 15%,var(--surface)))">
        <div class="between wrap" style="align-items:flex-start">
          <div><h1>Arena 🏆</h1><div class="sub">XP, daily missions, badges, leaderboards and challenges.</div></div>
          <button class="btn btn-primary" id="new-challenge">${G.icon('plus', 16)} Create challenge</button>
        </div>
        <div class="quick">
          <a class="chip ${tab === 'overview' ? 'on' : ''}" href="#/arena?tab=overview">Overview</a>
          <a class="chip ${tab === 'challenges' ? 'on' : ''}" href="#/arena?tab=challenges">Challenges</a>
          <a class="chip ${tab === 'leaderboard' ? 'on' : ''}" href="#/arena?tab=leaderboard">Leaderboard</a>
          <a class="chip ${tab === 'badges' ? 'on' : ''}" href="#/arena?tab=badges">Badges</a>
        </div>
      </section>
      <div id="abody" style="margin-top:16px">${G.skeletonList(3)}</div>`;
    G.qs('#new-challenge', view).onclick = () => challengeModal();
    const body = G.qs('#abody', view);

    if (tab === 'challenges') {
      const d = await G.get('/challenges');
      body.innerHTML = d.challenges.length ? `<div class="showcase">${d.challenges.map((c) => `
        <div class="project-card"><div class="project-body">
          <div class="between"><span class="pill">${esc(c.category)}</span><span class="pill">${esc(c.status)}</span></div>
          <a class="bold" style="display:block;font-size:16px;margin-top:8px" href="#/challenge/${esc(c.slug)}">${esc(c.title)}</a>
          <div class="small muted">${esc((c.description || '').slice(0, 110))}</div>
          <div class="tiny muted" style="margin-top:8px">${c.entries} entries · +${c.xp_reward} XP${c.ends_at ? ' · ends ' + new Date(c.ends_at).toLocaleDateString() : ''}</div>
        </div></div>`).join('')}</div>` : G.emptyState('🏆', 'No challenges yet', 'Create the first one for the community.');
    } else if (tab === 'leaderboard') {
      const board = query.board || 'overall';
      const d = await G.get(`/arena/leaderboard?board=${encodeURIComponent(board)}&range=${encodeURIComponent(query.range || '30d')}`);
      body.innerHTML = `<div class="row wrap" style="gap:8px;margin-bottom:12px">
          ${d.boards.map((b) => `<a class="chip ${board === b.key ? 'on' : ''}" href="#/arena?tab=leaderboard&board=${b.key}">${esc(b.label)}</a>`).join('')}</div>
        <div class="card"><div class="tiny muted" style="margin-bottom:10px">${esc(d.label)} · last 30 days · ranking = XP earned from the listed actions only</div>
        ${d.rows.length ? d.rows.map((u, i) => `<a class="row" href="#/u/${esc(u.username)}" style="gap:10px;padding:10px 0;border-bottom:1px solid var(--line-soft);text-decoration:none;color:inherit">
            <span class="bold" style="width:28px">${i + 1}</span>${G.avatar(u, 36)}
            <div class="grow"><div class="bold small">${esc(u.full_name)}</div><div class="tiny muted">Level ${u.level || 1} · ${u.xp || 0} XP total</div></div>
            <span class="pill">${u.score} pts</span></a>`).join('') : '<div class="small muted">No activity in this period yet.</div>'}</div>`;
    } else if (tab === 'badges') {
      const d = await G.get('/arena/badges');
      body.innerHTML = `<div class="showcase">${d.badges.map((b) => `
        <div class="project-card" style="${b.earned ? '' : 'opacity:.55'}"><div class="project-body">
          <div style="font-size:30px">${esc(b.emoji)}</div>
          <div class="bold" style="margin-top:6px">${esc(b.name)}</div>
          <div class="small muted">${esc(b.description)}</div>
          <div class="tiny muted" style="margin-top:8px">${b.earned ? '✓ Unlocked' : 'Locked'}</div>
        </div></div>`).join('')}</div>`;
    } else {
      const d = await G.get('/arena/me');
      const st = d.stats;
      body.innerHTML = `
        <div class="card">
          <div class="between wrap"><div><div class="bold" style="font-size:20px">Level ${st.level}</div>
            <div class="tiny muted">${st.xp} XP total · ${st.streak_days} day streak 🔥</div></div>
            <div class="row wrap" style="gap:6px">${st.badges.slice(0, 6).map((b) => `<span class="pill" title="${esc(b.name)}">${esc(b.emoji)}</span>`).join('')}</div></div>
          <div style="height:10px;background:var(--surface-2);border-radius:6px;overflow:hidden;margin-top:12px">
            <div style="height:100%;width:${Math.round(st.progress * 100)}%;background:linear-gradient(90deg,var(--volt),var(--iris))"></div></div>
          <div class="tiny muted" style="margin-top:6px">${st.xp - st.level_floor} / ${st.level_ceil - st.level_floor} XP to level ${st.level + 1}</div>
        </div>
        <div class="card" style="margin-top:16px">
          <h2 style="font-size:17px;margin:0 0 12px">Daily missions</h2>
          ${d.missions.map((m) => `<div class="row wrap" style="gap:10px;padding:10px 0;border-bottom:1px solid var(--line-soft)">
            <div class="grow"><div class="bold small">${esc(m.title)}</div><div class="tiny muted">${esc(m.description)} · +${m.xp_reward} XP</div>
              <div style="height:6px;background:var(--surface-2);border-radius:4px;overflow:hidden;margin-top:6px;max-width:240px">
                <div style="height:100%;width:${Math.round((m.progress / m.target) * 100)}%;background:var(--volt)"></div></div></div>
            ${m.claimed ? '<span class="pill">Claimed ✓</span>'
        : m.progress >= m.target ? `<button class="btn btn-primary btn-sm" data-claim="${m.id}">Claim</button>`
          : `<span class="tiny muted">${m.progress}/${m.target}</span>`}
          </div>`).join('')}
        </div>
        <div class="card" style="margin-top:16px">
          <h2 style="font-size:17px;margin:0 0 10px">How XP works</h2>
          <div class="row wrap" style="gap:8px">${d.rules.map((r) => `<span class="pill">${esc(r.action.replace(/_/g, ' '))} +${r.xp} (max ${r.daily_cap}/day)</span>`).join('')}</div>
          <div class="tiny muted" style="margin-top:10px">Daily caps and one-payout-per-item rules keep the leaderboard fair — spam earns nothing.</div>
        </div>`;
      G.qsa('[data-claim]', body).forEach((b) => b.onclick = async () => {
        try { const r = await G.post(`/arena/missions/${b.dataset.claim}/claim`, {}); G.toast(`+${r.reward} XP 🎉`, 'ok'); G.render(); }
        catch (e) { G.err(e); }
      });
    }
  });

  G.route('challenge', async (parts) => {
    const view = G.mountShell();
    view.innerHTML = G.skeletonPost();
    const d = await G.get('/challenges/' + parts[0]);
    const c = d.challenge;
    view.innerHTML = `
      <section class="greet rise">
        <div class="between wrap" style="align-items:flex-start">
          <div><h1>${esc(c.title)}</h1><div class="sub">${esc(c.description || '')}</div>
            <div class="tiny muted" style="margin-top:8px">${esc(c.category)} · ${c.entries} entries · +${c.xp_reward} XP · ${esc(c.status)}</div></div>
          ${c.status === 'open' && !d.my_entry ? '<button class="btn btn-primary" id="enter">Submit entry</button>' : ''}
        </div>
      </section>
      <div style="margin-top:16px">${d.entries.length ? d.entries.map((e) => `
        <div class="card" style="margin-bottom:12px">
          <div class="row" style="gap:10px;align-items:flex-start">${G.avatar(e, 40)}
            <div class="grow"><div class="bold small">${esc(e.full_name)} ${e.winner ? '<span class="pill">🏆 Winner</span>' : ''}</div>
              <div class="tiny muted">${G.timeAgo(e.created_at)}</div>
              ${e.title ? `<div class="bold" style="margin-top:6px">${esc(e.title)}</div>` : ''}
              <div class="small" style="white-space:pre-wrap;margin-top:4px">${esc(e.body)}</div>
              ${e.link_url ? `<a class="small" href="${esc(e.link_url)}" target="_blank" rel="noopener nofollow">${esc(e.link_url)}</a>` : ''}</div>
            <button class="btn ${e.voted ? 'btn-primary' : 'btn-ghost'} btn-sm" data-vote="${e.id}">▲ ${e.votes}</button></div>
        </div>`).join('') : G.emptyState('🎯', 'No entries yet', 'Be the first to submit.')}</div>`;
    const en = G.qs('#enter', view);
    if (en) en.onclick = () => entryModal(c.slug);
    G.qsa('[data-vote]', view).forEach((b) => b.onclick = async () => {
      if (!G.requireUser()) return;
      try { const r = await G.post(`/challenges/entries/${b.dataset.vote}/vote`, {}); b.textContent = '▲ ' + r.votes; b.className = 'btn btn-sm ' + (r.voted ? 'btn-primary' : 'btn-ghost'); }
      catch (e) { G.err(e); }
    });
  });

  function challengeModal() {
    if (!G.requireUser()) return;
    const m = G.modal('Create a challenge', `
      <div class="field"><label class="label" for="ch-title">Title</label><input class="input" id="ch-title" maxlength="120" placeholder="e.g. 7-day design sprint"></div>
      <div class="field"><label class="label" for="ch-cat">Category</label><select class="select" id="ch-cat">
        ${['Creative', 'Gaming', 'Football', 'Business', 'Coding', 'Design', 'Video editing', 'Quiz', 'Fitness'].map((c) => `<option>${c}</option>`).join('')}</select></div>
      <div class="field"><label class="label" for="ch-desc">Rules & description</label><textarea class="textarea" id="ch-desc" maxlength="3000" style="min-height:110px"></textarea></div>
      <div class="row wrap" style="gap:10px">
        <div class="field grow"><label class="label" for="ch-days">Runs for (days)</label><input class="input" id="ch-days" type="number" min="1" max="60" value="14"></div>
        <div class="field grow"><label class="label" for="ch-xp">XP reward</label><input class="input" id="ch-xp" type="number" min="10" max="500" value="100"></div>
      </div>
      <div class="tiny muted">Keep challenges safe and positive — dangerous or harmful challenges are removed by moderators.</div>
      <div class="err" id="ch-err" hidden></div>
      <div class="row" style="justify-content:flex-end;margin-top:10px"><button class="btn btn-primary" id="ch-go">Create</button></div>`);
    G.qs('#ch-go', m.body).onclick = async (e) => {
      const err = G.qs('#ch-err', m.body); err.hidden = true; e.target.disabled = true;
      try {
        const r = await G.post('/challenges', {
          title: G.qs('#ch-title', m.body).value, category: G.qs('#ch-cat', m.body).value,
          description: G.qs('#ch-desc', m.body).value, days: G.qs('#ch-days', m.body).value, xp_reward: G.qs('#ch-xp', m.body).value,
        });
        m.close(); G.toast('Challenge created 🏆', 'ok'); location.hash = '#/challenge/' + r.challenge.slug;
      } catch (ex) { err.textContent = ex.message; err.hidden = false; e.target.disabled = false; }
    };
  }

  function entryModal(slug) {
    if (!G.requireUser()) return;
    const m = G.modal('Submit your entry', `
      <div class="field"><label class="label" for="en-title">Title (optional)</label><input class="input" id="en-title" maxlength="120"></div>
      <div class="field"><label class="label" for="en-body">Your entry</label><textarea class="textarea" id="en-body" style="min-height:120px" maxlength="3000"></textarea></div>
      <div class="field"><label class="label" for="en-link">Link (optional)</label><input class="input" id="en-link" placeholder="https://…"></div>
      <div class="err" id="en-err" hidden></div>
      <div class="row" style="justify-content:flex-end"><button class="btn btn-primary" id="en-go">Submit</button></div>`);
    G.qs('#en-go', m.body).onclick = async (e) => {
      const err = G.qs('#en-err', m.body); err.hidden = true; e.target.disabled = true;
      try {
        const r = await G.post(`/challenges/${slug}/entries`, {
          title: G.qs('#en-title', m.body).value, body: G.qs('#en-body', m.body).value, link_url: G.qs('#en-link', m.body).value,
        });
        m.close(); G.toast(`Entry submitted${r.xp && r.xp.awarded ? ` · +${r.xp.awarded} XP` : ''} 🎯`, 'ok'); G.render();
      } catch (ex) { err.textContent = ex.message; err.hidden = false; e.target.disabled = false; }
    };
  }

  /* ================================================================ POLL ARENA */
  G.route('polls', async () => {
    const view = G.mountShell();
    view.innerHTML = `<section class="greet rise">
        <div class="between wrap"><div><h1>Poll Arena 📊</h1><div class="sub">Ask the community anything — see what Gen-Z actually thinks.</div></div>
        <button class="btn btn-primary" id="new-poll">${G.icon('plus', 16)} Create poll</button></div>
      </section><div id="pl" style="margin-top:16px">${G.skeletonList(3)}</div>`;
    G.qs('#new-poll', view).onclick = () => pollModal();
    const d = await G.get('/polls');
    const box = G.qs('#pl', view);
    const drawPoll = (p) => `<div class="card" style="margin-bottom:12px" data-poll="${p.id}">
      <div class="row" style="gap:10px">${G.avatar(p, 36)}
        <div class="grow"><div class="bold small">${esc(p.full_name)}</div><div class="tiny muted">${G.timeAgo(p.created_at)} · ${p.total_votes} votes${p.closed ? ' · closed' : ''}</div></div></div>
      <div class="bold" style="margin:12px 0 10px;font-size:16px">${esc(p.question)}</div>
      ${p.options.map((o) => `<button class="poll-opt" data-vote="${o.id}" ${p.voted || p.closed ? 'disabled' : ''}
        style="width:100%;text-align:left;border:1px solid var(--line-soft);background:var(--surface-2);border-radius:12px;padding:10px 12px;margin-bottom:8px;cursor:${p.voted || p.closed ? 'default' : 'pointer'};position:relative;overflow:hidden;color:inherit">
        <span style="position:absolute;inset:0 auto 0 0;width:${p.voted || p.closed ? o.pct : 0}%;background:color-mix(in srgb,var(--volt) 28%,transparent)"></span>
        <span style="position:relative;display:flex;justify-content:space-between;font-size:13.5px;font-weight:600">
          <span>${esc(o.label)}${p.my_options.includes(o.id) ? ' ✓' : ''}</span>${p.voted || p.closed ? `<span>${o.pct}%</span>` : ''}</span></button>`).join('')}
    </div>`;
    const render = (polls) => {
      box.innerHTML = polls.length ? polls.map(drawPoll).join('') : G.emptyState('📊', 'No polls yet', 'Create the first poll.');
      G.qsa('[data-vote]', box).forEach((b) => b.onclick = async () => {
        if (!G.requireUser()) return;
        const pid = b.closest('[data-poll]').dataset.poll;
        try {
          const r = await G.post(`/polls/${pid}/vote`, { option_id: Number(b.dataset.vote) });
          const el = G.el(drawPoll(r.poll));
          b.closest('[data-poll]').replaceWith(el);
          G.qsa('[data-vote]', el).forEach((x) => x.disabled = true);
        } catch (e) { G.err(e); }
      });
    };
    render(d.polls);
  });

  function pollModal() {
    if (!G.requireUser()) return;
    const m = G.modal('Create a poll', `
      <div class="field"><label class="label" for="po-q">Question</label><input class="input" id="po-q" maxlength="200" placeholder="Which game do you play most?"></div>
      <div id="po-opts">
        ${[0, 1].map((i) => `<div class="field"><label class="label" for="po-o${i}">Option ${i + 1}</label><input class="input po-o" id="po-o${i}" maxlength="80"></div>`).join('')}
      </div>
      <button class="btn btn-ghost btn-sm" id="po-add">+ Add option</button>
      <div class="field" style="margin-top:12px"><label class="label" for="po-hours">Closes after (hours)</label><input class="input" id="po-hours" type="number" min="1" max="720" value="72"></div>
      <div class="err" id="po-err" hidden></div>
      <div class="row" style="justify-content:flex-end"><button class="btn btn-primary" id="po-go">Publish poll</button></div>`);
    G.qs('#po-add', m.body).onclick = () => {
      const n = G.qsa('.po-o', m.body).length;
      if (n >= 6) return;
      G.qs('#po-opts', m.body).appendChild(G.el(`<div class="field"><label class="label" for="po-o${n}">Option ${n + 1}</label><input class="input po-o" id="po-o${n}" maxlength="80"></div>`));
    };
    G.qs('#po-go', m.body).onclick = async (e) => {
      const err = G.qs('#po-err', m.body); err.hidden = true; e.target.disabled = true;
      try {
        await G.post('/polls', {
          question: G.qs('#po-q', m.body).value,
          options: G.qsa('.po-o', m.body).map((i) => i.value).filter(Boolean),
          hours: G.qs('#po-hours', m.body).value,
        });
        m.close(); G.toast('Poll published 📊', 'ok'); G.render();
      } catch (ex) { err.textContent = ex.message; err.hidden = false; e.target.disabled = false; }
    };
  }

  /* ================================================================ IDEA ARENA */
  G.route('ideas', async (parts, query) => {
    const view = G.mountShell();
    const sort = query.sort || 'new';
    view.innerHTML = `<section class="greet rise" style="background:linear-gradient(135deg,color-mix(in srgb,var(--aqua) 14%,var(--surface)),var(--surface) 60%,color-mix(in srgb,var(--volt) 14%,var(--surface)))">
        <div class="between wrap"><div><h1>Idea Arena 💡</h1><div class="sub">Publish an idea, get feedback, find people who want to build it with you.</div></div>
        <button class="btn btn-primary" id="new-idea">${G.icon('plus', 16)} Share an idea</button></div>
        <div class="quick">
          <a class="chip ${sort === 'new' ? 'on' : ''}" href="#/ideas?sort=new">New</a>
          <a class="chip ${sort === 'trending' ? 'on' : ''}" href="#/ideas?sort=trending">Trending</a>
          <a class="chip ${sort === 'top' ? 'on' : ''}" href="#/ideas?sort=top">Top</a>
        </div>
      </section><div id="il" style="margin-top:16px">${G.skeletonList(3)}</div>`;
    G.qs('#new-idea', view).onclick = () => ideaModal();
    const d = await G.get('/ideas?sort=' + encodeURIComponent(sort));
    G.qs('#il', view).innerHTML = d.ideas.length ? d.ideas.map((i) => `
      <div class="card" style="margin-bottom:12px">
        <div class="row" style="gap:10px">${G.avatar(i, 36)}
          <div class="grow"><a class="bold small" href="#/u/${esc(i.username)}">${esc(i.full_name)}</a>
            <div class="tiny muted">${G.timeAgo(i.created_at)} · ${esc(i.stage)}</div></div>
          <button class="btn ${i.supported ? 'btn-primary' : 'btn-ghost'} btn-sm" data-sup="${i.id}">▲ ${i.supports}</button></div>
        <a class="bold" style="display:block;font-size:16px;margin:10px 0 4px" href="#/idea/${i.id}">${esc(i.title)}</a>
        <div class="small" style="color:var(--muted)">${esc((i.body || '').slice(0, 180))}</div>
        ${i.looking_for ? `<div class="row wrap" style="gap:6px;margin-top:10px">${i.looking_for.split(',').filter(Boolean).map((s) => `<span class="pill">Looking for: ${esc(s.trim())}</span>`).join('')}</div>` : ''}
        <div class="tiny muted" style="margin-top:8px">${i.comments_count} comment(s)</div>
      </div>`).join('') : G.emptyState('💡', 'No ideas yet', 'Share the first idea with the community.');
    G.qsa('[data-sup]', view).forEach((b) => b.onclick = async () => {
      if (!G.requireUser()) return;
      const r = await G.post(`/ideas/${b.dataset.sup}/support`, {});
      b.textContent = '▲ ' + r.supports; b.className = 'btn btn-sm ' + (r.supported ? 'btn-primary' : 'btn-ghost');
    });
  });

  G.route('idea', async (parts) => {
    const view = G.mountShell();
    view.innerHTML = G.skeletonPost();
    const d = await G.get('/ideas/' + parts[0]);
    const i = d.idea;
    view.innerHTML = `
      <div class="card">
        <div class="row" style="gap:10px">${G.avatar(i, 42)}
          <div class="grow"><a class="bold" href="#/u/${esc(i.username)}">${esc(i.full_name)}</a>
            <div class="tiny muted">${G.timeAgo(i.created_at)} · stage: ${esc(i.stage)}</div></div>
          <button class="btn ${i.supported ? 'btn-primary' : 'btn-ghost'} btn-sm" id="sup">▲ ${i.supports} support</button></div>
        <h1 style="font-size:22px;margin:14px 0 8px">${esc(i.title)}</h1>
        <div class="post-body" style="white-space:pre-wrap">${esc(i.body || '')}</div>
        ${i.looking_for ? `<div class="row wrap" style="gap:6px;margin-top:12px">${i.looking_for.split(',').filter(Boolean).map((s) => `<span class="pill">Looking for: ${esc(s.trim())}</span>`).join('')}</div>` : ''}
      </div>
      <div class="card" style="margin-top:16px">
        <h2 style="font-size:17px;margin:0 0 12px">Feedback (${d.comments.length})</h2>
        <div id="ic">${d.comments.map((c) => `<div class="row" style="gap:10px;padding:10px 0;border-bottom:1px solid var(--line-soft);align-items:flex-start">
          ${G.avatar(c, 34)}<div class="grow"><div class="bold small">${esc(c.full_name)}</div><div class="small">${esc(c.body)}</div></div></div>`).join('')}</div>
        <div class="row" style="gap:8px;margin-top:12px">
          <input class="input grow" id="ic-in" placeholder="Give useful feedback or offer to join…" maxlength="1500">
          <button class="btn btn-primary" id="ic-go">Send</button></div>
      </div>`;
    G.qs('#sup', view).onclick = async () => {
      if (!G.requireUser()) return;
      const r = await G.post(`/ideas/${i.id}/support`, {});
      G.qs('#sup', view).textContent = `▲ ${r.supports} support`;
      G.qs('#sup', view).className = 'btn btn-sm ' + (r.supported ? 'btn-primary' : 'btn-ghost');
    };
    G.qs('#ic-go', view).onclick = async () => {
      if (!G.requireUser()) return;
      const input = G.qs('#ic-in', view);
      if (!input.value.trim()) return;
      try { await G.post(`/ideas/${i.id}/comments`, { body: input.value }); input.value = ''; G.render(); }
      catch (e) { G.err(e); }
    };
  });

  function ideaModal() {
    if (!G.requireUser()) return;
    const m = G.modal('Share an idea', `
      <div class="field"><label class="label" for="id-title">Idea title</label><input class="input" id="id-title" maxlength="140" placeholder="e.g. An app that helps students swap notes"></div>
      <div class="field"><label class="label" for="id-body">Describe it</label><textarea class="textarea" id="id-body" style="min-height:120px" maxlength="4000"></textarea></div>
      <div class="row wrap" style="gap:10px">
        <div class="field grow"><label class="label" for="id-look">Looking for (comma separated)</label><input class="input" id="id-look" placeholder="Developer, Designer"></div>
        <div class="field grow"><label class="label" for="id-stage">Stage</label><select class="select" id="id-stage">
          <option value="idea">Just an idea</option><option value="building">Building</option><option value="launched">Launched</option></select></div>
      </div>
      <div class="err" id="id-err" hidden></div>
      <div class="row" style="justify-content:flex-end"><button class="btn btn-primary" id="id-go">Publish idea</button></div>`);
    G.qs('#id-go', m.body).onclick = async (e) => {
      const err = G.qs('#id-err', m.body); err.hidden = true; e.target.disabled = true;
      try {
        const r = await G.post('/ideas', {
          title: G.qs('#id-title', m.body).value, body: G.qs('#id-body', m.body).value,
          looking_for: G.qs('#id-look', m.body).value, stage: G.qs('#id-stage', m.body).value,
        });
        m.close(); G.toast('Idea published 💡', 'ok'); location.hash = '#/idea/' + r.idea.id;
      } catch (ex) { err.textContent = ex.message; err.hidden = false; e.target.disabled = false; }
    };
  }

  /* ================================================================ ADS manager */
  G.route('ads', async () => {
    if (!G.requireUser()) return;
    const view = G.mountShell();
    view.innerHTML = `<section class="greet rise">
        <div class="between wrap"><div><h1>Promote 📣</h1><div class="sub">Reach the right hub — interest-based targeting only, reviewed by moderators.</div></div>
        <button class="btn btn-primary" id="new-ad">${G.icon('plus', 16)} Create campaign</button></div>
      </section><div id="ad-body" style="margin-top:16px">${G.skeletonList(2)}</div>`;
    const [mine, packs, hubs] = await Promise.all([G.get('/ads/mine'), G.get('/ads/packages'), G.get('/hubs')]);
    G.qs('#new-ad', view).onclick = () => adModal(packs.packages, hubs.hubs);
    G.qs('#ad-body', view).innerHTML = `
      <div class="showcase">${packs.packages.map((p) => `<div class="project-card"><div class="project-body">
        <div class="bold">${esc(p.name)}</div><div class="bold" style="font-size:22px;margin:6px 0">৳${p.price}</div>
        <div class="small muted">${esc(p.description)}</div>
        <div class="tiny muted" style="margin-top:8px">${p.duration_days} days${p.perks ? ' · ' + esc(p.perks) : ''}</div></div></div>`).join('')}</div>
      <div class="card" style="margin-top:16px">
        <h2 style="font-size:17px;margin:0 0 12px">Your campaigns</h2>
        ${mine.campaigns.length ? mine.campaigns.map((c) => `<div class="row wrap" style="gap:10px;padding:12px 0;border-bottom:1px solid var(--line-soft)">
          <div class="grow"><div class="bold small">${esc(c.title)}</div>
            <div class="tiny muted">${esc(c.target_hubs || 'all hubs')} · ${c.impressions} impressions · ${c.clicks} clicks</div></div>
          <span class="pill">${esc(c.status)}</span></div>`).join('') : '<div class="small muted">No campaigns yet.</div>'}
        <div class="tiny muted" style="margin-top:12px">Estimated reach depends on hub membership — we never guarantee a fixed number of views. Ads are age-appropriate and never use private profile data for targeting.</div>
      </div>`;
  });

  function adModal(packages, hubs) {
    const m = G.modal('Create campaign', `
      <div class="field"><label class="label" for="ad-title">Headline</label><input class="input" id="ad-title" maxlength="100"></div>
      <div class="field"><label class="label" for="ad-body">Message</label><textarea class="textarea" id="ad-body" maxlength="500"></textarea></div>
      <div class="field"><label class="label" for="ad-url">Link</label><input class="input" id="ad-url" placeholder="https://… or #/product/12"></div>
      <div class="field"><label class="label">Target hubs</label>
        <div class="row wrap" style="gap:6px">${hubs.map((h) => `<label class="pill" style="cursor:pointer"><input type="checkbox" class="ad-hub" value="${esc(h.slug)}" style="margin-right:6px">${esc(h.emoji)} ${esc(h.name)}</label>`).join('')}</div></div>
      <div class="field"><label class="label" for="ad-pack">Package</label><select class="select" id="ad-pack">
        ${packages.map((p) => `<option value="${p.id}">${esc(p.name)} — ৳${p.price} / ${p.duration_days} days</option>`).join('')}</select></div>
      <div class="err" id="ad-err" hidden></div>
      <div class="row" style="justify-content:flex-end"><button class="btn btn-primary" id="ad-go">Submit for review</button></div>`);
    G.qs('#ad-go', m.body).onclick = async (e) => {
      const err = G.qs('#ad-err', m.body); err.hidden = true; e.target.disabled = true;
      try {
        const r = await G.post('/ads', {
          title: G.qs('#ad-title', m.body).value, body: G.qs('#ad-body', m.body).value,
          cta_url: G.qs('#ad-url', m.body).value, package_id: G.qs('#ad-pack', m.body).value,
          target_hubs: G.qsa('.ad-hub', m.body).filter((c) => c.checked).map((c) => c.value),
        });
        m.close();
        G.modal('Campaign submitted', `<p class="small">${esc(r.note)}</p>
          ${r.payment ? `<p class="small muted">${esc(r.payment.message)}</p>` : ''}`);
      } catch (ex) { err.textContent = ex.message; err.hidden = false; e.target.disabled = false; }
    };
  }
})();
