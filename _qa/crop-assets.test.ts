import {test} from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {createHash} from 'node:crypto';
import art from '../src/world/crop-art.json';import {crops,plotIds} from '../src/story/crops';import {cropArtStage,harvestArtKey} from '../src/story/crop-art-stage';import {rooms,world} from '../src/world/data';import {findPath,walkable} from '../src/engine/world';
test('twelve pinned crop images cover exactly all world stages and harvested species',()=>{
 assert.equal(art.length,12);assert.equal(new Set(art.map(a=>a.key)).size,12);
 for(const crop of Object.keys(crops) as (keyof typeof crops)[]){const family=art.filter(a=>a.crop===crop);assert.deepEqual(family.map(a=>a.stage).sort(),['growing','harvest','ready','young']);assert.equal(new Set(family.filter(a=>a.stage!=='harvest').map(a=>a.scale)).size,1);
 for(const a of family){const b=readFileSync('public/'+a.image.slice(2));assert.equal(b.length,a.bytes);assert.equal(createHash('sha256').update(b).digest('hex'),a.sha256);assert.equal(b.readUInt32BE(16),256);assert.equal(b.readUInt32BE(20),256);assert.ok(a.anchor.every(v=>v>=0&&v<=256));assert.ok(a.scale>0&&a.scale<.25)}
 assert.ok(art.some(a=>a.key===harvestArtKey(crop)));
 for(const [grown,stage] of [[0,'young'],[crops[crop].minutes/2,'growing'],[crops[crop].minutes,'ready']] as const){const state={townMinutes:540,flags:[],cash:0,energy:100,items:{},plots:{'crop-bed-1':{crop,grown,updatedAt:540,wetUntil:540}}};assert.equal(cropArtStage(state,'crop-bed-1')!.stage,stage);assert.ok(art.some(a=>a.key===cropArtStage(state,'crop-bed-1')!.key))}}
});
test('new bed group is on the garden side, reachable and distinct from the notice',()=>{
 for(const id of plotIds){const e=rooms.garden.entities.find(e=>e.id===id)!;assert.ok(e.at.x>=600);assert.ok(walkable(world,'garden',e.approach));assert.ok(findPath(world,'garden',rooms.garden.spawn,e.approach).length);const distance=(p:{x:number;y:number})=>Math.hypot(e.approach.x+8-p.x,e.approach.y+6-p.y);assert.ok(distance(e.at)<65);for(const other of rooms.garden.entities.filter(o=>o.id!==id&&!o.person))assert.ok(distance(e.at)<distance(other.at),id+' is unambiguous at approach')}
});
