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

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, jobs.SRC_DIR),
    filename: (req, file, cb) => cb(null, `${Date.now()}-${crypto.randomBytes(8).toString('hex')}.${VIDEO_MIME[file.mimetype] || 'bin'}`),
  }),
  limits: { fileSize: MAX_MB * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) => {
    if (!VIDEO_MIME[file.mimetype]) return cb(new U.HttpError(400, 'Unsupported video format. Use MP4, MOV or WebM.'));
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

    const row = jobs.createAsset({
      filePath: f.path,
      originalName: U.sanitizeText(f.originalname, 160),
      mime: f.mimetype,
      bytes: f.size,
      userId: req.user.id,
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
  if (row.user_id !== req.user.id && req.user.role !== 'admin') return res.status(403).json({ error: 'Not allowed.' });
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
