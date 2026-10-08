import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {batchArt,itemArt} from '../src/ui/bag-art';
import art from '../src/ui/bag-art.json';
import {bagRows} from '../src/ui/Bag';
import {initial} from '../src/story/state';
import {pinLegacy,addLot} from '../src/life/save';
import {createPlantsRegistry,snapPeaV2Ref} from '../server/life-plants-b2';
import {lifeView} from '../server/life-view';
test('selected derivatives match their fixed source bytes and complete 256px PNG canvases',()=>{
 assert.equal(Object.keys(art.assets).length,8);
 for(const a of Object.values(art.assets)){
  const source=readFileSync('public/'+a.source.slice(2)),png=readFileSync('public/'+a.image.slice(2));
  const hash=(b:Buffer)=>createHash('sha256').update(b).digest('hex');
  assert.equal(hash(source),a.sourceSHA256);assert.equal(hash(png),a.sha256);
  assert.equal(png.readUInt32BE(16),256);assert.equal(png.readUInt32BE(20),256);assert.equal(png[25],6);
 }
});
test('unknown crop revisions, changed hashes and old pea batches never borrow current art',()=>{
 const registry=createPlantsRegistry(),original=registry.ref('crop:radish');
 assert.ok(batchArt(original,'produce'));assert.equal(batchArt(original,'seed'),undefined);
 for(const ref of [{...original,revision:3},{...original,hash:'0'.repeat(64)},{...original,capability:'unknown'}])assert.equal(batchArt(ref as any,'produce'),undefined);
 assert.equal(batchArt({...snapPeaV2Ref,revision:1},'seed'),undefined);
 assert.equal(batchArt(snapPeaV2Ref,'seed'),art.assets['snap-pea-seed'].image);
 assert.equal(batchArt(snapPeaV2Ref,'produce'),art.assets['snap-pea-produce'].image);
});
test('items without corresponding art stay text-only instead of using another item',()=>{
 for(const id of art.missing)assert.equal(itemArt(id),undefined,id);
 assert.equal(itemArt('wild:harbor-mint-leaf'),undefined);assert.equal(itemArt('wild-mint-leaf'),undefined);
 assert.equal(itemArt('wood'),art.assets.wood.image);assert.equal(itemArt('unknown'),undefined);
});
test('read-failure and recovered projection share art and quantities without duplicating saved inventory',()=>{
 const registry=createPlantsRegistry(),s=pinLegacy({...initial('en','ui-art-test'),items:{'seed-radish':3,'crop-radish':2,wood:2,key:1}},registry);
 addLot(s,registry,snapPeaV2Ref,'seed',2,'synthetic-local-art-test');
 const before=structuredClone(s),fallback=bagRows(s,null),loaded=bagRows(s,lifeView(s,registry) as any);
 assert.deepEqual(fallback.map(r=>[r.id,r.quantity,r.image]),loaded.map(r=>[r.id,r.quantity,r.image]));
 assert.deepEqual(s,before);assert.equal(loaded.filter(r=>r.id==='crop:radish@1:produce').length,1);
 assert.equal(loaded.find(r=>r.id==='crop:radish@1:seed')!.image,undefined);
});
