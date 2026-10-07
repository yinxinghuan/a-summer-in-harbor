"""Read actual renderer screenshots; contact evidence only, never consumer art."""
from pathlib import Path
from PIL import Image,ImageDraw
import json
R=Path(__file__).resolve().parents[1];D=R.parent/'evidence/native-crab';report=json.loads((D/'REPORT.json').read_text());assert report['completed'] and len(report['cases'])==24
for width in [390,320]:
 sheet=Image.new('RGB',(1560,510),'#fff4d9');draw=ImageDraw.Draw(sheet)
 for row,scene in enumerate(['coast','beach','dock']):
  for col,direction in enumerate(['down','left','right','up']):
   c=next(c for c in report['cases'] if c['width']==width and c['scene']==scene and c['direction']==direction)
   for k,pose in enumerate(['stand','walkA','walkB']):
    state=c['trace'][k];p0,p1=state['projectedNativeBounds'];im=Image.open(D/f'platform-layout-{width}x{c["height"]}-{scene}-{direction}-{pose}.png').convert('RGB');box=(int(p0['x'])-4,int(p0['y']+state['canvasRect']['y'])-4,int(p1['x'])+5,int(p1['y']+state['canvasRect']['y'])+5);crop=im.crop(box);crop=crop.resize((crop.width*3,crop.height*3),Image.Resampling.NEAREST);x=(col*3+k)*130;y=row*170;sheet.paste(crop,(x+max(0,(130-crop.width)//2),y+37));draw.text((x+4,y+6),f'{scene}/{direction}',fill='#315e54');draw.text((x+4,y+20),pose,fill='#315e54')
 sheet.save(D/f'actual-renderer-{width}-native-gait-contact.png')
# Real continuous rAF coast/down; literal six actual frames, no tween or art edit.
c=next(c for c in report['cases'] if c['width']==390 and c['scene']=='coast' and c['direction']=='down');frames=[]
for n,state in enumerate(c['continuous']):
 im=Image.open(D/f'platform-layout-390x844-coast-down-continuous-{n}.png').convert('RGB');p0,p1=state['projectedNativeBounds'];box=(int(p0['x'])-24,int(p0['y']+state['canvasRect']['y'])-24,int(p1['x'])+25,int(p1['y']+state['canvasRect']['y'])+25);crop=im.crop(box).resize((344,316),Image.Resampling.NEAREST);frames.append(crop)
frames[0].save(D/'actual-rAF-coast-down.gif',save_all=True,append_images=frames[1:],duration=110,loop=0)
print('PASS two original screenshot gait contacts + literal six-frame rAF GIF')
