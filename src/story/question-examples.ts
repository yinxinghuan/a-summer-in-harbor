import {lifeExamples} from './resident-life';
import {residentHere} from '../world/residents';
import {rooms,tx,type Locale,type Words} from '../world/data';
import type {Save} from './state';
import {questProgress} from './progress';

type Example={id:string;words:Words};
const example=(id:string,zh:string,en:string):Example=>({id,words:[zh,en]});
const fallback=[
 example('place','你最喜欢这里的什么？','What do you like most about this place?'),
 example('day','你今天过得怎么样？','How is your day going?'),
];

// Presentation only: use committed, introduced facts, never model-generated instructions.
// Completion outranks old topic keys and missing consumed items (same as authored dialogue).
export function questionExamples(save:Save,person:string,locale:Locale){
 const q=questProgress(save),has=(flag:string)=>save.flags.includes(flag);
 const local=residentHere(save,person,save.scene)&&save.known.includes(person)&&rooms[save.scene]?.entities.some(e=>e.person===person);
 let options:Example[]=[];
 if(local)switch(person){
  case 'mara':
   if(q.arrival==='awaiting-key')options.push(example('mara-key','我刚到这里，能先告诉我住处在哪里吗？','I have just arrived. Could you tell me where my room is?'));
   else if(q.arrival==='key-collected')options.push(example('mara-room','拿到钥匙了，我该往哪边走？','I have the key. Which way is my room?'));
   else if(q.toolbag==='returned')options.push(example('mara-returned','工具袋已经交还了。你平时喜欢去哪里散步？','Now that your tool bag is back, where do you like to walk?'));
   else if(q.toolbag==='carried')options.push(example('mara-carried','工具袋我带回来了。你平时会用它修些什么？','I brought your tool bag back. What do you usually mend with it?'));
   else if(q.toolbag==='requested')options.push(example('mara-requested','你说的咖啡馆怎么走？','Which way is the café you mentioned?'));
   else options.push(example('mara-settled','行李放好了。想慢慢熟悉小镇，你有什么建议？','I have unpacked. How would you suggest getting to know the town?'));
   options.push(example('mara-summer','在这里过夏天，有什么让你一直很喜欢的小事？','What small thing do you always enjoy about summers here?'));break;
  case 'theo':
   if(q.terrace==='repaired')options.push(example('theo-fixed','露台灯修好了，你打算怎样布置今晚的露台？','The lantern is fixed. How will you set up the terrace tonight?'));
   else if(has('talk:theo:repair'))options.push(example('theo-repair','检查露台灯之前，有什么要留意的？','What should I look out for before checking the terrace lantern?'));
   else if(q.toolbag==='returned')options.push(example('theo-returned','工具袋已经交给玛拉了。店里什么时候比较清静？','Mara has her tool bag back. When is the café usually quiet?'));
   else options.push(example('theo-cafe','你最喜欢这家咖啡馆一天中的哪个时候？','What is your favorite time of day at the café?'));
   options.push(example('theo-food','今天有什么吃的值得一试？','What would you recommend trying here today?'));break;
  case 'june':
   if(q.bridge==='repaired')options.push(example('june-fixed','小桥修好了，以后怎么照看那些桥板？','The bridge is repaired. How should we look after the new boards?'));
   else if(q.bridge==='inspected')options.push(example('june-damage','我看过小桥的损坏处了，修理前应该先检查什么？','I have seen the damaged bridge. What should I check before repairs?'));
   else options.push(example('june-work','镇上最常送来修的是什么东西？','What do people in town most often bring in for repair?'));
   options.push(example('june-learning','我不太懂修理，新手可以从哪里学起？','I am new to repairs. What is a good place to start learning?'));break;
  case 'idris':options=[example('idris-first','第一次练习，怎样才能不太紧张？','How can I feel less nervous about my first practice?'),example('idris-safe','练习的时候，什么时候应该停下来歇一歇？','When should I stop for a break during practice?')];break;
  case 'ruth':options=[example('ruth-line','怎么分辨鱼在咬钩，还是水在晃？','How can I tell a bite from the movement of the water?'),example('ruth-pier','你喜欢在码头待到什么时候？','What time do you like to stay at the pier until?')];break;
  case 'luis':options=[example('luis-snack','想带点吃的出去散步，你会推荐什么？','What snack would you recommend taking on a walk?'),example('luis-local','附近居民最常来买些什么？','What do your neighbors usually come in for?')];break;
  case 'nell':options=[q.trail==='mapped'?example('nell-mapped','我找到了那条公共小路，你还记得它以前的样子吗？','I found the public trail. Do you remember what it used to look like?'):example('nell-photo','这张旧桥照片有什么故事？','What is the story behind this old bridge photograph?'),example('nell-shop','店里哪件旧东西让你印象最深？','Which old object in the shop has stayed with you most?')];break;
  case 'elena':options=[q.garden==='agreed-10-to-12'?example('elena-hours','约好十点到十二点通行了，怎样提醒大家遵守时间比较好？','We agreed on ten to twelve. What would help people respect those hours?'):example('elena-home','如果有人经过这里，你最希望他们注意什么？','What would you most like people passing through to keep in mind?'),example('elena-flowers','你照看的这些花，有什么特别喜欢的品种吗？','Do you have a favorite among the flowers you tend?')];break;
  case 'arthur':options=[q.trail==='mapped'?example('arthur-mapped','路线图拼好了，沿途有什么值得留意的？','The route map is together. What is worth noticing along the way?'):example('arthur-weather','只看眼前的天空，怎样判断天气会不会变？','How can you tell from the sky whether the weather will change?'),example('arthur-work','以前在气象站，一天通常是怎么过的？','What was an ordinary day at the weather station like?')];break;
 }
 if(local&&lifeExamples(save,person).length)options=lifeExamples(save,person).map((words,i)=>({id:'resident-'+i,words}));
 if(!options.length)options=fallback;
 const candidates=options.map(o=>({id:o.id,text:tx(o.words,locale)}));
 // Changing person, journey, locale or relevant progress invalidates preview/cycling,
 // but never rewrites an existing draft. No schema or save migration is needed.
 return {key:JSON.stringify([save.id,save.scene,person,locale,candidates]),candidates};
}
