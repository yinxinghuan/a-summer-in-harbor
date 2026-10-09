import pack from './content/reviewed-evening-gull-watch.json';
import {AnimalContentRegistry,builtInCommissions,canonical,validateCommission} from './animal-content';
import {compileAnimalStoryChoice} from './animal-grounding';
import {inspectAnimalChoice,assertBoundAnimalReview,parseBoundAnimalReview,animalContractHash} from './animal-grounded-review';
import {createHarborLife} from './life-assembly';

/** One frozen, already reviewed definition. No gateway, artifact transplantation,
 * model route or test-save adoption is needed to offer it to introduced Dani. */
export function reviewedAnimalRegistry(newStarts=true){
 if(pack.contractHash!==animalContractHash)throw Error('REVIEWED_ANIMAL_CONTRACT_MISMATCH');
 validateCommission(pack.definition);
 const inspection=inspectAnimalChoice(pack.groundedChoice,['dani'],builtInCommissions);
 assertBoundAnimalReview(parseBoundAnimalReview(JSON.stringify(pack.independentReview)),inspection);
 if(canonical(compileAnimalStoryChoice(pack.groundedChoice,['dani']))!==canonical(pack.definition))throw Error('REVIEWED_ANIMAL_DEFINITION_MISMATCH');
 const definitions=[...builtInCommissions,pack.definition];
 const enabled=[...builtInCommissions,...(newStarts?[pack.definition]:[])].map(d=>d.id+'@'+d.revision);
 const registry=new AnimalContentRegistry(definitions,enabled);
 if(canonical(registry.ref(pack.definition.id,pack.definition.revision))!==canonical(pack.ref))throw Error('REVIEWED_ANIMAL_REF_MISMATCH');
 return registry;
}

export function createReviewedAnimalLife(...args:Parameters<typeof createHarborLife>){
 return createHarborLife(args[0],args[1],args[2],reviewedAnimalRegistry());
}
