'use strict';
/* Gen-Z Hub — video asset store + processing queue.

   Storage layout (DATA_DIR/uploads):
     src/<uid>.<ext>        original upload (kept only while processing, or if VIDEO_KEEP_ORIGINAL=1)
     v/<uid>/poster.jpg     sharp poster/thumbnail
     v/<uid>/720p.mp4       adaptive renditions (H.264 High / AAC, faststart)

   Every public URL goes through mediaUrl(), so pointing the whole platform at S3/R2 + a CDN
   later is a one-env-var change (MEDIA_BASE_URL) instead of an application rewrite. */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { db, DATA_DIR } = require('./db');
const V = require('./video');

const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');
const SRC_DIR = path.join(UPLOAD_DIR, 'src');
const OUT_DIR = path.join(UPLOAD_DIR, 'v');
fs.mkdirSync(SRC_DIR, { recursive: true });
fs.mkdirSync(OUT_DIR, { recursive: true });

const KEEP_ORIGINAL = process.env.VIDEO_KEEP_ORIGINAL === '1';
const MEDIA_BASE_URL = (process.env.MEDIA_BASE_URL || '').replace(/\/$/, '');

/** Absolute (CDN) or relative URL for a stored media path. */
function mediaUrl(rel) {
  if (!rel) return '';
  if (/^https?:\/\//i.test(rel)) return rel;
  return MEDIA_BASE_URL ? MEDIA_BASE_URL + rel : rel;
}

const now = () => Date.now();

function newUid() { return crypto.randomBytes(10).toString('hex'); }

function getAsset(uid) {
  return db.prepare('SELECT * FROM video_assets WHERE uid=?').get(String(uid || ''));
}

function publicAsset(row) {
  if (!row) return null;
  let variants = [];
  try { variants = JSON.parse(row.variants || '[]'); } catch (e) { variants = []; }
  variants = variants.map((v) => ({ ...v, url: mediaUrl(v.url) })).sort((a, b) => b.h - a.h);
  return {
    uid: row.uid,
    status: row.status,
    stage: row.stage,
    progress: row.progress,
    width: row.width,
    height: row.height,
    duration: row.duration,
    fps: row.fps,
    poster: mediaUrl(row.poster),
    variants,
    url: variants.length ? variants[0].url : '',
    error: row.status === 'failed' ? 'Video processing failed.' : '',
  };
}

function update(uid, fields) {
  const keys = Object.keys(fields);
  if (!keys.length) return;
  db.prepare(`UPDATE video_assets SET ${keys.map((k) => `${k}=@${k}`).join(',')}, updated_at=@u WHERE uid=@uid`)
    .run({ ...fields, u: now(), uid });
}

/** Register a freshly uploaded file and queue it for processing. */
function createAsset({ filePath, originalName, mime, bytes, userId }) {
  const uid = newUid();
  db.prepare(`INSERT INTO video_assets (uid,user_id,status,stage,progress,original_name,original_path,mime,bytes,created_at,updated_at)
              VALUES (?,?,?,?,?,?,?,?,?,?,?)`)
    .run(uid, userId || null, 'processing', 'queued', 0, String(originalName || '').slice(0, 160), filePath, mime || '', bytes || 0, now(), now());
  enqueue(uid);
  return getAsset(uid);
}

/* ---------------------------------------------------------------- queue */
const queue = [];
let running = 0;
const CONCURRENCY = Math.max(1, Number(process.env.VIDEO_CONCURRENCY || 1));

function enqueue(uid) {
  if (!queue.includes(uid)) queue.push(uid);
  pump();
}

function pump() {
  while (running < CONCURRENCY && queue.length) {
    const uid = queue.shift();
    running++;
    processAsset(uid)
      .catch((e) => {
        // Never surface raw ffmpeg output to users — log it, show a friendly message.
        console.error('[video] processing failed', uid, e && e.message);
        try { update(uid, { status: 'failed', stage: 'failed', error: String((e && e.message) || 'error').slice(0, 500) }); } catch (_) {}
      })
      .finally(() => { running--; setImmediate(pump); });
  }
}

function setProgress(uid, pct, stage) {
  const p = Math.max(0, Math.min(100, Math.round(pct)));
  const cur = getAsset(uid);
  if (!cur) return;
  const fields = { progress: Math.max(cur.progress, p) };
  if (stage) fields.stage = stage;
  update(uid, fields);
}

async function processAsset(uid) {
  const row = getAsset(uid);
  if (!row) return;
  const input = row.original_path;
  if (!fs.existsSync(input)) throw new Error('source file missing');

  const dir = path.join(OUT_DIR, uid);
  fs.mkdirSync(dir, { recursive: true });
  const rel = (name) => `/uploads/v/${uid}/${name}`;

  // ---- 1. validate + probe -------------------------------------------------
  update(uid, { stage: 'analysing', progress: 3 });
  const src = await V.probe(input);
  if (!src.width || !src.height) throw new Error('unreadable video');
  if (src.duration && src.duration > Number(process.env.VIDEO_MAX_SECONDS || 900)) {
    throw new Error('video too long');
  }
  update(uid, {
    width: src.width, height: src.height, duration: Math.round((src.duration || 0) * 1000) / 1000,
    fps: src.fps || 0, rotation: src.rotation || 0, progress: 6,
  });

  // ---- 2. poster (sharp, correct aspect ratio, web optimised) --------------
  update(uid, { stage: 'optimizing' });
  const posterFile = path.join(dir, 'poster.jpg');
  try {
    await V.makePoster(input, posterFile, src);
    update(uid, { poster: rel('poster.jpg'), progress: 12 });
  } catch (e) { console.warn('[video] poster failed', uid, e.message); }

  // ---- 3. top rendition — remux when possible (zero quality loss) ----------
  const plan = V.planLadder(src);
  const top = plan[0];
  const variants = [];
  const pushVariant = (v) => {
    variants.push(v);
    variants.sort((a, b) => b.h - a.h);
    update(uid, { variants: JSON.stringify(variants) });
  };

  const topName = `${top.q}p.mp4`;
  const topFile = path.join(dir, topName);
  // Prefer a stream copy when the source is already web-safe and its bitrate is sensible.
  // If it is not, we normally re-encode — but on a small instance a long clip would take many
  // minutes of CPU, so we keep the original bytes instead: the user's quality is preserved
  // exactly and the adaptive ladder is still built underneath it.
  const MAX_ENCODE_S = Number(process.env.VIDEO_MAX_ENCODE_SECONDS || 180);
  const nativeTop = Math.min(src.width, src.height) === top.q;
  const tooExpensive = V.estimateEncodeSeconds(src, top) > MAX_ENCODE_S;
  const remuxable = nativeTop && (V.canRemux(src) || (tooExpensive && V.isWebSafe(src)));
  update(uid, { stage: remuxable ? 'optimizing' : 'transcoding' });

  const onTop = (p) => setProgress(uid, 12 + p * 58, remuxable ? 'optimizing' : 'transcoding');
  if (remuxable) {
    try {
      await V.remux(input, topFile, src, onTop);
    } catch (e) {
      console.warn('[video] remux failed, encoding instead', uid, e.message);
      await V.makeRendition(input, topFile, src, top, onTop);
    }
  } else {
    await V.makeRendition(input, topFile, src, top, onTop);
  }
  pushVariant({
    h: top.q, w: top.w || src.width, ph: top.h, url: rel(topName), label: `${top.q}p`,
    bytes: statSize(topFile), source: remuxable ? 'original' : 'encoded',
  });

  // Playable now — the user can publish while smaller rungs keep rendering.
  update(uid, { status: 'ready', stage: 'renditions', progress: 100 });

  // ---- 4. adaptive ladder in the background --------------------------------
  const rest = plan.slice(1);
  for (const rung of rest) {
    const name = `${rung.q}p.mp4`;
    const file = path.join(dir, name);
    try {
      await V.makeRendition(input, file, src, rung);
      pushVariant({ h: rung.q, w: rung.w, ph: rung.h, url: rel(name), label: `${rung.q}p`, bytes: statSize(file), source: 'encoded' });
    } catch (e) {
      console.warn('[video] rendition failed', uid, rung.q, e.message);
    }
  }

  update(uid, { stage: 'done' });
  if (!KEEP_ORIGINAL) {
    // We keep only what we serve: renditions + poster. No duplicate multi-hundred-MB masters.
    fs.promises.unlink(input).catch(() => {});
    update(uid, { original_path: '' });
  }
}

function statSize(f) { try { return fs.statSync(f).size; } catch (e) { return 0; } }

/** Delete every artefact for an asset (used by retry / cleanup). */
function purge(uid) {
  const dir = path.join(OUT_DIR, uid);
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) {}
}

function retry(uid) {
  const row = getAsset(uid);
  if (!row) return null;
  if (!row.original_path || !fs.existsSync(row.original_path)) return null;
  purge(uid);
  update(uid, { status: 'processing', stage: 'queued', progress: 0, error: '', variants: '[]', poster: '' });
  enqueue(uid);
  return getAsset(uid);
}

/** Requeue anything left mid-flight by a restart. */
function resumePending() {
  const rows = db.prepare("SELECT uid, original_path FROM video_assets WHERE status='processing'").all();
  rows.forEach((r) => {
    if (r.original_path && fs.existsSync(r.original_path)) enqueue(r.uid);
    else update(r.uid, { status: 'failed', stage: 'failed', error: 'interrupted' });
  });
}

module.exports = {
  UPLOAD_DIR, SRC_DIR, OUT_DIR, MEDIA_BASE_URL,
  mediaUrl, createAsset, getAsset, publicAsset, retry, purge, resumePending,
  queueLength: () => queue.length + running,
};
