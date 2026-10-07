import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {readFileSync,existsSync,mkdirSync,writeFileSync} from 'node:fs';
import {resolve,extname} from 'node:path';
import {randomUUID} from 'node:crypto';
import {Readable} from 'node:stream';
import {initial,type Save} from '../src/story/state';
import {people,rooms} from '../src/world/data';
import {createRuntime} from '../server/runtime';
import {createHarborLife} from '../server/life-assembly';
import {createApiHandler} from '../server/http';
import {knownPeople} from '../src/story/relationships';
// @ts-expect-error existing local authority fixture.
import {AsyncSessionAuthority,openAsyncSqliteAuthorityStore} from '../vendor/dynamic-runtime/packages/authority-session/async.mjs';

const dist=resolve(process.env.QA_DIST??'dist');
const stage=process.env.QA_STAGE??'after',out=resolve('../evidence',process.env.QA_OUTPUT??'vertical-avatars');mkdirSync(out,{recursive:true});
const allIds=Object.keys(people);assert.equal(allIds.length,22);const ids=process.env.QA_PERSON_SET?.split(',')??allIds;assert.ok(ids.every(id=>allIds.includes(id)));assert.deepEqual(knownPeople(initial('en','initial')),[]);
const report:any={stage,scope:'Actual fixed-build Main/View/RPGJS; original HTTP handler and isolated synthetic SQLite. No production identity/save/listener/external network.',cases:[],errors:[],missingAssets:[],blockedExternal:[],actions:[],modelCalls:0,mediaPosts:0,realPhone:false,miniApp:false};
const assembly=createHarborLife(createRuntime(async()=>{report.modelCalls++;throw Error('QA_MODEL_FORBIDDEN')})),runtime=assembly.runtime;
const mime:Record<string,string>={'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.json':'application/json','.woff2':'font/woff2','.ttf':'font/ttf','.mp3':'audio/mpeg','.svg':'image/svg+xml','.tmx':'application/xml'};
const browser=await chromium.launch({headless:true,executablePath:'/Users/yin/Library/Caches/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-mac-arm64/chrome-headless-shell',args:['--use-angle=swiftshader']});
async function imageData(img:any){await img.decode();const s=getComputedStyle(img),r=img.getBoundingClientRect();return {src:new URL(img.src).pathname,natural:[img.naturalWidth,img.naturalHeight],box:[r.width,r.height],fit:s.objectFit,frame:img.parentElement.className,frameRect:[img.parentElement.clientWidth,img.parentElement.clientHeight],style:img.getAttribute('style')};}
async function screenshotList(page:any,label:string){const body=page.locator('.harbor-panel__body');const metrics=await body.evaluate((e:any)=>({height:e.clientHeight,total:e.scrollHeight}));await page.screenshot({path:out+'/'+label+'-list.png'});return {screenshots:1,...metrics};}
try{
 for(const width of [320,390])for(const locale of process.env.QA_LOCALES?.split(',')??(stage==='before'?['zh']:['zh','en'])){
  const label=width+'-'+locale,context=await browser.newContext({viewport:{width,height:width===320?568:844},locale:locale==='zh'?'zh-CN':'en-US'});
  const owner='synthetic-'+randomUUID(),store=openAsyncSqliteAuthorityStore({path:':memory:',worldId:'avatar-ui-only',gameId:'avatar-ui-only'});
  const seed:Save={...initial(locale as any,randomUUID()),scene:'station',position:rooms.station.spawn,flags:['key','unpacked','bag-returned'],known:ids,items:{key:1},visited:['station','home'],history:[]};runtime.assertReadable(seed);
  const authority=new AsyncSessionAuthority(store,{...runtime,initial:(l:any,id:string)=>({...seed,id,locale:l})});let activeId:string|undefined;
  const api=createApiHandler({authority,lifeProject:assembly.lifeProject,landProject:assembly.landProject,usage:{status:async()=>({resetAt:0,dialogue:{remaining:0,maximum:0,retryAt:null,pending:0}})},noteMedia:{}});
  await context.route('**/*',async route=>{
   const req0=route.request(),url=new URL(req0.url());if(url.hostname!=='127.0.0.1'){report.blockedExternal.push(url.href);return route.abort();}
   if(url.pathname.includes('/api/')){
    const endpoint=url.pathname.slice(url.pathname.indexOf('/api/'));if(endpoint==='/api/bootstrap')return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({mode:'local-synthetic-owner-qa'})});
    if(endpoint.endsWith('/action'))report.actions.push(req0.postDataJSON());
    const raw=req0.postData(),req:any=Readable.from(raw?[Buffer.from(raw)]:[]);req.url=endpoint+url.search;req.method=req0.method();req.headers=req0.headers();let status=200,headers:any={},body=Buffer.alloc(0);const res:any={writeHead:(s:number,h:any)=>{status=s;headers=h??{}},end:(b:any)=>{body=Buffer.from(b??'')}};
    try{await api(req,res,owner);}catch(e:any){status=400;body=Buffer.from(JSON.stringify({error:e.code??e.message,terminal:true}));}
    if(endpoint==='/api/sessions'&&req.method==='POST'&&status<300){const result=JSON.parse(body.toString());activeId=result.id??result.save?.id??result.session?.id;}
    return route.fulfill({status,headers,body});
   }
   const file=resolve(dist,'.'+(url.pathname==='/'?'/index.html':decodeURIComponent(url.pathname)));if(!file.startsWith(dist+'/')||!existsSync(file)){report.missingAssets.push(url.pathname);return route.fulfill({status:404,body:'Missing local asset'});}return route.fulfill({status:200,contentType:mime[extname(file)]??'application/octet-stream',body:readFileSync(file)});
  });
  const page=await context.newPage();page.on('pageerror',e=>report.errors.push(String(e)));await page.goto('http://127.0.0.1:5492/?debug=1');await page.waitForFunction(()=>!!(document.querySelector('#rpg') as any)?.__rpgClient?.getCurrentPlayer()&&!document.querySelector('.harbor-loading'));
  for(let i=0;i<3;i++)await page.locator('.harbor-opening button').click();await page.waitForTimeout(350);
  await page.getByRole('button',{name:locale==='zh'?'菜单':'Menu',exact:true}).click();await page.getByRole('button',{name:locale==='zh'?'人物关系':'People & stories',exact:true}).click();await page.locator('.harbor-rel__person').first().waitFor();assert.equal(await page.locator('.harbor-rel__person').count(),ids.length);assert.ok(activeId,'real local HTTP create returned session id');
  const before=await authority.get(owner,activeId!);const actorBefore=await page.evaluate(()=>{const p=(document.querySelector('#rpg') as any).__rpgClient.getCurrentPlayer();return {x:p.x(),y:p.y()};});await page.locator('.harbor-rel__person img').evaluateAll(async imgs=>{await Promise.all(imgs.map((img:any)=>img.decode()));});await page.evaluate(()=>new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve()))));const list=await screenshotList(page,label);const images=[];
  for(const id of ids){const name=people[id].name[locale==='zh'?0:1],row=page.locator('.harbor-rel__person').filter({has:page.getByText(name,{exact:true})});const img=await row.locator('img').evaluate(imageData);images.push({id,...img});if(width===390&&locale==='zh')await row.locator('.harbor-person-avatar').screenshot({path:out+'/crop-'+id+'.png'});if(stage==='after'){assert.equal(img.src,'/art/people-avatars/'+id+'.png');assert.deepEqual(img.natural,[256,256]);assert.deepEqual(img.frameRect,[width===320?64:72,width===320?80:90]);}}
  const details=[];if(stage==='after'&&process.env.QA_LIST_ONLY!=='1')for(const id of ids){const name=people[id].name[locale==='zh'?0:1],row=page.locator('.harbor-rel__person').filter({has:page.getByText(name,{exact:true})});await row.scrollIntoViewIfNeeded();await row.click();await page.locator('.harbor-rel__identity').waitFor();const img=await page.locator('.harbor-rel__identity img').evaluate(imageData);assert.equal(img.src,'/art/people-avatars/'+id+'.png');assert.deepEqual(img.natural,[256,256]);assert.deepEqual(img.frameRect,[width===320?64:72,width===320?80:90]);assert.equal(img.style,images.find(p=>p.id===id)!.style);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);if(width===390&&locale==='zh'&&['dani','rowan','mara','arthur'].includes(id))await page.screenshot({path:out+'/'+label+'-detail-'+id+'.png'});
   const button=page.getByRole('button',{name:locale==='zh'?'放大人物肖像':'Enlarge portrait',exact:true});await button.click();const large=await page.locator('.harbor-portrait-full img').evaluate(imageData);assert.equal(large.src,'/art/'+people[id].art+'-root-v2.png');await page.getByRole('button',{name:locale==='zh'?'关闭放大图':'Close enlarged portrait',exact:true}).click();details.push({id,...img,largeOriginal:large.src});await page.getByRole('button',{name:locale==='zh'?'返回列表':'Back to list',exact:true}).click();}
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);assert.deepEqual(await authority.get(owner,activeId!),before,'browsing avatars/profile/enlarged portrait does not write save');await page.getByRole('button',{name:locale==='zh'?'关闭':'Close',exact:true}).click();await page.waitForTimeout(200);const actorAfter=await page.evaluate(()=>{const p=(document.querySelector('#rpg') as any).__rpgClient.getCurrentPlayer();return {x:p.x(),y:p.y()};});assert.deepEqual(actorAfter,actorBefore);report.cases.push({width,locale,list,images,details,unchangedSaveVersion:before.version,actorBefore,actorAfter});console.log('PASS',stage,label,images.length,details.length);await context.close();await store.close();
 }
 assert.equal(report.errors.length,0);assert.equal(report.missingAssets.length,0);assert.equal(report.actions.length,0);assert.equal(report.modelCalls,0);report.status='PASS';
}catch(e:any){report.status='FAIL';report.failure=e.stack;throw e;}finally{writeFileSync(out+'/'+(process.env.QA_REPORT??'report.json'),JSON.stringify(report,null,2)+'\n');await browser.close()}
