import test from 'node:test';
import assert from 'node:assert/strict';
import {initial} from '../src/story/state';
import {rooms,people,type Locale} from '../src/world/data';
import {questionExamples} from '../src/story/question-examples';

function state(person:string,flags:string[]=[]){
 const s=initial('en','example-test');s.known=[person];s.scene=Object.values(rooms).find(r=>r.entities.some(e=>e.person===person))!.id;s.flags=flags;return s;
}
test('every actual NPC input has multiple distinct, bilingual, bounded examples without mutating the save',()=>{
 for(const person of Object.keys(people))for(const locale of ['zh','en'] as Locale[]){
  const s=state(person),before=JSON.stringify(s),result=questionExamples(s,person,locale);
  assert.ok(result.candidates.length>=2,person);assert.equal(new Set(result.candidates.map(c=>c.text)).size,result.candidates.length);
  for(const c of result.candidates){assert.ok(c.text.length>0&&c.text.length<=400);assert.ok(locale==='zh'?/\p{Script=Han}/u.test(c.text):! /\p{Script=Han}/u.test(c.text));}
  assert.equal(JSON.stringify(s),before);
 }
});
test('completion overrides unconsumed old topics and absent consumed bag/materials after restore',()=>{
 const pairs=[['mara',['key','unpacked','bag-returned']],['theo',['terrace-fixed']],['june',['bridge-fixed']],['arthur',['alternative-route']],['elena',['garden-agreed']]] as [string,string[]][];
 for(const [person,flags] of pairs){const s=state(person,flags),result=questionExamples(JSON.parse(JSON.stringify(s)),person,'en');
  assert.match(result.candidates[0].id,/returned|fixed|mapped|hours/);assert.deepEqual(s.items,{});
  assert.ok(!result.candidates.some(c=>/pick up|find.*tool bag|two.*planks|repair the bridge/i.test(c.text)));
 }
});
test('unknown person or mismatched scene yields spoiler-free generic fallback',()=>{
 for(const person of ['mara','missing']){const s=initial('en','fallback');const options=questionExamples(s,person,'en').candidates;
  assert.deepEqual(options.map(c=>c.id),['place','day']);assert.ok(!options.some(c=>/bridge|bag|key|trail|Mara/.test(c.text)));
 }
 const s=state('june');s.scene='home';assert.equal(questionExamples(s,'june','en').candidates[0].id,'place');
});
test('introductory examples do not leak optional repairs, trails or future clues',()=>{
 for(const person of Object.keys(people)){const options=questionExamples(state(person),person,'en').candidates;
  assert.ok(!options.some(c=>/lantern|public trail|ten to twelve|clues|repaired/i.test(c.text)),person);
 }
});
test('context identity resets on relevant progress, locale, journey and person, not incidental version',()=>{
 const s=state('mara',['key','unpacked']),a=questionExamples(s,'mara','en').key;
 s.version++;assert.equal(questionExamples(s,'mara','en').key,a);
 s.flags.push('bag-returned');assert.notEqual(questionExamples(s,'mara','en').key,a);
 const b=questionExamples(s,'mara','en').key;
 assert.notEqual(questionExamples(s,'mara','zh').key,b);s.id='other-journey';assert.notEqual(questionExamples(s,'mara','en').key,b);
});
test('dynamic room observations do not imply the NPC knows them; completed repeat conversations retain examples',()=>{
 const s=state('june',['free-dialogue-experienced','bridge-fixed','market-open']);
 s.fieldNotes={rooms:[{observations:[{read:false}]}]} as any;
 assert.ok(!questionExamples(s,'june','en').candidates.some(c=>c.id==='june-observed'));
 s.fieldNotes!.rooms[0].observations[0].read=true;
 assert.ok(!questionExamples(s,'june','en').candidates.some(c=>/clues|examined/.test(c.text)));
 assert.equal(questionExamples(s,'june','en').candidates[0].id,'june-fixed');
});
