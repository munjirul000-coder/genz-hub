# 🚀 GEN-Z HUB — এখনই খোলো

**Connect. Build. Play. Grow.**

## 🔗 দুইটা লিংক (একটা না চললে অন্যটা)

**Link A — Serveo (এইটা bookmark করো)**
https://6acc5fa5358aa425-136-66-212-136.serveousercontent.com

**Link B — Cloudflare (backup)**
https://deaf-guardian-rehab-reads.trycloudflare.com


> Link A (Serveo) আমার সার্ভার-কি + IP থেকে তৈরি, তাই রিস্টার্ট করলেও **সাধারণত একই ঠিকানা** ফিরে আসে —
> এটাই bookmark করো। Link B প্রতিবার বদলায়।

দুইটাই এইমাত্র টেস্ট করা: `/` → 200, `/api/health` → 200, ডেমো লগইন → 200, ফিড API আসল পোস্ট রিটার্ন করছে।
ওয়ার্কস্পেসের ভেতরে চাইলে **Gen-Z Hub** প্রিভিউ প্যানেল (port 3000)-ও ব্যবহার করতে পারো।

## 👤 লগইন

| কে | Email | Password |
|---|---|---|
| **তোমার অ্যাকাউন্ট** | `demo@genzhub.app` | `Demo12345` |
| Admin panel | `admin@genzhub.app` | `AdminGenz2026` |
| Ayesha (founder) | `ayesha@demo.genzhub.app` | `Demo12345` |
| Raiyan (gamer) | `raiyan@demo.genzhub.app` | `Demo12345` |
| Mahi · Shakib · Tahmid · Nusrat · Fahim · Zarin · Arif | `<নাম>@demo.genzhub.app` | `Demo12345` |

`demo` দিয়ে ঢুকলেই: 🔔 **6 unread notification** · 💬 **5 unread message** · 🤝 **2 connection request** ·
নিজের private group-এ **2 join request** · 4টা লাইভ স্টোরি · saved পোস্ট।

## ⚠️ লিংক কেন বন্ধ হয়ে যায়

এই লিংকগুলো আমার ওয়ার্কস্পেস থেকে চলে। **আমি কাজ না করলে ওয়ার্কস্পেস ঘুমিয়ে পড়ে → সার্ভার বন্ধ → লিংক ডেড।**
২৪ ঘণ্টা চালু থাকা ঠিকানা পেতে একবার নিজের হোস্টিং-এ বসাতে হবে (নিচে)। কোড, ডেটা, ডিজাইন সব রেডি — শুধু হোস্ট লাগবে।

## 🌍 স্থায়ী করার সবচেয়ে সহজ পথ (একবারই, ~10 মিনিট)

### Fly.io — ফ্রি ভলিউম, কার্ড ছাড়া শুরু করা যায়
```bash
# নিজের কম্পিউটারে genz-hub-deploy.zip আনজিপ করে ভিতরে ঢুকে:
npm i -g flyctl
fly auth signup            # অথবা fly auth login
fly launch --no-deploy     # সাথে থাকা fly.toml ব্যবহার করবে
fly volumes create genzhub_data --size 3
fly secrets set ADMIN_EMAIL=you@example.com ADMIN_PASSWORD='StrongPass123'
fly deploy                 # → https://<app-name>.fly.dev  (স্থায়ী)
```

### অথবা যেকোনো VPS (৳500/মাস) — Docker দিয়ে
```bash
unzip genz-hub-deploy.zip && cd genz-hub
printf 'ADMIN_EMAIL=you@example.com\nADMIN_PASSWORD=StrongPass123\n' > .env
docker compose up -d --build       # :3000 এ চলবে, ডেটা volume-এ থাকবে
```
ডোমেইন থাকলে `deploy/nginx.conf` + `certbot --nginx` দিয়ে ফ্রি HTTPS।

### Render.com — GitHub-এ পুশ করে New → Blueprint (`render.yaml` অটো পড়বে; ডিস্কের জন্য পেইড ইনস্ট্যান্স)

ডিপ্লয়ের পর ডেমো ডেটা বসাতে: `node src/demo-seed.js --fresh`

## 🧪 টেস্ট রুট (১৫ মিনিট)

1. স্টোরিতে ট্যাপ → নিজের স্টোরি দাও
2. পোস্ট করো (ছবি + #hashtag) → **refresh** → পোস্ট থাকবে
3. Like (চেপে ধরলে 🔥👏🤯) · Comment · Reply · 🔁 Share · 📑 Save
4. 🔔 Notifications → Mark all as read
5. Network → Mahiya/Tahmid-এর request **Accept**
6. 💬 Messages → 3টা চ্যাটে রিপ্লাই
7. 💼 Business Hub → Collaboration board → নিজে পোস্ট
8. 🎮 Gaming Hub → Teams → Games ট্যাবে গেম সেভ
9. 👥 Demo Private Group → ⚙️ Manage → join request approve
10. 🌐 Communities · 📅 Events (Going/Interested)
11. ⚙️ Settings → Dark mode · বাংলা
12. 🛡️ Admin → Reports → resolve/dismiss
13. 📱 ফোনে খুলে bottom nav, ➕ Create, ☰ Menu


## 🔁 লিংক মরে গেলে কী করবে

আমাকে শুধু লিখো **"link"** — ৩০ সেকেন্ডে নতুন লিংক দিয়ে দেব।
নিজের কম্পিউটারে চালাতে চাইলে (কখনো মরবে না):

```bash
unzip genz-hub-deploy.zip && cd genz-hub
npm ci --omit=dev
node src/server.js        # → http://localhost:3000
node src/demo-seed.js --fresh   # ডেমো ডেটা বসাতে
```
