import {useEffect,useRef,useState} from 'react';
import type {Save} from '../story/state';
import {battleLocksWorld} from '../story/turn-battle';
import {candidateMotion} from '../story/client';
import {candidateEnabled,activePlayEnabled,experimentRate,globalPoint,isCluster,localPoint,pointZone} from './continuity';
import {motionProjection} from './render-adapter';
const blockPrediction=(value:boolean)=>{motionProjection.networkBlocked=value;motionProjection.block?.(value)};
import {registerCandidateFlush} from './exploration-flush';
import {useActivePlayClock} from './use-active-play-clock';
export {flushCandidateMovement,resumeCandidateAuthority} from './exploration-flush';
export function useMovingClock(save:Save|null,paused:boolean,ready:boolean,onHead:(s:Save)=>void,onError:()=>void){
 const activeBlocked=useActivePlayClock(save,paused,ready,onHead,onError);
 const enabled=candidateEnabled()&&!activePlayEnabled(),[blocked,setBlocked]=useState(enabled),latest=useRef({save,paused,ready,onHead,onError});latest.current={save,paused,ready,onHead,onError};
 useEffect(()=>{if(!enabled)return;let live=true,inFlight:Promise<Save|undefined>|undefined,head:Save|undefined,wasPaused=true,lastAck=performance.now(),leaseStart=0;
  const work=async(force=false):Promise<Save|undefined>=>{
   const current=latest.current;if(!current.save||!current.ready)return head;
   if(!head||current.save.id!==head.id||current.save.version>head.version){head=current.save;motionProjection.points=[];motionProjection.traceStart=globalPoint(head.scene,head.position)}
   if(head.activeChallenge||battleLocksWorld(head)){wasPaused=true;blockPrediction(true);if(live)setBlocked(false);return head}
   motionProjection.sample?.();blockPrediction(true);
   try{
    if(!head.movingClock||head.movingClock.millisecondsPerMinute!==experimentRate()){
     setBlocked(true);head=(await candidateMotion(head,'candidate-clock-enable',head.position,{millisecondsPerMinute:experimentRate()})).head;current.onHead(head);
    }
    const mustOpen=!head.movingClock!.lease||wasPaused&&!current.paused||performance.now()-leaseStart>2500;
    if(mustOpen){setBlocked(true);motionProjection.points=[];await motionProjection.restore?.(head.scene,head.position);leaseStart=performance.now();head=(await candidateMotion(head,'candidate-motion-open',head.position,{})).head;current.onHead(head);lastAck=performance.now();if(live)setBlocked(false)}
    if(current.paused&&wasPaused&&!force){blockPrediction(false);return head;}
    wasPaused=current.paused;
    const points=motionProjection.points.splice(0),tail=isCluster(head.scene)?globalPoint(motionProjection.scene,motionProjection.position):motionProjection.position;
    const previous=points.at(-1)??(isCluster(head.scene)?globalPoint(head.scene,head.position):head.position);if(Math.hypot(previous.x-tail.x,previous.y-tail.y)>.01)points.push({...tail});
    const end=points.at(-1),zone=isCluster(head.scene)?points.reduce((z,p)=>pointZone(p,z),head.scene):head.scene,position=end?(isCluster(zone)?localPoint(zone,end):end):head.position;
    leaseStart=performance.now();head=(await candidateMotion(head,'candidate-motion-step',position,{lease:head.movingClock!.lease!.id,sequence:head.movingClock!.lease!.sequence+1,points})).head;
    lastAck=performance.now();if(lastAck-leaseStart>2500){current.onHead(head);throw Error('CANDIDATE_LEASE_TOO_OLD')}motionProjection.traceStart=globalPoint(head.scene,head.position);blockPrediction(false);current.onHead(head);if(live)setBlocked(false);return head;
   }catch{if(current.save.id!==latest.current.save?.id)return undefined;if(live){setBlocked(true);latest.current.onError()}throw Error('CANDIDATE_MOTION_STOPPED')}
  };
  const enqueue=(force=false):Promise<Save|undefined>=>{if(inFlight)return force?inFlight.then(()=>enqueue(true)):inFlight;const next=work(force);inFlight=next;void next.finally(()=>{if(inFlight===next)inFlight=undefined}).catch(()=>{});return next};const unregister=registerCandidateFlush(()=>enqueue(true));
  const timer=setInterval(()=>{if(!live||inFlight||document.hidden||latest.current.paused&&wasPaused)return;const moving=motionProjection.points.length>0||motionProjection.moving?.();const resume=wasPaused&&!latest.current.paused;const needsOpen=!head?.movingClock?.lease;if(!resume&&!needsOpen&&performance.now()-lastAck<(moving?800:2000))return;void enqueue().catch(()=>{})},100);
  return()=>{live=false;clearInterval(timer);blockPrediction(true);unregister()};
 },[enabled]);return activePlayEnabled()?activeBlocked:blocked;
}
