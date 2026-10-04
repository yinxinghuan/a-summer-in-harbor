import {chromium} from 'playwright';import assert from 'node:assert/strict';import {mkdir,writeFile} from 'node:fs/promises';
const out='doc/residents-20261004/qa';await mkdir(out,{recursive:true});
const report={authority:'real local SQLite, synthetic player fixtures',externalModelCalls:0,errors:[],cases:[]};
const browser=await chromium.launch({headless:true,executablePath:'/Users/yin/Library/Caches/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-mac-arm64/chrome-headless-shell',args:['--use-angle=swiftshader']});
const base='/e78df027-7ef4-4d49-82eb-ea91f03d9fb3/api';
async function open(name,width=390,height=844,locale='en'){
 const c=await browser.newContext({viewport:{width,height},locale:locale==='zh'?'zh-CN':'en-US'});await c.route('**/*',r=>['127.0.0.1','localhost'].includes(new URL(r.request().url()).hostname)||/^(blob|data):/.test(r.request().url())?r.continue():r.abort());
 const seed=await c.request.post(`http://127.0.0.1:5258/qa/prepare?case=${name}&locale=${locale}`),s=await seed.json();assert.ok(s.id,JSON.stringify(s));
 await c.addInitScript(({id,locale})=>addEventListener('DOMContentLoaded',()=>{window.alteruLocalStorage?.setItem('harbor-opening:'+id,'3');window.alteruLocalStorage?.setItem('harbor-locale',locale);window.alteruLocalStorage?.setItem('harbor-muted','1')}),{id:s.id,locale});
 const p=await c.newPage();p.on('pageerror',e=>report.errors.push(String(e)));await p.goto('http://127.0.0.1:5257/?debug=1');await p.locator('canvas').waitFor();await p.waitForFunction(()=>document.querySelector('#rpg')?.__rpgClient?.sceneMap?.events&& !document.querySelector('.harbor-loading'));await p.waitForTimeout(300);
 return {c,p,s};
}
const events=p=>p.evaluate(()=>Object.entries(document.querySelector('#rpg').__rpgClient.sceneMap.events()).filter(([id])=>id.startsWith('person-')||id==='prop-garden-growing-fern').map(([id,e])=>({id,x:e.x(),y:e.y(),graphics:e.graphics(),pose:e.animationName(),direction:e.direction(),bounds:e.__rpgjsGraphicBounds})));
const snap=async(p,name)=>{await p.waitForTimeout(800);assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await p.screenshot({path:`${out}/${name}-platform-layout.png`})};
const head=async p=>p.evaluate(async base=>{const list=await(await fetch(base+'/sessions')).json();return (await fetch(base+'/sessions/'+list[0].id)).json()},base);
async function doneReading(p,locale='en'){for(let i=0;i<8&&await p.locator('.harbor-reply').count();i++)await p.locator('.harbor-reply__next button').click()}
async function refresh(p){await p.reload();await p.waitForFunction(()=>document.querySelector('#rpg')?.__rpgClient&&!document.querySelector('.harbor-loading'))}
async function journal(p,locale){if(await p.locator('.harbor-panel').count())await p.getByRole('button',{name:locale==='en'?'Close':'关闭',exact:true}).click();await p.getByRole('button',{name:locale==='en'?'Menu':'菜单',exact:true}).click();await p.getByRole('button',{name:locale==='en'?'Your journal':'旅行手记',exact:true}).click()}
try{
 for(const [width,height,locale] of [[390,844,'en'],[320,568,'zh']]){
  const {c,p}=await open('schedule-learning',width,height,locale);await p.locator('.harbor-action.is-ready').waitFor();await p.locator('.harbor-action').click();await doneReading(p);const draft=locale==='en'?'A draft I want to keep.':'这段草稿我要留着。';await p.locator('#harbor-question').fill(draft);
  await p.getByRole('button',{name:locale==='en'?'Where do you usually spend your day?':'平时在哪些地方能遇到你？',exact:true}).click();await p.locator('.harbor-reply').waitFor();await doneReading(p);assert.equal(await p.locator('#harbor-question').inputValue(),draft);
  await journal(p,locale);assert.equal(await p.locator('.harbor-resident-guide').count(),1);await snap(p,`schedule-learned-${width}`);const h=await head(p);assert.equal(h.townMinutes,710);assert.ok(h.flags.includes('talk:samira:routine'));report.cases.push({name:'learned routine without losing draft',width,locale});await c.close();
  const next=await open('schedule-known',width,height,locale);await journal(next.p,locale);await snap(next.p,`schedule-invitation-${width}`);assert.match(await next.p.locator('.harbor-neighbors').innerText(),locale==='en'?/three-hour nap/:/小睡三小时/);
  await next.p.locator('.harbor-resident-guide button').click();assert.match(await next.p.locator('.harbor-arrival-hints').innerText(),locale==='en'?/Harbor/:/港口/);await next.p.locator('.harbor-map-destination').scrollIntoViewIfNeeded();await snap(next.p,`schedule-arrival-${width}`);assert.equal((await head(next.p)).townMinutes,710);
  await journal(next.p,locale);await next.p.getByRole('button',{name:locale==='en'?'Find Fishing Pier on the map':'在地图上查看钓鱼码头',exact:true}).click();assert.ok(await next.p.getByRole('button',{name:locale==='en'?'Go here':'前往这里',exact:true}).isDisabled());await snap(next.p,`schedule-locked-pier-${width}`);report.cases.push({name:'arrival warning and locked destination',width,locale});await next.c.close();
 }
 const {c,p}=await open('schedule-hidden',320,568,'zh');await journal(p,'zh');assert.equal(await p.locator('.harbor-resident-guide').count(),0);assert.equal(await p.getByRole('button',{name:'在地图上查看',exact:true}).count(),0);report.cases.push({name:'no unlearned itinerary'});await c.close();assert.deepEqual(report.errors,[]);
}finally{await writeFile(out+'/browser-guide-report.json',JSON.stringify(report,null,2));await browser.close()}
console.log(JSON.stringify({cases:report.cases.length,errors:report.errors},null,2));
