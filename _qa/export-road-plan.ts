import {writeFileSync} from 'node:fs';import {outdoors} from '../src/world/outdoors';import {roadBoundaries} from '../src/world/road-boundaries';
writeFileSync('../live-20261007/assets/road-plan.json',JSON.stringify(Object.fromEntries(Object.entries(outdoors).map(([id,l])=>[id,{...l,boundaries:roadBoundaries(l)}])),null,2));
// Actual combined renderer consumer uses the original y650 projection boundary.
import {globalPoint} from '../src/candidate/continuity';import type {OutdoorLayout} from '../src/world/outdoors';
const cluster:OutdoorLayout={bounds:{x:0,y:0,w:1440,h:1632},spawn:{x:600,y:720},landmark:{x:600,y:650},quietZone:{x:0,y:0,w:1,h:1},barriers:[],entrances:{},roadExits:{},patches:[{x:0,y:0,w:1440,h:1632,material:'grass'}]};
for(const id of ['market','bazaar'])for(const p of outdoors[id].patches.filter(p=>p.material==='stone')){const q=globalPoint(id,p),y=id==='market'?Math.max(650,q.y):q.y,bottom=id==='bazaar'?Math.min(650,q.y+p.h):q.y+p.h;if(bottom>y)cluster.patches.push({...p,x:q.x,y,h:bottom-y})}
const original=JSON.parse((await import('node:fs')).readFileSync('../live-20261007/assets/road-plan.json','utf8'));original['market-bazaar']={...cluster,boundaries:roadBoundaries(cluster)};writeFileSync('../live-20261007/assets/road-plan.json',JSON.stringify(original,null,2));
