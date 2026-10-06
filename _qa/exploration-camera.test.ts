import {test} from 'node:test';import assert from 'node:assert/strict';
import {explorationCamera} from '../src/engine/exploration-camera';
// A geometric invariant over viewport/HUD sizes and future non-zero map origins.
// Renderer/browser evidence separately checks the actual adapter and material.
test('every reachable edge retains the same safe foot anchor without changing the walk rectangle',()=>{
 for(const size of [{x:246,y:368},{x:300,y:574},{x:787,y:529}])for(const walk of [{x:40,y:80,w:1280,h:880},{x:270,y:225,w:420,h:360},{x:-125,y:0,w:1440,h:1632}]){
  const original=structuredClone(walk),safe={left:12,top:130,right:12,bottom:115},scale=1.3;
  const {bounds:b,anchor:a}=explorationCamera({x:0,y:0,w:1440,h:1088},walk,size,safe,scale);
  for(const p of [{x:walk.x,y:walk.y},{x:walk.x+walk.w,y:walk.y+walk.h}]){
   const corner={x:p.x-a.x,y:p.y-a.y};assert.ok(corner.x>=b.x-1e-8&&corner.y>=b.y-1e-8);assert.ok(corner.x+size.x<=b.x+b.w+1e-8&&corner.y+size.y<=b.y+b.h+1e-8);
  }
  assert.deepEqual(walk,original);assert.ok(a.y*scale-73>=safe.top);assert.ok(a.y*scale<=size.y*scale-safe.bottom);
 }
});
