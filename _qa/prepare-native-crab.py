"""Whole-frame technical processing of nine fixed originals; no generation/editing."""
from pathlib import Path
from PIL import Image,ImageDraw
import json,hashlib,io
R=Path(__file__).resolve().parents[1]; chain=json.loads((R.parent/'SOURCE-CHAIN.json').read_text()); O=R/'public/art/animals/crab-c1-v2';O.mkdir(parents=True,exist_ok=True)
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
# Manual diagnostic markings of all eight walking tip projections. A lifted tip
# is still reserved in the support/swing sweep, not claimed planted. Pincers excluded.
points={
 'down-stand':[[224,240],[32,500],[62,650],[226,766],[788,766],[962,650],[990,500],[788,240]],
 'down-walkA':[[160,190],[48,500],[124,650],[252,784],[840,690],[968,676],[988,460],[856,216]],
 'down-walkB':[[218,194],[30,458],[70,688],[258,644],[794,750],[834,690],[978,680],[952,468]],
 'left-stand':[[290,246],[400,840],[596,852],[764,820],[950,720],[970,564],[916,380],[812,324]],
 'left-walkA':[[286,134],[408,720],[592,870],[766,718],[948,822],[928,476],[974,330],[710,234]],
 'left-walkB':[[548,58],[380,222],[446,892],[648,744],[832,886],[972,688],[1000,354],[800,250]],
 'up-stand':[[210,294],[60,470],[84,782],[304,844],[720,844],[932,782],[964,470],[806,294]],
 'up-walkA':[[58,440],[172,538],[60,790],[338,780],[880,826],[750,656],[980,468],[810,306]],
 'up-walkB':[[198,290],[60,560],[280,650],[124,820],[658,780],[950,804],[854,504],[976,420]],
}
roots={'down':[512,804],'left':[512,900],'up':[512,860]};ground={'down':[-15,-20,30,20],'left':[-8,-26,23,26],'right':[-15,-26,23,26],'up':[-15,-20,30,20]}; atlas=Image.new('RGBA',(512,384));frames={};annotations=[]
contact=Image.new('RGB',(1536,1536),'#fff4d9');draw=ImageDraw.Draw(contact)
for d,col in [('down',0),('left',1),('up',3)]:
 for pose,row in [('stand',0),('walkA',1),('walkB',2)]:
  key=d+'-stand' if pose=='stand' else f"crab-{d}-{pose}-{'v2' if d=='down' and pose=='walkA' else 'v1'}";record=next(v for v in chain['sources'] if v['id']==key); assert record['selected'];p=Path(record['rawPath'])
  if not p.is_file(): p=R.parent/record['portableRawPath']
  assert sha(p)==record['sha256']
  raw=Image.open(p).convert('RGBA');assert raw.size==(1024,1024);raw.putalpha(raw.getchannel('A').point(lambda a:0 if a<=32 else a));b=raw.getbbox();assert b; scale=.056;small=raw.crop(b).resize((round((b[2]-b[0])*scale),round((b[3]-b[1])*scale)),Image.Resampling.NEAREST)
  foot=roots[d];offset=(64-round((foot[0]-b[0])*scale),88-round((foot[1]-b[1])*scale));assert min(offset)>=0 and max(offset[0]+small.width,offset[1]+small.height)<=128
  f=Image.new('RGBA',(128,128));f.alpha_composite(small,offset);name=f'{d}-{pose}'; atlas.alpha_composite(f,(col*128,row*128));bounds=f.getbbox(); assert bounds
  rel={'x':(bounds[0]-64)*.5,'y':(bounds[1]-88)*.5,'w':(bounds[2]-bounds[0])*.5,'h':(bounds[3]-bounds[1])*.5}
  buffer=io.BytesIO();f.save(buffer,format='PNG');frame_sha=hashlib.sha256(buffer.getvalue()).hexdigest()
  src={k:record[k] for k in ['taskId','requestId','url','sha256','references']};frames[name]={'column':col,'row':row,'anchor':[.5,88/128],'relative':rel,'source':src,'sourceRoot':foot,'consumerFrameSHA256':frame_sha,'mirror':False}
  gx,gy,gw,gh=ground[d];tips=points[name];assert len(tips)==8
  projected=[[(x-foot[0])*.028,(y-foot[1])*.028] for x,y in tips];assert all(gx<=x<=gx+gw and gy<=y<=gy+gh for x,y in projected),name
  annotations.append({'frame':name,'rawSha256':record['sha256'],'manualTipProjections':tips,'worldTipProjections':projected,'groundRect':ground[d],'precision':'manual approximate tip centers, +/-12 source pixels; conservative envelope adds margin; includes lifted swing projections, not inferred weight/contact physics','method':'visual trace eight segmented walking appendages; two raised pincers excluded; low shell lies inside support sweep; neither alpha hull nor changing lowest toe determines root'})
  cx=row*512;cy=['down','left','up'].index(d)*512;thumb=raw.resize((512,512),Image.Resampling.NEAREST);contact.paste(thumb,(cx,cy),thumb)
  for i,(x,y) in enumerate(tips):draw.ellipse((cx+x/2-4,cy+y/2-4,cx+x/2+4,cy+y/2+4),outline='#148f63',width=2);draw.text((cx+x/2+5,cy+y/2),str(i+1),fill='#148f63')
  draw.rectangle((cx+(foot[0]+gx/.028)/2,cy+(foot[1]+gy/.028)/2,cx+(foot[0]+(gx+gw)/.028)/2,cy+foot[1]/2),outline='#3264b7',width=2);draw.text((cx+8,cy+8),name,fill='#315e54')
  if d=='left':
   m=Image.new('RGBA',(128,128));m.alpha_composite(f.transpose(Image.Transpose.FLIP_LEFT_RIGHT),(1,0));atlas.alpha_composite(m,(256,row*128));mb=m.getbbox();buffer=io.BytesIO();m.save(buffer,format='PNG');mirror_sha=hashlib.sha256(buffer.getvalue()).hexdigest();frames['right-'+pose]={**frames[name],'column':2,'relative':{'x':(mb[0]-64)*.5,'y':(mb[1]-88)*.5,'w':(mb[2]-mb[0])*.5,'h':(mb[3]-mb[1])*.5},'mirror':True,'mirrorFrom':name,'consumerFrameSHA256':mirror_sha,'wholeMirrorRootTranslationPixels':[1,0]}
atlas.save(O/'crab-c1.png');x=min(f['relative']['x'] for f in frames.values());y=min(f['relative']['y'] for f in frames.values());envelope={'x':x,'y':y,'w':max(f['relative']['x']+f['relative']['w'] for f in frames.values())-x,'h':max(f['relative']['y']+f['relative']['h'] for f in frames.values())-y}
manifest={'schema':2,'id':'shore-crab-native-c1-v2','width':512,'height':384,'image':'crab-c1.png','atlasSHA256':sha(O/'crab-c1.png'),'nativeSources':9,'directionFrames':12,'uniformNearestScale':.056,'worldScale':.5,'localLimbEditing':False,'wholeFrameMirrorDirections':['right'],'frames':frames,'displayEnvelope':envelope,'displayGap':8,'rootContract':'fixed manually supported back-edge source root for all stand/A/B; world/event/depth foot same anchor','groundProfile':'shore-crab-native-c1-v2@2','ground':ground,'rights':'alteru-project-use-confirmed-20261003: same project/service scope applicability; no universal MIT/CC image license','productionEnabled':False,'libraryWrite':False}
(O/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n');(R/'src/animals/native-crab-manifest.json').write_text(json.dumps(manifest,indent=2)+'\n');(R.parent/'evidence/support-annotations.json').write_text(json.dumps({'schema':1,'profile':manifest['groundProfile'],'rootByNativeFacing':roots,'annotations':annotations,'rightFacing':'complete horizontal reflection, supporting rect reflected exactly; no asymmetrical markings','quantizationMargin':'ground rectangles reserve >=.5 world units beyond annotated projections; actual renderer rounds event foot, <=.5 additional quantization also protected by 8-unit display guard'},indent=2)+'\n');contact.save(R.parent/'evidence/support-contact.png'); print(json.dumps({'atlasSHA256':manifest['atlasSHA256'],'envelope':envelope,'nativeSources':9,'frames':12}))
