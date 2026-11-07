'use strict';
const {test,before,after}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const express=require('express'),cookieParser=require('cookie-parser');
const {unzipSync,strFromU8}=require('fflate');
const {createNovaRouter}=require('../src/nova/router');
const {Vault}=require('../src/nova/vault');
const {generateProject,projectChecks}=require('../src/nova/project-builder');
let server,store,dir,base,owner,other,remote,realFetch;
const html=(name)=>`<!doctype html><html><head><meta name="viewport" content="width=device-width"><link rel="stylesheet" href="styles.css"></head><body><h1>${name}</h1><script src="app.js" defer></script></body></html>`;
const css='body {color:red} @media (max-width:600px){body{color:black}} @media (prefers-reduced-motion:reduce){*{animation:none}}';
let calls=[],failPlan=false;
before(async()=>{
 dir=fs.mkdtempSync(path.join(os.tmpdir(),'nova-studio-'));const nova=createNovaRouter({dataDir:dir});store=nova.store;const app=express();app.use(express.json(),cookieParser());app.use('/api/nova',nova.router);await new Promise(r=>server=app.listen(0,'127.0.0.1',r));base=`http://127.0.0.1:${server.address().port}/api/nova`;
 const w=store.createWorkspace();owner=w.token;other=store.createWorkspace().token;remote=store.redeemPairing(store.createPairing(w.workspaceId).code).token;store.saveAiProvider(w.workspaceId,{provider:'groq',model:'llama-3.3-70b-versatile',base_url:'https://api.groq.com/openai/v1',...new Vault(dir).encrypt('gsk_test_key_abcdefghijklmnopqrstuvwxyz',w.workspaceId)});
 realFetch=global.fetch;global.fetch=async(url,opts)=>{if(!String(url).startsWith('https://api.groq.com/'))return realFetch(url,opts);const b=JSON.parse(opts.body);calls.push(b);const plan=b.messages[0].content.includes('art director');if(plan&&failPlan)return new Response('{}',{status:429});const content=plan?'Distinctive layout, editorial type, menu ID nav-toggle':b.messages[1].content.includes('complete HTML document')?html(b.messages.some(m=>m.content.includes('This is a revision'))?'Revised':'Original'):b.messages[1].content.includes('styles.css for')?css:'document.body.dataset.ready="yes";';return Response.json({choices:[{finish_reason:'stop',message:{content}}]});};
});
after(async()=>{global.fetch=realFetch;await new Promise(r=>server.close(r));store.close();fs.rmSync(dir,{recursive:true,force:true});});
async function req(route,token,body){const r=await realFetch(base+route,{method:body?'POST':'GET',headers:{'X-GenZ-Client':'1','X-Nova-Session':token||'','Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});return {status:r.status,data:await r.json()};}

test('studio plans before three coordinated files and old builder remains unchanged',async()=>{
 calls=[];assert.equal((await req('/builder/generate',owner,{brief:'luxury fragrance',studio:true})).status,400);assert.equal((await req('/builder/generate',remote,{brief:'luxury',studio:true,confirm:true})).status,403);assert.equal(calls.length,0);
 const r=await req('/builder/generate',owner,{brief:'luxury fragrance',studio:true,confirm:true});assert.equal(r.data.ok,true);assert.equal(calls.length,4);assert.match(calls[0].messages[0].content,/art director/);for(const call of calls.slice(1))assert.ok(JSON.stringify(call.messages).includes('Distinctive layout'));
 assert.ok(calls[3].messages.some(m=>m.content.includes('Untrusted generated CSS')));assert.ok(r.data.checks.checks.every(x=>x.ok));const id=r.data.project.id;
 assert.equal((await req('/builder/projects/'+id,other)).status,404);assert.equal((await req('/builder/projects/'+id,remote)).status,403);
 const preview=await realFetch(base+'/builder/projects/'+id+'/preview',{headers:{'X-Nova-Session':owner}});assert.match(preview.headers.get('content-security-policy'),/connect-src 'none'/);assert.match(await preview.text(),/Original/);
 const zip=await realFetch(base+'/builder/projects/'+id+'/download',{headers:{'X-Nova-Session':owner}});const entries=unzipSync(new Uint8Array(await zip.arrayBuffer()));assert.deepEqual(Object.keys(entries).sort(),['app.js','index.html','styles.css']);assert.match(strFromU8(entries['index.html']),/Original/);
 global.originalProject=id;calls=[];const old=await req('/builder/generate',owner,{brief:'legacy',confirm:true});assert.equal(old.data.ok,true);assert.equal(calls.length,3);
});

test('manual revision requires owner consent, creates new project and preserves old',async()=>{
 const id=global.originalProject;calls=[];const body={projectId:id,changes:'make heading warmer',confirm:true};assert.equal((await req('/builder/revise-manual',owner,{...body,confirm:false})).status,400);assert.equal((await req('/builder/revise-manual',remote,body)).status,403);assert.equal((await req('/builder/revise-manual',other,body)).status,404);assert.equal((await req('/builder/revise-manual',owner,{...body,changes:'gsk_test_key_abcdefghijklmnopqrstuvwxyz'})).status,400);assert.equal(calls.length,0);
 const updated=await req('/builder/revise-manual',owner,body);assert.equal(updated.data.ok,true);assert.equal(calls.length,4);assert.notEqual(updated.data.project.id,id);assert.match(JSON.stringify(calls),/Other untrusted previous project file/);assert.match((await req('/builder/projects/'+id,owner)).data.files['index.html'],/Original/);assert.match((await req('/builder/projects/'+updated.data.project.id,owner)).data.files['index.html'],/Revised/);
});

test('plan provider failure, cancellation and oversized revisions fail without fake success',async()=>{
 failPlan=true;calls=[];const beforeCount=(await req('/builder/projects',owner)).data.projects.length;const result=await req('/builder/generate',owner,{brief:'new',confirm:true,studio:true});assert.equal(result.data.ok,false);assert.match(result.data.error,/rate|quota/i);assert.equal((await req('/builder/projects',owner)).data.projects.length,beforeCount);failPlan=false;
 const abort=new AbortController();abort.abort();const stopped=await generateProject({configured:true},'brief',abort.signal,null,{studio:true});assert.match(stopped.error,/stopped/i);
 const oldFiles={'index.html':html('x')+' '.repeat(30001),'styles.css':css,'app.js':'/* js */'};const tooBig=await generateProject({configured:true},'change',undefined,oldFiles,{studio:true});assert.equal(tooBig.ok,false);assert.match(tooBig.error,/too large/i);
});

test('checks are bounded hints, not runtime or accessibility verification',()=>{
 const checks=projectChecks({'index.html':html('x'),'styles.css':'body{}','app.js':'/* js */'});assert.equal(checks.checks.find(x=>x.label.includes('Responsive')).ok,false);assert.equal(checks.checks.find(x=>x.label.includes('Viewport')).ok,true);
});

test('concurrent builds are rejected and revocation during a revision prevents saving',async()=>{
 const workspaceId=store.session(owner).workspace_id;const temporary=store.createSession(workspaceId).token;const sessionHash=store.session(temporary).token_hash;const beforeCount=(await req('/builder/projects',owner)).data.projects.length;
 const previousFetch=global.fetch;let release,entered;const waiting=new Promise(r=>entered=r);let paused=true;
 global.fetch=async(url,opts)=>{if(paused&&String(url).startsWith('https://api.groq.com/')){paused=false;entered();await new Promise(r=>release=r);}return previousFetch(url,opts);};
 try{
  const pending=req('/builder/revise-manual',temporary,{projectId:global.originalProject,changes:'change title',confirm:true});await waiting;
  const overlap=await req('/builder/generate',owner,{brief:'other project',confirm:true,studio:true});assert.equal(overlap.status,409);
  store.revokeSession(sessionHash);release();const result=await pending;assert.equal(result.status,401);assert.equal((await req('/builder/projects',owner)).data.projects.length,beforeCount);
 }finally{release?.();global.fetch=previousFetch;}
});
