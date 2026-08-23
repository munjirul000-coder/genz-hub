# 🪜 GEN-Z HUB লাইভ করার ধাপে ধাপে গাইড
### কোন সময় ঠিক কী করতে হবে — শুরু থেকে শেষ (মোট ~২০ মিনিট)

---

## ধাপ ০ — শুরুর আগে (২ মিনিট)

**যা লাগবে:**
- একটা **কম্পিউটার/ল্যাপটপ** (ফোনে ফাইল আপলোড কঠিন — নিচে ফোনের বিকল্প আছে)
- একটা ইমেইল ঠিকানা
- ইন্টারনেট

**যা লাগবে না:** ক্রেডিট কার্ড · টাকা · কোডিং জ্ঞান

> 📱 **শুধু ফোন আছে?** তাহলে ধাপ ১–৫ বাদ দিয়ে সরাসরি আমাকে বলো —
> তুমি শুধু GitHub-এ সাইন-আপ করে একটা টোকেন দেবে, কোড পুশ করা আমি করে দেব।

---

## ধাপ ১ — কোড ডাউনলোড (১ মিনিট)

1. ব্রাউজারে খোলো: **https://tmpfiles.org/dl/wIwK2wLSCPQ0/genz-hub-deploy.zip**
2. `genz-hub-deploy.zip` ফাইলটা Downloads ফোল্ডারে নামবে (193 KB)

✅ **চেকপয়েন্ট:** ফাইলটা Downloads-এ আছে
❌ লিংক কাজ না করলে মিরর: **https://gofile.io/d/FGsyf5CQ**

---

## ধাপ ২ — জিপ আনজিপ করো (১ মিনিট)

1. ফাইলটার উপর **ডান-ক্লিক** → **Extract All / এখানে আনজিপ করুন**
2. একটা `genz-hub-deploy` ফোল্ডার হবে, তার **ভেতরে আরেকটা `genz-hub` ফোল্ডার**
3. ওই ভেতরের `genz-hub` ফোল্ডারটা খোলো

✅ **চেকপয়েন্ট:** ভেতরে এই জিনিসগুলো দেখছো —
`src` · `public` · `deploy` · `package.json` · `render.yaml` · `README.md`

> এই ফোল্ডারটাই তোমার পুরো ওয়েবসাইট। এটাকে খোলা রাখো, ধাপ ৫-এ লাগবে।

---

## ধাপ ৩ — GitHub অ্যাকাউন্ট (৩ মিনিট)

1. যাও: **https://github.com/signup**
2. ইমেইল দাও → পাসওয়ার্ড দাও → username দাও (যেমন `rafi2026`) → Continue
3. ইমেইলে আসা **৬ সংখ্যার কোড** বসাও
4. "How many team members?" ইত্যাদি প্রশ্ন আসলে **Skip / Continue for free** চাপো

✅ **চেকপয়েন্ট:** তুমি github.com-এ লগইন অবস্থায় আছো (উপরে ডানে তোমার ছবি/অক্ষর দেখাচ্ছে)

---

## ধাপ ৪ — খালি repo বানাও (১ মিনিট)

1. যাও: **https://github.com/new**
2. **Repository name:** `genz-hub`
3. **Public** সিলেক্ট করো (গুরুত্বপূর্ণ)
4. "Add a README file" — **টিক দিও না**
5. নিচে সবুজ **Create repository** চাপো

✅ **চেকপয়েন্ট:** একটা খালি পেজ এসেছে যেখানে লেখা *"Quick setup — if you've done this kind of thing before"*

---

## ধাপ ৫ — কোড আপলোড (৩ মিনিট) ⭐ সবচেয়ে গুরুত্বপূর্ণ ধাপ

1. ওই পেজেই নীল লেখা **"uploading an existing file"**-এ ক্লিক করো
   (না দেখলে: **Add file ▾ → Upload files**)
2. ধাপ ২-এর `genz-hub` ফোল্ডারটা খোলো
3. ভেতরের **সব কিছু সিলেক্ট করো** (Ctrl+A) — অর্থাৎ `src`, `public`, `deploy`, `package.json`,
   `render.yaml`, `Dockerfile`, `README.md` সব
4. সিলেক্ট করা জিনিসগুলো **ড্র্যাগ করে** GitHub-এর বক্সে ছেড়ে দাও
5. আপলোড শেষ হওয়া পর্যন্ত অপেক্ষা করো (৫০+ ফাইল, ~১ মিনিট)
6. নিচে সবুজ **Commit changes** চাপো

⚠️ **ভুল কোরো না:**
- ❌ জিপ ফাইলটা আপলোড করা (আনজিপ করা ফাইল লাগবে)
- ❌ শুধু বাইরের ফোল্ডারটা টানা (ভেতরের ফাইলগুলো লাগবে)
- ❌ `node_modules` বা `data` ফোল্ডার আপলোড করা (থাকলে বাদ দাও)

✅ **চেকপয়েন্ট:** repo পেজে `src`, `public`, `deploy`, `package.json`, `render.yaml` ফোল্ডার/ফাইল দেখা যাচ্ছে

---

## ধাপ ৬ — Render অ্যাকাউন্ট (২ মিনিট)

1. যাও: **https://dashboard.render.com/register**
2. **GitHub** বাটনে ক্লিক করে সাইন-আপ করো (সবচেয়ে সহজ)
3. GitHub অনুমতি চাইলে **Authorize Render** চাপো
4. ইমেইল ভেরিফিকেশন চাইলে ইমেইল চেক করে লিংকে ক্লিক করো

✅ **চেকপয়েন্ট:** Render ড্যাশবোর্ড দেখছো (বাঁদিকে মেনু, উপরে **New +** বাটন)
💳 কার্ড চাইবে না — ফ্রি প্ল্যানে কার্ড লাগে না

---

## ধাপ ৭ — ডিপ্লয় করো (২ মিনিট)

1. উপরে ডানে **New +** → **Blueprint**
   (সরাসরি লিংক: **https://dashboard.render.com/select-repo?type=blueprint**)
2. তোমার `genz-hub` repo খুঁজে **Connect** চাপো
   - repo না দেখালে → **Configure account** → GitHub-এ **All repositories** allow করো
3. Render নিজে থেকেই `render.yaml` পড়ে সব সেটিং দেখাবে (Node, Singapore, Free, env variables)
4. **Blueprint Name** যা আছে রেখে দাও → নিচে **Apply / Create Resources** চাপো

✅ **চেকপয়েন্ট:** একটা সার্ভিস তৈরি হয়েছে আর লগ স্ক্রল করছে

> **Blueprint অপশন খুঁজে না পেলে** → **New + → Web Service** → repo সিলেক্ট → এই মানগুলো দাও:
> Runtime **Node** · Region **Singapore** · Build `npm ci --omit=dev` · Start `node src/server.js` ·
> Instance **Free** · Health Check `/api/health`
> তারপর **Environment** ট্যাবে: `NODE_ENV=production`, `DATA_DIR=/tmp/genzhub-data`,
> `DEMO_SEED=1`, `ADMIN_EMAIL=তোমার ইমেইল`, `ADMIN_PASSWORD=শক্ত পাসওয়ার্ড`

---

## ধাপ ৮ — বিল্ড শেষ হওয়ার অপেক্ষা (৩–৫ মিনিট)

লগে ধারাবাহিকভাবে এগুলো দেখবে:

```
==> Cloning from https://github.com/...
==> Running build command 'npm ci --omit=dev'...
added 120 packages
==> Build successful 🎉
==> Deploying...
[demo] empty database detected — seeding the demo world…
=== GEN-Z HUB DEMO WORLD READY ===
Gen-Z Hub running on http://0.0.0.0:10000 (production)
==> Your service is live 🎉
```

✅ **চেকপয়েন্ট:** উপরে সবুজ **Live** ব্যাজ, আর একটা URL: `https://genz-hub-xxxx.onrender.com`

❌ **Build failed** দেখালে → **Manual Deploy ▾ → Clear build cache & deploy** → আবার অপেক্ষা করো।
তাতেও না হলে লগের শেষ ২০ লাইন আমাকে পাঠাও।

---

## ধাপ ৯ — সাইট খোলো ও লগইন করো (২ মিনিট)

1. উপরের URL-এ ক্লিক করো → **Connect. Build. Play. Grow.** ল্যান্ডিং পেজ আসবে
2. **Log in** চাপো → ডেমো বাটনে ট্যাপ করলেই ইমেইল-পাসওয়ার্ড ভরে যাবে:

| কে | Email | Password |
|---|---|---|
| তোমার টেস্ট ইউজার | `demo@genzhub.app` | `Demo12345` |
| Ayesha (founder) | `ayesha@demo.genzhub.app` | `Demo12345` |
| Raiyan (gamer) | `raiyan@demo.genzhub.app` | `Demo12345` |
| **Admin** | তোমার দেওয়া `ADMIN_EMAIL` | তোমার দেওয়া `ADMIN_PASSWORD` |

> Blueprint দিয়ে করলে অ্যাডমিন পাসওয়ার্ড Render বানিয়ে দিয়েছে →
> Render → service → **Environment** → `ADMIN_PASSWORD` → **Reveal**

✅ **চেকপয়েন্ট:** ফিডে পোস্ট দেখছো, উপরে 🔔 আর 💬 তে লাল সংখ্যা

---

## ধাপ ১০ — সব ফিচার টেস্ট করো (১০ মিনিট)

ক্রমানুসারে:

1. **স্টোরি** — উপরের গোল ছবিগুলোতে ট্যাপ · "＋ Your story" দিয়ে নিজেরটা দাও
2. **পোস্ট** — "What is happening?" → লেখো + ছবি + #hashtag → Publish → **refresh** করো, পোস্ট থাকবে
3. **রিঅ্যাকশন** — 👍 চাপো (চেপে ধরলে 🔥👏🤯) · Comment · কমেন্টে **Reply** · 🔁 Share · 📑 Save
4. **নোটিফিকেশন** 🔔 — Ayesha-র রিঅ্যাকশন, Shakib-এর কমেন্ট দেখবে → **Mark all as read**
5. **Network** — Mahiya আর Tahmid-এর connection request **Accept** করো
6. **Messages** 💬 — ৩টা চ্যাটে রিপ্লাই দাও
7. **Business Hub** 💼 — Join → *Post here* → **Collaboration** ট্যাবে co-founder পোস্ট দেখো
8. **Gaming Hub** 🎮 — **Teams** ট্যাব → **Games** ট্যাবে পছন্দের গেম সেভ করো
9. **Groups** 👥 — *Demo Private Group* → **⚙️ Manage** → join request **Approve**
10. **Communities / Events** 🌐📅 — Join · RSVP **Going/Interested**
11. **Settings** ⚙️ — **Dark mode** · **বাংলা** ভাষা
12. **Admin** 🛡️ — অ্যাডমিন দিয়ে লগইন → **Reports** → resolve/dismiss
13. **ফোনে** 📱 — একই লিংক ফোনে খোলো → নিচে bottom nav, ➕ Create, ☰ Menu

---

## ধাপ ১১ — মনে রাখার বিষয় (ফ্রি প্ল্যান)

| বিষয় | ব্যাখ্যা |
|---|---|
| ১৫ মিনিট কেউ না ঢুকলে **ঘুমায়** | পরের ভিজিটে ৩০–৫০ সেকেন্ড লোড নেবে — **লিংক মরে না** |
| তোমার বানানো পোস্ট **রিসেট** হতে পারে | ফ্রিতে ডিস্ক নেই; জেগে উঠলে ডেমো ডেটায় ফিরে যায় |
| সব ফিচার পুরোপুরি কাজ করে | শুধু ডেটা দীর্ঘমেয়াদে টেকে না |

---

## ধাপ ১২ — পরে: ডেটা স্থায়ী করা

**অপশন ১ — Render paid disk (~$7/মাস):** `render.yaml`-এ `plan: starter` করো,
নিচের `disk:` ব্লক আনকমেন্ট করো, `DATA_DIR=/var/data` করো → push → অটো রি-ডিপ্লয়

**অপশন ২ — শেয়ার্ড হোস্টিং (৳২০০০–৪০০০/বছর):** `deploy/SHARED-HOSTING-cPANEL.md` দেখো
(কেনার আগে জিজ্ঞেস করো: *"cPanel-এ Setup Node.js App আছে? Node 18/20? SSH? 1GB RAM?"*)

**অপশন ৩ — Fly.io (ফ্রি + ডেটা টেকে):** `deploy/SLEEPING-LINK.md`

**ডোমেইন:** Namecheap / Cloudflare → Render → Settings → **Custom Domain** → CNAME বসাও

---

## 🆘 আটকে গেলে কী পাঠাবে

| সমস্যা | আমাকে পাঠাও |
|---|---|
| GitHub-এ আপলোড হচ্ছে না | কোন স্ক্রিনে আছো তার স্ক্রিনশট |
| Render build failed | লগের শেষ ২০ লাইন |
| সাইট খোলে না | তোমার onrender.com লিংকটা |
| ডেমো ডেটা নেই | Environment ট্যাবের স্ক্রিনশট |

প্রতিটা ধাপে আমি আছি — একটা ধাপ শেষ করে "ধাপ ৫ শেষ" লিখলেই পরেরটা ধরিয়ে দেব। 💪
