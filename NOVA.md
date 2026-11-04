# NOVA — Personal AI Workspace

**Your mind, amplified.** একটি Stonic-অনুপ্রাণিত, কিন্তু সম্পূর্ণ original desktop-companion MVP। এটি Gen-Z Hub repo-র ভেতরে আলাদা route, আলাদা SQLite database এবং আলাদা session দিয়ে চলে; existing social platform অপরিবর্তিত থাকে।

> এটি Stonic AI-এর copy বা affiliated product নয়। এখানে যা কাজ করে তা নিচে সৎভাবে লেখা আছে; screen awareness, always-on wake word, live world monitor এবং arbitrary desktop automation এই build-এ নেই।

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
- **Voice** — browser speech recognition দিয়ে push-to-talk; optional spoken replies। Browser/OS-এর voice-এর ওপর নির্ভর করে।
- **Phone remote** — one-time pairing code, shared workspace, owner settings protected, revoke anytime।
- **Focus timer** — start/pause/reset, 15/25/50 min presets, page বদলালেও চলে।
- **NOVA / ATLAS persona** — আলাদা accent ও voice preference।
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
2. **Generate token** চাপো। Token একবারই দেখানো হয়। **Save token file** দিয়ে `nova-bridge.token` নামে agent-এর পাশে রাখো।
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
| Open YouTube / Spotify / WhatsApp | Default browser-এ fixed URL খোলে |
| Open Notepad / Calculator | Windows app launch |
| Open Downloads | Downloads folder খোলে |
| System information | OS, CPU, RAM, uptime পড়ে |
| WhatsApp draft | International number + text দিয়ে draft খোলে; **Send নিজে চাপতে হবে** |

**যা কখনোই চলে না:** arbitrary shell command, custom executable/URL, file delete/format, shutdown, screen capture, automatic WhatsApp send। Approval ২ মিনিটে expire হয়। Agent heartbeat ছাড়া system info দেখায় না।

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
2. Link কপি করে ফোনে খোলো, অথবা `/nova`-তে ১০-character code দাও।
3. Code ৫ মিনিটে expire হয় এবং একবার ব্যবহার হয়।
4. ফোন chat, memory ও desktop approval করতে পারে; workspace delete, bridge token generate বা owner settings বদলাতে পারে না।
5. **Settings → Paired phones → Revoke** দিলে access সাথে সাথে বন্ধ।

---

## Privacy ও বাস্তব সীমা

- Workspace session browser-এ থাকে; server data SQLite-এ। Public preview-তে data sandbox server-এ থাকে, তোমার PC-তে নয়।
- Voice input browser-এর speech service ব্যবহার করতে পারে; এটি offline wake-word listener নয়।
- Browser/OS voice না থাকলে spoken reply বা Bengali recognition সীমিত হতে পারে।
- Desktop bridge-কে polling-এর সময় নিজের system info server-এ পাঠাতে হয়; সেটা শুধু সেই workspace-এ দেখা যায়।
- এটি single-user companion MVP, enterprise multi-tenant product নয়। নিজের server HTTPS, backup ও access control দিয়ে চালাও।
- Live news/globe, screen understanding, file search, calendar/email integration, wake word এই version-এর বাইরে।

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
