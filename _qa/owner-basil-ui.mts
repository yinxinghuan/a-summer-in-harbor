// @ts-nocheck -- Playwright orchestration; runtime assertions exercise the compiled production UI.
import {createExplorationAssembly} from '../server/exploration-assembly';
import {withBasilPlantUses} from '../server/plant-basil';
import {makeDemoServer} from './temporary-account-server';
import {initial} from '../src/story/state';
import {GAME_UUID} from '../src/game-id';
import {mkdtempSync,rmSync,readFileSync,existsSync} from 'node:fs';
import {tmpdir} from 'node:os';import {join,resolve,extname} from 'node:path';
const directory=mkdtempSync(join(tmpdir(),'basil-real-ui-'));
const assembly=createExplorationAssembly({resolveDialogue:async()=>{report.modelCalls++;throw Error('QA_MODEL_DISABLED')},decorateLife:(r:any)=>withBasilPlantUses(r,{enabled:true,newStarts:true}),initial:(locale:any,id:string)=>({...initial(locale,id),scene:'cafe',position:rooms.cafe.spawn,visited:Object.keys(rooms),known:['mara'],flags:['key','unpacked','bag-returned','garden-agreed','alternative-route','route-open','market-open'],items:{key:1}})});
const server=await makeDemoServer({directory,port:5485,providedRuntime:assembly.runtime,lifeProject:assembly.lifeProject,landProject:assembly.landProject,decorateAuthority:assembly.decorateAuthority});
const mime:any={'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.json':'application/json','.svg':'image/svg+xml','.tmx':'application/xml','.tsx':'application/xml','.woff2':'font/woff2','.ttf':'font/ttf','.mp3':'audio/mpeg'};
import {chromium} from 'playwright';
import {rooms} from '../src/world/data.ts';
import {findPath} from '../src/engine/world.ts';
import {dynamicWorld} from '../src/dynamic-assets/layout.ts';
import {landWorld} from '../src/life/land.ts';
import {writeFile,mkdir,statfs} from 'node:fs/promises';import assert from 'node:assert/strict';
const out=new URL('../../evidence/owner-basil-flow-final/',import.meta.url);await mkdir(out,{recursive:true});
const report={scope:'owner final compiled Main/View/RPGJS + real loopback temporary-account/SQLite + natural 4s town clock; synthetic settled start then ordinary input',mint:'closed; no B applied',input:'ordinary click-to-walk, E, menu and button clicks; no force/teleport/clock edits/API mutations except labelled initial qa/prepare',cases:[],errors:[],blocked:[],screenshots:0,modelCalls:0,artCalls:0};
const browser=await chromium.launch({headless:true,executablePath:'/Users/yin/Library/Caches/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-mac-arm64/chrome-headless-shell',args:['--use-angle=swiftshader','--disk-cache-size=1','--media-cache-size=1','--disable-gpu-shader-disk-cache']});let page;
try{
 const disk=await statfs('.');assert.ok(disk.bavail*disk.bsize>=15*1024**3+32*1024**2,'DISK_FLOOR_STOP');
 const configs=[[390,844,'en','uses-flow'],[320,568,'zh','uses-flow']];
 for(const [width,height,locale,fixture] of configs){
  const record={width,height,locale,fixture,steps:[],ledger:[]};report.cases.push(record);const tx=(zh,en)=>locale==='zh'?zh:en;
  const c=await browser.newContext({viewport:{width,height},locale:locale==='zh'?'zh-CN':'en-US',serviceWorkers:'block'});
  await c.route('**/*',async r=>{const u=new URL(r.request().url());if(u.hostname!=='127.0.0.1'){report.blocked.push(u.origin+u.pathname);return r.abort()}
   if(u.pathname.includes('/api/')){const response=await r.fetch({url:server.url+u.pathname+u.search});return r.fulfill({response})}
   const rel='.'+(u.pathname==='/'?'/index.html':decodeURIComponent(u.pathname)),file=resolve('dist',rel);if(!file.startsWith(resolve('dist')+'/')||!existsSync(file))return r.fulfill({status:404,body:'Missing'});return r.fulfill({status:200,contentType:mime[extname(file)]??'application/octet-stream',body:readFileSync(file)});
  });
  await c.addInitScript(()=>{window.__name=(f)=>f});
  // Fresh browser context creates a new labelled settled fixture via normal bootstrap.
  page=await c.newPage();page.on('pageerror',e=>report.errors.push(String(e)));await page.goto('http://127.0.0.1:5498/?debug=1');
  const ready=()=>page.waitForFunction(()=>document.querySelector('#rpg')?.__rpgClient?.getCurrentPlayer()&&!document.querySelector('.harbor-loading'),null,{timeout:45000});await ready();
  for(let i=0;i<3;i++)await page.locator('.harbor-opening button').click();await page.addStyleTag({content:'#alteru-guest-banner{display:none!important}'});
  const [journey]=await(await c.request.get('http://127.0.0.1:5485/'+GAME_UUID+'/api/sessions')).json();const head=async()=>{const r=await c.request.get('http://127.0.0.1:5485/'+GAME_UUID+'/api/sessions/'+journey.id);assert.equal(r.status(),200);return r.json()};
  const ledger=async(name)=>{const s=await head();record.ledger.push({name,version:s.version,scene:s.scene,minute:s.townMinutes,cash:s.cash,energy:s.energy,items:s.items,life:s.lifeV1,uses:s.plantUsesV1,relations:s.relations});await writeFile(new URL('../flow-progress.json',out),JSON.stringify(record,null,2));return s};
  const click=async(name)=>{await page.getByRole('button',{name,exact:true}).click();record.steps.push(name);await page.waitForTimeout(180)};
  const close=async()=>{if(await page.locator('.harbor-backdrop').count()){await page.keyboard.press('Escape');await page.locator('.harbor-backdrop').waitFor({state:'detached'})}};
  const drain=async()=>{for(let i=0;i<12;i++){const buttons=page.locator('.harbor-reply__next button');if(!await buttons.count())break;await buttons.click();await page.waitForTimeout(120)}};
  const approach=async(id)=>{await close();await ready();const s=await head(),entity=rooms[s.scene].entities.find(e=>e.id===id);assert.ok(entity);
   const project=()=>page.evaluate(at=>{const c=document.querySelector('#rpg').__rpgClient,find=n=>n&&'toScreen' in n&&'clamp' in n?n:(n?.children??[]).map(find).find(Boolean),v=find(c.canvasApp.stage),q=v.toScreen(at.x,at.y),host=document.querySelector('#rpg'),r=host.getBoundingClientRect(),scale=r.width/parseFloat(host.style.width);return {x:r.x+q.x*scale,y:r.y+q.y*scale}},entity.approach);
   let point=await project();const canClick=await page.evaluate(q=>{const e=document.elementFromPoint(q.x,q.y);return !!e&&(e.matches('.harbor-world')||e instanceof HTMLCanvasElement)},point);
   if(canClick)await page.mouse.click(point.x,point.y);else{
    record.steps.push('normal-keyboard-path:'+id);
    const position=()=>page.evaluate(()=>{const p=document.querySelector('#rpg').__rpgClient.getCurrentPlayer();return {x:p.x(),y:p.y()}});
    const route=findPath(landWorld(dynamicWorld(s.flags,false),s.landV1),s.scene,await position(),entity.approach);assert.ok(route.length,'No normal walkable route: '+id);
    for(const q of route){for(let i=0;i<80;i++){const p=await position(),dx=q.x-p.x,dy=q.y-p.y;if(Math.hypot(dx,dy)<3)break;const x=Math.abs(dx)>Math.abs(dy),d=x?dx:dy,key=x?(d>0?'ArrowRight':'ArrowLeft'):(d>0?'ArrowDown':'ArrowUp');await page.keyboard.down(key);await page.waitForTimeout(Math.max(18,Math.min(90,Math.abs(d)/112*1000)));await page.keyboard.up(key);if(i===79)assert.fail('Keyboard walk stalled: '+JSON.stringify({id,p,q}));}}
   }
   await page.waitForFunction(at=>{const p=document.querySelector('#rpg').__rpgClient.getCurrentPlayer();return Math.hypot(p.x()-at.x,p.y()-at.y)<40},entity.approach,{timeout:18000});await page.locator('.harbor-action.is-ready').click();await page.locator('.harbor-panel--entity').waitFor();await page.waitForTimeout(180);await drain();record.steps.push('approach:'+id);
  };
  const travel=async(room)=>{await close();await click(tx('地图','Map'));await click(tx('全镇','The bay'));await page.locator(`[data-place="${rooms[room].area}"]`).click();await page.locator(`[data-place="${room}"]`).click();await click(tx('前往这里','Go here'));await page.locator('.harbor-backdrop').waitFor({state:'detached'});await ready();await page.waitForFunction(scene=>document.querySelector('#rpg').__rpgClient.activeRoom()?.name?.replace(/^map-/,'')===scene,room);};
  const shot=async(name)=>{const d=await statfs('.');assert.ok(d.bavail*d.bsize>=15*1024**3,'DISK_FLOOR_STOP');assert.ok(report.screenshots<8);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await page.screenshot({path:new URL(`${width}-${locale}-${fixture}-${name}-platform-layout.png`,out).pathname});report.screenshots++;};
  {
   await approach('theo');await click(tx('了解厨房需求','Read the kitchen request'));await drain();await click(tx('接罗勒订单 · 2份换$7','Accept basil order · 2 portions for $7'));await drain();let s=await ledger('accepted');assert.equal(s.plantUsesV1.order.reward,7);assert.equal(s.items['crop-basil'],undefined);
   await travel('grocery');await approach('crop-counter');await click(tx('买罗勒种子 · $5','Buy Basil seed · $5'));s=await ledger('bought-seed');assert.equal(s.cash,20);
   await travel('garden');await approach('crop-bed-1');await click(tx('播种罗勒 · 12小时','Plant Basil · 12 hours'));await click(tx('浇水 · 可湿润生长12小时','Water · 12 hours of growth'));await ledger('watered');
   await travel('home');await approach('bed');for(let i=0;i<4;i++)await click(tx('小睡三小时','Nap for three hours'));
   await travel('garden');await approach('crop-bed-1');await click(tx('收获并放入行囊','Harvest into your bag'));s=await ledger('actual-harvest');assert.equal(s.items['crop-basil'],3);
   await travel('home');await approach('bed');await click(tx('睡到早上九点','Sleep until 9 in the morning'));
   await travel('cafe');await approach('theo');await click(tx('交两份罗勒 · +$7','Deliver 2 basil portions · +$7'));s=await ledger('delivered');assert.equal(s.cash,27);assert.equal(s.items['crop-basil'],1);assert.equal(s.relations.theo,2);assert.equal(s.items['life-gift:theo-menu'],1);assert.equal(s.plantUsesV1.deliveries,1);await shot('delivery');await drain();
   await click(tx('聊聊上次的供货','Talk about the last delivery'));await drain();assert.equal((await head()).cash,27);
   await close();await click(tx('行囊','Bag'));await page.locator('[data-life-batch="crop:basil@1:produce"]').getByRole('button').click();await page.waitForTimeout(250);s=await ledger('retained-one');assert.equal(s.items['crop-basil'],0);assert.equal(s.items['seed-basil'],1);assert.equal(s.cash,27);await click(tx('收藏','Collections'));await page.locator('[data-life-record="seed:crop:basil"]').waitFor();await page.locator('[data-life-record="seed:crop:basil"]').scrollIntoViewIfNeeded();await shot('seed-and-gift');
   await page.reload();await ready();const restored=await head();assert.deepEqual(restored.plantUsesV1,s.plantUsesV1);assert.deepEqual(restored.items,s.items);assert.deepEqual(restored.lifeV1,s.lifeV1);record.result='pass';
  }
  await c.close();
 }
 assert.deepEqual(report.errors,[]);assert.equal(report.modelCalls,0);report.result='pass';
}catch(e){report.result='failed';report.failure=String(e);if(page&&!page.isClosed()){report.failureText=(await page.locator('body').innerText()).slice(-9000);report.failurePlayer=await page.evaluate(()=>{const c=document.querySelector('#rpg')?.__rpgClient,p=c?.getCurrentPlayer();return {scene:c?.activeRoom()?.name,x:p?.x(),y:p?.y()}});await page.screenshot({path:new URL('failure-platform-layout.png',out).pathname})}process.exitCode=1;}
finally{await writeFile(new URL('renderer-report.json',out),JSON.stringify(report,null,2));await browser.close();await server.close();rmSync(directory,{recursive:true,force:true})}
console.log(JSON.stringify({result:report.result,cases:report.cases.length,screenshots:report.screenshots,failure:report.failure,errors:report.errors}));
