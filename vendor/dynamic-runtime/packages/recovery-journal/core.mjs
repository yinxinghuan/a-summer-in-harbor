const randomId=()=>globalThis.crypto.randomUUID();
const pendingId = (p)=>p.operation === 'ending' ? 'ending:' + p.body.ending_id : p.body.action_id;
const terminal = new Set([
    'VERSION_CONFLICT',
    'OFF_SCENE_ENTITY',
    'INVALID_ACTION',
    'UNKNOWN_ENTITY',
    'INVALID_POSITION',
    'TOO_FAR',
    'UNSUPPORTED_ACTION',
    'INVALID_TEXT',
    'INVALID_ACTION_TYPE',
    'INVALID_NARRATION_MODE',
    'ACTION_ID_CONFLICT'
]);
const idPattern = /^[a-zA-Z0-9-]{16,80}$/;
function parsePending(raw) {
    const p = JSON.parse(raw);
    if (!p || !idPattern.test(p.id) || !p.body || p.operation !== undefined && p.operation !== 'ending' && p.operation !== 'prepared-action' || !idPattern.test(p.operation === 'ending' ? p.body.ending_id : p.body.action_id) || !Number.isSafeInteger(p.body.expected_version) || typeof p.body.sceneId !== 'string' || p.operation === 'ending' && (typeof p.body.snapshot_id !== 'string' || typeof p.body.mapVersion !== 'string')) throw Error('INVALID_PENDING');
    return p;
}
export class RecoverableSessionClient {
    storage;
    prefix;
    transport;
    policy;
    lock;
    constructor(storage, prefix, transport, policy, lock = async (_name, work)=>work()){
        this.storage = storage;
        this.prefix = prefix;
        this.transport = transport;
        this.policy = policy;
        this.lock = lock;
    }
    head(value, expectedId) {
        this.policy.assertHead(value);
        const h = value;
        if (!idPattern.test(h.id) || !Number.isSafeInteger(h.version) || h.version < 0 || expectedId !== undefined && h.id !== expectedId) throw Error('SESSION_RESPONSE_MISMATCH');
        return h;
    }
    assertSelected(id) {
        const current = this.read('session', '');
        if (current && current !== id) throw Error('SESSION_SELECTION_CHANGED');
    }
    async get(id) {
        return this.head(await this.transport('/sessions/' + id), id);
    }
    key(name) {
        return this.prefix + name;
    }
    read(name, fallback) {
        const raw = this.storage.getItem(this.key(name));
        return raw === null ? fallback : JSON.parse(raw);
    }
    write(name, value) {
        this.storage.setItem(this.key(name), JSON.stringify(value));
    }
    quarantine(key, raw) {
        this.storage.setItem(this.key('quarantine:' + randomId()), raw);
        if (this.storage.getItem(key) === raw) this.storage.removeItem(key);
    }
    pending() {
        const legacyKey = this.key('pending'), legacy = this.storage.getItem(legacyKey);
        if (legacy && legacy !== 'null') {
            let p;
            try {
                p = parsePending(legacy);
            } catch  {
                this.quarantine(legacyKey, legacy);
            }
            if (p) {
                this.put(p);
                if (this.storage.getItem(legacyKey) === legacy) this.storage.removeItem(legacyKey);
            }
        }
        const prefix = this.key('pending-v2:'), keys = Array.from({
            length: this.storage.length
        }, (_, i)=>this.storage.key(i)).filter((k)=>Boolean(k?.startsWith(prefix))), items = [];
        for (const key of keys){
            const raw = this.storage.getItem(key);
            if (!raw) continue;
            try {
                const p = parsePending(raw);
                if (key !== prefix + pendingId(p)) throw Error('KEY_MISMATCH');
                items.push(p);
            } catch  {
                this.quarantine(key, raw);
            }
        }
        return items;
    }
    put(p) {
        const key = this.key('pending-v2:' + pendingId(p)), raw = JSON.stringify(p), old = this.storage.getItem(key);
        if (old && old !== raw) throw Error('PENDING_ID_CONFLICT');
        this.storage.setItem(key, raw);
    }
    rememberRejection(p, code) {
        const key = this.key('pending-v2:' + pendingId(p));
        if (this.storage.getItem(key) !== JSON.stringify(p)) throw Error('PENDING_ID_CONFLICT');
        p.confirmedRejection = code;
        this.storage.setItem(key, JSON.stringify(p));
    }
    ack(p) {
        const key = this.key('pending-v2:' + pendingId(p));
        if (this.storage.getItem(key) === JSON.stringify(p)) this.storage.removeItem(key);
    }
    hasPending() {
        const session = this.read('session', '');
        return this.pending().some((p)=>p.id === session);
    }
    async enroll(locale, restart = false, options) {
        return this.lock(this.key('bootstrap'), async ()=>{
            const current = this.read('session', '');
            const work = async ()=>{
                if (restart && this.pending().length) throw Error('PENDING_ACTION');
                let pending = this.read('enrollment-pending', null);
                if (current && !restart && !pending) return this.get(current);
                if (!current && !restart && !pending && this.policy.resumeFromDirectory) {
                    const pendingIds = [
                        ...new Set(this.pending().map((p)=>p.id))
                    ];
                    if (pendingIds.length > 1) throw Error('SESSION_SELECTION_REQUIRED');
                    let id = pendingIds[0];
                    if (!id) {
                        const directory = await this.transport('/sessions');
                        if (!directory || !Array.isArray(directory.sessions) || directory.sessions.some((row)=>!row || !idPattern.test(row.id) || !Number.isFinite(row.updated))) throw Error('INVALID_SESSION_DIRECTORY');
                        id = [
                            ...directory.sessions
                        ].sort((a, b)=>b.updated - a.updated)[0]?.id;
                    }
                    if (id) {
                        const restored = await this.get(id);
                        this.write('session', restored.id);
                        return restored;
                    }
                }
                if (!pending) {
                    pending = !current && !restart ? this.read('enrollment-request', null) : null;
                    pending ??= {
                        enrollment_id: restart ? randomId() : this.read('enrollment', '') || randomId(),
                        locale,
                        ...options === undefined ? {} : {
                            options
                        }
                    };
                    this.write('enrollment-pending', pending);
                    this.write('enrollment-request', pending);
                    this.write('enrollment', pending.enrollment_id);
                }
                let response;
                try {
                    response = await this.transport('/sessions', pending);
                } catch (e) {
                    if (restart && e instanceof Error && [
                        'SESSION_LIMIT',
                        'CAMPAIGN_NOT_AVAILABLE'
                    ].includes(e.message)) {
                        this.write('enrollment-pending', null);
                        this.write('enrollment-request', null);
                    }
                    throw e;
                }
                const head = this.head(response);
                this.write('session', head.id);
                this.write('enrollment-pending', null);
                return head;
            };
            return restart ? this.lock(this.key('session:' + current), work) : work();
        });
    }
    async settle(p) {
        let result, rejected = false;
        const ending = p.operation === 'ending';
        if (ending && !this.policy.ending) throw Error('ENDING_UNAVAILABLE');
        const isTerminal = (code)=>terminal.has(code) || (ending ? this.policy.ending?.terminalErrors : this.policy.terminalErrors)?.includes(code);
        const refusal = (code)=>({
                kind: 'recovered',
                text: null,
                accepted: false,
                rejectionCode: code
            });
        if (p.confirmedRejection !== undefined) {
            if (typeof p.confirmedRejection !== 'string' || !isTerminal(p.confirmedRejection)) throw Error('INVALID_PENDING');
            rejected = true;
            result = refusal(p.confirmedRejection);
        } else {
            try {
                if (p.operation === 'prepared-action') {
                    const policy = this.policy.preparedAction;
                    if (!policy) throw Error('PREPARED_ACTION_UNAVAILABLE');
                    const plan = await this.transport('/sessions/' + p.id + '/prepare-action', p.body);
                    policy.assertPlan(plan, p.body, p.id);
                    if (plan.status !== 'committed') await policy.ready(plan);
                    result = await this.transport('/sessions/' + p.id + '/commit-action', p.body);
                } else result = await this.transport('/sessions/' + p.id + (ending ? '/ending' : '/actions'), p.body);
            } catch (e) {
                if (!(e instanceof Error) || !isTerminal(e.message)) throw e;
                this.rememberRejection(p, e.message);
                rejected = true;
                result = refusal(e.message);
            }
        }
        if (ending && !rejected) this.policy.ending.assertResult(result, p.body);
        if (result.head) this.head(result.head, p.id);
        const latest = await this.get(p.id);
        if (latest.version < p.body.expected_version || result.head && latest.version < result.head.version) throw Error('SESSION_RESPONSE_REGRESSED');
        if (result.head && latest.version === result.head.version && this.policy.scene(latest) !== this.policy.scene(result.head)) throw Error('SESSION_RESPONSE_MISMATCH');
        if (ending && !rejected && latest.version === result.head.version) this.policy.ending.assertResult({
            ...result,
            head: latest
        }, p.body);
        if (!result.head || latest.version !== result.head.version) result = {
            kind: 'recovered',
            text: null,
            accepted: false,
            ...result.rejectionCode ? {
                rejectionCode: result.rejectionCode
            } : {}
        };
        this.ack(p);
        return {
            ...result,
            head: latest
        };
    }
    async selectSession(id) {
        if (!idPattern.test(id)) throw Error('INVALID_SESSION_ID');
        return this.lock(this.key('bootstrap'), async ()=>{
            const current = this.read('session', '');
            return this.lock(this.key('session:' + current), async ()=>{
                if (this.pending().length || this.read('enrollment-pending', null)) throw Error('PENDING_ACTION');
                const selected = await this.get(id);
                this.write('session', selected.id);
                return selected;
            });
        });
    }
    async send(head, body) {
        return this.lock(this.key('session:' + head.id), async ()=>{
            this.head(head);
            this.assertSelected(head.id);
            if (this.pending().some((p)=>p.id === head.id)) throw Error('PENDING_ACTION');
            const p = {
                id: head.id,
                body: {
                    ...body,
                    sceneId: this.policy.scene(head),
                    action_id: randomId(),
                    expected_version: head.version
                }
            };
            this.put(p);
            return this.settle(p);
        });
    }
    async sendPrepared(head, body) {
        return this.lock(this.key('session:' + head.id), async ()=>{
            this.head(head);
            this.assertSelected(head.id);
            if (!this.policy.preparedAction) throw Error('PREPARED_ACTION_UNAVAILABLE');
            if (this.pending().some((p)=>p.id === head.id)) throw Error('PENDING_ACTION');
            const p = {
                id: head.id,
                operation: 'prepared-action',
                body: {
                    ...body,
                    sceneId: this.policy.scene(head),
                    action_id: randomId(),
                    expected_version: head.version
                }
            };
            this.put(p);
            return this.settle(p);
        });
    }
    async sendEnding(head) {
        return this.lock(this.key('session:' + head.id), async ()=>{
            this.head(head);
            this.assertSelected(head.id);
            if (!this.policy.ending) throw Error('ENDING_UNAVAILABLE');
            if (this.pending().some((p)=>p.id === head.id)) throw Error('PENDING_ACTION');
            const p = {
                id: head.id,
                operation: 'ending',
                body: {
                    ...this.policy.ending.request(head),
                    sceneId: this.policy.scene(head),
                    ending_id: randomId(),
                    expected_version: head.version
                }
            };
            this.put(p);
            return this.settle(p);
        });
    }
    async recover() {
        const session = this.read('session', '');
        if (!session) return null;
        return this.lock(this.key('session:' + session), async ()=>{
            this.assertSelected(session);
            let result = {
                head: await this.get(session),
                kind: 'recovered',
                text: null,
                accepted: false
            };
            for (const p of this.pending().filter((p)=>p.id === session))result = await this.settle(p);
            return result;
        });
    }
}
