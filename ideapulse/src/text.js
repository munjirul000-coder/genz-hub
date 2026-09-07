'use strict';

// Lightweight text analysis used to categorize submissions and group similar
// ones WITHOUT any external AI API. This is the deterministic fallback that
// always works. If an AI provider is later configured, its output can enrich
// the same categories/clusters via the same JSON shapes.

const CATEGORIES = [
  'food',
  'shopping',
  'education',
  'business',
  'technology',
  'transportation',
  'healthcare',
  'entertainment',
  'home',
  'finance',
  'other',
];

// Keyword → category hints (lowercase). Order matters: first category with the
// most matched hints wins ties on raw score.
const CATEGORY_HINTS = {
  food: [
    'food', 'organic', 'grocery', 'restaurant', 'meal', 'cook', 'cooking', 'eat',
    'eating', 'diet', 'recipe', 'vegetable', 'fruit', 'delivery food', 'snack',
    'farm', 'fresh produce', 'ingredient', 'nutrition', 'hungry',
  ],
  shopping: [
    'shop', 'shopping', 'buy', 'buying', 'store', 'product', 'products', 'order',
    'purchase', 'return', 'refund', 'local products', 'price', 'cheap', 'sale',
    'online shopping', 'ecommerce', 'marketplace', 'cart', 'checkout', 'brand',
  ],
  education: [
    'education', 'learn', 'learning', 'course', 'courses', 'study', 'student',
    'school', 'college', 'university', 'skill', 'skills', 'teach', 'teaching',
    'training', 'tutorial', 'degree', 'exam', 'homework', 'class',
  ],
  business: [
    'business', 'startup', 'entrepreneur', 'freelance', 'freelancer', 'invoice',
    'client', 'clients', 'marketing', 'sales', 'subscription', 'tool', 'tools',
    'small business', 'office', 'workflow', 'productivity', 'payroll', 'hiring',
  ],
  technology: [
    'app', 'apps', 'software', 'website', 'tech', 'phone', 'laptop', 'computer',
    'internet', 'wifi', 'battery', 'data', 'sync', 'automation', 'device',
    'gadget', 'ai', 'bug', 'login', 'password', 'cloud', 'backup',
  ],
  transportation: [
    'transport', 'transportation', 'bus', 'train', 'metro', 'traffic', 'commute',
    'parking', 'ride', 'taxi', 'uber', 'bike', 'bicycle', 'travel', 'flight',
    'road', 'drive', 'driving', 'public transport', 'route',
  ],
  healthcare: [
    'health', 'doctor', 'medical', 'medicine', 'hospital', 'clinic', 'mental',
    'therapy', 'fitness', 'gym', 'exercise', 'sleep', 'anxiety', 'stress',
    'pharmacy', 'appointment', 'wellness', 'dental', 'pain',
  ],
  entertainment: [
    'entertainment', 'movie', 'movies', 'music', 'game', 'games', 'gaming',
    'video', 'stream', 'streaming', 'concert', 'show', 'book', 'books', 'fun',
    'hobby', 'bored', 'content', 'podcast', 'series',
  ],
  home: [
    'home', 'house', 'apartment', 'rent', 'cleaning', 'clean', 'furniture',
    'garden', 'repair', 'kitchen', 'laundry', 'electricity', 'utility', 'bills',
    'maintenance', 'roommate', 'interior',
  ],
  finance: [
    'finance', 'financial', 'money', 'budget', 'budgeting', 'save', 'saving',
    'savings', 'invest', 'investing', 'bank', 'banking', 'loan', 'credit',
    'debt', 'tax', 'taxes', 'expense', 'expenses', 'crypto', 'insurance', 'payment',
  ],
};

// Keywords that add weight when scoring a submission for an opportunity.
const STRONG_WORDS = [
  'need', 'wish', 'want', 'hard', 'difficult', 'frustrating', 'annoying', 'hate',
  'impossible', 'always', 'never', 'expensive', 'waste', 'struggle', 'problem',
  'reliable', 'trust', 'trusted', 'genuinely', 'can\'t', 'cannot', 'no way',
  'no one', 'nobody', 'too much', 'takes forever', 'unable',
];

const STOP_WORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'if', 'then', 'of', 'to', 'in', 'on',
  'at', 'for', 'with', 'about', 'as', 'by', 'is', 'are', 'was', 'were', 'be',
  'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
  'can', 'could', 'should', 'may', 'might', 'must', 'i', 'me', 'my', 'we', 'our',
  'you', 'your', 'it', 'its', 'this', 'that', 'these', 'those', 'they', 'them',
  'their', 'what', 'which', 'who', 'whom', 'how', 'when', 'where', 'why', 'not',
  'no', 'yes', 'so', 'very', 'too', 'just', 'also', 'really', 'get', 'got',
  'make', 'made', 'like', 'want', 'need', 'there', 'here', 'from', 'into', 'up',
  'down', 'out', 'over', 'under', 'again', 'more', 'most', 'some', 'any', 'all',
  'each', 'every', 'than', 'because', 'while', 'im', 'ive', 'id', 'thing',
  'things', 'something', 'someone', 'way', 'people', 'find', 'hard', 'easier',
  'easy', 'better', 'good', 'help',
  // contractions
  "it's", "its", "don't", "dont", "can't", "cant", "won't", "wont", "isn't",
  "isnt", "i'm", "im", "i've", "ive", "i'd", "id", "you're", "youre",
  "they're", "theyre", "we're", "were", "there's", "theres", "what's",
  "whats", "that's", "thats", "i'll", "ill", "i cant", "cant",
]);

// Light stemmer — only safe pluralization, so "stores"→"store", "courses"→
// "course", "companies"→"company", "businesses"→"business", but singulars like
// "business"/"process" stay intact.
function stem(word) {
  if (word.endsWith('ies') && word.length > 4) return word.slice(0, -3) + 'y';
  if (word.endsWith('sses') && word.length > 4) return word.slice(0, -2);
  if (word.endsWith('s') && !word.endsWith('ss') && !word.endsWith('us') && word.length > 3) {
    return word.slice(0, -1);
  }
  return word;
}

function normalize(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/[^\p{L}\p{N}' -]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenize(text) {
  return normalize(text)
    .split(' ')
    .filter((t) => t.length > 1 && !STOP_WORDS.has(t))
    .map(stem)
    .filter((t) => t.length > 1 && !STOP_WORDS.has(t));
}

function bigrams(tokens) {
  const out = [];
  for (let i = 0; i < tokens.length - 1; i++) {
    out.push(tokens[i] + ' ' + tokens[i + 1]);
  }
  return out;
}

// Count word frequencies (with bigram support for phrases like "organic food").
function wordCounts(tokens) {
  const words = {};
  for (const t of tokens) if (t) words[t] = (words[t] || 0) + 1;
  for (const b of bigrams(tokens)) if (b) words[b] = (words[b] || 0) + 1;
  return words;
}

function countHits(tokens, hints) {
  let hits = 0;
  const joined = ' ' + tokens.join(' ') + ' ';
  for (const hint of hints) {
    if (hint.includes(' ')) {
      if (joined.includes(' ' + hint + ' ')) hits += 2;
    } else if (tokens.includes(hint)) {
      hits += 1;
    }
  }
  return hits;
}

// Choose a category from free text (used when the user skips the dropdown).
function categorize(text) {
  const tokens = tokenize(text);
  let best = 'other';
  let bestScore = 0;
  for (const [cat, hints] of Object.entries(CATEGORY_HINTS)) {
    const score = countHits(tokens, hints);
    if (score > bestScore) {
      best = cat;
      bestScore = score;
    }
  }
  return bestScore > 0 ? best : 'other';
}

// Extract a compact keyword profile for a submission (JSON-serializable).
// Bigrams are kept only when both words are substantive (not stop/qualifier
// words), which keeps meaningful phrases ("organic food") and drops noise
// ("can't easily"). Cap at the top terms to keep vectors dense and comparable.
function extractKeywords(text) {
  const tokens = tokenize(text);
  const counts = wordCounts(tokens);
  const entries = Object.entries(counts)
    .filter(([w]) => {
      if (STOP_WORDS.has(w)) return false;
      if (w.includes(' ')) {
        return w.split(' ').every((part) => !STOP_WORDS.has(part) && !QUALIFIER_STOP.has(part));
      }
      return true;
    })
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 16);
  const words = {};
  for (const [w, c] of entries) words[w] = c;
  return words;
}

function strongWordCount(text) {
  const tokens = tokenize(text);
  return tokens.filter((t) => STRONG_WORDS.includes(t)).length;
}

// Parse a keywords JSON blob into a plain object.
function parseKeywords(json) {
  try {
    return typeof json === 'string' ? JSON.parse(json) : json || {};
  } catch {
    return {};
  }
}

// Words that carry little grouping information on their own (qualifiers,
// generic verbs). They are excluded from cluster vocabulary but may be used to
// label opportunities ("Trusted", "Affordable", …).
const QUALIFIER_STOP = new Set([
  'verified', 'reliable', 'trusted', 'trustworthy', 'trust', 'genuine',
  'genuinely', 'actually', 'affordable', 'cheap', 'cheaper', 'expensive',
  'simple', 'simpler', 'easiest', 'easier', 'easy', 'convenient', 'good',
  'better', 'best', 'great', 'hard', 'difficult', 'real', 'really', 'fast',
  'faster', 'quick', 'smart', 'smarter', 'find', 'found', 'finding', 'want',
  'wish', 'need', 'needs', 'make', 'made', 'get', 'got', 'like', 'love',
  'hate', 'cannot', 'cant', 'dont', 'no', 'one', 'near', 'easily', 'work',
  'works', 'time', 'times', 'every', 'many', 'much', 'way', 'ways', 'thing',
  'things', 'people', 'someone', 'something', 'using', 'use', 'live',
  'available', 'always', 'never', 'struggle', 'struggling', 'waste',
  'takes', 'take', 'feel', 'feels', 'keep', 'keeps', 'know', 'knows',
  'there', 'here', 'very', 'too', 'just', 'also', 'really', 'would',
  'could', 'should', 'will', 'wont', 'isnt', 'im', 'ive', 'id',
  // Generic nouns/verbs that create spurious cross-topic links.
  'app', 'apps', 'show', 'shows', 'book', 'books', 'work', 'worker',
  'workers', 'across', 'after', 'am', 'lets', 'let', 'single', 'system',
  'help', 'helps', 'able', 'manage', 'management', 'anything', 'nothing',
  'everywhere', 'anywhere', 'somewhere',
  'learn', 'learning', 'getting', 'paying', 'spending', 'sold', 'only',
  'charge', 'charges', 'session', 'phone', 'pay', 'use', 'using', 'sale',
  'sales', 'support', 'supports', 'daily', 'weekly', 'monthly', 'everyday',
]);

module.exports = {
  CATEGORIES,
  QUALIFIER_STOP,
  normalize,
  tokenize,
  wordCounts,
  categorize,
  extractKeywords,
  strongWordCount,
  parseKeywords,
};
