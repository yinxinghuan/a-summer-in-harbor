import {brandActivePrepareFailure} from './active-business-failure';
import type {Save,Action} from '../src/story/state';
import type {createAnimalLife} from './animal-life';
import type {AnimalCommission,AnimalRef,AnimalLifeSave} from '../src/animal-life/types';
import {parseAnimalCommand} from './animal-life';
import {contentHash,sameAnimalRef} from './animal-content';
import {rooms} from '../src/world/data';
import {presentEntity,observedActor} from '../src/world/residents';
import {battleLocksWorld} from '../src/story/turn-battle';
import {nativeCrabId,nativeCrabPin} from '../src/animals/native-crab-config';
import {advanceNativeCrab,assertNativeCrab,currentNativeSample,nativeCrabFrame} from '../src/animals/native-crab-game';
import {canonical} from './animal-content';

export const crabCommission:AnimalCommission={schema:1,id:'animals:native-quiet-shore',revision:1,capability:'animal-notebook-v1',resident:'ruth',title:['停下来，看看岸边','Pause and watch the shore'],brief:['“那只蟹会横着退开。别追它，留一点距离，等它安静停下再看。愿意的话回来讲讲，没有期限。”','“That crab steps sideways to leave room. Don’t chase it. Keep a little distance and watch when it settles. Tell me if you like. No deadline.”'],page:['我和Ruth聊起蟹的横步。岸边不只是通往别处的路：停下来，也能看见另一个生命怎样给自己留空间。','Ruth and I talked about the crab’s sidestep. The shore is more than a route somewhere else: pausing lets us notice another life making room for itself.'],requirements:[{animal:nativeCrabId,behavior:'shore-space'}]};
export const crabCommissionRef:AnimalRef={id:crabCommission.id,revision:1,capability:'animal-notebook-v1',hash:contentHash(crabCommission)};
const event=(a:Action,s:Save)=>({sourceAction:a.action_id,minute:s.townMinutes??540});
const total=(s:Save)=>(s.townMinutes??540)*(s.activePlayClock?.millisecondsPerMinute??4000)+(s.activePlayClock?.remainderMs??0);
export function nativeForegroundBudget(before:Save,next:Save){if(!before.activePlayClock)return 0;if(before.activePlayClock.millisecondsPerMinute!==next.activePlayClock?.millisecondsPerMinute)throw Error('INVALID_NATIVE_BUDGET');const ms=total(next)-total(before);if(!Number.isSafeInteger(ms)||ms<0||ms>3000)throw Error('INVALID_NATIVE_BUDGET');return ms/1000}
/** Wraps the original combined animal/plants instance once. It owns no store,
 * transport, account or alternate clock. Native facts live in one optional pin. */
export function withNativeCrabLife(base:ReturnType<typeof createAnimalLife>,{enabled=false,now=Date.now,wait=(ms:number)=>new Promise<void>(r=>setTimeout(r,ms))}: {enabled?:boolean;now?:()=>number;wait?:(ms:number)=>Promise<void>}={}){
 const runtime={...base.runtime,
  validateAction(a:Action){try{base.runtime.validateAction(a)}catch(error){throw a.activePlay?brandActivePrepareFailure(error):error}},
  assertReadable(s:Save){base.runtime.assertReadable(s);assertNativeCrab(s)},
  finalizeMotion(_before:Save,next:Save){advanceNativeCrab(next,0,enabled)},
  async prepare(s:AnimalLifeSave,a:Action,cancel?:unknown,context?:{owner:string}){
   this.assertReadable(s);const payload=a.payload as any,ref=payload?.command?.ref;
   const native=a.action.startsWith('animal-life:')&&(a.target===nativeCrabId||ref?.id===crabCommission.id);
   if(!native){if(a.action==='animal-life:accept'&&s.nativeCrabV1?.plan&&!s.nativeCrabV1.page)throw Error('COMMISSION_UNAVAILABLE');const r=await base.runtime.prepare(s,a,cancel,context);advanceNativeCrab(r.head,0,enabled);this.assertReadable(r.head);return r}
   const command=parseAnimalCommand(a);
   if(a.expected_version!==s.version)throw Error('VERSION_CONFLICT');if(a.scene!==s.scene)throw Error('SCENE_MISMATCH');
   if(!/^[-a-zA-Z0-9]{16,80}$/.test(a.action_id))throw Error('INVALID_ACTION_ID');
   if(s.activeChallenge||battleLocksWorld(s))throw Error('CHALLENGE_ACTIVE');
   base.runtime.position(s,a.position);if(!s.movingClock?.transport||Math.hypot(a.position.x-s.position.x,a.position.y-s.position.y)>2)throw Error('NATIVE_CRAB_CHECKPOINT_REQUIRED');
   const head:AnimalLifeSave=structuredClone(s);advanceNativeCrab(head,0,enabled);
   if(!head.nativeCrabV1)throw Error('NATIVE_CRAB_CLOSED');const n=head.nativeCrabV1;
   let text:[string,string],person:string|undefined;
   const quietFrame=()=>{const f=nativeCrabFrame(head,a.position,true).frame;
    if(!f.visible||f.scene!==head.scene)throw Error('ANIMAL_AWAY');const distance=Math.hypot(a.position.x+8-f.foot.x,a.position.y+6-f.foot.y);
    if(distance<72)throw Error('LEAVE_CRAB_SPACE');if(distance>112)throw Error('TOO_FAR');if(f.phase!=='idle'||f.pose!=='stand')throw Error('CRAB_NEEDS_QUIET_MOMENT');return f;
   };
   if(command.verb==='sample'){
    if(a.target!==nativeCrabId||!enabled&&(!n.plan||!!n.page))throw Error('NATIVE_CRAB_CLOSED');
    const frame=quietFrame(),at=now();if(typeof cancel==='function'&&cancel())throw Error('REQUEST_IDENTITY_CANCELLED');await wait(400);if(typeof cancel==='function'&&cancel())throw Error('REQUEST_IDENTITY_CANCELLED');if(now()-at<400)throw Error('NATIVE_OBSERVATION_CLOCK');
    // The final existing CAS rejects another window's intervening action. The
    // paused frame stays still; elapsed observation never grants game time.
    if(canonical(quietFrame())!==canonical(frame))throw Error('OBSERVATION_STALE');
    n.frame=structuredClone(frame);n.sample={frame:structuredClone(frame),behavior:'shore-space',quietMs:400,sourceAction:a.action_id,version:head.version+1,minute:head.townMinutes??540,scene:head.scene,player:{...a.position}};
    text=['你停了一会儿，蟹也安静留在自己的地方。可以记下这次观察。','You pause for a moment. The crab stays quietly in its own space. You can record this observation.'];
   }else if(command.verb==='record'){
    const q=currentNativeSample(s,a.position);if(a.target!==nativeCrabId||!q)throw Error('OBSERVATION_STALE');const f=quietFrame();if(canonical(f)!==canonical(q.frame))throw Error('OBSERVATION_STALE');
    n.observation??=event(a,head);delete n.sample;text=['蟹的安静横步已留在收藏里。它是一次发现，不是捕获的动物。','The crab’s quiet sidestep is in Collections. It is a discovery, not a captured animal.'];
   }else{
    if(!sameAnimalRef(command.ref,crabCommissionRef))throw Error('NATIVE_CRAB_REF_MISMATCH');
    if(command.verb!=='cancel'){
     const e=rooms[head.scene].entities.find(e=>e.person===crabCommission.resident&&e.id===a.target);if(!head.known.includes(crabCommission.resident))throw Error('INTRODUCE_FIRST');if(!e||!presentEntity(head,e))throw Error('PERSON_AWAY');
     const p=observedActor(e,a.actorPosition);if(Math.hypot(a.position.x+8-p.x,a.position.y+6-p.y)>75)throw Error('TOO_FAR');person=crabCommission.resident;
    }
    if(command.verb==='brief'){if(!enabled&&!n.brief)throw Error('NATIVE_CRAB_CLOSED');n.brief??=event(a,head);text=[...crabCommission.brief]}
    else if(command.verb==='accept'){if(!enabled)throw Error('NATIVE_CRAB_CLOSED');if(!n.brief)throw Error('COMMISSION_PREMISE_UNREAD');if(n.plan||n.page||head.animalNotebookV1?.active)throw Error('COMMISSION_UNAVAILABLE');n.plan=event(a,head);text=['这份岸边观察约定已记下，没有期限。','Your shore observation plan is saved. There is no deadline.']}
    else if(command.verb==='cancel'){if(a.target!=='animal-notebook'||!n.plan||n.page)throw Error('COMMISSION_MISMATCH');delete n.plan;text=['约定已收起，蟹的观察仍留在收藏里。','The plan is set aside. Your crab observation remains in Collections.']}
    else{if(!n.plan||n.page)throw Error('COMMISSION_UNAVAILABLE');if(!n.observation)throw Error('OBSERVATIONS_MISSING');if((head.relations.ruth??0)>=100)throw Error('RELATION_FULL');n.page=event(a,head);head.relations.ruth=(head.relations.ruth??0)+1;text=[...crabCommission.page]}
    delete n.sample;
   }
   head.position={...a.position};head.version=s.version+1;head.cursor=s.cursor+1;head.history.push({id:a.action_id,kind:person?'talk':'action',...(person?{person}:{}),text});head.history=head.history.slice(-500);
   this.assertReadable(head);return {head,text,kind:'action',accepted:true,actionId:a.action};
  },
 };
 const project=(s:Save)=>{runtime.assertReadable(s);const old=base.animalProject(s),n=s.nativeCrabV1;
  const entry={ref:{...crabCommissionRef},definition:structuredClone(crabCommission),enabled,briefed:!!n?.brief,completed:!!n?.page,active:!!n?.plan&&!n.page,missing:n?.observation?[]:structuredClone(crabCommission.requirements)};
  return {...old,commissions:[...old.commissions,...(s.known.includes(crabCommission.resident)&&(enabled||n?.brief||n?.page)?[entry]:[])],pages:[...old.pages,...(n?.page?[{ref:{...crabCommissionRef},...n.page,title:[...crabCommission.title] as [string,string],text:[...crabCommission.page] as [string,string]}]:[])],sample:currentNativeSample(s)??old.sample};
 };
 return {...base,runtime,animalProject:project,nativeEnabled:enabled,advanceForeground:(before:Save,next:Save)=>advanceNativeCrab(next,nativeForegroundBudget(before,next),enabled),lifeProject:(s:Save)=>{
  const old=base.lifeProject(s),n=s.nativeCrabV1;
  return {...old,animals:project(s),collections:[...old.collections,...(n?.observation?[{record:{id:'observe:'+nativeCrabId+':shore-space',...n.observation,source:{id:nativeCrabId,kind:'animal-schedule' as const,visualVersion:nativeCrabPin.id}},isRecord:true as const}]:[])]};
 }};
}
