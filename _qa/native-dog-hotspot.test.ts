import test from 'node:test';
import assert from 'node:assert/strict';
import {createNativeDogRuntime,nativeDogTargets,nativeDogId,nativeDogBody} from '../src/animals/native-dog';
import {gameAnimalContext} from '../src/animals/game';
import {createAnimalRuntime} from '../src/animals/behavior';
import {acceptedAnimals} from '../src/animals/art';
import {overlaps} from '../src/animals/spatial';

const head={scene:'station',townMinutes:540,flags:['key','unpacked','bag-returned']};
const context=gameAnimalContext(head,{x:600,y:820},{paused:true});
const originals=createAnimalRuntime(acceptedAnimals).tick(0,context);
const state=createNativeDogRuntime().tick(0,context,originals,true)[0];

test('admitted native dog gets exactly one read-only target at its actual rendered foot',()=>{
 const [target]=nativeDogTargets([state],head.scene);
 assert.equal(target.id,nativeDogId);assert.deepEqual(target.at,state.foot);
 assert.deepEqual(target.actions,[]);assert.notEqual(target.at,state.foot);
 // Player feet can reach the normal interaction distance without intersecting
 // the original measured dog body. No collision or follow radius is reduced.
 assert.ok(Math.hypot(target.approach.x+8-state.foot.x,target.approach.y+6-state.foot.y)<65);
 assert.equal(overlaps(nativeDogBody(state.foot),{...target.approach,w:16,h:12}),false);
});
test('no hotspot survives an absent dog, wrong scene, or another animal identity',()=>{
 assert.deepEqual(nativeDogTargets([{...state,visible:false}],head.scene),[]);
 assert.deepEqual(nativeDogTargets([state],'courtyard'),[]);
 assert.deepEqual(nativeDogTargets([{...state,id:'harbor-cat-1'}],head.scene),[]);
});
test('live movement updates both target and approach without rewriting earlier samples or saved data',()=>{
 const before=nativeDogTargets([state],head.scene)[0];
 const moved={...state,foot:{x:state.foot.x+4,y:state.foot.y+3}};
 const after=nativeDogTargets([moved],head.scene)[0];
 assert.equal(after.at.x-before.at.x,4);assert.equal(after.at.y-before.at.y,3);
 assert.equal(after.approach.x-before.approach.x,4);assert.equal(after.approach.y-before.approach.y,3);
 assert.deepEqual(before.at,state.foot);assert.deepEqual(head.flags,['key','unpacked','bag-returned']);
});
