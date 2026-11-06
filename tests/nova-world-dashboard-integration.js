'use strict';
// Isolated real server and Chromium; network feeds are intentionally fixtures.
const fs = require('node:fs'), os = require('node:os'), path = require('node:path'), net = require('node:net');
const { spawn } = require('node:child_process'); const assert = require('node:assert/strict'); const puppeteer = require('puppeteer');
const ROOT = path.join(__dirname,'..'), delay = ms => new Promise(r => setTimeout(r,ms));
async function freePort() { const s=net.createServer(); await new Promise(r=>s.listen(0,'127.0.0.1',r)); const p=s.address().port; await new Promise(r=>s.close(r)); return p; }
async function browser() { if(fs.existsSync(puppeteer.executablePath())) return puppeteer.launch({headless:true,args:['--no-sandbox']}); const {default:chromium,inflate}=await import('@sparticuz/chromium'); await inflate(path.join(ROOT,'node_modules/@sparticuz/chromium/bin/al2023.tar.br')); process.env.LD_LIBRARY_PATH='/tmp/al2023/lib:'+(process.env.LD_LIBRARY_PATH||''); return puppeteer.launch({headless:true,executablePath:await chromium.executablePath(),args:chromium.args.filter(a=>!['--disable-web-security','--allow-running-insecure-content','--single-process'].includes(a))}); }
(async()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'nova-world-browser-')), port=await freePort(); const server=spawn(process.execPath,['src/server.js'],{cwd:ROOT,env:{...process.env,PORT:String(port),DATA_DIR:dir,NOVA_HOME:'1',NODE_ENV:'test'},stdio:'ignore'}); let b;
  try {
    for(let i=0;i<80;i++){ try { if((await fetch(`http://127.0.0.1:${port}/api/health`)).ok) break; }catch{} await delay(150); }
    b=await browser(); const p=await b.newPage(); let errors=[]; p.on('pageerror',e=>errors.push(e.message)); await p.setViewport({width:1440,height:900});
    await p.evaluateOnNewDocument(()=>{
      const real=window.fetch; window.fixture={flightRequests:0,offline:false,hold:false};
      window.fetch=(url,opts)=>{ const pathname=new URL(String(url),location.href).pathname, now=Date.now();
        if(pathname.endsWith('/world')) return Promise.resolve(Response.json(window.fixture.offline ? {fetchedAt:now,quakes:{ok:false,items:[],error:'Quakes unavailable'},news:{ok:false,items:[],error:'News unavailable'},bangladesh:{ok:false,items:[],error:'Bangladesh unavailable'}} : {fetchedAt:now,quakes:{ok:true,items:[{lat:23.7,lon:90.4,magnitude:4.2,time:now,place:'Near Dhaka',url:'https://earthquake.usgs.gov/test'}]},news:{ok:true,sources:[{name:'BBC World',ok:true}],items:[{title:'Example news',source:'BBC World',url:'https://www.bbc.com/news/test',time:now}]},bangladesh:{ok:true,items:[]}}));
        if(pathname.endsWith('/world/signals')) return Promise.resolve(Response.json(window.fixture.offline ? {fetchedAt:now,weather:{ok:false,items:[],error:'Weather unavailable'},storms:{ok:false,items:[],error:'NHC unavailable'},cyclones:{ok:false,items:[],error:'GDACS unavailable'}} : {fetchedAt:now,weather:{ok:true,items:[{name:'Dhaka',lat:23.81,lon:90.41,temperature:27,precipitation:1.2,wind:10,code:61,time:now}]},storms:{ok:true,items:[{name:'Test NHC',classification:'TS',lat:20,lon:-50,time:now,wind:40,url:'https://www.nhc.noaa.gov/text/test'}]},cyclones:{ok:true,items:[{name:'Test cyclone',country:'Bangladesh',lat:21,lon:90,time:now,alert:'Orange',severity:'Strong wind',url:'https://www.gdacs.org/report.aspx?eventtype=TC'}]}}));
        if(pathname.endsWith('/world/flights')) { window.fixture.flightRequests++; const answer=()=>Response.json({ok:true,region:'Dhaka region',radiusNm:250,fetchedAt:now,items:[{id:'ABCDEF',callsign:'BG123',lat:24,lon:91,time:now,altitude:30000,speed:400,heading:90}]}); return window.fixture.hold ? new Promise(resolve=>{window.fixture.release=()=>resolve(answer());}) : Promise.resolve(answer()); }
        return real(url,opts);
      };
    });
    await p.goto(`http://127.0.0.1:${port}/nova#world`,{waitUntil:'domcontentloaded'}); await p.waitForSelector('[data-weather]'); await p.waitForSelector('[data-cyclone]'); assert.equal(await p.evaluate(()=>window.fixture.flightRequests),0);
    assert.match(await p.$eval('body',e=>e.innerText),/not Bangladesh or worldwide/); await p.click('[data-cyclone]'); assert.match(await p.$eval('#world-selected',e=>e.innerText),/reported centroid/); assert.match(await p.$eval('#world-selected a',e=>e.href),/^https:\/\/www\.gdacs\.org\//);
    await p.click('#wm-flight-toggle'); await p.waitForSelector('[data-flight]'); await p.click('[data-flight]'); assert.match(await p.$eval('#world-selected',e=>e.innerText),/BG123/); assert.equal(await p.$eval('[data-flight]',e=>e.getAttribute('aria-pressed')),'true');
    await p.click('#world-refresh'); await p.waitForFunction(()=>window.fixture.flightRequests===2 && document.querySelector('[data-flight]')?.getAttribute('aria-pressed')==='true');
    await p.click('#wm-flight-untrack'); assert.equal(await p.$eval('#wm-flight-untrack',e=>e.hidden),true); await p.click('#wm-flight-toggle'); assert.equal(await p.$('[data-flight]'),null);
    await p.evaluate(()=>window.fixture.hold=true); await p.click('#wm-flight-toggle'); await p.waitForFunction(()=>!!window.fixture.release); await p.click('#wm-flight-toggle'); await p.evaluate(()=>window.fixture.release()); await delay(200); assert.equal(await p.$('[data-flight]'),null);
    await p.click('[data-world-mode="map"]'); assert.equal(await p.$eval('[data-world-mode="map"]',e=>e.getAttribute('aria-pressed')),'true'); await p.click('.world-event'); assert.match(await p.$eval('#world-selected',e=>e.innerText),/USGS details/);
    await p.setViewport({width:390,height:844}); await delay(200); assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth+1),true);
    await p.evaluate(()=>window.fixture.offline=true); await p.click('#world-refresh'); await p.waitForFunction(()=>document.querySelector('#wm-weather-list')?.innerText.includes('Weather unavailable')); assert.equal(await p.$('[data-cyclone]'),null); assert.match(await p.$eval('#wm-cyclone-list',e=>e.innerText),/GDACS unavailable/); assert.deepEqual(errors,[]);
    console.log('PASS: isolated Chromium dashboard, sources, opt-in tracking, selection, stale-response stop, mobile and offline (mocked feeds)');
  } finally { if(b) await b.close(); server.kill('SIGTERM'); await new Promise(r=>{if(server.exitCode!==null)return r(); server.once('exit',r);}); fs.rmSync(dir,{recursive:true,force:true}); }
})().catch(e=>{console.error(e);process.exitCode=1});
