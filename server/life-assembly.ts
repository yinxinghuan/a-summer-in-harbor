import {withNativeCrabLife} from './native-crab-life';
import {createAnimalLife} from './animal-life';
import type {createRuntime} from './runtime';
import type {AnimalContentRegistry} from './animal-content';

/** One plants wrapper, existing cats/gulls only. AI adoption/species hosts remain closed. */
export function createHarborLife(base:ReturnType<typeof createRuntime>,plantStarts=true,nativeOptions:Parameters<typeof withNativeCrabLife>[1]={},content?:AnimalContentRegistry){
 return withNativeCrabLife(createAnimalLife(base,content,plantStarts),nativeOptions);
}
