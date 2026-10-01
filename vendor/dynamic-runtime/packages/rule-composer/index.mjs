import {compile,validate,canonical,sha256} from '../rule-compiler/index.mjs';

export class CompositionError extends Error {
  constructor(code, detail, remedy) { super(`${code}: ${detail}`); this.code=code; this.remedy=remedy; }
}
const fail=(code,detail,remedy='调整语义单元、前置路径或申请经审核的组合预算；不要删除事实或修改初值。')=>{throw new CompositionError(code,detail,remedy);};
const hash=v=>sha256(canonical(v));
const cmp=(a,b)=>a<b?-1:a>b?1:0;
const sorted=a=>[...a].sort(cmp);
const id=s=>typeof s==='string'&&/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(s)&&s.length<=48&&!['constructor','prototype'].includes(s);
const keys=(o,required,optional=[])=>{
  if(!o||typeof o!=='object'||Array.isArray(o)||required.some(k=>!Object.hasOwn(o,k))||Object.keys(o).some(k=>![...required,...optional].includes(k)))fail('COMPOSITE_SHAPE',required.join(','));
};
const budgetKeys=['maxModules','totalFacts','sharedFacts','totalWitnessCases','totalActions','totalArtifactBytes'];
// Absolute parser guards are not the deployment profile. Both policy layers are mandatory.
const absolute={maxModules:128,totalFacts:8192,sharedFacts:8192,totalWitnessCases:262144,totalActions:8192,totalArtifactBytes:67108864};
export function validateCompositeBudgets(profile,envelope){
  for(const p of [profile,envelope]){
    keys(p,budgetKeys);
    for(const k of budgetKeys)if(!Number.isSafeInteger(p[k])||p[k]<(k==='sharedFacts'?0:1)||p[k]>absolute[k])fail('COMPOSITE_BUDGET_INVALID',k);
  }
  for(const k of budgetKeys)if(profile[k]>envelope[k])fail('COMPOSITE_ENVELOPE_EXCEEDED',k);
}
function normalize(input){
  keys(input,['format','sourceHash','spatialContract','profile','envelope','units','factWriters'],['policyContext']);
  if(input.policyContext!==undefined){
    keys(input.policyContext,['profileId','profileHash','platformPolicyId','platformPolicyHash']);
    const p=input.policyContext;
    if(!id(p.profileId)||!id(p.platformPolicyId)||![p.profileHash,p.platformPolicyHash].every(h=>typeof h==='string'&&/^[a-f0-9]{64}$/.test(h)))fail('COMPOSITE_POLICY_CONTEXT','invalid policy identity');
  }
  if(input.format!=='alteru-composite-source-v1'||!/^[a-f0-9]{64}$/.test(input.sourceHash)||!input.spatialContract||typeof input.spatialContract!=='object')fail('COMPOSITE_SHAPE','source/spatial binding');
  if(Buffer.byteLength(JSON.stringify(input))>4*1024*1024)fail('COMPOSITE_INPUT_LIMIT','4 MiB');
  validateCompositeBudgets(input.profile,input.envelope);
  if(!Array.isArray(input.units)||!input.units.length||input.units.length>128)fail('COMPOSITE_UNIT_LIMIT','1..128');
  const value=structuredClone(input), ids=new Set();
  for(const unit of value.units){
    keys(unit,['id','rules','exposedActions']);
    if(!id(unit.id)||ids.has(unit.id))fail('COMPOSITE_UNIT_ID',String(unit.id));ids.add(unit.id);
    const r=unit.rules;
    keys(r,['schemaVersion','gameId','rulesetVersion','stats','locations','initialLocation','items','facts','actions','walkthrough'],['characters','floors']);
    if(![1,2].includes(r.schemaVersion)||!Array.isArray(r.facts)||!Array.isArray(r.actions)||!Array.isArray(r.walkthrough)||!r.walkthrough.length)fail('COMPOSITE_UNIT_SHAPE',unit.id);
    for(const k of ['facts','actions']){
      const seen=new Set();
      if(r[k].length>8192)fail('COMPOSITE_INPUT_LIMIT',k);
      for(const e of r[k]){if(!e||!id(e.id)||seen.has(e.id))fail('COMPOSITE_DUPLICATE_ID',`${unit.id}/${k}`);seen.add(e.id);}
      r[k].sort((a,b)=>cmp(a.id,b.id));
    }
    const actions=new Set(r.actions.map(a=>a.id));
    if(!actions.size||!Array.isArray(unit.exposedActions)||!unit.exposedActions.length||new Set(unit.exposedActions).size!==unit.exposedActions.length||unit.exposedActions.some(a=>!actions.has(a)))fail('COMPOSITE_EXPOSURE',unit.id);
    if(r.walkthrough.length>128||r.walkthrough.some(a=>!actions.has(a)))fail('COMPOSITE_WITNESS_REFERENCE',unit.id);
    unit.exposedActions=sorted(unit.exposedActions);
  }
  value.units.sort((a,b)=>cmp(a.id,b.id));
  if(!value.factWriters||typeof value.factWriters!=='object'||Array.isArray(value.factWriters))fail('COMPOSITE_WRITERS','expected registry');
  for(const [fact,writers] of Object.entries(value.factWriters)){
    if(!id(fact)||!Array.isArray(writers)||new Set(writers).size!==writers.length||writers.some(w=>!ids.has(w)))fail('COMPOSITE_WRITERS',fact);
    value.factWriters[fact]=sorted(writers);
  }
  return value;
}
function factReferences(action){
  const refs=new Set();
  let nodes=0;
  const visit=(e,depth=0)=>{if(!e||typeof e!=='object')return;if(depth>6||++nodes>64)fail('COMPOSITE_EXPRESSION_LIMIT',action.id);if(e.op==='fact')refs.add(e.id);if(Array.isArray(e.rules))e.rules.forEach(r=>visit(r,depth+1));if(e.rule)visit(e.rule,depth+1);};
  visit(action.when);
  for(const r of action.requirements??[])if(r.type==='fact')refs.add(r.id);
  for(const e of action.effects??[])if(e.type==='fact'||e.type==='fact-add')refs.add(e.id);
  return refs;
}
function checkDeclarations(input){
  const facts=new Map(), first=input.units[0].rules;
  for(const unit of input.units){
    const r=unit.rules;
    // Local witness locations may differ; actual global spawn remains the caller's responsibility.
    for(const k of ['gameId','rulesetVersion','schemaVersion','stats','locations','items','characters'])if(canonical(r[k]??[])!==canonical(first[k]??[]))fail('COMPOSITE_REGISTRY_CONFLICT',`${unit.id}/${k}`);
    for(const f of r.facts){
      if(facts.has(f.id)&&canonical(facts.get(f.id))!==canonical(f))fail('COMPOSITE_FACT_CONFLICT',f.id);
      facts.set(f.id,f);
      if(!Object.hasOwn(input.factWriters,f.id))fail('COMPOSITE_WRITER_MISSING',f.id,'声明每个事实的允许写入语义单元；只读事实填空数组。');
    }
    for(const a of r.actions)for(const e of a.effects??[])if(['fact','fact-add'].includes(e.type)&&!input.factWriters[e.id]?.includes(unit.id))fail('COMPOSITE_WRITE_DENIED',`${unit.id}/${a.id}/${e.id}`);
  }
  for(const key of Object.keys(input.factWriters))if(!facts.has(key))fail('COMPOSITE_WRITER_UNKNOWN_FACT',key);
  return facts;
}
function partition(unit){
  const r=unit.rules, actions=new Map(r.actions.map(a=>[a.id,a])), facts=new Map(r.facts.map(f=>[f.id,f]));
  const adjacent=new Map(r.actions.map(a=>[a.id,new Set()]));
  for(const a of r.actions){
    if(!Array.isArray(a.next)||!Array.isArray(a.effects))fail('COMPOSITE_ACTION_SHAPE',`${unit.id}/${a.id}`);
    for(const n of a.next){if(!actions.has(n))fail('COMPOSITE_NEXT_REFERENCE',`${unit.id}/${a.id}/${n}`);adjacent.get(a.id).add(n);adjacent.get(n).add(a.id);}
  }
  // Never drop next edges. Connected components are indivisible packing units.
  const visited=new Set(), components=[];
  for(const action of sorted(actions.keys())){
    if(visited.has(action))continue;
    const queue=[action],component=[];
    while(queue.length){const a=queue.shift();if(visited.has(a))continue;visited.add(a);component.push(a);queue.push(...sorted(adjacent.get(a)));}
    components.push(sorted(component));
  }
  const seed=new Set(r.walkthrough);
  for(const floor of r.floors??[])for(const a of floor.allowed??[]){if(!actions.has(a))fail('COMPOSITE_FLOOR_REFERENCE',`${unit.id}/${a}`);seed.add(a);}
  for(const component of components)if(component.some(a=>seed.has(a)))component.forEach(a=>seed.add(a));
  const make=(actionIds,extras=[])=>{
    const refs=new Set(extras);
    for(const a of actionIds)for(const f of factReferences(actions.get(a)))refs.add(f);
    for(const f of refs)if(!facts.has(f))fail('COMPOSITE_FACT_REFERENCE',`${unit.id}/${f}`);
    return {...r,actions:sorted(actionIds).map(a=>actions.get(a)),facts:sorted(refs).map(f=>facts.get(f))};
  };
  const fits=ids=>{try{validate(make(ids));return true;}catch(e){if(e instanceof CompositionError)throw e;return false;}};
  if(!fits(seed))fail('COMPOSITE_UNSPLITTABLE_WITNESS',unit.id,'完整 walkthrough / next / floor 依赖不能放进单包。请作者提供更短且真实可达的局部见证；不能伪造已完成的初值。');
  const groups=[];let current=new Set(seed);
  for(const component of components){
    if(component.every(a=>seed.has(a)))continue;
    const proposed=new Set([...current,...component]);
    if(fits(proposed)){current=proposed;continue;}
    if(current.size>seed.size)groups.push(current);
    current=new Set([...seed,...component]);
    if(!fits(current))fail('COMPOSITE_UNSPLITTABLE_COMPONENT',`${unit.id}/${component.join(',')}`);
  }
  groups.push(current);
  const sources=groups.map(g=>make(g));
  const present=new Set(sources.flatMap(s=>s.facts.map(f=>f.id)));
  // Preserve even currently unused declarations; splitting must not lose save fields.
  for(const f of r.facts){
    if(present.has(f.id))continue;
    let added=false;
    for(const source of sources){
      const candidate={...source,facts:[...source.facts,f].sort((a,b)=>cmp(a.id,b.id))};
      try{validate(candidate);source.facts=candidate.facts;added=true;break;}catch{}
    }
    if(!added){const source=make(seed,[f.id]);try{validate(source);}catch{fail('COMPOSITE_UNSPLITTABLE_DECLARATION',`${unit.id}/${f.id}`);}sources.push(source);}
    present.add(f.id);
  }
  // Compile does reachable-witness validation later; no runtime JS oracle is installed.
  return sources.map((rules,index)=>({id:`m-${unit.id}-${index+1}`,unitId:unit.id,rules}));
}
function plan(input){
  const source=normalize(input), facts=checkDeclarations(source), modules=source.units.flatMap(partition);
  const counts=new Map();for(const m of modules)for(const f of m.rules.facts)counts.set(f.id,(counts.get(f.id)??0)+1);
  const cases=r=>r.actions.length*(r.walkthrough.length+1)+1+r.walkthrough.reduce((n,a)=>n+(r.actions.find(x=>x.id===a).requirements?.length??0),0);
  const metrics={maxModules:modules.length,totalFacts:facts.size,sharedFacts:[...counts.values()].filter(n=>n>1).length,
    totalWitnessCases:modules.reduce((n,m)=>n+cases(m.rules),0),totalActions:modules.reduce((n,m)=>n+m.rules.actions.length,0)};
  for(const [k,v] of Object.entries(metrics))if(v>source.profile[k])fail('COMPOSITE_TOTAL_BUDGET',`${k}: ${v} > ${source.profile[k]}`);
  const routes=source.units.flatMap(u=>u.exposedActions.map(actionId=>({unitId:u.id,actionId,moduleId:modules.find(m=>m.unitId===u.id&&m.rules.actions.some(a=>a.id===actionId)).id})));
  return {source,modules,routes,metrics,partitions:modules.map(m=>({moduleId:m.id,unitId:m.unitId,actions:m.rules.actions.length,facts:m.rules.facts.length,witnessCases:cases(m.rules),sourceBytes:Buffer.byteLength(JSON.stringify(m.rules))})),
    unitMapping:source.units.map(u=>({unitId:u.id,modules:modules.filter(m=>m.unitId===u.id).map(m=>m.id),actions:u.rules.actions.length,facts:u.rules.facts.length}))};
}
export function preflightComposite(input){
  try{const p=plan(input);return {ok:true,metrics:p.metrics,unitMapping:p.unitMapping,partitions:p.partitions,mechanicallyVerified:false};}
  catch(e){if(!(e instanceof CompositionError))throw e;return {ok:false,diagnostic:{code:e.code,message:e.message,remedy:e.remedy},mechanicallyVerified:false};}
}
export async function composeRules(input){
  const p=plan(input), modules=[];
  for(const m of p.modules){
    try{modules.push({...m,compiled:await compile(m.rules)});}catch(e){fail('COMPOSITE_COMPILE_REJECTED',`${m.unitId}: ${e.message}`);}
  }
  const bytes=modules.reduce((n,m)=>n+Object.values(m.compiled).reduce((s,v)=>s+Buffer.byteLength(v),0),0);
  if(bytes>p.source.profile.totalArtifactBytes)fail('COMPOSITE_TOTAL_BUDGET',`totalArtifactBytes: ${bytes}`);
  const manifest={format:'alteru-composite-manifest-v1',compilerPolicy:'frozen-64-facts-64-actions-2048-witness',
    sourceHash:p.source.sourceHash,spatialHash:hash(p.source.spatialContract),inputHash:hash(p.source),
    policyHash:hash({profile:p.source.profile,envelope:p.source.envelope,factWriters:p.source.factWriters,...(p.source.policyContext?{policyContext:p.source.policyContext}:{})}),
    modules:modules.map(m=>({id:m.id,unitId:m.unitId,rulesHash:hash(m.rules),artifactHash:hash(m.compiled)})),
    routes:p.routes,unitMapping:p.unitMapping,partitions:p.partitions,metrics:{...p.metrics,totalArtifactBytes:bytes}};
  return {source:p.source,modules,manifest,binding:hash(manifest)};
}
// This gate reconstructs everything. An artifact hash supplied by a client is not authority.
export async function verifyComposite(bundle,runProlog){
  if(typeof runProlog!=='function')fail('COMPOSITE_ENGINE_REQUIRED','SWI runner');
  const rebuilt=await composeRules(bundle.source);
  if(canonical(rebuilt)!==canonical(bundle))fail('COMPOSITE_BINDING_MISMATCH','recompiled manifest or artifact differs');
  let count=0;
  for(const m of rebuilt.modules){
    const cases=JSON.parse(m.compiled['witness.json']).cases;
    const actual=await runProlog(m.compiled,cases.map(c=>({action_id:c.actionId,state:c.state})));
    const expected=cases.map(c=>({accepted:c.accepted,effects:c.effects}));
    if(canonical(actual)!==canonical(expected))fail('COMPOSITE_WITNESS_MISMATCH',m.id);
    count+=cases.length;
  }
  // Capture a private immutable-by-reachability rebuilt bundle, not the caller's object.
  return Object.freeze({binding:rebuilt.binding,witnessCases:count,
    async resolve(request){
      keys(request,['binding','unitId','actionId','state']);const {binding,unitId,actionId,state}=request;
      if(binding!==rebuilt.binding)fail('COMPOSITE_STALE_BINDING','full composite required');
      const route=rebuilt.manifest.routes.find(r=>r.unitId===unitId&&r.actionId===actionId);
      if(!route)fail('COMPOSITE_UNKNOWN_INTENT',`${unitId}/${actionId}`);
      const m=rebuilt.modules.find(m=>m.id===route.moduleId);
      const result=await runProlog(m.compiled,[{action_id:actionId,state}]);
      if(!Array.isArray(result)||result.length!==1||typeof result[0]?.accepted!=='boolean'||!Array.isArray(result[0]?.effects)||!result[0].accepted&&result[0].effects.length)fail('COMPOSITE_ENGINE_RESPONSE','one result required');
      return result[0];
    }});
}
