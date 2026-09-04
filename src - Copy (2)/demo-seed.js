'use strict';
/* Gen-Z Hub — rich DEMO WORLD seeder.
   Builds a realistic, fully populated platform so every feature can be tested with real data.
   Usage: node src/demo-seed.js            (adds the demo world to the current database)
          node src/demo-seed.js --fresh    (wipes DATA_DIR first, then rebuilds everything) */
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

const FRESH = process.argv.includes('--fresh');
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
if (FRESH) {
  for (const f of ['genzhub.db', 'genzhub.db-wal', 'genzhub.db-shm']) {
    try { fs.unlinkSync(path.join(DATA_DIR, f)); } catch (e) {}
  }
}
const { db } = require('./db');
const U = require('./util');
require('./seed').ensureSeed();

const UPLOADS = path.join(DATA_DIR, 'uploads');
fs.mkdirSync(UPLOADS, { recursive: true });
const now = Date.now();
const H = 3600e3, D = 24 * H;

/* ---------- locally generated artwork (SVG, no external assets) ---------- */
const PALETTES = [
  ['#7c5cff', '#12d6c8'], ['#ff5c8a', '#7c5cff'], ['#12d6c8', '#3ba6ff'], ['#f5a524', '#ff5c8a'],
  ['#18b981', '#12d6c8'], ['#3ba6ff', '#7c5cff'], ['#ff7a45', '#f5a524'], ['#2b7fd4', '#0d7a70'],
];
function art(name, label, i, w = 1200, h = 675) {
  const [a, b] = PALETTES[i % PALETTES.length];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs>
  <rect width="${w}" height="${h}" fill="url(#g)"/>
  <circle cx="${w * 0.82}" cy="${h * 0.2}" r="${h * 0.34}" fill="rgba(255,255,255,.12)"/>
  <circle cx="${w * 0.16}" cy="${h * 0.86}" r="${h * 0.3}" fill="rgba(0,0,0,.12)"/>
  <text x="${w / 2}" y="${h / 2 + 18}" font-family="Segoe UI,Arial,sans-serif" font-size="${Math.round(h * 0.11)}"
    font-weight="800" fill="rgba(255,255,255,.92)" text-anchor="middle">${label}</text>
</svg>`;
  fs.writeFileSync(path.join(UPLOADS, name), svg);
  return '/uploads/' + name;
}
function avatarArt(name, letter, i) {
  const [a, b] = PALETTES[i % PALETTES.length];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="200" height="200">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs>
  <rect width="200" height="200" rx="100" fill="url(#g)"/>
  <text x="100" y="132" font-family="Segoe UI,Arial,sans-serif" font-size="96" font-weight="800" fill="#fff" text-anchor="middle">${letter}</text>
</svg>`;
  fs.writeFileSync(path.join(UPLOADS, name), svg);
  return '/uploads/' + name;
}

/* ---------- helpers ---------- */
const pw = bcrypt.hashSync('Demo12345', 10);
const uid = (username) => { const r = db.prepare('SELECT id FROM users WHERE username=?').get(username); return r && r.id; };
function addUser(o, i) {
  const existing = uid(o.username);
  if (existing) return existing;
  const info = db.prepare(`INSERT INTO users
    (username,email,password_hash,full_name,dob,bio,location,avatar,cover,in_business,in_gaming,business_role,fav_games,platform,gamer_tag,onboarded,created_at,last_seen)
    VALUES (@username,@email,@pw,@full_name,@dob,@bio,@location,@avatar,@cover,@biz,@gam,@role,@games,@platform,@tag,1,@created,@seen)`).run({
    username: o.username, email: o.email, pw, full_name: o.full_name, dob: o.dob || '2003-01-01',
    bio: o.bio || '', location: o.location || '', avatar: avatarArt('av-' + o.username + '.svg', o.full_name[0], i),
    cover: art('cover-' + o.username + '.svg', o.coverLabel || 'GEN-Z HUB', i + 2, 1200, 400),
    biz: o.biz ? 1 : 0, gam: o.gam ? 1 : 0, role: o.role || '', games: o.games || '', platform: o.platform || '',
    tag: o.tag || '', created: now - (o.daysAgo || 20) * D, seen: now - Math.floor(Math.random() * 4) * H,
  });
  (o.interests || []).forEach((n) => {
    const it = db.prepare('SELECT id FROM interests WHERE name=?').get(n);
    if (it) db.prepare('INSERT OR IGNORE INTO user_interests (user_id,interest_id) VALUES (?,?)').run(info.lastInsertRowid, it.id);
  });
  return info.lastInsertRowid;
}
function addPost(o) {
  const info = db.prepare(`INSERT INTO posts (user_id,content,hub,kind,topic,privacy,group_id,community_id,created_at)
    VALUES (?,?,?,?,?,?,?,?,?)`).run(o.user, o.content, o.hub || 'general', o.kind || 'post', o.topic || '',
    o.privacy || 'public', o.group || null, o.community || null, o.at);
  const id = info.lastInsertRowid;
  (o.media || []).forEach((m, i) => db.prepare('INSERT INTO post_media (post_id,url,type,position) VALUES (?,?,?,?)').run(id, m, 'image', i));
  U.linkHashtags(id, o.content);
  return id;
}
const react = (post, user, type, at) => db.prepare('INSERT OR IGNORE INTO reactions (post_id,user_id,type,created_at) VALUES (?,?,?,?)').run(post, user, type, at || now);
function comment(post, user, content, at, parent) {
  return db.prepare('INSERT INTO comments (post_id,user_id,parent_id,content,created_at) VALUES (?,?,?,?,?)')
    .run(post, user, parent || null, content, at || now).lastInsertRowid;
}
const follow = (a, b2) => db.prepare('INSERT OR IGNORE INTO follows (follower_id,following_id,created_at) VALUES (?,?,?)').run(a, b2, now - 5 * D);

/* ================= 1. PEOPLE ================= */
const P = [
  { username: 'demo', email: 'demo@genzhub.app', full_name: 'Demo User', bio: 'This is your test account — post, chat, join hubs, break things 🚀', location: 'Dhaka, BD',
    biz: 1, gam: 1, role: 'Founder', games: 'Valorant, FIFA', platform: 'PC', tag: 'demo#0001', coverLabel: 'CONNECT. BUILD. PLAY. GROW.',
    interests: ['Startups', 'Technology', 'Esports', 'Content Creation'], daysAgo: 30 },
  { username: 'ayesha', email: 'ayesha@demo.genzhub.app', full_name: 'Ayesha Siddika', bio: 'Building a study-tools startup. Ex-debater. Learning in public.', location: 'Dhaka, BD',
    biz: 1, role: 'Founder', coverLabel: 'BUILD IN PUBLIC', interests: ['Startups', 'Entrepreneurship', 'Education'], daysAgo: 26 },
  { username: 'shakib', email: 'shakib@demo.genzhub.app', full_name: 'Shakib Al Noman', bio: 'Full-stack dev. Node + React. Open to freelance work.', location: 'Chattogram, BD',
    biz: 1, role: 'Developer', coverLabel: 'SHIP IT', interests: ['Technology', 'Freelancing', 'Startups'], daysAgo: 24 },
  { username: 'mahi', email: 'mahi@demo.genzhub.app', full_name: 'Mahiya Rahman', bio: 'Brand designer 🎨 Figma all day. 40+ projects delivered.', location: 'Dhaka, BD',
    biz: 1, role: 'Designer', coverLabel: 'DESIGN THAT SELLS', interests: ['Design', 'Freelancing', 'Marketing'], daysAgo: 22 },
  { username: 'tahmid', email: 'tahmid@demo.genzhub.app', full_name: 'Tahmid Hasan', bio: 'Ecommerce operator. Meta ads, funnels, retention.', location: 'Khulna, BD',
    biz: 1, role: 'Marketer', coverLabel: 'GROWTH', interests: ['E-commerce', 'Marketing', 'Sales'], daysAgo: 21 },
  { username: 'raiyan', email: 'raiyan@demo.genzhub.app', full_name: 'Raiyan Kabir', bio: 'Valorant Immortal • IGL • looking for a serious 5-stack', location: 'Dhaka, BD',
    gam: 1, games: 'Valorant, CS2', platform: 'PC', tag: 'RAIYAN#BD1', coverLabel: 'CLUTCH OR KICK', interests: ['Esports', 'FPS', 'PC Gaming'], daysAgo: 19 },
  { username: 'nusrat', email: 'nusrat@demo.genzhub.app', full_name: 'Nusrat Jahan', bio: 'Mobile gaming creator. PUBGM clips daily. 12k subs 🎮', location: 'Sylhet, BD',
    gam: 1, games: 'PUBG Mobile, Free Fire', platform: 'Mobile', tag: 'NUSRAT_YT', coverLabel: 'CLIPS DAILY', interests: ['Mobile Gaming', 'Content Creation', 'Esports'], daysAgo: 17 },
  { username: 'fahim', email: 'fahim@demo.genzhub.app', full_name: 'Fahim Chowdhury', bio: 'CS student. Frontend by night, FIFA by weekend.', location: 'Dhaka, BD',
    biz: 1, gam: 1, role: 'Student', games: 'FIFA / FC, Minecraft', platform: 'Console', coverLabel: 'STUDENT + BUILDER',
    interests: ['Technology', 'Education', 'Sports Games'], daysAgo: 14 },
  { username: 'zarin', email: 'zarin@demo.genzhub.app', full_name: 'Zarin Tasnim', bio: 'Content creator & community manager. Football fan ⚽', location: 'Dhaka, BD',
    interests: ['Content Creation', 'Football', 'Music'], coverLabel: 'CREATE EVERY DAY', daysAgo: 12 },
  { username: 'arif', email: 'arif@demo.genzhub.app', full_name: 'Arif Mahmud', bio: 'Freelance video editor. Premiere + After Effects.', location: 'Rajshahi, BD',
    biz: 1, role: 'Freelancer', coverLabel: 'EDIT • RENDER • REPEAT', interests: ['Freelancing', 'Content Creation', 'Design'], daysAgo: 9 },
];
const ID = {};
P.forEach((p, i) => { ID[p.username] = addUser(p, i); });
const me = ID.demo;

/* follows: everyone follows a few others; several people follow the demo user */
const all = Object.values(ID);
all.forEach((a) => all.forEach((b2) => { if (a !== b2 && Math.random() > 0.45) follow(a, b2); }));
['ayesha', 'shakib', 'mahi', 'raiyan', 'nusrat', 'zarin'].forEach((u) => follow(ID[u], me));
['ayesha', 'shakib', 'raiyan'].forEach((u) => follow(me, ID[u]));

/* connections: two accepted + two pending requests waiting for the demo user to accept */
const conn = db.prepare(`INSERT OR IGNORE INTO connections (requester_id,addressee_id,status,created_at) VALUES (?,?,?,?)`);
conn.run(ID.ayesha, me, 'accepted', now - 6 * D);
conn.run(me, ID.shakib, 'accepted', now - 5 * D);
conn.run(ID.mahi, me, 'pending', now - 8 * H);
conn.run(ID.tahmid, me, 'pending', now - 3 * H);

/* ================= 2. POSTS ================= */
const posts = [];
const push = (o) => posts.push(addPost(o));

// general feed
push({ user: ID.zarin, at: now - 1.2 * H, content: 'Bangladesh match day 🇧🇩⚽ Who is watching tonight? Predictions in the comments. #football',
  media: [art('post-football.svg', 'MATCH NIGHT', 3)] });
push({ user: ID.fahim, at: now - 3 * H, content: 'Finally finished my first full-stack project — auth, database, deployment, everything. Backend was way less scary than I thought. #technology #education' });
push({ user: ID.nusrat, at: now - 5 * H, content: '4-finger claw took me 2 weeks to get used to and my KD literally doubled. If you are on the fence, just do it. #mobilegaming',
  media: [art('post-claw.svg', 'CLAW SETUP', 5)] });
push({ user: ID.arif, at: now - 9 * H, content: 'Editor tip: cut on motion, not on silence. Your reels will feel 2x faster instantly. #contentcreation' });
push({ user: ID.zarin, at: now - 26 * H, content: 'Made a 30-day content calendar for my page. Consistency > perfection. Anyone else doing a 30-day challenge? #music #contentcreation' });

// business hub
push({ user: ID.ayesha, hub: 'business', topic: 'Startups', at: now - 2 * H,
  content: 'Shipped the paid version of my study app today. 3 coaching centres signed up in week one — total revenue 4,500tk. Small, but real. Screenshots of the dashboard below 👇 #startups #buildinpublic',
  media: [art('post-dashboard.svg', 'REVENUE WEEK 1', 0), art('post-dashboard2.svg', 'SIGNUPS', 1)] });
push({ user: ID.mahi, hub: 'business', topic: 'Freelancing', at: now - 4 * H,
  content: 'Raised my rate by 40% and lost exactly zero clients. Price the outcome, not the hours. Happy to share my proposal template if anyone wants it. #freelancing' });
push({ user: ID.tahmid, hub: 'business', topic: 'E-commerce', at: now - 7 * H,
  content: 'Our repeat-purchase rate went 12% → 27% by fixing ONE thing: the post-order message. Retention is cheaper than ads, every single time. #ecommerce #marketing' });
push({ user: ID.shakib, hub: 'business', topic: 'Technology', at: now - 20 * H,
  content: 'Freelance devs: always take 50% upfront. Learned that one the expensive way 🙂 #freelancing #technology' });
push({ user: ID.ayesha, hub: 'business', kind: 'collab', topic: 'Networking', at: now - 12 * H,
  content: 'Looking for a co-founder (technical) for an EdTech tool for coaching centres. I handle sales, ops and content. Equity split, Dhaka preferred, remote is fine. DM me.' });
push({ user: ID.mahi, hub: 'business', kind: 'collab', topic: 'Technology', at: now - 30 * H,
  content: 'Looking for a developer to partner on a portfolio-builder for students. I do the full design system, you do the code, we split everything 50/50. #collaboration' });
push({ user: ID.tahmid, hub: 'business', kind: 'collab', topic: 'Marketing', at: now - 40 * H,
  content: 'Looking for a video editor for a 6-week ecommerce campaign. Paid per deliverable, portfolio required. Comment or DM.' });

// gaming hub
push({ user: ID.raiyan, hub: 'gaming', topic: 'Esports', at: now - 1.6 * H,
  content: 'Immortal 1 finally 🔥 20 minutes of aim trainer before every session genuinely works. Next stop: Radiant. #esports #fps',
  media: [art('post-rank.svg', 'IMMORTAL 1', 2)] });
push({ user: ID.nusrat, hub: 'gaming', topic: 'Mobile Gaming', at: now - 6 * H,
  content: 'New sensitivity settings for PUBGM after the update — 3-finger, gyro always on. Full breakdown in my next video. #mobilegaming' });
push({ user: ID.fahim, hub: 'gaming', topic: 'Console Gaming', at: now - 28 * H,
  content: 'FIFA career mode with a Bangladeshi custom club is unreasonably fun. Anyone else doing this? #sportsgames' });
push({ user: ID.raiyan, hub: 'gaming', kind: 'team', topic: 'Teams', at: now - 10 * H,
  content: 'LF teammates for a serious 5-stack. Need a controller main + a sentinel. Immortal-ish, mic required, scrims Sun/Tue/Thu 9pm. Comment your rank + role.' });
push({ user: ID.nusrat, hub: 'gaming', kind: 'team', topic: 'Tournaments', at: now - 34 * H,
  content: 'Squad hunting for the weekend PUBGM community cup — need one more assaulter. No tilt, no toxicity, just vibes. 🎮' });

// demo user's own posts (so the profile is not empty)
push({ user: me, at: now - 22 * H, content: 'Just joined Gen-Z Hub 👋 Testing every feature — posts, hubs, groups, messages. So far so good. #genzhub' });
push({ user: me, hub: 'business', topic: 'Business Ideas', at: now - 46 * H,
  content: 'Idea I keep coming back to: a tiny CRM built only for freelancers in Bangladesh — invoices in BDT, bKash-friendly, nothing else. Would you use it? #businessideas' });

/* reactions + comments */
posts.forEach((p, i) => {
  all.forEach((u) => { if (Math.random() > (i < 6 ? 0.35 : 0.6)) react(p, u, ['like', 'fire', 'clap', 'mind'][Math.floor(Math.random() * 4)], now - Math.random() * D); });
});
const c1 = comment(posts[5], ID.mahi, 'Congrats! How did you land the first centre?', now - 1.5 * H);
comment(posts[5], ID.ayesha, 'Walked in and offered to set it up free for one week. They kept it.', now - 1.2 * H, c1);
comment(posts[5], me, 'This is genuinely inspiring. Following your build 🙌', now - 50 * 60e3);
const c2 = comment(posts[13], ID.fahim, 'Diamond 2, sentinel main. Can do Sun/Thu.', now - 8 * H);
comment(posts[13], ID.raiyan, 'Add me, we will run a couple of unrated first.', now - 7 * H, c2);
comment(posts[0], ID.fahim, '2-1 Bangladesh, calling it now 🇧🇩', now - 1 * H);
comment(posts[6], me, 'Sending you a DM about that proposal template!', now - 3 * H);
comment(posts[2], ID.raiyan, 'Claw gang 🤝', now - 4 * H);

/* saved items for the demo user */
db.prepare(`INSERT OR IGNORE INTO saved_items (user_id,item_type,item_id,created_at) VALUES (?,'post',?,?)`).run(me, posts[6], now - 2 * H);
db.prepare(`INSERT OR IGNORE INTO saved_items (user_id,item_type,item_id,created_at) VALUES (?,'post',?,?)`).run(me, posts[9], now - 1 * H);

/* ================= 3. STORIES (active, 24h) ================= */
const st = db.prepare('INSERT INTO stories (user_id,media_url,media_type,caption,created_at,expires_at) VALUES (?,?,?,?,?,?)');
[['ayesha', 'DEMO DAY', 'Pitch practice tonight 🎤'], ['raiyan', 'SCRIM TIME', 'Scrims in 10 minutes'],
 ['nusrat', 'NEW CLIP', '1v4 clutch, full video tomorrow'], ['mahi', 'WIP', 'New brand board 🎨']]
  .forEach(([u, label, cap], i) => st.run(ID[u], art('story-' + u + '.svg', label, i + 1, 720, 1280), 'image', cap, now - (i + 1) * H, now + (20 - i) * H));

/* ================= 4. GROUPS ================= */
function group(o) {
  const g = db.prepare(`INSERT INTO groups (name,description,category,privacy,hub,cover,rules,owner_id,created_at) VALUES (?,?,?,?,?,?,?,?,?)`)
    .run(o.name, o.desc, o.cat, o.privacy, o.hub, art('grp-' + o.slug + '.svg', o.name.toUpperCase(), o.i, 1200, 400), o.rules, o.owner, now - 15 * D).lastInsertRowid;
  db.prepare(`INSERT INTO group_members (group_id,user_id,role,status,created_at) VALUES (?,?, 'owner','active',?)`).run(g, o.owner, now - 15 * D);
  (o.members || []).forEach((u) => db.prepare(`INSERT OR IGNORE INTO group_members (group_id,user_id,role,status,created_at) VALUES (?,?,?, 'active',?)`)
    .run(g, u, 'member', now - 10 * D));
  (o.mods || []).forEach((u) => db.prepare(`INSERT OR IGNORE INTO group_members (group_id,user_id,role,status,created_at) VALUES (?,?, 'moderator','active',?)`).run(g, u, now - 9 * D));
  (o.pending || []).forEach((u) => db.prepare(`INSERT OR IGNORE INTO group_members (group_id,user_id,role,status,created_at) VALUES (?,?, 'member','pending',?)`).run(g, u, now - 4 * H));
  return g;
}
const gDhaka = group({ name: 'Dhaka Startup Circle', slug: 'dhaka', desc: 'Weekly discussion group for student founders in Dhaka. Share progress, get feedback, find collaborators.',
  cat: 'Startups', privacy: 'public', hub: 'business', rules: '1. Be useful, not promotional.\n2. Share real numbers when you can.\n3. No spam, no selling.', owner: ID.ayesha,
  members: [ID.shakib, ID.mahi, ID.tahmid, me], mods: [ID.tahmid], i: 0 });
const gFreelance = group({ name: 'Freelance Client Hunt', slug: 'freelance', desc: 'Strategies for finding better clients, writing proposals and getting paid on time.',
  cat: 'Freelancing', privacy: 'public', hub: 'business', rules: '1. No lead selling.\n2. Help before promoting.', owner: ID.mahi,
  members: [ID.arif, ID.shakib, ID.fahim], i: 1 });
const gScrim = group({ name: 'Valorant Scrim Squad', slug: 'valorant', desc: 'Find teammates, organise scrims, review VODs together.',
  cat: 'Esports', privacy: 'public', hub: 'gaming', rules: '1. Show up on time.\n2. No toxicity.\n3. Comms in English or Bangla, just communicate.', owner: ID.raiyan,
  members: [ID.fahim, ID.nusrat, me], i: 2 });
// private group owned by the DEMO USER with two pending requests to approve
const gPrivate = group({ name: 'Demo Private Group', slug: 'private', desc: 'A private group you own — approve or decline the pending join requests from the Manage tab.',
  cat: 'Testing', privacy: 'private', hub: 'general', rules: '1. This group exists so you can test admin/moderation actions.', owner: me,
  members: [ID.zarin], pending: [ID.fahim, ID.arif], i: 3 });

addPost({ user: ID.ayesha, group: gDhaka, at: now - 5 * H, content: 'Weekly check-in 📌 What did you ship this week? I will start: onboarding flow + first 3 paying users.' });
addPost({ user: ID.shakib, group: gDhaka, at: now - 4 * H, content: 'Shipped a landing page and set up analytics. Next week: pricing page.' });
addPost({ user: ID.mahi, group: gFreelance, at: now - 8 * H, content: 'Template that works for me: problem → what I will do → timeline → price → next step. Keep it under one page.' });
addPost({ user: ID.raiyan, group: gScrim, at: now - 6 * H, content: 'Scrim block tonight 9pm. Drop a 🔥 if you are in.' });
addPost({ user: me, group: gPrivate, at: now - 20 * H, content: 'First post inside my own private group — only members can see this.' });

/* ================= 5. COMMUNITIES ================= */
const commOf = (slug) => { const c = db.prepare('SELECT id FROM communities WHERE slug=?').get(slug); return c && c.id; };
const joinComm = (slug, u, role) => { const id = commOf(slug); if (id) db.prepare('INSERT OR IGNORE INTO community_members (community_id,user_id,role,created_at) VALUES (?,?,?,?)').run(id, u, role || 'member', now - 8 * D); };
['entrepreneurs-bangladesh', 'young-founders', 'freelancers-guild', 'web-developers', 'marketing-lab', 'mobile-gamers', 'esports-players', 'pc-master-setup', 'football-fans', 'creator-corner']
  .forEach((slug) => all.forEach((u) => { if (Math.random() > 0.55) joinComm(slug, u); }));
joinComm('entrepreneurs-bangladesh', me);
joinComm('esports-players', me);
joinComm('young-founders', ID.ayesha, 'moderator');
addPost({ user: ID.ayesha, community: commOf('entrepreneurs-bangladesh'), at: now - 3 * H,
  content: 'Question for the group: at what point did you register your business officially? Doing it early vs waiting for revenue?' });
addPost({ user: ID.shakib, community: commOf('web-developers'), at: now - 11 * H,
  content: 'SQLite is genuinely enough for most side projects. Move to Postgres when you have a reason, not before. #technology' });
addPost({ user: ID.nusrat, community: commOf('mobile-gamers'), at: now - 9 * H, content: 'Best budget phone for 90fps right now? Budget around 25k. 🎮' });
addPost({ user: ID.zarin, community: commOf('football-fans'), at: now - 2 * H, content: 'Predictions thread for tonight ⚽ Drop your scoreline.' });

/* ================= 6. EVENTS ================= */
const ev = db.prepare(`INSERT INTO events (title,description,starts_at,mode,location,cover,hub,host_id,created_at) VALUES (?,?,?,?,?,?,?,?,?)`);
const events = [
  ['Young Founders Meetup', 'Casual meetup for student founders: 3 short talks, then open networking. Bring one problem you are stuck on.', now + 4 * D, 'physical', 'Banani, Dhaka', 'business', ID.ayesha],
  ['Freelance Pricing Workshop', 'Live session on packaging services, writing proposals and raising rates without losing clients.', now + 8 * D, 'online', 'Google Meet link shared with attendees', 'business', ID.mahi],
  ['Community Scrim Night', '5v5 Valorant scrims, open to all ranks. Bring a squad or get matched on the night.', now + 2 * D, 'online', 'Discord', 'gaming', ID.raiyan],
  ['PUBGM Community Cup', 'Squad tournament for the community. Free entry, bragging rights only — no betting, no entry fees.', now + 11 * D, 'online', '', 'gaming', ID.nusrat],
  ['Content Creator Hangout', 'Editing tips, gear talk and a feedback round on each other’s recent posts.', now + 6 * D, 'physical', 'Dhanmondi, Dhaka', 'general', ID.zarin],
];
events.forEach(([t, d, at, mode, loc, hub, host], i) => {
  const id = ev.run(t, d, at, mode, loc, art('event-' + i + '.svg', t.toUpperCase(), i + 4, 1200, 500), hub, host, now - 3 * D).lastInsertRowid;
  db.prepare(`INSERT OR IGNORE INTO event_attendees (event_id,user_id,status,created_at) VALUES (?,?, 'going',?)`).run(id, host, now - 3 * D);
  all.forEach((u) => { if (u !== host && Math.random() > 0.6) db.prepare(`INSERT OR IGNORE INTO event_attendees (event_id,user_id,status,created_at) VALUES (?,?,?,?)`)
    .run(id, u, Math.random() > 0.5 ? 'going' : 'interested', now - D); });
});

/* ================= 7. MESSAGES ================= */
function conversation(other, lines) {
  const cid = db.prepare('INSERT INTO conversations (created_at,last_message_at) VALUES (?,?)').run(now - 3 * D, now).lastInsertRowid;
  db.prepare('INSERT INTO conversation_members (conversation_id,user_id,last_read_at) VALUES (?,?,?)').run(cid, me, now - 2 * H);
  db.prepare('INSERT INTO conversation_members (conversation_id,user_id,last_read_at) VALUES (?,?,?)').run(cid, other, now);
  let t = now - lines.length * 20 * 60e3;
  lines.forEach(([who, body]) => {
    db.prepare('INSERT INTO messages (conversation_id,sender_id,body,created_at) VALUES (?,?,?,?)')
      .run(cid, who === 'me' ? me : other, body, t);
    t += 18 * 60e3;
  });
  db.prepare('UPDATE conversations SET last_message_at=? WHERE id=?').run(t, cid);
  return cid;
}
conversation(ID.ayesha, [['them', 'Hey! Saw you joined the Dhaka Startup Circle 👋'], ['me', 'Yes! Just getting started here.'],
  ['them', 'Nice. We do a weekly check-in every Sunday — you should post yours.'], ['them', 'Also, are you coming to the Young Founders Meetup?']]);
conversation(ID.raiyan, [['them', 'You play Valorant?'], ['me', 'Yeah, mostly casually.'],
  ['them', 'We are short one for scrims tonight 9pm. Interested?']]);
conversation(ID.mahi, [['me', 'Loved your post about pricing — can I get that proposal template?'],
  ['them', 'Of course, sending it over tonight 🙌']]);

/* ================= 8. NOTIFICATIONS for the demo user ================= */
db.prepare('DELETE FROM notifications WHERE user_id=?').run(me);
const notif = (actor, type, text, link, ago, read) => db.prepare(
  'INSERT INTO notifications (user_id,actor_id,type,entity_type,entity_id,text,link,is_read,created_at) VALUES (?,?,?,?,?,?,?,?,?)')
  .run(me, actor, type, 'post', posts[16], text, link, read ? 1 : 0, now - ago);
notif(ID.ayesha, 'like', 'Ayesha Siddika reacted to your post', '#/post/' + posts[16], 40 * 60e3, 0);
notif(ID.shakib, 'comment', 'Shakib Al Noman commented on your post', '#/post/' + posts[16], 2 * H, 0);
notif(ID.mahi, 'connect', 'Mahiya Rahman sent you a connection request', '#/network?tab=incoming', 8 * H, 0);
notif(ID.tahmid, 'connect', 'Tahmid Hasan sent you a connection request', '#/network?tab=incoming', 3 * H, 0);
notif(ID.raiyan, 'follow', 'Raiyan Kabir started following you', '#/u/raiyan', 5 * H, 0);
notif(ID.nusrat, 'follow', 'Nusrat Jahan started following you', '#/u/nusrat', 26 * H, 1);
notif(ID.zarin, 'group', 'Fahim Chowdhury requested to join Demo Private Group', '#/group/' + gPrivate, 4 * H, 0);

/* ================= 9. REPORTS for the admin queue ================= */
db.prepare(`INSERT INTO reports (reporter_id,target_type,target_id,reason,details,status,created_at) VALUES (?,?,?,?,?,?,?)`)
  .run(ID.fahim, 'post', posts[4], 'Spam', 'Looks like repeated promotional content.', 'open', now - 6 * H);
db.prepare(`INSERT INTO reports (reporter_id,target_type,target_id,reason,details,status,created_at) VALUES (?,?,?,?,?,?,?)`)
  .run(ID.zarin, 'user', ID.arif, 'Impersonation', 'Profile may be using someone else’s brand name.', 'open', now - 20 * H);
db.prepare(`INSERT INTO reports (reporter_id,target_type,target_id,reason,details,status,created_at) VALUES (?,?,?,?,?,?,?)`)
  .run(ID.mahi, 'comment', 1, 'Harassment', 'Rude reply to a new member.', 'resolved', now - 3 * D);

/* সব ডেমো অ্যাকাউন্টে ফ্ল্যাগশিপ dark থিম */
db.prepare("UPDATE users SET theme='dark'").run();

/* ================= SUMMARY ================= */
const count = (t) => db.prepare(`SELECT COUNT(*) n FROM ${t}`).get().n;
console.log('\n=== GEN-Z HUB DEMO WORLD READY ===');
['users', 'posts', 'post_media', 'comments', 'reactions', 'follows', 'connections', 'stories', 'groups', 'group_members',
 'communities', 'community_members', 'events', 'event_attendees', 'conversations', 'messages', 'notifications', 'saved_items', 'reports']
  .forEach((t) => console.log('  ' + t.padEnd(20) + count(t)));
console.log('\n  Demo login : demo@genzhub.app / Demo12345');
console.log('  Admin login: ' + (process.env.ADMIN_EMAIL || 'admin@genzhub.app') + ' / ' + (process.env.ADMIN_PASSWORD || 'AdminGenz2026'));
console.log('  Everyone else: <username>@demo.genzhub.app / Demo12345\n');
