/* Gen-Z Hub — Marketplace: shop, product, cart, checkout, orders, wishlist, seller studio.
   Uses the existing VOLT design system only (card / btn / chip / greet / empty / grid classes). */
(function () {
  'use strict';
  const G = window.GZ, S = G.state, esc = G.esc;

  const tk = (n) => '৳' + Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 2 });

  function productCard(p) {
    const off = p.compare_at > p.price ? Math.round((1 - p.price / p.compare_at) * 100) : 0;
    return `<a class="project-card" href="#/product/${p.id}" style="text-decoration:none;color:inherit">
      <div class="pc-cover" style="aspect-ratio:1/1;background:var(--surface-2);position:relative;overflow:hidden">
        ${p.image ? `<img src="${esc(p.image)}" alt="${esc(p.title)}" loading="lazy" style="width:100%;height:100%;object-fit:cover">`
      : '<div style="width:100%;height:100%;display:grid;place-items:center;font-size:34px">🛍️</div>'}
        ${off ? `<span class="badge badge-game" style="position:absolute;top:10px;left:10px">-${off}%</span>` : ''}
        ${p.stock <= 0 ? '<span class="pill" style="position:absolute;bottom:10px;left:10px">Out of stock</span>' : ''}
      </div>
      <div class="project-body">
        <div class="bold" style="font-size:14px;line-height:1.35">${esc(p.title)}</div>
        <div class="row wrap" style="gap:8px;margin-top:6px;align-items:baseline">
          <span class="bold" style="font-size:16px">${tk(p.price)}</span>
          ${p.compare_at > p.price ? `<span class="tiny muted" style="text-decoration:line-through">${tk(p.compare_at)}</span>` : ''}
        </div>
        <div class="tiny muted" style="margin-top:6px">${esc(p.store_name || '')} ${p.rating_count ? `· ★ ${p.rating} (${p.rating_count})` : ''}</div>
      </div>
    </a>`;
  }

  function grid(list, emptyMsg) {
    if (!list.length) return G.emptyState('🛍️', emptyMsg || 'Nothing here yet', 'Check back soon or try another category.');
    return `<div class="showcase">${list.map(productCard).join('')}</div>`;
  }

  async function cartCount() {
    if (!S.user) return 0;
    try { const c = await G.get('/market/cart'); return c.count || 0; } catch (e) { return 0; }
  }

  /* ---------------------------------------------------------------- shop */
  G.route('shop', async (parts, query) => {
    const view = G.mountShell();
    const cat = query.category || '';
    const sort = query.sort || '';
    const q = query.q || '';

    view.innerHTML = `
      <section class="greet rise" style="background:linear-gradient(135deg,color-mix(in srgb,var(--flare) 14%,var(--surface)),var(--surface) 60%,color-mix(in srgb,var(--volt) 14%,var(--surface)))">
        <div class="between wrap" style="align-items:flex-start">
          <div>
            <h1>Shop 🛍️</h1>
            <div class="sub">Gen-Z marketplace — discover products from creators, sellers and small brands.</div>
          </div>
          <div class="row" style="gap:8px">
            <a class="btn btn-ghost" href="#/cart">${G.icon('saved', 16)} Cart <span id="cart-badge" class="pill" hidden></span></a>
            <a class="btn btn-primary" href="#/seller">${G.icon('business', 16)} Seller studio</a>
          </div>
        </div>
        <form class="row" id="shop-search" style="margin-top:14px;gap:8px">
          <input class="input" id="sq" placeholder="Search products…" value="${esc(q)}" style="max-width:320px">
          <select class="select btn-sm" id="ssort" style="width:auto">
            <option value="">Featured</option><option value="new">Newest</option>
            <option value="price_low">Price: low → high</option><option value="price_high">Price: high → low</option>
            <option value="popular">Most popular</option><option value="rating">Top rated</option>
          </select>
          <button class="btn btn-ghost btn-sm">Search</button>
        </form>
        <div class="quick" id="cats"></div>
      </section>
      <div id="shop-body">${G.skeletonList(3)}</div>`;

    G.qs('#ssort', view).value = sort;
    G.qs('#shop-search', view).onsubmit = (e) => {
      e.preventDefault();
      const params = new URLSearchParams();
      const v = G.qs('#sq', view).value.trim(); if (v) params.set('q', v);
      const sv = G.qs('#ssort', view).value; if (sv) params.set('sort', sv);
      if (cat) params.set('category', cat);
      location.hash = '#/shop?' + params.toString();
    };

    cartCount().then((n) => { const b = G.qs('#cart-badge', view); if (b && n) { b.hidden = false; b.textContent = n; } });

    const params = new URLSearchParams();
    if (cat) params.set('category', cat);
    if (sort) params.set('sort', sort);
    if (q) params.set('q', q);
    const data = await G.get('/market/products?' + params.toString());

    G.qs('#cats', view).innerHTML = [['', 'All']].concat(data.categories.map((c) => [c, c]))
      .map(([k, label]) => `<a class="chip ${cat === k ? 'on' : ''}" href="#/shop?category=${encodeURIComponent(k)}">${esc(label)}</a>`).join('');
    G.qs('#shop-body', view).innerHTML = grid(data.products, q ? 'No products match your search' : 'No products listed yet');
  });

  /* ---------------------------------------------------------------- product */
  G.route('product', async (parts) => {
    const view = G.mountShell();
    view.innerHTML = G.skeletonPost();
    const d = await G.get('/market/products/' + parts[0]);
    const p = d.product;
    view.innerHTML = `
      <div class="card">
        <div class="row wrap" style="align-items:flex-start;gap:18px">
          <div style="flex:1 1 320px;min-width:280px">
            <div style="border-radius:var(--r);overflow:hidden;background:var(--surface-2);aspect-ratio:1/1">
              ${p.image ? `<img id="pimg" src="${esc(p.image)}" alt="${esc(p.title)}" style="width:100%;height:100%;object-fit:cover">`
      : '<div style="height:100%;display:grid;place-items:center;font-size:52px">🛍️</div>'}
            </div>
            ${p.images.length > 1 ? `<div class="row wrap" style="gap:8px;margin-top:10px">${p.images.map((u) => `<img data-thumb="${esc(u)}" src="${esc(u)}" alt="" style="width:64px;height:64px;object-fit:cover;border-radius:10px;cursor:pointer">`).join('')}</div>` : ''}
          </div>
          <div style="flex:1 1 320px;min-width:280px">
            <div class="row wrap" style="gap:6px">${p.hub_slug ? `<span class="pill">${esc(p.hub_slug)}</span>` : ''}<span class="pill">${esc(p.category)}</span>
              <span class="pill">${p.condition === 'used' ? 'Used' : 'New'}</span></div>
            <h1 style="margin:10px 0 6px;font-size:24px">${esc(p.title)}</h1>
            <div class="row" style="gap:10px;align-items:baseline">
              <span class="bold" style="font-size:26px">${tk(p.price)}</span>
              ${p.compare_at > p.price ? `<span class="muted" style="text-decoration:line-through">${tk(p.compare_at)}</span>` : ''}
            </div>
            <div class="small muted" style="margin-top:8px">${p.rating_count ? `★ ${p.rating} · ${p.rating_count} reviews · ` : ''}${p.sold_count} sold · ${p.stock} in stock</div>
            <a class="row" href="#/store/${esc(p.store_slug)}" style="gap:10px;margin-top:14px;text-decoration:none;color:inherit">
              ${p.store_logo ? `<img src="${esc(p.store_logo)}" alt="" style="width:36px;height:36px;border-radius:12px;object-fit:cover">` : '<div style="width:36px;height:36px;border-radius:12px;background:var(--surface-2);display:grid;place-items:center">🏪</div>'}
              <div><div class="bold small">${esc(p.store_name)}</div><div class="tiny muted">Visit store</div></div>
            </a>
            <div class="post-body" style="margin-top:14px;white-space:pre-wrap">${esc(p.description || 'No description provided.')}</div>
            <div class="row wrap" style="gap:8px;margin-top:18px">
              <button class="btn btn-primary" id="add-cart" ${p.stock <= 0 ? 'disabled' : ''}>${G.icon('plus', 16)} Add to cart</button>
              <button class="btn btn-ghost" id="buy-now" ${p.stock <= 0 ? 'disabled' : ''}>Buy now</button>
              <button class="btn btn-ghost" id="wish">${p.in_wishlist ? '♥ Saved' : '♡ Wishlist'}</button>
            </div>
            <div class="err" id="p-err" hidden style="margin-top:10px"></div>
          </div>
        </div>
      </div>
      <div class="card" style="margin-top:16px">
        <div class="between"><h2 style="font-size:17px;margin:0">Reviews</h2>
          ${d.can_review ? '<button class="btn btn-ghost btn-sm" id="write-review">Write a review</button>' : ''}</div>
        <div id="reviews" style="margin-top:12px">${d.reviews.length ? d.reviews.map((rv) => `
          <div class="row" style="align-items:flex-start;padding:10px 0;border-bottom:1px solid var(--line-soft)">
            ${G.avatar(rv, 34)}
            <div class="grow"><div class="bold small">${esc(rv.full_name)} <span class="tiny muted">· ${'★'.repeat(rv.rating)}</span></div>
            <div class="small">${esc(rv.body || '')}</div></div>
          </div>`).join('') : '<div class="small muted">No reviews yet.</div>'}</div>
      </div>
      ${d.related.length ? `<div style="margin-top:16px"><h2 style="font-size:17px;margin:0 0 10px">Related products</h2>${grid(d.related)}</div>` : ''}`;

    G.qsa('[data-thumb]', view).forEach((t) => t.onclick = () => { const i = G.qs('#pimg', view); if (i) i.src = t.dataset.thumb; });

    const err = G.qs('#p-err', view);
    const add = async (then) => {
      if (!G.requireUser()) return;
      err.hidden = true;
      try { await G.post('/market/cart', { product_id: p.id, qty: 1 }); G.toast('Added to cart 🛒', 'ok'); if (then) location.hash = then; }
      catch (e) { err.textContent = e.message; err.hidden = false; }
    };
    G.qs('#add-cart', view).onclick = () => add();
    G.qs('#buy-now', view).onclick = () => add('#/cart');
    G.qs('#wish', view).onclick = async (e) => {
      if (!G.requireUser()) return;
      const r = await G.post('/market/wishlist/' + p.id, {});
      e.target.textContent = r.saved ? '♥ Saved' : '♡ Wishlist';
    };
    const wr = G.qs('#write-review', view);
    if (wr) wr.onclick = () => reviewModal(p.id);
  });

  function reviewModal(productId) {
    const m = G.modal('Write a review', `
      <div class="field"><label class="label" for="rv-rating">Rating</label>
        <select class="select" id="rv-rating"><option value="5">★★★★★</option><option value="4">★★★★</option>
        <option value="3">★★★</option><option value="2">★★</option><option value="1">★</option></select></div>
      <div class="field"><label class="label" for="rv-body">Your review</label>
        <textarea class="textarea" id="rv-body" maxlength="800" placeholder="How was the product?"></textarea></div>
      <div class="err" id="rv-err" hidden></div>
      <div class="row" style="justify-content:flex-end"><button class="btn btn-primary" id="rv-send">Submit</button></div>`);
    G.qs('#rv-send', m.body).onclick = async (e) => {
      e.target.disabled = true;
      try {
        await G.post(`/market/products/${productId}/review`, { rating: Number(G.qs('#rv-rating', m.body).value), body: G.qs('#rv-body', m.body).value });
        m.close(); G.toast('Review posted ⭐', 'ok'); G.render();
      } catch (err) { const b = G.qs('#rv-err', m.body); b.textContent = err.message; b.hidden = false; e.target.disabled = false; }
    };
  }

  /* ---------------------------------------------------------------- store page */
  G.route('store', async (parts) => {
    const view = G.mountShell();
    view.innerHTML = G.skeletonPost();
    const d = await G.get('/market/stores/' + parts[0]);
    const s = d.store;
    view.innerHTML = `
      <section class="greet rise">
        <div class="between wrap" style="align-items:flex-start">
          <div class="row" style="gap:14px;align-items:flex-start">
            ${s.logo ? `<img src="${esc(s.logo)}" alt="" style="width:64px;height:64px;border-radius:20px;object-fit:cover">` : '<div style="width:64px;height:64px;border-radius:20px;background:var(--surface-2);display:grid;place-items:center;font-size:28px">🏪</div>'}
            <div><h1 style="margin:0">${esc(s.name)}</h1>
              <div class="sub">${esc(s.tagline || '')}</div>
              <div class="tiny muted" style="margin-top:6px">${s.followers} followers · ${s.rating_count ? `★ ${s.rating}` : 'No ratings yet'} · by @${esc(s.username)}</div></div>
          </div>
          ${s.is_mine ? '<a class="btn btn-primary" href="#/seller">Manage store</a>'
        : `<button class="btn ${s.is_following ? 'btn-ghost' : 'btn-primary'}" id="follow-store">${s.is_following ? 'Following' : 'Follow store'}</button>`}
        </div>
        ${s.about ? `<p class="small" style="margin-top:12px">${esc(s.about)}</p>` : ''}
      </section>
      <div style="margin-top:16px">${grid(d.products, 'This store has no products yet')}</div>`;
    const fb = G.qs('#follow-store', view);
    if (fb) fb.onclick = async () => {
      if (!G.requireUser()) return;
      const r = await G.post(`/market/stores/${s.id}/follow`, {});
      fb.textContent = r.following ? 'Following' : 'Follow store';
      fb.className = 'btn ' + (r.following ? 'btn-ghost' : 'btn-primary');
    };
  });

  /* ---------------------------------------------------------------- cart + checkout */
  G.route('cart', async () => {
    if (!G.requireUser()) return;
    const view = G.mountShell();
    view.innerHTML = '<div class="card">' + G.skeletonList(3) + '</div>';
    const draw = async () => {
      const c = await G.get('/market/cart');
      if (!c.items.length) {
        view.innerHTML = `<div class="card">${G.emptyState('🛒', 'Your cart is empty', 'Find something you like in the shop.', '<a class="btn btn-primary btn-sm" style="margin-top:12px" href="#/shop">Go to shop</a>')}</div>`;
        return;
      }
      view.innerHTML = `
        <div class="card">
          <h1 style="font-size:20px;margin:0 0 14px">Your cart</h1>
          ${c.items.map((i) => `<div class="row" style="gap:12px;padding:12px 0;border-bottom:1px solid var(--line-soft)">
            ${i.image ? `<img src="${esc(i.image)}" alt="" style="width:64px;height:64px;border-radius:12px;object-fit:cover">` : '<div style="width:64px;height:64px;border-radius:12px;background:var(--surface-2);display:grid;place-items:center">🛍️</div>'}
            <div class="grow"><a class="bold small" href="#/product/${i.product_id}">${esc(i.title)}</a>
              <div class="tiny muted">${esc(i.store_name)} · ${tk(i.price)}</div></div>
            <input class="input" type="number" min="0" max="${i.stock}" value="${i.qty}" data-qty="${i.id}" style="width:76px">
            <div class="bold small" style="min-width:80px;text-align:right">${tk(i.line_total)}</div>
            <button class="iconbtn" data-del="${i.id}" aria-label="Remove">✕</button>
          </div>`).join('')}
          <div class="between" style="margin-top:16px"><span class="muted">Subtotal</span><span class="bold" style="font-size:20px">${tk(c.subtotal)}</span></div>
        </div>
        <div class="card" style="margin-top:16px">
          <h2 style="font-size:17px;margin:0 0 12px">Delivery details</h2>
          <div class="field"><label class="label" for="ck-name">Full name</label><input class="input" id="ck-name" value="${esc(S.user.full_name)}"></div>
          <div class="field"><label class="label" for="ck-phone">Phone</label><input class="input" id="ck-phone" placeholder="01XXXXXXXXX"></div>
          <div class="field"><label class="label" for="ck-addr">Address</label><textarea class="textarea" id="ck-addr" placeholder="House, road, area"></textarea></div>
          <div class="field"><label class="label" for="ck-city">City</label><input class="input" id="ck-city" placeholder="Dhaka"></div>
          <div class="field"><label class="label" for="ck-pay">Payment</label>
            <select class="select" id="ck-pay"><option value="cod">Cash on delivery</option><option value="gateway">Online payment</option></select>
            <div class="tiny muted" id="pay-note" style="margin-top:6px"></div></div>
          <div class="err" id="ck-err" hidden></div>
          <button class="btn btn-primary btn-block" id="ck-go">Place order · ${tk(c.subtotal)}</button>
        </div>`;

      G.get('/payments/status').then((p) => {
        const note = G.qs('#pay-note', view);
        if (note) note.textContent = p.configured ? `Secure payment via ${p.provider}.` : p.message;
      }).catch(() => {});

      G.qsa('[data-qty]', view).forEach((inp) => inp.onchange = async () => {
        await G.patch('/market/cart/' + inp.dataset.qty, { qty: Number(inp.value) }); draw();
      });
      G.qsa('[data-del]', view).forEach((b) => b.onclick = async () => { await G.del('/market/cart/' + b.dataset.del); draw(); });

      G.qs('#ck-go', view).onclick = async (e) => {
        const err = G.qs('#ck-err', view); err.hidden = true;
        e.target.disabled = true; e.target.textContent = 'Placing order…';
        try {
          const r = await G.post('/market/checkout', {
            ship_name: G.qs('#ck-name', view).value, ship_phone: G.qs('#ck-phone', view).value,
            ship_address: G.qs('#ck-addr', view).value, ship_city: G.qs('#ck-city', view).value,
            payment_method: G.qs('#ck-pay', view).value,
          });
          G.toast('Order placed ✓ ' + r.order.code, 'ok');
          if (r.payment && r.payment.redirect_url) { location.href = r.payment.redirect_url; return; }
          if (r.payment && !r.payment.redirect_url) G.toast(r.payment.message, 'error');
          location.hash = '#/orders';
        } catch (ex) {
          err.textContent = ex.message; err.hidden = false;
          e.target.disabled = false; e.target.textContent = 'Place order';
        }
      };
    };
    draw();
  });

  /* ---------------------------------------------------------------- orders + wishlist */
  G.route('orders', async () => {
    if (!G.requireUser()) return;
    const view = G.mountShell();
    view.innerHTML = '<div class="card">' + G.skeletonList(3) + '</div>';
    const d = await G.get('/market/orders');
    view.innerHTML = `<section class="greet rise"><h1>Your orders</h1><div class="sub">Track everything you bought on Gen-Z Hub.</div></section>
      <div style="margin-top:16px">${d.orders.length ? d.orders.map((o) => `
        <div class="card" style="margin-bottom:12px">
          <div class="between wrap"><div><div class="bold">${esc(o.code)}</div>
            <div class="tiny muted">${new Date(o.created_at).toLocaleString()} · ${o.items.length} item(s) · ${esc(o.payment_method === 'cod' ? 'Cash on delivery' : 'Online')}</div></div>
            <div class="row" style="gap:8px"><span class="pill">${esc(o.status)}</span><span class="bold">${tk(o.total)}</span></div></div>
          <div style="margin-top:10px">${o.items.map((i) => `<div class="row" style="gap:10px;padding:8px 0">
            ${i.image ? `<img src="${esc(i.image)}" alt="" style="width:44px;height:44px;border-radius:10px;object-fit:cover">` : ''}
            <div class="grow small">${esc(i.title)} × ${i.qty}</div><span class="tiny muted">${esc(i.status)}</span></div>`).join('')}</div>
          ${['placed', 'confirmed'].includes(o.status) ? `<button class="btn btn-ghost btn-sm" data-cancel="${esc(o.code)}">Cancel order</button>` : ''}
        </div>`).join('') : G.emptyState('📦', 'No orders yet', 'Your purchases will appear here.')}</div>`;
    G.qsa('[data-cancel]', view).forEach((b) => b.onclick = async () => {
      await G.post(`/market/orders/${b.dataset.cancel}/cancel`, {}); G.toast('Order cancelled'); G.render();
    });
  });

  G.route('wishlist', async () => {
    if (!G.requireUser()) return;
    const view = G.mountShell();
    const d = await G.get('/market/wishlist');
    view.innerHTML = `<section class="greet rise"><h1>Wishlist</h1><div class="sub">Products you saved for later.</div></section>
      <div style="margin-top:16px">${grid(d.products, 'Nothing saved yet')}</div>`;
  });

  /* ---------------------------------------------------------------- seller studio */
  G.route('seller', async (parts, query) => {
    if (!G.requireUser()) return;
    const view = G.mountShell();
    view.innerHTML = '<div class="card">' + G.skeletonList(3) + '</div>';
    const d = await G.get('/market/seller/summary');

    if (!d.store) {
      view.innerHTML = `<section class="greet rise"><h1>Open your store 🏪</h1>
        <div class="sub">Sell to the Gen-Z Hub community — set it up in under a minute.</div></section>
        <div class="card" style="margin-top:16px">
          <div class="field"><label class="label" for="st-name">Store name</label><input class="input" id="st-name" maxlength="60" placeholder="e.g. Dhaka Sneaker Lab"></div>
          <div class="field"><label class="label" for="st-tag">Tagline</label><input class="input" id="st-tag" maxlength="120" placeholder="What do you sell?"></div>
          <div class="field"><label class="label" for="st-about">About</label><textarea class="textarea" id="st-about" maxlength="1200"></textarea></div>
          <div class="err" id="st-err" hidden></div>
          <button class="btn btn-primary" id="st-go">Create store</button>
        </div>`;
      G.qs('#st-go', view).onclick = async (e) => {
        const err = G.qs('#st-err', view); err.hidden = true; e.target.disabled = true;
        try {
          await G.post('/market/stores', { name: G.qs('#st-name', view).value, tagline: G.qs('#st-tag', view).value, about: G.qs('#st-about', view).value });
          G.toast('Store created 🏪', 'ok'); G.render();
        } catch (ex) { err.textContent = ex.message; err.hidden = false; e.target.disabled = false; }
      };
      return;
    }

    const tab = query.tab || 'products';
    view.innerHTML = `
      <section class="greet rise">
        <div class="between wrap"><div><h1>${esc(d.store.name)}</h1><div class="sub">Seller studio</div></div>
          <a class="btn btn-ghost" href="#/store/${esc(d.store.slug)}">View public store</a></div>
        <div class="statgrid" style="margin-top:14px;display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:10px">
          ${[['Products', d.stats.products], ['Orders', d.stats.orders], ['Revenue', tk(d.stats.revenue)], ['Followers', d.stats.followers]]
        .map(([k, v]) => `<div class="stat"><div class="bold" style="font-size:18px">${v}</div><div class="tiny muted">${k}</div></div>`).join('')}
        </div>
        <div class="quick">
          <a class="chip ${tab === 'products' ? 'on' : ''}" href="#/seller?tab=products">Products</a>
          <a class="chip ${tab === 'orders' ? 'on' : ''}" href="#/seller?tab=orders">Orders</a>
        </div>
      </section>
      <div class="row" style="margin:16px 0"><button class="btn btn-primary" id="new-product">${G.icon('plus', 16)} Add product</button></div>
      <div id="sbody"></div>`;

    G.qs('#new-product', view).onclick = () => productModal();

    const body = G.qs('#sbody', view);
    if (tab === 'orders') {
      body.innerHTML = d.orders.length ? `<div class="card">${d.orders.map((o) => `
        <div class="row wrap" style="gap:10px;padding:12px 0;border-bottom:1px solid var(--line-soft)">
          <div class="grow"><div class="bold small">${esc(o.title)} × ${o.qty}</div>
            <div class="tiny muted">${esc(o.code)} · @${esc(o.buyer)} · ${esc(o.ship_city || '')} · ${tk(o.line_total)}</div></div>
          <select class="select btn-sm" data-status="${o.id}" style="width:auto">
            ${['placed', 'confirmed', 'shipped', 'delivered', 'cancelled'].map((s) => `<option value="${s}" ${o.status === s ? 'selected' : ''}>${s}</option>`).join('')}
          </select>
        </div>`).join('')}</div>` : G.emptyState('📦', 'No orders yet', 'Orders from buyers will show up here.');
      G.qsa('[data-status]', body).forEach((sel) => sel.onchange = async () => {
        try { await G.post(`/market/seller/orders/${sel.dataset.status}/status`, { status: sel.value }); G.toast('Order updated', 'ok'); }
        catch (e) { G.err(e); }
      });
    } else {
      body.innerHTML = d.products.length ? `<div class="card">${d.products.map((p) => `
        <div class="row wrap" style="gap:10px;padding:12px 0;border-bottom:1px solid var(--line-soft)">
          ${p.image ? `<img src="${esc(p.image)}" alt="" style="width:48px;height:48px;border-radius:10px;object-fit:cover">` : ''}
          <div class="grow"><a class="bold small" href="#/product/${p.id}">${esc(p.title)}</a>
            <div class="tiny muted">${tk(p.price)} · stock ${p.stock} · ${esc(p.status)} · ${p.sold_count} sold</div></div>
          <button class="btn btn-ghost btn-sm" data-edit="${p.id}">Edit</button>
          <button class="btn btn-ghost btn-sm" data-rm="${p.id}">Delete</button>
        </div>`).join('')}</div>` : G.emptyState('🛍️', 'No products yet', 'Add your first product to start selling.');
      G.qsa('[data-edit]', body).forEach((b) => b.onclick = () => productModal(d.products.find((x) => x.id === Number(b.dataset.edit))));
      G.qsa('[data-rm]', body).forEach((b) => b.onclick = async () => {
        if (!confirm('Delete this product?')) return;
        await G.del('/market/products/' + b.dataset.rm); G.toast('Product deleted'); G.render();
      });
    }
  });

  function productModal(existing) {
    const cats = ['Fashion', 'Sneakers', 'Gaming', 'Technology', 'Phone accessories', 'Books', 'Stationery',
      'Fitness', 'Sports', 'Creator gear', 'Car accessories', 'Lifestyle', 'Gifts'];
    const p = existing || {};
    const m = G.modal(existing ? 'Edit product' : 'Add product', `
      <div class="field"><label class="label" for="pd-title">Title</label><input class="input" id="pd-title" maxlength="120" value="${esc(p.title || '')}"></div>
      <div class="row wrap" style="gap:10px">
        <div class="field grow"><label class="label" for="pd-price">Price (৳)</label><input class="input" id="pd-price" type="number" min="0" step="1" value="${p.price || ''}"></div>
        <div class="field grow"><label class="label" for="pd-compare">Compare at (৳)</label><input class="input" id="pd-compare" type="number" min="0" step="1" value="${p.compare_at || ''}"></div>
        <div class="field grow"><label class="label" for="pd-stock">Stock</label><input class="input" id="pd-stock" type="number" min="0" value="${p.stock != null ? p.stock : 1}"></div>
      </div>
      <div class="row wrap" style="gap:10px">
        <div class="field grow"><label class="label" for="pd-cat">Category</label><select class="select" id="pd-cat">${cats.map((c) => `<option ${p.category === c ? 'selected' : ''}>${c}</option>`).join('')}</select></div>
        <div class="field grow"><label class="label" for="pd-cond">Condition</label><select class="select" id="pd-cond"><option value="new">New</option><option value="used" ${p.condition === 'used' ? 'selected' : ''}>Used</option></select></div>
      </div>
      <div class="field"><label class="label" for="pd-desc">Description</label><textarea class="textarea" id="pd-desc" maxlength="4000">${esc(p.description || '')}</textarea></div>
      <div class="field"><label class="label">Photos</label>
        <label class="btn btn-ghost btn-sm" style="cursor:pointer">🖼️ Upload photos<input type="file" id="pd-file" accept="image/*" multiple hidden></label>
        <div class="row wrap" id="pd-prev" style="gap:8px;margin-top:8px"></div></div>
      <div class="err" id="pd-err" hidden></div>
      <div class="row" style="justify-content:flex-end"><button class="btn btn-primary" id="pd-go">${existing ? 'Save changes' : 'Publish product'}</button></div>`);

    let images = (p.images || []).slice();
    const prev = G.qs('#pd-prev', m.body);
    const draw = () => {
      prev.innerHTML = images.map((u, i) => `<div class="cp-thumb"><img src="${esc(u)}" alt=""><button class="iconbtn" data-x="${i}">✕</button></div>`).join('');
      prev.querySelectorAll('[data-x]').forEach((b) => b.onclick = () => { images.splice(Number(b.dataset.x), 1); draw(); });
    };
    draw();
    G.qs('#pd-file', m.body).onchange = async (e) => {
      try { const up = await G.uploadFiles([...e.target.files]); images = images.concat(up.filter((f) => f.type === 'image').map((f) => f.url)).slice(0, 6); draw(); }
      catch (err) { G.err(err); }
      e.target.value = '';
    };
    G.qs('#pd-go', m.body).onclick = async (e) => {
      const err = G.qs('#pd-err', m.body); err.hidden = true; e.target.disabled = true;
      const payload = {
        title: G.qs('#pd-title', m.body).value, price: G.qs('#pd-price', m.body).value,
        compare_at: G.qs('#pd-compare', m.body).value, stock: G.qs('#pd-stock', m.body).value,
        category: G.qs('#pd-cat', m.body).value, condition: G.qs('#pd-cond', m.body).value,
        description: G.qs('#pd-desc', m.body).value, images,
      };
      try {
        if (existing) await G.patch('/market/products/' + existing.id, payload);
        else await G.post('/market/products', payload);
        m.close(); G.toast(existing ? 'Product updated' : 'Product published 🛍️', 'ok'); G.render();
      } catch (ex) { err.textContent = ex.message; err.hidden = false; e.target.disabled = false; }
    };
  }
})();
