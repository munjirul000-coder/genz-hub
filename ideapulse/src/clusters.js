'use strict';

// Opportunity clustering + scoring engine.
//
// Deterministic, AI-free pipeline (an external AI API can enrich the same
// JSON shapes later — see README):
//
//   1. Load every submission and its stored keyword profile.
//   2. Find recurring themes (single words + bigrams) across the corpus,
//      ignoring generic qualifiers ("verified", "easy", "app", …).
//   3. Greedily group submissions around the strongest themes, merging
//      overlapping theme groups so one theme doesn't fragment into many.
//   4. Label each cluster with a human title ("Trusted Organic Food").
//   5. Score each cluster 0–100 — an *internal demand signal*, NOT a
//      guarantee of customers or profitability.

const text = require('./text');

function parseKeywords(json) {
  try {
    return typeof json === 'string' ? JSON.parse(json) : json || {};
  } catch {
    return {};
  }
}

function cleanLocation(raw) {
  const loc = String(raw || '').trim();
  if (!loc) return null;
  return loc.replace(/\s+/g, ' ').slice(0, 80);
}

function topKeywords(counts, n = 8) {
  return Object.entries(counts)
    .filter(([w]) => !text.QUALIFIER_STOP.has(w))
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, n)
    .map(([w]) => w);
}

// ── Theme discovery & grouping ────────────────────────────────────────────────
// Clustering works in two deterministic passes:
//
//   Pass 1 — discover recurring themes (words/bigrams shared by ≥2 submissions)
//            and, within each category, greedily build a cluster around the
//            strongest themes. Every submission belongs to at most one cluster,
//            which prevents a generic word from gluing unrelated topics.
//   Pass 2 — "sweep": any submission not yet claimed joins its most similar
//            cluster when it clearly belongs (Dice ≥ threshold).
//
// An external AI API can replace/augment these passes later without changing
// the data model.

const DICE_THRESHOLD = 0.05;

function makeVector(kw) {
  const vec = {};
  for (const [w, c] of Object.entries(kw || {})) {
    if (!w || text.QUALIFIER_STOP.has(w)) continue;
    vec[w] = c * (w.includes(' ') ? 2 : 1);
  }
  return vec;
}

function diceSimilarity(a, b) {
  let inter = 0;
  let totalA = 0;
  let totalB = 0;
  for (const c of Object.values(a)) totalA += c;
  for (const c of Object.values(b)) totalB += c;
  if (!totalA || !totalB) return 0;
  for (const k of Object.keys(a)) {
    if (b[k]) inter += Math.min(a[k], b[k]);
  }
  return (2 * inter) / (totalA + totalB);
}

function centroidOf(vecs) {
  const sum = {};
  for (const v of vecs) {
    for (const [k, val] of Object.entries(v)) sum[k] = (sum[k] || 0) + val;
  }
  return sum;
}

// Pass 1: cluster each category's submissions around recurring themes.
function themeClustersWithinCategory(subs) {
  const df = new Map();
  subs.forEach((row, idx) => {
    for (const w of Object.keys(parseKeywords(row.keywords))) {
      if (!w || text.QUALIFIER_STOP.has(w)) continue;
      if (!df.has(w)) df.set(w, new Set());
      df.get(w).add(idx);
    }
  });
  const themes = Array.from(df.entries())
    .filter(([, set]) => set.size >= 2)
    .sort(
      (a, b) =>
        b[1].size - a[1].size ||
        (b[0].includes(' ') ? 1 : 0) - (a[0].includes(' ') ? 1 : 0) ||
        b[0].length - a[0].length ||
        a[0].localeCompare(b[0])
    );

  const assigned = new Set();
  const clusters = [];
  for (const [, members] of themes) {
    const fresh = Array.from(members).filter((idx) => !assigned.has(idx));
    if (fresh.length >= 2) {
      fresh.forEach((idx) => assigned.add(idx));
      clusters.push({ rows: fresh.map((idx) => subs[idx]), vecs: fresh.map((idx) => makeVector(parseKeywords(subs[idx].keywords))) });
    }
  }
  return { clusters, assigned };
}

// Pass 2: sweep unassigned submissions into their nearest cluster.
function sweep(clusters, subs, assigned) {
  for (let idx = 0; idx < subs.length; idx++) {
    if (assigned.has(idx)) continue;
    const vec = makeVector(parseKeywords(subs[idx].keywords));
    if (!Object.keys(vec).length) continue;
    let best = -1;
    let bestSim = -1;
    for (let c = 0; c < clusters.length; c++) {
      const s = diceSimilarity(vec, centroidOf(clusters[c].vecs));
      if (s > bestSim) {
        bestSim = s;
        best = c;
      }
    }
    if (best >= 0 && bestSim >= DICE_THRESHOLD) {
      clusters[best].rows.push(subs[idx]);
      clusters[best].vecs.push(vec);
      assigned.add(idx);
    }
  }
  return clusters;
}

function clusterByCategoryAndTheme(rows) {
  const byCategory = new Map();
  for (const r of rows) {
    if (!byCategory.has(r.category)) byCategory.set(r.category, []);
    byCategory.get(r.category).push(r);
  }

  const groups = [];
  for (const subs of byCategory.values()) {
    if (subs.length < 2) continue;
    const { clusters, assigned } = themeClustersWithinCategory(subs);
    sweep(clusters, subs, assigned);
    for (const c of clusters) {
      if (c.rows.length >= 2) groups.push(c.rows);
    }
  }
  return groups;
}

// ── Titles ─────────────────────────────────────────────────────────────────────
const QUALIFIERS = [
  { re: /trust|verif|certif|genuine|authentic/, label: 'Trusted' },
  { re: /affordable|cheap|expensive|price|pricing|cost|pay/, label: 'Affordable' },
  { re: /reliab|dependab/, label: 'Reliable' },
  { re: /real.?time|live|predict|instant|automatic|automatically|auto.?/, label: 'Real-Time' },
  { re: /online|website|platform/, label: 'Online' },
  { re: /\blocal\b/, label: 'Local' },
  { re: /fast|quick|speed|instant/, label: 'Fast' },
  { re: /simple|easy|hassle/, label: 'Simple' },
  { re: /smart|intelligent/, label: 'Smart' },
];

function titleCase(phrase) {
  return phrase
    .split(' ')
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(' ');
}

function buildTitle(members, mergedCounts) {
  const corpus = members.map((m) => `${m.problem} ${m.desiredSolution}`).join(' ').toLowerCase();

  let qualifier = '';
  for (const q of QUALIFIERS) {
    if (q.re.test(corpus)) {
      qualifier = q.label;
      break;
    }
  }

  // Document frequency: how many members actually mention each keyword?
  const docFreq = {};
  for (const m of members) {
    for (const w of new Set(Object.keys(parseKeywords(m.keywords)))) {
      if (text.QUALIFIER_STOP.has(w)) continue;
      docFreq[w] = (docFreq[w] || 0) + 1;
    }
  }

  const pick = (hasSpace) =>
    Object.entries(docFreq)
      .filter(([w]) => hasSpace === w.includes(' '))
      .sort(
        (a, b) =>
          b[1] - a[1] ||
          (mergedCounts[b[0]] || 0) - (mergedCounts[a[0]] || 0) ||
          a[0].localeCompare(b[0])
      )[0];

  const bigram = pick(true);
  const word = pick(false);

  let subject;
  if (bigram && bigram[1] >= 2) subject = bigram[0];
  else if (word) subject = word[0];
  else subject = 'Opportunity';

  const title = qualifier ? `${qualifier} ${titleCase(subject)}` : titleCase(subject);
  return title.replace(/\s+/g, ' ').slice(0, 80);
}

// ── Scoring ────────────────────────────────────────────────────────────────────
function trendFor(members) {
  const buckets = new Map();
  for (const r of members) {
    const key = String(r.created_at || '').slice(0, 7);
    if (key) buckets.set(key, (buckets.get(key) || 0) + 1);
  }
  return Array.from(buckets.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([bucket, count]) => ({ bucket, count }));
}

function scoreCluster(members) {
  const n = members.length;
  const locations = new Set(members.map((r) => cleanLocation(r.broad_location)).filter(Boolean));
  const categories = {};
  for (const r of members) categories[r.category] = (categories[r.category] || 0) + 1;

  let strength = 0;
  for (const r of members) {
    const combined = `${r.problem} ${r.desiredSolution}`.toLowerCase();
    const explicit = /\b(i wish|i need|i want|i can'?t|i cannot|cannot find|hard to find|no one|there is no|struggle|frustrat|annoying|impossible)\b/.test(combined);
    strength += explicit ? 1 : 0;
  }
  const strengthRatio = strength / n;

  const times = members.map((r) => new Date(r.created_at).getTime()).sort((a, b) => a - b);
  let growth = 0;
  if (times.length >= 3) {
    const mid = times[Math.floor(times.length / 2)];
    const recent = times.filter((t) => t >= mid).length;
    const older = times.length - recent;
    if (older > 0) growth = Math.min(1, recent / older / 2);
  }

  const sizeComponent = Math.min(30, n * 6);
  const locationComponent = Math.min(18, locations.size * 4.5);
  const categoryComponent = Math.min(8, Object.keys(categories).length * 2);
  const strengthComponent = Math.min(22, Math.round(strengthRatio * 22));
  const growthComponent = Math.min(12, Math.round(growth * 12));
  const volumeComponent = Math.min(10, Math.round(Math.log10(1 + n) * 10));

  const score = Math.round(
    sizeComponent + locationComponent + categoryComponent + strengthComponent + growthComponent + volumeComponent
  );
  return { score: Math.max(5, Math.min(99, score)), locations: locations.size, categories, growth };
}

function scoreLabel(score) {
  if (score <= 30) return 'Low signal';
  if (score <= 60) return 'Moderate signal';
  if (score <= 80) return 'Strong signal';
  return 'Very strong signal';
}

function slugify(title) {
  return String(title)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 60);
}

// ── Main entry point ───────────────────────────────────────────────────────────
function rebuildClusters(db, now = new Date().toISOString()) {
  const rows = db.prepare('SELECT * FROM submissions ORDER BY created_at ASC').all();
  if (rows.length === 0) {
    db.prepare('DELETE FROM opportunity_clusters').run();
    return { clusters: 0 };
  }

  const groups = clusterByCategoryAndTheme(rows);

  const clusters = groups.map((members) => {
    const mergedCounts = {};
    for (const m of members) {
      for (const [w, c] of Object.entries(parseKeywords(m.keywords))) {
        mergedCounts[w] = (mergedCounts[w] || 0) + c;
      }
    }
    const scored = scoreCluster(members);
    const title = buildTitle(members, mergedCounts);
    const topCats = Object.entries(scored.categories)
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => ({ name, count }));
    const locations = Array.from(
      new Set(members.map((r) => cleanLocation(r.broad_location)).filter(Boolean))
    ).slice(0, 12);
    return {
      title,
      score: scored.score,
      score_label: scoreLabel(scored.score),
      submission_count: members.length,
      keywords: topKeywords(mergedCounts, 12),
      categories: topCats,
      locations,
      trend: trendFor(members),
      matchedIds: members.map((r) => r.id),
    };
  });

  clusters.sort((a, b) => b.score - a.score || b.submission_count - a.submission_count);

  // ── Persist ──────────────────────────────────────────────────────────────────
  const existing = new Map(
    db.prepare('SELECT slug, id FROM opportunity_clusters').all().map((r) => [r.slug, r.id])
  );

  const insertCluster = db.prepare(
    `INSERT INTO opportunity_clusters
       (slug, title, description, score, score_label, submission_count, keywords, categories, locations, trend, created_at, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`
  );
  const link = db.prepare(
    'INSERT OR IGNORE INTO cluster_submissions (cluster_id, submission_id) VALUES (?,?)'
  );
  const updateSub = db.prepare(
    'UPDATE submissions SET cluster_id = ?, updated_at = ? WHERE id = ?'
  );

  const newSlugs = new Set();
  const keepIds = [];
  for (const c of clusters) {
    const slug = slugify(c.title) || slugify(c.keywords[0] || 'opportunity');
    let uniqueSlug = slug;
    let i = 2;
    while (newSlugs.has(uniqueSlug)) uniqueSlug = `${slug}-${i++}`;

    let clusterId = existing.get(uniqueSlug) || existing.get(slug);
    if (clusterId) {
      db.prepare(
        `UPDATE opportunity_clusters SET
           title=?, description=?, score=?, score_label=?, submission_count=?,
           keywords=?, categories=?, locations=?, trend=?, updated_at=?
         WHERE id=?`
      ).run(
        c.title, c.title, c.score, c.score_label, c.submission_count,
        JSON.stringify(c.keywords), JSON.stringify(c.categories),
        JSON.stringify(c.locations), JSON.stringify(c.trend), now, clusterId
      );
      db.prepare('DELETE FROM cluster_submissions WHERE cluster_id = ?').run(clusterId);
    } else {
      const info = insertCluster.run(
        uniqueSlug, c.title, c.title, c.score, c.score_label, c.submission_count,
        JSON.stringify(c.keywords), JSON.stringify(c.categories),
        JSON.stringify(c.locations), JSON.stringify(c.trend), now, now
      );
      clusterId = Number(info.lastInsertRowid);
    }
    for (const id of c.matchedIds) {
      link.run(clusterId, id);
      updateSub.run(clusterId, now, id);
    }
    newSlugs.add(uniqueSlug);
    keepIds.push(clusterId);
  }

  if (keepIds.length) {
    const placeholders = keepIds.map(() => '?').join(',');
    db.prepare(`DELETE FROM opportunity_clusters WHERE id NOT IN (${placeholders})`).run(...keepIds);
  } else {
    db.prepare('DELETE FROM opportunity_clusters').run();
  }
  db.prepare(
    'UPDATE submissions SET cluster_id = NULL WHERE cluster_id NOT IN (SELECT id FROM opportunity_clusters)'
  ).run();

  return { clusters: clusters.length };
}

module.exports = { rebuildClusters, scoreLabel };
