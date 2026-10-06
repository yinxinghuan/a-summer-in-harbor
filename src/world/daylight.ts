/** Presentation only: never advances or writes townMinutes. */
export type Daylight = { brightness:number;top:[number,number,number,number];bottom:[number,number,number,number];lamps:number };
export const daylightKeys:{minute:number;light:Daylight}[]=[
 {minute:0,light:{brightness:.68,top:[22,43,112,.25],bottom:[22,43,112,.25],lamps:1}},
 {minute:300,light:{brightness:.76,top:[52,74,123,.18],bottom:[109,100,138,.12],lamps:.9}},
 {minute:390,light:{brightness:.91,top:[72,141,190,.21],bottom:[244,192,131,.10],lamps:.18}},
 {minute:540,light:{brightness:1,top:[87,130,169,0],bottom:[244,192,131,0],lamps:0}},
 {minute:900,light:{brightness:1,top:[116,127,170,0],bottom:[240,164,98,0],lamps:0}},
 {minute:1050,light:{brightness:.97,top:[154,129,155,.08],bottom:[242,171,100,.14],lamps:.12}},
 {minute:1140,light:{brightness:.9,top:[192,118,136,.12],bottom:[255,153,77,.28],lamps:.55}},
 {minute:1230,light:{brightness:.79,top:[78,70,137,.22],bottom:[155,113,151,.17],lamps:.9}},
 {minute:1350,light:{brightness:.68,top:[22,43,112,.25],bottom:[22,43,112,.25],lamps:1}},
 {minute:1440,light:{brightness:.68,top:[22,43,112,.25],bottom:[22,43,112,.25],lamps:1}},
];
const indoor:Daylight={brightness:1,top:[243,204,143,.03],bottom:[243,204,143,.03],lamps:0};
export function mixDaylight(a:Daylight,b:Daylight,t:number):Daylight{
 const mix=(x:number,y:number)=>x+(y-x)*t;
 const rgba=(x:Daylight['top'],y:Daylight['top'])=>x.map((n,i)=>mix(n,y[i])) as Daylight['top'];
 return {brightness:mix(a.brightness,b.brightness),top:rgba(a.top,b.top),bottom:rgba(a.bottom,b.bottom),lamps:mix(a.lamps,b.lamps)};
}
export function sampleDaylight(townMinutes:number,outdoor:boolean):Daylight{
 if(!outdoor)return indoor;
 const m=((Number.isFinite(townMinutes)?townMinutes:540)%1440+1440)%1440;
 const i=daylightKeys.findIndex(k=>k.minute>m),a=daylightKeys[i-1],b=daylightKeys[i];
 const t=(m-a.minute)/(b.minute-a.minute);return mixDaylight(a.light,b.light,t*t*(3-2*t));
}
export function paintDaylight(host:HTMLElement,light:Daylight){
 // Flatten tint over dimmed artwork into one source-over layer:
 // A = 1 - B(1-a), C = a*c/A. Avoid a full-canvas filter pass.
 const rgba=(c:Daylight['top'])=>{const alpha=1-light.brightness*(1-c[3]);const rgb=c.slice(0,3).map(n=>(alpha>0?n*c[3]/alpha:0).toFixed(2));return `rgba(${rgb.join(',')},${alpha.toFixed(4)})`};
 host.style.setProperty('--harbor-daylight-brightness',light.brightness.toFixed(4));
 host.style.setProperty('--harbor-daylight-top',rgba(light.top));host.style.setProperty('--harbor-daylight-bottom',rgba(light.bottom));
 host.style.setProperty('--harbor-daylight-lamps',light.lamps.toFixed(4));
 const night=Math.min(1,Math.max(0,(.79-light.brightness)/.11));
 host.style.setProperty('--harbor-daylight-lamp-core',(.7216+.1255*night).toFixed(4));
}
/** Interrupted jumps retarget from the displayed value, not a stale endpoint. */
export function createDaylightTransition(host:HTMLElement){
 let current:Daylight|undefined,destination:Daylight|undefined,frame=0,disposed=false,scene='';
 const reduced=matchMedia('(prefers-reduced-motion: reduce)');
 const reduceNow=()=>{if(reduced.matches&&destination){cancelAnimationFrame(frame);current=destination;paintDaylight(host,destination)}};
 reduced.addEventListener('change',reduceNow);
 return {
  update(minutes:number,outdoor:boolean,nextScene:string){
   cancelAnimationFrame(frame);const target=sampleDaylight(minutes,outdoor);destination=target;
   if(!current||scene!==nextScene||document.hidden){scene=nextScene;current=target;paintDaylight(host,target);return}
   const from=current,start=performance.now(),duration=reduced.matches?180:1200;
   const tick=(now:number)=>{if(disposed)return;const t=Math.min(1,(now-start)/duration);current=mixDaylight(from,target,t*t*(3-2*t));paintDaylight(host,current);if(t<1)frame=requestAnimationFrame(tick)};
   frame=requestAnimationFrame(tick);
  },
  dispose(){disposed=true;cancelAnimationFrame(frame);reduced.removeEventListener('change',reduceNow)},
 };
}
