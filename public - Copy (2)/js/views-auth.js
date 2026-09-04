/* Bloom — auth + onboarding views */
(function () {
  'use strict';
  const G = window.GZ, S = G.state, esc = G.esc;

  const ART = `<div class="auth-art">
      <div class="logo" style="font-size:22px"><span class="logo-mark" style="width:38px;height:38px;font-size:19px">B</span> BLOOM</div>
      <h1 style="font-size:40px;line-height:1.1;margin:8px 0 0;letter-spacing:-.03em">Connect. Build.<br>Play. Grow.</h1>
      <p style="opacity:.8;max-width:420px;margin:0">The social platform built for the generation that is starting businesses, learning skills and dominating lobbies — all in the same feed.</p>
      <div class="stack" style="gap:14px;margin-top:10px">
        <div class="feat"><div class="fi">💼</div><div><b>Business Hub</b><div style="opacity:.75;font-size:14px">Founders, freelancers and collaborators. Find your co-founder, not a customer.</div></div></div>
        <div class="feat"><div class="fi">🎮</div><div><b>Gaming Hub</b><div style="opacity:.75;font-size:14px">Squads, scrims, tournaments and clips across mobile, PC and console.</div></div></div>
        <div class="feat"><div class="fi">🌐</div><div><b>Communities & Groups</b><div style="opacity:.75;font-size:14px">Topic spaces with real moderation, rules and member roles.</div></div></div>
      </div>
    </div>`;

  function shellAuth(inner) {
    return `<div class="auth-wrap">${ART}<div class="auth-form"><div class="auth-card">${inner}</div></div></div>`;
  }

  G.route('auth', async (parts, query, main) => {
    if (S.user) { location.hash = '#/'; return; }
    const view = G.mountFull(shellAuth(`
      <div class="tabs" style="margin-bottom:18px">
        <button class="tab on" data-t="login">Log in</button>
        <button class="tab" data-t="signup">Create account</button>
      </div>
      <div id="auth-panel"></div>`));
    const panel = G.qs('#auth-panel', view);
    const tabs = G.qsa('.tab', view);
    const show = (which) => {
      tabs.forEach((t) => t.classList.toggle('on', t.dataset.t === which));
      which === 'login' ? loginForm(panel) : signupForm(panel);
    };
    tabs.forEach((t) => t.onclick = () => show(t.dataset.t));
    show(query.mode === 'signup' ? 'signup' : 'login');
  });

  function loginForm(panel) {
    panel.innerHTML = `<h2 style="margin:0 0 4px;letter-spacing:-.02em">Welcome back 👋</h2>
      <p class="muted small" style="margin:0 0 18px">Log in to your Bloom account.</p>
      <form id="lf" novalidate>
        <div class="field"><label class="label" for="li">Email or username</label>
          <input class="input" id="li" autocomplete="username" required></div>
        <div class="field"><label class="label" for="lp">Password</label>
          <input class="input" id="lp" type="password" autocomplete="current-password" required></div>
        <div class="between" style="margin-bottom:14px">
          <label class="row small" style="gap:7px"><input type="checkbox" id="lr" checked> Keep me signed in</label>
          <button type="button" class="link small" id="lforgot" style="background:none;border:0">Forgot password?</button>
        </div>
        <div class="err" id="lerr" hidden></div>
        <button class="btn btn-primary btn-block" type="submit">Log in</button>
      </form>
      <div class="card pad small muted" style="margin-top:16px">
        <b>Demo accounts — tap to fill</b>
        <div class="row wrap" style="gap:6px;margin-top:8px">
          <button type="button" class="chip" data-fill="demo@genzhub.app|Demo12345">👤 demo (your test user)</button>
          <button type="button" class="chip" data-fill="ayesha@demo.genzhub.app|Demo12345">💼 ayesha (founder)</button>
          <button type="button" class="chip" data-fill="raiyan@demo.genzhub.app|Demo12345">🎮 raiyan (gamer)</button>
          <button type="button" class="chip" data-fill="admin@genzhub.app|AdminGenz2026">🛡️ admin</button>
        </div>
        <div class="tiny" style="margin-top:8px">Everyone else: mahi / shakib / tahmid / nusrat / fahim / zarin / arif
        <br>@demo.genzhub.app · password <b>Demo12345</b></div>
      </div>`;
    G.qs('#lforgot', panel).onclick = forgotModal;
    G.qsa('[data-fill]', panel).forEach((b) => b.onclick = () => {
      const [em, pwd] = b.dataset.fill.split('|');
      G.qs('#li', panel).value = em;
      G.qs('#lp', panel).value = pwd;
      G.qs('#lerr', panel).hidden = true;
    });
    G.qs('#lf', panel).onsubmit = async (e) => {
      e.preventDefault();
      const err = G.qs('#lerr', panel); err.hidden = true;
      const btn = e.target.querySelector('button[type=submit]');
      btn.disabled = true; btn.textContent = 'Logging in…';
      try {
        const r = await G.post('/auth/login', {
          identifier: G.qs('#li', panel).value.trim(),
          password: G.qs('#lp', panel).value,
          remember: G.qs('#lr', panel).checked,
        });
        S.user = r.user;
        G.applyTheme();
        location.hash = r.user.onboarded ? '#/' : '#/onboarding';
        location.reload();
      } catch (ex) {
        err.textContent = ex.message; err.hidden = false;
        btn.disabled = false; btn.textContent = 'Log in';
      }
    };
  }

  function signupForm(panel) {
    panel.innerHTML = `<h2 style="margin:0 0 4px;letter-spacing:-.02em">Join Bloom</h2>
      <p class="muted small" style="margin:0 0 18px">Free forever. You must be 13 or older.</p>
      <form id="sf" novalidate>
        <div class="field"><label class="label" for="sn">Full name</label><input class="input" id="sn" autocomplete="name" required></div>
        <div class="field"><label class="label" for="su">Username</label>
          <input class="input" id="su" autocomplete="username" placeholder="e.g. rafi_builds" required>
          <div class="hint" id="suh">3-20 characters: letters, numbers, underscore.</div></div>
        <div class="field"><label class="label" for="se">Email</label><input class="input" id="se" type="email" autocomplete="email" required></div>
        <div class="field"><label class="label" for="sp">Password</label>
          <input class="input" id="sp" type="password" autocomplete="new-password" required>
          <div class="hint">Minimum 8 characters, with letters and numbers.</div></div>
        <div class="field"><label class="label" for="sd">Date of birth</label><input class="input" id="sd" type="date" required></div>
        <div class="err" id="serr" hidden></div>
        <button class="btn btn-primary btn-block" type="submit">Create account</button>
        <p class="tiny muted center" style="margin-top:12px">By joining you agree to keep Bloom respectful and safe.</p>
      </form>`;
    const uInput = G.qs('#su', panel), hint = G.qs('#suh', panel);
    let tmr;
    uInput.addEventListener('input', () => {
      clearTimeout(tmr);
      const v = uInput.value.trim();
      if (v.length < 3) { hint.textContent = '3-20 characters: letters, numbers, underscore.'; hint.style.color = ''; return; }
      tmr = setTimeout(async () => {
        try {
          const r = await G.get('/auth/username-available?username=' + encodeURIComponent(v));
          hint.textContent = r.available ? '✅ ' + r.reason : '❌ ' + r.reason;
          hint.style.color = r.available ? 'var(--ok)' : 'var(--danger)';
        } catch (e) {}
      }, 350);
    });
    G.qs('#sf', panel).onsubmit = async (e) => {
      e.preventDefault();
      const err = G.qs('#serr', panel); err.hidden = true;
      const btn = e.target.querySelector('button[type=submit]');
      btn.disabled = true; btn.textContent = 'Creating…';
      try {
        const r = await G.post('/auth/signup', {
          full_name: G.qs('#sn', panel).value.trim(), username: uInput.value.trim(),
          email: G.qs('#se', panel).value.trim(), password: G.qs('#sp', panel).value, dob: G.qs('#sd', panel).value,
        });
        S.user = r.user;
        location.hash = '#/onboarding';
        location.reload();
      } catch (ex) {
        err.textContent = ex.message; err.hidden = false;
        btn.disabled = false; btn.textContent = 'Create account';
      }
    };
  }

  function forgotModal() {
    const m = G.modal('Reset your password', `<p class="small muted" style="margin-top:0">Enter your account email and we will generate a reset link.</p>
      <div class="field"><label class="label" for="fe">Email</label><input class="input" id="fe" type="email"></div>
      <div class="err" id="ferr" hidden></div>
      <button class="btn btn-primary btn-block" id="fgo">Send reset link</button>
      <div id="fout" style="margin-top:14px"></div>`);
    G.qs('#fgo', m.body).onclick = async (e) => {
      e.target.disabled = true;
      try {
        const r = await G.post('/auth/forgot', { email: G.qs('#fe', m.body).value.trim() });
        const out = G.qs('#fout', m.body);
        out.innerHTML = `<div class="card pad small">${esc(r.message)}
          ${r.dev_token ? `<div style="margin-top:8px"><b>No mail server is configured in this environment</b>, so use this link directly:<br>
          <a class="link" href="#/reset?token=${esc(r.dev_token)}" data-close>Open reset page</a></div>` : ''}</div>`;
      } catch (ex) { const er = G.qs('#ferr', m.body); er.textContent = ex.message; er.hidden = false; }
      e.target.disabled = false;
    };
  }

  G.route('reset', async (parts, query) => {
    const view = G.mountFull(shellAuth(`<h2 style="margin:0 0 4px">Set a new password</h2>
      <p class="muted small" style="margin:0 0 18px">Choose a strong password you have not used before.</p>
      <div class="field"><label class="label" for="np">New password</label><input class="input" id="np" type="password"></div>
      <div class="field"><label class="label" for="np2">Confirm password</label><input class="input" id="np2" type="password"></div>
      <div class="err" id="rerr" hidden></div>
      <button class="btn btn-primary btn-block" id="rgo">Update password</button>
      <p class="center small" style="margin-top:14px"><a class="link" href="#/auth">Back to login</a></p>`));
    G.qs('#rgo', view).onclick = async (e) => {
      const err = G.qs('#rerr', view); err.hidden = true;
      const p1 = G.qs('#np', view).value, p2 = G.qs('#np2', view).value;
      if (p1 !== p2) { err.textContent = 'Passwords do not match.'; err.hidden = false; return; }
      e.target.disabled = true;
      try {
        await G.post('/auth/reset', { token: query.token, password: p1 });
        G.toast('Password updated. Please log in.', 'ok');
        location.hash = '#/auth';
      } catch (ex) { err.textContent = ex.message; err.hidden = false; e.target.disabled = false; }
    };
  });

  /* ---------------- onboarding ---------------- */
  G.route('onboarding', async () => {
    if (!S.user) { location.hash = '#/auth'; return; }
    let step = 1;
    const chosen = new Set((S.user.interests || []).map((i) => i.id));
    let hubs = { business: !!S.user.in_business, gaming: !!S.user.in_gaming };
    const view = G.mountFull(`<div style="max-width:640px;margin:0 auto;padding:28px 16px">
      <div class="logo" style="justify-content:center;margin-bottom:18px"><span class="logo-mark">B</span> BLOOM</div>
      <div class="card pad" id="ob"></div></div>`);
    const box = G.qs('#ob', view);

    function bar() {
      return `<div class="row" style="gap:6px;margin-bottom:18px">${[1, 2, 3, 4].map((i) => `<div style="flex:1;height:5px;border-radius:4px;background:${i <= step ? 'linear-gradient(90deg,var(--brand-1),var(--brand-2))' : 'var(--border)'}"></div>`).join('')}</div>`;
    }

    function draw() {
      if (step === 1) {
        box.innerHTML = bar() + `<h2 style="margin:0 0 6px">Welcome, ${esc(S.user.full_name.split(' ')[0])} 🎉</h2>
          <p class="muted">Bloom is where you build a business, level up skills and find your squad — in one feed.</p>
          <ul class="small muted" style="line-height:1.9">
            <li>Post text, photos and videos</li><li>Join communities and groups</li>
            <li>Discover Business Hub and Gaming Hub</li><li>Message people privately</li></ul>
          <button class="btn btn-primary btn-block" id="next">Get started →</button>`;
        G.qs('#next', box).onclick = () => { step = 2; draw(); };
      } else if (step === 2) {
        const cats = { business: 'Business', gaming: 'Gaming', general: 'General' };
        box.innerHTML = bar() + `<h2 style="margin:0 0 6px">Choose your interests</h2>
          <p class="muted small">Pick at least 3 so we can suggest the right people and communities.</p>
          ${Object.keys(cats).map((c) => `<div style="margin-bottom:14px"><div class="label">${cats[c]}</div>
            <div class="row wrap" style="gap:7px">${S.interests.filter((i) => i.category === c).map((i) =>
              `<button class="chip ${chosen.has(i.id) ? 'on' : ''}" data-i="${i.id}">${esc(i.name)}</button>`).join('')}</div></div>`).join('')}
          <div class="row" style="gap:8px"><button class="btn btn-ghost" id="skip">Skip</button>
          <button class="btn btn-primary grow" id="next">Continue</button></div>`;
        G.qsa('[data-i]', box).forEach((b) => b.onclick = () => {
          const id = Number(b.dataset.i);
          chosen.has(id) ? chosen.delete(id) : chosen.add(id);
          b.classList.toggle('on');
        });
        G.qs('#skip', box).onclick = () => { step = 3; draw(); };
        G.qs('#next', box).onclick = async () => {
          try { await G.put('/me/interests', { interest_ids: [...chosen] }); } catch (e) { G.err(e); }
          step = 3; draw();
        };
      } else if (step === 3) {
        box.innerHTML = bar() + `<h2 style="margin:0 0 6px">Which spaces do you want?</h2>
          <p class="muted small">You can join or leave a hub at any time.</p>
          <div class="stack">
            <button class="card pad row ${hubs.business ? 'on' : ''}" id="hb" style="text-align:left;cursor:pointer;border-color:${hubs.business ? 'var(--brand-1)' : 'var(--border)'}">
              <span style="font-size:26px">💼</span><span class="grow"><b>Business Hub</b><div class="small muted">Startups, freelancing, marketing, collaborations, events.</div></span>
              <span class="chip ${hubs.business ? 'on' : ''}">${hubs.business ? 'Joined' : 'Join'}</span></button>
            <button class="card pad row" id="hg" style="text-align:left;cursor:pointer;border-color:${hubs.gaming ? 'var(--brand-1)' : 'var(--border)'}">
              <span style="font-size:26px">🎮</span><span class="grow"><b>Gaming Hub</b><div class="small muted">Squads, esports, tournaments, clips and teammate finding.</div></span>
              <span class="chip ${hubs.gaming ? 'on' : ''}">${hubs.gaming ? 'Joined' : 'Join'}</span></button>
            <div class="card pad small muted">Not into either yet? Continue with the General Social Hub only.</div>
          </div>
          <button class="btn btn-primary btn-block" id="next" style="margin-top:16px">Continue</button>`;
        G.qs('#hb', box).onclick = () => { hubs.business = !hubs.business; draw(); };
        G.qs('#hg', box).onclick = () => { hubs.gaming = !hubs.gaming; draw(); };
        G.qs('#next', box).onclick = async () => {
          try {
            await G.post('/me/hubs', { hub: 'business', join: hubs.business });
            await G.post('/me/hubs', { hub: 'gaming', join: hubs.gaming });
            S.user.in_business = hubs.business; S.user.in_gaming = hubs.gaming;
          } catch (e) { G.err(e); }
          step = 4; draw();
        };
      } else {
        box.innerHTML = bar() + `<h2 style="margin:0 0 6px">People & communities for you</h2>
          <p class="muted small">Follow a few accounts and join communities to fill your feed.</p>
          <div id="sug">${G.skeletonList(3)}</div>
          <div id="coms" class="stack" style="margin-top:14px"></div>
          <button class="btn btn-primary btn-block" id="done" style="margin-top:18px">Finish and enter Bloom 🚀</button>`;
        G.qs('#done', box).onclick = async () => {
          try { const r = await G.post('/me/onboarding/complete'); S.user = r.user; } catch (e) {}
          location.hash = '#/'; location.reload();
        };
        G.get('/users/suggestions?limit=5').then(({ users }) => {
          const s = G.qs('#sug', box); s.innerHTML = '';
          if (!users.length) s.innerHTML = '<p class="small muted">No other members to suggest yet — you are early!</p>';
          users.forEach((u) => s.appendChild(G.userCard(u)));
        }).catch(() => { G.qs('#sug', box).innerHTML = '<p class="small muted">Could not load suggestions.</p>'; });
        const hubQ = hubs.business ? 'business' : hubs.gaming ? 'gaming' : 'general';
        G.get('/communities?hub=' + hubQ).then(({ communities }) => {
          const c = G.qs('#coms', box);
          communities.slice(0, 4).forEach((x) => c.appendChild(G.communityCard(x)));
        }).catch(() => {});
      }
    }
    draw();
  });
})();
