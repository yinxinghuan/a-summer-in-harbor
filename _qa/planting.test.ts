import {test} from 'node:test';
import assert from 'node:assert/strict';
import {rooms} from '../src/world/data';
import {outdoors} from '../src/world/outdoors';
test('new planting is grounded on dry land; unpotted foliage stays off paving',()=>{
 for(const [scene,room] of Object.entries(rooms))for(const p of room.props.filter(p=>p.art.startsWith('flora-'))){
  const layout=outdoors[scene];if(!layout)continue;
  const t=layout.patches.slice().reverse().find(t=>p.at.x>=t.x&&p.at.x<t.x+t.w&&p.at.y>=t.y&&p.at.y<t.y+t.h);
  assert.ok(t&&t.material!=='water',`${scene}/${p.id} planted on dry ground`);
  if(!/herbs|pot-rubber/.test(p.art))assert.ok(t.material==='grass'||t.material==='sand',`${scene}/${p.id} natural planting on ${t.material}`);
 }
});
