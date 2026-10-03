import test from 'node:test';import assert from 'node:assert/strict';
import {createPolicy,requestContext} from '../server/dynamic-assets/policy.mjs';
import {createRuntime} from '../server/runtime.ts';import {initial} from '../src/story/state.ts';
const owner='a'.repeat(64),sessionId='12345678-1234-1234-1234-123456789012';
test('QA exact two-new-journey gate, expiry, off, wrong owner and invalid config',()=>{
 let time=10000;const document={entries:[{owner,sessionId,enrollment:'asset-b-qa-test',createdAt:time,expiresAt:time+86400000}]};const p=createPolicy({mode:'qa',document,now:()=>time});assert.equal(p.enabled(owner,sessionId),true);assert.throws(()=>p.assert('b'.repeat(64),sessionId),/ASSET_QA_CLOSED/);assert.throws(()=>createPolicy({mode:'off',document}).assert(owner,sessionId),/ASSET_QA_CLOSED/);time+=86400000;assert.throws(()=>p.assert(owner,sessionId),/ASSET_QA_CLOSED/);assert.throws(()=>createPolicy({mode:'qa',document:{entries:[...document.entries,...document.entries]}}),/ASSET_QA_CONFIG/);
});
test('QA collision geometry does not change ordinary journey authority',()=>{
 const s=initial('en',sessionId);s.scene='home';const p={x:378,y:490};const runtime=createRuntime();assert.doesNotThrow(()=>runtime.position(s,p));requestContext.run({dynamicGeometry:true},()=>assert.throws(()=>runtime.position(s,p),/INVALID_POSITION/));assert.doesNotThrow(()=>runtime.position(s,p));
});
