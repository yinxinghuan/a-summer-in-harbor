import {validateProfile} from '../game-profile/index.mjs';
import {canonical, sha256, validate, compile, COMPILER_VERSION} from '../rule-compiler/index.mjs';

// First reviewed vertical slice, NOT the whole free-form delta language. This
// module has no HTTP route, model caller, activation or session writer. All
// context arguments must come from the authority, never from a player's body.
export const DELTA_CONTRACT_VERSION = 2; // Adds bounded locations to v1's frozen registry.

const reserved = 'sys-dyn-';
const fail = (code, at) => { throw Object.assign(new Error(`${code}: ${at}`), {code, status:422}); };
function exact(v, keys, at) {
  if (!v || typeof v !== 'object' || Array.isArray(v) || keys.some(k => !Object.hasOwn(v,k))
    || Object.keys(v).some(k => !keys.includes(k))) fail('DELTA_SHAPE_INVALID',at);
}
function list(v, max, at, min=0) {
  if (!Array.isArray(v) || v.length<min || v.length>max) fail('DELTA_LIMIT',at);
}
function stable(v, at) {
  if (typeof v!=='string' || !/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(v) || v.length>48
    || ['constructor','prototype'].includes(v) || v.startsWith(reserved)) fail('DELTA_ID_INVALID',at);
}
function bi(v, at, max=2000) {
  exact(v,['zh','en'],at);
  for (const text of Object.values(v)) if (typeof text!=='string' || !text.trim() || text.length>max
    || /[\x00-\x1f\x7f]/u.test(text)) fail('DELTA_TEXT_INVALID',at);
}
const b = (zh,en) => ({zh,en});
const fact = (id,value) => ({op:'fact',id,cmp:'eq',value});
const map = nodeId => ({op:'map-is',nodeId});
const all = rules => ({op:'all',rules});
const same = (a,b) => canonical(a)===canonical(b);
const normal = s => s.normalize('NFKC').toLowerCase().replace(/[\s\p{P}\p{S}]+/gu,'');
function uniqueLabels(entries, at) {
  for(const locale of ['zh','en']) {
    const seen=new Set();
    for(const entry of entries) {
      const label=normal(entry.label[locale]);
      if(!label || seen.has(label)) fail('DELTA_LABEL_COLLISION',at);
      seen.add(label);
    }
  }
}

/** Pure, additive preparation. The returned artifact is NOT verified/active.
 * parent is a trusted registered definition; lineage is trusted stored metadata.
 * snapshot contains only the source binding/version, not browser-owned progress.
 */
export async function prepareRuleDelta({parent, parentBinding, snapshot, proposal, lineage, profile}) {
  profile=validateProfile(profile,parent?.rules);
  // Freeze the request image across the asynchronous compiler call below.
  ({parent,parentBinding,snapshot,proposal,lineage}=structuredClone({parent,parentBinding,snapshot,proposal,lineage}));
  if(Buffer.byteLength(JSON.stringify(proposal)??'')>65536) fail('DELTA_LIMIT','proposal bytes');
  if(parent?.format!=='alteru-rule-package-v1' || parent.rules?.schemaVersion!==2
    || parent.rules.gameId!==profile.gameId) fail('DELTA_PARENT_INVALID','game');
  validate(parent.rules);
  exact(parentBinding,['registry_game_id','ruleset_version','artifact_hash'],'parentBinding');
  if(typeof parentBinding.registry_game_id!=='string' || !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(parentBinding.registry_game_id)
    || parentBinding.ruleset_version!==parent.rules.rulesetVersion || !/^[a-f0-9]{64}$/.test(parentBinding.artifact_hash??''))
    fail('DELTA_PARENT_INVALID','binding');
  const parentFiles=await compile(parent.rules);
  if(sha256(canonical(parentFiles))!==parentBinding.artifact_hash) fail('DELTA_PARENT_INVALID','artifact');
  exact(snapshot,['session_id','version','cursor'],'snapshot');
  if(typeof snapshot.session_id!=='string' || !/^[A-Za-z0-9_-]{1,128}$/.test(snapshot.session_id)
    || !Number.isSafeInteger(snapshot.version) || snapshot.version<0
    || !Number.isSafeInteger(snapshot.cursor) || snapshot.cursor<0) fail('DELTA_SOURCE_INVALID','snapshot');
  exact(proposal,['format','contract_version','profile','proposal_id','base','grounding','add'],'proposal');
  if(proposal.format!=='alteru-rule-delta-v1' || proposal.contract_version!==DELTA_CONTRACT_VERSION
    || proposal.profile!==profile.id) fail('DELTA_CONTRACT_INVALID','version/profile');
  stable(proposal.proposal_id,'proposal_id');
  if(!same(proposal.base,parentBinding)) fail('DELTA_STALE','parent binding');
  exact(proposal.grounding,['source','motivation'],'grounding');
  if(!same(proposal.grounding.source,snapshot)) fail('DELTA_STALE','source snapshot');
  bi(proposal.grounding.motivation,'grounding.motivation',200);
  exact(proposal.add,['locations','items','facts','actions'],'add');
  list(proposal.add.locations,1,'locations',1);
  list(proposal.add.items,profile.caps.items,'items'); list(proposal.add.facts,profile.caps.facts,'facts');
  // Entry and escape consume two of the eight action slots.
  list(proposal.add.actions,profile.caps.actions,'actions',1);
  if(!lineage || !Number.isSafeInteger(lineage.depth) || lineage.depth<0 || lineage.depth>=profile.maxChainDepth
    || !Array.isArray(lineage.locations) || !Array.isArray(lineage.proposals)
    || !lineage.rewardAllocations || typeof lineage.rewardAllocations!=='object') fail('DELTA_LINEAGE_INVALID','lineage');
  if(lineage.proposals.includes(proposal.proposal_id)) fail('DELTA_DUPLICATE','proposal');
  const rules=structuredClone(parent.rules);
  // Existing completion remains exclusively owned by its authored action.
  if(!rules.actions.some(a=>a.id===profile.completion.action)
    || !rules.facts.some(f=>f.id===profile.completion.fact&&f.initial===false)
    || profile.gateFacts.some(id=>!rules.facts.some(f=>f.id===id&&f.initial===false))) fail('DELTA_PARENT_INVALID','protected contract');
  const used=new Set([...rules.locations,...rules.items,...rules.facts,...rules.actions].map(x=>x.id));
  const addId = id => {stable(id,'add.id');if(used.has(id))fail('DELTA_ID_COLLISION',id);used.add(id);};
  const location=structuredClone(proposal.add.locations[0]);
  exact(location,['id','label','detail','lore','parent_id'],'location');
  addId(location.id);bi(location.label,'location.label',100);bi(location.detail,'location.detail');bi(location.lore,'location.lore');
  const parentLocation=rules.locations.find(l=>l.id===location.parent_id);
  if(!parentLocation) fail('DELTA_REFERENCE_INVALID','parent location');
  // Only declared parent locations may host the new entry; never teleport.
  if(!profile.parents.includes(location.parent_id)) fail('DELTA_PROFILE_BOUNDARY','entry parent');
  rules.locations.push({id:location.id,label:location.label});
  const localFacts=new Set();
  for(const value of proposal.add.facts) {
    exact(value,['id','initial'],'fact');addId(value.id);
    if(value.initial!==false) fail('DELTA_PROFILE_BOUNDARY','new facts start false');
    localFacts.add(value.id);rules.facts.push(structuredClone(value));
  }
  const localItems=new Set();
  for(const item of proposal.add.items) {
    addId(item.id);
    if(item.initialCount!==0) fail('DELTA_PROFILE_BOUNDARY','new items start empty');
    localItems.add(item.id);rules.items.push(structuredClone(item));
  }
  const allocations=structuredClone(lineage.rewardAllocations);
  const suffix=sha256(canonical({base:proposal.base,proposal_id:proposal.proposal_id})).slice(0,16);
  const enterId=`${reserved}enter-${suffix}`,exitId=`${reserved}exit-${suffix}`;
  const serverFacts=[];
  for(const submitted of proposal.add.actions) {
    exact(submitted,['id','label','successText','rejectionText','when','effects','next'],'action');
    addId(submitted.id);
    // Validate arbitrary expression shape before traversing/wrapping it.
    list(submitted.effects,14,'effects',1);list(submitted.next,5,'next');
    // Optional authoring hints can only reference actions in this same delta.
    // They never grant availability: runtime menus are queried from Prolog.
    if(submitted.next.some(id=>!proposal.add.actions.some(a=>a.id===id)))fail('DELTA_REFERENCE_INVALID','next');
    const action=structuredClone(submitted),guards=[map(location.id),...profile.gateFacts.map(id=>fact(id,true)),fact(profile.completion.fact,false),action.when];
    let reward=false;
    for(const effect of action.effects) {
      if(effect.type==='fact') {
        if(!localFacts.has(effect.id) || effect.value!==true) fail('DELTA_PROTECTED_WRITE','fact');
      } else if(effect.type==='inventory') {
        // One reviewed existing reward; newly registered items remain bounded.
        if(effect.action!=='add' || effect.count!==1 || !(profile.rewards.items.includes(effect.itemId)||localItems.has(effect.itemId)))
          fail('DELTA_REWARD_FORBIDDEN','inventory');
        allocations[effect.itemId]=(allocations[effect.itemId]??0)+effect.count;
        if(allocations[effect.itemId]>1) fail('DELTA_REWARD_LIMIT',effect.itemId);
        guards.push({op:'item-count',itemId:effect.itemId,cmp:'eq',value:0});reward=true;
      } else if(effect.type==='stat') {
        if(!profile.rewards.stats[effect.id]?.includes(effect.delta)) fail('DELTA_PROFILE_BOUNDARY','stat');
      } else fail('DELTA_PROTECTED_WRITE','effect');
    }
    // Each authored action is once-only in this slice (including cost-only
    // actions); no other model action may reset or write these server markers.
    const marker=`${reserved}done-${sha256(`${suffix}:${action.id}`).slice(0,16)}`;
    if(used.has(marker))fail('DELTA_ID_COLLISION','server marker');used.add(marker);
    serverFacts.push({id:marker,initial:false});guards.push(fact(marker,false));
    if(reward) {
      // A separate local investigation must precede collection. The compiler
      // later proves the actual scenario; grounding prose alone is not a gate.
      const requiresLocal = expr => expr?.op==='fact' && localFacts.has(expr.id) && expr.cmp==='eq' && expr.value===true
        || expr?.op==='all' && Array.isArray(expr.rules) && expr.rules.some(requiresLocal)
        || expr?.op==='any' && Array.isArray(expr.rules) && expr.rules.length>0 && expr.rules.every(requiresLocal);
      // Bound untrusted expressions before recursive reasoning.
      validate({...rules,actions:[...rules.actions,action],facts:[...rules.facts,...serverFacts]});
      if(!requiresLocal(action.when)) fail('DELTA_REWARD_PREREQUISITE','investigation');
    }
    action.when=all(guards);action.effects.push({type:'fact',id:marker,value:true});
    rules.actions.push(action);
  }
  if(proposal.add.facts.length+serverFacts.length>profile.caps.facts) fail('DELTA_LIMIT','facts including server markers');
  rules.facts.push(...serverFacts);
  for(const id of [enterId,exitId])if(used.has(id))fail('DELTA_ID_COLLISION','server route');
  rules.actions.push({id:enterId,label:b(`进入${location.label.zh}`,`Enter ${location.label.en}`),
    successText:b(`你沿安全通道进入${location.label.zh}。${location.detail.zh}`,`You follow the safe passage into ${location.label.en}. ${location.detail.en}`),
    rejectionText:structuredClone(profile.entryRejection),
    when:all([map(parentLocation.id),...profile.gateFacts.map(id=>fact(id,true)),fact(profile.completion.fact,false)]),
    effects:[{type:'map',nodeId:location.id}],next:[]});
  rules.actions.push({id:exitId,label:b(`从${location.label.zh}返回${parentLocation.label.zh}`,`Return from ${location.label.en} to ${parentLocation.label.en}`),
    successText:b(`你沿原路安全返回${parentLocation.label.zh}。`,`You return safely to ${parentLocation.label.en}.`),
    rejectionText:b('你当前不在这个地点。','You are not at this location.'),when:map(location.id),
    effects:[{type:'map',nodeId:parentLocation.id}],next:[]});
  // The ONLY floor extension is this exact trusted escape. Model input cannot
  // supply floors or nominate an arbitrary action for the exemption.
  for(const floor of rules.floors??[])floor.allowed.push(exitId);
  rules.rulesetVersion++;
  uniqueLabels(rules.locations,'locations');uniqueLabels(rules.items,'items');
  uniqueLabels(rules.actions,'actions');validate(rules);
  const compiled=await compile(rules),artifactHash=sha256(canonical(compiled));
  const content={locations:[...structuredClone(lineage.locations),{...location,enter_action_id:enterId,escape_action_id:exitId}],
    items:structuredClone(rules.items),actions:rules.actions.map(({id,label,successText,rejectionText})=>({id,label,successText,rejectionText})),
    facts:structuredClone(rules.facts)};
  const nextLineage={depth:lineage.depth+1,proposals:[...lineage.proposals,proposal.proposal_id],
    rewardAllocations:allocations,locations:content.locations};
  const descriptor={format:'alteru-dynamic-artifact-v1',contract_version:DELTA_CONTRACT_VERSION,profile:profile.id,
    profile_hash:sha256(canonical(profile)),compiler_version:COMPILER_VERSION,parent:structuredClone(parentBinding),source:structuredClone(snapshot),
    proposal_id:proposal.proposal_id,proposal_hash:sha256(canonical(proposal)),rules_artifact_hash:artifactHash,
    content_hash:sha256(canonical(content)),lineage_hash:sha256(canonical(nextLineage))};
  return {status:'prepared-unverified',definition:{format:parent.format,rules},compiled,content,lineage:nextLineage,
    descriptor,artifact_hash:sha256(canonical(descriptor)),rules_artifact_hash:artifactHash,
    entry_action_id:enterId,escape_action_id:exitId};
}
