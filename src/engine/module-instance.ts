/** RPGJS normalizes client module declarations in place. Keep each renderer's
 * mutable declaration separate from the package's shared Tiled module. */
export function instanceClientModules<T>(providers:T[]):T[]{
 return providers.map((provider:any)=>{
  const value=provider?.useValue;
  if(!provider?.meta?.client||!value?.client||typeof value.client!=='object')return provider;
  const client=Object.fromEntries(Object.entries(value.client).map(([key,v])=>[key,Array.isArray(v)?[...v]:v]));
  return {...provider,useValue:{...value,client}};
 });
}
