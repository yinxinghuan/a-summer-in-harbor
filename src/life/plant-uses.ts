import type {LifeSave,ContentRef} from './types';
import type {Words} from '../world/data';

export const basilTemplate=Object.freeze({id:'theo-basil-v1',revision:1,quantity:2,reward:7,cooldownMinutes:2880});
export const mintNode=Object.freeze({id:'harbor-mint-hill-1',species:'plant:harbor-mint',revision:1,scene:'hill',at:{x:640,y:790},approach:{x:632,y:808},stockCap:2,stockFloor:1,recoveryMinutes:720});
export const mintItem='wild:harbor-mint-leaf';
export type PlantOrder={id:string;template:'theo-basil-v1';templateHash:string;crop:ContentRef;quantity:2;reward:7;acceptedMinute:number;dueMinute:number};
export type MintState={node:'harbor-mint-hill-1';definitionHash:string;stock:1|2;recoverAt:number|null;observedAt?:number;observationSource?:string;leaves:number;firstLeafSource?:string;lastLeafSource?:string;archivedAt?:number;archiveSource?:string;sharedAt?:number;shareSource?:string};
export type PlantUsesState={schema:1;offerReadAt?:number;offerReadSource?:string;order?:PlantOrder;deliveries:number;mint?:MintState};
export type PlantUsesSave=LifeSave&{plantUsesV1?:PlantUsesState};
export type PlantUseVerb='read-offer'|'accept-basil'|'deliver-basil'|'close-basil'|'recall-delivery'|'observe-mint'|'collect-mint'|'archive-mint'|'share-mint';
export const plantUseVerbs:readonly PlantUseVerb[]=['read-offer','accept-basil','deliver-basil','close-basil','recall-delivery','observe-mint','collect-mint','archive-mint','share-mint'];
export const dueMinute=(accepted:number)=>(Math.floor(accepted/1440)+2)*1440+1020;
export function mintStatus(s:PlantUsesSave){const m=s.plantUsesV1?.mint,now=s.townMinutes??540;return {stock:m?.recoverAt!==null&&m?.recoverAt!==undefined&&now>=m.recoverAt?2:m?.stock??2,remaining:Math.max(0,(m?.recoverAt??now)-now),observed:m?.observedAt!==undefined,leaves:m?.leaves??0,archived:m?.archivedAt!==undefined,shared:m?.sharedAt!==undefined};}
export type PlantUsesView={snapshotVersion:number;enabled:true;newStarts:boolean;wildFixtureOnly:boolean;offerRead:boolean;order:PlantOrder|null;availableBasil:number;cooldownUntil:number;deliveries:number;mint:ReturnType<typeof mintStatus>;messages:{offer:Words;recollection:Words}};
