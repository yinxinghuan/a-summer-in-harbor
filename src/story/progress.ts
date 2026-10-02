import type {Save} from './state';

// Read-only projection. Completion facts outrank inventory absence and conversation order.
// Do not write new flags merely because an old topic has become irrelevant.
export function questProgress(s:Save){
 const has=(id:string)=>s.flags.includes(id);
 return {
  arrival:has('unpacked')?'settled':has('key')?'key-collected':'awaiting-key',
  toolbag:has('bag-returned')?'returned':(s.items.toolbag??0)>0?'carried':has('talk:theo:bag')?'collected':has('talk:mara:settle')?'requested':'not-requested',
  terrace:has('terrace-fixed')?'repaired':s.activeChallenge?.kind==='repair'?'in-progress':'unrepaired',
  bridge:has('bridge-fixed')?'repaired':has('bridge-seen')?'inspected':'uninspected',
  trail:has('alternative-route')?'mapped':'unmapped',
  garden:has('garden-agreed')?'agreed-10-to-12':'not-agreed',
  access:has('route-open')?'open':has('bridge-fixed')||has('alternative-route')||has('garden-agreed')?'ready':'not-ready',
  market:has('market-open')?'open':has('market-known')?'notice-read':'unknown',
 } as const;
}
