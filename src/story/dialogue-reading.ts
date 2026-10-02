import type {Entry,Save} from './state';
import type {Locale} from '../world/data';

type Cache=Pick<Storage,'getItem'|'setItem'|'removeItem'>;
export type Reading={exchangeId:string;page:number;locale:Locale;finished:boolean};
// Journey IDs are authority-issued. This is presentation state, never login proof.
export const readingKey=(journey:string,person:string)=>`harbor-reading-v1:${journey}:${person}`;
export const draftKey=(journey:string,person:string)=>`harbor-draft-v2:${journey}:${person}`;
export function dialoguePages(text:string,locale:Locale):string[]{
 const max=locale==='zh'?72:235;
 const sentences=text.match(/[^。！？.!?\n]+[。！？.!?]?[”’"']*|\n/g)??[text];
 const pages:string[]=[];let page='';
 for(const sentence of sentences){
  const chunks=sentence.length>max?(locale==='zh'?Array.from(sentence):sentence.split(/(?<=\s)/)):[sentence];
  for(const chunk of chunks){if(page.length+chunk.length>max&&page.trim()){pages.push(page.trim());page=''}page+=chunk}
 }
 if(page.trim())pages.push(page.trim());return pages.length?pages:[''];
}
export function rememberReply(cache:Cache,save:Save,entry:Entry,locale:Locale){
 if(entry.kind!=='talk'||!entry.person)return;
 const key=readingKey(save.id,entry.person);
 try{if(JSON.parse(cache.getItem(key)??'null')?.exchangeId===entry.id)return}catch{/* Replace malformed UI cache only. */}
 cache.setItem(key,JSON.stringify({exchangeId:entry.id,page:0,locale,finished:false} satisfies Reading));
}
export function restoreReading(cache:Cache,save:Save,person:string,locale:Locale){
 const key=readingKey(save.id,person);let cursor:Reading;
 try{cursor=JSON.parse(cache.getItem(key)??'null')}catch{return null}
 if(!cursor||typeof cursor.exchangeId!=='string'||!Number.isSafeInteger(cursor.page)||cursor.page<0||typeof cursor.finished!=='boolean')return null;
 const entry=save.history.find(h=>h.id===cursor.exchangeId&&h.person===person&&h.kind==='talk');
 if(!entry||cursor.finished)return null;
 const pages=dialoguePages(entry.text[locale==='zh'?0:1],locale);
 const page=cursor.locale===locale?Math.min(cursor.page,pages.length-1):0;
 return {entry,pages,historical:save.history.at(-1)?.id!==entry.id,cursor:{...cursor,page,locale}};
}
export const hasAsked=(save:Save)=>save.flags.includes('free-dialogue-experienced')||save.history.some(h=>h.kind==='talk'&&!!h.question);
