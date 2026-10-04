import {chromium} from 'playwright';import assert from 'node:assert/strict';import {mkdir,writeFile} from 'node:fs/promises';
const out='doc/qa/combat-20261005/after';await mkdir(out,{recursive:true});const report={cases:[],errors:[],failedAssets:[],environment:'local synthetic SQLite authority; no external media/model calls; no deployment'};
const browser=await chromium.launch({headless:true,executablePath:'/Users/yin/Library/Caches/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-mac-arm64/chrome-headless-shell',args:['--use-angle=swiftshader']});
try{for(const [width,height,locale] of [[320,568,'en'],[390,844,'en'],[320,568,'zh'],[1280,800,'en']]){
 const c=await browser.newContext({viewport:{width,height},locale:locale==='zh'?'zh-CN':'en-US'});const errors=[],actions=[];
 await c.route('**/*',r=>['127.0.0.1','localhost'].includes(new URL(r.request().url()).hostname)||/^(blob|data):/.test(r.request().url())?r.continue():r.abort());
 const s=await(await c.request.post('http://127.0.0.1:5305/qa/prepare?case=combat&locale='+locale)).json();assert.ok(s.id,JSON.stringify(s));
 await c.addInitScript(({id,locale})=>addEventListener('DOMContentLoaded',()=>{window.alteruLocalStorage?.setItem('harbor-opening:'+id,'3');window.alteruLocalStorage?.setItem('harbor-locale',locale);window.alteruLocalStorage?.setItem('harbor-muted','1')}),{id:s.id,locale});
 const p=await c.newPage();p.on('pageerror',e=>{errors.push(e.stack);report.errors.push({width,locale,error:e.stack})});p.on('requestfailed',r=>{if(/127\.0\.0\.1.*\/art\//.test(r.url()))report.failedAssets.push(r.url())});p.on('request',r=>{if(r.url().endsWith('/action'))actions.push(r.postDataJSON())});
 const text=(en,zh)=>locale==='zh'?zh:en;
 const button=(en,zh)=>p.getByRole('button',{name:text(en,zh),exact:true});
 const head=async()=>{const d=await(await c.request.get('http://127.0.0.1:5305/api/sessions/'+s.id)).json();return d.head??d};
 const snap=async name=>{await p.screenshot({path:`${out}/${name}-${width}-${locale}-platform-layout.png`});assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));};
 const waitWorld=async()=>{await p.waitForFunction(()=>document.querySelector('#rpg')?.__rpgClient?.getCurrentPlayer()&&!document.querySelector('.harbor-loading'));await p.waitForTimeout(600)};
 const markCanvas=()=>p.evaluate(()=>{window.qaWorldCanvas=document.querySelector('#rpg canvas')});
 const checkWorld=async(name)=>{await p.keyboard.press('Escape');await p.waitForTimeout(200);assert.equal(await p.locator('canvas').count(),1);const info=await p.evaluate(()=>{const c=document.querySelector('#rpg').__rpgClient;let textures=0;const walk=n=>{if(n.texture&&!n.texture.destroyed)textures++;for(const q of n.children??[])walk(q)};walk(c.canvasApp.stage);return {sameCanvas:window.qaWorldCanvas===document.querySelector('#rpg canvas'),textures,contextLost:c.renderer.gl?.isContextLost(),graphics:c.getCurrentPlayer().graphics().length}});assert.ok(info.sameCanvas);assert.ok(info.textures>5);assert.equal(info.contextLost,false);assert.ok(info.graphics>0);assert.equal((await head()).activeChallenge,undefined);assert.deepEqual(errors,[]);await snap(name);report.cases.push({width,locale,name,...info});await writeFile(out+'/report.json',JSON.stringify(report,null,2));console.log(width,locale,name);};
 const drain=async()=>{for(let i=0;i<10;i++){const b=p.locator('.harbor-reply__next button');if(!await b.count())break;await b.click()}};
 const enter=async(kind)=>{if(!await p.locator('.harbor-panel').count())await p.locator('.harbor-action.is-ready').click();await drain();await button(...({sparring:['Start a friendly spar','开始友好切磋'],footwork:['Start footwork practice','开始走位练习'],endurance:['Try a twenty-second round','练习坚持二十秒']}[kind])).click();await p.locator('.harbor-combat').waitFor()};
 const start=async()=>{await button('How to play','看看怎么操作').click();await button('Start practice','开始练习').click();await p.locator('.harbor-combat__controls').waitFor()};
 const leave=async()=>{await button('Return','返回').click();await p.locator('.harbor-combat').waitFor({state:'detached'})};
 await p.goto('http://127.0.0.1:5304/?debug=1');await waitWorld();await markCanvas();await snap('world');
 // Leave while generated combat images are still loading; requests complete after unmount.
 await p.route('**/art/*combat*.png',async r=>{await new Promise(resolve=>setTimeout(resolve,1300));await r.continue().catch(()=>{})});
 await enter('sparring');await leave();await p.waitForTimeout(1600);await checkWorld('cancel-loading');await p.unroute('**/art/*combat*.png');
 await enter('sparring');await snap('goal');await button('How to play','看看怎么操作').click();await snap('controls-guide');await button('Start practice','开始练习').click();await p.waitForTimeout(300);await snap('playing');
 const bounds=await p.locator('.harbor-combat__controls').boundingBox();assert.ok(bounds.y>=0&&bounds.y+bounds.height<=height);const arena=await p.locator('.harbor-arena').boundingBox();assert.ok(arena.height>=150,JSON.stringify(arena));const canvas=await p.locator('.harbor-arena canvas').boundingBox();assert.ok(Math.abs(canvas.height-arena.height)<2&&Math.abs(canvas.width-arena.width)<2,JSON.stringify({canvas,arena}));
 await p.keyboard.down('ArrowLeft');await p.waitForTimeout(220);await p.keyboard.up('ArrowLeft');await button('Dodge','闪避').click();await p.waitForTimeout(60);await snap('dodge');await p.waitForTimeout(800);
 const old=actions.length;await button('Return','返回').evaluate(e=>{e.click();e.click();e.click()});await p.locator('.harbor-combat').waitFor({state:'detached'});assert.equal(actions.slice(old).filter(a=>a.action==='challenge-finish').length,1);await checkWorld('returned');
 if(width===320&&locale==='en'||width===390){
  // Refresh an active challenge. Resume explicitly; no invisible movement or checkpoint.
  await enter('sparring');await start();await p.reload();await waitWorld();await markCanvas();await button('How to play','看看怎么操作').waitFor();await leave();await checkWorld('refresh-active-return');
  // A lost practice exits using real recorded input, not a declared client outcome.
  await enter('sparring');await start();await button('Back to the club','回到拳馆').waitFor({timeout:25000});await snap('result-lost');await button('Back to the club','回到拳馆').click();await p.locator('.harbor-combat').waitFor({state:'detached'});await checkWorld('lost-return');
  // Reach the footwork goal with real keyboard input and the existing obstacles.
  await enter('footwork');await start();assert.equal(await button('Strike','出手').count(),0);
  const go=async(key,axis,op,value)=>{await p.keyboard.down(key);await p.waitForFunction(({axis,op,value})=>{const e=document.querySelector('.harbor-combat__actor--you');if(!e)return false;const n=parseFloat(e.style[axis]);return op==='lt'?n<value:n>value},{axis,op,value},{timeout:5000});await p.keyboard.up(key)};
  await go('ArrowLeft','left','lt',14);await go('ArrowUp','top','lt',10);await p.keyboard.down('ArrowRight');await button('Back to the club','回到拳馆').waitFor({timeout:6000});await p.keyboard.up('ArrowRight');await snap('footwork-won');await button('Back to the club','回到拳馆').click();await p.locator('.harbor-combat').waitFor({state:'detached'});assert.ok((await head()).flags.includes('challenge:footwork'));await checkWorld('footwork-return');
  // Uncertain finish: server commits, reply lost. Retry must recover original ID.
  let lost=false;await p.route('**/api/sessions/*/action',async r=>{if(!lost&&r.request().postDataJSON().action==='challenge-finish'){lost=true;await r.fetch();await r.abort('failed')}else await r.continue()});
  await enter('endurance');await start();await button('Return','返回').click();await button('Retry return','重试返回').waitFor();await snap('return-error');const attempt=actions.filter(a=>a.action==='challenge-finish').at(-1);await button('Retry return','重试返回').click();await p.locator('.harbor-combat').waitFor({state:'detached'});const recovered=actions.filter(a=>a.action==='challenge-finish').at(-1);assert.equal(recovered.action_id,attempt.action_id);assert.equal((await head()).history.filter(h=>h.id===attempt.action_id).length,1);await p.unroute('**/api/sessions/*/action');await checkWorld('retry-return');
  await p.reload();await waitWorld();await markCanvas();await checkWorld('refreshed');
 }
 assert.deepEqual(errors,[]);await c.close();
}assert.deepEqual(report.failedAssets,[]);report.status='passed';}finally{await writeFile(out+'/report.json',JSON.stringify(report,null,2));await browser.close()}
console.log(JSON.stringify(report));
