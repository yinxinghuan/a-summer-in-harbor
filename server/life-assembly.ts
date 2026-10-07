import {createAnimalLife} from './animal-life';
import type {createRuntime} from './runtime';

/** One plants wrapper, existing cats/gulls only. AI adoption/species hosts remain closed. */
export function createHarborLife(base:ReturnType<typeof createRuntime>,plantStarts=true){
 return createAnimalLife(base,undefined,plantStarts);
}
