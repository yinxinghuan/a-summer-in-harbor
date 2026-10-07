import {test} from 'node:test';import assert from 'node:assert/strict';
import {bagRows} from '../src/ui/Bag';import {initial} from '../src/story/state';import {pinLegacy,addLot} from '../src/life/save';import {createPlantsRegistry,snapPeaV2Ref} from '../server/life-plants-b2';import {lifeView} from '../server/life-view';
test('read failure keeps pinned original and current goods, quantities and identities with no duplicate or invented use',()=>{
 const r=createPlantsRegistry(),s=pinLegacy({...initial('en','synthetic-bag'),items:{'seed-basil':2,'crop-basil':1,key:1}},r);addLot(s,r,snapPeaV2Ref,'seed',3,'fixture');const before=structuredClone(s),rows=bagRows(s,null);
 assert.equal(rows.filter(b=>b.id==='crop:basil@1:seed').length,1);assert.equal(rows.find(b=>b.id==='crop:basil@1:seed')?.quantity,2);assert.equal(rows.find(b=>b.id==='crop:snap-pea@2:seed')?.quantity,3);assert.ok(rows.every(b=>!b.batch));assert.deepEqual(s,before);
 const loaded=bagRows(s,lifeView(s,r) as any);assert.deepEqual(loaded.map(b=>[b.id,b.quantity]),rows.map(b=>[b.id,b.quantity]));
});
test('unupgraded saves keep original inventory and stable order without persisting a migration',()=>{
 const s={...initial('en','old-bag'),items:{key:1,'seed-basil':2,'crop-basil':3,photo:1}},before=structuredClone(s),rows=bagRows(s,null);assert.equal(rows.length,4);assert.equal(rows[0].category,'seed');assert.equal(rows[1].category,'produce');assert.deepEqual(s,before);assert.equal((s as any).lifeV1,undefined);
});
