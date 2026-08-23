# 🏠 শেয়ার্ড হোস্টিং (cPanel) — Gen-Z Hub বসানোর সম্পূর্ণ গাইড

## ০. কেনার আগে অবশ্যই যাচাই করো

শেয়ার্ড হোস্টিং-এ Gen-Z Hub চলবে **শুধু তখনই**, যখন cPanel-এ এই আইকনটা থাকে:

> **Software → Setup Node.js App**
> (একে বলা হয় "Node.js Selector" — CloudLinux/LiteSpeed হোস্টে থাকে)

বিক্রেতাকে হুবহু এই প্রশ্নগুলো করো:

| # | প্রশ্ন | দরকারি উত্তর |
|---|---|---|
| 1 | cPanel-এ **Setup Node.js App** আছে? | হ্যাঁ |
| 2 | **Node.js 18 / 20** ভার্সন পাওয়া যাবে? | হ্যাঁ |
| 3 | **Terminal / SSH** access দেবেন? | হ্যাঁ (না হলেও চলবে, তবে কষ্ট বেশি) |
| 4 | RAM কত? **1 GB+** | হ্যাঁ |
| 5 | native npm module (better-sqlite3) ইনস্টল করা যাবে? | হ্যাঁ |

❌ শুধু **PHP / WordPress** হোস্টিং হলে **চলবে না** — টাকা নষ্ট হবে।
বাংলাদেশে Node.js সাপোর্ট সহ cPanel দেয় এমন হোস্ট: ExonHost, Hostever, IT Nut Hosting,
DianaHost, Alpha Net (কেনার আগে উপরের ৫টা প্রশ্ন করে নিশ্চিত হও)।

দাম সাধারণত **৳২০০০–৪০০০/বছর**। ডোমেইন আলাদা (`.xyz` ≈ ৳২০০, `.com` ≈ ৳১২০০/বছর)।

---

## ১. ফাইল আপলোড

1. cPanel → **File Manager** → `/home/username/` (public_html-এর **বাইরে**) ফোল্ডারে যাও
2. **Upload** → `genz-hub-deploy.zip` আপলোড করো
3. জিপে ডান-ক্লিক → **Extract** → ফোল্ডার হবে `genz-hub`

---

## ২. Node.js App তৈরি

cPanel → **Setup Node.js App** → **CREATE APPLICATION**

| ফিল্ড | মান |
|---|---|
| Node.js version | **20.x** (না থাকলে 18.x) |
| Application mode | **Production** |
| Application root | `genz-hub` |
| Application URL | তোমার ডোমেইন বা সাবডোমেইন (যেমন `genzhub.yourdomain.com`) |
| Application startup file | `src/server.js` |

**Environment variables** (ADD VARIABLE দিয়ে একে একে):

| নাম | মান |
|---|---|
| `NODE_ENV` | `production` |
| `DATA_DIR` | `/home/username/genzhub-data` ← username বদলে দাও |
| `ADMIN_EMAIL` | তোমার ইমেইল |
| `ADMIN_PASSWORD` | শক্ত পাসওয়ার্ড |

> `PORT` দেবে না — cPanel (Passenger) নিজেই দেয়, অ্যাপ সেটা পড়ে নেয়।

**CREATE** চাপো।

---

## ৩. প্যাকেজ ইনস্টল

একই পেজে → **Run NPM Install** বাটন চাপো (১–৩ মিনিট)।

Terminal থাকলে আরও নিশ্চিত:
```bash
cd ~/genz-hub
source /home/username/nodevenv/genz-hub/20/bin/activate   # cPanel পেজে এই লাইনটা দেখায়
npm ci --omit=dev
```

---

## ৪. ডেমো ডেটা বসাও (ঐচ্ছিক)

- **Setup Node.js App** পেজে → **Run JS script** → `seed:demo` লিখে চালাও
- অথবা Terminal-এ: `npm run seed:demo`

এতে ১৭ জন ইউজার, ৩৯টা পোস্ট, স্টোরি, গ্রুপ, ইভেন্ট, মেসেজ সব তৈরি হবে।
লগইন: `demo@genzhub.app / Demo12345`, অ্যাডমিন: তোমার দেওয়া `ADMIN_EMAIL` / `ADMIN_PASSWORD`।

---

## ৫. চালু করো

**RESTART** বাটন চাপো → ব্রাউজারে তোমার ডোমেইন খোলো → Gen-Z Hub ল্যান্ডিং পেজ আসবে।
SSL: cPanel → **SSL/TLS Status** → **Run AutoSSL** (ফ্রি HTTPS)।

চেক: `https://yourdomain.com/api/health` → `{"status":"ok", ...}`

---

## 🩹 সমস্যা হলে

| সমস্যা | সমাধান |
|---|---|
| `npm install` এ **better-sqlite3 / node-gyp** এরর | Node ভার্সন **20.x** বা **18.x** বেছে আবার চালাও (এই ভার্সনগুলোর জন্য রেডিমেড বাইনারি আছে, কম্পাইল লাগে না)। তবু না হলে হোস্টকে বলো "python3 + gcc-c++ enable করুন", নয়তো VPS নাও। |
| সাইট খোলে কিন্তু **502 / Passenger error** | Application startup file ঠিক `src/server.js` কিনা দেখো; Node version 18+ কিনা দেখো; RESTART দাও |
| ছবি আপলোড হয় না | `DATA_DIR` ফোল্ডারের পারমিশন 755 করো: `mkdir -p ~/genzhub-data && chmod 755 ~/genzhub-data` |
| লগইন করলে সাথে সাথে লগআউট | `NODE_ENV=production` সেট আছে কিনা দেখো এবং সাইট **https**-এ চলছে কিনা (secure cookie) |
| ডেটা মুছে গেছে | `DATA_DIR` কখনো `genz-hub` ফোল্ডারের ভেতরে রেখো না — বাইরে (`~/genzhub-data`) রাখো, তাহলে রি-ডিপ্লয়েও ডেটা থাকবে |

## 💾 ব্যাকআপ (মাসে একবার)

File Manager দিয়ে `genzhub-data` ফোল্ডারটা zip করে নামিয়ে রাখো — এতেই ডেটাবেজ + সব আপলোড আছে।

---

## শেয়ার্ড হোস্টিং vs VPS — সংক্ষেপে

| | শেয়ার্ড (cPanel + Node) | VPS |
|---|---|---|
| দাম | ৳২০০০–৪০০০/বছর | ৳৪০০–৮০০/মাস |
| সেটআপ | ক্লিক-ভিত্তিক, সহজ | কমান্ড লাগে (আমি করিয়ে দেব) |
| ঝুঁকি | native module ইনস্টল আটকাতে পারে | কোনো ঝুঁকি নেই |
| উপযুক্ত | শুরু করার জন্য ✅ | ব্যবহারকারী বাড়লে ✅ |

**শুরুর জন্য শেয়ার্ড হোস্টিং যথেষ্ট** — Gen-Z Hub হালকা, কয়েকশ ইউজার পর্যন্ত আরামে চলবে।
