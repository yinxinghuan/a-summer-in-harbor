import test from 'node:test';
import assert from 'node:assert/strict';
import {world} from '../src/world/data';
import {walkable} from '../src/engine/world';
import {CLUSTER,clusterWalkable,globalPoint,localPoint,pointZone} from '../src/candidate/continuity';
import {adaptContinuousSpace} from '../src/candidate/render-adapter';
import type {SpaceOptions} from '../src/engine/rpg-space';

test('preserved overlap arrivals/routes remain usable; every seam endpoint has a real logical map',()=>{
 const previous=(globalThis as any).location;(globalThis as any).location={search:''};try{
 const points=[{scene:'bazaar',at:{x:80,y:648}},{scene:'bazaar',at:{x:80,y:668}},{scene:'bazaar',at:{x:864,y:668}},{scene:'market',at:{x:597,y:110}}];
 for(const {scene,at} of points){const p=globalPoint(scene,at);assert.equal(walkable(world,scene,at),true);assert.equal(pointZone(p,scene),scene);assert.equal(clusterWalkable(world,p,scene),true);
  let wrapped!:SpaceOptions;
  adaptContinuousSpace({world,scene,position:at,spritesheets:[],mapEvents:()=>[],onPosition:()=>{},onReady:()=>{},controlsBlocked:()=>false} as any,o=>{wrapped=o;return {scene:()=>CLUSTER,position:()=>p} as any});
  assert.equal(wrapped.arrivalWalkable!(p,CLUSTER),true);const target=globalPoint(scene,{x:at.x,y:at.y-28});const route=wrapped.findPath!(p,target,CLUSTER);assert.ok(route.length,'ordinary route out of old overlap must exist');
  for(const q of route)assert.ok(clusterWalkable(world,q,scene));
 }
 for(let y=580;y<=720;y++)for(const scene of ['market','bazaar']){const p={x:597,y},zone=pointZone(p,scene);assert.equal(clusterWalkable(world,p,scene),true);assert.equal(walkable(world,zone,localPoint(zone,p)),true,'packet endpoint needs readable logical coordinates')}
 assert.equal(clusterWalkable(world,{x:800,y:619},'market'),false);assert.equal(clusterWalkable(world,{x:205,y:669},'bazaar'),false);assert.equal(clusterWalkable(world,{x:597,y:669},'bazaar'),true);
 }finally{if(previous===undefined)delete (globalThis as any).location;else (globalThis as any).location=previous}
});
