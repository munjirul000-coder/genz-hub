# NOVA laptop setup (Windows 10/11)

এই গাইডটা তোমার নিজের Windows laptop-এ NOVA চালানোর জন্য। Public preview তোমার PC control করতে পারে না; desktop action চালাতে হলে NOVA server + bridge agent দুটোই তোমার laptop-এ চালানো সবচেয়ে সহজ।

## 1) Node.js install করো

1. https://nodejs.org থেকে **LTS (20 বা নতুন)** install করো।
2. Install শেষে PowerShell খুলে লিখো:

```powershell
node -v
npm -v
```

দুটো version দেখালে ঠিক আছে।

## 2) প্রজেক্টের ফাইল laptop-এ নাও

### সবচেয়ে সহজ: Arena থেকে দেওয়া ZIP

`NOVA-Laptop-Setup.zip` ফাইলটা **Download** করো → ফাইলটার ওপর right-click → **Extract All** → Extract চাপো। extracted `NOVA-Laptop` ফোল্ডার খুলে `START-NOVA.bat` চালাও। ZIP-এর ভেতর থেকে সরাসরি `.bat` চালাবে না। Git clone বা GitHub account লাগবে না।

প্রথমবার internet লাগবে, কারণ Node.js-এর প্রয়োজনীয় package গুলো install হবে। Install শেষ না হওয়া পর্যন্ত অপেক্ষা করো। Browser-এর address `http://localhost:3000/nova` হতে হবে; এটা তোমার নিজের laptop-এর NOVA, Arena preview নয়।

### বিকল্প: GitHub থেকে নেওয়া

যদি Git থাকে:

```powershell
git clone <তোমার-repo-url>
cd genz-hub
```

Git না থাকলে GitHub থেকে repo ZIP download করে extract করো, তারপর `genz-hub` folder খোলো।

## 3) NOVA start করো

`genz-hub` folder-এর ভেতরে **`START-NOVA.bat`** double-click করো।

- প্রথমবার dependencies install হবে।
- কয়েক সেকেন্ড পর browser-এ `http://localhost:3000/nova` খুলবে।
- কালো terminal window open থাকবে। এটা বন্ধ করলে NOVA server বন্ধ হবে।

Manual পথ:

```powershell
npm install
npm run nova
```

তারপর browser-এ `http://localhost:3000/nova`।

## 4) Groq API key page-এর ভেতরে connect করো

`.env` edit করতে হবে না।

1. https://console.groq.com/keys এ গিয়ে একটি API key তৈরি করো।
2. NOVA → **Settings → Intelligence → Connect Groq**।
3. Secure **Groq API key** field-এ key paste করো।
4. Model default `llama-3.3-70b-versatile`। কোনো কারণে unavailable হলে `llama-3.1-8b-instant` দিয়ে দেখো।
5. **Connect & test** চাপো।

সফল হলে top badge-এ **Groq + local** দেখাবে। এরপর সাধারণ প্রশ্ন করতে পারো। Memory, হিসাব, সময়, focus timer আর desktop command আগের মতোই local engine-এ চলে।

**সাবধান:** API key কখনো chat box-এ paste করবে না। ভুলে chat-এ দিলে NOVA সেটা save/send না করে secure connect field খুলে দেবে। Key শুধু তোমার NOVA server-এ encrypted অবস্থায় থাকে।

## Website বানানো (প্রথম version)

1. Groq connect করে Conversation page-এ **Build website** চাপো।
2. কী ধরনের website চাও লিখে **Generate website** চাপো। তোমার description সংযুক্ত AI provider-এ পাঠানো হবে; গোপন তথ্য লিখবে না।
3. Preview দেখে **Download index.html** চাপলে file download হবে। Preview-তে নিরাপত্তার জন্য JavaScript ও network বন্ধ থাকে; কিছু interactive অংশ সেখানে কাজ করবে না।
4. এটি একটি এক-file static prototype; বাস্তব login, payment, database, hosting বা autonomous project editing করে না। AI-generated code ভুল বা অনিরাপদ হতে পারে—বিশ্বাসের আগে review করো।

নতুন ZIP আলাদা folder-এ খুললে পুরনো workspace স্বয়ংক্রিয়ভাবে আসে না। পুরনো NOVA বন্ধ করে `data/nova` folder-টির backup রাখো; workspace ও encrypted key ফেরত পেতে database এবং vault key একসাথে রাখতে হবে।

## 5) Windows desktop control চালাও

1. NOVA → **Desktop control** → **Generate token**।
2. **Save token file** দিয়ে `nova-bridge.token` নামে save করো।
3. File টা repo-র `desktop` folder-এ রাখো। সেই folder-এ `nova-agent.js` আর `START-BRIDGE.bat` আছে।
4. **`desktop\START-BRIDGE.bat`** double-click করো।
5. Server URL জিজ্ঞেস করলে সাধারণত শুধু Enter চাপো: `http://localhost:3000`।
6. NOVA-তে `Open YouTube` বা `ইউটিউব খোলো` লিখো।
7. **Review → Approve & run** চাপো। Approval ছাড়া কিছু চলে না।

Bridge window open থাকলে desktop control কাজ করবে। বন্ধ করতে `Ctrl+C`।

## 6) ফোনকে remote বানাও (একই Wi‑Fi)

1. Laptop-এ PowerShell-এ `ipconfig` চালিয়ে IPv4 address দেখো, যেমন `192.168.0.105`।
2. ফোনের browser-এ `http://192.168.0.105:3000/nova` খোলো।
3. Laptop NOVA → **Connect phone** → pairing code দাও।
4. Windows Firewall জিজ্ঞেস করলে Node.js-কে private network-এ allow করো।

## Data কোথায় থাকে

- Workspace database: `data/nova/nova.db`
- Encrypted API key vault key: `data/nova/nova-vault.key`
- Bridge token file: `desktop/nova-bridge.token`

`data/` folder private রাখো। Backup নিলে `nova.db` আর `nova-vault.key` দুটোই রাখবে; একটা ছাড়া অন্যটা দিয়ে saved key খোলা যাবে না।

## সমস্যা হলে

- **`node` not found:** Node.js install করে PowerShell নতুন করে খোলো।
- **Port 3000 busy:** অন্য app বন্ধ করো, অথবা PowerShell-এ `$env:PORT=3001; npm run nova` দিয়ে `http://localhost:3001/nova` খোলো।
- **Groq 401/403:** key ভুল/expired। নতুন key দিয়ে আবার Connect করো।
- **Groq 429:** free-tier rate limit। কিছুক্ষণ পরে চেষ্টা করো।
- **Groq 404:** model name ভুল/unavailable। `llama-3.1-8b-instant` চেষ্টা করো।
- **Empty response with `gpt-oss` / reasoning model:** পুরনো NOVA version হলে update করে নতুন ZIP চালাও, অথবা আপাতত `llama-3.3-70b-versatile` ব্যবহার করো। নতুন version reasoning model-এর জন্য আলাদা token budget ব্যবহার করে।
- **Desktop offline:** `START-BRIDGE.bat` চলছে কি না, token file ঠিক জায়গায় আছে কি না দেখো। Token বদলালে পুরোনো agent disconnect হয়।
