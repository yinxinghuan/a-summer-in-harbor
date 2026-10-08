import {createHash} from 'node:crypto';
import {basilTemplate,mintNode,legacyMintNode,mintItem,dueMinute,mintStatus,plantUseVerbs,type PlantUsesSave,type PlantUseVerb} from '../src/life/plant-uses';
import {ContentRegistry} from '../src/life/registry';
import {pinLegacy,consumeLot,assertLifeReadable,giftItems,sameRef} from '../src/life/save';
import {advanceAwake} from '../src/story/fatigue';
import {battleLocksWorld} from '../src/story/turn-battle';
import type {Words} from '../src/world/data';

const hash=(v:unknown)=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
export const basilTemplateHash=hash(basilTemplate),mintDefinitionHash=hash(mintNode),legacyMintDefinitionHash=hash(legacyMintNode);
const ok=(c:unknown,e:string)=>{if(!c)throw Error(e)};
const int=(v:unknown,min=0,max=Number.MAX_SAFE_INTEGER)=>Number.isSafeInteger(v)&&(v as number)>=min&&(v as number)<=max;
const obj=(v:unknown):v is Record<string,any>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const keys=(v:Record<string,any>,allowed:string[])=>Object.keys(v).every(k=>allowed.includes(k));
const source=(v:unknown)=>typeof v==='string'&&v.length>0&&v.length<=120;
export function assertPlantUsesReadable(s:PlantUsesSave,r:ContentRegistry){
 assertLifeReadable(s,r);const p=s.plantUsesV1,now=s.townMinutes??540;
 if(p===undefined){ok(!(s.items[mintItem]??0),'UNSUPPORTED_PLANT_USES_SAVE');return}
 const bad='UNSUPPORTED_PLANT_USES_SAVE';
 ok(obj(p)&&keys(p,['schema','offerReadAt','offerReadSource','order','deliveries','mint'])&&p.schema===1&&int(p.deliveries),bad);
 ok((p.offerReadAt===undefined&&p.offerReadSource===undefined)||(int(p.offerReadAt,0,now)&&source(p.offerReadSource)),bad);
 if(p.order!==undefined){const o=p.order;ok(obj(o)&&Object.keys(o).sort().join(',')==='acceptedMinute,crop,dueMinute,id,quantity,reward,template,templateHash'&&source(o.id)&&o.template===basilTemplate.id&&o.templateHash===basilTemplateHash&&o.quantity===2&&o.reward===7&&int(o.acceptedMinute,0,now)&&o.dueMinute===dueMinute(o.acceptedMinute)&&!s.lifeV1?.order,bad);ok(obj(o.crop)&&Object.keys(o.crop).sort().join(',')==='capability,hash,id,revision'&&sameRef(o.crop,r.ref('crop:basil')),bad);}
 const m=p.mint;
 if(m===undefined){ok(!(s.items[mintItem]??0),bad);return}
 ok(obj(m)&&keys(m,['node','definitionHash','stock','recoverAt','observedAt','observationSource','leaves','firstLeafSource','lastLeafSource','archivedAt','archiveSource','sharedAt','shareSource'])&&m.node===mintNode.id&&[mintDefinitionHash,legacyMintDefinitionHash].includes(m.definitionHash)&&int(m.stock,1,2)&&((m.stock===2&&m.recoverAt===null)||(m.stock===1&&int(m.recoverAt,720,now+720)))&&int(m.leaves,0,99)&&m.leaves===(s.items[mintItem]??0),bad);
 for(const [t,k] of [['observedAt','observationSource'],['archivedAt','archiveSource'],['sharedAt','shareSource']] as const)ok((m[t]===undefined&&m[k]===undefined)||(int(m[t],0,now)&&source(m[k])),bad);
 ok((m.firstLeafSource===undefined&&m.lastLeafSource===undefined&&m.leaves===0)||(source(m.firstLeafSource)&&source(m.lastLeafSource)),bad);
 ok(m.archivedAt===undefined||m.firstLeafSource!==undefined,bad);ok(m.sharedAt===undefined||m.observedAt!==undefined,bad);
}
export function applyPlantUse(previous:PlantUsesSave,verb:PlantUseVerb,actionId:string,r:ContentRegistry,newStarts:boolean){
 ok(plantUseVerbs.includes(verb),'INVALID_PLANT_USE_COMMAND');ok(source(actionId),'INVALID_ACTION_ID');assertPlantUsesReadable(previous,r);ok(!previous.activeChallenge&&!battleLocksWorld(previous),'CHALLENGE_ACTIVE');
 const s=pinLegacy(previous,r) as PlantUsesSave;s.plantUsesV1??={schema:1,deliveries:0};const p=s.plantUsesV1,life=s.lifeV1!,now=s.townMinutes??540;
 let text:Words;
 if(verb==='read-offer'){ok(newStarts,'PLANT_USES_STARTS_CLOSED');p.offerReadAt??=now;p.offerReadSource??=actionId;text=['西奥的厨房需要两份罗勒，付$7。接单后截止后天17:00；也可以不接，去杂货铺每份卖$3。','Theo needs two basil portions for $7. Accepting makes them due by 17:00 the day after tomorrow. You can decline and sell at the grocer for $3 each.'];}
 else if(verb==='accept-basil'){ok(newStarts,'PLANT_USES_STARTS_CLOSED');ok(p.offerReadAt!==undefined,'ORDER_PREMISE_UNREAD');ok(!life.order&&!p.order,'ORDER_ACTIVE');ok(now>=life.cooldownUntil,'ORDER_COOLDOWN');p.order={id:actionId,template:'theo-basil-v1',templateHash:basilTemplateHash,crop:r.ref('crop:basil'),quantity:2,reward:7,acceptedMinute:now,dueMinute:dueMinute(now)};text=['接下两份罗勒的订单。后天17:00前，来咖啡馆当面交给西奥。','You accept the order for two basil portions. Deliver them to Theo at the café before 17:00 the day after tomorrow.'];}
 else if(verb==='deliver-basil'){const o=p.order;ok(o,'ORDER_MISSING');ok(now<o!.dueMinute,'ORDER_EXPIRED');ok(s.cash+o!.reward<=999,'PURSE_FULL');consumeLot(s,r,o!.crop,'produce',o!.quantity);s.cash+=o!.reward;delete p.order;p.deliveries++;life.cooldownUntil=now+basilTemplate.cooldownMinutes;
  if(!life.firstRewards.includes('theo-order-first')){ok(Object.keys(life.collections).length<64,'COLLECTION_CAPACITY');life.firstRewards.push('theo-order-first');s.relations.theo=Math.min(100,Math.max(-100,(s.relations.theo??0)+2));s.items[giftItems[0]]=1;life.collections['gift:'+giftItems[0]]={id:'gift:'+giftItems[0],sourceAction:actionId,minute:now};}
  text=['西奥收下两份罗勒，付了$7。他把这次供货记在厨房便条上，余下的收成由你安排。','Theo takes two basil portions and pays $7. He notes the delivery for the kitchen. The rest of your harvest is yours to use.'];}
 else if(verb==='close-basil'){ok(p.order,'ORDER_MISSING');ok(now>=p.order!.dueMinute,'ORDER_NOT_EXPIRED');delete p.order;life.cooldownUntil=now+basilTemplate.cooldownMinutes;text=['订单已经过期。罗勒仍在行囊，可以出售或留种。','The order expired. Your basil stays in your bag to sell or save for seed.'];}
 else if(verb==='recall-delivery'){ok(p.deliveries>0,'DELIVERY_MEMORY_MISSING');text=['“上次的罗勒已经用在厨房里了，谢谢。种下一轮之前，先想好自己要留多少。”','“Your last basil delivery went into the kitchen. Thank you. Before planting again, think about how much you want to keep.”'];}
 else {p.mint??={node:'harbor-mint-hill-1',definitionHash:mintDefinitionHash,stock:2,recoverAt:null,leaves:0};const m=p.mint,status=mintStatus(s);
  if(verb==='observe-mint'){ok(m.definitionHash===mintDefinitionHash&&newStarts,'PLANT_USES_STARTS_CLOSED');m.observedAt??=now;m.observationSource??=actionId;text=['观察已记下：这里只许少量采叶，保留株丛。采过后推进十二小时游戏时间，再回来看看。','You record the observation: take only a small amount of leaves and keep the clump. After collecting, return after twelve game hours.'];}
  else if(verb==='collect-mint'){ok(m.definitionHash===mintDefinitionHash&&newStarts,'PLANT_USES_STARTS_CLOSED');ok(status.stock>mintNode.stockFloor,'WILD_PLANT_RECOVERING');ok(m.leaves<99,'INVENTORY_FULL');ok(s.energy>=2,'REST_NEEDED');s.energy-=2;advanceAwake(s,10);s.townMinutes=now+10;m.stock=1;m.recoverAt=s.townMinutes+720;m.leaves++;m.firstLeafSource??=actionId;m.lastLeafSource=actionId;m.observedAt??=now;m.observationSource??=actionId;s.items[mintItem]=m.leaves;text=['采下一份叶，株丛保留着。叶片放进行囊；十二个游戏小时后可再采。','You take one portion of leaves and leave the clump. The leaves go into your bag. Collect again after twelve game hours.'];}
  else if(verb==='archive-mint'){ok(m.leaves>0,'ITEMS_MISSING');ok(m.archivedAt===undefined,'MINT_ALREADY_ARCHIVED');m.leaves--;if(m.leaves)s.items[mintItem]=m.leaves;else delete s.items[mintItem];m.archivedAt=now;m.archiveSource=actionId;text=['一份叶片收入你的生活记录，不再作为行囊实物；来源和观察会保留。','One portion of leaves goes into your notebook and leaves your bag. Its source and your observation remain.'];}
  else {ok(m.observedAt!==undefined,'DISCOVERIES_MISSING');ok(m.sharedAt===undefined,'MINT_ALREADY_SHARED');m.sharedAt=now;m.shareSource=actionId;s.relations.dani=Math.min(100,Math.max(-100,(s.relations.dani??0)+1));text=['丹妮听你讲过株丛和采集边界，给你的观察添了注释。她仍只收落叶，不向你索取活株。','Dani adds a note about the clump and its collection limits. She still saves fallen leaves and does not ask for a living plant.'];}
 }
 assertPlantUsesReadable(s,r);return {head:s,text};
}
