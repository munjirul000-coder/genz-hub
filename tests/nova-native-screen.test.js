'use strict';
process.env.DISABLE_RATE_LIMIT = '1';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { PassThrough, Writable } = require('node:stream');
const { createNativeScreen, screenVoiceIntent } = require('../src/nova/native-screen');
const { nativeScreenArgs } = require('../src/nova/native-screen-script');
const delay = ms => new Promise(r => setTimeout(r, ms));
const FRAME = Buffer.from([0xff, 0xd8, 0xff, 0xd9]).toString('base64');
function child() {
  const c = new EventEmitter(); c.stdout = new PassThrough(); c.messages = []; c.killed = false;
  c.stdin = new Writable({ write(chunk, _, done) { c.messages.push(...chunk.toString().trim().split('\n').map(JSON.parse)); done(); }, final(done) { setImmediate(() => c.emit('exit', 0)); done(); } });
  c.kill = () => { c.killed = true; setImmediate(() => c.emit('exit', 1)); }; c.send = o => c.stdout.write(JSON.stringify(o) + '\n'); return c;
}
function harness(extra = {}) {
  let c, valid = true, calls = [], config = { configured: true, base: 'https://api.groq.com/openai/v1', key: 'fixture-key' };
  const manager = createNativeScreen({ platform: 'win32', systemRoot: 'C:\\Windows', spawnChild: (...args) => { calls.push(args); c = child(); return c; }, sessionActive: () => valid, workspaceAi: () => config, checkMs: 10, readyMs: 50, captureMs: 70, stopMs: 20, ...extra });
  return { manager, get c() { return c; }, calls, invalidate() { valid = false; }, noAi() { config = { configured: false }; } };
}
async function start(h, voiceRequests = false) { const p = h.manager.start('w', 'a', { model: 'vision-model', voiceRequests }); h.c.send({ type: 'ready' }); assert.equal((await p).ok, true); }
function frame(h) { const cmd = h.c.messages.findLast(x => x.type === 'capture'); assert.ok(cmd); h.c.send({ type: 'frame', id: cmd.id, image: FRAME }); }

test('worker is static, visible before ready and capture, and handles tray stop before sending', () => {
  assert.throws(() => nativeScreenArgs(-1)); const s = Buffer.from(nativeScreenArgs(123).at(-1), 'base64').toString('utf16le');
  assert.match(s, /NotifyIcon/); assert.match(s, /CopyFromScreen/); assert.ok(s.indexOf('$icon.Visible = $true') < s.indexOf("type = 'ready'")); assert.match(s, /if \(-not \$running\) \{ break \}\s*Emit @\{ type = 'frame'/); assert.match(s, /40000000/);
});
test('opt-in, OS, provider, session, input, isolation and static worker', async () => {
  const h = harness(); h.invalidate(); assert.equal((await h.manager.start('w', 'a', { model: 'vision', voiceRequests: false })).ok, false); assert.equal(h.calls.length, 0);
  const linux = harness({ platform: 'linux' }); assert.equal((await linux.manager.start('w','a',{ model:'v', voiceRequests:false })).ok, false);
  const bad = harness(); assert.equal((await bad.manager.start('w','a',{ model:'v;bad', voiceRequests:false })).ok, false); assert.equal((await bad.manager.start('w','a',{ model:'v' })).ok, false); bad.noAi(); assert.equal((await bad.manager.start('w','a',{ model:'v', voiceRequests:false })).ok, false); assert.equal(bad.calls.length, 0);
  const good = harness(); await start(good); assert.equal(good.c.messages.length, 0); assert.equal(good.calls[0][2].shell, false); assert.equal(good.calls[0][2].env.NOVA_AI_API_KEY, undefined); assert.equal(good.manager.status('other','a').state,'off'); assert.equal(good.manager.status('w','other').owned,false); assert.equal((await good.manager.describe('w','other','describe')).ok,false); assert.equal((await good.manager.start('w','a',{ model:'v', voiceRequests:false })).ok,false); good.manager.close(); await delay(5);
});
test('voice intent is narrowly fixed and separate voice permission required', async () => {
  assert.equal(screenVoiceIntent('স্ক্রিনে কী আছে'), true); assert.equal(screenVoiceIntent('describe my screen'), true); assert.equal(screenVoiceIntent('describe my screen and click delete'), false); assert.equal(screenVoiceIntent('open my screen'), false);
  const h = harness(); await start(h); assert.match((await h.manager.describe('w','a','describe', {fromVoice:true})).error, /Voice/); assert.equal(h.c.messages.length, 0); h.manager.close(); await delay(5);
});
test('capture is one bounded image sent only on request; answer transient and secrets rejected', async () => {
  const old = global.fetch, h = harness(); let request; global.fetch = async (url, options) => { request = { url, options, body: JSON.parse(options.body) }; return Response.json({ choices: [{ message: { content: 'A desktop is visible.' } }] }); };
  try { await start(h, true); assert.equal((await h.manager.describe('w','a','my password')).ok,false); assert.equal(h.c.messages.length,0);
    const p = h.manager.describe('w','a','describe', {fromVoice:true}); assert.equal(h.c.messages.length,1); assert.equal((await h.manager.describe('w','a','describe')).ok,false); frame(h); const r = await p; assert.deepEqual(r,{ok:true,answer:'A desktop is visible.'}); assert.equal(request.body.messages[1].content[1].image_url.url,'data:image/jpeg;base64,'+FRAME); assert.equal(request.body.model,'vision-model'); assert.match(request.options.headers.Authorization,/fixture-key/); assert.equal(JSON.stringify(h.c.messages).includes('fixture-key'),false); assert.equal((await h.manager.describe('w','a','describe')).ok,false);
  } finally { global.fetch = old; h.manager.close(); await delay(5); }
});
test('stop, session revocation, expiry, bad frames, and canceled clients prevent upload', async () => {
  const old = global.fetch; let calls = 0; global.fetch = async () => { calls++; return Response.json({choices:[{message:{content:'ok'}}]}); };
  try {
    for (const mode of ['stop','invalid','expire','bad','abort']) {
      const h = harness({ lifetimeMs: mode === 'expire' ? 25 : 1000 }); await start(h); const a = new AbortController(); const p = h.manager.describe('w','a','describe',{signal:a.signal});
      if (mode === 'stop') h.manager.stop('w','a'); if (mode === 'invalid') { h.invalidate(); await delay(20); } if (mode === 'expire') await delay(35); if (mode === 'bad') { const id = h.c.messages[0].id; h.c.send({type:'frame',id,image:'AAAA'}); } if (mode === 'abort') a.abort();
      assert.equal((await p).ok,false,mode); assert.equal(calls,0); h.manager.close(); await delay(5);
    }
  } finally { global.fetch = old; }
});
test('stopping an uploaded request aborts it and suppresses a late answer', async () => {
  const old = global.fetch; let release, signal; global.fetch = async (_, o) => { signal = o.signal; await new Promise(r => { release = r; }); return Response.json({choices:[{message:{content:'late'}}]}); };
  const h = harness(); try { await start(h); const p = h.manager.describe('w','a','describe'); frame(h); await delay(5); assert.ok(release); h.manager.stop('w','a'); assert.equal(signal.aborted,true); release(); const result = await p; assert.equal(result.ok,false); assert.match(result.error,/cannot be recalled/); } finally { global.fetch = old; h.manager.close(); await delay(5); }
});
test('local owner endpoints require consent and cannot be used from remote or forwarded origins', async () => {
  const fs = require('node:fs'), os = require('node:os'), path = require('node:path'), express = require('express'), cookies = require('cookie-parser'); const { createNovaRouter } = require('../src/nova/router');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(),'nova-screen-')); let c, count = 0; const oldKey = process.env.NOVA_AI_API_KEY; process.env.NOVA_AI_API_KEY = 'fixture';
  const n = createNovaRouter({ dataDir:dir, nativeScreenOptions:{ platform:'win32', systemRoot:'C:\\Windows', spawnChild: () => { count++; c = child(); setImmediate(() => c.send({type:'ready'})); return c; } } }); const app = express(); app.use(express.json()); app.use(cookies()); app.use('/api/nova',n.router); const server = await new Promise(r => { const s = app.listen(0,'127.0.0.1',()=>r(s)); }); const origin = `http://127.0.0.1:${server.address().port}`;
  async function req(route, token, body, headers={}) { const res = await fetch(origin+'/api/nova'+route, { method:'POST', headers:{ 'Content-Type':'application/json', Origin:origin, ...(token ? {'X-Nova-Session':token} : {}), ...headers }, body:JSON.stringify(body) }); return { status:res.status, data:await res.json() }; }
  try { const owner = (await req('/session',null,{})).data.token; const row = n.store.session(owner); const remote = n.store.createSession(row.workspace_id,'remote').token; const params = {confirm:true,model:'vision',voiceRequests:false};
    assert.equal((await req('/native-screen/start',remote,params)).status,403); assert.equal((await req('/native-screen/start',owner,{...params,confirm:false})).status,400); assert.equal((await req('/native-screen/start',owner,params,{'x-forwarded-for':'1.2.3.4'})).status,403); assert.equal(count,0);
    assert.equal((await req('/native-screen/start',owner,params)).data.ok,true); assert.equal((await req('/native-screen/describe',owner,{question:'describe'})).status,400); assert.equal((await req('/native-screen/stop',remote,{})).status,403); assert.equal(c.messages.length,0); assert.equal((await req('/native-screen/stop',owner,{})).data.ok,true);
  } finally { n.close(); await new Promise(r=>server.close(r)); n.store.close(); fs.rmSync(dir,{recursive:true,force:true}); if (oldKey === undefined) delete process.env.NOVA_AI_API_KEY; else process.env.NOVA_AI_API_KEY=oldKey; }
});
test('native voice integrates only exact separately permitted screen requests and stop aborts vision', async () => {
  const fs = require('node:fs'), os = require('node:os'), path = require('node:path'), express = require('express'), cookies = require('cookie-parser'); const { createNovaRouter } = require('../src/nova/router');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(),'nova-screen-voice-')); const oldFetch = global.fetch, oldKey = process.env.NOVA_AI_API_KEY, oldProvider = process.env.NOVA_AI_PROVIDER; process.env.NOVA_AI_API_KEY = 'fixture'; process.env.NOVA_AI_PROVIDER = 'groq'; let screen, voice, visionCalls = 0, release, providerSignal;
  global.fetch = async (url, options) => { if (!String(url).startsWith('https://api.groq.com/')) return oldFetch(url, options); visionCalls++; providerSignal = options.signal; await new Promise(r => { release = r; }); return Response.json({ choices:[{ message:{ content:'A desktop is visible.' } }] }); };
  const n = createNovaRouter({ dataDir:dir, nativeScreenOptions:{ platform:'win32', systemRoot:'C:\\Windows', spawnChild:() => { screen = child(); setImmediate(()=>screen.send({type:'ready'})); return screen; } }, nativeVoiceOptions:{ platform:'win32', systemRoot:'C:\\Windows', spawnChild:() => { voice = child(); setImmediate(()=>voice.send({type:'ready',language:'en-US'})); return voice; } } });
  const app = express(); app.use(express.json()); app.use(cookies()); app.use('/api/nova',n.router); const server = await new Promise(r=>{const s=app.listen(0,'127.0.0.1',()=>r(s));}); const origin = `http://127.0.0.1:${server.address().port}`;
  async function req(route, token, body) { const r = await oldFetch(origin+'/api/nova'+route,{ method:'POST',headers:{'Content-Type':'application/json',Origin:origin,...(token?{'X-Nova-Session':token}:{})},body:JSON.stringify(body)}); return r.json(); }
  try { const token=(await req('/session',null,{})).token; assert.equal((await req('/native-voice/start',token,{confirm:true,language:'en-US'})).ok,true); assert.equal((await req('/native-screen/start',token,{confirm:true,model:'vision',voiceRequests:true})).ok,true);
    voice.send({type:'heard', text:'Nova describe my screen', confidence:0.9}); await delay(10); assert.equal(screen.messages[0].type,'capture'); frame({c:screen}); await delay(10); assert.equal(visionCalls,1); assert.ok(release);
    assert.equal((await req('/native-voice/stop',token,{})).ok,true); assert.equal(providerSignal.aborted,true); release(); await delay(15); assert.equal(voice.messages.some(m=>m.type==='say'),false); assert.ok(screen.messages.some(m=>m.type==='stop'));
  } finally { n.close(); await new Promise(r=>server.close(r)); n.store.close(); fs.rmSync(dir,{recursive:true,force:true}); global.fetch=oldFetch; if(oldKey===undefined) delete process.env.NOVA_AI_API_KEY; else process.env.NOVA_AI_API_KEY=oldKey; if(oldProvider===undefined) delete process.env.NOVA_AI_PROVIDER; else process.env.NOVA_AI_PROVIDER=oldProvider; }
});
test('unexpected screen worker exit aborts an in-flight provider request', async () => {
  const old = global.fetch; let release, signal; global.fetch = async (_, o) => { signal = o.signal; await new Promise(r => { release = r; }); return Response.json({ choices:[{message:{content:'late'}}] }); };
  const h = harness(); try { await start(h); const pending = h.manager.describe('w','a','describe'); frame(h); await delay(5); assert.ok(release); h.c.emit('exit',1); assert.equal(signal.aborted,true); release(); assert.equal((await pending).ok,false); assert.equal(h.manager.status('w','a').state,'off'); } finally { global.fetch = old; h.manager.close(); await delay(5); }
});
