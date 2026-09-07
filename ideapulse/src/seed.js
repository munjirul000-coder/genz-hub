'use strict';

// Seed script.
//   node src/seed.js          → create the admin account (if missing)
//   node src/seed.js --demo   → also insert realistic demo submissions
//
// The admin account is also auto-created on server boot when ADMIN_EMAIL and
// ADMIN_PASSWORD are provided. Demo data is OPTIONAL and clearly fictional.

const { db } = require('./db');
const { hashPassword } = require('./security');
const config = require('./config');
const text = require('./text');

function iso(daysAgo, hour = 12) {
  const d = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
  d.setUTCHours(hour, 0, 0, 0);
  return d.toISOString();
}

function ensureAdmin() {
  const email = config.ADMIN_EMAIL || 'admin@ideapulse.app';
  const password = config.ADMIN_PASSWORD || 'ideapulse-admin';
  const existing = db.prepare('SELECT id FROM admin_users WHERE email = ?').get(email);
  if (existing) {
    console.log(`ℹ️  Admin already exists: ${email}`);
    return;
  }
  db.prepare('INSERT INTO admin_users (email, password_hash, role, created_at) VALUES (?,?,?,?)').run(
    email,
    hashPassword(password),
    'admin',
    new Date().toISOString()
  );
  console.log(`✅ Admin created: ${email}`);
  console.log(`   (password from ADMIN_PASSWORD env var)`);
}

function seedDemo() {
  const count = db.prepare('SELECT COUNT(*) AS c FROM submissions').get().c;
  if (count > 0) {
    console.log(`ℹ️  ${count} submissions already exist — skipping demo seed (use --fresh? no; wipe data/ dir to reset).`);
    return;
  }

  // [problem, desired_solution, category, location, daysAgo, hour]
  const demos = [
    // ── Organic / trusted food cluster ────────────────────────────────────────
    ["It's really hard to find genuinely organic food in my area — the stores label things organic but I don't trust it.", 'A trusted service that delivers certified organic food at reasonable prices.', 'food', 'Dhaka', 118, 10],
    ["I don't trust whether the food sold as organic is actually organic.", 'A platform that verifies farms and shows proof of certification for every product.', 'food', 'Dhaka', 105, 15],
    ['I wish there was a reliable organic food delivery company near me.', 'Weekly organic produce boxes sourced from verified local farms.', 'food', 'Chattogram', 96, 9],
    ['Good organic food is difficult to find, and when I do find it, it is very expensive.', 'A membership that makes organic staples affordable by buying directly from farmers.', 'food', 'Sylhet', 84, 18],
    ['I cannot easily know if the vegetables I buy online are actually fresh and organic.', 'Live farm-to-door tracking with freshness guarantees for organic vegetables.', 'food', 'Dhaka', 60, 11],
    ['I want to eat organic but there is no single place that lists genuine organic sellers.', 'A directory of verified organic sellers with ratings and certifications.', 'food', 'Rajshahi', 41, 13],
    ['Organic groceries near me are always sold out by the time I get there.', 'A subscription that reserves organic groceries for me every week.', 'food', 'Dhaka', 20, 17],
    ['Finding trustworthy organic baby food is a constant struggle.', 'Curated organic baby food with transparent sourcing and lab reports.', 'food', 'Chattogram', 9, 8],

    // ── Education / practical skills cluster ─────────────────────────────────
    ['I need affordable practical courses that teach real-world skills, not just theory.', 'Short project-based courses with real assignments and feedback.', 'education', 'Dhaka', 112, 14],
    ['University taught me theory but not how to actually do a job.', 'Hands-on bootcamps that simulate real work and build a portfolio.', 'education', 'Chattogram', 99, 10],
    ['Practical skills like freelancing and marketing are expensive to learn.', 'Affordable mentorship sessions with people who actually work in the field.', 'education', 'Khulna', 80, 16],
    ['I want to learn coding but every course is too long and too expensive.', 'Bite-sized coding tracks focused on building one real project.', 'education', 'Dhaka', 63, 9],
    ['There is no clear path from learning a skill to getting paid for it.', 'A platform that connects finished course projects to real clients.', 'education', 'Sylhet', 33, 15],
    ['It is hard to find trusted local tutors for practical subjects.', 'A vetted marketplace for local tutors with real reviews.', 'education', 'Dhaka', 12, 12],

    // ── Local shopping cluster ───────────────────────────────────────────────
    ["I can't easily find reliable local products online — most marketplaces are full of fake listings.", 'A marketplace that verifies local sellers and their products.', 'shopping', 'Dhaka', 108, 11],
    ['Small local shops have great products but no way to sell online.', 'A simple storefront tool for local shops to sell with delivery.', 'shopping', 'Chattogram', 90, 14],
    ['I want to support local businesses but I cannot discover them easily.', 'A local-first shopping app that shows verified nearby sellers.', 'shopping', 'Rajshahi', 58, 10],
    ['Ordering from local artisans is confusing and slow across different pages.', 'One checkout for many local artisans with tracked delivery.', 'shopping', 'Dhaka', 26, 16],
    ['Returning items bought from small online sellers is a nightmare.', 'A fair, simple returns process for small online stores.', 'shopping', 'Sylhet', 7, 13],

    // ── Small business tools cluster ─────────────────────────────────────────
    ['Small businesses need simple tools without expensive subscriptions.', 'A single affordable toolkit for invoicing, inventory and customers.', 'business', 'Dhaka', 104, 10],
    ['Every business app wants a monthly fee and I end up paying for ten tools.', 'A pay-as-you-go suite that only charges for what I use.', 'business', 'Chattogram', 77, 15],
    ['Keeping track of clients and invoices across apps is messy.', 'One dashboard that unifies clients, invoices and follow-ups.', 'business', 'Dhaka', 45, 9],
    ['As a freelancer, chasing unpaid invoices is the worst part of my week.', 'Automated invoice reminders that are polite but persistent.', 'business', 'Khulna', 18, 17],
    ['I run a small shop and cannot afford expensive accounting software.', 'A free starter accounting tool designed for tiny businesses.', 'business', 'Rajshahi', 5, 11],

    // ── Commute / transport cluster ──────────────────────────────────────────
    ['My daily commute is unpredictable because of traffic and bad route info.', 'A commute app that predicts delays and suggests the fastest route in real time.', 'transportation', 'Dhaka', 100, 8],
    ['Public transport timings are never accurate so I am always late.', 'Live tracking of buses and trains with accurate arrival times.', 'transportation', 'Dhaka', 74, 18],
    ['There is no easy way to carpool safely with verified people.', 'A verified carpool matching service for daily commuters.', 'transportation', 'Chattogram', 39, 10],
    ['Parking near my office is impossible to find in the morning.', 'An app that shows available parking spots in real time.', 'transportation', 'Dhaka', 10, 9],

    // ── Healthcare appointments cluster ──────────────────────────────────────
    ['Booking a doctor appointment takes forever with phone calls and queues.', 'A simple online booking system for clinics with live availability.', 'healthcare', 'Dhaka', 92, 10],
    ['I never know which doctor to trust for a specific problem.', 'A verified directory of doctors with real patient reviews.', 'healthcare', 'Chattogram', 66, 14],
    ['Getting medicine delivered when I am sick is a struggle.', 'Fast pharmacy delivery with prescription verification.', 'healthcare', 'Dhaka', 30, 12],
    ['Mental health help is too expensive and hard to find locally.', 'Affordable online counselling sessions with verified therapists.', 'healthcare', 'Sylhet', 4, 16],

    // ── Home / cleaning cluster ──────────────────────────────────────────────
    ['Finding a reliable home cleaning service is hit or miss.', 'A vetted cleaning service with insured staff and easy booking.', 'home', 'Dhaka', 88, 11],
    ['Home repairs are hard to schedule — workers never show up on time.', 'An app that lets me book verified repair workers with time slots.', 'home', 'Chattogram', 52, 13],
    ['I hate spending my weekends on laundry and cleaning.', 'A cheap weekly cleaning and laundry bundle for busy people.', 'home', 'Dhaka', 22, 10],

    // ── Subscription fatigue cluster ─────────────────────────────────────────
    ['I am paying for too many subscriptions and losing track of them.', 'One app that tracks all subscriptions and cancels the ones I do not use.', 'finance', 'Dhaka', 70, 15],
    ['Subscriptions renew automatically and I only notice after being charged.', 'Clear renewal alerts before any subscription charges me again.', 'finance', 'Chattogram', 36, 9],
    ['Managing a personal budget feels like a chore with spreadsheets.', 'An automatic budget app that categorizes spending from my bank.', 'finance', 'Dhaka', 8, 12],

    // ── Recent singletons (mix) ──────────────────────────────────────────────
    ['I waste hours scrolling but never find content I actually like.', 'A feed that learns my taste and shows only what I care about.', 'entertainment', 'Dhaka', 3, 19],
    ['My phone battery dies by afternoon no matter what I do.', 'A smart battery saver that adapts to my usage.', 'technology', 'Chattogram', 2, 11],
    ['There is no good way to split bills fairly with friends.', 'A simple bill-splitting app that settles debts automatically.', 'finance', 'Dhaka', 1, 14],
    ['I want to learn to cook healthy meals but recipes are overwhelming.', 'Step-by-step short video recipes for quick healthy meals.', 'food', 'Sylhet', 1, 18],
  ];

  const insert = db.prepare(
    `INSERT INTO submissions (id, problem, desired_solution, category, broad_location, keywords, created_at, updated_at)
     VALUES (?,?,?,?,?,?,?,?)`
  );

  let n = 0;
  for (const [problem, solution, category, location, daysAgo, hour] of demos) {
    const id = `DEMO-${String(++n).padStart(4, '0')}`;
    const categoryFinal = category || text.categorize(problem);
    const keywords = text.extractKeywords(problem + ' ' + solution);
    const ts = iso(daysAgo, hour);
    insert.run(id, problem, solution, categoryFinal, location, JSON.stringify(keywords), ts, ts);
  }

  // eslint-disable-next-line global-require
  const { rebuildClusters } = require('./clusters');
  const res = rebuildClusters(db);
  console.log(`✅ Seeded ${n} demo submissions. Rebuilt ${res.clusters} opportunity clusters.`);
}

ensureAdmin();
if (process.argv.includes('--demo')) seedDemo();
else console.log('ℹ️  Run with --demo to also insert realistic demo submissions.');
