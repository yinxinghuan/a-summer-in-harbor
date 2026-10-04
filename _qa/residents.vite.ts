import {defineConfig} from 'vite';import base from '../vite.config';
export default defineConfig({...base,server:{host:'127.0.0.1',port:5257,strictPort:true,proxy:{'^/[0-9a-f-]{36}/api/':{target:'http://127.0.0.1:5258',rewrite:p=>p.replace(/^\/[0-9a-f-]{36}/,'')}}}});
