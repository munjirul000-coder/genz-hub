# FlashVault BD — Fullstack Next.js + Tailwind + shadcn/ui

**Premium 1-Hour VIP Flash Drop platform for Bangladesh surplus stocks.**

### Stack (Professional)

- **Framework:** Next.js 14 App Router (React 18, TypeScript)
- **Styling:** Tailwind CSS 3.4 + shadcn/ui (Button, Card, Badge, Input) — off-white #fdfcfa, ink #0a0a0a, gold #f59e0b
- **Animations:** Framer Motion — staggered reveals, hover lift, shimmer, live pulse
- **Typography:** Bricolage Grotesque 800, Instrument Serif italic, JetBrains Mono — generous spacing, editorial vault identity
- **Icons:** lucide-react
- **DB:** File JSON (`data/db.json`) with abstraction in `lib/db.ts` — easy swap to Prisma/Postgres/Cloudflare D1. No native deps, works on free tiers.
- **API:** Next.js Route Handlers `/api/*` — products, merchant submit, admin approve, drop status, stats

### Pages

- `/` — Landing: editorial hero, black countdown boxes, vault stack, brand ticker, product grid, how it works (not generic ecommerce)
- `/drop` — Live Drop: lock/unlock logic, FOMO (live traffic 14k, stock left, sold %), bKash checkout modal, `?force=unlock` for testing
- `/merchant` — Merchant portal: onboarding form (brand, title, prices, stock, phone) → pending queue → dashboard
- `/admin` — Secret Admin (key `FLASHVAULT2026`): Overview cards (Gross BDT, 10% commission, live traffic, drop toggle FORCE UNLOCK/LOCK), Approval Queue (Approve for Next Drop / Make Live / Reject), Escrow & Payout Manager (paid → shipped → delivered → Release Payout)

### Run Locally

```bash
cd flashvault-app
npm install
npm run dev # http://localhost:3001
```

### Build

```bash
npm run build
npm start
```

### Free Deploy

- **Cloudflare Pages (RECOMMENDED, no sleep):** Connect repo, Build output `.next` or static export, root `flashvault-app`. Free unlimited static requests, 500 builds/mo.
- **Render Free:** `render.yaml` included — Node, `npm ci && npm run build`, start `npm start`, region Singapore.
- **Vercel:** Works out of the box.

### Test Flow

1. `/merchant` → submit lot
2. `/admin` → key FLASHVAULT2026 → Approve → Make Live
3. `/drop?force=unlock` → buy → bKash demo → order goes to Escrow
4. `/admin` → mark delivered → Release Payout

Bloom is untouched, separate project.
