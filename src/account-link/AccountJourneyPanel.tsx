import {useState} from 'react';import type {AccountJourneyLink,View} from './core';
/** Candidate UI; only the QA entry mounts it until the trusted authority adapter exists. */
export function AccountJourneyPanel({link,view}:{link:AccountJourneyLink;view:View}){
 const [confirm,setConfirm]=useState(false);
 if(view.phase==='waiting')return <section><h2>Waiting for your account</h2><p>Sign in to continue your own journey.</p></section>;
 if(view.phase==='loading')return <p role="status">Finding your journeys…</p>;
 if(view.phase==='connection-needed')return <section><h2>Your account is ready</h2><p>Your journeys are not connected yet. Your existing progress has been kept.</p></section>;
 return <section><h2>{view.selected?'Your summer awaits':'Choose a journey'}</h2><p>Your existing journeys stay separate. Choosing one does not replace another.</p>
 {view.journeys.map(j=><button key={j.id} onClick={()=>link.choose(j.id)} disabled={view.phase==='claiming'} aria-pressed={view.selected?.id===j.id}>{j.title}{view.selected?.id===j.id?' · Selected':''}</button>)}
 {!view.journeys.length&&<p>No journey is available from this account connection yet.</p>}
 {view.legacy&&<article><h3>A journey on this browser</h3><p>{view.legacy.title}</p>{confirm?<><p>Is this your journey? Add it to this account only if you want it to belong here. Your other journeys will remain.</p><button disabled={view.phase==='claiming'} onClick={()=>void link.claimLegacy(true).then(()=>setConfirm(false))}>Yes, add my journey</button><button disabled={view.phase==='claiming'} onClick={()=>setConfirm(false)}>Keep it on this browser</button></>:<button onClick={()=>setConfirm(true)}>Review this journey</button>}</article>}
 {view.phase==='claiming'&&<p role="status">Adding your journey…</p>}{view.error&&<p role="alert">We could not finish that step. Your progress has been kept; you can try again.</p>}
 {view.selected&&<p role="status">Ready to continue: {view.selected.title}</p>}</section>;
}
