import {useEffect,useState} from 'react';
import type {Save} from '../story/state';
import {readLife} from '../story/client';
import {identitySnapshot} from '../account-link/transport';
import type {LifeView} from '../ui/LifeBag';
import {lifeSnapshotKey,lifeViewMatchesHead} from './snapshot';

/** Action-driven assembly: exact guarded snapshot, no motion or prediction clock. */
export function useLifeSnapshot(save:Save|null,accountLoading:boolean){
 const identity=identitySnapshot(),scope=JSON.stringify([identity.scope,identity.epoch]),key=save?lifeSnapshotKey(save):'';
 const [entry,setEntry]=useState<{scope:string;key:string;view:LifeView}>();
 useEffect(()=>{
  let live=true;
  if(save&&!accountLoading)void readLife(save).then(view=>{
   if(!lifeViewMatchesHead(save,view))throw Error('LIFE_SNAPSHOT_UNCONFIRMED');
   if(live)setEntry({scope,key,view});
  }).catch(()=>{if(live)setEntry(undefined)});
  return()=>{live=false};
 },[key,scope,accountLoading]);
 const view=!accountLoading&&save&&entry?.scope===scope&&entry.key===key&&lifeViewMatchesHead(save,entry.view)?entry.view:null;
 return {view,enabled:!!view};
}
