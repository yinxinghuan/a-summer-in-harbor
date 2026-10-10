import {useEffect,useRef,useState} from 'react';
import {MapGesture,type View as MapView} from '../engine/map-gesture';
import {findPath} from '../engine/world';
import {rooms,tx,worldWithFlags,type Locale} from '../world/data';
import {outdoors} from '../world/outdoors';
import {mapAreas,mapRoute,mapPosition,walkingEntrance,entranceReachable,placeTitle,visiblePlaces,routeMessages} from '../world/map-navigation';
import {longTravelMinutes,sameCluster,globalPoint} from '../candidate/continuity';
import {arrivalWarnings} from '../story/resident-guide';
import type {Save} from '../story/state';
export type BayMapState={area:string;selected:string;view:MapView};
const size={w:800,h:650},overview:Record<string,{x:number;y:number}>={station:{x:150,y:450},harbor:{x:400,y:450},market:{x:150,y:170},coast:{x:650,y:450},hill:{x:500,y:170}};
const xy=(p:{x:number;y:number})=>({x:80+p.x*.45,y:80+p.y*.45});
export function BayMap({save,locale,busy,onTravel,onWalk,focus,onSelectPlace,onExplore,state,onStateChange}:{state?:BayMapState;onStateChange?:(s:BayMapState)=>void;focus?:string;save:Save;locale:Locale;busy:boolean;onTravel:(id:string)=>void;onWalk?:(id:string)=>void;onSelectPlace?:(id:string)=>void;onExplore?:()=>void}){
 const submission=useRef(false);useEffect(()=>{if(!busy)submission.current=false},[busy,focus]);
 const valid=visiblePlaces(save),initial=valid.includes(focus??'')?focus!:valid.includes(state?.selected??'')?state!.selected:save.scene;
 const [area,setArea]=useState(state&&(!focus||state.selected===focus)?state.area:rooms[initial]?.area??'harbor'),[selected,setSelected]=useState(initial),[percent,setPercent]=useState(100);
 const box=useRef<HTMLDivElement>(null),paper=useRef<HTMLDivElement>(null),gesture=useRef(new MapGesture({w:300,h:300,contentW:size.w,contentH:size.h}));
 const latest=useRef({area,selected,onStateChange});latest.current={area,selected,onStateChange};
 const persist=()=>{const l=latest.current;l.onStateChange?.({area:l.area,selected:l.selected,view:{...gesture.current.view}})};
 const draw=()=>{const v=gesture.current.view;if(paper.current){paper.current.style.transform=`translate(-50%,-50%) translate(${v.x}px,${v.y}px) scale(${v.z})`;paper.current.querySelectorAll<HTMLElement>('.harbor-spatial-marker').forEach(el=>el.style.transform=`translate(-50%,-50%) scale(${1/v.z})`)}setPercent(Math.round(v.z*100));persist()};
 const fit=()=>{if(!box.current)return;const g=gesture.current;g.size={w:box.current.clientWidth,h:box.current.clientHeight,contentW:size.w,contentH:size.h};g.set({z:Math.min(g.size.w/size.w,g.size.h/size.h),x:0,y:0});draw()};
 useEffect(()=>{const el=box.current!;let first=true;const resize=()=>{gesture.current.size={w:el.clientWidth,h:el.clientHeight,contentW:size.w,contentH:size.h};if(first&&state?.view&&state.area===area){gesture.current.set(state.view);draw()}else fit();first=false};const o=new ResizeObserver(resize);o.observe(el);resize();return()=>{o.disconnect();gesture.current.cancel()}},[]);
 const first=useRef(true);useEffect(()=>{if(first.current){first.current=false;return}gesture.current.cancel();fit()},[area]);
 useEffect(()=>{onSelectPlace?.(selected);persist()},[selected,area]);
 useEffect(()=>{if(focus&&valid.includes(focus)&&focus!==latest.current.selected){setSelected(focus);setArea(rooms[focus].area)}},[focus]);
 const choose=(id:string)=>{submission.current=false;setSelected(id);if(area==='all')setArea(rooms[id].area)};
 const shared=sameCluster(save.scene,selected);
 const route=mapRoute(save,selected),quick=mapRoute(save,selected,true),entrance=walkingEntrance(save,selected),reachable=!route.failure&&entranceReachable(save,selected);
 const projected=(id:string,p:{x:number;y:number})=>{if(area==='market'){const q=globalPoint(id,p);return {x:185+q.x*.3,y:70+q.y*.3}}return xy(p)};
 const sourceZones=area==='market'?['market','bazaar']:[area];
 const current=area==='all'?overview[rooms[save.scene].area]:area==='market'&&['market','bazaar'].includes(save.scene)?projected(save.scene,save.position):mapPosition(save.scene,save.position,area);
 const nodes=area==='all'?mapAreas.map(id=>({id,at:overview[id],portal:false})):[...sourceZones.flatMap(id=>rooms[id].entities.filter(e=>e.kind==='portal'&&e.destination&&valid.includes(e.destination)&&!(area==='market'&&['market','bazaar'].includes(e.destination))).map(e=>({id:e.destination!,at:projected(id,e.at),portal:!rooms[e.destination!].outdoor}))),...(area==='market'?[{id:'bazaar',at:projected('bazaar',rooms.bazaar.spawn),portal:false}]:[])];
 const places=area==='all'?mapAreas:[...new Set([area,...nodes.map(n=>n.id),...valid.filter(id=>rooms[id].area===area)])];
 const path=area!=='all'&&save.scene===area&&entrance?findPath(worldWithFlags(save.flags),save.scene,save.position,entrance.approach).map(p=>projected(save.scene,p)):[];
 const targetNode=nodes.find(n=>n.id===selected),currentPoint=current?(area==='all'||area==='market'&&['market','bazaar'].includes(save.scene)?current:projected(area,current)):undefined;
 const locate=()=>{if(area!==rooms[save.scene].area){setArea(rooms[save.scene].area);return}if(currentPoint){const g=gesture.current;g.set({z:Math.max(g.view.z,.65),x:-(currentPoint.x-size.w/2)*Math.max(g.view.z,.65),y:-(currentPoint.y-size.h/2)*Math.max(g.view.z,.65)});draw()}};
 const point=(e:React.PointerEvent)=>{const r=box.current!.getBoundingClientRect();return {x:e.clientX-r.left-r.width/2,y:e.clientY-r.top-r.height/2}};
 return <div className="harbor-spatial-map">
  <div className="harbor-spatial-heading"><label>{tx(['区域','Area'],locale)}<select aria-label={tx(['地图区域','Map area'],locale)} value={area} onChange={e=>setArea(e.target.value)}><option value="all">{tx(['全镇','The bay'],locale)}</option>{mapAreas.map(id=><option key={id} value={id}>{tx(rooms[id].title,locale)}</option>)}</select></label><button onClick={locate}>{tx(['定位','Locate'],locale)}</button></div>
  <p className="harbor-spatial-current">{tx(['你在这里：','You are here: '],locale)}{tx(placeTitle(save,save.scene),locale)}{!rooms[save.scene].outdoor?' · '+tx(['建筑内','Inside'],locale):''}</p>
  <div className="harbor-map-gesture harbor-spatial-viewport" ref={box} role="group" aria-label={tx(['道路与入口地图；拖动或双指缩放','Roads and entrances; drag or pinch to zoom'],locale)} onPointerDown={e=>{if(e.button!==0)return;gesture.current.down(e.pointerId,point(e));e.currentTarget.setPointerCapture(e.pointerId)}} onPointerMove={e=>{if(gesture.current.points.has(e.pointerId)){gesture.current.move(e.pointerId,point(e));draw()}}} onPointerUp={e=>{const g=gesture.current;if(!g.points.has(e.pointerId))return;if(!g.moved){const el=document.elementFromPoint(e.clientX,e.clientY)?.closest<HTMLElement>('[data-place]');if(el&&box.current?.contains(el)&&el.dataset.place)choose(el.dataset.place)}g.up(e.pointerId)}} onPointerCancel={()=>gesture.current.cancel()} onLostPointerCapture={e=>{if(gesture.current.points.has(e.pointerId))gesture.current.cancel()}}>
   <div ref={paper} className="harbor-spatial-paper" style={{width:size.w,height:size.h}}><svg width={size.w} height={size.h} aria-hidden="true">
    {area==='all'?mapAreas.flatMap(id=>rooms[id].entities.filter(e=>e.destination&&mapAreas.includes(e.destination)&&id<e.destination).map(e=><path key={id+e.destination} className="harbor-spatial-road" d={`M${overview[id].x},${overview[id].y} L${overview[e.destination!].x},${overview[e.destination!].y}`}/>)):sourceZones.flatMap(id=>outdoors[id]?.patches.map((p,i)=><rect key={id+i} x={projected(id,p).x} y={projected(id,p).y} width={p.w*(area==='market'?.3:.45)} height={p.h*(area==='market'?.3:.45)} fill={{grass:'#dae4cd',stone:'#c7bc99',sand:'#e9d6ab',water:'#accbc9',wood:'#b7a788'}[p.material]}/>)??[])}
    {area!=='all'&&sourceZones.flatMap(id=>outdoors[id]?.barriers.map((p,i)=><rect key={'b'+id+i} x={projected(id,p).x} y={projected(id,p).y} width={p.w*(area==='market'?.3:.45)} height={p.h*(area==='market'?.3:.45)} fill="#798d7d" stroke="#405f58"/>)??[])}
    {path.length>0&&<polyline className="harbor-spatial-route" points={path.map(p=>`${p.x},${p.y}`).join(' ')}/>}
   </svg>{nodes.map((n,i)=><button key={n.id} data-place={n.id} className={'harbor-spatial-marker '+(n.portal?'is-building ':'')+(n.id===selected?'is-selected':'')} style={{left:n.at.x,top:n.at.y}} aria-label={tx(placeTitle(save,n.id),locale)+' · '+tx(n.portal?['建筑入口','Building entrance']:['公共道路','Public route'],locale)} title={tx(placeTitle(save,n.id),locale)} onClick={e=>{if(e.detail===0)choose(n.id)}}>{n.portal?<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M4 21V4h16v17M10 21V10h7v11M13 15h1" fill="none" stroke="currentColor" strokeWidth="2"/></svg>:null}<span>{i+1}</span></button>)}
    {currentPoint&&<span className="harbor-spatial-marker harbor-spatial-you" style={{left:currentPoint.x,top:currentPoint.y}} title={tx(['你在这里','You are here'],locale)} aria-label={tx(['你在这里','You are here'],locale)}>●</span>}
   </div>
  </div>
  <div className="harbor-spatial-tools"><button aria-label={tx(['放大','Zoom in'],locale)} onClick={()=>{gesture.current.zoom(gesture.current.view.z/.8);draw()}}>+</button><span aria-live="off">{percent}%</span><button aria-label={tx(['缩小','Zoom out'],locale)} onClick={()=>{gesture.current.zoom(gesture.current.view.z*.8);draw()}}>−</button><button onClick={fit}>{tx(['全图','Fit'],locale)}</button></div>
  <label className="harbor-spatial-destinations">{tx(['选择地点 · 数字对应地图入口','Choose a place · Numbers mark entrances'],locale)}<select aria-label={tx(['选择目的地','Choose destination'],locale)} value={places.includes(selected)?selected:''} onChange={e=>choose(e.target.value)}><option value="" disabled>{tx(['选择地点','Choose a place'],locale)}</option>{places.map(id=><option key={id} value={id}>{nodes.findIndex(n=>n.id===id)>=0?`${nodes.findIndex(n=>n.id===id)+1}. `:''}{tx(placeTitle(save,id),locale)} · {tx(rooms[id].outdoor?['室外','Outdoors']:['建筑内','Inside'],locale)}</option>)}</select></label>
  <section className="harbor-spatial-destination" aria-label={tx(['目的地与路线','Destination and route'],locale)}>
   <strong>{tx(placeTitle(save,selected),locale)}{targetNode?.portal?' · '+tx(['入口','Entrance'],locale):''}</strong>
   <p role="status">{route.failure?tx(routeMessages[route.failure],locale):route.places.map(id=>tx(placeTitle(save,id),locale)).join(' → ')}</p>
   {!route.failure&&<p>{tx(shared?['沿公共道路直接步行到达。','Walk directly along the public route.']:['步行只走到下一入口；到门边后确认进入。','Walk to the next entrance, then confirm entering at the door.'],locale)}</p>}
   <div className="harbor-spatial-actions"><button className="harbor-primary" disabled={busy||!reachable||!onWalk} onClick={()=>{if(submission.current)return;submission.current=true;onWalk?.(selected)}}>{tx(shared?['步行到此处','Walk to this place']:['走到下一入口','Walk to next entrance'],locale)}</button><button disabled={busy||!!quick.failure} onClick={()=>{if(submission.current)return;submission.current=true;onTravel(selected)}}>{tx(['快捷返回','Quick return'],locale)}{!quick.failure&&save.movingClock?' · '+longTravelMinutes(save.scene,selected)+' '+tx(['分钟','min'],locale):''}</button></div>
   {!route.failure&&!reachable&&<p>{tx(['入口暂不可达，请用摇杆调整位置再试。','The entrance cannot be reached. Move with the stick and try again.'],locale)}</p>}
   {!route.failure&&quick.failure&&<p>{tx(routeMessages[quick.failure],locale)}</p>}
   <details><summary>{tx(['到达提示与此地的事情','Arrival tips and matters here'],locale)}</summary>{arrivalWarnings(save,selected).map((w,i)=><p key={i}>{tx(w,locale)}</p>)}{onExplore&&<button onClick={onExplore}>{tx(['查看此地的事情','Matters at this place'],locale)}</button>}</details>
  </section>
 </div>;
}
