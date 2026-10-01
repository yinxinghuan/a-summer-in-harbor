import {test} from 'node:test';
import assert from 'node:assert/strict';
import {dailyUseSpaces} from '../src/world/scene-use';
import {rooms,world} from '../src/world/data';
import {findPath,walkable} from '../src/engine/world';
test('daily activity groups retain an unobstructed reachable standing side',()=>{
 for(const p of dailyUseSpaces){
  assert.ok(walkable(world,p.scene,p),`${p.scene}: ${p.activity} standing space`);
  assert.ok(findPath(world,p.scene,rooms[p.scene].spawn,p).length,`${p.scene}: ${p.activity} reachable from entrance`);
 }
});
