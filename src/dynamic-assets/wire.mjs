/** JSON transport for exact manifest/image bytes; this is not a bearer credential. */
const encode=b=>{let s='';for(const n of b)s+=String.fromCharCode(n);return btoa(s)};
const decode=s=>new Uint8Array(Array.from(atob(s),c=>c.charCodeAt(0)));
export function encodePackage(record){return {format:'harbor-library-package-v1',grant:structuredClone(record.grant),grantHash:record.grantHash,manifests:record.manifests.map(([k,b])=>[k,encode(b)]),packaged:record.packaged.map(([k,b])=>[k,encode(b)])}}
export function decodePackage(wire){
 if(!wire||wire.format!=='harbor-library-package-v1'||Object.keys(wire).some(k=>!['format','grant','grantHash','manifests','packaged'].includes(k)))throw Error('ASSET_PACKAGE_WIRE');
 let total=0;const list=(values,limit)=>{if(!Array.isArray(values)||values.length>32)throw Error('ASSET_PACKAGE_COUNT');const keys=new Set();return values.map(row=>{if(!Array.isArray(row)||row.length!==2||typeof row[0]!=='string'||row[0].length>200||keys.has(row[0])||typeof row[1]!=='string'||row[1].length>Math.ceil(limit/3)*4)throw Error('ASSET_PACKAGE_BYTES');keys.add(row[0]);const b=decode(row[1]);total+=b.length;if(b.length>limit||total>20*1024**2)throw Error('ASSET_PACKAGE_BYTES');return [row[0],b]})};
 return {grant:structuredClone(wire.grant),grantHash:wire.grantHash,manifests:list(wire.manifests,128*1024),packaged:list(wire.packaged,5*1024**2)};
}
