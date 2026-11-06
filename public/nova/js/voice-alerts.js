'use strict';
// A headline is only a publisher's report, not an independently verified event
// or an official emergency warning. Never fetch URLs supplied by a feed.
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.NovaVoiceAlerts = api;
})(typeof window === 'object' ? window : null, function () {
  const hosts = {
    'BBC World': ['bbc.com', 'www.bbc.com', 'bbc.co.uk', 'www.bbc.co.uk'],
    'The Guardian': ['theguardian.com', 'www.theguardian.com'],
    'Jago News 24': ['jagonews24.com', 'www.jagonews24.com'],
    'USGS': ['earthquake.usgs.gov'],
  };
  const crisis = /\b(?:world war|nuclear (?:attack|strike|explosion|war)|(?:war|invasion) (?:begins|breaks out|declared)|declares? war)\b|বিশ্বযুদ্ধ|বিশ্ব যুদ্ধ|পারমাণবিক হামলা|পরমাণু হামলা|পারমাণবিক যুদ্ধ|যুদ্ধ শুরু|যুদ্ধ ঘোষণা/i;
  function safeLink(value, source) {
    try { const u = new URL(value); return u.protocol === 'https:' && !u.username && !u.password && !u.port && hosts[source]?.includes(u.hostname) ? u.href : ''; } catch { return ''; }
  }
  function collect(data, now = Date.now()) {
    if (!Number.isFinite(data?.fetchedAt) || data.fetchedAt > now + 60000 || data.fetchedAt < now - 10 * 60000) return [];
    const recent = time => Number.isFinite(time) && time <= now + 60000 && time >= now - 4 * 3600000;
    const output = [];
    for (const feed of [data.news, data.bangladesh]) {
      if (!feed?.ok || !Array.isArray(feed.items)) continue;
      for (const n of feed.items.slice(0, 30)) {
        if (typeof n.title !== 'string' || !crisis.test(n.title) || !recent(n.time)) continue;
        const url = safeLink(n.url, n.source); if (!url) continue;
        output.push({ key: 'news:' + url, source: n.source, title: n.title.slice(0, 240), url, time: n.time, type: 'report' });
      }
    }
    if (data.quakes?.ok && Array.isArray(data.quakes.items)) for (const q of data.quakes.items.slice(0, 40)) {
      const magnitude = Number(q.magnitude); const url = safeLink(q.url, 'USGS');
      if (!url || !recent(q.time) || !Number.isFinite(magnitude) || magnitude < 6 || magnitude > 10 || typeof q.place !== 'string') continue;
      output.push({ key: 'quake:' + url, source: 'USGS', title: `M${magnitude.toFixed(1)} · ${q.place.slice(0, 160)}`, url, time: q.time, type: 'earthquake' });
    }
    const seen = new Set(); return output.sort((a, b) => b.time - a.time).filter(item => !seen.has(item.key) && seen.add(item.key)).slice(0, 20);
  }
  return { collect, safeLink };
});
