import {nextObjectiveEntrance} from '../story/navigation';
import type {Save} from '../story/state';
import {sameCluster,globalPoint,localPoint} from './continuity';
/** Walk through an internal seam to the next real object; never stop at its removed Go control. */
export function continuousObjectiveEntrance(s:Save){
 const entrance=nextObjectiveEntrance(s);
 if(!entrance?.destination||!sameCluster(s.scene,entrance.destination))return entrance;
 let destination=entrance.destination,target=nextObjectiveEntrance({...s,scene:destination});const seen=new Set([s.scene]);
 while(target?.destination&&sameCluster(s.scene,target.destination)&&!seen.has(target.destination)){seen.add(destination);destination=target.destination;target=nextObjectiveEntrance({...s,scene:destination});}
 if(!target)return entrance;
 return {...target,id:'continuous--'+destination+'--'+target.id,at:localPoint(s.scene,globalPoint(destination,target.at)),approach:localPoint(s.scene,globalPoint(destination,target.approach))};
}
