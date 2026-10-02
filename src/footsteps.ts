/** Distance-driven contacts. Pauses, teleports and room changes reset the cadence. */
export class FootstepCadence {
 private previous?:{x:number;y:number};
 private scene='';
 private distance=0;
 update(p:{x:number;y:number},scene:string,blocked:boolean){
  const moved=this.previous?Math.hypot(p.x-this.previous.x,p.y-this.previous.y):0;
  const changed=scene!==this.scene;this.previous={...p};this.scene=scene;
  if(changed||blocked||moved<.01||moved>=12){this.distance=0;return false}
  this.distance+=moved;
  if(this.distance<24)return false;
  this.distance%=24;return true;
 }
}
