import {chromium} from 'playwright';import assert from 'node:assert/strict';import {writeFile} from 'node:fs/promises';
const browser=await chromium.launch({headless:true,executablePath:'/Users/yin/Library/Caches/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-mac-arm64/chrome-headless-shell',args:['--use-angle=swiftshader']});
const results=[];
try{for(const locale of ['en','zh']){
 const c=await browser.newContext({viewport:{width:320,height:568},hasTouch:true});await c.route('**/*',r=>new URL(r.request().url()).hostname==='127.0.0.1'?r.continue():r.abort());const p=await c.newPage();
 await p.goto(`http://127.0.0.1:5249/_qa/examples-review.html?locale=${locale}&reading=1`);await p.locator('.harbor-action.is-ready').waitFor();await p.locator('.harbor-action').tap();
 await p.locator('.harbor-reply__next button').waitFor();assert.equal(await p.locator('.harbor-example-assist').count(),0);
 let pages=0;while(await p.locator('.harbor-reply__next button').count()){const before=await p.locator('.harbor-reply__next').textContent();await p.locator('.harbor-reply__next button').tap();await p.waitForFunction(v=>document.querySelector('.harbor-reply__next')?.textContent!==v,before);pages++;assert.ok(pages<20)}
 assert.ok(pages>1);await p.locator('.harbor-suggestion').tap();const input=p.locator('#harbor-question'),filled=await input.inputValue();assert.ok(filled.length);
 await input.fill('An edited draft must not disappear.');await p.locator('.harbor-suggestion').dblclick();assert.equal(await input.inputValue(),'An edited draft must not disappear.');
 assert.ok(await p.locator('.harbor-example-assist__preview').isVisible());
 // Emulate reduced available height while editing, not a claim about native iOS keyboard.
 await p.setViewportSize({width:320,height:370});await p.locator('.harbor-example-assist__actions button').last().click();await input.focus();await p.keyboard.press('End');await input.scrollIntoViewIfNeeded();await p.screenshot({path:`doc/qa/examples-20261004/${locale}-320-short-editing-platform-layout.png`});
 assert.ok(await p.getByRole('button',{name:locale==='en'?'Close':'关闭',exact:true}).isVisible());assert.equal(await p.evaluate(()=>window.__qaExamples.asks.length),0);
 results.push({locale,pages,readingGate:true,touchActivation:true,rapidClickDraftSafe:true,shortEditingViewport:true,requests:0});await c.close();
}}finally{await browser.close()}
await writeFile('doc/qa/examples-20261004/boundary-report.json',JSON.stringify(results,null,2));console.log(JSON.stringify(results));
