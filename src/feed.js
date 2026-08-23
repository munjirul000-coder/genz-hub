'use strict';
const { db } = require('./db');
const U = require('./util');
const jobs = require('./video-jobs');

// Hydrate a stored media row into the shape the player needs: poster, intrinsic size and the
// adaptive rendition list (read live from video_assets so a post always plays the best copy
// available, even if lower renditions finished after the post was published).
const assetCache = new Map();
function hydrateMedia(m) {
  const base = { url: jobs.mediaUrl(m.url), type: m.type, poster: jobs.mediaUrl(m.poster || ''),
    width: m.width || 0, height: m.height || 0, duration: m.duration || 0 };
  if (m.type !== 'video' || !m.asset_uid) return base;
  let a = assetCache.get(m.asset_uid);
  if (a === undefined) { a = jobs.publicAsset(jobs.getAsset(m.asset_uid)); assetCache.set(m.asset_uid, a); }
  if (!a) return base;
  return {
    ...base,
    asset_uid: a.uid,
    status: a.status,
    poster: a.poster || base.poster,
    width: a.width || base.width,
    height: a.height || base.height,
    duration: a.duration || base.duration,
    variants: a.variants,
    url: (a.variants[0] && a.variants[0].url) || base.url,
  };
}
setInterval(() => assetCache.clear(), 15000).unref?.();

// Base SQL fragment for visibility filtering. Uses :me param (0 for anonymous).
function visibilitySQL(alias = 'p') {
  return `
    ${alias}.removed=0
    AND NOT EXISTS (SELECT 1 FROM blocks b WHERE (b.blocker_id=${alias}.user_id AND b.blocked_id=@me) OR (b.blocker_id=@me AND b.blocked_id=${alias}.user_id))
    AND (
      ${alias}.user_id=@me
      OR (
        (${alias}.privacy='public'
          OR (${alias}.privacy='connections' AND EXISTS (
              SELECT 1 FROM connections c WHERE c.status='accepted' AND
              ((c.requester_id=${alias}.user_id AND c.addressee_id=@me) OR (c.requester_id=@me AND c.addressee_id=${alias}.user_id))))
        )
        AND (${alias}.group_id IS NULL OR EXISTS (
            SELECT 1 FROM groups g LEFT JOIN group_members gm ON gm.group_id=g.id AND gm.user_id=@me AND gm.status='active'
            WHERE g.id=${alias}.group_id AND (g.privacy='public' OR gm.user_id IS NOT NULL)))
      )
    )`;
}

const POST_FIELDS = `
  p.*, u.username, u.full_name, u.avatar, u.role AS author_role,
  (SELECT COUNT(*) FROM reactions rr WHERE rr.post_id=p.id) AS reaction_count,
  (SELECT COUNT(*) FROM comments cc WHERE cc.post_id=p.id AND cc.removed=0) AS comment_count,
  (SELECT COUNT(*) FROM posts sp WHERE sp.repost_of=p.id AND sp.removed=0) AS repost_count,
  (SELECT type FROM reactions rr WHERE rr.post_id=p.id AND rr.user_id=@me) AS my_reaction,
  (SELECT 1 FROM saved_items si WHERE si.user_id=@me AND si.item_type='post' AND si.item_id=p.id) AS is_saved,
  g.name AS group_name, cm.name AS community_name, cm.slug AS community_slug
`;

const POST_JOINS = `
  FROM posts p
  JOIN users u ON u.id=p.user_id
  LEFT JOIN groups g ON g.id=p.group_id
  LEFT JOIN communities cm ON cm.id=p.community_id
`;

function attachExtras(rows, me) {
  if (!rows.length) return rows;
  const ids = rows.map((r) => Number(r.id));
  const media = db.prepare(`SELECT * FROM post_media WHERE post_id IN (${ids.join(',')}) ORDER BY position`).all();
  const byPost = {};
  media.forEach((m) => { (byPost[m.post_id] = byPost[m.post_id] || []).push(hydrateMedia(m)); });
  const out = rows.map((r) => ({ ...r, media: byPost[r.id] || [], is_saved: !!r.is_saved }));
  // resolve reposts one level deep
  const repostIds = out.filter((r) => r.repost_of).map((r) => Number(r.repost_of));
  if (repostIds.length) {
    const parents = db.prepare(`SELECT ${POST_FIELDS} ${POST_JOINS} WHERE p.id IN (${repostIds.join(',')})`).all({ me });
    const pm = {};
    if (parents.length) {
      const pids = parents.map((x) => Number(x.id));
      db.prepare(`SELECT * FROM post_media WHERE post_id IN (${pids.join(',')}) ORDER BY position`).all()
        .forEach((m) => { (pm[m.post_id] = pm[m.post_id] || []).push(hydrateMedia(m)); });
    }
    const map = {};
    parents.forEach((p) => { map[p.id] = { ...p, media: pm[p.id] || [] }; });
    out.forEach((r) => { if (r.repost_of) r.original = map[r.repost_of] || null; });
  }
  return out;
}

function queryPosts({ me = 0, where = [], params = {}, limit = 10, cursor = null, order = 'p.created_at DESC, p.id DESC' }) {
  const clauses = [visibilitySQL('p'), ...where];
  // Keyset pagination must use the SAME key as the ORDER BY. The old cursor filtered on id alone
  // while the feed sorts by (created_at, id), so posts could be skipped entirely between pages —
  // a 50-post feed only ever showed ~15. Cursor format: "<created_at>_<id>" (legacy plain id still works).
  if (cursor) {
    const [cts, cid] = String(cursor).split('_');
    if (cid !== undefined) {
      clauses.push('(p.created_at < @cts OR (p.created_at = @cts AND p.id < @cid))');
      params.cts = Number(cts);
      params.cid = Number(cid);
    } else {
      clauses.push('p.id < @cursor');
      params.cursor = Number(cts);
    }
  }
  const sql = `SELECT ${POST_FIELDS} ${POST_JOINS} WHERE ${clauses.join(' AND ')} ORDER BY ${order} LIMIT @limit`;
  const rows = db.prepare(sql).all({ me, limit: limit + 1, ...params });
  const hasMore = rows.length > limit;
  const page = attachExtras(rows.slice(0, limit), me);
  const last = page[page.length - 1];
  return { posts: page, nextCursor: hasMore && last ? `${last.created_at}_${last.id}` : null };
}

function getPost(id, me) {
  const row = db.prepare(`SELECT ${POST_FIELDS} ${POST_JOINS} WHERE p.id=@id AND ${visibilitySQL('p')}`).get({ me, id });
  if (!row) return null;
  return attachExtras([row], me)[0];
}

module.exports = { queryPosts, getPost, visibilitySQL, POST_FIELDS, POST_JOINS, attachExtras };
