// Historical baseline harness for 02dd6db (old UI labels). Do not run against the fixed UI.
import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
const out='doc/qa/combat-20261005/before';await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:'/Users/yin/Library/Caches/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-mac-arm64/chrome-headless-shell',args:['--use-angle=swiftshader']});
const report={errors:[],states:[]};
try{for(const width of [320,390]){
 const c=await browser.newContext({viewport:{width,height:width===320?568:844},locale:'en-US'});
 await c.route('**/*',r=>['127.0.0.1','localhost'].includes(new URL(r.request().url()).hostname)||/^(blob|data):/.test(r.request().url())?r.continue():r.abort());
 const s=await(await c.request.post('http://127.0.0.1:5305/qa/prepare?case=combat')).json();
 await c.addInitScript(id=>addEventListener('DOMContentLoaded',()=>{window.alteruLocalStorage?.setItem('harbor-opening:'+id,'3');window.alteruLocalStorage?.setItem('harbor-locale','en');window.alteruLocalStorage?.setItem('harbor-muted','1')}),s.id);
 const p=await c.newPage();p.on('pageerror',e=>report.errors.push({width,error:e.stack}));
 await p.goto('http://127.0.0.1:5304/?debug=1');await p.waitForFunction(()=>document.querySelector('#rpg')?.__rpgClient?.getCurrentPlayer()&&!document.querySelector('.harbor-loading'));await p.waitForTimeout(2000);
 const snap=async name=>{report.states.push({width,name,...await p.evaluate(()=>{const e=document.querySelector('#rpg').__rpgClient,a=e.canvasApp;const walk=n=>({type:n.constructor.name,visible:n.visible,renderable:n.renderable,destroyed:n.destroyed,children:(n.children??[]).map(walk)});return {canvases:document.querySelectorAll('canvas').length,rendererDestroyed:!a.renderer,tickerStarted:a.ticker?.started,contextLost:a.renderer?.gl?.isContextLost(),stage:walk(a.stage),body:document.body.innerText}})});await p.screenshot({path:`${out}/${name}-${width}-platform-layout.png`})};
 await snap('world');await p.locator('.harbor-action.is-ready').click();await p.getByRole('button',{name:'Start a friendly spar',exact:true}).click();await p.getByRole('button',{name:'Ready—begin',exact:true}).waitFor();await snap('ready');await p.getByRole('button',{name:'Ready—begin',exact:true}).click();await p.keyboard.down('ArrowUp');await p.waitForTimeout(450);await p.keyboard.up('ArrowUp');await p.getByRole('button',{name:'Strike',exact:true}).click();await p.getByRole('button',{name:'Stop',exact:true}).click();await p.locator('.harbor-combat').waitFor({state:'detached'});await p.keyboard.press('Escape');await p.waitForTimeout(800);await snap('returned');
 await p.reload();await p.waitForFunction(()=>document.querySelector('#rpg')?.__rpgClient?.getCurrentPlayer()&&!document.querySelector('.harbor-loading'));await p.waitForTimeout(1000);await snap('refreshed');await c.close();
}}finally{await writeFile(out+'/report.json',JSON.stringify(report,null,2));await browser.close()}
console.log(JSON.stringify({errors:report.errors,states:report.states.map(({stage,body,...s})=>s)}));
