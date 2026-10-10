import {createServer, request} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve, sep, extname} from 'node:path';
const root=resolve('dist');
const mime={'.html':'text/html','.js':'application/javascript','.css':'text/css','.png':'image/png','.woff2':'font/woff2','.ttf':'font/ttf','.txt':'text/plain','.json':'application/json','.wav':'audio/wav','.mp3':'audio/mpeg'};
createServer(async(req,res)=>{
 const u=new URL(req.url,'http://127.0.0.1');
 if(/^\/[0-9a-f-]{36}\/api\//.test(u.pathname)){
  const proxy=request({hostname:'127.0.0.1',port:5571,path:req.url.replace(/^\/[0-9a-f-]{36}/,''),method:req.method,headers:req.headers},r=>{res.writeHead(r.statusCode,r.headers);r.pipe(res)});
  proxy.on('error',()=>{res.writeHead(502);res.end()});req.pipe(proxy);return;
 }
 const file=resolve(root,'.'+decodeURIComponent(u.pathname==='/'?'/index.html':u.pathname));
 if(!file.startsWith(root+sep)){res.writeHead(403);res.end();return}
 try{const data=await readFile(file);res.writeHead(200,{'Content-Type':mime[extname(file)]??'application/octet-stream','Cache-Control':'no-store'});res.end(data)}catch{res.writeHead(404);res.end()}
}).listen(5570,'127.0.0.1',()=>console.log('Owner fully built map QA :5570, synthetic authority :5571 only'));
