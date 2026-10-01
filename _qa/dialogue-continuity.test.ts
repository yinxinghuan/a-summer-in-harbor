import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {initial,applyAction,availableTopics,type Save} from '../src/story/state';
import {people,entityAt} from '../src/world/data';
import {dialoguePages,rememberReply,restoreReading,readingKey,draftKey,hasAsked} from '../src/story/dialogue-reading';
const cache=()=>{const m=new Map<string,string>();return {getItem:(k:string)=>m.get(k)??null,setItem:(k:string,v:string)=>{m.set(k,v)},removeItem:(k:string)=>{m.delete(k)}}};
const act=(s:Save,person:string,action:string,payload?:unknown)=>({action_id:randomUUID(),expected_version:s.version,scene:s.scene,position:entityAt(s.scene,person)!.approach,target:person,action,payload});
test('neutral initial questions, discovered bridge and prior answer gate follow-ups without reviving legacy topics',()=>{
 const s=initial('en',randomUUID());
 assert.ok(!availableTopics(s,'theo').find(t=>t.id==='coast')!.label[1].includes('closed'));
 assert.ok(!availableTopics(s,'june').some(t=>t.id==='bridge'));
 s.flags.push('bridge-seen');assert.ok(availableTopics(s,'june').some(t=>t.id==='bridge'));
 assert.ok(!availableTopics(s,'elena').some(t=>t.id==='hours'));
 s.flags.push('talk:elena:quiet');assert.ok(availableTopics(s,'elena').some(t=>t.id==='hours'));
 s.flags.push('talk:elena:hours');assert.ok(!availableTopics(s,'elena').some(t=>t.id==='hours'));
});
test('closed/reloaded midway response restores without modifying story; locale restarts same exchange and scopes reject other journeys/people',()=>{
 const c=cache();let s=initial('en',randomUUID());s=applyAction(s,act(s,'mara','introduce')).head;
 const entry=s.history[0];entry.text=['第一段介绍。'.repeat(24),'A measured sentence about the place. '.repeat(24)];
 const before=JSON.stringify(s);rememberReply(c,s,entry,'en');const restored=restoreReading(c,s,'mara','en')!;
 assert.ok(restored.pages.length>2);c.setItem(readingKey(s.id,'mara'),JSON.stringify({...restored.cursor,page:1}));
 assert.equal(restoreReading(c,s,'mara','en')!.cursor.page,1);
 assert.equal(restoreReading(c,s,'mara','zh')!.cursor.page,0);
 assert.equal(restoreReading(c,s,'theo','en'),null);assert.equal(restoreReading(c,{...s,id:randomUUID()},'mara','en'),null);
 assert.equal(restoreReading(c,{...s,history:[]},'mara','en'),null);
 assert.equal(JSON.stringify(s),before);
 const cursor={...restored.cursor,finished:true};c.setItem(readingKey(s.id,'mara'),JSON.stringify(cursor));
 rememberReply(c,s,entry,'en');assert.equal(restoreReading(c,s,'mara','en'),null,'receipt replay must not reopen a finished response');
 assert.notEqual(draftKey(s.id,'mara'),draftKey('other','mara'));
});
test('free dialogue is possible immediately after introduction; failure does not consume topic or count success',async()=>{
 const {createRuntime}=await import('../server/runtime');let s=initial('en',randomUUID());s=applyAction(s,act(s,'mara','introduce')).head;
 assert.equal(hasAsked(s),false);const before=JSON.stringify(s),a=act(s,'mara','ask',{text:'What should I do first?'});
 const failing=createRuntime(async()=>{throw Error('MODEL_CALL_FAILED')});await assert.rejects(failing.prepare(s,a,undefined,{owner:'test-owner'}),/MODEL_CALL_FAILED/);
 assert.equal(JSON.stringify(s),before);assert.ok(availableTopics(s,'mara').some(t=>t.id==='key'));
 const success=createRuntime(async()=>({topic:null,reply:['先安顿下来，慢慢认识这里。','Settle in first. There is time to get to know the place.']}));
 const result=await success.prepare(s,a,undefined,{owner:'test-owner'});assert.ok(hasAsked(result.head));assert.deepEqual(result.head.items,s.items);assert.deepEqual(result.head.flags,[...s.flags,'free-dialogue-experienced']);assert.ok(hasAsked({...result.head,history:[]}));
});
test('all introductions paginate into readable bilingual replies without dropping words',()=>{
 for(const p of Object.values(people))for(const locale of ['en','zh'] as const){const text=p.intro[locale==='zh'?0:1],pages=dialoguePages(text,locale);assert.equal(pages.join('').replace(/\s/g,''),text.replace(/\s/g,''));assert.ok(pages.every(p=>p.length<=(locale==='zh'?72:235)));}
});
