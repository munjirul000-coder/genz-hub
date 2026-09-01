'use strict';
/* Gen-Z Hub — lightweight, rules-based recommendations.
   No external AI/API calls. All scores are incremental and SQLite-friendly. */

const crypto = require('crypto');
const { db } = require('./db');
const U = require('./util');
const F = require('./feed');

const CATEGORIES = [
  'business', 'entrepreneurship', 'freelancing', 'technology', 'programming', 'ai',
  'gaming', 'football', 'sports', 'fitness', 'education', 'entertainment',
  'fashion', 'gadgets', 'cars', 'finance', 'career', 'creativity', 'general',
];

const CATEGORY_NAMES = {
  business: 'Business', entrepreneurship: 'Entrepreneurship', freelancing: 'Freelancing',
  technology: 'Technology', programming: 'Programming', ai: 'AI', gaming: 'Gaming',
  football: 'Football', sports: 'Sports', fitness: 'Fitness', education: 'Education',
  entertainment: 'Entertainment', fashion: 'Fashion', gadgets: 'Gadgets', cars: 'Cars',
  finance: 'Finance', career: 'Career', creativity: 'Creativity', general: 'General',
};

const DEFAULT_SETTINGS = {
  rec_exploration_pct: 0.15,
  rec_freshness_half_life_hours: 72,
  rec_diversity_penalty: 3.0,
  rec_creator_penalty: 4.0,
  rec_small_creator_boost: 3.0,
  rec_weight_like: 2,
  rec_weight_love: 4,
  rec_weight_angry: -3,
  rec_weight_middle: -4,
  rec_weight_comment: 5,
  rec_weight_share: 6,
  rec_weight_save: 7,
  rec_weight_post_click: 1,
  rec_weight_profile_visit: 2,
  rec_weight_group_visit: 3,
  rec_weight_search: 2,
  rec_weight_video_watch: 4,
  rec_weight_video_complete: 5,
  rec_weight_video_replay: 2,
  rec_weight_video_skip: -2,
  rec_weight_follow: 3,
  rec_weight_hide: -5,
  rec_weight_report: -10,
  rec_weight_skip: -2,
};

const ACTIONS = new Set([
  'impression', 'post_click', 'reaction', 'comment', 'share', 'save', 'unsave',
  'profile_visit', 'group_visit', 'community_visit', 'search', 'video_start',
  'video_watch', 'video_complete', 'video_replay', 'video_skip', 'skip', 'hide',
  'report', 'follow', 'interest_view',
]);

// These are the only events the browser may submit directly. Reactions/comments/saves/etc.
// are recorded by their authoritative mutation routes, so clients cannot mint score points.
const CLIENT_ACTIONS = new Set([
  'impression', 'post_click', 'skip', 'video_start', 'video_watch',
  'video_complete', 'video_replay', 'video_skip',
]);
const VIDEO_ACTIONS = new Set(['video_start', 'video_watch', 'video_complete', 'video_replay', 'video_skip']);

const KEYWORDS = [
  ['entrepreneurship', ['entrepreneur', 'founder', 'startup', 'start-up', 'cofounder', 'co-founder', 'business idea', 'build in public']],
  ['freelancing', ['freelanc', 'client work', 'proposal', 'remote work', 'gig work', 'upwork', 'fiverr']],
  ['programming', ['programming', 'developer', 'coding', 'code', 'javascript', 'typescript', 'python', 'node.js', 'react', 'backend', 'frontend', 'full-stack', 'software']],
  ['ai', ['artificial intelligence', 'machine learning', 'deep learning', 'generative ai', 'llm', 'chatgpt', 'neural network']],
  ['technology', ['technology', 'tech', 'software', 'cloud', 'cybersecurity', 'web app', 'app development']],
  ['gaming', ['gaming', 'gamer', 'gameplay', 'esports', 'e-sports', 'valorant', 'pubg', 'fifa', 'fortnite', 'minecraft', 'mobile gaming', 'pc gaming', 'console']],
  ['football', ['football', 'soccer', 'premier league', 'champions league', 'world cup', 'fifa', 'goalkeeper', 'striker']],
  ['sports', ['sports', 'cricket', 'basketball', 'badminton', 'tennis', 'athlete', 'match', 'tournament']],
  ['fitness', ['fitness', 'workout', 'gym', 'running', 'health', 'nutrition', 'muscle', 'exercise']],
  ['education', ['education', 'study', 'student', 'learning', 'course', 'exam', 'scholarship', 'university', 'tutorial']],
  ['entertainment', ['movie', 'film', 'music', 'series', 'netflix', 'celebrity', 'concert', 'comedy', 'entertainment']],
  ['fashion', ['fashion', 'outfit', 'style', 'clothing', 'sneaker', 'makeup', 'beauty']],
  ['gadgets', ['gadget', 'smartphone', 'iphone', 'android', 'laptop', 'headphone', 'camera', 'device', 'gear']],
  ['cars', ['car', 'automotive', 'motorcycle', 'bike', 'tesla', 'toyota', 'racing', 'vehicle']],
  ['finance', ['finance', 'invest', 'investment', 'stock', 'crypto', 'budget', 'money', 'banking', 'savings', 'trading']],
  ['career', ['career', 'job', 'resume', 'cv', 'interview', 'internship', 'hiring', 'professional']],
  ['creativity', ['creative', 'design', 'creator', 'content creation', 'photography', 'writing', 'illustration', 'video editing']],
  ['business', ['business', 'marketing', 'sales', 'ecommerce', 'e-commerce', 'retention', 'startup funding', 'store']],
];

const TOPIC_MAP = {
  business: ['business'], startups: ['business', 'entrepreneurship'], entrepreneurship: ['entrepreneurship'],
  freelancing: ['freelancing'], technology: ['technology'], programming: ['programming'], ai: ['ai'],
  gaming: ['gaming'], 'mobile gaming': ['gaming'], 'pc gaming': ['gaming'], console: ['gaming'], esports: ['gaming', 'sports'],
  football: ['football', 'sports'], sports: ['sports'], fitness: ['fitness'], education: ['education'],
  entertainment: ['entertainment'], fashion: ['fashion'], gadgets: ['gadgets'], cars: ['cars'], finance: ['finance'],
  career: ['career'], 'career development': ['career'], creativity: ['creativity'], design: ['creativity'],
  'content creation': ['creativity'], 'business ideas': ['business', 'entrepreneurship'], marketing: ['business'],
  'e-commerce': ['business'], networking: ['career'], 'investing education': ['finance', 'education'],
};

let lastCleanup = 0;
let initialized = false;
let settingCache = { at: 0, values: null };
const scoreUsers = new Set();

function now() { return U.now(); }
function clamp(n, min, max) { return Math.max(min, Math.min(max, n)); }
function asNumber(v, fallback) { const n = Number(v); return Number.isFinite(n) ? n : fallback; }
function slug(s) { return String(s || '').toLowerCase().trim(); }

function init() {
  if (initialized) return;
  const insCategory = db.prepare('INSERT OR IGNORE INTO recommendation_categories (slug,name,position,active) VALUES (?,?,?,1)');
  CATEGORIES.forEach((c, i) => insCategory.run(c, CATEGORY_NAMES[c], i));
  const insSetting = db.prepare('INSERT OR IGNORE INTO platform_settings (key,value,updated_at) VALUES (?,?,?)');
  Object.entries(DEFAULT_SETTINGS).forEach(([k, v]) => insSetting.run(k, String(v), now()));
  initialized = true;
  backfillPostCategories(500);
}

function config() {
  init();
  if (settingCache.values && now() - settingCache.at < 30000) return settingCache.values;
  const out = { ...DEFAULT_SETTINGS };
  db.prepare("SELECT key,value FROM platform_settings WHERE key LIKE 'rec_%'").all().forEach((r) => {
    if (Object.prototype.hasOwnProperty.call(out, r.key)) out[r.key] = asNumber(r.value, out[r.key]);
  });
  settingCache = { at: now(), values: out };
  return out;
}

function categoryForText(text, fallback = 'general') {
  const s = slug(text);
  const scores = {};
  const add = (c, n) => { if (CATEGORIES.includes(c)) scores[c] = (scores[c] || 0) + n; };
  if (!s) return [fallback];
  KEYWORDS.forEach(([c, words]) => words.forEach((w) => {
    if (s.includes(w)) add(c, w.length > 5 ? 0.35 : 0.22);
  }));
  if (!Object.keys(scores).length) return [fallback];
  return Object.entries(scores).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([c]) => c);
}

function categoryForHub(hub, name) {
  const map = { study: 'education', creative: 'creativity', movies: 'entertainment', music: 'entertainment', startups: 'entrepreneurship' };
  const h = slug(hub);
  return map[h] || (CATEGORIES.includes(h) ? h : categoryForText(name, 'general')[0]);
}

function categoriesForInterest(name, broadCategory) {
  const topic = TOPIC_MAP[slug(name)];
  if (topic) return topic;
  const found = categoryForText(name, broadCategory === 'business' ? 'business' : broadCategory === 'gaming' ? 'gaming' : 'general');
  return found.length ? found : [broadCategory === 'business' ? 'business' : broadCategory === 'gaming' ? 'gaming' : 'general'];
}

function categoriesForUser(userId) {
  const rows = db.prepare('SELECT i.name,i.category FROM user_interests ui JOIN interests i ON i.id=ui.interest_id WHERE ui.user_id=?').all(userId);
  const out = new Set();
  rows.forEach((r) => categoriesForInterest(r.name, r.category).forEach((c) => out.add(c)));
  return [...out];
}

function classifyPost(post) {
  const scores = {};
  const add = (c, n) => { if (CATEGORIES.includes(c)) scores[c] = (scores[c] || 0) + n; };
  const hub = slug(post.hub);
  if (hub === 'business') add('business', 0.8);
  else if (hub === 'gaming') add('gaming', 0.85);
  else add('general', 0.25);
  const topic = TOPIC_MAP[slug(post.topic)];
  if (topic) topic.forEach((c) => add(c, 0.8));
  categoryForText(`${post.content || ''} ${post.topic || ''}`, 'general').forEach((c) => add(c, 0.4));
  if (!Object.keys(scores).length) add('general', 1);
  const top = Object.entries(scores).sort((a, b) => b[1] - a[1]).slice(0, 4);
  const max = top[0] ? top[0][1] : 1;
  return top.map(([category, weight]) => ({ category, weight: Math.round((weight / max) * 1000) / 1000 }));
}

function ensurePostCategories(post) {
  init();
  const exists = db.prepare('SELECT 1 FROM post_categories WHERE post_id=? LIMIT 1').get(post.id);
  if (exists) return;
  const rows = classifyPost(post);
  const ins = db.prepare('INSERT OR IGNORE INTO post_categories (post_id,category,weight,created_at) VALUES (?,?,?,?)');
  rows.forEach((r) => ins.run(post.id, r.category, r.weight, now()));
}

function refreshPostCategories(post) {
  init();
  const tx = db.transaction(() => {
    db.prepare('DELETE FROM post_categories WHERE post_id=?').run(post.id);
    const ins = db.prepare('INSERT OR IGNORE INTO post_categories (post_id,category,weight,created_at) VALUES (?,?,?,?)');
    classifyPost(post).forEach((r) => ins.run(post.id, r.category, r.weight, now()));
  });
  tx();
}

function ensurePostCategoriesBatch(posts) {
  init();
  if (!posts.length) return;
  const ids = posts.map((p) => Number(p.id)).filter(Number.isInteger);
  const have = new Set(db.prepare(`SELECT post_id FROM post_categories WHERE post_id IN (${ids.join(',')})`).all().map((r) => r.post_id));
  const ins = db.prepare('INSERT OR IGNORE INTO post_categories (post_id,category,weight,created_at) VALUES (?,?,?,?)');
  const tx = db.transaction(() => posts.forEach((p) => {
    if (have.has(Number(p.id))) return;
    classifyPost(p).forEach((r) => ins.run(p.id, r.category, r.weight, now()));
  }));
  tx();
}

function backfillPostCategories(limit) {
  try {
    const posts = db.prepare(`SELECT p.id,p.content,p.hub,p.topic FROM posts p
      LEFT JOIN post_categories pc ON pc.post_id=p.id WHERE pc.post_id IS NULL ORDER BY p.id DESC LIMIT ?`).all(limit || 200);
    if (posts.length) ensurePostCategoriesBatch(posts);
  } catch (e) { /* first boot migration may run before all tables are available */ }
}

function postCategoryRows(ids) {
  if (!ids.length) return {};
  const out = {};
  db.prepare(`SELECT post_id,category,weight FROM post_categories WHERE post_id IN (${ids.join(',')})`).all().forEach((r) => {
    (out[r.post_id] = out[r.post_id] || []).push({ category: r.category, weight: Number(r.weight) || 0 });
  });
  return out;
}

function decay(row, at = now()) {
  const ageDays = Math.max(0, (at - (row.updated_at || at)) / 86400000);
  return Number(row.score || 0) * Math.pow(0.5, ageDays / 30);
}

function interestScores(userId) {
  ensureUserScores(userId);
  const t = now();
  const rows = db.prepare('SELECT category,score,interaction_count,updated_at FROM user_interest_scores WHERE user_id=?').all(userId);
  const out = {};
  CATEGORIES.forEach((c) => { out[c] = { category: c, name: CATEGORY_NAMES[c], score: 0, interactions: 0 }; });
  rows.forEach((r) => {
    if (out[r.category]) {
      out[r.category].score = decay(r, t);
      out[r.category].interactions = r.interaction_count || 0;
    }
  });
  // Explicit onboarding interests are a gentle prior, not a permanent lock-in.
  categoriesForUser(userId).forEach((c) => { if (out[c]) out[c].score += 15; });
  return out;
}

function ensureUserScores(userId) {
  if (!userId) return;
  if (scoreUsers.has(Number(userId))) return;
  init();
  const t = now();
  const ins = db.prepare('INSERT OR IGNORE INTO user_interest_scores (user_id,category,score,interaction_count,updated_at) VALUES (?,?,0,0,?)');
  const tx = db.transaction(() => CATEGORIES.forEach((c) => ins.run(userId, c, t)));
  tx();
  scoreUsers.add(Number(userId));
}

function weightFor(action, metadata) {
  const cfg = config();
  if (action === 'reaction') {
    const type = slug(metadata && metadata.type) || 'like';
    return asNumber(cfg['rec_weight_' + type], cfg.rec_weight_like);
  }
  return asNumber(cfg['rec_weight_' + action], 0);
}

function activityDelta(action, value, metadata) {
  const base = weightFor(action, metadata);
  if (action === 'impression' || action === 'video_start') return 0;
  if (action === 'video_watch') return base * clamp((Number(value) || 0) / 30, 0.1, 2);
  if (action === 'video_complete') return base;
  if (action === 'video_replay') return base;
  return base * clamp(Number(value) || 1, 0.25, 2);
}

function cleanupActivity() {
  const t = now();
  if (t - lastCleanup < 3600000) return;
  lastCleanup = t;
  db.prepare('DELETE FROM user_activity WHERE created_at<?').run(t - 180 * 86400000);
  db.prepare('DELETE FROM recommendation_impressions WHERE shown_at<?').run(t - 14 * 86400000);
  db.prepare('DELETE FROM shorts_impressions WHERE shown_at<?').run(t - 14 * 86400000);
  db.prepare("DELETE FROM recommendation_feedback WHERE created_at<? AND kind='skip'").run(t - 60 * 86400000);
}

function recordVideoStat(userId, postId, action, value, metadata) {
  if (!postId) return;
  const m = metadata || {};
  const duration = Math.max(0, Number(m.duration) || 0);
  const current = Math.max(0, Number(m.current) || 0);
  const completion = clamp(Number(m.completion) || (duration ? current / duration * 100 : 0), 0, 100);
  db.prepare(`INSERT INTO video_watch_stats
    (user_id,post_id,watched_seconds,max_seconds,completion_pct,starts,replays,skips,last_watched,updated_at)
    VALUES (?,?,?, ?,?,?, ?,?, ?,?)
    ON CONFLICT(user_id,post_id) DO UPDATE SET
      watched_seconds=watched_seconds+excluded.watched_seconds,
      max_seconds=MAX(video_watch_stats.max_seconds,excluded.max_seconds),
      completion_pct=MAX(video_watch_stats.completion_pct,excluded.completion_pct),
      starts=video_watch_stats.starts+excluded.starts,
      replays=video_watch_stats.replays+excluded.replays,
      skips=video_watch_stats.skips+excluded.skips,
      last_watched=excluded.last_watched,updated_at=excluded.updated_at`)
    .run(userId, postId, action === 'video_watch' ? Math.max(0, Number(value) || 0) : 0,
      current, completion, action === 'video_start' ? 1 : 0, action === 'video_replay' ? 1 : 0,
      action === 'video_skip' ? 1 : 0, now(), now());
}

function recentContextActivity(userId, action, targetId, category) {
  const windows = { profile_visit: 30000, group_visit: 30000, community_visit: 30000, interest_view: 30000, search: 10000 };
  const windowMs = windows[action];
  if (!windowMs) return false;
  if (targetId) return !!db.prepare('SELECT 1 FROM user_activity WHERE user_id=? AND action=? AND target_id=? AND created_at>? LIMIT 1')
    .get(userId, action, targetId, now() - windowMs);
  return !!db.prepare('SELECT 1 FROM user_activity WHERE user_id=? AND action=? AND category=? AND target_id IS NULL AND created_at>? LIMIT 1')
    .get(userId, action, category || 'general', now() - windowMs);
}

function clientEventBlocked(userId, action, post, value, metadata) {
  if (!CLIENT_ACTIONS.has(action) || !post) return true;
  if (VIDEO_ACTIONS.has(action)) {
    const hasVideo = db.prepare("SELECT 1 FROM post_media WHERE post_id=? AND type='video' LIMIT 1").get(post.id);
    if (!hasVideo) return true;
    const duration = Number(metadata && metadata.duration);
    const current = Number(metadata && metadata.current);
    if (action === 'video_watch' && (!Number.isFinite(value) || value <= 0 || value > 30)) return true;
    if (Number.isFinite(duration) && (duration < 0 || duration > 3600)) return true;
    if (Number.isFinite(current) && (current < 0 || current > Math.max(duration || 0, 3600))) return true;
  }
  // Debounce identical browser telemetry. This protects the score and watch counters from
  // a tight loop without affecting the normal player cadence (watch reports are ~8 seconds apart).
  const windows = { impression: 5000, post_click: 3000, skip: 3000, video_start: 3000,
    video_watch: 5000, video_complete: 30000, video_replay: 30000, video_skip: 5000 };
  const windowMs = windows[action] || 0;
  return !!(windowMs && db.prepare('SELECT 1 FROM user_activity WHERE user_id=? AND action=? AND post_id=? AND created_at>? LIMIT 1')
    .get(userId, action, post.id, now() - windowMs));
}

function recordActivity({ userId, action, postId = null, targetId = null, category = null, value = 1, metadata = {} }) {
  init();
  if (!userId || !ACTIONS.has(action)) return { ok: false, ignored: true };
  const isClient = metadata && metadata.source === 'client';
  let post = postId ? db.prepare('SELECT id,user_id,content,hub,topic FROM posts WHERE id=? AND removed=0').get(Number(postId)) : null;
  if (postId && !post) return { ok: false, ignored: true };
  if (isClient && postId) {
    post = db.prepare(`SELECT p.id,p.user_id,p.content,p.hub,p.topic FROM posts p
      WHERE p.id=@id AND ${F.visibilitySQL('p')}`).get({ id: Number(postId), me: userId });
  }
  if (isClient && clientEventBlocked(userId, action, post, Number(value), metadata)) return { ok: false, ignored: true };
  if (post) ensurePostCategories(post);
  let cats = post ? (postCategoryRows([post.id])[post.id] || []) : [];
  if (!cats.length && category && CATEGORIES.includes(category)) cats = [{ category, weight: 1 }];
  if (!cats.length && (action === 'follow' || action === 'profile_visit')) {
    cats = categoriesForUser(Number(targetId)).map((c) => ({ category: c, weight: 1 }));
  }
  if (!cats.length) cats = [{ category: 'general', weight: 1 }];
  if (!isClient && recentContextActivity(userId, action, targetId, cats[0].category)) return { ok: false, ignored: true };
  const safeValue = clamp(Number(value) || 1, -30, 30);
  const safeMeta = JSON.stringify(metadata || {}).slice(0, 900);
  const t = now();
  db.prepare(`INSERT INTO user_activity (user_id,action,post_id,target_id,category,value,metadata,created_at)
    VALUES (?,?,?,?,?,?,?,?)`).run(userId, action, post ? post.id : null, targetId ? Number(targetId) : null,
    cats[0].category, safeValue, safeMeta, t);

  ensureUserScores(userId);
  const delta = activityDelta(action, safeValue, metadata);
  if (delta) {
    const stmt = db.prepare(`UPDATE user_interest_scores
      SET score=MAX(-100,MIN(100,?)), interaction_count=interaction_count+1, updated_at=?
      WHERE user_id=? AND category=?`);
    const rows = db.prepare('SELECT category,score,updated_at FROM user_interest_scores WHERE user_id=?').all(userId);
    const current = {}; rows.forEach((r) => { current[r.category] = decay(r, t); });
    const tx = db.transaction(() => cats.forEach((c) => stmt.run(current[c.category] + delta * c.weight, t, userId, c.category)));
    tx();
  }
  if (action.startsWith('video_')) recordVideoStat(userId, post && post.id, action, safeValue, metadata);
  if (['hide', 'report'].includes(action) && post) {
    db.prepare(`INSERT INTO recommendation_feedback (user_id,post_id,kind,created_at) VALUES (?,?,?,?)
      ON CONFLICT(user_id,post_id,kind) DO UPDATE SET created_at=excluded.created_at`).run(userId, post.id, action, t);
  }
  cleanupActivity();
  return { ok: true, action, categories: cats.map((c) => c.category), delta };
}

function markImpressions(userId, posts) {
  if (!userId || !posts.length) return;
  const stmt = db.prepare(`INSERT INTO recommendation_impressions (user_id,post_id,shown_at,view_count)
    VALUES (?,?,?,1) ON CONFLICT(user_id,post_id) DO UPDATE SET shown_at=excluded.shown_at,view_count=view_count+1`);
  const t = now();
  const tx = db.transaction(() => posts.forEach((p) => stmt.run(userId, p.id, t)));
  tx();
}

function encodeCursor(obj) {
  return Buffer.from(JSON.stringify(obj)).toString('base64url');
}
function decodeCursor(raw) {
  if (!raw) return null;
  try {
    const x = JSON.parse(Buffer.from(String(raw), 'base64url').toString('utf8'));
    if (!x || !Array.isArray(x.ids) || x.ids.length > 120) return null;
    x.ids = x.ids.map(Number).filter((n) => Number.isInteger(n) && n > 0).slice(0, 120);
    x.offset = Math.max(0, Number(x.offset) || 0);
    return x;
  } catch (e) { return null; }
}

function authorStats(posts) {
  const ids = [...new Set(posts.map((p) => Number(p.user_id)).filter(Boolean))];
  if (!ids.length) return {};
  const out = {};
  db.prepare(`SELECT u.id,
    (SELECT COUNT(*) FROM posts p WHERE p.user_id=u.id AND p.removed=0) AS posts,
    (SELECT COUNT(*) FROM follows f WHERE f.following_id=u.id) AS followers
    FROM users u WHERE u.id IN (${ids.join(',')})`).all().forEach((r) => { out[r.id] = r; });
  return out;
}

function connectedAuthors(userId) {
  const out = new Set();
  db.prepare(`SELECT requester_id,addressee_id FROM connections WHERE status='accepted' AND
    (requester_id=? OR addressee_id=?)`).all(userId, userId).forEach((r) => {
    out.add(r.requester_id === userId ? r.addressee_id : r.requester_id);
  });
  return out;
}

function rankPosts(posts, userId, limit) {
  if (!posts.length) return [];
  ensurePostCategoriesBatch(posts);
  const ids = posts.map((p) => Number(p.id));
  const cats = postCategoryRows(ids);
  const scores = interestScores(userId);
  const cfg = config();
  const authors = authorStats(posts);
  const following = new Set(db.prepare('SELECT following_id FROM follows WHERE follower_id=?').all(userId).map((r) => r.following_id));
  const connected = connectedAuthors(userId);
  const negativePosts = new Set(db.prepare(`SELECT post_id FROM recommendation_feedback
    WHERE user_id=? AND kind IN ('hide','report') AND post_id IN (${ids.join(',')})`).all(userId).map((r) => r.post_id));
  const top = Object.values(scores).sort((a, b) => b.score - a.score).slice(0, 4).map((x) => x.category);
  const topSet = new Set(top.slice(0, 3));
  const nowMs = now();

  const scored = posts.map((p) => {
    const pc = cats[p.id] || [{ category: 'general', weight: 1 }];
    const match = pc.reduce((n, c) => n + clamp(scores[c.category] ? scores[c.category].score : 0, -100, 100) / 100 * c.weight, 0);
    const ageHours = Math.max(0, (nowMs - p.created_at) / 3600000);
    const freshness = 12 * Math.pow(0.5, ageHours / Math.max(12, cfg.rec_freshness_half_life_hours));
    const quality = Math.min(9, Math.log1p((p.reaction_count || 0) + (p.comment_count || 0) * 2 + (p.repost_count || 0) * 2));
    const relationship = p.user_id === userId ? 8 : following.has(p.user_id) ? 7 : connected.has(p.user_id) ? 5 : 0;
    // A creator must be able to see their own fresh post immediately, without allowing
    // an old backlog of self-posts to dominate later sessions.
    const ownFreshness = p.user_id === userId ? Math.max(0, 55 - ageHours * 1.5) : 0;
    const community = p.group_id || p.community_id ? 2 : 0;
    const small = authors[p.user_id] && (authors[p.user_id].posts <= 15 || authors[p.user_id].followers <= 50) && p.user_id !== userId
      ? cfg.rec_small_creator_boost : 0;
    const negative = negativePosts.has(p.id) ? 100 : 0;
    const base = 28 * match + quality + freshness + relationship + ownFreshness + community + small - negative;
    return { post: p, categories: pc, score: base, top: pc.some((c) => topSet.has(c.category)) };
  });

  const selected = [];
  const remaining = scored.slice();
  const explorationCount = Math.min(Math.floor(limit * clamp(cfg.rec_exploration_pct, 0.1, 0.2)), Math.max(0, limit - 1));
  const explore = remaining.filter((x) => !x.top).sort((a, b) => b.score - a.score);
  const exploreSlots = new Set();
  for (let i = 0; i < explorationCount; i++) exploreSlots.add(Math.min(limit - 1, Math.round((i + 1) * limit / (explorationCount + 1))));
  const creatorCount = {};
  const categoryCount = {};
  for (let slot = 0; slot < limit && remaining.length; slot++) {
    let pool = remaining;
    if (exploreSlots.has(slot) && explore.length) pool = explore.filter((x) => remaining.includes(x));
    if (!pool.length) pool = remaining;
    // Hard guard when alternatives exist: do not place the same creator back-to-back,
    // and avoid a fourth consecutive post whose primary category is the same.
    if (selected.length) {
      const lastAuthor = selected[selected.length - 1].user_id;
      const authorAlternatives = pool.filter((x) => x.post.user_id !== lastAuthor);
      if (authorAlternatives.length) pool = authorAlternatives;
      const primaryCategory = (x) => {
        const list = x && x.categories ? x.categories : (x ? (cats[x.id] || []) : []);
        return list.slice().sort((a, b) => b.weight - a.weight)[0]?.category;
      };
      const lastCategory = primaryCategory(selected[selected.length - 1]);
      let run = 0;
      for (let i = selected.length - 1; i >= 0 && primaryCategory(selected[i]) === lastCategory; i--) run++;
      // Only break a true run of three identical primary categories; do not ban a
      // category merely because it appeared somewhere in the previous three posts.
      if (run >= 3) {
        const categoryAlternatives = pool.filter((x) => primaryCategory(x) !== lastCategory);
        if (categoryAlternatives.length) pool = categoryAlternatives;
      }
    }
    pool.sort((a, b) => {
      const catA = Math.max(...a.categories.map((c) => categoryCount[c.category] || 0));
      const catB = Math.max(...b.categories.map((c) => categoryCount[c.category] || 0));
      const sa = a.score - (creatorCount[a.post.user_id] || 0) * cfg.rec_creator_penalty - catA * cfg.rec_diversity_penalty;
      const sb = b.score - (creatorCount[b.post.user_id] || 0) * cfg.rec_creator_penalty - catB * cfg.rec_diversity_penalty;
      return sb - sa;
    });
    const pick = pool[0];
    const index = remaining.indexOf(pick);
    if (index >= 0) remaining.splice(index, 1);
    const ei = explore.indexOf(pick); if (ei >= 0) explore.splice(ei, 1);
    selected.push(pick.post);
    creatorCount[pick.post.user_id] = (creatorCount[pick.post.user_id] || 0) + 1;
    pick.categories.forEach((c) => { categoryCount[c.category] = (categoryCount[c.category] || 0) + 1; });
  }
  return selected;
}

function candidateRows({ userId, where, params, limit, cursor, excludeShown }) {
  const extra = [...(where || [])];
  const p = { ...(params || {}) };
  if (excludeShown) {
    extra.push("NOT EXISTS (SELECT 1 FROM recommendation_feedback rf WHERE rf.user_id=@me AND rf.post_id=p.id AND rf.kind IN ('hide','report'))");
    extra.push('((p.user_id=@me AND p.created_at>@own_recent) OR NOT EXISTS (SELECT 1 FROM recommendation_impressions ri WHERE ri.user_id=@me AND ri.post_id=p.id AND ri.shown_at>@rec_cooldown))');
    p.own_recent = now() - 48 * 3600000;
    p.rec_cooldown = now() - 6 * 3600000;
  }
  return F.queryPosts({ me: userId, where: extra, params: p, limit, cursor, order: 'p.created_at DESC, p.id DESC' });
}

function rowsForIds(userId, ids, where, params) {
  if (!ids.length) return [];
  const safeIds = ids.filter((x) => Number.isInteger(x) && x > 0).slice(0, 120);
  const order = `CASE p.id ${safeIds.map((id, i) => `WHEN ${id} THEN ${i}`).join(' ')} ELSE ${safeIds.length} END`;
  const out = F.queryPosts({ me: userId, where: [...(where || []), `p.id IN (${safeIds.join(',')})`], params: params || {}, limit: safeIds.length, order });
  const map = new Map(out.posts.map((p) => [Number(p.id), p]));
  return safeIds.map((id) => map.get(id)).filter(Boolean);
}

function personalizedFeed({ me, where = [], params = {}, limit = 8, cursor = null }) {
  init();
  const take = clamp(Number(limit) || 8, 1, 20);
  let token = decodeCursor(cursor);
  let rows = [];
  let rankedIds = [];
  let nextBase = null;
  let consumed = 0;

  if (token && token.ids.length && token.offset < token.ids.length) {
    const requested = token.ids.slice(token.offset);
    rows = rowsForIds(me, requested, where, params);
    rankedIds = token.ids;
    nextBase = token.next || null;
    consumed = Math.min(take, requested.length);
  } else {
    const baseCursor = token && token.next ? token.next : null;
    const candidates = candidateRows({ userId: me, where, params, limit: Math.min(120, Math.max(40, take * 8)), cursor: baseCursor, excludeShown: true });
    rows = rankPosts(candidates.posts, me, Math.max(take, candidates.posts.length));
    rankedIds = rows.map((p) => Number(p.id));
    nextBase = candidates.nextCursor;
    if (!rows.length && !baseCursor) {
      const fallback = candidateRows({ userId: me, where, params, limit: Math.min(60, Math.max(20, take * 5)), cursor: null, excludeShown: false });
      rows = rankPosts(fallback.posts, me, take);
      rankedIds = rows.map((p) => Number(p.id));
      nextBase = fallback.nextCursor;
    }
    token = { ids: rankedIds, offset: 0, next: nextBase };
  }

  const page = rows.slice(0, take);
  const offset = (token.offset || 0) + (consumed || page.length);
  const hasMore = offset < rankedIds.length || !!nextBase;
  if (page.length) markImpressions(me, page);
  return {
    posts: page,
    nextCursor: hasMore ? encodeCursor({ ids: rankedIds, offset, next: nextBase }) : null,
    personalized: true,
    recommendationCategories: topCategories(me),
  };
}

function shortsCategoryRows(ids) {
  if (!ids.length) return {};
  const out = {};
  db.prepare(`SELECT pm.post_id,pm.duration,pm.width,pm.height,pm.type FROM post_media pm
    WHERE pm.type='video' AND pm.post_id IN (${ids.join(',')}) ORDER BY pm.position`).all().forEach((r) => {
    if (!out[r.post_id]) out[r.post_id] = r;
  });
  return out;
}

function shortsWatchRows(userId, ids) {
  if (!ids.length) return {};
  const out = {};
  db.prepare(`SELECT * FROM video_watch_stats WHERE user_id=? AND post_id IN (${ids.join(',')})`).all(userId).forEach((r) => { out[r.post_id] = r; });
  return out;
}

function rankShortsPosts(posts, userId, limit) {
  if (!posts.length) return [];
  ensurePostCategoriesBatch(posts);
  const ids = posts.map((p) => Number(p.id));
  const cats = postCategoryRows(ids);
  const media = shortsCategoryRows(ids);
  const watch = shortsWatchRows(userId, ids);
  const scores = interestScores(userId);
  const cfg = config();
  const authors = authorStats(posts);
  const following = new Set(db.prepare('SELECT following_id FROM follows WHERE follower_id=?').all(userId).map((r) => r.following_id));
  const connected = connectedAuthors(userId);
  const top = Object.values(scores).sort((a, b) => b.score - a.score).slice(0, 4).map((x) => x.category);
  const topSet = new Set(top.slice(0, 3));
  const nowMs = now();
  const scored = posts.map((p) => {
    const pc = cats[p.id] || [{ category: 'general', weight: 1 }];
    const match = pc.reduce((n, c) => n + clamp(scores[c.category] ? scores[c.category].score : 0, -100, 100) / 100 * c.weight, 0);
    const ageHours = Math.max(0, (nowMs - p.created_at) / 3600000);
    const freshness = 14 * Math.pow(0.5, ageHours / Math.max(12, cfg.rec_freshness_half_life_hours));
    const quality = Math.min(10, Math.log1p((p.reaction_count || 0) + (p.comment_count || 0) * 2 + (p.repost_count || 0) * 2));
    const relationship = p.user_id === userId ? 8 : following.has(p.user_id) ? 8 : connected.has(p.user_id) ? 5 : 0;
    const ownFreshness = p.user_id === userId ? Math.max(0, 55 - ageHours * 1.5) : 0;
    const w = watch[p.id];
    const duration = Number((media[p.id] && media[p.id].duration) || 0);
    const completion = w ? Number(w.completion_pct || 0) : 0;
    const watched = w ? Number(w.watched_seconds || 0) : 0;
    const replay = w ? Number(w.replays || 0) : 0;
    const skips = w ? Number(w.skips || 0) : 0;
    const watchScore = Math.min(20, completion * 0.12 + Math.min(8, watched / Math.max(10, duration || 30) * 8) + Math.min(4, replay * 2)) - Math.min(8, skips * 2);
    const small = authors[p.user_id] && (authors[p.user_id].posts <= 15 || authors[p.user_id].followers <= 50) && p.user_id !== userId ? cfg.rec_small_creator_boost : 0;
    const portrait = media[p.id] && media[p.id].width && media[p.id].height && media[p.id].height > media[p.id].width ? 2 : 0;
    return { post: p, categories: pc, score: 28 * match + quality + freshness + relationship + ownFreshness + watchScore + small + portrait, top: pc.some((c) => topSet.has(c.category)) };
  });
  const selected = [];
  const remaining = scored.slice();
  const explorationCount = Math.min(Math.floor(limit * clamp(cfg.rec_exploration_pct, 0.1, 0.2)), Math.max(0, limit - 1));
  const explore = remaining.filter((x) => !x.top).sort((a, b) => b.score - a.score);
  const slots = new Set();
  for (let i = 0; i < explorationCount; i++) slots.add(Math.min(limit - 1, Math.round((i + 1) * limit / (explorationCount + 1))));
  const creatorCount = {}, categoryCount = {};
  const primary = (x) => {
    const list = x && x.categories ? x.categories : (x ? (cats[x.id] || []) : []);
    return list.slice().sort((a, b) => b.weight - a.weight)[0]?.category;
  };
  for (let slot = 0; slot < limit && remaining.length; slot++) {
    let pool = slots.has(slot) && explore.length ? explore.filter((x) => remaining.includes(x)) : remaining;
    if (!pool.length) pool = remaining;
    if (selected.length) {
      const lastAuthor = selected[selected.length - 1].user_id;
      const altCreator = pool.filter((x) => x.post.user_id !== lastAuthor);
      if (altCreator.length) pool = altCreator;
      const lastCat = primary(selected[selected.length - 1]);
      let run = 0;
      for (let i = selected.length - 1; i >= 0 && primary(selected[i]) === lastCat; i--) run++;
      if (run >= 3) {
        const altCategory = pool.filter((x) => primary(x) !== lastCat);
        if (altCategory.length) pool = altCategory;
      }
    }
    pool.sort((a, b) => {
      const catA = Math.max(...a.categories.map((c) => categoryCount[c.category] || 0));
      const catB = Math.max(...b.categories.map((c) => categoryCount[c.category] || 0));
      const sa = a.score - (creatorCount[a.post.user_id] || 0) * cfg.rec_creator_penalty - catA * cfg.rec_diversity_penalty;
      const sb = b.score - (creatorCount[b.post.user_id] || 0) * cfg.rec_creator_penalty - catB * cfg.rec_diversity_penalty;
      return sb - sa;
    });
    const pick = pool[0];
    remaining.splice(remaining.indexOf(pick), 1);
    const ei = explore.indexOf(pick); if (ei >= 0) explore.splice(ei, 1);
    selected.push(pick.post);
    creatorCount[pick.post.user_id] = (creatorCount[pick.post.user_id] || 0) + 1;
    pick.categories.forEach((c) => { categoryCount[c.category] = (categoryCount[c.category] || 0) + 1; });
  }
  return selected;
}

function markShortsImpressions(userId, posts) {
  if (!userId || !posts.length) return;
  const stmt = db.prepare(`INSERT INTO shorts_impressions (user_id,post_id,shown_at,view_count) VALUES (?,?,?,1)
    ON CONFLICT(user_id,post_id) DO UPDATE SET shown_at=excluded.shown_at,view_count=view_count+1`);
  const t = now();
  db.transaction(() => posts.forEach((p) => stmt.run(userId, p.id, t)))();
}

function shortsFeed({ me, scope = 'for-you', limit = 6, cursor = null }) {
  init();
  const take = clamp(Number(limit) || 6, 1, 12);
  const where = ["EXISTS (SELECT 1 FROM post_media pm WHERE pm.post_id=p.id AND pm.type='video')", 'p.group_id IS NULL'];
  const params = {};
  if (scope === 'following') where.push('(p.user_id=@me OR EXISTS (SELECT 1 FROM follows f WHERE f.follower_id=@me AND f.following_id=p.user_id))');
  let token = decodeCursor(cursor);
  let rows = [], rankedIds = [], nextBase = null, consumed = 0;
  if (token && token.ids.length && token.offset < token.ids.length) {
    const requested = token.ids.slice(token.offset);
    rows = rowsForIds(me, requested, where, params);
    rankedIds = token.ids; nextBase = token.next || null; consumed = Math.min(take, requested.length);
  } else {
    const baseCursor = token && token.next ? token.next : null;
    // Recently-shown Shorts rest after a short cooldown so a session always feels fresh —
    // but if the cooldown would leave the feed EMPTY we recycle them instead. An empty
    // result should mean "no Shorts exist at all", never "the feed forgot them".
    const extra = [
      "NOT EXISTS (SELECT 1 FROM recommendation_feedback rf WHERE rf.user_id=@me AND rf.post_id=p.id AND rf.kind IN ('hide','report'))",
      'NOT EXISTS (SELECT 1 FROM shorts_impressions si WHERE si.user_id=@me AND si.post_id=p.id AND si.shown_at>@shorts_cooldown)',
    ];
    params.shorts_cooldown = now() - 30 * 60000; // 30-minute rest
    let candidates = F.queryPosts({ me, where: where.concat(extra), params, limit: Math.min(100, Math.max(30, take * 8)), cursor: baseCursor, order: 'p.created_at DESC, p.id DESC' });
    if (!candidates.posts.length) candidates = F.queryPosts({ me, where, params, limit: Math.min(100, Math.max(30, take * 8)), cursor: baseCursor, order: 'p.created_at DESC, p.id DESC' });
    rows = rankShortsPosts(candidates.posts, me, Math.max(take, candidates.posts.length));
    rankedIds = rows.map((p) => Number(p.id)); nextBase = candidates.nextCursor;
    // Do not recycle already-shown Shorts immediately. An empty result means the
    // viewer is caught up; the next fresh upload will appear on the next request.
    token = { ids: rankedIds, offset: 0, next: nextBase };
  }
  const page = rows.slice(0, take);
  const offset = (token.offset || 0) + (consumed || page.length);
  const hasMore = offset < rankedIds.length || !!nextBase;
  if (page.length) markShortsImpressions(me, page);
  return { posts: page, nextCursor: hasMore ? encodeCursor({ ids: rankedIds, offset, next: nextBase }) : null, personalized: true, shorts: true, recommendationCategories: topCategories(me) };
}

function topCategories(userId) {
  return Object.values(interestScores(userId)).sort((a, b) => b.score - a.score).slice(0, 5).map((x) => ({ category: x.category, score: Math.round(x.score * 10) / 10 }));
}

function fallbackFeed({ me, where = [], params = {}, limit = 8, cursor = null }) {
  // This path deliberately depends only on the original feed module. It is safe even if a
  // recommendation migration is unavailable during a partial deploy.
  const out = F.queryPosts({
    me, where, params, limit: clamp(Number(limit) || 8, 1, 20), cursor,
    order: 'p.created_at DESC, p.id DESC',
  });
  return { ...out, personalized: false, recommendationFallback: true };
}

function feedback(userId, postId, kind) {
  const allowed = ['hide', 'report', 'skip'];
  if (!allowed.includes(kind)) return { ok: false };
  const p = db.prepare('SELECT id FROM posts WHERE id=? AND removed=0').get(postId);
  if (!p) return { ok: false };
  if (['hide', 'report'].includes(kind)) {
    const existing = db.prepare('SELECT 1 FROM recommendation_feedback WHERE user_id=? AND post_id=? AND kind=?').get(userId, p.id, kind);
    if (existing) return { ok: true, already: true, action: kind };
  }
  return recordActivity({ userId, action: kind, postId: p.id, value: 1, metadata: { source: 'user' } });
}

function reset(userId) {
  const tx = db.transaction(() => {
    db.prepare('DELETE FROM user_activity WHERE user_id=?').run(userId);
    db.prepare('DELETE FROM user_interest_scores WHERE user_id=?').run(userId);
    db.prepare('DELETE FROM recommendation_impressions WHERE user_id=?').run(userId);
    db.prepare('DELETE FROM shorts_impressions WHERE user_id=?').run(userId);
    db.prepare('DELETE FROM recommendation_feedback WHERE user_id=?').run(userId);
    db.prepare('DELETE FROM video_watch_stats WHERE user_id=?').run(userId);
  });
  tx();
  scoreUsers.delete(Number(userId));
  ensureUserScores(userId);
  return { ok: true };
}

function hashQuery(q) { return crypto.createHash('sha256').update(String(q || '').toLowerCase().trim()).digest('hex').slice(0, 16); }

module.exports = {
  CATEGORIES, CATEGORY_NAMES, DEFAULT_SETTINGS, ACTIONS, CLIENT_ACTIONS, init, config, classifyPost,
  categoryForText, categoryForHub, categoriesForInterest, categoriesForUser, ensurePostCategories, refreshPostCategories, ensurePostCategoriesBatch,
  interestScores, topCategories, recordActivity, markImpressions, feedback, reset, hashQuery,
  personalizedFeed, shortsFeed, fallbackFeed,
};
