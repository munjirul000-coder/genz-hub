# 🔧 Render ঠিক করার নির্দেশনা — Blueprint not found + ডেটা স্থায়ী করা

## সমস্যা ১ — "Blueprint … not found on main branch"

স্ক্রিনশটে দেখা গেছে **Blueprint Path** ঘরে পুরো YAML লেখাটা পেস্ট করা হয়েছে।
ওই ঘরে **ফাইলের নাম** যায়, ফাইলের ভেতরের লেখা নয়।

- ✅ সঠিক: ঘরটা **খালি** রাখো (ডিফল্টেই root-এর `render.yaml` ধরে নেবে), বা শুধু লেখো `render.yaml`
- ❌ ভুল: `services: - type: web name: genz-hub ...` (পুরো YAML পেস্ট করা)

YAML-টা থাকবে repo-র **root**-এ `render.yaml` নামের ফাইলের ভেতরে।

---

## সমস্যা ২ — `/tmp`-এ ডেটা রাখা যাবে না

`/tmp` রিস্টার্টে মুছে যায়। তাই দুইটা কনফিগ বানিয়েছি:

| ফাইল | plan | ডেটা কোথায় | ডেটা টেকে? | খরচ |
|---|---|---|---|---|
| **`render.yaml`** (ডিফল্ট) | starter | **persistent disk** `/var/data` (1 GB) | ✅ হ্যাঁ | ~$7/মাস |
| `render-free.yaml` | free | `/opt/render/project/src/data` | ❌ না (রিস্টার্টে রিসেট) | ০ |

> Render-এ **persistent disk শুধু পেইড ইনস্ট্যান্সে** পাওয়া যায় — এটা Render-এর নিয়ম, কোডের সীমা নয়।
> ফ্রিতে ডেটাও টেকাতে চাইলে **Fly.io** (ফ্রি volume) — `deploy/SLEEPING-LINK.md` দেখো।

**যাচাই করা হয়েছে** (লোকালি, Render-এর মতো করে `DATA_DIR` আলাদা ডিস্কে রেখে):
1. ১ম বুট → ডেমো ওয়ার্ল্ড সিড হলো → নতুন পোস্ট তৈরি (HTTP 200)
2. সার্ভার বন্ধ → আবার চালু → **আগের পোস্ট অক্ষত ✅**, আর নতুন করে সিডও হয়নি ✅

---

## তোমার করণীয় — ধাপে ধাপে

### ধাপ ১ — GitHub-এ `render.yaml` আপডেট করো

1. যাও `https://github.com/munjirul000-coder/genz-hub`
2. `render.yaml` ফাইলে ক্লিক → ✏️ **Edit this file**
3. ভেতরের সব মুছে নিচেরটা পেস্ট করো → **Commit changes**

```yaml
services:
  - type: web
    name: genz-hub
    runtime: node
    plan: starter
    region: singapore
    buildCommand: npm install --omit=dev --no-audit --no-fund
    startCommand: node src/server.js
    healthCheckPath: /api/health
    autoDeploy: true
    disk:
      name: genzhub-data
      mountPath: /var/data
      sizeGB: 1
    envVars:
      - key: NODE_VERSION
        value: "20.19.0"
      - key: NODE_ENV
        value: production
      - key: DATA_DIR
        value: /var/data
      - key: DEMO_SEED
        value: "1"
      - key: ADMIN_EMAIL
        value: admin@genzhub.app
      - key: ADMIN_PASSWORD
        generateValue: true
```

4. `.node-version` ফাইল আছে কিনা দেখো — না থাকলে **Add file → Create new file**,
   নাম `.node-version`, ভেতরে শুধু `20.19.0`, তারপর Commit

### ধাপ ২ — Render-এ পুরনো ব্যর্থ জিনিস মুছে ফেলো

- Render → **Blueprints** → **Gen z hub** → **Settings** → **Delete Blueprint**
- **Resources**-এ `genz-hub-bd` সার্ভিস থাকলে → Settings → **Delete Web Service**

### ধাপ ৩ — নতুন করে Blueprint চালাও

1. **New + → Blueprint**
2. Repository: `munjirul000-coder/genz-hub` · Branch: **main**
3. **Blueprint Path: ঘরটা একদম খালি রাখো** ← এবার এখানে কিছু পেস্ট কোরো না
4. **Apply / Create Resources** → Starter প্ল্যান হওয়ায় কার্ড চাইবে ($7/মাস)

### ধাপ ৪ — লগে যা দেখবে

```
added 123 packages
==> Build successful 🎉
[demo] empty database detected — seeding the demo world…
=== GEN-Z HUB DEMO WORLD READY ===
Gen-Z Hub running on http://0.0.0.0:10000 (production)
==> Your service is live 🎉
```

### ধাপ ৫ — লগইন

- `demo@genzhub.app` / `Demo12345`
- Admin: `admin@genzhub.app` → পাসওয়ার্ড: Render → service → **Environment** → `ADMIN_PASSWORD` → **Reveal**

---

## টাকা খরচ ছাড়া আগে টেস্ট করতে চাইলে

ধাপ ১-এ `render.yaml`-এ এই কনটেন্টটা দাও (ফ্রি; সব ফিচার চলবে, তবে রিস্টার্টে ডেটা রিসেট হবে):

```yaml
services:
  - type: web
    name: genz-hub
    runtime: node
    plan: free
    region: singapore
    buildCommand: npm install --omit=dev --no-audit --no-fund
    startCommand: node src/server.js
    healthCheckPath: /api/health
    autoDeploy: true
    envVars:
      - key: NODE_VERSION
        value: "20.19.0"
      - key: NODE_ENV
        value: production
      - key: DATA_DIR
        value: /opt/render/project/src/data
      - key: DEMO_SEED
        value: "1"
      - key: ADMIN_EMAIL
        value: admin@genzhub.app
      - key: ADMIN_PASSWORD
        generateValue: true
```

পরে ডেটা স্থায়ী করতে: `plan: starter` + `disk:` ব্লক + `DATA_DIR=/var/data` করে commit — Render নিজেই রি-ডিপ্লয় করবে।

---

## আটকে গেলে

Render → service → **Logs** → শেষ ২০ লাইন পাঠাও।

| লগে | সমাধান |
|---|---|
| `node-gyp` / `prebuild-install` | `.node-version` = `20.19.0` আছে কিনা দেখো |
| `Cannot find module .../src/server.js` | repo-র root-এ `src` ফোল্ডার আছে কিনা দেখো (আরেকটা ফোল্ডারের ভেতরে নয়) |
| `Port scan timeout` | Environment-এ **`PORT` ভেরিয়েবল যোগ কোরো না** |
| `disk is only available on paid instance types` | হয় Starter নাও, নয়তো ফ্রি ভার্সনের YAML ব্যবহার করো |
