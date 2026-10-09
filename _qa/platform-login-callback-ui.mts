// @ts-nocheck -- isolated synthetic auth response; all real auth/model network blocked.
import {chromium} from 'playwright';import {makeDemoServer} from './temporary-account-server';import {createExplorationAssembly} from '../server/exploration-assembly';import {createReviewedAnimalLife} from '../server/reviewed-animal-life';import {withBasilPlantUses} from '../server/plant-basil';import {withWildMint} from '../server/wild-mint';import {mkdtempSync,readFileSync,existsSync,rmSync} from 'node:fs';import {mkdir,writeFile} from 'node:fs/promises';import {resolve,extname} from 'node:path';import assert from 'node:assert/strict';
const pass=process.env.HARBOR_CALLBACK_PASS??'before',out='../evidence/login-real-diagnosis/callback-'+pass;await mkdir(out,{recursive:true});
const shellRoot='/Users/yin/code/games/harbor-animal-ai-owner-aba82cc-20261009/evidence';const loader=readFileSync(shellRoot+'/guest-shell-public-20261009.js'),impl=readFileSync(shellRoot+'/guest-shell-impl-public-20261009.js');
const report={atUtc:new Date().toISOString(),scope:'original pinned public guest-shell + actual compiled Main + isolated account-only SQLite. Auth response, email, code, token, ID all synthetic local fixtures; external API calls0; user Chrome5596 untouched.',cases:[],errors:[],realAuthRequests:0,productionWrites:0};
const directory=mkdtempSync('/tmp/harbor-callback-local-'),assembly=createExplorationAssembly({createLife:createReviewedAnimalLife,crabEnabled:true,resolveDialogue:async()=>{throw Error('MODEL_DISABLED')},decorateLife:life=>withWildMint(withBasilPlantUses(life,{enabled:true}),{enabled:true})});
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.json':'application/json','.svg':'image/svg+xml','.tmx':'application/xml','.woff2':'font/woff2','.ttf':'font/ttf','.mp3':'audio/mpeg'};let server,browser;
try{
 server=await makeDemoServer({directory,accountOnly:true,providedRuntime:assembly.runtime,lifeProject:assembly.lifeProject,landProject:assembly.landProject,decorateAuthority:assembly.decorateAuthority});
 browser=await chromium.launch({headless:true,executablePath:'/Users/yin/Library/Caches/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-mac-arm64/chrome-headless-shell',args:['--use-angle=swiftshader','--disk-cache-size=1']});
 for(const mode of ['normal','stats-pending','stats-failure','identity-missing']){
  const c=await browser.newContext({viewport:{width:390,height:844},locale:'en-US',serviceWorkers:'block'});let pendingRelease,statsHeld=false,loginResponse=false,gameCreates=0;
  await c.route('**/*',async r=>{const q=r.request(),u=new URL(q.url());
   if(u.hostname==='images.aiwaves.tech'&&u.pathname.endsWith('/guest-shell.js'))return r.fulfill({contentType:'text/javascript',body:loader});
   if(u.hostname==='images.aiwaves.tech'&&u.pathname.endsWith('/guest-shell.impl.js'))return r.fulfill({contentType:'text/javascript',body:impl});
   if(u.pathname==='/note/aigram/email/code/login'){loginResponse=true;return r.fulfill({contentType:'application/json',body:JSON.stringify({retcode:0,data:{token:'LOCAL_FIXTURE_NOT_A_REAL_TOKEN',user:mode==='identity-missing'?{}:{telegram_id:'740101'}}})})}
   if(u.pathname==='/note/aigram/ai/game/get/play/stats'){
    if(mode==='stats-pending'){statsHeld=true;await new Promise(res=>pendingRelease=res)}
    return r.fulfill({status:mode==='stats-failure'?503:200,contentType:'application/json',body:JSON.stringify(mode==='stats-failure'?{msg:'LOCAL_STATS_FAILURE'}:{retcode:0,data:{}})}).catch(()=>{});
   }
   if(u.hostname!=='127.0.0.1')return r.abort();
   if(u.pathname.includes('/api/')){if(u.pathname.endsWith('/sessions')&&q.method()==='POST')gameCreates++;return r.fulfill({response:await r.fetch()})}
   const file=resolve('dist','.'+(u.pathname==='/'?'/index.html':u.pathname));if(!file.startsWith(resolve('dist')+'/')||!existsSync(file))return r.fulfill({status:404,body:'Missing'});return r.fulfill({contentType:mime[extname(file)]??'application/octet-stream',body:readFileSync(file)});
  });
  await c.addInitScript(()=>{window.__name=f=>f;localStorage.setItem('harbor-locale','en')});const p=await c.newPage();p.setDefaultTimeout(12000);p.on('pageerror',e=>report.errors.push(String(e)));await p.goto(server.url+'/?debug=1');await p.getByRole('button',{name:'Sign in to start',exact:true}).click();
  const modal=p.locator('#alteru-guest-login');await modal.waitFor();await modal.locator('#alteru-guest-agree').check();await modal.getByRole('button',{name:'Login with Email',exact:true}).click();await modal.locator('[data-email]').fill('local-qa@example.invalid');await modal.locator('[data-otp]').fill('000000');await modal.locator('[data-login]').click();await modal.waitFor({state:'detached'});assert.equal(loginResponse,true);await p.waitForTimeout(450);
  const state=await p.evaluate(()=>({liveIdValid:/^[1-9][0-9]{0,19}$/.test(String(window.Aigram?.telegramId??'')),modalClosed:!document.querySelector('#alteru-guest-login'),busy:document.querySelector('main')?.getAttribute('aria-busy'),newVisible:[...document.querySelectorAll('main button')].some(b=>b.textContent==='New game'),errorVisible:!!document.querySelector('main [role=alert]')}));
  if(mode!=='identity-missing'){
   await p.getByRole('button',{name:'New game',exact:true}).waitFor();await p.getByRole('button',{name:'New game',exact:true}).click();await p.waitForTimeout(450);state.newStarted=gameCreates===1;
   if(pass.startsWith('after'))assert.equal(state.newStarted,true,mode);else if(mode==='stats-pending')assert.equal(state.newStarted,false,'old candidate silently blocks New while stats response remains pending');else assert.equal(state.newStarted,true,mode);
  }else{assert.equal(state.liveIdValid,false);assert.equal(state.newVisible,false);assert.equal(gameCreates,0)}
  await p.addStyleTag({content:'#alteru-guest-banner{display:none!important}'});await p.evaluate(async()=>{await document.fonts.ready;await Promise.allSettled([...document.images].map(i=>i.decode()))});await p.screenshot({path:out+'/'+mode+'.png'});report.cases.push({mode,...state,statsHeld,gameCreates});pendingRelease?.();await c.close();
 }
 assert.deepEqual(report.errors,[]);report.result='PASS';
}catch(e){report.result='FAIL';report.failure=String(e);process.exitCode=1}
finally{await browser?.close();await server?.close();rmSync(directory,{recursive:true,force:true});await writeFile(out+'/report.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report))}
