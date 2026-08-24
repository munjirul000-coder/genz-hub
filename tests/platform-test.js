'use strict';
/* Gen-Z Hub — platform v2 end-to-end API test:
   hubs · marketplace (store→product→cart→checkout→order→review) · work (job→proposal→hire)
   · arena (XP, missions, badges, leaderboard) · challenges · polls · ideas · ads · admin. */

const BASE = process.env.BASE || 'http://127.0.0.1:10071';
let pass = 0, fail = 0;
const ok = (cond, msg, extra) => {
  if (cond) { pass++; console.log('  ok   ' + msg + (extra ? '  ' + extra : '')); }
  else { fail++; console.log('  FAIL ' + msg + (extra ? '  ' + extra : '')); }
};

function client() {
  let cookie = '';
  return async function api(path, opts = {}) {
    const res = await fetch(BASE + path, {
      method: opts.method || (opts.body ? 'POST' : 'GET'),
      headers: {
        'X-GenZ-Client': '1',
        ...(opts.body ? { 'content-type': 'application/json' } : {}),
        ...(cookie ? { cookie } : {}),
      },
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    });
    const sc = res.headers.getSetCookie ? res.headers.getSetCookie() : [];
    if (sc.length) cookie = sc.map((c) => c.split(';')[0]).join('; ');
    const text = await res.text();
    let json; try { json = JSON.parse(text); } catch (e) { json = { raw: text.slice(0, 120) }; }
    return { status: res.status, ...json };
  };
}

async function signup(api, tag) {
  const u = `t${tag}${Math.floor(Math.random() * 9000 + 1000)}`;
  const r = await api('/api/auth/signup', {
    body: { full_name: `Test ${tag}`, username: u, email: `${u}@test.io`, password: 'passw0rd1', dob: '2004-01-01' },
  });
  return { username: u, status: r.status, user: r.user };
}

(async () => {
  console.log('\n===== SETUP =====');
  const seller = client(); const buyer = client(); const admin = client();
  const s1 = await signup(seller, 'sell'); const s2 = await signup(buyer, 'buy');
  ok(s1.status === 200 && s2.status === 200, 'two fresh users created', `${s1.username} / ${s2.username}`);

  console.log('\n===== HUBS =====');
  let r = await seller('/api/hubs');
  ok(r.status === 200 && r.hubs.length >= 12, `hub directory returns ${r.hubs ? r.hubs.length : 0} hubs`);
  const gaming = r.hubs.find((h) => h.slug === 'gaming');
  r = await seller(`/api/hubs/gaming/join`, { body: {} });
  ok(r.joined === true, 'join a hub');
  r = await seller('/api/hubs/gaming');
  ok(r.status === 200 && r.hub.joined === true, 'hub page shows joined state', `${r.hub.members} members`);
  r = await seller('/api/hubs/does-not-exist');
  ok(r.status === 404, 'unknown hub → 404');

  console.log('\n===== MARKETPLACE =====');
  r = await seller('/api/market/stores', { body: { name: 'Test Sneaker Lab', tagline: 'Kicks for Gen-Z' } });
  ok(r.status === 200 && r.store, 'seller creates a store');
  const storeSlug = r.store && r.store.slug;
  r = await seller('/api/market/products', {
    body: { title: 'Volt Runner Sneakers', price: 2500, compare_at: 3200, stock: 5, category: 'Sneakers', hub_slug: 'fashion', description: 'Light, fast, original.' },
  });
  ok(r.status === 200 && r.product.price === 2500, 'seller lists a product', `৳${r.product && r.product.price}`);
  const productId = r.product && r.product.id;

  r = await buyer('/api/market/products');
  ok(r.products.some((p) => p.id === productId), 'product appears in public catalogue');
  r = await buyer(`/api/market/products/${productId}`);
  ok(r.status === 200 && r.product.store_name, 'product detail loads with store info');

  r = await seller('/api/market/cart', { body: { product_id: productId, qty: 1 } });
  ok(r.status === 400, 'seller cannot buy their own product');

  r = await buyer('/api/market/cart', { body: { product_id: productId, qty: 2 } });
  ok(r.count === 2 && r.subtotal === 5000, 'buyer adds 2 to cart', `subtotal ৳${r.subtotal}`);
  r = await buyer('/api/market/cart', { body: { product_id: productId, qty: 99 } });
  ok(r.status === 400 || r.count <= 5, 'stock limit enforced');

  r = await buyer(`/api/market/wishlist/${productId}`, { body: {} });
  ok(r.saved === true, 'wishlist add');
  r = await buyer('/api/market/wishlist');
  ok(r.products.length === 1, 'wishlist lists the product');

  r = await buyer('/api/market/checkout', { body: { ship_name: 'Buyer', ship_phone: '01700000000', ship_address: 'Road 1, Dhanmondi', ship_city: 'Dhaka', payment_method: 'cod' } });
  ok(r.status === 200 && r.order && r.order.code, 'checkout creates an order', r.order && r.order.code);
  const orderCode = r.order && r.order.code;
  ok(r.order && r.order.payment_status === 'unpaid' && r.order.payment_method === 'cod', 'COD order is honestly marked unpaid');

  r = await buyer('/api/market/checkout', { body: { ship_name: 'x', ship_phone: '1', ship_address: 'y', payment_method: 'gateway' } });
  ok(r.status === 400 || r.status === 503, 'gateway checkout refuses without a configured provider', String(r.status));

  r = await buyer('/api/market/cart');
  ok(r.count === 0, 'cart is emptied after checkout');
  r = await buyer(`/api/market/products/${productId}`);
  ok(r.product.stock === 3, 'stock decremented by the order', `stock=${r.product.stock}`);

  r = await seller('/api/market/seller/summary');
  ok(r.orders.length >= 1 && r.stats.revenue > 0, 'seller dashboard shows the order', `৳${r.stats.revenue}`);
  const itemId = r.orders[0] && r.orders[0].id;
  r = await seller(`/api/market/seller/orders/${itemId}/status`, { body: { status: 'shipped' } });
  ok(r.ok === true && r.order_status === 'shipped', 'seller updates fulfilment status');

  r = await buyer(`/api/market/products/${productId}/review`, { body: { rating: 5, body: 'Great quality!' } });
  ok(r.ok === true, 'buyer can review a purchased product');
  r = await seller(`/api/market/products/${productId}/review`, { body: { rating: 1 } });
  ok(r.status === 403, 'non-buyer cannot review');
  r = await buyer(`/api/market/products/${productId}`);
  ok(r.product.rating === 5 && r.product.rating_count === 1, 'rating aggregates onto the product');

  r = await buyer(`/api/market/orders/${orderCode}/cancel`, { body: {} });
  ok(r.status === 400 || r.ok, 'cancel respects order state', String(r.status));

  console.log('\n===== WORK =====');
  r = await buyer('/api/work/jobs', { body: { title: 'Need a logo for my clothing brand', category: 'Logo design', description: 'Modern, minimal, streetwear vibe.', budget_min: 2000, budget_max: 5000, skills: 'Illustrator, Branding' } });
  ok(r.status === 200 && r.job, 'client posts a job');
  const jobId = r.job && r.job.id;
  ok(typeof r.free_left === 'number', 'free posting quota tracked', `free left: ${r.free_left}`);

  r = await seller('/api/work/freelancer', { method: 'PUT', body: { headline: 'Brand designer', skills: 'Illustrator, Branding, Logo', hourly: 800, availability: 'open', about: 'I design brands.' } });
  ok(r.ok === true, 'freelancer profile saved');
  r = await buyer('/api/work/freelancers');
  ok(r.freelancers.length >= 1, 'freelancer appears in talent search');

  r = await seller(`/api/work/jobs/${jobId}/proposals`, { body: { cover: 'I have designed 20+ streetwear logos, here is my plan…', bid: 3500, days: 5 } });
  ok(r.ok === true, 'freelancer sends a proposal');
  r = await seller(`/api/work/jobs/${jobId}/proposals`, { body: { cover: 'Trying to apply twice with enough characters', bid: 1 } });
  ok(r.status === 409, 'duplicate proposal rejected');
  r = await buyer(`/api/work/jobs/${jobId}`);
  ok(r.proposals.length === 1, 'client sees proposals');
  const proposalId = r.proposals[0].id;
  r = await seller(`/api/work/jobs/${jobId}`);
  ok(r.proposals.length === 0, 'other users cannot read proposals (permission boundary)');
  r = await buyer(`/api/work/proposals/${proposalId}/status`, { body: { status: 'hired' } });
  ok(r.ok === true, 'client hires the freelancer');
  r = await buyer(`/api/work/jobs/${jobId}`);
  ok(r.job.status === 'filled', 'job auto-closes when filled');

  r = await buyer('/api/work/packages?kind=job');
  ok(r.packages.length >= 3 && r.payment, 'job packages are listed with payment status', `${r.packages.length} packages, gateway configured: ${r.payment.configured}`);
  r = await buyer(`/api/work/packages/${r.packages[0].id}/buy`, { body: {} });
  ok(r.purchase && r.purchase.payment_status === 'pending', 'package purchase stays pending without a gateway (no fake payments)');

  console.log('\n===== ARENA / XP =====');
  r = await seller('/api/arena/me');
  ok(r.stats && r.stats.xp > 0, 'XP accumulated from real actions', `xp=${r.stats && r.stats.xp} level=${r.stats && r.stats.level}`);
  ok(r.missions.length >= 5, `daily missions listed (${r.missions.length})`);
  const done = r.missions.find((m) => m.progress >= m.target && !m.claimed);
  if (done) {
    const c = await seller(`/api/arena/missions/${done.id}/claim`, { body: {} });
    ok(c.ok === true, 'completed mission can be claimed', `+${c.reward} XP`);
    const again = await seller(`/api/arena/missions/${done.id}/claim`, { body: {} });
    ok(again.status === 400, 'mission cannot be claimed twice');
  } else ok(true, 'no mission ready to claim yet (skipped)');

  r = await seller('/api/arena/badges');
  ok(r.badges.length >= 10, `badge catalogue (${r.badges.length}) with earned flags`);
  ok(r.badges.some((b) => b.earned), 'at least one badge auto-unlocked by real activity');
  r = await seller('/api/arena/leaderboard?board=builders');
  ok(r.status === 200 && Array.isArray(r.rows), 'leaderboard returns ranked rows', `${r.rows.length} entries`);

  console.log('\n===== CHALLENGES =====');
  r = await seller('/api/challenges', { body: { title: 'Seven day design sprint', category: 'Design', description: 'Post one design per day.', days: 7, xp_reward: 120 } });
  ok(r.status === 200 && r.challenge.slug, 'challenge created');
  const chSlug = r.challenge.slug;
  r = await buyer(`/api/challenges/${chSlug}/entries`, { body: { title: 'My sprint', body: 'Here is my entry with a real description.' } });
  ok(r.entry && r.xp && r.xp.awarded > 0, 'entry submitted and XP awarded');
  const entryId = r.entry.id;
  r = await buyer(`/api/challenges/entries/${entryId}/vote`, { body: {} });
  ok(r.status === 400, 'self-voting blocked');
  r = await seller(`/api/challenges/entries/${entryId}/vote`, { body: {} });
  ok(r.voted === true && r.votes === 1, 'other users can vote');
  r = await seller(`/api/challenges/entries/${entryId}/vote`, { body: {} });
  ok(r.voted === false && r.votes === 0, 'vote toggles off');

  console.log('\n===== POLLS =====');
  r = await seller('/api/polls', { body: { question: 'Which game do you play most?', options: ['Valorant', 'PUBG', 'FIFA'], hours: 48 } });
  ok(r.poll && r.poll.options.length === 3, 'poll created with options');
  const pollId = r.poll.id;
  r = await buyer(`/api/polls/${pollId}/vote`, { body: { option_id: r.poll.options[0].id } });
  ok(r.poll.total_votes === 1 && r.poll.options[0].pct === 100, 'vote counted with percentages');
  r = await buyer(`/api/polls/${pollId}/vote`, { body: { option_id: 999999 } });
  ok(r.status === 400 || r.status === 409, 'invalid/duplicate vote rejected');

  console.log('\n===== IDEA ARENA =====');
  r = await buyer('/api/ideas', { body: { title: 'An app that helps students swap notes', body: 'Students upload notes and earn credits.', looking_for: 'Developer, Designer', stage: 'idea' } });
  ok(r.idea && r.idea.id, 'idea published');
  const ideaId = r.idea.id;
  r = await seller(`/api/ideas/${ideaId}/support`, { body: {} });
  ok(r.supported === true && r.supports === 1, 'idea support works');
  r = await seller(`/api/ideas/${ideaId}/comments`, { body: { body: 'I can build the backend for this.' } });
  ok(r.ok === true, 'idea feedback comment');
  r = await buyer(`/api/ideas/${ideaId}`);
  ok(r.comments.length === 1 && r.idea.supports === 1, 'idea detail shows support + comments');

  console.log('\n===== ADS =====');
  r = await seller('/api/ads/packages');
  ok(r.packages.length >= 3, `ad packages listed (${r.packages.length})`);
  r = await seller('/api/ads', { body: { title: 'Volt Runner launch', body: 'New sneakers for the squad', cta_url: 'https://example.com', target_hubs: ['fashion', 'gaming'], package_id: r.packages[0].id } });
  ok(r.campaign && r.campaign.status === 'pending', 'campaign created and queued for review');
  const adId = r.campaign.id;
  r = await buyer('/api/ads/serve?hub=fashion');
  ok(!r.ad || r.ad.id !== adId, 'a pending campaign is never served');

  console.log('\n===== ADMIN =====');
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@genzhub.app';
  const adminPass = process.env.ADMIN_PASSWORD || 'AdminGenz2026';
  r = await admin('/api/auth/login', { body: { identifier: adminEmail, password: adminPass } });
  if (r.status !== 200) {
    console.log('  ..   admin login skipped (set ADMIN_PASSWORD to run admin tests)');
  } else {
    r = await admin('/api/admin/overview');
    ok(r.marketplace && r.work && r.arena, 'admin overview aggregates every section',
      `stores=${r.marketplace.stores} jobs=${r.work.jobs} ideas=${r.arena.ideas}`);
    r = await admin(`/api/admin/ads/${adId}/review`, { body: { status: 'active' } });
    ok(r.ok === true, 'admin approves an ad campaign');
    let servedOk = false;
    for (let i = 0; i < 25 && !servedOk; i++) {
      const served = await buyer('/api/ads/serve?hub=fashion');
      if (served.ad && served.ad.id === adId) servedOk = true;
    }
    ok(servedOk, 'approved campaign is served to the targeted hub');
    r = await admin('/api/admin/packages');
    const pk = r.packages.find((p) => p.kind === 'job');
    r = await admin(`/api/admin/packages/${pk.id}`, { method: 'PATCH', body: { price: 149, quantity: 7 } });
    ok(r.package.price_cents === 14900 && r.package.quantity === 7, 'admin can change package price/quantity (nothing hard-coded)');
    r = await admin('/api/admin/settings', { method: 'PUT', body: { job_free_quota: '3' } });
    ok(r.settings.job_free_quota === '3', 'admin can change platform settings');
    const hubSlug = 'test-hub-' + Math.floor(Math.random() * 100000);
    r = await admin('/api/admin/hubs', { body: { name: 'Test Hub', slug: hubSlug, emoji: '🧪', tagline: 'Created by the test suite' } });
    ok(r.hub && r.hub.slug === hubSlug, 'admin can create a new interest hub');
    await admin(`/api/admin/hubs/${r.hub.id}`, { method: 'PATCH', body: { active: 0 } });
    r = await admin('/api/admin/logs');
    ok(r.logs.length >= 3, `admin actions are audit-logged (${r.logs.length} entries)`);
    r = await buyer('/api/admin/overview');
    ok(r.status === 403 || r.status === 401, 'non-admin blocked from admin API');
  }

  console.log('\n===== PERMISSION BOUNDARIES =====');
  r = await seller(`/api/market/products/${productId}`, { method: 'DELETE' });
  ok(r.ok === true, 'owner can delete their product');
  r = await buyer('/api/market/seller/summary');
  ok(r.store === null, 'user without a store gets an empty seller dashboard');
  r = await buyer('/api/market/products', { body: { title: 'No store product', price: 100 } });
  ok(r.status === 400, 'cannot list a product without a store');

  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('ERROR', e); process.exit(1); });
