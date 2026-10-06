import type {CameraInsets} from '../engine/exploration-camera';
/** Measure game-owned overlays. External visitor banners never set composition. */
export function explorationLayout(world:HTMLElement){
 const app=world.closest<HTMLElement>('.harbor-app')!;
 let insets:CameraInsets={left:12,top:0,right:12,bottom:0};
 const box=(selector:string)=>app.querySelector<HTMLElement>(selector)?.getBoundingClientRect();
 const measure=()=>{
  const a=app.getBoundingClientRect(),header=box('.harbor-header');
  const set=(name:string,value:number)=>{const px=`${value}px`;if(app.style.getPropertyValue(name)!==px)app.style.setProperty(name,px)};
  if(header)set('--harbor-header-bottom',header.bottom-a.top);
  const location=box('.harbor-location');
  if(location)set('--harbor-location-bottom',location.bottom-a.top);
  const w=world.getBoundingClientRect(),objective=box('.harbor-objective'),controls=box('.harbor-controls');
  insets={left:12,top:Math.max(0,(objective?.bottom??location?.bottom??header?.bottom??w.top)-w.top)+12,right:12,bottom:Math.max(0,w.bottom-(controls?.top??w.bottom))+12};
 };
 const observer=new ResizeObserver(measure);
 const observe=()=>{observer.disconnect();for(const selector of ['.harbor-header','.harbor-location','.harbor-objective','.harbor-controls']){const e=app.querySelector(selector);if(e)observer.observe(e)}observer.observe(world);measure()};
 const mutations=new MutationObserver(observe);mutations.observe(app,{childList:true,subtree:true});
 window.addEventListener('resize',measure);document.fonts.ready.then(measure);observe();
 return {insets:()=>{measure();return insets},dispose:()=>{observer.disconnect();mutations.disconnect();window.removeEventListener('resize',measure)}};
}
