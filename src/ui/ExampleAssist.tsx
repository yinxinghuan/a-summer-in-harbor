import {useRef,useState} from 'react';
import {tx,type Locale} from '../world/data';

export type ExampleCandidate={id:string;text:string};
type Props={candidates:ExampleCandidate[];value:string;onChange:(value:string)=>void;inputId:string;locale:Locale;disabled?:boolean};

// A local writing aid. No submit, model, storage or game-authority dependency.
// Parent keys this by context and owns draft persistence.
export function ExampleAssist({candidates,value,onChange,inputId,locale,disabled=false}:Props){
 const [index,setIndex]=useState(-1),[preview,setPreview]=useState<ExampleCandidate|null>(null),[notice,setNotice]=useState(false);
 const owned=useRef<string|null>(null),trigger=useRef<HTMLButtonElement>(null);
 const focusInput=()=>{
  const input=document.getElementById(inputId) as HTMLTextAreaElement|null;
  input?.focus(); // Synchronous user gesture keeps the mobile keyboard available.
  requestAnimationFrame(()=>{if(input?.isConnected&&document.activeElement===input)input.setSelectionRange(input.value.length,input.value.length)});
 };
 const apply=(candidate:ExampleCandidate)=>{if(disabled)return;owned.current=candidate.text;onChange(candidate.text);setPreview(null);setNotice(true);focusInput()};
 const next=()=>{
  if(disabled||!candidates.length)return;
  const n=(index+1)%candidates.length,candidate=candidates[n];setIndex(n);
  // Only untouched examples from this mounted context may be cycled in place.
  // Restored drafts and player edits always require explicit replacement.
  if(!value.trim()||value===owned.current)apply(candidate);
  else{setPreview(candidate);setNotice(false)}
 };
 return <div className="harbor-example-assist">
  <button ref={trigger} className="harbor-suggestion" type="button" disabled={disabled||!candidates.length} onClick={next} aria-controls={inputId} aria-expanded={!!preview}>{tx(index<0?['举个例子','Give an example']:['换个例子','Another example'],locale)}</button>
  {preview?<section className="harbor-example-assist__preview" aria-label={tx(['可供改写的例子','An example you can edit'],locale)}>
   <p aria-live="polite">{preview.text}</p>
   <small>{tx(['你已经写了内容。只有点击替换，才会改动输入框。','You have a draft. It will only change if you choose to replace it.'],locale)}</small>
   <div className="harbor-example-assist__actions">
    <button type="button" disabled={disabled} onClick={()=>apply(preview)}>{tx(['用这个替换草稿','Replace draft with this'],locale)}</button>
    <button type="button" disabled={disabled} onClick={()=>{setPreview(null);trigger.current?.focus()}}>{tx(['保留我的草稿','Keep my draft'],locale)}</button>
   </div>
  </section>:<small role="status">{tx(notice?['例子已填入。可以改写，准备好再发送。','Example added. Edit it, then send when you are ready.']:['不知道从哪说起？试试一个可改写的例子。','Not sure where to start? Try an example you can edit.'],locale)}</small>}
 </div>;
}
