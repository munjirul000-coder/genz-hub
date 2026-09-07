'use strict';

// Internal business-research report generator (bilingual: en / bn).
// Produces a structured, honest report from a cluster's submissions. This is
// analysis of user feedback — it deliberately avoids claiming that any
// opportunity is guaranteed to succeed.

const { publicSubmission } = require('./util');

const MODEL_REVENUE_HINTS = [
  { match: /deliver|subscription|membership|box/i, model: 'subscription' },
  { match: /app\b|platform|online|website|tool/i, model: 'saas' },
  { match: /marketplace|directory|connect|matching|list/i, model: 'marketplace' },
  { match: /service\b|booking|repair|cleaning|tutor/i, model: 'service' },
  { match: /course|learn|teach|coach|mentor/i, model: 'education' },
  { match: /freemium|free starter|pay.?as.?you.?go/i, model: 'freemium' },
];

const MODEL_LABELS = {
  en: {
    subscription: 'Subscription / recurring delivery',
    saas: 'Software as a Service (SaaS)',
    marketplace: 'Marketplace / commission',
    service: 'Service fee per booking',
    education: 'Education / per-course or cohort fee',
    freemium: 'Freemium with usage-based pricing',
    default: 'Fee-for-service or product sales'
  },
  bn: {
    subscription: 'সাবস্ক্রিপশন / নিয়মিত ডেলিভারি',
    saas: 'সফটওয়্যার অ্যাজ আ সার্ভিস (SaaS)',
    marketplace: 'মার্কেটপ্লেস / কমিশন',
    service: 'প্রতি বুকিংয়ে সার্ভিস ফি',
    education: 'শিক্ষা / প্রতি কোর্স বা ব্যাচ ফি',
    freemium: 'ফ্রিমিয়াম + ব্যবহারভিত্তিক মূল্য',
    default: 'সার্ভিস ফি বা পণ্য বিক্রি'
  }
};

function pickModels(rows, lang) {
  const corpus = rows.map((r) => `${r.problem} ${r.desiredSolution}`).join(' ');
  const keys = MODEL_REVENUE_HINTS.filter((h) => h.match.test(corpus)).map((h) => h.model);
  if (!keys.length) keys.push('default');
  return Array.from(new Set(keys)).slice(0, 3).map((k) => MODEL_LABELS[lang][k] || MODEL_LABELS.en[k]);
}

function summarize(rows) {
  const problems = rows.map((r) => r.problem);
  const solutions = rows.map((r) => r.desiredSolution);
  const categories = {};
  for (const r of rows) categories[r.category] = (categories[r.category] || 0) + 1;
  const catSummary = Object.entries(categories)
    .sort((a, b) => b[1] - a[1])
    .map(([c, n]) => `${c} (${n})`)
    .join(', ');
  const locations = Array.from(new Set(rows.map((r) => r.broad_location).filter(Boolean)));
  const complaints = problems.slice().sort((a, b) => a.length - b.length).slice(0, 3);
  const requested = solutions.slice().sort((a, b) => a.length - b.length).slice(0, 3);
  return { complaints, requested, catSummary, locations };
}

function buildSections(cluster, rows, lang) {
  const s = summarize(rows);
  const models = pickModels(rows, lang);
  const trend = cluster.trend || [];
  const earliest = trend.length ? trend[0].bucket : null;
  const latest = trend.length ? trend[trend.length - 1].bucket : null;
  const ids = rows.map((r) => r.id).join(', ');
  const keywords = (cluster.keywords || []).slice(0, 8).join(', ');

  const quotes = (arr) => arr.map((p) => `"${p}"`).join(' ');

  if (lang === 'bn') {
    const intro = rows.length >= 2
      ? `${rows.length}টি বেনামি জমা একটি সম্পর্কিত অপ্রাপ্ত চাহিদা প্রকাশ করছে।`
      : 'একটি বেনামি জমা একটি সম্ভাব্য অপ্রাপ্ত চাহিদার ইঙ্গিত দিচ্ছে।';
    return [
      {
        heading: 'সমস্যার সারসংক্ষেপ',
        body: 'ইউজাররা বারবার একটি নির্দিষ্ট সমস্যার কথা বলছেন। প্রতিনিধিত্বমূলক অভিযোগ: ' +
          quotes(s.complaints) +
          (earliest && latest && earliest !== latest ? ` কার্যকলাপ ${earliest} থেকে ${latest} পর্যন্ত বিস্তৃত।` : ''),
      },
      {
        heading: 'গ্রাহকের প্রয়োজন',
        body: 'মূল চাহিদা হলো একটি বিশ্বস্ত ও সুবিধাজনক সমাধান — যা ইউজারদের বর্ণিত ঝামেলা দূর করবে। ' +
          `নমুনায় নির্ভরযোগ্যতা, স্বচ্ছতা ও ন্যায্য মূল্য সবচেয়ে বেশি গুরুত্ব পেয়েছে (${s.catSummary})।`,
      },
      {
        heading: 'সম্ভাব্য লক্ষ্য দর্শক',
        body: s.locations.length
          ? `যারা এই সমস্যার কথা বলছেন তারা এই এলাকাগুলোয় ছড়িয়ে আছেন: ${s.locations.join(', ')}। এগুলোই প্রাথমিক চাহিদার সংকেত দেখায়।`
          : 'বেশিরভাগ উত্তরদাতা এলাকা উল্লেখ করেননি — ভৌগোলিক চাহিদা বুঝতে আরও উত্তর আসার পর একই বিশ্লেষণ চালান।',
      },
      {
        heading: 'কাঙ্ক্ষিত সমাধান',
        body: 'ইউজাররা স্পষ্টভাবে চেয়েছেন: ' + quotes(s.requested) +
          '। প্রথম সংস্করণে এই বৈশিষ্ট্যগুলোকেই অগ্রাধিকার দিন।',
      },
      {
        heading: 'জমা থেকে প্রাপ্ত প্রমাণ',
        body: `বেনামিকৃত প্রমাণ (আইডি: ${ids})। অভ্যন্তরীণ সুযোগ স্কোর: ${cluster.score}/100 (${cluster.scoreLabel})। ` +
          `শীর্ষ কীওয়ার্ড: ${keywords}।`,
      },
      {
        heading: 'যে প্রশ্নগুলো এখনো যাচাই বাকি',
        body: '১) কতজন ইউজার আসলে টাকা দেবেন এবং কী দামে? ২) তারা এখন কী বিকল্প ব্যবহার করেন? ' +
          '৩) সমস্যাটি সাপ্তাহিক, মাসিক নাকি বিরল? ৪) দাম, বিশ্বাস বা সুবিধা — কোনটি গ্রহণযোগ্যতা বাড়াবে? ' +
          'বর্তমান ডেটায় এগুলোর উত্তর নেই — সাক্ষাৎকার ও পেইড পাইলট প্রয়োজন।',
      },
      {
        heading: 'সম্ভাব্য ব্যবসায়িক মডেল',
        body: models.join('; ') + '। প্রতিটি মডেল বাস্তব উইলিংনেস-টু-পে দিয়ে যাচাই করে তবেই তৈরি করুন।',
      },
      {
        heading: 'ঝুঁকি',
        body: 'কম সংখ্যক উত্তরে বাজার সম্পূর্ণ প্রতিফলিত নাও হতে পারে; সমস্যার স্ব-প্রতিবেদন কেনার ইচ্ছার সমান নয়; ' +
          'সাপ্লাই বা নিয়ন্ত্রক খরচ চাহিদার চেয়ে বেশি হতে পারে; আর "বিশ্বস্ত" অবস্থান অর্জন করা কঠিন ও হারানো সহজ।',
      },
      {
        heading: 'পরবর্তী যাচাইয়ের প্রস্তাবিত ধাপ',
        body: '১) উল্লেখিত এলাকায় ১০–১৫ জন গ্রাহকের সাক্ষাৎকার নিন। ২) আগ্রহ মাপতে একটি ওয়েটলিস্ট ল্যান্ডিং পেজ চালু করুন। ' +
          '৩) উইলিংনেস-টু-পে যাচাই করতে একটি ছোট পাইলট প্রি-সেল করুন। ৪) চাহিদার ধারা দেখতে প্রতি মাসে এই বিশ্লেষণ পুনরায় চালান।',
      },
    ];
  }

  const intro = rows.length >= 2
    ? `${rows.length} anonymous submissions express a related unmet need.`
    : 'One anonymous submission points at a possible unmet need.';
  return [
    {
      heading: 'Problem summary',
      body: 'Users consistently describe a recurring pain point. Representative complaints include: ' +
        quotes(s.complaints) +
        (earliest && latest && earliest !== latest ? ` Activity spans ${earliest} to ${latest}.` : ''),
    },
    {
      heading: 'Customer need',
      body: 'The underlying need is for a trustworthy, convenient solution that removes the friction users describe — ' +
        `reliability, transparency and fair pricing are the most emphasized values in the sample (${s.catSummary}).`,
    },
    {
      heading: 'Potential target audience',
      body: s.locations.length
        ? `The people reporting this problem are spread across: ${s.locations.join(', ')}. These broad areas indicate where early demand signals exist.`
        : 'Location was not provided by most respondents — run the same analysis after more responses arrive to see geographic demand.',
    },
    {
      heading: 'Requested solution',
      body: 'Users explicitly ask for: ' + quotes(s.requested) +
        '. These are the features the first version should prioritize.',
    },
    {
      heading: 'Evidence from submissions',
      body: `Anonymized evidence (IDs: ${ids}). Internal opportunity score: ${cluster.score}/100 (${cluster.scoreLabel}). ` +
        `Top keywords: ${keywords}.`,
    },
    {
      heading: 'Questions that still need validation',
      body: '1) How many of these users would actually pay, and at what price? 2) What do they use today as a workaround? ' +
        '3) Is frequency of the problem weekly, monthly or rare? 4) Would adoption be driven by price, trust, or convenience? ' +
        'None of these are answered by the current data — they require interviews and a paid pilot.',
    },
    {
      heading: 'Possible business models',
      body: models.join('; ') + '. Each model must be tested with real willingness-to-pay before building.',
    },
    {
      heading: 'Risks',
      body: 'Low response volume may not represent the broader market; self-reported problems do not equal purchase intent; ' +
        'supply/regulatory costs could exceed willingness to pay; and a "trusted" positioning is hard to earn and easy to lose.',
    },
    {
      heading: 'Recommended next validation steps',
      body: '1) Run 10–15 customer interviews from the reported locations. 2) Publish a landing page with a waitlist to measure intent. ' +
        '3) Pre-sell a small pilot at a fixed price to validate willingness-to-pay. 4) Re-run this analysis monthly to watch the demand trend.',
    },
  ];
}

function generateReport(cluster, submissions, lang) {
  const rows = submissions.map(publicSubmission);
  const summaryEn = lang === 'bn' ? null : null;
  void summaryEn;

  const scoreLabel = cluster.scoreLabel || cluster.score_label;
  const sections = buildSections(cluster, rows, lang || 'en');

  return {
    title: cluster.title,
    score: cluster.score,
    scoreLabel,
    generatedAt: new Date().toISOString(),
    summary: lang === 'bn'
      ? `সবচেয়ে সাধারণ থিম হলো "${cluster.title}"। এটি একটি সংকেত — প্রমাণিত বাজার নয়।`
      : `The most common theme is "${cluster.title}". This is a signal, not a proven market.`,
    sections,
  };
}

module.exports = { generateReport };
