# NOVA laptop setup (Windows 10/11)

এই গাইডটা তোমার নিজের Windows laptop-এ NOVA চালানোর জন্য। Public preview তোমার PC control করতে পারে না; desktop action চালাতে হলে NOVA server + bridge agent দুটোই তোমার laptop-এ চালানো সবচেয়ে সহজ।

## একবারের automatic updater setup

এই নির্দিষ্ট laptop-এর আগের NOVA ও bridge terminal বন্ধ করে `SETUP-NOVA-AUTO-UPDATE.bat` একবার download করে double-click করো; `Y` চাপলে installer-এর প্রয়োজনীয় file নিজে download করবে। ZIP নিজে download বা extract করতে হবে না। বিকল্প হিসেবে পুরো ZIP আলাদা folder-এ extract করে তার `SETUP-AUTO-UPDATE.bat` চালানো যায়। এটি `Documents\genz-hub-arena-549dbb1e-genz-hub\genz-hub-arena-549dbb1e-genz-hub`-এ থাকা আগের NOVA-তে শুধু updater bootstrap বসায়, data বা key overwrite করে না। ওই পুরোনো folder অন্য জায়গায় থাকলে installer থামবে; তখন screenshot নিয়ে সাহায্য নাও। এরপর আগের `START-NOVA.bat` বা তার desktop shortcut দিয়ে চালাও। Internet থাকলে প্রতিবার startup-এ update check হয়। Bridge-এর code পরিবর্তন হলে bridge terminal-ও restart করতে হবে।

Update নির্দিষ্ট GitHub branch থেকে আসে এবং code signature নেই: branch-এর লেখকদের বিশ্বাস করতে হবে। SQLite এবং vault key-এর backup `data/nova-updater`-এ জমে, সেগুলোও ব্যক্তিগত রাখতে হবে। Project-এর আলাদা backup রাখো। Offline থাকলে আগে থেকে install থাকা version চালানোর চেষ্টা করে। সফল update-এর পর runtime bug হলেও স্বয়ংক্রিয় rollback নিশ্চিত নয়। বিস্তারিত `NOVA.md`।

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

## Voice, character ও world monitor

- Conversation-এ **Start voice conversation** চাপলে browser microphone দিয়ে কথা শুনবে ও উত্তর পড়বে। **Stop voice conversation** চাপলে বন্ধ হয়। Bengali-এর জন্য Settings-এ **বাংলা** select করো; mic ও voice browser-এর ওপর নির্ভর করে এবং speech browser provider-এর কাছে যেতে পারে।
- Settings-এ **JARVIS**, **Mentor**, **Custom** বেছে voice/name/behaviour save করো। একই workspace-এ paired ফোন একই character settings পায়।
- Sidebar → **World monitor** → **3D globe** বা **2D map**। USGS-এর সাম্প্রতিক earthquake ও BBC World headline ইন্টারনেট পেলে দেখাবে। Feed বন্ধ থাকলে error দেখাবে; এখানে সব ধরনের world event নেই।

## Project builder ও screen viewer (পরীক্ষামূলক)

Conversation → **Project builder**-এ কী ধরনের website চাও লেখো। **Approve by voice** চেপে `অনুমতি দিচ্ছি` বললে NOVA একটি নতুন static website-এর তিনটি file বানানোর চেষ্টা করবে। এটি এক project-এর অনুমতি, পুরো PC চালানোর অনুমতি নয়। Preview দেখে project ZIP download করা যায়। Internet ও Groq connection দরকার। Generated code verify করে ব্যবহার করবে।

Desktop control → **Share screen** চাপলে browser-এ screen বেছে নিতে হবে। **Analyze screen** চাপলে নির্বাচিত screen-এর একটি ছবি এবং প্রশ্ন তোমার AI provider-এ যাবে—private তথ্য আগে বন্ধ করো। Vision model support না থাকলে error দেখাবে। AI চাইলে পুরো primary monitor-এর জন্য click point প্রস্তাব করে; point দেখে প্রতিবার নিজে অনুমতি দিতে হবে। ভুল point বা বদলে যাওয়া screen-এ click করলে delete-সহ ক্ষতি হতে পারে। আলাদা **Visual work** session চালু করলে একবার অনুমতিতে সর্বোচ্চ ১২ step click বা এক-লাইন type করতে পারে; ভুল click-এ delete হতে পারে এবং ঝুঁকি শনাক্ত সবসময় সফল নাও হতে পারে। বাস্তব Windows microphone, screen sharing, mouse ও keyboard পরীক্ষা করা হয়নি।

## Visual work session (পরীক্ষামূলক)

**Visual work**-এ পুরো primary screen share করে লক্ষ্য লিখলে, একবার button বা voice অনুমতিতে NOVA screen দেখে একাধিক সীমিত step চালাতে পারে। প্রতি step-এ screenshot তোমার AI provider-এ যায়; গোপন জিনিস বন্ধ রাখো। Stop করলে পরবর্তী কাজ থামে, তবে আগে থেকে চলমান Windows action শেষ হতে পারে। ভুল click বা delete শনাক্ত না হওয়ার ঝুঁকি আছে—backup রাখো ও কাজের দিকে নজর রাখো। Website project এখন তিনটি static file; app/backend তৈরি বা install করে না। বাস্তব Windows ও Groq vision-এ পরীক্ষা বাকি।

## Website বানানো (প্রথম version)

Conversation-এ যেমন `ekta bakery website banao` লিখে পাঠালেও NOVA একটি নতুন static website তৈরি করার চেষ্টা করে। Voice input থাকলে microphone button চেপে বলাও যায়; এটি সব ধরনের project বা desktop control নয়। Speech recognition browser-এর ওপর নির্ভর করে, আর তোমার অনুরোধ সংযুক্ত AI provider-এ পাঠানো হয়।

1. Groq connect করে Conversation page-এ **Build website** চাপো।
2. কী ধরনের website চাও লিখে **Generate website** চাপো। তোমার description সংযুক্ত AI provider-এ পাঠানো হবে; গোপন তথ্য লিখবে না।
3. NOVA নতুন project হিসেবে file নিজে save করবে। Preview দেখে চাইলে **Download index.html** চাপলে আলাদা copy download হবে। Preview একটি আলাদা sandbox-এ JavaScript চালায়; network ও form বন্ধ থাকে। Preview-তে গোপন তথ্য লিখবে না।
4. পরে আবার দেখতে **Build website → Saved websites** চাপো। Project-গুলো `data/nova/projects/`-এ থাকে; workspace delete করলেও এগুলো নিজে থেকে delete করা হয় না। কোনো website open করে preview বন্ধ করার পরে chat-এ যেমন `website change the title` লিখলে NOVA আগের code AI provider-এ পাঠিয়ে নতুন version তৈরি করার চেষ্টা করবে। আগের version বদলানো বা delete করা হবে না। Preview-তে সর্বশেষ খোলা site-এ পরিবর্তন প্রযোজ্য; না খুলে থাকলে সর্বশেষ তৈরি site ব্যবহার হবে।
5. এটি একটি এক-file static prototype; বাস্তব login, payment, database, hosting বা autonomous project editing করে না। AI-generated code ভুল বা অনিরাপদ হতে পারে—বিশ্বাসের আগে review করো।

নতুন ZIP আলাদা folder-এ খুললে পুরনো workspace স্বয়ংক্রিয়ভাবে আসে না। পুরনো NOVA বন্ধ করে `data/nova` folder-টির backup রাখো; workspace ও encrypted key ফেরত পেতে database এবং vault key একসাথে রাখতে হবে।

## 5) Windows desktop control চালাও

**সহজ উপায়:** এই laptop-এ NOVA খুলে **Desktop control → Connect this PC → Connect** চাপো। Token copy বা আলাদা ফাইল লাগে না। NOVA খোলা রাখো। বন্ধ করতে একই পেজে **Disconnect this PC** চাপো। একবার সম্মতি দিলে NOVA restart হলে bridge নিজে reconnect করার চেষ্টা করবে, যতক্ষণ না তুমি Disconnect চাপো। Browser tab বন্ধ করলেও NOVA server চালু থাকলে bridge চলবে। Connect করলে আগের bridge token এবং অপেক্ষমাণ action বাতিল হতে পারে; সাধারণ action review লাগে, আর অনুমোদিত visual session একাধিক সাধারণ step চালাতে পারে। অন্য ফোন বা hosted preview থেকে এই local shortcut চালু করা যায় না। নিচের ধাপগুলো শুধু manual setup-এর বিকল্প।

1. NOVA → **Desktop control** → **Generate token**।
2. **Copy token** চাপো, Notepad-এ paste করে `nova-bridge.token` নামে save করো। Token কাউকে দেখাবে না।
3. File টা repo-র `desktop` folder-এ রাখো। সেই folder-এ `nova-agent.js` আর `START-BRIDGE.bat` আছে।
4. **`desktop\START-BRIDGE.bat`** double-click করো।
5. Server URL জিজ্ঞেস করলে সাধারণত শুধু Enter চাপো: `http://localhost:3000`।
6. NOVA-তে `Open YouTube` বা `ইউটিউব খোলো` লিখো।
7. **Review → Approve & run** চাপো। Approval ছাড়া কিছু চলে না।

Bridge window open থাকলে desktop control কাজ করবে। বন্ধ করতে `Ctrl+C`।

### পরীক্ষামূলক mouse control

Updated NOVA এবং updated Windows bridge দুটোই দরকার। Desktop control-এ **Mouse control**-এ X/Y screen coordinate দিয়ে **Review move** বা **Review left click** চাপো, তারপর owner হিসেবে অনুমতি দাও। Chat-এ `mouse move 500 300` বা `mouse click 500 300`-ও বলা যায়। NOVA screen দেখতে পারে না, তাই নিজে লক্ষ্যবস্তু চিনতে পারে না। ভুল জায়গায় click করলে file delete-সহ যেকোনো action হতে পারে—screen দেখে অনুমতি দেবে। প্রতিটি move/click-এ আলাদা অনুমতি লাগে; voice approval ব্যবহার করলেও প্রতিটি action আলাদা অনুমোদন করতে হবে। Windows-এর virtual screen-এর বাইরে coordinate হলে তা প্রত্যাখ্যাত হবে। এই নতুন mouse feature বাস্তব Windows laptop-এ এখনো পরীক্ষা করা হয়নি।

### পরীক্ষামূলক Notepad typing এবং voice approval

Desktop control-এ **Keyboard: type in a supported app**-এ Notepad বেছে এক লাইনের লেখা দিয়ে **Review typing** চাপো। অনুমতির পরে সঙ্গে সঙ্গে Notepad সামনে আনো; bridge action পাওয়ার প্রায় পাঁচ সেকেন্ড পর শুধু foreground Notepad-এ লিখবে। Focus অন্যত্র চলে গেলে থামার চেষ্টা করবে; কিছু লেখা ইতোমধ্যে লেখা হয়ে থাকতে পারে। এছাড়া keyboard target list থেকে Chrome, Edge, Firefox, VS Code, Word, Excel বা PowerPoint বেছে এক লাইন লেখা যায়; নির্দিষ্ট app ও সঠিক text field সামনে আনতে হবে। Shortcuts, Enter বা arbitrary commands সমর্থিত নয়। লেখাটি action history-তে সংরক্ষিত হয় এবং paired device দেখতে পারে—কখনো password বা secret দেবে না।

Connected bridge থাকলে action review-এ **Approve by voice** চেপে `অনুমতি দিচ্ছি` বলেও ওই একটি action অনুমোদন করা যায়। Browser-এর speech recognition প্রয়োজন এবং browser vendor-এর service ব্যবহৃত হতে পারে। **Voice দিয়ে বক্তার পরিচয় যাচাই হয় না**—কাছে থাকা অন্য কেউ বা recording-ও একই কথা বলতে পারে। একবারে সব কাজের অনুমতি দেওয়া হয় না; প্রতিটি action আলাদা অনুমোদন লাগে। আসল Windows keyboard input ও microphone recognition এখনো বাস্তব laptop-এ পরীক্ষা করা হয়নি।



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

বাইরের network থেকে ফোনে চালাতে আলাদা private VPN বা HTTPS endpoint setup দরকার; শুধু laptop চালু রাখলে সরাসরি internet access তৈরি হয় না। `localhost` ফোনে দিলে laptop নয়, ফোনকেই বোঝায়। নিরাপত্তার জন্য router-এ সরাসরি port খুলবে না।


### আলাদা voice window (পরীক্ষামূলক)

Conversation বা Overview-এ **Open separate voice window → Open window** চাপো। নতুন window-তে **Start voice conversation** চাপো, microphone permission দাও এবং NOVA বা নোভা বলে অনুরোধ শুরু করো। মূল NOVA tab বন্ধ করা যায়, কিন্তু আলাদা voice window, Chrome এবং NOVA server চালু থাকতে হবে; voice window minimize করা যায়। এটি browser-এর speech recognition-এর ওপর নির্ভর করে, তাই background-এ থেমে যেতে পারে এবং Windows sleep/Chrome বন্ধ থাকলে কাজ করে না। Listening চলাকালে browser-এর speech service-এ audio যেতে পারে, এমনকি wake word না থাকলেও। যে কেউ বা recording নোভা বলতে পারে; কণ্ঠ দিয়ে পরিচয় যাচাই হয় না।

ইচ্ছা করলে আলাদা নিশ্চিতকরণ দিয়ে শুধু Firefox, Chrome, Edge, Notepad ও Calculator এই session-এ স্পষ্ট ও local-recognized নির্দেশে review ছাড়া খুলতে দিতে পারো; AI দিয়ে বোঝা নির্দেশ ও অন্য action review লাগে, voice বন্ধ করলে অনুমতি মুছে যায়। অন্য action review লাগে; চলমান কাজ stop-এর পরেও শেষ হতে পারে। বাস্তব Windows-এ minimized microphone ও wake word যাচাই বাকি। বাংলাদেশ সংবাদ Jago News 24 থেকে সর্বশেষ national/country/politics/economy headlines হিসেবে আসে; feed পুরোনো বা unavailable হলে জানানো হয়। BBC/Guardian বিশ্ব সংবাদ অপরিবর্তিত।


### Voice permission ও খবর সতর্কতা: সীমাবদ্ধতা

Continuous voice চালু করলে প্রতিটি অনুরোধের আগে “নোভা” বা “Nova” বলতে হবে; একা নাম বললে পরবর্তী অনুরোধের জন্য কিছুক্ষণ অপেক্ষা করবে। আলাদা voice window-তে সাধারণ action তৈরি হলে NOVA তার নাম ও প্রাসঙ্গিক বিবরণ পড়ে অনুমতি চাইতে পারে। “নোভা অনুমতি দিচ্ছি” / “Nova approve” বা “নোভা বাতিল” / “Nova cancel” বলে সিদ্ধান্ত দাও; অনুরোধ সময়সীমা শেষ হলে আবার বলতে হবে। “নোভা শোনা বন্ধ করো” / “Nova stop listening” বললে voice ও news monitoring বন্ধ হয়। Voice বা recording দিয়ে পরিচয় যাচাই হয় না; বাড়ির অন্য কেউ wake phrase এবং approval বললে সেটিও অনুমোদিত হতে পারে। ভুল মাউস ক্লিক তথ্য মুছে দিতে পারে—কথায় অনুমতি দিলেও স্ক্রিন দেখে নিশ্চিত হও। কিছু কাজ এখনও হাতে review বা screen-sharing চায়; সব ধরনের PC কাজ এই build পারে না।

আলাদা voice window-তে “নোভা খবর সতর্কতা চালু করো” / “Nova news alerts on” বললে বা **Enable news alerts for this session** দিয়ে স্বেচ্ছায় monitor চালু করা যায়। শুধু নতুন নির্বাচিত BBC/Guardian/Jago News-এর যুদ্ধ/পারমাণবিক ঘটনা সম্পর্কিত headline এবং USGS-এর magnitude 6 বা বেশি ভূমিকম্প প্রতিবেদন check করা হয়। প্রথম check বিদ্যমান ঘটনাগুলোকে baseline ধরে, পুনরায় ঘোষণা করে না। পরের match উৎস ও তার link সহ বলা হয়; link প্রকাশকের প্রতিবেদন, স্বাধীনভাবে ঘটনার প্রমাণ নয়। তিন মিনিট পরপর check করার চেষ্টা হয় এবং তথ্য পাঁচ মিনিট cache হতে পারে; খবর ভুল, অসম্পূর্ণ, বিলম্বিত বা বাদ পড়তে পারে। এটি সরকারী emergency সতর্কতা নয়, আক্রমণ নিশ্চিত করতে বা অবস্থানভিত্তিক পরামর্শ দিতে পারে না। জরুরিতে স্থানীয় কর্তৃপক্ষের নির্দেশ অনুসরণ করো। Window/browser বন্ধ, Windows sleep, internet/speech service বা NOVA বন্ধ থাকলে এটি কাজ নাও করতে পারে। বাস্তব Windows microphone ও live alert পরীক্ষা বাকি।
