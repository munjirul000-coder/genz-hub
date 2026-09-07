/* ============================================================
   IdeaPulse — i18n (English / বাংলা)
   ============================================================ */
(function () {
  'use strict';

  var DICT = {
    en: {
      // Meta / document titles
      'meta.title.home': 'IdeaPulse — What do you wish existed?',
      'meta.title.submit': 'What could be better? — IdeaPulse',
      'meta.title.thanks': 'Thank you for sharing — IdeaPulse',
      'meta.title.login': 'Admin Login — IdeaPulse',
      'meta.title.admin': 'Admin Dashboard — IdeaPulse',

      // Nav
      'nav.how': 'How It Works',
      'nav.examples': 'Examples',
      'nav.privacy': 'Privacy',
      'nav.share': 'Share a Problem',
      'nav.admin': 'Admin',

      // Hero
      'hero.eyebrow': 'Discover what people really need',
      'hero.title.a': 'What do you',
      'hero.title.b': 'wish existed?',
      'hero.sub': 'Tell us about a problem you face and the solution you wish existed. Your feedback can help shape better products and services.',
      'hero.cta.primary': 'Share a Problem',
      'hero.cta.secondary': 'How It Works',
      'hero.privacy': 'Your response is private. Other users cannot see what you submit.',
      'hero.chip.anon': '100% anonymous',
      'hero.chip.need': 'Real needs → potential opportunities',

      // How it works
      'how.eyebrow': 'How it works',
      'how.title.a': 'From problem to',
      'how.title.b': 'possibility',
      'how.sub': 'No accounts. No names. Just your honest take on what\u2019s broken and what would fix it.',
      'step.1.t': 'Tell us your problem',
      'step.1.d': 'What\u2019s annoying, broken, or missing in your daily life? Type it out in plain words.',
      'step.2.t': 'Tell us what would help',
      'step.2.d': 'Describe the product, service, or solution you wish existed to make it better.',
      'step.3.t': 'We analyze patterns',
      'step.3.d': 'We group similar problems and look for recurring themes people keep reporting.',
      'step.4.t': 'Needs become opportunities',
      'step.4.d': 'Real, repeated needs surface as potential opportunities worth exploring.',

      // Examples
      'examples.eyebrow': 'Example problems',
      'examples.title': 'What people often wish for',
      'examples.sub': 'These are examples to spark ideas — not real submissions.',
      'ex.food': 'It\u2019s hard to find genuinely organic food.',
      'ex.edu': 'I need affordable practical courses that teach real-world skills.',
      'ex.shop': 'I can\u2019t easily find reliable local products online.',
      'ex.biz': 'Small businesses need simple tools without expensive subscriptions.',

      // Privacy
      'privacy.eyebrow': 'Privacy first',
      'privacy.title.a': 'Your submission is',
      'privacy.title.b': 'private.',
      'privacy.body.1': 'Other users cannot browse or search your response. We don\u2019t collect your name, phone number, email, or exact address — and we don\u2019t store your IP address.',
      'privacy.body.2': 'What you share is only analyzed anonymously, in aggregate, to spot patterns and potential opportunities.',
      'privacy.card.1.t': 'No names or emails',
      'privacy.card.1.d': 'We never ask who you are.',
      'privacy.card.2.t': 'No public browsing',
      'privacy.card.2.d': 'No one can browse or search other people\u2019s responses.',
      'privacy.card.3.t': 'Aggregated only',
      'privacy.card.3.d': 'Feedback is analyzed anonymously for research and opportunity discovery.',
      'privacy.cta': 'Share a Problem',

      // CTA
      'cta.title': 'Tell us what should exist.',
      'cta.sub': 'It takes less than a minute. No account needed.',
      'cta.btn': 'Share a Problem',

      // Footer
      'footer.tagline': 'Discover what people really need.',

      // Submit
      'submit.eyebrow': 'Anonymous · under a minute',
      'submit.title.a': 'What could be',
      'submit.title.b': 'better?',
      'submit.sub': 'Two questions. That\u2019s it. No account, no name, no email.',
      'submit.q1': 'What problem do you face?',
      'submit.q1.ph': 'Example: I can\u2019t find reliable organic food in my area.',
      'submit.q1.hint': 'Describe it in your own words — big or small.',
      'submit.q2': 'What would make this better for you?',
      'submit.q2.ph': 'Example: A trusted service that delivers genuinely organic food at reasonable prices.',
      'submit.q2.hint': 'A product, service, or idea you wish existed.',
      'submit.category': 'Category',
      'submit.optional': '(optional)',
      'submit.autodetect': 'Auto-detect',
      'submit.location': 'Broad location',
      'submit.location.ph': 'e.g. Dhaka / city or area only',
      'submit.location.hint': 'City or area only — never your exact address.',
      'submit.consent': 'I understand that my response may be analyzed anonymously for research and business opportunity discovery.',
      'submit.btn': 'Submit Anonymously',
      'submit.privacy': 'Your response is private. Other users cannot see what you submit.',

      // Categories
      'cat.food': 'Food',
      'cat.shopping': 'Shopping',
      'cat.education': 'Education',
      'cat.business': 'Business',
      'cat.technology': 'Technology',
      'cat.transportation': 'Transportation',
      'cat.healthcare': 'Healthcare',
      'cat.entertainment': 'Entertainment',
      'cat.home': 'Home',
      'cat.finance': 'Finance',
      'cat.other': 'Other',

      // Thanks
      'thanks.title.a': 'Thank you for',
      'thanks.title.b': 'sharing.',
      'thanks.body': 'Your response has been securely recorded and may help us understand what people really need.',
      'thanks.again': 'Share Another Problem',
      'thanks.home': 'Back to Home',

      // Login
      'login.title': 'Admin Login',
      'login.sub': 'Private area — authorized admins only.',
      'login.email': 'Admin email / username',
      'login.password': 'Password',
      'login.btn': 'Sign in',
      'login.signing': 'Signing in…',
      'login.fail': 'Sign in failed.',
      'login.back': '← Back to site',
      'admin.viewsite': 'View site',
      'admin.logout': 'Log out',

      // Admin nav
      'nav.overview': 'Overview',
      'nav.submissions': 'Submissions',
      'nav.opportunities': 'Opportunities',
      'nav.analytics': 'Analytics',

      // Overview
      'ov.total': 'Total submissions',
      'ov.today': 'Today',
      'ov.week': 'This week',
      'ov.month': 'This month',
      'ov.problems': 'Most frequently mentioned problems',
      'ov.categories': 'Top categories',
      'ov.trending': 'Trending opportunities',
      'ov.trending.hint': 'Most activity in the last 30 days',
      'ov.related': 'related submission',
      'ov.related.pl': 'related submissions',
      'ov.empty.subs': 'No submissions yet.',
      'ov.empty.data': 'No data yet.',
      'ov.empty.opp': 'No opportunities yet. They appear automatically once related problems are submitted.',

      // Common
      'common.loading': 'Loading…',
      'common.error': 'Something went wrong',

      // Submissions
      'sub.export.csv': 'Export CSV',
      'sub.export.excel': 'Export Excel',
      'sub.search.ph': 'Search: organic, food, delivery…',
      'sub.allcats': 'All categories',
      'sub.allloc': 'All locations',
      'sub.sort.newest': 'Newest first',
      'sub.sort.oldest': 'Oldest first',
      'sub.sort.category': 'By category',
      'sub.sort.location': 'By location',
      'sub.th.id': 'ID',
      'sub.th.date': 'Date / Time',
      'sub.th.category': 'Category',
      'sub.th.problem': 'Problem',
      'sub.th.solution': 'Desired Solution',
      'sub.th.location': 'Location',
      'sub.prev': '← Prev',
      'sub.next': 'Next →',
      'sub.page': 'Page',
      'sub.page.of': 'of',
      'sub.empty': 'No submissions match your filters.',

      // Opportunities
      'opp.title': 'Potential Opportunities',
      'opp.reanalyze': '⟳ Re-analyze',
      'opp.analyzing': 'Analyzing…',
      'opp.empty': 'No opportunities yet. Once related problems are submitted, they are grouped here automatically.',
      'opp.disclaimer': 'Opportunity scores are an internal analytical signal based on user feedback — not a guarantee of customers, revenue, or profitability.',
      'opp.back': '← All opportunities',
      'opp.badge': 'Potential Opportunity',
      'opp.identified': 'identified by IdeaPulse',
      'opp.score': 'Opportunity Score',
      'opp.signal': 'Demand signal',
      'opp.m.categories': 'Categories',
      'opp.m.locations': 'Locations',
      'opp.m.keywords': 'Keywords',
      'opp.m.trend': 'Trend',
      'opp.trend.empty': 'Not enough history yet.',
      'opp.problems': 'Main problems',
      'opp.solutions': 'Requested solutions',
      'opp.rep': 'Representative anonymous submissions',
      'opp.research': 'Research',
      'opp.research.hint': 'Analysis of user feedback — not a guarantee of success',
      'opp.research.body': 'Generate an internal research report summarizing the problem, customer need, possible business models, risks, and next validation steps.',
      'opp.research.btn': 'Generate Business Research Report',
      'opp.research.generating': 'Generating…',
      'opp.report.title': 'Business Research Report',
      'opp.report.dl': 'Download .md',

      // Analytics
      'an.title': 'Analytics',
      'an.categories': 'Problems by category',
      'an.time': 'Problems over time',
      'an.solutions': 'Most requested solutions',
      'an.keywords': 'Top recurring keywords',
      'an.clusters': 'Top opportunity clusters',
      'an.geo': 'Geographic distribution',
      'an.click': 'Click any bar to inspect the related anonymous submissions.',
      'an.clickbar': 'Click a bar to filter',
      'an.buckets': 'time bucket(s)',
      'an.empty.history': 'Not enough history yet.',

      // Score labels
      'score.low': 'Low signal',
      'score.moderate': 'Moderate signal',
      'score.strong': 'Strong signal',
      'score.verystrong': 'Very strong signal',

      // Toasts
      'toast.problem.short': 'Please describe your problem in a few words.',
      'toast.solution.short': 'Please tell us what would make it better.',
      'toast.consent': 'Please tick the consent checkbox to continue.',
      'toast.submitting': 'Submitting…',
      'toast.generic': 'Something went wrong.',
      'toast.report': 'Report generated.',
      'toast.analysis': 'Analysis complete.'
    },

    bn: {
      'meta.title.home': 'IdeaPulse — কী থাকলে ভালো হতো?',
      'meta.title.submit': 'কী আরও ভালো হতে পারত? — IdeaPulse',
      'meta.title.thanks': 'জানানোর জন্য ধন্যবাদ — IdeaPulse',
      'meta.title.login': 'অ্যাডমিন লগইন — IdeaPulse',
      'meta.title.admin': 'অ্যাডমিন ড্যাশবোর্ড — IdeaPulse',

      'nav.how': 'যেভাবে কাজ করে',
      'nav.examples': 'উদাহরণ',
      'nav.privacy': 'গোপনীয়তা',
      'nav.share': 'সমস্যা জানান',
      'nav.admin': 'অ্যাডমিন',

      'hero.eyebrow': 'মানুষের আসলে কী প্রয়োজন, তা আবিষ্কার করুন',
      'hero.title.a': 'কী থাকলে',
      'hero.title.b': 'ভালো হতো?',
      'hero.sub': 'আপনার দৈনন্দিন জীবনের কোনো সমস্যা এবং সেটার সমাধান কেমন হতে পারত, তা জানান। আপনার মতামত আরও ভালো পণ্য ও সেবা তৈরিতে সাহায্য করতে পারে।',
      'hero.cta.primary': 'সমস্যা জানান',
      'hero.cta.secondary': 'যেভাবে কাজ করে',
      'hero.privacy': 'আপনার উত্তর ব্যক্তিগত। অন্যরা আপনার জমা দেওয়া তথ্য দেখতে পাবে না।',
      'hero.chip.anon': '১০০% বেনামী',
      'hero.chip.need': 'বাস্তব প্রয়োজন → সম্ভাব্য সুযোগ',

      'how.eyebrow': 'যেভাবে কাজ করে',
      'how.title.a': 'সমস্যা থেকে',
      'how.title.b': 'সম্ভাবনায়',
      'how.sub': 'কোনো অ্যাকাউন্ট নেই। নাম নেই। শুধু কী সমস্যা আর কী দিয়ে তা ঠিক হবে, সেই সৎ মতামত।',
      'step.1.t': 'আপনার সমস্যা বলুন',
      'step.1.d': 'দৈনন্দিন জীবনে কী বিরক্তিকর, ভাঙা বা অনুপস্থিত? সোজা কথায় লিখে ফেলুন।',
      'step.2.t': 'কী সাহায্য করবে, তা বলুন',
      'step.2.d': 'কোন পণ্য, সেবা বা সমাধান থাকলে ভালো হতো, তা বর্ণনা করুন।',
      'step.3.t': 'আমরা প্যাটার্ন বিশ্লেষণ করি',
      'step.3.d': 'একই ধরনের সমস্যাগুলো একত্র করি এবং বারবার আসা বিষয় খুঁজি।',
      'step.4.t': 'প্রয়োজনই হয়ে ওঠে সুযোগ',
      'step.4.d': 'বাস্তব ও বারবার আসা প্রয়োজন সম্ভাব্য সুযোগ হিসেবে উঠে আসে।',

      'examples.eyebrow': 'উদাহরণ সমস্যা',
      'examples.title': 'মানুষ প্রায়ই কী চায়',
      'examples.sub': 'এগুলো ধারণা দেওয়ার জন্য উদাহরণ — আসল জমা নয়।',
      'ex.food': 'সত্যিকারের অর্গানিক খাবার খুঁজে পাওয়া কঠিন।',
      'ex.edu': 'বাস্তব দক্ষতা শেখায় এমন সাশ্রয়ী কোর্স দরকার।',
      'ex.shop': 'অনলাইনে নির্ভরযোগ্য স্থানীয় পণ্য সহজে খুঁজে পাই না।',
      'ex.biz': 'ছোট ব্যবসার দরকার সহজ টুল — দামি সাবস্ক্রিপশন ছাড়া।',

      'privacy.eyebrow': 'সবার আগে গোপনীয়তা',
      'privacy.title.a': 'আপনার জমা সম্পূর্ণ',
      'privacy.title.b': 'ব্যক্তিগত।',
      'privacy.body.1': 'অন্য ইউজাররা আপনার উত্তর ব্রাউজ বা খুঁজতে পারবে না। আমরা আপনার নাম, ফোন, ইমেইল বা সঠিক ঠিকানা নিই না — এবং আইপি অ্যাড্রেসও সংরক্ষণ করি না।',
      'privacy.body.2': 'আপনার দেওয়া তথ্য শুধু বেনামে, সামগ্রিকভাবে বিশ্লেষণ করা হয় — প্যাটার্ন ও সম্ভাব্য সুযোগ খুঁজতে।',
      'privacy.card.1.t': 'কোনো নাম বা ইমেইল নয়',
      'privacy.card.1.d': 'আপনি কে, তা আমরা কখনো জিজ্ঞেস করি না।',
      'privacy.card.2.t': 'পাবলিক ব্রাউজিং নেই',
      'privacy.card.2.d': 'অন্য কারো উত্তর কেউ ব্রাউজ বা খুঁজতে পারবে না।',
      'privacy.card.3.t': 'শুধু সামগ্রিক বিশ্লেষণ',
      'privacy.card.3.d': 'মতামত বেনামে বিশ্লেষণ করা হয় গবেষণা ও সুযোগ আবিষ্কারের জন্য।',
      'privacy.cta': 'সমস্যা জানান',

      'cta.title': 'বলুন কী থাকা উচিত।',
      'cta.sub': 'এক মিনিটেরও কম লাগে। কোনো অ্যাকাউন্ট লাগে না।',
      'cta.btn': 'সমস্যা জানান',

      'footer.tagline': 'মানুষের আসলে কী প্রয়োজন, তা আবিষ্কার করুন।',

      'submit.eyebrow': 'বেনামী · এক মিনিটের কম',
      'submit.title.a': 'কী আরও',
      'submit.title.b': 'ভালো হতে পারত?',
      'submit.sub': 'মাত্র দুটি প্রশ্ন। ব্যস। কোনো অ্যাকাউন্ট, নাম বা ইমেইল নেই।',
      'submit.q1': 'আপনি কোন সমস্যার মুখোমুখি হন?',
      'submit.q1.ph': 'উদাহরণ: আমার এলাকায় নির্ভরযোগ্য অর্গানিক খাবার পাই না।',
      'submit.q1.hint': 'নিজের ভাষায় লিখুন — ছোট বা বড় যেকোনো সমস্যা।',
      'submit.q2': 'কী থাকলে এটি আপনার জন্য আরও ভালো হতো?',
      'submit.q2.ph': 'উদাহরণ: একটি বিশ্বস্ত সার্ভিস যা সত্যিকারের অর্গানিক খাবার সাশ্রয়ী দামে পৌঁছে দেয়।',
      'submit.q2.hint': 'যে পণ্য, সেবা বা ধারণা থাকলে ভালো হতো।',
      'submit.category': 'ক্যাটাগরি',
      'submit.optional': '(ঐচ্ছিক)',
      'submit.autodetect': 'স্বয়ংক্রিয়ভাবে চিহ্নিত',
      'submit.location': 'বিস্তৃত এলাকা',
      'submit.location.ph': 'যেমন: ঢাকা / শুধু শহর বা এলাকা',
      'submit.location.hint': 'শুধু শহর বা এলাকা — কখনো সঠিক ঠিকানা নয়।',
      'submit.consent': 'আমি বুঝতে পেরেছি যে আমার উত্তরটি গবেষণা ও ব্যবসায়িক সুযোগ আবিষ্কারের জন্য বেনামে বিশ্লেষণ করা হতে পারে।',
      'submit.btn': 'বেনামে জমা দিন',
      'submit.privacy': 'আপনার উত্তর ব্যক্তিগত। অন্যরা আপনার জমা দেওয়া তথ্য দেখতে পাবে না।',

      'cat.food': 'খাবার',
      'cat.shopping': 'কেনাকাটা',
      'cat.education': 'শিক্ষা',
      'cat.business': 'ব্যবসা',
      'cat.technology': 'প্রযুক্তি',
      'cat.transportation': 'পরিবহন',
      'cat.healthcare': 'স্বাস্থ্যসেবা',
      'cat.entertainment': 'বিনোদন',
      'cat.home': 'বাড়ি',
      'cat.finance': 'আর্থিক',
      'cat.other': 'অন্যান্য',

      'thanks.title.a': 'জানানোর জন্য',
      'thanks.title.b': 'ধন্যবাদ।',
      'thanks.body': 'আপনার উত্তর নিরাপদে সংরক্ষিত হয়েছে এবং মানুষদের আসলে কী প্রয়োজন তা বুঝতে সাহায্য করতে পারে।',
      'thanks.again': 'আরেকটি সমস্যা জানান',
      'thanks.home': 'হোমে ফিরে যান',

      'login.title': 'অ্যাডমিন লগইন',
      'login.sub': 'ব্যক্তিগত এলাকা — শুধুমাত্র অনুমোদিত অ্যাডমিনদের জন্য।',
      'login.email': 'অ্যাডমিন ইমেইল / ইউজারনেম',
      'login.password': 'পাসওয়ার্ড',
      'login.btn': 'সাইন ইন',
      'login.signing': 'সাইন ইন হচ্ছে…',
      'login.fail': 'সাইন ইন ব্যর্থ হয়েছে।',
      'login.back': '← সাইটে ফিরুন',
      'admin.viewsite': 'সাইট দেখুন',
      'admin.logout': 'লগ আউট',

      'nav.overview': 'ওভারভিউ',
      'nav.submissions': 'জমা তালিকা',
      'nav.opportunities': 'সুযোগসমূহ',
      'nav.analytics': 'বিশ্লেষণ',

      'ov.total': 'মোট জমা',
      'ov.today': 'আজ',
      'ov.week': 'এই সপ্তাহে',
      'ov.month': 'এই মাসে',
      'ov.problems': 'সবচেয়ে বেশি উল্লেখিত সমস্যা',
      'ov.categories': 'শীর্ষ ক্যাটাগরি',
      'ov.trending': 'ট্রেন্ডিং সুযোগ',
      'ov.trending.hint': 'গত ৩০ দিনে সবচেয়ে বেশি কার্যকলাপ',
      'ov.related': 'টি সম্পর্কিত জমা',
      'ov.related.pl': 'টি সম্পর্কিত জমা',
      'ov.empty.subs': 'এখনো কোনো জমা নেই।',
      'ov.empty.data': 'এখনো কোনো ডেটা নেই।',
      'ov.empty.opp': 'এখনো কোনো সুযোগ নেই। সম্পর্কিত সমস্যা জমা হলেই এগুলো স্বয়ংক্রিয়ভাবে দেখা যাবে।',

      'common.loading': 'লোড হচ্ছে…',
      'common.error': 'কিছু একটা সমস্যা হয়েছে',

      'sub.export.csv': 'CSV এক্সপোর্ট',
      'sub.export.excel': 'Excel এক্সপোর্ট',
      'sub.search.ph': 'খুঁজুন: অর্গানিক, খাবার, ডেলিভারি…',
      'sub.allcats': 'সব ক্যাটাগরি',
      'sub.allloc': 'সব এলাকা',
      'sub.sort.newest': 'নতুন আগে',
      'sub.sort.oldest': 'পুরনো আগে',
      'sub.sort.category': 'ক্যাটাগরি অনুযায়ী',
      'sub.sort.location': 'এলাকা অনুযায়ী',
      'sub.th.id': 'আইডি',
      'sub.th.date': 'তারিখ / সময়',
      'sub.th.category': 'ক্যাটাগরি',
      'sub.th.problem': 'সমস্যা',
      'sub.th.solution': 'কাঙ্ক্ষিত সমাধান',
      'sub.th.location': 'এলাকা',
      'sub.prev': '← আগে',
      'sub.next': 'পরের →',
      'sub.page': 'পৃষ্ঠা',
      'sub.page.of': '/',
      'sub.empty': 'আপনার ফিল্টারে কোনো জমা মেলেনি।',

      'opp.title': 'সম্ভাব্য সুযোগ',
      'opp.reanalyze': '⟳ পুনরায় বিশ্লেষণ',
      'opp.analyzing': 'বিশ্লেষণ চলছে…',
      'opp.empty': 'এখনো কোনো সুযোগ নেই। সম্পর্কিত সমস্যা জমা হলেই এখানে স্বয়ংক্রিয়ভাবে গুছিয়ে দেখানো হবে।',
      'opp.disclaimer': 'সুযোগ স্কোর ইউজার ফিডব্যাকের ভিত্তিতে একটি অভ্যন্তরীণ বিশ্লেষণী সংকেত — গ্রাহক, আয় বা লাভের নিশ্চয়তা নয়।',
      'opp.back': '← সব সুযোগ',
      'opp.badge': 'সম্ভাব্য সুযোগ',
      'opp.identified': 'IdeaPulse চিহ্নিত করেছে',
      'opp.score': 'সুযোগ স্কোর',
      'opp.signal': 'চাহিদার সংকেত',
      'opp.m.categories': 'ক্যাটাগরি',
      'opp.m.locations': 'এলাকা',
      'opp.m.keywords': 'কীওয়ার্ড',
      'opp.m.trend': 'ধারা',
      'opp.trend.empty': 'এখনো যথেষ্ট ইতিহাস নেই।',
      'opp.problems': 'মূল সমস্যা',
      'opp.solutions': 'কাঙ্ক্ষিত সমাধান',
      'opp.rep': 'প্রতিনিধিত্বমূলক বেনামি জমা',
      'opp.research': 'গবেষণা',
      'opp.research.hint': 'ইউজার ফিডব্যাকের বিশ্লেষণ — সাফল্যের নিশ্চয়তা নয়',
      'opp.research.body': 'সমস্যা, গ্রাহকের প্রয়োজন, সম্ভাব্য ব্যবসায়িক মডেল, ঝুঁকি ও পরবর্তী যাচাইয়ের ধাপ সংক্ষেপে একটি অভ্যন্তরীণ গবেষণা প্রতিবেদন তৈরি করুন।',
      'opp.research.btn': 'ব্যবসায়িক গবেষণা প্রতিবেদন তৈরি করুন',
      'opp.research.generating': 'তৈরি হচ্ছে…',
      'opp.report.title': 'ব্যবসায়িক গবেষণা প্রতিবেদন',
      'opp.report.dl': '.md ডাউনলোড',

      'an.title': 'বিশ্লেষণ',
      'an.categories': 'ক্যাটাগরি অনুযায়ী সমস্যা',
      'an.time': 'সময়ের সাথে সমস্যা',
      'an.solutions': 'সবচেয়ে বেশি চাওয়া সমাধান',
      'an.keywords': 'শীর্ষ পুনরাবৃত্ত কীওয়ার্ড',
      'an.clusters': 'শীর্ষ সুযোগ ক্লাস্টার',
      'an.geo': 'ভৌগোলিক বণ্টন',
      'an.click': 'সম্পর্কিত বেনামি জমা দেখতে যেকোনো বার-এ ক্লিক করুন।',
      'an.clickbar': 'ফিল্টার করতে একটি বার-এ ক্লিক করুন',
      'an.buckets': 'টি সময় বিভাগ',
      'an.empty.history': 'এখনো যথেষ্ট ইতিহাস নেই।',

      'score.low': 'কম সংকেত',
      'score.moderate': 'মাঝারি সংকেত',
      'score.strong': 'শক্তিশালী সংকেত',
      'score.verystrong': 'খুব শক্তিশালী সংকেত',

      'toast.problem.short': 'অনুগ্রহ করে আপনার সমস্যাটি কয়েকটি শব্দে লিখুন।',
      'toast.solution.short': 'কী থাকলে ভালো হতো, তা লিখুন।',
      'toast.consent': 'চালিয়ে যেতে অনুগ্রহ করে সম্মতির ঘরটি টিক দিন।',
      'toast.submitting': 'জমা হচ্ছে…',
      'toast.generic': 'কিছু একটা সমস্যা হয়েছে।',
      'toast.report': 'প্রতিবেদন তৈরি হয়েছে।',
      'toast.analysis': 'বিশ্লেষণ সম্পন্ন হয়েছে।'
    }
  };

  var STORAGE_KEY = 'ideapulse_lang';
  var current = 'en';

  function detect() {
    try {
      var stored = localStorage.getItem(STORAGE_KEY);
      if (stored === 'bn' || stored === 'en') return stored;
    } catch (e) { /* private mode */ }
    if (typeof navigator !== 'undefined' && /^bn/i.test(navigator.language || '')) return 'bn';
    return 'en';
  }

  function t(key) {
    var dict = DICT[current] || DICT.en;
    return dict[key] != null ? dict[key] : (DICT.en[key] != null ? DICT.en[key] : key);
  }

  function applyStatic() {
    document.documentElement.lang = current === 'bn' ? 'bn' : 'en';
    document.querySelectorAll('[data-i18n]').forEach(function (el) {
      el.textContent = t(el.getAttribute('data-i18n'));
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach(function (el) {
      el.setAttribute('placeholder', t(el.getAttribute('data-i18n-placeholder')));
    });
    document.querySelectorAll('[data-i18n-aria]').forEach(function (el) {
      el.setAttribute('aria-label', t(el.getAttribute('data-i18n-aria')));
    });
    // Update language toggle buttons (show the OTHER language).
    document.querySelectorAll('[data-lang-toggle]').forEach(function (btn) {
      btn.textContent = current === 'bn' ? 'English' : 'বাংলা';
    });
  }

  function setLang(lang) {
    if (lang !== 'bn' && lang !== 'en') lang = 'en';
    current = lang;
    try { localStorage.setItem(STORAGE_KEY, lang); } catch (e) { /* ignore */ }
    applyStatic();
    if (typeof window.__onLangChange === 'function') window.__onLangChange(lang);
  }

  function toggle() {
    setLang(current === 'bn' ? 'en' : 'bn');
  }

  function bind() {
    document.querySelectorAll('[data-lang-toggle]').forEach(function (btn) {
      btn.addEventListener('click', toggle);
    });
  }

  // Initialize
  current = detect();
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { bind(); applyStatic(); });
  } else {
    bind();
    applyStatic();
  }

  window.IP = {
    get lang() { return current; },
    t: t,
    setLang: setLang,
    toggle: toggle,
    applyStatic: applyStatic
  };
})();
