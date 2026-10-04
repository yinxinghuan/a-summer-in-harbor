import{test}from'node:test';import assert from'node:assert/strict';import{cropArtStage,harvestArtKey}from'../src/story/crop-art-stage';import{crops,type CropId}from'../src/story/crops';
test('crop visuals use watered growth, remain species-correct and preserve stage when dry/reloaded',()=>{
 for(const crop of Object.keys(crops) as CropId[]){const length=crops[crop].minutes;const s={townMinutes:0,flags:[],cash:0,energy:100,items:{},plots:{'crop-bed-1':{crop,grown:0,updatedAt:0,wetUntil:Math.min(720,length)}}};
 assert.equal(cropArtStage(s,'crop-bed-1')?.key,`crop-${crop}-young`);
 const growing={...s,townMinutes:Math.ceil(length/3)};assert.equal(cropArtStage(growing,'crop-bed-1')?.key,`crop-${crop}-growing`);
 const dry={...s,townMinutes:9000,plots:{'crop-bed-1':{crop,grown:0,updatedAt:0,wetUntil:1}}};assert.equal(cropArtStage(dry,'crop-bed-1')?.stage,'young');assert.equal(cropArtStage(dry,'crop-bed-1')?.dry,true);
 assert.deepEqual(cropArtStage(JSON.parse(JSON.stringify(dry)),'crop-bed-1'),cropArtStage(dry,'crop-bed-1'));
 assert.equal(cropArtStage({...s,plots:{'crop-bed-1':{crop,grown:length,updatedAt:0,wetUntil:0}}},'crop-bed-1')?.stage,'ready');assert.equal(harvestArtKey(crop),`produce-${crop}`);
 assert.equal(cropArtStage({...s,plots:{}},'crop-bed-1'),null);
 }
});
