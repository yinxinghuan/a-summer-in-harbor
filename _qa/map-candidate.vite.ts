import {defineConfig,mergeConfig} from 'vite';
import base from '../vite.config';
export default mergeConfig(base,defineConfig({cacheDir:'.map-vite-cache',build:{copyPublicDir:false},server:{host:'127.0.0.1',port:5486,strictPort:true,proxy:{'^/[0-9a-f-]{36}/api/':{target:'http://127.0.0.1:5487',rewrite:(p:string)=>p.replace(/^\/[0-9a-f-]{36}/,'')}}}}));
