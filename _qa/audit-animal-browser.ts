import {readFileSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {acceptedAnimals,animalArts} from '../src/animals/art';
import {profiles} from '../src/animals/config';
import {slotAt} from '../src/animals/behavior';
import {pointClear} from '../src/animals/spatial';
import {gameAnimalContext} from '../src/animals/game';
import {initial} from '../src/story/state';
const file='doc/qa/animals-integration-20261006/ui-final-build-v3/browser-report.json';const report=JSON.parse(readFileSync(file,'utf8'));
assert.equal(report.cases.length,12);assert.deepEqual(report.pageErrors,[]);assert.deepEqual(report.failedArt,[]);assert.equal(report.failure,undefined);
const results=[];
for(const c of report.cases){
 const projections=c.final;let maxFootSyncError=0;
 for(const target of projections.targets){const actor=projections.actors.find((a:any)=>a.id==='animal-'+target.id);assert.ok(actor?.graphics.length);const error=Math.hypot(actor.x-target.x,actor.y-target.y);maxFootSyncError=Math.max(maxFootSyncError,error);assert.ok(error<6,'DOM and synchronized client event can differ only within bounded network/frame delay');}
 const moving=new Map<string,{animations:Set<string>;positions:Set<string>}>();let checkedMotionPoints=0;
 if(c.motion){const save={...initial('en','synthetic-audit'),scene:c.name==='gull'?'dock':'station',townMinutes:780,flags:['key','unpacked']};const ctx=gameAnimalContext(save,save.position);ctx.player={x:-1000,y:-1000,w:16,h:12};
  for(const tick of c.motion)for(const a of tick.actors.filter((a:any)=>a.graphic)){
   const def=acceptedAnimals.find(d=>'animal-'+d.id===a.id)!;assert.ok(def);const slot=slotAt(def,780)!;
   assert.ok(pointClear({x:a.x,y:a.y},slot,profiles[def.species],ctx,[],false));checkedMotionPoints++;
   const item=moving.get(a.id)??{animations:new Set<string>(),positions:new Set<string>()};item.animations.add(a.animation);item.positions.add(a.x.toFixed(1)+','+a.y.toFixed(1));moving.set(a.id,item);
  }
  assert.ok([...moving.values()].some(item=>item.positions.size>10));if(c.name==='cat-walk'){const phases=[...moving.get('animal-harbor-cat-1')!.animations];assert.ok(phases.some(p=>p.startsWith('walkA')));assert.ok(phases.some(p=>p.startsWith('walkB')));assert.ok(phases.some(p=>p.startsWith('stand')))}
  if(c.name==='gull'){const phases=[...moving.get('animal-harbor-gull-3')!.animations];assert.ok(phases.some(p=>p.startsWith('wing-up')));assert.ok(phases.some(p=>p.startsWith('wing-down')));assert.ok(phases.some(p=>p.startsWith('stand')))}
 }
 for(const texture of projections.textures)assert.ok(texture.visible&&texture.renderable&&texture.frame.w>0&&texture.frame.h>0);
 results.push({name:c.name,width:c.width,maxFootSyncError,checkedMotionPoints,actualTextures:projections.textures.length,motion:[...moving].map(([id,x])=>({id,uniquePositions:x.positions.size,animationCoverage:[...x.animations].map(s=>s.replace(/:\d+$/,'')).filter((s,i,a)=>a.indexOf(s)===i).sort()}))});
}
const result={passed:true,source:file,cases:results,uncapturedTextureField:'worldAlpha is not exposed by this Pixi version; no alpha-value assertion claimed',scope:'actual client event+Pixi texture and DOM targets; current 19-resident geometry clearance. Motion audit does not replace visual review or real phone.'};writeFileSync('doc/qa/animals-integration-20261006/browser-mechanical-audit-final.json',JSON.stringify(result,null,2));console.log(JSON.stringify({passed:true,cases:results.length,motionPoints:results.reduce((n,r)=>n+r.checkedMotionPoints,0),maxFootSyncError:Math.max(...results.map(r=>r.maxFootSyncError))}));
