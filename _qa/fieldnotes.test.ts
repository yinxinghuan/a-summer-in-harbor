import {test} from 'node:test';import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';
import {initial,type Save,type Action} from '../src/story/state';import {entityAt,rooms} from '../src/world/data';import {createRuntime} from '../server/runtime';import {createFieldNotes} from '../server/fieldnotes';
// @ts-expect-error frozen skill runtime
import {AsyncSessionAuthority,openAsyncSqliteAuthorityStore} from '../vendor/dynamic-runtime/packages/authority-session/async.mjs';
const bi=(zh:string,en:string)=>({zh,en});
const draft=(n:number)=>({motivation:bi('你看过损坏的桥板，想多了解怎样保养木头。','Having inspected the broken boards, you want to learn how wood is maintained.'),room:{label:bi(n===1?'木料储藏间':'干燥棚',n===1?'Timber Store':'Drying Shed'),detail:bi('几块木板整齐靠着工作台。','Several boards stand neatly beside a workbench.'),lore:bi('琼会把潮湿的木料放在这里晾干。','June leaves damp timber here to dry.')},investigations:[{label:bi(n===1?'看看木板边缘':'看看金属工具',n===1?'Inspect the board edges':'Look at the metal tool'),successText:bi(n===1?'木板的边缘吸水较快，摸起来比中间潮。':'刚才看到木板受潮，这里的金属工具也有锈斑。',n===1?'The board edges feel damper than the middle.':'The damp boards you saw earlier have a counterpart here: rust on a metal tool.'),rejectionText:bi('先看看周围。','Look around first.')},{label:bi(n===1?'查看通风架':'看棚下的空隙',n===1?'Inspect the drying rack':'Look below the shed rack'),successText:bi('木架下留了空隙，木板没有贴在潮湿的地面上。','There is a gap beneath the rack, keeping boards clear of the damp floor.'),rejectionText:bi('先看看旁边的木板。','Inspect the boards beside it first.')}]});
const intent=(s:Save,target:string,action:string):Action=>({action_id:randomUUID(),expected_version:s.version,scene:s.scene,position:entityAt(s.scene,target)?.approach??s.position,target,action});
test('two generated notebook visits: compiled rules, safe return, read-only main story, idempotency and isolation',async()=>{
 const store=openAsyncSqliteAuthorityStore({worldId:'harbor-notes-test',gameId:'harbor-notes-test'});let generations=0,calls=0;
 try{
 const pgStyleStore={...store,transaction:(fn:any)=>store.transaction((tx:any)=>fn({...tx,artifact:async(...args:any[])=>{const row=await tx.artifact(...args);return row?{...row,revoked:String(row.revoked)}:row}}))};
 const notes=await createFieldNotes(pgStyleStore,{directory:'/tmp/harbor-notes-rules-test',gateway:{call:async({purpose}:any)=>{calls++;return JSON.stringify(purpose==='generation'?draft(++generations):{passed:true,reasons:[]})}}});
 const adapter=createRuntime(undefined,notes);adapter.initial=(locale:any,id:string)=>({...initial(locale,id),scene:'workshop',position:rooms.workshop.spawn,known:['june'],flags:['unpacked','bridge-seen'],items:{toolkit:1}});
 const auth=new AsyncSessionAuthority(store,adapter);let s:Save=await auth.create('owner-a',randomUUID(),'en');const original={items:s.items,flags:s.flags,energy:s.energy,cash:s.cash,standing:s.standing};
 const first=intent(s,'june','notes-generate');s=(await auth.action('owner-a',s.id,first)).head;assert.equal(s.fieldNotes!.depth,1);assert.equal(calls,2);
 assert.equal((await auth.action('owner-a',s.id,first)).head.version,1);assert.equal(calls,2);
 await assert.rejects(auth.action('owner-a',s.id,intent(s,'june','notes-generate')),/NOTES_READ_FIRST/);assert.equal(calls,2);
 const doIt=async(target:string,verb:string)=>s=(await auth.action('owner-a',s.id,intent(s,target,verb))).head;
 for(let n=1;n<=2;n++){
  if(n===2)await doIt('june','notes-generate');
  await doIt('to-annex-'+n,'travel');assert.equal(s.scene,'workshop-annex-'+n);assert.equal(s.fieldNotes!.state.location,s.scene);
  await assert.rejects(auth.action('owner-a',s.id,intent(s,'observation-b','notes-observe')),/NOTES_READ_FIRST/);
  await doIt('observation-a','notes-observe');await doIt('observation-b','notes-observe');
  await assert.rejects(auth.action('owner-a',s.id,intent(s,'observation-b','notes-observe')),/ALREADY_DONE/);
  await doIt('exit','travel');assert.equal(s.scene,'workshop');assert.equal(s.fieldNotes!.state.location,'workshop');
 }
 assert.equal(calls,4);assert.equal(s.fieldNotes!.depth,2);assert.deepEqual({items:s.items,flags:s.flags,energy:s.energy,cash:s.cash,standing:s.standing},original);
 await assert.rejects(auth.action('owner-a',s.id,intent(s,'june','notes-generate')),/NOTES_COMPLETE/);
 await assert.rejects(notes.load('owner-b',s.fieldNotes!.artifact),/NOTES_ARTIFACT_MISSING/);
 assert.equal((await auth.get('owner-a',s.id)).fieldNotes.rooms.length,2);
 }finally{await store.close()}
});
