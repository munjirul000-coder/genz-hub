# NOVA — Personal AI Workspace

**Your mind, amplified.** একটি Stonic-অনুপ্রাণিত, কিন্তু সম্পূর্ণ original desktop-companion MVP। এটি Gen-Z Hub repo-র ভেতরে আলাদা route, আলাদা SQLite database এবং আলাদা session দিয়ে চলে; existing social platform অপরিবর্তিত থাকে।

> এটি Stonic AI-এর copy বা affiliated product নয়। এখানে যা কাজ করে তা নিচে সৎভাবে লেখা আছে; screen awareness, always-on wake word এবং arbitrary desktop automation এই build-এ নেই। World monitor শুধু নিচের উল্লিখিত public feed দেখায়।

---

## এখনই ব্যবহার করো

```bash
npm install
npm run nova
# খুলো http://localhost:3000/nova
```

Windows laptop-এ সবচেয়ে সহজ পথ: repo root-এর **`START-NOVA.bat`** double-click করো। বিস্তারিত বাংলা গাইড: [`LAPTOP-SETUP.md`](LAPTOP-SETUP.md)।

`npm run nova` root `/` কে `/nova`-তে redirect করে। সাধারণ `npm start` দিলে আগের Gen-Z Hub home-ই থাকে, আর NOVA পাওয়া যায় `/nova`-তে। Gen-Z Hub sidebar-এও **NOVA AI** link আছে।

প্রথম visit-এ তোমার browser-এর জন্য একটি private workspace তৈরি হয়। Chat, memory, settings ও action history server-এর `DATA_DIR/nova/nova.db`-তে থাকে। অন্য browser/workspace সেই data দেখতে পায় না।

### যা কাজ করে

- **Conversation** — English/বাংলা local commands, হিসাব, সময়/তারিখ, help, focus timer। Optional cloud AI configure করলে open-ended প্রশ্নোত্তর।
- **Memory vault** — শুধু তুমি explicitly বললে বা add করলে save হয়। Search, category, edit, delete, export।
- **Desktop control** — Windows agent-এর মাধ্যমে allowlisted action। প্রতিটি action-এ আলাদা approval লাগে।
- **Voice** — push-to-talk অথবা স্পষ্টভাবে চালু/বন্ধ করা যায় এমন continuous conversation; browser speech recognition ও spoken replies-এর জন্য browser/OS-এর ওপর নির্ভর করে। Browser vendor speech process করতে পারে।
- **Phone remote** — one-time pairing code, shared workspace, owner settings protected, revoke anytime।
- **Focus timer** — start/pause/reset, 15/25/50 min presets, page বদলালেও চলে।
- **Characters** — NOVA, ATLAS, JARVIS-style, Mentor ও custom personality; custom name/behaviour ও browser voice settings। Original, Stonic বা Marvel-এর সঙ্গে affiliated নয়।
- **World monitor** — drag করা যায় এমন globe এবং 2D map; USGS M2.5+ last-day earthquake markers ও BBC World RSS headlines। Feed unavailable হলে তা দেখায়, fake event নয়।
- **Command palette** — `Ctrl/Cmd + K`; conversation shortcut `Ctrl/Cmd + J`।
- **Activity log** — pending, approved, running, completed, failed, cancelled, expired status।

---

## Windows desktop bridge

Web preview একা তোমার PC control করতে পারে না। তোমার Windows PC-তে agent চালাতে হবে।

### প্রয়োজন

- Windows 10/11
- Node.js 20 বা নতুন
- NOVA server চালু আছে such a way that the PC can reach it (localhost অথবা HTTPS host)

### ধাপ

1. NOVA → **Desktop control** → **Download nova-agent.js**। অথবা repo-র `desktop/nova-agent.js` ব্যবহার করো।
2. **Generate token** চাপো। Token একবারই দেখানো হয়। **Copy token** চাপো, Notepad-এ paste করে `nova-bridge.token` নামে agent-এর পাশে save করো। কাউকে token দেখাবে না।
3. PowerShell-এ সেই folder থেকে চালাও:

```powershell
node nova-agent.js --server http://localhost:3000 --token-file nova-bridge.token
```

Remote HTTPS server হলে:

```powershell
node nova-agent.js --server https://your-nova-host.example --token-file nova-bridge.token
```

4. NOVA-তে quick action বা chat command দাও, যেমন `Open YouTube` / `ইউটিউব খোলো`।
5. **Review → Approve & run** চাপো। Agent শুধু approved action নেয়, একবারে একটি কাজ করে, result ফেরত পাঠায়।
6. বন্ধ করতে terminal-এ `Ctrl+C`। Token বদলালে পুরোনো agent disconnect হয়।

### নিরাপদে কী কী চলে

| Action | কী হয় |
|---|---|
| Open YouTube / Spotify / WhatsApp / Google / Maps / Gmail / Calendar / GitHub / Wikipedia | Default browser-এ fixed URL খোলে; account data পড়ে বা পাঠায় না |
| Open Notepad / Calculator / Paint / Task Manager / On-Screen Keyboard | Windows app launch |
| Mouse move / click | Owner-approved coordinates; screen দেখতে পারে না এবং click অন্য app-এ ক্ষতিকর কাজ ঘটাতে পারে |
| Type in Notepad | Owner-approved এক লাইনের text; সক্রিয় Notepad window-তে সীমিত |
| Open Downloads | Downloads folder খোলে |
| System information | OS, CPU, RAM, uptime পড়ে |
| WhatsApp draft | International number + text দিয়ে draft খোলে; **Send নিজে চাপতে হবে** |

**সীমাবদ্ধতা:** সরাসরি arbitrary shell command, custom executable/URL, file delete/format, shutdown বা screen capture-এর action নেই; WhatsApp স্বয়ংক্রিয়ভাবে send হয় না। তবে অনুমোদিত mouse click অন্য app-এ delete বা অন্য ঝুঁকিপূর্ণ কাজ শুরু করতে পারে, তাই আগে screen দেখে নাও। Approval ২ মিনিটে expire হয়। Agent heartbeat ছাড়া system info দেখায় না।

### Windows ছাড়া পরীক্ষা

```bash
node desktop/nova-agent.js --self-test
node desktop/nova-agent.js --server http://localhost:3000 --token-file nova-bridge.token --dry-run
```

`--dry-run` approval/polling/result পুরো flow পরীক্ষা করে কিন্তু PC-তে কিছু execute করে না। Real execution Windows ছাড়া সম্ভব নয়।

---

## Optional open-ended AI

NOVA-র local commands (memory, হিসাব, সময়, focus, desktop approval) API key ছাড়াই চলে। Open-ended আলাপের জন্য একটি AI provider লাগে।

### সহজ পথ: page-এর ভেতরে Connect Groq

`.env` edit করতে হবে না।

1. Groq console-এ একটি API key তৈরি করো: `console.groq.com/keys`। Free-tier key কাজ করে।
2. NOVA → **Settings → Intelligence → Connect Groq**।
3. Secure **Groq API key** field-এ key paste করো। Model default `llama-3.3-70b-versatile`; দরকার হলে `llama-3.1-8b-instant` দাও।
4. **Connect & test** চাপো। NOVA নিজে থেকে key test করে, সফল হলে encrypted অবস্থায় workspace-এ save করে এবং সাথে সাথে connect হয়ে যায়।
5. Top badge-এ **Groq + local** দেখাবে। **Test AI connection** দিয়ে আবার পরীক্ষা করা যায়; **Disconnect** দিলে workspace key মুছে যায়।

**Key কখনো chat-এ paste করবে না।** Chat-এ key-like text গেলে NOVA সেটা save/send করে না; secure connect field খুলে দেয়। Key browser-এ ফেরত পাঠানো হয় না, export-এ থাকে না, শুধু server-side provider request-এ ব্যবহার হয়।

### Advanced: server environment presets

নিজে server চালালে `.env` বা environment variable-ও ব্যবহার করতে পারো। Workspace-এ saved key থাকলে সেটি env-এর চেয়ে priority পায়।

```bash
# Groq
NOVA_AI_PROVIDER=groq
NOVA_AI_API_KEY=gsk_your_key_here
NOVA_AI_MODEL=llama-3.3-70b-versatile

# OpenAI
# NOVA_AI_PROVIDER=openai
# NOVA_AI_API_KEY=your-provider-key
# NOVA_AI_MODEL=gpt-4.1-mini

# Local Ollama
# NOVA_AI_BASE_URL=http://127.0.0.1:11434/v1
# NOVA_AI_MODEL=your-local-model
# NOVA_AI_ALLOW_UNAUTHENTICATED=1
```

তারপর `npm run nova`। `.env` git-ignored; কখনো commit করো না।

### Privacy ও সীমা

- Memory, explicit commands, হিসাব ও সময় deterministic local engine-এ চলে।
- Cloud AI chat-এর জন্য recent conversation ও saved memories provider-এ পাঠায়। সেটা না চাইলে key connect করো না।
- Provider unavailable/rate-limited হলে NOVA সেটা জানায়; ভান করে না যে অন্য কোথাও উত্তর নিয়েছে।
- Groq free tier-এ rate limit আছে; limit hit করলে কিছুক্ষণ পরে আবার চেষ্টা করো।
- Saved key `DATA_DIR/nova/nova.db`-তে AES-256-GCM দিয়ে encrypted; vault key `DATA_DIR/nova/nova-vault.key`-এ থাকে। এটি at-rest protection, full server compromise-এর বিরুদ্ধে নয়। `data/` folder backup/রাখো, public করো না।

---

## Phone remote

1. Desktop NOVA → **Connect phone**।
2. ফোনে PC-এর পৌঁছানো যায় এমন address-এ `/nova` খোলো এবং ১০-character code দাও। Laptop-এ `localhost` লেখা link ফোনে কাজ করবে না: সেটা ফোনকেই বোঝায়। একই Wi-Fi-তে PC-এর LAN address ব্যবহার করো। বাইরের নেটওয়ার্ক থেকে access-এর জন্য নিজে private VPN বা নিরাপদ HTTPS setup করতে হবে; NOVA স্বয়ংক্রিয়ভাবে internet-এ প্রকাশ করে না। HTTP-তে traffic unencrypted হতে পারে; নিরাপদ private network/HTTPS ব্যবহার করো।
3. Code ৫ মিনিটে expire হয় এবং একবার ব্যবহার হয়।
4. ফোন chat, memory ও সাধারণ desktop approval করতে পারে; mouse/keyboard action শুধু owner prepare ও approve করতে পারে। ফোন workspace delete, bridge token generate বা owner settings বদলাতে পারে না।
5. **Settings → Paired phones → Revoke** দিলে access সাথে সাথে বন্ধ।

---

## World monitor ও voice conversation

- Sidebar-এর **World monitor**-এ 3D globe drag করা যায়; **2D map**-এ switch করা যায়। Marker-গুলো USGS M2.5+ গত ২৪ ঘণ্টার earthquake feed, headline BBC World RSS থেকে আসে। Server প্রতি পাঁচ মিনিট পর্যন্ত cache করে; কোনো feed বন্ধ থাকলে error দেখায়। সব conflict, fire বা অন্য hotspot দেখায় না। Map outline Natural Earth/world-atlas (লাইসেন্স `public/nova/world/`)।
- Conversation-এর **Start voice conversation** চাপলে microphone turn-by-turn চালু থাকে এবং response browser voice-এ পড়ে। **Stop voice conversation** চাপলে বন্ধ হয়; অন্য page-এ গেলে session বন্ধ হয়। Browser mic permission লাগে; browser vendor speech process করতে পারে, এবং Bengali recognition/voice availability browser ও OS-এর ওপর নির্ভর করে। এটি always-on wake word নয়।
- Settings-এ JARVIS-style, Mentor বা Custom নির্বাচন করে name ও behaviour save করা যায়। Cloud AI-কে recent conversation, selected personality preference ও explicitly saved memories পাঠানো হয়।

---

## Privacy ও বাস্তব সীমা

- Workspace session browser-এ থাকে; server data SQLite-এ। Public preview-তে data sandbox server-এ থাকে, তোমার PC-তে নয়।
- Voice input browser-এর speech service ব্যবহার করতে পারে; এটি offline wake-word listener নয়।
- Browser/OS voice না থাকলে spoken reply বা Bengali recognition সীমিত হতে পারে।
- Desktop bridge-কে polling-এর সময় নিজের system info server-এ পাঠাতে হয়; সেটা শুধু সেই workspace-এ দেখা যায়।
- এটি single-user companion MVP, enterprise multi-tenant product নয়। নিজের server HTTPS, backup ও access control দিয়ে চালাও।
- Globe-এর hotspot কেবল USGS earthquake; এটি সব global event cover করে না। BBC বা USGS offline/blocked থাকলে পুরনো বা fake headline দেখায় না।
- Screen understanding, file search, calendar/email data integration ও wake word এই version-এর বাইরে।

---

## পরীক্ষা

```bash
npm run test:nova       # API, isolation, memory, approval, bridge, pairing, expiry, agent safety
npm run test:nova:ui    # isolated server + real Chromium: desktop/mobile flows
```

UI test `screenshots/`-এ nova-desktop.png, nova-mobile.png, nova-approval.png, nova-desktop-control.png, nova-remote.png তৈরি করে। Chromium না থাকলে dev dependency `@sparticuz/chromium` fallback ব্যবহার করে।

## গুরুত্বপূর্ণ ফাইল

```text
src/nova/store.js       আলাদা SQLite schema + workspace/session store
src/nova/router.js      API, CSRF/origin guard, pairing, approval, bridge protocol
src/nova/assistant.js   local engine + optional OpenAI-compatible provider
src/nova/vault.js       AES-256-GCM vault for in-app API keys
src/nova/catalog.js     shared action allowlist
desktop/nova-agent.js   Windows-only executor, dry-run, self-test
public/nova/            dependency-free UI, procedural orb, local fonts
```

Fonts: Manrope ও Space Grotesk, SIL Open Font License; license files `public/nova/fonts/`-এ আছে।
