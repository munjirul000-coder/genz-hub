'use strict';
const bcrypt = require('bcryptjs');
const { db } = require('./db');
const U = require('./util');

const INTERESTS = [
  ['Entrepreneurship', 'business'], ['Startups', 'business'], ['Freelancing', 'business'], ['E-commerce', 'business'],
  ['Marketing', 'business'], ['Sales', 'business'], ['Investing Education', 'business'], ['Business Ideas', 'business'], ['Networking', 'business'],
  ['Mobile Gaming', 'gaming'], ['PC Gaming', 'gaming'], ['Console Gaming', 'gaming'], ['Esports', 'gaming'],
  ['Strategy Games', 'gaming'], ['FPS', 'gaming'], ['Sports Games', 'gaming'],
  ['Technology', 'general'], ['Movies', 'general'], ['Football', 'general'], ['Music', 'general'],
  ['Content Creation', 'general'], ['Education', 'general'], ['Design', 'general'], ['Career Development', 'general'],
];

const COMMUNITIES = [
  ['Entrepreneurs Bangladesh', 'business', 'Business', 'Founders and builders from Bangladesh sharing what actually works.'],
  ['Young Founders', 'business', 'Startups', 'Under-25 founders building their first companies.'],
  ['Freelancers Guild', 'business', 'Freelancing', 'Client hunting, pricing, contracts and remote work talk.'],
  ['Web Developers', 'business', 'Technology', 'Frontend, backend, and everything that ships to production.'],
  ['Marketing Lab', 'business', 'Marketing', 'Organic growth, content strategy and paid experiments.'],
  ['Mobile Gamers', 'gaming', 'Mobile', 'Mobile squads, loadouts, and daily grind talk.'],
  ['Esports Players', 'gaming', 'Esports', 'Competitive players, scrims, and tournament chatter.'],
  ['PC Master Setup', 'gaming', 'PC', 'Builds, benchmarks, and PC gaming discussion.'],
  ['Football Fans', 'general', 'Sports', 'Match nights, transfers and hot takes.'],
  ['Creator Corner', 'general', 'Content Creation', 'Editing, cameras, growth and creative burnout.'],
];

function ensureSeed() {
  const insI = db.prepare('INSERT OR IGNORE INTO interests (name,category) VALUES (?,?)');
  INTERESTS.forEach(([n, c]) => insI.run(n, c));

  const insC = db.prepare('INSERT OR IGNORE INTO communities (name,slug,description,hub,category,created_at) VALUES (?,?,?,?,?,?)');
  COMMUNITIES.forEach(([n, hub, cat, desc]) => insC.run(n, n.toLowerCase().replace(/[^a-z0-9]+/g, '-'), desc, hub, cat, U.now()));

  // admin account (credentials configurable via env) — always ensure correct password
  const adminEmail = (process.env.ADMIN_EMAIL || 'admin@genzhub.app').toLowerCase();
  const adminPass = process.env.ADMIN_PASSWORD || 'AdminGenz2026';
  let admin = db.prepare('SELECT * FROM users WHERE email=?').get(adminEmail);
  const hashed = bcrypt.hashSync(adminPass, 12);
  if (!admin) {
    const info = db.prepare(`INSERT INTO users (username,email,password_hash,full_name,dob,role,onboarded,bio,in_business,in_gaming,created_at,last_seen)
      VALUES (?,?,?,?,?, 'admin',1,?,1,1,?,?)`).run('genzadmin', adminEmail, hashed, 'Gen-Z Hub Admin', '2000-01-01',
      'Platform moderation & safety.', U.now(), U.now());
    admin = db.prepare('SELECT * FROM users WHERE id=?').get(info.lastInsertRowid);
  } else {
    // An existing account can be promoted safely when the owner explicitly sets
    // ADMIN_EMAIL in the deployment environment.
    db.prepare("UPDATE users SET role='admin', onboarded=1, status='active' WHERE id=?").run(admin.id);
    if (admin.password_hash !== hashed) {
      // Update password if it was changed via env (e.g. after switching from generateValue)
      db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hashed, admin.id);
    }
    admin = db.prepare('SELECT * FROM users WHERE id=?').get(admin.id);
  }

  if (db.prepare('SELECT COUNT(*) n FROM users').get().n > 1) return; // demo content only on a fresh database

  const demoPass = bcrypt.hashSync('GenzDemo123', 10);
  const people = [
    ['rafi', 'Rafi Ahmed', 'rafi@demo.genzhub.app', 'Building a SaaS for local shops. Learning in public.', 'Dhaka, BD', 1, 0, 'Founder', ['Startups', 'Entrepreneurship', 'Technology']],
    ['nabila', 'Nabila Karim', 'nabila@demo.genzhub.app', 'Freelance brand designer. 40+ projects delivered.', 'Chattogram, BD', 1, 0, 'Designer', ['Freelancing', 'Design', 'Marketing']],
    ['tanvir', 'Tanvir Hasan', 'tanvir@demo.genzhub.app', 'Competitive FPS player. Looking for a serious squad.', 'Sylhet, BD', 0, 1, '', ['Esports', 'FPS', 'PC Gaming']],
    ['sadia', 'Sadia Noor', 'sadia@demo.genzhub.app', 'CS student. Frontend dev by night, gamer on weekends.', 'Dhaka, BD', 1, 1, 'Developer', ['Technology', 'Mobile Gaming', 'Education']],
    ['imran', 'Imran Chowdhury', 'imran@demo.genzhub.app', 'Ecommerce operator. Ads, funnels, retention.', 'Khulna, BD', 1, 0, 'Marketer', ['E-commerce', 'Marketing', 'Sales']],
    ['jisan', 'Jisan Rahman', 'jisan@demo.genzhub.app', 'Mobile gaming content creator. Clips daily.', 'Rajshahi, BD', 0, 1, '', ['Mobile Gaming', 'Content Creation', 'Esports']],
  ];
  const insU = db.prepare(`INSERT INTO users (username,email,password_hash,full_name,dob,bio,location,in_business,in_gaming,business_role,onboarded,created_at,last_seen,fav_games,platform)
    VALUES (?,?,?,?,?,?,?,?,?,?,1,?,?,?,?)`);
  const ids = {};
  people.forEach(([un, name, email, bio, loc, biz, gam, role, ints], i) => {
    const info = insU.run(un, email, demoPass, name, '2003-05-1' + i, bio, loc, biz, gam, role, U.now() - (i + 1) * 86400000, U.now(),
      gam ? 'Valorant, PUBG Mobile, FIFA' : '', gam ? (i % 2 ? 'PC' : 'Mobile') : '');
    ids[un] = info.lastInsertRowid;
    ints.forEach((n) => {
      const it = db.prepare('SELECT id FROM interests WHERE name=?').get(n);
      if (it) db.prepare('INSERT OR IGNORE INTO user_interests (user_id,interest_id) VALUES (?,?)').run(ids[un], it.id);
    });
  });

  const f = db.prepare('INSERT OR IGNORE INTO follows (follower_id,following_id,created_at) VALUES (?,?,?)');
  const names = Object.values(ids);
  names.forEach((a) => names.forEach((b) => { if (a !== b && Math.random() > 0.45) f.run(a, b, U.now()); }));

  const cms = db.prepare('SELECT * FROM communities').all();
  const insCM = db.prepare('INSERT OR IGNORE INTO community_members (community_id,user_id,role,created_at) VALUES (?,?,?,?)');
  cms.forEach((c) => names.forEach((u) => { if (Math.random() > 0.6) insCM.run(c.id, u, 'member', U.now()); }));

  const gInfo = db.prepare(`INSERT INTO groups (name,description,category,privacy,hub,rules,owner_id,created_at) VALUES (?,?,?,?,?,?,?,?)`);
  const demoGroups = [
    ['Dhaka Startup Circle', 'Weekly discussion group for founders in Dhaka.', 'Startups', 'public', 'business', '1. Be useful.\n2. No spam.\n3. Share real numbers when you can.', ids.rafi],
    ['Freelance Client Hunt', 'Share strategies for finding better clients.', 'Freelancing', 'public', 'business', '1. No lead selling.\n2. Help before promoting.', ids.nabila],
    ['Valorant Scrim Squad', 'Find teammates and organise scrims.', 'Esports', 'public', 'gaming', '1. Show up on time.\n2. No toxicity.', ids.tanvir],
  ];
  demoGroups.forEach((row) => {
    const info = gInfo.run(...row, U.now());
    db.prepare(`INSERT INTO group_members (group_id,user_id,role,status,created_at) VALUES (?,?, 'owner','active',?)`).run(info.lastInsertRowid, row[6], U.now());
    names.forEach((u) => { if (u !== row[6] && Math.random() > 0.55) db.prepare(`INSERT OR IGNORE INTO group_members (group_id,user_id,role,status,created_at) VALUES (?,?, 'member','active',?)`).run(info.lastInsertRowid, u, U.now()); });
  });

  const posts = [
    [ids.rafi, 'Shipped the first paid version of my inventory app today. 3 shops signed up in the first week. Slow, but real. #startups #buildinpublic', 'business', 'post', 'Startups'],
    [ids.nabila, 'Raised my freelance rate by 40% and lost exactly zero clients. Lesson: price by outcome, not by hours. #freelancing', 'business', 'post', 'Freelancing'],
    [ids.imran, 'Retention beats acquisition. Our repeat-purchase rate went from 12% to 27% just by fixing the post-order emails. #ecommerce #marketing', 'business', 'post', 'E-commerce'],
    [ids.rafi, 'Looking for a co-founder (technical) for a logistics tool. I handle sales and ops. Equity split, remote, Dhaka preferred. DM if interested.', 'business', 'collab', 'Networking'],
    [ids.nabila, 'Looking for a developer to partner on a portfolio-builder side project. I do the design, you do the code. #collaboration', 'business', 'collab', 'Technology'],
    [ids.tanvir, 'Ranked grind done for the week. Immortal 1 finally. Aim trainer 20 min a day genuinely works. #esports #fps', 'gaming', 'post', 'Esports'],
    [ids.jisan, 'Mobile players: 4-finger claw took me two weeks to get used to and it changed everything. #mobilegaming', 'gaming', 'post', 'Mobile Gaming'],
    [ids.tanvir, 'LF teammates for a 5-stack. Need a controller main and a sentinel. Practice Sun/Tue/Thu 9pm. Serious players only.', 'gaming', 'team', 'Esports'],
    [ids.sadia, 'Built my first full-stack app this month. The backend was scarier in my head than in reality. #technology', 'general', 'post', ''],
    [ids.jisan, 'Match night. Who are we backing tonight? #football', 'general', 'post', ''],
    [ids.sadia, 'Study plan that finally worked for me: 50 min focus, 10 min walk, no phone in the room. #education', 'general', 'post', ''],
  ];
  const insP = db.prepare('INSERT INTO posts (user_id,content,hub,kind,topic,privacy,created_at) VALUES (?,?,?,?,?,?,?)');
  posts.forEach((p, i) => {
    const info = insP.run(p[0], p[1], p[2], p[3], p[4], 'public', U.now() - (posts.length - i) * 3600000);
    U.linkHashtags(info.lastInsertRowid, p[1]);
    names.forEach((u) => { if (u !== p[0] && Math.random() > 0.5) db.prepare('INSERT OR IGNORE INTO reactions (post_id,user_id,type,created_at) VALUES (?,?,?,?)').run(info.lastInsertRowid, u, ['like', 'fire', 'clap', 'mind'][Math.floor(Math.random() * 4)], U.now()); });
  });
  const firstPost = db.prepare('SELECT id,user_id FROM posts ORDER BY id LIMIT 1').get();
  db.prepare('INSERT INTO comments (post_id,user_id,content,created_at) VALUES (?,?,?,?)').run(firstPost.id, ids.nabila, 'Congrats! How did you get the first shop to say yes?', U.now() - 1800000);
  db.prepare('INSERT INTO comments (post_id,user_id,parent_id,content,created_at) VALUES (?,?,?,?,?)').run(firstPost.id, ids.rafi, 1, 'Walked in and offered to set it up free for a week. That was it.', U.now() - 1200000);

  const insE = db.prepare('INSERT INTO events (title,description,starts_at,mode,location,hub,host_id,created_at) VALUES (?,?,?,?,?,?,?,?)');
  insE.run('Young Founders Meetup', 'Casual meetup for student founders: intros, 3 short talks, open networking.', U.now() + 5 * 86400000, 'physical', 'Banani, Dhaka', 'business', ids.rafi, U.now());
  insE.run('Freelance Pricing Workshop', 'Live session on packaging services and raising rates without losing clients.', U.now() + 9 * 86400000, 'online', '', 'business', ids.nabila, U.now());
  insE.run('Community Scrim Night', '5v5 scrims, open to all skill levels. Bring a squad or get matched.', U.now() + 3 * 86400000, 'online', '', 'gaming', ids.tanvir, U.now());

  console.log('[seed] demo data created. Demo login: rafi@demo.genzhub.app / GenzDemo123');
}

module.exports = { ensureSeed };
