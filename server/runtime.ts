import {admitSpatialAction,spatialBinding,spatialSnapshot} from '../src/story/binding';
import {initial,applyAction,validateQuestion,type Save,type Action,type DialogueResolution} from '../src/story/state';
import {world,worldWithFlags} from '../src/world/data';import {walkable} from '../src/engine/world';
import type {createFieldNotes} from './fieldnotes';
type Notes=Awaited<ReturnType<typeof createFieldNotes>>;
export const createRuntime=(resolveDialogue?:(s:Save,a:Action,owner:string)=>Promise<DialogueResolution>,notes?:Notes)=>({
 initial,upgrade:(s:Save)=>s,scene:(s:Save)=>s.scene,
 assertReadable(s:Save){if(!s||s.mapVersion!==1||!s.id||!Number.isSafeInteger(s.version)||!world.scenes[s.scene]||!Array.isArray(s.flags)||!Array.isArray(s.known)||!walkable(worldWithFlags(s.flags),s.scene,s.position))throw Error('UNSUPPORTED_SAVE')},
 position(s:Save,p:{x:number;y:number}){if(!p||!walkable(worldWithFlags(s.flags),s.scene,p))throw Error('INVALID_POSITION');return {x:p.x,y:p.y}},
 validateAction(a:Action){if(!a||typeof a.action!=='string'||a.action.length>160||typeof a.target!=='string'||a.target.length>160||!a.position||!Number.isFinite(a.position.x)||!Number.isFinite(a.position.y))throw Error('INVALID_ACTION')},
 async prepare(s:Save,a:Action,_cancel?:unknown,context?:{owner:string}){const boundKey=admitSpatialAction(s,a);if(a.action==='notes-generate'||a.action==='notes-observe'){if(!notes)throw Error('NOTES_UNAVAILABLE');return a.action==='notes-generate'?notes.generate(s,a,context!.owner):notes.observe(s,a,context!.owner)}if(a.action==='ask')validateQuestion(s,a);const resolution=a.action==='ask'?(resolveDialogue?await resolveDialogue(s,a,context!.owner):undefined):undefined;const result=applyAction(s,a,resolution);if(notes&&result.head.scene!==s.scene)await notes.travel(s,result.head,context!.owner);if(a.action!=='travel-map')spatialBinding.assertTransition(spatialSnapshot(s),spatialSnapshot(result.head),boundKey,s.scene);return {...result,kind:'action',accepted:true,actionId:a.action}},
 preserveConcurrent(next:Save,_current:Save){return next},
});
export const runtime=createRuntime();
