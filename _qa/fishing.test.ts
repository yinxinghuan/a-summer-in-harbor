import {test} from 'node:test';import assert from 'node:assert/strict';
import {fishingInitial,fishingStep,recordFishing,replayFishing,type FishingRun} from '../src/challenges/fishing';
test('fishing tension matters, controlled hold/release catches a fish',()=>{
 let s=fishingInitial();const runs:FishingRun[]=[];
 while(s.result==='playing'){const reel=s.tension<.7;recordFishing(runs,reel);s=fishingStep(s,reel)}
 assert.equal(s.result,'caught');assert.deepEqual(replayFishing(runs),s);assert.ok(s.tick>300);
});
test('holding blindly loses and cannot submit a made up win',()=>{
 let s=fishingInitial();const runs:FishingRun[]=[];
 while(s.result==='playing'){recordFishing(runs,true);s=fishingStep(s,true)}
 assert.equal(s.result,'escaped');assert.throws(()=>replayFishing([...runs,{ticks:1,reel:true}]),/INPUT_AFTER_RESULT/);
 assert.throws(()=>replayFishing([{ticks:Infinity,reel:true}]),/INVALID_FISHING_INPUT/);
});
