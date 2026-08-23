#!/usr/bin/env bash
# Gen-Z Hub — one command to bring the demo back up (install deps if needed, start server, open a public link)
set -e
cd "$(dirname "$0")"
[ -d node_modules ] || npm ci --omit=dev
pkill -f "[s]rc/server.js" 2>/dev/null || true
pkill -f "[c]loudflared tunnel" 2>/dev/null || true
sleep 1
DATA_DIR="$PWD/data" PORT=${PORT:-3000} node src/server.js &
sleep 3
curl -sf "http://127.0.0.1:${PORT:-3000}/api/health" >/dev/null && echo "✅ app running on http://localhost:${PORT:-3000}"
if [ -x /tmp/cloudflared ]; then
  echo "opening public link…"
  /tmp/cloudflared tunnel --no-autoupdate --protocol quic --url "http://127.0.0.1:${PORT:-3000}" 2>&1 | grep -m1 -oE "https://[a-z0-9-]+\.trycloudflare\.com" &
fi
wait
