import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const out='../evidence/crop-consumer-final';await mkdir(out,{recursive:true});
const art=JSON.parse(await readFile('src/world/snap-pea-art.json','utf8'));
for(const file of Object.values(art.files))assert.equal(createHash('sha256').update(await readFile('public/'+file.image.slice(2))).digest('hex'),file.sha256);
const report={scope:'Actual Main/View/RPGJS, original guarded account transport and isolated synthetic SQLite; crop renderer/profile/item contract only',modelCalls:0,mediaPosts:0,productionAccess:false,physicalPhone:false,cases:[],errors:[]};
const browser=await chromium.launch({headless:true,executablePath:'/Users/yin/Library/Caches/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-mac-arm64/chrome-headless-shell',args:['--use-angle=swiftshader']});
const specs=[];
for(const region of ['courtyard','hill'])for(const stage of ['young','growing','ready'])for(const width of [320,390])specs.push({region,stage,width,locale:'en'});
for(const region of ['courtyard','hill'])for(const width of [320,390])specs.push({region,stage:'ready',width,locale:'zh'});
for(const width of [320,390])for(const locale of ['en','zh'])specs.push({region:'courtyard',stage:'old',width,locale});
let page;
try{for(const spec of specs){
 const {region,stage,width,locale}=spec,height=width===320?568:844,fixture='plants-'+(region==='hill'?'hill-':'')+stage,record={...spec,fixture};report.cases.push(record);
 const c=await browser.newContext({viewport:{width,height},locale:locale==='zh'?'zh-CN':'en-US'});
 await c.route('**/*',r=>['127.0.0.1','localhost'].includes(new URL(r.request().url()).hostname)||/^(blob|data):/.test(r.request().url())?r.continue():r.abort());
 assert.equal((await c.request.post('http://127.0.0.1:5511/qa/prepare?case='+fixture)).status(),200);
 page=await c.newPage();page.on('pageerror',e=>report.errors.push(String(e)));await page.goto('http://127.0.0.1:5510/?debug=1');
 await page.waitForFunction(()=>document.querySelector('#rpg')?.__rpgClient?.getCurrentPlayer()&&!document.querySelector('.harbor-loading'));
 for(let i=0;i<3;i++)await page.locator('.harbor-opening button').click();
 const [journey]=await(await c.request.get('http://127.0.0.1:5511/api/sessions')).json(),read=async()=>await(await c.request.get('http://127.0.0.1:5511/api/sessions/'+journey.id)).json(),before=await read();
 await page.waitForTimeout(350);record.rendered=await page.evaluate(()=>{
  const client=document.querySelector('#rpg').__rpgClient,textures=[];
  const visit=n=>{if(n.texture?.source?.label?.startsWith('prop-life-snap-pea-v2-')&&n.visible!==false&&(n.getGlobalAlpha?.()??1)>0){const b=n.getBounds();textures.push({label:n.texture.source.label,width:n.texture.source.width,height:n.texture.source.height,anchor:{x:n.anchor.x,y:n.anchor.y},scale:{x:n.scale.x,y:n.scale.y},bounds:{x:b.x,y:b.y,w:b.width,h:b.height}})}for(const child of n.children??[])visit(child)};visit(client.canvasApp.stage);
  return {events:Object.entries(client.sceneMap.events()).map(([id,a])=>({id,x:a.x(),y:a.y(),graphics:a.graphics()})),textures};
 });
 const bed=before.landV1.plots[0],plant=record.rendered.events.find(e=>e.id==='prop-life-bed-1'),soil=record.rendered.events.find(e=>e.id==='prop-land-bed-1');
 assert.deepEqual([plant.x,plant.y,soil.x,soil.y],[bed.at.x,bed.at.y-12,bed.at.x,bed.at.y-24]);
 if(stage==='old'){assert.deepEqual(plant.graphics,[]);assert.equal(record.rendered.textures.length,0);record.oldPinDoesNotBorrowNewArt=true}
 else{assert.deepEqual(plant.graphics,['prop-life-snap-pea-v2-'+stage]);const t=record.rendered.textures.find(t=>t.label==='prop-life-snap-pea-v2-'+stage+'.png');assert.ok(t);assert.deepEqual([t.width,t.height,t.anchor.x,t.anchor.y],[256,256,127.5/256,217/256]);assert.ok(Math.abs(t.scale.x-art.profile.scale)<1e-12&&Math.abs(t.scale.y-art.profile.scale)<1e-12)}
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await page.screenshot({path:out+`/${region}-${stage}-${width}-${locale}-world-platform-layout.png`});
 if(stage==='ready'){
  await page.getByRole('button',{name:locale==='zh'?'行囊':'Bag',exact:true}).click();await page.locator('[data-life-batch="crop:snap-pea@2:seed"] img').waitFor();await page.locator('[data-life-batch="crop:snap-pea@2:produce"] img').waitFor();
  record.items=await page.locator('img[data-crop-source*="life-snap-pea-v2"]').evaluateAll(es=>es.map(e=>({source:e.dataset.cropSource,w:e.getBoundingClientRect().width,h:e.getBoundingClientRect().height,loaded:e.complete&&e.naturalWidth===256})));
  assert.equal(record.items.length,2);assert.ok(record.items.every(e=>e.w===64&&e.h===64&&e.loaded));
  await page.locator('[data-life-batch="crop:snap-pea@2:produce"]').scrollIntoViewIfNeeded();await page.screenshot({path:out+`/${region}-${stage}-${width}-${locale}-bag-platform-layout.png`});
 }
 assert.deepEqual(await read(),before);record.readOnlyHeadUnchanged=true;record.result='pass';await c.close();
 }assert.deepEqual(report.errors,[]);report.result='pass';
}catch(e){report.result='failed';report.failure=String(e);if(page&&!page.isClosed())await page.screenshot({path:out+'/failure.png'});throw e}
finally{await writeFile(out+'/report.json',JSON.stringify(report,null,2));await browser.close()}
console.log(JSON.stringify({result:report.result,cases:report.cases.length,errors:report.errors}));
