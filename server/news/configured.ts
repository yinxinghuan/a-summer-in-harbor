import {readFileSync} from 'node:fs';
import {validNewsState} from '../../src/story/news-edition';
import {withNewsRuntime,projectNews} from './runtime';
/** Explicit, bounded local snapshot. No fetch, scheduler, or model invocation. */
export function configuredNews(base:any,path?:string,clock=Date.now){
 if(!path)return {runtime:base};
 const bytes=readFileSync(path);if(bytes.length>512*1024)throw Error('NEWS_CATALOG_TOO_LARGE');
 const catalog=JSON.parse(bytes.toString('utf8'));
 if(catalog.schema!==1||!Array.isArray(catalog.records)||catalog.records.length>200||catalog.records.some((r:any)=>r.status==='admitted'&&!validNewsState({newsMode:'live',newsEdition:r})))throw Error('NEWS_CATALOG_INVALID');
 // Capture once per process; replacing a file never mutates an in-flight turn.
 return {runtime:withNewsRuntime(base,()=>catalog,clock),newsProject:(s:any)=>projectNews(s,catalog,clock())};
}
