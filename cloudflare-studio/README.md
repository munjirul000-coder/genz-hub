# ELOVRA Website Studio — Cloudflare beta

এটি laptop-এর আগের NOVA app-এর সম্পূর্ণ online রূপ নয়। একক owner-এর জন্য একটি আলাদা experimental **static website studio**: Groq দিয়ে plan ও তিনটি file generate/revise, isolated preview, এবং browser-local project storage। Laptop-এর chat/memory, world monitor, voice, desktop control, old projects বা encrypted Groq key এখানে নিজে থেকে আসে না। Backend, database, real login/payment, hosting বা generated website deploy করে না। Output কাজ বা নিরাপদ হওয়ার নিশ্চয়তা নেই; code manually review করো। JavaScript syntax বা বাস্তব browser interaction server-side পরীক্ষা করে না।

## নিরাপত্তা ও storage

- **Default authentication হলো Cloudflare Access**: Worker-এর সব route-এ সরাসরি Access context এবং ঠিক `OWNER_EMAIL` match না হলে 403। বিকল্প হিসেবে নিচের GitHub login স্পষ্টভাবে configure করা যায়; কোনোটিই configured না হলে app বন্ধ থাকে। Static assets bundled text হিসেবে এক Worker থেকে পরিবেশন করা হয়; আলাদা Static Assets router `ctx.access` forward করে না। Preview URL বন্ধ।
- `GROQ_API_KEY` কেবল Cloudflare dashboard-এর **Secret** হিসেবে রাখতে হবে; repo, chat, screenshot, frontend বা সাধারণ variable-এ দেবে না। `OWNER_EMAIL` হলো নিজে লগইন করার email, কোনো password নয়। Worker শুধু hard-coded Groq API-তে request করে। Brief এবং revision-এর আগের file AI provider-এ যাবে।
- সর্বোচ্চ ১৫টি project ফোনের **একটি browser-এর localStorage**-এ থাকে, cloud database নয়। Browser data clear, private browsing, অন্য ফোন বা storage সমস্যা হলে project হারাতে পারে। সবসময় HTML, CSS, JS আলাদা download করে backup রাখো। Storage পূর্ণ হলে পুরোনো project মুছে না; নতুনটি save হবে না, তখনও বর্তমান preview থেকে download করতে হবে।
- Preview opaque iframe ও server-delivered sandbox CSP ব্যবহার করে: network, form submission, parent access বন্ধ। Review করার আগে generated code বিশ্বাস করবে না।
- Free Worker ও Groq quota/availability পরিবর্তন হতে পারে। AI model ও ব্যবহার অনুযায়ী quota বা খরচ হতে পারে। এই version বা live Groq এখনও বাস্তব Cloudflare account-এ deploy/test করা হয়নি।

## GitHub থেকে Cloudflare-এ deploy (কোনো credential chat-এ নয়)

Cloudflare Dashboard-এর বর্তমান UI সময়ের সাথে বদলাতে পারে। Build details-এ branch, root directory এবং commit যাচাই করো; ভুল branch বা `/` root থেকে build হলে অন্য site deploy হতে পারে।

1. **Compute → Workers & Pages → Create application → Import a repository / Connect to Git**। GitHub-এ স্বাভাবিক authorization দিয়ে `munjirul000-coder/genz-hub` repository বেছে নাও। শুধু প্রয়োজনীয় repo access দাও। Production branch `arena/549dbb1e-genz-hub` বেছে নাও; `main`-এ এই version নাও থাকতে পারে।
2. Root directory: `cloudflare-studio`। Build command ফাঁকা; deploy command: `npx --yes wrangler@4.158.0 deploy`। Build environment-এ `NODE_VERSION=22` দাও (Wrangler 4.158.0-এর Node 22+ প্রয়োজন); এই root-এ `.node-version`-ও 22 নির্দিষ্ট করে। Free plan বেছে deployment শুরু করো। Preview deployments বন্ধ রাখো। Configured না হওয়া পর্যন্ত Worker 403 দেখাবে—এটা expected।
3. Worker → **Access → Protect this Worker behind Access → All traffic**। নিজের Cloudflare account বা নির্দিষ্ট নিজের email-এর policy বেছে Access enable করো। Free tier বেছে নাও; paid plan/card-এর confirmation দেখালে থামো। Account অনুযায়ী Zero Trust onboarding লাগতে পারে। অন্য account থেকে access না পাওয়ার বিষয়টি যাচাই করো।
4. Worker → **Settings → Variables and Secrets**-এ `OWNER_EMAIL`-এ তোমার Access login email দাও (variable); `GROQ_API_KEY`-এ নিজের Groq key **Secret** হিসেবে দাও। Optional `GROQ_MODEL` default `llama-3.3-70b-versatile`। Values chat-এ নয়। Dashboard প্রয়োজনে version deploy করতে বললে করো।
5. Worker-এর **workers.dev** address খোলো। শুধু Access-এ অনুমোদিত নিজের account দিয়ে login করলে Studio দেখাবে। অন্য browser/private window দিয়ে অনুমতি ছাড়া খোলার চেষ্টা করে verify করো। Free UI/plan sign-up, resource limits এবং AI usage বর্তমান provider terms-এর ওপর নির্ভর করে।

## বিকল্প: কার্ড ছাড়া GitHub OAuth login (experimental)

Cloudflare Zero Trust Free onboarding-এ payment method চাইতে পারে। এই বিকল্পে Zero Trust লাগে না, তবে নিজের GitHub account ও OAuth app লাগবে। এটি locally mocked tests-এ যাচাই করা, **বাস্তব GitHub OAuth এবং Cloudflare account-এ এখনো যাচাই করা হয়নি**। শুধু এক owner-এর জন্য। GitHub account সুরক্ষিত রাখো, preferably two-factor authentication ব্যবহার করো।

1. GitHub account-এ Settings → Developer settings → OAuth Apps → New OAuth App। একেবারে নতুন app তৈরি করো, repository scope চেয়ো না। Homepage URL নিজের Worker-এর HTTPS origin, এবং Authorization callback URL ঠিক `https://<worker-host>/auth/github/callback`। Device flow বন্ধ রাখো।
2. Client ID এবং একটি নতুন Client Secret তৈরি করো; secret কারও কাছে, chat-এ, screenshot-এ বা Git-এ দিয়ো না।
3. Cloudflare Worker → Settings → Variables and Secrets-এ `APP_ORIGIN` (যেমন `https://your-worker.workers.dev`, শেষে slash নেই), `GITHUB_CLIENT_ID`, `GITHUB_OWNER_ID` (GitHub `/users/<username>` API-এর numeric id) এবং `AUTH_MODE=github` text variable হিসেবে দাও। `GITHUB_CLIENT_SECRET` একটি **Secret** হিসেবে দাও। সব সেট হওয়ার আগে login খুলবে না। আগের deployment-এর dashboard variables ধরে রাখতে `keep_vars` আছে।
4. `GROQ_API_KEY` আলাদা **Secret** হিসেবে যোগ করো। Credentials কোনো ব্যক্তি বা AI-কে না পাঠিয়ে কেবল নিজের dashboard-এ দাও।
5. Owner GitHub login যাচাই করো; অন্য GitHub account ও incognito session দিয়ে Studio এবং API-তে ঢোকা যায় না তা যাচাই করো। Session signed, HTTP-only cookie, সর্বোচ্চ আট ঘণ্টা। Log out এই browser-এর cookie মুছে; চুরি হওয়া session সঙ্গে সঙ্গে revoke করতে GitHub client secret বদলাতে হবে।

এই authentication Cloudflare Access-এর বদলি experimental app-level protection, সমতুল্য security audit বা MFA নয়। GitHub-এ MFA রাখা এবং strong account security জরুরি। Provider বা Worker failure এবং free quota এখনও বাস্তবে পরীক্ষা হয়নি। এ deployment-এর Wrangler config-এ `AUTH_MODE=github` এবং public app settings দেওয়া আছে; client secret না থাকলে এটি fail closed। Access mode চাইলে config-এ mode বদলে OWNER_EMAIL এবং Access policy ঠিক করতে হবে।

## Local tests (simulated Access, GitHub and AI)

`node --test tests/nova-cloud-studio.test.js tests/nova-cloud-github-auth.test.js` এবং `node tests/nova-cloud-studio-ui.js`। দ্বিতীয় test `npx wrangler@4.158.0 dev` চালিয়ে simulated Access ও mocked AI-এর সঙ্গে headless Chromium পরীক্ষা করে। প্রকৃত Access policy, Groq call ও deployed account পরীক্ষা করতে হবে।
