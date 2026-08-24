/* Gen-Z Hub — Work: job marketplace, proposals, freelancer profiles, job packages. */
(function () {
  'use strict';
  const G = window.GZ, S = G.state, esc = G.esc;
  const tk = (n) => '৳' + Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 0 });

  function jobCard(j) {
    return `<a class="card" href="#/job/${j.id}" style="display:block;text-decoration:none;color:inherit;margin-bottom:12px">
      <div class="between wrap" style="align-items:flex-start">
        <div class="grow"><div class="bold" style="font-size:15.5px">${esc(j.title)}</div>
          <div class="tiny muted" style="margin-top:4px">${esc(j.category)} · ${esc(j.location || 'Remote')} · ${G.timeAgo(j.created_at)}</div></div>
        <span class="pill">${j.budget_max ? `${tk(j.budget_min)}–${tk(j.budget_max)}` : 'Budget open'}${j.budget_type === 'hourly' ? '/hr' : ''}</span>
      </div>
      <div class="small" style="margin-top:8px;color:var(--muted)">${esc((j.description || '').slice(0, 160))}${(j.description || '').length > 160 ? '…' : ''}</div>
      <div class="row wrap" style="gap:6px;margin-top:10px">
        ${(j.skills || '').split(',').filter(Boolean).slice(0, 5).map((s) => `<span class="pill">${esc(s.trim())}</span>`).join('')}
        <span class="tiny muted" style="margin-left:auto">${j.proposals_count} proposal(s)</span>
      </div></a>`;
  }

  /* ---------------------------------------------------------------- work home */
  G.route('work', async (parts, query) => {
    const view = G.mountShell();
    const tab = query.tab || 'jobs';
    view.innerHTML = `
      <section class="greet rise" style="background:linear-gradient(135deg,color-mix(in srgb,var(--iris) 15%,var(--surface)),var(--surface) 60%,color-mix(in srgb,var(--aqua) 14%,var(--surface)))">
        <div class="between wrap" style="align-items:flex-start">
          <div><h1>Work 💼</h1><div class="sub">Find gigs, hire talent, build your freelance profile.</div></div>
          <div class="row" style="gap:8px">
            <button class="btn btn-ghost" id="edit-freelancer">My freelancer profile</button>
            <button class="btn btn-primary" id="post-job">${G.icon('plus', 16)} Post a job</button>
          </div>
        </div>
        <div class="quick">
          <a class="chip ${tab === 'jobs' ? 'on' : ''}" href="#/work?tab=jobs">Find work</a>
          <a class="chip ${tab === 'talent' ? 'on' : ''}" href="#/work?tab=talent">Hire talent</a>
          <a class="chip ${tab === 'mine' ? 'on' : ''}" href="#/work?tab=mine">My jobs</a>
          <a class="chip ${tab === 'proposals' ? 'on' : ''}" href="#/work?tab=proposals">My proposals</a>
          <a class="chip ${tab === 'packages' ? 'on' : ''}" href="#/work?tab=packages">Packages</a>
        </div>
      </section>
      <div id="wbody" style="margin-top:16px">${G.skeletonList(3)}</div>`;

    G.qs('#post-job', view).onclick = () => jobModal();
    G.qs('#edit-freelancer', view).onclick = () => freelancerModal();

    const body = G.qs('#wbody', view);
    if (tab === 'talent') {
      const d = await G.get('/work/freelancers');
      body.innerHTML = d.freelancers.length ? `<div class="showcase">${d.freelancers.map((f) => `
        <div class="project-card"><div class="project-body">
          <div class="row" style="gap:10px">${G.avatar(f, 42)}
            <div><a class="bold small" href="#/freelancer/${esc(f.username)}">${esc(f.full_name)}</a>
              <div class="tiny muted">${esc(f.headline || 'Freelancer')}</div></div></div>
          <div class="row wrap" style="gap:6px;margin-top:10px">${(f.skills || '').split(',').filter(Boolean).slice(0, 4).map((s) => `<span class="pill">${esc(s.trim())}</span>`).join('')}</div>
          <div class="tiny muted" style="margin-top:10px">${f.hourly ? tk(f.hourly) + '/hr · ' : ''}${f.jobs_done} job(s) done · Level ${f.level || 1}</div>
        </div></div>`).join('')}</div>` : G.emptyState('🧑‍💻', 'No freelancer profiles yet', 'Be the first — create your freelancer profile.');
    } else if (tab === 'mine') {
      const d = await G.get('/work/jobs?mine=1');
      body.innerHTML = d.jobs.length ? d.jobs.map(jobCard).join('') : G.emptyState('💼', 'You have not posted a job yet', 'Post your first job to receive proposals.');
    } else if (tab === 'proposals') {
      const d = await G.get('/work/proposals/mine');
      body.innerHTML = d.proposals.length ? `<div class="card">${d.proposals.map((p) => `
        <div class="row wrap" style="gap:10px;padding:12px 0;border-bottom:1px solid var(--line-soft)">
          <div class="grow"><a class="bold small" href="#/job/${p.job_id}">${esc(p.title)}</a>
            <div class="tiny muted">${esc(p.client_name)} · bid ${tk(p.bid)} · ${p.days} days · ${G.timeAgo(p.created_at)}</div></div>
          <span class="pill">${esc(p.status)}</span></div>`).join('')}</div>`
        : G.emptyState('📨', 'No proposals sent', 'Apply to a job to see it here.');
    } else if (tab === 'packages') {
      const d = await G.get('/work/packages?kind=job');
      body.innerHTML = `
        <div class="card"><div class="between wrap"><div>
          <div class="bold">Your posting credits</div>
          <div class="tiny muted">${d.free_left} free post(s) left · ${d.my_credits} package credit(s)</div></div>
          <span class="pill">${d.payment.configured ? 'Payments enabled' : 'Payment gateway not configured'}</span></div>
          ${d.payment.configured ? '' : `<div class="small muted" style="margin-top:10px">${esc(d.payment.message)}</div>`}
        </div>
        <div class="showcase" style="margin-top:16px">${d.packages.map((p) => `
          <div class="project-card"><div class="project-body">
            <div class="bold" style="font-size:16px">${esc(p.name)}</div>
            <div class="bold" style="font-size:22px;margin:6px 0">${tk(p.price)}</div>
            <div class="small muted">${esc(p.description)}</div>
            <div class="tiny muted" style="margin-top:8px">${p.quantity} job posts · ${p.duration_days} days${p.perks ? ' · ' + esc(p.perks) : ''}</div>
            <button class="btn btn-primary btn-block" style="margin-top:12px" data-buy="${p.id}">Buy package</button>
          </div></div>`).join('')}</div>`;
      G.qsa('[data-buy]', body).forEach((b) => b.onclick = async () => {
        if (!G.requireUser()) return;
        try {
          const r = await G.post(`/work/packages/${b.dataset.buy}/buy`, {});
          if (r.payment && r.payment.redirect_url) location.href = r.payment.redirect_url;
          else G.modal('Payment required', `<p class="small">${esc(r.payment.message)}</p>
            <p class="small muted">Your purchase <b>${esc(r.purchase.payment_ref || '')}</b> is saved as <b>pending</b> and becomes active the moment the payment provider confirms it. Nothing is charged and no credits are granted until then.</p>`);
        } catch (e) { G.err(e); }
      });
    } else {
      const q = query.q || '';
      body.innerHTML = `<form class="card row" id="jsearch" style="gap:8px;margin-bottom:14px">
          <input class="input" id="jq" placeholder="Search jobs, skills…" value="${esc(q)}"><button class="btn btn-ghost btn-sm">Search</button></form>
        <div id="jlist">${G.skeletonList(3)}</div>`;
      G.qs('#jsearch', body).onsubmit = (e) => { e.preventDefault(); location.hash = '#/work?tab=jobs&q=' + encodeURIComponent(G.qs('#jq', body).value.trim()); };
      const d = await G.get('/work/jobs?' + (q ? 'q=' + encodeURIComponent(q) : ''));
      G.qs('#jlist', body).innerHTML = d.jobs.length ? d.jobs.map(jobCard).join('')
        : G.emptyState('🔍', 'No open jobs match', 'Try a different keyword or check back later.');
    }
  });

  /* ---------------------------------------------------------------- single job */
  G.route('job', async (parts) => {
    const view = G.mountShell();
    view.innerHTML = G.skeletonPost();
    const d = await G.get('/work/jobs/' + parts[0]);
    const j = d.job;
    view.innerHTML = `
      <div class="card">
        <div class="between wrap" style="align-items:flex-start">
          <div><h1 style="font-size:22px;margin:0">${esc(j.title)}</h1>
            <div class="tiny muted" style="margin-top:6px">${esc(j.category)} · ${esc(j.location)} · posted ${G.timeAgo(j.created_at)} by
              <a href="#/u/${esc(j.username)}">${esc(j.full_name)}</a></div></div>
          <span class="pill">${esc(j.status)}</span>
        </div>
        <div class="row wrap" style="gap:8px;margin-top:12px">
          <span class="pill">${j.budget_max ? `${tk(j.budget_min)}–${tk(j.budget_max)}` : 'Budget open'}${j.budget_type === 'hourly' ? '/hr' : ''}</span>
          ${(j.skills || '').split(',').filter(Boolean).map((s) => `<span class="pill">${esc(s.trim())}</span>`).join('')}
        </div>
        <div class="post-body" style="white-space:pre-wrap;margin-top:14px">${esc(j.description || '')}</div>
        ${!j.is_client && j.status === 'open' ? `<div style="margin-top:16px">${d.my_proposal
      ? `<div class="pill">You applied · ${esc(d.my_proposal.status)}</div>`
      : '<button class="btn btn-primary" id="apply">Send a proposal</button>'}</div>` : ''}
      </div>
      ${j.is_client ? `<div class="card" style="margin-top:16px">
        <h2 style="font-size:17px;margin:0 0 12px">Proposals (${d.proposals.length})</h2>
        ${d.proposals.length ? d.proposals.map((p) => `
          <div class="row wrap" style="gap:10px;padding:12px 0;border-bottom:1px solid var(--line-soft);align-items:flex-start">
            ${G.avatar(p, 40)}
            <div class="grow"><a class="bold small" href="#/freelancer/${esc(p.username)}">${esc(p.full_name)}</a>
              <div class="tiny muted">${esc(p.headline || '')} · bid ${tk(p.bid)} · ${p.days} days · ${p.jobs_done || 0} jobs done</div>
              <div class="small" style="margin-top:6px;white-space:pre-wrap">${esc(p.cover)}</div></div>
            <div class="row" style="gap:6px">
              <span class="pill">${esc(p.status)}</span>
              <button class="btn btn-ghost btn-sm" data-pstatus="${p.id}" data-v="shortlisted">Shortlist</button>
              <button class="btn btn-primary btn-sm" data-pstatus="${p.id}" data-v="hired">Hire</button>
            </div></div>`).join('') : '<div class="small muted">No proposals yet.</div>'}
      </div>` : ''}`;

    const ap = G.qs('#apply', view);
    if (ap) ap.onclick = () => proposalModal(j);
    G.qsa('[data-pstatus]', view).forEach((b) => b.onclick = async () => {
      try { await G.post(`/work/proposals/${b.dataset.pstatus}/status`, { status: b.dataset.v }); G.toast('Proposal ' + b.dataset.v, 'ok'); G.render(); }
      catch (e) { G.err(e); }
    });
  });

  /* ---------------------------------------------------------------- freelancer profile */
  G.route('freelancer', async (parts) => {
    const view = G.mountShell();
    const d = await G.get('/work/freelancers/' + parts[0]);
    const f = d.profile || {};
    view.innerHTML = `
      <section class="greet rise">
        <div class="row wrap" style="gap:14px;align-items:flex-start">
          ${G.avatar(d.user, 64)}
          <div class="grow"><h1 style="margin:0">${esc(d.user.full_name)}</h1>
            <div class="sub">${esc(f.headline || d.user.bio || 'Gen-Z Hub member')}</div>
            <div class="row wrap" style="gap:6px;margin-top:10px">
              ${(f.skills || d.user.skills || '').split(',').filter(Boolean).map((s) => `<span class="pill">${esc(s.trim())}</span>`).join('')}
            </div></div>
          <div class="row" style="gap:8px">
            <span class="pill">Level ${d.stats.level}</span>
            <span class="pill">${f.availability || 'open'}</span>
          </div>
        </div>
      </section>
      <div class="card" style="margin-top:16px">
        <div class="row wrap" style="gap:16px">
          <div class="stat"><div class="bold">${f.hourly ? tk(f.hourly) : '—'}</div><div class="tiny muted">Hourly</div></div>
          <div class="stat"><div class="bold">${f.jobs_done || 0}</div><div class="tiny muted">Jobs done</div></div>
          <div class="stat"><div class="bold">${d.stats.xp}</div><div class="tiny muted">XP</div></div>
          <div class="stat"><div class="bold">${d.stats.badges.length}</div><div class="tiny muted">Badges</div></div>
        </div>
        ${f.about ? `<p class="small" style="margin-top:14px;white-space:pre-wrap">${esc(f.about)}</p>` : ''}
        ${f.portfolio_url ? `<a class="btn btn-ghost btn-sm" style="margin-top:10px" href="${esc(f.portfolio_url)}" target="_blank" rel="noopener">View portfolio</a>` : ''}
      </div>
      ${d.portfolio.length ? `<div class="card" style="margin-top:16px"><h2 style="font-size:17px;margin:0 0 10px">Projects</h2>
        ${d.portfolio.map((p) => `<a class="quote" style="display:block;margin-bottom:8px" href="#/post/${p.id}">${esc((p.content || '').slice(0, 140))}</a>`).join('')}</div>` : ''}`;
  });

  /* ---------------------------------------------------------------- modals */
  function jobModal() {
    if (!G.requireUser()) return;
    const cats = ['Web development', 'App development', 'Graphic design', 'Logo design', 'Video editing',
      'Photo editing', 'Writing', 'Programming', 'Social media', 'Marketing', 'Voice over', 'Data entry', 'Other'];
    const m = G.modal('Post a job', `
      <div class="field"><label class="label" for="jb-title">Job title</label><input class="input" id="jb-title" maxlength="120" placeholder="e.g. Need a logo for my clothing brand"></div>
      <div class="field"><label class="label" for="jb-cat">Category</label><select class="select" id="jb-cat">${cats.map((c) => `<option>${c}</option>`).join('')}</select></div>
      <div class="field"><label class="label" for="jb-desc">Description</label><textarea class="textarea" id="jb-desc" style="min-height:120px" maxlength="5000" placeholder="What exactly do you need? Deadline? Reference?"></textarea></div>
      <div class="row wrap" style="gap:10px">
        <div class="field grow"><label class="label" for="jb-min">Budget min (৳)</label><input class="input" id="jb-min" type="number" min="0"></div>
        <div class="field grow"><label class="label" for="jb-max">Budget max (৳)</label><input class="input" id="jb-max" type="number" min="0"></div>
        <div class="field grow"><label class="label" for="jb-type">Type</label><select class="select" id="jb-type"><option value="fixed">Fixed price</option><option value="hourly">Hourly</option></select></div>
      </div>
      <div class="row wrap" style="gap:10px">
        <div class="field grow"><label class="label" for="jb-skills">Skills (comma separated)</label><input class="input" id="jb-skills" placeholder="Illustrator, Branding"></div>
        <div class="field grow"><label class="label" for="jb-loc">Location</label><input class="input" id="jb-loc" value="Remote"></div>
      </div>
      <div class="err" id="jb-err" hidden></div>
      <div class="row" style="justify-content:flex-end"><button class="btn btn-primary" id="jb-go">Publish job</button></div>`);
    G.qs('#jb-go', m.body).onclick = async (e) => {
      const err = G.qs('#jb-err', m.body); err.hidden = true; e.target.disabled = true;
      try {
        await G.post('/work/jobs', {
          title: G.qs('#jb-title', m.body).value, category: G.qs('#jb-cat', m.body).value,
          description: G.qs('#jb-desc', m.body).value, budget_min: G.qs('#jb-min', m.body).value,
          budget_max: G.qs('#jb-max', m.body).value, budget_type: G.qs('#jb-type', m.body).value,
          skills: G.qs('#jb-skills', m.body).value, location: G.qs('#jb-loc', m.body).value,
        });
        m.close(); G.toast('Job published 💼', 'ok'); location.hash = '#/work?tab=mine'; G.render();
      } catch (ex) {
        err.innerHTML = esc(ex.message) + (/package/i.test(ex.message) ? ' <a href="#/work?tab=packages">See packages</a>' : '');
        err.hidden = false; e.target.disabled = false;
      }
    };
  }

  function proposalModal(job) {
    if (!G.requireUser()) return;
    const m = G.modal('Send a proposal', `
      <div class="field"><label class="label" for="pr-cover">Why you?</label>
        <textarea class="textarea" id="pr-cover" style="min-height:120px" maxlength="2000" placeholder="Show relevant work and how you will deliver."></textarea></div>
      <div class="row wrap" style="gap:10px">
        <div class="field grow"><label class="label" for="pr-bid">Your bid (৳)</label><input class="input" id="pr-bid" type="number" min="0"></div>
        <div class="field grow"><label class="label" for="pr-days">Delivery (days)</label><input class="input" id="pr-days" type="number" min="1" value="7"></div>
      </div>
      <div class="err" id="pr-err" hidden></div>
      <div class="row" style="justify-content:flex-end"><button class="btn btn-primary" id="pr-go">Send proposal</button></div>`);
    G.qs('#pr-go', m.body).onclick = async (e) => {
      const err = G.qs('#pr-err', m.body); err.hidden = true; e.target.disabled = true;
      try {
        await G.post(`/work/jobs/${job.id}/proposals`, {
          cover: G.qs('#pr-cover', m.body).value, bid: G.qs('#pr-bid', m.body).value, days: G.qs('#pr-days', m.body).value,
        });
        m.close(); G.toast('Proposal sent 📨', 'ok'); G.render();
      } catch (ex) { err.textContent = ex.message; err.hidden = false; e.target.disabled = false; }
    };
  }

  function freelancerModal() {
    if (!G.requireUser()) return;
    G.get('/work/freelancers/' + S.user.username).then((d) => {
      const f = d.profile || {};
      const m = G.modal('Freelancer profile', `
        <div class="field"><label class="label" for="fl-head">Headline</label><input class="input" id="fl-head" maxlength="120" value="${esc(f.headline || '')}" placeholder="e.g. Video editor for gaming creators"></div>
        <div class="field"><label class="label" for="fl-skills">Skills (comma separated)</label><input class="input" id="fl-skills" value="${esc(f.skills || '')}"></div>
        <div class="row wrap" style="gap:10px">
          <div class="field grow"><label class="label" for="fl-rate">Hourly rate (৳)</label><input class="input" id="fl-rate" type="number" min="0" value="${f.hourly || ''}"></div>
          <div class="field grow"><label class="label" for="fl-min">Minimum budget (৳)</label><input class="input" id="fl-min" type="number" min="0" value="${f.min_budget || ''}"></div>
          <div class="field grow"><label class="label" for="fl-av">Availability</label><select class="select" id="fl-av">
            ${['open', 'busy', 'closed'].map((a) => `<option value="${a}" ${f.availability === a ? 'selected' : ''}>${a}</option>`).join('')}</select></div>
        </div>
        <div class="field"><label class="label" for="fl-about">About your work</label><textarea class="textarea" id="fl-about" maxlength="2000">${esc(f.about || '')}</textarea></div>
        <div class="field"><label class="label" for="fl-port">Portfolio link</label><input class="input" id="fl-port" value="${esc(f.portfolio_url || '')}" placeholder="https://…"></div>
        <div class="err" id="fl-err" hidden></div>
        <div class="row" style="justify-content:flex-end"><button class="btn btn-primary" id="fl-go">Save profile</button></div>`);
      G.qs('#fl-go', m.body).onclick = async (e) => {
        const err = G.qs('#fl-err', m.body); err.hidden = true; e.target.disabled = true;
        try {
          await G.put('/work/freelancer', {
            headline: G.qs('#fl-head', m.body).value, skills: G.qs('#fl-skills', m.body).value,
            hourly: G.qs('#fl-rate', m.body).value, min_budget: G.qs('#fl-min', m.body).value,
            availability: G.qs('#fl-av', m.body).value, about: G.qs('#fl-about', m.body).value,
            portfolio_url: G.qs('#fl-port', m.body).value,
          });
          m.close(); G.toast('Freelancer profile saved ✓', 'ok');
        } catch (ex) { err.textContent = ex.message; err.hidden = false; e.target.disabled = false; }
      };
    }).catch(G.err);
  }
})();
