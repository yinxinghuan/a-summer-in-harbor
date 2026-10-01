from pathlib import Path
from PIL import Image,ImageOps
import json,hashlib
ROOT=Path(__file__).resolve().parents[1]
def cut(key):
 im=Image.open(ROOT/'doc/art'/key/'source.webp').convert('RGBA');p=im.load()
 for y in range(im.height):
  for x in range(im.width):
   r,g,b,a=p[x,y]
   if r>150 and b>140 and g<130 and min(r,b)-g>80:p[x,y]=(r,g,b,0)
 return im.crop(im.getbbox())
frames=[['hero-down-a','hero-root-v2','hero-down-b'],['hero-left-a','hero-left-stand','hero-left-b'],['hero-left-a','hero-left-stand','hero-left-b'],['hero-up-a','hero-up-stand','hero-up-b']]
atlas=Image.new('RGBA',(384,512));records=[]
for row,keys in enumerate(frames):
 for col,key in enumerate(keys):
  im=cut(key);im=im.resize((round(im.width*108/im.height),108),Image.Resampling.NEAREST)
  if row==2:im=ImageOps.mirror(im)
  atlas.alpha_composite(im,(col*128+(128-im.width)//2,row*128+122-im.height));records.append({'source':key,'row':row,'col':col,'mirror':row==2,'width':im.width,'visibleHeight':108})
atlas.save(ROOT/'public/art/hero.png')
(ROOT/'doc/art/hero-atlas.json').write_text(json.dumps({'cell':128,'visibleHeight':108,'footY':122,'worldHeight':56,'status':'candidate; runtime walk review pending','frames':records,'sha256':hashlib.sha256((ROOT/'public/art/hero.png').read_bytes()).hexdigest()},indent=2))
# Each NPC shares the hero's camera, visible world height and foot anchor.
for who in ['mara','theo','idris','june','ruth','luis','nell','elena','arthur']:
 a='idris-left-a-v4' if who=='idris' else who+'-left-a-v2';b=who+'-left-a' if who=='idris' else who+'-left-b-v3'
 walk=(ROOT/'doc/art'/b/'source.webp').exists() and (ROOT/'doc/art'/a/'source.webp').exists()
 rows=[[who+'-root-v2']*3,[a,who+'-left-stand',b] if walk else [who+'-left-stand']*3,[a,who+'-left-stand',b] if walk else [who+'-left-stand']*3,[who+'-up-stand']*3]
 out=Image.new('RGBA',(384,512))
 for row,keys in enumerate(rows):
  for col,key in enumerate(keys):
   im=cut(key);im=im.resize((round(im.width*108/im.height),108),Image.Resampling.NEAREST)
   if row==2:im=ImageOps.mirror(im)
   out.alpha_composite(im,(col*128+(128-im.width)//2,row*128+122-im.height))
 out.save(ROOT/'public/art'/('npc-'+who+'.png'))
# Combat frames retain their original common canvas coordinates; punching arms must
# not re-center the torso. Review body anchor before final acceptance.
for who in ['hero','idris']:
 for pose in ['guard','punch']:
  key=who+'-combat-'+pose
  im=cut(key);im.save(ROOT/'public/art'/(key+'.png'))
combat={}
for who in ['hero','idris']:
 for direction in ['left','down','up']:
  for pose in ['guard','punch']:
   key=who+'-combat-'+('' if direction=='left' else direction+'-')+pose
   if not (ROOT/'doc/art'/key/'source.webp').exists():continue
   sourceKey=key+'-v2' if key.endswith('-up-punch') else key
   im=cut(sourceKey)
   # Grounded lower-body center keeps an extended fist from shifting the torso.
   band=im.crop((0,int(im.height*.72),im.width,int(im.height*.9))).getbbox()
   anchor=(band[0]+band[2])/2/im.width if band else .5
   im.save(ROOT/'public/art'/(key+'.png'));combat[key]={'width':im.width,'height':im.height,'anchorX':anchor}
(ROOT/'src/world/combat-dimensions.json').write_text(json.dumps(combat,indent=2))
