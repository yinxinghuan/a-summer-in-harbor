import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const out=new URL('../doc/qa/examples-20261004/',import.meta.url);await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:'/Users/yin/Library/Caches/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-mac-arm64/chrome-headless-shell',args:['--use-angle=swiftshader']});
const report={cases:[],errors:[],blockedExternal:[],syntheticAuthority:true,modelCalls:0};
const text={en:{give:'Give an example',next:'Another example',keep:'Keep my draft',replace:'Replace draft with this',send:'Send question',close:'Close',menu:'Menu',reload:'Reload progress'},zh:{give:'举个例子',next:'换个例子',keep:'保留我的草稿',replace:'用这个替换草稿',send:'发送问题',close:'关闭',menu:'菜单',reload:'重新读取进度'}};
async function context(viewport){const c=await browser.newContext({viewport});await c.route('**/*',route=>{const u=new URL(route.request().url());if(['127.0.0.1','localhost'].includes(u.hostname)||['data:','blob:'].includes(u.protocol))return route.continue();report.blockedExternal.push(u.origin);return route.abort()});return c}
async function open(page,locale,person='mara',stage='returned'){
 page.on('pageerror',e=>report.errors.push(String(e)));
 await page.goto(`http://127.0.0.1:5249/_qa/examples-review.html?locale=${locale}&person=${person}&stage=${stage}`);
 await page.locator('.harbor-action.is-ready').waitFor({timeout:30000});await page.locator('.harbor-action').click();
 await page.getByRole('button',{name:text[locale].give,exact:true}).waitFor();
}
async function screen(page,name){await page.screenshot({path:new URL(name+'.png',out).pathname});}
try{
for(const [locale,width,height] of [['en',390,844],['zh',390,844],['en',320,568],['zh',320,568],['en',1024,768],['zh',1440,900]]){
 const c=await context({width,height}),p=await c.newPage(),t=text[locale];await open(p,locale);
 const input=p.locator('#harbor-question'),give=p.getByRole('button',{name:t.give,exact:true});
 await give.focus();await give.press('Enter');const a=await input.inputValue();assert.ok(a.length);assert.match(a,locale==='en'?/back/:/交还/);assert.equal(await p.evaluate(()=>document.activeElement?.id),'harbor-question');
 await p.getByRole('button',{name:t.next,exact:true}).click();const b=await input.inputValue();assert.notEqual(a,b);
 await p.getByRole('button',{name:t.next,exact:true}).click();assert.equal(await input.inputValue(),a);
 await screen(p,`${locale}-${width}-example-platform-layout`);
 await input.fill(locale==='en'?'I wrote this myself. Please keep it.':'这是我自己写的内容，请保留。');const mine=await input.inputValue();
 await p.getByRole('button',{name:t.next,exact:true}).click();assert.equal(await input.inputValue(),mine);
 await screen(p,`${locale}-${width}-draft-confirm-platform-layout`);
 await p.getByRole('button',{name:t.keep,exact:true}).click();assert.equal(await input.inputValue(),mine);
 await p.getByRole('button',{name:t.next,exact:true}).click();await p.getByRole('button',{name:t.replace,exact:true}).click();assert.notEqual(await input.inputValue(),mine);
 assert.equal(await p.evaluate(()=>document.activeElement?.id),'harbor-question');
 const counts=await p.evaluate(()=>window.__qaExamples.asks.length);assert.equal(counts,0,'examples must not send');
 // Reopen and refresh keep existing per-journey/person draft. Restored draft is not owned by helper.
 const chosen=await input.inputValue();await p.getByRole('button',{name:t.close,exact:true}).click();await p.locator('.harbor-action').click();await p.waitForFunction(v=>document.querySelector('#harbor-question')?.value===v,chosen);assert.equal(await input.inputValue(),chosen);
 await p.reload();await p.locator('.harbor-action.is-ready').waitFor();await p.locator('.harbor-action').click();await p.waitForFunction(v=>document.querySelector('#harbor-question')?.value===v,chosen);assert.equal(await input.inputValue(),chosen);
 await p.getByRole('button',{name:t.give,exact:true}).click();assert.equal(await input.inputValue(),chosen);assert.ok(await p.getByRole('button',{name:t.keep,exact:true}).isVisible());await p.getByRole('button',{name:t.keep,exact:true}).click();
 await p.getByRole('button',{name:t.send,exact:true}).click();assert.ok(await p.getByRole('button',{name:t.next,exact:true}).isDisabled());assert.ok(await input.isDisabled());
 await p.locator('.harbor-error').waitFor();assert.equal(await input.inputValue(),chosen);assert.equal(await p.evaluate(()=>window.__qaExamples.asks.length),1);
 const bounds=await p.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,canvases:document.querySelectorAll('canvas').length}));assert.ok(bounds.scroll<=bounds.width);assert.equal(bounds.canvases,1);
 report.cases.push({locale,width,height,cycled:true,nonDestructive:true,reopenReload:true,focus:true,manualSendFailureOnly:true,bounds});await c.close();
}
// Every actual NPC entry (including post-onboarding) in the real App / renderer.
for(const person of ['theo','june','idris','ruth','luis','nell','elena','arthur']){
 const c=await context({width:390,height:844}),p=await c.newPage();await open(p,'en',person);await p.getByRole('button',{name:'Give an example',exact:true}).click();assert.ok((await p.locator('#harbor-question').inputValue()).length);assert.equal(await p.evaluate(()=>window.__qaExamples.asks.length),0);
 if(person==='june'||person==='theo')await screen(p,`${person}-390-platform-layout`);
 report.cases.push({person,actualApp:true,examplePresent:true,noRequests:true});await c.close();
}
// Reloading new authoritative progress invalidates old suggestion state, not the draft.
{
 const c=await context({width:390,height:844}),p=await c.newPage();await open(p,'en','mara','arrival');
 await p.getByRole('button',{name:'Give an example',exact:true}).click();const old=await p.locator('#harbor-question').inputValue();assert.match(old,/arrived/);
 await p.getByRole('button',{name:'Close',exact:true}).click();await p.evaluate(()=>window.__qaExamples.setFlags(['key','unpacked','bag-returned']));await p.getByRole('button',{name:'Menu',exact:true}).click();await p.getByRole('button',{name:'Reload progress',exact:true}).click();await p.locator('.harbor-action.is-ready').waitFor();await p.locator('.harbor-action').click();await p.getByRole('button',{name:'Give an example',exact:true}).click();
 assert.equal(await p.locator('#harbor-question').inputValue(),old);assert.match(await p.locator('.harbor-example-assist__preview p').innerText(),/back/);
 report.cases.push({progressReload:true,oldDraftPreserved:true,newExampleUsesCompletion:true});await c.close();
}
for(const locale of ['zh','en']){
 const c=await context({width:320,height:568}),p=await c.newPage();await p.goto(`http://127.0.0.1:5249/_qa/examples-stress.html?locale=${locale}`);await p.getByRole('button',{name:text[locale].give,exact:true}).click();await screen(p,`${locale}-320-long-preview`);
 await p.getByRole('button',{name:text[locale].next,exact:true}).click();assert.equal(await p.locator('#stress-input').inputValue(),'My existing draft');
 assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await p.locator('.harbor-choices button').last().click();await p.getByRole('button',{name:'Close',exact:true}).click();assert.ok(await p.getByRole('button',{name:text[locale].next,exact:true}).isDisabled());
 report.cases.push({locale,stressLong:true,unbroken:true,eighthOptionReachable:true,disabled:true});await c.close();
}
assert.equal(report.errors.length,0);
}finally{await writeFile(new URL('browser-report.json',out),JSON.stringify(report,null,2));await browser.close()}
console.log(JSON.stringify(report,null,2));
