import type {Save} from '../story/state';
import {readLife} from '../story/client';
import {identitySnapshot} from '../account-link/transport';
import {useLifeProjection} from '../candidate/use-life-projection';

/** Preserve display across harmless ACKs; never replace the server's stamps.
 * Identity, content, scene, position and animal evidence are proof inputs. */
export function useLifeSnapshot(save:Save|null,accountLoading:boolean){
 const identity=identitySnapshot(),scope=JSON.stringify([identity.scope,identity.epoch]);
 const projection=useLifeProjection(save,scope,'owner-b2-cats-gulls-active-v1',readLife,!accountLoading);
 return {view:projection.view,enabled:!!projection.view,projectionCurrent:projection.current,retry:projection.retry};
}
