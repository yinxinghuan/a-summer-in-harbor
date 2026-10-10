// @ts-nocheck -- original Main/RPGJS, local synthetic journey only.
import {createExplorationAssembly} from '../server/exploration-assembly';
import {makeDemoServer} from './temporary-account-server';
import {initial} from '../src/story/state';
import {rooms} from '../src/world/data';
import {GAME_UUID} from '../src/game-id';
import {readFileSync,existsSync,mkdtempSync} from 'node:fs';
import {writeFile,mkdir} from 'node:fs/promises';
import {resolve,extname,join} from 'node:path';
import {tmpdir} from 'node:os';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const out='../evidence/map-release-baseline';await mkdir(out,{recursive:true});
const directory=mkdtempSync(join(tmpdir(),'harbor-dog-nearby-'));let models=0;let qaScene='station';
const assembly=createExplorationAssembly({crabEnabled:true,resolveDialogue:async()=>{models++;throw Error('QA_MODEL_DISABLED')},initial:(l,id)=>({...initial(l,id),scene:qaScene,townMinutes:540,flags:['key','unpacked','bag-returned','bridge-fixed','route-open','market-open','market-known'],known:['mara'],visited:Object.keys(rooms),items:{key:1},position:qaScene==='station'?{x:600,y:820}:rooms[qaScene].spawn})});
const server=await makeDemoServer({directory,port:5601,providedRuntime:assembly.runtime,lifeProject:assembly.lifeProject,landProject:assembly.landProject,decorateAuthority:assembly.decorateAuthority,accountOnly:true});
const mime={'.html':'text/html','.js':'application/javascript','.css':'text/css','.png':'image/png','.json':'application/json','.woff2':'font/woff2','.ttf':'font/ttf','.mp3':'audio/mpeg'};
const report={scope:'fully built Main/RPGJS + existing temporary-account adapter, synthetic local SQLite only, ordinary keys and panel buttons; physical/Telegram/production accounts not tested',cases:[],errors:[],models:0,directory};let browser;
try{
 browser=await chromium.launch({headless:true,executablePath:'/Users/yin/Library/Caches/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-mac-arm64/chrome-headless-shell',args:['--use-angle=swiftshader','--disable-gpu-shader-disk-cache']});
 for(const [width,height,locale,n,scene] of [[320,568,'zh',1,'station'],[390,844,'en',2,'station'],[320,568,'en',3,'coast'],[390,844,'zh',4,'coast'],[320,568,'zh',5,'path'],[390,844,'en',6,'path']]){
  qaScene=scene;const c=await browser.newContext({viewport:{width,height},locale:locale==='zh'?'zh-CN':'en-US',serviceWorkers:'block',hasTouch:true,isMobile:true});
  await c.route('**/*',async r=>{const u=new URL(r.request().url());if(u.hostname!=='127.0.0.1')return r.abort();if(u.pathname.includes('/api/'))return r.fulfill({response:await r.fetch({url:server.url+u.pathname+u.search})});const f=resolve('dist','.'+(u.pathname==='/'?'/index.html':decodeURIComponent(u.pathname)));if(!f.startsWith(resolve('dist')+'/')||!existsSync(f))return r.fulfill({status:404,body:'Missing'});return r.fulfill({status:200,contentType:mime[extname(f)]??'application/octet-stream',body:readFileSync(f)})});
  await c.addInitScript(({locale,n})=>{window.__name=f=>f;window.Aigram={isInAigram:true,telegramId:'99066'+n,callAigramAPI:async()=>({})};addEventListener('DOMContentLoaded',()=>{window.alteruLocalStorage.setItem('harbor-locale',locale);window.alteruLocalStorage.setItem('harbor-muted','1')})},{locale,n});
  const p=await c.newPage();p.on('pageerror',e=>report.errors.push(String(e)));p.setDefaultTimeout(20000);await p.goto(server.url+'/?debug=1');
  await p.getByRole('button',{name:locale==='zh'?'新游戏':'New game',exact:true}).click();
  const ready=()=>p.waitForFunction(()=>document.querySelector('#rpg')?.__rpgClient?.getCurrentPlayer()&&!document.querySelector('.harbor-loading'));
  await ready();for(let i=0;i<3;i++)await p.locator('.harbor-opening button').click();
  const opened=[];
  await p.evaluate(()=>{window.__mapEvents=[];for(const type of ['pointerdown','pointerup','lostpointercapture','click','touchend'])document.addEventListener(type,e=>window.__mapEvents.push({type,target:e.target?.className?.baseVal??e.target?.className??e.target?.tagName,map:!!document.querySelector('.harbor-panel--map')}),true)});

  for(let i=0;i<3;i++){
   await p.getByRole('button',{name:locale==='zh'?'地图':'Map',exact:true}).tap();await p.waitForTimeout(350);
   const state=await p.evaluate(()=>({map:!!document.querySelector('.harbor-panel--map'),renderer:!!document.querySelector('#rpg')?.__rpgClient?.getCurrentPlayer(),scroll:document.querySelector('.harbor-panel__body')?.scrollTop}));opened.push({i,...state});assert.equal(state.map,true);assert.equal(state.renderer,true);
   if(i===0){
    await p.getByRole('combobox',{name:locale==='zh'?'地图区域':'Map area',exact:true}).selectOption('all');
    await p.locator('[data-place="coast"]').tap();await p.waitForTimeout(150);
   }
   if(i===1){
    const b=await p.locator('.harbor-spatial-viewport').boundingBox();assert.ok(b);
    const session=await c.newCDPSession(p),x=b.x+b.width/2,y=b.y+b.height/2;
    await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y,id:7}]});
    for(let j=1;j<=6;j++)await session.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x+(1-x)*j/6,y,id:7}]});
    await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await p.waitForTimeout(250);
    const stillMap=await p.locator('.harbor-panel--map').count();opened.push({releaseOutsideAfterMapDrag:true,stillMap});
    await writeFile(`${out}/${width}-${scene}-events.json`,JSON.stringify(await p.evaluate(()=>window.__mapEvents),null,2));
    if(!stillMap)throw Error('MAP_CLOSE_ON_DRAG_RELEASE');
   }

   await p.getByRole('button',{name:locale==='zh'?'放大':'Zoom in',exact:true}).tap();await p.getByRole('button',{name:locale==='zh'?'缩小':'Zoom out',exact:true}).tap();await p.getByRole('button',{name:locale==='zh'?'关闭':'Close',exact:true}).tap();await p.waitForTimeout(90);
  }
  await p.screenshot({path:`${out}/${width}-${scene}-after12.png`});
  report.cases.push({width,height,locale,scene,opened,passed:true});await writeFile(out+'/partial.json',JSON.stringify(report,null,2));
  await c.unrouteAll({behavior:'wait'});await c.close();
 }
 assert.deepEqual(report.errors,[]);assert.equal(models,0);report.result='PASS';
}catch(e){report.result='FAIL';report.failure=String(e);report.stack=e.stack;process.exitCode=1;if(browser)for(const c of browser.contexts())for(const p of c.pages()){await p.screenshot({path:out+'/failure.png'}).catch(()=>{});await writeFile(out+'/failure.txt',await p.locator('body').innerText()).catch(()=>{})}}
finally{report.models=models;await writeFile(out+'/report.json',JSON.stringify(report,null,2));await browser?.close();await server.close()}
console.log(JSON.stringify(report));
