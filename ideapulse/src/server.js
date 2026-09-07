'use strict';

// IdeaPulse — full-stack server.
//   Express (static + JSON API) + SQLite (node:sqlite) + scrypt sessions.

const path = require('path');
const fs = require('fs');
const express = require('express');
const cookieParser = require('cookie-parser');
const compression = require('compression');

const config = require('./config');
const { db } = require('./db');
const security = require('./security');
const { ensureAdminUser } = require('./routes/admin');
const { rebuildClusters } = require('./clusters');

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', true);

// ── Security headers ──────────────────────────────────────────────────────────
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'same-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  if (config.PROD) res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  // Strict CSP: no remote scripts, styles, or connections. Charts are drawn
  // client-side with inline SVG; no external CDN needed.
  //
  // frame-ancestors is permissive so the app can be embedded in preview/paaS
  // sandboxes (e.g. *.e2b.app). The admin area is protected independently:
  // its session cookie is SameSite=Lax + httpOnly, so a cross-site page cannot
  // act as a signed-in admin.
  const allowAncestors =
    config.PROD && config.CANONICAL_HOST ? "'self'" : "'self' *";
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; " +
      "script-src 'self'; connect-src 'self'; frame-ancestors " + allowAncestors +
      "; base-uri 'self'; form-action 'self'"
  );
  next();
});

app.use(compression());
app.use(express.json({ limit: '256kb' }));
app.use(cookieParser());

// Health endpoint (no auth, no redirect) for load balancers / probes.
app.get('/api/health', (req, res) => res.json({ ok: true, service: 'ideapulse' }));

// ── API routes ────────────────────────────────────────────────────────────────
app.use('/api', security.csrfProtection);
app.use('/api', require('./routes/admin').router);
app.use('/api', require('./routes/api').router);

// ── Static assets ──────────────────────────────────────────────────────────────
app.use(
  express.static(path.join(config.ROOT, 'public'), {
    maxAge: config.PROD ? '7d' : 0,
    setHeaders(res, filePath) {
      if (filePath.endsWith('.html')) res.setHeader('Cache-Control', 'no-cache');
    },
  })
);

// ── SPA / page routes ──────────────────────────────────────────────────────────
function sendPage(res, file) {
  return res.sendFile(path.join(config.ROOT, 'public', file));
}

app.get('/admin/login', (req, res) => sendPage(res, 'admin-login.html'));
app.get('/admin', (req, res) => {
  if (!security.getSessionAdmin(req)) return res.redirect(302, '/admin/login');
  sendPage(res, 'admin.html');
});
app.get('/admin/dashboard', (req, res) => {
  if (!security.getSessionAdmin(req)) return res.redirect(302, '/admin/login');
  sendPage(res, 'admin.html');
});
app.get('/admin/opportunities/:slug', (req, res) => {
  if (!security.getSessionAdmin(req)) return res.redirect(302, '/admin/login');
  sendPage(res, 'admin.html');
});
app.get('/submit', (req, res) => sendPage(res, 'submit.html'));
app.get('/thanks', (req, res) => sendPage(res, 'thanks.html'));
app.get('/', (req, res) => sendPage(res, 'index.html'));

// ── robots.txt / sitemap ───────────────────────────────────────────────────────
app.get('/robots.txt', (req, res) => {
  res.type('text/plain').send('User-agent: *\nDisallow: /admin\nDisallow: /api/admin\nDisallow: /api/submissions\n');
});
app.get('/sitemap.xml', (req, res) => {
  const base = config.CANONICAL_HOST ? `https://${config.CANONICAL_HOST}` : `http://${req.get('host')}`;
  res.type('application/xml').send(
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
      `  <url><loc>${base}/</loc></url>\n</urlset>\n`
  );
});

// ── 404 for unknown routes ─────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: 'Not found.' });
});

// ── Error handler ──────────────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  // Never leak stack traces or internals to clients.
  console.error('[ideapulse] error:', err && err.message ? err.message : err);
  if (res.headersSent) return next(err);
  res.status(err.status || 500).json({ error: 'Something went wrong. Please try again.' });
});

// ── Boot ───────────────────────────────────────────────────────────────────────
function boot() {
  const created = ensureAdminUser(db);
  if (created) console.log(`[ideapulse] Provisioned admin account: ${created.email}`);

  // Ensure clusters reflect the current data (cheap on small datasets).
  try {
    const res = rebuildClusters(db);
    console.log(`[ideapulse] Rebuilt ${res.clusters} opportunity cluster(s).`);
  } catch (err) {
    console.error('[ideapulse] cluster rebuild failed:', err.message);
  }

  app.listen(config.PORT, '0.0.0.0', () => {
    console.log(`[ideapulse] IdeaPulse listening on http://0.0.0.0:${config.PORT}`);
  });
}

if (require.main === module) boot();

module.exports = app;
