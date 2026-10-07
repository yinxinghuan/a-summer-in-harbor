import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {initial} from '../src/story/state';
import {createHarborLife} from '../server/life-assembly';
import {createRuntime} from '../server/runtime';
import {createLifeProjection,lifeProjectionKey} from '../src/candidate/life-projection';
const assembly=createHarborLife(createRuntime());
const seed=()=>({...initial('en',randomUUID()),known:['mara'],flags:['key','unpacked']});
const bump=(s:any,extra:any={})=>({...s,version:s.version+1,cursor:s.cursor+1,...extra});
test('owner projection key includes actual scene/position/known/notebook/animal proof and aliases only harmless ACKs',async()=>{
 const s=seed(),key=lifeProjectionKey(s);assert.equal(lifeProjectionKey(bump(s)),key);
 for(const extra of [{scene:'home'},{position:{x:s.position.x+1,y:s.position.y}},{known:['mara','dani']},{cash:s.cash+1},{flags:[...s.flags,'terrace-fixed']},{animalNotebookV1:{schema:1,briefs:[],pages:[{minute:540,sourceAction:randomUUID(),ref:{id:'fixture',revision:1,hash:'f'.repeat(64)}}]}},{townMinutes:541},{items:{other:1}}])assert.notEqual(lifeProjectionKey(bump(s,extra)),key);
 const sample={...s,animalNotebookV1:{schema:1,briefs:[],pages:[],sample:{version:s.version} as any}};assert.notEqual(lifeProjectionKey(sample as any),lifeProjectionKey(bump(sample)));
 const c=createLifeProjection(async h=>assembly.lifeProject(h));c.update(s,'browser-A:epoch1','fixed');await c.settled();const original=c.present().view!;
 c.update(bump(s),'browser-A:epoch1','fixed');assert.equal(c.present().current,true);assert.equal(c.present().view,original);assert.equal(original.snapshotVersion,s.version,'keep original server stamp');
 c.update(bump(s,{townMinutes:541}),'browser-A:epoch1','fixed');assert.equal(c.present().current,false);assert.equal(c.present().view,original,'keep stale display only');await c.settled();assert.equal(c.present().current,true);
 assert.equal(c.forHead(s,'browser-B:epoch2','fixed').view,null);assert.equal(c.forHead(s,'browser-A:epoch1','changed-assembly').view,null);assert.equal(c.forHead({...s,id:randomUUID()},'browser-A:epoch1','fixed').view,null);c.dispose();
});
test('owner projection retries a read that saw a commit before its ACK, and rejects mismatched animal stamps',async()=>{
 const s=seed(),next=bump(s);let reads=0;
 const c=createLifeProjection(async()=>{reads++;return assembly.lifeProject(next)});c.update(s,'A','fixed');await c.settled();assert.equal(c.present().current,false);assert.equal(c.present().status,'error');
 c.update(next,'A','fixed');await c.settled();assert.equal(reads,2);assert.equal(c.present().current,true);assert.equal(c.present().view!.snapshotVersion,next.version);c.dispose();
 const bad=createLifeProjection(async h=>({...assembly.lifeProject(h),animals:{...assembly.animalProject(h),snapshotVersion:h.version+1}}));bad.update(s,'A','fixed');await bad.settled();assert.equal(bad.present().current,false);assert.equal(bad.present().view,null);bad.dispose();
});
