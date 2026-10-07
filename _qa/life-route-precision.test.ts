import test from 'node:test';
import assert from 'node:assert/strict';
import {advanceRoute} from '../src/engine/distance-motion';
import {findPath,walkable} from '../src/engine/world';
import {dynamicWorld} from '../src/dynamic-assets/layout';
import {landWorld} from '../src/life/land';
import {rooms} from '../src/world/data';

test('actual courtyard bed route: varied frame budgets retain exact legal edge coordinates without crossing soil',()=>{
 const world=landWorld(dynamicWorld(['key','unpacked','garden-agreed','alternative-route'],false),{schema:1,permissions:{},plots:[{id:'land-bed-1',region:'courtyard-common',geometryRevision:1,at:{x:288,y:604},sourceAction:'fixture',minute:540}]}),destination={x:280,y:622};
 const path=findPath(world,'courtyard',rooms.courtyard.spawn,destination);assert.ok(path.length);
 let seed=171;
 // The original kernel stalls on trial 29 at x=311.99999999999994, y≈567.19.
 for(let trial=1;trial<=40;trial++){
  let position={...rooms.courtyard.spawn};const route=[...path];
  for(let frame=0;route.length&&frame<1000;frame++){
   seed=(Math.imul(seed,1664525)+1013904223)>>>0;
   const result=advanceRoute(position,route,112*(.005+seed/4294967296*.035),p=>walkable(world,'courtyard',p));
   assert.equal(result.blocked,false,JSON.stringify({trial,frame,position:result.position}));position=result.position;route.splice(0,result.consumed);assert.ok(walkable(world,'courtyard',position));
  }
  assert.deepEqual(position,destination);assert.equal(route.length,0);
 }
 const blocked=advanceRoute({x:312,y:564},[{x:300,y:590}],100,p=>walkable(world,'courtyard',p));assert.equal(blocked.blocked,true);assert.ok(walkable(world,'courtyard',blocked.position));
});
