import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const out=process.env.HARBOR_B2_EVIDENCE;if(!out)throw Error('B2_EVIDENCE_REQUIRED');await mkdir(out,{recursive:true});
const report={scope:'actual Main bag, existing account/SQLite authority; synthetic fixtures; external requests blocked',cases:[],errors:[],modelCalls:0,mediaPosts:0,comprehension:'unverified'};
const browser=await chromium.launch({headless:true,executablePath:'/Users/yin/Library/Caches/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-mac-arm64/chrome-headless-shell',args:['--use-angle=swiftshader']});let page;
try{
 for(const fixture of ['hill','records','expired','batches'])for(const [width,height] of [[390,844],[320,568]])for(const locale of ['en','zh']){
  const record={fixture,width,height,locale};report.cases.push(record);const c=await browser.newContext({viewport:{width,height},locale:locale==='zh'?'zh-CN':'en-US'});
  await c.route('**/*',r=>['127.0.0.1','localhost'].includes(new URL(r.request().url()).hostname)||/^(blob|data):/.test(r.request().url())?r.continue():r.abort());await c.request.post('http://127.0.0.1:5441/qa/prepare?case='+fixture);
  const p=await c.newPage();page=p;p.on('pageerror',e=>report.errors.push(String(e)));await p.goto('http://127.0.0.1:5440/?debug=1');await p.waitForFunction(()=>document.querySelector('#rpg')?.__rpgClient?.getCurrentPlayer()&&!document.querySelector('.harbor-loading'));for(let i=0;i<3;i++)await p.locator('.harbor-opening button').click();
  const tx=(zh,en)=>locale==='zh'?zh:en;await p.getByRole('button',{name:tx('行囊','Bag'),exact:true}).click();await p.locator('.harbor-life-bag').waitFor();await p.locator('[data-life-batch]').first().waitFor();
  const dir=await(await c.request.get('http://127.0.0.1:5441/api/sessions')).json(),id=dir[0].id;const head=async()=>{const r=await c.request.get('http://127.0.0.1:5441/api/sessions/'+id);assert.equal(r.status(),200);return r.json()};const before=await head();
  const shot=async(name)=>{assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await p.screenshot({path:`${out}/${fixture}-${width}-${locale}-${name}-platform-layout.png`})};await shot('goods');
  if(fixture==='records'||fixture==='batches'){
   assert.match(await p.locator('[data-life-order]').innerText(),/3360/);assert.match(await p.locator('[data-life-order]').innerText(),/17:00/);
  }else if(fixture==='expired'){
   await p.getByRole('button',{name:tx('关闭过期订单 · 保留产物','Close expired order · keep produce'),exact:true}).click();await p.waitForFunction(()=>!document.querySelector('[data-life-order]'));
   const after=await head();assert.equal(after.lifeV1.order,undefined);assert.deepEqual(after.lifeV1.lots,before.lifeV1.lots);assert.deepEqual(after.items,before.items);assert.deepEqual([after.cash,after.energy,after.townMinutes],[before.cash,before.energy,before.townMinutes]);record.close='one version increment, produce and resources retained';await p.locator('.harbor-life-feedback[role=status]').waitFor();assert.equal(after.version,before.version+1);await shot('closed-order');
  }
  await p.getByRole('button',{name:tx('收藏','Collections'),exact:true}).click();await shot('records');
  if(fixture==='hill'){
   assert.match(await p.locator('.harbor-life-bag').innerText(),/No records yet|还没有登记/);assert.equal(before.lifeV1,undefined);
  }else{
   const seed=await p.locator('[data-life-record="seed:crop:basil"]').innerText();assert.match(seed,/0 physical seeds|实物 0 颗/);const gift=await p.locator('[data-life-record="gift:life-gift:theo-menu"]').innerText();assert.match(gift,/1 physical gifts|实物 1 件/);record.recordDoesNotCreateInventory=true;
  }
  if(fixture!=='expired'){assert.deepEqual(await head(),before);record.readOnly='opening bag/records did not write full head';}
  if(fixture==='hill'){
   await p.getByRole('button',{name:tx('种子与收成','Seeds & harvest'),exact:true}).click();const produce=p.locator('[data-life-batch="crop:basil@1:produce"]');await produce.getByRole('button').click();await p.waitForFunction(()=>document.querySelector('[data-life-batch="crop:basil@1:produce"] strong')?.textContent.includes('×2'));
   const after=await head();assert.equal(after.items['crop-basil'],2);assert.equal(after.items['seed-basil'],3);assert.equal(after.version,before.version+1);assert.ok(after.lifeV1.collections['seed:crop:basil']);assert.deepEqual([after.cash,after.energy,after.townMinutes],[before.cash,before.energy,before.townMinutes]);record.saveSeed='3 harvest -> 2; 2 seeds -> 3; one authority version';await p.locator('.harbor-life-feedback[role=status]').waitFor();
   await p.getByRole('button',{name:tx('收藏','Collections'),exact:true}).click();assert.match(await p.locator('[data-life-record="seed:crop:basil"]').innerText(),/3 physical seeds|实物 3 颗/);await shot('saved-seed-record');
  }
  if(fixture==='batches'){
   await p.getByRole('button',{name:tx('种子与收成','Seeds & harvest'),exact:true}).click();assert.equal(await p.locator('[data-life-batch="crop:snap-pea@1:produce"]').count(),1);const v2=p.locator('[data-life-batch="crop:snap-pea@2:produce"]');assert.match(await v2.innerText(),/deliberately long|长标签/);await v2.scrollIntoViewIfNeeded();await shot('v2-long-label');await v2.getByRole('button').click();await p.waitForFunction(()=>document.querySelector('[data-life-batch="crop:snap-pea@2:seed"] strong')?.textContent.includes('×1'));const after=await head();assert.equal(after.lifeV1.lots.find(l=>l.ref.id==='crop:snap-pea'&&l.ref.revision===1&&l.kind==='produce').quantity,2);assert.equal(after.lifeV1.lots.find(l=>l.ref.id==='crop:snap-pea'&&l.ref.revision===1&&l.kind==='seed').quantity,2);assert.equal(after.lifeV1.collections['seed:crop:snap-pea'].ref.revision,2);record.pinnedBatches='normal v2 save-seed consumes v2 only; v1 quantities unchanged';await p.locator('[data-life-batch="crop:snap-pea@2:seed"]').scrollIntoViewIfNeeded();await shot('v2-saved');
  }
  await p.getByRole('button',{name:tx('种子与收成','Seeds & harvest'),exact:true}).click();const scroller=p.locator('.harbor-panel__body'),box=await scroller.boundingBox();assert.ok(box);await p.mouse.move(box.x+box.width/2,box.y+box.height/2);await p.mouse.wheel(0,500);await p.waitForTimeout(180);record.scroll=await scroller.evaluate(e=>({top:e.scrollTop,height:e.scrollHeight,client:e.clientHeight}));assert.ok(record.scroll.top>0);await shot('scrolled');
  record.buttons=await p.locator('.harbor-life-bag button').evaluateAll(es=>es.map(e=>({label:e.textContent,w:e.getBoundingClientRect().width,h:e.getBoundingClientRect().height})));assert.ok(record.buttons.every(b=>b.w>=43.99&&b.h>=43.99));record.result='pass';await c.close();
 }
 assert.deepEqual(report.errors,[]);report.result='pass';
}catch(e){report.result='failed';report.failure=String(e);if(page&&!page.isClosed()){report.failureText=await page.locator('body').innerText();await page.screenshot({path:out+'/bag-failure-platform-layout.png'})}throw e}finally{await writeFile(out+'/bag-report.json',JSON.stringify(report,null,2));await browser.close()}
console.log(JSON.stringify({result:report.result,cases:report.cases.length,errors:report.errors}));
