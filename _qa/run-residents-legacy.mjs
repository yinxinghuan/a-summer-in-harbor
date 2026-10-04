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
 const {c,p,s}=await open('legacy-overlap');
 const before=await head(p),actor=(await events(p)).find(e=>e.id==='person-samira');
 assert.equal(before.townMinutes,undefined);assert.deepEqual(before.position,{x:542,y:424});assert.ok(Math.abs(actor.x-550)===24);assert.equal(actor.y,430);
 await snap(p,'legacy-overlap-resident-cleared');
 await p.keyboard.down('ArrowDown');await p.waitForTimeout(950);await p.keyboard.up('ArrowDown');await p.waitForTimeout(1200);
 const after=await head(p);assert.ok(after.position.y>before.position.y+40,JSON.stringify({before:before.position,after:after.position}));
 assert.deepEqual(after.flags,before.flags);assert.deepEqual(after.items,before.items);assert.equal(after.townMinutes,undefined);
 await snap(p,'legacy-overlap-player-exited');report.cases.push({name:'legacy-overlap',actor,before,after});assert.deepEqual(report.errors,[]);await c.close();
}finally{await writeFile(out+'/browser-legacy-overlap.json',JSON.stringify(report,null,2));await browser.close()}
console.log(JSON.stringify({cases:report.cases.length,errors:report.errors},null,2));
