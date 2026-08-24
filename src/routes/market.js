'use strict';
/* Gen-Z Hub — Marketplace: stores, products, cart, wishlist, checkout, orders, reviews.

   Money is stored in integer poisha (BDT × 100) — never floats.
   Payments: cash-on-delivery works end to end; card/mobile-banking runs through
   src/payments.js, which requires a real gateway to be configured (see PAYMENTS.md).
   Nothing is ever marked "paid" without a provider confirming it. */

const express = require('express');
const { db } = require('../db');
const U = require('../util');
const XP = require('../gamify');
const pay = require('../payments');

const r = express.Router();

const CATEGORIES = ['Fashion', 'Sneakers', 'Gaming', 'Technology', 'Phone accessories', 'Books',
  'Stationery', 'Fitness', 'Sports', 'Creator gear', 'Car accessories', 'Lifestyle', 'Gifts'];

const slugify = (s, extra) => (String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'item')
  + (extra ? '-' + extra : '');

const money = (v) => Math.max(0, Math.round(Number(v || 0) * 100));

function productPayload(p, me) {
  if (!p) return null;
  const images = db.prepare('SELECT url FROM product_images WHERE product_id=? ORDER BY position').all(p.id).map((x) => x.url);
  return {
    ...p,
    images,
    image: images[0] || '',
    price: p.price_cents / 100,
    compare_at: p.compare_at_cents ? p.compare_at_cents / 100 : 0,
    in_wishlist: me ? !!db.prepare('SELECT 1 FROM wishlist_items WHERE user_id=? AND product_id=?').get(me, p.id) : false,
  };
}

/* ---------------------------------------------------------------- catalogue */
r.get('/categories', U.wrap((req, res) => res.json({ categories: CATEGORIES })));

r.get('/products', U.wrap((req, res) => {
  const me = req.user ? req.user.id : 0;
  const where = ["p.status='active'", "s.status='active'"];
  const params = { limit: Math.min(Number(req.query.limit) || 24, 48), offset: Number(req.query.offset) || 0 };
  if (req.query.category) { where.push('p.category=@category'); params.category = String(req.query.category); }
  if (req.query.hub) { where.push('p.hub_slug=@hub'); params.hub = String(req.query.hub); }
  if (req.query.store) { where.push('s.slug=@store'); params.store = String(req.query.store); }
  if (req.query.seller) { where.push('p.seller_id=@seller'); params.seller = Number(req.query.seller); }
  if (req.query.q) { where.push('(p.title LIKE @q OR p.description LIKE @q)'); params.q = '%' + String(req.query.q).slice(0, 60) + '%'; }
  if (req.query.max_price) { where.push('p.price_cents<=@maxp'); params.maxp = money(req.query.max_price); }
  const sort = ({ new: 'p.created_at DESC', price_low: 'p.price_cents ASC', price_high: 'p.price_cents DESC', popular: 'p.sold_count DESC, p.views DESC', rating: 'p.rating DESC' })[req.query.sort] || 'p.featured DESC, p.created_at DESC';
  const rows = db.prepare(`SELECT p.*, s.name AS store_name, s.slug AS store_slug, s.logo AS store_logo
    FROM products p JOIN stores s ON s.id=p.store_id
    WHERE ${where.join(' AND ')} ORDER BY ${sort} LIMIT @limit OFFSET @offset`).all(params);
  res.json({ products: rows.map((p) => productPayload(p, me)), categories: CATEGORIES });
}));

r.get('/products/:id', U.wrap((req, res) => {
  const me = req.user ? req.user.id : 0;
  const p = db.prepare(`SELECT p.*, s.name AS store_name, s.slug AS store_slug, s.logo AS store_logo, s.rating AS store_rating
    FROM products p JOIN stores s ON s.id=p.store_id WHERE p.id=? AND p.status<>'removed'`).get(req.params.id);
  if (!p) return res.status(404).json({ error: 'Product not found.' });
  db.prepare('UPDATE products SET views=views+1 WHERE id=?').run(p.id);
  const reviews = db.prepare(`SELECT pr.*, u.username, u.full_name, u.avatar FROM product_reviews pr
    JOIN users u ON u.id=pr.user_id WHERE pr.product_id=? ORDER BY pr.created_at DESC LIMIT 30`).all(p.id);
  const related = db.prepare(`SELECT p.*, s.name AS store_name, s.slug AS store_slug FROM products p JOIN stores s ON s.id=p.store_id
    WHERE p.category=? AND p.id<>? AND p.status='active' ORDER BY p.created_at DESC LIMIT 6`).all(p.category, p.id);
  res.json({
    product: productPayload(p, me),
    reviews,
    related: related.map((x) => productPayload(x, me)),
    can_review: me ? !!db.prepare(`SELECT 1 FROM order_items oi JOIN orders o ON o.id=oi.order_id
      WHERE o.buyer_id=? AND oi.product_id=?`).get(me, p.id) : false,
  });
}));

/* ---------------------------------------------------------------- stores */
r.get('/stores', U.wrap((req, res) => {
  const rows = db.prepare(`SELECT s.*, u.username, u.full_name, u.avatar,
      (SELECT COUNT(*) FROM products p WHERE p.store_id=s.id AND p.status='active') AS product_count,
      (SELECT COUNT(*) FROM store_follows sf WHERE sf.store_id=s.id) AS followers
    FROM stores s JOIN users u ON u.id=s.owner_id WHERE s.status='active'
    ORDER BY product_count DESC, s.created_at DESC LIMIT 40`).all();
  res.json({ stores: rows });
}));

r.get('/stores/:slug', U.wrap((req, res) => {
  const me = req.user ? req.user.id : 0;
  const s = db.prepare(`SELECT s.*, u.username, u.full_name, u.avatar FROM stores s JOIN users u ON u.id=s.owner_id WHERE s.slug=?`).get(req.params.slug);
  if (!s) return res.status(404).json({ error: 'Store not found.' });
  const products = db.prepare(`SELECT * FROM products WHERE store_id=? AND status='active' ORDER BY created_at DESC LIMIT 40`).all(s.id);
  res.json({
    store: {
      ...s,
      followers: db.prepare('SELECT COUNT(*) c FROM store_follows WHERE store_id=?').get(s.id).c,
      is_following: me ? !!db.prepare('SELECT 1 FROM store_follows WHERE store_id=? AND user_id=?').get(s.id, me) : false,
      is_mine: me === s.owner_id,
    },
    products: products.map((p) => productPayload(p, me)),
  });
}));

r.post('/stores', U.requireAuth, U.rateLimit({ max: 3, windowMs: 24 * 3600 * 1000, key: 'store' }), U.wrap((req, res) => {
  const existing = db.prepare('SELECT * FROM stores WHERE owner_id=?').get(req.user.id);
  if (existing) return res.status(409).json({ error: 'You already have a store.' });
  const name = U.sanitizeText(req.body.name, 60);
  if (name.length < 3) return res.status(400).json({ error: 'Store name must be at least 3 characters.' });
  const slug = slugify(name, String(Date.now()).slice(-4));
  const info = db.prepare(`INSERT INTO stores (owner_id,name,slug,tagline,about,logo,banner,hub_slug,created_at)
    VALUES (?,?,?,?,?,?,?,?,?)`).run(req.user.id, name, slug, U.sanitizeText(req.body.tagline, 120),
    U.sanitizeText(req.body.about, 1200), U.sanitizeText(req.body.logo, 300), U.sanitizeText(req.body.banner, 300),
    U.sanitizeText(req.body.hub_slug, 40), U.now());
  res.json({ store: db.prepare('SELECT * FROM stores WHERE id=?').get(info.lastInsertRowid) });
}));

r.patch('/stores/mine', U.requireAuth, U.wrap((req, res) => {
  const s = db.prepare('SELECT * FROM stores WHERE owner_id=?').get(req.user.id);
  if (!s) return res.status(404).json({ error: 'You do not have a store yet.' });
  const fields = ['tagline', 'about', 'logo', 'banner', 'hub_slug'];
  const set = {}; fields.forEach((f) => { if (req.body[f] !== undefined) set[f] = U.sanitizeText(req.body[f], f === 'about' ? 1200 : 300); });
  if (req.body.name) set.name = U.sanitizeText(req.body.name, 60);
  if (Object.keys(set).length) {
    db.prepare(`UPDATE stores SET ${Object.keys(set).map((k) => `${k}=@${k}`).join(',')} WHERE id=@id`).run({ ...set, id: s.id });
  }
  res.json({ store: db.prepare('SELECT * FROM stores WHERE id=?').get(s.id) });
}));

r.post('/stores/:id/follow', U.requireAuth, U.wrap((req, res) => {
  const s = db.prepare('SELECT * FROM stores WHERE id=?').get(req.params.id);
  if (!s) return res.status(404).json({ error: 'Store not found.' });
  const has = db.prepare('SELECT 1 FROM store_follows WHERE store_id=? AND user_id=?').get(s.id, req.user.id);
  if (has) db.prepare('DELETE FROM store_follows WHERE store_id=? AND user_id=?').run(s.id, req.user.id);
  else db.prepare('INSERT INTO store_follows (user_id,store_id,created_at) VALUES (?,?,?)').run(req.user.id, s.id, U.now());
  res.json({ following: !has });
}));

/* ---------------------------------------------------------------- seller: products */
function requireStore(req, res) {
  const s = db.prepare('SELECT * FROM stores WHERE owner_id=?').get(req.user.id);
  if (!s) { res.status(400).json({ error: 'Create your store first.' }); return null; }
  if (s.status !== 'active') { res.status(403).json({ error: 'Your store is suspended.' }); return null; }
  return s;
}

r.post('/products', U.requireAuth, U.rateLimit({ max: 40, windowMs: 24 * 3600 * 1000, key: 'product' }), U.wrap((req, res) => {
  const store = requireStore(req, res); if (!store) return;
  const title = U.sanitizeText(req.body.title, 120);
  if (title.length < 4) return res.status(400).json({ error: 'Product title must be at least 4 characters.' });
  const price = money(req.body.price);
  if (price <= 0) return res.status(400).json({ error: 'Set a price greater than 0.' });
  const category = CATEGORIES.includes(req.body.category) ? req.body.category : 'Lifestyle';
  const images = Array.isArray(req.body.images) ? req.body.images.filter((u) => typeof u === 'string' && u.startsWith('/uploads/')).slice(0, 6) : [];
  const info = db.prepare(`INSERT INTO products
    (store_id,seller_id,title,slug,description,category,hub_slug,price_cents,compare_at_cents,stock,condition,created_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`).run(store.id, req.user.id, title, slugify(title, String(Date.now()).slice(-4)),
    U.sanitizeText(req.body.description, 4000), category, U.sanitizeText(req.body.hub_slug, 40), price,
    money(req.body.compare_at), Math.max(0, Number(req.body.stock) || 0),
    req.body.condition === 'used' ? 'used' : 'new', U.now());
  const id = info.lastInsertRowid;
  images.forEach((url, i) => db.prepare('INSERT INTO product_images (product_id,url,position) VALUES (?,?,?)').run(id, url, i));
  XP.award(req.user.id, 'product_listed', { refType: 'product', refId: Number(id) });
  res.json({ product: productPayload(db.prepare('SELECT * FROM products WHERE id=?').get(id), req.user.id) });
}));

r.patch('/products/:id', U.requireAuth, U.wrap((req, res) => {
  const p = db.prepare('SELECT * FROM products WHERE id=?').get(req.params.id);
  if (!p) return res.status(404).json({ error: 'Product not found.' });
  if (p.seller_id !== req.user.id && req.user.role !== 'admin') return res.status(403).json({ error: 'Not your product.' });
  const set = { updated_at: U.now() };
  if (req.body.title) set.title = U.sanitizeText(req.body.title, 120);
  if (req.body.description !== undefined) set.description = U.sanitizeText(req.body.description, 4000);
  if (req.body.price !== undefined) set.price_cents = money(req.body.price);
  if (req.body.compare_at !== undefined) set.compare_at_cents = money(req.body.compare_at);
  if (req.body.stock !== undefined) set.stock = Math.max(0, Number(req.body.stock) || 0);
  if (req.body.category && CATEGORIES.includes(req.body.category)) set.category = req.body.category;
  if (req.body.hub_slug !== undefined) set.hub_slug = U.sanitizeText(req.body.hub_slug, 40);
  if (req.body.status && ['active', 'hidden'].includes(req.body.status)) set.status = req.body.status;
  db.prepare(`UPDATE products SET ${Object.keys(set).map((k) => `${k}=@${k}`).join(',')} WHERE id=@id`).run({ ...set, id: p.id });
  if (Array.isArray(req.body.images)) {
    db.prepare('DELETE FROM product_images WHERE product_id=?').run(p.id);
    req.body.images.filter((u) => typeof u === 'string' && u.startsWith('/uploads/')).slice(0, 6)
      .forEach((url, i) => db.prepare('INSERT INTO product_images (product_id,url,position) VALUES (?,?,?)').run(p.id, url, i));
  }
  res.json({ product: productPayload(db.prepare('SELECT * FROM products WHERE id=?').get(p.id), req.user.id) });
}));

r.delete('/products/:id', U.requireAuth, U.wrap((req, res) => {
  const p = db.prepare('SELECT * FROM products WHERE id=?').get(req.params.id);
  if (!p) return res.status(404).json({ error: 'Product not found.' });
  if (p.seller_id !== req.user.id && req.user.role !== 'admin') return res.status(403).json({ error: 'Not your product.' });
  db.prepare("UPDATE products SET status='removed' WHERE id=?").run(p.id);
  res.json({ ok: true });
}));

/* ---------------------------------------------------------------- wishlist */
r.get('/wishlist', U.requireAuth, U.wrap((req, res) => {
  const rows = db.prepare(`SELECT p.*, s.name AS store_name, s.slug AS store_slug FROM wishlist_items w
    JOIN products p ON p.id=w.product_id JOIN stores s ON s.id=p.store_id
    WHERE w.user_id=? ORDER BY w.created_at DESC`).all(req.user.id);
  res.json({ products: rows.map((p) => productPayload(p, req.user.id)) });
}));

r.post('/wishlist/:productId', U.requireAuth, U.wrap((req, res) => {
  const pid = Number(req.params.productId);
  const p = db.prepare('SELECT id FROM products WHERE id=?').get(pid);
  if (!p) return res.status(404).json({ error: 'Product not found.' });
  const has = db.prepare('SELECT 1 FROM wishlist_items WHERE user_id=? AND product_id=?').get(req.user.id, pid);
  if (has) db.prepare('DELETE FROM wishlist_items WHERE user_id=? AND product_id=?').run(req.user.id, pid);
  else db.prepare('INSERT INTO wishlist_items (user_id,product_id,created_at) VALUES (?,?,?)').run(req.user.id, pid, U.now());
  res.json({ saved: !has });
}));

/* ---------------------------------------------------------------- cart */
function cartOf(userId) {
  const items = db.prepare(`SELECT c.id, c.qty, p.id AS product_id, p.title, p.price_cents, p.stock, p.status,
      s.name AS store_name, s.slug AS store_slug,
      (SELECT url FROM product_images pi WHERE pi.product_id=p.id ORDER BY position LIMIT 1) AS image
    FROM cart_items c JOIN products p ON p.id=c.product_id JOIN stores s ON s.id=p.store_id
    WHERE c.user_id=? ORDER BY c.created_at DESC`).all(userId);
  const live = items.filter((i) => i.status === 'active');
  const subtotal = live.reduce((n, i) => n + i.price_cents * i.qty, 0);
  return {
    items: live.map((i) => ({ ...i, price: i.price_cents / 100, line_total: (i.price_cents * i.qty) / 100 })),
    subtotal: subtotal / 100,
    subtotal_cents: subtotal,
    count: live.reduce((n, i) => n + i.qty, 0),
  };
}

r.get('/cart', U.requireAuth, U.wrap((req, res) => res.json(cartOf(req.user.id))));

r.post('/cart', U.requireAuth, U.wrap((req, res) => {
  const pid = Number(req.body.product_id);
  const qty = Math.max(1, Math.min(20, Number(req.body.qty) || 1));
  const p = db.prepare("SELECT * FROM products WHERE id=? AND status='active'").get(pid);
  if (!p) return res.status(404).json({ error: 'Product not available.' });
  if (p.seller_id === req.user.id) return res.status(400).json({ error: 'You cannot buy your own product.' });
  if (p.stock < qty) return res.status(400).json({ error: `Only ${p.stock} left in stock.` });
  const cur = db.prepare('SELECT * FROM cart_items WHERE user_id=? AND product_id=?').get(req.user.id, pid);
  if (cur) db.prepare('UPDATE cart_items SET qty=MIN(?, ?) WHERE id=?').run(cur.qty + qty, p.stock, cur.id);
  else db.prepare('INSERT INTO cart_items (user_id,product_id,qty,created_at) VALUES (?,?,?,?)').run(req.user.id, pid, Math.min(qty, p.stock), U.now());
  res.json(cartOf(req.user.id));
}));

r.patch('/cart/:id', U.requireAuth, U.wrap((req, res) => {
  const item = db.prepare('SELECT c.*, p.stock FROM cart_items c JOIN products p ON p.id=c.product_id WHERE c.id=? AND c.user_id=?')
    .get(req.params.id, req.user.id);
  if (!item) return res.status(404).json({ error: 'Cart item not found.' });
  const qty = Math.max(0, Math.min(Number(req.body.qty) || 0, item.stock));
  if (qty === 0) db.prepare('DELETE FROM cart_items WHERE id=?').run(item.id);
  else db.prepare('UPDATE cart_items SET qty=? WHERE id=?').run(qty, item.id);
  res.json(cartOf(req.user.id));
}));

r.delete('/cart/:id', U.requireAuth, U.wrap((req, res) => {
  db.prepare('DELETE FROM cart_items WHERE id=? AND user_id=?').run(req.params.id, req.user.id);
  res.json(cartOf(req.user.id));
}));

/* ---------------------------------------------------------------- checkout + orders */
r.post('/checkout', U.requireAuth, U.rateLimit({ max: 20, windowMs: 3600 * 1000, key: 'checkout' }), U.wrap((req, res) => {
  const cart = cartOf(req.user.id);
  if (!cart.items.length) return res.status(400).json({ error: 'Your cart is empty.' });
  const ship = {
    name: U.sanitizeText(req.body.ship_name, 80),
    phone: U.sanitizeText(req.body.ship_phone, 30),
    address: U.sanitizeText(req.body.ship_address, 300),
    city: U.sanitizeText(req.body.ship_city, 60),
    note: U.sanitizeText(req.body.note, 300),
  };
  if (!ship.name || !ship.phone || !ship.address) {
    return res.status(400).json({ error: 'Name, phone and address are required.' });
  }
  const method = req.body.payment_method === 'gateway' ? 'gateway' : 'cod';
  if (method === 'gateway' && !pay.isConfigured()) {
    return res.status(503).json({ error: pay.NOT_CONFIGURED_MESSAGE });
  }

  const code = 'GZ' + Date.now().toString(36).toUpperCase() + Math.floor(Math.random() * 900 + 100);
  const tx = db.transaction(() => {
    const info = db.prepare(`INSERT INTO orders
      (code,buyer_id,total_cents,status,payment_status,payment_method,ship_name,ship_phone,ship_address,ship_city,note,created_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`).run(code, req.user.id, cart.subtotal_cents, 'placed',
      method === 'cod' ? 'unpaid' : 'pending', method, ship.name, ship.phone, ship.address, ship.city, ship.note, U.now());
    const orderId = info.lastInsertRowid;
    cart.items.forEach((i) => {
      const p = db.prepare("SELECT * FROM products WHERE id=? AND status='active'").get(i.product_id);
      if (!p || p.stock < i.qty) throw new U.HttpError(400, `"${i.title}" is out of stock.`);
      db.prepare(`INSERT INTO order_items (order_id,product_id,store_id,seller_id,title,image,unit_cents,qty,status)
        VALUES (?,?,?,?,?,?,?,?,?)`).run(orderId, p.id, p.store_id, p.seller_id, p.title, i.image || '', p.price_cents, i.qty, 'placed');
      db.prepare('UPDATE products SET stock=stock-?, sold_count=sold_count+? WHERE id=?').run(i.qty, i.qty, p.id);
      U.notify({
        userId: p.seller_id, actorId: req.user.id, type: 'order', entityType: 'order', entityId: Number(orderId),
        text: `New order for "${p.title}" (${i.qty}×)`, link: '#/seller?tab=orders',
      });
    });
    db.prepare('DELETE FROM cart_items WHERE user_id=?').run(req.user.id);
    return orderId;
  });
  const orderId = tx();
  XP.award(req.user.id, 'order_placed', { refType: 'order', refId: Number(orderId) });
  const order = db.prepare('SELECT * FROM orders WHERE id=?').get(orderId);
  const payment = method === 'gateway' ? pay.createIntent({ amount_cents: order.total_cents, ref: order.code, userId: req.user.id }) : null;
  res.json({ order: { ...order, total: order.total_cents / 100 }, payment });
}));

r.get('/orders', U.requireAuth, U.wrap((req, res) => {
  const rows = db.prepare('SELECT * FROM orders WHERE buyer_id=? ORDER BY created_at DESC LIMIT 40').all(req.user.id);
  const items = rows.length
    ? db.prepare(`SELECT * FROM order_items WHERE order_id IN (${rows.map((o) => o.id).join(',')})`).all()
    : [];
  res.json({
    orders: rows.map((o) => ({
      ...o, total: o.total_cents / 100,
      items: items.filter((i) => i.order_id === o.id).map((i) => ({ ...i, unit: i.unit_cents / 100 })),
    })),
  });
}));

r.get('/orders/:code', U.requireAuth, U.wrap((req, res) => {
  const o = db.prepare('SELECT * FROM orders WHERE code=?').get(req.params.code);
  if (!o) return res.status(404).json({ error: 'Order not found.' });
  const isSeller = db.prepare('SELECT 1 FROM order_items WHERE order_id=? AND seller_id=?').get(o.id, req.user.id);
  if (o.buyer_id !== req.user.id && !isSeller && req.user.role !== 'admin') return res.status(403).json({ error: 'Not allowed.' });
  const items = db.prepare('SELECT * FROM order_items WHERE order_id=?').all(o.id);
  res.json({ order: { ...o, total: o.total_cents / 100, items: items.map((i) => ({ ...i, unit: i.unit_cents / 100 })) } });
}));

r.post('/orders/:code/cancel', U.requireAuth, U.wrap((req, res) => {
  const o = db.prepare('SELECT * FROM orders WHERE code=? AND buyer_id=?').get(req.params.code, req.user.id);
  if (!o) return res.status(404).json({ error: 'Order not found.' });
  if (!['placed', 'confirmed'].includes(o.status)) return res.status(400).json({ error: 'This order can no longer be cancelled.' });
  db.prepare("UPDATE orders SET status='cancelled', updated_at=? WHERE id=?").run(U.now(), o.id);
  db.prepare("UPDATE order_items SET status='cancelled' WHERE order_id=?").run(o.id);
  db.prepare('SELECT * FROM order_items WHERE order_id=?').all(o.id)
    .forEach((i) => { if (i.product_id) db.prepare('UPDATE products SET stock=stock+?, sold_count=MAX(0,sold_count-?) WHERE id=?').run(i.qty, i.qty, i.product_id); });
  res.json({ ok: true });
}));

/* ---------------------------------------------------------------- seller dashboard */
r.get('/seller/summary', U.requireAuth, U.wrap((req, res) => {
  const store = db.prepare('SELECT * FROM stores WHERE owner_id=?').get(req.user.id);
  if (!store) return res.json({ store: null });
  const products = db.prepare("SELECT * FROM products WHERE store_id=? AND status<>'removed' ORDER BY created_at DESC").all(store.id);
  const items = db.prepare(`SELECT oi.*, o.code, o.status AS order_status, o.created_at, o.ship_name, o.ship_city, u.username AS buyer
    FROM order_items oi JOIN orders o ON o.id=oi.order_id JOIN users u ON u.id=o.buyer_id
    WHERE oi.seller_id=? ORDER BY o.created_at DESC LIMIT 60`).all(req.user.id);
  const revenue = items.filter((i) => i.status !== 'cancelled').reduce((n, i) => n + i.unit_cents * i.qty, 0);
  res.json({
    store,
    products: products.map((p) => productPayload(p, req.user.id)),
    orders: items.map((i) => ({ ...i, unit: i.unit_cents / 100, line_total: (i.unit_cents * i.qty) / 100 })),
    stats: {
      products: products.length,
      orders: items.length,
      revenue: revenue / 100,
      followers: db.prepare('SELECT COUNT(*) c FROM store_follows WHERE store_id=?').get(store.id).c,
    },
  });
}));

r.post('/seller/orders/:itemId/status', U.requireAuth, U.wrap((req, res) => {
  const allowed = ['confirmed', 'shipped', 'delivered', 'cancelled'];
  const status = String(req.body.status || '');
  if (!allowed.includes(status)) return res.status(400).json({ error: 'Invalid status.' });
  const item = db.prepare('SELECT * FROM order_items WHERE id=? AND seller_id=?').get(req.params.itemId, req.user.id);
  if (!item) return res.status(404).json({ error: 'Order item not found.' });
  db.prepare('UPDATE order_items SET status=? WHERE id=?').run(status, item.id);
  const siblings = db.prepare('SELECT status FROM order_items WHERE order_id=?').all(item.order_id).map((s) => s.status);
  const orderStatus = siblings.every((s) => s === 'delivered') ? 'delivered'
    : siblings.every((s) => s === 'cancelled') ? 'cancelled'
      : siblings.some((s) => s === 'shipped') ? 'shipped' : 'confirmed';
  db.prepare('UPDATE orders SET status=?, updated_at=? WHERE id=?').run(orderStatus, U.now(), item.order_id);
  const order = db.prepare('SELECT * FROM orders WHERE id=?').get(item.order_id);
  U.notify({
    userId: order.buyer_id, actorId: req.user.id, type: 'order', entityType: 'order', entityId: order.id,
    text: `Order ${order.code}: ${item.title} is now ${status}`, link: '#/orders',
  });
  res.json({ ok: true, order_status: orderStatus });
}));

/* ---------------------------------------------------------------- reviews */
r.post('/products/:id/review', U.requireAuth, U.wrap((req, res) => {
  const pid = Number(req.params.id);
  const p = db.prepare('SELECT * FROM products WHERE id=?').get(pid);
  if (!p) return res.status(404).json({ error: 'Product not found.' });
  const bought = db.prepare(`SELECT 1 FROM order_items oi JOIN orders o ON o.id=oi.order_id WHERE o.buyer_id=? AND oi.product_id=?`)
    .get(req.user.id, pid);
  if (!bought) return res.status(403).json({ error: 'Only buyers can review this product.' });
  const rating = Math.max(1, Math.min(5, Number(req.body.rating) || 0));
  db.prepare(`INSERT INTO product_reviews (product_id,user_id,rating,body,created_at) VALUES (?,?,?,?,?)
    ON CONFLICT(product_id,user_id) DO UPDATE SET rating=excluded.rating, body=excluded.body`)
    .run(pid, req.user.id, rating, U.sanitizeText(req.body.body, 800), U.now());
  const agg = db.prepare('SELECT AVG(rating) a, COUNT(*) c FROM product_reviews WHERE product_id=?').get(pid);
  db.prepare('UPDATE products SET rating=?, rating_count=? WHERE id=?').run(Math.round(agg.a * 10) / 10, agg.c, pid);
  const sagg = db.prepare(`SELECT AVG(pr.rating) a, COUNT(*) c FROM product_reviews pr JOIN products p ON p.id=pr.product_id WHERE p.store_id=?`).get(p.store_id);
  db.prepare('UPDATE stores SET rating=?, rating_count=? WHERE id=?').run(Math.round((sagg.a || 0) * 10) / 10, sagg.c || 0, p.store_id);
  res.json({ ok: true });
}));

module.exports = { router: r, CATEGORIES };
