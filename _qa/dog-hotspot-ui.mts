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
const out=process.env.HARBOR_DOG_QA_OUT??'../evidence/dog-hotspot-first';await mkdir(out,{recursive:true});
const directory=mkdtempSync(join(tmpdir(),'harbor-dog-nearby-'));let models=0;
const assembly=createExplorationAssembly({crabEnabled:true,resolveDialogue:async()=>{models++;throw Error('QA_MODEL_DISABLED')},initial:(l,id)=>({...initial(l,id),scene:'station',townMinutes:540,flags:['key','unpacked','bag-returned'],known:['mara'],visited:Object.keys(rooms),items:{key:1},position:{x:600,y:820}})});
const server=await makeDemoServer({directory,port:5602,providedRuntime:assembly.runtime,lifeProject:assembly.lifeProject,landProject:assembly.landProject,decorateAuthority:assembly.decorateAuthority,accountOnly:true});
const mime={'.html':'text/html','.js':'application/javascript','.css':'text/css','.png':'image/png','.json':'application/json','.woff2':'font/woff2','.ttf':'font/ttf','.mp3':'audio/mpeg'};
const report={scope:'fully built Main/RPGJS + existing temporary-account adapter, synthetic local SQLite only, ordinary keys and panel buttons; physical/Telegram/production accounts not tested',cases:[],errors:[],models:0,directory};let browser;
try{
 browser=await chromium.launch({headless:true,executablePath:'/Users/yin/Library/Caches/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-mac-arm64/chrome-headless-shell',args:['--use-angle=swiftshader','--disable-gpu-shader-disk-cache']});
 for(const [width,height,locale,n] of [[320,568,'zh',1],[390,844,'en',2]]){
  const c=await browser.newContext({viewport:{width,height},locale:locale==='zh'?'zh-CN':'en-US',serviceWorkers:'block',hasTouch:true,isMobile:true});
  await c.route('**/*',async r=>{const u=new URL(r.request().url());if(u.hostname!=='127.0.0.1')return r.abort();if(u.pathname.includes('/api/'))return r.fulfill({response:await r.fetch({url:server.url+u.pathname+u.search})});const f=resolve('dist','.'+(u.pathname==='/'?'/index.html':decodeURIComponent(u.pathname)));if(!f.startsWith(resolve('dist')+'/')||!existsSync(f))return r.fulfill({status:404,body:'Missing'});return r.fulfill({status:200,contentType:mime[extname(f)]??'application/octet-stream',body:readFileSync(f)})});
  await c.addInitScript(({locale,n})=>{window.__name=f=>f;window.Aigram={isInAigram:true,telegramId:'99066'+n,callAigramAPI:async()=>({})};addEventListener('DOMContentLoaded',()=>{window.alteruLocalStorage.setItem('harbor-locale',locale);window.alteruLocalStorage.setItem('harbor-muted','1')})},{locale,n});
  const p=await c.newPage();p.on('pageerror',e=>report.errors.push(String(e)));p.setDefaultTimeout(20000);await p.goto(server.url+'/?debug=1');
  await p.getByRole('button',{name:locale==='zh'?'新游戏':'New game',exact:true}).click();
  const ready=()=>p.waitForFunction(()=>document.querySelector('#rpg')?.__rpgClient?.getCurrentPlayer()&&!document.querySelector('.harbor-loading'));
  await ready();for(let i=0;i<3;i++)await p.locator('.harbor-opening button').click();
  await p.evaluate(()=>{window.__touchEvents=[];for(const type of ['pointerdown','pointerup','click','touchend'])document.addEventListener(type,e=>{window.__touchEvents.push({type,t:performance.now(),target:e.target?.className,dialog:document.querySelector('[role="dialog"]')?.getAttribute('aria-label')??null})},true)});
  await p.evaluate(()=>{window.__dogSamples=[];let last=0;const sample=t=>{const c=document.querySelector('#rpg')?.__rpgClient,hero=c?.getCurrentPlayer(),dog=Object.values(c?.sceneMap.events()??{}).find(e=>e.id.includes('harbor-dog-1'));if(hero&&dog)window.__dogSamples.push({t,dt:t-last,visible:dog.graphics().length>0,x:dog.x(),y:dog.y(),hero:{x:hero.x(),y:hero.y()},clock:document.querySelector('.harbor-location')?.textContent});last=t;window.__dogSampleRaf=requestAnimationFrame(sample)};window.__dogSampleRaf=requestAnimationFrame(sample)});
  await p.waitForTimeout(500);await p.screenshot({path:`${out}/${width}-before.png`});
  const commands=[];p.on('request',q=>{if(q.method()==='POST'&&q.url().endsWith('/action')){try{commands.push(q.postDataJSON().action)}catch{}}});
  const dogPin=p.locator('[data-target="harbor-dog-1"]');await dogPin.waitFor({state:'visible'});await dogPin.tap();
  await p.waitForFunction(locale=>document.querySelector('.harbor-action')?.textContent?.includes(locale==='zh'?'狗':'Dog'),locale,{timeout:12000});
  assert.equal(await p.locator('.harbor-panel--entity').count(),0,'hotspot tap approaches without opening');
  await p.locator('.harbor-action').tap();await p.waitForTimeout(500);
  await writeFile(`${out}/${width}-interaction-events.json`,JSON.stringify(await p.evaluate(()=>window.__touchEvents),null,2));
  assert.equal(await p.getByRole('dialog',{name:locale==='zh'?'狗':'Dog',exact:true}).count(),1);
  assert.equal(await p.locator('.harbor-panel--entity .harbor-animal-notebook').count(),0,'dog has no cat-only sample/record action');
  assert.ok((await p.locator('.harbor-dialogue').innerText()).includes(locale==='zh'?'照看':'caretaker'));
  await p.screenshot({path:`${out}/${width}-dog-observation.png`});
  await p.getByRole('button',{name:locale==='zh'?'关闭':'Close',exact:true}).tap();await p.waitForTimeout(400);
  await p.keyboard.press('e');await p.getByRole('dialog',{name:locale==='zh'?'狗':'Dog',exact:true}).waitFor();
  await p.keyboard.press('Escape');await p.getByRole('dialog',{name:locale==='zh'?'狗':'Dog',exact:true}).waitFor({state:'hidden'});
  await p.locator('.harbor-action').focus();await p.locator('.harbor-action').press('Space');
  await p.getByRole('dialog',{name:locale==='zh'?'狗':'Dog',exact:true}).waitFor();
  await p.getByRole('button',{name:locale==='zh'?'关闭':'Close',exact:true}).tap();await p.waitForTimeout(400);
  assert.ok(commands.every(a=>!a?.startsWith('animal-')),'observation submits no animal command');
  await writeFile(`${out}/${width}-interaction.json`,JSON.stringify({hotspotTapped:true,approachedByOriginalPath:true,normalActionOpenedDog:true,keyboardEAndSpacePassed:true,readOnly:true,animalCommands:commands.filter(a=>a?.startsWith('animal-')),actionCommands:commands,physicalIOS:false},null,2));

  await p.keyboard.down('ArrowUp');await p.waitForTimeout(1800);await p.keyboard.up('ArrowUp');await p.waitForTimeout(700);await p.screenshot({path:`${out}/${width}-near.png`});
  await p.getByRole('button',{name:locale==='zh'?'行囊':'Bag',exact:true}).click();await p.waitForTimeout(1400);await p.screenshot({path:`${out}/${width}-paused.png`});
  await p.getByRole('button',{name:locale==='zh'?'关闭':'Close',exact:true}).click();
  await p.keyboard.down('ArrowDown');await p.waitForTimeout(1600);await p.keyboard.up('ArrowDown');await p.waitForTimeout(5000);await p.screenshot({path:`${out}/${width}-away.png`});
  const samples=await p.evaluate(()=>{cancelAnimationFrame(window.__dogSampleRaf);return window.__dogSamples});
  const visible=samples.filter(s=>s.visible),jumps=[];let max=0;
  for(let i=1;i<samples.length;i++){const a=samples[i-1],b=samples[i];if(!a.visible||!b.visible)continue;const d=Math.hypot(b.x-a.x,b.y-a.y);max=Math.max(max,d);if(d>8)jumps.push({a,b,d})}
  assert.ok(visible.length>150,'dog must actually render during proximity');assert.deepEqual(jumps,[]);
  await writeFile(`${out}/${width}-samples.json`,JSON.stringify(samples));
  const headers={'x-harbor-telegram-id':'99066'+n,'x-harbor-identity-mode':'temporary-unverified','x-harbor-game':GAME_UUID};
  const [journey]=await(await c.request.get(server.url+'/'+GAME_UUID+'/api/sessions',{headers})).json();
  const head=await(await c.request.get(server.url+'/'+GAME_UUID+'/api/sessions/'+journey.id,{headers})).json();
  assert.deepEqual(head.items,{key:1});assert.deepEqual(head.known,['mara']);assert.equal(head.scene,'station');assert.ok(head.townMinutes>540,'actual clock must cross a committed minute');
  await p.reload();await p.getByRole('button',{name:locale==='zh'?'继续':'Continue',exact:true}).click();await ready();
  report.cases.push({width,height,locale,sampleCount:samples.length,visibleFrames:visible.length,maxFrameDisplacement:max,jumps,minute:head.townMinutes,itemsUnchanged:true,knownUnchanged:true,continuedSameJourney:journey.id,passed:true});
  await writeFile(`${out}/${width}-samples.json`,JSON.stringify(samples));await c.unrouteAll({behavior:'wait'});await c.close();
 }
 assert.deepEqual(report.errors,[]);assert.equal(models,0);report.result='PASS';
}catch(e){report.result='FAIL';report.failure=String(e);report.stack=e.stack;process.exitCode=1;if(browser)for(const c of browser.contexts())for(const p of c.pages()){await p.screenshot({path:out+'/failure.png'}).catch(()=>{});await writeFile(out+'/failure.txt',await p.locator('body').innerText()).catch(()=>{})}}
finally{report.models=models;await writeFile(out+'/report.json',JSON.stringify(report,null,2));await browser?.close();await server.close()}
console.log(JSON.stringify(report));
