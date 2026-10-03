/** Pure selection policy. Library owns manifests/cache; job owner owns spending. */
export const POLICY_VERSION = 'asset-selection-v1';
const ID = /^[A-Za-z0-9_-]{1,96}$/;
const HASH = /^[a-f0-9]{64}$/;
const USES = ['background', 'story-photo', 'prop', 'tile', 'portrait', 'icon'];
const DEFAULTS = Object.freeze({purposeWeight:10, repeatWeight:2, diversityWeight:1,
  minPurposeMatches:0, recentWindow:24});
const identityFields = ['renditionId', 'assetId', 'revision', 'hash'];
const fail = code => { throw new Error(code); };
function exact(value, fields, required = fields) {
  if (!value || Object.getPrototypeOf(value) !== Object.prototype ||
      Object.keys(value).some(k => !fields.includes(k)) || required.some(k => !(k in value))) fail('INVALID_SELECTION_FIELDS');
}
function id(value) { if (typeof value !== 'string' || !ID.test(value)) fail('INVALID_SELECTION_ID'); }
function integer(value, min, max) {
  if (!Number.isSafeInteger(value) || value < min || value > max) fail('INVALID_SELECTION_NUMBER');
}
function tags(value, choices) {
  if (!Array.isArray(value) || value.length > 32 || new Set(value).size !== value.length) fail('INVALID_SELECTION_TAGS');
  value.forEach(id);
  if (choices && value.some(v => !choices.includes(v))) fail('INVALID_SELECTION_USAGE');
  return [...value].sort();
}
function pin(value) {
  identityFields.slice(0, 2).forEach(k => id(value[k]));
  integer(value.revision, 1, Number.MAX_SAFE_INTEGER);
  if (typeof value.hash !== 'string' || !HASH.test(value.hash)) fail('INVALID_SELECTION_HASH');
  return Object.fromEntries(identityFields.map(k => [k, value[k]]));
}
// Delimiters cannot occur in IDs. Revision is deliberately NOT "latest".
function identity(value) { const p = pin(value); return identityFields.map(k => p[k]).join(':'); }
function requestFields(value) {
  exact(value, ['gameId','worldId','roomId','slotId','itemId','category','orientation','usage',
    'dimensions','requiredTags','purposeTags']);
  ['gameId','worldId','roomId','slotId','itemId','category','orientation'].forEach(k => id(value[k]));
  if (!USES.includes(value.usage)) fail('INVALID_SELECTION_USAGE');
  const d = value.dimensions;
  exact(d, ['minWidth','maxWidth','minHeight','maxHeight']);
  Object.values(d).forEach(v => integer(v, 1, 16384));
  if (d.minWidth > d.maxWidth || d.minHeight > d.maxHeight) fail('INVALID_SELECTION_DIMENSIONS');
  return {...value, dimensions:{...d}, requiredTags:tags(value.requiredTags), purposeTags:tags(value.purposeTags)};
}
function policyFields(input) {
  exact(input, Object.keys(DEFAULTS), []);
  const result = {...DEFAULTS, ...input};
  ['purposeWeight','repeatWeight','diversityWeight'].forEach(k => integer(result[k], 0, 10000));
  integer(result.minPurposeMatches, 0, 32);
  integer(result.recentWindow, 0, 256);
  return Object.freeze(result);
}
function assessments(input) {
  if (!Array.isArray(input) || input.length > 4096) fail('INVALID_SELECTION_EVIDENCE');
  const result = new Map();
  for (const value of input) {
    exact(value, [...identityFields,'width','height','usages','tags','available']);
    const key = identity(value);
    if (result.has(key)) fail('DUPLICATE_SELECTION_EVIDENCE');
    integer(value.width, 1, 16384); integer(value.height, 1, 16384);
    if (typeof value.available !== 'boolean') fail('INVALID_SELECTION_AVAILABILITY');
    result.set(key, {...pin(value),width:value.width,height:value.height,
      usages:tags(value.usages, USES),tags:tags(value.tags),available:value.available});
  }
  return result;
}
function history(input, window) {
  if (!Array.isArray(input) || input.length > 4096) fail('INVALID_SELECTION_HISTORY');
  const result = input.map(value => {
    exact(value, [...identityFields,'itemId']); id(value.itemId);
    return {...pin(value),itemId:value.itemId};
  });
  // Input order is oldest -> newest, supplied by the authoritative usage journal.
  return window ? result.slice(-window) : [];
}
function authorizationFields(value, request, kind) {
  if (value === null) return {allowed:false,reason:'generation-not-authorized'};
  exact(value, ['authorizationId','gameId','worldId','roomId','allowedKinds','maxCalls',
    'usedCalls','reservedCalls','estimatedCalls','maxCostCny','usedCostCny','reservedCostCny','estimatedCallCostCny']);
  ['authorizationId','gameId','worldId','roomId'].forEach(k => id(value[k]));
  if (!Array.isArray(value.allowedKinds) || !value.allowedKinds.length ||
      new Set(value.allowedKinds).size !== value.allowedKinds.length ||
      value.allowedKinds.some(k => !['variant','new'].includes(k))) fail('INVALID_GENERATION_AUTHORIZATION');
  ['maxCalls','usedCalls','reservedCalls'].forEach(k => integer(value[k], 0, 1000000));
  integer(value.estimatedCalls, 1, 1000000);
  for (const key of ['maxCostCny','usedCostCny','reservedCostCny','estimatedCallCostCny']) {
    if (typeof value[key] !== 'number' || !Number.isFinite(value[key]) || value[key] < 0 || value[key] > 1000000) fail('INVALID_GENERATION_BUDGET');
  }
  if (['gameId','worldId','roomId'].some(k => value[k] !== request[k]) || !value.allowedKinds.includes(kind)) {
    return {allowed:false,reason:'generation-outside-authorization'};
  }
  if (value.usedCalls + value.reservedCalls + value.estimatedCalls > value.maxCalls ||
      value.usedCostCny + value.reservedCostCny + value.estimatedCallCostCny * value.estimatedCalls > value.maxCostCny) {
    return {allowed:false,reason:'generation-budget-exhausted'};
  }
  return {allowed:true,authorizationId:value.authorizationId,
    estimatedCalls:value.estimatedCalls,estimatedCostCny:value.estimatedCallCostCny * value.estimatedCalls,requiresAtomicReservation:true};
}

/** contract is trusted library core; evidence/history/authorization are trusted adapters,
 * never fields accepted from a model. No callbacks that generate or write are accepted. */
export function createAssetSelector({contract, policy = {}}) {
  for (const name of ['canonical','digest','verifyProfile','rendition','queryRenditions','roomManifest','verifyRoom']) {
    if (typeof contract?.[name] !== 'function') fail('ASSET_LIBRARY_CONTRACT_REQUIRED');
  }
  const config = policyFields(policy);
  const clone = value => JSON.parse(contract.canonical(value));
  const hashPolicy = () => contract.digest({version:POLICY_VERSION,config});

  async function context({profile, request, catalog, evidence, recent = []}) {
    const checkedProfile = await contract.verifyProfile(profile);
    const checkedRequest = requestFields(request);
    if (!Array.isArray(catalog) || catalog.length > 4096) fail('INVALID_SELECTION_CATALOG');
    const rows = catalog.map(contract.rendition);
    if (new Set(rows.map(identity)).size !== rows.length) fail('DUPLICATE_SELECTION_CATALOG');
    return {profile:checkedProfile,request:checkedRequest,rows,evidence:assessments(evidence),
      recent:history(recent,config.recentWindow),policyHash:await hashPolicy(),
      requestHash:await contract.digest({profile:checkedProfile,request:checkedRequest})};
  }

  function evaluate(row, c) {
    const r = c.request, p = c.profile;
    if (row.styleFamilyId !== p.styleFamilyId || row.profileId !== p.profileId ||
        row.profileVersion !== p.version || row.profileHash !== p.hash) return {rejection:'profile-incompatible'};
    if (row.itemId !== r.itemId || row.category !== r.category) return {rejection:'semantic-mismatch'};
    if (row.status !== 'published') return {rejection:'not-published'};
    // Delegate eligibility semantics to the library, do not parallel its approval implementation.
    if (!contract.queryRenditions([row], p).length) return {rejection:'license-or-quality-unapproved'};
    const e = c.evidence.get(identity(row));
    if (!e) return {rejection:'trusted-evidence-missing'};
    if (!e.available) return {rejection:'asset-unavailable'};
    if (!e.usages.includes(r.usage)) return {rejection:'usage-mismatch'};
    const d = r.dimensions;
    if (e.width < d.minWidth || e.width > d.maxWidth || e.height < d.minHeight || e.height > d.maxHeight) return {rejection:'dimensions-mismatch'};
    if (r.requiredTags.some(tag => !e.tags.includes(tag))) return {rejection:'required-purpose-missing'};
    const purposeMatches = r.purposeTags.filter(tag => e.tags.includes(tag)).length;
    if (purposeMatches < config.minPurposeMatches) return {rejection:'purpose-insufficient'};
    const repeatCount = c.recent.filter(h => identity(h) === identity(row)).length;
    const differentRecent = c.recent.filter(h => h.itemId === row.itemId && identity(h) !== identity(row)).length;
    const diversityBonus = differentRecent ? 1 : 0;
    const score = purposeMatches * config.purposeWeight - repeatCount * config.repeatWeight + diversityBonus * config.diversityWeight;
    return {evaluation:{purposeMatches,repeatCount,diversityBonus,score}};
  }

  async function seal(body) {
    const clean = clone(body);
    return {...clean,hash:await contract.digest(clean)};
  }

  async function select(input) {
    exact(input, ['profile','request','catalog','evidence','recent','authorization'],
      ['profile','request','catalog','evidence']);
    const c = await context(input), matching = [], bases = [], rejections = {};
    for (const row of c.rows) {
      const result = evaluate(row, c);
      if (result.rejection) { rejections[result.rejection] = (rejections[result.rejection] ?? 0) + 1; continue; }
      const item = {row,evaluation:result.evaluation,evidenceHash:await contract.digest(c.evidence.get(identity(row)))};
      if (row.orientation === c.request.orientation) matching.push(item);
      else { bases.push(item); rejections['orientation-missing'] = (rejections['orientation-missing'] ?? 0) + 1; }
    }
    const sort = list => list.sort((a,b) => b.evaluation.score - a.evaluation.score ||
      (identity(a.row) < identity(b.row) ? -1 : identity(a.row) > identity(b.row) ? 1 : 0));
    const common = {schemaVersion:1,policyVersion:POLICY_VERSION,policyHash:c.policyHash,
      requestHash:c.requestHash,profile:c.profile,request:c.request,rejections};
    if (matching.length) {
      const best = sort(matching)[0];
      return seal({...common,kind:'reuse',reason:'compatible-approved-reuse',pin:pin(best.row),
        evidenceHash:best.evidenceHash,evaluation:best.evaluation});
    }
    const kind = bases.length ? 'variant' : 'new';
    const permission = authorizationFields(input.authorization ?? null, c.request, kind);
    if (!permission.allowed) return seal({...common,kind:'unavailable',reason:permission.reason,
      next:'verified-packaged-fallback-or-explicit-authorization'});
    const base = bases.length ? sort(bases)[0] : null;
    return seal({...common,kind:base ? 'variant-plan' : 'generation-plan',
      reason:base ? 'approved-item-missing-orientation' : 'no-approved-compatible-item',
      basePin:base ? pin(base.row) : null,authorization:permission,
      execution:'plan-only',outputStatus:'candidate',requiresLibraryApproval:true});
  }

  async function restore({record,profile,request,catalog,evidence}) {
    exact(record, ['schemaVersion','policyVersion','policyHash','requestHash','profile','request',
      'rejections','kind','reason','pin','evidenceHash','evaluation','hash']);
    const {hash,...body} = record;
    if (await contract.digest(body) !== hash) fail('SELECTION_RECORD_INTEGRITY');
    if (record.schemaVersion !== 1 || record.policyVersion !== POLICY_VERSION || record.kind !== 'reuse') fail('SELECTION_RECORD_NOT_REUSABLE');
    exact(record.pin,identityFields);
    exact(record.evaluation,['purposeMatches','repeatCount','diversityBonus','score']);
    const c = await context({profile,request,catalog,evidence});
    if (record.policyHash !== c.policyHash || record.requestHash !== c.requestHash ||
        contract.canonical(record.profile) !== contract.canonical(c.profile) ||
        contract.canonical(record.request) !== contract.canonical(c.request)) fail('SELECTION_RECORD_BINDING');
    const row = c.rows.find(r => identity(r) === identity(record.pin));
    const result = row ? evaluate(row,c) : {rejection:'pinned-version-missing'};
    if (!row || result.rejection || row.orientation !== c.request.orientation) {
      return {kind:'unavailable',reason:result.rejection ?? 'pinned-orientation-mismatch',
        next:'verified-packaged-fallback',originalRecord:clone(record)};
    }
    if (await contract.digest(c.evidence.get(identity(row))) !== record.evidenceHash) {
      return {kind:'unavailable',reason:'pinned-evidence-changed',next:'verified-packaged-fallback',originalRecord:clone(record)};
    }
    // Saved evaluation/history are intentionally not recalculated on resume.
    return {kind:'reuse',reason:'restored-exact-pin',record:clone(record),rendition:clone(row)};
  }

  async function lockRoom({roomId,profile,layout,records,catalog,evidence}) {
    id(roomId);
    if (!Array.isArray(records) || records.length > 128) fail('INVALID_ROOM_SELECTIONS');
    const bySlot = new Map(); let scope;
    for (const record of records) {
      const recovered = await restore({record,profile,request:record.request,catalog,evidence});
      if (recovered.kind !== 'reuse') fail('ROOM_SELECTION_UNAVAILABLE');
      const r = record.request;
      if (r.roomId !== roomId || bySlot.has(r.slotId)) fail('ROOM_SELECTION_SCOPE');
      const key = `${r.gameId}:${r.worldId}`;
      if (scope !== undefined && key !== scope) fail('ROOM_SELECTION_SCOPE');
      scope = key; bySlot.set(r.slotId, record);
    }
    if (!Array.isArray(layout?.placements) || layout.placements.length !== records.length) fail('ROOM_SELECTION_LAYOUT');
    for (const p of layout.placements) {
      const r = bySlot.get(p.slotId)?.request;
      if (!r || r.itemId !== p.itemId || r.orientation !== p.orientation) fail('ROOM_SELECTION_LAYOUT');
    }
    // Library core must support exact placement pins (not catalog-wide uniqueness).
    const manifest = await contract.roomManifest({roomId,profile,layout,catalog,
      pins:records.map(record => ({slotId:record.request.slotId,...record.pin}))});
    // Detect older cores that ignored pins rather than accepting another selection.
    for (const asset of manifest.assets) {
      if (identity(asset) !== identity(bySlot.get(asset.slotId).pin)) fail('LIBRARY_PLACEMENT_PIN_UNSUPPORTED');
    }
    return contract.verifyRoom(manifest,catalog);
  }
  return Object.freeze({select,restore,lockRoom,policy:config,policyVersion:POLICY_VERSION});
}
