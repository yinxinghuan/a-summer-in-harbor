import {chromium} from 'playwright';
import {readFileSync,existsSync,mkdirSync,writeFileSync} from 'node:fs';
import {resolve,extname} from 'node:path';
import {Readable} from 'node:stream';
import {execFileSync} from 'node:child_process';
import {randomUUID,createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {pinLegacy,addLot} from '../src/life/save';
import {createPlantsRegistry,snapPeaV2Ref} from '../server/life-plants-b2';
import {sampleAnimal} from '../server/animal-life';
import {walkable} from '../src/engine/world';
import {world} from '../src/world/data';
import {initial,applyAction} from '../src/story/state';
import {rooms,entityAt} from '../src/world/data';
import {createRuntime} from '../server/runtime';
import {withBasilPlantUses} from '../server/plant-basil';
import {createExplorationAssembly} from '../server/exploration-assembly';
import {createMovingClock} from '../server/candidate-clock';
import {withCompactMotion} from '../server/candidate-motion-authority';
import {createActivePlayClock,withActivePlayRuntime} from '../server/active-play-clock';
import {withActivePlayAuthority} from '../server/active-play-authority';
import {createApiHandler} from '../server/http';
// @ts-expect-error frozen authority
import {AsyncSessionAuthority,openAsyncSqliteAuthorityStore} from '../vendor/dynamic-runtime/packages/authority-session/async.mjs';
const diskGuard=()=>{const row=execFileSync('df',['-k','.'],{encoding:'utf8'}).trim().split('\n').at(-1)!.trim().split(/\s+/);if(Number(row[3])<15728640)throw Error('15GIB_DISK_FLOOR')};diskGuard();
const out=resolve(process.env.QA_DYNAMIC_OUT??'../evidence/owner-basil-boundary-ui-final'),dist=resolve('dist'),publicRoot=resolve('public');mkdirSync(out,{recursive:true});
const mime:any={'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.json':'application/json','.svg':'image/svg+xml','.tmx':'application/xml','.tsx':'application/xml','.woff2':'font/woff2','.ttf':'font/ttf','.mp3':'audio/mpeg'};
const report:any={scope:'LOCAL candidate real compiled Main/View/RPGJS + isolated SQLite, all external network blocked; synthetic players; no model/media/production/publishing.',rate:4000,rateStatus:'configurable local experiment, not user-selected speed',cases:[],errors:[],blocked:[],modelCalls:0,bundle:readFileSync(resolve(dist,'index.html'),'utf8').match(/src="([^"]+index-[^"]+\.js)"/)?.[1]};
const browser=await chromium.launch({headless:true,executablePath:'/Users/yin/Library/Caches/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-mac-arm64/chrome-headless-shell',args:['--use-angle=swiftshader']});
try{for(const name of (process.env.QA_ACTIVE_CASES??'320-basil,390-basil').split(',')){
 const width=Number(name.split('-')[0]),height=width===320?568:844,kind=name.split('-')[1],locale=width===320?'zh':'en',owner='synthetic-'+randomUUID();let releaseLife:(()=>void)|undefined,holdNextLife=false,held=false;const registry=createPlantsRegistry();
 const store=openAsyncSqliteAuthorityStore({path:':memory:',worldId:randomUUID(),gameId:'active-browser',environment:'test'});
 let accepted:any={...initial(locale,randomUUID()),scene:'cafe',position:entityAt('cafe','theo')!.approach,known:['theo'],flags:['key','unpacked'],visited:Object.keys(rooms),items:{'crop-basil':3}};
 const pre=createExplorationAssembly({decorateLife:(r:any)=>withBasilPlantUses(r)});for(const v of ['read-offer','accept-basil'])accepted=(await pre.runtime.prepare(accepted,{action_id:randomUUID(),expected_version:accepted.version,scene:'cafe',position:accepted.position,target:'theo',action:'plant-use:'+v})).head;
 const assembly=createExplorationAssembly({decorateLife:(r:any)=>withBasilPlantUses(r),resolveDialogue:async()=>{report.modelCalls++;throw Error('QA_MODEL_CLOSED')},initial:(l:any,id:string)=>{
  if(kind==='basil')return {...accepted,id,version:0,cursor:0,history:[],townMinutes:3899};
  if(kind==='animal'){
   const s={...initial(locale,id),scene:'station',townMinutes:540,flags:['key','unpacked'],known:['mara'],visited:Object.keys(rooms)};
   for(let y=540;y<770;y+=4)for(let x=640;x<900;x+=4){const position={x,y};if(!walkable(world,s.scene,position))continue;try{const v=sampleAnimal(s,'harbor-cat-1',position),d=Math.hypot(position.x+8-v.frame.foot.x,position.y+6-v.frame.foot.y);if(d>=40&&d<=48)return {...s,position}}catch{}}
   throw Error('NO_OBSERVATION_FIXTURE');
  }
  const s=pinLegacy({...initial(locale,id),scene:kind==='shop'?'grocery':'courtyard',position:kind==='shop'?entityAt('grocery','crop-counter')!.approach:{x:280,y:622},townMinutes:3899,known:['theo'],flags:['key','unpacked','garden-agreed','alternative-route'],visited:Object.keys(rooms),landV1:{schema:1,permissions:{'courtyard-common':{revision:1,sourceAction:'fixture-permission',minute:540}},plots:[{id:'land-bed-1',region:'courtyard-common',geometryRevision:1,at:{x:288,y:604},minute:540,sourceAction:'fixture-bed-12345'}]}},registry);
  s.lifeV1!.plots['life-bed-1']={ref:snapPeaV2Ref,grown:719,updatedAt:3899,wetUntil:4619};s.lifeV1!.order={id:'fixture-order-1234',definition:'theo-peas-v1',crop:snapPeaV2Ref,quantity:2,reward:10,acceptedMinute:540,dueMinute:3900};addLot(s,registry,snapPeaV2Ref,'produce',2,'fixture-produce');return s;
 }}),runtime=assembly.runtime;
 const authority=assembly.decorateAuthority(new AsyncSessionAuthority(store,runtime),store),seed=await authority.create(owner,randomUUID(),'en'),head=()=>authority.get(owner,seed.id),api=createApiHandler({authority,lifeProject:assembly.lifeProject,landProject:assembly.landProject,usage:{status:async()=>({resetAt:0,dialogue:{remaining:0,maximum:0,retryAt:null,pending:0}})}});
 const actions:any[]=[],responses:any[]=[],rejected:any[]=[];let lose=false,offline=false;
 const context=await browser.newContext({viewport:{width,height},locale:locale==='zh'?'zh-CN':'en-US'});
 await context.route('**/*',async route=>{const req=route.request(),url=new URL(req.url());if(url.hostname!=='127.0.0.1'){report.blocked.push(url.origin+url.pathname);return route.abort()}
  if(url.pathname.includes('/api/')){
   const endpoint=url.pathname.slice(url.pathname.indexOf('/api/'));if(endpoint==='/api/bootstrap')return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({mode:'local-authoring-test'})});
   const data=req.postData();if(data)actions.push({endpoint,...req.postDataJSON()});if(offline&&endpoint.endsWith('/active-play'))return route.abort();
   const request:any=Readable.from(data?[Buffer.from(data)]:[]);request.url=endpoint+url.search;request.method=req.method();request.headers=req.headers();let status=200,headers:any={},body=Buffer.alloc(0);const response:any={writeHead:(s:number,h:any)=>{status=s;headers=h},end:(v:any)=>body=Buffer.from(v??'')};
   try{await api(request,response,owner)}catch(e:any){status=400;body=Buffer.from(JSON.stringify({error:e.code??e.message,terminal:true}))}const ack=endpoint.endsWith('/active-play')&&status===200?JSON.parse(body.toString()):undefined;responses.push({endpoint,status,bytes:body.length,action:req.postDataJSON()?.action,actionId:ack?.actionId,minute:ack?.fields?.townMinutes,ackSha:ack?createHash('sha256').update(body).digest('hex'):undefined});if(status>=400)rejected.push({endpoint,status,body:JSON.parse(body.toString())});
   if(lose&&endpoint.endsWith('/active-play')&&req.postDataJSON().action==='candidate-active-tick'){lose=false;return route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'SERVICE_UNAVAILABLE',terminal:false})})}
   if(endpoint.endsWith('/life')&&holdNextLife){holdNextLife=false;held=true;await new Promise<void>(r=>releaseLife=r)}
   return route.fulfill({status,headers,body});
  }
  const rel='.'+(url.pathname==='/'?'/index.html':decodeURIComponent(url.pathname));let file=resolve(dist,rel);if(!file.startsWith(dist+'/'))return route.fulfill({status:404,body:'Missing'});if(!existsSync(file)){file=resolve(publicRoot,rel);if(!file.startsWith(publicRoot+'/')||!existsSync(file))return route.fulfill({status:404,body:'Missing'})}return route.fulfill({status:200,contentType:mime[extname(file)]??'application/octet-stream',body:readFileSync(file)});
 });
 await context.addInitScript((id:string)=>{(window as any).__name=(f:any)=>f;addEventListener('DOMContentLoaded',()=>{window.alteruLocalStorage?.setItem('harbor-muted','1');window.alteruLocalStorage?.setItem('harbor-opening:'+id,'3')})},seed.id);

 const page=await context.newPage();page.setDefaultTimeout(20000);page.on('pageerror',e=>report.errors.push({name,error:String(e)}));
 const ready=()=>page.waitForFunction(()=>!!(document.querySelector('#rpg') as any)?.__rpgClient?.getCurrentPlayer()&&!document.querySelector('.harbor-loading'),undefined,{timeout:20000});
 await page.goto('http://127.0.0.1:5498/?debug=1');await ready();await page.addStyleTag({content:'#alteru-guest-banner{display:none!important}'});
 const result:any={name,width,height,kind,locale};
 const close=()=>page.getByRole('button',{name:locale==='zh'?'关闭':'Close',exact:true}).click();
 try{
  await page.waitForTimeout(700);assert.equal((await head()).townMinutes,3899);holdNextLife=true;
  for(let i=0;i<70&&!held;i++)await page.waitForTimeout(100);assert.ok(held);assert.equal((await head()).townMinutes,3900);
  await page.getByRole('button',{name:locale==='zh'?'行囊':'Bag',exact:true}).click();await page.locator('[data-plant-use-bag]').waitFor();
  const cancel=page.getByRole('button',{name:locale==='zh'?'关闭罗勒订单 · 保留产物':'Close basil order · keep produce',exact:true});await cancel.waitFor();assert.equal(await cancel.isDisabled(),true);
  await page.screenshot({path:out+'/'+name+'-stale-order-disabled.png'});releaseLife!();await cancel.isEnabled().then(async enabled=>{if(!enabled)await page.waitForFunction(()=>Array.from(document.querySelectorAll('[data-plant-use-bag] button')).some((b:any)=>!b.disabled))});
  const before=await head();await cancel.click();await page.waitForFunction(()=>!document.querySelector('[data-plant-use-bag] article'));const after=await head();assert.deepEqual(after.items,before.items);assert.equal(after.cash,before.cash);assert.equal(after.townMinutes,before.townMinutes);assert.equal(after.lifeV1.cooldownUntil,6780);assert.equal(after.plantUsesV1.order,undefined);
  await page.reload();await ready();assert.equal((await head()).plantUsesV1.order,undefined);result.order={naturalExpiry:true,oldDtoKept:true,staleCloseDisabled:true,freshReadEnables:true,actualCloseOnceKeepsGoodsCashMinute:true,reload:true};
  await page.screenshot({path:out+'/'+name+'-final.png'});report.cases.push(result);console.log('PASS',JSON.stringify(result));
 }catch(error){releaseLife?.();await page.screenshot({path:out+'/'+name+'-FAIL.png'});console.log('DIAGNOSTIC',name,JSON.stringify({error:String(error),head:await head(),rejected,body:await page.locator('body').innerText()}));throw error}
 finally{await context.close();store.close()}
}}finally{writeFileSync(out+'/renderer-report.json',JSON.stringify(report,null,2)+'\n');await browser.close()}
assert.equal(report.errors.length,0);assert.equal(report.modelCalls,0);
