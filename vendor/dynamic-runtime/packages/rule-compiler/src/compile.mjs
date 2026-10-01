import { createHash } from 'node:crypto';
import { readFile, mkdir, writeFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

export const COMPILER_VERSION = '0.2.0-experimental';
const LIMIT = 65536;
const fail = (at, message) => { throw new Error(`${at}: ${message}`); };
const own = (o, k) => Object.hasOwn(o, k);
function object(v, keys, at, optional = []) {
  if (!v || typeof v !== 'object' || Array.isArray(v)) fail(at, 'expected object');
  for (const k of Object.keys(v)) if (!keys.includes(k)) fail(`${at}.${k}`, 'unsupported field');
  for (const k of keys) if (!optional.includes(k) && !own(v, k)) fail(`${at}.${k}`, 'required');
}
function list(v, at, min = 0, max = 64) {
  if (!Array.isArray(v) || v.length < min || v.length > max) fail(at, `expected ${min}..${max} entries`);
}
function string(v, at, max = 2000) {
  if (typeof v !== 'string' || !v.trim() || v.length > max || /[\x00-\x1f\x7f]/u.test(v)) fail(at, 'invalid text');
}
function id(v, at) {
  if (typeof v !== 'string' || !/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(v) || v.length > 48 || ['constructor', 'prototype'].includes(v)) fail(at, 'expected a short non-reserved kebab-case id');
}
function integer(v, at, min = -1000000, max = 1000000) {
  if (!Number.isSafeInteger(v) || v < min || v > max) fail(at, `expected integer ${min}..${max}`);
}
function bilingual(v, at) {
  object(v, ['zh', 'en'], at);
  string(v.zh, `${at}.zh`); string(v.en, `${at}.en`);
}
function primitive(v, at) {
  if (typeof v === 'number') integer(v, at);
  else if (typeof v === 'string') string(v, at, 128);
  else if (typeof v !== 'boolean') fail(at, 'expected boolean, integer or short string');
}
function validateExpression(expression, registries, at = 'expression', depth = 0, budget = { nodes: 0 }) {
  if (depth > 6 || ++budget.nodes > 64) fail(at, 'expression is too complex');
  if (!expression || typeof expression !== 'object' || Array.isArray(expression)) fail(at, 'expected object');
  const { stats, locations, items, facts, characters } = registries;
  switch (expression.op) {
    case 'const':
      object(expression, ['op', 'value'], at); if (typeof expression.value !== 'boolean') fail(at, 'const value must be boolean'); break;
    case 'all': case 'any':
      object(expression, ['op', 'rules'], at);
      list(expression.rules, `${at}.rules`, expression.op === 'all' ? 1 : 2, 16);
      expression.rules.forEach((rule, index) => validateExpression(rule, registries, `${at}.rules[${index}]`, depth + 1, budget));
      break;
    case 'not':
      object(expression, ['op', 'rule'], at);
      validateExpression(expression.rule, registries, `${at}.rule`, depth + 1, budget);
      break;
    case 'map-is':
      object(expression, ['op', 'nodeId'], at); ref(locations, expression.nodeId, at); break;
    case 'character-status':
      object(expression, ['op', 'id', 'status'], at); ref(characters, expression.id, at);
      enumeration(expression.status, ['known','companion','departed'], at); break;
    case 'item-count':
      object(expression, ['op', 'itemId', 'cmp', 'value'], at); ref(items, expression.itemId, at);
      enumeration(expression.cmp, ['eq', 'gte', 'lte'], `${at}.cmp`); integer(expression.value, `${at}.value`, 0, 999); break;
    case 'stat':
      object(expression, ['op', 'id', 'cmp', 'value'], at); ref(stats, expression.id, at);
      enumeration(expression.cmp, ['eq', 'gte', 'lte'], `${at}.cmp`); integer(expression.value, `${at}.value`); break;
    case 'fact': {
      object(expression, ['op', 'id', 'cmp', 'value'], at); ref(facts, expression.id, at);
      enumeration(expression.cmp, ['eq', 'neq', 'gte', 'lte'], `${at}.cmp`); primitive(expression.value, `${at}.value`);
      const initial = facts.get(expression.id).initial;
      if (typeof expression.value !== typeof initial) fail(at, 'fact type mismatch');
      if (['gte', 'lte'].includes(expression.cmp) && typeof initial !== 'number') fail(at, 'ordered comparison requires numeric fact');
      break;
    }
    default: fail(at, 'unsupported expression operator');
  }
}
function expressionGuaranteesItem(expression, itemId, count) {
  if (expression.op === 'item-count') return expression.itemId === itemId
    && (expression.cmp === 'gte' || expression.cmp === 'eq') && expression.value >= count;
  if (expression.op === 'all') return expression.rules.some(rule => expressionGuaranteesItem(rule, itemId, count));
  if (expression.op === 'any') return expression.rules.every(rule => expressionGuaranteesItem(rule, itemId, count));
  return false;
}
function enumeration(v, values, at) { if (!values.includes(v)) fail(at, `expected ${values.join('|')}`); }
function registry(entries, at) {
  const map = new Map();
  entries.forEach((v, i) => {
    if (!v || typeof v !== 'object') fail(`${at}[${i}]`, 'expected object');
    id(v.id, `${at}[${i}].id`);
    if (map.has(v.id)) fail(at, `duplicate id ${v.id}`);
    map.set(v.id, v);
  });
  return map;
}
const ref = (map, value, at) => { if (!map.has(value)) fail(at, `unknown reference ${String(value)}`); };
export function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${canonical(value[k])}`).join(',')}}`;
  return JSON.stringify(value);
}
export const sha256 = value => createHash('sha256').update(value).digest('hex');

/** A deliberately bounded rules DSL, not a complete visual/game schema. */
export function validate(source) {
  if (Buffer.byteLength(JSON.stringify(source) ?? '') > LIMIT) fail('source', 'maximum 64 KiB');
  object(source, ['schemaVersion', 'gameId', 'rulesetVersion', 'stats', 'locations', 'initialLocation', 'items', 'facts', 'actions', 'walkthrough','characters','floors'], 'source',['characters','floors']);
  if(source.schemaVersion!==2&&(own(source,'characters')||own(source,'floors')))fail('source','extensions require schemaVersion 2');
  if (![1, 2].includes(source.schemaVersion)) fail('schemaVersion', 'unsupported');
  id(source.gameId, 'gameId'); integer(source.rulesetVersion, 'rulesetVersion', 1);
  list(source.stats, 'stats', 3, 3); list(source.locations, 'locations', 1, 32);
  list(source.items, 'items', 0, 32); list(source.facts, 'facts', 0, 64); list(source.actions, 'actions', 1, 64);
  const stats = registry(source.stats, 'stats'), locations = registry(source.locations, 'locations');
  const items = registry(source.items, 'items'), facts = registry(source.facts, 'facts'), actions = registry(source.actions, 'actions');
  list(source.characters??[],'characters',0,32);list(source.floors??[],'floors',0,3);
  const characters=registry(source.characters??[],'characters');
  for(const c of characters.values()){object(c,['id','initialStatus'],'character');enumeration(c.initialStatus,['hidden','known','companion','departed'],'character');}
  for(const f of source.floors??[]){object(f,['statId','threshold','allowed'],'floor');ref(stats,f.statId,'floor');integer(f.threshold,'floor');list(f.allowed,'floor.allowed',1,16);f.allowed.forEach(a=>ref(actions,a,'floor.allowed'));}
  ref(locations, source.initialLocation, 'initialLocation');
  for (const s of source.stats) {
    object(s, ['id', 'label', 'description', 'min', 'max', 'initial'], `stat.${s.id}`);
    bilingual(s.label, 'stat.label'); bilingual(s.description, 'stat.description');
    integer(s.min, 'stat.min'); integer(s.max, 'stat.max', s.min + 1); integer(s.initial, 'stat.initial', s.min, s.max);
  }
  for (const l of source.locations) { object(l, ['id', 'label'], `location.${l.id}`); bilingual(l.label, 'location.label'); }
  for (const i of source.items) {
    object(i, ['id', 'label', 'detail', 'effect', 'lore', 'initialCount'], `item.${i.id}`);
    for (const k of ['label', 'detail', 'effect', 'lore']) bilingual(i[k], `item.${k}`);
    integer(i.initialCount, 'item.initialCount', 0, 999);
  }
  for (const f of source.facts) { object(f, ['id', 'initial'], `fact.${f.id}`); primitive(f.initial, 'fact.initial'); }
  const labels = { zh: new Set(), en: new Set() };
  for (const a of source.actions) {
    const at = `action.${a.id}`;
    object(a, source.schemaVersion === 1
      ? ['id', 'label', 'successText', 'requirements', 'effects', 'next']
      : ['id', 'label', 'successText', 'rejectionText', 'when', 'effects', 'next'], at);
    bilingual(a.label, `${at}.label`); bilingual(a.successText, `${at}.successText`);
    if (source.schemaVersion === 2) {
      bilingual(a.rejectionText, `${at}.rejectionText`);
      validateExpression(a.when, { stats, locations, items, facts, characters }, `${at}.when`);
    }
    for (const locale of ['zh', 'en']) {
      const normalized = a.label[locale].toLowerCase().replace(/[\s\p{P}\p{S}]+/gu, '');
      if (!normalized || labels[locale].has(normalized)) fail(at, 'ambiguous normalized action label');
      labels[locale].add(normalized);
    }
    if (source.schemaVersion === 1) list(a.requirements, `${at}.requirements`, 0, 16);
    list(a.effects, `${at}.effects`, 1, 16); list(a.next, `${at}.next`, 0, 5);
    if (new Set(a.next).size !== a.next.length) fail(at, 'duplicate next action');
    a.next.forEach(n => ref(actions, n, `${at}.next`));
    for (const r of a.requirements ?? []) {
      const where = `${at}.requirement`;
      if (!r || typeof r !== 'object') fail(where, 'expected object');
      switch (r.type) {
        case 'map': object(r, ['type', 'nodeId', 'reason'], where); ref(locations, r.nodeId, where); break;
        case 'item': object(r, ['type', 'id', 'minCount', 'reason'], where); ref(items, r.id, where); integer(r.minCount, where, 1, 999); break;
        case 'stat': case 'fact': {
          const fact = r.type === 'fact';
          object(r, fact ? ['type', 'id', 'equals', 'min', 'max', 'reason'] : ['type', 'id', 'min', 'max', 'reason'], where, ['equals', 'min', 'max']);
          ref(fact ? facts : stats, r.id, where);
          const keys = ['min', 'max'].filter(k => own(r, k));
          if (own(r, 'equals')) {
            if (keys.length) fail(where, 'equality and numeric ranges cannot be combined');
            primitive(r.equals, where);
            if (typeof r.equals !== typeof facts.get(r.id).initial) fail(where, 'fact type mismatch');
          } else {
            if (!keys.length) fail(where, 'missing comparison');
            if (fact && typeof facts.get(r.id).initial !== 'number') fail(where, 'range requires numeric fact');
            keys.forEach(k => integer(r[k], where));
            if (own(r, 'min') && own(r, 'max') && r.min > r.max) fail(where, 'inverted range');
          }
          break;
        }
        default: fail(where, 'unsupported requirement');
      }
      bilingual(r.reason, `${where}.reason`);
    }
    const removed = new Map(), writes = new Set();
    for (const e of a.effects) {
      const where = `${at}.effect`;
      if (!e || typeof e !== 'object') fail(where, 'expected object');
      switch (e.type) {
        case 'stat': case 'fact-add':
          object(e, ['type', 'id', 'delta'], where); ref(e.type === 'stat' ? stats : facts, e.id, where);
          integer(e.delta, where, -999, 999);
          if (e.delta === 0) fail(where, 'zero delta');
          if (e.type === 'fact-add' && typeof facts.get(e.id).initial !== 'number') fail(where, 'increment requires numeric fact');
          break;
        case 'fact':
          object(e, ['type', 'id', 'value'], where); ref(facts, e.id, where); primitive(e.value, where);
          if (typeof e.value !== typeof facts.get(e.id).initial) fail(where, 'fact type mismatch');
          break;
        case 'inventory':
          object(e, ['type', 'action', 'itemId', 'count'], where); ref(items, e.itemId, where);
          enumeration(e.action, ['add', 'remove'], where); integer(e.count, where, 1, 999);
          if (e.action === 'remove') removed.set(e.itemId, (removed.get(e.itemId) ?? 0) + e.count);
          break;
        case 'map': object(e, ['type', 'nodeId'], where); ref(locations, e.nodeId, where); break;
        case 'clock-add': object(e, ['type', 'minutes'], where); integer(e.minutes, where, 1, 1440); break;
        case 'objective': case 'clock':
          if (source.schemaVersion !== 2) fail(where, 'text effects require schemaVersion 2');
          object(e, ['type', 'value'], where); bilingual(e.value, `${where}.value`);
          if (e.type === 'clock' && Object.values(e.value).some(v => !/^(?:[^\d\r\n]{1,80} · )?([01]\d|2[0-3]):[0-5]\d$/.test(v))) fail(where, 'clock requires HH:MM with optional story label');
          break;
        case 'party':
          if(source.schemaVersion!==2)fail(where,'party requires v2');
          object(e,['type','change','characterId'],where);ref(characters,e.characterId,where);enumeration(e.change,['add','remove'],where);break;
        case 'danger':
          if(source.schemaVersion!==2)fail(where,'danger requires v2');
          object(e,['type','outcome'],where);enumeration(e.outcome,['critical-success','success','costly-success','failure','critical-failure'],where);
          break;
        case 'session':
          object(e, ['type', 'ended'], where); if (e.ended !== true) fail(where, 'v1 supports checkpoint true only');
          if (a.next.length) fail(where, 'checkpoint cannot emit next choices'); break;
        default: fail(where, 'unsupported effect');
      }
      const key = e.type === 'fact-add' ? `fact:${e.id}` : `${e.type}:${e.id ?? e.itemId ?? e.characterId ?? ''}`;
      if (writes.has(key)) fail(where, 'multiple writes to one target are not supported in v1');
      writes.add(key);
    }
    for (const [item, count] of removed) {
      const guaranteed = source.schemaVersion === 2
        ? expressionGuaranteesItem(a.when, item, count)
        : a.requirements.some(r => r.type === 'item' && r.id === item && r.minCount >= count);
      if (!guaranteed) fail(at, `item ${item} needs an explicit pre-turn count >= ${count}`);
    }
  }
  list(source.walkthrough, 'walkthrough', 1, 128);
  source.walkthrough.forEach(a => ref(actions, a, 'walkthrough'));
  const caseCount = source.actions.length * (source.walkthrough.length + 1) + 1
    + source.walkthrough.reduce((n, a) => n + (actions.get(a).requirements?.length ?? 0), 0);
  if (caseCount > 2048) fail('walkthrough', 'maximum 2048 witness cases; split long test scenarios');
  return source;
}

export function initialState(source) {
  return { location: source.initialLocation, stats: Object.fromEntries(source.stats.map(x => [x.id, x.initial])),
    facts: Object.fromEntries(source.facts.map(x => [x.id, x.initial])),
    inventory: source.items.filter(x => x.initialCount).map(x => ({ id: x.id, count: x.initialCount })),
    characters:(source.characters??[]).filter(c=>c.initialStatus!=='hidden').map(c=>({id:c.id,status:c.initialStatus})),danger_phase:'calm' };
}
export function meets(r, state) {
  if (r.type === 'map') return state.location === r.nodeId;
  if (r.type === 'item') return (state.inventory.find(x => x.id === r.id)?.count ?? 0) >= r.minCount;
  const v = (r.type === 'stat' ? state.stats : state.facts)[r.id];
  return own(r, 'equals') ? v === r.equals : Number.isSafeInteger(v) && (!own(r, 'min') || v >= r.min) && (!own(r, 'max') || v <= r.max);
}
export function meetsExpression(expression, state) {
  if (expression.op === 'const') return expression.value;
  if (expression.op === 'all') return expression.rules.every(rule => meetsExpression(rule, state));
  if (expression.op === 'any') return expression.rules.some(rule => meetsExpression(rule, state));
  if (expression.op === 'not') return !meetsExpression(expression.rule, state);
  if (expression.op === 'map-is') return state.location === expression.nodeId;
  if (expression.op === 'character-status') return state.characters.some(c=>c.id===expression.id&&c.status===expression.status);
  const compare = value => expression.cmp === 'eq' ? value === expression.value
    : expression.cmp === 'neq' ? value !== expression.value
      : expression.cmp === 'gte' ? Number.isSafeInteger(value) && value >= expression.value
        : Number.isSafeInteger(value) && value <= expression.value;
  if (expression.op === 'item-count') return compare(state.inventory.find(item => item.id === expression.itemId)?.count ?? 0);
  if (expression.op === 'stat') return compare(state.stats[expression.id]);
  return own(state.facts, expression.id) && compare(state.facts[expression.id]);
}
export function resolve(source, state, actionId) {
  const action = source.actions.find(a => a.id === actionId);
  const accepted = Boolean(action && (source.floors??[]).every(f=>state.stats[f.statId]>f.threshold||f.allowed.includes(actionId)) && (source.schemaVersion === 2
    ? meetsExpression(action.when, state)
    : action.requirements.every(r => meets(r, state))));
  return { accepted, effects: accepted ? action.effects.map(e=>{
    if(e.type!=='stat'||source.schemaVersion!==2)return e;
    const s=source.stats.find(s=>s.id===e.id),current=state.stats[e.id];
    return {...e,delta:Math.max(s.min,Math.min(s.max,current+e.delta))-current};
  }) : [] };
}
/** Offline witness only. Story Session, not this helper, owns real commits. */
export function applyForTest(source, state, effects) {
  const next = structuredClone(state);
  for (const e of effects) {
    if (e.type === 'stat') { const d = source.stats.find(s => s.id === e.id); next.stats[e.id] = Math.max(d.min, Math.min(d.max, next.stats[e.id] + e.delta)); }
    if (e.type === 'fact') next.facts[e.id] = e.value;
    if (e.type === 'fact-add') { next.facts[e.id] += e.delta; integer(next.facts[e.id], 'witness.fact'); }
    if (e.type === 'map') next.location = e.nodeId;
    if(e.type==='party'){const c=next.characters.find(c=>c.id===e.characterId);if(c)c.status=e.change==='add'?'companion':'departed';else next.characters.push({id:e.characterId,status:e.change==='add'?'companion':'departed'});}
    if(e.type==='danger')next.danger_phase='calm';
    if (e.type === 'objective' || e.type === 'clock') next[e.type] = structuredClone(e.value);
    if (e.type === 'inventory') {
      const item = next.inventory.find(x => x.id === e.itemId);
      const count = (item?.count ?? 0) + (e.action === 'add' ? e.count : -e.count);
      integer(count, 'witness.inventory', 0, 999);
      next.inventory = next.inventory.filter(x => x.id !== e.itemId);
      if (count) next.inventory.push({ id: e.itemId, count });
    }
  }
  return next;
}
export function witness(source) {
  let state = initialState(source);
  const cases = [];
  for (const actionId of source.walkthrough) {
    for (const action of source.actions) cases.push({ state: structuredClone(state), actionId: action.id, ...resolve(source, state, action.id) });
    const result = resolve(source, state, actionId);
    if (!result.accepted) fail('walkthrough', `unreachable step ${actionId}`);
    for (const r of source.actions.find(a => a.id === actionId).requirements ?? []) {
      const broken = structuredClone(state);
      if (r.type === 'map') broken.location = 'unknown-location';
      if (r.type === 'item') broken.inventory = broken.inventory.filter(i => i.id !== r.id);
      if (r.type === 'stat') broken.stats[r.id] = own(r, 'min') ? r.min - 1 : r.max + 1;
      if (r.type === 'fact') broken.facts[r.id] = own(r, 'equals') ? (typeof r.equals === 'boolean' ? !r.equals : typeof r.equals === 'number' ? r.equals + 1 : `${r.equals}-other`) : own(r, 'min') ? r.min - 1 : r.max + 1;
      cases.push({ state: broken, actionId, accepted: false, effects: [] });
    }
    state = applyForTest(source, state, result.effects);
  }
  for (const action of source.actions) cases.push({ state: structuredClone(state), actionId: action.id, ...resolve(source, state, action.id) });
  cases.push({ state, actionId: 'unknown-action', accepted: false, effects: [] });
  return { finalState: state, cases };
}
function itemView(item, locale) {
  return { id: item.id, label: item.label[locale], count: item.initialCount, detail: item.detail[locale], effect: item.effect[locale], lore: item.lore[locale] };
}
export function domainPatch(source, locale) {
  return {
    id: source.gameId, initialFacts: initialState(source).facts,
    statDefinitions: source.stats.map(s => ({ id: s.id, label: s.label[locale], description: s.description[locale], min: s.min, max: s.max, initial: s.initial,
      domainMaxDelta: Math.max(1, ...source.actions.flatMap(a => a.effects.filter(e => e.type === 'stat' && e.id === s.id).map(e => Math.abs(e.delta)))) })),
    initialMap: source.locations.map(l => ({ id: l.id, label: l.label[locale], current: l.id === source.initialLocation, visited: l.id === source.initialLocation })),
    initialInventory: source.items.filter(i => i.initialCount).map(i => itemView(i, locale)),
    domainRules: { rules: source.actions.map(a => ({ id: a.id, intent: a.label[locale], match: [a.label[locale]], matchMode: 'exact', dangerPolicy: 'suppress',
      successContinuation: a.effects.some(e => e.type === 'session') ? 'checkpoint' : 'replace', rejectionContinuation: 'resume',
      requirements: source.schemaVersion === 2
        ? [{ type: 'expression', expression: a.when, reason: a.rejectionText[locale] }]
        : a.requirements.map(r => ({ ...r, reason: r.reason[locale] })),
      effects: a.effects.map(e => e.type === 'objective' || e.type === 'clock' ? { ...e, value: e.value[locale] }
        : e.type === 'inventory' && e.action === 'add' ? { ...e, item: { ...itemView(source.items.find(i => i.id === e.itemId), locale), count: e.count } } : { ...e }),
      successText: a.successText[locale], successChoices: a.next.map(n => source.actions.find(x => x.id === n).label[locale]) })) },
  };
}
export function wireEffect(e) {
  if(e.type==='party')return {type:'party',change:e.change,character_id:e.characterId};
  if (e.type === 'inventory') return { type: e.type, action: e.action, item_id: e.itemId, count: e.count };
  if (e.type === 'map') return { type: e.type, node_id: e.nodeId };
  if (e.type === 'fact-add') return { ...e, type: 'fact_add' };
  if (e.type === 'clock-add') return { ...e, type: 'clock_add' };
  return e;
}
const atom = text => `'${String(text).replace(/\\/g, '\\\\').replace(/'/g, "''")}'`;
function requirementGoal(r) {
  if (r.type === 'map') return `get_dict(location, S, L), L == ${JSON.stringify(r.nodeId)}`;
  if (r.type === 'item') return `get_dict(inventory, S, Items), once((member(I, Items), get_dict(id, I, Id), Id == ${JSON.stringify(r.id)})), get_dict(count, I, N), integer(N), N >= ${r.minCount}`;
  const value = own(r, 'equals') ? (typeof r.equals === 'string' ? JSON.stringify(r.equals) : String(r.equals)) : null;
  return `get_dict(${r.type === 'stat' ? 'stats' : 'facts'}, S, D), get_dict(${atom(r.id)}, D, V), ` +
    (value !== null ? `V == ${value}` : ['integer(V)', own(r, 'min') ? `V >= ${r.min}` : '', own(r, 'max') ? `V =< ${r.max}` : ''].filter(Boolean).join(', '));
}
const comparisonGoal = (value, cmp, expected) => cmp === 'eq' ? `${value} == ${expected}`
  : cmp === 'neq' ? value + ' \\== ' + expected
    : cmp === 'gte' ? `integer(${value}), ${value} >= ${expected}`
      : `integer(${value}), ${value} =< ${expected}`;
function expressionGoal(expression, vars = { index: 0 }) {
  if(expression.op==='character-status') {const i=vars.index++;return `get_dict(characters,S,Chars${i}), once((member(C${i},Chars${i}), C${i}.id == ${JSON.stringify(expression.id)}, C${i}.status == ${JSON.stringify(expression.status)}))`;}
  if (expression.op === 'const') return expression.value ? 'true' : 'fail';
  if (expression.op === 'all') return `(${expression.rules.map(rule => expressionGoal(rule, vars)).join(', ')})`;
  if (expression.op === 'any') return `(${expression.rules.map(rule => expressionGoal(rule, vars)).join(' ; ')})`;
  if (expression.op === 'not') return `\\+ (${expressionGoal(expression.rule, vars)})`;
  const suffix = vars.index++;
  if (expression.op === 'map-is') return `get_dict(location, S, L${suffix}), L${suffix} == ${JSON.stringify(expression.nodeId)}`;
  const expected = typeof expression.value === 'string' ? JSON.stringify(expression.value) : String(expression.value);
  if (expression.op === 'item-count') {
    const count = `(member(I${suffix}, Items${suffix}), get_dict(id, I${suffix}, Id${suffix}), Id${suffix} == ${JSON.stringify(expression.itemId)}, get_dict(count, I${suffix}, Found${suffix}) -> N${suffix} = Found${suffix} ; N${suffix} = 0)`;
    return `get_dict(inventory, S, Items${suffix}), ${count}, ${comparisonGoal(`N${suffix}`, expression.cmp, expected)}`;
  }
  const dict = expression.op === 'stat' ? 'stats' : 'facts';
  return `get_dict(${dict}, S, D${suffix}), get_dict(${atom(expression.id)}, D${suffix}, V${suffix}), ${comparisonGoal(`V${suffix}`, expression.cmp, expected)}`;
}
export async function compile(source) {
  validate(source);
  source = JSON.parse(canonical(source));
  const proof = witness(source);
  const sourceHash = sha256(canonical(source));
  const moduleName = `rpg_${sourceHash}`;
  const clauses = source.actions.flatMap((a, i) => [
    `compiled_action(${atom(a.id.replaceAll('-', '_'))}, S) :- ${source.schemaVersion === 2 ? [...(source.floors??[]).filter(f=>!f.allowed.includes(a.id)).map(f=>`S.stats.${atom(f.statId)} > ${f.threshold}`),expressionGoal(a.when)].join(', ') : a.requirements.length ? a.requirements.map((_, j) => `condition_${i}_${j}(S)`).join(', ') : 'is_dict(S)'}.`,
    ...(a.requirements ?? []).map((r, j) => `condition_${i}_${j}(S) :- ${requirementGoal(r)}.`),
    `game_rule_effects(${atom(a.id.replaceAll('-', '_'))}, E) :- atom_json_dict(${atom(JSON.stringify(a.effects.map(wireEffect)))}, E, []).`,
  ]).join('\n');
  const prolog = `%% Generated by create-prolog-rpg ${COMPILER_VERSION}; data never becomes a goal.\n` +
    `:- module(${moduleName}, [hydrate_game_state/3, game_action/4, game_rule_effects/2, evaluate_state/3, ruleset_identity/3]).\n` +
    `:- use_module(library(http/json)).\n:- discontiguous compiled_action/2, game_rule_effects/2.\n` +
    `ruleset_identity(${atom(source.gameId)}, ${source.rulesetVersion}, ${atom(sourceHash)}).\n` +
    `hydrate_game_state(Session, Actor, State) :-\n    util:start_session(${moduleName}, Session, Actor, State.location),\n    assertz(util:session_flag(Session, compiled_snapshot(Actor), State)).\n` +
    `game_action(Session, Actor, Action, Reply) :-\n    ( util:session_flag(Session, compiled_snapshot(Actor), S), compiled_action(Action, S) -> Accepted = true ; Accepted = false ),\n    Reply = json{accepted:Accepted}.\n` +
    `evaluate_state(Action,S,Reply) :- (compiled_action(Action,S) -> game_rule_effects(Action,Raw), maplist(bound_effect(S),Raw,Effects), Reply=json{accepted:true,effects:Effects}; Reply=json{accepted:false,effects:[]}).\n`+
    (source.schemaVersion===2?source.stats.map(s=>`stat_bound(${JSON.stringify(s.id)},${s.min},${s.max}).`).join('\n')+'\n'+
      `bound_effect(S,E,R) :- E.type == "stat", !, stat_bound(E.id,Min,Max), atom_string(Id,E.id), get_dict(Id,S.stats,Current), Delta is max(Min,min(Max,Current+E.delta))-Current, put_dict(delta,E,Delta,R).\n`:'')+
    `bound_effect(_,E,E).\n`+clauses + '\n';
  const files = {
    'domain.zh.json': JSON.stringify(domainPatch(source, 'zh'), null, 2) + '\n',
    'domain.en.json': JSON.stringify(domainPatch(source, 'en'), null, 2) + '\n',
    'rules.pl': prolog,
    'witness.json': JSON.stringify({ ...proof, cases: proof.cases.map(c => ({ ...c, effects: c.effects.map(wireEffect) })) }, null, 2) + '\n',
  };
  files['manifest.json'] = JSON.stringify({ format: 'alteru-rpg-rules', compilerVersion: COMPILER_VERSION, schemaVersion: source.schemaVersion,
    gameId: source.gameId, rulesetVersion: source.rulesetVersion, sourceHash, moduleName,
    files: Object.fromEntries(Object.entries(files).map(([name, body]) => [name, sha256(body)])),
    status: 'offline-compiled-not-published', signature: null, witnessCases: proof.cases.length }, null, 2) + '\n';
  if (Object.values(files).reduce((n, body) => n + Buffer.byteLength(body), 0) > 4 * 1024 * 1024) fail('artifacts', 'maximum 4 MiB');
  return files;
}

async function main() {
  const [input, output, ...extra] = process.argv.slice(2);
  if (!input || !output || extra.length) fail('usage', 'node compile.mjs source.json NEW_OUTPUT_DIRECTORY');
  if ((await stat(input)).size > LIMIT) fail('input', 'maximum 64 KiB');
  const files = await compile(JSON.parse(await readFile(input, 'utf8')));
  // Exclusive creation: never replace an existing output, including symlinks.
  await mkdir(output);
  for (const [name, body] of Object.entries(files)) await writeFile(path.join(output, name), body, { flag: 'wx' });
  console.log(JSON.stringify({ status: 'compiled', output: path.resolve(output), files: Object.keys(files) }));
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch(e => { console.error(e.message); process.exitCode = 1; });
