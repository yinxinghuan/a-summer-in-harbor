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
try{
for(const [name,width,height,locale] of [['owen',320,568,'en'],['dani',390,844,'zh'],['evening',1024,768,'en'],['evening',1440,900,'en']]){
 const {c,p}=await open(name,width,height,locale);await p.locator('.harbor-action.is-ready').waitFor();await snap(p,`${name}-${width}-final`);await p.locator('.harbor-action').click();if(name!=='evening'){await p.locator('.harbor-reply').waitFor();await doneReading(p,locale)}await snap(p,`${name}-${width}-conversation-final`);assert.ok(await p.locator('#harbor-question').isVisible());report.cases.push({name,width,height,locale,events:await events(p),head:await head(p)});await c.close();
}
assert.deepEqual(report.errors,[]);
}finally{await writeFile(out+'/browser-extra-report.json',JSON.stringify(report,null,2));await browser.close()}
console.log(JSON.stringify({cases:report.cases.length,errors:report.errors},null,2));
