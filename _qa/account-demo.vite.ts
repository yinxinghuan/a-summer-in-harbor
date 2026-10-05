import {defineConfig,mergeConfig} from 'vite';import base from '../vite.config';
export default mergeConfig(base,defineConfig({server:{host:'127.0.0.1',port:5261,strictPort:true,proxy:{'^/[0-9a-f-]{36}/api/':{target:'http://127.0.0.1:5260',rewrite:p=>p.replace(/^\/[0-9a-f-]{36}/,'')}}}}));
