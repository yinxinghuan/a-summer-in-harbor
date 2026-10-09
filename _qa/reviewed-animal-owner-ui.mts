// @ts-nocheck -- real compiled Main/View; isolated SQLite fixtures, read-only NPC offers/pages.
import {chromium} from 'playwright';
import {makeDemoServer} from './temporary-account-server';
import {createExplorationAssembly} from '../server/exploration-assembly';
import {createReviewedAnimalLife} from '../server/reviewed-animal-life';
import {withBasilPlantUses} from '../server/plant-basil';
import {withWildMint} from '../server/wild-mint';
import {initial} from '../src/story/state';
import {rooms} from '../src/world/data';
import {pinLegacy} from '../src/life/save';
import {createPlantsRegistry} from '../server/life-plants-b2';
import pack from '../server/content/reviewed-evening-gull-watch.json';
import {GAME_UUID} from '../src/game-id';
import {readFileSync,existsSync,mkdtempSync} from 'node:fs';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import assert from 'node:assert/strict';
const out='../evidence/reviewed-ui';await mkdir(out,{recursive:true});
const prior=JSON.parse(readFileSync('/tmp/harbor-reviewed-owner-z9Ncmc/playthrough.json','utf8')).head;
let mode='offer',models=0,business=0;
const assembly=createExplorationAssembly({crabEnabled:true,now:()=>100000,boot:'reviewed-owner-read-ui',createLife:createReviewedAnimalLife,resolveDialogue:async()=>{models++;throw Error('MODEL_DISABLED')},decorateLife:life=>withWildMint(withBasilPlantUses(life,{enabled:true}),{enabled:true}),initial:(locale,id)=>{
 if(mode==='page'){const s=structuredClone(prior);delete s.movingClock;delete s.activePlayClock;return {...s,id,locale,version:0,cursor:0,history:[]}}
 return pinLegacy({...initial(locale,id),scene:'market',townMinutes:780,position:{x:722,y:594},known:mode==='offer'?['mara','dani']:['mara'],visited:Object.keys(rooms),flags:['key','unpacked','route-open','market-open'],items:{key:1}},createPlantsRegistry());
}});
const directory=mkdtempSync('/tmp/harbor-reviewed-ui-');let server,browser;
const report={scope:'compiled actual Main/View/Pixi on isolated local guarded SQLite; explicitly synthetic introduced/unknown fixtures; completed page copied from prior ordinary local playthrough. No new share/adopt/proposal, original player or live service.',cases:[],errors:[],blockedBusiness:[],clockInitialization:0,modelCalls:0,newMediaPosts:0,newShareActions:0};
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.json':'application/json','.svg':'image/svg+xml','.tmx':'application/xml','.woff2':'font/woff2','.ttf':'font/ttf','.mp3':'audio/mpeg'};
try{
 server=await makeDemoServer({directory,port:5589,providedRuntime:assembly.runtime,lifeProject:assembly.lifeProject,landProject:assembly.landProject,decorateAuthority:assembly.decorateAuthority});
 browser=await chromium.launch({headless:true,executablePath:'/Users/yin/Library/Caches/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-mac-arm64/chrome-headless-shell',args:['--use-angle=swiftshader','--disk-cache-size=1','--media-cache-size=1']});
 for(const [width,height,locale] of [[320,568,'zh'],[390,844,'en'],[1280,800,'en']])for(const state of (process.env.HARBOR_REVIEW_UI_OFFERS_ONLY?['offer']:['unknown','offer','page'])){
  mode=state;const label=`${width}-${locale}-${state}`,c=await browser.newContext({viewport:{width,height},locale:locale==='zh'?'zh-CN':'en-US',serviceWorkers:'block'});
  await c.route('**/*',async r=>{const q=r.request(),u=new URL(q.url());if(u.hostname!=='127.0.0.1')return r.abort();if(u.pathname.includes('/api/')){if(u.pathname.endsWith('/action')){const action=q.postDataJSON()?.action;if(action==='candidate-clock-enable')report.clockInitialization++;else{business++;report.blockedBusiness.push(action);return r.abort()}}return r.fulfill({response:await r.fetch()})}const file=resolve('dist','.'+(u.pathname==='/'?'/index.html':decodeURIComponent(u.pathname)));if(!file.startsWith(resolve('dist')+'/')||!existsSync(file))return r.fulfill({status:404,body:'Missing'});return r.fulfill({contentType:mime[extname(file)]??'application/octet-stream',body:readFileSync(file)})});
  await c.addInitScript(()=>{window.__name=f=>f});const p=await c.newPage();p.setDefaultTimeout(25000);p.on('pageerror',e=>report.errors.push({label,error:String(e)}));await p.goto(server.url+'/?debug=1');
  await p.waitForFunction(()=>document.querySelector('#rpg')?.__rpgClient?.getCurrentPlayer()&&!document.querySelector('.harbor-loading'));
  while(await p.locator('.harbor-opening button').isVisible())await p.locator('.harbor-opening button').click();
  const api=server.url+'/'+GAME_UUID+'/api',[journey]=await(await c.request.get(api+'/sessions')).json();
  const dto=await(await c.request.get(api+'/sessions/'+journey.id+'/life')).json();
  const custom=dto.animals.commissions.find(x=>x.ref.id===pack.ref.id),tx=(zh,en)=>locale==='zh'?zh:en;
  if(state==='unknown'){
   assert.equal(custom,undefined);await p.locator('.harbor-header nav').getByRole('button',{name:tx('人物','People'),exact:true}).click();assert.equal(await p.locator('[data-person="dani"]').count(),0);
  }else if(state==='offer'){
   assert.equal(custom.enabled,true);assert.deepEqual(custom.ref,pack.ref);assert.equal(custom.active,false);
   await p.locator('[data-target="dani"]').focus();await p.keyboard.press('Enter');await p.waitForFunction(()=>document.querySelector('.harbor-action.is-ready')?.textContent.includes('Dani')||document.querySelector('.harbor-action.is-ready')?.textContent.includes('丹妮'));
   await p.locator('.harbor-action.is-ready').click();const row=p.locator(`[data-animal-commission="${pack.ref.id}"]`);await row.waitFor();assert.equal(await row.locator('strong').innerText(),pack.definition.title[locale==='zh'?0:1]);assert.equal(await row.getByRole('button',{name:tx('聊聊动物日常','Ask about animal routines'),exact:true}).count(),1);await row.scrollIntoViewIfNeeded();
  }else{
   await p.locator('.harbor-header nav').getByRole('button',{name:tx('行囊','Bag'),exact:true}).click();await p.locator('.harbor-bag > .harbor-subnav').getByRole('button',{name:tx('发现记录','Records'),exact:true}).click();const page=p.locator(`[data-animal-page="${pack.ref.id}"]`);await page.waitFor();await page.scrollIntoViewIfNeeded();assert.equal(await page.locator('strong').innerText(),pack.definition.title[locale==='zh'?0:1]);assert.equal(await page.locator('p').innerText(),pack.definition.page[locale==='zh'?0:1]);
  }
  await p.waitForTimeout(250);const noOverflow=await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1);assert.equal(noOverflow,true);await p.screenshot({path:`${out}/${label}.png`});report.cases.push({label,state,width,height,locale,noOverflow,fixedRefExact:state!=='unknown',unknownHidden:state==='unknown',result:'PASS'});await c.close();await writeFile(out+(process.env.HARBOR_REVIEW_UI_OFFERS_ONLY?'/report-offers-final.json':'/report.json'),JSON.stringify(report,null,2)+'\n');
 }
 assert.equal(models,0);assert.equal(business,0);assert.deepEqual(report.errors,[]);report.result='PASS';
}catch(e){report.result='FAIL';report.failure=String(e);process.exitCode=1;for(const c of browser?.contexts()??[])for(const p of c.pages())await p.screenshot({path:out+'/failure.png'}).catch(()=>{})}
finally{report.modelCalls=models;await browser?.close();await server?.close();await writeFile(out+(process.env.HARBOR_REVIEW_UI_OFFERS_ONLY?'/report-offers-final.json':'/report.json'),JSON.stringify(report,null,2)+'\n')}
console.log(JSON.stringify({result:report.result,cases:report.cases.length,business,models,errors:report.errors,failure:report.failure}));
