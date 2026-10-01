/** Starts only a loopback development authority. */
import {spawn,spawnSync} from 'node:child_process';import {homedir} from 'node:os';
const python=[process.env.HARBOR_PYTHON,'python3',homedir()+'/miniconda3/bin/python3'].filter(Boolean).find(p=>spawnSync(p,['-c','from PIL import Image']).status===0);if(!python)throw Error('Install Python Pillow or set HARBOR_PYTHON before starting the authoring server.');
const child=spawn(process.execPath,['--import','tsx','server/index.ts'],{stdio:'inherit',env:{...process.env,HARBOR_PYTHON:python}});for(const signal of['SIGINT','SIGTERM'])process.on(signal,()=>child.kill(signal));child.on('exit',code=>process.exit(code??0));
