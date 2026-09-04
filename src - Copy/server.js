'use strict';
const path = require('path');
const fs = require('fs');
const express = require('express');
const cookieParser = require('cookie-parser');
const multer = require('multer');
const compression = require('compression');
const crypto = require('crypto');

const { db, DATA_DIR } = require('./db');
const U = require('./util');

const app = express();
const PORT = Number(process.env.PORT || 3000);
const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

app.disable('x-powered-by');
app.set('trust proxy', true);
app.use(compression());

const PROD = process.env.NODE_ENV === 'production';
const CANONICAL_HOST = process.env.CANONICAL_HOST || '';

// Force HTTPS + canonical host when deployed behind a proxy
app.use((req, res, next) => {
  // Platform health probes (Render/Fly/Kubernetes) arrive over plain HTTP and treat any 3xx as a
  // FAILED check — which pulls the whole service out of the load balancer. Never redirect them.
  if (req.path === '/api/health') return next();
  if (PROD && req.get('x-forwarded-proto') === 'http') {
    return res.redirect(301, 'https://' + req.get('host') + req.originalUrl);
  }
  if (PROD && CANONICAL_HOST && req.get('host') !== CANONICAL_HOST) {
    return res.redirect(301, 'https://' + CANONICAL_HOST + req.originalUrl);
  }
  next();
});

// --- security headers ---
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'same-origin');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(self), camera=(self)');
  if (process.env.NODE_ENV === 'production') res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  res.setHeader('Content-Security-Policy',
    "default-src 'self'; img-src 'self' data: blob:; media-src 'self' blob:; " +
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; " +
    "script-src 'self'; connect-src 'self'; frame-ancestors *");
  next();
});

app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());
app.use(U.loadUser);
app.use('/api', U.csrfGuard);
app.use('/api', U.rateLimit({ max: 600, windowMs: 60000, key: 'api' }));

// --- uploads ---
const ALLOWED = {
  'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif',
  'video/mp4': 'mp4', 'video/webm': 'webm', 'video/quicktime': 'mov',
  'application/pdf': 'pdf', 'text/plain': 'txt',
};
const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, UPLOAD_DIR),
    filename: (req, file, cb) => cb(null, `${Date.now()}-${crypto.randomBytes(8).toString('hex')}.${ALLOWED[file.mimetype] || 'bin'}`),
  }),
  limits: { fileSize: 25 * 1024 * 1024, files: 6 },
  fileFilter: (req, file, cb) => {
    if (!ALLOWED[file.mimetype]) return cb(new U.HttpError(400, 'Unsupported file type. Allowed: JPG, PNG, WEBP, GIF, MP4, WEBM, MOV, PDF, TXT.'));
    cb(null, true);
  },
});

app.post('/api/upload', U.requireAuth, U.rateLimit({ max: 60, windowMs: 10 * 60 * 1000, key: 'upload' }), (req, res) => {
  upload.array('files', 6)(req, res, (err) => {
    if (err) {
      const msg = err.code === 'LIMIT_FILE_SIZE' ? 'File is too large. Maximum size is 25 MB.' : (err.message || 'Upload failed.');
      return res.status(400).json({ error: msg });
    }
    const files = (req.files || []).map((f) => ({
      url: `/uploads/${f.filename}`,
      type: f.mimetype.startsWith('image/') ? 'image' : f.mimetype.startsWith('video/') ? 'video' : 'file',
      name: U.sanitizeText(f.originalname, 120),
      size: f.size,
    }));
    if (!files.length) return res.status(400).json({ error: 'No file received.' });
    res.json({ files });
  });
});

/* --- media delivery ---------------------------------------------------------
   Processed video renditions + posters are content-addressed (never overwritten), so they get
   a 1-year immutable cache and are safe to sit behind a CDN. express.static already answers
   HTTP Range requests, which is what makes seeking/streaming work; we advertise it explicitly.
   Setting MEDIA_BASE_URL swaps every media URL to object storage/CDN without touching code. */
const staticMedia = (dir, immutable) => express.static(dir, {
  maxAge: immutable ? '365d' : '7d',
  immutable: !!immutable,
  acceptRanges: true,
  setHeaders: (res) => {
    res.setHeader('Content-Disposition', 'inline');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Access-Control-Allow-Origin', '*'); // future CDN / object-storage origin pulls
  },
});
app.use('/uploads/v', staticMedia(path.join(UPLOAD_DIR, 'v'), true));
app.use('/uploads', staticMedia(UPLOAD_DIR, false));

// --- API routes ---
const auth = require('./routes/auth');
app.use('/api/auth', auth.router);
app.use('/api/me', require('./routes/me'));
app.use('/api/posts', require('./routes/posts'));
app.use('/api/shorts', require('./routes/shorts'));
app.use('/api/recommendations', require('./routes/recommendations'));
app.use('/api/media', require('./routes/media'));
const users = require('./routes/users');
app.use('/api/users', users.router);
app.use('/api/conversations', require('./routes/messages'));
const misc = require('./routes/misc');
app.use('/api/notifications', misc.notifications);
app.use('/api/stories', misc.stories);
app.use('/api/search', misc.search);
app.use('/api/reports', misc.reports);
app.use('/api/announcements', require('./routes/announcements'));
app.use('/api/admin/auth', require('./routes/admin-auth'));
app.use('/api/admin', require('./routes/admin-rbac'));
const gc = require('./routes/groups');
app.use('/api/groups', gc.groups);
app.use('/api/communities', gc.communities);
app.use('/api/events', gc.events);
app.use('/api/admin', require('./routes/admin'));
app.use('/api/admin', require('./routes/admin2'));       // v2 platform administration
const market = require('./routes/market');
app.use('/api/market', market.router);
const work = require('./routes/work');
app.use('/api/work', work.router);
const arena = require('./routes/arena');
app.use('/api/hubs', arena.hubs);
app.use('/api/challenges', arena.challenges);
app.use('/api/polls', arena.polls);
app.use('/api/ideas', arena.ideas);
app.use('/api/arena', arena.arena);
app.use('/api/ads', arena.ads);
app.get('/api/payments/status', (req, res) => res.json(require('./payments').status()));
app.post('/api/payments/callback', (req, res) => {
  const out = require('./payments').confirmCallback(req.body);
  res.status(out.ok ? 200 : 400).json(out);
});

app.get('/api/health', (req, res) => {
  let dbOk = true;
  try { db.prepare('SELECT 1').get(); } catch (e) { dbOk = false; }
  res.status(dbOk ? 200 : 503).json({
    status: dbOk ? 'ok' : 'degraded',
    service: 'genz-hub',
    version: require('../package.json').version,
    uptime_s: Math.round(process.uptime()),
    time: new Date().toISOString(),
  });
});

app.get('/api/bootstrap', U.wrap((req, res) => {
  res.json({
    user: req.user ? auth.me(req.user) : null,
    interests: db.prepare('SELECT * FROM interests ORDER BY category, name').all(),
    counts: db.prepare('SELECT (SELECT COUNT(*) FROM users) AS users, (SELECT COUNT(*) FROM posts WHERE removed=0) AS posts, (SELECT COUNT(*) FROM communities) AS communities').get(),
  });
}));

app.use('/api', (req, res) => res.status(404).json({ error: 'Endpoint not found.' }));

// --- static frontend (versioned assets, never-stale HTML) ---
const PUBLIC = path.join(__dirname, '..', 'public');

// প্রতিটি ডিপ্লয়ে নতুন ভার্সন → ব্রাউজার নিশ্চিতভাবে নতুন CSS/JS পায়
function computeAssetVersion() {
  let newest = 0;
  const walk = (dir) => {
    for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, f.name);
      if (f.isDirectory()) walk(full);
      else { const m = fs.statSync(full).mtimeMs; if (m > newest) newest = m; }
    }
  };
  try { walk(path.join(PUBLIC, 'js')); walk(path.join(PUBLIC, 'css')); } catch (e) {}
  return Math.round(newest).toString(36);
}
const ASSET_V = computeAssetVersion();
const INDEX_HTML = fs.readFileSync(path.join(PUBLIC, 'index.html'), 'utf8')
  .replace(/(src|href)="(\/(?:js|css)\/[^"]+)"/g, (m, attr, url) => `${attr}="${url}?v=${ASSET_V}"`);

function sendIndex(req, res) {
  res.setHeader('Cache-Control', 'no-cache, must-revalidate');
  res.type('html').send(INDEX_HTML);
}
app.get('/', sendIndex);
app.get('/index.html', sendIndex);
app.use(express.static(PUBLIC, {
  extensions: ['html'],
  etag: true,
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('index.html')) { res.setHeader('Cache-Control', 'no-cache, must-revalidate'); return; }
    // ?v=… দিয়ে আসা CSS/JS নিরাপদে দীর্ঘমেয়াদে ক্যাশ করা যায়; বাকিগুলো প্রতিবার যাচাই হবে
    if (/\.(js|css)$/.test(filePath)) res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    else res.setHeader('Cache-Control', 'public, max-age=86400, must-revalidate');
  },
}));
app.use((req, res) => sendIndex(req, res));

// --- errors ---
app.use((err, req, res, next) => {
  const status = err.status || 500;
  if (status >= 500) console.error('[error]', err);
  res.status(status).json({ error: status >= 500 ? 'Something went wrong on our side. Please try again.' : err.message });
});

require('./seed').ensureSeed();

// DEMO_SEED=1 → যদি ডেটাবেজ প্রায় খালি থাকে (যেমন Render ফ্রি টিয়ারে নতুন কনটেইনার),
// তাহলে বড় ডেমো ওয়ার্ল্ড (১৭ ইউজার, পোস্ট, স্টোরি, গ্রুপ, ইভেন্ট, মেসেজ) নিজে থেকেই বসিয়ে দাও।
if (process.env.DEMO_SEED === '1') {
  try {
    const n = db.prepare('SELECT COUNT(*) c FROM users').get().c;
    if (n < 8) {
      console.log('[demo] empty database detected — seeding the demo world…');
      require('child_process').execFileSync(process.execPath, [path.join(__dirname, 'demo-seed.js')], { stdio: 'inherit' });
    }
  } catch (e) { console.error('[demo] seeding skipped:', e.message); }
}

// Platform v2 defaults: hubs, badges, missions, packages, settings (idempotent).
try { require('./seed-platform').seedPlatform(); } catch (e) { console.error('[seed] platform seed failed:', e.message); }

// Lightweight recommendation categories/settings are seeded locally; no external service is used.
try { require('./recommendations').init(); } catch (e) { console.error('[recommendations] init failed:', e.message); }

// Resume any video that was mid-transcode when the process restarted.
try { require('./video-jobs').resumePending(); } catch (e) { console.error('[video] resume failed', e.message); }

const server = app.listen(PORT, '0.0.0.0', () => console.log(`Gen-Z Hub running on http://0.0.0.0:${PORT} (${PROD ? 'production' : 'development'})`));

function shutdown(sig) {
  console.log(`[${sig}] shutting down…`);
  server.close(() => { try { db.close(); } catch (e) {} process.exit(0); });
  setTimeout(() => process.exit(1), 8000).unref();
}
['SIGTERM', 'SIGINT'].forEach((s) => process.on(s, () => shutdown(s)));
process.on('unhandledRejection', (e) => console.error('[unhandledRejection]', e));
