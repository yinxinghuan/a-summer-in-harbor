import {useEffect,useRef,useState} from 'react';
import {createLifeProjection,type LifeProjectionDTO,type LifeProjectionHead} from './life-projection';
/** Caller supplies its identity epoch, fixed projection assembly and original guarded readLife. */
export function useLifeProjection<V extends LifeProjectionDTO>(head:LifeProjectionHead|null,scope:string,assembly:string,read:(head:LifeProjectionHead)=>Promise<V>,enabled=true){
 const [,refresh]=useState(0),reader=useRef(read);reader.current=read;
 const controller=useRef<ReturnType<typeof createLifeProjection<V>>>();
 if(!controller.current)controller.current=createLifeProjection<V>(h=>reader.current(h),()=>refresh(n=>n+1));
 useEffect(()=>{controller.current!.update(head,scope,assembly,enabled)},[head,scope,assembly,enabled]);
 useEffect(()=>()=>controller.current!.dispose(),[]);
 const current=controller.current.forHead(head,scope,assembly,enabled);
 // A new render must not briefly present the previous journey or grant freshness before its effect runs.
 return {...current,retry:()=>controller.current!.retry()};
}
