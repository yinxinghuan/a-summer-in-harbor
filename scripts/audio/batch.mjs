import fs from 'node:fs/promises';import {randomUUID} from 'node:crypto';import {spawn} from 'node:child_process';
const specs={
 'step':['sfx',.5,'One single very soft close-up shoe footstep on a wooden board, short dry natural tap, no reverb, no background sound, no sequence.'],
 'door':['sfx',.7,'One gentle old wooden door latch click and soft close, intimate cozy quiet interior, short sound, no voices no ambience.'],
 'hit':['sfx',.5,'One soft padded boxing practice impact, dry muted cloth thump, non violent sports training, no voices no reverb no background.'],
 'progress':['sfx',1,'One gentle warm two-note acoustic chime, small task complete in a cozy game, clear and soft, no voice no background.'],
 'practice':['music',45,'Light friendly instrumental practice music for a neighborhood boxing club, relaxed brushed drum groove, upright bass and muted guitar, 102 BPM, playful and approachable, low pressure, no dramatic battle music, no vocals, clean ending.'],
 'town-a':['music',45,'Background exploration music for a cozy modern seaside town, warm and gently curious, acoustic instrumental, nylon string guitar, soft upright piano, brushed percussion and double bass, 86 BPM, medium-low energy, small repeating musical phrases with breathing space for conversation, no vocals, no dramatic climax, clean ending.'],
 'town-b':['music',45,'Background exploration theme for a newcomer spending summer in a seaside town, friendly and quietly hopeful, mellow acoustic folk with piano and lightly plucked mandolin, 82 BPM, unhurried simple motif, restrained bass and soft brushed rhythm, intimate natural recording, no vocals, no huge crescendo, clean ending.'],
 'coast':['music',45,'Quiet exploration music for an open beach and wooden harbor piers, spacious and reflective but welcoming, soft electric piano and warm nylon guitar harmonics, subtle bowed bass, 72 BPM, sparse open phrases with long pauses, low energy background underscore, instrumental, no vocals, no ocean sound effects, clean ending.'],
 'hill':['music',45,'Exploration music for sunny pine trails and a small hilltop garden, lightly playful and spacious acoustic instrumental, muted marimba, fingerpicked guitar, very soft brushed shaker and warm bass, 88 BPM, steady relaxed walking pulse, no suspense or dramatic climax, no vocals, clean ending.']
};
const identity=JSON.parse(await fs.readFile('doc/game-identity.json','utf8'));
for(const [name,[kind,duration,prompt]] of Object.entries(specs)){
 const file=`doc/audio/${name}-request.json`;let request;try{request=JSON.parse(await fs.readFile(file,'utf8'))}catch{request={requestId:randomUUID(),sessionId:identity.uuid,kind,duration,prompt};await fs.writeFile(file,JSON.stringify(request,null,2))}
 try{await fs.access(`public/audio/${name}.mp3`);continue}catch{}
 await new Promise(resolve=>{const p=spawn(process.execPath,['scripts/audio/generate-audio.mjs','--session-id',request.sessionId,'--request-id',request.requestId,'--kind',kind,'--duration',String(duration),'--prompt',prompt,'--output',`public/audio/${name}.mp3`]);let out='';p.stdout.on('data',b=>out+=b);p.stderr.on('data',b=>out+=b);p.on('close',async code=>{await fs.writeFile(`doc/audio/${name}-result.txt`,out);console.log(name,code===0?'candidate downloaded, listening pending':'request failed; same ID retained');resolve()})})
}
