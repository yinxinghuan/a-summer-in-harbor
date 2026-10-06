import test from 'node:test';
import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {animalReviewAccepted,animalPresentation,renderAnimal,type AnimalArt} from '../src/animals/render-contract';
import {animalSheet} from '../src/animals/rpgjs-sheet';
import type {AnimalState} from '../src/animals/types';
const gates=['singleImage','family','targetScene','technical'] as const;
const accepted=()=>Object.fromEntries(gates.map(key=>[key,'accepted']));
const state={id:'synthetic-validator',species:'cat',visualVersion:'synthetic-validator-v1',scene:'station',visible:true,foot:{x:120,y:120},direction:'down',pose:'stand',phase:'idle',elevation:0} as AnimalState;
const frame={x:0,y:0,w:16,h:16,anchor:[.5,1],scale:1,sourceSha256:'0'.repeat(64),requestId:'synthetic-not-a-media-request',taskId:'synthetic-not-a-media-task'};
const base={species:'cat',visualVersion:state.visualVersion,image:'./synthetic-unloaded-fixture.png',atlas:{w:16,h:16},frames:Object.fromEntries(['stand','walkA','walkB','sun-rest','sleep'].map(p=>[p,Object.fromEntries(['down','left','right','up'].map(d=>[d,{...frame}]))]))};
test('review JSON is fail closed in render, sheet and atomic projection for all absent/invalid/failed gates',()=>{
 const cases:{name:string;review:unknown}[]=[{name:'missing',review:undefined},{name:'null',review:null},{name:'empty',review:{}},{name:'array',review:[]},{name:'string',review:'accepted'},{name:'boolean',review:true},{name:'inherited',review:Object.create(accepted())},{name:'extra field',review:{...accepted(),unknown:'accepted'}},{name:'symbol field',review:{...accepted(),[Symbol('unknown')]:'accepted'}},{name:'getter',review:Object.defineProperty(accepted(),'family',{get:()=>{throw Error('MUST_NOT_EVALUATE_ACCESSOR')}})}];
 for(const gate of gates){const missing=accepted();delete missing[gate];cases.push({name:'missing '+gate,review:missing});for(const value of ['hold','rejected','pass','unknown',undefined,null,0,true,{},[]])cases.push({name:gate+' invalid '+String(value),review:{...accepted(),[gate]:value}})}
 const results=cases.map(({name,review})=>{const art={...base,review} as AnimalArt;assert.equal(animalReviewAccepted(review),false,name);assert.equal(renderAnimal(state,art),null,name);assert.throws(()=>animalSheet(art),/ANIMAL_ART_NOT_ACCEPTED/,name);assert.deepEqual(animalPresentation([state],{[state.visualVersion]:art},'station'),{visuals:[],collisions:[],targets:[]},name);return {name,renderAccepted:false,sheetAccepted:false,visuals:0,collisions:0,targets:0}});
 writeFileSync(new URL('../doc/qa/animals-integration-20261006/review-gates-regression.json',import.meta.url),JSON.stringify({authority:'automated synthetic regression',fixture:'unloaded synthetic frame, no media calls',ownerReproductionIncluded:true,cases:results,caseCount:results.length},null,2)+'\n');
});
test('complete explicit accepted review passes, and valid hold/rejected never passes',()=>{
 const art={...base,review:accepted()} as AnimalArt;assert.equal(animalReviewAccepted(art.review),true);assert.ok(renderAnimal(state,art));assert.ok(animalSheet(art));assert.equal(animalPresentation([state],{[state.visualVersion]:art},'station').visuals.length,1);
 for(const decision of ['hold','rejected'])for(const gate of gates)assert.equal(animalReviewAccepted({...accepted(),[gate]:decision}),false);
 assert.equal(animalReviewAccepted(Object.assign(Object.create(null),accepted())),true);
});
