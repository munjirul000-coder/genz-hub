'use strict';
/* Gen-Z Hub — gamification engine: XP, levels, streaks, badges, daily missions.

   Anti-abuse: every action has a daily cap and XP is only awarded for distinct references,
   so spamming posts or self-votes cannot farm the leaderboard. */

const { db } = require('./db');
const U = require('./util');

// action → { xp, dailyCap } (dailyCap = how many times per day it can pay out)
const ACTIONS = {
  post: { xp: 10, cap: 5 },
  comment: { xp: 4, cap: 10 },
  reaction_received: { xp: 1, cap: 30 },
  follow_received: { xp: 3, cap: 10 },
  project: { xp: 25, cap: 3 },
  idea: { xp: 15, cap: 3 },
  idea_support_received: { xp: 2, cap: 20 },
  challenge_entry: { xp: 40, cap: 3 },
  challenge_win: { xp: 200, cap: 3 },
  poll_created: { xp: 6, cap: 3 },
  poll_vote: { xp: 1, cap: 10 },
  community_join: { xp: 5, cap: 5 },
  hub_join: { xp: 5, cap: 12 },
  profile_complete: { xp: 30, cap: 1 },
  product_listed: { xp: 12, cap: 5 },
  order_placed: { xp: 10, cap: 5 },
  proposal_sent: { xp: 6, cap: 8 },
  job_posted: { xp: 12, cap: 5 },
  helpful_reply: { xp: 8, cap: 5 },
  daily_login: { xp: 5, cap: 1 },
};

const today = () => new Date().toISOString().slice(0, 10);

/** Level curve: level n needs 100 * n * (n+1) / 2 XP (1→100, 2→300, 3→600 …). */
function levelFor(xp) {
  let lvl = 1;
  while (xp >= 50 * lvl * (lvl + 1)) lvl++;
  return lvl;
}
function levelBounds(level) {
  const floor = level === 1 ? 0 : 50 * (level - 1) * level;
  const ceil = 50 * level * (level + 1);
  return { floor, ceil };
}

function ensureStats(userId) {
  db.prepare('INSERT OR IGNORE INTO user_stats (user_id,xp,level,updated_at) VALUES (?,0,1,?)').run(userId, U.now());
  return db.prepare('SELECT * FROM user_stats WHERE user_id=?').get(userId);
}

/**
 * Award XP for an action. Returns { awarded, xp, level, leveledUp, badges: [] }.
 * Safe to call from anywhere — never throws into a request handler.
 */
function award(userId, action, { refType = '', refId = null } = {}) {
  try {
    if (!userId) return null;
    const def = ACTIONS[action];
    if (!def) return null;
    const day = today();
    const stats = ensureStats(userId);

    // daily cap
    const used = db.prepare('SELECT COUNT(*) c FROM xp_events WHERE user_id=? AND action=? AND day=?').get(userId, action, day).c;
    if (used >= def.cap) return { awarded: 0, xp: stats.xp, level: stats.level, leveledUp: false, badges: [] };

    // never pay twice for the same object
    if (refId) {
      const dup = db.prepare('SELECT 1 FROM xp_events WHERE user_id=? AND action=? AND ref_type=? AND ref_id=?')
        .get(userId, action, refType, refId);
      if (dup) return { awarded: 0, xp: stats.xp, level: stats.level, leveledUp: false, badges: [] };
    }

    db.prepare('INSERT INTO xp_events (user_id,action,amount,ref_type,ref_id,day,created_at) VALUES (?,?,?,?,?,?,?)')
      .run(userId, action, def.xp, refType, refId, day, U.now());

    const xp = stats.xp + def.xp;
    const level = levelFor(xp);
    const leveledUp = level > stats.level;

    // streak
    let streak = stats.streak_days || 0;
    if (stats.last_active_day !== day) {
      const y = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
      streak = stats.last_active_day === y ? streak + 1 : 1;
    }
    db.prepare('UPDATE user_stats SET xp=?, level=?, streak_days=?, last_active_day=?, updated_at=? WHERE user_id=?')
      .run(xp, level, streak, day, U.now(), userId);

    if (leveledUp) {
      U.notify({
        userId, actorId: userId, type: 'level_up', entityType: 'user', entityId: userId,
        text: `Level up! You reached level ${level}`, link: '#/arena',
      });
    }

    progressMissions(userId, action);
    const badges = checkBadges(userId);
    return { awarded: def.xp, xp, level, leveledUp, badges };
  } catch (e) {
    console.error('[xp] award failed', action, e.message);
    return null;
  }
}

/* ---------------------------------------------------------------- missions */
function progressMissions(userId, action) {
  const day = today();
  const list = db.prepare('SELECT * FROM missions WHERE active=1 AND action=?').all(action);
  list.forEach((m) => {
    db.prepare('INSERT OR IGNORE INTO mission_progress (user_id,mission_id,day,progress,claimed) VALUES (?,?,?,0,0)')
      .run(userId, m.id, day);
    db.prepare('UPDATE mission_progress SET progress=MIN(progress+1,?) WHERE user_id=? AND mission_id=? AND day=?')
      .run(m.target, userId, m.id, day);
  });
}

function missionsFor(userId) {
  const day = today();
  return db.prepare(`
    SELECT m.*, COALESCE(mp.progress,0) AS progress, COALESCE(mp.claimed,0) AS claimed
    FROM missions m LEFT JOIN mission_progress mp ON mp.mission_id=m.id AND mp.user_id=? AND mp.day=?
    WHERE m.active=1 ORDER BY m.position, m.id`).all(userId, day);
}

function claimMission(userId, missionId) {
  const day = today();
  const m = db.prepare('SELECT * FROM missions WHERE id=? AND active=1').get(missionId);
  if (!m) return { error: 'Mission not found.' };
  const mp = db.prepare('SELECT * FROM mission_progress WHERE user_id=? AND mission_id=? AND day=?').get(userId, missionId, day);
  if (!mp || mp.progress < m.target) return { error: 'Finish the mission first.' };
  if (mp.claimed) return { error: 'Already claimed today.' };
  db.prepare('UPDATE mission_progress SET claimed=1 WHERE user_id=? AND mission_id=? AND day=?').run(userId, missionId, day);
  const stats = ensureStats(userId);
  const xp = stats.xp + m.xp_reward;
  db.prepare('UPDATE user_stats SET xp=?, level=?, updated_at=? WHERE user_id=?').run(xp, levelFor(xp), U.now(), userId);
  db.prepare('INSERT INTO xp_events (user_id,action,amount,ref_type,ref_id,day,created_at) VALUES (?,?,?,?,?,?,?)')
    .run(userId, 'mission_claim', m.xp_reward, 'mission', m.id, day, U.now());
  return { ok: true, xp, level: levelFor(xp), reward: m.xp_reward };
}

/* ---------------------------------------------------------------- badges */
const COUNTERS = {
  posts: (id) => db.prepare('SELECT COUNT(*) c FROM posts WHERE user_id=? AND removed=0').get(id).c,
  comments: (id) => db.prepare('SELECT COUNT(*) c FROM comments WHERE user_id=? AND removed=0').get(id).c,
  challenges: (id) => db.prepare('SELECT COUNT(*) c FROM challenge_entries WHERE user_id=?').get(id).c,
  challenge_wins: (id) => db.prepare('SELECT COUNT(*) c FROM challenge_entries WHERE user_id=? AND winner=1').get(id).c,
  projects: (id) => db.prepare("SELECT COUNT(*) c FROM posts WHERE user_id=? AND kind IN ('collab','team') AND removed=0").get(id).c,
  ideas: (id) => db.prepare('SELECT COUNT(*) c FROM ideas WHERE user_id=? AND status=\'active\'').get(id).c,
  products: (id) => db.prepare("SELECT COUNT(*) c FROM products WHERE seller_id=? AND status='active'").get(id).c,
  jobs_done: (id) => db.prepare("SELECT COUNT(*) c FROM job_proposals WHERE freelancer_id=? AND status='hired'").get(id).c,
  xp: (id) => (db.prepare('SELECT xp FROM user_stats WHERE user_id=?').get(id) || { xp: 0 }).xp,
  followers: (id) => db.prepare('SELECT COUNT(*) c FROM follows WHERE following_id=?').get(id).c,
};

function checkBadges(userId) {
  const earned = [];
  const owned = new Set(db.prepare('SELECT badge_id FROM user_badges WHERE user_id=?').all(userId).map((r) => r.badge_id));
  const all = db.prepare("SELECT * FROM badges WHERE active=1 AND rule_type<>'manual'").all();
  all.forEach((b) => {
    if (owned.has(b.id)) return;
    const counter = COUNTERS[b.rule_type];
    if (!counter) return;
    if (counter(userId) >= b.rule_value) {
      db.prepare('INSERT OR IGNORE INTO user_badges (user_id,badge_id,created_at) VALUES (?,?,?)').run(userId, b.id, U.now());
      earned.push({ code: b.code, name: b.name, emoji: b.emoji });
      U.notify({
        userId, actorId: userId, type: 'badge', entityType: 'badge', entityId: b.id,
        text: `Badge unlocked: ${b.emoji} ${b.name}`, link: '#/arena?tab=badges',
      });
    }
  });
  return earned;
}

function profileFor(userId) {
  const stats = ensureStats(userId);
  const { floor, ceil } = levelBounds(stats.level);
  const badges = db.prepare(`SELECT b.code,b.name,b.emoji,b.description,ub.created_at
    FROM user_badges ub JOIN badges b ON b.id=ub.badge_id WHERE ub.user_id=? ORDER BY ub.created_at DESC`).all(userId);
  return {
    xp: stats.xp,
    level: stats.level,
    streak_days: stats.streak_days,
    level_floor: floor,
    level_ceil: ceil,
    progress: Math.max(0, Math.min(1, (stats.xp - floor) / Math.max(1, ceil - floor))),
    badges,
  };
}

/** Leaderboards with transparent, published rules. */
const BOARDS = {
  creators: { label: 'Top Creators', sql: "SELECT user_id, SUM(amount) score FROM xp_events WHERE action IN ('post','reaction_received','challenge_entry') AND created_at>@since GROUP BY user_id" },
  contributors: { label: 'Top Contributors', sql: "SELECT user_id, SUM(amount) score FROM xp_events WHERE action IN ('comment','helpful_reply','community_join') AND created_at>@since GROUP BY user_id" },
  builders: { label: 'Top Builders', sql: "SELECT user_id, SUM(amount) score FROM xp_events WHERE action IN ('project','idea','product_listed') AND created_at>@since GROUP BY user_id" },
  gamers: { label: 'Top Gamers', sql: "SELECT user_id, SUM(amount) score FROM xp_events WHERE action IN ('challenge_entry','challenge_win') AND created_at>@since GROUP BY user_id" },
  overall: { label: 'Overall XP', sql: 'SELECT user_id, SUM(amount) score FROM xp_events WHERE created_at>@since GROUP BY user_id' },
};

function leaderboard(board = 'overall', range = '30d', limit = 20) {
  const b = BOARDS[board] || BOARDS.overall;
  const days = range === 'all' ? 3650 : range === '7d' ? 7 : 30;
  const since = U.now() - days * 86400000;
  const rows = db.prepare(`SELECT s.user_id, s.score, u.username, u.full_name, u.avatar, st.level, st.xp
    FROM (${b.sql}) s JOIN users u ON u.id=s.user_id
    LEFT JOIN user_stats st ON st.user_id=s.user_id
    WHERE u.status='active' ORDER BY s.score DESC, st.xp DESC LIMIT @limit`).all({ since, limit });
  return { board, label: b.label, range, rows };
}

module.exports = {
  ACTIONS, award, levelFor, levelBounds, ensureStats, profileFor,
  missionsFor, claimMission, checkBadges, leaderboard, BOARDS,
};
