import {Pool} from 'pg';
import {privateText,validatePublicConfig} from '../server/public-config';
import {GAME_UUID} from '../src/game-id';
const config=validatePublicConfig(JSON.parse(await privateText(process.env.HARBOR_CONFIG_FILE)));
const pool=new Pool({host:config.pgHost,database:config.database,user:config.user,password:await privateText(process.env.HARBOR_PG_PASSWORD_FILE),max:4});
const options={pool,schema:config.schema,worldId:GAME_UUID,gameId:GAME_UUID,environment:'test'};
const checks:Function[]=[];const test=(label:string,fn:Function)=>checks.push(async()=>{await fn();console.log(JSON.stringify({check:label,passed:true}))});
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {mkdtempSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {rooms,entityAt} from '../src/world/data';
import {initial,has,objective,type Save,type Action} from '../src/story/state';
import {objectivePlace} from '../src/story/navigation';
import {chapterReview} from '../src/story/chapter';
import {runtime} from '../server/runtime';
// @ts-expect-error frozen skill module
import {AsyncSessionAuthority,openPgAuthorityStore} from '../vendor/dynamic-runtime/packages/authority-session/async.mjs';

for(const route of ['bridge','trail','garden'] as const)test(`chapter ${route}: legal route, receipt replay, restart and continued exploration`,async()=>{
 let store=await openPgAuthorityStore(options),auth=new AsyncSessionAuthority(store,runtime);
 try{
  const owner='qa-'+randomUUID();let s:Save=await auth.create(owner,randomUUID(),'en');
  const command=async(target:string,action:string,payload?:unknown)=>{
   const intent:Action={action_id:randomUUID(),expected_version:s.version,scene:s.scene,position:entityAt(s.scene,target)?.approach??s.position,target,action,payload};
   const result=await auth.action(owner,s.id,intent);s=result.head;return {intent,result};
  };
  // Traverse real authored portals. No flags, rewards or visited locations are injected.
  const go=async(destination:string)=>{
   const queue:{scene:string;path:string[]}[]=[{scene:s.scene,path:[]}],seen=new Set([s.scene]);let path:string[]|undefined;
   while(queue.length){const node=queue.shift()!;if(node.scene===destination){path=node.path;break;}for(const e of rooms[node.scene].entities){if(e.kind!=='portal'||!e.destination||seen.has(e.destination)||e.destination.startsWith('workshop-annex-'))continue;seen.add(e.destination);queue.push({scene:e.destination,path:[...node.path,e.id]});}}
   assert.ok(path,destination);for(const id of path!)await command(id,'travel');
  };
  assert.equal(chapterReview(s),null);
  await command('mara','introduce');await command('mara','talk:key');await go('home');await command('bed','unpack');await go('station');await command('mara','talk:settle');
  await go('cafe');await command('theo','introduce');await command('theo','talk:bag');await command('terrace','challenge-start:repair');
  const challenge=s.activeChallenge!;await store.close();store=await openPgAuthorityStore(options);auth=new AsyncSessionAuthority(store,runtime);s=await auth.get(owner,s.id);assert.deepEqual(s.activeChallenge,challenge);
  await command(challenge.id,'challenge-finish',{solution:[1,3,2]});await go('station');await command('mara','talk:return-bag');
  await go('bazaar');await command('notice','read-market');if(route!=='trail'){await go('path');await command('bridge','inspect-bridge');}
  if(route==='bridge'){await go('workshop');await command('june','introduce');await command('june','talk:tools');await go('beach');await command('driftwood','gather-wood');await go('path');await command('bridge','repair-bridge');}
  if(route==='trail'){await go('weather');await command('arthur','introduce');await command('arthur','talk:trail');await go('camp');await command('old-map','challenge-start:map');await command(s.activeChallenge!.id,'challenge-finish',{solution:[0,1,2,3]});}
  if(route==='garden'){await go('courtyard');await command('elena','introduce');await command('elena','talk:quiet');await command('elena','talk:hours');}
  assert.equal(chapterReview(s),null);assert.deepEqual(objectivePlace(s),{scene:'lighthouse',entity:'gate'});await go('lighthouse');await command('gate','open-route');assert.ok(has(s,'route-choice:'+route));assert.equal(chapterReview(s),null);
  await go('bazaar');const completed=await command('notice','open-market');assert.equal(objectivePlace(s),null);assert.match(objective(s)[1],/Summer continues/);const closed=structuredClone(s),review=chapterReview(s);assert.ok(review);assert.deepEqual(chapterReview(s),review);assert.deepEqual(s,closed);
  if(process.env.HARBOR_CHAPTER_FIXTURES==='1')writeFileSync(new URL('./chapter-'+route+'.json',import.meta.url),JSON.stringify(closed,null,2));
  assert.deepEqual(await auth.action(owner,s.id,completed.intent),completed.result);await assert.rejects(command('notice','open-market'),/ALREADY_DONE/);
  await store.close();store=await openPgAuthorityStore(options);auth=new AsyncSessionAuthority(store,runtime);s=await auth.get(owner,s.id);assert.deepEqual(s,closed);assert.deepEqual(chapterReview(s),review);
  await assert.rejects(auth.get('owner-b',s.id),/SESSION_NOT_FOUND/);
  // An optional later repair must not rewrite the already chosen access route.
  if(route!=='bridge'){await go('workshop');await command('june','introduce');await command('june','talk:tools');await go('beach');await command('driftwood','gather-wood');await go('path');if(!has(s,'bridge-seen'))await command('bridge','inspect-bridge');await command('bridge','repair-bridge');assert.deepEqual(chapterReview(s)!.route,review!.route);}
  await go('home');await command('bed','rest');assert.equal(s.energy,100);assert.ok(has(s,'market-open'));
 }finally{await store.close();}
});
test('legacy completion stays neutral, and incomplete saves get no chapter page',()=>{
 const s=initial('en',randomUUID());assert.equal(chapterReview(s),null);s.flags=['market-open','bridge-fixed','alternative-route'];const text=JSON.stringify(chapterReview(s));assert.match(text,/arranged access/);assert.doesNotMatch(text,/You repaired|recovered the public/);
});

try{for(const check of checks)await check();}finally{await pool.end()}
