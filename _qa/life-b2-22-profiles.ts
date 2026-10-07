import {createLifePlantsB2,createPlantsRegistry,snapPeaV2Ref} from '../server/life-plants-b2';
import {pinLegacy} from '../src/life/save';
import {chromium, type Page} from 'playwright';
import assert from 'node:assert/strict';
import {readFileSync,existsSync,mkdirSync,writeFileSync} from 'node:fs';
import {resolve,extname} from 'node:path';
import {randomUUID} from 'node:crypto';
import {Readable} from 'node:stream';
import {initial,availableTopics, type Save} from '../src/story/state';
import {rooms,entityAt,people} from '../src/world/data';
import {createRuntime} from '../server/runtime';
import {createApiHandler} from '../server/http';
import {techNomad,nomadSchedule} from '../src/world/tech-nomads';
import {residentHere} from '../src/world/residents';
import {npcSheets} from '../src/world/sheets';
import {findPath} from '../src/engine/world';
import {dynamicWorld} from '../src/dynamic-assets/layout';
// @ts-expect-error frozen authority: isolated SQLite, never a production session.
import {AsyncSessionAuthority,openAsyncSqliteAuthorityStore} from '../vendor/dynamic-runtime/packages/authority-session/async.mjs';

const person=process.env.QA_PERSON??'harper',role=techNomad(person)!;assert.ok(role);assert.equal(npcSheets.length,22);
const completeMinute=({harper:850,tess:600,noor:1080} as Record<string,number>)[person];
const initialScene=nomadSchedule(person,{townMinutes:completeMinute})!.scene!;
const out=resolve('../evidence',process.env.QA_OUTPUT??'owner-ui');mkdirSync(out,{recursive:true});
const report:any={scope:'Actual local fixed-build Main/View/RPGJS and HTTP handler with isolated SQLite authority; synthetic legacy seed only. B2 fixed host active and initial synthetic @2 bed retained. English profile/story integration; no identity injection, listener, external network, production save or deployment.',cases:[],errors:[],missingAssets:[],blockedExternal:[],modelCalls:0,mediaPosts:0,realPhone:false,miniApp:false,configuredResidents:22,admittedResidents:22};
const b2=createLifePlantsB2(createRuntime(async()=>{report.modelCalls++;throw Error('QA_MODEL_FORBIDDEN')}));const runtime=b2.runtime;
const browser=await chromium.launch({headless:true,executablePath:'/Users/yin/Library/Caches/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-mac-arm64/chrome-headless-shell',args:['--use-angle=swiftshader']});
const mime:Record<string,string>={'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.jpg':'image/jpeg','.json':'application/json','.woff2':'font/woff2','.ttf':'font/ttf','.mp3':'audio/mpeg','.svg':'image/svg+xml','.tmx':'application/xml','.txt':'text/plain'};
const mapOnly=process.env.QA_MAP_SCENES==='1';
const variants=(mapOnly?role.routes.flatMap((r)=>([320,390] as const).map(width=>({width,height:width===320?568:844,locale:'en' as const,scene:r.scene,minute:role.schedule.find(s=>s.scene===r.scene)!.start+60}))):([320,390] as const).flatMap(width=>(['en','zh'] as const).map(locale=>({width,height:width===320?568:844,locale,scene:initialScene,minute:completeMinute})))).filter(v=>v.locale==='en').slice(Number(process.env.QA_CASE_SKIP??0),Number(process.env.QA_CASE_SKIP??0)+Number(process.env.QA_CASE_LIMIT??(mapOnly?6:4)));
async function settled(page:Page){await page.waitForFunction(()=>!!(document.querySelector('#rpg') as any)?.__rpgClient?.getCurrentPlayer()&&!document.querySelector('.harbor-loading'));}
async function drain(page:Page){await page.waitForFunction(()=>!document.querySelector('.harbor-panel p[role="status"]'));for(let i=0;i<15;i++){const next=page.locator('.harbor-reply button');if(!await next.count())return;await next.click();await page.waitForTimeout(70);}throw Error('REPLY_NEVER_FINISHED');}
async function close(page:Page,locale:string){const button=page.getByRole('button',{name:locale==='en'?'Close':'关闭',exact:true});if(await button.count())await button.click();}
async function meet(page:Page,id:string,snapshot?:string){
 // Person/item markers have pointer-events:none by the existing contract.
 // Reach the actual entity with normal keyboard movement, then use Interact.
 const current=await page.evaluate(()=>{const c=(document.querySelector('#rpg') as any).__rpgClient;return {scene:c.activeRoom().name.replace(/^map-/,''),x:c.getCurrentPlayer().x(),y:c.getCurrentPlayer().y()}});
 const at=await page.evaluate(id=>{const c=(document.querySelector('#rpg') as any).__rpgClient,e=c.sceneMap.events()['person-'+id];return e?{x:e.x(),y:e.y()}:null},id);
 const entity=entityAt(current.scene,id)!;assert.ok(entity,'entity registered');
 const destination=at?{x:at.x-8,y:at.y+8}:entity.approach;
 for(let attempt=0;attempt<8;attempt++){
  const now=await page.evaluate(()=>{const c=(document.querySelector('#rpg') as any).__rpgClient;return {x:c.getCurrentPlayer().x(),y:c.getCurrentPlayer().y()}});
  if(Math.hypot(now.x-destination.x,now.y-destination.y)<5)break;
  const bodies=await page.evaluate(()=>{const c=(document.querySelector('#rpg') as any).__rpgClient;return Object.entries(c.sceneMap.events()).filter(([id,v]:any)=>id.startsWith('person-')&&v.graphics().length>0).map(([,v]:any)=>({x:v.x()-9,y:v.y()-8,w:18,h:8}))});
  const base=dynamicWorld(['key','unpacked','bag-returned'],false),collision={...base,scenes:{...base.scenes,[current.scene]:{...base.scenes[current.scene],obstacles:[...base.scenes[current.scene].obstacles,...bodies]}}};
  const route=findPath(collision,current.scene,now,destination);assert.ok(route.length,'normal reachable path around actual NPC bodies');
  let stalled=false;
  for(const point of route){
   let previous=now,stationary=0;
   for(let n=0;n<40;n++){
    const p=await page.evaluate(()=>{const c=(document.querySelector('#rpg') as any).__rpgClient;return {x:c.getCurrentPlayer().x(),y:c.getCurrentPlayer().y()}});
    const dx=point.x-p.x,dy=point.y-p.y;if(Math.hypot(dx,dy)<5)break;
    stationary=Math.hypot(previous.x-p.x,previous.y-p.y)<.1?stationary+1:0;previous=p;
    if(stationary>6){stalled=true;break;}
    const key=Math.abs(dx)>Math.abs(dy)?(dx>0?'ArrowRight':'ArrowLeft'):(dy>0?'ArrowDown':'ArrowUp');
    await page.keyboard.down(key);await page.waitForTimeout(45);await page.keyboard.up(key);
   }
   if(stalled)break;
  }
 }
 assert.equal(await page.locator(`[data-target="${id}"]`).getAttribute('data-near'),'true','entity reached through normal movement');
 if(people[id]){const label=await page.locator('.harbor-action span').innerText();assert.ok([...people[id].name,...people[id].unknown].includes(label),'normal Interact selects intended resident: '+id+' / '+label);}
 if(snapshot)await page.screenshot({path:snapshot});
 await page.locator('.harbor-action').click();await page.locator('.harbor-panel').waitFor();await page.waitForTimeout(100);await drain(page);
}
async function mapTravel(page:Page,id:string,locale:string){await close(page,locale);await page.getByRole('button',{name:locale==='en'?'Map':'地图',exact:true}).click();await page.locator('.harbor-map-tabs').getByRole('button',{name:rooms[rooms[id].area].title[locale==='zh'?0:1],exact:true}).click();await page.locator(`[data-place="${id}"]`).press('Enter');await page.getByRole('button',{name:locale==='en'?'Go here':'前往这里',exact:true}).click();await page.waitForFunction(id=>{const c=(document.querySelector('#rpg') as any)?.__rpgClient;return c?.activeRoom()?.name?.replace(/^map-/,'')===id&&!document.querySelector('.harbor-loading')},id);await settled(page);}
const inspect=(id:string)=>{
 const c=(document.querySelector('#rpg') as any).__rpgClient,e=c.sceneMap.events()['person-'+id];
 const events=Object.entries(c.sceneMap.events()).filter(([id])=>id.startsWith('person-')||id.startsWith('animal-')).map(([id,v]:any)=>({id,graphics:v.graphics(),x:typeof v.x==='function'?v.x():null,y:typeof v.y==='function'?v.y():null}));
 return {player:{x:c.getCurrentPlayer().x(),y:c.getCurrentPlayer().y()},resident:e?{x:typeof e.x==='function'?e.x():null,y:typeof e.y==='function'?e.y():null,pose:e.animationName?.(),direction:e.direction?.(),graphics:e.graphics()}:null,events,targets:[...document.querySelectorAll('[data-target]')].map(e=>e.getAttribute('data-target')),overflow:document.documentElement.scrollWidth>innerWidth+1};
};
try{
 for(const {width,height,locale,scene,minute} of variants){
  console.log('START',person,width,locale);
  const label=person+'-'+(mapOnly?scene+'-':'')+`${width}-${locale}`,context=await browser.newContext({viewport:{width,height},locale:locale==='en'?'en-US':'zh-CN'});
  const store=openAsyncSqliteAuthorityStore({path:out+'/'+label+'-'+randomUUID()+'.sqlite',worldId:'owner-nomads22-local',gameId:'owner-nomads22-local'}),owner='synthetic-'+randomUUID();
  let seed:any={...initial(locale,randomUUID()),scene,townMinutes:minute,position:entityAt(scene,person)!.approach,flags:['key','unpacked','bag-returned'],items:{key:1},known:['mara','mira'],relations:{mira:2},visited:Object.keys(rooms),history:[{id:'legacy-mira',kind:'talk',person:'mira',text:['先前在旧街相识。','An earlier meeting on Market Lane.']}]};
  seed=pinLegacy(seed,createPlantsRegistry());seed.landV1={schema:1,permissions:{'courtyard-common':{revision:1,sourceAction:'synthetic-permit',minute:540}},plots:[{id:'land-bed-1',region:'courtyard-common',geometryRevision:1,at:{x:288,y:604},sourceAction:'synthetic-bed',minute:540}]};seed.lifeV1.plots['life-bed-1']={ref:snapPeaV2Ref,grown:200,updatedAt:540,wetUntil:1260};
  runtime.assertReadable(seed);
  const authority=new AsyncSessionAuthority(store,{...runtime,initial:(l:any,id:string)=>({...seed,id,locale:l})});
  const created=await authority.create(owner,randomUUID(),locale),actions:any[]=[],checkpoints:any[]=[];
  const api=createApiHandler({authority,lifeProject:b2.lifeProject,landProject:b2.landProject,usage:{status:async()=>({resetAt:0,dialogue:{remaining:0,maximum:0,retryAt:null,pending:0}})},noteMedia:{}});
  const head=()=>authority.get(owner,created.id) as Promise<Save>;
  await context.route('**/*',async route=>{
   const url=new URL(route.request().url());if(url.hostname!=='127.0.0.1'){report.blockedExternal.push(url.href);return route.abort();}
   const path=url.pathname;
   if(path.includes('/api/')){
    const endpoint=path.slice(path.indexOf('/api/'));
    if(endpoint==='/api/bootstrap')return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({mode:'local-synthetic-owner-qa'})});
    const raw=route.request().postData();if(endpoint.endsWith('/action'))actions.push(route.request().postDataJSON());if(endpoint.endsWith('/checkpoint'))checkpoints.push(route.request().postDataJSON());
    const req:any=Readable.from(raw?[Buffer.from(raw)]:[]);req.url=endpoint+url.search;req.method=route.request().method();req.headers=route.request().headers();let status=200,headers:any={},body=Buffer.alloc(0);
    const res:any={writeHead:(s:number,h:any)=>{status=s;headers=h??{}},end:(v:any)=>{body=Buffer.from(v??'')}};
    try{await api(req,res,owner);}catch(e:any){status=400;body=Buffer.from(JSON.stringify({error:e.code??e.message,terminal:true}));}
    return route.fulfill({status,headers,body});
   }
   const file=resolve('dist','.'+(path==='/'?'/index.html':decodeURIComponent(path)));if(!file.startsWith(resolve('dist')+'/')||!existsSync(file)){report.missingAssets.push(path);return route.fulfill({status:404,body:'Missing fixture resource'});}
   return route.fulfill({status:200,contentType:mime[extname(file)]??'application/octet-stream',body:readFileSync(file)});
  });
  await context.addInitScript(()=>addEventListener('DOMContentLoaded',()=>{(window as any).alteruLocalStorage?.setItem('harbor-muted','1')}));
  const page=await context.newPage();page.on('pageerror',e=>report.errors.push(String(e)));
  try{
   await page.goto('http://127.0.0.1:5490/?debug=1');await settled(page);for(let i=0;i<3;i++)await page.locator('.harbor-opening button').click();await page.waitForTimeout(450);
   const garden=await page.evaluate(inspect,person);assert.ok(garden.resident?.graphics.includes('npc-'+person));for(const id of ['harper','tess','noor']){const present=residentHere({townMinutes:minute,flags:seed.flags},id,scene);assert.equal(garden.targets.includes(id),present);assert.equal(garden.events.some(e=>e.id==='person-'+id&&e.graphics.length>0),present);}assert.equal(garden.overflow,false);
   await page.screenshot({path:out+'/'+label+'-initial-map.png'});
   if(mapOnly){const expected=entityAt(scene,person)!.at;assert.ok(Math.abs(garden.resident!.x-expected.x)<=24);assert.equal(garden.resident!.y,expected.y);assert.equal(garden.resident!.pose,'stand');assert.equal((await head()).version,0);report.cases.push({person,width,height,locale,scene,minute,actualNPC: garden,readOnlyMapFixture:true,actions:actions.length});console.log('MAP PASS',label);continue;}
   await meet(page,person,out+'/'+label+'-near-npc.png');assert.ok((await head()).known.includes(person));
   const card=await page.locator('.harbor-portrait img').evaluate(async(img:any)=>{await img.decode();return {natural:[img.naturalWidth,img.naturalHeight],box:[img.width,img.height],fit:getComputedStyle(img).objectFit}});assert.deepEqual(card.natural,[512,512]);assert.deepEqual(card.box,[48,48]);assert.equal(card.fit,'contain');
   await page.screenshot({path:out+'/'+label+'-conversation-portrait.png'});
   await page.getByRole('button',{name:role.story.question[locale==='zh'?0:1],exact:true}).click();await drain(page);assert.ok((await head()).flags.includes(`talk:${person}:nomads-v1-start`));
   const partner=role.story.partner;
   const afterStart=await head(),partnerScene=Object.keys(rooms).find(scene=>residentHere(afterStart,partner,scene))!;
   if((await head()).scene!==partnerScene)await mapTravel(page,partnerScene,locale);else await close(page,locale);
   await meet(page,partner);
   if(role.story.partnerPrerequisite){await page.getByRole('button',{name:availableTopics(await head(),partner).find(t=>t.id==='life')!.label[locale==='zh'?0:1],exact:true}).click();await drain(page);}
   const consult=role.story;await page.getByRole('button',{name:consult.consultPrompt[locale==='zh'?0:1],exact:true}).click();await drain(page);assert.ok((await head()).flags.includes(`talk:${partner}:nomads-v1-${person}-consult`));
   const currentHead=await head(),backScene=Object.keys(rooms).find(scene=>residentHere(currentHead,person,scene))!;
   if(currentHead.scene!==backScene)await mapTravel(page,backScene,locale);else await close(page,locale);
   await meet(page,person);const before=await head();const choice=consult.choices[Number(process.env.QA_CHOICE_INDEX??(locale==='zh'?1:0))];await page.getByRole('button',{name:choice.label[locale==='zh'?0:1],exact:true}).click();await drain(page);const completed=await head();assert.equal(completed.techNomadsV1!.stories[person].choice,choice.id);assert.equal(completed.relations[person],1);assert.equal(completed.relations[partner],1);for(const key of ['cash','items','plots','animalsV1'] as const)assert.deepEqual(completed[key],before[key]);
   await page.screenshot({path:out+'/'+label+'-choice-saved.png'});await close(page,locale);
   await page.getByRole('button',{name:locale==='en'?'Menu':'菜单',exact:true}).click();await page.getByRole('button',{name:locale==='en'?'People & stories':'人物关系',exact:true}).click();
   const beforeProfile=await head(),actionCount=actions.length;const avatar=await page.locator('.harbor-rel__person').filter({hasText:role.name[locale==='zh'?0:1]}).locator('img').evaluate(async(img:any)=>{await img.decode();return {natural:[img.naturalWidth,img.naturalHeight],fit:getComputedStyle(img).objectFit}});assert.deepEqual(avatar.natural,[256,256]);assert.equal(avatar.fit,'contain');
   await page.screenshot({path:out+'/'+label+'-people-list.png'});await page.getByRole('button',{name:role.name[locale==='zh'?0:1]}).click();const profile=await page.locator('.harbor-rel__identity img').evaluate(async(img:any)=>{await img.decode();return {natural:[img.naturalWidth,img.naturalHeight],box:[img.width,img.height],fit:getComputedStyle(img).objectFit}});assert.deepEqual(profile.natural,[512,512]);assert.equal(profile.box[0],profile.box[1]);assert.equal(profile.fit,'contain');
   await page.screenshot({path:out+'/'+label+'-profile.png'});await page.getByRole('button',{name:locale==='en'?'Enlarge portrait':'放大人物肖像',exact:true}).click();await page.locator('.harbor-portrait-full img').waitFor();await page.screenshot({path:out+'/'+label+'-profile-enlarged.png'});await page.getByRole('button',{name:locale==='en'?'Close enlarged portrait':'关闭放大图',exact:true}).click();
   await page.getByRole('button',{name:/Read conversations|查看谈话记录/}).click();await page.screenshot({path:out+'/'+label+'-profile-history.png'});assert.equal(actions.length,actionCount);const afterProfile=await head();assert.equal(afterProfile.version,beforeProfile.version);assert.deepEqual(afterProfile.techNomadsV1,beforeProfile.techNomadsV1);
   assert.deepEqual(afterProfile.landV1,seed.landV1);assert.deepEqual((afterProfile as any).lifeV1.plots['life-bed-1'].ref,snapPeaV2Ref);report.cases.push({person,width,height,locale,card,avatar,profile,storyCompleted:true,profileReadHeadVersionUnchanged:true,landAndCropPinned:true,actions,final:{version:afterProfile.version,memory:afterProfile.techNomadsV1}});console.log('PROFILE PASS',label);continue;
   await mapTravel(page,'home',locale);await meet(page,'bed');
   if(person==='noor'){await page.getByRole('button',{name:locale==='en'?'Sleep until 9 in the morning':'睡到早上九点',exact:true}).click();await drain(page);}
   else for(let n=0;n<(person==='tess'?2:1);n++){await page.getByRole('button',{name:locale==='en'?'Nap for three hours':'小睡三小时',exact:true}).click();await drain(page);}
   await close(page,locale);const laterScene=nomadSchedule(person,await head())!.scene!;await mapTravel(page,laterScene,locale);
   const coast=await page.evaluate(inspect,person);assert.ok(coast.resident?.graphics.includes('npc-'+person));await meet(page,person,out+'/'+label+'-revisit-near-npc.png');await page.getByRole('button',{name:locale==='en'?'Has that choice stayed with you?':'后来，你还记得那次选择吗？',exact:true}).click();await drain(page);
   const recalled=await head();assert.ok(recalled.techNomadsV1!.stories[person].recalledAt);assert.equal(recalled.relations[person],1);assert.equal(recalled.relations[partner],1);assert.ok(!await page.getByRole('button',{name:locale==='en'?'Has that choice stayed with you?':'后来，你还记得那次选择吗？',exact:true}).count());await page.screenshot({path:out+'/'+label+'-revisit.png'});
   await page.reload();await settled(page);const reloaded=await head();assert.deepEqual(reloaded.techNomadsV1,recalled.techNomadsV1);assert.deepEqual(reloaded.history,recalled.history);
   console.log('PASS',label);
   report.cases.push({person,width,height,locale,garden,coast,card,avatar,profile,storyCompleted:true,actualRevisit:true,reloadPreservesStory:true,actions,checkpoints,final:{version:reloaded.version,minute:reloaded.townMinutes,relations:reloaded.relations,memory:reloaded.techNomadsV1}});
  }catch(error){report.failure={label,actualScene:await page.evaluate(inspect,person),error:String(error),body:(await page.locator('body').innerText()).slice(-2500),head:await head()};await page.screenshot({path:out+'/'+label+'-failure.png'});throw error;}
  finally{await context.close();await store.close();}
 }
 assert.deepEqual(report.errors,[]);assert.deepEqual(report.missingAssets,[]);assert.equal(report.modelCalls,0);
}finally{writeFileSync(out+'/report.json',JSON.stringify(report,null,2)+'\n');await browser.close();}
console.log(JSON.stringify({ownerUICases:report.cases.length,modelCalls:report.modelCalls,mediaPosts:0,realMiniApp:false,report:out+'/report.json'}));
