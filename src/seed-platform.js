'use strict';
/* Gen-Z Hub — seed for the v2 platform: 12 interest hubs, badges, daily missions and the
   default (fully admin-editable) job / ad / cosmetic packages. Idempotent: safe on every boot. */

const { db } = require('./db');
const U = require('./util');

const HUBS = [
  ['business', 'Business', '💼', 'Startups, sales and building income', 'iris'],
  ['gaming', 'Gaming', '🎮', 'Squads, tournaments and clips', 'volt'],
  ['sports', 'Sports', '⚽', 'Football, cricket and local teams', 'aqua'],
  ['study', 'Study', '📚', 'SSC, HSC, coding and languages', 'iris'],
  ['fitness', 'Fitness', '🏋️', 'Training, nutrition and progress', 'flare'],
  ['technology', 'Technology', '💻', 'Code, gadgets and AI-free tinkering', 'aqua'],
  ['creative', 'Creative', '🎨', 'Design, art and content', 'flare'],
  ['cars', 'Cars', '🚗', 'Rides, mods and motorsport', 'volt'],
  ['movies', 'Movies', '🎬', 'Films, series and reviews', 'iris'],
  ['music', 'Music', '🎵', 'Producers, singers and playlists', 'flare'],
  ['fashion', 'Fashion', '👕', 'Fits, thrift and streetwear', 'aqua'],
  ['startups', 'Startups', '🚀', 'Ideas, MVPs and co-founders', 'volt'],
];

const BADGES = [
  ['first-post', 'First Post', '✍️', 'Published your first post', 'posts', 1],
  ['active-member', 'Active Member', '🔥', 'Published 10 posts', 'posts', 10],
  ['community-helper', 'Community Helper', '🤝', 'Wrote 25 comments', 'comments', 25],
  ['idea-creator', 'Idea Creator', '💡', 'Shared an idea in the Idea Arena', 'ideas', 1],
  ['builder', 'Builder', '💻', 'Started 3 projects', 'projects', 3],
  ['challenger', 'Challenger', '🎯', 'Entered your first challenge', 'challenges', 1],
  ['champion', 'Champion', '🏆', 'Won a challenge', 'challenge_wins', 1],
  ['seller', 'Seller', '🛍️', 'Listed your first product', 'products', 1],
  ['hired', 'Hired', '💼', 'Got hired for a job', 'jobs_done', 1],
  ['rising-star', 'Rising Star', '🌟', 'Reached 500 XP', 'xp', 500],
  ['legend', 'Legend', '👑', 'Reached 5000 XP', 'xp', 5000],
  ['popular', 'Popular', '📣', '25 people follow you', 'followers', 25],
];

const MISSIONS = [
  ['daily-checkin', 'Daily check-in', 'Open Gen-Z Hub today', 'daily_login', 1, 5, 1],
  ['daily-post', 'Share something', 'Publish 1 post', 'post', 1, 15, 2],
  ['daily-comment', 'Join 3 conversations', 'Write 3 comments', 'comment', 3, 15, 3],
  ['daily-vote', 'Vote in a poll', 'Vote in 1 poll', 'poll_vote', 1, 8, 4],
  ['daily-support', 'Back an idea', 'Support 1 idea in the Idea Arena', 'idea_support_received', 1, 10, 5],
  ['daily-hub', 'Explore a hub', 'Join a new interest hub', 'hub_join', 1, 10, 6],
];

// Defaults only — admins change price/quantity/duration from Admin → Packages.
const PACKAGES = [
  ['job', 'job-starter', 'Starter', '5 job posts, 30 days each', 10000, 5, 30, 'Standard listing', 1],
  ['job', 'job-pro', 'Pro', '10 job posts + highlighted listing', 20000, 10, 30, 'Highlighted listing', 2],
  ['job', 'job-business', 'Business', '25 job posts + priority placement', 40000, 25, 60, 'Priority placement, team access', 3],
  ['ad', 'ad-basic', 'Basic promotion', 'Hub-targeted promotion for 7 days', 10000, 1, 7, 'Feed placement', 1],
  ['ad', 'ad-standard', 'Standard promotion', 'Hub + category targeting for 14 days', 30000, 1, 14, 'Feed + hub placement', 2],
  ['ad', 'ad-premium', 'Premium promotion', 'Multi-hub targeting for 30 days', 50000, 1, 30, 'Feed, hub and marketplace placement', 3],
  ['cosmetic', 'pack-reactions', 'Gen-Z Reaction Pack', 'Original animated reactions for your posts', 1000, 1, 365, 'Exclusive reactions', 1],
  ['cosmetic', 'pack-theme', 'Profile Theme Pack', 'Extra profile themes and effects', 2000, 1, 365, 'Profile themes', 2],
];

const SETTINGS = {
  job_free_quota: '2',
  marketplace_commission_pct: '5',
  ads_enabled: '1',
  marketplace_enabled: '1',
  work_enabled: '1',
  arena_enabled: '1',
  signup_open: '1',
};

function seedPlatform() {
  const t = U.now();

  const hub = db.prepare('INSERT OR IGNORE INTO hubs (slug,name,emoji,tagline,accent,position,created_at) VALUES (?,?,?,?,?,?,?)');
  HUBS.forEach((h, i) => hub.run(h[0], h[1], h[2], h[3], h[4], i, t));

  const badge = db.prepare('INSERT OR IGNORE INTO badges (code,name,emoji,description,rule_type,rule_value) VALUES (?,?,?,?,?,?)');
  BADGES.forEach((b) => badge.run(...b));

  const mission = db.prepare('INSERT OR IGNORE INTO missions (code,title,description,action,target,xp_reward,position) VALUES (?,?,?,?,?,?,?)');
  MISSIONS.forEach((m) => mission.run(...m));

  const pkg = db.prepare(`INSERT OR IGNORE INTO packages (kind,code,name,description,price_cents,quantity,duration_days,perks,position,updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?)`);
  PACKAGES.forEach((p) => pkg.run(p[0], p[1], p[2], p[3], p[4], p[5], p[6], p[7], p[8], t));

  const setting = db.prepare('INSERT OR IGNORE INTO platform_settings (key,value,updated_at) VALUES (?,?,?)');
  Object.entries(SETTINGS).forEach(([k, v]) => setting.run(k, v, t));

  // keep legacy business/gaming membership flags reflected in the new hub tables
  const bizHub = db.prepare("SELECT id FROM hubs WHERE slug='business'").get();
  const gameHub = db.prepare("SELECT id FROM hubs WHERE slug='gaming'").get();
  const link = db.prepare('INSERT OR IGNORE INTO user_hubs (user_id,hub_id,created_at) VALUES (?,?,?)');
  if (bizHub) db.prepare('SELECT id FROM users WHERE in_business=1').all().forEach((u) => link.run(u.id, bizHub.id, t));
  if (gameHub) db.prepare('SELECT id FROM users WHERE in_gaming=1').all().forEach((u) => link.run(u.id, gameHub.id, t));

  // every existing user gets an XP row so leaderboards and levels work immediately
  const stats = db.prepare('INSERT OR IGNORE INTO user_stats (user_id,xp,level,updated_at) VALUES (?,0,1,?)');
  db.prepare('SELECT id FROM users').all().forEach((u) => stats.run(u.id, t));
}

module.exports = { seedPlatform, HUBS, BADGES, MISSIONS, PACKAGES };

if (require.main === module) {
  seedPlatform();
  console.log('Gen-Z Hub: platform v2 seeded (hubs, badges, missions, packages, settings).');
}
