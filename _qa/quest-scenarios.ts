import {initial,applyAction,type Save,type Action} from '../src/story/state';
import {rooms,entityAt} from '../src/world/data';
export const intent=(s:Save,target:string,action:string,payload?:unknown):Action=>({action_id:crypto.randomUUID(),expected_version:s.version,scene:s.scene,position:entityAt(s.scene,target)?.approach??s.position,target,action,payload});
export function scenario(){
 let s=initial('en',crypto.randomUUID());
 const step=(target:string,action:string,payload?:unknown)=>{const a=intent(s,target,action,payload),r=applyAction(s,a);s=r.head;return {a,...r}};
 const go=(destination:string)=>{const queue=[{scene:s.scene,path:[] as string[]}],seen=new Set([s.scene]);while(queue.length){const n=queue.shift()!;if(n.scene===destination){for(const id of n.path)step(id,'travel');return}for(const e of rooms[n.scene].entities)if(e.destination&&!e.destination.startsWith('workshop-annex-')&&!seen.has(e.destination)){seen.add(e.destination);queue.push({scene:e.destination,path:[...n.path,e.id]})}}throw Error('NO_ROUTE')};
 const arrive=()=>{step('mara','introduce');step('mara','talk:key');go('home');step('bed','unpack');go('station')};
 const collect=()=>{go('cafe');step('theo','introduce');step('theo','talk:bag');go('station')};
 return {get save(){return s},step,go,arrive,collect};
}
