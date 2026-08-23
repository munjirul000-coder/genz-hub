'use strict';
const express = require('express');
const { db } = require('../db');
const U = require('../util');
const F = require('../feed');

const r = express.Router();
const HUBS = ['general', 'business', 'gaming'];
const PRIVACY = ['public', 'connections', 'private'];

function canPostTo(user, { group_id, community_id }) {
  if (group_id) {
    const m = db.prepare(`SELECT * FROM group_members WHERE group_id=? AND user_id=? AND status='active'`).get(group_id, user.id);
    if (!m) return 'You must be an active member of this group to post.';
  }
  if (community_id) {
    const m = db.prepare('SELECT * FROM community_members WHERE community_id=? AND user_id=?').get(community_id, user.id);
    if (!m) return 'Join this community before posting in it.';
  }
  return null;
}

// ---------- create ----------
r.post('/', U.requireAuth, U.rateLimit({ max: 30, windowMs: 5 * 60 * 1000, key: 'post' }), U.wrap((req, res) => {
  const content = U.sanitizeText(req.body.content, 5000);
  const media = Array.isArray(req.body.media) ? req.body.media.slice(0, 6) : [];
  const hub = HUBS.includes(req.body.hub) ? req.body.hub : 'general';
  const privacy = PRIVACY.includes(req.body.privacy) ? req.body.privacy : 'public';
  const kind = ['post', 'collab', 'team'].includes(req.body.kind) ? req.body.kind : 'post';
  const topic = U.sanitizeText(req.body.topic, 40);
  const group_id = req.body.group_id ? Number(req.body.group_id) : null;
  const community_id = req.body.community_id ? Number(req.body.community_id) : null;
  const link_url = U.sanitizeText(req.body.link_url, 500);

  if (!content && !media.length) return res.status(400).json({ error: 'Write something or attach media before posting.' });
  if (link_url && !/^https?:\/\//i.test(link_url)) return res.status(400).json({ error: 'Link must start with http:// or https://' });
  if (hub === 'business' && !req.user.in_business) return res.status(403).json({ error: 'Join Business Hub before posting there.' });
  if (hub === 'gaming' && !req.user.in_gaming) return res.status(403).json({ error: 'Join Gaming Hub before posting there.' });
  const err = canPostTo(req.user, { group_id, community_id });
  if (err) return res.status(403).json({ error: err });

  for (const m of media) {
    if (!m || typeof m.url !== 'string' || !m.url.startsWith('/uploads/') || !['image', 'video'].includes(m.type)) {
      return res.status(400).json({ error: 'Invalid media attachment.' });
    }
  }

  const info = db.prepare(`INSERT INTO posts (user_id,content,hub,kind,topic,privacy,group_id,community_id,link_url,created_at) VALUES (?,?,?,?,?,?,?,?,?,?)`)
    .run(req.user.id, content, hub, kind, topic, privacy, group_id, community_id, link_url || null, U.now());
  const id = info.lastInsertRowid;
  const im = db.prepare('INSERT INTO post_media (post_id,url,type,position) VALUES (?,?,?,?)');
  media.forEach((m, i) => im.run(id, m.url, m.type, i));
  U.linkHashtags(id, content);

  // mentions
  const mentions = [...new Set((content.match(/@([a-z0-9_]{3,20})/gi) || []).map((x) => x.slice(1).toLowerCase()))].slice(0, 8);
  mentions.forEach((name) => {
    const target = db.prepare('SELECT id FROM users WHERE username=?').get(name);
    if (target) U.notify({ userId: target.id, actorId: req.user.id, type: 'mention', entityType: 'post', entityId: id, text: `${req.user.full_name} mentioned you in a post`, link: `#/post/${id}` });
  });
  res.json({ post: F.getPost(id, req.user.id) });
}));

// ---------- feeds ----------
r.get('/feed', U.wrap((req, res) => {
  const me = req.user ? req.user.id : 0;
  const scope = req.query.scope || 'for-you';
  const hub = HUBS.includes(req.query.hub) ? req.query.hub : null;
  const where = [];
  const params = {};
  if (hub) { where.push('p.hub=@hub'); params.hub = hub; }
  else where.push("p.hub='general'");
  where.push('p.group_id IS NULL');
  if (scope === 'following' && me) {
    where.push('(p.user_id=@me OR EXISTS (SELECT 1 FROM follows f WHERE f.follower_id=@me AND f.following_id=p.user_id))');
  }
  if (req.query.topic) { where.push('p.topic=@topic'); params.topic = U.sanitizeText(req.query.topic, 40); }
  if (req.query.kind) { where.push('p.kind=@kind'); params.kind = U.sanitizeText(req.query.kind, 20); }
  const out = F.queryPosts({ me, where, params, limit: Math.min(Number(req.query.limit) || 8, 20), cursor: req.query.cursor });
  res.json(out);
}));

r.get('/hashtag/:tag', U.wrap((req, res) => {
  const me = req.user ? req.user.id : 0;
  const tag = U.sanitizeText(req.params.tag, 40).toLowerCase();
  const out = F.queryPosts({
    me, where: ['EXISTS (SELECT 1 FROM post_hashtags ph JOIN hashtags h ON h.id=ph.hashtag_id WHERE ph.post_id=p.id AND h.tag=@tag)'],
    params: { tag }, limit: 10, cursor: req.query.cursor,
  });
  res.json(out);
}));

r.get('/trending-hashtags', U.wrap((req, res) => {
  const rows = db.prepare(`SELECT h.tag, COUNT(*) AS n FROM post_hashtags ph JOIN hashtags h ON h.id=ph.hashtag_id
    JOIN posts p ON p.id=ph.post_id WHERE p.removed=0 AND p.privacy='public' GROUP BY h.tag ORDER BY n DESC, h.tag LIMIT 8`).all();
  res.json({ hashtags: rows });
}));

r.get('/saved', U.requireAuth, U.wrap((req, res) => {
  const me = req.user.id;
  const posts = F.queryPosts({ me, where: ["EXISTS (SELECT 1 FROM saved_items s WHERE s.user_id=@me AND s.item_type='post' AND s.item_id=p.id)"], limit: 20 });
  const events = db.prepare(`SELECT e.*, u.username, u.full_name FROM saved_items s JOIN events e ON e.id=s.item_id JOIN users u ON u.id=e.host_id
    WHERE s.user_id=? AND s.item_type='event' AND e.removed=0 ORDER BY e.starts_at`).all(me);
  res.json({ posts: posts.posts, events });
}));

r.get('/:id', U.wrap((req, res) => {
  const me = req.user ? req.user.id : 0;
  const p = F.getPost(Number(req.params.id), me);
  if (!p) return res.status(404).json({ error: 'Post not found or you do not have access to it.' });
  res.json({ post: p });
}));

// ---------- edit / delete ----------
r.patch('/:id', U.requireAuth, U.wrap((req, res) => {
  const post = db.prepare('SELECT * FROM posts WHERE id=? AND removed=0').get(req.params.id);
  if (!post) return res.status(404).json({ error: 'Post not found.' });
  if (post.user_id !== req.user.id) return res.status(403).json({ error: 'You can only edit your own posts.' });
  const content = U.sanitizeText(req.body.content, 5000);
  const privacy = PRIVACY.includes(req.body.privacy) ? req.body.privacy : post.privacy;
  const hasMedia = db.prepare('SELECT COUNT(*) n FROM post_media WHERE post_id=?').get(post.id).n;
  if (!content && !hasMedia) return res.status(400).json({ error: 'Post cannot be empty.' });
  db.prepare('UPDATE posts SET content=?, privacy=?, updated_at=? WHERE id=?').run(content, privacy, U.now(), post.id);
  U.linkHashtags(post.id, content);
  res.json({ post: F.getPost(post.id, req.user.id) });
}));

r.delete('/:id', U.requireAuth, U.wrap((req, res) => {
  const post = db.prepare('SELECT * FROM posts WHERE id=?').get(req.params.id);
  if (!post) return res.status(404).json({ error: 'Post not found.' });
  const isMod = req.user.role === 'admin';
  if (post.user_id !== req.user.id && !isMod) return res.status(403).json({ error: 'You can only delete your own posts.' });
  db.prepare('DELETE FROM posts WHERE id=?').run(post.id);
  res.json({ ok: true });
}));

// ---------- reactions ----------
r.post('/:id/react', U.requireAuth, U.wrap((req, res) => {
  const id = Number(req.params.id);
  const post = F.getPost(id, req.user.id);
  if (!post) return res.status(404).json({ error: 'Post not found.' });
  const type = ['like', 'fire', 'clap', 'mind'].includes(req.body.type) ? req.body.type : 'like';
  const existing = db.prepare('SELECT * FROM reactions WHERE post_id=? AND user_id=?').get(id, req.user.id);
  if (existing && existing.type === type) {
    db.prepare('DELETE FROM reactions WHERE post_id=? AND user_id=?').run(id, req.user.id);
  } else if (existing) {
    db.prepare('UPDATE reactions SET type=? WHERE post_id=? AND user_id=?').run(type, id, req.user.id);
  } else {
    db.prepare('INSERT INTO reactions (post_id,user_id,type,created_at) VALUES (?,?,?,?)').run(id, req.user.id, type, U.now());
    U.notify({ userId: post.user_id, actorId: req.user.id, type: 'like', entityType: 'post', entityId: id, text: `${req.user.full_name} reacted to your post`, link: `#/post/${id}` });
  }
  const count = db.prepare('SELECT COUNT(*) n FROM reactions WHERE post_id=?').get(id).n;
  const mine = db.prepare('SELECT type FROM reactions WHERE post_id=? AND user_id=?').get(id, req.user.id);
  res.json({ reaction_count: count, my_reaction: mine ? mine.type : null });
}));

r.get('/:id/reactions', U.wrap((req, res) => {
  const rows = db.prepare(`SELECT r.type,u.id,u.username,u.full_name,u.avatar FROM reactions r JOIN users u ON u.id=r.user_id WHERE r.post_id=? ORDER BY r.created_at DESC LIMIT 50`).all(req.params.id);
  res.json({ users: rows });
}));

// ---------- comments ----------
r.get('/:id/comments', U.wrap((req, res) => {
  const me = req.user ? req.user.id : 0;
  const post = F.getPost(Number(req.params.id), me);
  if (!post) return res.status(404).json({ error: 'Post not found.' });
  const rows = db.prepare(`SELECT c.*, u.username,u.full_name,u.avatar FROM comments c JOIN users u ON u.id=c.user_id
    WHERE c.post_id=? AND c.removed=0 ORDER BY c.created_at ASC LIMIT 300`).all(post.id);
  res.json({ comments: rows });
}));

r.post('/:id/comments', U.requireAuth, U.rateLimit({ max: 60, windowMs: 5 * 60 * 1000, key: 'comment' }), U.wrap((req, res) => {
  const me = req.user.id;
  const post = F.getPost(Number(req.params.id), me);
  if (!post) return res.status(404).json({ error: 'Post not found.' });
  const content = U.sanitizeText(req.body.content, 1000);
  if (!content) return res.status(400).json({ error: 'Comment cannot be empty.' });
  let parent_id = req.body.parent_id ? Number(req.body.parent_id) : null;
  if (parent_id) {
    const p = db.prepare('SELECT * FROM comments WHERE id=? AND post_id=?').get(parent_id, post.id);
    if (!p) return res.status(400).json({ error: 'The comment you replied to no longer exists.' });
    if (p.parent_id) parent_id = p.parent_id;
    U.notify({ userId: p.user_id, actorId: me, type: 'reply', entityType: 'post', entityId: post.id, text: `${req.user.full_name} replied to your comment`, link: `#/post/${post.id}` });
  }
  const info = db.prepare('INSERT INTO comments (post_id,user_id,parent_id,content,created_at) VALUES (?,?,?,?,?)').run(post.id, me, parent_id, content, U.now());
  U.notify({ userId: post.user_id, actorId: me, type: 'comment', entityType: 'post', entityId: post.id, text: `${req.user.full_name} commented on your post`, link: `#/post/${post.id}` });
  const c = db.prepare(`SELECT c.*, u.username,u.full_name,u.avatar FROM comments c JOIN users u ON u.id=c.user_id WHERE c.id=?`).get(info.lastInsertRowid);
  res.json({ comment: c });
}));

r.patch('/comments/:cid', U.requireAuth, U.wrap((req, res) => {
  const c = db.prepare('SELECT * FROM comments WHERE id=? AND removed=0').get(req.params.cid);
  if (!c) return res.status(404).json({ error: 'Comment not found.' });
  if (c.user_id !== req.user.id) return res.status(403).json({ error: 'You can only edit your own comments.' });
  const content = U.sanitizeText(req.body.content, 1000);
  if (!content) return res.status(400).json({ error: 'Comment cannot be empty.' });
  db.prepare('UPDATE comments SET content=?, updated_at=? WHERE id=?').run(content, U.now(), c.id);
  res.json({ ok: true, content });
}));

r.delete('/comments/:cid', U.requireAuth, U.wrap((req, res) => {
  const c = db.prepare('SELECT c.*, p.user_id AS post_owner FROM comments c JOIN posts p ON p.id=c.post_id WHERE c.id=?').get(req.params.cid);
  if (!c) return res.status(404).json({ error: 'Comment not found.' });
  const allowed = c.user_id === req.user.id || c.post_owner === req.user.id || req.user.role === 'admin';
  if (!allowed) return res.status(403).json({ error: 'Not allowed.' });
  db.prepare('DELETE FROM comments WHERE id=?').run(c.id);
  res.json({ ok: true });
}));

// ---------- repost / save ----------
r.post('/:id/repost', U.requireAuth, U.wrap((req, res) => {
  const id = Number(req.params.id);
  const post = F.getPost(id, req.user.id);
  if (!post) return res.status(404).json({ error: 'Post not found.' });
  const root = post.repost_of || post.id;
  const content = U.sanitizeText(req.body.content, 1000);
  const info = db.prepare(`INSERT INTO posts (user_id,content,hub,privacy,repost_of,created_at) VALUES (?,?,?,?,?,?)`)
    .run(req.user.id, content, post.hub, 'public', root, U.now());
  const owner = db.prepare('SELECT user_id FROM posts WHERE id=?').get(root);
  U.notify({ userId: owner.user_id, actorId: req.user.id, type: 'repost', entityType: 'post', entityId: root, text: `${req.user.full_name} reposted your post`, link: `#/post/${root}` });
  res.json({ post: F.getPost(info.lastInsertRowid, req.user.id) });
}));

r.post('/:id/save', U.requireAuth, U.wrap((req, res) => {
  const id = Number(req.params.id);
  if (!F.getPost(id, req.user.id)) return res.status(404).json({ error: 'Post not found.' });
  const ex = db.prepare(`SELECT * FROM saved_items WHERE user_id=? AND item_type='post' AND item_id=?`).get(req.user.id, id);
  if (ex) { db.prepare('DELETE FROM saved_items WHERE id=?').run(ex.id); return res.json({ saved: false }); }
  db.prepare(`INSERT INTO saved_items (user_id,item_type,item_id,created_at) VALUES (?,'post',?,?)`).run(req.user.id, id, U.now());
  res.json({ saved: true });
}));

module.exports = r;
