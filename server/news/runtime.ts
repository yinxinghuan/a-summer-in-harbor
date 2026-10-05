import {validNewsState,type NewsEdition} from '../../src/story/news-edition';
import type {Save,Action} from '../../src/story/state';
// @ts-expect-error bounded local collector module
import {selectStory,editionStatus} from './collector.mjs';
export function withNewsRuntime(base:any,catalog:()=>any,clock=Date.now){return {...base,
 initial(locale:any,id:string){const r=selectStory(catalog(),clock());return {...base.initial(locale,id),newsMode:'live',...(r?{newsEdition:structuredClone(r)}:{})}},
 assertReadable(s:Save){base.assertReadable(s);if(!validNewsState(s))throw Error('UNSUPPORTED_NEWS_SAVE')},
 async prepare(s:Save,a:Action,...rest:any[]){
  // Pin the edition on the first committed notebook action for existing journeys.
  // Already-read older stories retain their own facts and topic progress.
  if(!s.newsMode&&!s.flags.includes('news:heard')&&a.target==='dani'&&(a.action==='talk:visitor-news'||a.action==='ask')){
   const edition=selectStory(catalog(),clock());s={...s,newsMode:'live',...(edition?{newsEdition:structuredClone(edition)}:{})};
  }
  if(a.target==='dani'&&a.action.startsWith('talk:visitor-')&&s.newsMode==='live'){
   const status=s.newsEdition?editionStatus(catalog(),s.newsEdition,clock()):'unavailable';
   if(status==='changed'||status==='unavailable'||status==='expired'&&!s.flags.includes('news:heard'))throw Error('NEWS_SOURCE_UNAVAILABLE');
  }
  const result=await base.prepare(s,a,...rest);
  if(s.newsMode==='live'&&result.head?.flags.some((f:string)=>(f.startsWith('news:')||f.startsWith('talk:dani:visitor-'))&&!s.flags.includes(f))){
   const status=s.newsEdition?editionStatus(catalog(),s.newsEdition,clock()):'unavailable';
   if(status==='changed'||status==='unavailable'||status==='expired'&&!s.flags.includes('news:heard'))throw Error('NEWS_SOURCE_UNAVAILABLE');
  }
  return result;
 }
}}
export function projectNews(s:Save,catalog:any,now=Date.now()):Save{return s.newsMode==='live'?{...s,newsAvailability:s.newsEdition?editionStatus(catalog,s.newsEdition,now):'unavailable'}:s}
