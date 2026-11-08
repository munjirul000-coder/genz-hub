// Optional single-owner GitHub OAuth. Disabled unless AUTH_MODE is explicitly github.
// No GitHub access token is persisted; the signed cookie is scoped to this Worker.
const encoder = new TextEncoder();
const stateCookie = '__Host-elovra-oauth';
const sessionCookie = '__Host-elovra-session';
const security = {'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'"};
const b64 = bytes => btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
function unb64(value) {
  if(!/^[A-Za-z0-9_-]+$/.test(value)) throw new Error('Invalid encoding');
  const s=atob(value.replace(/-/g,'+').replace(/_/g,'/')+'='.repeat((4-value.length%4)%4));
  return Uint8Array.from(s,c=>c.charCodeAt(0));
}
const random = n => b64(crypto.getRandomValues(new Uint8Array(n)));
const json = (body,status=403) => Response.json({error:body},{status,headers:security});
function cookie(name,value,age) { return `${name}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${age}`; }
function cookies(request,name) {
  const entries=(request.headers.get('Cookie')||'').split(';').map(x=>x.trim()).filter(x=>x.startsWith(name+'='));
  return entries.length===1 ? entries[0].slice(name.length+1) : '';
}
function redirect(location, values=[]) {
  const headers=new Headers({...security,Location:location});
  for(const value of values) headers.append('Set-Cookie',value);
  return new Response(null,{status:303,headers});
}
async function key(secret) {return crypto.subtle.importKey('raw',encoder.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign','verify']);}
async function seal(secret,kind,payload) {
  const value=b64(encoder.encode(JSON.stringify(payload)));
  const signature=await crypto.subtle.sign('HMAC',await key(secret),encoder.encode(kind+'.'+value));
  return value+'.'+b64(signature);
}
async function open(secret,kind,value) {
  try {
    if(value.length>4096) return null;
    const parts=value.split('.');if(parts.length!==2)return null;
    const valid=await crypto.subtle.verify('HMAC',await key(secret),unb64(parts[1]),encoder.encode(kind+'.'+parts[0]));
    if(!valid)return null;
    const data=JSON.parse(new TextDecoder().decode(unb64(parts[0])));
    const now=Math.floor(Date.now()/1000);
    if(!data || !Number.isInteger(data.exp) || data.exp<=now || !Number.isInteger(data.iat) || data.iat>now+30 || data.exp<=data.iat) return null;
    return data;
  } catch {return null;}
}
function settings(env) {
  try {
    const origin=new URL(env.APP_ORIGIN);
    if(origin.protocol!=='https:' || origin.origin!==env.APP_ORIGIN || origin.username || origin.password || origin.search || origin.hash || origin.pathname!=='/')return null;
    if(!/^[A-Za-z0-9._-]{10,100}$/.test(env.GITHUB_CLIENT_ID||'') || typeof env.GITHUB_CLIENT_SECRET!=='string' || env.GITHUB_CLIENT_SECRET.length<32 || env.GITHUB_CLIENT_SECRET.length>200 || !/^[1-9][0-9]{0,19}$/.test(env.GITHUB_OWNER_ID||''))return null;
    return {origin:origin.origin,id:env.GITHUB_CLIENT_ID,secret:env.GITHUB_CLIENT_SECRET,owner:env.GITHUB_OWNER_ID};
  }catch{return null;}
}
const loginPage = `<!doctype html><html lang="bn"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>ELOVRA — লগইন</title><style>body{font:18px system-ui;background:#101423;color:#f5f5ff;display:grid;place-items:center;min-height:90vh;margin:0}main{padding:2rem;max-width:28rem}a{display:inline-block;background:#b4ff6b;color:#12200a;padding:1rem 1.5rem;border-radius:1rem;font-weight:700;text-decoration:none}</style></head><body><main><h1>ELOVRA</h1><p>শুধু অনুমোদিত মালিকের GitHub অ্যাকাউন্ট দিয়ে প্রবেশ করা যাবে।</p><a href="/auth/github">GitHub দিয়ে প্রবেশ করো</a></main></body></html>`;
// Returns null only for a verified owner session; otherwise a complete response.
export async function githubAuth(request,env) {
  const config=settings(env);if(!config)return json('GitHub login is not configured.',503);
  const url=new URL(request.url);if(url.origin!==config.origin)return json('Invalid app origin.');
  const callback=config.origin+'/auth/github/callback';
  if(url.pathname==='/auth/github' && request.method==='GET') {
    const iat=Math.floor(Date.now()/1000),state=random(32),verifier=random(32);
    const challenge=b64(await crypto.subtle.digest('SHA-256',encoder.encode(verifier)));
    const value=await seal(config.secret,'oauth',{iat,exp:iat+300,state,verifier});
    const target=new URL('https://github.com/login/oauth/authorize');
    for(const [k,v] of Object.entries({client_id:config.id,redirect_uri:callback,state,code_challenge:challenge,code_challenge_method:'S256',allow_signup:'false'}))target.searchParams.set(k,v);
    return redirect(target.href,[cookie(stateCookie,value,300)]);
  }
  if(url.pathname==='/auth/github/callback' && request.method==='GET') {
    const clear=cookie(stateCookie,'',0), value=await open(config.secret,'oauth',cookies(request,stateCookie));
    const states=url.searchParams.getAll('state'),codes=url.searchParams.getAll('code');
    if(!value || states.length!==1 || codes.length!==1 || states[0]!==value.state || typeof value.verifier!=='string' || !/^[A-Za-z0-9_-]{43}$/.test(value.verifier) || !/^[A-Za-z0-9_-]{1,512}$/.test(codes[0]))return redirect('/?login=failed',[clear]);
    try {
      const tokenResponse=await fetch('https://github.com/login/oauth/access_token',{method:'POST',redirect:'error',signal:AbortSignal.timeout(15000),headers:{Accept:'application/json','Content-Type':'application/json'},body:JSON.stringify({client_id:config.id,client_secret:config.secret,code:codes[0],redirect_uri:callback,code_verifier:value.verifier})});
      if(!tokenResponse.ok)throw new Error('Token request failed');
      const token=await tokenResponse.json();
      if(typeof token.access_token!=='string'||!token.access_token||token.access_token.length>1024)throw new Error('Missing token');
      const userResponse=await fetch('https://api.github.com/user',{redirect:'error',signal:AbortSignal.timeout(15000),headers:{Accept:'application/vnd.github+json','User-Agent':'ELOVRA-Website-Studio',Authorization:'Bearer '+token.access_token}});
      if(!userResponse.ok)throw new Error('Identity request failed');
      const user=await userResponse.json();if(!Number.isSafeInteger(user.id)||String(user.id)!==config.owner)throw new Error('Not owner');
      const iat=Math.floor(Date.now()/1000),session=await seal(config.secret,'session',{iat,exp:iat+28800,owner:config.owner,nonce:random(16)});
      return redirect('/',[clear,cookie(sessionCookie,session,28800)]);
    } catch {return redirect('/?login=failed',[clear]);}
  }
  if(url.pathname==='/auth/logout' && request.method==='POST') {
    if(request.headers.get('Origin')!==config.origin)return json('Invalid origin.');
    return redirect('/',[cookie(sessionCookie,'',0)]);
  }
  const session=await open(config.secret,'session',cookies(request,sessionCookie));
  if(session && session.owner===config.owner && session.exp-session.iat<=28800)return null;
  if(url.pathname==='/' && request.method==='GET')return new Response(loginPage,{headers:{...security,'Content-Type':'text/html; charset=utf-8'}});
  return json('Owner login is required.',401);
}
