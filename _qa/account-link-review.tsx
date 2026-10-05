import {useMemo,useState} from 'react';import {createRoot} from 'react-dom/client';
import {AccountJourneyLink,publicHint,readRecentHint,type Journey,type View} from '../src/account-link/core';import {AccountJourneyPanel} from '../src/account-link/AccountJourneyPanel';
import './account-link-review.css';

if(!import.meta.env.DEV)throw Error('DEV_ONLY');
const game='e78df027-7ef4-4d49-82eb-ea91f03d9fb3';
const first={id:'00000000-0000-4000-8000-000000000001',title:'A summer by the harbor — your first journey',version:12},old={id:'00000000-0000-4000-8000-000000000002',title:'The journey started on this browser',version:7};
let current='A',hasAuthority=true,claimed=false;const owned:Record<string,Journey[]>={A:[first],B:[]},cache=new Map<string,string>(),receipts=new Map<string,any>();
const storage={getItem:(k:string)=>cache.get(k)??null,setItem:(k:string,v:string)=>{cache.set(k,v)},removeItem:(k:string)=>{cache.delete(k)}};
function Demo(){const [view,setView]=useState<View>({phase:'waiting',journeys:[]}),[identity,setIdentity]=useState('A');const link=useMemo(()=>new AccountJourneyLink({gameId:game,identity:()=>current?{account:current}:null,storage,changed:setView,readHint:async()=>readRecentHint([{user_id:'A',resource_data:JSON.stringify(publicHint(game,first.id))}],current,game),authority:{list:async()=>{if(!hasAuthority)throw Error('NOT_CONNECTED');return {journeys:[...owned[current]],...(!claimed?{legacy:old}:{})}},claim:async(id,key)=>{const owner=current;await new Promise(r=>setTimeout(r,400));if(receipts.has(key))return receipts.get(key);if(claimed)throw Error('ALREADY_OWNED');if(id!==old.id)throw Error('NOT_OWNER');owned[owner].push(old);claimed=true;const result={journeys:[...owned[owner]]};receipts.set(key,result);return result}}}),[]);
 return <main><aside><strong>Local account-flow test</strong><p>Synthetic accounts and journeys. No platform requests or real save changes.</p><nav>{['A','B',''].map(id=><button key={id} onClick={()=>{current=id;setIdentity(id);void link.connect()}}>{id?'Test account '+id:'Not signed in'}</button>)}</nav><p>Current: {identity||'not ready'}</p><button onClick={()=>void link.connect()}>Reconnect</button></aside><AccountJourneyPanel key={view.scope??view.phase} link={link} view={view}/></main>
}
createRoot(document.getElementById('root')!).render(<Demo/>);
