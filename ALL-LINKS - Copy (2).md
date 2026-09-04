# 🔗 GEN-Z HUB — সব লিংক এক জায়গায় (পথ C: তুমি নিজে করবে)

## ১) 📥 কোড ডাউনলোড (যেকোনো একটা)

| উৎস | লিংক |
|---|---|
| সরাসরি ডাউনলোড | https://tmpfiles.org/dl/wIwK2wLSCPQ0/genz-hub-deploy.zip |
| মিরর ১ | https://gofile.io/d/FGsyf5CQ |
| মিরর ২ | https://tmpfiles.org/dl/w8wM29LWOpYL/genz-hub-deploy.zip |
| Workspace | `genz-hub-deploy.zip` (193 KB) |

জিপ খুললে ভেতরে একটা `genz-hub` ফোল্ডার — এটাই পুরো ওয়েবসাইট (৫৭ ফাইল)।

---

## ২) 🐙 GitHub (কোড রাখার জায়গা)

| কাজ | লিংক |
|---|---|
| সাইন-আপ | https://github.com/signup |
| নতুন repo বানাও | https://github.com/new |
| টোকেন (দরকার হলে) | https://github.com/settings/tokens |

**repo বানানোর সময়:** নাম `genz-hub` · **Public** · README টিক দিও না · **Create repository**

**ফাইল আপলোড:** repo পেজে → **Add file ▾ → Upload files** →
জিপ **আনজিপ করে** ভেতরের সব ফাইল (`src`, `public`, `deploy`, `package.json`, `render.yaml` …) ড্র্যাগ করো → **Commit changes**

> ⚠️ জিপ ফাইলটা আপলোড কোরো না · `node_modules` / `data` ফোল্ডার থাকলে বাদ দাও

---

## ৩) 🚀 Render (হোস্টিং — ফ্রি, কার্ড লাগে না)

| কাজ | লিংক |
|---|---|
| সাইন-আপ / লগইন | https://dashboard.render.com/register |
| ড্যাশবোর্ড | https://dashboard.render.com |
| নতুন Blueprint | https://dashboard.render.com/select-repo?type=blueprint |
| নতুন Web Service (বিকল্প) | https://dashboard.render.com/select-repo?type=web |
| ডকুমেন্টেশন | https://render.com/docs/free |

**ধাপ:** Sign in with GitHub → **New + → Blueprint** → `genz-hub` repo → **Apply** → ৩–৫ মিনিট বিল্ড
→ লিংক: `https://genz-hub-xxxx.onrender.com`

**Blueprint অপশন না পেলে — Web Service দিয়ে:**

| ফিল্ড | মান |
|---|---|
| Language / Runtime | **Node** |
| Region | **Singapore** |
| Build Command | `npm ci --omit=dev` |
| Start Command | `node src/server.js` |
| Instance Type | **Free** |
| Health Check Path | `/api/health` |

**Environment variables:**

| Key | Value |
|---|---|
| `NODE_ENV` | `production` |
| `DATA_DIR` | `/tmp/genzhub-data` |
| `DEMO_SEED` | `1` |
| `ADMIN_EMAIL` | তোমার ইমেইল |
| `ADMIN_PASSWORD` | নিজের একটা শক্ত পাসওয়ার্ড |

---

## ৪) 🔑 সাইটে লগইন (ডিপ্লয়ের পর)

| কে | Email | Password |
|---|---|---|
| তোমার টেস্ট ইউজার | `demo@genzhub.app` | `Demo12345` |
| Ayesha (founder) | `ayesha@demo.genzhub.app` | `Demo12345` |
| Raiyan (gamer) | `raiyan@demo.genzhub.app` | `Demo12345` |
| Mahi · Shakib · Tahmid · Nusrat · Fahim · Zarin · Arif | `<নাম>@demo.genzhub.app` | `Demo12345` |
| পুরনো ডেমো | `rafi@` / `tanvir@demo.genzhub.app` | `GenzDemo123` |
| **Admin** | তোমার দেওয়া `ADMIN_EMAIL` | তোমার দেওয়া `ADMIN_PASSWORD` |

চেক: `https://তোমার-লিংক/api/health` → `{"status":"ok"}`

---

## ৫) 📚 গাইড ফাইল (জিপের ভেতরে + workspace-এ)

| ফাইল | কী আছে |
|---|---|
| `deploy/RENDER-STEP-BY-STEP.md` | Render-এর পূর্ণ গাইড (বাংলা) |
| `deploy/SHARED-HOSTING-cPANEL.md` | শেয়ার্ড হোস্টিং কিনলে (বাংলা) |
| `deploy/SLEEPING-LINK.md` | "মরে না, ঘুমায়" হোস্টিং তুলনা |
| `deploy/DEPLOY.md` | VPS / Docker / nginx / HTTPS |
| `START-HERE.md` | টেস্ট চেকলিস্ট |
| `README.md` | পুরো প্রজেক্টের ডকুমেন্টেশন |

---

## ৬) 🌐 পরে আসল হোস্টিং কিনলে

| দরকার | লিংক |
|---|---|
| ডোমেইন (সস্তা) | https://www.namecheap.com · https://www.cloudflare.com/products/registrar/ |
| Fly.io (ফ্রি, ডেটাও টেকে) | https://fly.io/app/sign-up |
| BD হোস্টিং (Node.js সহ cPanel) | ExonHost · Hostever · IT Nut Hosting · DianaHost |

কেনার আগে জিজ্ঞেস করবে: **"cPanel-এ Setup Node.js App আছে? Node 18/20 দেবেন? SSH আছে? 1GB RAM?"**

---

## ৭) 🩹 আটকে গেলে

| সমস্যা | সমাধান |
|---|---|
| Build fail (`better-sqlite3`) | Render → Manual Deploy → **Clear build cache & deploy** |
| প্রথম লোডে ৩০–৫০ সেকেন্ড | স্বাভাবিক, ঘুম থেকে জাগছে |
| সাইট খালি, ডেমো ডেটা নেই | Environment-এ `DEMO_SEED=1` আছে কিনা দেখো → Manual Deploy |
| পোস্ট মুছে গেছে | ফ্রি টিয়ারে ডিস্ক নেই — স্বাভাবিক। ডেটা রাখতে: paid disk / cPanel / VPS |
| অন্য কিছু | স্ক্রিনশট বা লগ পাঠাও, আমি ঠিক করে দেব |
