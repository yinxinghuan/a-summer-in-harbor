import test from 'node:test';import assert from 'node:assert/strict';
import pack from '../server/content/reviewed-evening-gull-watch.json';
import {rooms} from '../src/world/data';
import {animalObservationSceneIds,animalChoiceSchema,contractViolations} from '../server/animal-contract-schema';
import {animalContractHash} from '../server/animal-grounded-review';
import {reviewedAnimalRegistry} from '../server/reviewed-animal-life';
test('new chapel preserves the exact frozen animal review contract and existing content reader',()=>{
 assert.ok(rooms.chapel);assert.equal(animalContractHash,pack.contractHash);
 assert.deepEqual(reviewedAnimalRegistry().ref(pack.ref.id,pack.ref.revision),pack.ref);
 assert.deepEqual([...animalObservationSceneIds],Object.keys(rooms).filter(id=>id!=='chapel'));
});
test('a new map cannot grant a new animal observation through the old review schema',()=>{
 const choice=structuredClone(pack.groundedChoice);choice.observations[0].scene='chapel';
 assert.ok(contractViolations(choice,animalChoiceSchema).some(v=>v.path==='$.observations[0].scene'&&v.constraint==='enum'));
});
