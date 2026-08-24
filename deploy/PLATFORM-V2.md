# Gen-Z Hub — Platform v2

**CONNECT • PLAY • BUILD • WORK • SHOP** — one account, many worlds.

This document covers the v2 platform layer (hubs, marketplace, work, arena, ads, admin).
The video pipeline is documented separately in [`VIDEO-PIPELINE.md`](VIDEO-PIPELINE.md).

Everything below is **implemented and tested** — real tables, real endpoints, real UI.
The design system is unchanged: every new screen is built from the existing VOLT components
(`card`, `chip`, `greet`, `project-card`, `pill`, `btn`, `empty`).

---

## 1. Interest hubs

12 seeded hubs — Business, Gaming, Sports, Study, Fitness, Technology, Creative, Cars, Movies,
Music, Fashion, Startups — plus admin-created hubs at runtime (`POST /api/admin/hubs`).

* Users follow **as many hubs as they like** (`user_hubs`), never locked into one.
* `#/hubs` directory, `#/hub/:slug` page (communities, people, products, challenges in that hub).
* Legacy Business/Gaming membership flags stay in sync automatically.

| Endpoint | Purpose |
|---|---|
| `GET /api/hubs` | directory with member counts + joined flag |
| `GET /api/hubs/:slug` | hub page payload |
| `POST /api/hubs/:slug/join` | join / leave (toggle) |

## 2. Marketplace (`#/shop`)

Full commerce loop: **store → product → cart → checkout → order → fulfilment → review**.

* Money is stored as integer poisha (`price_cents`) — no floating point drift.
* Stock is decremented inside a transaction; cancelling an order restores it.
* Sellers get `#/seller` (studio: products, orders, revenue, followers).
* Buyers get `#/cart`, `#/orders`, `#/wishlist`, product pages with reviews.
* Reviews are **purchase-verified** — non-buyers get 403.
* Products carry `hub_slug`, so `#/shop?hub=gaming` and hub pages show relevant products
  (interest-based discovery instead of a generic catalogue).

| Endpoint | Purpose |
|---|---|
| `GET /api/market/products` | catalogue: category, hub, store, search, price, sort |
| `GET /api/market/products/:id` | detail + reviews + related |
| `POST /api/market/stores` · `PATCH /api/market/stores/mine` | store lifecycle |
| `POST/PATCH/DELETE /api/market/products…` | seller CRUD (owner-only) |
| `GET/POST/PATCH/DELETE /api/market/cart…` | cart |
| `POST /api/market/checkout` | order creation (transactional) |
| `GET /api/market/orders` · `/orders/:code` · `/orders/:code/cancel` | buyer order tracking |
| `GET /api/market/seller/summary` · `POST /api/market/seller/orders/:id/status` | fulfilment |
| `POST /api/market/products/:id/review` | verified review |

## 3. Work — freelancing & jobs (`#/work`)

* **Clients** post jobs (category, budget range, fixed/hourly, skills, expiry) and review proposals.
* **Freelancers** build a profile (headline, skills, rate, availability, portfolio) and apply.
* Hiring flips the job to `filled`, increments the freelancer's completed-job count and notifies both sides.
* Proposals are only visible to the job owner (verified by a permission test).
* **Job packages**: every user gets a configurable number of free posts
  (`job_free_quota`, default 2), then needs credits from a package.

## 4. Packages & payments — honest by design

Job, ad and cosmetic packages live in the `packages` table and are **fully editable by admins**
(price, quantity, duration, perks, active) — nothing is hard-coded in the UI.

`src/payments.js` is the single integration point. With no gateway configured:

* purchases are stored with `payment_status = 'pending'`,
* the user sees exactly why nothing was charged,
* **no credits are granted and nothing is ever marked paid.**

To enable real payments set `PAYMENT_PROVIDER`, `PAYMENT_KEY`, `PAYMENT_SECRET`, `PUBLIC_URL`
and implement the two marked integration points (create session, verify callback signature).
Card data never touches Gen-Z Hub. Cash-on-delivery works end to end today.

## 5. Advertising (`#/ads`)

* Advertisers create campaigns targeting **interest hubs and categories only** — never private
  profile data, never sensitive attributes.
* Every campaign starts `pending` and must be **approved by an admin** before it can be served
  (verified by test: a pending campaign is never returned by `/api/ads/serve`).
* Impressions and clicks are counted; the UI states plainly that reach is an estimate and that
  no fixed number of views is guaranteed.

## 6. Arena — XP, missions, badges, leaderboards (`#/arena`)

`src/gamify.js` is the engine. Anti-abuse is built in:

* every action has a **daily cap** (e.g. post +10 XP, max 5/day),
* XP is paid **once per object** (`ref_type`+`ref_id`), so editing/re-reacting earns nothing extra,
* self-votes are blocked, mission rewards can be claimed once per day.

Levels use `xp ≥ 50·n·(n+1)`; streaks track consecutive active days. 12 badges unlock from real
counters (posts, comments, challenge wins, products listed, jobs done, XP, followers).
Leaderboards (`creators`, `contributors`, `builders`, `gamers`, `overall`) publish their exact
scoring rule in the UI.

## 7. Challenges · Poll Arena · Idea Arena

* **Challenges** (`#/arena?tab=challenges`, `#/challenge/:slug`): create, submit one entry per user,
  community voting (no self-voting), admin marks winners → XP + 🏆 badge. Safety copy discourages
  dangerous challenges and moderators can close any challenge.
* **Poll Arena** (`#/polls`): 2–6 options, optional multi-select, auto-closing, live percentages,
  one vote per user per option, XP capped to prevent farming.
* **Idea Arena** (`#/ideas`, `#/idea/:id`): publish an idea, list what you are looking for, get
  supports and feedback comments; supporters give the author XP (capped).

## 8. Admin (`src/routes/admin2.js`)

`/api/admin/overview` aggregates marketplace GMV, work, ads, arena and hub membership.
Admins can: create/edit hubs, edit every package price/quantity/duration, approve or reject ad
campaigns, suspend stores, hide/remove products, change job status, close challenges, pick
challenge winners, create badges and update platform settings
(`job_free_quota`, `marketplace_commission_pct`, feature switches, signup toggle, notice).

**Every admin action is written to `admin_logs`** and readable at `/api/admin/logs`.

## 9. Data model additions (schema v2)

`hubs`, `user_hubs`, `stores`, `products`, `product_images`, `cart_items`, `wishlist_items`,
`orders`, `order_items`, `product_reviews`, `store_follows`, `freelancer_profiles`, `job_posts`,
`job_proposals`, `packages`, `package_purchases`, `ad_campaigns`, `user_stats`, `xp_events`,
`badges`, `user_badges`, `missions`, `mission_progress`, `challenges`, `challenge_entries`,
`challenge_votes`, `polls`, `poll_options`, `poll_votes`, `ideas`, `idea_supports`,
`idea_comments`, `platform_settings`, `admin_logs` — all indexed, all created with
`IF NOT EXISTS` so existing databases upgrade in place.

## 10. Tests

```bash
node tests/platform-test.js        # 70 API checks: full commerce, work, arena, ads, admin, permissions
node tests/platform-ui-test.js     # 56 browser checks on desktop + mobile, 0 console errors
bash qa.sh                         # 90 legacy API checks (unchanged, still green)
node tests/video-feed-test.js      # 39 video player checks
```

Latest run: **70/70 · 56/56 · 90/90 · 39/39**.

## 11. Not yet wired (and deliberately not faked)

| Item | Status |
|---|---|
| Card / mobile-banking payments | architecture + pending records ready; needs provider keys |
| Marketplace commission payout | percentage is configurable and recorded; no payout rail yet |
| Real-time chat | still 4s polling (WebSocket would replace `messages.js` transport only) |
| Email verification / password-reset email | needs an SMTP or transactional provider |
