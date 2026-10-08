import {useLayoutEffect,useRef} from 'react';

const inertOwners=new WeakMap<HTMLElement,{count:number;before:boolean}>();
const selector='button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex="0"]';
/** Ephemeral DOM only: trap the top dialog, restore its opener, and keep stacked dialogs reversible. */
export function useModalFocus<T extends HTMLElement=HTMLElement>(active:boolean){
 const ref=useRef<T>(null);
 useLayoutEffect(()=>{
  const dialog=ref.current;if(!active||!dialog)return;
  const opener=document.activeElement instanceof HTMLElement?document.activeElement:null;
  const backdrop=dialog.closest<HTMLElement>('.harbor-backdrop');
  const siblings=backdrop?.parentElement?[...backdrop.parentElement.children].filter((e):e is HTMLElement=>e instanceof HTMLElement&&e!==backdrop):[];
  for(const e of siblings){const entry=inertOwners.get(e)??{count:0,before:e.inert};entry.count++;inertOwners.set(e,entry);e.inert=true}
  (dialog.querySelector<HTMLElement>('[data-menu-close]')??dialog.querySelector<HTMLElement>(selector)??dialog).focus({preventScroll:true});
  const onKey=(e:KeyboardEvent)=>{
   if(e.key!=='Tab'||dialog.inert)return;
   const top=[...document.querySelectorAll<HTMLElement>('[aria-modal="true"]')].filter(e=>!e.inert).at(-1);if(top!==dialog)return;
   const controls=[...dialog.querySelectorAll<HTMLElement>(selector)].filter(e=>!e.closest('[hidden],[inert]')&&e.getClientRects().length>0);
   const first=controls[0],last=controls.at(-1);if(!first){e.preventDefault();dialog.focus();return}
   if(!dialog.contains(document.activeElement)){e.preventDefault();(e.shiftKey?last!:first).focus()}
   else if(e.shiftKey&&(document.activeElement===first||document.activeElement===dialog)){e.preventDefault();last!.focus()}
   else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus()}
  };
  document.addEventListener('keydown',onKey,true);
  return()=>{document.removeEventListener('keydown',onKey,true);for(const e of siblings){const entry=inertOwners.get(e);if(!entry)continue;if(--entry.count===0){e.inert=entry.before;inertOwners.delete(e)}}if(opener?.isConnected&&!opener.closest('[inert]'))opener.focus({preventScroll:true})};
 },[active]);
 return ref;
}
