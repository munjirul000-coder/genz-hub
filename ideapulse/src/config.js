'use strict';

// IdeaPulse configuration — reads from environment variables with safe defaults.
// Never store secrets in frontend code; everything sensitive lives here / in env.

const path = require('path');
const fs = require('fs');

const ROOT = path.join(__dirname, '..');
const DATA_DIR = path.resolve(process.env.DATA_DIR || path.join(ROOT, 'data'));
fs.mkdirSync(DATA_DIR, { recursive: true });

const NODE_ENV = process.env.NODE_ENV || 'development';
const PROD = NODE_ENV === 'production';

// In production we refuse to boot with the placeholder secret.
let sessionSecret = process.env.SESSION_SECRET || '';
if (!sessionSecret) {
  if (PROD) {
    throw new Error(
      'SESSION_SECRET is required in production. Set it in your environment (see .env.example).'
    );
  }
  sessionSecret = 'ideapulse-dev-secret-do-not-use-in-production';
}

module.exports = {
  ROOT,
  DATA_DIR,
  PORT: Number(process.env.PORT || 3000),
  NODE_ENV,
  PROD,
  SESSION_SECRET: sessionSecret,
  SESSION_TTL_MS: 7 * 24 * 60 * 60 * 1000, // 7 days
  SESSION_COOKIE: 'ip_session',
  CSRF_COOKIE: 'ip_csrf',
  ADMIN_EMAIL: (process.env.ADMIN_EMAIL || '').trim().toLowerCase(),
  ADMIN_PASSWORD: process.env.ADMIN_PASSWORD || '',
  CANONICAL_HOST: (process.env.CANONICAL_HOST || '').trim(),
};
