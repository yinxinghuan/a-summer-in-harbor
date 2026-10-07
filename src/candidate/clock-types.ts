export type MotionFields={scene:string;position:{x:number;y:number};townMinutes?:number;awakeMinutes?:number;energy:number;visited:string[];clock:Omit<MovingClock,'transport'>};
export type MotionAck={schema:1;id:string;mapVersion:1;baseVersion:number;version:number;cursor:number;ordinal:number;actionId:string;token:string;fields:MotionFields};
/** Injective bounded identity, disjoint from historical client-generated UUID action IDs. */
export const motionActionId=(journey:string,ordinal:number)=>`motion-${journey}-${ordinal}`;
export type MovingClock={version:2;millisecondsPerMinute:2000|4000;remainderMs:number;fractionalMs?:number;speedSlackUnits?:number;lease?:{id:string;boot:string;sequence:number;lastAt:number};transport?:{version:1;last:{digest:string;ack:MotionAck}}};
/** A compact patch is valid only against the exact head from which it was computed. */
export function applyMotionAck<T extends {id:string;mapVersion:1;version:number;cursor:number;movingClock?:MovingClock}>(head:T,ack:MotionAck):T{
 if(ack.schema!==1||ack.id!==head.id||ack.mapVersion!==head.mapVersion||ack.baseVersion!==head.version||ack.version!==head.version+1)throw Error('MOTION_HEAD_RESYNC');
 const {clock,...fields}=ack.fields;return {...head,...fields,version:ack.version,cursor:ack.cursor,movingClock:{...clock,transport:{version:1,last:{digest:'',ack}}}};
}
