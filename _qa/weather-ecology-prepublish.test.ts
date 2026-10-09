import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {initial} from '../src/story/state';
import {rooms} from '../src/world/data';
import {createWeatherState} from '../src/weather/state';
import {createWeatherEcology} from '../src/weather/ecology';
import {createAnimalRuntime} from '../src/animals/behavior';
import {acceptedAnimals} from '../src/animals/art';
import {gameAnimalContext} from '../src/animals/game';

test('first lazy ecology activation preserves an already walking old58 cat foot',()=>{
 const save={...initial('en',randomUUID()),scene:'station',townMinutes:900,position:rooms.station.spawn,weatherV1:createWeatherState(900)};
 const runtime=createAnimalRuntime(acceptedAnimals),context=()=>gameAnimalContext(save,save.position);
 const first=runtime.tick(0,context()).find(a=>a.id==='harbor-cat-1')!;
 let before=first;for(let i=0;i<80;i++)before=runtime.tick(.04,context()).find(a=>a.id==='harbor-cat-1')!;
 assert.ok(before.visible&&Math.hypot(before.foot.x-first.foot.x,before.foot.y-first.foot.y)>1,'ordinary old58 patrol has really moved');
 const pinned={...save,weatherEcologyV1:createWeatherEcology(900)};
 const after=runtime.tick(0,gameAnimalContext(pinned,pinned.position)).find(a=>a.id==='harbor-cat-1')!;
 assert.deepEqual(after.foot,before.foot,'policy pin alone must not teleport back to initial home point');
 const moved=runtime.tick(.04,gameAnimalContext(pinned,pinned.position)).find(a=>a.id==='harbor-cat-1')!;
 assert.ok(Math.hypot(moved.foot.x-after.foot.x,moved.foot.y-after.foot.y)<=1.121,'first shelter step respects original frame speed');
});
