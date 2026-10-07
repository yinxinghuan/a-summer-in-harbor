import {nextObjectiveEntrance} from '../story/navigation';
import type {Save} from '../story/state';
import {sameCluster,globalPoint,localPoint} from './continuity';
/** Walk through an internal seam to the next real object; never stop at its removed Go control. */
export function continuousObjectiveEntrance(s:Save){
 const entrance=nextObjectiveEntrance(s);
 if(!entrance?.destination||!sameCluster(s.scene,entrance.destination))return entrance;
 const target=nextObjectiveEntrance({...s,scene:entrance.destination});
 if(!target)return entrance;
 return {...target,id:'continuous--'+entrance.destination+'--'+target.id,at:localPoint(s.scene,globalPoint(entrance.destination,target.at)),approach:localPoint(s.scene,globalPoint(entrance.destination,target.approach))};
}
