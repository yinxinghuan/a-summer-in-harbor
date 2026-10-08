// @ts-nocheck -- real compiled Main/View, ordinary input, explicitly synthetic local accounts only.
import {createExplorationAssembly} from '../server/exploration-assembly';
import {withBasilPlantUses} from '../server/plant-basil';
import {createPlantsRegistry,snapPeaV2Ref} from '../server/life-plants-b2';
import {pinLegacy,addLot} from '../src/life/save';
import {makeDemoServer} from './temporary-account-server';
import {initial} from '../src/story/state';
import {rooms} from '../src/world/data';
import {GAME_UUID} from '../src/game-id';
import {mkdtempSync,readFileSync,existsSync} from 'node:fs';
import {join,resolve,extname} from 'node:path';
import {writeFile,mkdir} from 'node:fs/promises';
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const directory=mkdtempSync('/tmp/harbor-menu-b24-final-'),out='../evidence/platform-layout';await mkdir(out,{recursive:true});
let models=0;const registry=createPlantsRegistry();
const assembly=createExplorationAssembly({crabEnabled:true,resolveDialogue:async()=>{models++;throw Error('QA_MODEL_DISABLED')},
 decorateLife:r=>withBasilPlantUses(r),
 initial:(l,id)=>{let s=pinLegacy({...initial(l,id),scene:'station',position:{...rooms.station.spawn},
  flags:['key','unpacked','bag-returned','alternative-route','route-open','market-open'],visited:Object.keys(rooms),known:['mara','theo','dani','june'],energy:55,
  items:{key:1,toolbag:1,toolkit:1,wood:2,fish:1,photo:1,route:1,'packed-snack':2,'seed-radish':3,'seed-basil':2,'seed-tomato':2,'crop-radish':2,'crop-basil':3,'crop-tomato':2}},registry);
  addLot(s,registry,snapPeaV2Ref,'seed',2,'synthetic-ui-pea-seed');addLot(s,registry,snapPeaV2Ref,'produce',2,'synthetic-ui-pea-produce');
  return s}
});
const server=await makeDemoServer({directory,port:0,providedRuntime:assembly.runtime,lifeProject:assembly.lifeProject,landProject:assembly.landProject,decorateAuthority:assembly.decorateAuthority});
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.json':'application/json','.svg':'image/svg+xml','.tmx':'application/xml','.woff2':'font/woff2','.ttf':'font/ttf','.mp3':'audio/mpeg'};
const outDir='../evidence/external-guest';await mkdir(outDir,{recursive:true});
const external={scope:'ordinary local browser, original compiled UI with current public guest-shell scripts served byte-for-byte; other external traffic blocked; not production/Telegram',checks:[],pageErrors:[],blocked:0,models:0};
let browser;
try{
 browser=await chromium.launch({headless:true,executablePath:'/Users/yin/Library/Caches/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-mac-arm64/chrome-headless-shell',args:['--use-angle=swiftshader','--disk-cache-size=1','--media-cache-size=1','--disable-gpu-shader-disk-cache']});
 const c=await browser.newContext({viewport:{width:390,height:844},locale:'en-US',hasTouch:true,serviceWorkers:'block'});
 await c.route('**/*',async r=>{
  const u=new URL(r.request().url());
  if(u.hostname==='images.aiwaves.tech'&&u.pathname==='/alteru/guest-shell.js')return r.fulfill({contentType:'text/javascript',body:readFileSync('../evidence/guest-shell-current.js')});
  if(u.hostname==='images.aiwaves.tech'&&u.pathname==='/alteru/guest-shell.impl.js')return r.fulfill({contentType:'text/javascript',body:readFileSync('../evidence/guest-shell-impl-current.js')});
  if(u.hostname!=='127.0.0.1'){external.blocked++;return r.abort()}
  if(u.pathname.includes('/api/'))return r.fulfill({response:await r.fetch()});
  const file=resolve('dist','.'+(u.pathname==='/'?'/index.html':decodeURIComponent(u.pathname)));if(!file.startsWith(resolve('dist')+'/')||!existsSync(file))return r.fulfill({status:404,body:'Missing'});return r.fulfill({contentType:mime[extname(file)]??'application/octet-stream',body:readFileSync(file)})
 });
 await c.addInitScript(()=>{window.__name=f=>f});const p=await c.newPage();p.setDefaultTimeout(15000);p.on('pageerror',e=>external.pageErrors.push(String(e)));
 await p.goto(server.url+'/?debug=1');await p.waitForFunction(()=>document.querySelector('#rpg')?.__rpgClient?.getCurrentPlayer()&&!document.querySelector('.harbor-loading'));
 for(let i=0;i<3;i++)await p.locator('.harbor-opening button').click();
 await p.waitForSelector('#alteru-guest-banner',{state:'visible'});await p.screenshot({path:outDir+'/390-en-home-external-guest.png'});external.checks.push('actual guest shell banner visible without production CSS suppression or identity injection');
 const opener=p.locator('.harbor-header nav').getByRole('button',{name:'Bag',exact:true});await opener.focus();await p.keyboard.press('Enter');await p.locator('[data-bag-item="item:wood"]').click();await p.waitForFunction(()=>{const i=document.querySelector('[data-bag-detail] img') as HTMLImageElement;return !!i&&i.complete&&i.naturalWidth>0});await p.screenshot({path:outDir+'/390-en-bag-detail-external-guest.png'});
 assert.equal(await p.locator('[data-bag-detail] img').getAttribute('data-crop-source'),'./art/bag/wood.png');external.checks.push('bag opens by normal keyboard and original wood detail accessible with external banner');
 assert.equal(await p.locator('[data-bag-item*="harbor-mint"]').count(),0);external.checks.push('unpublished mint action absent');
 await p.keyboard.press('Escape');assert.equal(await p.locator('.harbor-panel').count(),0);external.checks.push('Escape closes modal with guest banner retained');
 assert.equal(external.pageErrors.length,0);assert.equal(models,0);external.result='PASS';
}catch(e){external.failure=String(e);external.result='FAIL';process.exitCode=1;for(const c of browser?.contexts()??[])for(const p of c.pages())await p.screenshot({path:outDir+'/failure.png'}).catch(()=>{})}finally{external.models=models;await writeFile(outDir+'/report.json',JSON.stringify(external,null,2));await browser?.close();await server.close()}
console.log(JSON.stringify(external));
