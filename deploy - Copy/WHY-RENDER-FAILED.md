# 🚨 আসল সমস্যা: repo-তে ভুল প্রজেক্ট আছে

## যা পেলাম (তোমার পাবলিক repo সরাসরি পড়ে)

`github.com/munjirul000-coder/genz-hub` — main branch:

```
.gitignore  .node-version  Dockerfile  README.md
next.config.mjs  package-lock.json  package.json
postcss.config.mjs  render.yaml  tailwind.config.js
```

সেখানকার `package.json`:

```json
{ "name": "genz-hub-bd",
  "scripts": { "build": "next build", "start": "next start ..." },
  "dependencies": { "next": "^16.3.1", "react": "19.0.0", "recharts": "...", "framer-motion": "..." },
  "devDependencies": { "tailwindcss": "3.4.17", "postcss": "...", "autoprefixer": "..." } }
```

👉 এটা **Next.js + Tailwind**-এর সম্পূর্ণ আলাদা একটা প্রজেক্ট। আমাদের Gen-Z Hub-এর
`src/`, `public/`, `deploy/` — একটা ফোল্ডারও ওখানে নেই।

`picomatch@2.3.2` vs `picomatch@4.0.5` — এই দুইটা **tailwind/next-এর ভেতরের ডিপেন্ডেন্সি**।
আমাদের প্রজেক্টে picomatch নামের কোনো প্যাকেজই নেই। তাই আমার এখানে lock ফাইল যতবারই
নতুন করে বানাই, তোমার Render বিল্ড ঠিক হবে না — কারণ Render **অন্য একটা প্রজেক্ট** বিল্ড করছে।

## আসল Gen-Z Hub কেমন হওয়ার কথা

```
package.json → name: genz-hub
dependencies : bcryptjs, better-sqlite3, compression, cookie-parser, express, multer
start        : node src/server.js
ফোল্ডার      : src/ (14 ফাইল)  public/ (16 ফাইল)  deploy/
lock         : 132 entries · 0 dev · picomatch নেই ✅
```

---

# ✅ সমাধান — repo-র কনটেন্ট বদলাও (১০ মিনিট)

## পথ ১ (সবচেয়ে পরিষ্কার) — নতুন repo

1. https://github.com/new → নাম **`genz-hub-app`** → **Public** → Create
2. **uploading an existing file** → `GENZHUB-UPLOAD-TO-GITHUB.zip` আনজিপ করে
   ভেতরের **সব ফাইল ও ফোল্ডার** (`src`, `public`, `deploy`, `package.json`,
   `package-lock.json`, `render.yaml`, `.node-version` …) ড্র্যাগ করে ছাড়ো → **Commit changes**
3. Render → পুরনো Blueprint ও `genz-hub-bd` সার্ভিস **Delete**
4. Render → **New + → Blueprint** → **`genz-hub-app`** repo → Branch `main`
   → **Blueprint Path ঘরটা খালি** → **Apply**

## পথ ২ — পুরনো repo পরিষ্কার করে

`genz-hub` repo-তে এই ৬টা ফাইল আগে **Delete** করো
(ফাইলে ক্লিক → 🗑️ Delete this file → Commit):

- `next.config.mjs`
- `postcss.config.mjs`
- `tailwind.config.js`
- `package.json`
- `package-lock.json`
- `Dockerfile`

তারপর উপরের ধাপ ২-এর মতো আমাদের ফাইলগুলো আপলোড করো → Render-এ
**Manual Deploy → Clear build cache & deploy**

---

## আপলোডের পর মিলিয়ে নাও (গুরুত্বপূর্ণ)

repo-র প্রথম পাতায় এগুলো **থাকতেই হবে**:

- [ ] `src/` ফোল্ডার (ভেতরে `server.js`, `db.js`, `routes/`)
- [ ] `public/` ফোল্ডার (ভেতরে `index.html`, `js/`, `css/`)
- [ ] `package.json` — খুলে দেখো ভেতরে **express** ও **better-sqlite3** আছে
- [ ] `package-lock.json` — name **genz-hub**
- [ ] `render.yaml`, `.node-version`

❌ থাকা যাবে না: `next.config.mjs`, `tailwind.config.js`, `postcss.config.mjs`

---

## Render-এর সেটিং (প্রজেক্ট স্ট্রাকচারের সাথে মেলানো)

| সেটিং | মান |
|---|---|
| Runtime | Node |
| Branch | `main` |
| Build Command | `npm ci && npm run build` |
| Start Command | `node src/server.js` |
| Health Check Path | `/api/health` |
| Instance | Free |
| Region | Singapore |

Environment variables:

```
NODE_VERSION = 20.19.0
NODE_ENV     = production
DATA_DIR     = /opt/render/project/src/data
DEMO_SEED    = 1
ADMIN_EMAIL  = admin@genzhub.app
ADMIN_PASSWORD = (নিজের একটা শক্ত পাসওয়ার্ড)
```

⚠️ `PORT` ভেরিয়েবল যোগ কোরো না — Render নিজেই দেয়।

সফল লগ:

```
added 123 packages, and audited 124 packages
Gen-Z Hub: no build step required (server-rendered SPA)
==> Build successful 🎉
[demo] empty database detected — seeding the demo world…
=== GEN-Z HUB DEMO WORLD READY ===
Gen-Z Hub running on http://0.0.0.0:10000 (production)
==> Your service is live 🎉
```

লগইন: `demo@genzhub.app` / `Demo12345` · Admin: `admin@genzhub.app` + তোমার দেওয়া পাসওয়ার্ড
