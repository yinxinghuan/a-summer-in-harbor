import {test} from 'node:test';import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';import {mkdtempSync,rmSync} from 'node:fs';import {tmpdir} from 'node:os';import {join} from 'node:path';
import {runtime,createRuntime} from '../server/runtime';import {entityAt} from '../src/world/data';import {cartridge} from '../src/story/cartridge';
// @ts-expect-error pinned skill module
import {AsyncSessionAuthority,openAsyncSqliteAuthorityStore} from '../vendor/dynamic-runtime/packages/authority-session/async.mjs';
const intent=(s:any,verb:string)=>({action_id:randomUUID(),expected_version:s.version,scene:s.scene,position:entityAt(s.scene,'mara')!.approach,target:'mara',action:verb});
test('lost response replays after database restart without repeating rewards',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'harbor-restart-')),config={path:join(dir,'save.sqlite'),worldId:'harbor-restart',gameId:'harbor-restart'};let store=openAsyncSqliteAuthorityStore(config);
 try{let auth=new AsyncSessionAuthority(store,runtime),s=await auth.create('owner',randomUUID(),'en');s=(await auth.action('owner',s.id,intent(s,'introduce'))).head;const a=intent(s,'talk:key');await auth.action('owner',s.id,a);await store.close();store=openAsyncSqliteAuthorityStore(config);auth=new AsyncSessionAuthority(store,runtime);const replay=await auth.action('owner',s.id,a);assert.equal(replay.head.items.key,1);assert.equal((await auth.events('owner',s.id,0)).length,2);assert.equal((await auth.get('owner',s.id)).version,2);}finally{await store.close();rmSync(dir,{recursive:true,force:true})}
});
test('failed model and failed transaction preserve head, events and receipt boundary',async()=>{
 const store=openAsyncSqliteAuthorityStore({worldId:'harbor-failure',gameId:'harbor-failure'});try{const auth=new AsyncSessionAuthority(store,createRuntime(async()=>{throw Error('MODEL_CALL_FAILED')}));let s=await auth.create('owner',randomUUID(),'en');s=(await auth.action('owner',s.id,intent(s,'introduce'))).head;
 await assert.rejects(auth.action('owner',s.id,{...intent(s,'ask'),payload:{text:'Tell me about town'}}),/MODEL_CALL_FAILED/);assert.deepEqual(await auth.get('owner',s.id),s);
 await assert.rejects(store.transaction(async(repo:any)=>{await repo.write('owner',{...s,cash:999},s.cursor,Date.now());throw Error('INJECTED_ROLLBACK')}),/INJECTED_ROLLBACK/);assert.deepEqual(await auth.get('owner',s.id),s);assert.equal((await auth.events('owner',s.id,0)).length,1);
 }finally{await store.close()}
});
test('bilingual cartridges preserve the same stat, location, item and character identities',()=>{
 const en=cartridge('en'),zh=cartridge('zh');for(const key of ['statDefinitions','initialMap','initialInventory','characters'] as const){const a=(en as any)[key],b=(zh as any)[key];assert.ok(Array.isArray(a),key);assert.deepEqual(a.map(x=>x.id),b.map((x:any)=>x.id),key)}assert.equal(en.id,zh.id);assert.equal(en.opening.blocks.length,3);
});
