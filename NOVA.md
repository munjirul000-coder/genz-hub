# NOVA — Personal AI Workspace

**Your mind, amplified.** একটি Stonic-অনুপ্রাণিত, কিন্তু সম্পূর্ণ original desktop-companion MVP। এটি Gen-Z Hub repo-র ভেতরে আলাদা route, আলাদা SQLite database এবং আলাদা session দিয়ে চলে; existing social platform অপরিবর্তিত থাকে।

> এটি Stonic AI-এর copy বা affiliated product নয়। এখানে যা কাজ করে তা নিচে সৎভাবে লেখা আছে; always-on wake word এবং unrestricted desktop automation এই build-এ নেই। Experimental visual-work session-এর সুনির্দিষ্ট সীমা নিচে আছে। World monitor শুধু নিচের উল্লিখিত public feed দেখায়।

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
- **Desktop control** — Windows agent-এর allowlisted action; manual action-এ আলাদা approval লাগে। Experimental visual-work session-এ একবার অনুমতির পরে সাধারণ step স্বয়ংক্রিয়ভাবে চলতে পারে।
- **Voice** — push-to-talk অথবা স্পষ্টভাবে চালু/বন্ধ করা যায় এমন continuous conversation; browser speech recognition ও spoken replies-এর জন্য browser/OS-এর ওপর নির্ভর করে। Browser vendor speech process করতে পারে।
- **Phone remote** — one-time pairing code, shared workspace, owner settings protected, revoke anytime।
- **Focus timer** — start/pause/reset, 15/25/50 min presets, page বদলালেও চলে।
- **Characters** — NOVA, ATLAS, JARVIS-style, Mentor ও custom personality; custom name/behaviour ও browser voice settings। Original, Stonic বা Marvel-এর সঙ্গে affiliated নয়।
- **World monitor** — drag করা যায় এমন globe এবং 2D map; USGS M2.5+ last-day earthquake markers ও BBC World / The Guardian RSS headlines। Feed unavailable হলে তা দেখায়, fake event নয়।
- **Command palette** — `Ctrl/Cmd + K`; conversation shortcut `Ctrl/Cmd + J`।
- **Activity log** — pending, approved, running, completed, failed, cancelled, expired status।

---

## Windows desktop bridge

Web preview একা তোমার PC control করতে পারে না। তোমার Windows PC-তে agent চালাতে হবে।

### প্রয়োজন

- Windows 10/11
- Node.js 20 বা নতুন
- NOVA server চালু আছে such a way that the PC can reach it (localhost অথবা HTTPS host)

### সহজ পদ্ধতি: এই Windows PC এক ক্লিকে connect

NOVA এই একই Windows laptop-এ `localhost` দিয়ে খোলা থাকলে **Desktop control → Connect this PC → Connect** চাপো। Local bridge background-এ চালু হয়; token copy, file বা অতিরিক্ত terminal লাগে না। একবার চালু করলে পেজে **Disconnect this PC** দিয়ে বন্ধ করা যায়; NOVA বন্ধ হলে managed bridge-ও থামে। একবার সম্মতি দিলে NOVA আবার চালু হলে bridge নিজে reconnect করার চেষ্টা করে, যতক্ষণ না তুমি Disconnect চাপো। Browser tab বন্ধ করলেও NOVA server চলতে থাকলে bridge বন্ধ হয় না। Connect করার সময় আগের bridge token বদলে যায় এবং অপেক্ষমাণ action বাতিল হয়। আগে থেকে চলমান action শেষ হয়ে যেতে পারে। সাধারণ action review লাগে; visual work session অনুমোদিত হলে একাধিক সাধারণ step চালাতে পারে এবং ঝুঁকি আছে। এই shortcut owner এবং একই PC-র local browser-এর জন্য; remote ফোন বা hosted preview থেকে PC bridge চালু হয় না।

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
| Type in Notepad / Chrome / Edge / Firefox / VS Code / Word / Excel / PowerPoint | Owner-approved এক লাইনের text; নির্বাচিত app সামনে না থাকলে থামে, text field কোনটি তা বুঝতে পারে না |
| Open Downloads | Downloads folder খোলে |
| System information | OS, CPU, RAM, uptime পড়ে |
| WhatsApp draft | International number + text দিয়ে draft খোলে; **Send নিজে চাপতে হবে** |

**সীমাবদ্ধতা:** সরাসরি arbitrary shell command, custom executable/URL, file delete/format, shutdown বা screen capture-এর action নেই; WhatsApp স্বয়ংক্রিয়ভাবে send হয় না। তবে অনুমোদিত mouse click অন্য app-এ delete বা অন্য ঝুঁকিপূর্ণ কাজ শুরু করতে পারে, তাই আগে screen দেখে নাও। Approval সাধারণত ২ মিনিটে expire হয়; screen-suggested click ৩০ সেকেন্ডে expire হয়। Agent heartbeat ছাড়া system info দেখায় না।

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

## নতুন project builder ও screen viewer

- **Conversation → Project builder**-এ website-এর বিবরণ লিখে **Approve & build** অথবা **Approve by voice** চাপো। Voice-এ `অনুমতি দিচ্ছি` বললে একটি project build-এর অনুমতি দেওয়া হয়। পরিচয় voice দিয়ে যাচাই হয় না। Voice input দিয়ে স্পষ্ট website তৈরির অনুরোধ করলেও এই অনুমতির window খোলে।
- এটি connected AI-কে তিনবার অনুরোধ করে নতুন `index.html`, `styles.css`, `app.js` বানায়; JavaScript syntax check করে এবং syntax ভুল হলে একবার repair করার চেষ্টা করে, code execute করে না। সব সফল হলে আলাদা folder `data/nova/built-projects/`-এ রাখে। **Saved projects** থেকে দেখা ও **Download project ZIP** করা যায়। Preview-তে network ও forms বন্ধ। Generated code ভুল হতে পারে—ব্যবহারের আগে review করো।
- এই অনুমতি **শুধু নতুন static website files** তৈরি করতে প্রযোজ্য। Screen দেখে নিজে desktop operate করা, existing project edit, app/backend বানানো, package install, test run, deploy বা file delete করে না। Stop দিলে চলমান AI request বন্ধের চেষ্টা করে; save শুরু হয়ে গেলে project থেকে যেতে পারে।
- **Desktop control → Share screen**-এ browser picker দিয়ে screen/window বেছে নিতে হয়। Preview নিজ browser-এ থাকে। **Analyze screen** বা **Suggest click** না চাপা পর্যন্ত AI-তে পাঠানো হয় না; চাপলে একটি frame ও প্রশ্ন connected AI provider-এ যায়, তাই private content আগে বন্ধ করো। Compatible vision model ও internet দরকার; model availability বদলাতে পারে। Screen frame NOVA database-এ রাখা হয় না। Sharing বন্ধ করতে **Stop sharing** বা window বন্ধ করো। **Suggest click**-এ AI একটি point প্রস্তাব করতে পারে: পুরো primary monitor share করে checkbox confirm করতে হবে। চিহ্নিত ছবি ও বাস্তব screen মিলিয়ে প্রতিটি click আলাদাভাবে অনুমতি দিতে হবে; click ভুল বা ধ্বংসাত্মক হতে পারে। এই আলাদা viewer-এ প্রতিটি click-এ আলাদা অনুমতি লাগে। Visual work session-এ সীমিত স্বয়ংক্রিয় loop আছে।
- Real Windows screen sharing, নতুন mouse/keyboard action, microphone ও Groq vision এই build-এ বাস্তব laptop-এ পরীক্ষা করা হয়নি। Browser/OS permission প্রয়োজন।

---

## Automatic updates (Windows, opt-in)

একবার single-file `SETUP-NOVA-AUTO-UPDATE.bat` ব্যবহার করে (বা archive-এর `SETUP-AUTO-UPDATE.bat` দিয়ে) এই laptop-এর পূর্বে থাকা NOVA folder-এ updater বসানোর পর, `START-NOVA.bat` প্রতিবার চালুর আগে নির্দিষ্ট GitHub branch-এ update পরীক্ষা করে। নতুন commit থাকলে সেটি HTTPS-এর মাধ্যমে নির্দিষ্ট commit ID দিয়ে download করে, তারপর app file update করে। পুরোনো server পুরোপুরি বন্ধ করতে হবে; bridge চালু থাকলে bridge-এর নতুন code নিতে সেটিও restart করতে হবে। একই সময়ে দ্বিতীয়বার NOVA চালানো বন্ধ রাখতে updater lock ব্যবহার করে।

Updater `data`, project, `nova-bridge.token`, vault key এবং ব্যবহারকারীর অন্যান্য file overwrite করে না। Update-এর আগে NOVA ও Gen-Z Hub SQLite database-এর consistent snapshot এবং vault key স্থানীয় `data/nova-updater/backup-*` folder-এ রাখে; পরিবর্তিত application file-এর পুরোনো copy-ও সেখানে থাকে। এই backup-এ **ব্যক্তিগত তথ্য ও vault key আছে**, তাই folder ব্যক্তিগত রাখো। Backup স্বয়ংক্রিয়ভাবে মুছে ফেলা হয় না এবং সময়ের সঙ্গে storage বাড়তে পারে; আগে আলাদা backup রাখাও জরুরি। Project file-গুলোর সম্পূর্ণ backup এই updater করে না।

Internet বা GitHub বন্ধ থাকলে আগে থেকে সঠিকভাবে install থাকা version চালানোর চেষ্টা করে। Dependency update আলাদা folder-এ তৈরি হয়; failure বা মাঝপথে update থামলে আগের code/dependencies restore করার ব্যবস্থা আছে। সফলভাবে install হওয়ার পরে নতুন app-এর runtime bug বা database migration থেকে automatic rollback-এর নিশ্চয়তা নেই; Windows-এ বাস্তব পরীক্ষা দরকার। এটি signed commercial updater নয়: **repository/branch-এর maintainer বা GitHub account compromise হলে ক্ষতিকর code চলতে পারে**। কেবল নির্ভরযোগ্য update source ব্যবহার করো। Updater কেবল `arena/549dbb1e-genz-hub` branch ব্যবহার করে; branch মুছে গেলে বা repository unavailable হলে নতুন update আর আসবে না।

বন্ধ করতে `desktop/STOP-AUTO-UPDATE.bat`, আবার চালু করতে `desktop/START-AUTO-UPDATE.bat` ব্যবহার করো। স্থির startup bootstrap নিজে update হয় না; ভবিষ্যতে এর format বদলাতে হলে আবার একবার manual installation লাগতে পারে।

---

## Experimental visual work session

Conversation বা Desktop control → **Visual work**। প্রথমে পুরো primary monitor share করো, goal লেখো, তারপর **Approve & start** বা **Approve by voice** (`অনুমতি দিচ্ছি`)। এটি সর্বোচ্চ ১২ step / ৪ মিনিটের অনুমতি। Window খোলা ও screen sharing চালু থাকতে হবে। প্রতিবার একটি frame ও goal সংযুক্ত cloud vision provider-এ যায়; কাজের label ও টাইপ করা text activity history-তে থাকে। আগে গোপন window বন্ধ করো। Voice বক্তার পরিচয় যাচাই করে না।

NOVA screenshot দেখে পরের step নির্বাচন করে, bridge-কে অনুমোদিত click বা নির্দিষ্ট app-এ এক লাইন text পাঠায়, action-এর ফল অপেক্ষা করে এবং আবার screenshot নেয়। Website goal হলে একটি নতুন তিন-file static project ও সর্বোচ্চ দুইটি নতুন revision তৈরি করতে পারে; আগের version মুছে না। Sandboxed preview থাকে। AI-এর completion message নিজের দাবি, সম্পূর্ণ correctness-এর নিশ্চয়তা নয়।

**Stop** বা dialog বন্ধ করলে নতুন step বন্ধ হয় এবং queued step cancel করার চেষ্টা হয়; Windows-এ ইতোমধ্যে শুরু হওয়া action শেষ হতে পারে। ১৫ সেকেন্ডে unclaimed automatic action expire হয়। Delete/send/install ইত্যাদি AI বা keyword দিয়ে শনাক্ত হলে আলাদা approval চায়; **এটি নির্ভুল নয় এবং ভুল click-এ অনুমতি ছাড়াও deletion ঘটতে পারে**। Screen বদলে যাওয়া, ভুল monitor নির্বাচন, DPI scaling বা ভুল AI সিদ্ধান্তে অন্য জায়গায় click হতে পারে। শুধু নজর রেখে, backup রেখে ব্যবহার করো।

এখনো unrestricted PC control, arbitrary app/software/backend তৈরি, shell command, package download/install, runtime test বা deployment নেই। এটি সম্পূর্ণ project automation-এর নিশ্চয়তা নয়। Real Windows input, real screen capture, microphone ও cloud vision এখনো এই build-এ বাস্তব laptop-এ পরীক্ষা হয়নি; automated checks mocked। Commercial release-এর আগে security, privacy, reliability ও license review দরকার।

---

## World monitor ও voice conversation

- Sidebar-এর **World monitor**-এ 3D globe drag করা যায়; **2D map**-এ switch করা যায়। Marker-গুলো USGS M2.5+ গত ২৪ ঘণ্টার earthquake feed, headline BBC World ও The Guardian RSS থেকে আসে; একটি news source বন্ধ থাকলেও অন্যটি কাজ করতে পারে। প্রতিটি খবরের source ও সময় দেখানো হয়। Server প্রতি পাঁচ মিনিট পর্যন্ত cache করে; Refresh চাপলে নতুন করে চেষ্টা করে। Source ছবি দিলে thumbnail দেখায়, না দিলে placeholder; fake ছবি নয়। Browser ছবিগুলো সরাসরি publisher-এর image host থেকে লোড করে, তাই publisher তোমার IP পেতে পারে। Feed বন্ধ থাকলে সেটি দেখায়। সব conflict, fire বা অন্য hotspot দেখায় না। Map outline Natural Earth/world-atlas (লাইসেন্স `public/nova/world/`)। নীল grid, তারা, orbit ও জমির বিন্দু সাজসজ্জা; শুধু USGS feed-এর কমলা marker ভূমিকম্পের তথ্য।
- Conversation-এর **Start voice conversation** চাপলে microphone turn-by-turn চালু থাকে এবং response browser voice-এ পড়ে। **Stop voice conversation** চাপলে বন্ধ হয়; অন্য page-এ গেলে session বন্ধ হয়। Browser mic permission লাগে; browser vendor speech process করতে পারে, এবং Bengali recognition/voice availability browser ও OS-এর ওপর নির্ভর করে। বাংলা reply পড়ার জন্য browser বা Windows-এ বাংলা text-to-speech voice থাকতে হবে; voice লোড/উপলব্ধ না হলে NOVA সতর্ক করে। Settings-এর Installed voice তালিকা পরীক্ষা করো। এটি always-on wake word নয়।
- Settings-এ JARVIS-style, Mentor বা Custom নির্বাচন করে name ও behaviour save করা যায়। Cloud AI-কে recent conversation, selected personality preference ও explicitly saved memories পাঠানো হয়।


Chat-এ latest news বা ভূমিকম্প সম্পর্কে জিজ্ঞেস করলে একই World Monitor-এর BBC ও The Guardian headline / USGS feed ব্যবহার করা হয়। AI সংযুক্ত থাকলে feed-এর তথ্য দিয়ে উত্তর দেয়; checked time এবং মূল উৎসের link দেখায়। Feed-এ শুধু headline থাকে, সম্পূর্ণ article বা অন্য website search নয়; না পাওয়া তথ্য AI-এর বানিয়ে বলা উচিত নয় এবং উত্তর যাচাই করতে হবে। Feed সর্বোচ্চ ৫ মিনিট cache হতে পারে। Feed বন্ধ থাকলে সেটি জানানো হয়; AI বন্ধ থাকলেও পাওয়া তথ্য সরাসরি দেখায়। খবর সংক্রান্ত প্রশ্ন ও feed data সংযুক্ত AI provider-এ পাঠানো হয়।

---

## Privacy ও বাস্তব সীমা

- Workspace session browser-এ থাকে; server data SQLite-এ। Public preview-তে data sandbox server-এ থাকে, তোমার PC-তে নয়।
- Voice input browser-এর speech service ব্যবহার করতে পারে; এটি offline wake-word listener নয়।
- Browser/OS voice না থাকলে spoken reply বা Bengali recognition সীমিত হতে পারে।
- Desktop bridge-কে polling-এর সময় নিজের system info server-এ পাঠাতে হয়; সেটা শুধু সেই workspace-এ দেখা যায়।
- এটি single-user companion MVP, enterprise multi-tenant product নয়। নিজের server HTTPS, backup ও access control দিয়ে চালাও।
- Globe-এর hotspot কেবল USGS earthquake; এটি সব global event cover করে না। News sources বা USGS offline/blocked থাকলে পুরনো বা fake headline দেখায় না।
- Screen viewer-এ আলাদা click suggestion পর্যালোচনা করা যায়। Visual work session-এ একবার অনুমতির পরে সীমিত বহু-step loop চলতে পারে; ঝুঁকি শনাক্তকরণ নিখুঁত নয়। File search, calendar/email data integration ও wake word এই version-এর বাইরে।

---

## বিক্রির আগে গুরুত্বপূর্ণ

এটি এখনো personal MVP, বিক্রির জন্য প্রস্তুত product নয়। Windows-এ আসল device ও cloud model পরীক্ষা, security/privacy review, ব্যবহারকারীর সম্মতি ও data retention, accessibility, support, backup এবং third-party license, character name/brand ও AI provider-এর commercial terms যাচাই দরকার। NOVA Stonic-এর সঙ্গে যুক্ত নয়; তার proprietary code, logo বা brand এখানে ব্যবহার করা হয় না। Screen-এর AI suggestion ভুল হতে পারে, এবং Windows click অন্য app-এ deletion ঘটাতে পারে—এখনো সব deletion শনাক্ত করার নিশ্চয়তা নেই।

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


### Windows tray companion (প্রথম ধাপ, পরীক্ষামূলক)

আপডেটের পর আগের `START-NOVA.bat` থেকেই NOVA চালু করো। Windows notification area-তে NOVA-র tray icon আসার কথা (hidden icons-এর তীরের ভেতরেও থাকতে পারে)। Icon-এর menu থেকে **Open NOVA**, **Open voice page** বা **Stop NOVA** বেছে নেওয়া যায়। এটি শুধু server/window-এর control; tray নিজে microphone বা screen ব্যবহার করে না। চালু থাকা terminal window বন্ধ করো না। Tray তৈরি ব্যর্থ হলে আগের মতো browser ও terminal দিয়েই চালানোর চেষ্টা হবে; terminal-এ Ctrl+C দিয়ে বন্ধ করা যাবে।

**Open voice page** default browser-এ একটি tab বা window খোলে। এটি করলে voice নিজে চালু হয় না: সেখানে **Start voice conversation** ও browser microphone permission প্রয়োজন। Voice window-তে বাংলা বা English recognition language বেছে নেওয়া যায়; auto setting থাকলে এখানে বাংলা প্রথম পছন্দ। Language বদলাতে শুনতে থাকা turn পুনরায় শুরু হয়; recognition browser ও OS-এর ওপর নির্ভর করে এবং ভুল শুনতে পারে। Server হারালে voice window microphone বন্ধ করার চেষ্টা করে, কিন্তু browser suspend হলে তা দেরি হতে পারে। Main tab বন্ধ করলেও server/tray চলতে পারে, **voice window বা browser বন্ধ করলে শোনা বন্ধ হবে**। এই tray controller নিজে microphone ব্যবহার করে না। নিচে আলাদা পরীক্ষামূলক background voice-এর বর্ণনা আছে; Windows startup-এ নিজে চালু হওয়া নেই; আলাদা অনুমতিসহ পরীক্ষামূলক native screen নিচে বর্ণিত। Tray ও microphone বাস্তব Windows-এ পরীক্ষা এখনও বাকি।

### আলাদা voice window (পরীক্ষামূলক)

Conversation বা Overview-এ **Open separate voice window → Open window** চাপো। নতুন window-তে **Start voice conversation** চাপো, microphone permission দাও এবং NOVA বা নোভা বলে অনুরোধ শুরু করো। মূল NOVA tab বন্ধ করা যায়, কিন্তু আলাদা voice window, Chrome এবং NOVA server চালু থাকতে হবে; voice window minimize করা যায়। এটি browser-এর speech recognition-এর ওপর নির্ভর করে, তাই background-এ থেমে যেতে পারে এবং Windows sleep/Chrome বন্ধ থাকলে কাজ করে না। Listening চলাকালে browser-এর speech service-এ audio যেতে পারে, এমনকি wake word না থাকলেও। যে কেউ বা recording নোভা বলতে পারে; কণ্ঠ দিয়ে পরিচয় যাচাই হয় না।

ইচ্ছা করলে আলাদা নিশ্চিতকরণ দিয়ে শুধু Firefox, Chrome, Edge, Notepad ও Calculator এই session-এ স্পষ্ট ও local-recognized নির্দেশে review ছাড়া খুলতে দিতে পারো; AI দিয়ে বোঝা নির্দেশ ও অন্য action review লাগে, voice বন্ধ করলে অনুমতি মুছে যায়। অন্য action review লাগে; চলমান কাজ stop-এর পরেও শেষ হতে পারে। বাস্তব Windows-এ minimized microphone ও wake word যাচাই বাকি। বাংলাদেশ সংবাদ Jago News 24 থেকে সর্বশেষ national/country/politics/economy headlines হিসেবে আসে; feed পুরোনো বা unavailable হলে জানানো হয়। BBC/Guardian বিশ্ব সংবাদ অপরিবর্তিত।


### আড্ডা ও বন্ধুর মতো কথা

Groq বা সংযুক্ত AI চালু থাকলে NOVA-কে যেমন “নোভা চলো গল্প করি”, “নোভা আজ আমার মন ভালো নেই” বা “নোভা তোমার কী খবর” বলতে পারো। এটি আগের কয়েকটি বার্তার context ব্যবহার করে স্বাভাবিকভাবে উত্তর দেওয়ার চেষ্টা করে; AI ভুল বুঝতে বা ভুল উত্তর দিতে পারে। বাংলায় বলার জন্য voice page-এ বাংলা recognition নির্বাচন করো। Audio ও বাংলা voice browser/Windows-এর ওপর নির্ভরশীল।

চাইলে “নোভা আড্ডা মোড চালু করো” বলে বা voice page-এর বোতামে আড্ডা মোড চালু করতে পারো। এই window-র chat দিয়ে desktop action, website build, timer বা নতুন memory তৈরি হবে না; অন্য window ও বোতামের কাজ বন্ধ হয় না। আগে থেকে অনুমতির অপেক্ষায় বা চলমান কাজ থাকলে আগে সেটি শেষ/বাতিল করতে হবে। আড্ডা চালু করলে স্বয়ংক্রিয় app-opening permission ও project-revision permission বাতিল হয়। কাজের জন্য “নোভা আড্ডা মোড বন্ধ করো” বলো। Voice বন্ধ বা window বন্ধ করলে মোডও বন্ধ হয়। **প্রতিবার নোভা বলে ডাকতে হবে**; কাছের ব্যক্তি বা recording-ও ডাকতে পারে, কণ্ঠে পরিচয় যাচাই হয় না।

আড্ডার লেখা অন্য chat-এর মতো workspace-এ সংরক্ষিত হয়; সংযুক্ত AI ব্যবহার করলে সাম্প্রতিক আলাপ ও তোমার সংরক্ষিত memories সেই provider-এ পাঠানো হয়। Browser-এর speech service-এ microphone audio যেতে পারে। Memory কেবল স্পষ্টভাবে রাখতে বললে সাধারণ মোডে সংরক্ষিত হয়; আড্ডা মোডে নতুন memory save হয় না। AI সংযুক্ত না থাকলে মাত্র কিছু পূর্বনির্ধারিত আড্ডার উত্তর পাওয়া যাবে; এটি পূর্ণ offline AI নয়।

### Voice দিয়ে একটি static website কাজ (পরীক্ষামূলক)

আলাদা voice window-তে listening চালু থাকলে বলো: “নোভা একটা bakery ওয়েবসাইট তৈরি করো”। NOVA জানাবে বর্ণনা AI provider-এ যাবে এবং তিনটি নতুন static file তৈরি হবে; ৬০ সেকেন্ডের মধ্যে “নোভা অনুমতি দিচ্ছি” বললে কাজ শুরু হবে, অথবা “নোভা বাতিল” বললে হবে না। কাজ চলার সময় “নোভা কাজ বন্ধ করো” বলে থামানোর অনুরোধ দেওয়া যায়। আগেই save শুরু হয়ে গেলে সেটি শেষ হয়ে থাকতে পারে—Saved projects-এ যাচাই করো। সফল হলে sandboxed preview আসে; AI তৈরি code ব্যবহারের আগে যাচাই করো।

একই অনুমতিতে, কাজ শেষ হওয়ার ১৫ মিনিটের মধ্যে ওই project-এ আরও সর্বোচ্চ দুটি চাওয়া পরিবর্তন বলতে পারো: “নোভা ওয়েবসাইটের রঙ নীল করো”। প্রতিটি পরিবর্তনে পুরোনো file বদলানো না হয়ে একটি নতুন version তৈরি হয়। Voice বন্ধ/নতুন project চাইলে অনুমতি বাতিল হয়; session/server বন্ধ হলে মেয়াদ বা অনুমতি থাকে না। কেউ কাছ থেকে কথা বা recording চালিয়েও অনুমতি দিতে পারে—voice পরিচয় যাচাই করে না। এটি কেবল static website prototype: desktop দেখা বা চালানো, installation, server/backend তৈরি বা website প্রকাশ নয়। বাস্তব Windows microphone-এ এই ধাপের পরীক্ষা এখনও বাকি।

### Voice permission ও খবর সতর্কতা: সীমাবদ্ধতা

Continuous voice চালু করলে প্রতিটি অনুরোধের আগে “নোভা” বা “Nova” বলতে হবে; একা নাম বললে পরবর্তী অনুরোধের জন্য কিছুক্ষণ অপেক্ষা করবে। আলাদা voice window-তে সাধারণ action তৈরি হলে NOVA তার নাম ও প্রাসঙ্গিক বিবরণ পড়ে অনুমতি চাইতে পারে। “নোভা অনুমতি দিচ্ছি” / “Nova approve” বা “নোভা বাতিল” / “Nova cancel” বলে সিদ্ধান্ত দাও; অনুরোধ সময়সীমা শেষ হলে আবার বলতে হবে। “নোভা শোনা বন্ধ করো” / “Nova stop listening” বললে voice ও news monitoring বন্ধ হয়। Voice বা recording দিয়ে পরিচয় যাচাই হয় না; বাড়ির অন্য কেউ wake phrase এবং approval বললে সেটিও অনুমোদিত হতে পারে। ভুল মাউস ক্লিক তথ্য মুছে দিতে পারে—কথায় অনুমতি দিলেও স্ক্রিন দেখে নিশ্চিত হও। কিছু কাজ এখনও হাতে review বা screen-sharing চায়; সব ধরনের PC কাজ এই build পারে না।

আলাদা voice window-তে “নোভা খবর সতর্কতা চালু করো” / “Nova news alerts on” বললে বা **Enable news alerts for this session** দিয়ে স্বেচ্ছায় monitor চালু করা যায়। শুধু নতুন নির্বাচিত BBC/Guardian/Jago News-এর যুদ্ধ/পারমাণবিক ঘটনা সম্পর্কিত headline এবং USGS-এর magnitude 6 বা বেশি ভূমিকম্প প্রতিবেদন check করা হয়। প্রথম check বিদ্যমান ঘটনাগুলোকে baseline ধরে, পুনরায় ঘোষণা করে না। পরের match উৎস ও তার link সহ বলা হয়; link প্রকাশকের প্রতিবেদন, স্বাধীনভাবে ঘটনার প্রমাণ নয়। তিন মিনিট পরপর check করার চেষ্টা হয় এবং তথ্য পাঁচ মিনিট cache হতে পারে; খবর ভুল, অসম্পূর্ণ, বিলম্বিত বা বাদ পড়তে পারে। এটি সরকারী emergency সতর্কতা নয়, আক্রমণ নিশ্চিত করতে বা অবস্থানভিত্তিক পরামর্শ দিতে পারে না। জরুরিতে স্থানীয় কর্তৃপক্ষের নির্দেশ অনুসরণ করো। Window/browser বন্ধ, Windows sleep, internet/speech service বা NOVA বন্ধ থাকলে এটি কাজ নাও করতে পারে। বাস্তব Windows microphone ও live alert পরীক্ষা বাকি।


### Windows background voice (নতুন, পরীক্ষামূলক)

`START-NOVA.bat` দিয়ে NOVA চালিয়ে একই laptop-এর localhost NOVA পেজে **Windows background voice (experimental)** চাপো। তথ্য পড়ে বাংলা অথবা English বেছে **I agree · start microphone** দিলে তবেই আলাদা microphone tray worker চালু হওয়ার চেষ্টা করে। Tray-এর আলাদা icon-এ ডান ক্লিক করে **Stop NOVA background voice**, একই পেজের ওই বোতাম, অথবা “Nova stop listening” দিয়ে বন্ধ করা যায়। Tray icon hidden icons-এর তীরের ভেতরে থাকতে পারে। Browser বন্ধ করলেও NOVA server ও Windows চালু থাকলে শোনার চেষ্টা চলবে; restart-এর পর আবার নিজে অনুমতি দিতে হবে। এটি chat-only: desktop কাজ, project, voice approval বা নতুন memory নয়। অন্য browser voice আগের মতোই আছে।

**বাস্তব Windows microphone/tray-এ এখনও পরীক্ষা হয়নি।** Windows-এর System.Speech-এ নির্বাচিত language-এর recognizer ও TTS voice দুটোই দরকার। `bn-BD` recognizer অনেক Windows-এ থাকে না; না থাকলে স্পষ্ট error দেখাবে, তখন বাংলা ব্যবহারে আগের browser voice window ব্যবহার করো। Sleep, hardware/permission, recognition error বা দীর্ঘ uninterrupted speech-এ থামতে দেরি হতে পারে; নিশ্চয়তা নেই। Server বন্ধ হলে worker বন্ধ হওয়ার কথা; সন্দেহ হলে Windows microphone indicator ও tray পরীক্ষা করো।

প্রতিটি অনুরোধের শুরুতে “Nova”/“নোভা” বলো। Recognition ভুল হতে পারে, কাছের যে কেউ বা recording ডাকতে পারে; এটি পরিচয় যাচাই করে না। Windows স্থানীয় recognizer ব্যবহার করে, NOVA audio file রাখে না; wake-যুক্ত কথার text ও reply workspace-এ থাকে এবং সাম্প্রতিক আলাপ ও সংরক্ষিত memory সংযুক্ত AI-তে যেতে পারে। কিছু পরিচিত secret pattern আটকানোর চেষ্টা আছে, তবে সব গোপন তথ্য চেনা যায় না—password/key কখনো বলবে না। শুধু laptop-এর local owner session থেকে চালু/বন্ধ করা যায়; paired phone বা remote proxy নয়।


### লক্ষ্য থেকে ধাপে ধাপে পরিকল্পনা (পরীক্ষামূলক)

Conversation → **Plan a goal**। লক্ষ্য লিখতে বা **Speak goal** দিয়ে বলতে পারো; লেখা দেখে **Send goal & make plan** চাপলে লক্ষ্যটি সংযুক্ত AI provider-এ যায়। পরিকল্পনার জন্য screenshot, আগের chat বা memory পাঠানো হয় না। Password, key বা গোপন তথ্য লিখো/বোলো না। AI ভুল বুঝতে পারে—তার পরামর্শ পড়ে যাচাই করো।

সর্বোচ্চ ছয়টি প্রস্তাবিত ধাপ দেখা যায়। NOVA শুধু নির্দিষ্ট app/site খোলা ও system info নেওয়ার ধাপ প্রস্তুত করতে পারে; **Review this action**-এ আসল কাজ দেখে আলাদা অনুমোদন দিতে হবে। **Approve by voice** চাপলে “অনুমতি দিচ্ছি” বলেও ওই ধাপ অনুমোদন করা যায়—কণ্ঠ পরিচয় যাচাই করে না। Windows bridge সংযুক্ত থাকা লাগে। Agent ফল না জানানো পর্যন্ত পরের ধাপে যাবে না; বন্ধ করার পরও ইতিমধ্যে চলা কাজ শেষ হতে পারে। ফাইল তৈরি, টাইপ/ক্লিক, ডিলিট, ইনস্টল, টাকা পাঠানো বা প্রকাশ এভাবে স্বয়ংক্রিয়ভাবে হয় না। অসমর্থিত কাজ/প্রশ্ন নিজে করতে বা স্পষ্ট করতে হবে; **I did this step** হলো তোমার ঘোষণা, NOVA সেটি যাচাই করে না। সব ধাপ শেষ মানেই পুরো লক্ষ্য পূরণ প্রমাণ নয়।

প্রস্তুত action ও তার ফল activity history-তে থাকে। Plan window বন্ধ বা **Stop plan** দিলে অপেক্ষমাণ/queued ধাপ বাতিলের চেষ্টা হয়; plan দশ মিনিট পর শেষ এবং server restart-এ থাকে না। আলাদা browser voice window-তে “নোভা পরিকল্পনা করো [লক্ষ্য]” বলেও পরিকল্পনা শুরু করা যায়; নিচের voice ধাপগুলো দেখো। আলাদা Windows background voice এখনও শুধু আড্ডা, এই planner চালায় না; বাস্তব Windows microphone/desktop পরীক্ষা বাকি।


### Voice দিয়ে ধাপে ধাপে পরিকল্পনা (পরীক্ষামূলক)

আলাদা voice window-তে **Start voice conversation** চালু করে বলো “নোভা পরিকল্পনা করো আমার কাজ শুরু করতে সাহায্য করো”। NOVA লক্ষ্য ও privacy-এর কথা বলে আলাদা সম্মতি চাইবে। ঠিক থাকলে বলো **“নোভা পরিকল্পনার অনুমতি দিচ্ছি”**; তবেই লক্ষ্য AI provider-এ পাঠাবে। সাধারণ “অনুমতি দিচ্ছি” দিয়ে এই সম্মতি দেওয়া যায় না। পরিকল্পনায় স্ক্রিন, সাম্প্রতিক chat বা memory পাঠানো হয় না; গোপন তথ্য বলবে না।

নির্দিষ্ট কোনো সমর্থিত কাজের প্রকৃত নাম ও বিবরণ শোনার পর কেবল সেটি অনুমোদন করতে বলো **“নোভা এই ধাপ অনুমোদন করো”**। প্রতিটি ধাপে নতুন অনুমতি লাগে। NOVA agent-এর ফলের অপেক্ষা করে পরের ধাপে যায়; queued মানে completed নয়। নিজে করার ধাপ শেষ করলে বলো **“নোভা আমি এই ধাপ শেষ করেছি”**—NOVA সেটি যাচাই করতে পারে না। পুরো লক্ষ্যও স্বাধীনভাবে যাচাই করা হয় না। বন্ধ করতে **“নোভা পরিকল্পনা বন্ধ করো”**; চলমান action তবু শেষ হতে পারে।

Browser voice output-এ error বা বাধার খবর দিলে নিরাপত্তার জন্য plan বন্ধের অনুরোধ যায়; স্ক্রিনের Plan a goal ব্যবহার করো। Speaker mute থাকলে বা তুমি সত্যিই শুনেছ কি না তা NOVA যাচাই করতে পারে না। NOVA কথা বলার সময় শুনতে পারে না, তাই কথা শেষ হলে stop বলো। কণ্ঠ বক্তার পরিচয় যাচাই করে না—কাছের অন্য কেউ বা recording সম্মতি দিতে পারে। Browser-এর speech service audio পেতে পারে, আর speech recognition ভুল শুনতে পারে। Voice window ও NOVA চালু রাখতে হবে; এই upgrade native background voice-এ কাজ করে না। বাস্তব Windows microphone, speaker ও desktop পরীক্ষা এখনও বাকি। পরিকল্পনা শুধু নির্দিষ্ট app/site খোলা ও system info সমর্থন করে; typing, mouse click, install, delete বা send চালায় না।

## Windows native screen permission (পরীক্ষামূলক)

**Desktop control → Native screen permission & view** থেকে আলাদাভাবে অনুমতি দিতে পারো। Browser-এর screen picker লাগে না। Windows-এ NOVA server চলতে হবে; শুধু সেই কম্পিউটারের primary screen দেখা যায়। অনুমতি চালু হওয়া মাত্র ছবি তোলা হয় না—প্রতিটি অনুরোধে একটি still frame নেওয়া হয়। এটি সর্বোচ্চ এক ঘণ্টা থাকে; NOVA বন্ধ বা owner session মেয়াদ শেষ হলে অনুমতি বন্ধ হয়। NOVA window-তে কমলা warning ও Windows notification area-তে আলাদা কমলা screen icon থাকার কথা (hidden icons-এও থাকতে পারে)। **Stop screen access** বা icon-এর Stop দিয়ে বন্ধ করো। নতুন owner session থেকে দেখার অনুরোধ করা যাবে না, তবে বন্ধ করে নতুন অনুমতি দেওয়া যাবে।

প্রতিটি frame ও প্রশ্ন সংযুক্ত AI vision provider-এ পাঠানো হয়। স্ক্রিনে password, ব্যক্তিগত message বা আর্থিক তথ্য থাকতে পারে; আগে এমন বিষয় সরিয়ে নাও। NOVA screenshot database বা log-এ রাখে না, কিন্তু provider তার নিয়ম অনুযায়ী তথ্য রাখতে পারে। Stop চাপলে ইতিমধ্যে পাঠানো ছবি ফেরত আনা যায় না। Provider-এ নির্বাচিত vision model পাওয়া না গেলে বর্ণনা ব্যর্থ হবে; বর্ণনা ভুল বা সংবেদনশীল তথ্যও প্রকাশ করতে পারে। এটি শুধুই দেখা ও বর্ণনার অনুমতি—click, settings বদল, install বা shutdown/restart/sleep নয়।

চাইলে একই owner session-এ Windows background voice চালু করে screen অনুমতির dialog-এ **আলাদাভাবে voice অনুমতি** দাও। তখন “নোভা স্ক্রিনে কী আছে” / “নোভা স্ক্রিনটা দেখো” বা “Nova describe my screen” বলা যায়; কেবল নির্দিষ্ট বাক্যেই ছবি তোলা হবে। “নোভা স্ক্রিন বন্ধ করো” দিয়ে stop-এর অনুরোধ করা যায়। আশেপাশের মানুষ বা recording দিয়েও এটি চালু হতে পারে; voice পরিচয় যাচাই করে না। Windows-এ উপযুক্ত বাংলা recognizer না থাকলে বাংলা কাজ নাও করতে পারে। Voice বন্ধ করা বা request বাতিলের সময় চলমান screen request ও permission বন্ধ করার চেষ্টা হয়; পাঠানো frame ফেরত আনা যায় না।

**গুরুত্বপূর্ণ:** এই worker, Windows tray, primary-screen capture, native microphone/Bengali recognition ও বাস্তব Groq vision এখনও Windows laptop-এ পরীক্ষা করা হয়নি। Automated test-এ এগুলো simulated। কাজ না করলে stop করো; আপাতত এটিকে পূর্ণ স্বাধীন desktop operator বা নিরাপত্তার নিশ্চয়তা মনে করো না।
