const invalid=()=>{throw new Error('RULE_OUTPUT_INVALID');};
const exact=(value,keys)=>{
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).length!==keys.length||keys.some(k=>!Object.hasOwn(value,k)))invalid();
};
const integer=(n,min,max)=>{if(!Number.isSafeInteger(n)||n<min||n>max)invalid();};

// Decode a bounded command language. This deliberately does NOT compare the
// returned effects to the authored action's effects or re-evaluate conditions.
export function decodeEffects(result,definition,cartridge,save){
 exact(result,['accepted','effects']);
 if(typeof result.accepted!=='boolean'||!Array.isArray(result.effects)||result.effects.length>16||(!result.accepted&&result.effects.length))invalid();
 const stats=new Map(),counts=new Map(save.inventory.map(i=>[i.id,i.count]));
 const facts={...save.facts},seen=new Set();
 return result.effects.map(e=>{
  if(!e||typeof e!=='object')invalid();
  const key=`${e.type==='fact_add'?'fact':e.type}:${e.id??e.item_id??e.character_id??''}`;
  if(seen.has(key))invalid();seen.add(key);
  if(e.type==='stat'){
   exact(e,['type','id','delta']);const d=cartridge.statDefinitions.find(s=>s.id===e.id);if(!d)invalid();
   integer(e.delta,-(d.domainMaxDelta??d.maxDelta),d.domainMaxDelta??d.maxDelta);
   const total=(stats.get(e.id)??0)+e.delta;integer(total,-(d.domainMaxDelta??d.maxDelta),d.domainMaxDelta??d.maxDelta);stats.set(e.id,total);
   // The existing reducer clamps to the declared stat range. Reject anything
   // it would silently change, so accepted effects are applied exactly.
   integer(save.stats[e.id]+total,d.min,d.max);return {...e};
  }
  if(e.type==='fact'||e.type==='fact_add'){
   exact(e,e.type==='fact'?['type','id','value']:['type','id','delta']);
   const d=definition.rules.facts.find(f=>f.id===e.id);if(!d)invalid();
   if(e.type==='fact_add'){
    if(typeof d.initial!=='number'||typeof facts[e.id]!=='number')invalid();integer(e.delta,-999,999);
    integer(facts[e.id]+e.delta,-1000000,1000000);facts[e.id]+=e.delta;return {type:'fact-add',id:e.id,delta:e.delta};
   }
   if(typeof e.value!==typeof d.initial)invalid();
   if(typeof e.value==='number')integer(e.value,-1000000,1000000);
   else if(typeof e.value==='string'){if(!e.value.length||e.value.length>128||/[\x00-\x1f\x7f]/.test(e.value))invalid();}
   else if(typeof e.value!=='boolean')invalid();
   facts[e.id]=e.value;return {...e};
  }
  if(e.type==='inventory'){
   exact(e,['type','action','item_id','count']);integer(e.count,1,999);
   if(!['add','remove'].includes(e.action)||!definition.rules.items.some(i=>i.id===e.item_id))invalid();
   const next=(counts.get(e.item_id)??0)+(e.action==='add'?e.count:-e.count);integer(next,0,999);counts.set(e.item_id,next);
   const item=save.inventory.find(i=>i.id===e.item_id)??cartridge.domainRules.rules.flatMap(r=>r.effects).find(f=>f.type==='inventory'&&f.itemId===e.item_id&&f.item)?.item;
   if(e.action==='add'&&!item)invalid();
   return {type:'inventory',action:e.action,itemId:e.item_id,count:e.count,...(item?{item:{...item}}:{})};
  }
  if(e.type==='map'){
   exact(e,['type','node_id']);if(!save.map.some(n=>n.id===e.node_id))invalid();return {type:'map',nodeId:e.node_id};
  }
  if(e.type==='party'){
   exact(e,['type','change','character_id']);
   if(!['add','remove'].includes(e.change)||!(definition.rules.characters??[]).some(c=>c.id===e.character_id))invalid();
   return {type:'party',change:e.change,characterId:e.character_id};
  }
  if(e.type==='danger'){
   exact(e,['type','outcome']);if(!['critical-success','success','costly-success','failure','critical-failure'].includes(e.outcome))invalid();
   return {...e};
  }
  if(e.type==='clock_add'){exact(e,['type','minutes']);integer(e.minutes,1,1440);return {type:'clock-add',minutes:e.minutes};}
  if(e.type==='objective'||e.type==='clock'){
   exact(e,['type','value']);exact(e.value,['zh','en']);
   if(definition.rules.schemaVersion!==2||!['zh','en'].includes(save.locale))invalid();
   for(const value of Object.values(e.value)){
    if(typeof value!=='string'||!value.trim()||value.length>2000||/[\x00-\x1f\x7f]/.test(value))invalid();
    if(e.type==='clock'&&!/^(?:[^\d\r\n]{1,80} · )?([01]\d|2[0-3]):[0-5]\d$/.test(value))invalid();
   }
   return {type:e.type,value:e.value[save.locale]};
  }
  if(e.type==='session'){exact(e,['type','ended']);if(typeof e.ended!=='boolean')invalid();return {...e};}
  invalid();
 });
}
