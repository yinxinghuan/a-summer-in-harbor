import {sha256,canonical} from '../rule-compiler/index.mjs';
export function assembleSlots(draft,{profile,proposalId,parentId}){
  const exact=(v,keys)=>{if(!v||typeof v!=='object'||Array.isArray(v)||Object.keys(v).length!==keys.length||keys.some(k=>!Object.hasOwn(v,k)))throw Error('SLOT_SHAPE_INVALID');};
  exact(draft,['motivation','room','investigations']);exact(draft.room,['label','detail','lore']);
  if(!Array.isArray(draft.investigations)||draft.investigations.length!==2)throw Error('SLOT_SHAPE_INVALID');
  for(const i of draft.investigations)exact(i,['label','successText','rejectionText']);
  const prefix='slot-'+sha256(canonical({profile:profile.id,proposalId})).slice(0,12),facts=[prefix+'-read-a',prefix+'-read-b'];
  return{motivation:draft.motivation,add:{locations:[{id:prefix+'-room',...draft.room,parent_id:parentId}],items:[],facts:facts.map(id=>({id,initial:false})),actions:draft.investigations.map((i,n)=>({id:prefix+'-inspect-'+(n?'b':'a'),...i,when:n?{op:'fact',id:facts[0],cmp:'eq',value:true}:{op:'const',value:true},effects:[{type:'fact',id:facts[n],value:true}],next:[]}))}};
}
