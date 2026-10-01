import {summerAudio} from '../audio';
import artDimensions from './art-dimensions.json';
import mapDimensions from './map-dimensions.json';
import {Direction} from '@rpgjs/common';
import {findPath,walkable} from '../engine/world';
import {useEffect,useRef,useState} from 'react';import {Assets} from 'pixi.js';import type {RpgPlayer} from '@rpgjs/server';
import {createRpgSpace,type Space} from '../engine/rpg-space';import {rooms,world,worldWithFlags,tx,entityLabel,type Locale,type Entity} from './data';import {heroSheet,sheets,propId,npcSheets} from './sheets';import type {Point} from '../engine/world';
export type WorldHandle={move:(x:number,y:number)=>void;position:()=>Point;approach:(e:Entity)=>void};
export function View({scene,start,locale,flags,titles,paused,onNear,onPosition,onRenderReady,handle}:{scene:string;start:Point;locale:Locale;flags:string[];titles:Record<string,[string,string]>;paused:boolean;onNear:(e:Entity|null)=>void;onPosition:(p:Point)=>void;onRenderReady:(ready:boolean)=>void;handle:{current:WorldHandle|null}}){
 const host=useRef<HTMLDivElement>(null),space=useRef<Space|null>(null),latest=useRef({scene,start,paused,onNear,onPosition,locale,flags});latest.current={scene,start,paused,onNear,onPosition,locale,flags};const [ready,setReady]=useState(false),[error,setError]=useState('');
 useEffect(()=>{
  const mount=host.current!.querySelector<HTMLElement>('#rpg')!;
  const propActors=new Map<string,RpgPlayer>();
  const event=(id:string,x:number,y:number,graphic:string|string[]=id)=>({id,x,y,event:{onInit(this:RpgPlayer){this.setHitbox(1,1);this.through=true;this.animationFixed=true;this.setGraphic(graphic);this.animationName.set('stand');this.syncChanges();if(id.startsWith('prop-'))propActors.set(id,this)}}});
  const layerEvent=(id:string,layer:string)=>{const d=mapDimensions[(id+'-'+layer) as keyof typeof mapDimensions];return d.empty?[]:[event(layer+'-'+id,d.x,d.y+(layer==='front'?d.height:0))]};
  const actors=new Map<string,RpgPlayer>(),actorPositions=new Map<string,Point>(),patrols=new Map<string,{side:number;pause:number;distance:number}>();
  const personEvent=(id:string,e:Entity)=>({id:'person-'+e.id,x:e.at.x,y:e.at.y,event:{onInit(this:RpgPlayer){this.setHitbox(1,1);this.through=true;this.animationFixed=true;this.setGraphic('npc-'+e.person);this.animationName.set('stand');this.syncChanges();actors.set(id+'/'+e.id,this);actorPositions.set(id+'/'+e.id,{...e.at})}}});
  const collisionWorld=(id:string)=>({...world,scenes:{...world.scenes,[id]:{...world.scenes[id],obstacles:[...worldWithFlags(latest.current.flags).scenes[id].obstacles,...rooms[id].entities.filter(e=>e.person).map(e=>{const p=actorPositions.get(id+'/'+e.id)??e.at;return {x:p.x-9,y:p.y-8,w:18,h:8}})]}}});
  const events=(id:string)=>[...layerEvent(id,'base'),...layerEvent(id,'north'),...layerEvent(id,'side'),...rooms[id].props.filter(p=>!p.floorDecoration).map(p=>event(propId(id,p),p.at.x,p.at.y,p.visibleWhen&&!latest.current.flags.includes(p.visibleWhen)?[]:propId(id,p))),...rooms[id].entities.filter(e=>e.person&&npcSheets.some(s=>s.id==='npc-'+e.person)).map(e=>personEvent(id,e)),...layerEvent(id,'front')];
  const prepare=async(id:string)=>{await Assets.load(heroSheet.image);await Promise.all(sheets.filter(s=>s.id.endsWith('-'+id)||s.id.startsWith('prop-'+id+'-')||s.id.startsWith('npc-')).map(s=>Assets.load(s.image)))};
  let lastNear='',motionTime=0,npcTick=0,walkDistance=0,previousPoint={...start};void prepare(scene).then(()=>{
   createRpgSpace({world,host:mount,scene,position:start,speed:112,stride:48,sheet:heroSheet,spritesheets:sheets,cameraBounds:id=>{const r=rooms[id].interior;return rooms[id].outdoor?{x:0,y:0,w:1440,h:1088}:{x:r.x-8,y:r.y-64,w:r.w+16,h:r.h+72}},foregroundReveal:[{textureForScene:id=>id+'-front.png',size:{w:1440,h:1088},originForScene:id=>{const d=mapDimensions[(id+'-front') as keyof typeof mapDimensions];return {x:d.x,y:d.y,width:d.width,height:d.height}},center:{x:8,y:-20},radius:68,opacity:.2,active:(p,id)=>!rooms[id].outdoor&&p.y>rooms[id].interior.y+rooms[id].interior.h-78},{textureForScene:()=> 'door-front-v7.png',size:{w:1440,h:1088},originForScene:id=>{const p=rooms[id].props.find(p=>p.id==='exit-leaf')!;const d=artDimensions['door-front-v7'];const h=d.height*p.width/d.width;return {x:p.at.x-p.width/2,y:p.at.y-h,width:d.width,height:d.height,worldWidth:p.width,worldHeight:h}},center:{x:8,y:-20},radius:68,opacity:.2,active:(p,id)=>!rooms[id].outdoor&&p.y>rooms[id].interior.y+rooms[id].interior.h-78}],mapEvents:events,prepareScene:prepare,walkable:(p,id)=>walkable(collisionWorld(id),id,p),findPath:(a,b,id)=>findPath(collisionWorld(id),id,a,b),controlsBlocked:()=>latest.current.paused,onDestination:()=>{},onError:e=>setError(String(e)),onReady:r=>{space.current=r;r.pause(latest.current.paused);handle.current={move:r.move,position:r.position,approach:e=>r.walkTo(e.approach)};if(r.renderedScene()!==latest.current.scene){void r.restore(latest.current.scene,latest.current.start).then(()=>{setReady(true);onRenderReady(true)}).catch(e=>setError(String(e)))}else{setReady(true);onRenderReady(true)}},onPosition:p=>latest.current.onPosition(p),onFrame:(dt,p,id,blocked)=>{
    if(!space.current||space.current.renderedScene()!==id||id!==latest.current.scene)return;
    for(const prop of rooms[id].props.filter(prop=>prop.state||prop.visibleWhen)){const key=propId(id,prop),actor=propActors.get(key),graphic=prop.visibleWhen&&!latest.current.flags.includes(prop.visibleWhen)?'':key+(prop.state&&latest.current.flags.includes(prop.state.flag)?'-active':'');if(actor&&(actor.graphics()[0]??'')!==graphic){actor.setGraphic(graphic||[]);actor.syncChanges()}}
    const glow=host.current?.querySelector<HTMLElement>('.harbor-lantern-glow');if(glow&&space.current){const q=space.current.project({x:365,y:350});glow.style.transform=`translate(${q.x}px,${q.y}px) translate(-50%,-50%)`}
    const moved=Math.hypot(p.x-previousPoint.x,p.y-previousPoint.y);previousPoint={...p};if(!blocked&&moved<12){walkDistance+=moved;if(walkDistance>24){walkDistance%=24;summerAudio.effect('step')}}
    motionTime+=blocked?0:dt;npcTick+=dt;
    if(npcTick>.06){npcTick=0;for(const e of rooms[id].entities.filter(e=>e.person)){
     const actor=actors.get(id+'/'+e.id);if(!actor)continue;
     const current=actorPositions.get(id+'/'+e.id)??e.at,nearPlayer=Math.hypot(p.x+8-current.x,p.y+6-current.y)<110;
     let next={...current},pose='stand',direction=actor.direction();
     if(!blocked&&!nearPlayer&&e.person==='idris'){
      const patrol=patrols.get(id+'/'+e.id)??{side:1,pause:0,distance:0};patrols.set(id+'/'+e.id,patrol);
      if(patrol.pause>0)patrol.pause=Math.max(0,patrol.pause-.06);else{
       const goal=e.at.x+patrol.side*40,delta=Math.sign(goal-current.x)*Math.min(Math.abs(goal-current.x),1.8);next={x:current.x+delta,y:e.at.y};patrol.distance+=Math.abs(delta);direction=delta>0?Direction.Right:Direction.Left;pose=['stride-0','stride-1','stride-2','stride-1'][Math.floor(patrol.distance/12)%4];
       if(Math.abs(goal-next.x)<.1){patrol.side*=-1;patrol.pause=1.5;pose='stand'}
      }
     }else if(nearPlayer){const dx=p.x+8-current.x,dy=p.y+6-current.y;direction=Math.abs(dx)>Math.abs(dy)?(dx>0?Direction.Right:Direction.Left):(dy>0?Direction.Down:Direction.Up)}
     if(next.x!==current.x||next.y!==current.y){void actor.teleport(next);actorPositions.set(id+'/'+e.id,next)}
     if(actor.direction()!==direction)actor.direction.set(direction);if(actor.animationName()!==pose)actor.animationName.set(pose);actor.syncChanges();
    }}
    let near:Entity|null=null,best=65;
    for(const e of rooms[id].entities){if(e.destination?.startsWith('workshop-annex-')&&!latest.current.flags.includes(e.destination))continue;const at=actorPositions.get(id+'/'+e.id)??e.at,dist=Math.hypot(p.x+8-at.x,p.y+6-at.y);if(dist<best&&Math.hypot(p.x+8-e.at.x,p.y+6-e.at.y)<75){best=dist;near=e}const button=host.current?.querySelector<HTMLElement>(`[data-target="${e.id}"]`),q=space.current?.project(e.passage?{x:e.passage.sign.x,y:e.passage.sign.y-56}:{x:at.x,y:at.y-(e.kind==='person'?70:e.kind==='portal'&&!rooms[id].outdoor?86:32)});if(button&&q){button.style.transform=`translate(${q.x}px,${q.y}px) translate(-50%,-50%)`;button.dataset.near=String(dist<65);button.dataset.readable=String(dist<190)}}
    if(lastNear!==(near?.id??'')){lastNear=near?.id??'';latest.current.onNear(near)}
   }});
  }).catch(e=>setError(String(e)));
 },[]);
 useEffect(()=>{space.current?.pause(paused)},[paused]);
 useEffect(()=>{const r=space.current;if(!r)return;setReady(false);onRenderReady(false);onNear(null);void r.restore(scene,start).then(()=>{setReady(true);onRenderReady(true)}).catch(e=>setError(String(e)))},[scene]);
 return <div ref={host} className="harbor-world" onClick={e=>{if(paused||!space.current||!(e.target instanceof HTMLCanvasElement||e.target===e.currentTarget))return;const b=e.currentTarget.getBoundingClientRect();space.current.walkTo(space.current.toWorld({x:e.clientX-b.x,y:e.clientY-b.y}))}}>{scene==='cafe'&&flags.includes('terrace-fixed')&&<div className="harbor-lantern-glow"/>}<div id="rpg" aria-label={tx(titles[scene]??rooms[scene].title,locale)}/>{rooms[scene].entities.filter(e=>!e.destination?.startsWith('workshop-annex-')||flags.includes(e.destination)).map(e=><button key={e.id} className={'harbor-target harbor-target--'+e.kind+(e.passage?' harbor-target--trail':'')} data-target={e.id} onClick={()=>handle.current?.approach(e)} aria-label={tx(titles[e.destination??'']??entityLabel(e,flags),locale)}>{e.kind==='portal'?tx(titles[e.destination??'']??entityLabel(e,flags),locale):e.kind==='person'?<span className="harbor-target__dot"/>:<span className="harbor-target__dot"/>}</button>)}{(!ready||error)&&<div className="harbor-loading"><p>{error?tx(['场景未能载入','The scene could not load'],locale):tx(['正在抵达…','Arriving…'],locale)}</p>{error&&<button onClick={()=>location.reload()}>{tx(['重新载入','Reload'],locale)}</button>}</div>}</div>
}
