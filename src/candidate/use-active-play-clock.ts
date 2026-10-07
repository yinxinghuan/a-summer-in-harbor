import {useEffect,useRef,useState} from 'react';
import type {Save} from '../story/state';
import {battleLocksWorld} from '../story/turn-battle';
import {candidateMotion,candidateActivePlay,activePlayClientId,connect,hasPendingAction} from '../story/client';
import {activePlayEnabled,globalPoint,isCluster,localPoint,pointZone} from './continuity';
import {motionProjection} from './render-adapter';
import {registerCandidateFlush,registerActivePlayFence} from './exploration-flush';
import {createActivePlayBudget} from './active-play-budget';
const block=(v:boolean)=>{motionProjection.networkBlocked=v;motionProjection.block?.(v)};
/** One queue arbitrates two protocols. Heartbeats use elapsed server time, never rAF distance. */
export function useActivePlayClock(save:Save|null,paused:boolean,ready:boolean,onHead:(s:Save)=>void,onError:()=>void){
 const enabled=activePlayEnabled(),[blocked,setBlocked]=useState(enabled),wake=useRef(()=>{}),latest=useRef({save,paused,ready,onHead,onError});latest.current={save,paused,ready,onHead,onError};
 useEffect(()=>{
  if(!enabled||!save)return;let live=true,head=save,inFlight:Promise<Save|undefined>|undefined,hold=false,resume=true,pagedOut=false,lastPump=-Infinity,motionAt=-Infinity,playAt=-Infinity;
  const playing=()=>!!latest.current.ready&&!latest.current.paused&&!document.hidden&&!pagedOut&&!latest.current.save?.activeChallenge&&!(latest.current.save&&battleLocksWorld(latest.current.save));
  const budget=createActivePlayBudget(performance.now());
  const client=activePlayClientId(),publish=(s:Save)=>{head=s;if(live)latest.current.onHead(s)};
  const movement=async(force=false)=>{
   motionProjection.sample?.();const hasPoints=motionProjection.points.length>0||!!motionProjection.moving?.();
   if(!hasPoints&&!force)return;
   block(true);
   if(!head.movingClock)publish((await candidateMotion(head,'candidate-clock-enable',head.position,{millisecondsPerMinute:4000})).head);
   if(!head.movingClock!.lease||performance.now()-motionAt>2500){motionProjection.points=[];await motionProjection.restore?.(head.scene,head.position);publish((await candidateMotion(head,'candidate-motion-open',head.position,{})).head);motionAt=performance.now()}
   motionProjection.sample?.();const points=motionProjection.points.splice(0),tail=isCluster(head.scene)?globalPoint(motionProjection.scene,motionProjection.position):motionProjection.position;
   const previous=points.at(-1)??(isCluster(head.scene)?globalPoint(head.scene,head.position):head.position);
   if(Math.hypot(previous.x-tail.x,previous.y-tail.y)>.01)points.push({...tail});
   if(points.length||force){const zone=isCluster(head.scene)?points.reduce((z,p)=>pointZone(p,z),head.scene):head.scene,end=points.at(-1),position=end?(isCluster(zone)?localPoint(zone,end):end):head.position;
    publish((await candidateMotion(head,'candidate-motion-step',position,{lease:head.movingClock!.lease!.id,sequence:head.movingClock!.lease!.sequence+1,points})).head);motionAt=performance.now();motionProjection.traceStart=globalPoint(head.scene,head.position)}
  };
  const work=async(business=false):Promise<Save|undefined>=>{
   const current=latest.current;if(!current.ready||!current.save||current.save.id!==head.id)return head;
   if(current.save.version>head.version){head=current.save;resume=true;motionProjection.points=[];motionProjection.traceStart=globalPoint(head.scene,head.position)}
   const locked=!!head.activeChallenge||battleLocksWorld(head),stop=current.paused||document.hidden||pagedOut||locked;
   if(hold&&!business)return head;
   try{
    if(hasPendingAction())throw Error('PENDING_ACTION');
    const foreign=head.activePlayClock?.lease&&head.activePlayClock.lease.client!==client;
    if(foreign){
     // A second tab must acquire the time lease before touching movement authority.
     if(stop&&!business){block(true);resume=true;if(live)setBlocked(false);return head}
     publish((await candidateActivePlay(head,'candidate-active-open',client)).head);resume=false;playAt=performance.now();budget.reset(playAt,playing());motionAt=-Infinity;
    }
    // A stationary business action must retain its exact observation proof.
    // Flush actual movement, but renew idle movement leases only during play.
    if(!locked)await movement(!business&&!stop&&(!head.movingClock?.lease||performance.now()-motionAt>=1600));
    if(business){block(true);return head}
    // Re-read after asynchronous movement: a panel may have opened during its ACK.
    const shouldPause=latest.current.paused||document.hidden||pagedOut||locked,c=head.activePlayClock,l=c?.lease;
    if(shouldPause){block(true);resume=true;if(l?.client===client){publish((await candidateActivePlay(head,'candidate-active-pause',client,budget.take(performance.now()))).head)}if(live)setBlocked(false);return head}
    if(resume||!l||l.client!==client||performance.now()-playAt>2500){publish((await candidateActivePlay(head,'candidate-active-open',client)).head);resume=false;playAt=performance.now();budget.reset(playAt,playing())}
    else{publish((await candidateActivePlay(head,'candidate-active-tick',client,budget.take(performance.now()))).head);playAt=performance.now()}
    if(live)setBlocked(false);block(false);return head;
   }catch(e:any){
    if(!live)return undefined;
    block(true);resume=true;
    if(['ACTIVE_LEASE_BUSY','VERSION_CONFLICT','ACTIVE_LEASE_EXPIRED','MOTION_EXPIRED','ACTION_ID_CONFLICT','ACTIVE_CONFIRMATION_REQUIRED','ACTIVE_RECEIPT_RETIRED'].includes(e.message)&&!hasPendingAction()){
     const fresh=await connect(head.locale);if(!live||fresh.id!==head.id)return undefined;publish(fresh);setBlocked(true);return head;
    }
    setBlocked(true);latest.current.onError();throw e;
   }finally{lastPump=performance.now();if(stop)block(true)}
  };
  const enqueue=(business=false):Promise<Save|undefined>=>{
   if(inFlight)return business?inFlight.then(()=>enqueue(true)):inFlight;
   const next=work(business);inFlight=next;void next.finally(()=>{if(inFlight===next)inFlight=undefined}).catch(()=>{});return next;
  };
  const unregister=registerCandidateFlush(async business=>{if(business){budget.set(false,performance.now());hold=true}return enqueue(!!business)},()=>{hold=false;resume=true});
  const unfence=registerActivePlayFence(s=>s.id===head.id&&s.version===head.version?{client,lease:head.activePlayClock?.lease?.id,activeMs:budget.take(performance.now())}:undefined);
  wake.current=()=>{budget.set(!hold&&playing(),performance.now());if(hold)return;block(true);const run=()=>{if(live&&!hold)void enqueue().catch(()=>{})};if(inFlight)void inFlight.then(run,()=>{});else run()};
  const visibility=()=>{budget.set(!hold&&playing(),performance.now());resume=true;block(true);if(!hold)void enqueue().catch(()=>{})};
  const pagehide=()=>{pagedOut=true;visibility()},pageshow=()=>{pagedOut=false;visibility()};
  document.addEventListener('visibilitychange',visibility);window.addEventListener('pagehide',pagehide);window.addEventListener('pageshow',pageshow);
  const timer=setInterval(()=>{if(!live||inFlight||hold)return;const s=latest.current;if(!s.ready||!s.save)return;const stop=s.paused||document.hidden||s.save.activeChallenge||battleLocksWorld(s.save);if(stop&&!head.activePlayClock?.lease)return;if(performance.now()-lastPump<800)return;void enqueue().catch(()=>{})},100);
  void enqueue().catch(()=>{});
  return()=>{live=false;wake.current=()=>{};unfence();unregister();clearInterval(timer);document.removeEventListener('visibilitychange',visibility);window.removeEventListener('pagehide',pagehide);window.removeEventListener('pageshow',pageshow);block(true)};
 },[enabled,save?.id]);
 useEffect(()=>{if(enabled)wake.current()},[enabled,paused,ready]);
 return blocked;
}
