/* Bloom — Projects showcase (portfolio-style view over collaboration/team posts) */
(function () {
  'use strict';
  const G = window.GZ, S = G.state, esc = G.esc;

  const FILTERS = [
    ['all', 'All projects', ''],
    ['business', 'Startups & business', 'hub=business&kind=collab'],
    ['gaming', 'Gaming teams', 'hub=gaming&kind=team'],
    ['mine', 'My projects', ''],
  ];

  G.route('projects', async (parts, query) => {
    if (!G.requireUser()) return;
    const view = G.mountShell();
    const tab = query.tab || 'all';

    view.innerHTML = `
      <section class="greet rise" style="background:linear-gradient(135deg,color-mix(in srgb,var(--aqua) 14%,var(--surface)),var(--surface) 60%,color-mix(in srgb,var(--iris) 16%,var(--surface)))">
        <div class="between wrap" style="align-items:flex-start">
          <div>
            <h1>Projects & collaborations</h1>
            <div class="sub">What the community is building right now — join a team or recruit yours.</div>
          </div>
          <button class="btn btn-primary" id="new-project">${G.icon('plus', 16)} Start a project</button>
        </div>
        <div class="quick">
          ${FILTERS.map(([k, label]) => `<a class="chip ${tab === k ? 'on' : ''}" href="#/projects?tab=${k}">${esc(label)}</a>`).join('')}
        </div>
      </section>
      <div id="pj"></div>`;

    G.qs('#new-project', view).onclick = () => G.openComposer({
      contentType: 'project', kind: 'collab',
      hub: S.user.in_business ? 'business' : 'general',
      onDone: () => G.render(),
    });

    const box = G.qs('#pj', view);
    box.innerHTML = `<div class="showcase">${Array.from({ length: 3 }, () => `
      <div class="project-card"><div class="skel" style="height:130px;border-radius:0"></div>
      <div class="project-body"><div class="skel" style="height:14px;width:70%"></div>
      <div class="skel" style="height:11px;width:92%"></div><div class="skel" style="height:11px;width:60%"></div></div></div>`).join('')}</div>`;

    try {
      let url = '/posts/feed?limit=20&';
      if (tab === 'business') url += 'hub=business&kind=collab';
      else if (tab === 'gaming') url += 'hub=gaming&kind=team';
      else url += 'kind=collab';

      let { posts } = await G.get(url);
      if (tab === 'all') {
        const team = await G.get('/posts/feed?limit=20&hub=gaming&kind=team').catch(() => ({ posts: [] }));
        const biz = await G.get('/posts/feed?limit=20&hub=business&kind=collab').catch(() => ({ posts: [] }));
        const seen = new Set(posts.map((p) => p.id));
        [...team.posts, ...biz.posts].forEach((p) => { if (!seen.has(p.id)) { seen.add(p.id); posts.push(p); } });
        posts.sort((a, b) => b.created_at - a.created_at);
      }
      if (tab === 'mine') posts = posts.filter((p) => p.user_id === S.user.id);

      box.innerHTML = '';
      if (!posts.length) {
        box.innerHTML = G.emptyState('🚀', 'No projects here yet',
          tab === 'mine' ? 'Start your first project and find people to build it with.' : 'Be the first to post what you are building.',
          `<div style="margin-top:16px"><button class="btn btn-primary btn-sm" data-start>${G.icon('plus', 15)} Start a project</button></div>`);
        const b = box.querySelector('[data-start]');
        if (b) b.onclick = () => G.openComposer({ contentType: 'project', kind: 'collab', hub: S.user.in_business ? 'business' : 'general', onDone: () => G.render() });
        return;
      }
      const grid = G.el('<div class="showcase"></div>');
      posts.forEach((p) => grid.appendChild(G.projectCard(p)));
      box.appendChild(grid);
    } catch (e) {
      box.innerHTML = G.errorState(e.message, 'pj-retry');
      const r = G.qs('#pj-retry', box); if (r) r.onclick = () => G.render();
    }
    G.buildRail();
  });
})();
