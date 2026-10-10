import test from 'node:test';
import assert from 'node:assert/strict';
import {createNativeDogRuntime,nativeDogBody} from '../src/animals/native-dog';
import {createAnimalRuntime} from '../src/animals/behavior';
import {acceptedAnimals} from '../src/animals/art';
import {gameAnimalContext} from '../src/animals/game';
import {overlaps,terrainClear} from '../src/animals/spatial';
import type {Context,AnimalDef} from '../src/animals/types';
const save={scene:'station',townMinutes:540,flags:['key','unpacked','bag-returned']};
const far=gameAnimalContext(save,{x:600,y:820},{paused:true});
const old=createAnimalRuntime(acceptedAnimals).tick(0,far);
test('player display proximity preserves native dog foot even when paused; clearing space resumes without a jump',()=>{
 const r=createNativeDogRuntime(),before=r.tick(0,far,old,true)[0];assert.equal(before.visible,true);
 assert.deepEqual(before.foot,{x:640,y:712});
 const near=gameAnimalContext(save,{x:596,y:752},{paused:true});assert.equal(overlaps(nativeDogBody(before.foot),near.player),false);
 for(const dt of [0,.016,.04,100]){const next=r.tick(dt,near,old,true)[0];assert.equal(next.visible,true);assert.deepEqual(next.foot,before.foot);assert.equal(next.reason,'space-occupied');assert.equal(next.pose,'stand')}
 const after=r.tick(.04,{...far,paused:false},old,true)[0];assert.ok(Math.hypot(after.foot.x-before.foot.x,after.foot.y-before.foot.y)<=36*.04+1e-7);assert.notEqual(after.reason,'space-occupied');
 assert.deepEqual(r.tick(0,{...near,townMinutes:541},old,true)[0].foot,after.foot);
});
test('the original cat ignores visual-only player proximity and retains its unchanged resting behavior',()=>{
 const cats=createAnimalRuntime(acceptedAnimals),first=cats.tick(0,far),cat=first.find(s=>s.id==='harbor-cat-1')!;
 const near=gameAnimalContext(save,{x:cat.foot.x-44,y:cat.foot.y+40},{paused:true});
 const after=cats.tick(0,near).find(s=>s.id===cat.id)!;assert.deepEqual(after.foot,cat.foot);assert.equal(after.pose,cat.pose);
});
const dog:AnimalDef={id:'qa-dog',species:'dog',visualVersion:'fixture',ownerId:'owner',schedule:{morning:{scene:'yard',region:{x:0,y:0,w:300,h:200},points:[{x:100,y:100}],activity:'follow'}}};
const context:Context={scene:'yard',townMinutes:540,paused:false,player:{x:280,y:170,w:16,h:12},people:{owner:{scene:'yard',foot:{x:180,y:100},body:{x:171,y:92,w:18,h:8}}},forbidden:{},world:{width:300,height:200,step:4,actor:{w:16,h:12},scenes:{yard:{spawn:{x:100,y:100},interior:{x:0,y:0,w:300,h:200},obstacles:[]}}}};
test('continuous same-slot follow keeps its progressed foot across each committed minute, pauses and unrelated weather slots',()=>{
 const r=createAnimalRuntime([dog],{holdOccupied:true,preserveVisibleSlot:true});let s=r.tick(.04,context)[0];
 for(let i=0;i<20;i++)s=r.tick(.04,context)[0];const foot={...s.foot};assert.ok(foot.x>100+10);
 for(const minute of [541,542,550]){const next=r.tick(0,{...context,townMinutes:minute,paused:true,animalSlots:{unrelated:{scene:'elsewhere',region:{x:0,y:0,w:1,h:1},points:[{x:0,y:0}],activity:'shelter'}}})[0];assert.deepEqual(next.foot,foot);assert.equal(next.pose,'stand')}
 const away=r.tick(.04,{...context,townMinutes:550,people:{}})[0];assert.equal(away.reason,'owner-away');assert.deepEqual(away.foot,foot);
});
test('a new occupied display reservation holds at valid ground and cannot grant walking through a wall',()=>{
 const r=createAnimalRuntime([dog],{holdOccupied:true,preserveVisibleSlot:true});const s=r.tick(0,context)[0];
 const blocked={...context,paused:true,player:{x:s.foot.x-8,y:s.foot.y-8,w:16,h:12}};
 const next=r.tick(0,blocked)[0];assert.deepEqual(next.foot,s.foot);assert.equal(next.visible,true);assert.equal(next.reason,'space-occupied');assert.equal(terrainClear(next.foot,next.slot!,{collision:{w:22,h:10}} as any,blocked),true);
 const wall={...blocked,world:{...context.world,scenes:{yard:{...context.world.scenes.yard,obstacles:[{x:s.foot.x-20,y:s.foot.y-20,w:40,h:40}]}}}};
 const hidden=r.tick(0,wall)[0];assert.equal(hidden.visible,false);assert.equal(hidden.reason,'no-safe-position');assert.deepEqual(hidden.foot,s.foot);
});
