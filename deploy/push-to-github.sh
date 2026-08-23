#!/usr/bin/env bash
# Gen-Z Hub → GitHub push helper.
# ব্যবহার:  GH_USER=তোমার_ইউজারনেম GH_TOKEN=ghp_xxx bash deploy/push-to-github.sh [repo-name]
# টোকেন কোথাও সেভ হয় না — শুধু এই একবারের push-এ ব্যবহার হয়, তারপর remote মুছে ফেলা হয়।
set -e
REPO="${1:-genz-hub}"
: "${GH_USER:?GH_USER দাও}" ; : "${GH_TOKEN:?GH_TOKEN দাও}"
cd "$(dirname "$0")/.."

# repo না থাকলে বানাও (public)
curl -s -o /dev/null -w "create repo: %{http_code}\n" -X POST https://api.github.com/user/repos \
  -H "Authorization: Bearer $GH_TOKEN" -H "Accept: application/vnd.github+json" \
  -d "{\"name\":\"$REPO\",\"private\":false,\"description\":\"Gen-Z Hub — Connect. Build. Play. Grow.\"}"

git init -q 2>/dev/null || true
git add -A && git commit -qm "Gen-Z Hub — full-stack social platform" 2>/dev/null || true
git branch -M main
git remote remove origin 2>/dev/null || true
git remote add origin "https://${GH_USER}:${GH_TOKEN}@github.com/${GH_USER}/${REPO}.git"
git push -u origin main --force
git remote remove origin          # টোকেন আর কোথাও থাকল না
echo "✅ Done → https://github.com/${GH_USER}/${REPO}"
echo "এখন Render → New + → Blueprint → এই repo সিলেক্ট করো।"
