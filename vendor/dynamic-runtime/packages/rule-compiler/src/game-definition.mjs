import { validate, domainPatch, initialState, resolve } from './compile.mjs';

const fail = (where, message) => { throw new Error(`${where}: ${message}`); };
function object(v, keys, at, optional = []) {
  if (!v || typeof v !== 'object' || Array.isArray(v)) fail(at, 'expected object');
  for (const k of Object.keys(v)) if (!keys.includes(k) && !optional.includes(k)) fail(`${at}.${k}`, 'unsupported field');
  for (const k of keys) if (!Object.hasOwn(v, k)) fail(`${at}.${k}`, 'required');
}
function text(v, at, max = 4000) {
  if (typeof v !== 'string' || !v.trim() || v.length > max || /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(v)) fail(at, 'invalid text');
}
function bi(v, at) { object(v, ['zh','en'], at); text(v.zh, at); text(v.en, at); }
function list(v, at, min = 0, max = 32) { if (!Array.isArray(v) || v.length < min || v.length > max) fail(at, 'invalid list length'); }
function num(v, at, min, max, integral = true) {
  if (!Number.isFinite(v) || (integral && !Number.isInteger(v)) || v < min || v > max) fail(at, 'invalid numeric range');
}
const allowed = (v, values, at) => { if (!values.includes(v)) fail(at, 'unsupported value'); };
function texts(v, at, min, max) { list(v, at, min, max); v.forEach(x => bi(x, at)); }

/** Full cartridge shell configuration for a deliberately bounded stateful source export. */
export function validateGame(definition) {
  if (Buffer.byteLength(JSON.stringify(definition)) > 256 * 1024) fail('game', 'maximum 256 KiB');
  object(definition, ['format','rules','presentation','documents'], 'game');
  if (!['alteru-prolog-game-v1', 'alteru-prolog-game-v2'].includes(definition.format)) fail('format', 'unsupported');
  if ((definition.format === 'alteru-prolog-game-v1') !== (definition.rules.schemaVersion === 1)) fail('format', 'must match rules.schemaVersion');
  validate(definition.rules);
  const p = definition.presentation, r = definition.rules;
  object(p, ['mode','title','subtitle','promise','theme','stats','audio','assets','opening','characters','director','danger','transitionAnchor','sceneImageDirection','itemImageDirection'], 'presentation', ['observationTargets']);
  allowed(p.mode, ['stateful'], 'mode');
  for (const k of ['title','subtitle','promise','transitionAnchor']) bi(p[k], k);
  text(p.sceneImageDirection, 'sceneImageDirection'); text(p.itemImageDirection, 'itemImageDirection');
  object(p.assets, ['cover','entry','poster','notices'], 'assets');
  for (const k of ['cover','entry','poster']) if (typeof p.assets[k] !== 'string' || !/^[a-z0-9][a-z0-9-]{0,63}\.png$/.test(p.assets[k])) fail(`assets.${k}`, 'expected a plain PNG basename');
  if (new Set([p.assets.cover,p.assets.entry,p.assets.poster]).size !== 3) fail('assets', 'cover, entry and poster must be separate files');
  text(p.assets.notices, 'notices', 16000);
  object(p.theme, ['outer','surface','paper','ink','muted','accent','danger','gold','material'], 'theme');
  for (const [key,v] of Object.entries(p.theme)) if (key !== 'material' && !/^#[0-9a-f]{6}$/i.test(v)) fail('theme', 'hex colors required');
  allowed(p.theme.material, ['harbor','apartment','wayfarer'], 'material');
  list(p.stats, 'stat display metadata', 3, 3);
  if (new Set(p.stats.map(s=>s.id)).size !== 3) fail('stat metadata', 'duplicate id');
  for (const s of p.stats) {
    object(s, ['id','display','inverse','warningAt','dangerAt','maxDelta'], 'stat metadata');
    const def=r.stats.find(x=>x.id===s.id);
    if (!def) fail('stat metadata', 'unknown id');
    allowed(s.display, ['number','bar'], 'display');
    if (typeof s.inverse !== 'boolean') fail('inverse', 'explicit boolean required');
    num(s.warningAt, 'warningAt', def.min, def.max); num(s.dangerAt, 'dangerAt', def.min, def.max);num(s.maxDelta, 'maxDelta', 1, 999);
    if (s.inverse ? s.dangerAt>s.warningAt : s.dangerAt<s.warningAt) fail('stat thresholds','direction mismatch');
  }
  object(p.audio, ['bpm','rootHz','scale','levels'], 'audio');
  num(p.audio.bpm, 'bpm', 40, 180); num(p.audio.rootHz, 'rootHz', 40, 1000);
  list(p.audio.scale, 'scale', 3, 12); p.audio.scale.forEach(v => num(v, 'scale note', 0, 24));
  object(p.audio.levels, ['music','ambient','sfx','master'], 'levels');
  for (const [key,v] of Object.entries(p.audio.levels)) num(v, key, 0, key === 'sfx' ? 0.045 : key === 'master' ? 1 : 0.12, false);
  object(p.opening, ['time','objective','blocks','choices','imagePrompt'], 'opening');
  if (typeof p.opening.time !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(p.opening.time)) fail('opening.time', 'expected HH:MM');
  bi(p.opening.objective, 'objective'); text(p.opening.imagePrompt, 'imagePrompt'); texts(p.opening.blocks, 'blocks', 2, 4);
  list(p.opening.choices, 'choices', 1, 5);
  if (new Set(p.opening.choices).size !== p.opening.choices.length) fail('choices', 'duplicate');
  for (const id of p.opening.choices) if (!resolve(r, initialState(r), id).accepted) fail('opening.choices', `action ${id} is not initially feasible`);
  if (Object.hasOwn(p, 'observationTargets')) {
    list(p.observationTargets, 'observationTargets', 0, 32);
    const targetIds = new Set(), labels = {zh:new Set(),en:new Set()};
    for (const target of p.observationTargets) {
      const at = 'observationTargets';
      object(target, ['id','label','locationId','introducedBy','whileFacts'], at);
      if (typeof target.id !== 'string' || !/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(target.id) || target.id.length > 48
        || ['constructor','prototype'].includes(target.id) || targetIds.has(target.id)) fail(at, 'invalid/duplicate id');
      targetIds.add(target.id); bi(target.label, at);
      if (!r.locations.some(l=>l.id===target.locationId)) fail(at, 'unknown location');
      const intro=target.introducedBy;
      let visible;
      if (intro?.kind === 'opening') {
        object(intro,['kind','blockIndex'],at);
        num(intro.blockIndex,at,0,p.opening.blocks.length-1);
        if (target.locationId !== r.initialLocation) fail(at,'opening detail must be at initial location');
        visible=p.opening.blocks[intro.blockIndex];
      } else {
        object(intro,['kind','ruleId'],at); allowed(intro.kind,['rule'],at);
        visible=r.actions.find(a=>a.id===intro.ruleId)?.successText;
        if (!visible) fail(at,'unknown introduction rule');
      }
      for (const locale of ['zh','en']) {
        const label=target.label[locale];
        text(label,at,locale==='zh'?48:96);
        if (label !== label.trim() || /[\r\n\t\[\]<>]/.test(label) || labels[locale].has(label)) fail(at,'invalid/duplicate label');
        if (!visible[locale].includes(label)) fail(at,'label must occur in authored visible introduction');
        labels[locale].add(label);
      }
      list(target.whileFacts,at,0,16);
      const factIds=new Set();
      for (const condition of target.whileFacts) {
        object(condition,['id','equals'],at);
        const fact=r.facts.find(f=>f.id===condition.id);
        if (!fact || factIds.has(condition.id) || typeof fact.initial !== typeof condition.equals
          || !['boolean','number','string'].includes(typeof condition.equals)) fail(at,'unknown/duplicate or mismatched fact');
        if (typeof condition.equals==='number') num(condition.equals,at,-1000000,1000000);
        if (typeof condition.equals==='string') text(condition.equals,at,128);
        factIds.add(condition.id);
      }
    }
  }
  list(p.characters, 'characters', 0, 16);
  const ids = new Set(), names = {zh:new Set(),en:new Set()};
  for (const c of p.characters) {
    object(c, ['id','name','role','appearance','naming','intent','detail','lore','vitality','stress'], 'character');
    if (!/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(c.id) || c.id.length > 48 || ids.has(c.id) || ['constructor','prototype'].includes(c.id)) fail('character.id', 'invalid/duplicate');
    ids.add(c.id);
    for (const k of ['name','role','appearance','naming','intent','detail','lore']) bi(c[k], `character.${k}`);
    num(c.vitality, 'vitality', 0, 100); num(c.stress, 'stress', 0, 100);
    for (const locale of ['zh','en']) {
      if (names[locale].has(c.name[locale])) fail('character.name', 'duplicate');
      names[locale].add(c.name[locale]);
      if (!c.naming[locale].includes(c.name[locale])) fail('character.naming', 'must give the visible source of the name');
      if (c.appearance[locale].includes(c.name[locale]) || p.opening.blocks.some(b => b[locale].includes(c.name[locale]))) fail('character.debut', 'name used before naming beat');
    }
  }
  object(p.director, ['mode','fixedWorldRules','generationRules','choiceIntents','maxActiveThreads'], 'director');
  allowed(p.director.mode, ['guided','open-world'], 'director.mode');
  texts(p.director.fixedWorldRules, 'fixedWorldRules', 1, 16); texts(p.director.generationRules, 'generationRules', 1, 16); texts(p.director.choiceIntents, 'choiceIntents', 3, 3);
  num(p.director.maxActiveThreads, 'maxActiveThreads', 1, 5);
  const d = p.danger;
  object(d, ['minSafeTurns','maxSafeTurns','cooldownTurns','graceScenes','escalationStats','threatPalette','methods','physicalCombat','resolution'], 'danger');
  num(d.minSafeTurns, 'minSafeTurns', 1, 20); num(d.maxSafeTurns, 'maxSafeTurns', d.minSafeTurns, 20); num(d.cooldownTurns, 'cooldownTurns', 1, 20); num(d.graceScenes, 'graceScenes', 0, 20);
  list(d.escalationStats, 'escalationStats', 1, 3);
  for (const id of d.escalationStats) if (!r.stats.some(s => s.id === id)) fail('escalationStats', 'unknown stat');
  texts(d.threatPalette, 'threatPalette', 4, 16); texts(d.methods, 'methods', 3, 3);
  allowed(d.physicalCombat, ['none','rare','occasional'], 'physicalCombat');
  object(d.resolution, ['skill','modifier','dcBySeverity','fallbackCosts'], 'resolution'); bi(d.resolution.skill, 'skill');
  num(d.resolution.modifier, 'modifier', -10, 10); list(d.resolution.dcBySeverity, 'dcBySeverity', 5, 5);
  d.resolution.dcBySeverity.forEach((v,i,a) => { num(v, 'dc', 1, 30); if (i && v <= a[i-1]) fail('dc', 'must increase'); });
  list(d.resolution.fallbackCosts, 'fallbackCosts', 1, 3);
  for (const cost of d.resolution.fallbackCosts) {
    object(cost, ['statId','operation','amount'], 'cost');
    if (!r.stats.some(s => s.id === cost.statId)) fail('cost', 'unknown stat');
    allowed(cost.operation, ['add','remove'], 'cost.operation'); num(cost.amount, 'cost.amount', 1, 10);
  }
  object(definition.documents, ['requirements','visual'], 'documents');
  for (const [key,v] of Object.entries(definition.documents)) text(v, key, 32000);
  return definition;
}

export function makeCartridge(definition, locale) {
  validateGame(definition);
  const {rules:r,presentation:p} = definition, zh = locale === 'zh';
  allowed(locale, ['zh','en'], 'locale');
  const patch = domainPatch(r, locale);
  const localize = value => value[locale];
  return {
    schemaVersion:1, ...patch, statDefinitions:patch.statDefinitions.map(s=>({...s,...p.stats.find(m=>m.id===s.id)})), locale, coverImage:'./cover.png', entryImage:'./entry.png',
    copy:{title:localize(p.title),subtitle:localize(p.subtitle),promise:localize(p.promise), enter:zh?'进入故事':'Enter story', continue:zh?'继续旅程':'Continue', customAction:zh?'说说你想做什么':'What would you like to do?',itemImagingTitle:zh?'物品图鉴':'Item images',itemImagingBody:zh?'为已经获得的物品生成图像。':'Generate images for items you own.'},
    theme:p.theme, audioTheme:{material:p.theme.material,...p.audio,tension:[]},
    transitionAnchor:localize(p.transitionAnchor), sceneImageDirection:p.sceneImageDirection, itemImageDirection:p.itemImageDirection,
    director:{...p.director,fixedWorldRules:p.director.fixedWorldRules.map(localize),generationRules:p.director.generationRules.map(localize),choiceIntents:p.director.choiceIntents.map(localize)},
    dangerDirector:{...p.danger,threatPalette:p.danger.threatPalette.map(localize),methods:p.danger.methods.map(localize),resolution:{...p.danger.resolution,skill:localize(p.danger.resolution.skill)}},
    drawerLabels:zh?{party:'人物',map:'地图',inventory:'行囊',log:'记录'}:{party:'People',map:'Map',inventory:'Inventory',log:'Journal'},
    opening:{location:patch.initialMap.find(l=>l.current).label,time:p.opening.time,objective:localize(p.opening.objective),imagePrompt:p.opening.imagePrompt,
      blocks:[...p.opening.blocks.map(localize),...p.characters.flatMap(c=>[c.appearance,c.naming,c.intent].map(localize))].map((text,i)=>({id:`opening-${i}`,kind:'narration',text})),
      choices:p.opening.choices.map(id=>({id,label:r.actions.find(a=>a.id===id).label[locale]}))},
    characters:p.characters.map(c=>({id:c.id,name:localize(c.name),role:localize(c.role),detail:localize(c.detail),lore:localize(c.lore),vitality:c.vitality,stress:c.stress,skills:[],initialStatus:'known'})),
    initialPartyMemberIds:[],demoTurns:[],
    ...(p.observationTargets ? {compiledObservationTargets:p.observationTargets.map(target=>({
      ...target,label:localize(target.label),
    }))} : {}),
  };
}
