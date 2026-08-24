'use strict';
/* Gen-Z Hub — schema v2: hubs, marketplace, work/freelancing, ads, gamification,
   polls, ideas, challenges, platform settings and admin audit log.

   Kept in its own file so the original schema stays readable. Everything is created with
   IF NOT EXISTS so it is safe on every boot, including existing production databases. */

function applySchemaV2(db) {
  db.exec(`
/* ---------------------------------------------------------------- interest hubs */
CREATE TABLE IF NOT EXISTS hubs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  emoji TEXT NOT NULL DEFAULT '',
  tagline TEXT DEFAULT '',
  accent TEXT DEFAULT '',
  position INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS user_hubs (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  hub_id INTEGER NOT NULL REFERENCES hubs(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, hub_id)
);
CREATE INDEX IF NOT EXISTS idx_user_hubs_hub ON user_hubs(hub_id);

/* ---------------------------------------------------------------- marketplace */
CREATE TABLE IF NOT EXISTS stores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  owner_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  tagline TEXT DEFAULT '',
  about TEXT DEFAULT '',
  logo TEXT DEFAULT '',
  banner TEXT DEFAULT '',
  hub_slug TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'active',      -- active | suspended
  rating REAL NOT NULL DEFAULT 0,
  rating_count INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_stores_owner ON stores(owner_id);

CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  store_id INTEGER NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  seller_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT DEFAULT '',
  category TEXT NOT NULL DEFAULT 'Lifestyle',
  hub_slug TEXT DEFAULT '',
  price_cents INTEGER NOT NULL DEFAULT 0,       -- stored in poisha (BDT * 100)
  compare_at_cents INTEGER NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'BDT',
  stock INTEGER NOT NULL DEFAULT 0,
  condition TEXT NOT NULL DEFAULT 'new',        -- new | used
  status TEXT NOT NULL DEFAULT 'active',        -- active | hidden | removed
  featured INTEGER NOT NULL DEFAULT 0,
  views INTEGER NOT NULL DEFAULT 0,
  sold_count INTEGER NOT NULL DEFAULT 0,
  rating REAL NOT NULL DEFAULT 0,
  rating_count INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_products_store ON products(store_id);
CREATE INDEX IF NOT EXISTS idx_products_cat ON products(category);
CREATE INDEX IF NOT EXISTS idx_products_hub ON products(hub_slug);
CREATE INDEX IF NOT EXISTS idx_products_status ON products(status, created_at);

CREATE TABLE IF NOT EXISTS product_images (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_product_images ON product_images(product_id);

CREATE TABLE IF NOT EXISTS cart_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  qty INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  UNIQUE(user_id, product_id)
);
CREATE TABLE IF NOT EXISTS wishlist_items (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, product_id)
);

CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  buyer_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  total_cents INTEGER NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'BDT',
  status TEXT NOT NULL DEFAULT 'placed',       -- placed | confirmed | shipped | delivered | cancelled
  payment_status TEXT NOT NULL DEFAULT 'unpaid', -- unpaid | pending | paid | refunded
  payment_method TEXT NOT NULL DEFAULT 'cod',  -- cod | gateway (gateway needs configuration)
  ship_name TEXT DEFAULT '',
  ship_phone TEXT DEFAULT '',
  ship_address TEXT DEFAULT '',
  ship_city TEXT DEFAULT '',
  note TEXT DEFAULT '',
  created_at INTEGER NOT NULL,
  updated_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_orders_buyer ON orders(buyer_id, created_at);

CREATE TABLE IF NOT EXISTS order_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id INTEGER REFERENCES products(id) ON DELETE SET NULL,
  store_id INTEGER REFERENCES stores(id) ON DELETE SET NULL,
  seller_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  image TEXT DEFAULT '',
  unit_cents INTEGER NOT NULL DEFAULT 0,
  qty INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'placed'
);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_seller ON order_items(seller_id);

CREATE TABLE IF NOT EXISTS product_reviews (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL,
  body TEXT DEFAULT '',
  created_at INTEGER NOT NULL,
  UNIQUE(product_id, user_id)
);
CREATE TABLE IF NOT EXISTS store_follows (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  store_id INTEGER NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, store_id)
);

/* ---------------------------------------------------------------- work / freelancing */
CREATE TABLE IF NOT EXISTS freelancer_profiles (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  headline TEXT DEFAULT '',
  about TEXT DEFAULT '',
  skills TEXT DEFAULT '',                       -- comma separated
  hourly_cents INTEGER NOT NULL DEFAULT 0,
  min_budget_cents INTEGER NOT NULL DEFAULT 0,
  availability TEXT NOT NULL DEFAULT 'open',    -- open | busy | closed
  portfolio_url TEXT DEFAULT '',
  rating REAL NOT NULL DEFAULT 0,
  rating_count INTEGER NOT NULL DEFAULT 0,
  jobs_done INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER
);

CREATE TABLE IF NOT EXISTS job_posts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  category TEXT NOT NULL DEFAULT 'Other',
  skills TEXT DEFAULT '',
  budget_min_cents INTEGER NOT NULL DEFAULT 0,
  budget_max_cents INTEGER NOT NULL DEFAULT 0,
  budget_type TEXT NOT NULL DEFAULT 'fixed',    -- fixed | hourly
  location TEXT DEFAULT 'Remote',
  status TEXT NOT NULL DEFAULT 'open',          -- open | closed | filled | removed
  proposals_count INTEGER NOT NULL DEFAULT 0,
  expires_at INTEGER,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON job_posts(status, created_at);
CREATE INDEX IF NOT EXISTS idx_jobs_client ON job_posts(client_id);

CREATE TABLE IF NOT EXISTS job_proposals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  job_id INTEGER NOT NULL REFERENCES job_posts(id) ON DELETE CASCADE,
  freelancer_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  cover TEXT DEFAULT '',
  bid_cents INTEGER NOT NULL DEFAULT 0,
  days INTEGER NOT NULL DEFAULT 7,
  status TEXT NOT NULL DEFAULT 'sent',          -- sent | shortlisted | hired | declined | withdrawn
  created_at INTEGER NOT NULL,
  UNIQUE(job_id, freelancer_id)
);
CREATE INDEX IF NOT EXISTS idx_proposals_job ON job_proposals(job_id);
CREATE INDEX IF NOT EXISTS idx_proposals_freelancer ON job_proposals(freelancer_id);

/* ---------------------------------------------------------------- packages (jobs + ads) */
CREATE TABLE IF NOT EXISTS packages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kind TEXT NOT NULL,                           -- job | ad | cosmetic
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  price_cents INTEGER NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'BDT',
  quantity INTEGER NOT NULL DEFAULT 0,          -- job posts included / ad credits
  duration_days INTEGER NOT NULL DEFAULT 30,
  perks TEXT DEFAULT '',
  active INTEGER NOT NULL DEFAULT 1,
  position INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER
);
CREATE TABLE IF NOT EXISTS package_purchases (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  package_id INTEGER NOT NULL REFERENCES packages(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  credits_total INTEGER NOT NULL DEFAULT 0,
  credits_left INTEGER NOT NULL DEFAULT 0,
  amount_cents INTEGER NOT NULL DEFAULT 0,
  payment_status TEXT NOT NULL DEFAULT 'pending', -- pending | paid | failed (gateway required)
  payment_ref TEXT DEFAULT '',
  expires_at INTEGER,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_purchases_user ON package_purchases(user_id, kind);

/* ---------------------------------------------------------------- advertising */
CREATE TABLE IF NOT EXISTS ad_campaigns (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  advertiser_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT DEFAULT '',
  image TEXT DEFAULT '',
  cta_label TEXT DEFAULT 'Learn more',
  cta_url TEXT DEFAULT '',
  product_id INTEGER REFERENCES products(id) ON DELETE SET NULL,
  target_hubs TEXT DEFAULT '',                  -- comma separated hub slugs
  target_categories TEXT DEFAULT '',
  package_id INTEGER REFERENCES packages(id) ON DELETE SET NULL,
  budget_cents INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',       -- pending | active | paused | rejected | finished
  review_note TEXT DEFAULT '',
  impressions INTEGER NOT NULL DEFAULT 0,
  clicks INTEGER NOT NULL DEFAULT 0,
  starts_at INTEGER,
  ends_at INTEGER,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_ads_status ON ad_campaigns(status, ends_at);

/* ---------------------------------------------------------------- gamification */
CREATE TABLE IF NOT EXISTS user_stats (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  xp INTEGER NOT NULL DEFAULT 0,
  level INTEGER NOT NULL DEFAULT 1,
  streak_days INTEGER NOT NULL DEFAULT 0,
  last_active_day TEXT DEFAULT '',
  updated_at INTEGER
);
CREATE TABLE IF NOT EXISTS xp_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  amount INTEGER NOT NULL,
  ref_type TEXT DEFAULT '',
  ref_id INTEGER,
  day TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_xp_user_day ON xp_events(user_id, day, action);

CREATE TABLE IF NOT EXISTS badges (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  emoji TEXT NOT NULL DEFAULT '🏅',
  description TEXT DEFAULT '',
  rule_type TEXT NOT NULL DEFAULT 'manual',     -- posts | comments | challenges | projects | xp | products | manual
  rule_value INTEGER NOT NULL DEFAULT 1,
  active INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS user_badges (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  badge_id INTEGER NOT NULL REFERENCES badges(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, badge_id)
);

CREATE TABLE IF NOT EXISTS missions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  action TEXT NOT NULL,                         -- xp action that completes it
  target INTEGER NOT NULL DEFAULT 1,
  xp_reward INTEGER NOT NULL DEFAULT 10,
  active INTEGER NOT NULL DEFAULT 1,
  position INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS mission_progress (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  mission_id INTEGER NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
  day TEXT NOT NULL,
  progress INTEGER NOT NULL DEFAULT 0,
  claimed INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, mission_id, day)
);

CREATE TABLE IF NOT EXISTS challenges (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  category TEXT NOT NULL DEFAULT 'Creative',
  hub_slug TEXT DEFAULT '',
  cover TEXT DEFAULT '',
  xp_reward INTEGER NOT NULL DEFAULT 100,
  badge_code TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'open',          -- open | judging | closed
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  starts_at INTEGER,
  ends_at INTEGER,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS challenge_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  challenge_id INTEGER NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  post_id INTEGER REFERENCES posts(id) ON DELETE SET NULL,
  title TEXT DEFAULT '',
  body TEXT DEFAULT '',
  link_url TEXT DEFAULT '',
  votes INTEGER NOT NULL DEFAULT 0,
  winner INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  UNIQUE(challenge_id, user_id)
);
CREATE TABLE IF NOT EXISTS challenge_votes (
  entry_id INTEGER NOT NULL REFERENCES challenge_entries(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (entry_id, user_id)
);

/* ---------------------------------------------------------------- polls */
CREATE TABLE IF NOT EXISTS polls (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  post_id INTEGER REFERENCES posts(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  hub_slug TEXT DEFAULT '',
  multi INTEGER NOT NULL DEFAULT 0,
  closes_at INTEGER,
  total_votes INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS poll_options (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  poll_id INTEGER NOT NULL REFERENCES polls(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  votes INTEGER NOT NULL DEFAULT 0,
  position INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS poll_votes (
  poll_id INTEGER NOT NULL REFERENCES polls(id) ON DELETE CASCADE,
  option_id INTEGER NOT NULL REFERENCES poll_options(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (poll_id, user_id, option_id)
);

/* ---------------------------------------------------------------- idea arena */
CREATE TABLE IF NOT EXISTS ideas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT DEFAULT '',
  hub_slug TEXT DEFAULT '',
  looking_for TEXT DEFAULT '',
  stage TEXT NOT NULL DEFAULT 'idea',           -- idea | building | launched
  supports INTEGER NOT NULL DEFAULT 0,
  comments_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active',
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_ideas_created ON ideas(created_at);
CREATE TABLE IF NOT EXISTS idea_supports (
  idea_id INTEGER NOT NULL REFERENCES ideas(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (idea_id, user_id)
);
CREATE TABLE IF NOT EXISTS idea_comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  idea_id INTEGER NOT NULL REFERENCES ideas(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

/* ---------------------------------------------------------------- platform admin */
CREATE TABLE IF NOT EXISTS platform_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at INTEGER
);
CREATE TABLE IF NOT EXISTS admin_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  admin_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  target_type TEXT DEFAULT '',
  target_id INTEGER,
  detail TEXT DEFAULT '',
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_admin_logs ON admin_logs(created_at);
`);

  // ---- profile columns used by the new sections (idempotent) ----
  const addColumn = (table, column, definition) => {
    const cols = db.prepare(`PRAGMA table_info(${table})`).all().map((c) => c.name);
    if (!cols.includes(column)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${definition}`);
  };
  addColumn('users', 'skills', "skills TEXT DEFAULT ''");
  addColumn('users', 'work_status', "work_status TEXT NOT NULL DEFAULT 'none'"); // none | freelancer | client | both
  addColumn('users', 'portfolio_url', "portfolio_url TEXT DEFAULT ''");
  addColumn('posts', 'poll_id', 'poll_id INTEGER');
  addColumn('posts', 'product_id', 'product_id INTEGER');
}

module.exports = { applySchemaV2 };
