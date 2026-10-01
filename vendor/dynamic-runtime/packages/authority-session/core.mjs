
import {AuthorityError as LabError} from './error.mjs';
const validId = (id)=>typeof id === 'string' && /^[a-zA-Z0-9-]{16,80}$/.test(id);
const wire = (v)=>JSON.parse(JSON.stringify(v));
const canonical = (v)=>Array.isArray(v) ? v.map(canonical) : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map((k)=>[
            k,
            canonical(v[k])
        ])) : v;
const digest = (v)=>JSON.stringify(canonical(v));
export class SessionAuthority {
    db;
    runtime;
    now;
    inFlight = new Map();
    constructor(db, runtime, now = Date.now, narrationPolicy = {windowMs:60000,turnsPerWindow:0}){
        this.db = db;
        this.narrationPolicy = narrationPolicy;
        this.runtime = runtime;
        this.now = now;
        db.run('CREATE TABLE IF NOT EXISTS prepared_actions(owner TEXT NOT NULL, action TEXT NOT NULL, session TEXT NOT NULL, digest TEXT NOT NULL, base TEXT NOT NULL, response TEXT NOT NULL, PRIMARY KEY(owner,action))');
        db.run('CREATE TABLE IF NOT EXISTS narration_usage(owner TEXT PRIMARY KEY, window_start INTEGER NOT NULL, uses INTEGER NOT NULL)');
        db.run('CREATE TABLE IF NOT EXISTS journeys(id TEXT PRIMARY KEY, owner TEXT NOT NULL, enrollment TEXT NOT NULL, enrollment_digest TEXT NOT NULL, data TEXT NOT NULL, cursor INTEGER NOT NULL DEFAULT 0, updated INTEGER NOT NULL, UNIQUE(owner,enrollment))');
        db.run('CREATE TABLE IF NOT EXISTS receipts(owner TEXT NOT NULL, action TEXT NOT NULL, digest TEXT NOT NULL, response TEXT NOT NULL, PRIMARY KEY(owner,action))');
        db.run('CREATE TABLE IF NOT EXISTS journal(session TEXT NOT NULL, cursor INTEGER NOT NULL, action TEXT NOT NULL, kind TEXT NOT NULL, event TEXT NOT NULL, PRIMARY KEY(session,cursor))');
    }
    row(owner, id) {
        const row = this.db.all('SELECT data,cursor FROM journeys WHERE owner=? AND id=?', owner, id)[0];
        if (!row) throw new LabError('SESSION_NOT_FOUND', 404);
        return row;
    }
    write(owner, h, cursor) {
        this.db.run('UPDATE journeys SET data=?,cursor=?,updated=? WHERE owner=? AND id=?', JSON.stringify(h), cursor, this.now(), owner, h.id);
    }
    get(owner, id) {
        return this.db.transaction(()=>{
            const row = this.row(owner, id), head = this.runtime.upgrade(JSON.parse(row.data));
            if (JSON.stringify(head) !== row.data) throw new LabError('MIGRATION_REQUIRED',409);
            return head;
        });
    }
    create(owner, enrollment, locale, options) {
        if (!validId(enrollment)) throw new LabError('INVALID_ENROLLMENT');
        const hash = digest(options === undefined ? {
            locale
        } : {
            locale,
            options
        });
        return this.db.transaction(()=>{
            const old = this.db.all('SELECT id,enrollment_digest FROM journeys WHERE owner=? AND enrollment=?', owner, enrollment)[0];
            if (old) {
                if (old.enrollment_digest !== hash) throw new LabError('ENROLLMENT_ID_CONFLICT', 409);
                return this.runtime.upgrade(JSON.parse(this.row(owner, old.id).data));
            }
            const sample = this.db.all('SELECT data,cursor FROM journeys LIMIT 1')[0];
            if (sample) this.runtime.assertReadable(JSON.parse(sample.data));
            const count = this.db.all('SELECT COUNT(*) AS n FROM journeys WHERE owner=?', owner)[0].n;
            if (count >= 100) throw new LabError('SESSION_LIMIT', 429);
            const head = wire(this.runtime.initial(locale, crypto.randomUUID(), options));
            this.db.run('INSERT INTO journeys VALUES(?,?,?,?,?,?,?)', head.id, owner, enrollment, hash, JSON.stringify(head), 0, this.now());
            return head;
        });
    }
    directory(owner) {
        return this.db.all('SELECT id,data,cursor,updated FROM journeys WHERE owner=? ORDER BY updated DESC LIMIT 100', owner).map((r)=>{
            const h = this.runtime.upgrade(JSON.parse(r.data));
            return {
                id: r.id,
                version: h.version,
                cursor: r.cursor,
                scene: this.runtime.scene(h),
                updated: r.updated
            };
        });
    }
    events(owner, id, after) {
        this.row(owner, id);
        if (!Number.isSafeInteger(after) || after < 0) throw new LabError('INVALID_CURSOR');
        return this.db.all('SELECT event FROM journal WHERE session=? AND cursor>? ORDER BY cursor LIMIT 100', id, after).map((r)=>JSON.parse(r.event));
    }
    checkpoint(owner, id, body) {
        return this.db.transaction(()=>{
            const row = this.row(owner, id), head = this.runtime.upgrade(JSON.parse(row.data));
            if (body?.sceneId !== this.runtime.scene(head) || body.expected_version !== head.version) throw new LabError('STALE_POSITION', 409);
            const context = this.runtime.spatialContext?.(head, body) ?? head;
            const position = this.runtime.position(context, body.position);
            context.position = position;
            this.write(owner, context, row.cursor);
            return {
                position
            };
        });
    }
    replay(owner, action, hash) {
        const r = this.db.all('SELECT digest,response FROM receipts WHERE owner=? AND action=?', owner, action)[0];
        if (!r) return null;
        if (r.digest !== hash) throw new LabError('ACTION_ID_CONFLICT', 409);
        return JSON.parse(r.response);
    }
    async action(owner, id, body) {
        return this.dispatch(owner, id, body, 'action');
    }
    async ending(owner, id, body) {
        return this.dispatch(owner, id, body, 'ending');
    }
    async dispatch(owner, id, body, operation) {
        if (operation === 'ending') {
            if (!this.runtime.ending) throw new LabError('ENDING_UNAVAILABLE', 503);
            this.runtime.ending.validate(body);
        } else this.runtime.validateAction(body);
        body = wire(body);
        const receiptId = operation === 'ending' ? 'ending:' + body.ending_id : body.action_id;
        const hash = digest(operation === 'ending' ? {
            id,
            body,
            operation
        } : {
            id,
            body
        }), cached = this.replay(owner, receiptId, hash);
        if (cached) return cached;
        const key = JSON.stringify([
            owner,
            receiptId
        ]), existing = this.inFlight.get(key);
        if (existing) {
            if (existing.hash !== hash) throw new LabError('ACTION_ID_CONFLICT', 409);
            return existing.promise;
        }
        const promise = this.prepareAndCommit(owner, id, body, hash, operation, receiptId);
        this.inFlight.set(key, {
            hash,
            promise
        });
        try {
            return await promise;
        } finally{
            if (this.inFlight.get(key)?.promise === promise) this.inFlight.delete(key);
        }
    }
    async prepareAction(owner, id, body) {
        this.runtime.validateAction(body);
        body = wire(body);
        const hash = digest({
            id,
            body
        }), cached = this.replay(owner, body.action_id, hash);
        if (cached) return {
            status: 'committed',
            result: cached
        };
        const old = this.db.all('SELECT digest,base,response FROM prepared_actions WHERE owner=? AND action=?', owner, body.action_id)[0];
        if (old) {
            if (old.digest !== hash) throw new LabError('ACTION_ID_CONFLICT', 409);
            const current = this.get(owner, id), base = JSON.parse(old.base);
            if (current.version !== base.version || current.mapVersion !== base.mapVersion) throw new LabError('VERSION_CONFLICT', 409);
            return {
                status: 'prepared',
                result: JSON.parse(old.response)
            };
        }
        const key = JSON.stringify([
            owner,
            'prepare:' + body.action_id
        ]), running = this.inFlight.get(key);
        if (running) {
            if (running.hash !== hash) throw new LabError('ACTION_ID_CONFLICT', 409);
            return running.promise;
        }
        const promise = (async ()=>{
            const head = this.get(owner, id);
            if (head.version !== body.expected_version) throw new LabError('VERSION_CONFLICT', 409);
            const count = this.db.all('SELECT COUNT(*) AS n FROM prepared_actions WHERE owner=?', owner)[0].n;
            if (count >= 32) throw new LabError('PREPARED_ACTION_LIMIT', 429);
            const response = await this.runtime.prepare(head, body, ()=>this.reserveNarration(owner));
            if (response.kind !== 'action' || response.accepted !== true || response.head.id !== id || response.head.version !== head.version + 1) throw new LabError('UNSUPPORTED_ACTION', 409);
            this.runtime.assertReadable(response.head);
            return this.db.transaction(()=>{
                const committed = this.replay(owner, body.action_id, hash);
                if (committed) return {
                    status: 'committed',
                    result: committed
                };
                const current = JSON.parse(this.row(owner, id).data);
                if (current.version !== head.version || current.mapVersion !== head.mapVersion) throw new LabError('VERSION_CONFLICT', 409);
                const raced = this.db.all('SELECT digest,response FROM prepared_actions WHERE owner=? AND action=?', owner, body.action_id)[0];
                if (raced) {
                    if (raced.digest !== hash) throw new LabError('ACTION_ID_CONFLICT', 409);
                    return {
                        status: 'prepared',
                        result: JSON.parse(raced.response)
                    };
                }
                if (this.db.all('SELECT COUNT(*) AS n FROM prepared_actions WHERE owner=?', owner)[0].n >= 32) throw new LabError('PREPARED_ACTION_LIMIT', 429);
                this.db.run('INSERT INTO prepared_actions VALUES(?,?,?,?,?,?)', owner, body.action_id, id, hash, JSON.stringify(head), JSON.stringify(response));
                return {
                    status: 'prepared',
                    result: wire(response)
                };
            });
        })();
        this.inFlight.set(key, {
            hash,
            promise
        });
        try {
            return await promise;
        } finally{
            if (this.inFlight.get(key)?.promise === promise) this.inFlight.delete(key);
        }
    }
    async commitPreparedAction(owner, id, body) {
        this.runtime.validateAction(body);
        body = wire(body);
        const hash = digest({
            id,
            body
        }), cached = this.replay(owner, body.action_id, hash);
        if (cached) return cached;
        const row = this.db.all('SELECT digest,base,response FROM prepared_actions WHERE owner=? AND action=?', owner, body.action_id)[0];
        if (!row) throw new LabError('ACTION_NOT_PREPARED', 409);
        if (row.digest !== hash) throw new LabError('ACTION_ID_CONFLICT', 409);
        return this.commitResponse(owner, id, body, hash, 'action', body.action_id, JSON.parse(row.base), JSON.parse(row.response), true);
    }
    reserveNarration(owner) {
        if(this.narrationPolicy.turnsPerWindow===0)return false;
        return this.db.transaction(()=>{
            const now = this.now(), old = this.db.all('SELECT window_start,uses FROM narration_usage WHERE owner=?', owner)[0];
            const active = old && now >= old.window_start && now - old.window_start < this.narrationPolicy.windowMs;
            if (active && old.uses >= this.narrationPolicy.turnsPerWindow) return false;
            this.db.run('INSERT INTO narration_usage(owner,window_start,uses) VALUES(?,?,?) ON CONFLICT(owner) DO UPDATE SET window_start=excluded.window_start,uses=excluded.uses', owner, active ? old.window_start : now, active ? old.uses + 1 : 1);
            return true;
        });
    }
    async prepareAndCommit(owner, id, body, hash, operation, receiptId) {
        const head = this.get(owner, id);
        if(head.version!==body.expected_version)throw new LabError('VERSION_CONFLICT',409);
        const response = operation === 'ending' ? await this.runtime.ending.prepare(head, body) : await this.runtime.prepare(head, body, ()=>this.reserveNarration(owner));
        return this.commitResponse(owner, id, body, hash, operation, receiptId, head, response);
    }
    commitResponse(owner, id, body, hash, operation, receiptId, head, response, prepared = false) {
        return this.db.transaction(()=>{
            const raced = this.replay(owner, receiptId, hash);
            if (raced) return raced;
            const row = this.row(owner, id), current = JSON.parse(row.data);
            this.runtime.assertReadable(current);
            if (current.mapVersion !== head.mapVersion) throw new LabError('JOURNEY_VERSION_UNSUPPORTED', 409);
            if (current.version !== head.version) throw new LabError('VERSION_CONFLICT', 409);
            if (response.head.id !== head.id || response.head.version !== head.version + 1) throw new LabError('INVALID_COMMIT_CANDIDATE', 409);
            this.runtime.assertReadable(response.head);
            if (operation === 'ending') {
                this.runtime.ending.assertCurrent(head, current);
                if (response.kind !== 'ending' || this.runtime.scene(response.head) !== this.runtime.scene(current)) throw new LabError('INVALID_COMMIT_CANDIDATE', 409);
                response.head.position = {
                    ...current.position
                };
            }
            if (prepared) this.runtime.assertPrepared?.(response.head, current, typeof response.actionId === 'string' ? response.actionId : undefined);
            this.runtime.preserveConcurrent(response.head, current);
            const cursor = row.cursor + (operation === 'ending' ? 0 : 1), result = wire({
                ...response,
                cursor
            }), event = {
                cursor,
                version: response.head.version,
                action_id: body.action_id,
                kind: response.kind
            };
            this.write(owner, response.head, cursor);
            if (operation === 'action') this.db.run('INSERT INTO journal VALUES(?,?,?,?,?)', id, cursor, body.action_id, response.kind, JSON.stringify(event));
            this.db.run('INSERT INTO receipts VALUES(?,?,?,?)', owner, receiptId, hash, JSON.stringify(result));
            this.db.run('DELETE FROM prepared_actions WHERE owner=? AND session=?', owner, id);
            return result;
        });
    }
}
