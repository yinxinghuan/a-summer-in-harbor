/** Deterministic, local author fixtures. No HTTP/model/media/storage calls.
 * Transitions between authored scenes/time are marked as fixture operations,
 * not represented as UI play or proof of renderer/spatial admission. */
import {initial} from '../src/story/state';
import {rooms} from '../src/world/data';
import {ContentRegistry,snapPeaDefinition} from '../src/life/registry';
import {applyLife} from '../src/life/rules';
import {acceptedAnimals} from '../src/animals/art';
import {createAnimalRuntime} from '../src/animals/behavior';
import {gameAnimalContext} from '../src/animals/game';
import type {Admission,Command,LifeSave} from '../src/life/types';

const r=new ContentRegistry([snapPeaDefinition],new Set(['crop:snap-pea@1'])),ref=r.ref('crop:snap-pea');
function route(id:'a'|'b'|'c'){
 let s:LifeSave={...initial('en','b1-qa-route-'+id),scene:'grocery',position:rooms.grocery.spawn,known:['theo','dani'],flags:['key','unpacked'],visited:Object.keys(rooms)},n=0;const steps:any[]=[];
 const fixture=(scene:string,time=s.townMinutes!)=>{steps.push({kind:'author-fixture-transition',from:{scene:s.scene,minute:s.townMinutes},to:{scene,minute:time},meaning:'not a committed player travel/clock action; full UI/spatial and time passage remain B2'});s.scene=scene;s.position=rooms[scene].spawn;s.townMinutes=time};
 const doAction=(command:Command,extra:Partial<Admission>={})=>{
  const admission:Admission={scene:s.scene,target:['buy-seed','sell'].includes(command.verb)?'crop-counter':'qa-life-target',...('plot' in command?{plot:command.plot,cultivated:true}:{}),...(['accept-order','deliver-order'].includes(command.verb)?{resident:'theo' as const,premiseRead:true}:{}),...(command.verb==='share-dani'?{resident:'dani' as const,premiseRead:true}:{}),...(command.verb==='display-gift'?{displaySlot:command.slot}:{}),...extra};
  const out=applyLife(s,{actionId:'b1-qa-route-'+id+'-'+String(++n).padStart(6,'0'),expectedVersion:s.version,command},r,admission);s=out.head;s.version++;s.cursor++;steps.push({kind:'real-pure-rule-result',command,text:out.text,event:out.event,after:{cash:s.cash,energy:s.energy,minute:s.townMinutes,items:s.items,relations:s.relations}});
 };
 doAction({verb:'buy-seed',ref});fixture('garden');doAction({verb:'plant',ref,plot:'life-bed-1'});doAction({verb:'water',plot:'life-bed-1'});fixture('garden',s.townMinutes!+720);doAction({verb:'harvest',plot:'life-bed-1'});fixture(id==='a'?'cafe':'grocery',1980);
 if(id==='a'){doAction({verb:'accept-order',ref});doAction({verb:'deliver-order'});doAction({verb:'save-seed',ref})}
 if(id==='b'){doAction({verb:'save-seed',ref});doAction({verb:'sell',ref});doAction({verb:'sell',ref})}
 if(id==='c')for(let i=0;i<3;i++)doAction({verb:'sell',ref});
 const cropOutcome={cash:s.cash,seeds:s.items['life-seed:snap-pea']??0,produce:s.items['life-produce:snap-pea']??0,theoRelation:s.relations.theo??0,theoGift:s.items['life-gift:theo-menu']??0};
 if(id==='a'){
  for(const [scene,time,behavior] of [['station',1980,'sun-rest'],['courtyard',2740,'sleep']] as const){fixture(scene,time);const actual=createAnimalRuntime(acceptedAnimals).tick(0,gameAnimalContext(s,s.position)).find(a=>a.id==='harbor-cat-1')!;if(!actual.visible||actual.phase!==behavior)throw Error('FIXTURE_BEHAVIOR_MISMATCH');doAction({verb:'observe-animal',animal:actual.id,behavior},{animal:{id:actual.id,behavior,visualVersion:actual.visualVersion}})}
  fixture('garden',3420);doAction({verb:'share-dani'});fixture('home');doAction({verb:'display-gift',slot:'home-shelf-1',gift:'life-gift:theo-menu'});doAction({verb:'display-gift',slot:'home-shelf-2',gift:'life-gift:dani-page'});
 }
 return {id,cropOutcome,steps,final:{cash:s.cash,energy:s.energy,items:s.items,relations:s.relations,collections:s.lifeV1!.collections,display:s.lifeV1!.display}};
}
process.stdout.write(JSON.stringify({format:'harbor-life-b1-local-walkthrough-v1',integrationTarget:'f6e6be82ee10e6422892754a1fc624147e217c2c',status:'executed-local-rules-with-explicit-author-fixtures',productionMounted:false,newAssetAdmission:'HOLD',humanComprehension:'unverified',definition:snapPeaDefinition,ref,routes:['a','b','c'].map(id=>route(id as 'a'|'b'|'c'))},null,2)+'\n');
