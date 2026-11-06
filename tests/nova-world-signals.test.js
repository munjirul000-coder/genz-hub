'use strict';
process.env.DISABLE_RATE_LIMIT = '1';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { CITIES, REGIONS, parseWeather, parseStorms, parseCyclones, parseFlights, getSignals, getFlights } = require('../src/nova/world-signals');
const weatherFixture = () => CITIES.map((c, i) => ({ current: { time:'2026-11-06T12:00', temperature_2m: 20+i, precipitation:i === 0 ? 1.5 : 0, wind_speed_10m: 15, weather_code:i === 0 ? 95 : 0 } }));
test('weather is bounded and associated to fixed cities, and storms validate source data', () => {
  const cities = parseWeather(weatherFixture()); assert.equal(cities.length,10); assert.equal(cities[0].name,'Dhaka'); assert.equal(cities[0].precipitation,1.5); assert.equal(cities[0].time, Date.parse('2026-11-06T12:00Z'));
  assert.throws(()=>parseWeather([])); let bad = weatherFixture(); bad[0].current.wind_speed_10m = null; assert.throws(()=>parseWeather(bad));
  const storm = {name:'Test',classification:'TS',intensity:'55',latitudeNumeric:22,longitudeNumeric:-45,lastUpdate:'2026-11-06T12:00:00Z', publicAdvisory:{url:'https://www.nhc.noaa.gov/text/test.shtml'}};
  assert.equal(parseStorms({activeStorms:[]}).length,0); assert.equal(parseStorms({activeStorms:[storm]})[0].wind,55); assert.equal(parseStorms({activeStorms:[{...storm,intensity:null}]})[0].wind,null); assert.equal(parseStorms({activeStorms:[{...storm,publicAdvisory:{url:'https://evil.test/'}}]})[0].url,''); assert.throws(()=>parseStorms({activeStorms:[{name:'broken'}]}));
});
test('GDACS cyclone reports use recent attributed event centroids, not forecast tracks', () => {
  const now=Date.now(), f={ type:'Feature', geometry:{type:'Point',coordinates:[90,22]}, properties:{eventtype:'TC',iscurrent:'true',name:'Cyclone test',country:'Bangladesh',datemodified:new Date(now).toISOString(),alertlevel:'Orange',severitydata:{severitytext:'Heavy winds'},url:{report:'https://www.gdacs.org/report.aspx?eventtype=TC'}}};
  const rows=parseCyclones({type:'FeatureCollection',features:[f]},now); assert.equal(rows.length,1); assert.equal(rows[0].lat,22); assert.equal(rows[0].url,'https://www.gdacs.org/report.aspx?eventtype=TC');
  assert.equal(parseCyclones({type:'FeatureCollection',features:[{...f,properties:{...f.properties,datemodified:new Date(now-8*86400000).toISOString()}}]},now).length,0);
  assert.equal(parseCyclones({type:'FeatureCollection',features:[{...f,properties:{...f.properties,url:{report:'https://evil.test'}}}]},now)[0].url,''); assert.throws(()=>parseCyclones({features:[]}));
});
test('aircraft must be recent, valid and snapshot timestamps come from provider', () => {
  const now=Date.now(), data={now,ac:[{hex:'abcdef',flight:'  BG123  ',lat:23.8,lon:90.4,seen_pos:3,alt_baro:10000,gs:320,track:80},{hex:'nope',lat:24,lon:91,seen_pos:3},{hex:'bbbbbb',lat:22,lon:90,seen_pos:200}]};
  const rows=parseFlights(data,now); assert.equal(rows.length,1); assert.equal(rows[0].callsign,'BG123'); assert.equal(rows[0].time,now-3000); assert.equal(rows[0].speed,320); assert.throws(()=>parseFlights({ac:[]},now)); assert.throws(()=>parseFlights({now:now-3600000,ac:[]},now)); assert.throws(()=>parseFlights({now,ac:'wrong'},now));
});
test('fixed-source proxy caches, coalesces, is opt-in for flights, and validates regions', async () => {
  const old=global.fetch; let calls=[];
  global.fetch=async (url,options)=>{ calls.push(String(url)); assert.equal(options.redirect,'error'); if(String(url).startsWith('https://api.open-meteo.com/')) return Response.json(weatherFixture()); if(String(url).startsWith('https://www.gdacs.org/')) return Response.json({type:'FeatureCollection',features:[]}); if(String(url).startsWith('https://www.nhc.noaa.gov/')) return Response.json({activeStorms:[]}); if(String(url).startsWith('https://api.adsb.lol/')) return Response.json({now:Date.now(),ac:[{hex:'abcdef',lat:23,lon:90,seen_pos:1}]}); throw new Error('Unexpected URL'); };
  try { const [a,b]=await Promise.all([getSignals(),getSignals()]); assert.equal(a.weather.ok,true); assert.equal(b.storms.ok,true); assert.equal(calls.length,3); assert.ok(calls.every(x=>!x.includes('adsb'))); await getSignals(); assert.equal(calls.length,3);
    assert.equal(await getFlights('../evil'),null); const [first,second]=await Promise.all([getFlights('dhaka'),getFlights('dhaka')]); assert.equal(first.ok,true); assert.equal(first.items.length,1); assert.equal(second.radiusNm,250); assert.equal(calls.length,4); await getFlights('dhaka'); assert.equal(calls.length,4); assert.equal((await getFlights('london')).ok,false); assert.equal(calls.length,4); assert.equal(Object.keys(REGIONS).length,5);
  } finally { global.fetch=old; }
});
test('new source APIs require session and reject arbitrary region / URL', async () => {
  const fs=require('node:fs'), os=require('node:os'), path=require('node:path'), express=require('express'), cookies=require('cookie-parser'); const {createNovaRouter}=require('../src/nova/router'); const dir=fs.mkdtempSync(path.join(os.tmpdir(),'nova-signals-api-')); const n=createNovaRouter({dataDir:dir}); const app=express(); app.use(express.json()); app.use(cookies()); app.use('/api/nova',n.router); const server=await new Promise(r=>{const s=app.listen(0,'127.0.0.1',()=>r(s));}); const base=`http://127.0.0.1:${server.address().port}/api/nova`;
  try { assert.equal((await fetch(base+'/world/signals')).status,401); assert.equal((await fetch(base+'/world/flights?region=dhaka')).status,401); const session=await (await fetch(base+'/session',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'})).json(); const headers={'X-Nova-Session':session.token}; assert.equal((await fetch(base+'/world/flights?region=https%3A%2F%2Fevil.test',{headers})).status,400); const signal=await (await fetch(base+'/world/signals',{headers})).json(); assert.equal(signal.weather.items[0].name,'Dhaka'); const flight=await (await fetch(base+'/world/flights?region=dhaka',{headers})).json(); assert.equal(flight.items.length,1);
  } finally { n.close(); await new Promise(r=>server.close(r)); n.store.close(); fs.rmSync(dir,{recursive:true,force:true}); }
});
test('provider errors and malformed responses are never presented as empty clear skies', async () => {
  const old = global.fetch; const modulePath = require.resolve('../src/nova/world-signals'); delete require.cache[modulePath]; const isolated = require('../src/nova/world-signals'); let calls = 0;
  global.fetch = async url => { calls++; if(String(url).includes('open-meteo')) return Response.json({invalid:true}); return new Response('unavailable',{status:429}); };
  try { const signals = await isolated.getSignals(); assert.equal(signals.weather.ok,false); assert.equal(signals.storms.ok,false); assert.equal(signals.cyclones.ok,false); assert.deepEqual(signals.cyclones.items,[]); const flights = await isolated.getFlights('dhaka'); assert.equal(flights.ok,false); assert.deepEqual(flights.items,[]); const count=calls; await isolated.getFlights('dhaka'); assert.equal(calls,count); }
  finally { global.fetch=old; }
});
