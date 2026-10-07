/** Loopback synthetic settled journey; actual combined Main/account/SQLite. No model/media. */
import {makeDemoServer} from './temporary-account-server';
import {createRuntime} from '../server/runtime';
import {createHarborLife} from '../server/life-assembly';
import {withBasilPlantUses} from '../server/plant-basil';
import {initial} from '../src/story/state';
import {rooms} from '../src/world/data';
const directory=process.env.HARBOR_BASIL_QA_DIRECTORY;if(!directory)throw Error('QA_DIRECTORY_REQUIRED');
const life=withBasilPlantUses(createHarborLife({...createRuntime(async()=>{throw Error('QA_MODEL_DISABLED')}),initial:(locale:any,id:string)=>({...initial(locale,id),scene:'cafe',position:rooms.cafe.spawn,visited:Object.keys(rooms),known:['mara'],flags:['key','unpacked','bag-returned','garden-agreed','alternative-route','route-open','market-open'],items:{key:1}})}));
const server=await makeDemoServer({directory,port:5485,providedRuntime:life.runtime,lifeProject:life.lifeProject,landProject:life.landProject});
console.log('Basil combined local fixture 127.0.0.1:5485; synthetic, model/media disabled');
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>void server.close().then(()=>process.exit(0)));
