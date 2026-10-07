import {motionRejectionStatus,type MotionRejectionCode} from '../src/candidate/motion-errors';
/** Construct only at an authored rejection before the motion writer commits. */
export class MotionRejection extends Error{
 readonly terminal=true;readonly code:MotionRejectionCode;readonly status:number;
 constructor(code:MotionRejectionCode){super(code);this.code=code;this.status=motionRejectionStatus[code]}
}
export function motionHttpFailure(error:unknown){
 return error instanceof MotionRejection
  ?{status:error.status,body:{error:error.code,terminal:true}}
  :{status:503,body:{error:'SERVICE_UNAVAILABLE',terminal:false}};
}
