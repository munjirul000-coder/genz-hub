'use strict';
// Fixed public endpoints only. These are snapshots, not official warnings or
// a complete global aircraft/weather picture. Never accept a URL from a client.
const WEATHER_URL = 'https://api.open-meteo.com/v1/forecast';
const GDACS_URL = 'https://www.gdacs.org/gdacsapi/api/events/geteventlist/EVENTS4APP';
const STORMS_URL = 'https://www.nhc.noaa.gov/CurrentStorms.json';
const FLIGHT_URL = 'https://api.adsb.lol/v2/point';
const CITIES = [
  { name: 'Dhaka', lat: 23.81, lon: 90.41 }, { name: 'Chattogram', lat: 22.36, lon: 91.78 },
  { name: 'Kolkata', lat: 22.57, lon: 88.36 }, { name: 'Delhi', lat: 28.61, lon: 77.21 },
  { name: 'Dubai', lat: 25.20, lon: 55.27 }, { name: 'Singapore', lat: 1.35, lon: 103.82 },
  { name: 'Tokyo', lat: 35.68, lon: 139.69 }, { name: 'London', lat: 51.51, lon: -0.13 },
  { name: 'New York', lat: 40.71, lon: -74.01 }, { name: 'Sydney', lat: -33.87, lon: 151.21 },
];
const REGIONS = Object.freeze({ dhaka: { name: 'Dhaka region', lat: 23.81, lon: 90.41 }, dubai: { name: 'Dubai region', lat: 25.20, lon: 55.27 }, singapore: { name: 'Singapore region', lat: 1.35, lon: 103.82 }, london: { name: 'London region', lat: 51.51, lon: -0.13 }, newyork: { name: 'New York region', lat: 40.71, lon: -74.01 } });
const CACHE_MS = 5 * 60000, WEATHER_CACHE_MS = 15 * 60000;
let signalsCache = null, signalsPending = null, flightsCache = new Map(), flightsPending = new Map(), lastFlightRequest = 0;
const finite = (n, min, max) => typeof n === 'number' && Number.isFinite(n) && n >= min && n <= max;
const text = (x, max = 80) => typeof x === 'string' ? x.replace(/[\x00-\x1f\x7f]/g, '').trim().slice(0, max) : '';
async function json(url, limit = 2 * 1024 * 1024) {
  const r = await fetch(url, { signal: AbortSignal.timeout(9000), redirect: 'error', headers: { 'User-Agent': 'NOVA-World-Monitor/1.0', Accept: 'application/json' } });
  if (!r.ok) throw new Error('Source unavailable');
  const reader = r.body.getReader(); let size = 0; const chunks = [];
  try { while (true) { const { value, done } = await reader.read(); if (done) break; size += value.length; if (size > limit) { await reader.cancel(); throw new Error('Source too large'); } chunks.push(value); } } finally { reader.releaseLock(); }
  return JSON.parse(Buffer.concat(chunks.map(x => Buffer.from(x))).toString('utf8'));
}
function parseWeather(data) {
  if (!Array.isArray(data) || data.length !== CITIES.length) throw new Error('Invalid weather response');
  return data.map((d, i) => {
    const c = d?.current, time = typeof c?.time === 'string' ? Date.parse(c.time.endsWith('Z') ? c.time : c.time + 'Z') : NaN;
    if (!c || !Number.isFinite(time) || !finite(c.temperature_2m, -100, 70) || !finite(c.precipitation, 0, 1000) || !finite(c.wind_speed_10m, 0, 500) || !Number.isInteger(c.weather_code) || c.weather_code < 0 || c.weather_code > 99) throw new Error('Invalid weather response');
    return { ...CITIES[i], temperature: c.temperature_2m, precipitation: c.precipitation, wind: c.wind_speed_10m, code: c.weather_code, time };
  });
}
function parseStorms(data) {
  if (!Array.isArray(data?.activeStorms)) throw new Error('Invalid storm response');
  const storms = data.activeStorms.slice(0, 40).map(s => {
    const lat = s?.latitudeNumeric, lon = s?.longitudeNumeric, time = Date.parse(s?.lastUpdate);
    if (!finite(lat, -90, 90) || !finite(lon, -180, 180) || !Number.isFinite(time) || !text(s?.name)) return null;
    let url = ''; try { const u = new URL(s?.publicAdvisory?.url || s?.forecastAdvisory?.url); if (u.protocol === 'https:' && u.hostname === 'www.nhc.noaa.gov' && !u.username && !u.password && !u.port) url = u.href; } catch {}
    const wind = s.intensity == null || s.intensity === '' ? NaN : Number(s.intensity);
    return { name: text(s.name), classification: text(s.classification, 12), lat, lon, time, wind: Number.isFinite(wind) && wind >= 0 && wind <= 250 ? wind : null, url };
  }).filter(Boolean);
  if (data.activeStorms.length && !storms.length) throw new Error('Invalid storm response');
  return storms;
}
// GDACS positions are reported event centroids, not necessarily current
// storm centers. "Current" in the feed is not a local safety guarantee.
function parseCyclones(data, now = Date.now()) {
  if (data?.type !== 'FeatureCollection' || !Array.isArray(data.features)) throw new Error('Invalid GDACS response');
  const candidates = data.features.filter(f => f?.properties?.eventtype === 'TC' && String(f.properties.iscurrent) === 'true');
  const rows = candidates.slice(0, 100).map(f => {
    const p = f.properties || {}, coords = f.geometry?.coordinates;
    if (f.geometry?.type !== 'Point' || !Array.isArray(coords) || !finite(coords[0], -180, 180) || !finite(coords[1], -90, 90)) return null;
    const raw = text(p.datemodified, 50), time = Date.parse(/(?:Z|[+-]\d\d:\d\d)$/.test(raw) ? raw : raw + 'Z');
    if (!Number.isFinite(time) || time > now + 3600000 || time < now - 7 * 86400000 || !text(p.name)) return null;
    let url = ''; try { const u = new URL(p.url?.report); if (u.protocol === 'https:' && u.hostname === 'www.gdacs.org' && !u.username && !u.password && !u.port) url = u.href; } catch {}
    return { name: text(p.name, 120), country: text(p.country, 80), severity: text(p.severitydata?.severitytext, 160), alert: text(p.alertlevel, 20), lat: coords[1], lon: coords[0], time, url };
  }).filter(Boolean).sort((a,b) => b.time - a.time).slice(0, 25);
  return rows;
}
function parseFlights(data, now = Date.now()) {
  if (!Array.isArray(data?.ac)) throw new Error('Invalid aircraft response');
  if (!finite(data.now, 1, 9999999999999)) throw new Error('Aircraft timestamp unavailable');
  const sourceTime = data.now < 1e11 ? data.now * 1000 : data.now;
  if (sourceTime > now + 60000 || sourceTime < now - 15 * 60000) throw new Error('Aircraft snapshot is stale');
  return data.ac.slice(0, 1000).map(a => {
    const lat = a?.lat, lon = a?.lon, age = a?.seen_pos;
    if (!finite(lat, -90, 90) || !finite(lon, -180, 180) || !finite(age, 0, 180) || !/^[a-f\d]{6}$/i.test(a.hex || '')) return null;
    return { id: a.hex.toUpperCase(), callsign: text(a.flight, 16) || 'Unknown flight', lat, lon, time: sourceTime - age * 1000, altitude: finite(a.alt_baro, -2000, 70000) ? a.alt_baro : null, speed: finite(a.gs, 0, 1500) ? a.gs : null, heading: finite(a.track, 0, 360) ? a.track : null };
  }).filter(Boolean).slice(0, 100);
}
async function result(fn) { try { return { ok: true, items: await fn() }; } catch { return { ok: false, items: [], error: 'Source unavailable or returned invalid data.' }; } }
async function getSignals() {
  if (signalsCache && Date.now() - signalsCache.fetchedAt < WEATHER_CACHE_MS) return signalsCache;
  if (signalsPending) return signalsPending;
  signalsPending = (async () => {
    const query = new URLSearchParams({ latitude: CITIES.map(c => c.lat).join(','), longitude: CITIES.map(c => c.lon).join(','), current: 'temperature_2m,precipitation,weather_code,wind_speed_10m', timezone: 'GMT', forecast_days: '1' });
    const [weather, storms, cyclones] = await Promise.all([result(async () => parseWeather(await json(WEATHER_URL + '?' + query))), result(async () => parseStorms(await json(STORMS_URL))), result(async () => parseCyclones(await json(GDACS_URL)))]);
    return signalsCache = { fetchedAt: Date.now(), weather, storms, cyclones };
  })();
  try { return await signalsPending; } finally { signalsPending = null; }
}
async function getFlights(region) {
  if (!Object.hasOwn(REGIONS, region)) return null;
  const cached = flightsCache.get(region); if (cached && Date.now() - cached.fetchedAt < CACHE_MS) return cached;
  if (flightsPending.has(region)) return flightsPending.get(region);
  if (Date.now() - lastFlightRequest < 2500) return { fetchedAt: Date.now(), region: REGIONS[region].name, radiusNm: 250, ok: false, items: [], error: 'Please wait a few seconds before switching regions.' };
  lastFlightRequest = Date.now(); const r = REGIONS[region];
  const pending = (async () => { const response = await result(async () => parseFlights(await json(`${FLIGHT_URL}/${r.lat}/${r.lon}/250`))); const value = { fetchedAt: Date.now(), region: r.name, radiusNm: 250, ...response }; flightsCache.set(region, value); return value; })();
  flightsPending.set(region, pending); try { return await pending; } finally { flightsPending.delete(region); }
}
module.exports = { getSignals, getFlights, parseWeather, parseStorms, parseCyclones, parseFlights, CITIES, REGIONS };
