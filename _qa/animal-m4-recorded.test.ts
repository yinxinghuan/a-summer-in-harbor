/** Frozen SUCCESSFUL Game Chat responses; never imports the live operator. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {animalChoiceSchema,contractViolations} from '../server/animal-contract-schema';
import {inspectAnimalChoice,parseBoundAnimalReview,assertBoundAnimalReview,registeredAnimalScheduleFacts,publicAnimalReviewPacket} from '../server/animal-grounded-review';
import {compileAnimalStoryChoice,assertCompiledAnimalChoice} from '../server/animal-grounding';
import {AnimalContentRegistry,builtInCommissions,contentHash} from '../server/animal-content';
const bytes=(ordinal:number)=>readFileSync(new URL(`./fixtures/animal-live-m4-v5-20261008-${ordinal}.json`,import.meta.url));
const raw=(ordinal:number)=>JSON.parse(bytes(ordinal).toString()).choices[0].message.content;
const known=['mara','ruth','owen','dani'],choice=JSON.parse(raw(1));
test('M4 frozen original responses retain actual network byte hashes',()=>{
 assert.equal(createHash('sha256').update(bytes(1)).digest('hex'),'d900ad5b54a00553655975612c6349cff795d54844ef3c5754b3a4c956fdb77f');
 assert.equal(createHash('sha256').update(bytes(2)).digest('hex'),'093c73f97e710e7fdfa31bd4d324fe7d709542d9328d9f27963c29d6a386486b');
});
test('M4 raw candidate directly fits schema and both exact registered evening facts',()=>{
 assert.deepEqual(contractViolations(choice,animalChoiceSchema),[]);
 assert.deepEqual(inspectAnimalChoice(choice,known).issues,[]);
 assert.equal(choice.observations.length,2);assert.equal(choice.resident,'dani');
 for(const o of choice.observations)assert.equal(registeredAnimalScheduleFacts.filter(f=>f.animal===o.animal&&f.period===o.period&&f.scene===o.scene).length,1);
 assert.ok(!builtInCommissions.some(d=>d.id===choice.id));
});
test('M4 independent review has exact V2 shape and agrees with private fact reconciliation',()=>{
 const review=parseBoundAnimalReview(raw(2)),packet=inspectAnimalChoice(choice,known);
 assert.deepEqual(review,{format:'harbor-animal-review-v2',passed:true,findings:[]});
 assert.deepEqual(assertBoundAnimalReview(review,packet),{trusted:true,passed:true});
 assert.equal('issues' in publicAnimalReviewPacket(packet),false);
 assert.throws(()=>assertBoundAnimalReview({...review,passed:false,findings:[{observationId:packet.observations[0].observationId,factId:packet.observations[0].factId,ruleId:'ANIMAL_SCHEDULE_MISMATCH'}]},packet),/ANIMAL_REVIEW_UNTRUSTED/);
});
test('M4 author compilation preserves registered individual requirements and ref/hash',()=>{
 const definition=compileAnimalStoryChoice(choice,known);assertCompiledAnimalChoice(choice,definition);
 assert.deepEqual(definition.requirements,[{animal:'harbor-gull-3',behavior:'shore-space'},{animal:'harbor-gull-4',behavior:'shore-space'}]);
 const ref=new AnimalContentRegistry([definition]).ref(definition.id,definition.revision);
 assert.equal(ref.hash,contentHash(definition));assert.ok(definition.brief[1].includes('shore gull 3')&&definition.brief[1].includes('shore gull 4'));
});
