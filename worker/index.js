// Same-UUID gateway. All secrets arrive through private deployment bindings.
const encoder=new TextEncoder();
const hex=bytes=>Array.from(bytes,x=>x.toString(16).padStart(2,'0')).join('');
async function mac(key,value){return hex(new Uint8Array(await crypto.subtle.sign('HMAC',await crypto.subtle.importKey('raw',encoder.encode(key),{name:'HMAC',hash:'SHA-256'},false,['sign']),encoder.encode(value))));}
const equal=(a,b)=>{if(a.length!==b.length)return false;let n=0;for(let i=0;i<a.length;i++)n|=a.charCodeAt(i)^b.charCodeAt(i);return n===0};
export async function handleApi(request,env){
 const fail=(error,status)=>Response.json({error},{status,headers:{'Cache-Control':'no-store'}});
 const origin=env.HARBOR_PUBLIC_ORIGIN,base=env.HARBOR_GAME_BASE,upstream=env.HARBOR_UPSTREAM_ORIGIN,token=env.HARBOR_EDGE_TOKEN,expires=Number(env.HARBOR_EXPIRES_AT);
 if(origin!=='https://game.aiwaves.tech'||!/^\/[a-f0-9-]{36}$/.test(base??'')||!/^https:\/\/[a-z0-9.-]+$/.test(upstream??'')||!/^[a-f0-9]{64}$/.test(token??'')||!Number.isSafeInteger(expires)||env.HARBOR_IDENTITY_MODE!=='browser-capability-v1')return fail('PUBLIC_DEPLOYMENT_UNCONFIGURED',503);
 if(Date.now()>=expires)return fail('PLAY_WINDOW_CLOSED',410);
 const url=new URL(request.url),path=url.pathname;
 if(!/^\/api\/(?:health|bootstrap|usage|sessions(?:\/[a-f0-9-]{36}(?:\/(?:action|checkpoint|events|media\/workshop-annex-[12](?:\/(?:status|prepare))?))?)?)$/.test(path)||url.search&&!/^\?after=\d{1,12}$/.test(url.search))return fail('NOT_FOUND',404);
 if(!['GET','POST'].includes(request.method))return fail('METHOD_NOT_ALLOWED',405);
 if(request.headers.get('Origin')&&request.headers.get('Origin')!==origin||request.headers.get('Sec-Fetch-Site')==='cross-site')return fail('ORIGIN_FORBIDDEN',403);
 if(request.method==='POST'&&(request.headers.get('Origin')!==origin||!request.headers.get('Content-Type')?.startsWith('application/json')))return fail('INVALID_WRITE_ORIGIN',403);
 const name='__Secure-harbor-'+base.slice(1),cookies=(request.headers.get('Cookie')??'').split(';').map(x=>x.trim()).filter(x=>x.startsWith(name+'='));
 let owner=path==='/api/health'?'0'.repeat(64):null,setCookie;
 if(cookies.length===1){const [id,signature,...extra]=cookies[0].slice(name.length+1).split('.');if(!extra.length&&/^[a-f0-9]{64}$/.test(id??'')&&/^[a-f0-9]{64}$/.test(signature??'')&&equal(signature,await mac(token,'harbor-v1:'+base+':'+id)))owner=id;}
 if(!owner){if(path!=='/api/bootstrap'||request.method!=='POST')return fail('PLAYER_SESSION_REQUIRED',401);owner=hex(crypto.getRandomValues(new Uint8Array(32)));setCookie=name+'='+owner+'.'+await mac(token,'harbor-v1:'+base+':'+owner)+'; Path='+base+'/; Secure; HttpOnly; SameSite=Strict; Max-Age='+Math.min(31536000,Math.floor((expires-Date.now())/1000));}
 let body;
 if(request.method==='POST'){
  if(Number(request.headers.get('Content-Length'))>1500000)return fail('BODY_TOO_LARGE',413);
  const reader=request.body?.getReader();if(!reader)return fail('INVALID_JSON',400);const chunks=[];let size=0;
  try{while(true){const x=await reader.read();if(x.done)break;size+=x.value.byteLength;if(size>1500000){await reader.cancel();return fail('BODY_TOO_LARGE',413)}chunks.push(x.value)}}finally{reader.releaseLock()}
  body=new Uint8Array(size);let offset=0;for(const c of chunks){body.set(c,offset);offset+=c.length}
 }
 const headers=new Headers({'X-Harbor-Edge':token,'X-Harbor-Owner':owner,'Origin':origin,'X-Harbor-Game':base.slice(1)});if(body)headers.set('Content-Type','application/json');
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),120000);
 try{const r=await fetch(upstream+base+path+url.search,{method:request.method,headers,body,redirect:'manual',signal:controller.signal});if(r.status>=300&&r.status<400)return fail('UPSTREAM_REDIRECT_REFUSED',502);const out=new Headers({'Content-Type':r.headers.get('Content-Type')??'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});if(setCookie&&r.ok)out.set('Set-Cookie',setCookie);return new Response(r.body,{status:r.status,headers:out})}catch{return fail('SERVICE_UNAVAILABLE',503)}finally{clearTimeout(timer)}
}
