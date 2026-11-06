'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { collect, safeLink } = require('../public/nova/js/voice-alerts');
const now = 1800000000000;
const example = () => ({ fetchedAt: now, news: { ok: true, items: [
  { source: 'BBC World', title: 'World war fears rise after a speech', url: 'https://www.bbc.com/news/123', time: now - 60000 },
  { source: 'The Guardian', title: 'World war: commentary', url: 'https://www.theguardian.com/world/123', time: now - 7200000 },
] }, bangladesh: { ok: true, items: [{ source: 'Jago News 24', title: 'যুদ্ধ শুরু নিয়ে সতর্কতা', url: 'https://www.jagonews24.com/national/news/123', time: now - 90000 }] }, quakes: { ok: true, items: [{ magnitude: 6.5, place: 'Test location', time: now - 120000, url: 'https://earthquake.usgs.gov/earthquakes/eventpage/123' }] } });
test('alerts contain only recent attributed coverage and strong USGS quakes', () => {
  const items = collect(example(), now); assert.equal(items.length, 4); assert.equal(items[0].source, 'BBC World');
  assert.equal(items.find(x => x.source === 'USGS').title, 'M6.5 · Test location');
  assert.equal(items.find(x => x.source === 'Jago News 24').type, 'report');
  assert.ok(items.every(x => x.url.startsWith('https://')));
});
test('untrusted URLs, non-events, stale and future data are rejected', () => {
  assert.equal(safeLink('https://www.bbc.com.evil.example/news', 'BBC World'), '');
  assert.equal(safeLink('https://user@www.bbc.com/news', 'BBC World'), '');
  assert.equal(safeLink('https://www.bbc.com:443/news', 'BBC World').startsWith('https://'), true); // URL canonicalizes default port
  const bad = example();
  bad.news.items = [
    { source: 'BBC World', title: 'World war', url: 'https://example.com/fake', time: now },
    { source: 'BBC World', title: 'Nuclear power station opens', url: 'https://www.bbc.com/news/2', time: now },
    { source: 'BBC World', title: 'World war', url: 'https://www.bbc.com/news/3', time: now - 5 * 3600000 },
    { source: 'BBC World', title: 'World war', url: 'https://www.bbc.com/news/4', time: now + 120000 },
  ];
  bad.bangladesh.ok = false; bad.quakes.items = [{ magnitude: 5.9, time: now, place: 'Small', url: 'https://earthquake.usgs.gov/earthquakes/2' }];
  assert.deepEqual(collect(bad, now), []);
  const stale = example(); stale.fetchedAt = now - 11 * 60000; assert.deepEqual(collect(stale, now), []);
  stale.fetchedAt = now + 120000; assert.deepEqual(collect(stale, now), []);
});
test('duplicate links are reported only once', () => {
  const data = example(); data.news.items.push(data.news.items[0]);
  assert.equal(collect(data, now).filter(x => x.source === 'BBC World').length, 1);
});
