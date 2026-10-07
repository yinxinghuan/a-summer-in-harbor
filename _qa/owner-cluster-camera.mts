import {chromium} from 'playwright';
import {readFileSync,existsSync,mkdirSync,writeFileSync} from 'node:fs';
import {resolve,extname} from 'node:path';
import {Readable} from 'node:stream';
import {execFileSync} from 'node:child_process';
import {randomUUID,createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {initial,applyAction} from '../src/story/state';
import {world,rooms,entityAt} from '../src/world/data';
import {walkable} from '../src/engine/world';
import {createRuntime} from '../server/runtime';
import {createExplorationAssembly} from '../server/exploration-assembly';
import {createMovingClock} from '../server/candidate-clock';
import {withCompactMotion} from '../server/candidate-motion-authority';
import {createActivePlayClock,withActivePlayRuntime} from '../server/active-play-clock';
import {withActivePlayAuthority} from '../server/active-play-authority';
import {createApiHandler} from '../server/http';
// @ts-expect-error frozen authority
import {AsyncSessionAuthority,openAsyncSqliteAuthorityStore} from '../vendor/dynamic-runtime/packages/authority-session/async.mjs';
const diskGuard=()=>{const row=execFileSync('df',['-k','.'],{encoding:'utf8'}).trim().split('\n').at(-1)!.trim().split(/\s+/);if(Number(row[3])<15728640)throw Error('15GIB_DISK_FLOOR')};diskGuard();
const out=resolve(process.env.QA_CAMERA_OUT??'../evidence/owner-cluster-camera'),dist=resolve('dist'),publicRoot=resolve('public');mkdirSync(out,{recursive:true});
const mime:any={'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.json':'application/json','.svg':'image/svg+xml','.tmx':'application/xml','.tsx':'application/xml','.woff2':'font/woff2','.ttf':'font/ttf','.mp3':'audio/mpeg'};
const report:any={scope:'LOCAL candidate real compiled Main/View/RPGJS + isolated SQLite, all external network blocked; synthetic players; no model/media/production/publishing.',rate:4000,rateStatus:'configurable local experiment, not user-selected speed',cases:[],errors:[],blocked:[],modelCalls:0,bundle:readFileSync(resolve(dist,'index.html'),'utf8').match(/src="([^"]+index-[^"]+\.js)"/)?.[1]};
function edge(scene:string,side:string){const r=rooms[scene].interior;let best:any=null,score=Infinity;const north=side.includes('north'),south=side.includes('south'),west=side.includes('west'),east=side.includes('east');const target={x:west?r.x:east?r.x+r.w-16:r.x+r.w/2-8,y:north?r.y:south?r.y+r.h-12:r.y+r.h/2};for(let y=r.y;y<=r.y+r.h-12;y+=2)for(let x=r.x;x<=r.x+r.w-16;x+=2){const d=(west||east?4:1)*Math.abs(x-target.x)+(north||south?4:1)*Math.abs(y-target.y);if(d<score&&walkable(world,scene,{x,y})){best={x,y};score=d}}return best}
async function measure(page:any){return page.evaluate(()=>{const c=(document.querySelector('#rpg') as any).__rpgClient,stage=c.canvasApp.stage;let hero:any,view:any,backdrop:any;const visit=(n:any)=>{if(n.texture?.source?.label?.includes('/hero.png'))hero=n;if('toWorld' in n&&'clamp' in n)view=n;if(n.label==='exploration-overscan')backdrop=n;for(const k of n.children??[])visit(k)};visit(stage);
 const rect=(selector:string)=>{const b=document.querySelector(selector)?.getBoundingClientRect();return b&&{x:b.x,y:b.y,w:b.width,h:b.height,bottom:b.bottom,right:b.right}};const rpg=rect('#rpg')!,w=rect('.harbor-world')!,b=hero.getBounds(),sx=rpg.w/parseFloat(c.width()),sy=rpg.h/parseFloat(c.height()),row=Math.floor(hero.texture.frame.y/128),col=Math.floor(hero.texture.frame.x/128);const alphas=[[[37,14,90,122],[36,14,91,122],[37,14,90,122]],[[39,14,88,122],[40,14,88,122],[38,14,90,122]],[[39,14,88,122],[40,14,88,122],[38,14,90,122]],[[41,14,86,122],[40,14,87,122],[41,14,87,122]]];const a=alphas[row][col];const actor={left:rpg.x+(b.x+b.width*a[0]/128)*sx,top:rpg.y+(b.y+b.height*a[1]/128)*sy,right:rpg.x+(b.x+b.width*a[2]/128)*sx,bottom:rpg.y+(b.y+b.height*a[3]/128)*sy};const objective=rect('.harbor-objective')!,controls=rect('.harbor-controls');const safe={left:w.x+12,top:objective.bottom+12,right:w.right-12,bottom:(controls?.y??w.bottom)-12};const targets=[...document.querySelectorAll<HTMLElement>('.harbor-target--portal[data-readable=true]')].filter(e=>getComputedStyle(e).visibility==='visible'&&getComputedStyle(e).opacity!=='0').map(e=>{const b=e.getBoundingClientRect();return {id:e.dataset.target,left:b.left,top:b.top,right:b.right,bottom:b.bottom}});
 return {player:{x:c.getCurrentPlayer().x(),y:c.getCurrentPlayer().y()},actor,safe,gaps:{top:actor.top-objective.bottom,bottom:(controls?.y??w.bottom)-actor.bottom,left:actor.left-w.x,right:w.right-actor.right},header:rect('.harbor-header'),location:rect('.harbor-location'),objective,controls,world:w,rpg,scale:sx,targets,camera:{center:{x:view.center.x,y:view.center.y},corner:view.toWorld(0,0),opposite:view.toWorld(parseFloat(c.width()),parseFloat(c.height())),clamp:view.plugins.get('clamp')?.options,followPaused:view.plugins.get('follow')?.paused,animatePaused:view.plugins.get('animate')?.paused},backdrop:backdrop&&{texture:backdrop.texture.source.label,world:{x:backdrop.x,y:backdrop.y,w:backdrop.width,h:backdrop.height},tileScale:{x:backdrop.tileScale.x,y:backdrop.tileScale.y}},period:(document.querySelector('.harbor-world') as HTMLElement).dataset.period,overflow:document.documentElement.scrollWidth>innerWidth+1};});}
function verify(m:any,label:string){for(const k of ['top','bottom','left','right'])assert.ok(m.gaps[k]>=11.5,label+' actor '+k+' '+m.gaps[k]);assert.equal(m.overflow,false,label+' overflow');assert.ok(m.backdrop,label+' backdrop');assert.ok(m.camera.followPaused!==false);for(const t of m.targets){assert.ok(t.left>=m.safe.left-1&&t.right<=m.safe.right+1&&t.top>=m.safe.top-1&&t.bottom<=m.safe.bottom+1,label+' caption '+t.id)}}

const browser=await chromium.launch({headless:true,executablePath:'/Users/yin/Library/Caches/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-mac-arm64/chrome-headless-shell',args:['--use-angle=swiftshader']});
try{for(const [width,height] of [[320,568],[390,844],[1280,800]])for(const scene of ['market','bazaar'])for(const side of ['north-west','north-east','south-west','south-east']){
 if(process.env.QA_CAMERA_CASE&&process.env.QA_CAMERA_CASE!==`${width}-${scene}-${side}`)continue;
 const name=`${width}-${scene}-${side}`,owner='synthetic-camera-'+randomUUID(),position=edge(scene,side),locale=side==='north-east'?'zh':'en';
 const store=openAsyncSqliteAuthorityStore({path:':memory:',worldId:randomUUID(),gameId:'active-browser',environment:'test'});
 const assembly=createExplorationAssembly({resolveDialogue:async()=>{report.modelCalls++;throw Error('QA_MODEL_CLOSED')},initial:(l:any,id:string)=>{
  return {...initial(locale,id),scene,position,townMinutes:1350,known:[],flags:['key','unpacked','bag-returned'],visited:Object.keys(rooms)};
 }}),runtime=assembly.runtime;
 const authority=assembly.decorateAuthority(new AsyncSessionAuthority(store,runtime),store),seed=await authority.create(owner,randomUUID(),'en'),head=()=>authority.get(owner,seed.id),api=createApiHandler({authority,lifeProject:assembly.lifeProject,landProject:assembly.landProject,usage:{status:async()=>({resetAt:0,dialogue:{remaining:0,maximum:0,retryAt:null,pending:0}})}});
 const actions:any[]=[],responses:any[]=[],rejected:any[]=[];let lose=false,offline=false;
 const context=await browser.newContext({viewport:{width,height},locale:locale==='en'?'en-US':'zh-CN'});
 await context.route('**/*',async route=>{const req=route.request(),url=new URL(req.url());if(url.hostname!=='127.0.0.1'){report.blocked.push(url.origin+url.pathname);return route.abort()}
  if(url.pathname.includes('/api/')){
   const endpoint=url.pathname.slice(url.pathname.indexOf('/api/'));if(endpoint==='/api/bootstrap')return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({mode:'local-authoring-test'})});
   const data=req.postData();if(data)actions.push({endpoint,...req.postDataJSON()});if(offline&&endpoint.endsWith('/active-play'))return route.abort();
   const request:any=Readable.from(data?[Buffer.from(data)]:[]);request.url=endpoint+url.search;request.method=req.method();request.headers=req.headers();let status=200,headers:any={},body=Buffer.alloc(0);const response:any={writeHead:(s:number,h:any)=>{status=s;headers=h},end:(v:any)=>body=Buffer.from(v??'')};
   try{await api(request,response,owner)}catch(e:any){status=400;body=Buffer.from(JSON.stringify({error:e.code??e.message,terminal:true}))}const ack=endpoint.endsWith('/active-play')&&status===200?JSON.parse(body.toString()):undefined;responses.push({endpoint,status,bytes:body.length,action:req.postDataJSON()?.action,actionId:ack?.actionId,minute:ack?.fields?.townMinutes,ackSha:ack?createHash('sha256').update(body).digest('hex'):undefined});if(status>=400)rejected.push({endpoint,status,body:JSON.parse(body.toString())});
   if(lose&&endpoint.endsWith('/active-play')&&req.postDataJSON().action==='candidate-active-tick'){lose=false;return route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'SERVICE_UNAVAILABLE',terminal:false})})}
   return route.fulfill({status,headers,body});
  }
  const rel='.'+(url.pathname==='/'?'/index.html':decodeURIComponent(url.pathname));let file=resolve(dist,rel);if(!file.startsWith(dist+'/'))return route.fulfill({status:404,body:'Missing'});if(!existsSync(file)){file=resolve(publicRoot,rel);if(!file.startsWith(publicRoot+'/')||!existsSync(file))return route.fulfill({status:404,body:'Missing'})}return route.fulfill({status:200,contentType:mime[extname(file)]??'application/octet-stream',body:readFileSync(file)});
 });
 await context.addInitScript((id:string)=>{(window as any).__name=(f:any)=>f;addEventListener('DOMContentLoaded',()=>{window.alteruLocalStorage?.setItem('harbor-muted','1');window.alteruLocalStorage?.setItem('harbor-opening:'+id,'3')})},seed.id);

 const page=await context.newPage();page.setDefaultTimeout(20000);page.on('pageerror',e=>report.errors.push({name,error:String(e)}));
 const ready=()=>page.waitForFunction(()=>!!(document.querySelector('#rpg') as any)?.__rpgClient?.getCurrentPlayer()&&!document.querySelector('.harbor-loading'),undefined,{timeout:20000});
 await page.goto('http://127.0.0.1:5498/?debug=1&candidate=1&active_clock=1');await ready();await page.addStyleTag({content:'#alteru-guest-banner{display:none!important}'});
 const result:any={name,width,height,scene,side,locale,syntheticStartingPosition:position};
 try{
  await page.waitForTimeout(700);const m=await measure(page);verify(m,name);result.metrics=m;
  await page.screenshot({path:out+'/'+name+'-platform-layout.png'});
  if(side==='south-west'){
   let first=(await head()).activePlayClock?.lease;for(let i=0;i<40&&!first;i++){await page.waitForTimeout(100);first=(await head()).activePlayClock?.lease}assert.ok(first,'clock should open after ready');
   await page.getByRole('button',{name:locale==='en'?'Bag':'行囊',exact:true}).click();await page.waitForTimeout(300);assert.equal((await head()).activePlayClock?.lease,undefined);
   await page.screenshot({path:out+'/'+name+'-bag.png'});await page.getByRole('button',{name:locale==='en'?'Close':'关闭',exact:true}).click();await page.waitForTimeout(350);verify(await measure(page),name+'-bag-closed');result.panelRoundTrip=true;
  }
  if(width===390&&scene==='bazaar'&&side==='north-west'){
   const before=(await measure(page)).player;await page.setViewportSize({width:320,height:568});await page.waitForTimeout(400);const resized=await measure(page);verify(resized,name+'-resize');assert.deepEqual(resized.player,before);result.resize=resized;
  }
  result.head=await head();assert.equal(result.head.scene,scene);assert.deepEqual(result.head.position,position);
  if(process.env.QA_CAMERA_INPUTS==='1'&&side==='south-west'){
   const click=await page.evaluate(()=>{const c=(document.querySelector('#rpg') as any).__rpgClient;let view:any;const visit=(n:any)=>{if('toWorld' in n&&'clamp' in n)view=n;for(const ch of n.children??[])visit(ch)};visit(c.canvasApp.stage);const p=c.getCurrentPlayer(),target={x:p.x(),y:p.y()-32},screen=view.toScreen(target.x,target.y),r=document.querySelector('#rpg')!.getBoundingClientRect();return {x:r.x+screen.x*r.width/parseFloat(c.width()),y:r.y+screen.y*r.height/parseFloat(c.height())}});
   await page.mouse.click(click.x,click.y);let moved=await head();for(let i=0;i<50&&moved.position.y>=position.y-16;i++){await page.waitForTimeout(100);moved=await head()}assert.equal(moved.scene,scene);assert.ok(moved.position.y<position.y-16,'ordinary canvas route leaves old overlap');verify(await measure(page),name+'-ordinary-route');result.route={input:'ordinary canvas click, no teleport',before:position,after:moved.position};await page.screenshot({path:out+'/'+name+'-ordinary-route.png'});
  }result.clockWriters='single isolated authority';report.cases.push(result);console.log('PASS',name,JSON.stringify(m.gaps));
 }catch(error){await page.screenshot({path:out+'/'+name+'-FAIL.png'});writeFileSync(out+'/failed-case.json',JSON.stringify({result,metrics:await measure(page),head:await head(),error:String(error),rejected,actions,body:await page.locator('body').innerText()},null,2));throw error}
 finally{await context.close();store.close()}
}}finally{writeFileSync(out+'/renderer-report.json',JSON.stringify(report,null,2)+'\n');await browser.close()}
assert.equal(report.errors.length,0);assert.equal(report.modelCalls,0);
