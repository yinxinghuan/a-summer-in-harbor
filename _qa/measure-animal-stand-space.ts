import {readFileSync, writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {heroSheet,npcSheets,sheets,propId} from '../src/world/sheets';
import {rooms} from '../src/world/data';
import {animalArts} from '../src/animals/art';
const inputs: Record<string,Record<string,unknown>> = {candidates:{},people:{},animals:{},props:{}};
for(const sheet of [heroSheet,...npcSheets]) inputs.people[sheet.id]={
 source:'public/'+sheet.image.replace(/^\.\//,''),
 frames:Object.fromEntries(Array.from({length:12},(_,i)=>[String(i),[(i%3)*128,Math.floor(i/3)*128,128,128,.5,122/128,56/108]])),
};
for(const [version,art] of Object.entries(animalArts)) inputs.animals[version]={
 source:'public/'+art.image.replace(/^\.\//,''),
 frames:Object.fromEntries(Object.entries(art.frames).flatMap(([pose,directions])=>Object.entries(directions??{}).map(([dir,f])=>[pose+'-'+dir,[f.x,f.y,f.w,f.h,...f.anchor,f.scale]]))),
};
for(const scene of ['courtyard','station','harbor','coast','beach','dock'])for(const prop of rooms[scene].props.filter(p=>!p.floorDecoration))for(const id of [propId(scene,prop),...(prop.state?[propId(scene,prop)+'-active']:[])]){
 const sheet=sheets.find(s=>s.id===id);if(!sheet)throw Error('PROP_SHEET_MISSING');
 const frame=sheet.textures.stand.animations()[0][0];
 inputs.props[id]={source:'public/'+sheet.image.replace(/^\.\//,''),scene,foot:{...prop.at},frames:{stand:[0,0,sheet.width,sheet.height,...frame.anchor,frame.scale[0]]}};
}
const result=execFileSync('arch',['-x86_64','/Library/Frameworks/Python.framework/Versions/3.11/bin/python3','_qa/measure-animal-stand-space.py'],{input:JSON.stringify(inputs),maxBuffer:8*1024*1024});
const target='_qa/animal-stand-space-geometry.json';
// No input/source image is modified. Overwrite only this reproducible new sidecar.
writeFileSync(target,result);
const data=JSON.parse(readFileSync(target,'utf8'));
console.log(JSON.stringify({candidates:Object.keys(data.candidates).length,people:Object.keys(data.people).length,animalFamilies:Object.keys(data.animals).length,props:Object.keys(data.props).length,purpose:data.purpose}));
