'use strict';
/* Gen-Z Hub — media routes: high-quality video ingest + processing status. */

const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const express = require('express');
const multer = require('multer');
const U = require('../util');
const V = require('../video');
const jobs = require('../video-jobs');
const { db } = require('../db');

const r = express.Router();

const VIDEO_MIME = {
  'video/mp4': 'mp4', 'video/quicktime': 'mov', 'video/webm': 'webm',
  'video/x-matroska': 'mkv', 'video/x-m4v': 'm4v', 'video/3gpp': '3gp',
  'video/mpeg': 'mpg', 'video/x-msvideo': 'avi',
};
const MAX_MB = Number(process.env.VIDEO_MAX_MB || 300);
const VIDEO_EXTENSIONS = new Set(['mp4', 'mov', 'webm', 'mkv', 'm4v', '3gp', 'mpg', 'mpeg', 'avi']);
function videoExtension(file) {
  const byMime = VIDEO_MIME[file.mimetype];
  if (byMime) return byMime;
  const byName = path.extname(file.originalname || '').toLowerCase().slice(1);
  return VIDEO_EXTENSIONS.has(byName) ? byName : 'bin';
}

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, jobs.SRC_DIR),
    filename: (req, file, cb) => cb(null, `${Date.now()}-${crypto.randomBytes(8).toString('hex')}.${videoExtension(file)}`),
  }),
  limits: { fileSize: MAX_MB * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) => {
    const mime = file.mimetype || '';
    const name = (file.originalname || '').toLowerCase();
    const isVideo = mime.startsWith('video/') || 
                    name.endsWith('.mp4') || name.endsWith('.mov') || name.endsWith('.webm') ||
                    name.endsWith('.mkv') || name.endsWith('.m4v');
    if (!isVideo) return cb(new U.HttpError(400, 'Unsupported video format. Use MP4, MOV or WebM.'));
    cb(null, true);
  },
});

// POST /api/media/video — upload one video, returns an asset that is processed in the background
r.post('/video', U.requireAuth, U.rateLimit({ max: 30, windowMs: 30 * 60 * 1000, key: 'vidupload' }), (req, res) => {
  upload.single('file')(req, res, async (err) => {
    if (err) {
      const msg = err.code === 'LIMIT_FILE_SIZE'
        ? `That video is too large. Maximum size is ${MAX_MB} MB.`
        : (err.message || 'Upload failed.');
      return res.status(400).json({ error: msg });
    }
    const f = req.file;
    if (!f) return res.status(400).json({ error: 'No video received.' });

    // No ffmpeg on this host? Serve the original untouched rather than degrading it.
    if (!V.AVAILABLE || !V.TRANSCODE) {
      const rel = `/uploads/src/${f.filename}`;
      const uid = crypto.randomBytes(10).toString('hex');
      db.prepare(`INSERT INTO video_assets (uid,user_id,status,stage,progress,original_name,original_path,mime,bytes,variants,created_at,updated_at)
                  VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`)
        .run(uid, req.user.id, 'ready', 'done', 100, U.sanitizeText(f.originalname, 160), f.path, f.mimetype, f.size,
          JSON.stringify([{ h: 0, w: 0, url: rel, label: 'Original', bytes: f.size, source: 'original' }]), Date.now(), Date.now());
      return res.json({ asset: jobs.publicAsset(jobs.getAsset(uid)) });
    }

    // Probe first (cheap) so an invalid .mp4 cannot become a published fallback post.
    // The expensive poster/rendition work still runs asynchronously after this check.
    try {
      const probe = await V.probe(f.path);
      if (!probe.width || !probe.height) throw new Error('unreadable video');
      if (probe.duration && probe.duration > Number(process.env.VIDEO_MAX_SECONDS || 900)) throw new Error('video too long');
    } catch (probeErr) {
      fs.promises.unlink(f.path).catch(() => {});
      return res.status(400).json({ error: 'This video could not be read. Please choose a valid MP4, MOV or WebM video.' });
    }

    const row = jobs.createAsset({
      filePath: f.path,
      originalName: U.sanitizeText(f.originalname, 160),
      mime: f.mimetype,
      bytes: f.size,
      userId: req.user.id,
      instantPublic: true,
    });
    res.json({ asset: jobs.publicAsset(row) });
  });
});

// GET /api/media/video/:uid — processing status (progress %, stage, playback URLs)
r.get('/video/:uid', U.wrap((req, res) => {
  const row = jobs.getAsset(req.params.uid);
  if (!row) return res.status(404).json({ error: 'Video not found.' });
  res.json({ asset: jobs.publicAsset(row) });
}));

// POST /api/media/video/:uid/retry — "Try again" after a processing failure
r.post('/video/:uid/retry', U.requireAuth, U.wrap((req, res) => {
  const row = jobs.getAsset(req.params.uid);
  if (!row) return res.status(404).json({ error: 'Video not found.' });
  if (row.user_id !== req.user.id && !U.hasPermission(req.user, 'posts.moderate')) return res.status(403).json({ error: 'Not allowed.' });
  const again = jobs.retry(req.params.uid);
  if (!again) return res.status(400).json({ error: 'This video can no longer be reprocessed. Please upload it again.' });
  res.json({ asset: jobs.publicAsset(again) });
}));

// GET /api/media/capabilities — what this deployment can do (used by the composer UI)
r.get('/capabilities', (req, res) => {
  res.json({
    transcoding: !!(V.AVAILABLE && V.TRANSCODE),
    maxVideoMb: MAX_MB,
    cdn: !!jobs.MEDIA_BASE_URL,
    queue: jobs.queueLength(),
  });
});

module.exports = r;
