/* ============================================================
   IdeaPulse — shared frontend logic
   Landing reveal · submission form · admin login · admin SPA
   ============================================================ */
(function () {
  'use strict';

  var API = '/api';
  var CSRF = null;

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function el(id) { return document.getElementById(id); }

  // i18n helper (defined in /js/i18n.js, loaded before this file)
  function t(key) {
    return window.IP ? window.IP.t(key) : key;
  }
  function catName(cat) {
    return t('cat.' + cat);
  }
  function scoreLabelLocal(label) {
    var map = {
      'Low signal': 'score.low',
      'Moderate signal': 'score.moderate',
      'Strong signal': 'score.strong',
      'Very strong signal': 'score.verystrong'
    };
    return t(map[label] || 'score.low');
  }

  function toast(msg, kind) {
    var t = el('toast');
    if (!t) {
      t = document.createElement('div');
      t.id = 'toast';
      t.className = 'toast';
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.className = 'toast show ' + (kind || 'ok');
    clearTimeout(t.__timer);
    t.__timer = setTimeout(function () { t.className = 'toast'; }, 3200);
  }

  function fetchJSON(url, opts) {
    opts = opts || {};
    var headers = opts.headers || {};
    headers['Content-Type'] = 'application/json';
    if (CSRF && (opts.method === 'POST' || opts.method === 'PUT' || opts.method === 'PATCH' || opts.method === 'DELETE')) {
      headers['X-CSRF-Token'] = CSRF;
    }
    return fetch(url, {
      method: opts.method || 'GET',
      headers: headers,
      body: opts.body ? JSON.stringify(opts.body) : undefined,
      credentials: 'same-origin'
    }).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (data) {
        if (!res.ok) throw new Error(data.error || ('Request failed (' + res.status + ')'));
        return data;
      });
    });
  }

  function bootstrapCsrf() {
    return fetchJSON(API + '/csrf').then(function (d) { CSRF = d.csrfToken; return d; });
  }

  // ── Landing page: reveal on scroll ─────────────────────────
  function initLanding() {
    var year = el('year');
    if (year) year.textContent = new Date().getFullYear();
    var items = document.querySelectorAll('.reveal');
    if (!('IntersectionObserver' in window)) {
      items.forEach(function (n) { n.classList.add('in'); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
      });
    }, { threshold: 0.12 });
    items.forEach(function (n) { io.observe(n); });
  }

  // ── Submission form ─────────────────────────────────────────
  function initSubmit() {
    var form = el('submission-form');
    if (!form) return;
    var btn = el('submit-btn');
    var consent = el('consent');
    var consentBox = el('consent-box');

    consent.addEventListener('change', function () {
      consentBox.classList.toggle('checked', consent.checked);
    });

    bootstrapCsrf();

    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      var problem = el('problem').value.trim();
      var solution = el('solution').value.trim();
      if (problem.length < 10) { toast(t('toast.problem.short'), 'err'); el('problem').focus(); return; }
      if (solution.length < 5) { toast(t('toast.solution.short'), 'err'); el('solution').focus(); return; }
      if (!consent.checked) { toast(t('toast.consent'), 'err'); consent.focus(); return; }

      btn.disabled = true;
      var original = btn.textContent;
      btn.innerHTML = '<span class="spinner"></span> ' + esc(t('toast.submitting'));

      fetchJSON(API + '/submissions', {
        method: 'POST',
        body: {
          problem: problem,
          desiredSolution: solution,
          category: el('category').value,
          broadLocation: el('location').value
        }
      }).then(function () {
        window.location.href = '/thanks';
      }).catch(function (err) {
        toast(err.message || t('toast.generic'), 'err');
        btn.disabled = false;
        btn.textContent = original;
      });
    });
  }

  // ── Admin login ────────────────────────────────────────────
  function initAdminLogin() {
    var form = el('login-form');
    if (!form) return;
    var btn = el('login-btn');
    var errEl = el('login-error');

    // Already signed in? Go straight to the dashboard.
    fetchJSON(API + '/session').then(function (d) {
      if (d.authenticated) window.location.href = '/admin/dashboard';
    }).catch(function () {});

    bootstrapCsrf();

    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      errEl.style.display = 'none';
      btn.disabled = true;
      btn.innerHTML = '<span class="spinner"></span> ' + esc(t('login.signing'));
      fetchJSON(API + '/login', {
        method: 'POST',
        body: { email: el('email').value.trim(), password: el('password').value }
      }).then(function () {
        window.location.href = '/admin/dashboard';
      }).catch(function (err) {
        errEl.textContent = err.message || t('login.fail');
        errEl.style.display = 'block';
        btn.disabled = false;
        btn.textContent = t('login.btn');
      });
    });
  }

  // ── Admin dashboard SPA ────────────────────────────────────
  var state = { view: 'overview', page: 1, filters: {} };

  function initAdmin() {
    var viewRoot = el('view');
    if (!viewRoot) return;

    fetchJSON(API + '/session').then(function (d) {
      if (!d.authenticated) { window.location.href = '/admin/login'; return; }
      var emailEl = el('admin-email');
      if (emailEl) emailEl.textContent = d.email;
      bootstrapCsrf().then(renderCurrent);
    }).catch(function () {
      window.location.href = '/admin/login';
    });

    document.querySelectorAll('[data-nav]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        setView(btn.getAttribute('data-nav'));
      });
    });
    var logout = el('logout-btn');
    if (logout) logout.addEventListener('click', doLogout);
    window.addEventListener('popstate', function () {
      var v = (location.hash || '#overview').slice(1);
      if (v === 'overview' || v === 'submissions' || v === 'opportunities' || v === 'analytics') setView(v, true);
    });
  }

  function doLogout() {
    fetchJSON(API + '/logout', { method: 'POST' }).then(function () {
      window.location.href = '/admin/login';
    }).catch(function () {
      window.location.href = '/admin/login';
    });
  }

  function setView(view, skipPush) {
    state.view = view;
    state.page = 1;
    if (view === 'overview' || view === 'submissions' || view === 'opportunities' || view === 'analytics') {
      if (!skipPush) history.pushState(null, '', '#/' + view);
    }
    document.querySelectorAll('[data-nav]').forEach(function (b) {
      b.classList.toggle('active', b.getAttribute('data-nav') === view);
    });
    renderCurrent();
  }

  function renderCurrent() {
    var viewRoot = el('view');
    if (!viewRoot) return;
    if (state.view === 'overview') renderOverview(viewRoot);
    else if (state.view === 'submissions') renderSubmissions(viewRoot);
    else if (state.view === 'opportunities') renderOpportunities(viewRoot);
    else if (state.view === 'analytics') renderAnalytics(viewRoot);
  }

  function loading(root) {
    root.innerHTML = '<div class="empty"><span class="spinner" style="border-color:rgba(124,58,237,.3);border-top-color:#7c3aed;"></span><p>' + esc(t('common.loading')) + '</p></div>';
  }

  // ── Overview ───────────────────────────────────────────────
  function renderOverview(root) {
    loading(root);
    fetchJSON(API + '/admin/overview').then(function (d) {
      var topProblems = (d.topProblems || []).slice(0, 8);
      root.innerHTML =
        '<div class="stat-grid">' +
        statCard(t('ov.total'), d.total) +
        statCard(t('ov.today'), d.today) +
        statCard(t('ov.week'), d.thisWeek) +
        statCard(t('ov.month'), d.thisMonth) +
        '</div>' +

        '<div class="grid" style="grid-template-columns:1.4fr 1fr;margin-top:20px;">' +
        '<div class="panel"><div class="panel-head"><h3>' + esc(t('ov.problems')) + '</h3></div>' +
        '<div class="panel-body">' +
        (topProblems.length
          ? '<div class="bars">' + topProblems.map(function (p) {
              var max = topProblems[0].count || 1;
              return '<div class="bar-row"><span class="name" data-q="' + esc(p.word) + '">' + esc(p.word) + '</span>' +
                '<span class="track"><span class="fill" style="width:' + Math.round((p.count / max) * 100) + '%"></span></span>' +
                '<span class="cnt">' + p.count + '</span></div>';
            }).join('') + '</div>'
          : emptyState(t('ov.empty.subs'))) +
        '</div></div>' +

        '<div class="panel"><div class="panel-head"><h3>' + esc(t('ov.categories')) + '</h3></div>' +
        '<div class="panel-body">' +
        (d.categories.length
          ? '<div class="bars">' + d.categories.slice(0, 8).map(function (c) {
              var max = d.categories[0].count || 1;
              return '<div class="bar-row"><span class="name" data-category="' + esc(c.name) + '">' + esc(catName(c.name)) + '</span>' +
                '<span class="track"><span class="fill" style="width:' + Math.round((c.count / max) * 100) + '%"></span></span>' +
                '<span class="cnt">' + c.count + '</span></div>';
            }).join('') + '</div>'
          : emptyState(t('ov.empty.data'))) +
        '</div></div>' +
        '</div>' +

        '<div class="panel" style="margin-top:20px;">' +
        '<div class="panel-head"><h3>' + esc(t('ov.trending')) + '</h3><span class="hint" style="margin:0;">' + esc(t('ov.trending.hint')) + '</span></div>' +
        '<div class="panel-body">' +
        (d.trendingOpportunities.length
          ? '<div class="grid grid-3">' + d.trendingOpportunities.map(clusterCard).join('') + '</div>'
          : emptyState(t('ov.empty.opp'))) +
        '</div></div>';

      bindClicks(root);
    }).catch(function (err) { root.innerHTML = errorState(err.message); });
  }

  function statCard(label, value) {
    return '<div class="stat"><div class="label">' + esc(label) + '</div><div class="value">' + Number(value || 0) + '</div></div>';
  }

  function clusterCard(c) {
    var relatedKey = c.submissionCount === 1 ? 'ov.related' : 'ov.related.pl';
    return '<div class="card" data-opp="' + c.id + '" style="cursor:pointer;">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;gap:10px;">' +
      '<h3 style="margin:0;font-size:1.05rem;">' + esc(c.title) + '</h3>' +
      '<span class="badge">' + esc(scoreLabelLocal(c.scoreLabel)) + '</span></div>' +
      '<div style="margin:10px 0 6px;"><span class="score-num">' + c.score + '</span><span style="color:var(--faint);font-size:0.8rem;"> / 100</span></div>' +
      '<div style="font-size:0.82rem;color:var(--muted);">' + c.submissionCount + ' ' + esc(t(relatedKey)) + '</div></div>';
  }

  function emptyState(msg) {
    return '<div class="empty"><div class="big">' + esc(msg) + '</div></div>';
  }
  function errorState(msg) {
    return '<div class="empty"><div class="big">' + esc(t('common.error')) + '</div><p>' + esc(msg) + '</p></div>';
  }

  // ── Submissions (search / filter / sort / export) ──────────
  function currentQuery() {
    var q = new URLSearchParams();
    if (state.filters.q) q.set('q', state.filters.q);
    if (state.filters.category) q.set('category', state.filters.category);
    if (state.filters.location) q.set('location', state.filters.location);
    if (state.filters.from) q.set('from', state.filters.from);
    if (state.filters.to) q.set('to', state.filters.to);
    if (state.filters.sort) q.set('sort', state.filters.sort);
    q.set('page', state.page);
    return q;
  }

  function renderSubmissions(root) {
    loading(root);
    var qs = currentQuery().toString();
    fetchJSON(API + '/admin/submissions?' + qs).then(function (d) {
      var rows = (d.items || []).map(function (s) {
        return '<tr>' +
          '<td class="mono">' + esc(s.id) + '</td>' +
          '<td style="white-space:nowrap;">' + fmtDate(s.createdAt) + '</td>' +
          '<td><span class="badge">' + esc(catName(s.category)) + '</span></td>' +
          '<td style="max-width:300px;">' + esc(s.problem) + '</td>' +
          '<td style="max-width:300px;">' + esc(s.desiredSolution) + '</td>' +
          '<td>' + (s.broadLocation ? esc(s.broadLocation) : '<span style="color:var(--faint);">—</span>') + '</td>' +
          '</tr>';
      }).join('');

      var totalPages = Math.max(1, Math.ceil(d.total / (d.limit || 20)));

      root.innerHTML =
        '<div class="panel">' +
        '<div class="panel-head"><h3>' + esc(t('nav.submissions')) + ' (' + d.total + ')</h3>' +
        '<div style="display:flex;gap:8px;">' +
        '<a class="btn btn-ghost btn-sm" href="' + API + '/admin/submissions/export?' + exportQuery('csv') + '">' + esc(t('sub.export.csv')) + '</a>' +
        '<a class="btn btn-ghost btn-sm" href="' + API + '/admin/submissions/export?' + exportQuery('xls') + '">' + esc(t('sub.export.excel')) + '</a>' +
        '</div></div>' +
        '<div class="panel-body">' +
        '<div class="filters" style="margin-bottom:16px;">' +
        '<input class="input search" id="f-q" placeholder="' + esc(t('sub.search.ph')) + '" value="' + esc(state.filters.q || '') + '" />' +
        '<select class="select" id="f-category"><option value="">' + esc(t('sub.allcats')) + '</option>' +
        (d.categories || []).map(function (c) { return '<option value="' + esc(c) + '"' + (state.filters.category === c ? ' selected' : '') + '>' + esc(catName(c)) + '</option>'; }).join('') +
        '</select>' +
        '<select class="select" id="f-location"><option value="">' + esc(t('sub.allloc')) + '</option>' +
        (d.locations || []).map(function (l) { return '<option value="' + esc(l) + '"' + (state.filters.location === l ? ' selected' : '') + '>' + esc(l) + '</option>'; }).join('') +
        '</select>' +
        '<input class="input" type="date" id="f-from" value="' + esc(state.filters.from || '') + '" />' +
        '<input class="input" type="date" id="f-to" value="' + esc(state.filters.to || '') + '" />' +
        '<select class="select" id="f-sort">' +
        '<option value="newest"' + (state.filters.sort !== 'oldest' && state.filters.sort !== 'category' && state.filters.sort !== 'location' ? ' selected' : '') + '>' + esc(t('sub.sort.newest')) + '</option>' +
        '<option value="oldest"' + (state.filters.sort === 'oldest' ? ' selected' : '') + '>' + esc(t('sub.sort.oldest')) + '</option>' +
        '<option value="category"' + (state.filters.sort === 'category' ? ' selected' : '') + '>' + esc(t('sub.sort.category')) + '</option>' +
        '<option value="location"' + (state.filters.sort === 'location' ? ' selected' : '') + '>' + esc(t('sub.sort.location')) + '</option>' +
        '</select>' +
        '</div>' +
        (rows.length
          ? '<div class="table-wrap"><table><thead><tr><th>' + esc(t('sub.th.id')) + '</th><th>' + esc(t('sub.th.date')) + '</th><th>' + esc(t('sub.th.category')) + '</th><th>' + esc(t('sub.th.problem')) + '</th><th>' + esc(t('sub.th.solution')) + '</th><th>' + esc(t('sub.th.location')) + '</th></tr></thead><tbody>' + rows + '</tbody></table></div>'
          : emptyState(t('sub.empty'))) +
        '<div style="display:flex;justify-content:space-between;align-items:center;margin-top:16px;">' +
        '<button class="btn btn-ghost btn-sm" id="prev-page"' + (state.page <= 1 ? ' disabled' : '') + '>' + esc(t('sub.prev')) + '</button>' +
        '<span class="hint" style="margin:0;">' + esc(t('sub.page')) + ' ' + state.page + ' ' + esc(t('sub.page.of')) + ' ' + totalPages + '</span>' +
        '<button class="btn btn-ghost btn-sm" id="next-page"' + (state.page >= totalPages ? ' disabled' : '') + '>' + esc(t('sub.next')) + '</button>' +
        '</div>' +
        '</div></div>';

      bindFilterControls();
    }).catch(function (err) { root.innerHTML = errorState(err.message); });
  }

  function exportQuery(format) {
    var p = new URLSearchParams();
    if (state.filters.q) p.set('q', state.filters.q);
    if (state.filters.category) p.set('category', state.filters.category);
    if (state.filters.location) p.set('location', state.filters.location);
    if (state.filters.from) p.set('from', state.filters.from);
    if (state.filters.to) p.set('to', state.filters.to);
    p.set('format', format);
    return p.toString();
  }

  function bindFilterControls() {
    var q = el('f-q'), cat = el('f-category'), loc = el('f-location'),
        from = el('f-from'), to = el('f-to'), sort = el('f-sort');

    function apply(reset) {
      if (reset) state.page = 1;
      state.filters.q = q.value.trim();
      state.filters.category = cat.value;
      state.filters.location = loc.value;
      state.filters.from = from.value;
      state.filters.to = to.value;
      state.filters.sort = sort.value;
      renderSubmissions(el('view'));
    }
    var debounce;
    q.addEventListener('input', function () { clearTimeout(debounce); debounce = setTimeout(function () { apply(true); }, 350); });
    cat.addEventListener('change', function () { apply(true); });
    loc.addEventListener('change', function () { apply(true); });
    from.addEventListener('change', function () { apply(true); });
    to.addEventListener('change', function () { apply(true); });
    sort.addEventListener('change', function () { apply(true); });

    var prev = el('prev-page'), next = el('next-page');
    if (prev) prev.addEventListener('click', function () { if (state.page > 1) { state.page--; renderSubmissions(el('view')); } });
    if (next) next.addEventListener('click', function () { state.page++; renderSubmissions(el('view')); });
  }

  // ── Opportunities ──────────────────────────────────────────
  function renderOpportunities(root) {
    loading(root);
    fetchJSON(API + '/admin/opportunities').then(function (d) {
      var items = d.items || [];
      root.innerHTML =
        '<div class="panel-head" style="border:0;padding:0 0 16px;"><h2 style="margin:0;">' + esc(t('opp.title')) + '</h2>' +
        '<button class="btn btn-ghost btn-sm" id="reanalyze-btn">' + esc(t('opp.reanalyze')) + '</button></div>' +
        (items.length
          ? '<div class="grid grid-3">' + items.map(clusterCard).join('') + '</div>'
          : emptyState(t('opp.empty'))) +
        '<p class="hint" style="margin-top:16px;">' + esc(t('opp.disclaimer')) + '</p>';

      var re = el('reanalyze-btn');
      if (re) re.addEventListener('click', function () {
        re.disabled = true; re.textContent = t('opp.analyzing');
        fetchJSON(API + '/admin/reanalyze', { method: 'POST' }).then(function () {
          toast(t('toast.analysis')); renderOpportunities(root);
        }).catch(function (err) { toast(err.message, 'err'); re.disabled = false; re.textContent = t('opp.reanalyze'); });
      });
      bindClicks(root);
    }).catch(function (err) { root.innerHTML = errorState(err.message); });
  }

  function renderOpportunityDetail(root, id) {
    loading(root);
    fetchJSON(API + '/admin/opportunities/' + id).then(function (d) {
      var c = d.cluster;
      var subs = d.submissions || [];
      var trend = c.trend || [];

      var reports = d.report
        ? '<div class="panel" style="margin-top:18px;"><div class="panel-head"><h3>' + esc(t('opp.report.title')) + '</h3>' +
          '<button class="btn btn-soft btn-sm" id="dl-report">' + esc(t('opp.report.dl')) + '</button></div>' +
          '<div class="panel-body report-body" id="report-body"></div></div>'
        : '';

      var relatedKey = c.submissionCount === 1 ? 'ov.related' : 'ov.related.pl';

      root.innerHTML =
        '<button class="btn btn-ghost btn-sm" data-nav="opportunities" style="margin-bottom:18px;">' + esc(t('opp.back')) + '</button>' +
        '<div class="panel"><div class="panel-body"><div class="opp-head">' +
        '<div><span class="eyebrow">' + esc(t('opp.badge')) + '</span><h2 style="font-size:2rem;margin:8px 0 4px;">' + esc(c.title) + '</h2>' +
        '<p style="margin:0;">' + c.submissionCount + ' ' + esc(t(relatedKey)) + ' · ' + esc(t('opp.identified')) + '</p></div>' +
        '<div class="opp-score"><div style="font-size:0.78rem;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.05em;">' + esc(t('opp.score')) + '</div>' +
        '<div class="score-num" style="font-size:2.4rem;">' + c.score + '<span style="font-size:1rem;color:var(--faint);">/100</span></div>' +
        '<span class="badge">' + esc(scoreLabelLocal(c.scoreLabel)) + '</span></div>' +
        '</div>' +

        '<div style="margin-top:20px;"><div class="label" style="font-size:.82rem;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px;">' + esc(t('opp.signal')) + '</div>' +
        '<div class="score-bar"><span style="width:' + c.score + '%"></span></div></div>' +

        '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:16px;margin-top:24px;">' +
        metric(t('opp.m.categories'), (c.categories || []).map(function (x) { return catName(x.name) + ' (' + x.count + ')'; }).join(', ') || '—') +
        metric(t('opp.m.locations'), (c.locations || []).join(', ') || '—') +
        metric(t('opp.m.keywords'), (c.keywords || []).slice(0, 8).map(function (k) { return '<span class="kw-chip">' + esc(k) + '</span>'; }).join('') || '—') +
        metric(t('opp.m.trend'), trendChart(trend)) +
        '</div>' +
        '</div></div>' +

        '<div class="grid" style="grid-template-columns:1fr 1fr;margin-top:18px;">' +
        '<div class="panel"><div class="panel-head"><h3>' + esc(t('opp.problems')) + '</h3></div><div class="panel-body">' +
        subs.slice(0, 5).map(function (s) { return '<div class="quote">' + esc(s.problem) + '<span class="who">' + esc(s.id) + ' · ' + esc(catName(s.category)) + '</span></div>'; }).join('') +
        '</div></div>' +
        '<div class="panel"><div class="panel-head"><h3>' + esc(t('opp.solutions')) + '</h3></div><div class="panel-body">' +
        subs.slice(0, 5).map(function (s) { return '<div class="quote">' + esc(s.desiredSolution) + '<span class="who">' + esc(s.id) + '</span></div>'; }).join('') +
        '</div></div>' +
        '</div>' +

        '<div class="panel" style="margin-top:18px;"><div class="panel-head"><h3>' + esc(t('opp.rep')) + '</h3></div>' +
        '<div class="table-wrap"><table><thead><tr><th>' + esc(t('sub.th.id')) + '</th><th>' + esc(t('sub.th.date')) + '</th><th>' + esc(t('sub.th.category')) + '</th><th>' + esc(t('sub.th.problem')) + '</th><th>' + esc(t('sub.th.location')) + '</th></tr></thead><tbody>' +
        subs.map(function (s) {
          return '<tr><td class="mono">' + esc(s.id) + '</td><td style="white-space:nowrap;">' + fmtDate(s.createdAt) + '</td><td><span class="badge">' + esc(catName(s.category)) + '</span></td><td>' + esc(s.problem) + '</td><td>' + (s.broadLocation || '—') + '</td></tr>';
        }).join('') +
        '</tbody></table></div></div>' +

        '<div class="panel" style="margin-top:18px;"><div class="panel-head"><h3>' + esc(t('opp.research')) + '</h3><span class="hint" style="margin:0;">' + esc(t('opp.research.hint')) + '</span></div>' +
        '<div class="panel-body">' +
        '<p style="max-width:720px;">' + esc(t('opp.research.body')) + '</p>' +
        '<button class="btn btn-primary" id="gen-report">' + esc(t('opp.research.btn')) + '</button>' +
        '</div></div>' + reports;

      var gen = el('gen-report');
      if (gen) gen.addEventListener('click', function () {
        gen.disabled = true; gen.innerHTML = '<span class="spinner"></span> ' + esc(t('opp.research.generating'));
        fetchJSON(API + '/admin/opportunities/' + id + '/report', { method: 'POST', body: { lang: window.IP ? window.IP.lang : 'en' } }).then(function (res) {
          toast(t('toast.report'));
          renderOpportunityDetail(root, id);
        }).catch(function (err) { toast(err.message, 'err'); gen.disabled = false; gen.textContent = t('opp.research.btn'); });
      });

      if (d.report) {
        var rb = el('report-body');
        if (rb) rb.innerHTML = renderMarkdown(d.report.content);
        var dl = el('dl-report');
        if (dl) dl.addEventListener('click', function () {
          downloadText('ideapulse-report-' + c.slug + '.md', d.report.content);
        });
      }
      bindClicks(root);
    }).catch(function (err) { root.innerHTML = errorState(err.message); });
  }

  function metric(label, html) {
    return '<div><div style="font-size:.78rem;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px;">' + esc(label) + '</div><div style="font-size:.95rem;color:var(--ink);">' + html + '</div></div>';
  }

  function trendChart(trend) {
    if (!trend || trend.length < 2) return '<span style="color:var(--faint);">' + esc(t('opp.trend.empty')) + '</span>';
    var w = 240, h = 90, pad = 6;
    var max = Math.max.apply(null, trend.map(function (t) { return t.count; }));
    var pts = trend.map(function (t, i) {
      var x = pad + (i * (w - 2 * pad)) / (trend.length - 1);
      var y = h - pad - ((h - 2 * pad) * (t.count / max));
      return x.toFixed(1) + ',' + y.toFixed(1);
    }).join(' ');
    return '<svg width="100%" height="' + h + '" viewBox="0 0 ' + w + ' ' + h + '" preserveAspectRatio="none">' +
      '<polyline points="' + pts + '" fill="none" stroke="#7c3aed" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>' +
      '<polygon points="' + pad + ',' + (h - pad) + ' ' + pts + ' ' + (w - pad) + ',' + (h - pad) + '" fill="url(#tg)" opacity="0.25"/>' +
      '<defs><linearGradient id="tg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7c3aed"/><stop offset="1" stop-color="#d946ef" stop-opacity="0"/></linearGradient></defs>' +
      '</svg>';
  }

  function renderMarkdown(md) {
    var s = esc(md);
    var lines = s.split('\n');
    var out = [];
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];
      if (/^## /.test(line)) out.push('<h2>' + line.slice(3) + '</h2>');
      else if (/^# /.test(line)) out.push('<h1>' + line.slice(2) + '</h1>');
      else if (/^&gt; /.test(line)) out.push('<blockquote>' + line.slice(5) + '</blockquote>');
      else if (/^---$/.test(line.trim())) out.push('<hr style="border:none;border-top:1px solid var(--line);margin:20px 0;">');
      else if (line.trim() === '') out.push('');
      else out.push('<p>' + line + '</p>');
    }
    var html = out.join('\n');
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
    return html;
  }

  function downloadText(name, text) {
    var blob = new Blob([text], { type: 'text/markdown;charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }

  // ── Analytics ──────────────────────────────────────────────
  function renderAnalytics(root) {
    loading(root);
    fetchJSON(API + '/admin/analytics').then(function (d) {
      root.innerHTML =
        '<h2 style="margin-bottom:18px;">' + esc(t('an.title')) + '</h2>' +
        '<div class="chart-grid">' +
        barPanel(t('an.categories'), d.categories, 'category') +
        linePanel(t('an.time'), d.timelineMonthly, 'month') +
        barPanel(t('an.solutions'), d.topSolutions, 'q') +
        barPanel(t('an.keywords'), d.topKeywords, 'q') +
        barPanel(t('an.clusters'), (d.topClusters || []).map(function (c) { return { name: c.title, count: c.submissionCount, id: c.id }; }), 'opp') +
        barPanel(t('an.geo'), d.geo, 'location') +
        '</div>' +
        '<p class="hint" style="margin-top:16px;">' + esc(t('an.click')) + '</p>';
      bindClicks(root);
    }).catch(function (err) { root.innerHTML = errorState(err.message); });
  }

  function barPanel(title, items, kind) {
    var list = (items || []).slice(0, 8);
    var body = list.length
      ? '<div class="bars">' + list.map(function (p) {
          var max = list[0].count || 1;
          var label = kind === 'category' ? catName(p.name) : p.name;
          var attrs = kind === 'category' ? 'data-category="' + esc(p.name) + '"'
            : kind === 'location' ? 'data-location="' + esc(p.name) + '"'
            : kind === 'opp' ? 'data-opp="' + esc(p.id || '') + '"'
            : 'data-q="' + esc(p.name) + '"';
          return '<div class="bar-row"><span class="name" ' + attrs + '>' + esc(label) + '</span>' +
            '<span class="track"><span class="fill" style="width:' + Math.round((p.count / max) * 100) + '%"></span></span>' +
            '<span class="cnt">' + p.count + '</span></div>';
        }).join('') + '</div>'
      : emptyState(t('ov.empty.data'));
    return '<div class="chart"><h4>' + esc(title) + '</h4><div class="cap">' + esc(t('an.clickbar')) + '</div>' + body + '</div>';
  }

  function linePanel(title, points, keyField) {
    var pts = (points || []);
    var body = pts.length > 1 ? lineChart(pts, keyField) : emptyState(t('an.empty.history'));
    return '<div class="chart"><h4>' + esc(title) + '</h4><div class="cap">' + pts.length + ' ' + esc(t('an.buckets')) + '</div>' + body + '</div>';
  }

  function lineChart(points, keyField) {
    var w = 460, h = 200, padL = 34, padR = 14, padT = 14, padB = 26;
    var max = Math.max.apply(null, points.map(function (p) { return p.count; })) || 1;
    var iw = w - padL - padR, ih = h - padT - padB;
    var coords = points.map(function (p, i) {
      var x = padL + (points.length === 1 ? iw / 2 : (i * iw) / (points.length - 1));
      var y = padT + ih - (ih * (p.count / max));
      return { x: x, y: y, p: p };
    });
    var line = coords.map(function (c) { return c.x.toFixed(1) + ',' + c.y.toFixed(1); }).join(' ');
    var area = padL + ',' + (padT + ih) + ' ' + line + ' ' + (padL + iw) + ',' + (padT + ih);
    var dots = coords.map(function (c) {
      return '<circle cx="' + c.x.toFixed(1) + '" cy="' + c.y.toFixed(1) + '" r="3.4" fill="#7c3aed"/>' +
        '<title>' + esc(c.p[keyField]) + ': ' + c.p.count + '</title>';
    }).join('');
    var xlabels = coords.filter(function (_, i) { return coords.length <= 8 || i % Math.ceil(coords.length / 8) === 0; })
      .map(function (c) { return '<text x="' + c.x.toFixed(1) + '" y="' + (h - 6) + '" font-size="10" fill="#9aa1b1" text-anchor="middle">' + esc(c.p[keyField]) + '</text>'; }).join('');
    return '<svg class="line-chart" viewBox="0 0 ' + w + ' ' + h + '" preserveAspectRatio="none">' +
      '<defs><linearGradient id="lg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7c3aed" stop-opacity="0.28"/><stop offset="1" stop-color="#d946ef" stop-opacity="0"/></linearGradient></defs>' +
      '<polygon points="' + area + '" fill="url(#lg)"/>' +
      '<polyline points="' + line + '" fill="none" stroke="#7c3aed" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>' +
      dots + xlabels + '</svg>';
  }

  // ── Event binding helpers ──────────────────────────────────
  function bindClicks(root) {
    root.querySelectorAll('[data-category]').forEach(function (n) {
      n.addEventListener('click', function () { filterTo('category', n.getAttribute('data-category')); });
    });
    root.querySelectorAll('[data-location]').forEach(function (n) {
      n.addEventListener('click', function () { filterTo('location', n.getAttribute('data-location')); });
    });
    root.querySelectorAll('[data-q]').forEach(function (n) {
      n.addEventListener('click', function () { filterTo('q', n.getAttribute('data-q')); });
    });
    root.querySelectorAll('[data-opp]').forEach(function (n) {
      n.addEventListener('click', function () { renderOpportunityDetail(el('view'), n.getAttribute('data-opp')); });
    });
    root.querySelectorAll('[data-nav]').forEach(function (n) {
      n.addEventListener('click', function () { setView(n.getAttribute('data-nav')); });
    });
  }

  function filterTo(key, value) {
    state.filters = { q: '', category: '', location: '', from: '', to: '', sort: 'newest' };
    if (key === 'category') state.filters.category = value;
    else if (key === 'location') state.filters.location = value;
    else state.filters.q = value;
    state.page = 1;
    setView('submissions');
  }

  function fmtDate(iso) {
    var d = new Date(iso);
    if (isNaN(d)) return esc(iso);
    var locale = (window.IP && window.IP.lang === 'bn') ? 'bn-BD' : undefined;
    return d.toLocaleString(locale, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  // ── Boot ───────────────────────────────────────────────────
  function boot() {
    var page = document.body ? document.body.getAttribute('data-page') : null;
    if (page === 'submit') initSubmit();
    else if (page === 'admin-login') initAdminLogin();
    else if (page === 'admin') initAdmin();
    initLanding();
  }

  // Called by i18n.js whenever the language changes: re-render the current
  // admin view (its labels are built dynamically) and re-apply static labels.
  window.__onLangChange = function () {
    var page = document.body ? document.body.getAttribute('data-page') : null;
    if (page === 'admin') {
      renderCurrent();
    }
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
