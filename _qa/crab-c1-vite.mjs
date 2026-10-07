import {createServer} from 'vite';const server=await createServer({cacheDir:'.data/crab-c1-vite-cache',server:{host:'127.0.0.1',port:5528,strictPort:true}});await server.listen();server.printUrls();
