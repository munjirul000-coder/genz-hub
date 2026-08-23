# 🚀 Render.com-এ Gen-Z Hub বসানো — ধাপে ধাপে (১০ মিনিট, ফ্রি, কার্ড লাগে না)

শেষে যা পাবে: **https://genz-hub-xxxx.onrender.com** — লিংকটা কখনো মরবে না,
১৫ মিনিট কেউ না ঢুকলে ঘুমাবে, কেউ ঢুকলে ~৩০–৫০ সেকেন্ডে জেগে উঠে ডেমো ডেটাসহ চলবে।

---

## ধাপ ১ — কোড GitHub-এ তোলো (৪ মিনিট)

Render কোড পড়ে একটা Git repo থেকে। তাই আগে GitHub-এ তুলতে হবে।

1. **github.com** → Sign up (ফ্রি, ইমেইল দিয়ে)
2. উপরে ডানে **+ → New repository**
   - Repository name: `genz-hub`
   - **Public** সিলেক্ট করো
   - **Create repository**
3. পরের পেজে **“uploading an existing file”** লিংকে ক্লিক করো
4. কম্পিউটারে `genz-hub-deploy.zip` আনজিপ করো → ভেতরের **`genz-hub` ফোল্ডারের সব ফাইল**
   (`src`, `public`, `deploy`, `package.json`, `render.yaml` …) ড্র্যাগ করে ছেড়ে দাও
   > ⚠️ জিপ ফাইলটা আপলোড কোরো না — **আনজিপ করা ফাইলগুলো** দিতে হবে।
   > ⚠️ `node_modules` বা `data` ফোল্ডার আপলোড কোরো না (থাকলে বাদ দাও)।
5. নিচে **Commit changes** চাপো

কম্পিউটারে Git থাকলে আরও দ্রুত:
```bash
unzip genz-hub-deploy.zip && cd genz-hub
git init && git add -A && git commit -m "Gen-Z Hub"
git branch -M main
git remote add origin https://github.com/USERNAME/genz-hub.git
git push -u origin main
```

---

## ধাপ ২ — Render অ্যাকাউন্ট (২ মিনিট)

1. **render.com** → **Get Started** → **Sign in with GitHub** (সবচেয়ে সহজ)
2. GitHub-এর অনুমতি দাও (Render তোমার repo পড়তে পারবে)

---

## ধাপ ৩ — Blueprint দিয়ে ডিপ্লয় (৩ মিনিট)

1. Render ড্যাশবোর্ড → **New +** → **Blueprint**
2. তোমার `genz-hub` repo সিলেক্ট করো → **Connect**
3. Render নিজে থেকেই `render.yaml` পড়ে সব সেটিং নিয়ে নেবে:

| সেটিং | মান (অটো) |
|---|---|
| Runtime | Node |
| Build | `npm ci --omit=dev` |
| Start | `node src/server.js` |
| Health check | `/api/health` |
| Region | Singapore |
| Plan | Free |
| `NODE_ENV` | production |
| `DATA_DIR` | /tmp/genzhub-data |
| `DEMO_SEED` | 1 ← খালি ডেটাবেজ পেলে ডেমো ডেটা নিজে বসাবে |
| `ADMIN_PASSWORD` | Render নিজে বানাবে |

4. **Apply / Create** চাপো → ৩–৫ মিনিট বিল্ড হবে (লগ দেখতে পাবে)

> **Blueprint অপশন না পেলে** এভাবে করো: New + → **Web Service** → repo সিলেক্ট →
> Build `npm ci --omit=dev`, Start `node src/server.js`, Plan **Free**,
> তারপর Environment ট্যাবে উপরের ভেরিয়েবলগুলো হাতে যোগ করো।

---

## ধাপ ৪ — খোলো ও টেস্ট করো

Render তোমাকে একটা URL দেবে: **https://genz-hub-xxxx.onrender.com**

লগইন:

| কে | Email | Password |
|---|---|---|
| তোমার টেস্ট ইউজার | `demo@genzhub.app` | `Demo12345` |
| Ayesha (founder) | `ayesha@demo.genzhub.app` | `Demo12345` |
| Raiyan (gamer) | `raiyan@demo.genzhub.app` | `Demo12345` |
| Admin | `admin@genzhub.app` | Render → Environment → `ADMIN_PASSWORD` (Reveal চাপলে দেখাবে) |

চেক: `https://your-url.onrender.com/api/health` → `{"status":"ok"}`

---

## ⚠️ ফ্রি প্ল্যানে যা মনে রাখবে

| বিষয় | ব্যাখ্যা |
|---|---|
| **ঘুমায়** | ১৫ মিনিট কেউ না ঢুকলে ঘুমাবে; পরের ভিজিটে ৩০–৫০ সেকেন্ড লোড নেবে (একবারই) |
| **ডেটা রিসেট** | ফ্রি টিয়ারে ডিস্ক নেই → ঘুম/রিস্টার্টের পর তোমার বানানো পোস্ট মুছে ডেমো ডেটায় ফিরে যাবে |
| **টেস্টের জন্য ঠিক আছে** | সব ফিচার পুরোপুরি কাজ করবে, শুধু ডেটা দীর্ঘমেয়াদে টিকবে না |
| **আসল ডেটা রাখতে** | `render.yaml`-এ `plan: starter` করে disk ব্লকটা আনকমেন্ট করো + `DATA_DIR=/var/data` (~$7/মাস), অথবা শেয়ার্ড হোস্টিং/VPS |

---

## 🩹 সমস্যা হলে

| সমস্যা | সমাধান |
|---|---|
| Build fail — `better-sqlite3` | Render Node 20 ব্যবহার করে, রেডিমেড বাইনারি আছে; আবার **Manual Deploy → Clear build cache & deploy** দাও |
| প্রথম লোডে দেরি | স্বাভাবিক — ঘুম থেকে জাগছে, ৩০–৫০ সেকেন্ড অপেক্ষা করো |
| ডেমো ডেটা নেই | Environment-এ `DEMO_SEED=1` আছে কিনা দেখো → Manual Deploy |
| Admin পাসওয়ার্ড জানি না | Render → তোমার service → **Environment** → `ADMIN_PASSWORD` → **Reveal** |
| ডেটা মুছে গেছে | ফ্রি টিয়ারের স্বাভাবিক আচরণ (উপরের টেবিল দেখো) |

---

## পরে আসল হোস্টে সরানো

একই কোড, একই জিপ — শুধু `deploy/SHARED-HOSTING-cPANEL.md` (cPanel) বা `deploy/DEPLOY.md` (VPS/Docker)
অনুসরণ করলেই হবে। কিছু নতুন করে বানাতে হবে না।
