'use strict';

// SQLite database layer.
//
// We use Node's built-in `node:sqlite` (DatabaseSync) so the project has ZERO
// native build dependencies — it runs anywhere Node 22.5+ runs, with no
// node-gyp, no external database server, and no vendor lock-in. The file is a
// real on-disk SQLite database, which satisfies the "proper database, not
// localStorage" requirement and supports real SQL queries, joins, indexes and
// transactions.

const path = require('path');
const { DatabaseSync } = require('node:sqlite');
const config = require('./config');

const db = new DatabaseSync(path.join(config.DATA_DIR, 'ideapulse.db'));

db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');
db.exec('PRAGMA busy_timeout = 5000;');

const SCHEMA = `
-- One row per admin user. Passwords are stored as scrypt hashes, never plaintext.
CREATE TABLE IF NOT EXISTS admin_users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'admin',
  created_at    TEXT NOT NULL
);

-- Server-side sessions. Only a SHA-256 hash of the random session token is
-- stored; the raw token lives solely in the user's httpOnly cookie.
CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  admin_id   INTEGER NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (admin_id) REFERENCES admin_users(id) ON DELETE CASCADE
);

-- Anonymous problem submissions. We intentionally store NO names, emails,
-- phone numbers, IP addresses or exact addresses.
CREATE TABLE IF NOT EXISTS submissions (
  id               TEXT PRIMARY KEY,          -- anonymous id like "IP-7F3K9Q2A"
  problem          TEXT NOT NULL,
  desired_solution TEXT NOT NULL,
  category         TEXT NOT NULL,
  broad_location   TEXT,                      -- city / area only, optional
  keywords         TEXT,                      -- JSON {words:{}, bigrams:{}}
  cluster_id       INTEGER,
  created_at       TEXT NOT NULL,             -- ISO-8601 UTC
  updated_at       TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_submissions_created ON submissions(created_at);
CREATE INDEX IF NOT EXISTS idx_submissions_category ON submissions(category);
CREATE INDEX IF NOT EXISTS idx_submissions_cluster ON submissions(cluster_id);

-- Automatically grouped "potential opportunities" produced by the analysis engine.
CREATE TABLE IF NOT EXISTS opportunity_clusters (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  slug             TEXT NOT NULL UNIQUE,
  title            TEXT NOT NULL,
  description      TEXT,
  score            INTEGER NOT NULL DEFAULT 0,
  score_label      TEXT NOT NULL DEFAULT 'Low signal',
  submission_count INTEGER NOT NULL DEFAULT 0,
  keywords         TEXT,                      -- JSON top keywords
  categories       TEXT,                      -- JSON [{name,count}]
  locations        TEXT,                      -- JSON [names]
  trend            TEXT,                      -- JSON [{bucket,count}]
  created_at       TEXT NOT NULL,
  updated_at       TEXT NOT NULL
);

-- Which submissions belong to which cluster.
CREATE TABLE IF NOT EXISTS cluster_submissions (
  cluster_id    INTEGER NOT NULL,
  submission_id TEXT NOT NULL,
  PRIMARY KEY (cluster_id, submission_id),
  FOREIGN KEY (cluster_id) REFERENCES opportunity_clusters(id) ON DELETE CASCADE,
  FOREIGN KEY (submission_id) REFERENCES submissions(id) ON DELETE CASCADE
);

-- Generated business-research reports (future monetization hook: these could be
-- sold / gated later without changing the data model).
CREATE TABLE IF NOT EXISTS generated_reports (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  cluster_id INTEGER NOT NULL,
  format     TEXT NOT NULL DEFAULT 'markdown',
  content    TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (cluster_id) REFERENCES opportunity_clusters(id) ON DELETE CASCADE
);

-- Key/value application settings (future subscription/payment flags live here).
CREATE TABLE IF NOT EXISTS app_settings (
  key        TEXT PRIMARY KEY,
  value      TEXT,
  updated_at TEXT NOT NULL
);

-- Insert monetization defaults so the architecture is ready for payments later.
INSERT OR IGNORE INTO app_settings (key, value, updated_at) VALUES
  ('monetization', '{"research_reports":false,"opportunity_insights":false,"partnerships":false,"launch_ventures":false}', datetime('now'));
`;

db.exec(SCHEMA);

// A tiny helper so callers can run multiple statements atomically.
function transaction(fn) {
  db.exec('BEGIN');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

module.exports = { db, transaction };
