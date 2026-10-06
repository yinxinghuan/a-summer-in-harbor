import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';

const out='doc/qa/animals-integration-20261006/ui-map-collision-v2';
await mkdir(out,{recursive:true});
const report={scope:'ordinary local UI travel and keyboard against a resting cat; actual RPGJS renderer, synthetic SQLite journey only',cases:[],errors:[],mediaPosts:0,originalPlayerModified:false};
const browser=await chromium.launch({headless:true,executablePath:'/Users/yin/Library/Caches/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-mac-arm64/chrome-headless-shell',args:['--use-angle=swiftshader']});
const feet=()=>{const c=document.querySelector('#rpg').__rpgClient,p=c.getCurrentPlayer(),a=c.sceneMap.events()['animal-harbor-cat-1'];return {player:{x:p.x(),y:p.y()},cat:a?{x:a.x(),y:a.y(),graphic:a.graphics()[0]}:null}};
try{for(const width of [320,390]){
 const context=await browser.newContext({viewport:{width,height:width===320?568:844},locale:'en-US',recordVideo:{dir:out}});
 await context.route('**/*',r=>['localhost','127.0.0.1'].includes(new URL(r.request().url()).hostname)?r.continue():r.abort());
 const seed=await(await context.request.post('http://127.0.0.1:5425/qa/prepare?case=cat-mira')).json();
 await context.addInitScript(id=>addEventListener('DOMContentLoaded',()=>{window.alteruLocalStorage?.setItem('harbor-opening:'+id,'3');window.alteruLocalStorage?.setItem('harbor-locale','en');window.alteruLocalStorage?.setItem('harbor-muted','1')}),seed.id);
 const page=await context.newPage();page.on('pageerror',e=>report.errors.push(String(e)));
 await page.goto('http://127.0.0.1:5426/?debug=1');await page.waitForFunction(()=>document.querySelector('#rpg')?.__rpgClient?.getCurrentPlayer()&&!document.querySelector('.harbor-loading'));
 await page.getByRole('button',{name:'Map',exact:true}).click();await page.locator('.harbor-map-tabs').getByRole('button',{name:'Station Street',exact:true}).click();await page.locator('[data-place="station"]').click();await page.getByRole('button',{name:'Go here',exact:true}).click();
 await page.waitForFunction(()=>!document.querySelector('.harbor-loading')&&document.querySelector('.harbor-location')?.innerText.includes('Station Street'));
 const press=async(key,ms)=>{await page.keyboard.down(key);await page.waitForTimeout(ms);await page.keyboard.up(key)};
 await press('ArrowRight',1850);await press('ArrowUp',800);
 const target=page.locator('[data-target="harbor-cat-1"]'),box=await target.boundingBox();assert.ok(box);const point={x:box.x+box.width/2,y:box.y+box.height/2};assert.equal(await page.evaluate(p=>document.elementFromPoint(p.x,p.y)?.closest('[data-target]')?.getAttribute('data-target'),point),'harbor-cat-1');await page.mouse.click(point.x,point.y);
 await page.waitForFunction(()=>document.querySelector('[data-target="harbor-cat-1"]')?.dataset.near==='true');await page.waitForTimeout(1000);
 const before=await page.evaluate(feet);assert.ok(before.cat?.graphic);await page.screenshot({path:out+'/station-'+width+'-before.png'});
 await page.evaluate(()=>{const c=document.querySelector('#rpg').__rpgClient;window.__animalCollisionTrace=[];const stop=performance.now()+2100;const tick=()=>{const p=c.getCurrentPlayer(),a=c.sceneMap.events()['animal-harbor-cat-1'];if(a?.graphics().length)window.__animalCollisionTrace.push({player:{x:p.x(),y:p.y()},cat:{x:a.x(),y:a.y()}});if(performance.now()<stop)requestAnimationFrame(tick)};requestAnimationFrame(tick)});
 await press('ArrowUp',1700);await page.waitForTimeout(450);const after=await page.evaluate(feet),trace=await page.evaluate(()=>window.__animalCollisionTrace);
 // Collision must stop the player; it must not push this resting cat away.
 assert.ok(trace.length>20);for(const frame of trace){assert.ok(Math.hypot(frame.cat.x-before.cat.x,frame.cat.y-before.cat.y)<.5,'ordinary contact must not move a resting cat after travel');assert.ok(!(frame.player.x<frame.cat.x+15&&frame.player.x+16>frame.cat.x-15&&frame.player.y<frame.cat.y&&frame.player.y+12>frame.cat.y-18),'player and cat ground bodies must not overlap')}
 assert.ok(before.player.y-after.player.y>15&&before.player.y-after.player.y<50);assert.ok(after.player.y>=after.cat.y-.1);await page.screenshot({path:out+'/station-'+width+'-stopped.png'});
 const head=await(await context.request.get('http://127.0.0.1:5425/api/sessions/'+seed.id)).json();assert.equal(head.scene,'station');assert.equal(head.townMinutes,560);assert.equal(head.animalsV1,undefined);
 const video=page.video();await context.close();await video.saveAs(out+'/station-'+width+'.webm');report.cases.push({width,passed:true,head:{scene:head.scene,townMinutes:head.townMinutes,version:head.version},before,after,trace});await writeFile(out+'/report.json',JSON.stringify(report,null,2));console.log(JSON.stringify({width,passed:true,frames:trace.length,before,after}));
}assert.deepEqual(report.errors,[])}catch(e){report.failure=String(e);for(const context of browser.contexts())for(const page of context.pages())await page.screenshot({path:out+'/failure.png'}).catch(()=>{});throw e}finally{await writeFile(out+'/report.json',JSON.stringify(report,null,2));await browser.close()}
