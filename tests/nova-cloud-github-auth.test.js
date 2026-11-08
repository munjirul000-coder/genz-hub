'use strict';
const {test,before,after}=require('node:test');const assert=require('node:assert/strict');
let app,oldFetch,mode='owner',githubRequests=[];
const env={AUTH_MODE:'github',APP_ORIGIN:'https://studio.example',GITHUB_CLIENT_ID:'Ov23li1234567890',GITHUB_CLIENT_SECRET:'f'.repeat(40),GITHUB_OWNER_ID:'317030294',GROQ_API_KEY:'test-secret'};
const assets={'/index.html':{content:'<h1>Private Studio</h1>',type:'text/html'},'/app.js':{content:'private code',type:'text/javascript'}};
const req=(path,options={})=>new Request('https://studio.example'+path,options);
const run=(request,e=env)=>app.fetch(request,e,{},assets);
const pair=(headers,name)=>headers.getSetCookie().find(s=>s.startsWith(name+'=')).split(';')[0];
const stateName='__Host-elovra-oauth',sessionName='__Host-elovra-session';
before(async()=>{({default:app}=await import('../cloudflare-studio/app.mjs'));oldFetch=global.fetch;global.fetch=async(url,options)=>{githubRequests.push({url,options});assert.equal(options.redirect,'manual');if(mode==='network')throw new Error('Network');if(mode==='redirect')return new Response(null,{status:302,headers:{location:'https://evil.example'}});if(url==='https://github.com/login/oauth/access_token')return Response.json({access_token:'fake-github-token'});assert.equal(url,'https://api.github.com/user');return Response.json({id:mode==='owner'?317030294:42});};});
after(()=>{global.fetch=oldFetch;});
async function start() {const response=await run(req('/auth/github'));assert.equal(response.status,303);const location=new URL(response.headers.get('location'));return {response,location,state:location.searchParams.get('state'),cookie:pair(response.headers,stateName)};}
async function callback(started,state=started.state){return run(req('/auth/github/callback?code=sample_code&state='+state,{headers:{cookie:started.cookie}}));}

test('default Access remains fail-closed and unknown authentication modes reject',async()=>{
  assert.equal((await run(req('/'),{})).status,403);
  assert.equal((await run(req('/'),{...env,AUTH_MODE:'githb'})).status,503);
  assert.equal((await run(req('/'),{...env,GITHUB_CLIENT_SECRET:''})).status,503);
  assert.equal((await run(req('/'),{...env,APP_ORIGIN:'http://studio.example'})).status,503);
  assert.equal((await run(new Request('https://wrong.example/'))).status,403);
});
test('anonymous sees login page only, not protected content or API',async()=>{
  const page=await run(req('/'));assert.equal(page.status,200);assert.match(await page.text(),/GitHub/);
  for(const path of ['/app.js','/preview.html','/api/status','/api/build'])assert.equal((await run(req(path))).status,401);
});
test('OAuth state, PKCE and redirect are fixed and reject tampering',async()=>{
  githubRequests=[];const started=await start();
  assert.equal(started.location.origin,'https://github.com');assert.equal(started.location.pathname,'/login/oauth/authorize');
  assert.equal(started.location.searchParams.get('redirect_uri'),'https://studio.example/auth/github/callback');
  assert.equal(started.location.searchParams.get('code_challenge_method'),'S256');assert.equal(started.location.searchParams.get('code_challenge').length,43);
  assert.match(started.response.headers.getSetCookie()[0],/HttpOnly; Secure; SameSite=Lax; Max-Age=300/);
  for(const r of [await callback(started,'wrong'),await run(req('/auth/github/callback?code=x&state='+started.state)),await run(req('/auth/github/callback?code=x&state='+started.state,{headers:{cookie:started.cookie+'x'}})),await run(req('/auth/github/callback?code=x&code=y&state='+started.state,{headers:{cookie:started.cookie}}))]){
    assert.equal(r.headers.get('location'),'/?login=failed&stage=state');assert.match(r.headers.getSetCookie()[0],/Max-Age=0/);
  }
  assert.equal(githubRequests.length,0);
});
test('verified owner gets a short-lived signed HttpOnly session and can use the studio',async()=>{
  mode='owner';githubRequests=[];const started=await start();const result=await callback(started);assert.equal(result.status,303);assert.equal(result.headers.get('location'),'/');
  assert.equal(githubRequests.length,2);
  const body=JSON.parse(githubRequests[0].options.body);assert.equal(body.redirect_uri,'https://studio.example/auth/github/callback');assert.equal(body.code_verifier.length,43);
  const challenge=Buffer.from(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(body.code_verifier))).toString('base64url');assert.equal(challenge,started.location.searchParams.get('code_challenge'));
  const session=pair(result.headers,sessionName);assert.match(result.headers.getSetCookie().find(x=>x.startsWith(sessionName)),/HttpOnly; Secure; SameSite=Lax; Max-Age=28800/);
  const page=await run(req('/',{headers:{cookie:session}}));assert.equal(page.status,200);assert.match(await page.text(),/Private Studio/);
  const status=await run(req('/api/status',{headers:{cookie:session}}));assert.deepEqual(await status.json(),{configured:true,mode:'browser-storage',authMode:'github'});
  assert.equal((await run(req('/api/status',{headers:{cookie:session+'x'}}))).status,401);
  assert.equal((await run(req('/api/status',{headers:{cookie:session+'; '+session}}))).status,401);
  const csrf=await run(req('/api/build',{method:'POST',headers:{cookie:session,origin:'https://evil.example','content-type':'application/json','x-nova-studio':'1'},body:'{}'}));assert.equal(csrf.status,403);
  assert.equal((await run(req('/auth/logout',{method:'POST',headers:{origin:'https://evil.example',cookie:session}}))).status,403);
  const logout=await run(req('/auth/logout',{method:'POST',headers:{origin:env.APP_ORIGIN,cookie:session}}));assert.match(logout.headers.getSetCookie()[0],/Max-Age=0/);
  assert.equal((await run(req('/api/status',{headers:{cookie:session}}),{...env,GITHUB_CLIENT_SECRET:'a'.repeat(40)})).status,401);
});
test('other GitHub accounts and provider failures never receive a session',async()=>{
  for(const value of ['other','network','redirect']){mode=value;const result=await callback(await start());assert.equal(result.headers.get('location'),'/?login=failed&stage='+(value==='other'?'owner':value==='redirect'?'token':'provider'));assert.ok(!result.headers.getSetCookie().some(c=>c.startsWith(sessionName)));}
  mode='owner';
});

test('expired and future-issued signed sessions are rejected',async()=>{
  async function make(payload){const data=Buffer.from(JSON.stringify(payload)).toString('base64url');const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(env.GITHUB_CLIENT_SECRET),{name:'HMAC',hash:'SHA-256'},false,['sign']);const mac=await crypto.subtle.sign('HMAC',key,new TextEncoder().encode('session.'+data));return sessionName+'='+data+'.'+Buffer.from(mac).toString('base64url');}
  const now=Math.floor(Date.now()/1000);
  for(const payload of [{iat:now-100,exp:now-1,owner:env.GITHUB_OWNER_ID},{iat:now+100,exp:now+200,owner:env.GITHUB_OWNER_ID},{iat:now-1,exp:now+28800,owner:env.GITHUB_OWNER_ID},{iat:now-1,exp:now+100,owner:'42'}]){
    assert.equal((await run(req('/api/status',{headers:{cookie:await make(payload)}}))).status,401);
  }
});

test('login failure displays only a safe diagnostic without echoing input',async()=>{const r=await run(req('/?login=failed&stage=owner'));assert.match(await r.text(),/লগইন হয়নি.*owner/);const x=await run(req('/?login=failed&stage=%3Cscript%3Eevil'));assert.doesNotMatch(await x.text(),/<script>evil/);});
