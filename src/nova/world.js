'use strict';
// Public feeds are fixed URLs. No user-supplied URLs or client secrets are sent.
const QUAKES_URL = 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_day.geojson';
const NEWS_URL = 'https://feeds.bbci.co.uk/news/world/rss.xml';
const GUARDIAN_NEWS_URL = 'https://www.theguardian.com/world/rss';
const BANGLADESH_NEWS_URL = 'https://www.jagonews24.com/rss/rss.xml';
let cache = null;
let pending = null;
async function textLimit(response, limit = 2 * 1024 * 1024) {
  if (!response.ok) throw new Error(`Feed HTTP ${response.status}`);
  const reader = response.body.getReader(); let size = 0; const chunks = [];
  try { while (true) { const { value, done } = await reader.read(); if (done) break; size += value.length; if (size > limit) throw new Error('Feed too large'); chunks.push(value); } }
  finally { reader.releaseLock(); }
  return Buffer.concat(chunks.map(x => Buffer.from(x))).toString('utf8');
}
function cleanText(value, max = 300) { return String(value || '').replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').replace(/<[^>]*>/g, '').replace(/&#(x[\da-f]+|\d+);/gi, (_, n) => { const v = n[0].toLowerCase() === 'x' ? parseInt(n.slice(1), 16) : Number(n); return v > 0 && v <= 0x10ffff ? String.fromCodePoint(v) : ''; }).replace(/&(amp|lt|gt|quot|apos);/g, (_, n) => ({ amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" }[n])).replace(/\s+/g, ' ').trim().slice(0, max); }
function quakeItems(data) {
  if (!Array.isArray(data.features)) throw new Error('Invalid earthquake feed');
  return data.features.slice(0, 200).map(f => {
    if (!f || !Array.isArray(f.geometry?.coordinates)) return null;
    const [lon, lat] = f.geometry.coordinates; const p = f.properties || {};
    if (p.mag == null || p.time == null) return null;
    const magnitude = Number(p.mag), time = Number(p.time);
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180 || !Number.isFinite(magnitude) || !Number.isFinite(time) || time <= 0) return null;
    let url = ''; try { const u = new URL(p.url); if (u.protocol === 'https:' && u.hostname === 'earthquake.usgs.gov') url = u.href; } catch {}
    return { lat, lon, magnitude, time, place: cleanText(p.place, 160) || 'Unknown location', url };
  }).filter(Boolean).sort((a, b) => b.time - a.time).slice(0, 40);
}
// Only publisher-controlled URLs can be rendered or linked; never proxy a
// feed-supplied URL on the server or accept arbitrary third-party image hosts.
function newsUrl(value, hosts) {
  try {
    const u = new URL(cleanText(value, 1800));
    if (u.protocol !== 'https:' || u.username || u.password || u.port || !hosts.includes(u.hostname)) return '';
    return u.href;
  } catch { return ''; }
}
function newsItems(xml, publisher = 'BBC World') {
  if (!/<(?:rss|feed)\b/i.test(xml)) throw new Error('Invalid news feed');
  const hosts = publisher === 'Jago News 24' ? ['www.jagonews24.com', 'jagonews24.com'] : publisher === 'The Guardian' ? ['www.theguardian.com', 'theguardian.com'] : ['www.bbc.com', 'bbc.com', 'www.bbc.co.uk', 'bbc.co.uk'];
  const imageHosts = publisher === 'Jago News 24' ? [] : publisher === 'The Guardian' ? ['i.guim.co.uk'] : ['ichef.bbci.co.uk'];
  return [...xml.matchAll(/<item\b[^>]*>([\s\S]*?)<\/item>/gi)].slice(0, 30).map(match => {
    const item = match[1]; const get = tag => (item.match(new RegExp('<' + tag + '\\b[^>]*>([\\s\\S]*?)<\\/' + tag + '>', 'i')) || [])[1] || '';
    const title = cleanText(get('title'), 240), url = newsUrl(get('link'), hosts);
    const time = Date.parse(cleanText(get('pubDate'), 100));
    let image = '';
    for (const media of item.matchAll(/<media:(?:thumbnail|content)\b([^>]*?)\/?>/gi)) {
      const attrs = media[1]; if (/\b(?:type\s*=\s*["']video|medium\s*=\s*["']video)/i.test(attrs)) continue;
      const value = (attrs.match(/\burl\s*=\s*(["'])(.*?)\1/i) || [])[2];
      image = newsUrl(value, imageHosts); if (image) break;
    }
    if (publisher === 'Jago News 24' && url && !/^\/(?:national|country|politics|economy)\//i.test(new URL(url).pathname)) return null;
    return title && url ? { title, url, time: Number.isFinite(time) ? time : null, source: publisher, image } : null;
  }).filter(Boolean).slice(0, 12);
}
async function loadFeed(url, parse) {
  try { const response = await fetch(url, { signal: AbortSignal.timeout(8000), redirect: 'error', headers: { 'User-Agent': 'NOVA-World-Monitor/1.0', Accept: 'application/json, application/rss+xml, application/xml, text/xml' } }); return { ok: true, items: parse(await textLimit(response)) }; }
  catch { return { ok: false, items: [], error: 'Feed unavailable. Check internet connection and try again.' }; }
}
async function getWorldData({ force = false } = {}) {
  if (!force && cache && Date.now() - cache.fetchedAt < (cache.quakes.ok && cache.news.sources?.every(s => s.ok) ? 5 * 60000 : 30000)) return cache;
  if (pending) return pending;
  pending = (async () => {
    const [quakes, bbc, guardian, bangladeshFeed] = await Promise.all([
      loadFeed(QUAKES_URL, x => quakeItems(JSON.parse(x))),
      loadFeed(NEWS_URL, x => newsItems(x, 'BBC World')),
      loadFeed(GUARDIAN_NEWS_URL, x => newsItems(x, 'The Guardian')),
      loadFeed(BANGLADESH_NEWS_URL, x => newsItems(x, 'Jago News 24')),
    ]);
    const sources = [{ name: 'BBC World', ok: bbc.ok }, { name: 'The Guardian', ok: guardian.ok }];
    const items = [...bbc.items, ...guardian.items].sort((a, b) => (b.time || 0) - (a.time || 0));
    const news = { ok: bbc.ok || guardian.ok, items, sources, ...(!bbc.ok && !guardian.ok ? { error: 'News sources unavailable. Check your internet connection and press Refresh.' } : {}) };
    const bangladesh = { ...bangladeshFeed, source: 'Jago News 24' };
    // A healthy HTTP response is not proof a feed is current.
    if (bangladesh.ok) bangladesh.items = bangladesh.items.filter(n => n.time && n.time <= Date.now() + 3600000 && n.time >= Date.now() - 48 * 3600000);
    if (bangladesh.ok && !bangladesh.items.length) {
      bangladesh.ok = false; bangladesh.items = []; bangladesh.error = 'Bangladesh news feed is empty or not recent. Try Refresh later.';
    }
    cache = { fetchedAt: Date.now(), quakes, news, bangladesh };
    return cache;
  })();
  try { return await pending; } finally { pending = null; }
}
module.exports = { getWorldData, quakeItems, newsItems, newsUrl, QUAKES_URL, NEWS_URL, GUARDIAN_NEWS_URL, BANGLADESH_NEWS_URL };
