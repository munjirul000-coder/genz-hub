# FlashVault BD — Fullstack Free Deploy (Bangla)

## Cloudflare Pages — RECOMMENDED 100% FREE, No Sleep

1. GitHub e `flashvault-app` push koro
2. Cloudflare Dashboard → Pages → Create Project → Connect GitHub
3. Settings:
   - Framework: Next.js
   - Root: `flashvault-app`
   - Build command: `npm run build`
   - Output: `.next` (auto)
   - Env: NODE_VERSION=20
4. Deploy → `https://flashvault-bd.pages.dev`
5. Custom domain add free

**Keno best?** Static + API both free, unlimited requests, no sleep like Render, Dhaka PoP fast. 500 builds/month free.

## Render Free (2nd option)

`render.yaml` ache — Blueprint diye 1-click:
- Runtime Node 20
- Build `npm ci && npm run build`
- Start `npm start`
- Region Singapore
- Free plan 750h/month (Bloom er sathe share)

## Vercel Free

Vercel e Next.js auto detect kore — just import repo.

## DB Note

Ekhon `data/db.json` file DB use kortesi — free tier e kono extra DB lagbe na. Production e chaile:
- Vercel Postgres / Neon (free)
- Cloudflare D1 (free 5GB)
- Prisma diye swap korte parba — `lib/db.ts` abstraction ready.

## ENV

Kono ENV lagbe na MVP te. Admin key `FLASHVAULT2026` hardcoded demo er jonno — production e `.env` e move korba.
