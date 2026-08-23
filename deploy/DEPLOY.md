# Deploying Gen-Z Hub as a live website

The app is a single Node process serving both the API and the site, with SQLite + an uploads folder on one
persistent volume (`DATA_DIR`). Pick any option below.

## 0. Environment variables

| Variable | Purpose | Example |
|---|---|---|
| `PORT` | HTTP port | `3000` |
| `NODE_ENV` | `production` enables HSTS, secure cookies, static caching, HTTPS redirect | `production` |
| `DATA_DIR` | persistent folder for `genzhub.db` + `uploads/` | `/data` |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | bootstrap admin account (created on first run) | — |
| `CANONICAL_HOST` | optional; 301-redirects every other host to this one | `genzhub.app` |

Never commit real values — copy `.env.example` to `.env`.

## 1. Docker (any VPS)

```bash
cp .env.example .env && edit .env          # set a strong ADMIN_PASSWORD
docker compose up -d --build
curl localhost:3000/api/health
```

## 2. VPS without Docker (Ubuntu + nginx + HTTPS)

```bash
sudo adduser --system --group genzhub
sudo mkdir -p /opt/genzhub /var/lib/genzhub && sudo chown -R genzhub /var/lib/genzhub
sudo rsync -a --exclude node_modules --exclude data ./ /opt/genzhub/
cd /opt/genzhub && sudo -u genzhub npm ci --omit=dev

sudo cp deploy/genzhub.service /etc/systemd/system/
printf 'ADMIN_EMAIL=you@example.com\nADMIN_PASSWORD=StrongPass123\n' | sudo tee /etc/genzhub.env
sudo systemctl enable --now genzhub

sudo cp deploy/nginx.conf /etc/nginx/sites-available/genzhub
sudo ln -s /etc/nginx/sites-available/genzhub /etc/nginx/sites-enabled/
sudo certbot --nginx -d genzhub.example.com    # free TLS
sudo systemctl reload nginx
```

PM2 alternative: `pm2 start ecosystem.config.js --env production && pm2 save && pm2 startup`.

## 3. Render.com

Push the repo, then **New → Blueprint** and select `render.yaml`. It provisions the web service, a 5 GB
persistent disk mounted at `/var/data`, and the `/api/health` check. Set `ADMIN_EMAIL` in the dashboard.

## 4. Fly.io

```bash
fly launch --no-deploy
fly volumes create genzhub_data --size 3
fly secrets set ADMIN_EMAIL=you@example.com ADMIN_PASSWORD=StrongPass123
fly deploy
```

## 5. Custom domain checklist

1. `A` record → server IP (or the platform's target).
2. Issue TLS (certbot, or automatic on Render/Fly).
3. Set `CANONICAL_HOST=yourdomain.com` and `NODE_ENV=production`.
4. Verify: `curl -I https://yourdomain.com/api/health` → `200`, and cookies show `Secure; HttpOnly; SameSite=Lax`.

## 6. Backups

Everything lives in `DATA_DIR`. Nightly cron:

```bash
0 3 * * * sqlite3 /var/lib/genzhub/genzhub.db ".backup '/backups/genzhub-$(date +\%F).db'" \
  && tar czf /backups/uploads-$(date +\%F).tgz -C /var/lib/genzhub uploads
```

## 7. Scaling notes

SQLite runs in WAL mode and handles a single writer — keep **one** app instance and scale vertically first.
For horizontal scaling, swap `src/db.js` for Postgres (the query layer is centralised in `src/db.js`,
`src/feed.js` and `src/routes/*`) and move uploads to object storage.
