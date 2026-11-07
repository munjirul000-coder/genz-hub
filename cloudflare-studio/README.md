# ELOVRA Website Studio — Cloudflare beta

এটি laptop-এর আগের NOVA app-এর সম্পূর্ণ online রূপ নয়। একক owner-এর জন্য একটি আলাদা experimental **static website studio**: Groq দিয়ে plan ও তিনটি file generate/revise, isolated preview, এবং browser-local project storage। Laptop-এর chat/memory, world monitor, voice, desktop control, old projects বা encrypted Groq key এখানে নিজে থেকে আসে না। Backend, database, real login/payment, hosting বা generated website deploy করে না। Output কাজ বা নিরাপদ হওয়ার নিশ্চয়তা নেই; code manually review করো। JavaScript syntax বা বাস্তব browser interaction server-side পরীক্ষা করে না।

## নিরাপত্তা ও storage

- **Cloudflare Access বাধ্যতামূলক**: Worker-এর সব route-এ সরাসরি Cloudflare Access context এবং ঠিক `OWNER_EMAIL` match না হলে 403। Access চালু না করলেও নিজে থেকে public app খুলে যায় না। Access-এ All traffic বেছে শুধু নিজের account/email অনুমোদন করো; অন্য কাউকে অনুমতি দেবে না। Static assets আলাদা asset binding নয়: Cloudflare-এর internal Static Assets router `ctx.access` forward করে না, তাই bundled text হিসেবে এক Worker থেকেই পরিবেশন করা হয়। Preview URL বন্ধ।
- `GROQ_API_KEY` কেবল Cloudflare dashboard-এর **Secret** হিসেবে রাখতে হবে; repo, chat, screenshot, frontend বা সাধারণ variable-এ দেবে না। `OWNER_EMAIL` হলো নিজে লগইন করার email, কোনো password নয়। Worker শুধু hard-coded Groq API-তে request করে। Brief এবং revision-এর আগের file AI provider-এ যাবে।
- সর্বোচ্চ ১৫টি project ফোনের **একটি browser-এর localStorage**-এ থাকে, cloud database নয়। Browser data clear, private browsing, অন্য ফোন বা storage সমস্যা হলে project হারাতে পারে। সবসময় HTML, CSS, JS আলাদা download করে backup রাখো। Storage পূর্ণ হলে পুরোনো project মুছে না; নতুনটি save হবে না, তখনও বর্তমান preview থেকে download করতে হবে।
- Preview opaque iframe ও server-delivered sandbox CSP ব্যবহার করে: network, form submission, parent access বন্ধ। Review করার আগে generated code বিশ্বাস করবে না।
- Free Worker ও Groq quota/availability পরিবর্তন হতে পারে। AI model ও ব্যবহার অনুযায়ী quota বা খরচ হতে পারে। এই version বা live Groq এখনও বাস্তব Cloudflare account-এ deploy/test করা হয়নি।

## GitHub থেকে Cloudflare-এ deploy (কোনো credential chat-এ নয়)

Cloudflare Dashboard-এর বর্তমান UI সময়ের সাথে বদলাতে পারে:

1. **Compute → Workers & Pages → Create application → Import a repository / Connect to Git**। GitHub-এ স্বাভাবিক authorization দিয়ে `munjirul000-coder/genz-hub` repository বেছে নাও। শুধু প্রয়োজনীয় repo access দাও। Production branch `arena/549dbb1e-genz-hub` বেছে নাও; `main`-এ এই version নাও থাকতে পারে।
2. Root directory: `cloudflare-studio`। Build command ফাঁকা; deploy command: `npx --yes wrangler@4.158.0 deploy`। Free plan বেছে deployment শুরু করো। Preview deployments বন্ধ রাখো। Configured না হওয়া পর্যন্ত Worker 403 দেখাবে—এটা expected।
3. Worker → **Access → Protect this Worker behind Access → All traffic**। নিজের Cloudflare account বা নির্দিষ্ট নিজের email-এর policy বেছে Access enable করো। Free tier বেছে নাও; paid plan/card-এর confirmation দেখালে থামো। Account অনুযায়ী Zero Trust onboarding লাগতে পারে। অন্য account থেকে access না পাওয়ার বিষয়টি যাচাই করো।
4. Worker → **Settings → Variables and Secrets**-এ `OWNER_EMAIL`-এ তোমার Access login email দাও (variable); `GROQ_API_KEY`-এ নিজের Groq key **Secret** হিসেবে দাও। Optional `GROQ_MODEL` default `llama-3.3-70b-versatile`। Values chat-এ নয়। Dashboard প্রয়োজনে version deploy করতে বললে করো।
5. Worker-এর **workers.dev** address খোলো। শুধু Access-এ অনুমোদিত নিজের account দিয়ে login করলে Studio দেখাবে। অন্য browser/private window দিয়ে অনুমতি ছাড়া খোলার চেষ্টা করে verify করো। Free UI/plan sign-up, resource limits এবং AI usage বর্তমান provider terms-এর ওপর নির্ভর করে।

## Local tests (simulated Access and AI)

`node --test tests/nova-cloud-studio.test.js` এবং `node tests/nova-cloud-studio-ui.js`। দ্বিতীয় test `npx wrangler@4.158.0 dev` চালিয়ে simulated Access ও mocked AI-এর সঙ্গে headless Chromium পরীক্ষা করে। প্রকৃত Access policy, Groq call ও deployed account পরীক্ষা করতে হবে।
