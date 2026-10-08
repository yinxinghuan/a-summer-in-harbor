import {motionRejectionStatus,type MotionRejectionCode} from '../src/candidate/motion-errors';
/** Construct only at an authored rejection before the motion writer commits. */
export class MotionRejection extends Error{
 readonly terminal=true;readonly code:MotionRejectionCode;readonly status:number;
 readonly retryAfterMs?:number;
 constructor(code:MotionRejectionCode,retryAfterMs?:number){super(code);this.code=code;this.status=motionRejectionStatus[code];if(code==='MOTION_TOO_FAST'&&Number.isSafeInteger(retryAfterMs)&&retryAfterMs!>0&&retryAfterMs!<=1251)this.retryAfterMs=retryAfterMs}
}
export function motionHttpFailure(error:unknown){
 return error instanceof MotionRejection
  ?{status:error.status,body:{error:error.code,terminal:true,...(error.retryAfterMs===undefined?{}:{retryAfterMs:error.retryAfterMs})}}
  :{status:503,body:{error:'SERVICE_UNAVAILABLE',terminal:false}};
}
