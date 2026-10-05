import {getTelegramId,isInAigramNow,callAigramAPI,type AigramResponse} from '../shared/runtime/bridge';
import {readRecentHint,type CloudHint,type Identity} from './core';
export function currentPlatformIdentity():Identity{if(!isInAigramNow())return null;const account=getTelegramId();return account&&account!=='__alteru_guest__'?{account}:null}
/** Read-only composition using the unchanged canonical host bridge. Not installed into production entry. */
export async function platformJourneyHint(gameId:string,signal:AbortSignal):Promise<CloudHint>{
 const before=currentPlatformIdentity();if(!before||signal.aborted)return {kind:'unavailable'};
 const r=await callAigramAPI<AigramResponse<unknown>>('/note/aigram/ai/game/get/data/list?session_id='+encodeURIComponent(gameId),'GET');
 if(signal.aborted||currentPlatformIdentity()?.account!==before.account)return {kind:'unavailable'};
 return r?.retcode===0?readRecentHint(r.data,before.account,gameId):{kind:'unavailable'};
}
// Deliberately no real cloud write or capability export. The documented list
// discloses multiple users and is not an authenticated game-authority transport.
