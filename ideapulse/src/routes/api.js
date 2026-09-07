'use strict';

// Public + admin API routes.
//
// PUBLIC (no auth):  POST /api/submissions            — create an anonymous submission
//
// ADMIN (auth):      GET  /api/admin/overview         — dashboard metrics
//                    GET  /api/admin/submissions      — search/filter/sort/paginate
//                    GET  /api/admin/submissions/export — CSV / Excel
//                    GET  /api/admin/analytics        — chart data
//                    GET  /api/admin/opportunities    — clusters list
//                    GET  /api/admin/opportunities/:id — cluster detail
//                    GET  /api/admin/opportunities/export — CSV / Excel
//                    POST /api/admin/opportunities/:id/report — generate report
//                    POST /api/admin/reanalyze        — rebuild clusters

const express = require('express');
const crypto = require('crypto');
const security = require('../security');
const text = require('../text');
const util = require('../util');
const exportUtil = require('../export');
const { generateReport } = require('../reports');
const { requireAdmin } = require('./admin');
const { db } = require('../db');
const { rebuildClusters } = require('../clusters');

const router = express.Router();

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC — submission intake
// ─────────────────────────────────────────────────────────────────────────────

function anonymousId() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = 'IP-';
  const bytes = crypto.randomBytes(8);
  for (let i = 0; i < 8; i++) out += alphabet[bytes[i] % alphabet.length];
  return out;
}

router.post(
  '/submissions',
  security.rateLimit({ name: 'submit', max: 5, windowMs: 60_000 }),
  (req, res) => {
    const validation = util.validateSubmission(req.body || {});
    if (!validation.ok) return res.status(400).json({ error: validation.error });

    const { problem, desiredSolution, category, broadLocation } = validation.data;

    // Basic spam protection: reject near-duplicate text from the same window.
    const dupWindow = new Date(Date.now() - 5 * 60_000).toISOString();
    const dupe = db
      .prepare('SELECT id FROM submissions WHERE problem = ? AND created_at >= ? LIMIT 1')
      .get(problem, dupWindow);
    if (dupe) {
      // Silently accept but don't duplicate — keeps UX smooth and spam harmless.
      return res.status(201).json({ ok: true, id: dupe.id, duplicate: true });
    }

    const id = anonymousId();
    const keywords = text.extractKeywords(problem + ' ' + desiredSolution);
    const ts = new Date().toISOString();

    db.prepare(
      `INSERT INTO submissions (id, problem, desired_solution, category, broad_location, keywords, created_at, updated_at)
       VALUES (?,?,?,?,?,?,?,?)`
    ).run(id, problem, desiredSolution, category, broadLocation, JSON.stringify(keywords), ts, ts);

    // Keep opportunity clusters in sync. Fast for MVP-sized datasets; an
    // error here must never fail the submission itself.
    try {
      rebuildClusters(db);
    } catch (err) {
      console.error('[ideapulse] cluster rebuild after submission failed:', err.message);
    }

    res.status(201).json({ ok: true, id });
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN — all routes below require a valid session
// ─────────────────────────────────────────────────────────────────────────────
router.use('/admin', requireAdmin);

// --- Overview metrics ---------------------------------------------------------
router.get('/admin/overview', (req, res) => {
  const total = db.prepare('SELECT COUNT(*) c FROM submissions').get().c;
  const today = db.prepare('SELECT COUNT(*) c FROM submissions WHERE created_at >= ?').get(util.startOfDayUTC()).c;
  const week = db.prepare('SELECT COUNT(*) c FROM submissions WHERE created_at >= ?').get(util.startOfWeekUTC()).c;
  const month = db.prepare('SELECT COUNT(*) c FROM submissions WHERE created_at >= ?').get(util.startOfMonthUTC()).c;

  const categories = db
    .prepare('SELECT category, COUNT(*) c FROM submissions GROUP BY category ORDER BY c DESC')
    .all()
    .map((r) => ({ name: r.category, count: r.c }));

  // Most frequently mentioned problems = most frequent problem keywords.
  const problemFreq = keywordFrequency(
    db.prepare('SELECT problem FROM submissions').all(),
    (r) => r.problem
  );

  // Trending opportunities = clusters with the most activity in the last 30 days.
  const since30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const trending = db
    .prepare(
      `SELECT c.id, c.title, c.score, c.score_label, c.submission_count, COUNT(s.id) recent
         FROM opportunity_clusters c
         LEFT JOIN cluster_submissions cs ON cs.cluster_id = c.id
         LEFT JOIN submissions s ON s.id = cs.submission_id AND s.created_at >= ?
        GROUP BY c.id ORDER BY recent DESC, c.score DESC LIMIT 6`
    )
    .all(since30)
    .map((r) => ({ id: r.id, title: r.title, score: r.score, scoreLabel: r.score_label, submissionCount: r.submission_count, recent: r.recent }));

  const clusters = db.prepare('SELECT * FROM opportunity_clusters ORDER BY score DESC LIMIT 6').all();

  res.json({
    total,
    today,
    thisWeek: week,
    thisMonth: month,
    mostCommonCategory: categories[0] ? categories[0].name : null,
    categories,
    topProblems: problemFreq.slice(0, 8),
    trendingOpportunities: trending,
    topClusters: clusters.map(clusterView),
  });
});

function keywordFrequency(rows, getter) {
  const counts = {};
  for (const row of rows) {
    const tokens = text.tokenize(getter(row));
    const seen = new Set();
    for (const w of tokens) {
      if (text.QUALIFIER_STOP.has(w) || seen.has(w)) continue;
      seen.add(w);
      counts[w] = (counts[w] || 0) + 1;
    }
    for (const b of bigrams(tokens)) {
      if (seen.has(b)) continue;
      const parts = b.split(' ');
      if (parts.some((p) => text.QUALIFIER_STOP.has(p))) continue;
      seen.add(b);
      counts[b] = (counts[b] || 0) + 1;
    }
  }
  return Object.entries(counts)
    .map(([word, count]) => ({ word, count }))
    .sort((a, b) => b.count - a.count || a.word.localeCompare(b.word));
}

function bigrams(tokens) {
  const out = [];
  for (let i = 0; i < tokens.length - 1; i++) out.push(tokens[i] + ' ' + tokens[i + 1]);
  return out;
}

// --- Search / filter / sort ----------------------------------------------------
function buildSubmissionQuery(query) {
  const clauses = [];
  const params = [];

  if (query.q) {
    const like = `%${query.q}%`;
    clauses.push('(problem LIKE ? OR desired_solution LIKE ? OR broad_location LIKE ? OR id LIKE ?)');
    params.push(like, like, like, like);
  }
  if (query.category) {
    clauses.push('category = ?');
    params.push(query.category);
  }
  if (query.location) {
    clauses.push('broad_location LIKE ?');
    params.push(`%${query.location}%`);
  }
  if (query.from) {
    clauses.push('created_at >= ?');
    params.push(dateStart(query.from));
  }
  if (query.to) {
    clauses.push('created_at <= ?');
    params.push(dateEnd(query.to));
  }
  const where = clauses.length ? 'WHERE ' + clauses.join(' AND ') : '';

  let order = 'ORDER BY created_at DESC';
  if (query.sort === 'oldest') order = 'ORDER BY created_at ASC';
  else if (query.sort === 'category') order = 'ORDER BY category ASC, created_at DESC';
  else if (query.sort === 'location') order = 'ORDER BY broad_location ASC, created_at DESC';

  return { where, params, order };
}

function dateStart(v) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return `${v}T00:00:00.000Z`;
  return new Date(v).toISOString();
}
function dateEnd(v) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return `${v}T23:59:59.999Z`;
  return new Date(v).toISOString();
}

router.get('/admin/submissions', (req, res) => {
  const { where, params, order } = buildSubmissionQuery(req.query);
  const { page, limit, offset } = util.paging(req.query, 20, 200);

  const total = db.prepare(`SELECT COUNT(*) c FROM submissions ${where}`).get(...params).c;
  const rows = db
    .prepare(`SELECT * FROM submissions ${where} ${order} LIMIT ? OFFSET ?`)
    .all(...params, limit, offset)
    .map(util.publicSubmission);

  const categories = db
    .prepare('SELECT DISTINCT category FROM submissions ORDER BY category')
    .all()
    .map((r) => r.category);
  const locations = db
    .prepare("SELECT DISTINCT broad_location FROM submissions WHERE broad_location IS NOT NULL AND broad_location != '' ORDER BY broad_location")
    .all()
    .map((r) => r.broad_location);

  res.json({ items: rows, total, page, limit, categories, locations });
});

// --- Export --------------------------------------------------------------------
function submissionExportRows(query) {
  const { where, params, order } = buildSubmissionQuery(query);
  return db
    .prepare(`SELECT * FROM submissions ${where} ${order}`)
    .all(...params)
    .map((r) => ({
      id: r.id,
      createdAt: r.created_at,
      category: r.category,
      problem: r.problem,
      desiredSolution: r.desired_solution,
      broadLocation: r.broad_location || '',
    }));
}

router.get('/admin/submissions/export', (req, res) => {
  const rows = submissionExportRows(req.query);
  const format = String(req.query.format || 'csv').toLowerCase();

  if (format === 'xls' || format === 'xlsx' || format === 'excel') {
    res.setHeader('Content-Type', 'application/vnd.ms-excel');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="ideapulse-submissions-${stamp()}.xls"`
    );
    return res.send(exportUtil.toSpreadsheetML(rows, exportUtil.SUBMISSION_COLUMNS));
  }

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="ideapulse-submissions-${stamp()}.csv"`);
  // UTF-8 BOM so Excel renders non-ASCII text correctly.
  res.send('\uFEFF' + exportUtil.toCsv(rows, exportUtil.SUBMISSION_COLUMNS));
});

function stamp() {
  return new Date().toISOString().slice(0, 10);
}

// --- Analytics ------------------------------------------------------------------
router.get('/admin/analytics', (req, res) => {
  const categories = db
    .prepare('SELECT category, COUNT(*) c FROM submissions GROUP BY category ORDER BY c DESC')
    .all()
    .map((r) => ({ name: r.category, count: r.c }));

  const monthly = db
    .prepare("SELECT substr(created_at,1,7) m, COUNT(*) c FROM submissions GROUP BY m ORDER BY m")
    .all()
    .map((r) => ({ month: r.m, count: r.c }));

  const since90 = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
  const daily = db
    .prepare("SELECT substr(created_at,1,10) d, COUNT(*) c FROM submissions WHERE created_at >= ? GROUP BY d ORDER BY d")
    .all(since90)
    .map((r) => ({ day: r.d, count: r.c }));

  const solutionFreq = keywordFrequency(
    db.prepare('SELECT desired_solution FROM submissions').all(),
    (r) => r.desired_solution
  );
  const keywordFreq = keywordFrequency(
    db.prepare('SELECT problem, desired_solution FROM submissions').all(),
    (r) => `${r.problem} ${r.desired_solution}`
  );

  const geo = db
    .prepare("SELECT broad_location, COUNT(*) c FROM submissions WHERE broad_location IS NOT NULL AND broad_location != '' GROUP BY broad_location ORDER BY c DESC LIMIT 30")
    .all()
    .map((r) => ({ name: r.broad_location, count: r.c }));

  const clusters = db
    .prepare('SELECT * FROM opportunity_clusters ORDER BY score DESC LIMIT 12')
    .all()
    .map(clusterView);

  res.json({
    categories,
    timelineMonthly: monthly,
    timelineDaily: daily,
    topSolutions: solutionFreq.slice(0, 12),
    topKeywords: keywordFreq.slice(0, 30),
    geo,
    topClusters: clusters,
  });
});

// --- Opportunity clusters --------------------------------------------------------
function clusterView(c) {
  return {
    id: c.id,
    slug: c.slug,
    title: c.title,
    description: c.description,
    score: c.score,
    scoreLabel: c.score_label,
    submissionCount: c.submission_count,
    keywords: safeJson(c.keywords, []),
    categories: safeJson(c.categories, []),
    locations: safeJson(c.locations, []),
    trend: safeJson(c.trend, []),
    createdAt: c.created_at,
    updatedAt: c.updated_at,
  };
}
function safeJson(v, fallback) {
  try {
    return typeof v === 'string' ? JSON.parse(v) : v || fallback;
  } catch {
    return fallback;
  }
}

router.get('/admin/opportunities', (req, res) => {
  const clusters = db
    .prepare('SELECT * FROM opportunity_clusters ORDER BY score DESC, submission_count DESC')
    .all()
    .map(clusterView);
  res.json({ items: clusters });
});

router.get('/admin/opportunities/export', (req, res) => {
  const clusters = db
    .prepare('SELECT * FROM opportunity_clusters ORDER BY score DESC')
    .all()
    .map((c) => ({
      id: c.id,
      title: c.title,
      score: c.score,
      scoreLabel: c.score_label,
      submissionCount: c.submission_count,
      categories: (safeJson(c.categories, []) || []).map((x) => `${x.name} (${x.count})`).join('; '),
      locations: (safeJson(c.locations, []) || []).join('; '),
      keywords: (safeJson(c.keywords, []) || []).join(', '),
    }));
  const format = String(req.query.format || 'csv').toLowerCase();
  if (format === 'xls' || format === 'xlsx' || format === 'excel') {
    res.setHeader('Content-Type', 'application/vnd.ms-excel');
    res.setHeader('Content-Disposition', `attachment; filename="ideapulse-opportunities-${stamp()}.xls"`);
    return res.send(exportUtil.toSpreadsheetML(clusters, exportUtil.OPPORTUNITY_COLUMNS));
  }
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="ideapulse-opportunities-${stamp()}.csv"`);
  res.send('\uFEFF' + exportUtil.toCsv(clusters, exportUtil.OPPORTUNITY_COLUMNS));
});

router.get('/admin/opportunities/:id', (req, res) => {
  const id = util.toInt(req.params.id, 0);
  const cluster = db.prepare('SELECT * FROM opportunity_clusters WHERE id = ?').get(id);
  if (!cluster) return res.status(404).json({ error: 'Opportunity not found.' });

  const subs = db
    .prepare(
      `SELECT s.* FROM submissions s
        JOIN cluster_submissions cs ON cs.submission_id = s.id
       WHERE cs.cluster_id = ? ORDER BY s.created_at DESC`
    )
    .all(id)
    .map(util.publicSubmission);

  const reportRows = db
    .prepare('SELECT * FROM generated_reports WHERE cluster_id = ? ORDER BY created_at DESC LIMIT 1')
    .get(id);

  res.json({
    cluster: clusterView(cluster),
    submissions: subs,
    report: reportRows
      ? { format: reportRows.format, content: reportRows.content, createdAt: reportRows.created_at }
      : null,
  });
});

router.post('/admin/opportunities/:id/report', (req, res) => {
  const id = util.toInt(req.params.id, 0);
  const cluster = db.prepare('SELECT * FROM opportunity_clusters WHERE id = ?').get(id);
  if (!cluster) return res.status(404).json({ error: 'Opportunity not found.' });

  const subs = db
    .prepare(
      `SELECT s.* FROM submissions s
        JOIN cluster_submissions cs ON cs.submission_id = s.id
       WHERE cs.cluster_id = ? ORDER BY s.created_at ASC`
    )
    .all(id);

  const lang = req.body && req.body.lang === 'bn' ? 'bn' : 'en';
  const report = generateReport(clusterView(cluster), subs, lang);
  const markdown = renderMarkdown(report, lang);

  const info = db
    .prepare('INSERT INTO generated_reports (cluster_id, format, content, created_at) VALUES (?,?,?,?)')
    .run(id, 'markdown', markdown, new Date().toISOString());

  res.json({ id: Number(info.lastInsertRowid), content: markdown, report });
});

function renderMarkdown(report, lang) {
  const s = report.sections
    .map((sec) => `## ${sec.heading}\n\n${sec.body}\n`)
    .join('\n');
  const T = lang === 'bn'
    ? {
        reportTitle: 'ব্যবসায়িক গবেষণা প্রতিবেদন',
        scoreLine: `অভ্যন্তরীণ সুযোগ স্কোর: **${report.score}/100 (${report.scoreLabel})**।`,
        disclaimer1: 'এই স্কোর শুধুমাত্র ইউজার ফিডব্যাকের সংকেতের শক্তি নির্দেশ করে। এটি গ্রাহক,',
        disclaimer2: 'আয় বা লাভের কোনো নিশ্চয়তা নয়।',
        generated: 'তৈরি',
        footer: 'IdeaPulse দ্বারা তৈরি। এটিকে গবেষণার প্রমাণ হিসেবে বিবেচনা করুন, বিনিয়োগের পরামর্শ হিসেবে নয়।'
      }
    : {
        reportTitle: 'Business Research Report',
        scoreLine: `Internal opportunity score: **${report.score}/100 (${report.scoreLabel})**.`,
        disclaimer1: 'This score reflects the strength of the user-feedback signal only. It is NOT a',
        disclaimer2: 'guarantee of customers, revenue, or profitability.',
        generated: 'Generated',
        footer: 'Generated by IdeaPulse. Treat as research evidence, not investment advice.'
      };

  return [
    `# ${T.reportTitle} — ${report.title}`,
    '',
    `> ${T.scoreLine}`,
    `> ${T.disclaimer1}`,
    `> ${T.disclaimer2}`,
    '',
    `*${T.generated} ${new Date(report.generatedAt).toISOString()}*`,
    '',
    s,
    '',
    '---',
    `*${T.footer}*`,
  ].join('\n');
}

router.post('/admin/reanalyze', (req, res) => {
  const result = rebuildClusters(db);
  res.json({ ok: true, clusters: result.clusters });
});

module.exports = { router };
