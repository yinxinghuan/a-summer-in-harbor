import https from 'node:https';
import {lookup} from 'node:dns/promises';
import {createHash} from 'node:crypto';
import {readFile,writeFile,rename,mkdir,open,unlink} from 'node:fs/promises';
import {dirname} from 'node:path';
export const source=Object.freeze({id:'fed-monetary',name:'Federal Reserve Board',url:'https://www.federalreserve.gov/feeds/press_monetary.xml',host:'www.federalreserve.gov'});
export const LIMIT=524288,TTL=72*3600000,MAX_AGE=30*86400000;
export const hash=s=>createHash('sha256').update(s).digest('hex');
export function publicIPv4(s){const a=s.split('.').map(Number);return a.length===4&&a.every(x=>Number.isInteger(x)&&x>=0&&x<=255)&&!([0,10,127].includes(a[0])||a[0]>=224||(a[0]===169&&a[1]===254)||(a[0]===172&&a[1]>=16&&a[1]<=31)||(a[0]===192&&(a[1]===168||a[1]===0||a[1]===2))||(a[0]===100&&a[1]>=64&&a[1]<=127)||(a[0]===198&&(a[1]===18||a[1]===19||a[1]===51))||(a[0]===203&&a[1]===0&&a[2]===113));}
export function safeArticle(s){try{const u=new URL(s);return u.protocol==='https:'&&u.hostname===source.host&&!u.port&&!u.username&&!u.password&&!u.search&&!u.hash&&/^\/newsevents\/pressreleases\/monetary\d{8}[a-z]?\.htm$/.test(u.pathname)}catch{return false}}
/** No user URL or headers. DNS is bounded; the approved public address is used on the actual TLS connection. */
export async function readOfficialFeed(){
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),10000);
 try{const addresses=await Promise.race([lookup(source.host,{family:4,all:true}),new Promise((_,reject)=>controller.signal.addEventListener('abort',()=>reject(Error('SOURCE_TIMEOUT')),{once:true}))]);
 if(!addresses.length||addresses.some(x=>!publicIPv4(x.address)))throw Error('SOURCE_ADDRESS_DENIED');
 return await new Promise((resolve,reject)=>{
 const req=https.get(source.url,{agent:false,signal:controller.signal,lookup:(_h,opts,cb)=>opts?.all?cb(null,[{address:addresses[0].address,family:4}]):cb(null,addresses[0].address,4),headers:{Accept:'application/rss+xml, application/xml, text/xml','Accept-Encoding':'identity','User-Agent':'HarborNewsLocalValidation/1.0'}},res=>{
 if(res.statusCode!==200){res.resume();reject(Error('SOURCE_HTTP_'+res.statusCode));return}
 if(!/(xml|rss)/i.test(res.headers['content-type']??'')||res.headers['content-encoding']||Number(res.headers['content-length']??0)>LIMIT){res.destroy();reject(Error('SOURCE_TYPE_OR_SIZE'));return}
 const chunks=[];let bytes=0;res.on('data',c=>{bytes+=c.length;if(bytes>LIMIT){res.destroy();reject(Error('SOURCE_TOO_LARGE'))}else chunks.push(c)});res.on('error',reject);res.on('end',()=>resolve({xml:Buffer.concat(chunks).toString('utf8'),httpDate:res.headers.date,bytes,fetchedAt:new Date().toISOString()}));
 });req.on('error',reject);
 });}finally{clearTimeout(timer)}
}
const decode=s=>s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g,'$1').replace(/&#(x[0-9a-f]+|[0-9]+);/gi,(_,n)=>{const c=n[0].toLowerCase()==='x'?parseInt(n.slice(1),16):Number(n);return c>0&&c<=0x10ffff?String.fromCodePoint(c):''}).replace(/&(amp|lt|gt|quot|apos);/g,(_,n)=>({amp:'&',lt:'<',gt:'>',quot:'"',apos:"'"}[n]));
const tag=(s,t)=>decode(s.match(new RegExp('<'+t+'(?:\\s[^>]*)?>([\\s\\S]*?)</'+t+'>','i'))?.[1]??'').replace(/<[^>]*>/g,'').replace(/\s+/g,' ').trim();
export function parseFeed(xml,now){
 if(Buffer.byteLength(xml)>LIMIT||/<!DOCTYPE|<!ENTITY/i.test(xml)||!/<rss\b/i.test(xml)||!/<\/rss>\s*$/i.test(xml))throw Error('SOURCE_XML_INVALID');
 const records=[],rejected=[];const items=[...xml.matchAll(/<item\b[^>]*>([\s\S]*?)<\/item>/gi)];if(items.length>100)throw Error('SOURCE_ITEM_LIMIT');
 for(const [,item] of items){const title=tag(item,'title'),url=tag(item,'link'),publishedRaw=tag(item,'pubDate'),published=Date.parse(publishedRaw);
 if(!title||title.length>200||/[\u0000-\u001f\u202a-\u202e\u2066-\u2069]/.test(title)||/ignore.{0,30}instructions|system prompt|api.?key|<script|javascript:/i.test(title)||!safeArticle(url)||!Number.isFinite(published)||!/(GMT|UTC|[+-]\d{4})$/i.test(publishedRaw)||published>now+300000||now-published>MAX_AGE){rejected.push({reason:'INELIGIBLE_ITEM'});continue}
 const canonicalURL=new URL(url).href,contentHash=hash(JSON.stringify({title,description:tag(item,'description'),publishedAt:new Date(published).toISOString()}));
 records.push({id:'rss-'+hash(canonicalURL).slice(0,24),sourceId:source.id,canonicalURL,title,source:source.name,publishedAt:new Date(published).toISOString(),publishedRaw,publishedPrecision:'instant',publishedTimezone:'UTC',contentHash,template:'finance-budget-v1'});
 }
 return {records:records.sort((a,b)=>b.publishedAt.localeCompare(a.publishedAt)),rejected};
}
export function mergeCatalog(previous,parsed,fetchedAt){
 const catalog=structuredClone(previous??{schema:1,records:[]});if(catalog.schema!==1)throw Error('CATALOG_SCHEMA');let added=0,changed=0,duplicate=0;
 for(const r of parsed.records){const versions=catalog.records.filter(x=>x.id===r.id).sort((a,b)=>b.revision-a.revision),last=versions[0];
 if(last?.contentHash===r.contentHash){last.lastCheckedAt=fetchedAt;if(last.status==='admitted')last.expiresAt=new Date(Math.min(Date.parse(fetchedAt)+TTL,Date.parse(r.publishedAt)+MAX_AGE)).toISOString();duplicate++;continue}
 const revision=(last?.revision??0)+1;
 if(last){for(const old of versions)old.status='superseded';changed++}else added++;
 catalog.records.push({...r,revision,fetchedAt,lastCheckedAt:fetchedAt,expiresAt:new Date(Math.min(Date.parse(fetchedAt)+TTL,Date.parse(r.publishedAt)+MAX_AGE)).toISOString(),status:last?'changed-pending-review':'admitted',...(last?{supersedes:last.revision}:{})});
 }
 if(catalog.records.length>200)throw Error('CATALOG_CAPACITY_REVIEW_REQUIRED');catalog.lastFetchAt=fetchedAt;return {catalog,counts:{added,changed,duplicate,rejected:parsed.rejected.length}};
}
export function selectStory(catalog,now=Date.now()){return catalog.records.filter(r=>r.status==='admitted'&&Date.parse(r.expiresAt)>now&&Date.parse(r.publishedAt)<=now+300000).sort((a,b)=>b.publishedAt.localeCompare(a.publishedAt))[0]}
export function editionStatus(catalog,record,now=Date.now()){const stored=catalog.records.find(r=>r.id===record.id&&r.revision===record.revision);return !stored?'unavailable':stored.status!=='admitted'?'changed':Date.parse(stored.expiresAt)<=now?'expired':'current'}
export async function loadCatalog(path){try{return JSON.parse(await readFile(path,'utf8'))}catch(e){if(e.code==='ENOENT')return {schema:1,records:[]};throw e}}
export async function collectOnce(path){
 await mkdir(dirname(path),{recursive:true});const lock=await open(path+'.lock','wx');
 try{const before=await loadCatalog(path),feed=await readOfficialFeed(),parsed=parseFeed(feed.xml,Date.parse(feed.fetchedAt)),result=mergeCatalog(before,parsed,feed.fetchedAt);const tmp=path+'.tmp-'+process.pid;await writeFile(tmp,JSON.stringify(result.catalog,null,2));await rename(tmp,path);return {source:source.url,fetchedAt:feed.fetchedAt,httpDate:feed.httpDate,bytes:feed.bytes,responseSha256:hash(feed.xml),...result.counts,selected:selectStory(result.catalog),modelCalls:0};}
 finally{await lock.close();await unlink(path+'.lock')}
}
