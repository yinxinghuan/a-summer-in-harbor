import type {Save} from '../src/story/state';
import {dynamicWorld} from '../src/dynamic-assets/layout';
import {landWorld} from '../src/life/land';
import {createRuntime} from './runtime';
import {createHarborLife} from './life-assembly';
import {createMovingClock,withMovingClock} from './candidate-clock';
import {withCompactMotion} from './candidate-motion-authority';
import {createActivePlayClock,withActivePlayRuntime} from './active-play-clock';
import {withActivePlayAuthority} from './active-play-authority';

/** Published owner assembly. The caller's final
 * news wrapper is installed before the outer time settlement, and the account
 * service supplies its guarded transaction store to both compact channels. */
export function createExplorationAssembly({resolveDialogue,notes,now=Date.now,boot,defaultRate=4000,plantStarts=true,decorateLife=(r:any)=>r,decorateRuntime=(r:any)=>({runtime:r}),initial}:any={}){
 const motion=createMovingClock({now,boot,worldForSave:(s:Save)=>landWorld(dynamicWorld(s.flags,!!s.dynamicAssetRooms),s.landV1)});
 const base=createRuntime(resolveDialogue,notes,motion);
 const life=decorateLife(createHarborLife(initial?{...base,initial}:base,plantStarts));
 const decorated=decorateRuntime(life.runtime);
 const play=createActivePlayClock({now,boot,defaultRate});
 const runtime=withActivePlayRuntime(withMovingClock(decorated.runtime,motion),play);
 return {...life,...decorated,runtime,motion,play,
  decorateAuthority:(authority:any,guardedStore:any,finalRuntime=runtime)=>withActivePlayAuthority(withCompactMotion(authority,guardedStore,finalRuntime,motion,now),guardedStore,finalRuntime,play,now),
 };
}
