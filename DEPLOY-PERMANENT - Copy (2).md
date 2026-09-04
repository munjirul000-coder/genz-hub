# Make Gen-Z Hub permanently public (5–10 minutes)

The app is one Node process (API + website) with SQLite and uploads inside a single folder (`DATA_DIR`).
It therefore needs a host with a **persistent disk**. Serverless hosts (Vercel, Netlify, Cloudflare Pages)
wipe the filesystem between invocations, so posts, users and uploads would disappear — pick one of the hosts below,
or migrate the DB layer to Postgres first (`src/db.js` is the only file that opens the database).

Package to upload: `genz-hub-deploy.zip` (or `.tar.gz`) — 57 files, no `node_modules`, no test data.

---

## Option A — Render.com (easiest, has a free tier for the service; disk requires a paid instance)

1. Unzip and push to a GitHub repo (`git init && git add . && git commit -m "Gen-Z Hub" && git push`).
2. Render dashboard → **New → Blueprint** → pick the repo. It reads `render.yaml` automatically:
   web service, `npm ci`, `node src/server.js`, health check `/api/health`, 5 GB disk mounted at `/var/data`.
3. Set env vars in the dashboard: `ADMIN_EMAIL`, `ADMIN_PASSWORD` (`NODE_ENV=production` and `DATA_DIR=/var/data`
   come from the blueprint).
4. Deploy → you get `https://<name>.onrender.com`, permanent and public.

## Option B — Fly.io (free volume allowance, global)

```bash
npm i -g flyctl && fly auth login
fly launch --no-deploy            # keeps the bundled fly.toml
fly volumes create genzhub_data --size 3
fly secrets set ADMIN_EMAIL=you@example.com ADMIN_PASSWORD='StrongPass123'
fly deploy                        # → https://<app>.fly.dev
```

## Option C — Railway

New Project → Deploy from repo → add a **Volume** mounted at `/data` → variables
`NODE_ENV=production`, `DATA_DIR=/data`, `ADMIN_EMAIL`, `ADMIN_PASSWORD` → Deploy.

## Option D — Any VPS (Hetzner / DigitalOcean / Contabo, ~$4/mo) with Docker

```bash
scp genz-hub-deploy.zip user@server:~ && ssh user@server
unzip genz-hub-deploy.zip && cd genz-hub
printf 'ADMIN_EMAIL=you@example.com\nADMIN_PASSWORD=StrongPass123\n' > .env
docker compose up -d --build          # app on :3000 with a named volume
```
Then point a domain at the server and run `deploy/nginx.conf` + `certbot --nginx` for free HTTPS
(`deploy/DEPLOY.md` has the exact commands, plus a systemd unit and PM2 config).

---

## After deploying — 60-second checklist

```bash
curl -I https://YOUR-DOMAIN/api/health        # 200, application/json
```
Then in a browser: landing page → Join free → complete onboarding → post something → refresh (post must survive)
→ log out → log back in. Set `CANONICAL_HOST=yourdomain.com` once the domain is final.

## Backups (single folder)

```bash
sqlite3 $DATA_DIR/genzhub.db ".backup '/backups/genzhub-$(date +%F).db'"
tar czf /backups/uploads-$(date +%F).tgz -C $DATA_DIR uploads
```
