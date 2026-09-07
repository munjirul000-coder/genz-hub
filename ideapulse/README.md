# IdeaPulse

**Discover what people really need.**

IdeaPulse is a full-stack web platform where people anonymously submit problems they face
and the solution they wish existed. Submissions are **private by design** — other users can
never browse, search, or see them. Only an authenticated admin can analyze the submissions
through a secure dashboard that automatically groups related problems into **potential
business opportunities**, scores them, and generates internal research reports.

> 💡 IdeaPulse is not a survey. It's a signal engine for finding real, unmet needs.

---

## ✨ Features

**Public side**
- Premium, mobile-first landing page ("What do you wish existed?")
- Ultra-low-friction submission form (two questions + optional category/location, <1 minute)
- Post-submission thank-you screen
- Strict privacy: no names, emails, phone numbers, IP addresses, or exact addresses collected

**Admin side** (`/admin`)
- Secure email + password login with scrypt-hashed credentials and httpOnly sessions
- Overview: total / today / this week / this month, top categories, most-mentioned problems, trending opportunities
- Full submissions list with search, category/location/date filters, sorting, pagination
- **Opportunity analysis**: automatically groups similar problems into clusters with titles, scores, keywords, locations, and trend charts
- Opportunity detail page with related submissions + **Business Research Report** generator
- Analytics dashboard (problems by category, over time, top solutions, top keywords, top clusters, geographic distribution) — every chart is clickable to drill into submissions
- **Export** filtered submissions or opportunities as **CSV** or **Excel (.xls)**

**Security & privacy**
- Server-side authorization on every admin route; nothing is exposed publicly
- CSRF protection (double-submit token) + rate limiting + spam de-duplication
- Input validation and length limits; HTML output escaping to prevent XSS
- No IP address or exact-location storage
- Strict Content-Security-Policy; secrets only via environment variables (never in frontend code)

---

## 🧰 Tech stack

| Layer | Choice | Why |
|---|---|---|
| Runtime | Node.js **≥ 22.5** | Built-in SQLite module |
| Backend | Express 4 | Simple, reliable, tiny |
| Database | **SQLite** via `node:sqlite` | Real relational DB, zero native builds, zero external services |
| Auth | scrypt (node:crypto) + signed sessions | No bcrypt native dependency |
| Frontend | Server-rendered HTML + vanilla JS SPA | No build step, no CDN, strict CSP-safe |

The app is a **single deployable unit** — no separate API server, no external database, no build
step. It runs anywhere Node runs (Render, Fly.io, Railway, a VPS, Docker, even behind nginx).

---

## 🚀 Quick start

```bash
# 1. Use Node 22.5+ (required for the built-in SQLite module)
node --version   # should be v22.5.0 or newer

# 2. Install dependencies (pure-JS only — no native compilation)
npm install

# 3. Configure the environment
cp .env.example .env
#    → edit .env and set a strong ADMIN_PASSWORD and SESSION_SECRET

# 4. (Optional) seed realistic demo submissions + auto-create the admin account
npm run seed:demo

# 5. Run
npm start
# → http://localhost:3000
```

Open **http://localhost:3000** for the public site and **http://localhost:3000/admin/login**
for the admin dashboard.

### Admin account setup

The admin account is created automatically **on first boot** from these variables:

```bash
ADMIN_EMAIL=admin@ideapulse.app
ADMIN_PASSWORD=change-this-strong-password
```

- If the `admin_users` table already has a user with that email, nothing is overwritten.
- You can also create/verify it manually with `npm run seed` (creates admin only, no demo data).
- **Never** hard-code credentials in frontend code. They live only in server-side env vars.

### Database setup

The database is a single SQLite file (`data/ideapulse.db`), created automatically on first run.
Schema and indexes are created automatically (see [`src/db.js`](src/db.js)):

- `submissions` — anonymous problem + desired solution + category + broad location
- `admin_users` — email + scrypt password hash
- `sessions` — SHA-256-hashed session tokens (raw token only in httpOnly cookie)
- `opportunity_clusters` — auto-grouped potential opportunities with scores
- `cluster_submissions` — many-to-many link between clusters and submissions
- `generated_reports` — generated business research reports
- `app_settings` — key/value flags (used for future monetization toggles)

---

## ⚙️ Configuration (`.env`)

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3000` | HTTP port |
| `DATA_DIR` | `./data` | Where the SQLite database is stored |
| `NODE_ENV` | `development` | Set `production` when deploying |
| `SESSION_SECRET` | *(required in prod)* | Random 64-char hex used to sign session cookies |
| `ADMIN_EMAIL` | — | Initial admin email (provisioned on boot) |
| `ADMIN_PASSWORD` | — | Initial admin password |
| `CANONICAL_HOST` | — | Public host (optional; enables HTTPS redirect + tighter CSP) |

Generate a session secret with:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## 🧪 Tests

```bash
npm test
```

Runs an end-to-end smoke test (`tests/smoke.js`) that spawns the real server on a fresh
temporary database and verifies the complete flow:

```
Visitor → Landing → Submit (with CSRF) → DB → Admin login → Dashboard
        → Search/Filter → Opportunity analysis → Report → Export → Logout
```

It also asserts negative cases: unauthenticated admin access (401), missing CSRF (403),
wrong password (401), and session clearing after logout.

---

## 🐳 Deployment

### Option A — Docker

```bash
docker build -t ideapulse .
docker run -p 3000:3000 \
  -e ADMIN_EMAIL=admin@ideapulse.app \
  -e ADMIN_PASSWORD='change-this-strong-password' \
  -e SESSION_SECRET='<64-char hex>' \
  -e NODE_ENV=production \
  -v ideapulse-data:/app/data \
  ideapulse
```

### Option B — Node process

```bash
npm ci --omit=dev
NODE_ENV=production SESSION_SECRET=<secret> ADMIN_EMAIL=... ADMIN_PASSWORD=... npm start
```

> In production, `NODE_ENV=production` **requires** `SESSION_SECRET` (the server refuses to
> boot with a placeholder secret) and sets `Secure` cookies + HSTS + tightened CSP.

### Option C — PaaS (Render / Fly.io / Railway)

1. Set the environment variables above in the platform dashboard.
2. Set a persistent disk mounted at `/app/data` (or `DATA_DIR`).
3. Start command: `npm start`. Build command: `npm ci` (or none — no build step).

---

## 📡 API reference

All JSON APIs live under `/api`. Admin endpoints require a valid session cookie
(obtained from `/api/login`).

### Public

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/csrf` | no | Returns a CSRF token (also sets the CSRF cookie) |
| `POST` | `/api/submissions` | no | Create an anonymous submission. Rate-limited. |

`POST /api/submissions` body:

```json
{
  "problem": "I can't find reliable organic food in my area.",
  "desiredSolution": "A trusted service that delivers genuinely organic food.",
  "category": "food",          // optional; one of the 11 categories, or "" for auto-detect
  "broadLocation": "Dhaka"     // optional; city/area only
}
```

### Admin (require session)

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/session` | Current session info |
| `POST` | `/api/login` | `{email, password}` — sets session cookie |
| `POST` | `/api/logout` | Destroys the session |
| `GET` | `/api/admin/overview` | Dashboard metrics + trending opportunities |
| `GET` | `/api/admin/submissions` | Search/filter/sort/paginate submissions |
| `GET` | `/api/admin/submissions/export?format=csv\|xls` | Export (respects the same filters) |
| `GET` | `/api/admin/analytics` | Chart data (categories, timeline, keywords, geo, clusters) |
| `GET` | `/api/admin/opportunities` | List opportunity clusters |
| `GET` | `/api/admin/opportunities/:id` | Cluster detail + related submissions |
| `GET` | `/api/admin/opportunities/export?format=csv\|xls` | Export clusters |
| `POST` | `/api/admin/opportunities/:id/report` | Generate a business research report |
| `POST` | `/api/admin/reanalyze` | Rebuild opportunity clusters |

`GET /api/admin/submissions` query params: `q`, `category`, `location`, `from` (YYYY-MM-DD),
`to` (YYYY-MM-DD), `sort` (`newest|oldest|category|location`), `page`, `limit`.

---

## 🧠 How opportunity analysis works

The clustering engine (`src/clusters.js`) is a **deterministic, AI-free pipeline**:

1. Every submission is tokenized (with light stemming) into a keyword profile of meaningful
   words and bigrams, dropping stop-words and generic qualifiers ("easy", "app", "want"…).
2. Within each category, submissions are grouped around recurring themes, then a "sweep" pass
   attaches remaining submissions to their nearest cluster.
3. Each cluster gets a human-readable title ("Trusted Organic Food") and a **0–100 Opportunity
   Score** computed from: number of related submissions, number of distinct locations, category
   breadth, strength of expressed need ("I wish…", "hard to find…"), and growth over time.

Score labels:

| Range | Label |
|---|---|
| 0–30 | Low signal |
| 31–60 | Moderate signal |
| 61–80 | Strong signal |
| 81–100 | Very strong signal |

> ⚠️ The score is an **internal analytical signal** from user feedback. It is **not** a
> guarantee of customers, revenue, or profitability.

### AI analysis (optional)

The platform works fully without any AI. If you later add an AI provider, the cleanest
integration points are:

- **Categorization** — in `POST /api/submissions`, replace/augment the `text.categorize()`
  fallback with an AI-suggested category.
- **Clustering & summaries** — `src/clusters.js` returns plain JSON (`title`, `keywords`,
  `categories`, `locations`, `trend`); an AI step can propose better titles, merge clusters,
  or summarize themes, then feed the same shapes back into `rebuildClusters`'s persistence.

The `opportunity_clusters` schema is already AI-friendly (keywords/categories/locations/trend
as JSON columns).

---

## 💰 Future monetization architecture

Payments are intentionally **not** implemented in v1, but the schema is ready:

- `generated_reports` — reports can later be sold (market research reports) with a paywall.
- `opportunity_clusters` — selected opportunity insights can be gated by subscription.
- `app_settings` — already seeded with `monetization` flags:
  `research_reports`, `opportunity_insights`, `partnerships`, `launch_ventures`.

Planned models: (1) sell market-research reports, (2) sell access to selected opportunity
insights, (3) partner with entrepreneurs/companies, (4) launch businesses from validated
demand. Adding payments later only requires a billing table + a gate on the relevant endpoints.

---

## 🔒 Security notes

- Passwords are hashed with **scrypt** (`N=16384, r=8, p=1`), never stored in plaintext.
- Session tokens are random 256-bit; only their SHA-256 hash is stored server-side.
- Cookies are `httpOnly` + `SameSite=Lax` (+ `Secure` in production).
- All state-changing requests require a valid CSRF token.
- Login and public submission are rate-limited; near-duplicate submissions are de-duplicated.
- No IP addresses or exact addresses are stored; `robots.txt` blocks `/admin` and `/api/admin`.
- Output is HTML-escaped in the admin UI to prevent stored XSS.

---

## 📁 Project layout

```
ideapulse/
├── src/
│   ├── server.js          # Express app, security headers, routes, boot
│   ├── config.js          # env configuration
│   ├── db.js              # SQLite schema + helpers
│   ├── security.js        # scrypt, sessions, CSRF, rate limiting
│   ├── text.js            # tokenizer, categorizer, keyword extraction
│   ├── clusters.js        # opportunity clustering + scoring
│   ├── reports.js         # business research report generator
│   ├── export.js          # CSV + Excel (.xls) export
│   ├── seed.js            # admin provisioning + demo seed
│   ├── util.js            # validation, pagination, date windows
│   └── routes/
│       ├── admin.js       # auth routes + requireAdmin
│       └── api.js         # public + admin API
├── public/
│   ├── index.html         # landing page
│   ├── submit.html        # submission form
│   ├── thanks.html        # success screen
│   ├── admin-login.html   # admin login
│   ├── admin.html         # admin dashboard SPA
│   ├── css/app.css        # design system
│   └── js/ideapulse.js    # shared frontend logic
├── tests/smoke.js         # end-to-end test
├── .env.example
├── Dockerfile
└── package.json
```

---

## License

MIT
