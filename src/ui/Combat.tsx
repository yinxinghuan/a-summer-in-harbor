import {summerAudio} from '../audio';
import dimensions from '../world/combat-dimensions.json';
import {useEffect,useRef,useState} from 'react';
import {Application,Assets,Sprite,Texture,Rectangle,Graphics,TilingSprite} from 'pixi.js';
import {beginEncounter,stepEncounter,FixedClock,appendInput,type InputRun,type CombatState} from '../combat/core';
import {encounterPresets} from '../combat/presets';
import {tx,type Locale,type Words} from '../world/data';
import {Joystick} from './Joystick';import {Icon} from './icons';
import './combat.css';

type Props={kind:string;locale:Locale;error:Words|null;onFinish:(runs:InputRun[])=>Promise<boolean|undefined>;onLeave:()=>Promise<boolean|undefined>};
const idle=()=>({x:0,y:0,attack:false,defend:false});
const snapshot=(s:CombatState)=>({hp:s.player.hp,enemy:s.enemies.reduce((n,e)=>n+e.hp,0),result:s.result,tick:s.tick,phase:s.enemies[0].phase,dodge:s.player.dodgeCooldown,playerPhase:s.player.phase,playerDodge:s.player.dodgeTicks});
export function Combat({kind,locale,error,onFinish,onLeave}:Props){
 const config=encounterPresets[kind];
 const [guide,setGuide]=useState(0),[started,setStarted]=useState(false),[pending,setPending]=useState(false),[returnFailed,setReturnFailed]=useState(false);
 const startedRef=useRef(false),pendingRef=useRef(false),exitMode=useRef<'withdraw'|'result'|null>(null),alive=useRef(true);
 const mount=useRef<HTMLDivElement>(null),labels=useRef<(HTMLSpanElement|null)[]>([]),inputs=useRef(idle()),runs=useRef<InputRun[]>([]),current=useRef<CombatState|null>(null);
 const [hud,setHud]=useState(()=>snapshot(beginEncounter(config))),[ready,setReady]=useState(false),[loadError,setLoadError]=useState(false),[feedback,setFeedback]=useState<'hit'|'hurt'|'miss'|null>(null);
 const submit=async(mode:'withdraw'|'result')=>{
  if(pendingRef.current)return;
  pendingRef.current=true;exitMode.current=mode;inputs.current=idle();setPending(true);setReturnFailed(false);
  try{const ok=await(mode==='withdraw'?onLeave():onFinish(runs.current));if(alive.current&&!ok)setReturnFailed(true)}
  catch{if(alive.current)setReturnFailed(true)}
  finally{pendingRef.current=false;if(alive.current)setPending(false)}
 };
 useEffect(()=>{
  alive.current=true;const c=encounterPresets[kind],s=beginEncounter(c);current.current=s;
  const app=new Application(),clock=new FixedClock(),ownedFrames:Texture[]=[];
  let stopped=false,initialized=false,disposed=false;
  const dispose=()=>{
   if(!initialized||disposed)return;disposed=true;
   // Other Pixi renderers (the RPGJS world) are still live. Boolean true also
   // releases GLOBAL batch pools in Pixi 8.20; only remove this arena's view.
   app.destroy({removeView:true,releaseGlobalResources:false},{children:true,texture:false,textureSource:false});
   for(const frame of ownedFrames)frame.destroy(false);ownedFrames.length=0;
  };
  void(async()=>{
   await app.init({width:c.width,height:c.height,background:'#d9c9a4',antialias:false,resolution:Math.min(2,devicePixelRatio),autoDensity:true});initialized=true;
   if(stopped){dispose();return}
   app.canvas.style.width='100%';app.canvas.style.height='100%';
   mount.current!.appendChild(app.canvas);
   const keys=Object.keys(dimensions),assets:Record<string,Texture>={};
   const [walkSources,floorTexture]=await Promise.all([
    Promise.all(['hero','npc-idris'].map(key=>Assets.load<Texture>('./art/'+key+'.png'))),
    Assets.load<Texture>('./art/floor-wood.png'),
    Promise.all(keys.map(async key=>{assets[key]=await Assets.load('./art/'+key+'.png')})),
   ]);
   // Cancellation can happen during any image request. Never revive an arena
   // after its modal has closed, and never unload shared Assets textures.
   if(stopped)return;
   const walks=walkSources.map(tex=>Array.from({length:12},(_,i)=>{const frame=new Texture({source:tex.source,frame:new Rectangle(i%3*128,Math.floor(i/3)*128,128,128)});ownedFrames.push(frame);return frame}));
   const floor=new TilingSprite({texture:floorTexture,width:c.width,height:c.height});floor.tileScale.set(.16);floor.zIndex=-2;
   const graphics=new Graphics();graphics.zIndex=-1;app.stage.addChild(floor,graphics);app.stage.sortableChildren=true;
   const sprites=[s.player,...s.enemies].map((a,i)=>{const sprite=new Sprite(walks[i][1]);sprite.anchor.set(.5,122/128);sprite.scale.set(56/108);app.stage.addChild(sprite);return sprite});
   const previous=[s.player,...s.enemies].map(a=>({...a.position})),strides=previous.map(()=>0);
   let count=0,lastResult=s.result,feedbackUntil=0;
   app.ticker.add(t=>{
    if(stopped||document.hidden)return;
    clock.update(t.deltaMS/1000,()=>{
     if(s.result!=='playing'||!startedRef.current||exitMode.current)return;
     appendInput(runs.current,inputs.current);stepEncounter(c,s,inputs.current);
     const event=s.events.find(e=>e.type==='hit'&&e.target===s.player.id)??s.events.find(e=>e.type==='hit'||e.type==='miss'&&e.actor===s.player.id);
     if(event){if(event.type==='hit')summerAudio.effect('hit');setFeedback(event.type==='miss'?'miss':event.target===s.player.id?'hurt':'hit');feedbackUntil=s.tick+42}
     if(feedbackUntil&&s.tick>=feedbackUntil){setFeedback(null);feedbackUntil=0}
     inputs.current.attack=false;inputs.current.defend=false;
    });
    graphics.clear();graphics.rect(8,8,c.width-16,c.height-16).stroke({color:0x887658,width:3});
    for(const o of c.obstacles)graphics.roundRect(o.x,o.y,o.w,o.h,3).fill(0x547d7c);
    if(c.objective.kind==='reach'){const z=c.objective.zone;graphics.rect(z.x,z.y,z.w,z.h).fill({color:0x4f9083,alpha:.7})}
    [s.player,...s.enemies].forEach((a,i)=>{
     const sprite=sprites[i],distance=Math.hypot(a.position.x-previous[i].x,a.position.y-previous[i].y);strides[i]+=distance;previous[i]={...a.position};
     const direction=Math.abs(a.facing.x)>=Math.abs(a.facing.y)?(a.facing.x<0?'left':'right'):(a.facing.y<0?'up':'down');
     if(a.phase!=='idle'||distance<.01){
      const key=(i===0?'hero':'idris')+'-combat-'+(['left','right'].includes(direction)?'':direction+'-')+(a.phase==='active'?'punch':'guard'),d=dimensions[key as keyof typeof dimensions];
      if(d&&assets[key]){sprite.texture=assets[key];sprite.anchor.set(d.anchorX,1);sprite.scale.set((direction==='right'?-1:1)*56/d.height,56/d.height)}
     }else{const row={down:0,left:1,right:2,up:3}[direction],col=[0,1,2,1][Math.floor(strides[i]/12)%4];sprite.texture=walks[i][row*3+col];sprite.anchor.set(.5,122/128);sprite.scale.set(56/108)}
     sprite.position.set(a.position.x,a.position.y);sprite.zIndex=a.position.y;sprite.alpha=a.hp<=0?.25:a.hurtTicks?.55:1;
     graphics.ellipse(a.position.x,a.position.y-2,13,5).stroke({color:i===0?0x285b50:0x86521e,width:2});
     const label=labels.current[i];if(label){label.style.left=`${Math.max(12,Math.min(88,a.position.x/c.width*100))}%`;label.style.top=`${Math.min(92,(a.position.y+5)/c.height*100)}%`}
     if(a.phase==='windup'||a.phase==='active'){const angle=Math.atan2(a.facing.y,a.facing.x),arc=a.attack.arc/2;graphics.moveTo(a.position.x,a.position.y).arc(a.position.x,a.position.y,a.attack.reach,angle-arc,angle+arc).closePath().fill({color:a.phase==='active'?0xb04d35:0xddae4c,alpha:.5})}
    });
    for(const b of s.projectiles)graphics.circle(b.position.x,b.position.y,b.radius).fill(0x9b4738);
    if(++count%6===0||s.result!==lastResult){setHud(snapshot(s));lastResult=s.result}
   });setReady(true);
  })().catch(()=>{if(!stopped){setReady(false);setLoadError(true);dispose()}});
  const canInput=()=>startedRef.current&&!exitMode.current&&current.current?.result==='playing';
  const down=(e:KeyboardEvent)=>{
   if(!canInput()||e.target instanceof HTMLInputElement||e.target instanceof HTMLTextAreaElement)return;
   const k=e.key.toLowerCase();if([' ','j','k','shift','w','a','s','d','arrowup','arrowdown','arrowleft','arrowright'].includes(k))e.preventDefault();
   if(!e.repeat&&(k==='j'||k===' '))inputs.current.attack=true;if(!e.repeat&&(k==='k'||k==='shift'))inputs.current.defend=true;
   if(k==='w'||k==='arrowup')inputs.current.y=-1;if(k==='s'||k==='arrowdown')inputs.current.y=1;if(k==='a'||k==='arrowleft')inputs.current.x=-1;if(k==='d'||k==='arrowright')inputs.current.x=1;
  };
  const up=(e:KeyboardEvent)=>{if(['w','s','arrowup','arrowdown'].includes(e.key.toLowerCase()))inputs.current.y=0;if(['a','d','arrowleft','arrowright'].includes(e.key.toLowerCase()))inputs.current.x=0};
  const clear=()=>{inputs.current=idle();clock.reset()};
  window.addEventListener('keydown',down);window.addEventListener('keyup',up);window.addEventListener('blur',clear);document.addEventListener('visibilitychange',clear);
  return()=>{alive.current=false;stopped=true;clear();window.removeEventListener('keydown',down);window.removeEventListener('keyup',up);window.removeEventListener('blur',clear);document.removeEventListener('visibilitychange',clear);dispose()};
 },[kind]);
 const finished=hud.result!=='playing',locked=pending||returnFailed;
 const title:Words=kind==='footwork'?['走位练习','Footwork']:kind==='endurance'?['坚持二十秒','Twenty-second round']:['友好切磋','A friendly spar'];
 const goal:Words=kind==='footwork'?['绕过垫子和来球，走进对面的绿色区域。','Avoid the pads and balls; reach the green zone.']:kind==='endurance'?['躲开教练的拳，保持二十秒。','Avoid the coach’s punches for twenty seconds.']:['靠近并面向教练，命中四次。','Face the coach at close range and land four hits.'];
 const hint:Words=feedback==='hurt'?['被击中一次，先拉开距离。','You were hit. Make some space.']:feedback==='hit'?['命中了！留意教练下一次出手。','You landed a hit! Watch the next windup.']:feedback==='miss'?['没有打中，靠近并面向教练再出手。','Missed. Face the coach and get closer.']:hud.phase==='windup'?['教练蓄力了——离开黄色扇形！','Coach winding up—leave the yellow arc!']:hud.phase==='active'?['正在出招——避开正面！','Incoming—keep clear of the front!']:hud.phase==='recovery'&&kind==='sparring'?['教练正在收招，靠近还击。','Coach recovering—step in and strike.']:kind==='footwork'?['绿色区域在对面，绕过垫子前进。','Reach the far green zone. Go around the pads.']:kind==='endurance'?['持续移动，留意黄色出招提示。','Keep moving. Watch for the yellow windup.']:['先向教练靠近；看到黄色提示就躲开。','Approach the coach; dodge the yellow windup.'];
 return <section className="harbor-combat" data-started={started} aria-label={tx(['练习','Practice'],locale)}>
  <header className="harbor-combat__heading"><div><small>{tx(['港口拳馆 · 实时练习','BOXING CLUB · REAL TIME'],locale)}</small><h2>{tx(title,locale)}</h2></div><button disabled={locked} onClick={()=>void submit(finished?'result':'withdraw')}>{tx(['返回','Return'],locale)}</button></header>
  {!started&&!locked&&<div className="harbor-combat__brief">
   <small>{tx(guide===0?['1 / 2 · 目标','1 / 2 · YOUR GOAL']:['2 / 2 · 操作','2 / 2 · CONTROLS'],locale)}</small>
   {guide===0?<><p>{tx(goal,locale)}</p><p>{tx(['你从下方开始，脚边标着「你」。上方是教练伊德里斯。','You start below, marked “You”. Coach Idris is above.'],locale)}</p><p>{tx(['这是实时练习，按开始才计时。不会扣钱、物品或小镇体力。','This is real time; the clock waits for Start. No money, items or town energy are spent.'],locale)}</p></>:<><p>{tx(['摇杆移动。朝想去的方向移动，再点闪避快速躲开。','Use the stick to move. Aim by moving, then tap Dodge to dash that way.'],locale)}</p><p>{tx(kind==='sparring'?['靠近并面向教练时点出手。黄色扇形是蓄力预警，先闪开，收招后再还击。','Tap Strike near the coach while facing him. Yellow warns of a punch: dodge, then counter.']:['这项练习不必出拳。看到预警就躲开，专心移动。','No punches needed here. Avoid the warning and keep moving.'],locale)}</p><p className="harbor-combat__keys">{tx(['电脑：方向键 / WASD 移动，K 闪避，J 出手。挨到五次就结束；可随时返回。','Keyboard: arrows / WASD, K to dodge, J to strike. Five hits end practice; Return leaves anytime.'],locale)}</p></>}
  </div>}
  {started&&!locked&&<div className="harbor-combat__status"><span>{tx(['你 · 剩余次数','You · hits left'],locale)} <b>{hud.hp}/5</b></span><span>{kind==='sparring'?tx(['教练','Coach'],locale)+' '+hud.enemy+'/4':kind==='endurance'?Math.min(20,Math.floor(hud.tick/60))+'/20s':tx(['到达绿色区','Reach green'],locale)}</span></div>}
  <div className="harbor-combat__field" hidden={!started||locked}><div className="harbor-arena" ref={mount}><span ref={e=>{labels.current[0]=e}} className="harbor-combat__actor harbor-combat__actor--you">{tx(['你','You'],locale)}</span><span ref={e=>{labels.current[1]=e}} className="harbor-combat__actor">{tx(['教练','Coach'],locale)}</span></div></div>
  {locked?<div className="harbor-combat__return" role="status"><p>{tx(pending?['正在返回拳馆…','Returning to the club…']:['暂时没能确认返回，练习已暂停。','Return could not be confirmed. Practice is paused.'],locale)}</p>{returnFailed&&<>{error&&<p className="harbor-error">{tx(error,locale)}</p>}<button className="harbor-primary harbor-wide" onClick={()=>void submit(exitMode.current!)}>{tx(['重试返回','Retry return'],locale)}</button></>}</div>:loadError?<p role="alert">{tx(['练习场没能准备好。请返回拳馆后再试。','The practice floor could not load. Return to the club and try again.'],locale)}</p>:!started?<footer className="harbor-combat__footer"><button className="harbor-primary harbor-wide" disabled={guide===1&&!ready} onClick={()=>{if(guide===0)setGuide(1);else{inputs.current=idle();startedRef.current=true;setStarted(true)}}}>{tx(guide===0?['看看怎么操作','How to play']:ready?['开始练习','Start practice']:['准备练习场…','Preparing practice…'],locale)}</button></footer>:finished?<div className="harbor-result"><h3>{tx(hud.result==='won'?['练习完成','Practice complete']:['歇口气，下次再试','Take a breath. Try again later.'],locale)}</h3><button className="harbor-primary" disabled={pending} onClick={()=>void submit('result')}>{tx(['回到拳馆','Back to the club'],locale)}</button></div>:<>
   <p className="harbor-combat__hint">{tx(hint,locale)}</p>
   <div className="harbor-combat__controls"><div className="harbor-combat__move"><Joystick label={tx(['移动','Move'],locale)} onMove={(x,y)=>{if(!exitMode.current){inputs.current.x=x;inputs.current.y=y}}}/><small>{tx(['移动','Move'],locale)}</small></div><button aria-label={tx(['闪避','Dodge'],locale)} disabled={hud.dodge>0||hud.playerPhase!=='idle'||hud.playerDodge>0} onPointerDown={()=>{inputs.current.defend=true}} onKeyDown={e=>{if((e.key==='Enter'||e.key===' ')&&!e.repeat)inputs.current.defend=true}}><Icon name="shield"/>{tx(['闪避','Dodge'],locale)}<small>{hud.dodge>0?(hud.dodge/60).toFixed(1)+'s':tx(['K · 就绪','K · ready'],locale)}</small></button>{kind==='sparring'&&<button aria-label={tx(['出手','Strike'],locale)} className="harbor-primary" disabled={hud.playerPhase!=='idle'||hud.playerDodge>0} onPointerDown={()=>{inputs.current.attack=true}} onKeyDown={e=>{if((e.key==='Enter'||e.key===' ')&&!e.repeat)inputs.current.attack=true}}><Icon name="attack"/>{tx(['出手','Strike'],locale)}<small>{tx(hud.playerPhase!=='idle'?['收招中','Recovering']:['J · 近身','J · close up'],locale)}</small></button>}</div>
  </>}
 </section>;
}
