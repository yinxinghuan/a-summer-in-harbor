import {preview} from 'vite';
const server=await preview({preview:{host:'127.0.0.1',port:5426,strictPort:true,proxy:{'^/[0-9a-f-]{36}/api/':{target:'http://127.0.0.1:5425',rewrite:p=>p.replace(/^\/[0-9a-f-]{36}/,'')}}}});server.printUrls();
