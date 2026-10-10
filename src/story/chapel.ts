import type {Words} from '../world/data';
import type {LifeTopic} from './resident-life';
import type {TownState} from '../world/residents';
export const chapelTopicIds=['chapel-welcome','chapel-memory'];
export const chapelActionLabels:Record<string,Words>={
 'chapel-read-notice':['读活动便条','Read the activity note'],
 'chapel-help-reading':['整理阅读角 · 免费','Arrange the reading corner · Free'],
 'chapel-listen':['留下听一会儿 · 免费','Stay and listen · Free'],
 'chapel-recall':['回看这次相聚','Remember the visit'],
};
const selected=(s:TownState)=>s.flags.includes('chapel:participation:reading')?'reading':s.flags.includes('chapel:participation:listening')?'listening':undefined;
export function chapelJoined(s:TownState){return selected(s)}
export function validChapelState(s:TownState){
 const f=s.flags;if(!Array.isArray(f))return false;
 const chapel=f.filter(x=>x.startsWith('chapel:'));
 const allowed=['chapel:visited','chapel:notice-read','chapel:participation:reading','chapel:participation:listening','chapel:completed','chapel:meeting-clue'];
 if(chapel.some(x=>!allowed.includes(x))||new Set(chapel).size!==chapel.length)return false;
 const choices=Number(f.includes(allowed[2]))+Number(f.includes(allowed[3]));
 return choices<=1&&(!f.includes('chapel:notice-read')||f.includes('chapel:visited'))&&
 (choices===1?f.includes('chapel:notice-read')&&f.includes('chapel:completed')&&f.includes('chapel:meeting-clue'):!f.includes('chapel:completed')&&!f.includes('chapel:meeting-clue'));
}
const period=(s:TownState)=>{const m=(s.townMinutes??540)%1440;return m>=720&&m<1020};
export function chapelRead(s:TownState):Words{
 const joined=selected(s),time:Words=['每天午后12:00至17:00，图书馆居民来整理阅读角，轻声哼歌的居民来试着衔接句子。其他时间可安静看书；错过了，可以另一个午后来。','Every afternoon, 12:00–17:00, the library resident tends the reading corner and the resident who hums works on a few lines. At other times, you can read quietly. Another afternoon is fine if you miss this one.'];
 const recall:Words=joined==='reading'?['你上次把阅读角理好了。桌边多留出一把椅子，给下一个邻居。','You arranged the reading corner. An extra chair waits by the table for the next neighbor.']:joined==='listening'?['你上次留下听了那几句。靠过道的椅子仍留着，愿意的话还可以来坐。','You stayed to hear those few lines. The aisle-side chair is still there whenever you want to sit.']:['阅读角开放。先读这张便条，再到书桌旁帮忙，或午后在座席旁听一会儿。两种参与任选一种；不花钱，不耗物品。现在离开也没关系。','The reading corner is open. Read this note, then help by the book table or listen beside the seats in the afternoon. Choose one kind of participation; neither costs money or items. You can also leave for now.'];
 return [recall[0]+' '+time[0],recall[1]+' '+time[1]];
}
export function chapelActionAvailable(s:TownState,id:string){
 if(!id.startsWith('chapel-'))return true;
 if(id==='chapel-read-notice')return true;
 if(id==='chapel-recall')return !!selected(s);
 if(!s.flags.includes('chapel:notice-read')||selected(s))return false;
 return id==='chapel-help-reading'||id==='chapel-listen'&&period(s)&&s.known.includes('samira');
}
export function applyChapelAction(s:TownState,id:string):Words{
 if(s.scene!=='chapel')throw Error('CHAPEL_WRONG_PLACE');
 const add=(f:string)=>{if(!s.flags.includes(f))s.flags.push(f)};
 if(id==='chapel-read-notice'){add('chapel:visited');add('chapel:notice-read');return chapelRead(s)}
 if(id==='chapel-recall'){if(!selected(s))throw Error('CHAPEL_NOT_JOINED');return chapelRead(s)}
 if(!s.flags.includes('chapel:notice-read'))throw Error('CHAPEL_READ_NOTE_FIRST');
 if(selected(s))throw Error('CHAPEL_ALREADY_JOINED');
 if(id!=='chapel-help-reading'&&id!=='chapel-listen')throw Error('CHAPEL_UNKNOWN_ACTION');
 if(id==='chapel-listen'&&(!period(s)||!s.known.includes('samira')))throw Error(!period(s)?'CHAPEL_REHEARSAL_AWAY':'INTRODUCE_FIRST');
 add('chapel:participation:'+(id==='chapel-help-reading'?'reading':'listening'));add('chapel:completed');add('chapel:meeting-clue');
 return id==='chapel-help-reading'?['书留在桌上，你给下一位邻居放好一把椅子，中央过道仍然畅通。门边的便条记着午后会合地点。下次回来，可以看看谁正在这里。','You leave the books on the table and set out a chair for the next neighbor, keeping the central aisle clear. The note gives the afternoon meeting place. Come back to see who is here.']:['萨米拉轻声接起两句，又停下来琢磨下一段。你安静地听，没有把这变成一场演出。下一个午后，座席旁还是你们会合的地方。','Samira softly joins two lines, then stops to think about the next. You listen without turning it into a performance. The seats are your meeting place another afternoon.'];
}
export function chapelTopics(s:TownState,person:string):LifeTopic[]{
 if(s.scene!=='chapel'||!period(s)||!s.known.includes(person)||!['dani','samira'].includes(person))return [];
 return [{id:'chapel-welcome',once:true,label:['这里今天有什么活动？','What happens here today?'] as Words,reply:person==='dani'?['“我是来整理阅读角的。书留在桌上，椅子放过道两侧。门边便条写着今天的安排；你不必留下帮忙，坐坐也好。”','“I’m here to tend the reading corner. Books on the table, chairs beside the aisle. The note by the door has the arrangements. You needn’t help; a quiet sit is welcome too.”'] as Words:['“还是那几句没名字的小调。我来试试怎么接下一段，不想办成演出。门边有便条，愿意的话可以坐下听一会儿。”','“Still those few lines without a name. I came to try the next part, not to put on a show. There’s a note by the door. You can sit and listen if you like.”'] as Words},...(selected(s)?[{id:'chapel-memory',label:['还记得我上次来吗？','Remember my last visit?'] as Words,reply:chapelRead(s)}]:[])];
}
export function chapelDescription(s:TownState,id:string):Words|undefined{
 if(s.scene!=='chapel')return;
 if(id==='chapel-note')return chapelRead(s);
 if(id==='chapel-reading')return selected(s)?chapelRead(s):['书桌旁留着一把椅子。先读门边的便条；帮忙不会改变你的钱、体力或物品。','A chair stands beside the book table. Read the note by the door first. Helping costs no money, energy or items.'];
 if(id==='chapel-seat')return selected(s)?chapelRead(s):period(s)?['午后有人在这里轻声试着衔接歌句。先向她打招呼，再读活动便条。','Someone softly tries to join a few lines here in the afternoon. Say hello to her, then read the activity note.']:['这里此刻很安静。排练者每天下午12:00至17:00来，另一个午后仍有机会。','It is quiet just now. The resident returns every afternoon, 12:00–17:00. Another afternoon is fine.'];
}

export function chapelObjective(s:TownState):Words{
 return selected(s)?['教堂大厅 · 记得这次相聚，或回山坡继续探索','Chapel Hall · Remember the visit, or return to the hill']:s.flags.includes('chapel:notice-read')?['教堂大厅 · 整理阅读角，或午后留下听一会儿','Chapel Hall · Arrange the reading corner, or listen in the afternoon']:['教堂大厅 · 先读门边的社区便条','Chapel Hall · Read the community note by the door'];
}
