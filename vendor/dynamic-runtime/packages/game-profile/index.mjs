export {validateCompositeProfile} from './composite.mjs';
const fail=()=>{throw Object.assign(Error('PROFILE_INVALID'),{code:'PROFILE_INVALID',status:422});};
const id=s=>typeof s==='string'&&/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(s)&&s.length<=64&&!['constructor','prototype'].includes(s);
const ids=v=>Array.isArray(v)&&v.length<=32&&new Set(v).size===v.length&&v.every(id);
const integer=(n,min,max)=>Number.isSafeInteger(n)&&n>=min&&n<=max;
const exact=(v,keys)=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k));
// Internal review contract v0.1, NOT the full spatial/prompt profile in PlanDocs.
export function validateProfile(input,rules){
  const p=structuredClone(input);
  if(!exact(p,['version','id','gameId','strictness','parents','gateFacts','completion','caps','maxChainDepth','rewards','entryRejection','semanticReview','limits'])||p.version!==1||!id(p.id)||!id(p.gameId)||!['slots-v1','rules-v1'].includes(p.strictness))fail();
  if(!ids(p.parents)||!p.parents.length||!ids(p.gateFacts)||!p.gateFacts.length||!exact(p.completion,['action','fact'])||!id(p.completion.action)||!id(p.completion.fact)||p.gateFacts.includes(p.completion.fact))fail();
  if(!exact(p.caps,['locations','items','facts','actions'])||p.caps.locations!==1||!integer(p.caps.items,0,4)||!integer(p.caps.facts,1,8)||!integer(p.caps.actions,1,6)||!integer(p.maxChainDepth,1,4))fail();
  if(!exact(p.rewards,['items','stats'])||!ids(p.rewards.items)||!p.rewards.stats||Array.isArray(p.rewards.stats)||typeof p.rewards.stats!=='object')fail();
  for(const [key,values]of Object.entries(p.rewards.stats))if(!id(key)||!Array.isArray(values)||!values.length||values.length>4||values.some(n=>!integer(n,-2,-1)))fail();
  if(!exact(p.entryRejection,['en','zh'])||Object.values(p.entryRejection).some(s=>typeof s!=='string'||!s.trim()||s.length>200))fail();
  if(!exact(p.semanticReview,['required','disabledReason'])||typeof p.semanticReview.required!=='boolean'||typeof p.semanticReview.disabledReason!=='string'||(!p.semanticReview.required&&!p.semanticReview.disabledReason.trim()))fail();
  if(!exact(p.limits,['perSessionConcurrent','perOwnerDaily','proposalAttempts','serviceConcurrent'])||p.limits.perSessionConcurrent!==1)fail();
  for(const [key,cap]of Object.entries({perOwnerDaily:10,proposalAttempts:6,serviceConcurrent:4})){
    const v=p.limits[key];if(!exact(v,['default','max'])||!integer(v.default,1,cap)||!integer(v.max,v.default,cap))fail();
  }
  if(rules){
    if(rules.gameId!==p.gameId||!rules.actions.some(a=>a.id===p.completion.action)||!rules.facts.some(f=>f.id===p.completion.fact&&f.initial===false)||p.gateFacts.some(id=>!rules.facts.some(f=>f.id===id&&f.initial===false))||p.parents.some(id=>!rules.locations.some(l=>l.id===id))||p.rewards.items.some(id=>!rules.items.some(i=>i.id===id))||Object.keys(p.rewards.stats).some(id=>!rules.stats.some(s=>s.id===id)))fail();
  }
  return p;
}
export function resolveLimits(profile,overrides={}){
  const p=validateProfile(profile),out={perSessionConcurrent:1,totalModelCalls:0};
  const keys=['perOwnerDaily','proposalAttempts','serviceConcurrent','totalModelCalls'];
  if(Object.keys(overrides).some(k=>!keys.includes(k)))throw Error('QUOTA_OVERRIDE_FORBIDDEN');
  for(const k of keys){const n=overrides[k]??(k==='totalModelCalls'?0:p.limits[k].default),max=k==='totalModelCalls'?100000:p.limits[k].max;if(!integer(n,k==='totalModelCalls'?0:1,max))throw Error('QUOTA_OVERRIDE_INVALID');out[k]=n;}
  return Object.freeze(out);
}
