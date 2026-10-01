import type {IncomingMessage,ServerResponse} from 'node:http';
export const json=(res:ServerResponse,status:number,data:unknown)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(data))};
export function createApiHandler({authority,usage,noteMedia}:any){return async(req:IncomingMessage,res:ServerResponse,who:string)=>{const path=new URL(req.url!,'http://localhost').pathname,method=req.method;
  let body:any={};if(method==='POST'){let size=0,parts:Buffer[]=[];for await(const c of req){size+=c.length;if(size>1500000)return json(res,413,{error:'REQUEST_TOO_LARGE'});parts.push(c)}body=JSON.parse(Buffer.concat(parts).toString()||'{}')}
  if(path==='/api/usage'&&method==='GET')return json(res,200,await usage.status(who));
  if(path==='/api/sessions'&&method==='GET')return json(res,200,await authority.directory(who));
  if(path==='/api/sessions'&&method==='POST')return json(res,200,await authority.create(who,body.enrollment_id,body.locale));
  const mediaMatch=path.match(/^\/api\/sessions\/([a-f0-9-]{36})\/media\/(workshop-annex-[12])(?:\/(status|prepare))?$/);
  if(mediaMatch){const [,id,room,op]=mediaMatch;if(op==='status'&&method==='GET')return json(res,200,await noteMedia.status(who,id,room));if(op==='prepare'&&method==='POST')return json(res,200,await noteMedia.ensure(who,id,room));if(!op&&method==='GET'){const {bytes,type}=await noteMedia.image(who,id,room);res.writeHead(200,{'Content-Type':type,'Cache-Control':'private,max-age=86400','X-Content-Type-Options':'nosniff'});return res.end(bytes)}return json(res,405,{error:'METHOD_NOT_ALLOWED'})}
  const match=path.match(/^\/api\/sessions\/([a-f0-9-]{36})(?:\/(action|checkpoint|events))?$/);
  if(!match)return json(res,404,{error:'NOT_FOUND'});const [,id,operation]=match;
  if(!operation&&method==='GET')return json(res,200,await authority.get(who,id));
  if(operation==='action'&&method==='POST'){
   if(!['ask','notes-generate'].includes(body.action))return json(res,200,await authority.action(who,id,body));
   const allowance=body.action==='ask'?'dialogue':'room';await usage.reserve(who,allowance,body.action_id,{session:id,body});
   try{const result=await authority.action(who,id,body);await usage.settle(who,allowance,body.action_id,true);return json(res,200,result)}catch(e:any){if(e.code!=='MODEL_CALL_PENDING_OR_INTERRUPTED')await usage.settle(who,allowance,body.action_id,false);throw e}
  }
  if(operation==='checkpoint'&&method==='POST')return json(res,200,await authority.checkpoint(who,id,body));
  if(operation==='events'&&method==='GET')return json(res,200,await authority.events(who,id,Number(new URL(req.url!,'http://localhost').searchParams.get('after')??0)));
  return json(res,405,{error:'METHOD_NOT_ALLOWED'});

}}
