'use strict';
// Public feeds are fixed URLs. No user-supplied URLs or client secrets are sent.
const QUAKES_URL = 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_day.geojson';
const NEWS_URL = 'https://feeds.bbci.co.uk/news/world/rss.xml';
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
function newsItems(xml) {
  if (!/<(?:rss|feed)\b/i.test(xml)) throw new Error('Invalid news feed');
  return [...xml.matchAll(/<item\b[^>]*>([\s\S]*?)<\/item>/gi)].slice(0, 20).map(match => {
    const item = match[1]; const get = tag => (item.match(new RegExp('<' + tag + '\\b[^>]*>([\\s\\S]*?)<\\/' + tag + '>', 'i')) || [])[1] || '';
    const title = cleanText(get('title'), 240), rawLink = cleanText(get('link'), 800);
    let url = ''; try { const u = new URL(rawLink); if (u.protocol === 'https:' && (u.hostname === 'bbc.com' || u.hostname.endsWith('.bbc.com') || u.hostname === 'bbc.co.uk' || u.hostname.endsWith('.bbc.co.uk'))) url = u.href; } catch {}
    const time = Date.parse(cleanText(get('pubDate'), 100));
    return title && url ? { title, url, time: Number.isFinite(time) ? time : null } : null;
  }).filter(Boolean).slice(0, 12);
}
async function loadFeed(url, parse) {
  try { const response = await fetch(url, { signal: AbortSignal.timeout(8000), redirect: 'error', headers: { 'User-Agent': 'NOVA-World-Monitor/1.0', Accept: 'application/json, application/rss+xml, application/xml, text/xml' } }); return { ok: true, items: parse(await textLimit(response)) }; }
  catch { return { ok: false, items: [], error: 'Feed unavailable. Check internet connection and try again.' }; }
}
async function getWorldData() {
  if (cache && Date.now() - cache.fetchedAt < (cache.quakes.ok && cache.news.ok ? 5 * 60000 : 30000)) return cache;
  if (pending) return pending;
  pending = (async () => {
    const [quakes, news] = await Promise.all([loadFeed(QUAKES_URL, x => quakeItems(JSON.parse(x))), loadFeed(NEWS_URL, newsItems)]);
    cache = { fetchedAt: Date.now(), quakes, news };
    return cache;
  })();
  try { return await pending; } finally { pending = null; }
}
module.exports = { getWorldData, quakeItems, newsItems, QUAKES_URL, NEWS_URL };
