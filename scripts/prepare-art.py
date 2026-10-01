"""Documented chroma removal, uniform scaling and assembly; never repaint source geometry."""
from pathlib import Path
from PIL import Image
import json,hashlib
ROOT=Path(__file__).resolve().parents[1]
keys=['hero-root-v2','cafe-counter','cafe-table','plant','wall-north','floor-stone','floor-wood','floor-grass','floor-sand','floor-water','house-cafe','bench','mara-root-v2','theo-root-v2','idris-root-v2','house-rental','house-grocery','canopy-tree','street-sign','flower-planter','june-root-v2','ruth-root-v2','luis-root-v2','nell-root-v2','elena-root-v2','arthur-root-v2','bed','luggage','workbench','noticeboard','driftwood','lantern','boxing-rack','bridge','fishing-kit','cafe-table-v2','door-front-v7','house-workshop','house-gym','market-stall','lighthouse-building','weather-building','camp-tent','coastal-rocks','harbor-crates','wooden-chair','bridge-broken','market-stall-closed','repair-closeup-dark','trail-map-closeup','bridge-photo']
layout=json.loads((ROOT/'doc/world-layout.json').read_text())
widths={}
for room in layout['rooms'].values() if isinstance(layout['rooms'],dict) else layout['rooms']:
 for p in room['props']:widths[p['art']]=max(widths.get(p['art'],0),p['width'])
meta_path=ROOT/'src/world/art-dimensions.json'
meta=json.loads(meta_path.read_text()) if meta_path.exists() else {}
for key in keys:
 src=ROOT/'doc/art'/key/'source.webp'
 if not src.exists():continue
 im=Image.open(src).convert('RGBA');px=im.load()
 if not key.startswith('floor'):
  for y in range(im.height):
   for x in range(im.width):
    r,g,b,a=px[x,y]
    if r>150 and b>140 and g<130 and min(r,b)-g>80:px[x,y]=(r,g,b,0)
  box=im.getbbox();im=im.crop(box)
 else:box=(0,0,im.width,im.height)
 originalSize=im.size
 if key in widths and im.width>int(widths[key]*3):
  target=int(widths[key]*3);im=im.resize((target,round(im.height*target/im.width)),Image.Resampling.NEAREST)
 out=ROOT/'public/art'/f'{key}.png';im.save(out)
 meta[key]={'width':im.width,'height':im.height,'sourceBounds':list(box),'sourceCropSize':list(originalSize),'uniformRuntimeScale':im.width/originalSize[0],'sourceSha':hashlib.sha256(src.read_bytes()).hexdigest(),'processedSha':hashlib.sha256(out.read_bytes()).hexdigest(),'process':'magenta colour key and tight crop, geometry unchanged' if not key.startswith('floor') else 'decode PNG, unchanged geometry','status':'runtime candidate'}
 # Stand-only diagnostic atlas until actual walking phases are admitted; never mark motion accepted.
 if key=='hero-root-v2':
  cell=128;scaled=im.resize((round(im.width*108/im.height),108),Image.Resampling.NEAREST);atlas=Image.new('RGBA',(cell*3,cell*4));
  for row in range(4):
   for col in range(3):atlas.alpha_composite(scaled,(col*cell+(cell-scaled.width)//2,row*cell+122-scaled.height))
  atlas.save(ROOT/'public/art/hero-diagnostic.png')
(ROOT/'src/world/art-dimensions.json').write_text(json.dumps(meta,indent=2))
